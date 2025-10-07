import { LightningElement, track } from 'lwc';

export default class PreviewContainer extends LightningElement {
    @track componentName = '';

    connectedCallback() {
        // Listen for messages from VS Code extension
        this.boundHandleMessage = this.handleMessage.bind(this);
        window.addEventListener('message', this.boundHandleMessage);
    }

    disconnectedCallback() {
        if (this.boundHandleMessage) {
            window.removeEventListener('message', this.boundHandleMessage);
        }
    }

    handleMessage(event) {
        // Check if message is from VS Code extension (via iframe postMessage)
        if (event.data && event.data.type === 'updateComponent') {
            this.componentName = event.data.componentName || '';
        }
    }
}
