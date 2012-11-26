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
        this._color = new Float32Array([1, 1, 1, 1]);
        this._colorMap = null;

        this.setParameter('uColor', this._color);
    };

    BasicMaterial = pc.inherits(BasicMaterial, pc.scene.Material);

    Object.defineProperty(BasicMaterial.prototype, 'color', {
        get: function() { 
            return this._color;
        },
        set: function(color) {
            this._color = color;
            this.setParameter('uColor', color);
            this.transparent = (color[3] < 1);
        }
    });

    Object.defineProperty(BasicMaterial.prototype, 'colorMap', {
        get: function() { 
            return this.getParameter('texture_diffuseMap'); 
        },
        set: function(colorMap) {
            this._colorMap = colorMap;
            if (diffuseMap === null) {
                if (this.getParameter('texture_diffuseMap')) {
                    this.deleteParameter('texture_diffuseMap');
                }
            } else {
                this.setParameter('texture_diffuseMap', colorMap);
            }
        }
    });

    BasicMaterial.prototype.getProgram = function (mesh) {
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
        program = library.getProgram('basic', options);
        this._programs[key] = program;
        return program;
    };
    
    return {
        BasicMaterial: BasicMaterial
    }; 
}());