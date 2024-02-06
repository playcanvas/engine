import { SceneParser } from '../parsers/scene.js';
import { SceneUtils } from './scene-utils.js';

import { ResourceHandler } from './handler.js';

/**
 * @augments ResourceHandler
 */
class HierarchyHandler extends ResourceHandler {
    /**
     * Type of the resource the handler handles.
     *
     * @type {string}
     */
    handlerType = "hierarchy";

    constructor(app) {
        super(app);
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

        // re-enable script initialization
        this._app.systems.script.preloading = false;

        return parent;
    }
}

export { HierarchyHandler };
