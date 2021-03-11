import { SceneParser } from './parser/scene.js';
import { SceneUtils } from "./scene-utils";

/**
 * @class
 * @name SceneHandler
 * @implements {ResourceHandler}
 * @classdesc Resource handler used for loading {@link Scene} resources.
 * @param {Application} app - The running {@link Application}.
 */
class SceneHandler {
    constructor(app) {
        this._app = app;
        this.maxRetries = 0;
    }

    load(url, callback) {
        SceneUtils.load(url, callback);
    }

    open(url, data) {
        // prevent script initialization until entire scene is open
        this._app.systems.script.preloading = true;

        var parser = new SceneParser(this._app, false);
        var parent = parser.parse(data);

        // set scene root
        var scene = this._app.scene;
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
