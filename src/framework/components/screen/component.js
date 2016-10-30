pc.extend(pc, function () {
    var ScreenComponent = function ScreenComponent (system, entity) {
        this._resolution = new pc.Vec2(640, 320);
        this._referenceResolution = new pc.Vec2(640,320);
        this._scaleMode = pc.ScreenComponent.SCALEMODE_NONE;
        this.scale = 1;
        this._scaleBlend = 0.5;

        this._screenSpace = false;
        this._screenMatrix = new pc.Mat4();

        system.app.graphicsDevice.on("resizecanvas", this._onResize, this);
    };
    ScreenComponent = pc.inherits(ScreenComponent, pc.Component);

    ScreenComponent.SCALEMODE_NONE = "none";
    ScreenComponent.SCALEMODE_BLEND = "blend";

    var _transform = new pc.Mat4();

    pc.extend(ScreenComponent.prototype, {
        // used for debug rendering
        // update: function (dt) {
        //     var p = this.entity.getPosition();
        //     var s = this.entity.getLocalScale();
        //     var r = this.entity.right.clone().scale(this._resolution.x * s.x/2);
        //     var u = this.entity.up.clone().scale(this._resolution.y * s.y/2);

        //     var corners = [
        //         p.clone().sub(r).sub(u),
        //         p.clone().sub(r).add(u),
        //         p.clone().add(r).add(u),
        //         p.clone().add(r).sub(u)
        //     ];

        //     var points = [
        //         corners[0], corners[1],
        //         corners[1], corners[2],
        //         corners[2], corners[3],
        //         corners[3], corners[0]
        //     ];

        //     this.system.app.renderLines(points, new pc.Color(1,1,1));
        // },

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
            var near = 1;
            var far = -1;

            var w = this._resolution.x * this.scale;
            var h = this._resolution.y * this.scale;

            left = 0;
            right = w;
            bottom = -h;
            top = 0;

            this._screenMatrix.setOrtho(left, right, bottom, top, near, far);

            if (!this._screenSpace) {
                _transform.setScale(-0.5*w, 0.5*h, 1);
                this._screenMatrix.mul2(_transform, this._screenMatrix);
            }
        },

        _onResize: function (width, height) {
            if (this._screenSpace) {
                this._resolution.set(width, height);
                this.resolution = this._resolution; // force update
            }
        }
    });

    Object.defineProperty(ScreenComponent.prototype, "resolution", {
        set: function (value) {
            if (!this._screenSpace) {
                this._resolution.set(value.x, value.y);
            } else {
                // ignore input when using screenspace.
                this._resolution.set(this.system.app.graphicsDevice.width, this.system.app.graphicsDevice.height);
            }
            // if (this._scaleMode === pc.ScreenComponent.SCALEMODE_NONE) {
            //     this.referenceResolution = this._resolution;
            // }

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

    Object.defineProperty(ScreenComponent.prototype, "screenSpace", {
        set: function (value) {
            this._screenSpace = value;
            if (this._screenSpace) {
                this._resolution.set(this.system.app.graphicsDevice.width, this.system.app.graphicsDevice.height);
            }
            this.resolution = this._resolution; // force update either way
            this.fire('set:screenspace', this._screenSpace);
        },
        get: function () {
            return this._screenSpace;
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

    return {
        ScreenComponent: ScreenComponent
    };
}());

