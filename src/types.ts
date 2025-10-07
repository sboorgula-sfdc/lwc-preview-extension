/**
 * Type definitions for the extension
 */

export interface LwrErrorInfo {
    message: string;
    stack: string;
}

export interface WebviewMessage {
    type: string;
    [key: string]: any;
}

export interface ComponentLoadMessage extends WebviewMessage {
    type: 'componentLoadComplete';
    success: boolean;
    componentName?: string;
}

export interface UpdateComponentMessage extends WebviewMessage {
    type: 'updateComponent';
    componentName: string | null;
}

export interface UpdateLoadingStateMessage extends WebviewMessage {
    type: 'updateLoadingState';
    isLoading: boolean;
    text?: string;
}

export interface LwrErrorMessage extends WebviewMessage {
    type: 'lwrError';
    errorMessage: string;
    errorStack: string;
}

export interface ClearLwrErrorMessage extends WebviewMessage {
    type: 'clearLwrError';
}

export interface ToggleAutoOpenMessage extends WebviewMessage {
    type: 'toggleAutoOpen';
    enabled: boolean;
}

export interface ForceReloadMessage extends WebviewMessage {
    type: 'forceReload';
}

export interface ServerStartOptions {
    port: number;
    projectRoot: string;
}

export interface CopyProgress {
    copied: number;
    skipped: number;
}

export type MessageType =
    | UpdateComponentMessage
    | UpdateLoadingStateMessage
    | LwrErrorMessage
    | ClearLwrErrorMessage
    | ToggleAutoOpenMessage
    | ForceReloadMessage;

