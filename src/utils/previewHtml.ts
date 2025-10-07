/**
 * Generate loading HTML for preview panel
 */
export function getLoadingHtml(): string {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">
        <title>LWC Preview</title>
        <style>
            body {
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                margin: 0;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                background: #1e1e1e;
                color: #cccccc;
            }
            .loading {
                text-align: center;
            }
            .spinner {
                border: 4px solid #f3f3f3;
                border-top: 4px solid #3498db;
                border-radius: 50%;
                width: 40px;
                height: 40px;
                animation: spin 1s linear infinite;
                margin: 0 auto 20px;
            }
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        </style>
    </head>
    <body>
        <div class="loading">
            <div class="spinner"></div>
            <h2>Starting LWC Preview server...</h2>
            <p>Please wait while the server starts up.</p>
        </div>
    </body>
    </html>`;
}

/**
 * Generate error HTML for preview panel
 */
export function getErrorHtml(message: string): string {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">
        <title>LWC Preview Error</title>
        <style>
            body {
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                margin: 0;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                background: #1e1e1e;
                color: #f48771;
            }
            .error {
                text-align: center;
                max-width: 600px;
                padding: 20px;
            }
        </style>
    </head>
    <body>
        <div class="error">
            <h2>❌ Error</h2>
            <p>${message}</p>
        </div>
    </body>
    </html>`;
}

/**
 * Generate main preview HTML for preview panel
 */
export function getPreviewHtml(componentName: string, port: number, autoOpenEnabled: boolean = true): string {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; frame-src http://localhost:*;">
        <title>LWC Preview</title>
        <style>
            body, html {
                margin: 0;
                padding: 0;
                width: 100%;
                height: 100vh;
                overflow: hidden;
            }
            iframe {
                border: none;
                width: 100%;
                height: 100%;
            }
            .toolbar {
                background: #2d2d30;
                color: #cccccc;
                padding: 8px 12px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                font-size: 13px;
                border-bottom: 1px solid #3e3e42;
                display: flex;
                align-items: center;
                gap: 10px;
            }
            .toolbar-title {
                font-weight: 600;
            }
            .toolbar-component {
                color: #4ec9b0;
                font-family: 'Courier New', monospace;
            }
            .toolbar-spacer {
                flex: 1;
            }
            .auto-open-toggle-container {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .toggle-label {
                font-size: 12px;
                color: #cccccc;
                user-select: none;
            }
            .force-reload-button {
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 6px 12px;
                background: #3e3e42;
                border-radius: 4px;
                cursor: pointer;
                user-select: none;
                transition: all 0.2s;
                border: 1px solid #555;
                font-size: 12px;
                color: #cccccc;
            }
            .force-reload-button:hover {
                background: #4e4e52;
                border-color: #666;
            }
            .force-reload-button:active {
                background: #2e2e32;
                transform: scale(0.95);
            }
            .force-reload-button.reloading {
                background: #0e639c;
                border-color: #0e639c;
                cursor: wait;
            }
            .reload-icon {
                font-size: 15px;
                transition: transform 0.3s;
            }
            .force-reload-button.reloading .reload-icon {
                animation: spin-reload 1s linear infinite;
            }
            @keyframes spin-reload {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            .toggle-switch {
                position: relative;
                width: 44px;
                height: 22px;
                background: #3e3e42;
                border-radius: 12px;
                cursor: pointer;
                transition: background 0.3s ease;
                border: 1px solid #555;
            }
            .toggle-switch:hover {
                background: #4e4e52;
            }
            .toggle-switch.enabled {
                background: #0e639c;
                border-color: #0e639c;
            }
            .toggle-switch.enabled:hover {
                background: #1177bb;
            }
            .toggle-slider {
                position: absolute;
                top: 2px;
                left: 2px;
                width: 18px;
                height: 18px;
                background: #ffffff;
                border-radius: 50%;
                transition: transform 0.3s ease;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
            }
            .toggle-switch.enabled .toggle-slider {
                transform: translateX(20px);
            }
            .toggle-icon {
                position: absolute;
                top: 50%;
                transform: translateY(-50%);
                font-size: 10px;
                transition: opacity 0.2s ease;
            }
            .toggle-icon-off {
                left: 6px;
                opacity: 1;
            }
            .toggle-icon-on {
                right: 6px;
                opacity: 0;
            }
            .toggle-switch.enabled .toggle-icon-off {
                opacity: 0;
            }
            .toggle-switch.enabled .toggle-icon-on {
                opacity: 1;
            }
            .container {
                display: flex;
                flex-direction: column;
                height: 100vh;
            }
            .preview-frame {
                flex: 1;
            }
            .loading-overlay {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(30, 30, 30, 0.95);
                display: none;
                align-items: center;
                justify-content: center;
                flex-direction: column;
                z-index: 1000;
            }
            .loading-overlay.active {
                display: flex;
            }
            .loading-spinner {
                width: 50px;
                height: 50px;
                border: 4px solid #3e3e42;
                border-top: 4px solid #4ec9b0;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }
            .loading-text {
                margin-top: 20px;
                color: #cccccc;
                font-size: 14px;
            }
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            .lwr-error-overlay {
                position: absolute;
                top: 45px;
                left: 0;
                right: 0;
                bottom: 0;
                background: #1e1e1e;
                display: none;
                overflow-y: auto;
                z-index: 999;
                padding: 40px;
                opacity: 0;
                transition: opacity 0.3s ease-in-out;
            }
            .lwr-error-overlay.active {
                display: block;
                opacity: 1;
            }
            .lwr-error-container {
                max-width: 800px;
                margin: 0 auto;
            }
            .lwr-error-icon {
                font-size: 64px;
                text-align: center;
                margin-bottom: 20px;
            }
            .lwr-error-title {
                font-size: 24px;
                font-weight: 600;
                color: #f48771;
                margin: 0 0 20px 0;
                text-align: center;
            }
            .lwr-error-message {
                font-size: 14px;
                color: #f48771;
                background: rgba(244, 135, 113, 0.1);
                padding: 15px 20px;
                border-radius: 6px;
                border-left: 4px solid #f48771;
                margin-bottom: 20px;
                line-height: 1.6;
            }
            .lwr-error-stack {
                background: rgba(0, 0, 0, 0.3);
                border-radius: 6px;
                padding: 15px;
                margin-top: 20px;
            }
            .lwr-error-stack summary {
                cursor: pointer;
                font-size: 13px;
                color: #858585;
                padding: 5px;
                user-select: none;
            }
            .lwr-error-stack summary:hover {
                color: #cccccc;
            }
            .lwr-error-stack pre {
                margin: 10px 0 0 0;
                padding: 15px;
                background: #0d0d0d;
                border-radius: 4px;
                overflow-x: auto;
                font-size: 12px;
                color: #d4d4d4;
                font-family: 'Courier New', Consolas, monospace;
                line-height: 1.5;
                white-space: pre-wrap;
                word-wrap: break-word;
            }
            .lwr-error-dismiss {
                display: block;
                margin: 20px auto 0;
                padding: 10px 20px;
                background: #3e3e42;
                color: #cccccc;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
                font-family: inherit;
            }
            .lwr-error-dismiss:hover {
                background: #4e4e52;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="toolbar">
                <span class="toolbar-title">⚡ LWC Preview</span>
                <span class="toolbar-component" id="component-name">${componentName}</span>
                <div class="toolbar-spacer"></div>
                <div class="force-reload-button" id="force-reload-button" title="Force Reload - Restart server and refresh preview">
                    <span class="reload-icon">🔄</span>
                    <span class="reload-label">Force Reload</span>
                </div>
                <div class="auto-open-toggle-container">
                    <span class="toggle-label" id="toggle-label">${autoOpenEnabled ? 'Auto-open' : 'Manual'}</span>
                    <div class="toggle-switch ${autoOpenEnabled ? 'enabled' : ''}" id="auto-open-toggle" title="${autoOpenEnabled ? 'Auto-open enabled - Click to disable' : 'Manual mode - Click to enable auto-open'}">
                        <span class="toggle-icon toggle-icon-off">✕</span>
                        <span class="toggle-icon toggle-icon-on">✓</span>
                        <div class="toggle-slider"></div>
                    </div>
                </div>
            </div>
            <iframe id="preview-frame" class="preview-frame" src="http://localhost:${port}"></iframe>
            <div class="loading-overlay" id="loading-overlay">
                <div class="loading-spinner"></div>
                <div class="loading-text" id="loading-text">Loading component...</div>
            </div>
            <div class="lwr-error-overlay" id="lwr-error-overlay">
                <div class="lwr-error-container">
                    <div class="lwr-error-icon">🔥</div>
                    <h2 class="lwr-error-title">LWR Server Error</h2>
                    <div class="lwr-error-message" id="lwr-error-message"></div>
                    <div class="lwr-error-stack">
                        <details>
                            <summary>Stack Trace</summary>
                            <pre id="lwr-error-stack"></pre>
                        </details>
                    </div>
                    <button class="lwr-error-dismiss" id="lwr-error-dismiss">Dismiss</button>
                </div>
            </div>
        </div>
        <script>
            const vscode = acquireVsCodeApi();
            const iframe = document.getElementById('preview-frame');
            const componentNameEl = document.getElementById('component-name');
            const loadingOverlay = document.getElementById('loading-overlay');
            const loadingText = document.getElementById('loading-text');
            const lwrErrorOverlay = document.getElementById('lwr-error-overlay');
            const lwrErrorMessage = document.getElementById('lwr-error-message');
            const lwrErrorStack = document.getElementById('lwr-error-stack');
            const lwrErrorDismiss = document.getElementById('lwr-error-dismiss');
            const autoOpenToggle = document.getElementById('auto-open-toggle');
            const toggleLabel = document.getElementById('toggle-label');
            const forceReloadButton = document.getElementById('force-reload-button');
            
            let autoOpenEnabled = ${autoOpenEnabled ? 'true' : 'false'};
            let isReloading = false;

            function setLoading(isLoading, text = 'Loading component...') {
                if (isLoading) {
                    loadingText.textContent = text;
                    loadingOverlay.classList.add('active');
                } else {
                    setTimeout(() => loadingOverlay.classList.remove('active'), 300);
                }
            }

            function showLwrError(errorMessage, errorStack) {
                lwrErrorMessage.textContent = errorMessage;
                lwrErrorStack.textContent = errorStack;
                lwrErrorOverlay.style.display = 'block';
                lwrErrorOverlay.offsetHeight;
                lwrErrorOverlay.classList.add('active');
                setLoading(false);
            }

            function dismissLwrError() {
                lwrErrorOverlay.classList.remove('active');
                setTimeout(() => lwrErrorOverlay.style.display = 'none', 300);
            }

            lwrErrorDismiss.addEventListener('click', dismissLwrError);

            // Handle force reload button
            forceReloadButton.addEventListener('click', () => {
                if (isReloading) return; // Prevent double-clicking
                
                isReloading = true;
                forceReloadButton.classList.add('reloading');
                forceReloadButton.title = 'Reloading server...';
                
                // Send force reload message to extension
                vscode.postMessage({
                    type: 'forceReload'
                });
                
                // Reset button state after a delay (extension will handle actual reload)
                setTimeout(() => {
                    isReloading = false;
                    forceReloadButton.classList.remove('reloading');
                    forceReloadButton.title = 'Force Reload - Restart server and refresh preview';
                }, 5000);
            });

            // Handle auto-open toggle
            autoOpenToggle.addEventListener('click', () => {
                autoOpenEnabled = !autoOpenEnabled;
                updateAutoOpenUI();
                vscode.postMessage({
                    type: 'toggleAutoOpen',
                    enabled: autoOpenEnabled
                });
            });

            function updateAutoOpenUI() {
                if (autoOpenEnabled) {
                    autoOpenToggle.classList.add('enabled');
                    toggleLabel.textContent = 'Auto-open';
                    autoOpenToggle.title = 'Auto-open enabled - Click to disable';
                } else {
                    autoOpenToggle.classList.remove('enabled');
                    toggleLabel.textContent = 'Manual';
                    autoOpenToggle.title = 'Manual mode - Click to enable auto-open';
                }
            }

            let isLwcReady = false;
            let pendingComponentName = '${componentName}';

            window.addEventListener('message', event => {
                if (event.source === iframe.contentWindow) {
                    const message = event.data;
                    if (message.type === 'componentLoadComplete') {
                        setLoading(false);
                        if (!message.success && message.componentName) {
                            loadingText.textContent = 'Failed to load ' + message.componentName;
                            setTimeout(() => setLoading(false), 2000);
                        }
                    } else if (message.type === 'lwcReady') {
                        // LWC component is ready to receive messages
                        isLwcReady = true;
                        if (pendingComponentName) {
                            iframe.contentWindow.postMessage({
                                type: 'updateComponent',
                                componentName: pendingComponentName
                            }, 'http://localhost:${port}');
                            pendingComponentName = '';
                        }
                    }
                    return;
                }
                
                const message = event.data;
                
                if (message.type === 'updateComponent') {
                    dismissLwrError();
                    componentNameEl.textContent = message.componentName || '';
                    
                    if (isLwcReady) {
                        iframe.contentWindow.postMessage({
                            type: 'updateComponent',
                            componentName: message.componentName
                        }, 'http://localhost:${port}');
                    } else {
                        // Store for later when LWC is ready
                        pendingComponentName = message.componentName;
                    }
                } else if (message.type === 'updateLoadingState') {
                    setLoading(message.isLoading, message.text || 'Loading...');
                } else if (message.type === 'lwrError') {
                    showLwrError(message.errorMessage, message.errorStack);
                } else if (message.type === 'clearLwrError') {
                    dismissLwrError();
                }
            });
        </script>
    </body>
    </html>`;
}

