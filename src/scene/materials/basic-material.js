import { Color } from '../../core/color.js';

import { Material } from './material.js';

/**
 * @class
 * @name pc.BasicMaterial
 * @augments pc.Material
 * @classdesc A Basic material is for rendering unlit geometry, either using a constant color or a
 * color map modulated with a color.
 * @property {pc.Color} color The flat color of the material (RGBA, where each component is 0 to 1).
 * @property {pc.Texture|null} colorMap The color map of the material (default is null). If specified, the color map is
 * modulated by the color property.
 * @example
 * // Create a new Basic material
 * var material = new pc.BasicMaterial();
 *
 * // Set the material to have a texture map that is multiplied by a red color
 * material.color.set(1, 0, 0);
 * material.colorMap = diffuseMap;
 *
 * // Notify the material that it has been modified
 * material.update();
 */
function BasicMaterial() {
    Material.call(this);

    this.color = new Color(1, 1, 1, 1);
    this.colorUniform = new Float32Array(4);

    this.colorMap = null;
    this.vertexColors = false;
}
BasicMaterial.prototype = Object.create(Material.prototype);
BasicMaterial.prototype.constructor = BasicMaterial;

Object.assign(BasicMaterial.prototype, {
    /**
     * @function
     * @name pc.BasicMaterial#clone
     * @description Duplicates a Basic material. All properties are duplicated except textures
     * where only the references are copied.
     * @returns {pc.BasicMaterial} A cloned Basic material.
     */
    clone: function () {
        var clone = new BasicMaterial();

        Material.prototype._cloneInternal.call(this, clone);

        clone.color.copy(this.color);
        clone.colorMap = this.colorMap;
        clone.vertexColors = this.vertexColors;

        return clone;
    },

    updateUniforms: function () {
        this.clearParameters();

        this.colorUniform[0] = this.color.r;
        this.colorUniform[1] = this.color.g;
        this.colorUniform[2] = this.color.b;
        this.colorUniform[3] = this.color.a;
        this.setParameter('uColor', this.colorUniform);
        if (this.colorMap) {
            this.setParameter('texture_diffuseMap', this.colorMap);
        }
    },

    updateShader: function (device, scene, objDefs, staticLightList, pass, sortedLights) {
        var options = {
            skin: !!this.meshInstances[0].skinInstance,
            vertexColors: this.vertexColors,
            diffuseMap: !!this.colorMap,
            pass: pass
        };
        var library = device.getProgramLibrary();
        this.shader = library.getProgram('basic', options);
    }
});

export { BasicMaterial };
