import * as fs from 'fs';
import * as path from 'path';

/**
 * Recursively delete a directory and its contents
 */
export function deleteDirectoryRecursive(dirPath: string): void {
    if (fs.existsSync(dirPath)) {
        fs.readdirSync(dirPath).forEach((file) => {
            const curPath = path.join(dirPath, file);
            if (fs.lstatSync(curPath).isDirectory()) {
                deleteDirectoryRecursive(curPath);
            } else {
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(dirPath);
    }
}

/**
 * Clean up the 'c' folder contents
 */
export function cleanupComponentFolder(extensionPath: string): void {
    const cFolderPath = path.join(extensionPath, 'src', 'modules', 'c');

    if (fs.existsSync(cFolderPath)) {
        const files = fs.readdirSync(cFolderPath);
        files.forEach(file => {
            const filePath = path.join(cFolderPath, file);
            if (fs.lstatSync(filePath).isDirectory()) {
                deleteDirectoryRecursive(filePath);
            } else {
                fs.unlinkSync(filePath);
            }
        });
    }
}

/**
 * Check if file should be copied based on modification time and size
 */
export function shouldCopyFile(srcPath: string, destPath: string): boolean {
    if (!fs.existsSync(destPath)) {
        return true;
    }

    const srcStats = fs.statSync(srcPath);
    const destStats = fs.statSync(destPath);

    return srcStats.mtimeMs > destStats.mtimeMs || srcStats.size !== destStats.size;
}

/**
 * Copy file from source to destination
 */
export function copyFile(srcPath: string, destPath: string): void {
    const destDir = path.dirname(destPath);
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
    }
    fs.copyFileSync(srcPath, destPath);
}

/**
 * Copy directory recursively (optimized - only copies changed files)
 */
export async function copyDirectoryOptimized(
    src: string,
    dest: string,
    onProgress?: (copied: number, skipped: number) => void
): Promise<void> {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }

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

            if (onProgress && copiedCount % 5 === 0) {
                onProgress(copiedCount, skippedCount);
            }
        }
    }
}

