pc.extend(pc, function () {
    var ImageComponentData = function () {
        this.enabled = true;
    };
    ImageComponentData = pc.inherits(ImageComponentData, pc.ComponentData);

    return {
        ImageComponentData: ImageComponentData
    };
}());
