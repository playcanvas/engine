import {
    ADDRESS_CLAMP_TO_EDGE,
    CLEARFLAG_COLOR, CLEARFLAG_DEPTH,
    FILTER_NEAREST,
    PIXELFORMAT_DEPTHSTENCIL, PIXELFORMAT_R8_G8_B8_A8
} from '../graphics/constants.js';

import { RenderTarget } from '../graphics/render-target.js';
import { Texture } from '../graphics/texture.js';

import {
    LAYERID_DEPTH, LAYERID_WORLD,
    SHADER_DEPTH
} from '../scene/constants.js';

import { Layer } from '../scene/layer.js';

// Internal class abstracting the access to the depth texture of the scene.
// For webgl 2 devices, actual depth buffer is copied to a texture at the specified time during camera rendering
// for webgl 1 devices, the scene's depth is rendered to a separate RGBA texture
class SceneDepth {
    constructor(application) {
        this.application = application;
        this.device = application.graphicsDevice;

        // create depth layer
        this.clearOptions = null;
        this.layer = null;
        this.init();
    }

    allocateTexture(device, name, format) {

        // allocate texture that will store the depth
        const texture = new Texture(device, {
            format: format,
            width: device.width,
            height: device.height,
            mipmaps: false,
            minFilter: FILTER_NEAREST,
            magFilter: FILTER_NEAREST,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE
        });
        texture.name = name;

        // assign it to scope to expose it to shaders
        device.scope.resolve("uDepthMap").setValue(texture);
        return texture;
    }

    allocateRenderTarget(renderTarget, device, name, format, isDepth) {

        // allocate texture buffer
        const buffer = this.allocateTexture(device, name, format);
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

        this.clearOptions = {
            flags: 0
        };

        // WebGL 2 depth layer just copies existing depth
        this.layer = new Layer({
            enabled: false,
            name: "Depth",
            id: LAYERID_DEPTH,

            onEnable: function () {
                // allocate / resize esting RT as needed
                this.renderTarget = self.allocateRenderTarget(this.renderTarget, app.graphicsDevice, "rt-depth2", PIXELFORMAT_DEPTHSTENCIL, true);
            },

            onDisable: function () {
                self.releaseRenderTarget(this.renderTarget);
                this.renderTarget = null;
            },

            onPreRenderOpaque: function (cameraPass) { // resize depth map if needed
                const gl = app.graphicsDevice.gl;
                this.srcFbo = gl.getParameter(gl.FRAMEBUFFER_BINDING);

                // reallocate RT if needed
                if (this.renderTarget.width !== app.graphicsDevice.width || this.renderTarget.height !== app.graphicsDevice.height) {
                    this.onEnable();
                }

                // disable clearing
                this.oldClear = this.cameras[cameraPass].camera._clearOptions;
                this.cameras[cameraPass].camera._clearOptions = self.clearOptions;
            },

            // copy out the depth
            onPostRenderOpaque: function (cameraPass) {
                if (this.renderTarget) {
                    this.cameras[cameraPass].camera._clearOptions = this.oldClear;

                    app.graphicsDevice.setRenderTarget(this.renderTarget);
                    app.graphicsDevice.updateBegin();

                    const gl = app.graphicsDevice.gl;
                    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.srcFbo);
                    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.renderTarget._glFrameBuffer);
                    gl.blitFramebuffer(0, 0, this.renderTarget.width, this.renderTarget.height,
                                       0, 0, this.renderTarget.width, this.renderTarget.height,
                                       gl.DEPTH_BUFFER_BIT, gl.NEAREST);
                }
            }
        });
    }

    initWebGl1() {

        const app = this.application;
        const self = this;

        this.clearOptions = {
            color: [254.0 / 255, 254.0 / 255, 254.0 / 255, 254.0 / 255],
            depth: 1.0,
            flags: CLEARFLAG_COLOR | CLEARFLAG_DEPTH
        };

        // WebGL 1 depth layer just renders same objects as in World, but with RGBA-encoded depth shader
        this.layer = new Layer({
            enabled: false,
            name: "Depth",
            id: LAYERID_DEPTH,
            shaderPass: SHADER_DEPTH,

            onEnable: function () {
                // allocate / resize esting RT as needed
                this.renderTarget = self.allocateRenderTarget(this.renderTarget, app.graphicsDevice, "rt-depth1", PIXELFORMAT_R8_G8_B8_A8, false);
            },

            onDisable: function () {
                self.releaseRenderTarget(this.renderTarget);
                this.renderTarget = null;
            },

            onPostCull: function (cameraPass) {

                // Collect all rendered mesh instances with the same render target as World has, depthWrite == true and prior to this layer to replicate blitFramebuffer on WebGL2
                const visibleObjects = this.instances.visibleOpaque[cameraPass];
                const visibleList = visibleObjects.list;
                const layerComposition = app.scene.layers;
                var subLayerEnabled = layerComposition.subLayerEnabled;
                var isTransparent = layerComposition.subLayerList;

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
            },

            onPreRenderOpaque: function (cameraPass) {

                // reallocate RT if needed
                if (this.renderTarget.width !== app.graphicsDevice.width || this.renderTarget.height !== app.graphicsDevice.height) {
                    this.onEnable();
                }

                this.oldClear = this.cameras[cameraPass].camera._clearOptions;
                this.cameras[cameraPass].camera._clearOptions = self.clearOptions;
            },

            onDrawCall: function () {
                app.graphicsDevice.setColorWrite(true, true, true, true);
            },

            onPostRenderOpaque: function (cameraPass) {
                if (!this.renderTarget) return;
                this.cameras[cameraPass].camera._clearOptions = this.oldClear;
            }
        });
    }

    // create a depth layer, which is a default depth layer, but also a template used
    // to patch application created depth layers to behave as one
    init() {

        if (this.device.webgl2) {
            this.initWebGl2();
        } else {
            this.initWebGl1();
        }
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

export { SceneDepth };
