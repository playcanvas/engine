pc.extend(pc, function () {
    // pre-allocated temp variables
    var _deviceCoord = new pc.Vec3();
    var _far = new pc.Vec3();
    /**
     * @private
     * @name pc.Camera
     * @class A camera.
     */
    var Camera = function () {
        this._projection = pc.PROJECTION_PERSPECTIVE;
        this._nearClip = 0.1;
        this._farClip = 10000;
        this._fov = 45;
        this._orthoHeight = 10;
        this._aspect = 16 / 9;
        this._horizontalFov = false;
        this.frustumCulling = false;
        this.cullingMask = 0xFFFFFFFF;
        this._renderDepthRequests = 0;

        this._projMatDirty = true;
        this._projMat = new pc.Mat4();
        this._viewMat = new pc.Mat4();
        this._viewProjMat = new pc.Mat4();

        this.vrDisplay = null;

        this._rect = {
            x: 0,
            y: 0,
            width: 1,
            height: 1
        };

        this._scissorRect = {
            x: 0,
            y: 0,
            width: 1,
            height: 1
        };

        this.frustum = new pc.Frustum(this._projMat, this._viewMat);

        // Create a full size viewport onto the backbuffer
        this.renderTarget = null;
        this._depthTarget = null;

        // Create the clear options
        this._clearOptions = {
            color: [ 0.5, 0.5, 0.5, 1.0 ],
            depth: 1.0,
            stencil: 0,
            flags: pc.CLEARFLAG_COLOR | pc.CLEARFLAG_DEPTH | pc.CLEARFLAG_STENCIL
        };

        this._node = null;

        this.customTransformFunc = null;
        this.hasCustomTransformFunc = false;
        this.customProjFunc = null;
        this.hasCustomProjFunc = false;
        this._cullFaces = true;
        this._flipFaces = false;
    };

    Camera.prototype = {
        /**
         * @private
         * @function
         * @name pc.Camera#clone
         * @description Duplicates a camera node but does not 'deep copy' the hierarchy.
         * @returns {pc.Camera} A cloned Camera.
         */
        clone: function () {
            var clone = new pc.Camera();
            clone.projection = this._projection;
            clone.nearClip = this._nearClip;
            clone.farClip = this._farClip;
            clone.fov = this._fov;
            clone.aspectRatio = this._aspect;
            clone.renderTarget = this.renderTarget;
            clone.setClearOptions(this.getClearOptions());
            clone.frustumCulling = this.frustumCulling;
            clone.cullingMask = this.cullingMask;
            return clone;
        },

        /**
         * @private
         * @function
         * @name pc.Camera#worldToScreen
         * @description Convert a point from 3D world space to 2D canvas pixel space.
         * @param {pc.Vec3} worldCoord The world space coordinate to transform.
         * @param {Number} cw The width of PlayCanvas' canvas element.
         * @param {Number} ch The height of PlayCanvas' canvas element.
         * @param {pc.Vec3} [screenCoord] 3D vector to recieve screen coordinate result.
         * @returns {pc.Vec3} The screen space coordinate.
         */
        worldToScreen: function (worldCoord, cw, ch, screenCoord) {
            if (screenCoord === undefined) {
                screenCoord = new pc.Vec3();
            }

            var projMat = this.getProjectionMatrix();
            var wtm = this._node.getWorldTransform();
            this._viewMat.copy(wtm).invert();
            this._viewProjMat.mul2(projMat, this._viewMat);
            this._viewProjMat.transformPoint(worldCoord, screenCoord);

            // calculate w co-coord
            var wp = worldCoord.data;
            var vpm = this._viewProjMat.data;
            var w = wp[0] * vpm[3] +
                    wp[1] * vpm[7] +
                    wp[2] * vpm[11] +
                        1 * vpm[15];

            screenCoord.x = (screenCoord.x / w + 1) * 0.5 * cw;
            screenCoord.y = (1 - screenCoord.y / w) * 0.5 * ch;

            return screenCoord;
        },

        /**
         * @private
         * @function
         * @name pc.Camera#screenToWorld
         * @description Convert a point from 2D canvas pixel space to 3D world space.
         * @param {Number} x x coordinate on PlayCanvas' canvas element.
         * @param {Number} y y coordinate on PlayCanvas' canvas element.
         * @param {Number} z The distance from the camera in world space to create the new point.
         * @param {Number} cw The width of PlayCanvas' canvas element.
         * @param {Number} ch The height of PlayCanvas' canvas element.
         * @param {pc.Vec3} [worldCoord] 3D vector to recieve world coordinate result.
         * @returns {pc.Vec3} The world space coordinate.
         */
        screenToWorld: function (x, y, z, cw, ch, worldCoord) {
            if (worldCoord === undefined) {
                worldCoord = new pc.Vec3();
            }

            var projMat = this.getProjectionMatrix();
            var wtm = this._node.getWorldTransform();
            this._viewMat.copy(wtm).invert();
            this._viewProjMat.mul2(projMat, this._viewMat);
            var invViewProjMat = this._viewProjMat.clone().invert();

            if (this._projection === pc.PROJECTION_PERSPECTIVE) {
                // Calculate the screen click as a point on the far plane of the
                // normalized device coordinate 'box' (z=1)
                _far.set(x / cw * 2 - 1, (ch - y) / ch * 2 - 1, 1);

                // Transform to world space
                var farW = invViewProjMat.transformPoint(_far);

                var w = _far.x * invViewProjMat.data[3] +
                        _far.y * invViewProjMat.data[7] +
                        _far.z * invViewProjMat.data[11] +
                        invViewProjMat.data[15];

                farW.scale(1 / w);

                var alpha = z / this._farClip;
                worldCoord.lerp(this._node.getPosition(), farW, alpha);
            } else {
                // Calculate the screen click as a point on the far plane of the
                // normalized device coordinate 'box' (z=1)
                var range = this._farClip - this._nearClip;
                _deviceCoord.set(x / cw * 2 - 1, (ch - y) / ch * 2 - 1, (this._farClip - z) / range * 2 - 1);
                // Transform to world space
                invViewProjMat.transformPoint(_deviceCoord, worldCoord);
            }

            return worldCoord;
        },

        /**
         * @private
         * @function
         * @name pc.Camera#getClearOptions
         * @description Retrieves the options used to determine how the camera's render target will be cleared.
         * @return {Object} The options determining the behaviour of render target clears.
         */
        getClearOptions: function () {
            return this._clearOptions;
        },

        /**
         * @private
         * @function
         * @name pc.Camera#getProjectionMatrix
         * @description Retrieves the projection matrix for the specified camera.
         * @returns {pc.Mat4} The camera's projection matrix.
         */
        getProjectionMatrix: function () {
            if (this._projMatDirty) {
                if (this._projection === pc.PROJECTION_PERSPECTIVE) {
                    this._projMat.setPerspective(this._fov, this._aspect, this._nearClip, this._farClip, this._horizontalFov);
                } else {
                    var y = this._orthoHeight;
                    var x = y * this._aspect;
                    this._projMat.setOrtho(-x, x, -y, y, this._nearClip, this._farClip);
                }

                this._projMatDirty = false;
            }
            return this._projMat;
        },

        getRect: function () {
            return this._rect;
        },

        /**
         * @private
         * @function
         * @name pc.Camera#setClearOptions
         * @description Sets the options used to determine how the camera's render target will be cleared.
         * @param {Object} clearOptions The options determining the behaviour of subsequent render target clears.
         * @param {Number[]} clearOptions.color The options determining the behaviour of subsequent render target clears.
         * @param {Number} clearOptions.depth The options determining the behaviour of subsequent render target clears.
         * @param {pc.CLEARFLAG} clearOptions.flags The options determining the behaviour of subsequent render target clears.
         */
        setClearOptions: function (options) {
            this._clearOptions.color[0] = options.color[0];
            this._clearOptions.color[1] = options.color[1];
            this._clearOptions.color[2] = options.color[2];
            this._clearOptions.color[3] = options.color[3];
            this._clearOptions.depth = options.depth;
            this._clearOptions.stencil = options.stencil;
            this._clearOptions.flags = options.flags;
        },

        setRect: function (x, y, width, height) {
            this._rect.x = x;
            this._rect.y = y;
            this._rect.width = width;
            this._rect.height = height;
        },

        setScissorRect: function (x, y, width, height) {
            this._scissorRect.x = x;
            this._scissorRect.y = y;
            this._scissorRect.width = width;
            this._scissorRect.height = height;
        },

        requestDepthMap: function () {
            this._renderDepthRequests++;
        },

        releaseDepthMap: function () {
            this._renderDepthRequests--;
        }
    };

    /**
     * @private
     * @type Number
     * @name pc.Camera#aspectRatio
     * @description Camera's aspect ratio.
     */
    Object.defineProperty(Camera.prototype, 'aspectRatio', {
        get: function() { return this._aspect; },
        set: function(v) {
            if (this._aspect !== v) {
                this._aspect = v;
                this._projMatDirty = true;
            }
        }
    });

    /**
     * @private
     * @type Number
     * @name pc.Camera#projection
     * @description Camera's projection type, to specify whether projection is orthographic (parallel projection) or perspective. Can be:
     * <ul>
     *     <li>{@link pc.PROJECTION_PERSPECTIVE}</li>
     *     <li>{@link pc.PROJECTION_ORTHOGRAPHIC}</li>
     * </ul>
     */
    Object.defineProperty(Camera.prototype, 'projection', {
        get: function() { return this._projection; },
        set: function(v) {
            if (this._projection !== v) {
                this._projection = v;
                this._projMatDirty = true;
            }
        }
    });

    /**
     * @private
     * @type Number
     * @name pc.Camera#nearClip
     * @description Camera's distance to near clipping plane
     */
    Object.defineProperty(Camera.prototype, 'nearClip', {
        get: function() { return this._nearClip; },
        set: function(v) {
            if (this._nearClip !== v) {
                this._nearClip = v;
                this._projMatDirty = true;
            }
        }
    });

    /**
     * @private
     * @type Number
     * @name pc.Camera#farClip
     * @description Camera's distance to far clipping plane
     */
    Object.defineProperty(Camera.prototype, 'farClip', {
        get: function() { return this._farClip; },
        set: function(v) {
            if (this._farClip !== v) {
                this._farClip = v;
                this._projMatDirty = true;
            }
        }
    });

    /**
     * @private
     * @type Number
     * @name pc.Camera#fov
     * @description Camera's field of view in degrees. This angle is in degrees
     * and is measured vertically or horizontally between the sides of camera planes.
     * hirozontalFov property defines the fov axis - vertical or horizontal.
     */
    Object.defineProperty(Camera.prototype, 'fov', {
        get: function() { return this._fov; },
        set: function(v) {
            if (this._fov !== v) {
                this._fov = v;
                this._projMatDirty = true;
            }
        }
    });

    /**
     * @private
     * @type Boolean
     * @name pc.Camera#horizontalFov
     * @description Camera's horizontal or vertical field of view.
     */
    Object.defineProperty(Camera.prototype, 'horizontalFov', {
        get: function() { return this._horizontalFov; },
        set: function(v) {
            if (this._horizontalFov !== v) {
                this._horizontalFov = v;
                this._projMatDirty = true;
            }
        }
    });

    /**
     * @private
     * @type Number
     * @name pc.Camera#orthoHeight
     * @description Camera's half height of the orthographics view.
     */
    Object.defineProperty(Camera.prototype, 'orthoHeight', {
        get: function() { return this._orthoHeight; },
        set: function(v) {
            if (this._orthoHeight !== v) {
                this._orthoHeight = v;
                this._projMatDirty = true;
            }
        }
    });

    /**
     * @private
     * @type Array
     * @name pc.Camera#clearColor
     * @description Camera's clear color.
     */
    Object.defineProperty(Camera.prototype, 'clearColor', {
        get: function() { return this._clearOptions.color; },
        set: function(v) {
            this._clearOptions.color[0] = v[0];
            this._clearOptions.color[1] = v[1];
            this._clearOptions.color[2] = v[2];
            this._clearOptions.color[3] = v[3];
        }
    });

    /**
     * @private
     * @type Number
     * @name pc.Camera#clearDepth
     * @description Camera's clear depth value.
     */
    Object.defineProperty(Camera.prototype, 'clearDepth', {
        get: function() { return this._clearOptions.depth; },
        set: function(v) {
            this._clearOptions.depth = v;
        }
    });

    /**
     * @private
     * @type Number
     * @name pc.Camera#clearStencil
     * @description Camera's clear stencil value.
     */
    Object.defineProperty(Camera.prototype, 'clearStencil', {
        get: function() { return this._clearOptions.stencil; },
        set: function(v) {
            this._clearOptions.stencil = v;
        }
    });

    /**
     * @private
     * @type Number
     * @name pc.Camera#clearFlags
     * @description Camera's clear flags bits value.
     */
    Object.defineProperty(Camera.prototype, 'clearFlags', {
        get: function() { return this._clearOptions.flags; },
        set: function(v) {
            this._clearOptions.flags = v;
        }
    });

    return {
        Camera: Camera
    };
}());
