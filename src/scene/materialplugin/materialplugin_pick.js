pc.scene.materialplugin.pick = {
    isTransparent: function (material) {
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
        var program = library.getProgram("pick", options);
        return program;
    }
};