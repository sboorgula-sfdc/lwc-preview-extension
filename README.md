# LWC Preview

Preview Lightning Web Components directly in VS Code.

## Features

- **Live Preview**: View your LWC components as you develop them
- **Auto-Sync**: Automatically syncs components from `force-app/main/default/lwc` to preview
- **Component Switching**: Preview automatically updates when you switch between components
- **Error Display**: Shows LWR compilation errors with detailed stack traces
- **SFDX Integration**: Works seamlessly with Salesforce DX projects

## Requirements

- VS Code 1.85.0 or higher
- Node.js installed
- SFDX project with `sfdx-project.json`
- LWC components in `force-app/main/default/lwc`

## Usage

1. Open an SFDX project in VS Code
2. Open any LWC component file (`.html` or `.js`)
3. Click the preview icon in the editor toolbar, or run command: `Toggle LWC Preview`
4. The preview will open in a side panel showing your component

## How It Works

- The extension starts an LWR server on port 8347
- Components from `force-app/main/default/lwc` are synced to the preview environment
- Changes to your components are automatically reflected in the preview
- Switching between component files updates the preview automatically

## License

MIT

