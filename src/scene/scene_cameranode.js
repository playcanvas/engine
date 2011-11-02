pc.scene.Projection = {
    PERSPECTIVE  : 0,
    ORTHOGRAPHIC : 1
}

pc.extend(pc.scene, function () {
    /**
     * @name pc.scene.CameraNode
     * @class A camera.
     */
    var CameraNode = function () {
        this._projection = pc.scene.Projection.PERSPECTIVE;
        this._nearClip = 0.1;
        this._farClip = 10000.0;
        this._fov = 45.0;
        this._viewWindow = pc.math.vec2.create(1.0, 1.0);
        this._lookAtNode = null;
        this._upNode = null;
        
        this._projMat = pc.math.mat4.create();
        this._viewMat = pc.math.mat4.create();
        this._viewProjMat = pc.math.mat4.create();

        // Create a full size viewport onto the backbuffer
        this._renderTarget = new pc.gfx.RenderTarget();

        // Create the clear options
        this._clearOptions = {
            color: [186.0 / 255.0, 186.0 / 255.0, 177.0 / 255.0, 1.0],
            depth: 1.0,
            flags: pc.gfx.ClearFlag.COLOR | pc.gfx.ClearFlag.DEPTH
        };
    }

    // A CameraNode is a specialization of a GraphNode.  So inherit...
    CameraNode = CameraNode.extendsFrom(pc.scene.GraphNode);

    CameraNode.prototype.clone = function () {
        var clone = new pc.scene.CameraNode();

        // GraphNode
        clone.setName(this.getName());
        clone.setLocalTransform(pc.math.mat4.clone(this.getLocalTransform()));
        clone._graphId = this._graphId;

        // CameraNode
        clone.setProjection(this.getProjection());
        clone.setNearClip(this.getNearClip());
        clone.setFarClip(this.getFarClip());
        clone.setFov(this.getFov());
        clone.setViewWindow(pc.math.vec2.clone(this.getViewWindow()));
        clone.setLookAtNode(this.getLookAtNode());
        clone.setUpNode(this.getUpNode());
        clone.setRenderTarget(this.getRenderTarget());
        clone.setClearOptions(this.getClearOptions());

        return clone;
    };

    /**
     * Convert a point in 3D world space to a point in 2D screen space.
     * (0,0) is top-left
     * @param {Vec3} point
     */
    CameraNode.prototype.worldToScreen = function (point) {
        var projMat,
            wtm = this.getWorldTransform(),
            viewMat = pc.math.mat4.invert(wtm),
            pvm = pc.math.mat4.create(),
            width = this._renderTarget.getWidth(),
            height = this._renderTarget.getHeight(),
            point2d = Vector4.create();

        projMat = pc.math.mat4.makePerspective(this._fov, width / height, this._nearClip, this._farClip);
        // Create projection view matrix
        pc.math.mat4.multiply(projMat, viewMat, pvm);    
        
        // transform point
        pc.math.mat4.multiplyVec3(point, 1.0, pvm, point2d);
        
        // Convert from homogenous coords
        var denom = point2d[3] || 1;
        
        point2d[0] = (width / 2) + (width / 2) * point2d[0] / denom;
        point2d[1] = height - ((height / 2) + (height / 2) * point2d[1] / denom);
        point2d[2] = point2d[2] / denom;        
        
        return point2d;
    };

    /**
     * Convert a point from 2D screen space to 3D world space
     * @param {Number} x x coordinate on screen
     * @param {Number} y y coordinate on scree
     * @param {Number} z The distance from the camera in world space to create the new point
     */
    CameraNode.prototype.screenToWorld = function (x,y,z) {  
        var output = pc.math.vec3.create();
        var wtm = this.getWorldTransform();
        var width = this._renderTarget.getWidth();
        var height = this._renderTarget.getHeight(); 
        var viewport = this._renderTarget.getViewport();
        var projMat = pc.math.mat4.makePerspective(this._fov, width / height, this._nearClip, this._farClip);
        var viewMat = pc.math.mat4.invert(wtm);

        unproject(pc.math.vec3.create(x,y,z), modelview, projection, viewport, output);
        
        return output;
    };

    /**
     * @function
     * @name pc.scene.CameraNode#frameBegin
     * @description Marks the beginning of a block of rendering to the specified camera.
     * This function begins by setting its render target and the currently target for the active graphics
     * device. It then clears the render target with the clear options set for the camera. Finally, it
     * internally sets the value of three shader uniforms: 'matrix_projection' (the 4x4 projection matrix
     * for the specified camera, 'matrix_view' (the 4x4 inverse of the specified camera's world transformation
     * matrix) and 'view_position' (the eye coordinate of the camera in world space).
     * Note that calls to frameBegin/frameEnd cannot be nested.
     * @author Will Eastcott
     */
    CameraNode.prototype.frameBegin = function (clear) {
        clear = (clear === undefined) ? true : clear;
        
        var device = pc.gfx.Device.getCurrent();
        device.setRenderTarget(this._renderTarget);
        device.updateBegin();
        if (clear) {
            device.clear(this._clearOptions);
        }
        
        // Set the projection matrix
        if (this._projection === pc.scene.Projection.PERSPECTIVE) {
            var viewport = this._renderTarget.getViewport();
            var aspect = viewport.width / viewport.height;
            pc.math.mat4.makePerspective(this._fov, aspect, this._nearClip, this._farClip, this._projMat);
        } else {
            pc.math.mat4.makeOrtho(-this._viewWindow[0], this._viewWindow[0], 
                                   -this._viewWindow[1], this._viewWindow[1],
                                    this._nearClip, this._farClip, this._projMat);
        }
        
        // Set the view related matrices
        var wtm = this.getWorldTransform();
        if (this._lookAtNode !== null) {
            var eye = pc.math.mat4.getTranslation(wtm);
            var target = pc.math.mat4.getTranslation(this._lookAtNode.getWorldTransform());
            if (this._upNode !== null) {
                var upPos = pc.math.mat4.getTranslation(this._upNode.getWorldTransform());
                var up = pc.math.vec3.create();
                pc.math.vec3.subtract(upPos, eye, up);
                pc.math.vec3.normalize(up, up);
            } else {
                var up = pc.math.vec3.create(0, 1, 0);
            }
            wtm = pc.math.mat4.makeLookAt(eye, target, up);
        }
        pc.math.mat4.invert(wtm, this._viewMat);
        pc.math.mat4.multiply(this._projMat, this._viewMat, this._viewProjMat);

        device.scope.resolve("matrix_projection").setValue(this._projMat);
        device.scope.resolve("matrix_view").setValue(this._viewMat);
        device.scope.resolve("matrix_viewInverse").setValue(wtm);
        device.scope.resolve("matrix_viewProjection").setValue(this._viewProjMat);

        // Set the eye position in world coordinates
        device.scope.resolve("view_position").setValue([wtm[12], wtm[13], wtm[14]]);
    };

    /**
     * @function
     * @name pc.scene.CameraNode#frameEnd
     * @description Marks the end of a block of rendering to the specified camera.
     * This function must be come after a matching call to frameBegin.
     * Note that calls to frameBegin/frameEnd cannot be nested.
     * @author Will Eastcott
     */
    CameraNode.prototype.frameEnd = function () {
        var device = pc.gfx.Device.getCurrent();
        device.updateEnd();
    };

    /**
     * @function
     * @name pc.scene.CameraNode#getFarClip
     * @description Retrieves the setting for the specified camera's far clipping plane. This
     * is a Z-coordinate in eye coordinates.
     * @returns {Number} The far clipping plane distance.
     * @author Will Eastcott
     */
    CameraNode.prototype.getFarClip = function () {
        return this._farClip;
    };

    /**
     * @function
     * @name pc.scene.CameraNode#getFov
     * @description Retrieves the setting for the specified camera's vertical field of view. This
     * angle is in degrees and is measured vertically between the top and bottom camera planes.
     * @returns {Number} The vertical field of view in degrees.
     * @author Will Eastcott
     */
    CameraNode.prototype.getFov = function () {
        return this._fov;
    };

    /**
     * @function
     * @name pc.scene.CameraNode#getFrustum
     * @description Retrieves the frustum shape for the specified camera.
     * @returns {pc.shape.Frustum} The camera's frustum shape.
     * @author Will Eastcott
     */
    CameraNode.prototype.getFrustum = function () {
        return new pc.shape.Frustum(this._projMat, this._viewMat);
    };

    /**
     * @function
     * @name pc.scene.CameraNode#getNearClip
     * @description Retrieves the setting for the specified camera's near clipping plane. This
     * is a Z-coordinate in eye coordinates.
     * @returns {Number} The near clipping plane distance.
     * @author Will Eastcott
     */
    CameraNode.prototype.getNearClip = function () {
        return this._nearClip;
    };

    /**
     * @function
     * @name pc.scene.CameraNode#getProjection
     * @description Retrieves the projection type for the specified camera.
     * @returns {pc.scene.Projection} The camera's projection type.
     * @author Will Eastcott
     */
    CameraNode.prototype.getProjection = function () {
        return this._projection;
    };

    /**
     * @function
     * @name pc.scene.CameraNode#getProjectionMatrix
     * @description Retrieves the projection matrix for the specified camera.
     * @returns {pc.matrix.Mat4} The camera's projection matrix.
     * @author Will Eastcott
     */
    CameraNode.prototype.getProjectionMatrix = function () {
        var projMat;
        if (this._projection === pc.scene.Projection.PERSPECTIVE) {
            var viewport = this._renderTarget.getViewport();
            var aspect = viewport.width / viewport.height;
            projMat = pc.math.mat4.makePerspective(this._fov, aspect, this._nearClip, this._farClip);
        } else {
            projMat = pc.math.mat4.makeOrtho(-this._viewWindow[0], this._viewWindow[0], 
                                             -this._viewWindow[1], this._viewWindow[1],
                                              this._nearClip, this._farClip);
        }
        return projMat;
    };

    /**
     * @function
     * @name pc.scene.CameraNode#getRenderTarget
     * @description Retrieves the render target currently set on the specified camera.
     * @returns {pc.gfx.RenderTarget} The camera's render target.
     * @author Will Eastcott
     */
    CameraNode.prototype.getRenderTarget = function () {
        return this._renderTarget;
    };

    /**
     * @function
     * @name pc.scene.CameraNode#getViewWindow
     * @description Retrieves the view window on the camera. The view window is specified
     * as half extents in X and Y axes. Note that the view window is only relevant
     * for cameras with an orthographic projection type. For cameras with a perspective 
     * projection, pc.scene.CameraNode#setFov is used to control the frustum shape.
     * @param {pc.math.Vec2} halfExtents The render target to set.
     * @author Will Eastcott
     */
    CameraNode.prototype.getViewWindow = function () {
        return this._viewWindow;
    };

    /**
     * @function
     * @name pc.scene.CameraNode#setClearOptions
     * @description Sets the options used to determine how the camera's render target will be cleared.
     * The clearing of the render target actually happens on a call to pc.scene.CameraNode#frameBegin.
     * @param {Object} clearOptions The options determining the behaviour of subsequent render target clears.
     * @param {Array} clearOptions.color The options determining the behaviour of subsequent render target clears.
     * @param {number} clearOptions.depth The options determining the behaviour of subsequent render target clears.
     * @param {pc.gfx.ClearFlag} clearOptions.flags The options determining the behaviour of subsequent render target clears.
     * @author Will Eastcott
     */
    CameraNode.prototype.setClearOptions = function (options) {
        this._clearOptions = options;
    };

    /**
     * @function
     * @name pc.scene.CameraNode#getClearOptions
     * @description Retrieves the options used to determine how the camera's render target will be cleared.
     * The clearing of the render target actually happens on a call to pc.scene.CameraNode#frameBegin.
     * @return {Object} The options determining the behaviour of render target clears.
     * @author Will Eastcott
     */
    CameraNode.prototype.getClearOptions = function () {
        return this._clearOptions;
    };

    /**
     * @function
     * @name pc.scene.CameraNode#setFarClip
     * @description Sets the specified camera's far clipping plane. This is a Z-coordinate in eye coordinates.
     * @param {Number} far The far clipping plane distance.
     * @author Will Eastcott
     */
    CameraNode.prototype.setFarClip = function (far) {
        this._farClip = far;
    };

    /**
     * @function
     * @name pc.scene.CameraNode#setFov
     * @description Sets the specified camera's vertical field of view. This angle is in degrees and is
     * measured vertically from the view direction of the camera. Therefore, the angle is actually half 
     * the angle between the top and bottom camera planes.
     * @param {Number} fov The vertical field of view in degrees.
     * @author Will Eastcott
     */
    CameraNode.prototype.setFov = function (fov) {
        this._fov = fov;
    };

    /**
     * @function
     * @name pc.scene.CameraNode#setNearClip
     * @description Sets the specified camera's near clipping plane. This is a Z-coordinate in eye coordinates.
     * @param {Number} near The near clipping plane distance.
     * @author Will Eastcott
     */
    CameraNode.prototype.setNearClip = function (near) {
        this._nearClip = near;
    };

    /**
     * @function
     * @name pc.scene.CameraNode#setProjection
     * @description Sets the projection type for the specified camera. This determines whether the projection
     * will be orthographic (parallel projection) or perspective.
     * @param {pc.scene.Projection} type The camera's projection type.
     * @author Will Eastcott
     */
    CameraNode.prototype.setProjection = function (type) {
        this._projection = type;
    };

    /**
     * @function
     * @name pc.scene.CameraNode#setRenderTarget
     * @description Sets the specified render target on the camera.
     * @param {pc.gfx.RenderTarget} target The render target to set.
     * @author Will Eastcott
     */
    CameraNode.prototype.setRenderTarget = function (target) {
        this._renderTarget = target;
    };

    /**
     * @function
     * @name pc.scene.CameraNode#setViewWindow
     * @description Sets the view window on the camera. The view window is specified
     * as half extents in X and Y axes. Note that the view window is only relevant
     * for cameras with an orthographic projection type. For cameras with a perspective 
     * projection, pc.scene.CameraNode#setFov is used to control the frustum shape.
     * @param {pc.math.Vec2} halfExtents The render target to set.
     * @author Will Eastcott
     */
    CameraNode.prototype.setViewWindow = function (halfExtents) {
        this._viewWindow = halfExtents;
    };

    CameraNode.prototype.setLookAtNode = function (node) {
        this._lookAtNode = node;
    };

    CameraNode.prototype.getLookAtNode = function () {
        return this._lookAtNode;
    };

    CameraNode.prototype.setUpNode = function (node) {
        this._upNode = node;
    };

    CameraNode.prototype.getUpNode = function () {
        return this._upNode;
    };

    return {
        CameraNode: CameraNode
    }; 
}());
    