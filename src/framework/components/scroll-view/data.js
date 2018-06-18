Object.assign(pc, function () {
    var ScrollViewComponentData = function () {
        this.enabled = true;
    };
    ScrollViewComponentData = pc.inherits(ScrollViewComponentData, pc.ComponentData);

    return {
        ScrollViewComponentData: ScrollViewComponentData
    };
}());
