import * as child_process from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { LOG_PREFIX } from '../constants';
import { StatusBarManager } from './StatusBarManager';

/**
 * Manages npm dependencies for the LWR project
 */
export class DependencyManager {
    constructor(
        private readonly projectRoot: string,
        private readonly statusBarManager: StatusBarManager
    ) { }

    /**
     * Ensure dependencies are installed
     */
    public async ensureInstalled(): Promise<void> {
        const nodeModulesPath = path.join(this.projectRoot, 'node_modules');

        const needsInstall =
            !fs.existsSync(nodeModulesPath) ||
            fs.readdirSync(nodeModulesPath).length === 0 ||
            !fs.existsSync(path.join(nodeModulesPath, 'lwr'));

        if (!needsInstall) {
            console.log(`${LOG_PREFIX} Dependencies already installed, skipping npm install`);
            return;
        }

        console.log(`${LOG_PREFIX} Installing dependencies with npm install...`);
        await this.runNpmInstall();
    }

    /**
     * Run npm install in the project root
     */
    private async runNpmInstall(): Promise<void> {
        const command = 'install';
        const commandLabel = 'npm install';

        this.statusBarManager.showSyncing('Installing dependencies...');

        return new Promise<void>((resolve, reject) => {
            const npmProcess = child_process.spawn('npm', [command], {
                cwd: this.projectRoot,
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
                this.statusBarManager.showError(`Failed to install dependencies: ${error.message}`);
                vscode.window.showErrorMessage(
                    `LWC Preview: Failed to install dependencies - ${error.message}`
                );
                reject(error);
            });

            npmProcess.on('close', (code: number) => {
                if (code === 0) {
                    console.log(`[${commandLabel}] Dependencies installed successfully`);
                    this.statusBarManager.showLoading('Starting LWC Preview server...');
                    resolve();
                } else {
                    console.error(`[${commandLabel}] Process exited with code ${code}`);
                    this.statusBarManager.showError(
                        `Failed to install dependencies (exit code: ${code})`
                    );
                    vscode.window.showErrorMessage(
                        `LWC Preview: Failed to install dependencies (exit code: ${code})`
                    );
                    reject(new Error(`${commandLabel} exited with code ${code}`));
                }
            });
        });
    }
}

