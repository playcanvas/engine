import { now } from '../../../core/time.js';

import { ADDRESS_CLAMP_TO_EDGE, FILTER_NEAREST, PIXELFORMAT_R8_G8_B8_A8 } from '../../../graphics/constants.js';
import { DebugGraphics } from '../../../graphics/debug-graphics.js';
import { RenderTarget } from '../../../graphics/render-target.js';
import { Texture } from '../../../graphics/texture.js';

import { LAYERID_DEPTH } from '../../../scene/constants.js';

/** @typedef {import('../../application.js').Application} Application */
/** @typedef {import('./component.js').CameraComponent} CameraComponent */

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
 * Used to manage multiple post effects for a camera.
 */
class PostEffectQueue {
    /**
     * Create a new PostEffectQueue instance.
     *
     * @param {Application} app - The application.
     * @param {CameraComponent} camera - The camera component.
     */
    constructor(app, camera) {
        this.app = app;
        this.camera = camera;

        /**
         * Render target where the postprocessed image needs to be rendered to. Defaults to null
         * which is main framebuffer.
         *
         * @type {RenderTarget}
         * @ignore
         */
        this.destinationRenderTarget = null;

        /**
         * All of the post effects in the queue.
         *
         * @type {PostEffect[]}
         * @ignore
         */
        this.effects = [];

        /**
         * If the queue is enabled it will render all of its effects, otherwise it will not render
         * anything.
         *
         * @type {boolean}
         * @ignore
         */
        this.enabled = false;

        // legacy
        this.depthTarget = null;

        this.renderTargetScale = 1;
        /**
         * @type {number|null}
         * @private
         */
        this.resizeTimeout = null;
        /**
         * The time in milliseconds since the last resize.
         *
         * @type {number}
         * @private
         */
        this.resizeLast = 0;

        this._resizeTimeoutCallback = () => {
            this.resizeRenderTargets();
        };

        camera.on('set:rect', this.onCameraRectChanged, this);
    }

    /**
     * Allocate a color buffer texture.
     *
     * @param {number} format - The format of the color buffer.
     * @param {string} name - The name of the color buffer.
     * @returns {Texture} The color buffer texture.
     * @private
     */
    _allocateColorBuffer(format, name) {
        const rect = this.camera.rect;
        const width = Math.floor(rect.z * this.app.graphicsDevice.width * this.renderTargetScale);
        const height = Math.floor(rect.w * this.app.graphicsDevice.height * this.renderTargetScale);

        const colorBuffer = new Texture(this.app.graphicsDevice, {
            name: name,
            format: format,
            width: width,
            height: height,
            mipmaps: false,
            minFilter: FILTER_NEAREST,
            magFilter: FILTER_NEAREST,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE
        });

        return colorBuffer;
    }

    /**
     * Creates a render target with the dimensions of the canvas, with an optional depth buffer.
     *
     * @param {boolean} useDepth - Set to true to create a render target with a depth buffer.
     * @param {boolean} hdr - Use HDR render target format.
     * @returns {RenderTarget} The render target.
     * @private
     */
    _createOffscreenTarget(useDepth, hdr) {

        const device = this.app.graphicsDevice;
        const format = hdr ? device.getHdrFormat() : PIXELFORMAT_R8_G8_B8_A8;
        const name = this.camera.entity.name + '-posteffect-' + this.effects.length;

        const colorBuffer = this._allocateColorBuffer(format, name);

        const useStencil =  this.app.graphicsDevice.supportsStencil;
        const samples = useDepth ? device.samples : 1;

        return new RenderTarget({
            colorBuffer: colorBuffer,
            depth: useDepth,
            stencil: useStencil,
            samples: samples
        });
    }

    _resizeOffscreenTarget(rt) {
        const format = rt.colorBuffer.format;
        const name = rt.colorBuffer.name;

        rt.destroyFrameBuffers();
        rt.destroyTextureBuffers();
        rt._colorBuffer = this._allocateColorBuffer(format, name);
    }

    _destroyOffscreenTarget(rt) {
        rt.destroyTextureBuffers();
        rt.destroy();
    }

    setRenderTargetScale(scale) {
        this.renderTargetScale = scale;
        this.resizeRenderTargets();
    }

    /**
     * Adds a post effect to the queue. If the queue is disabled adding a post effect will
     * automatically enable the queue.
     *
     * @param {PostEffect} effect - The post effect to add to the queue.
     */
    addEffect(effect) {
        // first rendering of the scene requires depth buffer
        const effects = this.effects;
        const isFirstEffect = effects.length === 0;

        const inputTarget = this._createOffscreenTarget(isFirstEffect, effect.hdr);
        const newEntry = new PostEffect(effect, inputTarget);
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
     * Removes a post effect from the queue. If the queue becomes empty it will be disabled
     * automatically.
     *
     * @param {PostEffect} effect - The post effect to remove.
     */
    removeEffect(effect) {

        // find index of effect
        let index = -1;
        for (let i = 0, len = this.effects.length; i < len; i++) {
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
        for (let i = 0, len = this.effects.length; i < len; i++) {
            const effect = this.effects[i].effect;
            if (this._newPostEffect === effect)
                continue;

            if (effect.needsDepthBuffer) {
                this._requestDepthMap();
            }
        }
    }

    _releaseDepthMaps() {
        for (let i = 0, len = this.effects.length; i < len; i++) {
            const effect = this.effects[i].effect;
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
     * Removes all the effects from the queue and disables it.
     */
    destroy() {
        // release memory for all effects
        for (let i = 0, len = this.effects.length; i < len; i++) {
            this.effects[i].inputTarget.destroy();
        }

        this.effects.length = 0;

        this.disable();
    }

    /**
     * Enables the queue and all of its effects. If there are no effects then the queue will not be
     * enabled.
     */
    enable() {
        if (!this.enabled && this.effects.length) {
            this.enabled = true;

            this._requestDepthMaps();

            this.app.graphicsDevice.on('resizecanvas', this._onCanvasResized, this);

            // original camera's render target is where the final output needs to go
            this.destinationRenderTarget = this.camera.renderTarget;

            // camera renders to the first effect's render target
            this.camera.renderTarget = this.effects[0].inputTarget;

            // callback when postprocessing takes place
            this.camera.onPostprocessing = () => {

                if (this.enabled) {
                    let rect = null;
                    const len = this.effects.length;
                    if (len) {

                        DebugGraphics.pushGpuMarker(this.app.graphicsDevice, "Postprocess");

                        for (let i = 0; i < len; i++) {
                            const fx = this.effects[i];

                            let destTarget = fx.outputTarget;

                            // last effect
                            if (i === len - 1) {
                                rect = this.camera.rect;

                                // if camera originally rendered to a render target, render last effect to it
                                if (this.destinationRenderTarget) {
                                    destTarget = this.destinationRenderTarget;
                                }
                            }

                            DebugGraphics.pushGpuMarker(this.app.graphicsDevice, fx.name);
                            fx.effect.render(fx.inputTarget, destTarget, rect);
                            DebugGraphics.popGpuMarker(this.app.graphicsDevice);
                        }

                        DebugGraphics.popGpuMarker(this.app.graphicsDevice);
                    }
                }
            };
        }
    }

    /**
     * Disables the queue and all of its effects.
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

    /**
     * Handler called when the application's canvas element is resized.
     *
     * @param {number} width - The new width of the canvas.
     * @param {number} height - The new height of the canvas.
     * @private
     */
    _onCanvasResized(width, height) {
        const rect = this.camera.rect;
        const device = this.app.graphicsDevice;
        this.camera.camera.aspectRatio = (device.width * rect.z) / (device.height * rect.w);

        // avoid resizing the render targets too often by using a timeout
        if (this.resizeTimeout)
            return;

        // Note: this should be reviewed, as this would make postprocessing incorrect for a few frames
        // until the resize takes place
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

        const rect = this.camera.rect;
        const desiredWidth = Math.floor(rect.z * this.app.graphicsDevice.width * this.renderTargetScale);
        const desiredHeight = Math.floor(rect.w * this.app.graphicsDevice.height * this.renderTargetScale);

        const effects = this.effects;

        for (let i = 0, len = effects.length; i < len; i++) {
            const fx = effects[i];
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
