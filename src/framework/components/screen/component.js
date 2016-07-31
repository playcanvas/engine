pc.extend(pc, function () {
    var ScreenComponent = function ScreenComponent (system, entity) {
        this._resolution = new pc.Vec2(640, 320);
        this._screenSpace = false;
        this._screenMatrix = new pc.Mat4();

        system.app.graphicsDevice.on("resizecanvas", this._onResize, this);
    };
    ScreenComponent = pc.inherits(ScreenComponent, pc.Component);

    var _transform = new pc.Mat4();

    pc.extend(ScreenComponent.prototype, {
        update: function (dt) {
            var p = this.entity.getPosition();
            var s = this.entity.getLocalScale();
            var r = this.entity.right.clone().scale(this._resolution.x * s.x/2);
            var u = this.entity.up.clone().scale(this._resolution.y * s.y/2);

            var corners = [
                p.clone().sub(r).sub(u),
                p.clone().sub(r).add(u),
                p.clone().add(r).add(u),
                p.clone().add(r).sub(u)
            ];

            var points = [
                corners[0], corners[1],
                corners[1], corners[2],
                corners[2], corners[3],
                corners[3], corners[0]
            ];

            this.system.app.renderLines(points, new pc.Color(1,1,1));
        },

        _calcProjectionMatrix: function () {
            var left;
            var right;
            var bottom;
            var top;
            var near = 1;
            var far = -1;
            var w = this._resolution.x;
            var h = this._resolution.y;

            left = w/2;
            right = -w/2;
            bottom = -h/2;
            top = h/2;

            this._screenMatrix.setOrtho(left, right, bottom, top, near, far);

            if (!this._screenSpace) {
                _transform.setScale(-0.5*w, 0.5*h, 1);
                this._screenMatrix.mul2(_transform, this._screenMatrix);
            }
        },

        _onResize: function (width, height) {
            if (this._screenSpace) {
                this._resolution.set(width, height);
                this._calcProjectionMatrix();
            }
        }
    });

    Object.defineProperty(ScreenComponent.prototype, "resolution", {
        set: function (value) {
            this._resolution.set(value.x, value.y);
            this._calcProjectionMatrix();
        },
        get: function () {
            return this._resolution;
        }
    });

    Object.defineProperty(ScreenComponent.prototype, "screenSpace", {
        set: function (value) {
            this._screenSpace = value;
            if (this._screenSpace) {
                this._resolution.set(this.system.app.graphicsDevice.width, this.system.app.graphicsDevice.height);
                this._calcProjectionMatrix();
            }
        },
        get: function () {
            return this._screenSpace;
        }
    });

    return {
        ScreenComponent: ScreenComponent
    };
}());

