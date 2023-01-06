import { LitOptions } from "./lit-options.js";

/**
 * The standard material options define a set of options used to control the shader frontend shader generation,
 * such as textures, tints and multipliers.
 *
 * @property {number} pass Value of {@link Layer#shaderPass} of the Layer being rendered. Must be set to the
 * same in {@link LitOptions#pass}.
 * @property {boolean} forceUv1 If UV1 (second set of texture coordinates) is required in the shader. Will be
 * declared as "vUv1" and passed to the fragment shader.
 * @property {boolean} ambientTint The value of {@link StandardMaterial#ambientTint}.
 * @property {boolean} diffuseTint Defines if {@link StandardMaterial#diffuse} constant should affect diffuse color.
 * @property {boolean} specularTint Defines if {@link StandardMaterial#specular} constant should affect specular
 * color.
 * @property {boolean} metalnessTint Defines if {@link StandardMaterial#metalness} constant should affect metalness
 * value.
 * @property {boolean} glossTint Defines if {@link StandardMaterial#shininess} constant should affect glossiness
 * value.
 * @property {boolean} emissiveTint Defines if {@link StandardMaterial#emissive} constant should affect emission
 * value.
 * @property {boolean} opacityTint Defines if {@link StandardMaterial#opacity} constant should affect opacity value.
 * @property {boolean} packedNormal If normal map contains X in RGB, Y in Alpha, and Z must be reconstructed.
 * @property {boolean} glossInvert Invert the gloss channel.
 * @property {boolean} sheenGlossInvert Invert the sheen gloss channel.
 * @property {boolean} clearCoatGlossInvert Invert the clearcoat gloss channel.
 */
class StandardMaterialOptions {
    constructor() {
        this.chunks = [];
        this._pass = 0;
        this.forceUv1 = false;
        this.ambientTint = false;
        this.diffuseTint = false;
        this.specularTint = false;
        this.metalnessTint = false;
        this.glossTint = false;
        this.emissiveTint = false;
        this.opacityTint = false;
        this.emissiveEncoding = 'linear';
        this.lightMapEncoding = 'linear';
        this.packedNormal = false;
        this.glossInvert = false;
        this.sheenGlossInvert = false;
        this.clearCoatGlossInvert = false;

        this.litOptions = new LitOptions();
    }

    set pass(p) {
        this._pass = p;
        this.litOptions._pass = p;
    }

    get pass() {
        return this._pass;
    }
}

export { StandardMaterialOptions };
