import * as child_process from 'child_process';
import * as vscode from 'vscode';
import { LWR_SERVER_PORT, LOG_PREFIX } from '../constants';
import { StatusBarManager } from './StatusBarManager';
import { parseLwrError } from '../utils/errorHandler';
import { LwrErrorInfo } from '../types';

/**
 * Manages the LWR server lifecycle
 */
export class ServerManager {
    private lwrServerProcess: child_process.ChildProcess | null = null;
    private _serverReady: boolean = false;
    private errorDebounceTimer: NodeJS.Timeout | null = null;
    private errorCallback: ((errorInfo: LwrErrorInfo) => void) | null = null;

    constructor(
        private readonly projectRoot: string,
        private readonly statusBarManager: StatusBarManager
    ) { }

    /**
     * Check if server is ready
     */
    public get isReady(): boolean {
        return this._serverReady;
    }

    /**
     * Set error callback for handling LWR errors
     */
    public setErrorCallback(callback: (errorInfo: LwrErrorInfo) => void): void {
        this.errorCallback = callback;
    }

    /**
     * Start the LWR server
     */
    public start(): void {
        if (this.lwrServerProcess) return;

        this.lwrServerProcess = child_process.spawn('npm', ['start', '--', '--port', String(LWR_SERVER_PORT)], {
            cwd: this.projectRoot,
            shell: true,
            stdio: ['ignore', 'pipe', 'pipe']
        });

        this.setupServerListeners();
    }

    /**
     * Setup listeners for server output and errors
     */
    private setupServerListeners(): void {
        if (!this.lwrServerProcess) return;

        if (this.lwrServerProcess.stdout) {
            this.lwrServerProcess.stdout.on('data', (data: Buffer) => {
                this.handleServerOutput(data.toString());
            });
        }

        if (this.lwrServerProcess.stderr) {
            this.lwrServerProcess.stderr.on('data', (data: Buffer) => {
                this.handleServerError(data.toString());
            });
        }

        this.lwrServerProcess.on('error', (error) => {
            this.handleSpawnError(error);
        });

        this.lwrServerProcess.on('close', (code: number) => {
            this.handleServerClose(code);
        });
    }

    /**
     * Handle server stdout output
     */
    private handleServerOutput(output: string): void {
        if (output.includes('Application is available at:') ||
            output.includes(`localhost:${LWR_SERVER_PORT}`) ||
            output.includes('Server listening')) {
            if (!this._serverReady) {
                this._serverReady = true;
                this.statusBarManager.showReady(LWR_SERVER_PORT);
                console.log(`${LOG_PREFIX} Server ready at http://localhost:${LWR_SERVER_PORT}`);
            }
        }
    }

    /**
     * Handle server stderr output
     */
    private handleServerError(errorOutput: string): void {
        this.handleLwrError(errorOutput);
    }

    /**
     * Handle spawn errors
     */
    private handleSpawnError(error: Error): void {
        console.error('[LWR Server Spawn Error]:', error);
        this.statusBarManager.showError(`Failed to start server: ${error.message}`);
        vscode.window.showErrorMessage(`LWC Preview: Failed to start server - ${error.message}`);
    }

    /**
     * Handle server process close
     */
    private handleServerClose(code: number): void {
        this.lwrServerProcess = null;
        this._serverReady = false;

        if (code !== 0) {
            this.statusBarManager.showWarning(`Server stopped (exit code: ${code})`);
        }
    }

    /**
     * Handle LWR compilation/runtime errors
     */
    private handleLwrError(errorOutput: string): void {
        if (!errorOutput.includes('Error') && !errorOutput.includes('LWC1')) {
            return;
        }

        if (this.errorDebounceTimer) {
            clearTimeout(this.errorDebounceTimer);
        }

        this.errorDebounceTimer = setTimeout(() => {
            const errorInfo = parseLwrError(errorOutput);

            if (errorInfo && this.errorCallback) {
                this.errorCallback(errorInfo);
                vscode.window.showErrorMessage(
                    `LWR Error: ${errorInfo.message.substring(0, 80)}...`
                );
            }
        }, 500);
    }

    /**
     * Stop the LWR server
     */
    public stop(): void {
        if (this.lwrServerProcess) {
            this.lwrServerProcess.kill();
            this.lwrServerProcess = null;
            this._serverReady = false;
        }

        if (this.errorDebounceTimer) {
            clearTimeout(this.errorDebounceTimer);
            this.errorDebounceTimer = null;
        }
    }

    /**
     * Restart the LWR server (force reload)
     */
    public async restart(): Promise<void> {
        this.statusBarManager.showLoading('Restarting server...');

        this.stop();
        await new Promise(resolve => setTimeout(resolve, 2000));

        this.statusBarManager.showLoading('Starting server...');
        this.start();

        const maxWaitTime = 60000;
        const checkInterval = 100;
        let elapsed = 0;

        while (elapsed < maxWaitTime) {
            if (this._serverReady) {
                this.statusBarManager.showReady(LWR_SERVER_PORT);
                return;
            }

            await new Promise(resolve => setTimeout(resolve, checkInterval));
            elapsed += checkInterval;
        }

        this.statusBarManager.showError('Server restart failed');
        throw new Error('Server failed to restart. Check the Output panel for details.');
    }
}

