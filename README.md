# DOS USB

A modern UI for playing DOS games from a USB stick. This application allows you to download, manage, and play classic DOS games using a sleek, modern interface.

## Architecture

This project follows Domain-Driven Design principles to create a maintainable and scalable codebase. See [DDD-ARCHITECTURE.md](./DDD-ARCHITECTURE.md) for detailed information about the architecture.

### Key Architecture Layers

- **Domain Layer**: Core business logic organized into bounded contexts
- **Application Layer**: Orchestrates domain operations and provides state management
- **Presentation Layer**: UI components and user interaction
- **Infrastructure Layer**: External concerns like file system access and DOSBox integration

## Features

- **Modern UI**: Clean, responsive interface for browsing and playing your DOS games
- **Portable**: Designed to run from a USB stick
- **Game Store**: Download classic DOS games directly from dosgames.com
- **Game Management**: Organize and manage your DOS game collection
- **DOSBox Integration**: Seamlessly launches games in DOSBox

## Getting Started

### Prerequisites

- Windows PC (Windows 10 or later recommended)
- DOSBox installed (or use the bundled version)

### Installation

#### For Users

1. Download the latest release from the [Releases page](https://github.com/webbertakken/dos-usb/releases)
2. Extract the contents to your USB drive
3. Run `DOSGamesPortable.exe` from your USB drive

#### For Developers

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Run the development server:
   ```
   npm run electron-dev
   ```

## Usage

### My Games

The home screen displays all your installed DOS games. You can:
- Search for games by title, description, or category
- Launch games with a single click
- Edit game metadata like title, description, and thumbnail

### Game Store

The Store tab lets you browse and download classic DOS games:
- Browse games by category
- Search for specific games
- Download games directly to your collection

### Settings

Configure your DOS USB environment:
- Set custom DOSBox path
- Set custom games directory
- View application information

## Building for Production

To build the application for production:

```
npm run electron-build
```

This will create a portable executable that can be run directly from a USB drive.

## Technical Details

This application is built with:
- [Next.js](https://nextjs.org/) - React framework
- [Electron](https://www.electronjs.org/) - Desktop application framework
- [Tailwind CSS](https://tailwindcss.com/) - CSS framework
- [Zustand](https://github.com/pmndrs/zustand) - State management

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [DOSBox](https://www.dosbox.com/) - DOS emulator
- [dosgames.com](https://www.dosgames.com/) - Source for DOS games
- All the original DOS game developers who created these classics

---

**Note**: This application does not include any games. Games must be downloaded separately and are subject to their own licensing terms.

## Development

For more information about development, see the following resources:

- [Domain Layer](./src/domain/README.md)
- [Application Layer](./src/application/README.md)
- [Presentation Layer](./src/presentation/README.md)
- [Infrastructure Layer](./electron/README.md)
