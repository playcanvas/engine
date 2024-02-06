import { SceneUtils } from './scene-utils.js';

import { ResourceHandler } from './handler.js';

/**
 * @augments ResourceHandler
 */
class SceneSettingsHandler extends ResourceHandler {
    constructor(app) {
        super(app);
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
