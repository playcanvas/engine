import { ShaderProcessorOptions } from '../../platform/graphics/shader-processor-options.js';
import { DITHER_NONE, FRESNEL_SCHLICK, SPECOCC_AO } from "../constants.js";
import { Material } from './material.js';
import { LitMaterialOptions } from './lit-material-options.js';
import { LitMaterialOptionsBuilder } from './lit-material-options-builder.js';
import { getProgramLibrary } from "../shader-lib/get-program-library.js";
import { lit } from '../shader-lib/programs/lit.js';

const options = new LitMaterialOptions();

/**
 * LitMaterial comprises a shader chunk implementing the material "front end" (the shader program
 * providing the material surface properties like diffuse, opacity, normals etc) and a set of
 * flags which control the material "back end" (the shader program calculating the lighting,
 * shadows, reflections, fogging etc).
 *
 * The front end and back end together form a complete PBR shader.
 *
 * @ignore
 */
class LitMaterial extends Material {
    usedUvs = [true];

    shaderChunk = 'void evaluateFrontend() {}\n';

    chunks = null;

    useLighting = true;

    useFog = true;

    useTonemap = true;

    useSkybox = true;

    ambientSH = null;

    pixelSnap = false;

    nineSlicedMode = null;

    fastTbn = false;

    twoSidedLighting = false;

    occludeDirect = false;

    occludeSpecular = SPECOCC_AO;

    occludeSpecularIntensity = 1;

    opacityFadesSpecular = true;

    opacityDither = DITHER_NONE;

    opacityShadowDither = DITHER_NONE;

    ggxSpecular = false;

    fresnelModel = FRESNEL_SCHLICK;

    dynamicRefraction = false;

    // has members
    hasAo = false;

    hasSpecular = false;

    hasSpecularityFactor = false;

    hasLighting = false;

    hasHeights = false;

    hasNormals = false;

    hasSheen = false;

    hasRefraction = false;

    hasIrridescence = false;

    hasMetalness = false;

    hasClearCoat = false;

    hasClearCoatNormals = false;

    getShaderVariant(device, scene, objDefs, renderParams, pass, sortedLights, viewUniformFormat, viewBindGroupFormat, vertexFormat) {
        options.usedUvs = this.usedUvs.slice();
        options.shaderChunk = this.shaderChunk;

        LitMaterialOptionsBuilder.update(options.litOptions, this, scene, renderParams, objDefs, pass, sortedLights);
        const processingOptions = new ShaderProcessorOptions(viewUniformFormat, viewBindGroupFormat, vertexFormat);
        const library = getProgramLibrary(device);
        library.register('lit', lit);
        const shader = library.getProgram('lit', options, processingOptions, this.userId);
        return shader;
    }
}

export { LitMaterial };
