Object.assign(pc, function () {

    var Template = function Template(app, json) {
        this._app = app;

        this.origJson = json;

        var parser = new pc.SceneParser(app);

        this._templateRoot = parser.parse(json);

        this._instanceGuids = [];
    };

    Template.prototype.instantiate = function () {
        var instance = this._templateRoot.clone();

        this._instanceGuids.push(instance.getGuid());

        return instance;
    };

    Template.prototype.applyToInstances = function (callback) {
        for (var i = 0; i < this._instanceGuids.length; i++) {
            var guid = this._instanceGuids[i];

            var entity = this._app.root.findByGuid(guid);

            callback(entity, i, guid);
        }
    };

    return {
        Template: Template
    };
}());
