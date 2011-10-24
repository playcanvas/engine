pc.extend(pc.fw, function () {
    function ScriptComponentData() {
        this.urls = [];
        this.instances = {};
        this._scripts = [];
    }
    ScriptComponentData = ScriptComponentData.extendsFrom(pc.fw.ComponentData);
    
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
