pc.extend(pc.posteffect, function () {
    /**
     * @name pc.posteffect.PostEffectQueue
     * @constructor Create a new PostEffectQueue
     * @class Used to manage multiple post effects for a camera
     * @param {pc.fw.ApplicationContext} context The application context
     * @param {pc.fw.CameraComponent} camera The camera component
     */
    function PostEffectQueue(context, camera) {
        this.context = context;
        this.camera = camera;
        // stores all of the post effects
        this.effects = [];
        // if the queue is enabled it will render all of its effects
        // otherwise it will not render anything
        this.enabled = false;
        // this render target has depth encoded in RGB - needed for effects that
        // require a depth buffer
        this.depthTarget = null;

        camera.on('set_rect', this.onCameraRectChanged, this);

        this.previous
    }

    PostEffectQueue.prototype = {
         /**
         * @private
         * @function
         * @name pc.fw.PostEffectQueue#_createOffscreenTarget
         * @description Creates a render target with the dimensions of the canvas, with an optional depth buffer
         * @param {Boolean} useDepth Set to true if you want to create a render target with a depth buffer
         * @returns {pc.gfx.RenderTarget} The render target
         */
        _createOffscreenTarget: function (useDepth) {
            var rect = this.camera.rect;
            var width = Math.floor(rect.z * this.context.graphicsDevice.width);
            var height = Math.floor(rect.w * this.context.graphicsDevice.height);

            var colorBuffer = new pc.gfx.Texture(this.context.graphicsDevice, {
                format: pc.gfx.PIXELFORMAT_R8_G8_B8_A8,
                width: width,
                height: height
            });

            colorBuffer.minFilter = pc.gfx.FILTER_NEAREST;
            colorBuffer.magFilter = pc.gfx.FILTER_NEAREST;
            colorBuffer.addressU = pc.gfx.ADDRESS_CLAMP_TO_EDGE;
            colorBuffer.addressV = pc.gfx.ADDRESS_CLAMP_TO_EDGE;

            return new pc.gfx.RenderTarget(this.context.graphicsDevice, colorBuffer, { depth: useDepth });
        },

        _setDepthTarget: function (depthTarget) {
            if (this.depthTarget !== depthTarget) {
                // destroy existing depth target
                if (this.depthTarget) {
                    this.depthTarget.destroy();
                }

                this.depthTarget = depthTarget;
            }

            // set this to the _depthTarget field of the camera node
            // used by the forward renderer to render the scene with
            // a depth shader on the depth target
            this.camera.camera._depthTarget = depthTarget;
        },

        /**
         * @function
         * @name pc.fw.PostEffectQueue#addEffect
         * @description Adds a post effect to the queue. If the queue is disabled adding a post effect will
         * automatically enable the queue.
         * @param {Object} effect The post effect to add to the queue.
         */
        addEffect: function (effect) {
            // first rendering of the scene requires depth buffer
            var isFirstEffect = this.effects.length === 0;

            var effects = this.effects;
            var newEntry = {
                effect: effect,
                inputTarget: this._createOffscreenTarget(isFirstEffect),
                outputTarget: null
            };

            if (effect.needsDepthBuffer) {
                if (!this.depthTarget) {
                    this._setDepthTarget(this._createOffscreenTarget(true));
                }

                effect.depthMap = this.depthTarget.colorBuffer;
            }

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
         * @name pc.fw.PostEffectQueue#removeEffect
         * @description Removes a post effect from the queue. If the queue becomes empty it will be disabled automatically.
         * @param {Object} effect The post effect to remove.
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
                            this.effects[1].inputTarget = this._createOffscreenTarget(true);
                        }

                        this.camera.renderTarget = this.effects[1].inputTarget;
                    }
                }

                // release memory for removed effect
                this.effects[index].inputTarget.destroy();

                this.effects.splice(index, 1);
            }

            if (this.depthTarget) {
                var isDepthTargetNeeded = false;
                for (var i=0,len=this.effects.length; i<len; i++) {
                    if (this.effects[i].effect.needsDepthBuffer) {
                        isDepthTargetNeeded = true;
                        break;
                    }
                }

                if (!isDepthTargetNeeded) {
                    this._setDepthTarget(null);
                }
            }


            if (this.effects.length === 0) {
                this.disable();
            }
        },

        /**
         * @function
         * @name pc.fw.PostEffectQueue#destroy
         * @description Removes all the effects from the queue and disables it
         */
        destroy: function () {
            // release memory of depth target
            if (this.depthTarget) {
                this.depthTarget.destroy();
                this.depthTarget = null;
            }

            // release memory for all effects
            for (var i=0,len=this.effects.length; i<len; i++) {
                this.effects[i].inputTarget.destroy();
            }

            this.effects.length = 0;

            this.disable();
        },

        /**
         * @function
         * @name pc.fw.PostEffectQueue#enable
         * @description Enables the queue and all of its effects. If there are no effects then the queue will not be enabled.
         */
        enable: function () {
            if (!this.enabled && this.effects.length) {
                this.enabled = true;

                var effects = this.effects;
                var camera = this.camera;

                // set the camera's rect to full screen. Set it directly to the
                // camera node instead of the component because we want to keep the old
                // rect set in the component for restoring the camera to its original settings
                // when the queue is disabled.
                camera.camera.setRect(0, 0, 1, 1);

                // create a new command that renders all of the effects one after the other
                this.command = new pc.scene.Command(pc.scene.LAYER_FX, pc.scene.BLEND_NONE, function () {
                    if (this.enabled && camera.data.isRendering) {
                        var rect = null;
                        var len = effects.length;
                        if (len) {
                            camera.renderTarget = effects[0].inputTarget;
                            this._setDepthTarget(this.depthTarget);

                            for (var i=0; i<len; i++) {
                                var fx = effects[i];
                                if (i === len - 1) {
                                    rect = camera.rect;
                                }

                                fx.effect.render(fx.inputTarget, fx.outputTarget, rect);
                            }
                        }
                    }
                }.bind(this));

                this.context.scene.drawCalls.push(this.command);
            }
        },

        /**
         * @function
         * @name pc.fw.PostEffectQueue#disable
         * @description Disables the queue and all of its effects.
         */
        disable: function () {
            if (this.enabled) {
                this.enabled = false;

                this.camera.renderTarget = null;
                this.camera.camera._depthTarget = null;
                var rect = this.camera.rect;
                this.camera.camera.setRect(rect.x, rect.y, rect.z, rect.w);

                // remove the draw command
                var i = this.context.scene.drawCalls.indexOf(this.command);
                if (i >= 0) {
                    this.context.scene.drawCalls.splice(i, 1);
                }
            }
        },

        resizeRenderTargets: function () {
            var rect = this.camera.rect;
            var desiredWidth = Math.floor(rect.z * this.context.graphicsDevice.width);
            var desiredHeight = Math.floor(rect.w * this.context.graphicsDevice.height);

            var effects = this.effects;

            if (this.depthTarget && this.depthTarget.width !== desiredWidth && this.depthTarget.height !== desiredHeight) {
                this._setDepthTarget(this._createOffscreenTarget(true));
            }

            for (var i=0,len=effects.length; i<len; i++) {
                var fx = effects[i];
                if (fx.inputTarget.width !== desiredWidth ||
                    fx.inputTarget.height !== desiredHeight)  {
                    fx.inputTarget.destroy();
                    fx.inputTarget = this._createOffscreenTarget(fx.effect.needsDepthBuffer || i === 0);

                    if (fx.effect.needsDepthBuffer) {
                        fx.depthMap = this.depthTarget;
                    }

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