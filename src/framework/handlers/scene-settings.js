import { SceneUtils } from './scene-utils.js';

class SceneSettingsHandler {
    constructor(app) {
        this._app = app;
        this.maxRetries = 0;
    }

    load(url, callback) {
        SceneUtils.load(url, this.maxRetries, callback);
    }

    open(url, data) {
        return data.settings;
    }
}

export { SceneSettingsHandler };
