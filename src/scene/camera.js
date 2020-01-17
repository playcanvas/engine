Object.assign(pc, function () {
    // pre-allocated temp variables
    var _deviceCoord = new pc.Vec3();
    var _far = new pc.Vec3();
    var _farW = new pc.Vec3();
    var _invViewProjMat = new pc.Mat4();
    /**
     * @private
     * @class
     * @name pc.Camera
     * @classdesc A camera.
     */
    var Camera = function () {
        this._projection = pc.PROJECTION_PERSPECTIVE;
        this._nearClip = 0.1;
        this._farClip = 10000;
        this._shaderParams = new Float32Array(4);
        this._fov = 45;
        this._orthoHeight = 10;
        this._aspect = 16 / 9;
        this._aspectRatioMode = pc.ASPECT_AUTO;
        this._horizontalFov = false;
        this.frustumCulling = false;
        this.cullingMask = 0xFFFFFFFF;
        this._renderDepthRequests = 0;

        this._projMatDirty = true;
        this._projMat = new pc.Mat4();
        this._viewMatDirty = true;
        this._viewMat = new pc.Mat4();
        this._viewProjMatDirty = true;
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
            color: [0.5, 0.5, 0.5, 1.0],
            depth: 1.0,
            stencil: 0,
            flags: pc.CLEARFLAG_COLOR | pc.CLEARFLAG_DEPTH | pc.CLEARFLAG_STENCIL
        };

        this._node = null;

        this.calculateTransform = null;
        this.overrideCalculateTransform = false;
        this.calculateProjection = null;
        this.overrideCalculateProjection = false;
        this._cullFaces = true;
        this._flipFaces = false;

        this._component = null;
    };

    Object.assign(Camera.prototype, {
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
            clone._shaderParams = this._shaderParams.slice();
            clone.fov = this._fov;
            clone.aspectRatio = this._aspect;
            clone._aspectRatioMode = this._aspectRatioMode;
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
         * @param {pc.Vec3} worldCoord - The world space coordinate to transform.
         * @param {number} cw - The width of PlayCanvas' canvas element.
         * @param {number} ch - The height of PlayCanvas' canvas element.
         * @param {pc.Vec3} [screenCoord] - 3D vector to receive screen coordinate result.
         * @returns {pc.Vec3} The screen space coordinate.
         */
        worldToScreen: function (worldCoord, cw, ch, screenCoord) {
            if (screenCoord === undefined) {
                screenCoord = new pc.Vec3();
            }

            if (this._projMatDirty || this._viewMatDirty || this._viewProjMatDirty) {
                var projMat = this.getProjectionMatrix();
                var viewMat = this.getViewMatrix();
                this._viewProjMat.mul2(projMat, viewMat);
                this._viewProjMatDirty = false;
            }
            this._viewProjMat.transformPoint(worldCoord, screenCoord);

            // calculate w co-coord
            var vpm = this._viewProjMat.data;
            var w = worldCoord.x * vpm[3] +
                    worldCoord.y * vpm[7] +
                    worldCoord.z * vpm[11] +
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
         * @param {number} x - x coordinate on PlayCanvas' canvas element.
         * @param {number} y - y coordinate on PlayCanvas' canvas element.
         * @param {number} z - The distance from the camera in world space to create the new point.
         * @param {number} cw - The width of PlayCanvas' canvas element.
         * @param {number} ch - The height of PlayCanvas' canvas element.
         * @param {pc.Vec3} [worldCoord] - 3D vector to receive world coordinate result.
         * @returns {pc.Vec3} The world space coordinate.
         */
        screenToWorld: function (x, y, z, cw, ch, worldCoord) {
            if (worldCoord === undefined) {
                worldCoord = new pc.Vec3();
            }

            if (this._projMatDirty || this._viewMatDirty || this._viewProjMatDirty) {
                var projMat = this.getProjectionMatrix();
                var viewMat = this.getViewMatrix();
                this._viewProjMat.mul2(projMat, viewMat);
                this._viewProjMatDirty = false;
            }
            _invViewProjMat.copy(this._viewProjMat).invert();

            if (this._projection === pc.PROJECTION_PERSPECTIVE) {
                // Calculate the screen click as a point on the far plane of the
                // normalized device coordinate 'box' (z=1)
                _far.set(x / cw * 2 - 1, (ch - y) / ch * 2 - 1, 1);

                // Transform to world space
                _invViewProjMat.transformPoint(_far, _farW);

                var w = _far.x * _invViewProjMat.data[3] +
                        _far.y * _invViewProjMat.data[7] +
                        _far.z * _invViewProjMat.data[11] +
                        _invViewProjMat.data[15];

                _farW.scale(1 / w);

                var alpha = z / this._farClip;
                worldCoord.lerp(this._node.getPosition(), _farW, alpha);
            } else {
                // Calculate the screen click as a point on the far plane of the
                // normalized device coordinate 'box' (z=1)
                var range = this._farClip - this._nearClip;
                _deviceCoord.set(x / cw, (ch - y) / ch, z / range);
                _deviceCoord.scale(2);
                _deviceCoord.sub(pc.Vec3.ONE);

                // Transform to world space
                _invViewProjMat.transformPoint(_deviceCoord, worldCoord);
            }

            return worldCoord;
        },

        /**
         * @private
         * @function
         * @name pc.Camera#getClearOptions
         * @description Retrieves the options used to determine how the camera's render target will be cleared.
         * @returns {object} The options determining the behaviour of render target clears.
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

                var n = this._nearClip;
                var f = this._farClip;
                this._shaderParams[0] = 1 / f;
                this._shaderParams[1] = f;
                this._shaderParams[2] = (1 - f / n) / 2;
                this._shaderParams[3] = (1 + f / n) / 2;

                this._projMatDirty = false;
            }
            return this._projMat;
        },

        /**
         * @private
         * @function
         * @name pc.Camera#getViewMatrix
         * @description Retrieves the view matrix for the specified camera based on the entity world transformation.
         * @returns {pc.Mat4} The camera's view matrix.
         */
        getViewMatrix: function () {
            if (this._viewMatDirty) {
                var wtm = this._node.getWorldTransform();
                this._viewMat.copy(wtm).invert();
                this._viewMatDirty = false;
            }
            return this._viewMat;
        },

        getRect: function () {
            return this._rect;
        },

        /**
         * @private
         * @function
         * @name pc.Camera#setClearOptions
         * @description Sets the options used to determine how the camera's render target will be cleared.
         * @param {object} options - The options determining the behaviour of subsequent render target clears.
         * @param {number[]} options.color - The options determining the behaviour of subsequent render target clears.
         * @param {number} options.depth - The options determining the behaviour of subsequent render target clears.
         * @param {number} options.flags - The options determining the behaviour of subsequent render target clears.
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
    });

    /**
     * @private
     * @name pc.Camera#aspectRatio
     * @type {number}
     * @description Camera's aspect ratio.
     */
    Object.defineProperty(Camera.prototype, 'aspectRatio', {
        get: function () {
            return this._aspect;
        },
        set: function (v) {
            if (this._aspect !== v) {
                this._aspect = v;
                this._projMatDirty = true;
            }
        }
    });

    /**
     * @private
     * @name pc.Camera#projection
     * @type {number}
     * @description Camera's projection type, to specify whether projection is orthographic (parallel projection) or perspective. Can be:
     * <ul>
     *     <li>{@link pc.PROJECTION_PERSPECTIVE}</li>
     *     <li>{@link pc.PROJECTION_ORTHOGRAPHIC}</li>
     * </ul>
     */
    Object.defineProperty(Camera.prototype, 'projection', {
        get: function () {
            return this._projection;
        },
        set: function (v) {
            if (this._projection !== v) {
                this._projection = v;
                this._projMatDirty = true;
            }
        }
    });

    /**
     * @private
     * @name pc.Camera#nearClip
     * @type {number}
     * @description Camera's distance to near clipping plane
     */
    Object.defineProperty(Camera.prototype, 'nearClip', {
        get: function () {
            return this._nearClip;
        },
        set: function (v) {
            if (this._nearClip !== v) {
                this._nearClip = v;
                this._projMatDirty = true;
            }
        }
    });

    /**
     * @private
     * @name pc.Camera#farClip
     * @type {number}
     * @description Camera's distance to far clipping plane
     */
    Object.defineProperty(Camera.prototype, 'farClip', {
        get: function () {
            return this._farClip;
        },
        set: function (v) {
            if (this._farClip !== v) {
                this._farClip = v;
                this._projMatDirty = true;
            }
        }
    });

    /**
     * @private
     * @name pc.Camera#fov
     * @type {number}
     * @description Camera's field of view in degrees. This angle is in degrees
     * and is measured vertically or horizontally between the sides of camera planes.
     * hirozontalFov property defines the fov axis - vertical or horizontal.
     */
    Object.defineProperty(Camera.prototype, 'fov', {
        get: function () {
            return this._fov;
        },
        set: function (v) {
            if (this._fov !== v) {
                this._fov = v;
                this._projMatDirty = true;
            }
        }
    });

    /**
     * @private
     * @name pc.Camera#horizontalFov
     * @type {boolean}
     * @description Camera's horizontal or vertical field of view.
     */
    Object.defineProperty(Camera.prototype, 'horizontalFov', {
        get: function () {
            return this._horizontalFov;
        },
        set: function (v) {
            if (this._horizontalFov !== v) {
                this._horizontalFov = v;
                this._projMatDirty = true;
            }
        }
    });

    /**
     * @private
     * @name pc.Camera#orthoHeight
     * @type {number}
     * @description Camera's half height of the orthographics view.
     */
    Object.defineProperty(Camera.prototype, 'orthoHeight', {
        get: function () {
            return this._orthoHeight;
        },
        set: function (v) {
            if (this._orthoHeight !== v) {
                this._orthoHeight = v;
                this._projMatDirty = true;
            }
        }
    });

    /**
     * @private
     * @name pc.Camera#clearColor
     * @type {number[]}
     * @description Camera's clear color.
     */
    Object.defineProperty(Camera.prototype, 'clearColor', {
        get: function () {
            return this._clearOptions.color;
        },
        set: function (v) {
            this._clearOptions.color[0] = v[0];
            this._clearOptions.color[1] = v[1];
            this._clearOptions.color[2] = v[2];
            this._clearOptions.color[3] = v[3];
        }
    });

    /**
     * @private
     * @name pc.Camera#clearDepth
     * @type {number}
     * @description Camera's clear depth value.
     */
    Object.defineProperty(Camera.prototype, 'clearDepth', {
        get: function () {
            return this._clearOptions.depth;
        },
        set: function (v) {
            this._clearOptions.depth = v;
        }
    });

    /**
     * @private
     * @name pc.Camera#clearStencil
     * @type {number}
     * @description Camera's clear stencil value.
     */
    Object.defineProperty(Camera.prototype, 'clearStencil', {
        get: function () {
            return this._clearOptions.stencil;
        },
        set: function (v) {
            this._clearOptions.stencil = v;
        }
    });

    /**
     * @private
     * @name pc.Camera#clearFlags
     * @type {number}
     * @description Camera's clear flags bits value.
     */
    Object.defineProperty(Camera.prototype, 'clearFlags', {
        get: function () {
            return this._clearOptions.flags;
        },
        set: function (v) {
            this._clearOptions.flags = v;
        }
    });

    return {
        Camera: Camera
    };
}());
