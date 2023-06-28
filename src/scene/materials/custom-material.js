import { ShaderProcessorOptions } from '../../platform/graphics/shader-processor-options.js';
import { LIGHTTYPE_DIRECTIONAL, LIGHTTYPE_OMNI, LIGHTTYPE_SPOT, MASK_AFFECT_DYNAMIC, SHADERDEF_INSTANCING, SHADERDEF_MORPH_NORMAL, SHADERDEF_MORPH_POSITION, SHADERDEF_MORPH_TEXTURE_BASED, SHADERDEF_SCREENSPACE, SHADERDEF_SKIN } from "../constants";
import { getProgramLibrary } from "../shader-lib/get-program-library";
import { LitOptions } from "./lit-options";
import { collectLights } from "./lit-material-common.js";
import { Material } from './material.js';
import { custom } from '../shader-lib/programs/custom.js';

/**
 * A custom material provides a custom front-end part of a lit material
 *
 * @augments Material
 */


class CustomMaterial extends Material {
    /**
     * Create a new custom material instance.
     */
    constructor() {
        super();

        this._litOptions = new LitOptions();
        this._argumentsChunk = "";
    }

    set litOptions(value) {
        this._litOptions = value;
    }

    get litOptions() {
        return this._litOptions;
    }

    set argumentsChunk(value) {
        this._argumentsChunk = value;
    }

    get argumentsChunk() {
        return this._argumentsChunk;
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
        options.customLitArguments = this._argumentsChunk;

        const processingOptions = new ShaderProcessorOptions(viewUniformFormat, viewBindGroupFormat, vertexFormat);

        const library = getProgramLibrary(device);
        library.register('custom', custom);
        const shader = library.getProgram('custom', options, processingOptions);

        this._dirtyShader = false;
        return shader;
    }
}

export { CustomMaterial };
