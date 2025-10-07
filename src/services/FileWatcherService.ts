import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { LWC_SOURCE_PATH, LWR_MODULES_PATH, LOG_PREFIX } from '../constants';
import { copyDirectoryOptimized, copyFile, shouldCopyFile, deleteDirectoryRecursive } from '../utils/fileSystem';
import { StatusBarManager } from './StatusBarManager';
import { PreviewPanelManager } from './PreviewPanelManager';
import { getComponentInfo, isComponentValid, getComponentDirectoryPath } from '../utils/componentResolver';

/**
 * Manages file watching and synchronization between SFDX and LWR projects
 */
export class FileWatcherService {
    private fileWatcher: vscode.FileSystemWatcher | null = null;
    private isInitialCopyInProgress: boolean = false;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly workspaceRoot: string,
        private readonly lwrProjectRoot: string,
        private readonly statusBarManager: StatusBarManager,
        private readonly previewPanelManager: PreviewPanelManager
    ) { }

    /**
     * Setup file watcher for LWC source files
     */
    public setup(): void {
        const lwcSourcePath = path.join(this.workspaceRoot, LWC_SOURCE_PATH);
        if (!fs.existsSync(lwcSourcePath)) return;

        const pattern = new vscode.RelativePattern(lwcSourcePath, '**/*');
        this.fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);

        this.fileWatcher.onDidCreate(async (uri) => await this.handleFileChange(uri.fsPath));
        this.fileWatcher.onDidChange(async (uri) => await this.handleFileChange(uri.fsPath));
        this.fileWatcher.onDidDelete(async (uri) => await this.handleFileDelete(uri.fsPath));

        this.context.subscriptions.push(this.fileWatcher);
    }

    /**
     * Handle file creation or change
     */
    private async handleFileChange(filePath: string): Promise<void> {
        const lwcSourcePath = path.join(this.workspaceRoot, LWC_SOURCE_PATH);
        const destBasePath = path.join(this.lwrProjectRoot, LWR_MODULES_PATH);
        const relativePath = path.relative(lwcSourcePath, filePath);
        const destPath = path.join(destBasePath, relativePath);

        try {
            if (!fs.existsSync(filePath)) return;

            const stats = fs.statSync(filePath);

            if (stats.isDirectory()) {
                await copyDirectoryOptimized(filePath, destPath);
            } else if (stats.isFile()) {
                if (shouldCopyFile(filePath, destPath)) {
                    copyFile(filePath, destPath);
                }
                await this.checkComponentValidity(filePath);
            }

            this.previewPanelManager.clearLwrError();
        } catch (error) {
            console.error(`${LOG_PREFIX} Error handling file change:`, error);
        }
    }

    /**
     * Handle file deletion
     */
    private async handleFileDelete(filePath: string): Promise<void> {
        const lwcSourcePath = path.join(this.workspaceRoot, LWC_SOURCE_PATH);
        const destBasePath = path.join(this.lwrProjectRoot, LWR_MODULES_PATH);
        const destPath = path.join(destBasePath, path.relative(lwcSourcePath, filePath));

        try {
            if (!fs.existsSync(destPath)) return;

            const stats = fs.statSync(destPath);

            if (stats.isDirectory()) {
                deleteDirectoryRecursive(destPath);

                const componentInfo = getComponentInfo(filePath);
                if (componentInfo?.componentName === this.previewPanelManager.getCurrentComponentName()) {
                    this.previewPanelManager.close();
                }
            } else {
                fs.unlinkSync(destPath);
                await this.checkComponentValidity(filePath);
            }

            this.previewPanelManager.clearLwrError();
        } catch (error) {
            console.error(`${LOG_PREFIX} Error handling file deletion:`, error);
        }
    }

    /**
     * Check component validity and close preview if invalid
     */
    private async checkComponentValidity(filePath: string): Promise<void> {
        const componentInfo = getComponentInfo(filePath);
        if (!componentInfo || componentInfo.componentName !== this.previewPanelManager.getCurrentComponentName()) {
            return;
        }

        const componentDirPath = getComponentDirectoryPath(filePath);
        if (!componentDirPath) return;

        if (!isComponentValid(componentDirPath, componentInfo.componentName)) {
            vscode.window.showWarningMessage(
                `LWC Preview: Component "${componentInfo.componentName}" is missing required files (.html or .js)`
            );
            this.previewPanelManager.close();
        }
    }

    /**
     * Perform initial sync of all LWC components
     */
    public async initialSync(): Promise<void> {
        const lwcSourcePath = path.join(this.workspaceRoot, LWC_SOURCE_PATH);
        const destPath = path.join(this.lwrProjectRoot, LWR_MODULES_PATH);

        if (!fs.existsSync(lwcSourcePath)) return;

        try {
            this.isInitialCopyInProgress = true;
            this.statusBarManager.showSyncing('Syncing LWC components...');
            await copyDirectoryOptimized(lwcSourcePath, destPath);
        } catch (error) {
            console.error(`${LOG_PREFIX} Failed to sync LWC components:`, error);
            vscode.window.showErrorMessage('Failed to sync LWC components');
            this.statusBarManager.showWarning('Failed to sync components');
            throw error;
        } finally {
            this.isInitialCopyInProgress = false;
        }
    }

    /**
     * Check if initial copy is in progress
     */
    public isInitialCopyRunning(): boolean {
        return this.isInitialCopyInProgress;
    }

    /**
     * Dispose file watcher
     */
    public dispose(): void {
        if (this.fileWatcher) {
            this.fileWatcher.dispose();
            this.fileWatcher = null;
        }
    }
}

