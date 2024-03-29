import { SceneUtils } from './scene-utils.js';
import { SceneParser } from '../parsers/scene.js';

import { ResourceHandler } from './handler.js';

/**
 * Resource handler used for loading {@link Scene} resources.
 *
 * @category Graphics
 */
class SceneHandler extends ResourceHandler {
    /**
     * Create a new SceneHandler instance.
     *
     * @param {import('../app-base.js').AppBase} app - The running {@link AppBase}.
     * @ignore
     */
    constructor(app) {
        super(app, 'scene');
    }

    load(url, callback) {
        SceneUtils.load(url, this.maxRetries, callback);
    }

    open(url, data) {
        // prevent script initialization until entire scene is open
        this._app.systems.script.preloading = true;

        const parser = new SceneParser(this._app, false);
        const parent = parser.parse(data);

        // set scene root
        const scene = this._app.scene;
        scene.root = parent;

        this._app.applySceneSettings(data.settings);

        // re-enable script initialization
        this._app.systems.script.preloading = false;

        return scene;
    }
}

export { SceneHandler };
