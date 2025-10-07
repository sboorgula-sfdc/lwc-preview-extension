import * as path from 'path';
import * as fs from 'fs';
import { LOG_PREFIX } from '../constants';

/**
 * Component information extracted from file path
 */
export interface ComponentInfo {
    /** Full module path (e.g., 'c/myComponent') */
    modulePath: string;
    /** Component name (e.g., 'myComponent') */
    componentName: string;
}

/**
 * Extract component information from a file path
 * Looks for 'lwc' directory in path and extracts component name
 * 
 * @param filePath - Absolute or relative file path
 * @returns Component information or null if not an LWC file
 * 
 * @example
 * getComponentInfo('/path/to/force-app/main/default/lwc/myComponent/myComponent.js')
 * // Returns: { modulePath: 'c/myComponent', componentName: 'myComponent' }
 */
export function getComponentInfo(filePath: string): ComponentInfo | null {
    if (!filePath) return null;

    const normalizedPath = path.normalize(filePath);
    const pathParts = normalizedPath.split(path.sep);
    const lwcIndex = pathParts.lastIndexOf('lwc');

    if (lwcIndex === -1 || lwcIndex >= pathParts.length - 1) {
        return null;
    }

    const componentName = pathParts[lwcIndex + 1];
    if (!componentName || componentName.trim() === '') {
        return null;
    }

    return {
        modulePath: `c/${componentName}`,
        componentName
    };
}

/**
 * Check if a file path is part of an LWC component
 * 
 * @param filePath - File path to check
 * @returns True if the path contains 'lwc' directory
 */
export function isLwcFile(filePath: string): boolean {
    return getComponentInfo(filePath) !== null;
}

/**
 * Extract component name from file path without full component info
 * 
 * @param filePath - File path to extract from
 * @returns Component name or null
 */
export function getComponentName(filePath: string): string | null {
    const componentInfo = getComponentInfo(filePath);
    return componentInfo ? componentInfo.componentName : null;
}

/**
 * Check if a component has the required files (html and js) to be previewed
 * 
 * @param componentPath - Path to the component directory
 * @param componentName - Name of the component
 * @returns True if both html and js files exist
 */
export function isComponentValid(componentPath: string, componentName: string): boolean {
    const htmlPath = path.join(componentPath, `${componentName}.html`);
    const jsPath = path.join(componentPath, `${componentName}.js`);

    return fs.existsSync(htmlPath) && fs.existsSync(jsPath);
}

/**
 * Get the component directory path from a file path
 * 
 * @param filePath - Full path to a file within a component
 * @returns Component directory path or null
 */
export function getComponentDirectoryPath(filePath: string): string | null {
    const pathParts = filePath.split(path.sep);
    const lwcIndex = pathParts.lastIndexOf('lwc');

    if (lwcIndex === -1 || lwcIndex >= pathParts.length - 1) {
        return null;
    }

    // Return path up to and including the component folder
    return pathParts.slice(0, lwcIndex + 2).join(path.sep);
}

