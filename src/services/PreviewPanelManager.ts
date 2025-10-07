import * as vscode from 'vscode';
import {
    LWR_SERVER_PORT,
    WEBVIEW_ID,
    WEBVIEW_TITLE,
    SERVER_START_TIMEOUT,
    SERVER_START_CHECK_INTERVAL,
    MESSAGE_TYPES,
    CONFIG_KEYS,
    LOG_PREFIX
} from '../constants';
import { ComponentInfo } from '../utils/componentResolver';
import { getLoadingHtml, getErrorHtml, getPreviewHtml } from '../utils/previewHtml';
import { LwrErrorInfo, MessageType } from '../types';

/**
 * Manages the webview panel for component preview
 */
export class PreviewPanelManager {
    private previewPanel: vscode.WebviewPanel | null = null;
    private currentComponentName: string | null = null;
    private hasActiveError: boolean = false;
    private autoOpenEnabled: boolean = true;
    private forceReloadCallback: (() => Promise<void>) | null = null;

    constructor(private readonly context: vscode.ExtensionContext) {
        // Load auto-open preference from workspace configuration
        this.loadAutoOpenPreference();
    }

    /**
     * Get current component name
     */
    public getCurrentComponentName(): string | null {
        return this.currentComponentName;
    }

    /**
     * Set current component name
     */
    public setCurrentComponentName(name: string | null): void {
        this.currentComponentName = name;
    }

    /**
     * Check if preview panel is open
     */
    public isOpen(): boolean {
        return this.previewPanel !== null;
    }

    /**
     * Check if auto-open is enabled
     */
    public isAutoOpenEnabled(): boolean {
        return this.autoOpenEnabled;
    }

    /**
     * Load auto-open preference from configuration
     */
    private loadAutoOpenPreference(): void {
        const config = vscode.workspace.getConfiguration();
        this.autoOpenEnabled = config.get(CONFIG_KEYS.AUTO_OPEN_PREVIEW, true);
    }

    /**
     * Toggle auto-open preference
     */
    public async toggleAutoOpen(enabled: boolean): Promise<void> {
        this.autoOpenEnabled = enabled;
        const config = vscode.workspace.getConfiguration();
        await config.update(CONFIG_KEYS.AUTO_OPEN_PREVIEW, enabled, vscode.ConfigurationTarget.Workspace);
        vscode.window.showInformationMessage(`LWC Preview: Auto-open ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Set callback for force reload
     */
    public setForceReloadCallback(callback: () => Promise<void>): void {
        this.forceReloadCallback = callback;
    }

    /**
     * Trigger force reload (restart server)
     */
    public async triggerForceReload(): Promise<void> {
        if (this.forceReloadCallback) {
            await this.forceReloadCallback();
        }
    }

    /**
     * Close the preview panel
     */
    public close(): void {
        if (this.previewPanel) {
            this.previewPanel.dispose();
            this.previewPanel = null;
            this.currentComponentName = null;
        }
    }

    /**
     * Show the preview panel
     */
    public async show(
        componentInfo: ComponentInfo | null,
        serverReady: boolean
    ): Promise<void> {
        if (this.previewPanel) {
            this.previewPanel.reveal(vscode.ViewColumn.Two);
            if (serverReady) {
                this.showPreviewContent(componentInfo);
            }
            return;
        }

        this.previewPanel = vscode.window.createWebviewPanel(
            WEBVIEW_ID,
            WEBVIEW_TITLE,
            vscode.ViewColumn.Two,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: []
            }
        );

        // Handle messages from webview
        this.previewPanel.webview.onDidReceiveMessage(
            async (message) => {
                if (message.type === MESSAGE_TYPES.TOGGLE_AUTO_OPEN) {
                    await this.toggleAutoOpen(message.enabled);
                } else if (message.type === MESSAGE_TYPES.FORCE_RELOAD) {
                    await this.triggerForceReload();
                }
            },
            null,
            this.context.subscriptions
        );

        this.previewPanel.onDidDispose(
            () => {
                this.previewPanel = null;
                this.currentComponentName = null;
            },
            null,
            this.context.subscriptions
        );

        if (!serverReady) {
            await this.showLoadingUntilReady(componentInfo);
        } else {
            this.showPreviewContent(componentInfo);
        }
    }

    /**
     * Show loading state until server is ready
     */
    private async showLoadingUntilReady(componentInfo: ComponentInfo | null): Promise<void> {
        if (this.previewPanel) {
            this.previewPanel.webview.html = getLoadingHtml();
        }
    }

    /**
     * Show preview content
     */
    private showPreviewContent(componentInfo: ComponentInfo | null): void {
        if (this.previewPanel) {
            this.previewPanel.webview.html = getPreviewHtml(
                componentInfo?.componentName || '',
                LWR_SERVER_PORT,
                this.autoOpenEnabled
            );
        }
    }

    /**
     * Update the displayed component
     */
    public updateComponent(componentName: string | null): void {
        if (this.previewPanel) {
            this.sendMessage({
                type: MESSAGE_TYPES.UPDATE_COMPONENT,
                componentName: componentName
            });
            this.hasActiveError = false;
        }
    }

    /**
     * Update loading state
     */
    public updateLoadingState(isLoading: boolean, text?: string): void {
        if (this.previewPanel) {
            this.sendMessage({
                type: MESSAGE_TYPES.UPDATE_LOADING_STATE,
                isLoading: isLoading,
                text: text
            });
        }
    }

    /**
     * Send LWR error to preview
     */
    public sendLwrError(errorInfo: LwrErrorInfo): void {
        if (this.previewPanel && !this.hasActiveError) {
            this.sendMessage({
                type: MESSAGE_TYPES.LWR_ERROR,
                errorMessage: errorInfo.message,
                errorStack: errorInfo.stack
            });
            this.hasActiveError = true;
        }
    }

    /**
     * Clear LWR error from preview
     */
    public clearLwrError(): void {
        if (this.previewPanel && this.hasActiveError) {
            this.sendMessage({
                type: MESSAGE_TYPES.CLEAR_LWR_ERROR
            });
            this.hasActiveError = false;
        }
    }

    /**
     * Send message to webview
     */
    private sendMessage(message: MessageType | any): void {
        if (this.previewPanel) {
            this.previewPanel.webview.postMessage(message);
        }
    }

    /**
     * Update preview when server becomes ready
     */
    public onServerReady(componentInfo: ComponentInfo | null): void {
        if (this.previewPanel) {
            this.showPreviewContent(componentInfo);
        }
    }
}

