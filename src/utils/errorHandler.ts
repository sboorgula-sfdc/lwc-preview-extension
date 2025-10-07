import { LwrErrorInfo } from '../types';

/**
 * Custom error classes for better error handling
 */
export class LwcPreviewError extends Error {
    constructor(message: string, public readonly originalError?: Error) {
        super(message);
        this.name = 'LwcPreviewError';
        Object.setPrototypeOf(this, LwcPreviewError.prototype);
    }
}

export class ProjectSetupError extends LwcPreviewError {
    constructor(message: string, originalError?: Error) {
        super(message, originalError);
        this.name = 'ProjectSetupError';
    }
}

export class ServerStartError extends LwcPreviewError {
    constructor(message: string, originalError?: Error) {
        super(message, originalError);
        this.name = 'ServerStartError';
    }
}

export class FileSyncError extends LwcPreviewError {
    constructor(message: string, originalError?: Error) {
        super(message, originalError);
        this.name = 'FileSyncError';
    }
}

/**
 * Error type enum
 */
export enum LwrErrorType {
    LWC_COMPILATION = 'LWC Compilation Error',
    TEMPLATE = 'LWC Template Error',
    MODULE_RESOLUTION = 'Module Resolution Error',
    SYNTAX = 'JavaScript Syntax Error',
    GENERIC = 'LWR Server Error'
}

/**
 * Extract LWC compilation error from output
 */
function extractLwcError(output: string): string {
    const match = output.match(/LWC\d+:([^\n]+)/);
    return match ? match[1].trim() : output.split('\n')[0];
}

/**
 * Extract template error from output
 */
function extractTemplateError(output: string): string {
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
function extractModuleError(output: string): string {
    const match = output.match(/Cannot find module ['"]([^'"]+)['"]/);
    if (match) {
        return `Cannot find module "${match[1]}". Check your imports.`;
    }
    return output.split('\n')[0];
}

/**
 * Extract JavaScript syntax error from output
 */
function extractSyntaxError(output: string): string {
    const match = output.match(/SyntaxError: ([^\n]+)/);
    return match ? match[1].trim() : output.split('\n')[0];
}

/**
 * Extract generic error from output
 */
function extractGenericError(output: string): string {
    const match = output.match(/Error: ([^\n]+)/);
    if (match) {
        return match[1].trim();
    }
    const lines = output.split('\n').filter(line => line.trim().length > 0);
    return lines[0] || output;
}

/**
 * Determine error type from output
 */
function determineErrorType(errorOutput: string): LwrErrorType | null {
    if (errorOutput.includes('LWC1')) {
        return LwrErrorType.LWC_COMPILATION;
    } else if (errorOutput.includes('template') && errorOutput.includes('error')) {
        return LwrErrorType.TEMPLATE;
    } else if (errorOutput.includes('Cannot find module') || errorOutput.includes('Module not found')) {
        return LwrErrorType.MODULE_RESOLUTION;
    } else if (errorOutput.includes('SyntaxError') || errorOutput.includes('Unexpected token')) {
        return LwrErrorType.SYNTAX;
    } else if (errorOutput.includes('Error:') || errorOutput.includes('ERROR')) {
        return LwrErrorType.GENERIC;
    }
    return null;
}

/**
 * Extract error message based on type
 */
function extractErrorMessage(errorOutput: string, errorType: LwrErrorType): string {
    switch (errorType) {
        case LwrErrorType.LWC_COMPILATION:
            return extractLwcError(errorOutput);
        case LwrErrorType.TEMPLATE:
            return extractTemplateError(errorOutput);
        case LwrErrorType.MODULE_RESOLUTION:
            return extractModuleError(errorOutput);
        case LwrErrorType.SYNTAX:
            return extractSyntaxError(errorOutput);
        case LwrErrorType.GENERIC:
        default:
            return extractGenericError(errorOutput);
    }
}

/**
 * Parse LWR server error output and return formatted error message
 */
export function parseLwrError(errorOutput: string): LwrErrorInfo | null {
    // Ignore non-error output
    if (!errorOutput.includes('Error') && !errorOutput.includes('LWC1')) {
        return null;
    }

    const errorType = determineErrorType(errorOutput);
    if (!errorType) {
        return null;
    }

    const errorMessage = `${errorType}: ${extractErrorMessage(errorOutput, errorType)}`;
    const errorStack = errorOutput;

    return { message: errorMessage, stack: errorStack };
}

/**
 * Format error for display to user
 */
export function formatErrorForDisplay(error: Error): string {
    if (error instanceof LwcPreviewError) {
        return error.originalError
            ? `${error.message}\nCaused by: ${error.originalError.message}`
            : error.message;
    }
    return error.message;
}

