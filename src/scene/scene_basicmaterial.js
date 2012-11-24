pc.extend(pc.scene, function () {

    /**
     * @name pc.scene.BasicMaterial
     * @class A Basic material is the main, general purpose material that is most often used for rendering. 
     * It can approximate a wide variety of surface types and can simlulate dynamic reflected light.
     * @property {Float32Array} ambient The ambient color of the material (RGB, where each component is 0 to 1).
     * @property {pc.gfx.Texture} lightMap The light map of the material. This must be a 2D texture rather 
     * than a cube map.
     * @author Will Eastcott
     */
    var BasicMaterial = function () {
        this.setProgramName('basic');
        this.setParameter('uColor', new Float32Array([1, 1, 1, 1]));
    };

    BasicMaterial = pc.inherits(BasicMaterial, pc.scene.Material);

    Object.defineProperty(BasicMaterial.prototype, 'color', {
        get: function() { 
            return this.getParameter('uColor');
        },
        set: function(color) {
            if (this.getParameter('texture_diffuseMap')) {
                this.deleteParameter('texture_diffuseMap');
            }
            this.setParameter('uColor', color);
        }
    });

    Object.defineProperty(BasicMaterial.prototype, 'colorMap', {
        get: function() { 
            return this.getParameter('texture_diffuseMap'); 
        },
        set: function(diffuseMap) {
            if (this.getParameter('uColor')) {
                this.deleteParameter('uColor');
            }
            this.setParameter('texture_diffuseMap', diffuseMap);
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