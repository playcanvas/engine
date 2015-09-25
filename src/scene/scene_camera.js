pc.extend(pc, function () {
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
        this._renderDepthRequests = 0;

        this._projMatDirty = true;
        this._projMat = new pc.Mat4();
        this._viewMat = new pc.Mat4();
        this._viewProjMat = new pc.Mat4();

        this._rect = {
            x: 0,
            y: 0,
            width: 1,
            height: 1
        };

        this._frustum = new pc.Frustum(this._projMat, this._viewMat);

        // Create a full size viewport onto the backbuffer
        this._renderTarget = null;
        this._depthTarget = null;

        // Create the clear options
        this._clearOptions = {
            color: [186.0 / 255.0, 186.0 / 255.0, 177.0 / 255.0, 1.0],
            depth: 1.0,
            flags: pc.CLEARFLAG_COLOR | pc.CLEARFLAG_DEPTH
        };

        this._node = null;
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
            clone.setProjection(this.getProjection());
            clone.setNearClip(this.getNearClip());
            clone.setFarClip(this.getFarClip());
            clone.setFov(this.getFov());
            clone.setAspectRatio(this.getAspectRatio());
            clone.setRenderTarget(this.getRenderTarget());
            clone.setClearOptions(this.getClearOptions());
            clone.frustumCulling = this.frustumCulling;
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
                var far = new pc.Vec3(x / cw * 2 - 1, (ch - y) / ch * 2 - 1, 1);
                // Transform to world space
                var farW = invViewProjMat.transformPoint(far);

                var w = far.x * invViewProjMat.data[3] +
                        far.y * invViewProjMat.data[7] +
                        far.z * invViewProjMat.data[11] +
                        invViewProjMat.data[15];

                farW.scale(1 / w);

                var alpha = z / this._farClip;
                worldCoord.lerp(this._node.getPosition(), farW, alpha);
            } else {
                // Calculate the screen click as a point on the far plane of the
                // normalized device coordinate 'box' (z=1)
                var range = this._farClip - this._nearClip;
                var deviceCoord = new pc.Vec3(x / cw * 2 - 1, (ch - y) / ch * 2 - 1, (this._farClip - z) / range * 2 - 1);
                // Transform to world space
                invViewProjMat.transformPoint(deviceCoord, worldCoord);
            }

            return worldCoord;
        },

        /**
         * @private
         * @function
         * @name pc.Camera#getAspectRatio
         * @description Retrieves the setting for the specified camera's aspect ratio.
         * @returns {Number} The aspect ratio of the camera (width divided by height).
         */
        getAspectRatio: function () {
            return this._aspect;
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
         * @name pc.Camera#getFarClip
         * @description Retrieves the setting for the specified camera's far clipping plane. This
         * is a Z-coordinate in eye coordinates.
         * @returns {Number} The far clipping plane distance.
         */
        getFarClip: function () {
            return this._farClip;
        },

        /**
         * @private
         * @function
         * @name pc.Camera#getFov
         * @description Retrieves the setting for the specified camera's vertical field of view. This
         * angle is in degrees and is measured vertically between the top and bottom camera planes.
         * @returns {Number} The vertical field of view in degrees.
         */
        getFov: function () {
            return this._fov;
        },

        /**
         * @private
         * @function
         * @name pc.Camera#getFrustum
         * @description Retrieves the frustum shape for the specified camera.
         * @returns {pc.shape.Frustum} The camera's frustum shape.
         */
        getFrustum: function () {
            return this._frustum;
        },

        /**
         * @private
         * @function
         * @name pc.Camera#getNearClip
         * @description Retrieves the setting for the specified camera's near clipping plane. This
         * is a Z-coordinate in eye coordinates.
         * @returns {Number} The near clipping plane distance.
         */
        getNearClip: function () {
            return this._nearClip;
        },

        /**
         * @private
         * @function
         * @name pc.Camera#getOrthoHeight
         * @description Retrieves the half height of the orthographic camera's view window.
         * @returns {Number} The half height of the orthographic view window in eye coordinates.
         */
        getOrthoHeight: function () {
            return this._orthoHeight;
        },

        /**
         * @private
         * @function
         * @name pc.Camera#getProjection
         * @description Retrieves the projection type for the specified camera.
         * @returns {pc.PROJECTION} The camera's projection type.
         */
        getProjection: function () {
            return this._projection;
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
         * @name pc.Camera#getRenderTarget
         * @description Retrieves the render target currently set on the specified camera.
         * @returns {pc.RenderTarget} The camera's render target.
         */
        getRenderTarget: function () {
            return this._renderTarget;
        },

        /**
         * @private
         * @function
         * @name pc.Camera#setAspectRatio
         * @description Sets the specified camera's aspect ratio. This is normally the width
         * of the viewport divided by height.
         * @returns {Number} The aspect ratio of the camera.
         */
        setAspectRatio: function (aspect) {
            this._aspect = aspect;
            this._projMatDirty = true;
        },

        /**
         * @private
         * @function
         * @name pc.Camera#setClearOptions
         * @description Sets the options used to determine how the camera's render target will be cleared.
         * @param {Object} clearOptions The options determining the behaviour of subsequent render target clears.
         * @param {Array} clearOptions.color The options determining the behaviour of subsequent render target clears.
         * @param {number} clearOptions.depth The options determining the behaviour of subsequent render target clears.
         * @param {pc.CLEARFLAG} clearOptions.flags The options determining the behaviour of subsequent render target clears.
         */
        setClearOptions: function (options) {
            this._clearOptions = options;
        },

        /**
         * @private
         * @function
         * @name pc.Camera#setFarClip
         * @description Sets the specified camera's far clipping plane. This is a Z-coordinate in eye coordinates.
         * @param {Number} far The far clipping plane distance.
         */
        setFarClip: function (far) {
            this._farClip = far;
            this._projMatDirty = true;
        },

        /**
         * @private
         * @function
         * @name pc.Camera#setFov
         * @description Sets the specified camera's vertical field of view. This angle is in degrees and is
         * measured vertically from the view direction of the camera. Therefore, the angle is actually half
         * the angle between the top and bottom camera planes.
         * @param {Number} fov The vertical field of view in degrees.
         */
        setFov: function (fov) {
            this._fov = fov;
            this._projMatDirty = true;
        },

        /**
         * @private
         * @function
         * @name pc.Camera#setNearClip
         * @description Sets the specified camera's near clipping plane. This is a Z-coordinate in eye coordinates.
         * @param {Number} near The near clipping plane distance.
         */
        setNearClip: function (near) {
            this._nearClip = near;
            this._projMatDirty = true;
        },

        /**
         * @private
         * @function
         * @name pc.Camera#setOrthoHeight
         * @description Sets the half height of the orthographic camera's view window.
         * @param {Number} height The half height of the orthographic view window in eye coordinates.
         */
        setOrthoHeight: function (height) {
            this._orthoHeight = height;
            this._projMatDirty = true;
        },

        /**
         * @private
         * @function
         * @name pc.Camera#setHorizontalFov
         * @description Toggles horizontal/vertical FOV
         * @param {Number} value true (horizontal) or false (vertical).
         */
        setHorizontalFov: function (value) {
            this._horizontalFov = value;
            this._projMatDirty = true;
        },

        /**
         * @private
         * @function
         * @name pc.Camera#setProjection
         * @description Sets the projection type for the specified camera. This determines whether the projection
         * will be orthographic (parallel projection) or perspective.
         * @param {pc.Projection} type The camera's projection type.
         */
        setProjection: function (type) {
            this._projection = type;
            this._projMatDirty = true;
        },

        setRect: function (x, y, width, height) {
            this._rect.x = x;
            this._rect.y = y;
            this._rect.width = width;
            this._rect.height = height;
        },

        /**
         * @private
         * @function
         * @name pc.Camera#setRenderTarget
         * @description Sets the specified render target on the camera.
         * @param {pc.RenderTarget} target The render target to set.
         */
        setRenderTarget: function (target) {
            this._renderTarget = target;
        },

        requestDepthMap: function () {
            this._renderDepthRequests++;
        },

        releaseDepthMap: function () {
            this._renderDepthRequests--;
        }
    };

    return {
        Camera: Camera
    };
}());
