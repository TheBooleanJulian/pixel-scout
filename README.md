<div align="center">

# Pixel Scout

**Live screen color picker and magnifier overlay for designers and developers.**

![Electron](https://img.shields.io/badge/-Electron-47848F?logo=electron&logoColor=white)
![JavaScript](https://img.shields.io/badge/-JavaScript-F7DF1E?logo=javascript&logoColor=black)
![HTML](https://img.shields.io/badge/-HTML-E34F26?logo=html5&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-00D4C8.svg)

</div>

---

## What it does

Pixel Scout is a lightweight Electron desktop app that lets you sample colors from anywhere on your screen in real time. Move your cursor over any pixel to instantly read its HEX, RGB, or HSL value, with a magnifier overlay for precision work. It sits quietly in the system tray until you need it, making it a low-friction tool for designers and developers who frequently need to match or reference on-screen colors.

## Features

- **Live color picking** — sample any pixel on screen in real time
- **Magnifier overlay** — zoom into screen areas for precise selection
- **Multiple color formats** — instant HEX, RGB, and HSL output
- **Auto clipboard copy** — picked color is copied automatically
- **System tray integration** — runs unobtrusively in the background
- **Glassmorphism UI** — transparent overlay with modern backdrop blur
- **Keyboard shortcuts** — quick activation without touching the mouse

## Tech Stack

| Layer | Choice |
|---|---|
| Desktop runtime | Electron |
| Interface | Single-file HTML + JavaScript |
| Entry point | `main.js` (Electron main) + `preload.js` |
| Launch helpers | `start.bat` (Windows), `start.sh` (Unix), `launch.vbs` (silent Windows launch) |

## Quick Start

```bash
git clone https://github.com/TheBooleanJulian/pixel-scout.git
cd pixel-scout
npm install
npm start
```

**Prerequisites:** Node.js v14+ and npm.

## Project Structure

```
pixel-scout/
|-- main.js          # Electron main process
|-- preload.js       # Electron preload script
|-- index.html       # Overlay UI
|-- start.bat        # Windows launcher
|-- start.sh         # Unix launcher
|-- launch.vbs       # Silent Windows launcher
`-- package.json
```

## Status / Roadmap

- [x] Live color sampling with overlay
- [x] HEX, RGB, HSL format support
- [x] System tray integration
- [x] Clipboard auto-copy
- [ ] Customisable keyboard shortcuts
- [ ] Packaged distributable builds

## Changelog

- **Apr 2026** — Initial public release: Electron color picker with magnifier overlay, system tray support, multi-format output, and glassmorphism UI

## License

MIT

---

<div align="center">
<sub>Built by <a href="https://github.com/TheBooleanJulian">@TheBooleanJulian</a></sub>
</div>