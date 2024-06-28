import { LitShaderOptions } from "../shader-lib/programs/lit-shader-options.js";

/**
 * The standard material options define a set of options used to control the shader frontend shader
 * generation, such as textures, tints and multipliers.
 *
 * @category Graphics
 */
class StandardMaterialOptions {
    /**
     * If UV1 (second set of texture coordinates) is required in the shader. Will be declared as
     * "vUv1" and passed to the fragment shader.
     *
     * @type {boolean}
     */
    forceUv1 = false;

    /**
     * The value of {@link StandardMaterial#ambientTint}.
     *
     * @type {boolean}
     */
    ambientTint = false;

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

    /**
     * Defines if {@link StandardMaterial#emissive} constant should affect emissive color.
     *
     * @type {boolean}
     */
    emissiveTint = false;

    /**
     * Defines if {@link StandardMaterial#opacity} constant should affect opacity value.
     *
     * @type {boolean}
     */
    opacityTint = false;

    emissiveEncoding = 'linear';

    lightMapEncoding = 'linear';

    /**
     * If normal map contains X in RGB, Y in Alpha, and Z must be reconstructed.
     *
     * @type {boolean}
     */
    packedNormal = false;

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
