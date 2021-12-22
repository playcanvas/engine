import { SceneUtils } from './scene-utils.js';
import { SceneParser } from './parser/scene.js';

/** @typedef {import('../framework/application.js').Application} Application */
/** @typedef {import('./handler.js').ResourceHandler} ResourceHandler */

/**
 * Resource handler used for loading {@link Scene} resources.
 *
 * @implements {ResourceHandler}
 */
class SceneHandler {
    /**
     * Create a new SceneHandler instance.
     *
     * @param {Application} app - The running {@link Application}.
     */
    constructor(app) {
        this._app = app;
        this.maxRetries = 0;
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

    patch(asset, assets) {
    }
}

export { SceneHandler };
