const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  copyText:     (text) => ipcRenderer.send('copy-text', text),
  setFollowing: (val)  => ipcRenderer.send('set-following', val),
  quit:         ()     => ipcRenderer.send('quit-app'),

  // Color comes from cursor-free desktopCapturer path
  onColorUpdate:  (fn) => ipcRenderer.on('color-update',  (_e, data) => fn(data)),
  // Cursor position for zoom centering + window follow
  onCursorPos:    (fn) => ipcRenderer.on('cursor-pos',    (_e, data) => fn(data)),
  onCtrlState:    (fn) => ipcRenderer.on('ctrl-state',    (_e, held) => fn(held)),
  onFollowState:  (fn) => ipcRenderer.on('follow-state',  (_e, val)  => fn(val)),
});
