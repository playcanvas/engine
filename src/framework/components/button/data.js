Object.assign(pc, (function () {
    function ButtonComponentData() {
        this.enabled = true;
    }
    ButtonComponentData = pc.inherits(ButtonComponentData, pc.ComponentData);

    return {
        ButtonComponentData: ButtonComponentData
    };
}()));
