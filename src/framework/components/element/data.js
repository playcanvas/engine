Object.assign(pc, (function () {
    function ElementComponentData() {
        this.enabled = true;
    }
    ElementComponentData = pc.inherits(ElementComponentData, pc.ComponentData);

    return {
        ElementComponentData: ElementComponentData
    };
}()));
