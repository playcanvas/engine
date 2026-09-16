import { SceneUtils } from './scene-utils.js';

import { ResourceHandler } from './handler.js';

/**
 * Resource handler for the `scenesettings` asset type. Loads a PlayCanvas scene JSON file and
 * returns only its settings block, leaving the entity hierarchy untouched.
 *
 * @ignore
 */
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
