import { LitShaderOptions } from '../shader-lib/programs/lit-shader-options.js';

/**
 * The standard material options define a set of options used to control the shader frontend shader
 * generation, such as textures, tints and multipliers.
 *
 * @category Graphics
 */
class StandardMaterialOptions {
    /**
     * The set of defines used to generate the shader.
     *
     * @type {Map<string, string>}
     */
    defines = new Map();

    /**
     * If UV1 (second set of texture coordinates) is required in the shader. Will be declared as
     * "vUv1" and passed to the fragment shader.
     *
     * @type {boolean}
     */
    forceUv1 = false;

    /**
     * Defines if {@link StandardMaterial#specular} constant should affect specular color.
     *
     * @type {boolean}
     */
    specularTint = false;

    /**
     * Defines if {@link StandardMaterial#metalness} constant should affect metalness value.
     *
     * @type {boolean}
     */
    metalnessTint = false;

    /**
     * Defines if {@link StandardMaterial#gloss} constant should affect glossiness value.
     *
     * @type {boolean}
     */
    glossTint = false;

    emissiveEncoding = 'linear';

    lightMapEncoding = 'linear';

    vertexColorGamma = false;

    /**
     * If normal map contains X in RGB, Y in Alpha, and Z must be reconstructed.
     *
     * @type {boolean}
     */
    packedNormal = false;

    /**
     * If normal detail map contains X in RGB, Y in Alpha, and Z must be reconstructed.
     *
     * @type {boolean}
     */
    normalDetailPackedNormal = false;

    /**
     * If normal clear coat map contains X in RGB, Y in Alpha, and Z must be reconstructed.
     *
     * @type {boolean}
     */
    clearCoatPackedNormal = false;

    /**
     * Invert the gloss channel.
     *
     * @type {boolean}
     */
    glossInvert = false;

    /**
     * Invert the sheen gloss channel.
     *
     * @type {boolean}
     */
    sheenGlossInvert = false;

    /**
     * Invert the clearcoat gloss channel.
     *
     * @type {boolean}
     */
    clearCoatGlossInvert = false;

    /**
     * True to include AO variables even if AO is not used, which allows SSAO to be used in the lit shader.
     *
     * @type {boolean}
     */
    useAO = false;

    /**
     * Storage for the options for lit the shader and material.
     *
     * @type {LitShaderOptions}
     */
    litOptions = new LitShaderOptions();

    // program-library assumes material options has a pass property
    get pass() {
        return this.litOptions.pass;
    }
}

export { StandardMaterialOptions };
