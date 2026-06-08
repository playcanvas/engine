import { Kernel } from '../../core/math/kernel.js';
import { SEMANTIC_POSITION, SHADERLANGUAGE_GLSL, SHADERLANGUAGE_WGSL } from '../../platform/graphics/constants.js';
import { RenderPassShaderQuad } from '../../scene/graphics/render-pass-shader-quad.js';
import glsldofBlurPS from '../../scene/shader-lib/glsl/chunks/render-pass/frag/dofBlur.js';
import wgsldofBlurPS from '../../scene/shader-lib/wgsl/chunks/render-pass/frag/dofBlur.js';
import { ShaderChunks } from '../../scene/shader-lib/shader-chunks.js';
import { ShaderUtils } from '../../scene/shader-lib/shader-utils.js';

/**
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { Texture } from '../../platform/graphics/texture.js'
 */

/**
 * Render pass implementation of a down-sample filter used by the Depth of Field pass. Based on
 * a texel of the CoC texture, it generates blurred version of the near or far texture.
 *
 * @category Graphics
 * @ignore
 */
class RenderPassDofBlur extends RenderPassShaderQuad {
    blurRadiusNear = 1;

    blurRadiusFar = 1;

    _blurRings = 3;

    _blurRingPoints = 3;

    /**
     * Resolution the blur radius is calibrated against. The blur is applied as a fraction of this
     * height, making the effect resolution-independent (higher resolution only increases quality,
     * not blur strength). Applied as a uniform scale on the blur radius, so it can be changed at
     * runtime without recompiling the shader. Value 540 matches the legacy half-resolution far
     * texture at a 1080p frame, preserving previously authored blurRadius values.
     *
     * @type {number}
     */
    referenceHeight = 540;

    /**
     * @param {GraphicsDevice} device - The graphics device.
     * @param {Texture|null} nearTexture - The near texture to blur. Skip near blur if the texture is null.
     * @param {Texture} farTexture - The far texture to blur.
     * @param {Texture} cocTexture - The CoC texture.
     */
    constructor(device, nearTexture, farTexture, cocTexture) {
        super(device);
        this.nearTexture = nearTexture;
        this.farTexture = farTexture;
        this.cocTexture = cocTexture;

        // register shader chunks
        ShaderChunks.get(device, SHADERLANGUAGE_GLSL).set('dofBlurPS', glsldofBlurPS);
        ShaderChunks.get(device, SHADERLANGUAGE_WGSL).set('dofBlurPS', wgsldofBlurPS);

        const { scope } = device;
        this.kernelId = scope.resolve('kernel[0]');
        this.kernelCountId = scope.resolve('kernelCount');
        this.blurRadiusNearId = scope.resolve('blurRadiusNear');
        this.blurRadiusFarId = scope.resolve('blurRadiusFar');

        this.nearTextureId = scope.resolve('nearTexture');
        this.farTextureId = scope.resolve('farTexture');
        this.cocTextureId = scope.resolve('cocTexture');
    }

    set blurRings(value) {
        if (this._blurRings !== value) {
            this._blurRings = value;
            this.shader = null;
        }
    }

    get blurRings() {
        return this._blurRings;
    }

    set blurRingPoints(value) {
        if (this._blurRingPoints !== value) {
            this._blurRingPoints = value;
            this.shader = null;
        }
    }

    get blurRingPoints() {
        return this._blurRingPoints;
    }

    createShader() {
        this.kernel = new Float32Array(Kernel.concentric(this.blurRings, this.blurRingPoints));
        const kernelCount = this.kernel.length >> 1;
        const nearBlur = this.nearTexture !== null;

        const defines = new Map();
        defines.set('{KERNEL_COUNT}', kernelCount);
        defines.set('{INV_KERNEL_COUNT}', 1.0 / kernelCount);
        if (nearBlur) defines.set('NEAR_BLUR', '');

        this.shader = ShaderUtils.createShader(this.device, {
            uniqueName: `DofBlurShader-${kernelCount}-${nearBlur ? 'nearBlur' : 'noNearBlur'}`,
            attributes: { aPosition: SEMANTIC_POSITION },
            vertexChunk: 'quadVS',
            fragmentChunk: 'dofBlurPS',
            fragmentDefines: defines
        });
    }

    execute() {

        if (!this.shader) {
            this.createShader();
        }

        this.nearTextureId.setValue(this.nearTexture);
        this.farTextureId.setValue(this.farTexture);
        this.cocTextureId.setValue(this.cocTexture);

        this.kernelId.setValue(this.kernel);
        this.kernelCountId.setValue(this.kernel.length >> 1);

        // express the blur radius as a fraction of the reference height, so the effect is
        // resolution-independent (the shader then aspect-corrects it to stay circular in pixels);
        // guard against an invalid reference height to avoid Infinity/NaN blur radii
        const referenceHeight = this.referenceHeight > 0 ? this.referenceHeight : 540;
        const invReferenceHeight = 1 / referenceHeight;
        this.blurRadiusNearId.setValue(this.blurRadiusNear * invReferenceHeight);
        this.blurRadiusFarId.setValue(this.blurRadiusFar * invReferenceHeight);

        super.execute();
    }
}

export { RenderPassDofBlur };
