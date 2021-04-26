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

class DepthLayer {
    constructor(application) {
        this.application = application;
        this.device = application.graphicsDevice;

        // created depth layer
        this.layer = this.init();
    }

    // create a depth layer, which is a default depth layer, but also a template used
    // to patch application created depth layers to behave as one
    init() {

        var app = this.application;
        let depthLayer = null;

        if (this.device.webgl2) {

            // WebGL 2 depth layer just copies existing depth
            depthLayer = new Layer({
                enabled: false,
                name: "Depth",
                id: LAYERID_DEPTH,

                onEnable: function () {
                    if (this.renderTarget) return;
                    var depthBuffer = new Texture(app.graphicsDevice, {
                        format: PIXELFORMAT_DEPTHSTENCIL,
                        width: app.graphicsDevice.width,
                        height: app.graphicsDevice.height,
                        mipmaps: false
                    });
                    depthBuffer.name = 'rt-depth2';
                    depthBuffer.minFilter = FILTER_NEAREST;
                    depthBuffer.magFilter = FILTER_NEAREST;
                    depthBuffer.addressU = ADDRESS_CLAMP_TO_EDGE;
                    depthBuffer.addressV = ADDRESS_CLAMP_TO_EDGE;
                    this.renderTarget = new RenderTarget({
                        colorBuffer: null,
                        depthBuffer: depthBuffer,
                        autoResolve: false
                    });
                    app.graphicsDevice.scope.resolve("uDepthMap").setValue(depthBuffer);
                },

                onDisable: function () {
                    if (!this.renderTarget) return;
                    this.renderTarget._depthBuffer.destroy();
                    this.renderTarget.destroy();
                    this.renderTarget = null;
                },

                onPreRenderOpaque: function (cameraPass) { // resize depth map if needed
                    var gl = app.graphicsDevice.gl;
                    this.srcFbo = gl.getParameter(gl.FRAMEBUFFER_BINDING);

                    if (!this.renderTarget || (this.renderTarget.width !== app.graphicsDevice.width || this.renderTarget.height !== app.graphicsDevice.height)) {
                        this.onDisable();
                        this.onEnable();
                    }

                    // disable clearing
                    this.oldClear = this.cameras[cameraPass].camera._clearOptions;
                    this.cameras[cameraPass].camera._clearOptions = this.depthClearOptions;
                },

                onPostRenderOpaque: function (cameraPass) { // copy depth
                    if (!this.renderTarget) return;

                    this.cameras[cameraPass].camera._clearOptions = this.oldClear;

                    var gl = app.graphicsDevice.gl;

                    app.graphicsDevice.setRenderTarget(this.renderTarget);
                    app.graphicsDevice.updateBegin();

                    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.srcFbo);
                    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.renderTarget._glFrameBuffer);
                    gl.blitFramebuffer(0, 0, this.renderTarget.width, this.renderTarget.height,
                                    0, 0, this.renderTarget.width, this.renderTarget.height,
                                    gl.DEPTH_BUFFER_BIT,
                                    gl.NEAREST);
                }

            });

            depthLayer.depthClearOptions = {
                flags: 0
            };

        } else {

            // WebGL 1 depth layer just renders same objects as in World, but with RGBA-encoded depth shader
            depthLayer = new Layer({
                enabled: false,
                name: "Depth",
                id: LAYERID_DEPTH,
                shaderPass: SHADER_DEPTH,

                onEnable: function () {
                    if (this.renderTarget) return;
                    var colorBuffer = new Texture(app.graphicsDevice, {
                        format: PIXELFORMAT_R8_G8_B8_A8,
                        width: app.graphicsDevice.width,
                        height: app.graphicsDevice.height,
                        mipmaps: false
                    });
                    colorBuffer.name = 'rt-depth1';
                    colorBuffer.minFilter = FILTER_NEAREST;
                    colorBuffer.magFilter = FILTER_NEAREST;
                    colorBuffer.addressU = ADDRESS_CLAMP_TO_EDGE;
                    colorBuffer.addressV = ADDRESS_CLAMP_TO_EDGE;
                    this.renderTarget = new RenderTarget(app.graphicsDevice, colorBuffer, {
                        depth: true,
                        stencil: app.graphicsDevice.supportsStencil
                    });
                    app.graphicsDevice.scope.resolve("uDepthMap").setValue(colorBuffer);
                },

                onDisable: function () {
                    if (!this.renderTarget) return;
                    this.renderTarget._colorBuffer.destroy();
                    this.renderTarget.destroy();
                    this.renderTarget = null;
                },

                onPostCull: function (cameraPass) {
                    // Collect all rendered mesh instances with the same render target as World has, depthWrite == true and prior to this layer to replicate blitFramebuffer on WebGL2
                    var visibleObjects = this.instances.visibleOpaque[cameraPass];
                    var visibleList = visibleObjects.list;
                    var visibleLength = 0;
                    var layers = app.scene.layers.layerList;
                    var subLayerEnabled = app.scene.layers.subLayerEnabled;
                    var isTransparent = app.scene.layers.subLayerList;

                    // can't use self.defaultLayerWorld.renderTarget because projects that use the editor override default layers
                    var rt = app.scene.layers.getLayerById(LAYERID_WORLD).renderTarget;
                    var cam = this.cameras[cameraPass];
                    var layer;
                    var j;
                    var layerVisibleList, layerCamId, layerVisibleListLength, drawCall, transparent;
                    for (var i = 0; i < layers.length; i++) {
                        layer = layers[i];
                        if (layer === this) break;
                        if (layer.renderTarget !== rt || !layer.enabled || !subLayerEnabled[i]) continue;
                        layerCamId = layer.cameras.indexOf(cam);
                        if (layerCamId < 0) continue;
                        transparent = isTransparent[i];
                        layerVisibleList = transparent ? layer.instances.visibleTransparent[layerCamId] : layer.instances.visibleOpaque[layerCamId];
                        layerVisibleListLength = layerVisibleList.length;
                        layerVisibleList = layerVisibleList.list;
                        for (j = 0; j < layerVisibleListLength; j++) {
                            drawCall = layerVisibleList[j];
                            if (drawCall.material && drawCall.material.depthWrite && !drawCall._noDepthDrawGl1) {
                                visibleList[visibleLength] = drawCall;
                                visibleLength++;
                            }
                        }
                    }
                    visibleObjects.length = visibleLength;
                },

                onPreRenderOpaque: function (cameraPass) { // resize depth map if needed
                    if (!this.renderTarget || (this.renderTarget.width !== app.graphicsDevice.width || this.renderTarget.height !== app.graphicsDevice.height)) {
                        this.onDisable();
                        this.onEnable();
                    }
                    this.oldClear = this.cameras[cameraPass].camera._clearOptions;
                    this.cameras[cameraPass].camera._clearOptions = this.rgbaDepthClearOptions;
                },

                onDrawCall: function () {
                    app.graphicsDevice.setColorWrite(true, true, true, true);
                },

                onPostRenderOpaque: function (cameraPass) {
                    if (!this.renderTarget) return;
                    this.cameras[cameraPass].camera._clearOptions = this.oldClear;
                }

            });

            depthLayer.rgbaDepthClearOptions = {
                color: [254.0 / 255, 254.0 / 255, 254.0 / 255, 254.0 / 255],
                depth: 1.0,
                flags: CLEARFLAG_COLOR | CLEARFLAG_DEPTH
            };
        }

        return depthLayer;
    }

    // function which patches a layer to use depth layer set up in this class
    patch(layer) {
        layer.onEnable = this.layer.onEnable;
        layer.onDisable = this.layer.onDisable;
        layer.onPreRenderOpaque = this.layer.onPreRenderOpaque;
        layer.onPostRenderOpaque = this.layer.onPostRenderOpaque;
        layer.depthClearOptions = this.layer.depthClearOptions;
        layer.rgbaDepthClearOptions = this.layer.rgbaDepthClearOptions;
        layer.shaderPass = this.layer.shaderPass;
        layer.onPostCull = this.layer.onPostCull;
        layer.onDrawCall = this.layer.onDrawCall;
    }
}

export { DepthLayer };
