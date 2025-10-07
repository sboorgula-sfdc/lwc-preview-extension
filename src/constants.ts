/**
 * Application-wide constants
 */

export const LWR_SERVER_PORT = 8347;
export const LWR_BASE_PROJECT_FOLDER = 'lwr-base-project';
export const SFDX_PROJECT_FILE = 'sfdx-project.json';
export const LWC_SOURCE_PATH = 'force-app/main/default/lwc';
export const LWR_MODULES_PATH = 'src/modules/c';

export const SERVER_START_TIMEOUT = 30000; // 30 seconds
export const SERVER_START_CHECK_INTERVAL = 1000; // 1 second
export const ERROR_DEBOUNCE_DELAY = 500; // 500ms

export const WEBVIEW_ID = 'lwcPreview';
export const WEBVIEW_TITLE = 'LWC Preview';

export const COMMAND_TOGGLE_PREVIEW = 'lwc-preview.togglePreview';

export const STATUS_BAR_PRIORITY = 100;

export const MESSAGE_TYPES = {
    UPDATE_COMPONENT: 'updateComponent',
    UPDATE_LOADING_STATE: 'updateLoadingState',
    LWR_ERROR: 'lwrError',
    CLEAR_LWR_ERROR: 'clearLwrError',
    COMPONENT_LOAD_COMPLETE: 'componentLoadComplete',
    LWC_READY: 'lwcReady',
    TOGGLE_AUTO_OPEN: 'toggleAutoOpen',
    FORCE_RELOAD: 'forceReload'
} as const;

export const LOG_PREFIX = '[LWC Preview]';

export const CONFIG_KEYS = {
    AUTO_OPEN_PREVIEW: 'lwc-preview.autoOpenPreview'
} as const;

