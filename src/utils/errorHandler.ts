/**
 * Extract LWC compilation error from output
 */
export function extractLwcError(output: string): string {
    const match = output.match(/LWC\d+:([^\n]+)/);
    return match ? match[1].trim() : output.split('\n')[0];
}

/**
 * Extract template error from output
 */
export function extractTemplateError(output: string): string {
    const lines = output.split('\n');
    for (const line of lines) {
        if (line.includes('error') && line.trim().length > 0) {
            return line.trim();
        }
    }
    return output.split('\n')[0];
}

/**
 * Extract module resolution error from output
 */
export function extractModuleError(output: string): string {
    const match = output.match(/Cannot find module ['"]([^'"]+)['"]/);
    if (match) {
        return `Cannot find module "${match[1]}". Check your imports.`;
    }
    return output.split('\n')[0];
}

/**
 * Extract JavaScript syntax error from output
 */
export function extractSyntaxError(output: string): string {
    const match = output.match(/SyntaxError: ([^\n]+)/);
    return match ? match[1].trim() : output.split('\n')[0];
}

/**
 * Extract generic error from output
 */
export function extractGenericError(output: string): string {
    const match = output.match(/Error: ([^\n]+)/);
    if (match) {
        return match[1].trim();
    }
    const lines = output.split('\n').filter(line => line.trim().length > 0);
    return lines[0] || output;
}

/**
 * Parse LWR server error output and return formatted error message
 */
export function parseLwrError(errorOutput: string): { message: string; stack: string } | null {
    // Ignore non-error output
    if (!errorOutput.includes('Error') && !errorOutput.includes('LWC1')) {
        return null;
    }

    let errorMessage = '';
    const errorStack = errorOutput;

    if (errorOutput.includes('LWC1')) {
        errorMessage = 'LWC Compilation Error: ' + extractLwcError(errorOutput);
    } else if (errorOutput.includes('template') && errorOutput.includes('error')) {
        errorMessage = 'LWC Template Error: ' + extractTemplateError(errorOutput);
    } else if (errorOutput.includes('Cannot find module') || errorOutput.includes('Module not found')) {
        errorMessage = 'Module Resolution Error: ' + extractModuleError(errorOutput);
    } else if (errorOutput.includes('SyntaxError') || errorOutput.includes('Unexpected token')) {
        errorMessage = 'JavaScript Syntax Error: ' + extractSyntaxError(errorOutput);
    } else if (errorOutput.includes('Error:') || errorOutput.includes('ERROR')) {
        errorMessage = 'LWR Server Error: ' + extractGenericError(errorOutput);
    }

    return errorMessage ? { message: errorMessage, stack: errorStack } : null;
}

