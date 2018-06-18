Object.assign(pc, function () {
    var ButtonComponentData = function () {
        this.enabled = true;
    };
    ButtonComponentData = pc.inherits(ButtonComponentData, pc.ComponentData);

    return {
        ButtonComponentData: ButtonComponentData
    };
}());
