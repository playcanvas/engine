import { ShaderProcessorOptions } from '../../platform/graphics/shader-processor-options.js';
import { LIGHTTYPE_DIRECTIONAL, LIGHTTYPE_OMNI, LIGHTTYPE_SPOT, MASK_AFFECT_DYNAMIC, SHADERDEF_INSTANCING, SHADERDEF_MORPH_NORMAL, SHADERDEF_MORPH_POSITION, SHADERDEF_MORPH_TEXTURE_BASED, SHADERDEF_SCREENSPACE, SHADERDEF_SKIN } from "../constants.js";
import { getProgramLibrary } from "../shader-lib/get-program-library.js";
import { LitOptions } from "./lit-options.js";
import { collectLights } from "./lit-material-common.js";
import { Material } from './material.js';
import { custom } from '../shader-lib/programs/custom.js';

/**
 * A custom material provides a custom shader chunk for the arguments passed to the lit shader.
 *
 * @ignore
 */

class CustomMaterial extends Material {
    _litOptions = new LitOptions();

    _shaderChunk = "";

    _usedUvs = [true];

    /**
     * Set the lit options used to generate the lighting code for the shader.
     *
     * @param {LitOptions} value - The lit options.
     */
    set litOptions(value) {
        this._litOptions = value;
    }

    /**
     * Get the lit options.
     *
     * @type {LitOptions}
     */
    get litOptions() {
        return this._litOptions;
    }

    /**
     * Set the shader chunk used to feed arguments to the lit shader.
     *
     * @param {string} value - The shader chunk.
     */
    set shaderChunk(value) {
        this._shaderChunk = value;
    }

    /**
     * Get the shader chunk used to describe the arguments to the lit shader.
     *
     * @type {string}
     */
    get shaderChunk() {
        return this._shaderChunk;
    }

    /**
     * Enable a specific UV channel.
     *
     * @param {number} value - The UV channel.
     */
    setUsedUv(value) {
        this._usedUvs[value] = true;
    }

    getShaderVariant(device, scene, objDefs, staticLightList, pass, sortedLights, viewUniformFormat, viewBindGroupFormat, vertexFormat) {

        const options = {
            skin: objDefs && (objDefs & SHADERDEF_SKIN) !== 0,
            screenSpace: objDefs && (objDefs & SHADERDEF_SCREENSPACE) !== 0,
            useInstancing: objDefs && (objDefs & SHADERDEF_INSTANCING) !== 0,
            useMorphPosition: objDefs && (objDefs & SHADERDEF_MORPH_POSITION) !== 0,
            useMorphNormal: objDefs && (objDefs & SHADERDEF_MORPH_NORMAL) !== 0,
            useMorphTextureBased: objDefs && (objDefs & SHADERDEF_MORPH_TEXTURE_BASED) !== 0,

            pass: pass,
            litOptions: this._litOptions
        };

        const lightsFiltered = [];
        const mask = objDefs ? (objDefs >> 16) : MASK_AFFECT_DYNAMIC;
        this._litOptions.lightMaskDynamic = !!(mask & MASK_AFFECT_DYNAMIC);

        collectLights(LIGHTTYPE_DIRECTIONAL, sortedLights[LIGHTTYPE_DIRECTIONAL], lightsFiltered, mask);
        collectLights(LIGHTTYPE_OMNI, sortedLights[LIGHTTYPE_OMNI], lightsFiltered, mask, staticLightList);
        collectLights(LIGHTTYPE_SPOT, sortedLights[LIGHTTYPE_SPOT], lightsFiltered, mask, staticLightList);

        this._litOptions.lights = lightsFiltered;
        options.customLitArguments = this._shaderChunk;
        options.usedUvs = this._usedUvs;

        const processingOptions = new ShaderProcessorOptions(viewUniformFormat, viewBindGroupFormat, vertexFormat);

        const library = getProgramLibrary(device);
        library.register('custom', custom);
        const shader = library.getProgram('custom', options, processingOptions);

        this._dirtyShader = false;
        return shader;
    }
}

export { CustomMaterial };
