import { Color } from '../../core/math/color.js';

import { ShaderProcessorOptions } from '../../platform/graphics/shader-processor-options.js';

import {
    SHADERDEF_INSTANCING, SHADERDEF_MORPH_NORMAL, SHADERDEF_MORPH_POSITION, SHADERDEF_MORPH_TEXTURE_BASED,
    SHADERDEF_SCREENSPACE, SHADERDEF_SKIN
} from '../constants.js';
import { getProgramLibrary } from '../shader-lib/get-program-library.js';
import { basic } from '../shader-lib/programs/basic.js';
import { Material } from './material.js';

/**
 * A BasicMaterial is for rendering unlit geometry, either using a constant color or a color map
 * modulated with a color.
 *
 * ```javascript
 * // Create a new Basic material
 * const material = new pc.BasicMaterial();
 *
 * // Set the material to have a texture map that is multiplied by a red color
 * material.color.set(1, 0, 0);
 * material.colorMap = diffuseMap;
 *
 * // Notify the material that it has been modified
 * material.update();
 * ```
 *
 * @category Graphics
 */
class BasicMaterial extends Material {
    /**
     * The flat color of the material (RGBA, where each component is 0 to 1).
     *
     * @type {Color}
     */
    color = new Color(1, 1, 1, 1);

    /** @ignore */
    colorUniform = new Float32Array(4);

    /**
     * The color map of the material (default is null). If specified, the color map is
     * modulated by the color property.
     *
     * @type {import('../../platform/graphics/texture.js').Texture|null}
     */
    colorMap = null;

    /** @ignore */
    vertexColors = false;

    /**
     * Copy a `BasicMaterial`.
     *
     * @param {BasicMaterial} source - The material to copy from.
     * @returns {BasicMaterial} The destination material.
     */
    copy(source) {
        super.copy(source);

        this.color.copy(source.color);
        this.colorMap = source.colorMap;
        this.vertexColors = source.vertexColors;

        return this;
    }

    /**
     * @param {import('../../platform/graphics/graphics-device.js').GraphicsDevice} device - The graphics device.
     * @param {import('../scene.js').Scene} scene - The scene.
     * @ignore
     */
    updateUniforms(device, scene) {
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

    getShaderVariant(device, scene, objDefs, renderParams, pass, sortedLights, viewUniformFormat, viewBindGroupFormat, vertexFormat) {

        const options = {
            skin: objDefs && (objDefs & SHADERDEF_SKIN) !== 0,
            screenSpace: objDefs && (objDefs & SHADERDEF_SCREENSPACE) !== 0,
            useInstancing: objDefs && (objDefs & SHADERDEF_INSTANCING) !== 0,
            useMorphPosition: objDefs && (objDefs & SHADERDEF_MORPH_POSITION) !== 0,
            useMorphNormal: objDefs && (objDefs & SHADERDEF_MORPH_NORMAL) !== 0,
            useMorphTextureBased: objDefs && (objDefs & SHADERDEF_MORPH_TEXTURE_BASED) !== 0,

            alphaTest: this.alphaTest > 0,
            vertexColors: this.vertexColors,
            diffuseMap: !!this.colorMap,
            pass: pass
        };

        const processingOptions = new ShaderProcessorOptions(viewUniformFormat, viewBindGroupFormat, vertexFormat);

        const library = getProgramLibrary(device);
        library.register('basic', basic);

        return library.getProgram('basic', options, processingOptions, this.userId);
    }
}

export { BasicMaterial };
