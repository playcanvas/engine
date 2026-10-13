import { BlendState } from '../../../../platform/graphics/blend-state.js';
import { SEMANTIC_POSITION, SHADERLANGUAGE_GLSL, SHADERLANGUAGE_WGSL } from '../../../../platform/graphics/constants.js';
import { RenderPassShaderQuad } from '../../../../scene/graphics/render-pass-shader-quad.js';
import glslLensFlareSpritePS from '../glsl/sprite-ps.js';
import glslLensFlareSpriteVS from '../glsl/sprite-vs.js';
import { ShaderChunks } from '../../../../scene/shader-lib/shader-chunks.js';
import { ShaderUtils } from '../../../../scene/shader-lib/shader-utils.js';
import wgslLensFlareSpritePS from '../wgsl/sprite-ps.js';
import wgslLensFlareSpriteVS from '../wgsl/sprite-vs.js';

/**
 * @import { GraphicsDevice } from '../../../../platform/graphics/graphics-device.js'
 * @import { Texture } from '../../../../platform/graphics/texture.js'
 */

/**
 * A render pass drawing the elements of all lens flares as instanced quads, added into the flare
 * texture. See FramePassLensFlare.
 *
 * @ignore
 */
class RenderPassLensFlareSprites extends RenderPassShaderQuad {
    /**
     * The number of elements to draw, one instance each.
     *
     * @type {number}
     */
    numInstances = 0;

    /**
     * The element data texture, see FramePassLensFlare.
     *
     * @type {Texture|null}
     */
    elementsTexture = null;

    /**
     * The baked shapes, a texture array.
     *
     * @type {Texture|null}
     */
    shapesTexture = null;

    /**
     * The visibility of the flares measured this frame.
     *
     * @type {Texture|null}
     */
    visibilityTexture = null;

    /**
     * The per-flare data, see FramePassLensFlare.
     *
     * @type {Float32Array|null}
     */
    flareData = null;

    /**
     * @param {GraphicsDevice} device - The graphics device.
     */
    constructor(device) {
        super(device);

        ShaderChunks.get(device, SHADERLANGUAGE_GLSL).set('lensFlareSpriteVS', glslLensFlareSpriteVS);
        ShaderChunks.get(device, SHADERLANGUAGE_GLSL).set('lensFlareSpritePS', glslLensFlareSpritePS);
        ShaderChunks.get(device, SHADERLANGUAGE_WGSL).set('lensFlareSpriteVS', wgslLensFlareSpriteVS);
        ShaderChunks.get(device, SHADERLANGUAGE_WGSL).set('lensFlareSpritePS', wgslLensFlareSpritePS);

        this.shader = ShaderUtils.createShader(device, {
            uniqueName: 'LensFlareSprites',
            attributes: { aPosition: SEMANTIC_POSITION },
            vertexChunk: 'lensFlareSpriteVS',
            fragmentChunk: 'lensFlareSpritePS'
        });

        this.blendState = BlendState.ADDBLEND;

        const scope = device.scope;
        this.elementsId = scope.resolve('lensFlareElements');
        this.shapesId = scope.resolve('lensFlareShapes');
        this.visibilityId = scope.resolve('lensFlareVisibility');
        this.dataId = scope.resolve('lensFlareData[0]');
        this.paramsId = scope.resolve('lensFlareParams');
        this.paramsValue = new Float32Array(4);
    }

    execute() {

        // the pass still clears the flare texture when there is nothing to draw
        const { numInstances, elementsTexture, shapesTexture, visibilityTexture, flareData } = this;
        if (numInstances === 0 || !elementsTexture || !shapesTexture || !visibilityTexture || !flareData) {
            return;
        }

        const rt = this.renderTarget;
        const { paramsValue } = this;
        paramsValue[0] = rt.height / rt.width;
        this.paramsId.setValue(paramsValue);
        this.elementsId.setValue(elementsTexture);
        this.shapesId.setValue(shapesTexture);
        this.visibilityId.setValue(visibilityTexture);
        this.dataId.setValue(flareData);

        this.device.setDrawStates(this.blendState, this.depthState, this.cullMode, this.frontFace, this.stencilFront, this.stencilBack);
        this.quadRender.render(undefined, undefined, numInstances);
    }
}

export { RenderPassLensFlareSprites };
