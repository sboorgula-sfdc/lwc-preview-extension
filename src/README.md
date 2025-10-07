# LWC Preview Extension - Source Code

## Quick Overview

This directory contains the refactored source code for the LWC Preview extension, organized using a service-oriented architecture.

## Directory Structure

```
src/
├── constants.ts              # Application constants
├── types.ts                  # TypeScript type definitions
├── extension.ts              # Main extension entry point
├── services/                 # Service layer
│   ├── StatusBarManager.ts
│   ├── DependencyManager.ts
│   ├── ProjectSetupService.ts
│   ├── ServerManager.ts
│   ├── PreviewPanelManager.ts
│   └── FileWatcherService.ts
└── utils/                    # Utility functions
    ├── componentResolver.ts
    ├── errorHandler.ts
    ├── fileSystem.ts
    └── previewHtml.ts
```

## Service Responsibilities

| Service | Purpose | Key Methods |
|---------|---------|-------------|
| `StatusBarManager` | Manage VS Code status bar | `showLoading()`, `showReady()`, `showError()` |
| `DependencyManager` | Handle npm dependencies | `ensureInstalled()` |
| `ProjectSetupService` | Setup LWR base project | `setupLwrBaseProject()` |
| `ServerManager` | Manage LWR server lifecycle | `start()`, `stop()`, `isReady` |
| `PreviewPanelManager` | Manage webview preview panel | `show()`, `updateComponent()` |
| `FileWatcherService` | Watch and sync LWC files | `setup()`, `initialSync()` |

## Key Files

### `extension.ts`
Main orchestrator class that:
- Coordinates all services
- Handles VS Code extension lifecycle
- Manages activation/deactivation
- Registers commands and event handlers

### `constants.ts`
Centralized configuration:
- Server port, paths, timeouts
- Message type enums
- Configuration values

### `types.ts`
TypeScript definitions:
- Interface definitions
- Message types
- Service contracts

## Utility Modules

### `componentResolver.ts`
Parse and extract LWC component information from file paths.

**Functions:**
- `getComponentInfo(filePath)` - Extract component info
- `isLwcFile(filePath)` - Check if file is LWC
- `getComponentName(filePath)` - Get component name

### `errorHandler.ts`
Custom error types and LWR error parsing.

**Error Classes:**
- `LwcPreviewError` - Base error
- `ProjectSetupError` - Setup failures
- `ServerStartError` - Server issues
- `FileSyncError` - File sync problems

**Functions:**
- `parseLwrError(output)` - Parse LWR error output
- `formatErrorForDisplay(error)` - Format user messages

### `fileSystem.ts`
File system operations and synchronization.

**Functions:**
- `copyFile(src, dest)` - Copy single file
- `copyDirectoryOptimized(src, dest)` - Smart directory copy
- `shouldCopyFile(src, dest)` - Check if copy needed
- `cleanupComponentFolder(path)` - Cleanup on deactivation
- `ensureDirectory(path)` - Safe directory creation

### `previewHtml.ts`
Generate HTML for webview preview panel.

**Functions:**
- `getLoadingHtml()` - Loading state HTML
- `getErrorHtml(message)` - Error state HTML
- `getPreviewHtml(component, port)` - Main preview HTML

## Development Guidelines

### Adding New Features

1. **Identify the concern**: Which service should handle this?
2. **Update service**: Add methods to appropriate service
3. **Update extension.ts**: Wire up new functionality
4. **Update types**: Add new interfaces if needed
5. **Test**: Verify in isolation and integration

### Error Handling

Always use custom error types:
```typescript
throw new ProjectSetupError(
    'Setup failed',
    originalError
);
```

### Logging

Use the `LOG_PREFIX` constant:
```typescript
console.log(`${LOG_PREFIX} Operation completed`);
```

### Type Safety

Always define types for:
- Function parameters
- Return values
- Message structures
- Service state

## Common Tasks

### Add New Service

1. Create new file in `services/`
2. Export class with clear responsibility
3. Add to `extension.ts` constructor
4. Initialize in `activate()` method

### Add New Constant

Add to `constants.ts`:
```typescript
export const NEW_CONSTANT = value;
```

### Add New Type

Add to `types.ts`:
```typescript
export interface NewType {
    property: string;
}
```

### Modify Error Handling

Update `errorHandler.ts`:
```typescript
export class NewError extends LwcPreviewError {
    constructor(message: string, originalError?: Error) {
        super(message, originalError);
        this.name = 'NewError';
    }
}
```

## Testing

### Manual Testing Steps

1. Open SFDX project in VS Code
2. Verify status bar shows "LWC Preview"
3. Open LWC component file
4. Verify preview opens automatically
5. Edit component file
6. Verify preview updates
7. Introduce error in component
8. Verify error displays
9. Fix error
10. Verify error clears

### Service Testing

Each service can be tested independently by:
1. Mocking dependencies
2. Creating service instance
3. Calling methods
4. Verifying behavior

## Code Style

- Use TypeScript strict mode
- Always specify types
- Use async/await for async operations
- Handle errors with try/catch
- Document public methods with JSDoc
- Use meaningful variable names
- Keep functions small and focused

## Best Practices

1. **Single Responsibility**: Each service does one thing
2. **Dependency Injection**: Pass dependencies in constructor
3. **Error Handling**: Use custom error types
4. **Resource Cleanup**: Always dispose resources
5. **Type Safety**: Use TypeScript features
6. **Documentation**: Comment complex logic
7. **Logging**: Log important operations

## Troubleshooting

### Common Issues

**Extension not activating:**
- Check if SFDX project exists
- Verify sfdx-project.json present

**Server not starting:**
- Check node_modules installed
- Verify port 8347 available
- Check terminal output

**Preview not updating:**
- Verify file watcher active
- Check file sync status
- Look for errors in console

**Compilation errors:**
- Run `npm run compile`
- Check for TypeScript errors
- Verify all imports correct

## Resources

- [REFACTORING_SUMMARY.md](../REFACTORING_SUMMARY.md) - Detailed refactoring notes
- [ARCHITECTURE.md](../ARCHITECTURE.md) - Architecture diagrams and flows
- [VS Code Extension API](https://code.visualstudio.com/api)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)

## Maintenance

### Regular Tasks

- Keep dependencies updated
- Review and improve error messages
- Add logging where helpful
- Optimize file synchronization
- Improve type definitions

### Code Quality Checks

```bash
# Compile TypeScript
npm run compile

# Run linter
npm run lint

# Watch mode for development
npm run watch
```

---

**Maintainers**: Review this document when onboarding new contributors  
**Last Updated**: During Refactoring  
**Code Quality**: ⭐⭐⭐⭐⭐

