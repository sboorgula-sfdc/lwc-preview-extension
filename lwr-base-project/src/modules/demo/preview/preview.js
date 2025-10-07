import { LightningElement, api, track } from 'lwc';

export default class Preview extends LightningElement {
  @track componentConstructor;
  @track hasError = false;
  @track errorMessage = '';
  @track errorStack = '';
  @track errorComponentName = '';

  _componentName = '';
  _previousComponentName = '';

  get hasComponent() {
    return this.componentConstructor != null && !this.hasError;
  }

  @api
  get componentName() {
    return this._componentName;
  }

  set componentName(value) {
    this._componentName = value;
    // Load component when name changes
    this.loadComponent();
  }

  async loadComponent() {
    // Clear previous component and error state if name changed
    if (this._componentName !== this._previousComponentName) {
      this.componentConstructor = null;
      this.hasError = false;
      this.errorMessage = '';
      this.errorStack = '';
      this._previousComponentName = this._componentName;
    }

    if (!this._componentName) {
      this.componentConstructor = null;
      this.hasError = false;
      this.notifyLoadComplete(false);
      return;
    }

    try {
      const { default: ctor } = await import(`c/${this._componentName}`);
      this.componentConstructor = ctor;
      this.hasError = false;
      console.log(`✅ Loaded: ${this._componentName}`);
      this.notifyLoadComplete(true);
    } catch (error) {
      console.error(`❌ Failed to load: ${this._componentName}`, error);

      // Set error state
      this.componentConstructor = null;
      this.hasError = true;
      this.errorComponentName = this._componentName;
      this.errorMessage = this.getErrorMessage(error);
      this.errorStack = error.stack || error.toString();

      this.notifyLoadComplete(false);
    }
  }

  getErrorMessage(error) {
    // Check for common error types
    if (error.message) {
      if (error.message.includes('Cannot find module')) {
        return `Component "c/${this._componentName}" does not exist. Make sure the component files are in force-app/main/default/lwc/${this._componentName}/ and have been synced.`;
      }
      if (error.message.includes('Unexpected token')) {
        return `Syntax error in component "${this._componentName}". Check the JavaScript file for syntax errors.`;
      }
      if (error.message.includes('import')) {
        return `Import error in "${this._componentName}". ${error.message}`;
      }
      return error.message;
    }
    return 'Unknown error occurred while loading component.';
  }

  notifyLoadComplete(success) {
    // Dispatch custom event that bubbles up
    this.dispatchEvent(new CustomEvent('componentloaded', {
      bubbles: true,
      composed: true,
      detail: {
        componentName: this._componentName,
        success: success
      }
    }));

    // Send message to parent window (for webview communication)
    window.parent.postMessage({
      type: 'componentLoadComplete',
      componentName: this._componentName,
      success: success
    }, '*');
  }
}