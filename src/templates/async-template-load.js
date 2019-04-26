Object.assign(pc, function () {

    var AsyncTemplateLoad = function AsyncTemplateLoad(app, json) {
        this._app = app;
        this._json = json;
    };

    AsyncTemplateLoad.prototype.run = function () {
        new pc.LoadDependencies(this._app, this._json, this._onLoad.bind(this)).run();
    };


    return {
        AsyncTemplateLoad: AsyncTemplateLoad
    };
}());
