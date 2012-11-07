pc.extend(pc.fw, function () {
    function ScriptComponentData() {
        // serialized
        this.urls = [];

        // not serialized
        this.instances = {};
        this._scripts = [];
        this.runInTools = false;
    }
    ScriptComponentData = pc.inherits(ScriptComponentData, pc.fw.ComponentData);
    
    return {
        ScriptComponentData: ScriptComponentData
    };
    
}());