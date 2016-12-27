pc.extend(pc, function () {
    pc.SCREEN_TYPE_WORLD    = "world";
    pc.SCREEN_TYPE_CAMERA   = "camera";
    pc.SCREEN_TYPE_SCREEN   = "screen";

    var ScreenComponent = function ScreenComponent (system, entity) {
        this._resolution = new pc.Vec2(this.system.app.graphicsDevice.width, this.system.app.graphicsDevice.height);
        this._referenceResolution = new pc.Vec2(640,320);
        this._scaleMode = pc.ScreenComponent.SCALEMODE_NONE;
        this.scale = 1;
        this._scaleBlend = 0.5;
        this._debugColor = null;

        this._screenType = pc.SCREEN_TYPE_CAMERA;
        this._screenDistance = 1.0;
        this._screenMatrix = new pc.Mat4();

        system.app.graphicsDevice.on("resizecanvas", this._onResize, this);
    };

    ScreenComponent = pc.inherits(ScreenComponent, pc.Component);

    ScreenComponent.SCALEMODE_NONE = "none";
    ScreenComponent.SCALEMODE_BLEND = "blend";

    var _transform = new pc.Mat4();

    pc.extend(ScreenComponent.prototype, {

        // Draws a debug box transforming local-spaced corners using current transformation matrix.
        // Helps to understand where the bounds of the screen really are.
        _drawDebugBox: function (dt) {
            var p = new pc.Vec3(0, 0, 0);
            var r = this.entity.right.clone().scale(this._resolution.x).sub(new pc.Vec3(0, 0, 0));
            var u = this.entity.up.clone().scale(this._resolution.y).sub(new pc.Vec3(0, 0, 0));

            // corners are obviously origin (0, 0, 0) plus all combinations of Right
            // and Up vectors, which have the length of horizontal and vertical resolution
            // respectively
            var corners = [
                p.clone().add(u).add(new pc.Vec3(0, 0, 0)),
                p.clone().add(r).add(u),
                p.clone().add(r).add(new pc.Vec3(0, 0, 0)),
                p.clone().add(new pc.Vec3(0, 0, 0))
            ];

            // the points denote the lines between the corners.
            var points = [
                corners[0], corners[1],
                corners[1], corners[2],
                corners[2], corners[3],
                corners[3], corners[0]
            ];

            var transform = this._screenMatrix;

            // we use _screenMatrix to do the transforms as that's the matrix
            // all nested components rely on
            for(var i = 0; i < points.length; i++) {
                points[i] = transform.transformPoint( points[i] );
            }

            // use immediate API to avoid material and transform glitches
            this.system.app.renderLines(points, this._debugColor, this._screenType == pc.SCREEN_TYPE_SCREEN ? pc.LINEBATCH_SCREEN : pc.LINEBATCH_WORLD);
        },

        syncDrawOrder: function () {
            var i = 1;

            var recurse = function (e) {
                if (e.element) {
                    e.element.drawOrder = i++;
                }

                var children = e.getChildren();
                for (var j = 0; j < children.length; j++) {
                    recurse(children[j]);
                }
            }

            recurse(this.entity);
        },

        _calcProjectionMatrix: function () {
            var left;
            var right;
            var bottom;
            var top;
            var near = 1E5;
            var far = -1E5;

            var w = this._resolution.x * this.scale;
            var h = this._resolution.y * this.scale;

            left = 0;
            right = w;
            bottom = 0;
            top = h;

            // default screen matrix is obviously plain ortho one: UI space with (0, 0) origin
            // at the lower left corner and (w, h) in size maps onto clipspace of the device.
            this._screenMatrix.setOrtho(0, w, 0, h, near, far);

            if (this._screenType == pc.SCREEN_TYPE_CAMERA) {
                // camera case requires special consideration, however
                var camera = this.camera;

                // first off, decide where the UI plane will end up in camera's sight
                var nearClipOffset     = this._screenDistance;
                // this will be our clip-space-to-camera-space transform
                var clipSpaceToNearClipSpace = new pc.Mat4();

                if (camera.projection == pc.PROJECTION_PERSPECTIVE) {
                    // we are in pespective camera
                    // we cannot just inverse projection matrix as this will break transforms, so
                    // we have to compue clip-space-to-camera-space transform ourself

                    // we extract fov from the camera
                    var fov = camera.fov / 2;
                    // then we compute the viewport height at nearClipOffset distance which is conveniently
                    // fov angle tangents times offset of the place
                    var nearClipHalfHeight = Math.tan( fov * Math.PI / 180.0 ) * nearClipOffset;
                    // the near clip width comes from screen proportions
                    var nearClipHalfWidth  = nearClipHalfHeight * w / h;
                    
                    // while the clip space to near clip space would be just scale
                    clipSpaceToNearClipSpace.setTRS( pc.Vec3.ZERO, pc.Quat.IDENTITY, new pc.Vec3( nearClipHalfWidth, nearClipHalfHeight, 1 ) );
                } else {
                    // we are in ortho camera
                    clipSpaceToNearClipSpace.setTRS( pc.Vec3.ZERO, pc.Quat.IDENTITY, new pc.Vec3( camera.orthoHeight * w / h, camera.orthoHeight, 1 ) );
                }

                // the clipOffset will be the transform to move from (0, 0, 0) onto the desired UI pane
                var clipOffset = new pc.Mat4().setTRS( new pc.Vec3(0, 0, -nearClipOffset), pc.Quat.IDENTITY, pc.Vec3.ONE );

                // and the screen matrix is effectively the chain of transforms:
                // UI plane -> Clip space -> Camera Origin -> UI plane
                this._screenMatrix = camera._node.getWorldTransform().clone().
                    mul( clipOffset ).
                    mul( clipSpaceToNearClipSpace ).
                    mul( this._screenMatrix );
            } else if (this._screenType == pc.SCREEN_TYPE_WORLD) {
                // in case of the the world everything is very simple – just normalize the size to match
                // the desired "resolution"
                var worldMatrix = new pc.Mat4();
                worldMatrix.setTRS( new pc.Vec3(-this._resolution.x * 0.5, -this._resolution.y * 0.5, 0), pc.Quat.IDENTITY, new pc.Vec3( 1, 1, 1 ) );

                this._screenMatrix = worldMatrix.mul( this.entity.getWorldTransform() ); 
            }

            this._width = w;
            this._height = h;
        },

        _onResize: function (width, height) {
            if (this._screenType != pc.SCREEN_TYPE_WORLD) {
                this._resolution.set(width, height);
                this.resolution = this._resolution; // force update
            }
        }
    });

    Object.defineProperty(ScreenComponent.prototype, "resolution", {
        set: function (value) {
            if (this._screenType != pc.SCREEN_TYPE_SCREEN) {
                this._resolution.set(value.x, value.y);
            } else {
                // ignore input when using screenspace.
                this._resolution.set(this.system.app.graphicsDevice.width, this.system.app.graphicsDevice.height);
            }

            if (this._scaleMode === pc.ScreenComponent.SCALEMODE_NONE) {
                this.referenceResolution = this._resolution;
            }

            var refRes = this.referenceResolution;
            this._scalex = refRes.x / this._resolution.x;
            this._scaley = refRes.y / this._resolution.y;
            this.scale = this._scalex*(1-this._scaleBlend) + this._scaley*this._scaleBlend;

            this._calcProjectionMatrix();
            this.fire("set:resolution", this._resolution);
        },
        get: function () {
            return this._resolution;
        }
    });

    Object.defineProperty(ScreenComponent.prototype, "debugColor", {
        get: function () {
            return this._debugColor;
        },

        set: function (value) {
            this._debugColor = value;

            if (this._debugColor) {
                pc.ComponentSystem.on("update", this._drawDebugBox, this);
            } else {
                pc.ComponentSystem.off("update", this._drawDebugBox, this);
            }
        }
    });

    Object.defineProperty(ScreenComponent.prototype, "referenceResolution", {
        set: function (value) {
            this._referenceResolution.set(value.x, value.y);

            var refRes = this.referenceResolution;
            this._scalex = refRes.x / this._resolution.x;
            this._scaley = refRes.y / this._resolution.y;
            this.scale = this._scalex*(1-this._scaleBlend) + this._scaley*this._scaleBlend;

            this._calcProjectionMatrix();
            this.fire("set:referenceresolution", this._resolution);
        },
        get: function () {
            if (this._scaleMode === pc.ScreenComponent.SCALEMODE_NONE) {
                return this._resolution;
            } else {
                return this._referenceResolution;
            }
        }
    });

    Object.defineProperty(ScreenComponent.prototype, "screenType", {
        set: function (value) {
            this._screenType = value;
            
            if (this._screenType == pc.SCREEN_TYPE_SCREEN) {
                this._resolution.set(this.system.app.graphicsDevice.width, this.system.app.graphicsDevice.height);
            }

            this.resolution = this._resolution;

            this.fire('set:screentype', this._screenType);
        },
        get: function () {
            return this._screenType;
        }
    });

    Object.defineProperty(ScreenComponent.prototype, "screenDistance", {
        set: function (value) {
            this._screenDistance = value;
            this._calcProjectionMatrix();
        },
        get: function () {
            return this._screenDistance;
        }
    });

    Object.defineProperty(ScreenComponent.prototype, "scaleMode", {
        set: function (value) {
            if (value !== pc.ScreenComponent.SCALEMODE_NONE && value !== pc.ScreenComponent.SCALEMODE_BLEND) {
                value = pc.ScreenComponent.SCALEMODE_NONE;
            }
            this._scaleMode = value;
            this.resolution = this._resolution; // force update
            this.fire("set:scalemode", this._scaleMode);
        },
        get: function () {
            return this._scaleMode;
        }
    });

    Object.defineProperty(ScreenComponent.prototype, "scaleBlend", {
        set: function (value) {
            this._scaleBlend = value;
            this._scalex = this._referenceResolution.x / this._resolution.x;
            this._scaley = this._referenceResolution.y / this._resolution.y;
            this.scale = this._scalex*(1-this._scaleBlend) + this._scaley*this._scaleBlend;

            this._calcProjectionMatrix();
            this.fire("set:scaleblend", this._scaleBlend);
        },
        get: function () {
            return this._scaleBlend;
        }
    });

    Object.defineProperty(ScreenComponent.prototype, "camera", {
        set: function (value) {
            this._camera = value;
            this._calcProjectionMatrix();
        },
        get: function () {
            return this._camera || pc.Application.getApplication().systems.camera.cameras[0].camera;
        }
    });

    return {
        ScreenComponent: ScreenComponent
    };
}());

