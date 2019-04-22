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

    Template.expand = function (app, data) {
        var template = app.assets.get(data.template_id);

        // todo: replace this with an actual traversal-based tree-copy

        var h = JSON.parse(JSON.stringify(template.resource.origJson));

        var instId = data.resource_id;

        var parent = data.parent;

        var templId = Object.keys(h.entities)[0];

        Object.assign(data, h.entities[templId]);

        data.resource_id = instId;

        data.parent = parent;

        data.collapsed_template = false;

        return data;
    };

    return {
        Template: Template
    };
}());
