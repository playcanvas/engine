pc.extend(pc.scene, function () {

    /**
     * @name pc.scene.DepthMaterial
     * @class A Depth material is for rendering depth information.
     * @author Will Eastcott
     */
    var DepthMaterial = function () {
        this.setProgramName('depth');
    };

    DepthMaterial = pc.inherits(DepthMaterial, pc.scene.Material);

    DepthMaterial.prototype.getProgram = function (mesh) {
        var key = mesh.getGeometry().isSkinned() ? 'skin' : 'static';

        var program = this._programs[key];
        if (program) {
            return program;
        }

        var device = pc.gfx.Device.getCurrent();
        var skinned = mesh.getGeometry().isSkinned();
        var options = {
            skin: skinned
        };
        var library = device.getProgramLibrary();
        program = library.getProgram('depth', options);
        this._programs[key] = program;
        return program;
    };
    
    return {
        DepthMaterial: DepthMaterial
    }; 
}());