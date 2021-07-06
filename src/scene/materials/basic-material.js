import { Color } from '../../math/color.js';
import {
    SHADERDEF_INSTANCING, SHADERDEF_MORPH_NORMAL, SHADERDEF_MORPH_POSITION, SHADERDEF_MORPH_TEXTURE_BASED,
    SHADERDEF_SCREENSPACE, SHADERDEF_SKIN
} from '../constants.js';

import { Material } from './material.js';

/**
 * @class
 * @name BasicMaterial
 * @augments Material
 * @classdesc A Basic material is for rendering unlit geometry, either using a constant color or a
 * color map modulated with a color.
 * @property {Color} color The flat color of the material (RGBA, where each component is 0 to 1).
 * @property {Texture|null} colorMap The color map of the material (default is null). If specified, the color map is
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
class BasicMaterial extends Material {
    constructor() {
        super();

        this.color = new Color(1, 1, 1, 1);
        this.colorUniform = new Float32Array(4);

        this.colorMap = null;
        this.vertexColors = false;
    }

    /**
     * @function
     * @name BasicMaterial#clone
     * @description Duplicates a Basic material. All properties are duplicated except textures
     * where only the references are copied.
     * @returns {BasicMaterial} A cloned Basic material.
     */
    clone() {
        var clone = new BasicMaterial();

        Material.prototype._cloneInternal.call(this, clone);

        clone.color.copy(this.color);
        clone.colorMap = this.colorMap;
        clone.vertexColors = this.vertexColors;

        return clone;
    }

    updateUniforms() {
        this.clearParameters();

        this.colorUniform[0] = this.color.r;
        this.colorUniform[1] = this.color.g;
        this.colorUniform[2] = this.color.b;
        this.colorUniform[3] = this.color.a;
        this.setParameter('uColor', this.colorUniform);
        if (this.colorMap) {
            this.setParameter('texture_diffuseMap', this.colorMap);
        }
    }

    updateShader(device, scene, objDefs, staticLightList, pass, sortedLights) {
        var options = {
            skin: objDefs && (objDefs & SHADERDEF_SKIN) !== 0,
            screenSpace: objDefs && (objDefs & SHADERDEF_SCREENSPACE) !== 0,
            useInstancing: objDefs && (objDefs & SHADERDEF_INSTANCING) !== 0,
            useMorphPosition: objDefs && (objDefs & SHADERDEF_MORPH_POSITION) !== 0,
            useMorphNormal: objDefs && (objDefs & SHADERDEF_MORPH_NORMAL) !== 0,
            useMorphTextureBased: objDefs && (objDefs & SHADERDEF_MORPH_TEXTURE_BASED) !== 0,

            vertexColors: this.vertexColors,
            diffuseMap: !!this.colorMap,
            pass: pass
        };
        var library = device.getProgramLibrary();
        this.shader = library.getProgram('basic', options);
    }
}

export { BasicMaterial };
