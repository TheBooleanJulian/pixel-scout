# Pixel Scout

A sleek, lightweight desktop application for live screen color picking and magnification. Built with Electron, Pixel Scout provides real-time color sampling from anywhere on your screen with an elegant overlay interface.

## Features

- **Live Color Picking**: Sample colors from any point on your screen in real-time
- **Magnifier Overlay**: Zoom in on screen areas for precise color selection
- **System Tray Integration**: Minimizes to tray for unobtrusive operation
- **Color Formats**: Supports HEX, RGB, and HSL color formats
- **Keyboard Shortcuts**: Quick access with customizable hotkeys
- **Transparent UI**: Modern glassmorphism design with backdrop blur

## Installation

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Setup
1. Clone the repository:
   ```bash
   git clone https://github.com/TheBooleanJulian/pixel-scout.git
   cd pixel-scout
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the application:
   ```bash
   npm start
   ```

## Usage

- Launch Pixel Scout using `npm start`
- The app will appear as an overlay window
- Move your cursor to sample colors
- Press Ctrl to activate color picking mode
- Colors are automatically copied to clipboard
- Minimize to system tray for background operation

## Development

### Building
```bash
npm run build
```

### Packaging
```bash
npm run package
```

## Technologies

- **Electron**: Cross-platform desktop app framework
- **HTML/CSS/JavaScript**: Frontend interface
- **Node.js**: Backend runtime

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Author

The Boolean Julian