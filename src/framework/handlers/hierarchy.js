import { SceneParser } from '../parsers/scene.js';
import { SceneUtils } from './scene-utils.js';

import { ResourceHandler } from './handler.js';

class HierarchyHandler extends ResourceHandler {
    /**
     * @param {import('../app-base').AppBase} app - The running {@link AppBase}.
     */
    constructor(app) {
        super(app, 'hierarchy');
    }

    load(url, callback) {
        SceneUtils.load(url, this.maxRetries, callback);
    }

    open(url, data) {
        // prevent script initialization until entire scene is open
        this._app.systems.script.preloading = true;

        const parser = new SceneParser(this._app, false);
        const parent = parser.parse(data);

        // re-enable script initialization
        this._app.systems.script.preloading = false;

        return parent;
    }
}

export { HierarchyHandler };
