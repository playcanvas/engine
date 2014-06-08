pc.scene.Projection = {
    PERSPECTIVE  : 0,
    ORTHOGRAPHIC : 1
};

pc.extend(pc.scene, function () {
    /**
     * @name pc.scene.CameraNode
     * @class A camera.
     */
    var CameraNode = function () {
        this._projection = pc.scene.Projection.PERSPECTIVE;
        this._nearClip = 0.1;
        this._farClip = 10000;
        this._fov = 45;
        this._orthoHeight = 10;
        this._aspect = 16 / 9;

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

        this._frustum = new pc.shape.Frustum(this._projMat, this._viewMat);

        // Create a full size viewport onto the backbuffer
        this._renderTarget = null;

        // Create the clear options
        this._clearOptions = {
            color: [186.0 / 255.0, 186.0 / 255.0, 177.0 / 255.0, 1.0],
            depth: 1.0,
            flags: pc.gfx.CLEARFLAG_COLOR | pc.gfx.CLEARFLAG_DEPTH
        };
    };

    // A CameraNode is a specialization of a GraphNode.  So inherit...
    CameraNode = pc.inherits(CameraNode, pc.scene.GraphNode);

    pc.extend(CameraNode.prototype, {
        /**
         * @private
         * @function
         * @name pc.scene.CameraNode#_cloneInternal
         * @description Internal function for cloning the contents of a camera node. Also clones
         * the properties of the superclass GraphNode.
         * @param {pc.scene.CameraNode} clone The clone that will receive the copied properties.
         */
        _cloneInternal: function (clone) {
            // Clone GraphNode properties
            CameraNode._super._cloneInternal.call(this, clone);

            // Clone CameraNode properties
            clone.setProjection(this.getProjection());
            clone.setNearClip(this.getNearClip());
            clone.setFarClip(this.getFarClip());
            clone.setFov(this.getFov());
            clone.setAspectRatio(this.getAspectRatio());
            clone.setRenderTarget(this.getRenderTarget());
            clone.setClearOptions(this.getClearOptions());
        },

        /**
         * @function
         * @name pc.scene.CameraNode#clone
         * @description Duplicates a camera node but does not 'deep copy' the hierarchy.
         * @returns {pc.scene.CameraNode} A cloned CameraNode.
         */
        clone: function () {
            var clone = new pc.scene.CameraNode();
            this._cloneInternal(clone);
            return clone;
        },

        /**
         * Convert a point in 3D world space to a point in 2D screen space.
         * (0,0) is top-left
         * @param {Vec3} point
         */
        worldToScreen: function (point) {
            var projMat,
                wtm = this.getWorldTransform(),
                viewMat = wtm.clone().invert();
                pvm = new pc.Mat4();
                width = this._renderTarget.getWidth(),
                height = this._renderTarget.getHeight(),
                point2d = new pc.Vec3();

            projMat = new pc.Mat4().setPerspective(this._fov, width / height, this._nearClip, this._farClip);
            // Create projection view matrix
            pvm.mul2(projMat, viewMat);

            // transform point
            pvm.transformPoint(point, point2d);

            point2d.x = (width / 2) + (width / 2) * point2d.x;
            point2d.y = height - ((height / 2) + (height / 2) * point2d.y);
            point2d.z = point2d.z;

            return point2d;
        },

        /**
         * @function
         * @name pc.scene.CameraNode#screenToWorld
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
            if (typeof worldCoord === 'undefined') {
                worldCoord = new pc.Vec3();
            }

            var projMat = this.getProjectionMatrix();
            var wtm = this.getWorldTransform();
            this._viewMat.copy(wtm);
            this._viewMat.invert();
            this._viewProjMat.mul2(projMat, this._viewMat);
            var invViewProjMat = this._viewProjMat.clone().invert();

            var far = new pc.Vec3(x / cw * 2 - 1, (ch - y) / ch * 2 - 1, 1);
            var farW = invViewProjMat.transformPoint(far);

            var w = far.x * invViewProjMat.data[3] +
                    far.y * invViewProjMat.data[7] +
                    far.z * invViewProjMat.data[11] +
                    invViewProjMat.data[15];

            farW.scale(1 / w);

            var alpha = z / this._farClip;
            worldCoord.lerp(this.getPosition(), farW, alpha);

            return worldCoord;
        },

        /**
         * @function
         * @name pc.scene.CameraNode#getAspectRatio
         * @description Retrieves the setting for the specified camera's aspect ratio.
         * @returns {Number} The aspect ratio of the camera (width divided by height).
         */
        getAspectRatio: function () {
            return this._aspect;
        },

        /**
         * @function
         * @name pc.scene.CameraNode#getClearOptions
         * @description Retrieves the options used to determine how the camera's render target will be cleared.
         * @return {Object} The options determining the behaviour of render target clears.
         */
        getClearOptions: function () {
            return this._clearOptions;
        },

        /**
         * @function
         * @name pc.scene.CameraNode#getFarClip
         * @description Retrieves the setting for the specified camera's far clipping plane. This
         * is a Z-coordinate in eye coordinates.
         * @returns {Number} The far clipping plane distance.
         */
        getFarClip: function () {
            return this._farClip;
        },

        /**
         * @function
         * @name pc.scene.CameraNode#getFov
         * @description Retrieves the setting for the specified camera's vertical field of view. This
         * angle is in degrees and is measured vertically between the top and bottom camera planes.
         * @returns {Number} The vertical field of view in degrees.
         */
        getFov: function () {
            return this._fov;
        },

        /**
         * @function
         * @name pc.scene.CameraNode#getFrustum
         * @description Retrieves the frustum shape for the specified camera.
         * @returns {pc.shape.Frustum} The camera's frustum shape.
         */
        getFrustum: function () {
            return this._frustum;
        },

        /**
         * @function
         * @name pc.scene.CameraNode#getNearClip
         * @description Retrieves the setting for the specified camera's near clipping plane. This
         * is a Z-coordinate in eye coordinates.
         * @returns {Number} The near clipping plane distance.
         */
        getNearClip: function () {
            return this._nearClip;
        },

        /**
         * @function
         * @name pc.scene.CameraNode#getOrthoHeight
         * @description Retrieves the half height of the orthographic camera's view window.
         * @returns {Number} The half height of the orthographic view window in eye coordinates.
         */
        getOrthoHeight: function () {
            return this._orthoHeight;
        },

        /**
         * @function
         * @name pc.scene.CameraNode#getProjection
         * @description Retrieves the projection type for the specified camera.
         * @returns {pc.scene.Projection} The camera's projection type.
         */
        getProjection: function () {
            return this._projection;
        },

        /**
         * @function
         * @name pc.scene.CameraNode#getProjectionMatrix
         * @description Retrieves the projection matrix for the specified camera.
         * @returns {pc.Mat4} The camera's projection matrix.
         */
        getProjectionMatrix: function () {
            if (this._projMatDirty) {
                if (this._projection === pc.scene.Projection.PERSPECTIVE) {
                    this._projMat.setPerspective(this._fov, this._aspect, this._nearClip, this._farClip);
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
         * @function
         * @name pc.scene.CameraNode#getRenderTarget
         * @description Retrieves the render target currently set on the specified camera.
         * @returns {pc.gfx.RenderTarget} The camera's render target.
         */
        getRenderTarget: function () {
            return this._renderTarget;
        },

        /**
         * @function
         * @name pc.scene.CameraNode#setAspectRatio
         * @description Sets the specified camera's aspect ratio. This is normally the width
         * of the viewport divided by height.
         * @returns {Number} The aspect ratio of the camera.
         */
        setAspectRatio: function (aspect) {
            this._aspect = aspect;
            this._projMatDirty = true;
        },

        /**
         * @function
         * @name pc.scene.CameraNode#setClearOptions
         * @description Sets the options used to determine how the camera's render target will be cleared.
         * @param {Object} clearOptions The options determining the behaviour of subsequent render target clears.
         * @param {Array} clearOptions.color The options determining the behaviour of subsequent render target clears.
         * @param {number} clearOptions.depth The options determining the behaviour of subsequent render target clears.
         * @param {pc.gfx.CLEARFLAG} clearOptions.flags The options determining the behaviour of subsequent render target clears.
         */
        setClearOptions: function (options) {
            this._clearOptions = options;
        },

        /**
         * @function
         * @name pc.scene.CameraNode#setFarClip
         * @description Sets the specified camera's far clipping plane. This is a Z-coordinate in eye coordinates.
         * @param {Number} far The far clipping plane distance.
         */
        setFarClip: function (far) {
            this._farClip = far;
            this._projMatDirty = true;
        },

        /**
         * @function
         * @name pc.scene.CameraNode#setFov
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
         * @function
         * @name pc.scene.CameraNode#setNearClip
         * @description Sets the specified camera's near clipping plane. This is a Z-coordinate in eye coordinates.
         * @param {Number} near The near clipping plane distance.
         */
        setNearClip: function (near) {
            this._nearClip = near;
            this._projMatDirty = true;
        },

        /**
         * @function
         * @name pc.scene.CameraNode#setOrthoHeight
         * @description Sets the half height of the orthographic camera's view window.
         * @param {Number} height The half height of the orthographic view window in eye coordinates.
         */
        setOrthoHeight: function (height) {
            this._orthoHeight = height;
            this._projMatDirty = true;
        },

        /**
         * @function
         * @name pc.scene.CameraNode#setProjection
         * @description Sets the projection type for the specified camera. This determines whether the projection
         * will be orthographic (parallel projection) or perspective.
         * @param {pc.scene.Projection} type The camera's projection type.
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
         * @function
         * @name pc.scene.CameraNode#setRenderTarget
         * @description Sets the specified render target on the camera.
         * @param {pc.gfx.RenderTarget} target The render target to set.
         */
        setRenderTarget: function (target) {
            this._renderTarget = target;
        }
    });

    return {
        CameraNode: CameraNode
    };
}());
