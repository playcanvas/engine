Object.assign(pc, (function () {
    function ScriptComponentData() {
        this.enabled = true;
    }
    ScriptComponentData = pc.inherits(ScriptComponentData, pc.ComponentData);

    return {
        ScriptComponentData: ScriptComponentData
    };
}()));
