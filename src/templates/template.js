import { SceneParser } from '../resources/parser/scene.js';

/**
 * @private
 * @class
 * @name Template
 * @classdesc Create a Template resource from raw database data.
 * @param {pc.Application} app - The application.
 * @param {object} data - Asset data from the database.
 */
class Template {
    constructor(app, data) {
        this._app = app;

        this._data = data;

        this._templateRoot = null;
    }

    /**
     * @private
     * @function
     * @name Template#instantiate
     * @description Create an instance of this template.
     * @returns {pc.Entity} The root entity of the created instance.
     */
    instantiate() {
        if (!this._templateRoot) { // at first use, after scripts are loaded
            this._parseTemplate();
        }

        return this._templateRoot.clone();
    }

    _parseTemplate() {
        var parser = new SceneParser(this._app, true);

        this._templateRoot = parser.parse(this._data);
    }
}

export { Template };
