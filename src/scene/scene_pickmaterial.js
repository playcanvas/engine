pc.extend(pc.scene, function () {

    /**
     * @name pc.scene.PickMaterial
     * @class A Pick material is for rendering a scene into the frame buffer such that different meshes
     * have different colors that can be queried on a frame buffer read at a specific pixel (normally a
     * click coordinate). This implements frame buffer picking.
     * @property {Float32Array} color The flat color to be written to the frame buffer. RGBA, with each
     * component between 0 and 1.
     * @author Will Eastcott
     */
    var PickMaterial = function () {
        this.color = pc.math.vec4.create(0, 0, 0, 1);

        this.update();
    };

    PickMaterial = pc.inherits(PickMaterial, pc.scene.Material);

    PickMaterial.prototype.update = function () {
        this.clearParameters();

        this.setParameter('uColor', this.color);

        this.transparent = false;
    };

    PickMaterial.prototype.getProgram = function (mesh) {
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
        program = library.getProgram('pick', options);
        this._programs[key] = program;
        return program;
    };
    
    return {
        PickMaterial: PickMaterial
    }; 
}());