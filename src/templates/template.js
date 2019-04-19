Object.assign(pc, function () {

    var Template = function Template(app, json) {
        var parser = new pc.SceneParser(app);

        this._templateRoot = parser.parse(json);

        this._instanceGuids = [];
    };

    Template.prototype.instantiate = function () {
        var instance = this._templateRoot.clone();

        this._instanceGuids.push(instance.getGuid());

        return instance;
    };
    
    return {
        Template: Template
    };
}());
