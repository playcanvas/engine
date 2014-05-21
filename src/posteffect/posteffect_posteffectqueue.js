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
            var colorBuffer = new pc.gfx.Texture(this.context.graphicsDevice, {
                format: pc.gfx.PIXELFORMAT_R8_G8_B8_A8,
                width: this.context.graphicsDevice.canvas.width,
                height: this.context.graphicsDevice.canvas.height
            });

            colorBuffer.minFilter = pc.gfx.FILTER_NEAREST;
            colorBuffer.magFilter = pc.gfx.FILTER_NEAREST;
            colorBuffer.addressU = pc.gfx.ADDRESS_CLAMP_TO_EDGE;
            colorBuffer.addressV = pc.gfx.ADDRESS_CLAMP_TO_EDGE;
            var renderTarget = new pc.gfx.RenderTarget(this.context.graphicsDevice, colorBuffer, { depth: useDepth });
            return renderTarget;
        },

        /**
         * @function
         * @name pc.fw.PostEffectQueue#removeEffect
         * @description Removes a post effect from the queue. If the queue becomes empty it will be disabled automatically.
         * @param {Object} effect The post effect to remove.
         */
        removeEffect: function (effect) {
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
                    this.effects[index-1].outputTarget = this.effects.length > index + 1 ?
                                                         this.effects[index+1].inputTarget :
                                                         null;
                } else {
                    if (this.effects.length > 1) {
                        // if we removed the first effect then make sure that
                        // the input render target of the effect that will now become the first one
                        // has a depth buffer
                        if (!this.effects[1].inputTarget._depth) {
                            this.effects[1].inputTarget = this._createOffscreenTarget(true);
                        }
                    }
                }

                this.effects.splice(index, 1);
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

                // create a new command that renders all of the effects one after the other
                this.command = new pc.scene.Command(pc.scene.LAYER_FX, pc.scene.BLEND_NONE, function () {
                    if (this.enabled) {
                        var len = effects.length;
                        if (len) {
                            camera.renderTarget = effects[0].inputTarget;

                            for (var i=0; i<len; i++) {
                                var fx = effects[i];
                                fx.effect.render(fx.inputTarget, fx.outputTarget);
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
                // restore the camera's renderTarget to null
                this.camera.renderTarget = null;
                // remove the draw command
                var i = this.context.scene.drawCalls.indexOf(this.command);
                if (i >= 0) {
                    this.context.scene.drawCalls.splice(i, 1);
                }
            }
        }
    };

    return {
        PostEffectQueue: PostEffectQueue
    };
}());