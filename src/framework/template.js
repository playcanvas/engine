import { SceneParser } from './parsers/scene.js';

/**
 * @import { AppBase } from './app-base.js'
 * @import { Entity } from './entity.js'
 */

/**
 * Create a Template resource from raw database data.
 */
class Template {
    /**
     * @type {AppBase}
     * @private
     */
    _app;

    /** @private */
    _data;

    /**
     * @type {Entity|null}
     * @private
     */
    _templateRoot = null;

    /**
     * Create a new Template instance.
     *
     * @param {AppBase} app - The application.
     * @param {object} data - Asset data from the database.
     */
    constructor(app, data) {
        this._app = app;
        this._data = data;
    }

    /**
     * Create an instance of this template.
     *
     * @returns {Entity} The root entity of the created instance.
     */
    instantiate() {
        if (!this._templateRoot) { // at first use, after scripts are loaded
            this._parseTemplate();
        }

        return this._templateRoot.clone();
    }

    /** @private */
    _parseTemplate() {
        const parser = new SceneParser(this._app, true);

        this._templateRoot = parser.parse(this._data);
    }

    set data(value) {
        this._data = value;
        // cache invalidation: the next instantiate() will parse and use the new _data
        this._templateRoot = null;
    }

    get data() {
        return this._data;
    }
}

export { Template };
