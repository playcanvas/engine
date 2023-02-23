import { Debug } from '../../core/debug.js';

import {
    ADDRESS_CLAMP_TO_EDGE,
    FILTER_NEAREST, FILTER_LINEAR, FILTER_LINEAR_MIPMAP_LINEAR,
    PIXELFORMAT_DEPTHSTENCIL, PIXELFORMAT_RGBA8
} from '../../platform/graphics/constants.js';

import { RenderTarget } from '../../platform/graphics/render-target.js';
import { Texture } from '../../platform/graphics/texture.js';
import { BlendState } from '../../platform/graphics/blend-state.js';
import { DebugGraphics } from '../../platform/graphics/debug-graphics.js';

import {
    LAYERID_DEPTH, LAYERID_WORLD,
    SHADER_DEPTH
} from '../constants.js';

import { Layer } from '../layer.js';

// uniform names (first is current name, second one is deprecated name for compatibility)
const _depthUniformNames = ['uSceneDepthMap', 'uDepthMap'];
const _colorUniformNames = ['uSceneColorMap', 'texture_grabPass'];

/**
 * Internal class abstracting the access to the depth and color texture of the scene.
 * color frame buffer is copied to a texture
 * For webgl 2 devices, the depth buffer is copied to a texture
 * for webgl 1 devices, the scene's depth is rendered to a separate RGBA texture
 *
 * TODO: implement mipmapped color buffer support for WebGL 1 as well, which requires
 * the texture to be a power of two, by first downscaling the captured framebuffer
 * texture to smaller power of 2 texture, and then generate mipmaps and use it for rendering
 * TODO: or even better, implement blur filter to have smoother lower levels
 *
 * @ignore
 */
class SceneGrab {
    /**
     * Create an instance of SceneGrab.
     *
     * @param {import('../../platform/graphics/graphics-device.js').GraphicsDevice} device - The
     * graphics device.
     * @param {import('../scene.js').Scene} scene - The scene.
     */
    constructor(device, scene) {

        Debug.assert(scene);
        this.scene = scene;

        Debug.assert(device);
        this.device = device;

        // create depth layer
        this.layer = null;

        // create a depth layer, which is a default depth layer, but also a template used
        // to patch application created depth layers to behave as one
        if (this.device.webgl2 || this.device.isWebGPU) {
            this.initMainPath();
        } else {
            this.initFallbackPath();
        }
    }

    /**
     * Returns true if the camera rendering scene grab textures requires a render pass to do it.
     *
     * @param {import('../../platform/graphics/graphics-device.js').GraphicsDevice} device - The
     * graphics device used for rendering.
     * @param {import('../../framework/components/camera/component.js').CameraComponent} camera - The camera that
     * needs scene grab textures.
     */
    static requiresRenderPass(device, camera) {

        // just copy out the textures, no render pass needed
        if (device.webgl2 || device.isWebGPU) {
            return false;
        }

        // on WebGL1 device, only depth rendering needs render pass
        return camera.renderSceneDepthMap;
    }

    setupUniform(device, depth, buffer) {

        // assign it to scopes to expose it to shaders
        const names = depth ? _depthUniformNames : _colorUniformNames;
        names.forEach(name => device.scope.resolve(name).setValue(buffer));
    }

    allocateTexture(device, source, name, format, isDepth, mipmaps) {

        // allocate texture that will store the depth
        return new Texture(device, {
            name,
            format,
            width: source ? source.colorBuffer.width : device.width,
            height: source ? source.colorBuffer.height : device.height,
            mipmaps,
            minFilter: isDepth ? FILTER_NEAREST : (mipmaps ? FILTER_LINEAR_MIPMAP_LINEAR : FILTER_LINEAR),
            magFilter: isDepth ? FILTER_NEAREST : FILTER_LINEAR,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE
        });
    }

    // texture format of the source texture the grab pass needs to copy
    getSourceColorFormat(texture) {
        // based on the RT the camera renders to, otherwise framebuffer
        return texture?.format ?? this.device.framebufferFormat;
    }

    shouldReallocate(targetRT, sourceTexture, testFormat) {

        // need to reallocate if format does not match
        if (testFormat) {
            const targetFormat = targetRT?.colorBuffer.format;
            const sourceFormat = this.getSourceColorFormat(sourceTexture);
            if (targetFormat !== sourceFormat)
                return true;
        }

        // need to reallocate if dimensions don't match
        const width = sourceTexture?.width || this.device.width;
        const height = sourceTexture?.height || this.device.height;
        return !targetRT || width !== targetRT.width || height !== targetRT.height;
    }

    allocateRenderTarget(renderTarget, sourceRenderTarget, device, format, isDepth, mipmaps, isDepthUniforms) {

        // texture / uniform names: new one (first), as well as old one  (second) for compatibility
        const names = isDepthUniforms ? _depthUniformNames : _colorUniformNames;

        // allocate texture buffer
        const buffer = this.allocateTexture(device, sourceRenderTarget, names[0], format, isDepth, mipmaps);

        if (renderTarget) {

            // if reallocating RT size, release previous framebuffer
            renderTarget.destroyFrameBuffers();

            // assign new texture
            if (isDepth) {
                renderTarget._depthBuffer = buffer;
            } else {
                renderTarget._colorBuffer = buffer;
            }
        } else {

            // create new render target with the texture
            renderTarget = new RenderTarget({
                name: 'renderTargetSceneGrab',
                colorBuffer: isDepth ? null : buffer,
                depthBuffer: isDepth ? buffer : null,
                depth: !isDepth,
                stencil: device.supportsStencil,
                autoResolve: false
            });
        }

        return renderTarget;
    }

    releaseRenderTarget(rt) {

        if (rt) {
            rt.destroyTextureBuffers();
            rt.destroy();
        }
    }

    // main path where both color and depth is copied from existing surface
    initMainPath() {

        const device = this.device;
        const self = this;

        // WebGL 2 depth layer just copies existing color or depth
        this.layer = new Layer({
            enabled: false,
            name: "Depth",
            id: LAYERID_DEPTH,

            onDisable: function () {
                self.releaseRenderTarget(this.depthRenderTarget);
                this.depthRenderTarget = null;

                self.releaseRenderTarget(this.colorRenderTarget);
                this.colorRenderTarget = null;
            },

            onPreRenderOpaque: function (cameraPass) { // resize depth map if needed

                /** @type {import('../../framework/components/camera/component.js').CameraComponent} */
                const camera = this.cameras[cameraPass];

                if (camera.renderSceneColorMap) {

                    // allocate / resize existing RT as needed
                    if (self.shouldReallocate(this.colorRenderTarget, camera.renderTarget?.colorBuffer, true)) {
                        self.releaseRenderTarget(this.colorRenderTarget);
                        const format = self.getSourceColorFormat(camera.renderTarget?.colorBuffer);
                        this.colorRenderTarget = self.allocateRenderTarget(this.colorRenderTarget, camera.renderTarget, device, format, false, true, false);
                    }

                    // copy color from the current render target
                    DebugGraphics.pushGpuMarker(device, 'GRAB-COLOR');

                    const colorBuffer = this.colorRenderTarget.colorBuffer;

                    if (device.isWebGPU) {

                        device.copyRenderTarget(camera.renderTarget, this.colorRenderTarget, true, false);

                    } else {

                        device.copyRenderTarget(device.renderTarget, this.colorRenderTarget, true, false);

                        // generate mipmaps
                        device.activeTexture(device.maxCombinedTextures - 1);
                        device.bindTexture(colorBuffer);
                        device.gl.generateMipmap(colorBuffer.impl._glTarget);
                    }

                    DebugGraphics.popGpuMarker(device);

                    // assign unifrom
                    self.setupUniform(device, false, colorBuffer);
                }

                if (camera.renderSceneDepthMap) {

                    // reallocate RT if needed
                    if (self.shouldReallocate(this.depthRenderTarget, camera.renderTarget?.depthBuffer)) {
                        self.releaseRenderTarget(this.depthRenderTarget);
                        this.depthRenderTarget = self.allocateRenderTarget(this.depthRenderTarget, camera.renderTarget, device, PIXELFORMAT_DEPTHSTENCIL, true, false, true);
                    }

                    // copy depth
                    DebugGraphics.pushGpuMarker(device, 'GRAB-DEPTH');
                    device.copyRenderTarget(device.renderTarget, this.depthRenderTarget, false, true);
                    DebugGraphics.popGpuMarker(device);

                    // assign unifrom
                    self.setupUniform(device, true, this.depthRenderTarget.depthBuffer);
                }
            },

            onPostRenderOpaque: function (cameraPass) {
            }
        });
    }

    // fallback path, where copy is not possible and the scene gets re-rendered
    initFallbackPath() {

        const self = this;
        const device = this.device;
        const scene = this.scene;

        // WebGL 1 depth layer renders the same objects as in World, but with RGBA-encoded depth shader to get depth
        this.layer = new Layer({
            enabled: false,
            name: "Depth",
            id: LAYERID_DEPTH,
            shaderPass: SHADER_DEPTH,

            onEnable: function () {

                // create RT without textures, those will be created as needed later
                this.depthRenderTarget = new RenderTarget({
                    name: 'depthRenderTarget-webgl1',
                    depth: true,
                    stencil: device.supportsStencil,
                    autoResolve: false,
                    graphicsDevice: device
                });

                // assign it so the render actions knows to render to it
                // TODO: avoid this as this API is deprecated
                this.renderTarget = this.depthRenderTarget;
            },

            onDisable: function () {

                // only release depth texture, but not the render target itself
                this.depthRenderTarget.destroyTextureBuffers();
                this.renderTarget = null;

                self.releaseRenderTarget(this.colorRenderTarget);
                this.colorRenderTarget = null;
            },

            onPostCull: function (cameraPass) {

                /** @type {import('../../framework/components/camera/component.js').CameraComponent} */
                const camera = this.cameras[cameraPass];

                if (camera.renderSceneDepthMap) {

                    // reallocate RT if needed
                    if (!this.depthRenderTarget.depthBuffer || self.shouldReallocate(this.depthRenderTarget, camera.renderTarget?.depthBuffer)) {
                        this.depthRenderTarget.destroyTextureBuffers();
                        this.depthRenderTarget = self.allocateRenderTarget(this.depthRenderTarget, camera.renderTarget, device, PIXELFORMAT_RGBA8, false, false, true);
                    }

                    // Collect all rendered mesh instances with the same render target as World has, depthWrite == true and prior to this layer to replicate blitFramebuffer on WebGL2
                    const visibleObjects = this.instances.visibleOpaque[cameraPass];
                    const visibleList = visibleObjects.list;
                    const layerComposition = scene.layers;
                    const subLayerEnabled = layerComposition.subLayerEnabled;
                    const isTransparent = layerComposition.subLayerList;

                    // can't use self.defaultLayerWorld.renderTarget because projects that use the editor override default layers
                    const rt = layerComposition.getLayerById(LAYERID_WORLD).renderTarget;

                    let visibleLength = 0;
                    const layers = layerComposition.layerList;
                    for (let i = 0; i < layers.length; i++) {
                        const layer = layers[i];
                        if (layer === this) break;
                        if (layer.renderTarget !== rt || !layer.enabled || !subLayerEnabled[i]) continue;

                        const layerCamId = layer.cameras.indexOf(camera);
                        if (layerCamId < 0) continue;

                        const transparent = isTransparent[i];
                        let layerVisibleList = transparent ? layer.instances.visibleTransparent[layerCamId] : layer.instances.visibleOpaque[layerCamId];
                        const layerVisibleListLength = layerVisibleList.length;
                        layerVisibleList = layerVisibleList.list;

                        for (let j = 0; j < layerVisibleListLength; j++) {
                            const drawCall = layerVisibleList[j];
                            if (drawCall.material && drawCall.material.depthWrite && !drawCall._noDepthDrawGl1) {
                                visibleList[visibleLength] = drawCall;
                                visibleLength++;
                            }
                        }
                    }
                    visibleObjects.length = visibleLength;
                }
            },

            onPreRenderOpaque: function (cameraPass) {

                /** @type {import('../../framework/components/camera/component.js').CameraComponent} */
                const camera = this.cameras[cameraPass];

                if (camera.renderSceneColorMap) {

                    // reallocate RT if needed
                    if (self.shouldReallocate(this.colorRenderTarget, camera.renderTarget?.colorBuffer)) {
                        self.releaseRenderTarget(this.colorRenderTarget);
                        const format = self.getSourceColorFormat(camera.renderTarget?.colorBuffer);
                        this.colorRenderTarget = self.allocateRenderTarget(this.colorRenderTarget, camera.renderTarget, device, format, false, false, false);
                    }

                    // copy out the color buffer
                    DebugGraphics.pushGpuMarker(device, 'GRAB-COLOR');

                    // initialize the texture
                    const colorBuffer = this.colorRenderTarget._colorBuffer;
                    if (!colorBuffer.impl._glTexture) {
                        colorBuffer.impl.initialize(device, colorBuffer);
                    }

                    // copy framebuffer to it
                    device.bindTexture(colorBuffer);
                    const gl = device.gl;
                    gl.copyTexImage2D(gl.TEXTURE_2D, 0, colorBuffer.impl._glFormat, 0, 0, colorBuffer.width, colorBuffer.height, 0);

                    // stop the device from updating this texture further
                    colorBuffer._needsUpload = false;
                    colorBuffer._needsMipmapsUpload = false;

                    DebugGraphics.popGpuMarker(device);

                    // assign unifrom
                    self.setupUniform(device, false, colorBuffer);
                }

                if (camera.renderSceneDepthMap) {
                    // assign unifrom
                    self.setupUniform(device, true, this.depthRenderTarget.colorBuffer);
                }
            },

            onDrawCall: function () {
                // writing depth to color render target, force no blending and writing to all channels
                device.setBlendState(BlendState.DEFAULT);
            },

            onPostRenderOpaque: function (cameraPass) {

                /** @type {import('../../framework/components/camera/component.js').CameraComponent} */
                const camera = this.cameras[cameraPass];

                if (camera.renderSceneDepthMap) {
                    // just clear the list of visible objects to avoid keeping references
                    const visibleObjects = this.instances.visibleOpaque[cameraPass];
                    visibleObjects.length = 0;
                }
            }
        });
    }

    // function which patches a layer to use depth layer set up in this class
    patch(layer) {

        layer.onEnable = this.layer.onEnable;
        layer.onDisable = this.layer.onDisable;
        layer.onPreRenderOpaque = this.layer.onPreRenderOpaque;
        layer.onPostRenderOpaque = this.layer.onPostRenderOpaque;
        layer.shaderPass = this.layer.shaderPass;
        layer.onPostCull = this.layer.onPostCull;
        layer.onDrawCall = this.layer.onDrawCall;
    }
}

export { SceneGrab };
