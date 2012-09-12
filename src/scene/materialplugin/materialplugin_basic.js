pc.scene.materialplugin.basic = {
    isTransparent: function (material) {
        var parameters = material.getParameters();
        if (parameters["color"] !== undefined) {
            if (parameters["color"]._data[3] < 1.0)
                return true;
        }
        return false;
    },

    generateStateKey: function (mesh) {
        return mesh.getGeometry().isSkinned() ? 'skin' : 'static';
    },

    getProgram: function (material, mesh) {
        var device = pc.gfx.Device.getCurrent();
        var skinned = mesh.getGeometry().isSkinned();
        var options = {
            skin: skinned
        };
        var library = device.getProgramLibrary();
        var program = library.getProgram("basic", options);
        return program;
    }
};