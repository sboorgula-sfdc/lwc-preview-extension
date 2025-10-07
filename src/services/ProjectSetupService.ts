import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import AdmZip from 'adm-zip';
import { LWR_BASE_PROJECT_FOLDER, LOG_PREFIX } from '../constants';
import { copyDirectoryOptimized } from '../utils/fileSystem';

/**
 * Handles setup of the LWR base project
 */
export class ProjectSetupService {
    constructor(private readonly context: vscode.ExtensionContext) { }

    /**
     * Setup the LWR base project in global storage
     */
    public async setupLwrBaseProject(): Promise<string> {
        const extensionPath = this.context.extensionPath;
        const globalStoragePath = this.context.globalStorageUri.fsPath;

        // Ensure global storage directory exists
        this.ensureDirectory(globalStoragePath);

        const version = this.getExtensionVersion(extensionPath);
        const versionedFolderName = `${LWR_BASE_PROJECT_FOLDER}-${version}`;
        const destLwrBasePath = path.join(globalStoragePath, versionedFolderName);

        // If we already have the extracted folder, use it
        if (fs.existsSync(destLwrBasePath)) {
            console.log(`${LOG_PREFIX} Using existing ${versionedFolderName} at: ${destLwrBasePath}`);
            return destLwrBasePath;
        }

        const sourceLwrBasePath = path.join(extensionPath, LWR_BASE_PROJECT_FOLDER);
        const sourceZipPath = path.join(extensionPath, `${LWR_BASE_PROJECT_FOLDER}.zip`);

        // Prefer extracting from zip when packaged
        if (fs.existsSync(sourceZipPath)) {
            await this.extractFromZip(sourceZipPath, globalStoragePath, destLwrBasePath, versionedFolderName);
        } else if (fs.existsSync(sourceLwrBasePath)) {
            // Dev scenario: copy from workspace folder
            await this.copyFromSource(sourceLwrBasePath, destLwrBasePath, versionedFolderName);
        } else {
            throw new Error(
                `Neither zip nor source folder available. ` +
                `Looked for zip at: ${sourceZipPath} and folder at: ${sourceLwrBasePath}`
            );
        }

        console.log(`${LOG_PREFIX} LWR base project (v${version}) ready at: ${destLwrBasePath}`);
        console.log(`${LOG_PREFIX} Global storage path: ${globalStoragePath}`);
        return destLwrBasePath;
    }

    /**
     * Ensure directory exists
     */
    private ensureDirectory(dirPath: string): void {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    }

    /**
     * Get extension version from package.json
     */
    private getExtensionVersion(extensionPath: string): string {
        const packageJsonPath = path.join(extensionPath, 'package.json');
        try {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            return packageJson.version || '0.0.0';
        } catch (error) {
            console.error(`${LOG_PREFIX} Failed to read package.json version:`, error);
            return '0.0.0';
        }
    }

    /**
     * Extract LWR base project from zip
     */
    private async extractFromZip(
        sourceZipPath: string,
        globalStoragePath: string,
        destLwrBasePath: string,
        versionedFolderName: string
    ): Promise<void> {
        console.log(`${LOG_PREFIX} Extracting ${versionedFolderName} from zip: ${sourceZipPath}`);

        try {
            const zip = new AdmZip(sourceZipPath);
            const tempExtractPath = path.join(globalStoragePath, 'temp-extract');
            zip.extractAllTo(tempExtractPath, true);

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

            console.log(`${LOG_PREFIX} Successfully extracted ${versionedFolderName}`);
        } catch (error) {
            console.error(`${LOG_PREFIX} Failed to extract zip, falling back to copy:`, error);

            const sourceLwrBasePath = path.join(
                this.context.extensionPath,
                LWR_BASE_PROJECT_FOLDER
            );

            if (fs.existsSync(sourceLwrBasePath)) {
                await this.copyFromSource(sourceLwrBasePath, destLwrBasePath, versionedFolderName);
            } else {
                throw error;
            }
        }
    }

    /**
     * Copy LWR base project from source folder
     */
    private async copyFromSource(
        sourcePath: string,
        destPath: string,
        versionedFolderName: string
    ): Promise<void> {
        console.log(`${LOG_PREFIX} Copying ${versionedFolderName} from ${sourcePath} to ${destPath}`);
        await copyDirectoryOptimized(sourcePath, destPath);
        console.log(`${LOG_PREFIX} Successfully copied ${versionedFolderName}`);
    }
}

