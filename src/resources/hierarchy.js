import { http } from '../net/http.js';

import { SceneParser } from './parser/scene.js';
import { SceneUtils } from "./scene-utils";

class HierarchyHandler {
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

        // re-enable script initialization
        this._app.systems.script.preloading = false;

        return parent;
    }
}

export { HierarchyHandler };
