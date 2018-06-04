pc.extend(pc, function () {
    var ScrollbarComponentData = function () {
        this.enabled = true;
    };
    ScrollbarComponentData = pc.inherits(ScrollbarComponentData, pc.ComponentData);

    return {
        ScrollbarComponentData: ScrollbarComponentData
    };
}());
