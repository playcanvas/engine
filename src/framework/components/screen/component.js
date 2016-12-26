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

        // used for debug rendering
        _drawDebugBox: function (dt) {
            var p = new pc.Vec3(0, 0, 0);
            var r = this.entity.right.clone().scale(this._resolution.x).sub(new pc.Vec3(0, 0, 0));
            var u = this.entity.up.clone().scale(this._resolution.y).sub(new pc.Vec3(0, 0, 0));

            var corners = [
                p.clone().add(u).add(new pc.Vec3(0, 0, 0)),
                p.clone().add(r).add(u),
                p.clone().add(r).add(new pc.Vec3(0, 0, 0)),
                p.clone().add(new pc.Vec3(0, 0, 0))
            ];

            var points = [
                corners[0], corners[1],
                corners[1], corners[2],
                corners[2], corners[3],
                corners[3], corners[0]
            ];

            var transform = this._screenMatrix;

            for(var i = 0; i < points.length; i++) {
                points[i] = transform.transformPoint( points[i] );
            }

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

            this._screenMatrix.setOrtho(0, w, 0, h, near, far);

            if (this._screenType == pc.SCREEN_TYPE_CAMERA) {
                var camera = this.camera;

                var fov = camera.fov / 2;
                var nearClipOffset     = this._screenDistance;
                var nearClipHalfHeight = Math.tan( fov * Math.PI / 180.0 ) * nearClipOffset;
                var nearClipHalfWidth  = nearClipHalfHeight * w / h;
                var clipOffset = new pc.Mat4().setTRS( new pc.Vec3(0, 0, -nearClipOffset), pc.Quat.IDENTITY, pc.Vec3.ONE );
                var clipSpaceToNearClipSpace = new pc.Mat4();
                clipSpaceToNearClipSpace.setTRS( pc.Vec3.ZERO, pc.Quat.IDENTITY, new pc.Vec3( nearClipHalfWidth, nearClipHalfHeight, 1 ) );
                
                this._screenMatrix = camera._node.getWorldTransform().clone().
                    mul( clipOffset ).
                    mul( clipSpaceToNearClipSpace ).
                    mul( this._screenMatrix );
            } else if (this._screenType == pc.SCREEN_TYPE_WORLD) {
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

