import { ShaderProcessorOptions } from '../../platform/graphics/shader-processor-options.js';
import { FRESNEL_SCHLICK, SPECOCC_AO, SPECULAR_BLINN } from "../constants.js";
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

    useGammaTonemap = true;

    useSkybox = true;

    shadingModel = SPECULAR_BLINN;

    ambientSH = null;

    pixelSnap = false;

    nineSlicedMode = null;

    fastTbn = false;

    twoSidedLighting = false;

    occludeDirect = false;

    occludeSpecular = SPECOCC_AO;

    occludeSpecularIntensity = 1;

    opacityFadesSpecular = true;

    opacityDither = false;

    opacityShadowDither = false;

    conserveEnergy = true;

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

    getShaderVariant(device, scene, objDefs, unused, pass, sortedLights, viewUniformFormat, viewBindGroupFormat, vertexFormat) {
        options.usedUvs = this.usedUvs.slice();
        options.shaderChunk = this.shaderChunk;

        LitMaterialOptionsBuilder.update(options.litOptions, this, scene, objDefs, pass, sortedLights);
        const processingOptions = new ShaderProcessorOptions(viewUniformFormat, viewBindGroupFormat, vertexFormat);
        const library = getProgramLibrary(device);
        library.register('lit', lit);
        const shader = library.getProgram('lit', options, processingOptions, this.userId);
        return shader;
    }
}

export { LitMaterial };
