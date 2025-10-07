import * as fs from 'fs';
import * as path from 'path';
import { FileSyncError } from './errorHandler';
import { CopyProgress } from '../types';
import { LOG_PREFIX } from '../constants';

/**
 * Recursively delete a directory and its contents
 */
export function deleteDirectoryRecursive(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
        return;
    }

    try {
        const entries = fs.readdirSync(dirPath);

        for (const entry of entries) {
            const curPath = path.join(dirPath, entry);
            const stats = fs.lstatSync(curPath);

            if (stats.isDirectory()) {
                deleteDirectoryRecursive(curPath);
            } else {
                fs.unlinkSync(curPath);
            }
        }

        fs.rmdirSync(dirPath);
    } catch (error) {
        throw new FileSyncError(
            `Failed to delete directory: ${dirPath}`,
            error instanceof Error ? error : new Error(String(error))
        );
    }
}

/**
 * Clean up the 'c' folder contents
 */
export function cleanupComponentFolder(extensionPath: string): void {
    const cFolderPath = path.join(extensionPath, 'src', 'modules', 'c');
    if (!fs.existsSync(cFolderPath)) return;

    try {
        const files = fs.readdirSync(cFolderPath);

        for (const file of files) {
            const filePath = path.join(cFolderPath, file);
            const stats = fs.lstatSync(filePath);

            if (stats.isDirectory()) {
                deleteDirectoryRecursive(filePath);
            } else {
                fs.unlinkSync(filePath);
            }
        }
    } catch (error) {
        console.error(`${LOG_PREFIX} Cleanup error:`, error);
    }
}

/**
 * Check if file should be copied based on modification time and size
 */
export function shouldCopyFile(srcPath: string, destPath: string): boolean {
    try {
        if (!fs.existsSync(destPath)) return true;

        const srcStats = fs.statSync(srcPath);
        const destStats = fs.statSync(destPath);

        return srcStats.mtimeMs > destStats.mtimeMs || srcStats.size !== destStats.size;
    } catch (error) {
        return true;
    }
}

/**
 * Ensure directory exists, creating it if necessary
 */
export function ensureDirectory(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

/**
 * Copy file from source to destination
 */
export function copyFile(srcPath: string, destPath: string): void {
    try {
        const destDir = path.dirname(destPath);
        ensureDirectory(destDir);
        fs.copyFileSync(srcPath, destPath);
    } catch (error) {
        throw new FileSyncError(
            `Failed to copy file from ${srcPath} to ${destPath}`,
            error instanceof Error ? error : new Error(String(error))
        );
    }
}

/**
 * Check if path exists
 */
export function pathExists(filePath: string): boolean {
    return fs.existsSync(filePath);
}

/**
 * Check if path is a directory
 */
export function isDirectory(filePath: string): boolean {
    try {
        return fs.statSync(filePath).isDirectory();
    } catch {
        return false;
    }
}

/**
 * Copy directory recursively (optimized - only copies changed files)
 */
export async function copyDirectoryOptimized(
    src: string,
    dest: string,
    onProgress?: (progress: CopyProgress) => void
): Promise<void> {
    if (!fs.existsSync(src)) {
        throw new FileSyncError(`Source directory does not exist: ${src}`);
    }

    try {
        ensureDirectory(dest);

        const entries = fs.readdirSync(src, { withFileTypes: true });
        let copiedCount = 0;
        let skippedCount = 0;

        for (const entry of entries) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);

            if (entry.isDirectory()) {
                await copyDirectoryOptimized(srcPath, destPath, onProgress);
            } else {
                if (shouldCopyFile(srcPath, destPath)) {
                    copyFile(srcPath, destPath);
                    copiedCount++;
                } else {
                    skippedCount++;
                }

                // Report progress every 5 files
                if (onProgress && copiedCount % 5 === 0) {
                    onProgress({ copied: copiedCount, skipped: skippedCount });
                }
            }
        }

        // Final progress report
        if (onProgress && copiedCount > 0) {
            onProgress({ copied: copiedCount, skipped: skippedCount });
        }
    } catch (error) {
        if (error instanceof FileSyncError) {
            throw error;
        }
        throw new FileSyncError(
            `Failed to copy directory from ${src} to ${dest}`,
            error instanceof Error ? error : new Error(String(error))
        );
    }
}

