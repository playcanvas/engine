Object.assign(pc, function () {

    var AsyncTemplateLoad = function AsyncTemplateLoad(app, instanceData, parent) {
        this._app = app;
        this._instanceData = instanceData;
        this._parent = parent;
    };

    AsyncTemplateLoad.prototype.run = function () {
        var templateIds = pc.TemplateUtils.extractTemplateIds(this._entities);

        new pc.LoadDependencies(
            this._app,
            templateIds,
            this._onLoad.bind(this)
        ).run();
    };

    AsyncTemplateLoad.prototype._onLoad = function () {
        var expanded = pc.TemplateUtils.expandTemplateEntities(
            this._app, this._instanceData.instanceEntities);

        var root = this._callParser(expanded);

        this._parent.addChild(root);
    };

    AsyncTemplateLoad.prototype._callParser = function (expanded) {
        var h = { entities: expanded }; // root's parent is null

        return new pc.SceneParser(this._app).parse(h);
    };
    
    return {
        AsyncTemplateLoad: AsyncTemplateLoad
    };
}());
