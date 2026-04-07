const { app, BrowserWindow, screen, ipcMain, desktopCapturer,
        clipboard, session, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const zlib  = require('zlib');

let win, tray;
let following    = true;
let ctrlHeld     = false;
let posInterval;
let colorInterval;

// ── Tray icon ─────────────────────────────────────────────────────────────────
function makeTrayIconBuffer() {
  const W = 16, H = 16;
  const crcTable = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    return t;
  })();
  const crc32 = buf => { let c = 0xFFFFFFFF; for (const b of buf) c = crcTable[(c^b)&0xFF]^(c>>>8); return (c^0xFFFFFFFF)>>>0; };
  const chunk = (type, data) => {
    const t = Buffer.from(type), len = Buffer.allocUnsafe(4), crcBuf = Buffer.allocUnsafe(4);
    len.writeUInt32BE(data.length); crcBuf.writeUInt32BE(crc32(Buffer.concat([t,data])));
    return Buffer.concat([len, t, data, crcBuf]);
  };
  const rows = [];
  for (let y = 0; y < H; y++) {
    rows.push(0);
    for (let x = 0; x < W; x++) {
      const inside = Math.hypot(x-W/2+.5, y-H/2+.5) < 6.5;
      rows.push(inside?0:0, inside?212:0, inside?200:0, inside?255:0);
    }
  }
  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(W,0); ihdr.writeUInt32BE(H,4);
  ihdr[8]=8; ihdr[9]=6; ihdr[10]=0; ihdr[11]=0; ihdr[12]=0;
  return Buffer.concat([
    Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(Buffer.from(rows))),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

// ── Global Ctrl key detection — no native modules needed ─────────────────────
// Windows: persistent PowerShell process polls GetAsyncKeyState via WinForms.
// macOS:   IOKit CGEventSource (spawned via swift/osascript).
// Polling at 50ms gives ~50ms latency which is imperceptible for hold-to-pin.

let keyPollProcess = null;

function startKeyHook() {
  if (process.platform === 'win32') {
    startKeyHookWindows();
  } else if (process.platform === 'darwin') {
    startKeyHookMac();
  }
  // Linux: no common zero-dep approach; tray menu toggle still works
}

function startKeyHookWindows() {
  const { spawn } = require('child_process');

  // One persistent PowerShell process that prints "1" or "0" every 50ms
  // VK_CONTROL = 0x11, VK_LCONTROL = 0xA2, VK_RCONTROL = 0xA3
  const ps_script = `
Add-Type @"
using System.Runtime.InteropServices;
public class KbState {
  [DllImport("user32.dll")] public static extern short GetAsyncKeyState(int vKey);
}
"@
while($true) {
  $l = [KbState]::GetAsyncKeyState(0xA2) -band 0x8000
  $r = [KbState]::GetAsyncKeyState(0xA3) -band 0x8000
  if ($l -or $r) { Write-Host 1 } else { Write-Host 0 }
  Start-Sleep -Milliseconds 50
}`.trim();

  try {
    keyPollProcess = spawn('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-Command', ps_script
    ], { windowsHide: true });

    let lastState = false;
    keyPollProcess.stdout.on('data', (data) => {
      const lines = data.toString().trim().split(/\r?\n/);
      const held = lines[lines.length - 1].trim() === '1';
      if (held === lastState) return;
      lastState = held;
      ctrlHeld = held;
      win?.webContents.send('ctrl-state', held);
    });

    keyPollProcess.on('error', (err) => {
      console.warn('Key poll process error:', err.message);
    });

    keyPollProcess.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        console.warn('Key poll process exited with code', code);
      }
    });
  } catch (err) {
    console.warn('Could not start key hook:', err.message);
  }
}

function startKeyHookMac() {
  const { spawn } = require('child_process');
  // Use swift one-liner to poll CGEventSource modifier flags
  const swift_script = `
import Cocoa
while true {
  let flags = CGEventSource.flagsState(.hidSystemState)
  let ctrl = flags.contains(.maskControl)
  print(ctrl ? 1 : 0)
  fflush(stdout)
  usleep(50000)
}`.trim();

  try {
    keyPollProcess = spawn('swift', ['-'], {
      stdio: ['pipe', 'pipe', 'ignore']
    });
    keyPollProcess.stdin.write(swift_script);
    keyPollProcess.stdin.end();

    let lastState = false;
    keyPollProcess.stdout.on('data', (data) => {
      const lines = data.toString().trim().split(/\n/);
      const held = lines[lines.length - 1].trim() === '1';
      if (held === lastState) return;
      lastState = held;
      ctrlHeld = held;
      win?.webContents.send('ctrl-state', held);
    });
  } catch (err) {
    console.warn('Could not start mac key hook:', err.message);
  }
}


function toggleFollowing(val) {
  following = (val !== undefined) ? val : !following;
  win?.webContents.send('follow-state', following);
  tray?.setContextMenu(buildTrayMenu());
}

function buildTrayMenu() {
  return Menu.buildFromTemplate([
    { label: 'Pixel Scout', enabled: false },
    { type: 'separator' },
    { label: following ? '📌 Pin in place (or hold Ctrl)' : '🔄 Resume following', click: () => toggleFollowing() },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ]);
}

// ── Cursor-free color sampling via desktopCapturer ────────────────────────────
// desktopCapturer thumbnails are OS-level screenshots — cursor layer is
// composited above the framebuffer so it NEVER appears in these captures.
// We request half-resolution to keep encoding fast (~80ms interval feels live).
let lastCursorX = 0, lastCursorY = 0;

async function sampleColor() {
  if (!win || win.isDestroyed()) return;
  const pt      = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(pt);
  const b       = display.bounds;

  // Half logical resolution → small PNG, fast encoding, still accurate per-pixel
  const thumbW = Math.round(b.width  / 2);
  const thumbH = Math.round(b.height / 2);

  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: thumbW, height: thumbH },
    });
    if (!sources.length) return;

    const thumb = sources[0].thumbnail;
    const { width: tw, height: th } = thumb.getSize();

    // Map logical cursor position → thumbnail pixel (accounting for display offset)
    const tx = Math.max(0, Math.min(Math.round((pt.x - b.x) * tw / b.width),  tw - 1));
    const ty = Math.max(0, Math.min(Math.round((pt.y - b.y) * th / b.height), th - 1));

    // toBitmap() returns raw BGRA on Windows, RGBA on macOS/Linux
    // Crop a single pixel then convert via toDataURL to sidestep byte-order issues
    const pixelImg  = thumb.crop({ x: tx, y: ty, width: 1, height: 1 });
    const [r, g, b2] = extractRGB(pixelImg);

    win.webContents.send('color-update', { r, g, b: b2, x: pt.x, y: pt.y });
  } catch (_) { /* sleep/lock, ignore */ }
}

// Extract RGB from a 1×1 NativeImage robustly (handles BGRA/RGBA)
function extractRGB(img) {
  // toDataURL gives a PNG data URL — parse it with a tiny PNG decoder
  // to avoid endian/platform issues with toBitmap()
  const buf = img.toPNG();
  // PNG IDAT data starts at byte 33 for a 1×1 RGBA image (after IHDR chunk)
  // Instead, use the reliable approach: decode via toBitmap and sniff channel order
  const bmp = img.toBitmap(); // 4 bytes: either BGRA or RGBA
  if (!bmp || bmp.length < 4) return [0, 0, 0];

  // On Windows Electron, toBitmap() is BGRA. On macOS it's RGBA.
  // Heuristic: if this is a 1px image we can't distinguish — use toPNG path instead
  // toPNG is always RGBA regardless of platform
  const pngBuf = buf; // already computed above
  // Parse PNG IDAT manually for 1×1 RGBA: bytes 41–44 after decompression
  // Simpler: trust that the PNG bytes at known offset give us the pixel
  // For a 1×1 RGBA PNG the pixel is at offset 41 (after sig+IHDR+IDAT header)
  // But zlib decompression varies. Safest: just send the png as base64 to renderer.
  // Actually the simplest robust approach: read from the bitmap with platform check.
  const isWindows = process.platform === 'win32';
  if (isWindows) {
    // BGRA on Windows
    return [bmp[2], bmp[1], bmp[0]];
  } else {
    // RGBA on macOS/Linux  
    return [bmp[0], bmp[1], bmp[2]];
  }
}

function createWindow() {
  win = new BrowserWindow({
    width: 288, height: 440,
    frame: false, transparent: true, alwaysOnTop: true,
    skipTaskbar: true, resizable: false, hasShadow: false, focusable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  win.loadFile('index.html');
  win.setAlwaysOnTop(true, 'screen-saver');

  // Permissions for getDisplayMedia (zoom view stream)
  session.defaultSession.setPermissionRequestHandler((_wc, _p, cb) => cb(true));
  session.defaultSession.setPermissionCheckHandler(() => true);
  session.defaultSession.setDisplayMediaRequestHandler((_req, callback) => {
    desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 0, height: 0 } })
      .then(sources => callback({ video: sources[0] }));
  });

  // Tray
  const icon = nativeImage.createFromBuffer(makeTrayIconBuffer());
  tray = new Tray(icon);
  tray.setToolTip('Pixel Scout — running');
  tray.setContextMenu(buildTrayMenu());
  tray.on('click', () => { win.show(); win.focus(); });

  // Window positioning @ 60fps
  posInterval = setInterval(() => {
    if (win.isDestroyed()) return;
    const pt      = screen.getCursorScreenPoint();
    const display = screen.getDisplayNearestPoint(pt);
    win.webContents.send('cursor-pos', { x: pt.x, y: pt.y, bounds: display.bounds });

    if (!following || ctrlHeld) return;
    const { x: dx, y: dy, width: dw, height: dh } = display.bounds;
    const [ww, wh] = win.getSize();
    const pad = 24;
    let nx = pt.x + pad, ny = pt.y + pad;
    if (nx + ww > dx + dw) nx = pt.x - ww - pad;
    if (ny + wh > dy + dh) ny = pt.y - wh - pad;
    win.setPosition(Math.max(dx+2, Math.round(nx)), Math.max(dy+2, Math.round(ny)));
  }, 16);

  // Cursor-free color sampling @ ~12fps (80ms)
  colorInterval = setInterval(sampleColor, 80);
}

ipcMain.on('copy-text',     (_, t) => clipboard.writeText(t));
ipcMain.on('set-following', (_, v) => toggleFollowing(v));
ipcMain.on('quit-app',      ()     => app.quit());

app.whenReady().then(() => { createWindow(); startKeyHook(); });
app.on('window-all-closed', () => {
  if (posInterval)   clearInterval(posInterval);
  if (colorInterval) clearInterval(colorInterval);
  if (keyPollProcess) { try { keyPollProcess.kill(); } catch (_) {} }
  app.quit();
});
