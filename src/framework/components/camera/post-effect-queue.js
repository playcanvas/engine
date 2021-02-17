import { now } from '../../../core/time.js';

import { ADDRESS_CLAMP_TO_EDGE, FILTER_NEAREST, PIXELFORMAT_R8_G8_B8_A8 } from '../../../graphics/constants.js';
import { RenderTarget } from '../../../graphics/render-target.js';
import { Texture } from '../../../graphics/texture.js';

import { LAYERID_DEPTH, LAYERID_UI, SORTMODE_NONE } from '../../../scene/constants.js';
import { Layer } from '../../../scene/layer.js';

let depthLayer;

class PostEffect {
    constructor(effect, inputTarget) {
        this.effect = effect;
        this.inputTarget = inputTarget;
        this.outputTarget = null;
        this.name = effect.constructor.name;
    }
}

/**
 * @class
 * @name pc.PostEffectQueue
 * @classdesc Used to manage multiple post effects for a camera.
 * @description Create a new PostEffectQueue.
 * @param {pc.Application} app - The application.
 * @param {pc.CameraComponent} camera - The camera component.
 */
class PostEffectQueue {
    constructor(app, camera) {
        var self = this;

        this.app = app;
        this.camera = camera;
        
        // stores all of the post effects of type PostEffect
        this.effects = [];

        // if the queue is enabled it will render all of its effects
        // otherwise it will not render anything
        this.enabled = false;

        // legacy
        this.depthTarget = null;

        this.renderTargetScale = 1;
        this.resizeTimeout = null;
        this.resizeLast = 0;

        this._resizeTimeoutCallback = function () {
            self.resizeRenderTargets();
        };

        camera.on('set_rect', this.onCameraRectChanged, this);
    }

    /**
     * @private
     * @function
     * @name pc.PostEffectQueue#_createOffscreenTarget
     * @description Creates a render target with the dimensions of the canvas, with an optional depth buffer.
     * @param {boolean} useDepth - Set to true if you want to create a render target with a depth buffer.
     * @param {boolean} hdr - Use HDR render target format.
     * @returns {pc.RenderTarget} The render target.
     */

    _createOffscreenTarget(useDepth, hdr) {
        var rect = this.camera.rect;

        var width = Math.floor(rect.z * this.app.graphicsDevice.width * this.renderTargetScale);
        var height = Math.floor(rect.w * this.app.graphicsDevice.height * this.renderTargetScale);

        var device = this.app.graphicsDevice;
        var format = hdr ? device.getHdrFormat() : PIXELFORMAT_R8_G8_B8_A8;
        var useStencil =  this.app.graphicsDevice.supportsStencil;
        var samples = useDepth ? device.samples : 1;

        var colorBuffer = new Texture(device, {
            format: format,
            width: width,
            height: height
        });
        colorBuffer.name = this.camera.entity.name + '-posteffect-' + this.effects.length;

        colorBuffer.minFilter = FILTER_NEAREST;
        colorBuffer.magFilter = FILTER_NEAREST;
        colorBuffer.addressU = ADDRESS_CLAMP_TO_EDGE;
        colorBuffer.addressV = ADDRESS_CLAMP_TO_EDGE;

        return new RenderTarget(this.app.graphicsDevice, colorBuffer, { depth: useDepth, stencil: useStencil, samples: samples });
    }

    _resizeOffscreenTarget(rt) {
        var rect = this.camera.rect;

        var width = Math.floor(rect.z * this.app.graphicsDevice.width * this.renderTargetScale);
        var height = Math.floor(rect.w * this.app.graphicsDevice.height * this.renderTargetScale);

        var device = this.app.graphicsDevice;
        var format = rt.colorBuffer.format;

        rt._colorBuffer.destroy();

        var colorBuffer = new Texture(device, {
            format: format,
            width: width,
            height: height
        });
        colorBuffer.name = 'posteffect';

        colorBuffer.minFilter = FILTER_NEAREST;
        colorBuffer.magFilter = FILTER_NEAREST;
        colorBuffer.addressU = ADDRESS_CLAMP_TO_EDGE;
        colorBuffer.addressV = ADDRESS_CLAMP_TO_EDGE;

        rt._colorBuffer = colorBuffer;
        rt.destroy();
    }

    _destroyOffscreenTarget(rt) {
        if (rt._colorBuffer)
            rt._colorBuffer.destroy();
        if (rt._depthBuffer)
            rt._depthBuffer.destroy();

        rt.destroy();
    }

    setRenderTargetScale(scale) {
        this.renderTargetScale = scale;
        this.resizeRenderTargets();
    }

    /**
     * @function
     * @name pc.PostEffectQueue#addEffect
     * @description Adds a post effect to the queue. If the queue is disabled adding a post effect will
     * automatically enable the queue.
     * @param {pc.PostEffect} effect - The post effect to add to the queue.
     */
    addEffect(effect) {
        // first rendering of the scene requires depth buffer
        let effects = this.effects;
        const isFirstEffect = effects.length === 0;

        let inputTarget = this._createOffscreenTarget(isFirstEffect, effect.hdr);
        let newEntry = new PostEffect(effect, inputTarget);
        effects.push(newEntry);

        this._sourceTarget = newEntry.inputTarget;

        // connect the effect with the previous effect if one exists
        if (effects.length > 1) {
            effects[effects.length - 2].outputTarget = newEntry.inputTarget;
        }

        // Request depthmap if needed
        this._newPostEffect = effect;
        if (effect.needsDepthBuffer) {
            this._requestDepthMap();
        }

        this.enable();
        this._newPostEffect = undefined;
    }

    /**
     * @function
     * @name pc.PostEffectQueue#removeEffect
     * @description Removes a post effect from the queue. If the queue becomes empty it will be disabled automatically.
     * @param {pc.PostEffect} effect - The post effect to remove.
     */
    removeEffect(effect) {

        // find index of effect
        var i, len, index = -1;
        for (i = 0, len = this.effects.length; i < len; i++) {
            if (this.effects[i].effect === effect) {
                index = i;
                break;
            }
        }

        if (index >= 0) {
            if (index > 0)  {
                // connect the previous effect with the effect after the one we're about to remove
                this.effects[index - 1].outputTarget = (index + 1) < this.effects.length ?
                    this.effects[index + 1].inputTarget :
                    null;
            } else {
                if (this.effects.length > 1) {
                    // if we removed the first effect then make sure that
                    // the input render target of the effect that will now become the first one
                    // has a depth buffer
                    if (!this.effects[1].inputTarget._depth) {
                        this._destroyOffscreenTarget(this.effects[1].inputTarget);
                        this.effects[1].inputTarget = this._createOffscreenTarget(true, this.effects[1].hdr);
                        this._sourceTarget = this.effects[1].inputTarget;
                    }

                    this.camera.renderTarget = this.effects[1].inputTarget;
                }
            }

            // release memory for removed effect
            this._destroyOffscreenTarget(this.effects[index].inputTarget);

            this.effects.splice(index, 1);
        }

        if (this.enabled) {
            if (effect.needsDepthBuffer) {
                this._releaseDepthMap();
            }
        }

        if (this.effects.length === 0) {
            this.disable();
        }
    }

    _requestDepthMaps() {
        for (var i = 0, len = this.effects.length; i < len; i++) {
            var effect = this.effects[i].effect;
            if (this._newPostEffect === effect)
                continue;

            if (effect.needsDepthBuffer) {
                this._requestDepthMap();
            }
        }
    }

    _releaseDepthMaps() {
        for (var i = 0, len = this.effects.length; i < len; i++) {
            var effect = this.effects[i].effect;
            if (effect.needsDepthBuffer) {
                this._releaseDepthMap();
            }
        }
    }

    _requestDepthMap() {
        if (!depthLayer) depthLayer = this.app.scene.layers.getLayerById(LAYERID_DEPTH);
        if (depthLayer) depthLayer.incrementCounter();
    }

    _releaseDepthMap() {
        if (depthLayer) depthLayer.decrementCounter();
    }

    /**
     * @function
     * @name pc.PostEffectQueue#destroy
     * @description Removes all the effects from the queue and disables it.
     */
    destroy() {
        // release memory for all effects
        for (var i = 0, len = this.effects.length; i < len; i++) {
            this.effects[i].inputTarget.destroy();
        }

        this.effects.length = 0;

        this.disable();
    }

    /**
     * @function
     * @name pc.PostEffectQueue#enable
     * @description Enables the queue and all of its effects. If there are no effects then the queue will not be enabled.
     */
    enable() {
        if (!this.enabled && this.effects.length) {
            this.enabled = true;

            var self = this;
            this._requestDepthMaps();

            this.app.graphicsDevice.on('resizecanvas', this._onCanvasResized, this);

            // camera renders to render target
            this.camera.renderTarget = this.effects[0].inputTarget;

            // callback when postprocessing takes place
            this.camera.onPostprocessing = function(camera) {

                if (self.enabled) {
                    var rect = null;
                    var len = self.effects.length;
                    if (len) {

                        // #ifdef DEBUG
                        self.app.graphicsDevice.pushMarker("Postprocess");
                        // #endif

                        for (var i = 0; i < len; i++) {
                            var fx = self.effects[i];

                            if (i === len - 1) {
                                rect = self.camera.rect;
                            }

                            // #ifdef DEBUG
                            self.app.graphicsDevice.pushMarker(fx.name);
                            // #endif

                            fx.effect.render(fx.inputTarget, fx.outputTarget, rect);

                            // #ifdef DEBUG
                            self.app.graphicsDevice.popMarker("");
                            // #endif
                        }

                        // #ifdef DEBUG
                        self.app.graphicsDevice.popMarker("");
                        // #endif
                    }
                }
            };
        }
    }

    /**
     * @function
     * @name pc.PostEffectQueue#disable
     * @description Disables the queue and all of its effects.
     */
    disable() {
        if (this.enabled) {
            this.enabled = false;

            this.app.graphicsDevice.off('resizecanvas', this._onCanvasResized, this);

            this._releaseDepthMaps();
            
            this._destroyOffscreenTarget(this._sourceTarget);

            this.camera.renderTarget = null;
            this.camera.onPostprocessing = null;
        }
    }

    _onCanvasResized(width, height) {
        var rect = this.camera.rect;
        var device = this.app.graphicsDevice;
        this.camera.camera.aspectRatio = (device.width * rect.z) / (device.height * rect.w);

        // avoid resizing the render targets too often by using a timeout
        if (this.resizeTimeout)
            return;

        if ((now() - this.resizeLast) > 100) {
            // allow resizing immediately if haven't been resized recently
            this.resizeRenderTargets();
        } else {
            // target to maximum at 10 resizes a second
            this.resizeTimeout = setTimeout(this._resizeTimeoutCallback, 100);
        }
    }

    resizeRenderTargets() {
        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
            this.resizeTimeout = null;
        }

        this.resizeLast = now();

        var rect = this.camera.rect;
        var desiredWidth = Math.floor(rect.z * this.app.graphicsDevice.width * this.renderTargetScale);
        var desiredHeight = Math.floor(rect.w * this.app.graphicsDevice.height * this.renderTargetScale);

        var effects = this.effects;

        for (var i = 0, len = effects.length; i < len; i++) {
            var fx = effects[i];
            if (fx.inputTarget.width !== desiredWidth ||
                fx.inputTarget.height !== desiredHeight)  {
                this._resizeOffscreenTarget(fx.inputTarget);
            }
        }
    }

    onCameraRectChanged(name, oldValue, newValue) {
        if (this.enabled) {
            this.resizeRenderTargets();
        }
    }
}

export { PostEffectQueue };
