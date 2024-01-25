import { Debug } from '../../../core/debug.js';
import {
    PIXELFORMAT_RGBA8, DEVICETYPE_NULL
} from '../constants.js';
import { GraphicsDevice } from '../graphics-device.js';

import { NullIndexBuffer } from './null-index-buffer.js';
import { NullRenderTarget } from './null-render-target.js';
import { NullShader } from './null-shader.js';
import { NullTexture } from './null-texture.js';
import { NullVertexBuffer } from './null-vertex-buffer.js';

class NullGraphicsDevice extends GraphicsDevice {
    constructor(canvas, options = {}) {
        super(canvas, options);
        options = this.initOptions;

        this.isNull = true;
        this._deviceType = DEVICETYPE_NULL;
        this.samples = 1;

        Debug.log('NullGraphicsDevice');
    }

    destroy() {
        super.destroy();
    }

    initDeviceCaps() {

        this.disableParticleSystem = true;
        this.precision = 'highp';
        this.maxPrecision = 'highp';
        this.maxSamples = 4;
        this.maxTextures = 16;
        this.maxTextureSize = 4096;
        this.maxCubeMapSize = 4096;
        this.maxVolumeSize = 4096;
        this.maxColorAttachments = 8;
        this.maxPixelRatio = 1;
        this.maxAnisotropy = 16;
        this.supportsInstancing = true;
        this.supportsUniformBuffers = false;
        this.supportsVolumeTextures = true;
        this.supportsBoneTextures = true;
        this.supportsMorphTargetTexturesCore = true;
        this.supportsAreaLights = true;
        this.supportsDepthShadow = true;
        this.supportsGpuParticles = false;
        this.supportsMrt = true;
        this.extUintElement = true;
        this.extTextureFloat = true;
        this.textureFloatRenderable = true;
        this.extTextureHalfFloat = true;
        this.textureHalfFloatRenderable = true;
        this.textureHalfFloatUpdatable = true;
        this.boneLimit = 1024;
        this.supportsImageBitmap = true;
        this.extStandardDerivatives = true;
        this.extBlendMinmax = true;
        this.areaLightLutFormat = PIXELFORMAT_RGBA8;
        this.supportsTextureFetch = true;
    }

    postInit() {
        super.postInit();
    }

    frameStart() {
        super.frameStart();
    }

    frameEnd() {
        super.frameEnd();
    }

    updateBegin() {
    }

    updateEnd() {
    }

    readPixels(x, y, w, h, pixels) {
    }

    createVertexBufferImpl(vertexBuffer, format) {
        return new NullVertexBuffer(vertexBuffer, format);
    }

    createIndexBufferImpl(indexBuffer) {
        return new NullIndexBuffer(indexBuffer);
    }

    createShaderImpl(shader) {
        return new NullShader(shader);
    }

    createTextureImpl(texture) {
        return new NullTexture(texture);
    }

    createRenderTargetImpl(renderTarget) {
        return new NullRenderTarget(renderTarget);
    }

    draw(primitive, numInstances = 1, keepBuffers) {
    }

    setShader(shader) {
        return true;
    }

    setBlendState(blendState) {
    }

    setDepthState(depthState) {
    }

    setStencilState(stencilFront, stencilBack) {
    }

    setBlendColor(r, g, b, a) {
    }

    setCullMode(cullMode) {
    }

    setAlphaToCoverage(state) {
    }

    initializeContextCaches() {
        super.initializeContextCaches();
    }

    clear(options) {
    }

    setViewport(x, y, w, h) {
    }

    setScissor(x, y, w, h) {
    }

    copyRenderTarget(source, dest, color, depth) {
        return true;
    }

    // #if _DEBUG
    pushMarker(name) {
    }

    popMarker() {
    }
    // #endif
}

export { NullGraphicsDevice };
