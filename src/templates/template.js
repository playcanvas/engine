Object.assign(pc, function () {

    var Template = function Template(app, json) {
        var parser = new pc.SceneParser(app);

        this._templateRoot = parser.parse(json);
    };

    Template.prototype.instantiate = function () {
        return this._templateRoot.clone();
    };

    return {
        Template: Template
    };
}());
