pc.extend(pc, function () {
    var ScriptComponentData = function () {
        this.enabled = true;
    };
    ScriptComponentData = pc.inherits(ScriptComponentData, pc.ComponentData);

    return {
        ScriptComponentData: ScriptComponentData
    };
}());
