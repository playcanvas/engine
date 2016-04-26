pc.extend(pc, function () {
    var ScriptLegacyComponentData = function () {
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
    ScriptLegacyComponentData = pc.inherits(ScriptLegacyComponentData, pc.ComponentData);

    return {
        ScriptLegacyComponentData: ScriptLegacyComponentData
    };
}());
