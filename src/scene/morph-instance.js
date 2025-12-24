import { Debug } from '../core/debug.js';
import { SEMANTIC_POSITION } from '../platform/graphics/constants.js';
import { drawQuadWithShader } from './graphics/quad-render-utils.js';
import { RenderTarget } from '../platform/graphics/render-target.js';
import { DebugGraphics } from '../platform/graphics/debug-graphics.js';
import { ShaderUtils } from './shader-lib/shader-utils.js';
import { BlendState } from '../platform/graphics/blend-state.js';

/**
 * @import { Morph } from './morph.js'
 * @import { Shader } from '../platform/graphics/shader.js'
 */

/**
 * An instance of {@link Morph}. Contains weights to assign to every {@link MorphTarget}, manages
 * selection of active morph targets.
 *
 * @category Graphics
 */
class MorphInstance {
    /**
     * Create a new MorphInstance instance.
     *
     * @param {Morph} morph - The {@link Morph} to instance.
     */
    constructor(morph) {
        /**
         * The morph with its targets, which is being instanced.
         *
         * @type {Morph}
         */
        this.morph = morph;
        morph.incRefCount();
        this.device = morph.device;

        // shader to blend a required number of morph targets
        const maxNumTargets = morph._targets.length;
        this.shader = this._createShader(maxNumTargets);

        // weights
        this._weights = [];
        this._weightMap = new Map();
        for (let v = 0; v < morph._targets.length; v++) {
            const target = morph._targets[v];
            if (target.name) {
                this._weightMap.set(target.name, v);
            }
            this.setWeight(v, target.defaultWeight);
        }

        // array for max number of weights
        this._shaderMorphWeights = new Float32Array(maxNumTargets);

        // array for target indices
        this._shaderMorphIndex = new Uint32Array(maxNumTargets);

        // create render targets to morph targets into
        const createRT = (name, textureVar) => {

            // render to appropriate, RGBA formats
            this[textureVar] = morph._createTexture(name, morph._renderTextureFormat);
            return new RenderTarget({
                colorBuffer: this[textureVar],
                depth: false
            });
        };

        if (morph.morphPositions) {
            this.rtPositions = createRT('MorphRTPos', 'texturePositions');
        }

        if (morph.morphNormals) {
            this.rtNormals = createRT('MorphRTNrm', 'textureNormals');
        }

        this._textureParams = new Float32Array([morph.morphTextureWidth, morph.morphTextureHeight]);

        // position aabb data - expand it 2x on each side to handle the expected worse range. Note
        // that this is only needed for the fallback solution using integer textures to encode positions
        const halfSize = morph.aabb.halfExtents;
        this._aabbSize = new Float32Array([halfSize.x * 4, halfSize.y * 4, halfSize.z * 4]);
        const min = morph.aabb.getMin();
        this._aabbMin = new Float32Array([min.x * 2, min.y * 2, min.z * 2]);

        // aabb size and min factors for normal rendering, where the range is -1..1
        this._aabbNrmSize = new Float32Array([2, 2, 2]);
        this._aabbNrmMin = new Float32Array([-1, -1, -1]);

        this.aabbSizeId = this.device.scope.resolve('aabbSize');
        this.aabbMinId = this.device.scope.resolve('aabbMin');

        // resolve shader inputs
        this.morphTextureId = this.device.scope.resolve('morphTexture');
        this.morphFactor = this.device.scope.resolve('morphFactor[0]');
        this.morphIndex = this.device.scope.resolve('morphIndex[0]');
        this.countId = this.device.scope.resolve('count');

        // true indicates render target textures are full of zeros to avoid rendering to them when all weights are zero
        this.zeroTextures = false;
    }

    /**
     * Frees video memory allocated by this object.
     */
    destroy() {

        // don't destroy shader as it's in the cache and can be used by other materials
        this.shader = null;

        const morph = this.morph;
        if (morph) {

            // decrease ref count
            this.morph = null;
            morph.decRefCount();

            // destroy morph
            if (morph.refCount < 1) {
                morph.destroy();
            }
        }

        this.rtPositions?.destroy();
        this.rtPositions = null;

        this.texturePositions?.destroy();
        this.texturePositions = null;

        this.rtNormals?.destroy();
        this.rtNormals = null;

        this.textureNormals?.destroy();
        this.textureNormals = null;
    }

    /**
     * Clones a MorphInstance. The returned clone uses the same {@link Morph} and weights are set
     * to defaults.
     *
     * @returns {MorphInstance} A clone of the specified MorphInstance.
     */
    clone() {
        return new MorphInstance(this.morph);
    }

    _getWeightIndex(key) {
        if (typeof key === 'string') {
            const index = this._weightMap.get(key);
            if (index === undefined) {
                Debug.errorOnce(`Cannot find morph target with name: ${key}.`);
            }
            return index;
        }
        return key;
    }

    /**
     * Gets current weight of the specified morph target.
     *
     * @param {string|number} key - An identifier for the morph target. Either the weight index or
     * the weight name.
     * @returns {number} Weight.
     */
    getWeight(key) {
        const index = this._getWeightIndex(key);
        return this._weights[index];
    }

    /**
     * Sets weight of the specified morph target.
     *
     * @param {string|number} key - An identifier for the morph target. Either the weight index or
     * the weight name.
     * @param {number} weight - Weight.
     */
    setWeight(key, weight) {
        const index = this._getWeightIndex(key);
        Debug.assert(index >= 0 && index < this.morph._targets.length);
        this._weights[index] = weight;
        this._dirty = true;
    }

    /**
     * Create the shader for texture based morphing.
     *
     * @param {number} maxCount - Maximum bumber of textures to blend.
     * @returns {Shader} Shader.
     * @private
     */
    _createShader(maxCount) {

        const defines = new Map();
        defines.set('{MORPH_TEXTURE_MAX_COUNT}', maxCount);
        if (this.morph.intRenderFormat) defines.set('MORPH_INT', '');

        const outputType = this.morph.intRenderFormat ? 'uvec4' : 'vec4';

        return ShaderUtils.createShader(this.device, {
            uniqueName: `TextureMorphShader_${maxCount}-${this.morph.intRenderFormat ? 'int' : 'float'}`,
            attributes: { vertex_position: SEMANTIC_POSITION },
            vertexChunk: 'morphVS',
            fragmentChunk: 'morphPS',
            fragmentDefines: defines,
            fragmentOutputTypes: [outputType]
        });
    }

    _updateTextureRenderTarget(renderTarget, activeCount, isPos) {

        const { morph, device } = this;
        this.setAabbUniforms(isPos);
        this.morphTextureId.setValue(isPos ? morph.targetsTexturePositions : morph.targetsTextureNormals);

        device.setBlendState(BlendState.NOBLEND);

        // set up parameters for active blend targets
        this.countId.setValue(activeCount);
        this.morphFactor.setValue(this._shaderMorphWeights);
        this.morphIndex.setValue(this._shaderMorphIndex);

        // render quad with shader
        drawQuadWithShader(device, renderTarget, this.shader);
    }

    _updateTextureMorph(activeCount) {

        const device = this.device;

        DebugGraphics.pushGpuMarker(device, 'MorphUpdate');

        // update textures if active targets, or no active targets and textures need to be cleared
        if (activeCount > 0 || !this.zeroTextures) {

            // blend morph targets into render targets
            if (this.rtPositions) {
                this._updateTextureRenderTarget(this.rtPositions, activeCount, true);
            }

            if (this.rtNormals) {
                this._updateTextureRenderTarget(this.rtNormals, activeCount, false);
            }

            // textures were cleared if no active targets
            this.zeroTextures = activeCount === 0;
        }

        DebugGraphics.popGpuMarker(device);
    }

    setAabbUniforms(isPos = true) {
        this.aabbSizeId.setValue(isPos ? this._aabbSize : this._aabbNrmSize);
        this.aabbMinId.setValue(isPos ? this._aabbMin : this._aabbNrmMin);
    }


    prepareRendering(device) {
        this.setAabbUniforms();
    }

    /**
     * Selects active morph targets and prepares morph for rendering. Called automatically by
     * renderer.
     */
    update() {

        this._dirty = false;
        const targets = this.morph._targets;

        // collect weights for active targets
        const epsilon = 0.00001;
        const weights = this._shaderMorphWeights;
        const indices = this._shaderMorphIndex;

        let activeCount = 0;
        for (let i = 0; i < targets.length; i++) {
            if (Math.abs(this.getWeight(i)) > epsilon) {
                weights[activeCount] = this.getWeight(i);
                indices[activeCount] = i;
                activeCount++;
            }
        }

        // prepare for rendering
        this._updateTextureMorph(activeCount);
    }
}

export { MorphInstance };
