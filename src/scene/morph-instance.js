import { BLENDEQUATION_ADD, BLENDMODE_ONE, PIXELFORMAT_RGBA32F, PIXELFORMAT_RGBA16F } from '../graphics/constants.js';
import { createShaderFromCode } from '../graphics/program-lib/utils.js';
import { drawQuadWithShader } from '../graphics/simple-post-effect.js';
import { RenderTarget } from '../graphics/render-target.js';

import { Morph } from './morph.js';

// vertex shader used to add morph targets from textures into render target
var textureMorphVertexShader =
    'attribute vec2 vertex_position;\n' +
    'varying vec2 uv0;\n' +
    'void main(void) {\n' +
    '    gl_Position = vec4(vertex_position, 0.5, 1.0);\n' +
    '    uv0 = vertex_position.xy * 0.5 + 0.5;\n' +
    '}\n';

/**
 * @class
 * @name MorphInstance
 * @classdesc An instance of {@link Morph}. Contains weights to assign to every {@link MorphTarget}, manages selection of active morph targets.
 * @param {Morph} morph - The {@link Morph} to instance.
 * @property {MeshInstance} meshInstance The mesh instance this morph instance controls the morphing of.
 * @property {Morph} morph The morph with its targets, which is being instanced.
 */
class MorphInstance {
    constructor(morph) {
        this.morph = morph;
        morph.incRefCount();
        this.device = morph.device;
        this.meshInstance = null;

        // weights
        this._weights = [];
        for (var v = 0; v < morph._targets.length; v++) {
            this.setWeight(v, morph._targets[v].defaultWeight);
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
            var createRT = function (name, textureVar) {

                // render to appropriate, RGBA formats, we cannot render to RGB float / half float format in WEbGL
                var format = morph._renderTextureFormat === Morph.FORMAT_FLOAT ? PIXELFORMAT_RGBA32F : PIXELFORMAT_RGBA16F;
                this[textureVar] = morph._createTexture(name, format);
                return new RenderTarget({
                    colorBuffer: this[textureVar],
                    depth: false
                });
            }.bind(this);

            if (morph.morphPositions) {
                this.rtPositions = createRT("MorphRTPos", "texturePositions");
            }

            if (morph.morphNormals) {
                this.rtNormals = createRT("MorphRTNrm", "textureNormals");
            }

            // texture params
            this._textureParams = new Float32Array([morph.morphTextureWidth, morph.morphTextureHeight,
                1 / morph.morphTextureWidth, 1 / morph.morphTextureHeight]);

            // resolve possible texture names
            for (var i = 0; i < this.maxSubmitCount; i++) {
                this["morphBlendTex" + i] = this.device.scope.resolve("morphBlendTex" + i);
            }

            this.morphFactor = this.device.scope.resolve("morphFactor[0]");

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
     * @function
     * @name MorphInstance#destroy
     * @description Frees video memory allocated by this object.
     */
    destroy() {

        this.meshInstance = null;

        // don't destroy shader as it's in the cache and can be used by other materials
        this.shader = null;

        const morph = this.morph;
        if (morph) {

            // decrease ref count
            this.morph = null;
            morph.decRefCount();

            // destroy morph
            if (morph.getRefCount() < 1) {
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
     * @function
     * @name MorphInstance#clone
     * @description Clones a MorphInstance. The returned clone uses the same {@link Morph} and weights are set to defaults.
     * @returns {MorphInstance} A clone of the specified MorphInstance.
     */
    clone() {
        var clone = new MorphInstance(this.morph);
        return clone;
    }

    /**
     * @function
     * @name MorphInstance#getWeight
     * @description Gets current weight of the specified morph target.
     * @param {number} index - An index of morph target.
     * @returns {number} Weight.
     */
    getWeight(index) {
        return this._weights[index];
    }

    /**
     * @function
     * @name MorphInstance#setWeight
     * @description Sets weight of the specified morph target.
     * @param {number} index - An index of morph target.
     * @param {number} weight - Weight.
     */
    setWeight(index, weight) {
        this._weights[index] = weight;
        this._dirty = true;
    }

    // generates fragment shader to blend number of textures using specified weights
    _getFragmentShader(numTextures) {

        var i, fragmentShader = '';

        if (numTextures > 0) {
            fragmentShader += 'varying vec2 uv0;\n' +
                'uniform highp float morphFactor[' + numTextures + '];\n';
        }

        for (i = 0; i < numTextures; i++) {
            fragmentShader += 'uniform highp sampler2D morphBlendTex' + i + ';\n';
        }

        fragmentShader += 'void main (void) {\n' +
            '    highp vec4 color = vec4(0, 0, 0, 1);\n';

        for (i = 0; i < numTextures; i++) {
            fragmentShader += '    color.xyz += morphFactor[' + i + '] * texture2D(morphBlendTex' + i + ', uv0).xyz;\n';
        }

        fragmentShader += '    gl_FragColor = color;\n' +
            '}\n';

        return fragmentShader;
    }

    // creates complete shader for texture based morphing
    _getShader(count) {

        var shader = this.shaderCache[count];

        // if shader is not in cache, generate one
        if (!shader) {
            var fs = this._getFragmentShader(count);
            shader = createShaderFromCode(this.device, textureMorphVertexShader, fs, "textureMorph" + count);
            this.shaderCache[count] = shader;
        }

        return shader;
    }

    _updateTextureRenderTarget(renderTarget, srcTextureName) {

        var device = this.device;

        // blend curently set up textures to render target
        var submitBatch = function (usedCount, blending) {

            // factors
            this.morphFactor.setValue(this._shaderMorphWeights);

            // alpha blending - first pass gets none, following passes are additive
            device.setBlending(blending);
            if (blending) {
                device.setBlendFunction(BLENDMODE_ONE, BLENDMODE_ONE);
                device.setBlendEquation(BLENDEQUATION_ADD);
            }

            // render quad with shader for required number of textures
            var shader = this._getShader(usedCount);
            drawQuadWithShader(device, renderTarget, shader, undefined, undefined, blending);

        }.bind(this);

        // set up parameters for active blend targets
        var usedCount = 0;
        var blending = false;
        var count = this._activeTargets.length;
        for (var i = 0; i < count; i++) {
            var activeTarget = this._activeTargets[i];
            var tex = activeTarget.target[srcTextureName];
            if (tex) {

                // texture
                this["morphBlendTex" + usedCount].setValue(tex);

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

        var device = this.device;

        // #if _DEBUG
        device.pushMarker("MorphUpdate");
        // #endif

        // update textures if active targets, or no active targets and textures need to be cleared
        if (this._activeTargets.length > 0 || !this.zeroTextures) {

            // blend morph targets into render targets
            this._updateTextureRenderTarget(this.rtPositions, 'texturePositions');
            this._updateTextureRenderTarget(this.rtNormals, 'textureNormals');

            // textures were cleared if no active targets
            this.zeroTextures = this._activeTargets.length === 0;
        }

        // #if _DEBUG
        device.popMarker();
        // #endif
    }

    _updateVertexMorph() {

        // prepare 8 slots for rendering. these are supported combinations: PPPPPPPP, NNNNNNNN, PPPPNNNN
        var i, count = this.maxSubmitCount;
        for (i = 0; i < count; i++) {
            this._shaderMorphWeights[i] = 0;
            this._activeVertexBuffers[i] = null;
        }

        var posIndex = 0;
        var nrmIndex = this.morph.morphPositions ? 4 : 0;
        var target;
        for (i = 0; i < this._activeTargets.length; i++) {
            target = this._activeTargets[i].target;

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
     * @function
     * @name MorphInstance#update
     * @description Selects active morph targets and prepares morph for rendering. Called automatically by renderer.
     */
    update() {

        this._dirty = false;
        var targets = this.morph._targets;

        // collect active targets, reuse objects in _activeTargets array to avoid allocations
        var activeCount = 0, activeTarget;
        var i, absWeight, epsilon = 0.00001;
        for (i = 0; i < targets.length; i++) {
            absWeight = Math.abs(this.getWeight(i));
            if (absWeight > epsilon) {

                    // create new object if needed
                if (this._activeTargets.length <= activeCount) {
                    this._activeTargets[activeCount] = {};
                }

                activeTarget = this._activeTargets[activeCount++];
                activeTarget.absWeight = absWeight;
                activeTarget.weight = this.getWeight(i);
                activeTarget.target = targets[i];
            }
        }
        this._activeTargets.length = activeCount;

        // if there's more active targets then rendering supports
        var maxActiveTargets = this.morph.maxActiveTargets;
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
