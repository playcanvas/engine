Object.assign(pc, function () {
    var ElementComponentData = function () {
        this.enabled = true;
    };
    ElementComponentData = pc.inherits(ElementComponentData, pc.ComponentData);

    return {
        ElementComponentData: ElementComponentData
    };
}());
