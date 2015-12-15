pc.extend(pc, function () {
    var Pack = function (data) {
        this.hierarchy = data.hierarchy;
        this.settings = data.settings;
    };

    return {
        Pack: Pack
    };
}());
