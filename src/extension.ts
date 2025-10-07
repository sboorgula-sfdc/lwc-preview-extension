import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import AdmZip from 'adm-zip';
import { getComponentInfo, ComponentInfo } from './utils/componentResolver';
import { copyDirectoryOptimized, copyFile, shouldCopyFile, cleanupComponentFolder } from './utils/fileSystem';
import { parseLwrError } from './utils/errorHandler';
import { getLoadingHtml, getErrorHtml, getPreviewHtml } from './utils/previewHtml';

const LWR_SERVER_PORT = 8347;
const LWR_BASE_PROJECT_FOLDER = 'lwr-base-project';

let lwrServerProcess: child_process.ChildProcess | null = null;
let previewPanel: vscode.WebviewPanel | null = null;
let serverReady = false;
let fileWatcher: vscode.FileSystemWatcher | null = null;
let currentComponentName: string | null = null;
let isSfdxProject = false;
let isInitialCopyInProgress = false;
let extensionContext: vscode.ExtensionContext | null = null;
let hasActiveError = false;
let errorDebounceTimer: NodeJS.Timeout | null = null;
let statusBarItem: vscode.StatusBarItem | null = null;
let lwrProjectRoot: string | null = null;

export async function activate(context: vscode.ExtensionContext) {
    extensionContext = context;
    isSfdxProject = checkIsSfdxProject();

    // Create status bar item
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = "$(loading~spin) LWC Preview";
    statusBarItem.tooltip = "Starting LWC Preview server...";
    context.subscriptions.push(statusBarItem);

    if (!isSfdxProject) {
        statusBarItem.text = "$(warning) LWC Preview";
        statusBarItem.tooltip = "Not an SFDX project";
        statusBarItem.show();

        context.subscriptions.push(
            vscode.commands.registerCommand('lwc-preview.togglePreview', () => {
                vscode.window.showWarningMessage('LWC Preview requires an SFDX project (sfdx-project.json not found)');
            })
        );
        return;
    }

    statusBarItem.show();

    // Setup lwr-base-project folder
    try {
        lwrProjectRoot = await setupLwrBaseProject(context);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to setup LWR base project: ${error}`);
        statusBarItem.text = "$(error) LWC Preview";
        statusBarItem.tooltip = "Failed to setup base project";
        return;
    }

    setupFileWatcher(context);
    setupActiveEditorTracking(context);
    registerPreviewCommand(context);

    // Check and install dependencies if needed
    await ensureDependenciesInstalled(context);

    startLwrServer(context);

    // Wait for initial component sync to complete before auto-opening preview
    await initialSyncComponents(context);

    // Auto-open preview if an LWC component is already open
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
        const componentInfo = getComponentInfo(activeEditor.document.uri.fsPath);
        if (componentInfo) {
            currentComponentName = componentInfo.componentName;
            await showPreview(context, componentInfo);
        }
    }
}

function checkIsSfdxProject(): boolean {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        return false;
    }

    const sfdxProjectPath = path.join(workspaceFolders[0].uri.fsPath, 'sfdx-project.json');
    return fs.existsSync(sfdxProjectPath);
}

async function setupLwrBaseProject(context: vscode.ExtensionContext): Promise<string> {
    const extensionPath = context.extensionPath;

    // Use globalStorageUri for proper extension storage with read/write permissions
    const globalStoragePath = context.globalStorageUri.fsPath;

    // Ensure global storage directory exists
    if (!fs.existsSync(globalStoragePath)) {
        fs.mkdirSync(globalStoragePath, { recursive: true });
    }

    // Get extension version to create versioned folder name
    const packageJsonPath = path.join(extensionPath, 'package.json');
    let version = '0.0.0';
    try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        version = packageJson.version || '0.0.0';
    } catch (error) {
        console.error('[LWC Preview] Failed to read package.json version:', error);
    }

    const sourceLwrBasePath = path.join(extensionPath, LWR_BASE_PROJECT_FOLDER);
    const sourceZipPath = path.join(extensionPath, `${LWR_BASE_PROJECT_FOLDER}.zip`);
    // Use versioned folder name to avoid conflicts between versions
    const versionedFolderName = `${LWR_BASE_PROJECT_FOLDER}-${version}`;
    const destLwrBasePath = path.join(globalStoragePath, versionedFolderName);

    // If we already have the extracted folder in global storage, use it
    if (fs.existsSync(destLwrBasePath)) {
        console.log(`[LWC Preview] Using existing ${versionedFolderName} at: ${destLwrBasePath}`);
        console.log(`[LWC Preview] LWR base project ready at: ${destLwrBasePath}`);
        console.log(`[LWC Preview] Global storage path: ${globalStoragePath}`);
        return destLwrBasePath;
    }

    // Prefer extracting from zip when packaged
    if (fs.existsSync(sourceZipPath)) {
        console.log(`[LWC Preview] Extracting ${versionedFolderName} from zip: ${sourceZipPath}`);
        try {
            const zip = new AdmZip(sourceZipPath);
            // Extract to a temp location first
            const tempExtractPath = path.join(globalStoragePath, 'temp-extract');
            zip.extractAllTo(tempExtractPath, true);

            // Move the extracted 'lwr-base-project' folder to the versioned name
            const extractedPath = path.join(tempExtractPath, LWR_BASE_PROJECT_FOLDER);
            if (!fs.existsSync(extractedPath)) {
                throw new Error('Extraction succeeded but lwr-base-project folder not found in zip');
            }

            // Rename to versioned folder name
            fs.renameSync(extractedPath, destLwrBasePath);

            // Clean up temp directory
            if (fs.existsSync(tempExtractPath)) {
                fs.rmdirSync(tempExtractPath, { recursive: true });
            }

            console.log(`[LWC Preview] Successfully extracted ${versionedFolderName}`);
        } catch (e) {
            console.error('[LWC Preview] Failed to extract zip, falling back to copy:', e);
            // Fall back to copying from source folder if available
            if (fs.existsSync(sourceLwrBasePath)) {
                console.log(`[LWC Preview] Copying ${versionedFolderName} from ${sourceLwrBasePath} to ${destLwrBasePath}`);
                await copyDirectoryOptimized(sourceLwrBasePath, destLwrBasePath);
                console.log(`[LWC Preview] Successfully copied ${versionedFolderName}`);
            } else {
                throw new Error(`Neither zip nor source folder available. Looked for zip at: ${sourceZipPath} and folder at: ${sourceLwrBasePath}`);
            }
        }
    } else {
        // Dev scenario: zip not present, copy from workspace folder bundled with extension
        if (!fs.existsSync(sourceLwrBasePath)) {
            throw new Error(`lwr-base-project folder not found at: ${sourceLwrBasePath}`);
        }
        console.log(`[LWC Preview] Copying ${versionedFolderName} from ${sourceLwrBasePath} to ${destLwrBasePath}`);
        await copyDirectoryOptimized(sourceLwrBasePath, destLwrBasePath);
        console.log(`[LWC Preview] Successfully copied ${versionedFolderName}`);
    }

    console.log(`[LWC Preview] LWR base project (v${version}) ready at: ${destLwrBasePath}`);
    console.log(`[LWC Preview] Global storage path: ${globalStoragePath}`);
    return destLwrBasePath;
}

function setupFileWatcher(context: vscode.ExtensionContext) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) return;

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const lwcSourcePath = path.join(workspaceRoot, 'force-app', 'main', 'default', 'lwc');

    if (!fs.existsSync(lwcSourcePath)) return;

    const pattern = new vscode.RelativePattern(lwcSourcePath, '**/*');
    fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);

    fileWatcher.onDidCreate(async (uri) => {
        await handleFileChange(uri.fsPath, workspaceRoot);
    });

    fileWatcher.onDidChange(async (uri) => {
        await handleFileChange(uri.fsPath, workspaceRoot);
    });

    fileWatcher.onDidDelete(async (uri) => {
        await handleFileDelete(uri.fsPath, workspaceRoot);
    });

    context.subscriptions.push(fileWatcher);
}

async function handleFileChange(filePath: string, workspaceRoot: string) {
    if (!lwrProjectRoot) return;

    const lwcSourcePath = path.join(workspaceRoot, 'force-app', 'main', 'default', 'lwc');
    const destBasePath = path.join(lwrProjectRoot, 'src', 'modules', 'c');
    const relativePath = path.relative(lwcSourcePath, filePath);
    const destPath = path.join(destBasePath, relativePath);

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        if (shouldCopyFile(filePath, destPath)) {
            copyFile(filePath, destPath);
        }
    }

    clearLwrError();
}

async function handleFileDelete(filePath: string, workspaceRoot: string) {
    if (!lwrProjectRoot) return;

    const lwcSourcePath = path.join(workspaceRoot, 'force-app', 'main', 'default', 'lwc');
    const destBasePath = path.join(lwrProjectRoot, 'src', 'modules', 'c');
    const relativePath = path.relative(lwcSourcePath, filePath);
    const destPath = path.join(destBasePath, relativePath);

    if (fs.existsSync(destPath)) {
        fs.unlinkSync(destPath);
    }

    clearLwrError();
}

function setupActiveEditorTracking(context: vscode.ExtensionContext) {
    const editorChangeDisposable = vscode.window.onDidChangeActiveTextEditor(async (editor) => {
        if (!editor) return;

        const componentInfo = getComponentInfo(editor.document.uri.fsPath);
        if (componentInfo) {
            // Auto-open preview if not already open
            if (!previewPanel) {
                currentComponentName = componentInfo.componentName;
                await showPreview(context, componentInfo);
            }
            // Update preview if component changed
            else if (componentInfo.componentName !== currentComponentName) {
                currentComponentName = componentInfo.componentName;
                updatePreviewComponent(currentComponentName);
            }
        }
    });

    context.subscriptions.push(editorChangeDisposable);
}

function registerPreviewCommand(context: vscode.ExtensionContext) {
    const disposable = vscode.commands.registerCommand('lwc-preview.togglePreview', async () => {
        if (previewPanel) {
            previewPanel.dispose();
            previewPanel = null;
            return;
        }

        const activeEditor = vscode.window.activeTextEditor;
        let componentInfo: ComponentInfo | null = null;

        if (activeEditor) {
            componentInfo = getComponentInfo(activeEditor.document.uri.fsPath);
            if (componentInfo) {
                currentComponentName = componentInfo.componentName;
            }
        }

        if (!componentInfo) {
            currentComponentName = null;
        }

        await showPreview(context, componentInfo);
    });

    context.subscriptions.push(disposable);
}

async function ensureDependenciesInstalled(context: vscode.ExtensionContext): Promise<void> {
    if (!lwrProjectRoot) {
        throw new Error('LWR project root not initialized');
    }

    const projectRoot = lwrProjectRoot;
    const nodeModulesPath = path.join(projectRoot, 'node_modules');

    // Check if node_modules exists and has required packages
    const needsInstall = !fs.existsSync(nodeModulesPath) ||
        fs.readdirSync(nodeModulesPath).length === 0 ||
        !fs.existsSync(path.join(nodeModulesPath, 'lwr'));

    if (!needsInstall) {
        console.log('[LWC Preview] Dependencies already installed, skipping npm install');
        return;
    }

    console.log('[LWC Preview] Installing dependencies with npm install...');
    await runNpmInstall(projectRoot, false);
}

async function runNpmInstall(projectRoot: string, useCI: boolean): Promise<void> {
    const command = 'install';
    const commandLabel = 'npm install';

    if (statusBarItem) {
        statusBarItem.text = "$(sync~spin) LWC Preview";
        statusBarItem.tooltip = "Installing dependencies...";
    }

    return new Promise<void>((resolve, reject) => {
        const npmProcess = child_process.spawn('npm', [command], {
            cwd: projectRoot,
            shell: true,
            stdio: ['ignore', 'pipe', 'pipe']
        });

        if (npmProcess.stdout) {
            npmProcess.stdout.on('data', (data: Buffer) => {
                console.log(`[${commandLabel}]:`, data.toString());
            });
        }

        if (npmProcess.stderr) {
            npmProcess.stderr.on('data', (data: Buffer) => {
                console.log(`[${commandLabel} stderr]:`, data.toString());
            });
        }

        npmProcess.on('error', (error) => {
            console.error(`[${commandLabel}] Failed:`, error);
            if (statusBarItem) {
                statusBarItem.text = "$(error) LWC Preview";
                statusBarItem.tooltip = `Failed to install dependencies: ${error.message}`;
            }
            vscode.window.showErrorMessage(`LWC Preview: Failed to install dependencies - ${error.message}`);
            reject(error);
        });

        npmProcess.on('close', (code: number) => {
            if (code === 0) {
                console.log(`[${commandLabel}] Dependencies installed successfully`);
                if (statusBarItem) {
                    statusBarItem.text = "$(loading~spin) LWC Preview";
                    statusBarItem.tooltip = "Starting LWC Preview server...";
                }
                resolve();
            } else {
                console.error(`[${commandLabel}] Process exited with code ${code}`);
                if (statusBarItem) {
                    statusBarItem.text = "$(error) LWC Preview";
                    statusBarItem.tooltip = `Failed to install dependencies (exit code: ${code})`;
                }
                vscode.window.showErrorMessage(`LWC Preview: Failed to install dependencies (exit code: ${code})`);
                reject(new Error(`${commandLabel} exited with code ${code}`));
            }
        });
    });
}

async function startLwrServer(context: vscode.ExtensionContext) {
    if (lwrServerProcess) return;

    if (!lwrProjectRoot) {
        throw new Error('LWR project root not initialized');
    }

    const projectRoot = lwrProjectRoot;

    // Use npm to run lwr with port argument
    const command = 'npm';
    const args = ['start', '--', '--port', String(LWR_SERVER_PORT)];

    console.log(`[LWC Preview] Starting LWR server in: ${projectRoot}`);

    lwrServerProcess = child_process.spawn(command, args, {
        cwd: projectRoot,
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe']
    });

    if (lwrServerProcess.stdout) {
        lwrServerProcess.stdout.on('data', (data: Buffer) => {
            const output = data.toString();
            console.log('[LWR Server]:', output);

            if (output.includes('Server listening') || output.includes('localhost:')) {
                if (!serverReady) {
                    serverReady = true;
                    if (statusBarItem) {
                        statusBarItem.text = "$(check) LWC Preview";
                        statusBarItem.tooltip = `LWC Preview ready (port ${LWR_SERVER_PORT})`;
                    }
                }
            }
        });
    }

    if (lwrServerProcess.stderr) {
        lwrServerProcess.stderr.on('data', (data: Buffer) => {
            const errorOutput = data.toString();
            console.error('[LWR Server Error]:', errorOutput);
            handleLwrError(errorOutput);
        });
    }

    lwrServerProcess.on('error', (error) => {
        console.error('[LWR Server Spawn Error]:', error);
        if (statusBarItem) {
            statusBarItem.text = "$(error) LWC Preview";
            statusBarItem.tooltip = `Failed to start server: ${error.message}`;
        }
        vscode.window.showErrorMessage(`LWC Preview: Failed to start server - ${error.message}`);
    });

    lwrServerProcess.on('close', (code: number) => {
        console.log(`[LWR Server] Process closed with code ${code}`);
        lwrServerProcess = null;
        serverReady = false;
        if (statusBarItem && code !== 0) {
            statusBarItem.text = "$(warning) LWC Preview";
            statusBarItem.tooltip = `LWC Preview server stopped (exit code: ${code})`;
        }
    });
}

function handleLwrError(errorOutput: string) {
    if (!errorOutput.includes('Error') && !errorOutput.includes('LWC1')) {
        return;
    }

    if (errorDebounceTimer) {
        clearTimeout(errorDebounceTimer);
    }

    errorDebounceTimer = setTimeout(() => {
        const errorInfo = parseLwrError(errorOutput);

        if (errorInfo && !hasActiveError) {
            sendLwrErrorToPreview(errorInfo.message, errorInfo.stack);
            vscode.window.showErrorMessage(`LWR Error: ${errorInfo.message.substring(0, 80)}...`);
        }
    }, 500);
}

async function initialSyncComponents(context: vscode.ExtensionContext) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) return;

    if (!lwrProjectRoot) {
        throw new Error('LWR project root not initialized');
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const lwcSourcePath = path.join(workspaceRoot, 'force-app', 'main', 'default', 'lwc');
    const destPath = path.join(lwrProjectRoot, 'src', 'modules', 'c');

    if (!fs.existsSync(lwcSourcePath)) return;

    try {
        isInitialCopyInProgress = true;

        if (statusBarItem) {
            statusBarItem.text = "$(sync~spin) LWC Preview";
            statusBarItem.tooltip = "Syncing LWC components...";
        }

        console.log(`[LWC Preview] Copying SFDX LWC components from ${lwcSourcePath} to ${destPath}`);
        await copyDirectoryOptimized(lwcSourcePath, destPath);

        if (statusBarItem && serverReady) {
            statusBarItem.text = "$(check) LWC Preview";
            statusBarItem.tooltip = `LWC Preview ready (port ${LWR_SERVER_PORT})`;
        }

        if (previewPanel) {
            updatePreviewLoadingState(false);
        }
    } catch (error) {
        vscode.window.showErrorMessage('Failed to sync LWC components');
        if (statusBarItem) {
            statusBarItem.text = "$(warning) LWC Preview";
            statusBarItem.tooltip = "Failed to sync components";
        }
    } finally {
        isInitialCopyInProgress = false;
    }
}

async function showPreview(context: vscode.ExtensionContext, componentInfo: ComponentInfo | null) {
    previewPanel = vscode.window.createWebviewPanel(
        'lwcPreview',
        'LWC Preview',
        vscode.ViewColumn.Two,
        {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: []
        }
    );

    previewPanel.onDidDispose(() => {
        previewPanel = null;
        currentComponentName = null;
    }, null, context.subscriptions);

    if (!serverReady) {
        previewPanel.webview.html = getLoadingHtml();

        const maxAttempts = 30;
        let attempts = 0;

        const checkServer = setInterval(() => {
            attempts++;
            if (serverReady) {
                clearInterval(checkServer);
                if (previewPanel) {
                    previewPanel.webview.html = getPreviewHtml(
                        componentInfo?.componentName || '',
                        LWR_SERVER_PORT
                    );
                }
            } else if (attempts >= maxAttempts) {
                clearInterval(checkServer);
                if (previewPanel) {
                    previewPanel.webview.html = getErrorHtml('Server failed to start. Please check the terminal output.');
                }
            }
        }, 1000);
    } else {
        previewPanel.webview.html = getPreviewHtml(
            componentInfo?.componentName || '',
            LWR_SERVER_PORT
        );
    }
}

function updatePreviewComponent(componentName: string | null) {
    if (previewPanel) {
        previewPanel.webview.postMessage({
            type: 'updateComponent',
            componentName: componentName
        });
        hasActiveError = false;
    }
}

function updatePreviewLoadingState(isLoading: boolean) {
    if (previewPanel) {
        previewPanel.webview.postMessage({
            type: 'updateLoadingState',
            isLoading: isLoading
        });
    }
}

function sendLwrErrorToPreview(errorMessage: string, errorStack: string) {
    if (previewPanel && !hasActiveError) {
        previewPanel.webview.postMessage({
            type: 'lwrError',
            errorMessage: errorMessage,
            errorStack: errorStack
        });
        hasActiveError = true;
    }
}

function clearLwrError() {
    if (previewPanel && hasActiveError) {
        previewPanel.webview.postMessage({
            type: 'clearLwrError'
        });
        hasActiveError = false;
    }
}

export function deactivate() {
    if (lwrServerProcess) {
        lwrServerProcess.kill();
        lwrServerProcess = null;
    }

    if (fileWatcher) {
        fileWatcher.dispose();
        fileWatcher = null;
    }

    if (errorDebounceTimer) {
        clearTimeout(errorDebounceTimer);
        errorDebounceTimer = null;
    }

    if (statusBarItem) {
        statusBarItem.dispose();
        statusBarItem = null;
    }

    if (extensionContext && isSfdxProject && lwrProjectRoot) {
        console.log('[LWC Preview] Cleaning up lwr-base-project folder...');
        cleanupComponentFolder(lwrProjectRoot);
    }
}
