import {
    ADDRESS_CLAMP_TO_EDGE,
    FILTER_NEAREST, FILTER_LINEAR, FILTER_LINEAR_MIPMAP_LINEAR,
    PIXELFORMAT_DEPTHSTENCIL, PIXELFORMAT_R8_G8_B8_A8, PIXELFORMAT_R8_G8_B8
} from '../../platform/graphics/constants.js';

import { RenderTarget } from '../../platform/graphics/render-target.js';
import { Texture } from '../../platform/graphics/texture.js';
import { DebugGraphics } from '../../platform/graphics/debug-graphics.js';

import {
    LAYERID_DEPTH, LAYERID_WORLD,
    SHADER_DEPTH
} from '../../scene/constants.js';

import { Layer } from '../../scene/layer.js';

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
    constructor(application) {
        this.application = application;

        /** @type {import('../../platform/graphics/graphics-device.js').GraphicsDevice} */
        this.device = application.graphicsDevice;

        // create depth layer
        this.layer = null;

        // color buffer format
        this.colorFormat = this.device.defaultFramebufferAlpha ? PIXELFORMAT_R8_G8_B8_A8 : PIXELFORMAT_R8_G8_B8;

        // create a depth layer, which is a default depth layer, but also a template used
        // to patch application created depth layers to behave as one
        if (this.device.webgl2) {
            this.initWebGl2();
        } else {
            this.initWebGl1();
        }
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

    resizeCondition(target, source, device) {
        const width = source?.width || device.width;
        const height = source?.height || device.height;
        return !target || width !== target.width || height !== target.height;
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

    initWebGl2() {

        const app = this.application;
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

                /** @type {import('../../platform/graphics/graphics-device.js').GraphicsDevice} */
                const device = app.graphicsDevice;

                /** @type {import('../components/camera/component.js').CameraComponent} */
                const camera = this.cameras[cameraPass];

                if (camera.renderSceneColorMap) {

                    // allocate / resize existing RT as needed
                    if (self.resizeCondition(this.colorRenderTarget, camera.renderTarget?.colorBuffer, device)) {
                        self.releaseRenderTarget(this.colorRenderTarget);
                        this.colorRenderTarget = self.allocateRenderTarget(this.colorRenderTarget, camera.renderTarget, device, this.colorFormat, false, true, false);
                    }

                    // copy color from the current render target
                    DebugGraphics.pushGpuMarker(device, 'GRAB-COLOR');

                    device.copyRenderTarget(device.renderTarget, this.colorRenderTarget, true, false);

                    // generate mipmaps
                    device.activeTexture(device.maxCombinedTextures - 1);
                    const colorBuffer = this.colorRenderTarget.colorBuffer;
                    device.bindTexture(colorBuffer);
                    device.gl.generateMipmap(colorBuffer.impl._glTarget);

                    DebugGraphics.popGpuMarker(device);

                    // assign unifrom
                    self.setupUniform(device, false, colorBuffer);
                }

                if (camera.renderSceneDepthMap) {

                    // reallocate RT if needed
                    if (self.resizeCondition(this.depthRenderTarget, camera.renderTarget?.depthBuffer, device)) {
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

    initWebGl1() {

        const app = this.application;
        const self = this;

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
                    stencil: app.graphicsDevice.supportsStencil,
                    autoResolve: false,
                    graphicsDevice: app.graphicsDevice
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

                /** @type {import('../../platform/graphics/graphics-device.js').GraphicsDevice} */
                const device = app.graphicsDevice;

                /** @type {import('../components/camera/component.js').CameraComponent} */
                const camera = this.cameras[cameraPass];

                if (camera.renderSceneDepthMap) {

                    // reallocate RT if needed
                    if (self.resizeCondition(this.depthRenderTarget, camera.renderTarget?.depthBuffer, device)) {
                        this.depthRenderTarget.destroyTextureBuffers();
                        this.depthRenderTarget = self.allocateRenderTarget(this.depthRenderTarget, camera.renderTarget, device, PIXELFORMAT_R8_G8_B8_A8, false, false, true);
                    }

                    // Collect all rendered mesh instances with the same render target as World has, depthWrite == true and prior to this layer to replicate blitFramebuffer on WebGL2
                    const visibleObjects = this.instances.visibleOpaque[cameraPass];
                    const visibleList = visibleObjects.list;
                    const layerComposition = app.scene.layers;
                    const subLayerEnabled = layerComposition.subLayerEnabled;
                    const isTransparent = layerComposition.subLayerList;

                    // can't use self.defaultLayerWorld.renderTarget because projects that use the editor override default layers
                    const rt = app.scene.layers.getLayerById(LAYERID_WORLD).renderTarget;
                    const cam = this.cameras[cameraPass];

                    let visibleLength = 0;
                    const layers = layerComposition.layerList;
                    for (let i = 0; i < layers.length; i++) {
                        const layer = layers[i];
                        if (layer === this) break;
                        if (layer.renderTarget !== rt || !layer.enabled || !subLayerEnabled[i]) continue;

                        const layerCamId = layer.cameras.indexOf(cam);
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

                /** @type {import('../../platform/graphics/graphics-device.js').GraphicsDevice} */
                const device = app.graphicsDevice;

                /** @type {import('../components/camera/component.js').CameraComponent} */
                const camera = this.cameras[cameraPass];

                if (camera.renderSceneColorMap) {

                    // reallocate RT if needed
                    if (self.resizeCondition(this.colorRenderTarget, camera.renderTarget?.colorBuffer, device)) {
                        self.releaseRenderTarget(this.colorRenderTarget);
                        this.colorRenderTarget = self.allocateRenderTarget(this.colorRenderTarget, camera.renderTarget, device, this.colorFormat, false, false, false);
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
                app.graphicsDevice.setColorWrite(true, true, true, true);
            },

            onPostRenderOpaque: function (cameraPass) {

                /** @type {import('../components/camera/component.js').CameraComponent} */
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
