import { SceneParser } from '../resources/parser/scene.js';

/** @typedef {import('../framework/application.js').Application} Application */
/** @typedef {import('../framework/entity.js').Entity} Entity */

/**
 * Create a Template resource from raw database data.
 */
class Template {
    /**
     * Create a new Template instance.
     *
     * @param {Application} app - The application.
     * @param {object} data - Asset data from the database.
     */
    constructor(app, data) {
        this._app = app;

        this._data = data;

        this._templateRoot = null;
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

    _parseTemplate() {
        const parser = new SceneParser(this._app, true);

        this._templateRoot = parser.parse(this._data);
    }
}

export { Template };
