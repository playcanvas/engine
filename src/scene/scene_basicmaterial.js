pc.extend(pc.scene, function () {

    /**
     * @name pc.scene.BasicMaterial
     * @class A Basic material is is for rendering unlit geometry, either using a constant color or a
     * color map modulated with a color.
     * @property {Float32Array} color The flat color of the material (RGBA, where each component is 0 to 1).
     * @property {pc.gfx.Texture} colorMap The color map of the material. If specified, the color map is 
     * modulated by the color property.
     * @author Will Eastcott
     */
    var BasicMaterial = function () {
        this.color = pc.math.vec4.create(1, 1, 1, 1);
        this.colorMap = null;

        this.update();
    };

    BasicMaterial = pc.inherits(BasicMaterial, pc.scene.Material);

    BasicMaterial.prototype.update = function () {
        this.clearParameters();

        this.setParameter('uColor', this.color);
        if (this.colorMap) {
            this.setParameter('texture_diffuseMap', this.colorMap);
        }

        this.transparent = (this.color[3] < 1);
        if (this.colorMap) {
            if (this.colorMap.format === pc.gfx.PIXELFORMAT_R8_G8_B8_A8) {
                this.transparent = true;
            }
        }
    };

    BasicMaterial.prototype.getProgram = function (mesh) {
//        var key = mesh.getGeometry().isSkinned() ? 'skin' : 'static';
        var key = 'static';

        var program = this._programs[key];
        if (program) {
            return program;
        }

        var device = pc.gfx.Device.getCurrent();
//        var skinned = mesh.getGeometry().isSkinned();
        var skinned = false;
        var options = {
            skin: skinned
        };
        var library = device.getProgramLibrary();
        program = library.getProgram('basic', options);
        this._programs[key] = program;
        return program;
    };
    
    return {
        BasicMaterial: BasicMaterial
    }; 
}());