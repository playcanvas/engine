pc.extend(pc.fw, function () {
    function ScriptComponentData() {
        this.urls = [];
        this.runInTools = false;
        this.instances = {};
        this._scripts = [];
    }
    ScriptComponentData = pc.inherits(ScriptComponentData, pc.fw.ComponentData);
    
    return {
        ScriptComponentData: ScriptComponentData
    };
    
}());
editor.link.addComponentType("script");

editor.link.expose({
    system: "script",
    variable: "urls",
    name: "urls",
    displayName: "URLs",
    description: "Attach scripts to this Entity",
    type: "script_urls",
    defaultValue: []
});
