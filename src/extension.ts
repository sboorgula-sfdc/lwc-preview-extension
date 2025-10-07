import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import {
    SFDX_PROJECT_FILE,
    COMMAND_TOGGLE_PREVIEW,
    LOG_PREFIX,
    LWR_SERVER_PORT,
    LWC_SOURCE_PATH
} from './constants';
import { getComponentInfo, ComponentInfo, isComponentValid, getComponentDirectoryPath } from './utils/componentResolver';
import { cleanupComponentFolder } from './utils/fileSystem';
import { ProjectSetupError, formatErrorForDisplay } from './utils/errorHandler';

// Services
import { StatusBarManager } from './services/StatusBarManager';
import { ProjectSetupService } from './services/ProjectSetupService';
import { DependencyManager } from './services/DependencyManager';
import { ServerManager } from './services/ServerManager';
import { PreviewPanelManager } from './services/PreviewPanelManager';
import { FileWatcherService } from './services/FileWatcherService';

/**
 * Main extension class that orchestrates all services
 */
class LwcPreviewExtension {
    private statusBarManager: StatusBarManager;
    private projectSetupService: ProjectSetupService;
    private dependencyManager: DependencyManager | null = null;
    private serverManager: ServerManager | null = null;
    private previewPanelManager: PreviewPanelManager;
    private fileWatcherService: FileWatcherService | null = null;

    private lwrProjectRoot: string | null = null;
    private workspaceRoot: string | null = null;
    private isSfdxProject: boolean = false;
    private previewCommand: vscode.Disposable | null = null;
    private isForceReloading: boolean = false;

    constructor(private readonly context: vscode.ExtensionContext) {
        this.statusBarManager = new StatusBarManager(context);
        this.projectSetupService = new ProjectSetupService(context);
        this.previewPanelManager = new PreviewPanelManager(context);
    }

    /**
     * Activate the extension
     */
    public async activate(): Promise<void> {
        this.statusBarManager.initialize();
        this.statusBarManager.showLoading();

        this.isSfdxProject = this.checkIsSfdxProject();

        if (!this.isSfdxProject) {
            this.handleNonSfdxProject();
            return;
        }

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            this.statusBarManager.showError('No workspace folder found');
            return;
        }
        this.workspaceRoot = workspaceFolders[0].uri.fsPath;

        try {
            this.lwrProjectRoot = await this.projectSetupService.setupLwrBaseProject();

            this.dependencyManager = new DependencyManager(
                this.lwrProjectRoot,
                this.statusBarManager
            );

            this.serverManager = new ServerManager(
                this.lwrProjectRoot,
                this.statusBarManager
            );

            this.fileWatcherService = new FileWatcherService(
                this.context,
                this.workspaceRoot,
                this.lwrProjectRoot,
                this.statusBarManager,
                this.previewPanelManager
            );

            this.serverManager.setErrorCallback((errorInfo) => {
                this.previewPanelManager.sendLwrError(errorInfo);
            });

            this.previewPanelManager.setForceReloadCallback(async () => {
                await this.handleForceReload();
            });

            this.fileWatcherService.setup();
            this.setupActiveEditorTracking();
            this.registerCommands();

            await this.dependencyManager.ensureInstalled();
            this.serverManager.start();
            await this.waitForServerReady();
            await this.fileWatcherService.initialSync();

            if (this.serverManager.isReady) {
                this.statusBarManager.showReady(LWR_SERVER_PORT);
            }

            await this.autoOpenPreviewForActiveEditor();
        } catch (error) {
            const errorMessage = error instanceof Error
                ? formatErrorForDisplay(error)
                : String(error);

            console.error(`${LOG_PREFIX} Activation failed:`, error);
            vscode.window.showErrorMessage(`Failed to activate LWC Preview: ${errorMessage}`);
            this.statusBarManager.showError('Activation failed');
        }
    }

    /**
     * Check if current workspace is an SFDX project
     */
    private checkIsSfdxProject(): boolean {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return false;
        }

        const sfdxProjectPath = path.join(
            workspaceFolders[0].uri.fsPath,
            SFDX_PROJECT_FILE
        );

        return fs.existsSync(sfdxProjectPath);
    }

    /**
     * Handle non-SFDX project scenario
     */
    private handleNonSfdxProject(): void {
        this.statusBarManager.showWarning('Not an SFDX project');

        // Register a disabled command that shows warning
        this.context.subscriptions.push(
            vscode.commands.registerCommand(COMMAND_TOGGLE_PREVIEW, () => {
                vscode.window.showWarningMessage(
                    'LWC Preview requires an SFDX project (sfdx-project.json not found)'
                );
            })
        );
    }

    /**
     * Setup active editor tracking to auto-switch preview
     */
    private setupActiveEditorTracking(): void {
        const editorChangeDisposable = vscode.window.onDidChangeActiveTextEditor(
            async (editor) => {
                if (!editor || this.isForceReloading) return;

                const componentInfo = getComponentInfo(editor.document.uri.fsPath);
                if (!componentInfo) return;

                const componentDirPath = getComponentDirectoryPath(editor.document.uri.fsPath);
                if (!componentDirPath) return;

                const isValid = isComponentValid(componentDirPath, componentInfo.componentName);
                if (!isValid) {
                    if (this.previewPanelManager.getCurrentComponentName() === componentInfo.componentName) {
                        this.previewPanelManager.close();
                    }
                    return;
                }

                if (!this.previewPanelManager.isOpen()) {
                    if (this.previewPanelManager.isAutoOpenEnabled()) {
                        this.previewPanelManager.setCurrentComponentName(componentInfo.componentName);
                        await this.showPreview(componentInfo);
                    }
                } else if (componentInfo.componentName !== this.previewPanelManager.getCurrentComponentName()) {
                    this.previewPanelManager.setCurrentComponentName(componentInfo.componentName);
                    this.previewPanelManager.updateComponent(componentInfo.componentName);
                }
            }
        );

        this.context.subscriptions.push(editorChangeDisposable);
    }

    /**
     * Register VS Code commands
     */
    private registerCommands(): void {
        this.previewCommand = vscode.commands.registerCommand(
            COMMAND_TOGGLE_PREVIEW,
            async () => {
                if (!this.serverManager || !this.serverManager.isReady) {
                    vscode.window.showWarningMessage('LWC Preview: Server is starting, please wait...');
                    return;
                }

                if (this.previewPanelManager.isOpen()) {
                    this.previewPanelManager.close();
                    return;
                }

                const activeEditor = vscode.window.activeTextEditor;
                if (!activeEditor) {
                    vscode.window.showInformationMessage('LWC Preview: Please open an LWC component file to preview');
                    return;
                }

                const componentInfo = getComponentInfo(activeEditor.document.uri.fsPath);
                if (!componentInfo) {
                    vscode.window.showInformationMessage('LWC Preview: Please open an LWC component file to preview');
                    return;
                }

                const componentDirPath = getComponentDirectoryPath(activeEditor.document.uri.fsPath);
                if (!componentDirPath) return;

                const isValid = isComponentValid(componentDirPath, componentInfo.componentName);
                if (!isValid) {
                    vscode.window.showWarningMessage(
                        `LWC Preview: Component "${componentInfo.componentName}" is missing required files (.html or .js)`
                    );
                    return;
                }

                this.previewPanelManager.setCurrentComponentName(componentInfo.componentName);
                await this.showPreview(componentInfo);
            }
        );

        this.context.subscriptions.push(this.previewCommand);
    }

    /**
     * Show the preview panel
     */
    private async showPreview(componentInfo: ComponentInfo | null): Promise<void> {
        if (!this.serverManager) {
            vscode.window.showErrorMessage('Server not initialized');
            return;
        }

        const serverReady = this.serverManager.isReady;
        await this.previewPanelManager.show(componentInfo, serverReady);

        if (!serverReady) {
            await this.waitForServerReadyAndUpdate(componentInfo);
        }
    }

    /**
     * Wait for server to become ready and update preview
     */
    private async waitForServerReadyAndUpdate(componentInfo: ComponentInfo | null): Promise<void> {
        const maxWaitTime = 30000;
        const checkInterval = 1000;
        let elapsed = 0;

        while (elapsed < maxWaitTime) {
            await new Promise(resolve => setTimeout(resolve, checkInterval));
            elapsed += checkInterval;

            if (this.serverManager?.isReady) {
                this.previewPanelManager.onServerReady(componentInfo);
                return;
            }
        }
    }

    /**
     * Wait for server to be ready during activation
     */
    private async waitForServerReady(): Promise<void> {
        const maxWaitTime = 30000;
        const checkInterval = 500;
        let elapsed = 0;

        while (elapsed < maxWaitTime) {
            if (this.serverManager?.isReady) {
                return;
            }
            await new Promise(resolve => setTimeout(resolve, checkInterval));
            elapsed += checkInterval;
        }

        throw new ProjectSetupError('Server failed to start within timeout');
    }

    /**
     * Auto-open preview for active editor if applicable
     */
    private async autoOpenPreviewForActiveEditor(): Promise<void> {
        if (!this.previewPanelManager.isAutoOpenEnabled()) return;

        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) return;

        const componentInfo = getComponentInfo(activeEditor.document.uri.fsPath);
        if (!componentInfo) return;

        const componentDirPath = getComponentDirectoryPath(activeEditor.document.uri.fsPath);
        if (!componentDirPath) return;

        if (!isComponentValid(componentDirPath, componentInfo.componentName)) return;

        this.previewPanelManager.setCurrentComponentName(componentInfo.componentName);
        await this.showPreview(componentInfo);
    }

    /**
     * Handle force reload request from preview panel
     */
    private async handleForceReload(): Promise<void> {
        if (!this.serverManager) {
            throw new Error('Server manager not initialized');
        }

        this.isForceReloading = true;
        const currentComponent = this.previewPanelManager.getCurrentComponentName();

        try {
            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: "LWC Preview: Force Reload",
                    cancellable: false
                },
                async (progress) => {
                    try {
                        if (!this.serverManager) {
                            throw new Error('Server manager not available');
                        }

                        progress.report({ increment: 0, message: "Closing preview..." });
                        this.previewPanelManager.close();
                        await new Promise(resolve => setTimeout(resolve, 500));

                        progress.report({ increment: 10, message: "Restarting server..." });
                        await this.serverManager.restart();

                        progress.report({ increment: 60, message: "Server ready!" });

                        progress.report({ increment: 10, message: "Stabilizing..." });
                        await new Promise(resolve => setTimeout(resolve, 1000));

                        progress.report({ increment: 10, message: "Reopening preview..." });

                        if (currentComponent) {
                            const lwcSourcePath = path.join(this.workspaceRoot!, LWC_SOURCE_PATH);
                            const componentDirPath = path.join(lwcSourcePath, currentComponent);

                            if (isComponentValid(componentDirPath, currentComponent)) {
                                const componentInfo: ComponentInfo = {
                                    componentName: currentComponent,
                                    modulePath: `c/${currentComponent}`
                                };

                                this.previewPanelManager.setCurrentComponentName(currentComponent);
                                await this.showPreview(componentInfo);
                                progress.report({ increment: 10, message: "Complete!" });
                            } else {
                                vscode.window.showWarningMessage(
                                    `Component "${currentComponent}" is missing required files (.html or .js)`
                                );
                            }
                        }
                    } catch (error: any) {
                        console.error(`${LOG_PREFIX} Force reload failed:`, error);

                        const errorMessage = error?.message || String(error);
                        const result = await vscode.window.showErrorMessage(
                            `Force Reload Failed: ${errorMessage}`,
                            'Retry',
                            'Cancel'
                        );

                        if (result === 'Retry') {
                            await this.handleForceReload();
                        }
                    }
                }
            );

            this.isForceReloading = false;

            if (this.previewPanelManager.isOpen()) {
                vscode.window.showInformationMessage('LWC Preview: Force reload completed successfully!');
            }
        } catch (error: any) {
            this.isForceReloading = false;
            console.error(`${LOG_PREFIX} Force reload error:`, error);
            throw error;
        }
    }

    /**
     * Deactivate the extension
     */
    public deactivate(): void {
        if (this.serverManager) {
            this.serverManager.stop();
        }

        if (this.fileWatcherService) {
            this.fileWatcherService.dispose();
        }

        this.statusBarManager.dispose();

        if (this.isSfdxProject && this.lwrProjectRoot) {
            cleanupComponentFolder(this.lwrProjectRoot);
        }
    }
}

// Extension instance
let extensionInstance: LwcPreviewExtension | null = null;

/**
 * Extension activation entry point
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
    extensionInstance = new LwcPreviewExtension(context);
    await extensionInstance.activate();
}

/**
 * Extension deactivation entry point
 */
export function deactivate(): void {
    if (extensionInstance) {
        extensionInstance.deactivate();
        extensionInstance = null;
    }
}
