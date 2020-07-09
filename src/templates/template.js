import { SceneParser } from '../resources/parser/scene.js';

import { TemplateUtils } from './template-utils.js';

import { CompressUtils } from '../compress/compress-utils.js';

/**
 * @private
 * @class
 * @name pc.Template
 * @classdesc Create a Template resource from raw database data.
 * @param {pc.Application} app - The application.
 * @param {object} data - Asset data from the database.
 */
function Template(app, data) {
    this._app = app;

    this._data = data;

    this._expandedData = {};

    this._templateRoot = null;
}

/**
 * @private
 * @function
 * @name pc.Template#instantiate
 * @description Create an instance of this template.
 * @returns {pc.Entity} The root entity of the created instance.
 */
Template.prototype.instantiate = function () {
    if (!this._templateRoot) { // at first use, after scripts are loaded
        this._parseTemplate();
    }

    return this._templateRoot.clone();
};


/**
 * @private
 * @function
 * @name pc.Template#getExpandedData
 * @description Creates, if needed, and returns an object whose entities field contains
 * expanded entity data. This output format matches the format of raw scene data.
 * @returns {object} An object whose entities field contains
 * expanded entity data.
 */
Template.prototype.getExpandedData = function () {
    if (!this._expandedData.entities) {
        this._expandedData.entities = TemplateUtils.expandTemplateEntities(
            this._app, this._data.entities);
    }

    return this._expandedData;
};

Template.prototype._parseTemplate = function () {
    this._data = CompressUtils.decompress(this._data);

    var parser = new SceneParser(this._app, true);

    this._templateRoot = parser.parse(this.getExpandedData());
};

export { Template };
