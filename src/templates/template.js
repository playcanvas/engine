Object.assign(pc, function () {
    'use strict';

    /**
     * @private
     * @constructor
     * @name pc.Template
     * @classdesc Create a Template resource from raw database data
     * @param {pc.Application} app The application
     * @param {Object} data Asset data from the database
     */
    var Template = function Template(app, data) {
        this._app = app;

        this._data = data;

        this._expandedData = {};

        this._templateRoot = null;
    };

    /**
     * @function
     * @name pc.Template#instantiate
     * @description Create an instance of this template
     * @returns {pc.Entity} The root entity of the created instance
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
     * @returns {Object} An object whose entities field contains
     * expanded entity data
     */
    Template.prototype.getExpandedData = function () {
        if (!this._expandedData.entities) {
            this._expandedData.entities = pc.TemplateUtils.expandTemplateEntities(
                this._app, this._data.entities);
        }

        return this._expandedData;
    };

    Template.prototype._parseTemplate = function () {
        var parser = new pc.SceneParser(this._app);

        this._templateRoot = parser.parse(this.getExpandedData(), true);
    };

    return {
        Template: Template
    };
}());
