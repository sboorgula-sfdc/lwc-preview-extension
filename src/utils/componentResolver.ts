import * as path from 'path';

export interface ComponentInfo {
    modulePath: string;
    componentName: string;
}

/**
 * Extract component information from a file path
 * Looks for 'lwc' directory in path and extracts component name
 */
export function getComponentInfo(filePath: string): ComponentInfo | null {
    const pathParts = filePath.split(path.sep);
    const lwcIndex = pathParts.lastIndexOf('lwc');

    if (lwcIndex === -1 || lwcIndex >= pathParts.length - 1) {
        return null;
    }

    const componentName = pathParts[lwcIndex + 1];
    const modulePath = `c/${componentName}`;

    return { modulePath, componentName };
}

