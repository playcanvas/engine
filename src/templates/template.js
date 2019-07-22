/**
 * Create a Template resource from raw database data.
 *
 * This is called by TemplateHandler after all assets referenced
 * by template_id in entities here have been loaded.
 * Therefore entities can be expanded right away.
 *
 * Calling SceneParser requires script assets referenced in components
 * to be loaded. We do it when 'instantiate' is called for the first
 * time, after the scene has been parsed, which in turn happens
 * after all scripts are loaded.
 *
 */

Object.assign(pc, function () {

    var Template = function Template(app, data) {
        this._app = app;

        this._data = data;

        this._expandedData = {};
    };

    Template.prototype.instantiate = function () {
        if (!this._templateRoot) { // at first use, after scripts are loaded
            this._parseTemplate();
        }

        return this._templateRoot.clone();
    };

    Template.prototype.getExpandedData = function () {
        if (!this._expandedData.entities) {
            this._expandedData.entities = pc.TemplateUtils.expandTemplateEntities(
                this._app, this._data.entities);
        }

        return this._expandedData;
    };

    Template.prototype._parseTemplate = function () {
        var parser = new pc.SceneParser(this._app);

        this._templateRoot = parser.parse(this.getExpandedData());
    };

    return {
        Template: Template
    };
}());
