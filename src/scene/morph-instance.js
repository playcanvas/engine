import { Debug } from '../core/debug.js';

import { BLENDEQUATION_ADD, BLENDMODE_ONE } from '../platform/graphics/constants.js';
import { drawQuadWithShader } from './graphics/quad-render-utils.js';
import { RenderTarget } from '../platform/graphics/render-target.js';
import { DebugGraphics } from '../platform/graphics/debug-graphics.js';

import { createShaderFromCode } from './shader-lib/utils.js';
import { BlendState } from '../platform/graphics/blend-state.js';

// vertex shader used to add morph targets from textures into render target
const textureMorphVertexShader = `
    attribute vec2 vertex_position;
    varying vec2 uv0;
    void main(void) {
        gl_Position = vec4(vertex_position, 0.5, 1.0);
        uv0 = vertex_position.xy * 0.5 + 0.5;
    }
    `;

const blendStateAdditive = new BlendState(true, BLENDEQUATION_ADD, BLENDMODE_ONE, BLENDMODE_ONE);

/**
 * An instance of {@link Morph}. Contains weights to assign to every {@link MorphTarget}, manages
 * selection of active morph targets.
 */
class MorphInstance {
    /**
     * Create a new MorphInstance instance.
     *
     * @param {import('./morph.js').Morph} morph - The {@link Morph} to instance.
     */
    constructor(morph) {
        /**
         * The morph with its targets, which is being instanced.
         *
         * @type {import('./morph.js').Morph}
         */
        this.morph = morph;
        morph.incRefCount();
        this.device = morph.device;

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

        // temporary array of targets with non-zero weight
        this._activeTargets = [];

        if (morph.useTextureMorph) {

            // shader cache
            this.shaderCache = {};

            // max number of morph targets rendered at a time (each uses single texture slot)
            this.maxSubmitCount = this.device.maxTextures;

            // array for max number of weights
            this._shaderMorphWeights = new Float32Array(this.maxSubmitCount);

            // create render targets to morph targets into
            const createRT = (name, textureVar) => {

                // render to appropriate, RGBA formats, we cannot render to RGB float / half float format in WEbGL
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

            // texture params
            this._textureParams = new Float32Array([morph.morphTextureWidth, morph.morphTextureHeight,
                1 / morph.morphTextureWidth, 1 / morph.morphTextureHeight]);

            // resolve possible texture names
            for (let i = 0; i < this.maxSubmitCount; i++) {
                this['morphBlendTex' + i] = this.device.scope.resolve('morphBlendTex' + i);
            }

            this.morphFactor = this.device.scope.resolve('morphFactor[0]');

            // true indicates render target textures are full of zeros to avoid rendering to them when all weights are zero
            this.zeroTextures = false;

        } else {    // vertex attribute based morphing

            // max number of morph targets rendered at a time
            this.maxSubmitCount = 8;

            // weights of active vertex buffers in format used by rendering
            this._shaderMorphWeights = new Float32Array(this.maxSubmitCount);                           // whole array
            this._shaderMorphWeightsA = new Float32Array(this._shaderMorphWeights.buffer, 0, 4);        // first 4 elements
            this._shaderMorphWeightsB = new Float32Array(this._shaderMorphWeights.buffer, 4 * 4, 4);    // second 4 elements

            // pre-allocate array of active vertex buffers used by rendering
            this._activeVertexBuffers = new Array(this.maxSubmitCount);
        }
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

        if (this.rtPositions) {
            this.rtPositions.destroy();
            this.rtPositions = null;
        }

        if (this.texturePositions) {
            this.texturePositions.destroy();
            this.texturePositions = null;
        }

        if (this.rtNormals) {
            this.rtNormals.destroy();
            this.rtNormals = null;
        }

        if (this.textureNormals) {
            this.textureNormals.destroy();
            this.textureNormals = null;
        }
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
                Debug.error(`Cannot find morph target with name: ${key}.`);
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
     * Generate fragment shader to blend a number of textures using specified weights.
     *
     * @param {number} numTextures - Number of textures to blend.
     * @returns {string} Fragment shader.
     * @private
     */
    _getFragmentShader(numTextures) {

        let fragmentShader = '';

        if (numTextures > 0) {
            fragmentShader += 'varying vec2 uv0;\n' +
                'uniform highp float morphFactor[' + numTextures + '];\n';
        }

        for (let i = 0; i < numTextures; i++) {
            fragmentShader += 'uniform highp sampler2D morphBlendTex' + i + ';\n';
        }

        fragmentShader += 'void main (void) {\n' +
            '    highp vec4 color = vec4(0, 0, 0, 1);\n';

        for (let i = 0; i < numTextures; i++) {
            fragmentShader += '    color.xyz += morphFactor[' + i + '] * texture2D(morphBlendTex' + i + ', uv0).xyz;\n';
        }

        fragmentShader += '    gl_FragColor = color;\n' +
            '}\n';

        return fragmentShader;
    }

    /**
     * Create complete shader for texture based morphing.
     *
     * @param {number} count - Number of textures to blend.
     * @returns {import('../platform/graphics/shader.js').Shader} Shader.
     * @private
     */
    _getShader(count) {

        let shader = this.shaderCache[count];

        // if shader is not in cache, generate one
        if (!shader) {
            const fs = this._getFragmentShader(count);
            shader = createShaderFromCode(this.device, textureMorphVertexShader, fs, 'textureMorph' + count);
            this.shaderCache[count] = shader;
        }

        return shader;
    }

    _updateTextureRenderTarget(renderTarget, srcTextureName) {

        const device = this.device;

        // blend currently set up textures to render target
        const submitBatch = (usedCount, blending) => {

            // factors
            this.morphFactor.setValue(this._shaderMorphWeights);

            // alpha blending - first pass gets none, following passes are additive
            device.setBlendState(blending ? blendStateAdditive : BlendState.DEFAULT);

            // render quad with shader for required number of textures
            const shader = this._getShader(usedCount);
            drawQuadWithShader(device, renderTarget, shader);
        };

        // set up parameters for active blend targets
        let usedCount = 0;
        let blending = false;
        const count = this._activeTargets.length;
        for (let i = 0; i < count; i++) {
            const activeTarget = this._activeTargets[i];
            const tex = activeTarget.target[srcTextureName];
            if (tex) {

                // texture
                this['morphBlendTex' + usedCount].setValue(tex);

                // weight
                this._shaderMorphWeights[usedCount] = activeTarget.weight;

                // submit if batch is full
                usedCount++;
                if (usedCount >= this.maxSubmitCount) {

                    submitBatch(usedCount, blending);
                    usedCount = 0;
                    blending = true;
                }
            }
        }

        // leftover batch, or just to clear texture
        if (usedCount > 0 || (count === 0 && !this.zeroTextures)) {
            submitBatch(usedCount, blending);
        }
    }

    _updateTextureMorph() {

        const device = this.device;

        DebugGraphics.pushGpuMarker(device, 'MorphUpdate');

        // update textures if active targets, or no active targets and textures need to be cleared
        if (this._activeTargets.length > 0 || !this.zeroTextures) {

            // blend morph targets into render targets
            if (this.rtPositions)
                this._updateTextureRenderTarget(this.rtPositions, 'texturePositions');

            if (this.rtNormals)
                this._updateTextureRenderTarget(this.rtNormals, 'textureNormals');

            // textures were cleared if no active targets
            this.zeroTextures = this._activeTargets.length === 0;
        }

        DebugGraphics.popGpuMarker(device);
    }

    _updateVertexMorph() {

        // prepare 8 slots for rendering. these are supported combinations: PPPPPPPP, NNNNNNNN, PPPPNNNN
        const count = this.maxSubmitCount;
        for (let i = 0; i < count; i++) {
            this._shaderMorphWeights[i] = 0;
            this._activeVertexBuffers[i] = null;
        }

        let posIndex = 0;
        let nrmIndex = this.morph.morphPositions ? 4 : 0;
        for (let i = 0; i < this._activeTargets.length; i++) {
            const target = this._activeTargets[i].target;

            if (target._vertexBufferPositions) {
                this._activeVertexBuffers[posIndex] = target._vertexBufferPositions;
                this._shaderMorphWeights[posIndex] = this._activeTargets[i].weight;
                posIndex++;
            }

            if (target._vertexBufferNormals) {
                this._activeVertexBuffers[nrmIndex] = target._vertexBufferNormals;
                this._shaderMorphWeights[nrmIndex] = this._activeTargets[i].weight;
                nrmIndex++;
            }
        }
    }

    /**
     * Selects active morph targets and prepares morph for rendering. Called automatically by
     * renderer.
     */
    update() {

        this._dirty = false;
        const targets = this.morph._targets;

        // collect active targets, reuse objects in _activeTargets array to avoid allocations
        let activeCount = 0;
        const epsilon = 0.00001;
        for (let i = 0; i < targets.length; i++) {
            const absWeight = Math.abs(this.getWeight(i));
            if (absWeight > epsilon) {

                // create new object if needed
                if (this._activeTargets.length <= activeCount) {
                    this._activeTargets[activeCount] = {};
                }

                const activeTarget = this._activeTargets[activeCount++];
                activeTarget.absWeight = absWeight;
                activeTarget.weight = this.getWeight(i);
                activeTarget.target = targets[i];
            }
        }
        this._activeTargets.length = activeCount;

        // if there's more active targets then rendering supports
        const maxActiveTargets = this.morph.maxActiveTargets;
        if (this._activeTargets.length > maxActiveTargets) {

            // sort them by absWeight
            this._activeTargets.sort(function (l, r) {
                return (l.absWeight < r.absWeight) ? 1 : (r.absWeight < l.absWeight ? -1 : 0);
            });

            // remove excess
            this._activeTargets.length = maxActiveTargets;
        }

        // prepare for rendering
        if (this.morph.useTextureMorph) {
            this._updateTextureMorph();
        } else {
            this._updateVertexMorph();
        }
    }
}

export { MorphInstance };
