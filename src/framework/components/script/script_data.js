pc.extend(pc, function () {
    var ScriptComponentData = function () {
        // serialized
        this.scripts = [];
        this.enabled = true;

        // not serialized
        this.instances = {};
        this._instances = {};
        this.runInTools = false;
        this.attributes = {};
        this.initialized = false;
        this.postInitialized = false;
        this.areScriptsLoaded = false;
    };
    ScriptComponentData = pc.inherits(ScriptComponentData, pc.ComponentData);

    return {
        ScriptComponentData: ScriptComponentData
    };
}());