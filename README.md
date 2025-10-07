# LWC Preview

Preview Lightning Web Components directly in VS Code with live updates and instant feedback.

## Overview

LWC Preview is a VS Code extension that enables developers to preview their Lightning Web Components in real-time without leaving the editor. It uses Lightning Web Runtime (LWR) to provide a fast, accurate preview experience that mirrors how components behave in production.

## Features

- **🚀 Auto-Launch Preview**: Automatically opens preview when you open LWC component files
- **🔄 Real-Time Sync**: File changes are instantly reflected in the preview
- **🔀 Smart Component Switching**: Preview automatically updates when switching between component files
- **❌ Error Handling**: Shows LWR compilation errors with detailed stack traces and error messages
- **📊 Status Bar Integration**: Visual indicator showing server status and activity
- **⚡ Optimized Performance**: Smart file watching and optimized component syncing
- **🎨 Salesforce Lightning Design System**: Built-in SLDS styling support
- **🔧 Automatic Dependency Management**: Handles npm dependencies automatically

## Requirements

- **VS Code**: Version 1.85.0 or higher
- **Node.js**: Any recent version (required for running LWR server)
- **SFDX Project**: Must have `sfdx-project.json` in workspace root
- **LWC Components**: Components should be in `force-app/main/default/lwc`

## Installation

### From VSIX File

1. Download the latest `.vsix` file from releases
2. In VS Code, open Command Palette (`Cmd+Shift+P` or `Ctrl+Shift+P`)
3. Run: `Extensions: Install from VSIX...`
4. Select the downloaded `.vsix` file

### From Source (Development)

```bash
# Clone the repository
git clone https://github.com/sboorgula-sfdc/lwc-preview-extension.git
cd lwc-preview-extension

# Install dependencies
npm run init

# Compile the extension
npm run compile

# Package the extension (optional)
npm run vscode:package
```

## Usage

### Quick Start

1. **Open an SFDX Project** in VS Code
2. **Open any LWC component file** (`.html`, `.js`, or `.css`)
3. The preview will **automatically open** in a side panel
4. Start editing your component and see changes instantly!

### Manual Toggle

- Click the **preview icon** (📄) in the editor toolbar
- Or run command: **`Toggle LWC Preview`** from Command Palette

### Status Bar

The status bar indicator shows the current state:
- `$(loading~spin) LWC Preview` - Starting up or syncing
- `$(check) LWC Preview` - Ready and running
- `$(warning) LWC Preview` - Warning state
- `$(error) LWC Preview` - Error state

Hover over the indicator for more details.

## How It Works

### Architecture

1. **Extension Activation**: When you open an SFDX project, the extension:
   - Validates the project structure
   - Extracts the LWR base project to VS Code's global storage
   - Installs required dependencies (if not already installed)
   - Starts the LWR dev server on port 8347

2. **Component Syncing**: 
   - On activation, all components from `force-app/main/default/lwc` are copied to the LWR project
   - File watchers monitor changes and sync them in real-time
   - Only relevant files are copied (JS, HTML, CSS, SVG, etc.)

3. **Preview Rendering**:
   - The preview panel embeds the LWR server's output
   - Component switching is handled via iframe communication
   - Errors from LWR are captured and displayed with formatting

4. **Cleanup**:
   - When the extension deactivates, the LWR server is gracefully terminated
   - Component folders are cleaned up to free disk space

### File Structure

```
lwc-preview-ext/
├── src/
│   ├── extension.ts           # Main extension logic
│   └── utils/
│       ├── componentResolver.ts   # Component detection
│       ├── errorHandler.ts        # LWR error parsing
│       ├── fileSystem.ts          # File operations
│       └── previewHtml.ts         # Webview HTML generation
├── lwr-base-project/          # Base LWR project
│   ├── src/
│   │   ├── modules/
│   │   │   ├── c/             # Synced LWC components
│   │   │   └── demo/          # Preview container components
│   │   ├── assets/            # SLDS CSS
│   │   └── layouts/           # HTML layout
│   ├── lwr.config.json        # LWR configuration
│   └── package.json           # LWR dependencies
└── package.json               # Extension metadata
```

## Configuration

The extension uses the following defaults:
- **LWR Server Port**: 8347
- **Component Source**: `force-app/main/default/lwc`
- **Storage Location**: VS Code global storage (versioned by extension version)

Currently, these are not configurable but may be in future versions.

## Development

### Building

```bash
# Compile TypeScript
npm run compile

# Watch mode for development
npm run watch

# Build the zip archive of lwr-base-project
npm run build:zip

# Full build (zip + compile)
npm run vscode:prepublish
```

### Packaging

```bash
# Package extension (increments version automatically)
npm run vscode:package
```

This will:
1. Build the lwr-base-project zip
2. Compile TypeScript
3. Increment patch version
4. Create a `.vsix` file

### Project Scripts

- `npm run init` - Install all dependencies (extension + lwr-base-project)
- `npm run compile` - Compile TypeScript
- `npm run watch` - Watch mode for development
- `npm run lint` - Run ESLint
- `npm run build:zip` - Create lwr-base-project.zip
- `npm run vscode:prepublish` - Full build for publishing
- `npm run vscode:package` - Package extension as VSIX

## Troubleshooting

### Preview doesn't open
- **Check**: Is this an SFDX project? Look for `sfdx-project.json`
- **Check**: Are components in `force-app/main/default/lwc`?
- **Check**: Status bar indicator for error messages

### Server won't start
- **Check**: Is port 8347 already in use?
- **Check**: Are Node.js and npm installed?
- **Check**: Output panel → "Extension Host" for error logs

### Components not updating
- **Try**: Close and reopen the preview
- **Try**: Save the file explicitly (`Cmd+S` or `Ctrl+S`)
- **Check**: Console logs for sync errors

### Error: "Failed to install dependencies"
- **Check**: Internet connection
- **Check**: npm is accessible from command line
- **Try**: Delete global storage folder and restart VS Code
- **Location**: Check Output panel for global storage path

### Performance issues
- Large projects with many components may take longer to sync initially
- Subsequent syncs are optimized and should be fast
- Consider closing the preview when not actively using it

## Known Limitations

- Only works with SFDX project structure
- Requires components in `force-app/main/default/lwc`
- Port 8347 must be available
- Components must be valid LWC syntax (enforced by LWR)
- No support for custom LWR configurations yet

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details

## Repository

[https://github.com/sboorgula-sfdc/lwc-preview-extension](https://github.com/sboorgula-sfdc/lwc-preview-extension)

## Changelog

### 0.0.4
- Improved dependency management
- Enhanced error handling
- Status bar integration
- Auto-launch preview functionality
- Optimized file syncing

---

**Made with ❤️ for Salesforce Developers**
