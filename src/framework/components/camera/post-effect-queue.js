Object.assign(pc, function () {
    var depthLayer;
    /**
     * @constructor
     * @name pc.PostEffectQueue
     * @classdesc Used to manage multiple post effects for a camera
     * @description Create a new PostEffectQueue
     * @param {pc.Application} app The application
     * @param {pc.CameraComponent} camera The camera component
     */
    function PostEffectQueue(app, camera) {
        var self = this;

        this.app = app;
        this.camera = camera;
        // stores all of the post effects
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

        this._origOverrideClear = false;
        this._origClearColorBuffer = false;
        this._origDepthColorBuffer = false;
        this._origStencilColorBuffer = false;
    }

    Object.assign(PostEffectQueue.prototype, {
        /**
         * @private
         * @function
         * @name pc.PostEffectQueue#_createOffscreenTarget
         * @description Creates a render target with the dimensions of the canvas, with an optional depth buffer
         * @param {Boolean} useDepth Set to true if you want to create a render target with a depth buffer
         * @param {Boolean} hdr Use HDR render target format
         * @returns {pc.RenderTarget} The render target
         */

        _createOffscreenTarget: function (useDepth, hdr) {
            var rect = this.camera.rect;

            var width = Math.floor(rect.z * this.app.graphicsDevice.width * this.renderTargetScale);
            var height = Math.floor(rect.w * this.app.graphicsDevice.height * this.renderTargetScale);

            var device = this.app.graphicsDevice;
            var format = hdr ? device.getHdrFormat() : pc.PIXELFORMAT_R8_G8_B8_A8;
            var useStencil =  this.app.graphicsDevice.supportsStencil;

            var colorBuffer = new pc.Texture(device, {
                format: format,
                width: width,
                height: height
            });
            colorBuffer.name = 'posteffect #' + this.effects.length;

            colorBuffer.minFilter = pc.FILTER_NEAREST;
            colorBuffer.magFilter = pc.FILTER_NEAREST;
            colorBuffer.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
            colorBuffer.addressV = pc.ADDRESS_CLAMP_TO_EDGE;

            return new pc.RenderTarget(this.app.graphicsDevice, colorBuffer, { depth: useDepth, stencil: useStencil });
        },

        _resizeOffscreenTarget: function (rt) {
            var rect = this.camera.rect;

            var width = Math.floor(rect.z * this.app.graphicsDevice.width * this.renderTargetScale);
            var height = Math.floor(rect.w * this.app.graphicsDevice.height * this.renderTargetScale);

            var device = this.app.graphicsDevice;
            var format = rt.colorBuffer.format;

            rt._colorBuffer.destroy();

            var colorBuffer = new pc.Texture(device, {
                format: format,
                width: width,
                height: height
            });
            colorBuffer.name = 'posteffect';

            colorBuffer.minFilter = pc.FILTER_NEAREST;
            colorBuffer.magFilter = pc.FILTER_NEAREST;
            colorBuffer.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
            colorBuffer.addressV = pc.ADDRESS_CLAMP_TO_EDGE;

            rt._colorBuffer = colorBuffer;
            rt.destroy();
        },

        _destroyOffscreenTarget: function (rt) {
            if (rt._colorBuffer)
                rt._colorBuffer.destroy();
            if (rt._depthBuffer)
                rt._depthBuffer.destroy();

            rt.destroy();
        },

        setRenderTargetScale: function (scale) {
            this.renderTargetScale = scale;
            this.resizeRenderTargets();
        },

        /**
         * @function
         * @name pc.PostEffectQueue#addEffect
         * @description Adds a post effect to the queue. If the queue is disabled adding a post effect will
         * automatically enable the queue.
         * @param {pc.PostEffect} effect The post effect to add to the queue.
         */
        addEffect: function (effect) {
            // first rendering of the scene requires depth buffer
            var isFirstEffect = this.effects.length === 0;

            var effects = this.effects;
            var newEntry = {
                effect: effect,
                inputTarget: this._createOffscreenTarget(isFirstEffect, effect.hdr),
                outputTarget: null
            };

            // legacy compatibility: create new layer
            if (!this.layer) {
                this.layer = new pc.Layer({
                    opaqueSortMode: pc.SORTMODE_NONE,
                    transparentSortMode: pc.SORTMODE_NONE,
                    passThrough: true,
                    name: "PostEffectQueue",
                    renderTarget: this.camera.renderTarget,
                    clear: false,
                    onPostRender: function () {
                        for (var i = 0; i < this._commandList.length; i++) {
                            this._commandList[i]();
                        }
                    }
                });
                // insert it after the last occurence of this camera
                var layerList = this.app.scene.layers.layerList;
                var order = 0;
                var i;
                var start = layerList.length - 1;
                for (i = start; i >= 0; i--) {
                    if (layerList[i].id === pc.LAYERID_UI) {
                        start = i - 1;

                        this._origOverrideClear = layerList[i].overrideClear;
                        this._origClearColorBuffer = layerList[i].clearColorBuffer;
                        this._origDepthColorBuffer = layerList[i].clearDepthBuffer;
                        this._origStencilColorBuffer = layerList[i].clearStencilBuffer;

                        layerList[i].overrideClear = true;
                        layerList[i].clearColorBuffer = false;
                        layerList[i].clearDepthBuffer = this.camera.clearDepthBuffer;
                        layerList[i].clearStencilBuffer = this.camera.clearStencilBuffer;
                        break;
                    }
                }

                this._sourceLayers = [];

                for (i = 0; i < this.camera.layers.length; i++) {
                    var layerID = this.camera.layers[i];
                    var layer = this.app.scene.layers.getLayerById(layerID);
                    var index = this.app.scene.layers.layerList.indexOf(layer);

                    if (index <= start) {
                        if (layerID != pc.LAYERID_DEPTH) {
                            layer.renderTarget = newEntry.inputTarget;
                            this._sourceLayers.push(layer);
                        }

                        if (index > order)
                            order = index;
                    }
                }
                this.app.scene.layers.insertOpaque(this.layer, order + 1);
                this._sourceTarget = newEntry.inputTarget;
                this.layer._commandList = [];
                this.layer.isPostEffect = true;
            }

            effects.push(newEntry);

            var len = effects.length;
            if (len > 1) {
                // connect the effect with the previous effect if one exists
                effects[len - 2].outputTarget = newEntry.inputTarget;
            }

            // Request depthmap if needed
            this._newPostEffect = effect;
            if (effect.needsDepthBuffer) {
                this._requestDepthMap();
            }


            this.enable();
            this._newPostEffect = undefined;
        },

        /**
         * @function
         * @name pc.PostEffectQueue#removeEffect
         * @description Removes a post effect from the queue. If the queue becomes empty it will be disabled automatically.
         * @param {pc.PostEffect} effect The post effect to remove.
         */
        removeEffect: function (effect) {
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
                        // Also apply to the source layers
                        for (i = 0; i < this._sourceLayers.length; i++) {
                            this._sourceLayers[i].renderTarget = this.effects[1].inputTarget;
                        }

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
        },

        _requestDepthMaps: function () {
            for (var i = 0, len = this.effects.length; i < len; i++) {
                var effect = this.effects[i].effect;
                if (this._newPostEffect === effect)
                    continue;

                if (effect.needsDepthBuffer) {
                    this._requestDepthMap();
                }
            }
        },

        _releaseDepthMaps: function () {
            for (var i = 0, len = this.effects.length; i < len; i++) {
                var effect = this.effects[i].effect;
                if (effect.needsDepthBuffer) {
                    this._releaseDepthMap();
                }
            }
        },

        _requestDepthMap: function () {
            if (!depthLayer) depthLayer = this.app.scene.layers.getLayerById(pc.LAYERID_DEPTH);
            if (depthLayer) depthLayer.incrementCounter();
        },

        _releaseDepthMap: function () {
            if (depthLayer) depthLayer.decrementCounter();
        },

        /**
         * @function
         * @name pc.PostEffectQueue#destroy
         * @description Removes all the effects from the queue and disables it
         */
        destroy: function () {
            // release memory for all effects
            for (var i = 0, len = this.effects.length; i < len; i++) {
                this.effects[i].inputTarget.destroy();
            }

            this.effects.length = 0;

            this.disable();
        },

        /**
         * @function
         * @name pc.PostEffectQueue#enable
         * @description Enables the queue and all of its effects. If there are no effects then the queue will not be enabled.
         */
        enable: function () {
            if (!this.enabled && this.effects.length) {
                this.enabled = true;

                var self = this;
                this._requestDepthMaps();

                this.app.graphicsDevice.on('resizecanvas', this._onCanvasResized, this);

                // set the camera's rect to full screen. Set it directly to the
                // camera node instead of the component because we want to keep the old
                // rect set in the component for restoring the camera to its original settings
                // when the queue is disabled.
                // self.camera.camera.setRect(0, 0, 1, 1);

                // create a new command that renders all of the effects one after the other
                this.command = function () {
                    if (self.enabled) {
                        var rect = null;
                        var len = self.effects.length;
                        if (len) {
                            self.layer.renderTarget = self.effects[0].inputTarget;
                            // self.depthTarget = self.camera.camera._depthTarget;

                            for (var i = 0; i < len; i++) {
                                var fx = self.effects[i];
                                // if (self.depthTarget) fx.effect.depthMap = self.depthTarget.colorBuffer;
                                if (i === len - 1) {
                                    rect = self.camera.rect;
                                }

                                fx.effect.render(fx.inputTarget, fx.outputTarget, rect);
                            }
                        }
                    }
                };

                this.layer._commandList.push(this.command);
            }
        },

        /**
         * @function
         * @name pc.PostEffectQueue#disable
         * @description Disables the queue and all of its effects.
         */
        disable: function () {
            if (this.enabled) {
                this.enabled = false;

                this.app.graphicsDevice.off('resizecanvas', this._onCanvasResized, this);

                this._releaseDepthMaps();
                this._destroyOffscreenTarget(this._sourceTarget);

                // remove the draw command
                var i = this.layer._commandList.indexOf(this.command);
                if (i >= 0) {
                    this.layer._commandList.splice(i, 1);
                }

                // Reset the UI layer to its original state
                var layerList = this.app.scene.layers.layerList;
                var start = layerList.length - 1;
                for (i = 0; i <= layerList.length; i++) {
                    if (layerList[i].id === pc.LAYERID_UI) {
                        start = i - 1;
                        layerList[i].overrideClear = this._origOverrideClear;
                        layerList[i].clearColorBuffer = this._origClearColorBuffer;
                        layerList[i].clearDepthBuffer = this._origDepthColorBuffer;
                        layerList[i].clearStencilBuffer = this._origStencilColorBuffer;
                        break;
                    }
                }
                for (i = start; i >= 0; i--) {
                    if (layerList[i].cameras.indexOf(this.camera) >= 0) {
                        layerList[i].renderTarget = undefined;
                    }
                }

                this.app.scene.layers.removeOpaque(this.layer);
                this.layer = null;
            }
        },

        _onCanvasResized: function (width, height) {
            var rect = this.camera.rect;
            var device = this.app.graphicsDevice;
            this.camera.camera.aspectRatio = (device.width * rect.z) / (device.height * rect.w);

            // avoid resizing the render targets too often by using a timeout
            if (this.resizeTimeout)
                return;

            if ((pc.now() - this.resizeLast) > 100) {
                // allow resizing immediately if haven't been resized recently
                this.resizeRenderTargets();
            } else {
                // target to maximum at 10 resizes a second
                this.resizeTimeout = setTimeout(this._resizeTimeoutCallback, 100);
            }
        },

        resizeRenderTargets: function () {
            if (this.resizeTimeout) {
                clearTimeout(this.resizeTimeout);
                this.resizeTimeout = null;
            }

            this.resizeLast = pc.now();

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
        },

        onCameraRectChanged: function (name, oldValue, newValue) {
            if (this.enabled) {
                // reset the camera node's rect to full screen otherwise
                // post effect will not work correctly
                // this.camera.camera.setRect(0, 0, 1, 1);
                this.resizeRenderTargets();
            }
        }
    });

    return {
        PostEffectQueue: PostEffectQueue
    };
}());
