pc.extend(pc, function () {
    /**
     * @name pc.PostEffectQueue
     * @description Create a new PostEffectQueue
     * @class Used to manage multiple post effects for a camera
     * @param {pc.Application} app The application
     * @param {pc.CameraComponent} camera The camera component
     */
    function PostEffectQueue(app, camera) {
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

        camera.on('set_rect', this.onCameraRectChanged, this);
    }

    PostEffectQueue.prototype = {
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
            var format = hdr? device.getHdrFormat() : pc.PIXELFORMAT_R8_G8_B8_A8;

            var colorBuffer = new pc.Texture(device, {
                format: format,
                width: width,
                height: height
            });

            colorBuffer.minFilter = pc.FILTER_NEAREST;
            colorBuffer.magFilter = pc.FILTER_NEAREST;
            colorBuffer.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
            colorBuffer.addressV = pc.ADDRESS_CLAMP_TO_EDGE;

            return new pc.RenderTarget(this.app.graphicsDevice, colorBuffer, { depth: useDepth });
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

            if (isFirstEffect) {
                this.camera.renderTarget = newEntry.inputTarget;
            }

            effects.push(newEntry);

            var len = effects.length;
            if (len > 1) {
                // connect the effect with the previous effect if one exists
                effects[len - 2].outputTarget = newEntry.inputTarget;
            }

            this.enable();
        },

        /**
         * @function
         * @name pc.PostEffectQueue#removeEffect
         * @description Removes a post effect from the queue. If the queue becomes empty it will be disabled automatically.
         * @param {pc.PostEffect} effect The post effect to remove.
         */
        removeEffect: function (effect) {
            // find index of effect
            var index = -1;
            for (var i=0,len=this.effects.length; i<len; i++) {
                if (this.effects[i].effect === effect) {
                    index = i;
                    break;
                }
            }

            if (index >= 0) {
                if (index > 0)  {
                    // connect the previous effect with the effect after the one we're about to remove
                    this.effects[index-1].outputTarget = (index + 1) < this.effects.length ?
                                                         this.effects[index+1].inputTarget :
                                                         null;
                } else {
                    if (this.effects.length > 1) {
                        // if we removed the first effect then make sure that
                        // the input render target of the effect that will now become the first one
                        // has a depth buffer
                        if (!this.effects[1].inputTarget._depth) {
                            this.effects[1].inputTarget.destroy();
                            this.effects[1].inputTarget = this._createOffscreenTarget(true, this.effects[1].hdr);
                        }

                        this.camera.renderTarget = this.effects[1].inputTarget;
                    }
                }

                // release memory for removed effect
                this.effects[index].inputTarget.destroy();

                this.effects.splice(index, 1);
            }

            if (this.enabled) {
                if (effect.needsDepthBuffer) {
                    this.camera.releaseDepthMap();
                }
            }

            if (this.effects.length === 0) {
                this.disable();
            }
        },

        requestDepthMap: function () {
            for (var i=0,len=this.effects.length; i<len; i++) {
                var effect = this.effects[i].effect;
                if (effect.needsDepthBuffer) {
                    this.camera.camera.requestDepthMap();
                }
            }
        },

        releaseDepthMap: function () {
            for (var i=0,len=this.effects.length; i<len; i++) {
                var effect = this.effects[i].effect;
                if (effect.needsDepthBuffer) {
                    this.camera.releaseDepthMap();
                }
            }
        },

        /**
         * @function
         * @name pc.PostEffectQueue#destroy
         * @description Removes all the effects from the queue and disables it
         */
        destroy: function () {
            // release memory for all effects
            for (var i=0,len=this.effects.length; i<len; i++) {
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

                var effects = this.effects;
                var camera = this.camera;
                this.requestDepthMap();

                this.app.graphicsDevice.on('resizecanvas', this._onCanvasResized, this);

                // set the camera's rect to full screen. Set it directly to the
                // camera node instead of the component because we want to keep the old
                // rect set in the component for restoring the camera to its original settings
                // when the queue is disabled.
                camera.camera.setRect(0, 0, 1, 1);

                // create a new command that renders all of the effects one after the other
                this.command = new pc.Command(pc.LAYER_FX, pc.BLEND_NONE, function () {
                    if (this.enabled && camera.data.isRendering) {
                        var rect = null;
                        var len = effects.length;
                        if (len) {
                            camera.renderTarget = effects[0].inputTarget;
                            this.depthTarget = this.camera.camera._depthTarget;

                            for (var i=0; i<len; i++) {
                                var fx = effects[i];
                                if (this.depthTarget) fx.effect.depthMap = this.depthTarget.colorBuffer;
                                if (i === len - 1) {
                                    rect = camera.rect;
                                }

                                fx.effect.render(fx.inputTarget, fx.outputTarget, rect);
                            }
                        }
                    }
                }.bind(this));

                this.app.scene.drawCalls.push(this.command);
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

                this.camera.renderTarget = null;
                this.releaseDepthMap();

                var rect = this.camera.rect;
                this.camera.camera.setRect(rect.x, rect.y, rect.z, rect.w);

                // remove the draw command
                var i = this.app.scene.drawCalls.indexOf(this.command);
                if (i >= 0) {
                    this.app.scene.drawCalls.splice(i, 1);
                }
            }
        },

        _onCanvasResized: function (width, height) {

            var rect = this.camera.rect;
            var device = this.app.graphicsDevice;
            var aspect = (device.width * rect.z) / (device.height * rect.w);
            if (aspect !== this.camera.camera.getAspectRatio()) {
                this.camera.camera.setAspectRatio(aspect);
            }

            // avoid resizing the render targets too often by using a timeout
            if (this.resizeTimeout) {
                clearTimeout(this.resizeTimeout);
            }

            this.resizeTimeout = setTimeout(this.resizeRenderTargets.bind(this), 500);
        },

        resizeRenderTargets: function () {
            var rect = this.camera.rect;
            var desiredWidth = Math.floor(rect.z * this.app.graphicsDevice.width * this.renderTargetScale);
            var desiredHeight = Math.floor(rect.w * this.app.graphicsDevice.height * this.renderTargetScale);

            var effects = this.effects;

            for (var i=0,len=effects.length; i<len; i++) {
                var fx = effects[i];
                if (fx.inputTarget.width !== desiredWidth ||
                    fx.inputTarget.height !== desiredHeight)  {
                    fx.inputTarget.destroy();
                    fx.inputTarget = this._createOffscreenTarget(fx.effect.needsDepthBuffer || i === 0, fx.hdr);

                    if (i>0) {
                        effects[i-1].outputTarget = fx.inputTarget;
                    } else {
                        this.camera.renderTarget = fx.inputTarget;
                    }
                }
            }
        },

        onCameraRectChanged: function (name, oldValue, newValue) {
            if (this.enabled) {
                // reset the camera node's rect to full screen otherwise
                // post effect will not work correctly
                this.camera.camera.setRect(0, 0, 1, 1);
                this.resizeRenderTargets();
            }
        }
    };

    return {
        PostEffectQueue: PostEffectQueue
    };
}());
