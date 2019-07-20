Object.assign(pc, function () {
    /**
     * @constructor
     * @name pc.VrDisplay
     * @classdesc Represents a single Display for VR content. This could be a Head Mounted display that can present content on a separate screen
     * or a phone which can display content full screen on the same screen. This object contains the native `navigator.VRDisplay` object
     * from the WebVR API.
     * @description Represents a single Display for VR content. This could be a Head Mounted display that can present content on a separate screen
     * or a phone which can display content full screen on the same screen. This object contains the native `navigator.VRDisplay` object
     * from the WebVR API.
     * @param {pc.Application} app The application outputting to this VR display.
     * @param {VRDisplay} display The native VRDisplay object from the WebVR API.
     * @property {Number} id An identifier for this distinct VRDisplay
     * @property {VRDisplay} display The native VRDisplay object from the WebVR API
     * @property {Boolean} presenting True if this display is currently presenting VR content
     * @property {VRDisplayCapabilities} capabilities Returns the <a href="https://w3c.github.io/webvr/#interface-vrdisplaycapabilities" target="_blank">VRDisplayCapabilities</a> object from the VRDisplay.
     * This can be used to determine what features are available on this display.
     */
    var VrDisplay = function (app, display) {
        var self = this;

        this._app = app;
        this._device = app.graphicsDevice;

        this.id = display.displayId;

        this._frameData = null;
        if (window.VRFrameData) {
            this._frameData = new window.VRFrameData();
        }
        this.display = display;

        this._camera = null; // camera component

        this.sitToStandInv = new pc.Mat4();

        this.leftView = new pc.Mat4();
        this.leftProj = new pc.Mat4();
        this.leftViewInv = new pc.Mat4();
        this.leftPos = new pc.Vec3();

        this.rightView = new pc.Mat4();
        this.rightProj = new pc.Mat4();
        this.rightViewInv = new pc.Mat4();
        this.rightPos = new pc.Vec3();

        this.combinedPos = new pc.Vec3();
        this.combinedView = new pc.Mat4();
        this.combinedProj = new pc.Mat4();
        this.combinedViewInv = new pc.Mat4();
        this.combinedFov = 0;
        this.combinedAspect = 0;

        this.presenting = false;

        self._presentChange = function (event) {
            var display;
            // handle various events formats
            if (event.display) {
                // this is the official spec event format
                display = event.display;
            } else if (event.detail && event.detail.display) {
                // webvr-polyfill uses this
                display = event.detail.display;
            } else if (event.detail && event.detail.vrdisplay) {
                // this was used in the webvr emulation chrome extension
                display = event.detail.vrdisplay;
            } else {
                // final catch all is to use this display as Firefox Nightly (54.0a1)
                // does not include the display within the event data
                display = self.display;
            }

            // check if event refers to this display
            if (display === self.display) {
                self.presenting = (self.display && self.display.isPresenting);

                if (self.presenting) {
                    var leftEye = self.display.getEyeParameters("left");
                    var rightEye = self.display.getEyeParameters("right");
                    var w = Math.max(leftEye.renderWidth, rightEye.renderWidth) * 2;
                    var h = Math.max(leftEye.renderHeight, rightEye.renderHeight);
                    // set canvas resolution to the display resolution
                    self._app.graphicsDevice.setResolution(w, h);
                    // prevent window resizing from resizing it
                    self._app._allowResize = false;
                } else {
                    // restore original resolution
                    self._app.setCanvasResolution(pc.RESOLUTION_AUTO);
                    self._app._allowResize = true;
                }

                self.fire('beforepresentchange', self); // fire internal event for camera component
                self.fire('presentchange', self);
            }
        };
        window.addEventListener('vrdisplaypresentchange', self._presentChange, false);

        pc.events.attach(this);
    };

    Object.assign(VrDisplay.prototype, {
        /**
         * @function
         * @name pc.VrDisplay#destroy
         * @description Destroy this display object
         */
        destroy: function () {
            window.removeEventListener('vrdisplaypresentchange', self._presentChange);
            if (this._camera) this._camera.vrDisplay = null;
            this._camera = null;
        },

        /**
         * @function
         * @name pc.VrDisplay#poll
         * @description Called once per frame to update the current status from the display. Usually called by {@link pc.VrManager}.
         */
        poll: function () {
            if (this.display) {
                this.display.getFrameData(this._frameData);

                this.leftProj.data = this._frameData.leftProjectionMatrix;
                this.rightProj.data = this._frameData.rightProjectionMatrix;

                var stage = this.display.stageParameters;
                if (stage) {

                    this.sitToStandInv.set(stage.sittingToStandingTransform).invert();

                    this.combinedView.set(this._frameData.leftViewMatrix);
                    this.leftView.mul2(this.combinedView, this.sitToStandInv);

                    this.combinedView.set(this._frameData.rightViewMatrix);
                    this.rightView.mul2(this.combinedView, this.sitToStandInv);
                } else {

                    this.leftView.set(this._frameData.leftViewMatrix);
                    this.rightView.set(this._frameData.rightViewMatrix);
                }

                // Find combined position and view matrix
                // Camera is offset backwards to cover both frustums

                // Extract widest frustum plane and calculate fov
                var nx = this.leftProj.data[3] + this.leftProj.data[0];
                var nz = this.leftProj.data[11] + this.leftProj.data[8];
                var l = 1.0 / Math.sqrt(nx * nx + nz * nz);
                nx *= l;
                nz *= l;
                var maxFov = -Math.atan2(nz, nx);

                nx = this.rightProj.data[3] + this.rightProj.data[0];
                nz = this.rightProj.data[11] + this.rightProj.data[8];
                l = 1.0 / Math.sqrt(nx * nx + nz * nz);
                nx *= l;
                nz *= l;
                maxFov = Math.max(maxFov, -Math.atan2(nz, nx));
                maxFov *= 2.0;

                this.combinedFov = maxFov;

                var aspect = this.rightProj.data[5] / this.rightProj.data[0];
                this.combinedAspect = aspect;

                var view = this.combinedView;
                view.copy(this.leftView);
                view.invert();
                this.leftViewInv.copy(view);
                var pos = this.combinedPos;
                pos.x = this.leftPos.x = view.data[12];
                pos.y = this.leftPos.y = view.data[13];
                pos.z = this.leftPos.z = view.data[14];
                view.copy(this.rightView);
                view.invert();
                this.rightViewInv.copy(view);
                var deltaX = pos.x - view.data[12];
                var deltaY = pos.y - view.data[13];
                var deltaZ = pos.z - view.data[14];
                var dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ);
                this.rightPos.x = view.data[12];
                this.rightPos.y = view.data[13];
                this.rightPos.z = view.data[14];
                pos.x += view.data[12];
                pos.y += view.data[13];
                pos.z += view.data[14];
                pos.x *= 0.5; // middle pos
                pos.y *= 0.5;
                pos.z *= 0.5;
                var b = Math.PI * 0.5;
                var c = maxFov * 0.5;
                var a = Math.PI - (b + c);
                var offset = dist * 0.5 * ( Math.sin(a) );// / Math.sin(b) ); // equals 1
                var fwdX = view.data[8];
                var fwdY = view.data[9];
                var fwdZ = view.data[10];
                view.data[12] = pos.x + fwdX * offset; // our forward goes backwards so + instead of -
                view.data[13] = pos.y + fwdY * offset;
                view.data[14] = pos.z + fwdZ * offset;
                this.combinedViewInv.copy(view);
                view.invert();

                // Find combined projection matrix
                this.combinedProj.setPerspective(maxFov * pc.math.RAD_TO_DEG,
                                                 aspect,
                                                 this.display.depthNear + offset,
                                                 this.display.depthFar + offset,
                                                 true);
            }
        },

        /**
         * @function
         * @name pc.VrDisplay#requestPresent
         * @description Try to present full screen VR content on this display
         * @param {Function} callback Called when the request is completed. Callback takes a single argument (err) that is the error message return
         * if presenting fails, or null if the call succeeds. Usually called by {@link pc.CameraComponent#enterVr}.
         */
        requestPresent: function (callback) {
            if (!this.display) {
                if (callback) callback(new Error("No VrDisplay to requestPresent"));
                return;
            }

            if (this.presenting) {
                if (callback) callback(new Error("VrDisplay already presenting"));
                return;
            }

            this.display.requestPresent([{ source: this._device.canvas }]).then(function () {
                if (callback) callback();
            }, function (err) {
                if (callback) callback(err);
            });
        },

        /**
         * @function
         * @name pc.VrDisplay#exitPresent
         * @description Try to stop presenting VR content on this display
         * @param {Function} callback Called when the request is completed. Callback takes a single argument (err) that is the error message return
         * if presenting fails, or null if the call succeeds. Usually called by {@link pc.CameraComponent#exitVr}.
         */
        exitPresent: function (callback) {
            if (!this.display) {
                if (callback) callback(new Error("No VrDisplay to exitPresent"));
            }

            if (!this.presenting) {
                if (callback) callback(new Error("VrDisplay not presenting"));
                return;
            }

            this.display.exitPresent().then(function () {
                if (callback) callback();
            }, function () {
                if (callback) callback(new Error("exitPresent failed"));
            });
        },

        /**
         * @function
         * @name pc.VrDisplay#requestAnimationFrame
         * @description Used in the main application loop instead of the regular `window.requestAnimationFrame`. Usually only called from inside {@link pc.Application}
         * @param {Function} fn Function called when it is time to update the frame.
         */
        requestAnimationFrame: function (fn) {
            if (this.display) this.display.requestAnimationFrame(fn);
        },

        /**
         * @function
         * @name pc.VrDisplay#submitFrame
         * @description Called when animation update is complete and the frame is ready to be sent to the display. Usually only called from inside {@link pc.Application}.
         */
        submitFrame: function () {
            if (this.display) this.display.submitFrame();
        },

        /**
         * @function
         * @name pc.VrDisplay#reset
         * @description Called to reset the pose of the pc.VrDisplay. Treating its current pose as the origin/zero. This should only be called in 'sitting' experiences.
         */
        reset: function () {
            if (this.display) this.display.resetPose();
        },

        /**
         * @function
         * @name pc.VrDisplay#setClipPlanes
         * @description Set the near and far depth plans of the display. This enables mapping of values in the
         * render target depth attachment to scene coordinates
         * @param {Number} n The near depth distance
         * @param {Number} f The far depth distance
         */
        setClipPlanes: function (n, f) {
            if (this.display) {
                this.display.depthNear = n;
                this.display.depthFar = f;
            }
        },

        /**
         * @function
         * @name pc.VrDisplay#getFrameData
         * @description Return the current frame data that is updated during polling.
         * @returns {VRFrameData} The frame data object
         */
        getFrameData: function () {
            if (this.display) return this._frameData;
        }
    });

    Object.defineProperty(VrDisplay.prototype, "capabilities", {
        get: function () {
            if (this.display) return this.display.capabilities;
            return {};
        }
    });

    return {
        VrDisplay: VrDisplay
    };
}());
