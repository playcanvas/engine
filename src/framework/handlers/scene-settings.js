import { SceneUtils } from './scene-utils.js';

import { ResourceHandler } from './handler.js';

class SceneSettingsHandler extends ResourceHandler {
    constructor(app) {
        super(app, 'scenesettings');
    }

    load(url, callback) {
        SceneUtils.load(url, this.maxRetries, callback);
    }

    open(url, data) {
        return data.settings;
    }
}

export { SceneSettingsHandler };
