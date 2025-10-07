import * as vscode from 'vscode';
import { STATUS_BAR_PRIORITY } from '../constants';

/**
 * Manages the status bar item for the extension
 */
export class StatusBarManager {
    private statusBarItem: vscode.StatusBarItem | null = null;

    constructor(private readonly context: vscode.ExtensionContext) { }

    /**
     * Initialize and show the status bar
     */
    public initialize(): void {
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            STATUS_BAR_PRIORITY
        );
        this.context.subscriptions.push(this.statusBarItem);
        this.statusBarItem.show();
    }

    /**
     * Update status bar to show loading state
     */
    public showLoading(tooltip: string = 'Starting LWC Preview server...'): void {
        if (this.statusBarItem) {
            this.statusBarItem.text = '$(loading~spin) LWC Preview';
            this.statusBarItem.tooltip = tooltip;
        }
    }

    /**
     * Update status bar to show syncing state
     */
    public showSyncing(tooltip: string = 'Syncing LWC components...'): void {
        if (this.statusBarItem) {
            this.statusBarItem.text = '$(sync~spin) LWC Preview';
            this.statusBarItem.tooltip = tooltip;
        }
    }

    /**
     * Update status bar to show ready state
     */
    public showReady(port: number): void {
        if (this.statusBarItem) {
            this.statusBarItem.text = '$(check) LWC Preview';
            this.statusBarItem.tooltip = `LWC Preview ready (port ${port})`;
        }
    }

    /**
     * Update status bar to show warning state
     */
    public showWarning(tooltip: string): void {
        if (this.statusBarItem) {
            this.statusBarItem.text = '$(warning) LWC Preview';
            this.statusBarItem.tooltip = tooltip;
        }
    }

    /**
     * Update status bar to show error state
     */
    public showError(tooltip: string): void {
        if (this.statusBarItem) {
            this.statusBarItem.text = '$(error) LWC Preview';
            this.statusBarItem.tooltip = tooltip;
        }
    }

    /**
     * Dispose the status bar item
     */
    public dispose(): void {
        if (this.statusBarItem) {
            this.statusBarItem.dispose();
            this.statusBarItem = null;
        }
    }
}

