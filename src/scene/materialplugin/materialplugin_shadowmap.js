pc.scene.materialplugin.shadowmap = {
    isTransparent: function (material) {
        // Shadow geometry is never transparent.  It either occludes or it doesn't.
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
        var program = library.getProgram("shadowmap", options);
        return program;
    }
};