# LWC Preview Extension - Architecture & Implementation

## Overview

This document describes the architecture, design decisions, and implementation details of the LWC Preview VS Code extension. The extension enables real-time preview of Lightning Web Components during development.

**Architecture Version:** 2.1  
**Extension Version:** 0.0.4+

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [File Structure](#file-structure)
3. [Service Layer](#service-layer)
4. [Utility Layer](#utility-layer)
5. [Interaction Flows](#interaction-flows)
6. [Recent Features](#recent-features)
7. [Design Patterns](#design-patterns)
8. [Best Practices](#best-practices)

---

## Architecture Overview

### System Architecture

The extension follows a **service-oriented architecture** with clear separation of concerns:

```
┌───────────────────────────────────────────────────────────────────┐
│                         VS Code Extension Host                    │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                  LwcPreviewExtension                        │  │
│  │                  (Main Orchestrator)                        │  │
│  │                                                             │  │
│  │  - Coordinates all services                                 │  │
│  │  - Manages extension lifecycle                              │  │
│  │  - Handles VS Code integration                              │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                              │                                    │
│                ┌─────────────┴─────────────┐                      │
│                │                           │                      │
│  ┌─────────────▼────────┐    ┌─────────────▼────────┐             │
│  │  StatusBarManager    │    │ ProjectSetupService  │             │
│  │                      │    │                      │             │
│  │ - Status updates     │    │ - LWR base setup     │             │
│  │ - User feedback      │    │ - Version mgmt       │             │
│  └──────────────────────┘    └──────────────────────┘             │
│                                                                   │
│  ┌──────────────────────┐    ┌──────────────────────┐             │
│  │  DependencyManager   │    │   ServerManager      │             │
│  │                      │    │                      │             │
│  │ - npm install        │    │ - Start/stop server  │             │
│  │ - Dependency check   │    │ - Error handling     │             │
│  └──────────────────────┘    └──────────────────────┘             │
│                                         │                         │
│  ┌──────────────────────┐    ┌──────────▼───────────┐             │
│  │ FileWatcherService   │    │ PreviewPanelManager  │             │
│  │                      │    │                      │             │
│  │ - File sync          │◄───┤ - Webview panel      │             │
│  │ - Change detection   │    │ - Component preview  │             │
│  └──────────────────────┘    └──────────────────────┘             │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────┐
│                         Utility Layer                             │
│                                                                   │
│  ┌──────────────────┐  ┌───────────────────┐  ┌───────────────┐   │
│  │ componentResolver│  │  errorHandler     │  │  fileSystem   │   │
│  │                  │  │                   │  │               │   │
│  │ - Parse paths    │  │ - Error types     │  │ - Copy files  │   │
│  │ - Extract info   │  │ - Error parsing   │  │ - Sync logic  │   │
│  └──────────────────┘  └───────────────────┘  └───────────────┘   │
│                                                                   │
│  ┌──────────────────┐  ┌───────────────────┐  ┌───────────────┐   │
│  │  previewHtml     │  │   constants       │  │    types      │   │
│  │                  │  │                   │  │               │   │
│  │ - HTML templates │  │ - Configuration   │  │ - Interfaces  │   │
│  │ - Webview content│  │ - Magic values    │  │ - Type defs   │   │
│  └──────────────────┘  └───────────────────┘  └───────────────┘   │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

### Before vs After Refactoring

| Aspect | Before | After |
|--------|--------|-------|
| **Structure** | Monolithic (612 lines) | Service-oriented (270 lines main) |
| **State Management** | 11 global variables | 0 global variables |
| **Concerns** | Mixed in one file | Separated by service |
| **Error Handling** | Basic messages | Custom error hierarchy |
| **Constants** | Hard-coded throughout | Centralized in one file |
| **Testability** | Difficult | Easy (mockable services) |

---

## File Structure

```
src/
├── constants.ts              # Application-wide constants
├── types.ts                  # TypeScript type definitions
├── extension.ts              # Main extension orchestrator
├── services/                 # Service classes
│   ├── StatusBarManager.ts      - Status bar UI management
│   ├── DependencyManager.ts     - npm dependency handling
│   ├── ProjectSetupService.ts   - LWR project initialization
│   ├── ServerManager.ts         - LWR server lifecycle
│   ├── PreviewPanelManager.ts   - Webview panel management
│   └── FileWatcherService.ts    - File synchronization
└── utils/                    # Utility functions
    ├── componentResolver.ts     - Component path parsing
    ├── errorHandler.ts          - Error types & parsing
    ├── fileSystem.ts            - File operations
    └── previewHtml.ts           - HTML templates
```

### Core Files

#### `constants.ts`
Centralized configuration and magic values:
- Server ports, paths, timeouts
- Message type enums
- Configuration keys

#### `types.ts`
TypeScript interfaces and types:
- `ComponentInfo`, `LwrErrorInfo`
- Message types for webview communication
- Service configuration interfaces

#### `extension.ts`
Main orchestrator class (270 lines):
```typescript
class LwcPreviewExtension {
    // Service instances
    private statusBarManager: StatusBarManager;
    private projectSetupService: ProjectSetupService;
    private dependencyManager: DependencyManager | null;
    private serverManager: ServerManager | null;
    private previewPanelManager: PreviewPanelManager;
    private fileWatcherService: FileWatcherService | null;
    
    public async activate(): Promise<void>
    public deactivate(): void
}
```

---

## Service Layer

### StatusBarManager
**Purpose:** Manage VS Code status bar item

**Key Methods:**
- `initialize()` - Create and show status bar
- `showLoading(tooltip)` - Display loading state
- `showSyncing(tooltip)` - Display sync state
- `showReady(port)` - Display ready state
- `showWarning(tooltip)` / `showError(tooltip)` - Error states
- `dispose()` - Cleanup

**States:**
- Loading: `$(loading~spin) LWC Preview`
- Syncing: `$(sync~spin) LWC Preview`
- Ready: `$(check) LWC Preview`
- Warning: `$(warning) LWC Preview`
- Error: `$(error) LWC Preview`

---

### ProjectSetupService
**Purpose:** Setup LWR base project in global storage

**Key Methods:**
- `setupLwrBaseProject()` - Main orchestration
- `extractFromZip()` - Extract from packaged .zip
- `copyFromSource()` - Copy from source (dev mode)
- `getExtensionVersion()` - Version management

**Features:**
- Version-aware folder management
- Handles both packaged and dev scenarios
- Uses VS Code's global storage for proper permissions
- Automatic fallback between zip and copy methods

---

### DependencyManager
**Purpose:** Handle npm dependency installation

**Key Methods:**
- `ensureInstalled()` - Check and install if needed
- `runNpmInstall()` - Execute npm install with error handling

**Features:**
- Smart dependency checking (checks for node_modules and lwr package)
- Progress reporting via status bar
- Proper error handling and user notifications

---

### ServerManager
**Purpose:** Manage LWR server lifecycle

**Key Methods:**
- `start()` - Start LWR server process
- `stop()` - Stop server and cleanup
- `setErrorCallback(callback)` - Register error handler
- `isReady` - Property for server readiness status

**Features:**
- Process spawning with proper stdio handling
- Stdout/stderr monitoring
- Debounced error handling (500ms)
- Automatic server-ready detection
- Proper process cleanup on deactivation

---

### PreviewPanelManager
**Purpose:** Manage webview panel for component preview

**Key Methods:**
- `show(componentInfo, serverReady)` - Create/show panel
- `updateComponent(componentName)` - Update displayed component
- `sendLwrError(errorInfo)` / `clearLwrError()` - Error management
- `updateLoadingState(isLoading, text)` - Loading state
- `isAutoOpenEnabled()` - Check auto-open setting
- `toggleAutoOpen(enabled)` - Toggle and persist setting

**Features:**
- Single panel enforcement (reuses existing panel)
- Auto-open toggle functionality
- Webview message handling
- Error overlay display
- Loading state management
- Component switching without recreating panel

**Auto-Open Feature:**
- Toggle switch in preview header
- Persists to workspace configuration
- Two modes: Auto-open (enabled) and Manual (disabled)

---

### FileWatcherService
**Purpose:** Watch and sync LWC files between SFDX and LWR projects

**Key Methods:**
- `setup()` - Initialize file system watcher
- `initialSync()` - Perform initial component sync
- `handleFileChange(filePath)` - Handle creation/modification
- `handleFileDelete(filePath)` - Handle deletion
- `isInitialCopyRunning()` - Check sync status
- `dispose()` - Cleanup

**Features:**
- Optimized file copying (only changed files)
- Real-time file synchronization
- Progress tracking capability
- Automatic error clearing on file changes

---

## Utility Layer

### componentResolver.ts
**Purpose:** Parse and extract LWC component information from file paths

**Functions:**
- `getComponentInfo(filePath)` - Extract component info
- `isLwcFile(filePath)` - Check if file is LWC
- `getComponentName(filePath)` - Get component name only

**Features:**
- Path normalization
- Input validation
- Comprehensive JSDoc documentation

---

### errorHandler.ts
**Purpose:** Custom error types and LWR error parsing

**Error Hierarchy:**
```
Error
└── LwcPreviewError
    ├── ProjectSetupError
    ├── ServerStartError
    └── FileSyncError
```

**Functions:**
- `parseLwrError(output)` - Parse LWR server error output
- `formatErrorForDisplay(error)` - User-friendly formatting

**Error Types:**
- `LWC_COMPILATION` - LWC compilation errors
- `TEMPLATE` - Template syntax errors
- `MODULE_RESOLUTION` - Import/module errors
- `SYNTAX` - JavaScript syntax errors
- `GENERIC` - Other errors

---

### fileSystem.ts
**Purpose:** File system operations and synchronization

**Functions:**
- `copyFile(src, dest)` - Copy single file
- `copyDirectoryOptimized(src, dest, onProgress)` - Smart directory copy
- `shouldCopyFile(src, dest)` - Check if copy needed (timestamp/size)
- `cleanupComponentFolder(path)` - Cleanup on deactivation
- `ensureDirectory(path)` - Safe directory creation
- `pathExists(path)` - Check existence
- `isDirectory(path)` - Validate directory

**Features:**
- Optimized copying (only changed files)
- Progress callbacks
- Custom error types
- Enhanced logging

---

### previewHtml.ts
**Purpose:** Generate HTML for webview preview panel

**Functions:**
- `getLoadingHtml()` - Loading state HTML
- `getErrorHtml(message)` - Error state HTML
- `getPreviewHtml(component, port, autoOpenEnabled)` - Main preview HTML

**Features:**
- iOS-style toggle switch for auto-open
- Error overlay with stack trace
- Loading overlay with spinner
- Message passing between webview and extension
- Responsive design

---

## Interaction Flows

### Extension Activation

```
User opens VS Code with SFDX project
         ↓
  activate(context)
         ↓
  StatusBarManager.initialize() → Show "Loading..."
         ↓
  Check if SFDX project → Exit if not
         ↓
  ProjectSetupService.setupLwrBaseProject()
         ↓
  DependencyManager.ensureInstalled()
         ↓
  ServerManager.start()
         ↓
  FileWatcherService.setup()
         ↓
  FileWatcherService.initialSync()
         ↓
  Wait for server ready
         ↓
  Auto-open preview (if enabled and LWC file open)
```

### File Change Flow

```
User edits LWC file
         ↓
  FileSystemWatcher detects change
         ↓
  FileWatcherService.handleFileChange()
         ↓
  shouldCopyFile() check (timestamp/size)
         ↓
  copyFile() to LWR project
         ↓
  PreviewPanelManager.clearLwrError()
         ↓
  LWR server hot-reloads → Preview updates
```

### Preview Opening Flow

```
User switches to LWC component file
         ↓
  onDidChangeActiveTextEditor event
         ↓
  getComponentInfo(filePath)
         ↓
  Check if auto-open enabled
         ↓
  If enabled → PreviewPanelManager.show()
         ↓
  Check if panel exists → Reuse if yes
         ↓
  Check if server ready
         ↓
  Show preview content or loading state
```

### Error Handling Flow

```
LWR Server encounters error
         ↓
  ServerManager.handleServerError()
         ↓
  Debounce errors (500ms)
         ↓
  parseLwrError() → Determine error type
         ↓
  Invoke error callback
         ↓
  PreviewPanelManager.sendLwrError()
         ↓
  Display in webview overlay
         ↓
  Show VS Code notification
```

---

## Recent Updates

### Bug Fixes

#### Component Deletion Not Syncing
**Problem:** Deleted components/files from `force-app/main/default/lwc` weren't removed from lwr-base-project.

**Solution:**
- Enhanced `FileWatcherService.handleFileDelete()` to handle both files and directories
- Uses `fs.statSync()` to distinguish between file and directory deletions
- Recursively deletes component directories
- Automatically closes preview if deleted component was being shown

**Impact:** Orphaned files eliminated, proper cleanup maintained.

#### New Component Creation Not Copied
**Problem:** New components created in `force-app/main/default/lwc` weren't synced to lwr-base-project.

**Solution:**
- Enhanced `FileWatcherService.handleFileChange()` to detect directory creation
- Automatically copies entire component directories
- Uses optimized copying (only changed files)

**Impact:** New components immediately available, no restart needed.

#### Missing Component Validation
**Problem:** Preview could open for incomplete components (missing .html or .js files).

**Solution:**
- Added `isComponentValid()` function to check for required files
- Added `getComponentDirectoryPath()` helper function
- Validation in three places:
  1. Manual preview trigger (`registerCommands`)
  2. Auto-open (`setupActiveEditorTracking`)
  3. File changes (`checkComponentValidity`)
- Clear warning messages for invalid components
- Preview closes automatically when critical files deleted

**Impact:** No more errors from incomplete components, better UX.

#### Force Reload Button
**Problem:** New components added to `force-app/main/default/lwc` weren't available in preview until LWR server restarted. Also, file changes required manual preview close/open to reflect properly.

**Solution:**
- Added "Force Reload" button (🔄) in preview header
- Complete restart workflow with progress notifications
- Automatically closes preview → restarts server → reopens preview
- Extended timeouts and cleanup delays for reliability
- Progress notification shows each step
- Retry option if reload fails

**Improved Workflow:**
1. User clicks Force Reload button (🔄)
2. Progress notification appears with steps:
   - "Closing preview..."
   - "Stopping server..."
   - "Server restarted successfully!"
   - "Stabilizing..."
   - "Reopening preview..."
   - "Preview reopened!"
3. All changes are now reflected

**Reliability Improvements:**
- **Log-based detection** - waits for actual "Application is available at:" message instead of arbitrary timers
- **2-second cleanup delay** - ensures port 8347 is fully released
- **60-second timeout** - generous timeout for slower systems
- **100ms polling** - faster detection when server is ready
- **Progress logging** every 10 seconds - helps debugging
- **Better error messages** - more actionable feedback
- **Retry button** - if restart fails, user can retry easily
- **Component validation** - ensures component is valid before reopening

**UI:**
- Button with reload icon (🔄) and "Force Reload" label
- Gray background, blue when reloading
- Spinning animation during reload
- 5-second cooldown to prevent double-clicks
- Tooltip: "Force Reload - Restart server and refresh preview"
- VS Code progress notification with step-by-step feedback

**Impact:** Reliable server restart that picks up all changes. Users get clear feedback at each step and can retry if issues occur.

### Feature Enhancements

#### 1. Single Preview Panel Enforcement
**Problem Solved:** Multiple preview panels were being created when switching between files.

**Solution:**
- `PreviewPanelManager.show()` now checks if a panel already exists
- Reuses existing panel by calling `reveal()` instead of creating new ones
- Ensures only one preview panel is active at any time

**Implementation:**
```typescript
public async show(componentInfo, serverReady): Promise<void> {
    if (this.previewPanel) {
        this.previewPanel.reveal(vscode.ViewColumn.Two);
        if (serverReady) {
            this.showPreviewContent(componentInfo);
        }
        return;
    }
    // Create new panel only if none exists
}
```

#### 2. Server-Ready Validation
**Problem Solved:** Preview icon was clickable before LWR server was ready, causing errors.

**Solution:**
- Added server-ready check in command handler
- Shows informative message: "Server is starting, please wait..."
- Command validates server state before executing

**Implementation:**
```typescript
private registerCommands(): void {
    this.previewCommand = vscode.commands.registerCommand(
        COMMAND_TOGGLE_PREVIEW,
        async () => {
            if (!this.serverManager || !this.serverManager.isReady) {
                vscode.window.showWarningMessage(
                    'LWC Preview: Server is starting, please wait...'
                );
                return;
            }
            // Proceed with preview
        }
    );
}
```

#### 3. Auto-Open Toggle Feature
**New Capability:** Users can now control whether preview opens automatically.

**UI Design:**
```
┌────────────────────────────────────────────────────┐
│ ⚡ LWC Preview  myComponent  Auto-open  [●──]     │
├────────────────────────────────────────────────────┤
│              Component Preview Area                │
└────────────────────────────────────────────────────┘
```

**Features:**
- iOS-style toggle switch in preview header
- Two modes:
  - **Auto-open** (enabled): Preview opens automatically when switching to LWC files
  - **Manual** (disabled): Preview only opens when clicking preview icon
- Setting persists in workspace configuration
- Can also be configured in VS Code settings

**Configuration:**
```json
{
  "lwc-preview.autoOpenPreview": true  // or false
}
```

**Toggle Switch Design:**
- 44x24px pill-shaped switch
- White circular slider that slides left/right
- Background: Gray when OFF, Blue when ON
- Icons: ✕ (off) and ✓ (on) with fade transitions
- Smooth 300ms animations

**Message Flow:**
```
User clicks toggle
      ↓
Webview sends 'toggleAutoOpen' message
      ↓
PreviewPanelManager.toggleAutoOpen()
      ↓
Update workspace configuration
      ↓
Update UI state
      ↓
Show confirmation notification
```

**New Components:**
- `CONFIG_KEYS.AUTO_OPEN_PREVIEW` constant
- `ToggleAutoOpenMessage` type
- `PreviewPanelManager` methods:
  - `isAutoOpenEnabled()` - Check current state
  - `toggleAutoOpen(enabled)` - Toggle and persist
  - `loadAutoOpenPreference()` - Load from config
- Modified `setupActiveEditorTracking()` to respect setting
- Enhanced `registerCommands()` with server-ready check

---

## Design Patterns

### Service Pattern
Each service encapsulates related functionality:
- Single responsibility
- Clear interfaces
- Dependency injection

### Observer Pattern
Event-driven architecture:
- FileSystemWatcher for file changes
- Event listeners for editor changes
- Callbacks for server events

### Facade Pattern
Main extension class provides simplified interface:
- Hides complexity of services
- Coordinates interactions
- Single entry point

### Factory Pattern
Service instantiation by main class:
- Dependencies passed in constructor
- Proper initialization order

---

## Best Practices

### SOLID Principles Applied

1. **Single Responsibility Principle** ✅
   - Each service has one well-defined responsibility

2. **Open/Closed Principle** ✅
   - Services are open for extension, closed for modification

3. **Liskov Substitution Principle** ✅
   - Service implementations can be swapped

4. **Interface Segregation Principle** ✅
   - Clean, focused interfaces

5. **Dependency Inversion Principle** ✅
   - Dependency injection throughout

### Code Quality

- **TypeScript Strict Mode** ✅
- **No `any` Types** ✅
- **Comprehensive JSDoc** ✅
- **Error Handling** ✅
- **Resource Cleanup** ✅
- **Consistent Naming** ✅

### VS Code Extension Best Practices

- **Proper Disposal** ✅ - All subscriptions managed
- **Activation Events** ✅ - Efficient activation
- **Global Storage** ✅ - Proper file permissions
- **User Feedback** ✅ - Status bar and notifications
- **Error Reporting** ✅ - Clear error messages

---

## Key Improvements

### Separation of Concerns
- Each service handles one aspect
- Extension.ts is an orchestrator, not implementation
- Easy to understand and maintain

### Type Safety
- Comprehensive TypeScript interfaces
- Type-safe message passing
- Better IDE support and autocomplete

### Error Handling
- Custom error class hierarchy
- Proper error propagation
- User-friendly error messages

### Maintainability
- Clear code organization
- Well-documented
- Easy to locate functionality
- Reduced code duplication

### Testability
- Services can be unit tested in isolation
- Dependency injection enables mocking
- Clear interfaces for testing

### Scalability
- Easy to add new features
- Services can be extended independently
- No risk of breaking unrelated functionality

---

## Testing Strategy

### Manual Testing Checklist
- ✅ Extension activation
- ✅ SFDX project detection
- ✅ LWR server startup
- ✅ Component preview
- ✅ File synchronization
- ✅ Error handling
- ✅ Status bar updates
- ✅ Extension deactivation
- ✅ Auto-open toggle functionality
- ✅ Preview panel reuse (no duplicates)
- ✅ Server-ready validation

### Unit Testing (Future)
- Test each service independently
- Mock dependencies
- Test error scenarios

### Integration Testing (Future)
- Test service interactions
- End-to-end workflows
- VS Code API integration

---

## Metrics

### Code Metrics

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Main file lines | 612 | 270 | -56% |
| Number of files | 5 | 13 | Better organization |
| Global variables | 11 | 0 | Eliminated |
| Longest function | ~100 lines | ~40 lines | More readable |
| Cyclomatic complexity | High | Low | Easier to maintain |

### Quality Metrics

- **Compilation:** ✅ Success
- **Linter:** ✅ No errors
- **Backward Compatibility:** ✅ Maintained
- **Type Coverage:** ✅ 100%

---

## Future Enhancements

With the new architecture, these are easier to implement:

1. **Testing:** Unit tests for each service
2. **Configuration:** User-configurable settings per service
3. **Logging:** Structured logging system
4. **Performance:** Individual service optimization
5. **Features:** New features without affecting existing code
6. **Multi-workspace:** Support for multiple workspaces
7. **Keyboard Shortcuts:** Customizable shortcuts for toggle
8. **File Type Filters:** Auto-open for specific file types only

---

## Conclusion

The extension follows modern software architecture principles with a clean service-oriented design. Each component has a single responsibility, making the codebase:

- **Maintainable** - Clear structure and organization
- **Robust** - Better error handling
- **Professional** - Industry best practices
- **Testable** - Services can be tested independently
- **Scalable** - Easy to add new features

**Architecture Version:** 2.1  
**Last Updated:** After Feature Implementation  
**Maintainability Score:** ⭐⭐⭐⭐⭐
