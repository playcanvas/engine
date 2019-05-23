Object.assign(pc, function () {

    var AsyncTemplateLoad = function AsyncTemplateLoad(app, json, parent) {
        this._app = app;
        this._json = json;
        this._parent = parent;

        this._entities = json.instance_entities; // moved here from the scene by collapse
        this._expanded = {};
    };

    AsyncTemplateLoad.prototype.run = function () {
        var templateIds = pc.TemplateUtils.extractTemplateIds(this._entities);

        new pc.LoadDependencies(this._app, templateIds, this._onLoad.bind(this)).run();
    };

    AsyncTemplateLoad.prototype._onLoad = function () {
        this._expandAll();

        var root = this._callParser();

        this._parent.addChild(root);
    };

    AsyncTemplateLoad.prototype._expandAll = function () {
        for (var guid in this._entities) {
            var h = this._entities[guid];

            this._expanded[guid] = h.collapsed_template ?
                pc.TemplateUtils.expandEntity(this._app, h) : h;
        }
    };
    
    AsyncTemplateLoad.prototype._callParser = function () {
        var h = { entities: this._expanded };

        return new pc.SceneParser(this._app).parse(h); // root's parent is null
    };
    
    return {
        AsyncTemplateLoad: AsyncTemplateLoad
    };
}());
