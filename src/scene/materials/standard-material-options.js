import { LitOptions } from "./lit-options.js";

/**
 * - pass: value of {@link Layer#shaderPass} of the Layer being rendered. Must be set to the
 * same in {@link LitOptions#pass}.
 * - forceUv1: if UV1 (second set of texture coordinates) is required in the shader. Will be
 * declared as "vUv1" and passed to the fragment shader.
 * - ambientTint: the value of {@link StandardMaterial#ambientTint}.
 * - diffuseTint: defines if {@link StandardMaterial#diffuse} constant should affect diffuse color.
 * - specularTint: defines if {@link StandardMaterial#specular} constant should affect specular
 * color.
 * - metalnessTint: defines if {@link StandardMaterial#metalness} constant should affect metalness
 * value.
 * - glossTint: defines if {@link StandardMaterial#shininess} constant should affect glossiness
 * value.
 * - emissiveTint: defines if {@link StandardMaterial#emissive} constant should affect emission
 * value.
 * - opacityTint: defines if {@link StandardMaterial#opacity} constant should affect opacity value.
 * - emissiveEncoding: how emissiveMap is encoded. This value is based on Texture#encoding.
 * - lightMapEncoding: how lightMap is encoded. This value is based on on Texture#encoding.
 * - packedNormal: if normal map contains X in RGB, Y in Alpha, and Z must be reconstructed.
 *
 */
class StandardMaterialOptions {
    constructor() {
        this.chunks = [];
        this.pass = 0;
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

        this.litOptions = new LitOptions();
    }
}

export { StandardMaterialOptions };
