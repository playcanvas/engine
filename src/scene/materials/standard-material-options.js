import { LitOptions } from "./lit-options.js";

/**
 * The standard material options define a set of options used to control the shader frontend shader
 * generation, such as textures, tints and multipliers.
 */
class StandardMaterialOptions {
    /** @private */
    _pass = 0;

    chunks = [];

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
     * Defines if {@link StandardMaterial#diffuse} constant should affect diffuse color.
     *
     * @type {boolean}
     */
    diffuseTint = false;

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

    litOptions = new LitOptions();

    /**
     * Value of {@link Layer#shaderPass} of the Layer being rendered. Must be set to the same in
     * {@link LitOptions#pass}.
     *
     * @type {number}
     */
    set pass(p) {
        this._pass = p;
        this.litOptions._pass = p;
    }

    get pass() {
        return this._pass;
    }
}

export { StandardMaterialOptions };
