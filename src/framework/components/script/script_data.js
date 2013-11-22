pc.extend(pc.fw, function () {
    var ScriptComponentData = function () {
        // serialized
        this.scripts = [];

        // not serialized
        this.instances = {};
        this._scripts = [];
        this.runInTools = false;
    };
    ScriptComponentData = pc.inherits(ScriptComponentData, pc.fw.ComponentData);
    
    return {
        ScriptComponentData: ScriptComponentData
    };
}());