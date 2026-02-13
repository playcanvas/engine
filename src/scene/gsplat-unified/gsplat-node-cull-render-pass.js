import { SEMANTIC_POSITION } from '../../platform/graphics/constants.js';
import { RenderPassShaderQuad } from '../graphics/render-pass-shader-quad.js';
import { ShaderUtils } from '../shader-lib/shader-utils.js';
import glslGsplatNodeCullingPS from '../shader-lib/glsl/chunks/gsplat/frag/gsplatNodeCulling.js';
import wgslGsplatNodeCullingPS from '../shader-lib/wgsl/chunks/gsplat/frag/gsplatNodeCulling.js';

/**
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { Texture } from '../../platform/graphics/texture.js'
 */

/**
 * Render pass for GPU frustum culling of bounding spheres. Reads local-space spheres and
 * transform indices, reconstructs world matrices, and tests against camera frustum planes.
 * Outputs a bit-packed R32U visibility texture (each texel holds 32 sphere results as bits).
 *
 * @ignore
 */
class GSplatNodeCullRenderPass extends RenderPassShaderQuad {
    /** @type {Texture} */
    _boundsSphereTexture;

    /** @type {Texture} */
    _boundsTransformIndexTexture;

    /** @type {Texture} */
    _transformsTexture;

    /** @type {number} */
    _totalBoundsEntries = 0;

    /** @type {Float32Array} */
    _frustumPlanes;

    /**
     * @param {GraphicsDevice} device - The graphics device.
     */
    constructor(device) {
        super(device);

        this.shader = ShaderUtils.createShader(device, {
            uniqueName: 'GSplatNodeCulling',
            attributes: { aPosition: SEMANTIC_POSITION },
            vertexChunk: 'quadVS',
            fragmentGLSL: glslGsplatNodeCullingPS,
            fragmentWGSL: wgslGsplatNodeCullingPS,
            fragmentOutputTypes: ['uint']
        });

        // Resolve uniform scope IDs
        this.boundsSphereTextureId = device.scope.resolve('boundsSphereTexture');
        this.boundsTransformIndexTextureId = device.scope.resolve('boundsTransformIndexTexture');
        this.transformsTextureId = device.scope.resolve('transformsTexture');
        this.boundsTextureWidthId = device.scope.resolve('boundsTextureWidth');
        this.transformsTextureWidthId = device.scope.resolve('transformsTextureWidth');
        this.totalBoundsEntriesId = device.scope.resolve('totalBoundsEntries');
        this.frustumPlanesId = device.scope.resolve('frustumPlanes[0]');
    }

    /**
     * @param {Texture} boundsSphereTexture - The bounds sphere texture.
     * @param {Texture} boundsTransformIndexTexture - The transform index texture.
     * @param {Texture} transformsTexture - The transforms texture.
     * @param {number} totalBoundsEntries - Total number of bounds entries.
     * @param {Float32Array} frustumPlanes - 24 floats: 6 planes x (nx, ny, nz, distance).
     */
    setup(boundsSphereTexture, boundsTransformIndexTexture, transformsTexture, totalBoundsEntries, frustumPlanes) {
        this._boundsSphereTexture = boundsSphereTexture;
        this._boundsTransformIndexTexture = boundsTransformIndexTexture;
        this._transformsTexture = transformsTexture;
        this._totalBoundsEntries = totalBoundsEntries;
        this._frustumPlanes = frustumPlanes;
    }

    execute() {
        this.boundsSphereTextureId.setValue(this._boundsSphereTexture);
        this.boundsTransformIndexTextureId.setValue(this._boundsTransformIndexTexture);
        this.transformsTextureId.setValue(this._transformsTexture);
        this.boundsTextureWidthId.setValue(this._boundsSphereTexture.width);
        this.transformsTextureWidthId.setValue(this._transformsTexture.width);
        this.totalBoundsEntriesId.setValue(this._totalBoundsEntries);
        this.frustumPlanesId.setValue(this._frustumPlanes);

        super.execute();
    }
}

export { GSplatNodeCullRenderPass };
