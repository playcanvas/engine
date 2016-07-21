pc.extend(pc, function () {
    var ScreenComponent = function ScreenComponent (system, entity) {
        this._resolution = new pc.Vec2(640, 320);
        this._screenSpace = false;

        system.app.graphicsDevice.on("resizecanvas", this._onResize, this);
    };
    ScreenComponent = pc.inherits(ScreenComponent, pc.Component);
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

                // new pc.Vec3(p.x - this._resolution.x*s.x/2, p.y - this._resolution.y*s.y/2, p.z),
                // new pc.Vec3(p.x - this._resolution.x*s.x/2, p.y + this._resolution.y*s.y/2, p.z),
                // new pc.Vec3(p.x + this._resolution.x*s.x/2, p.y + this._resolution.y*s.y/2, p.z),
                // new pc.Vec3(p.x + this._resolution.x*s.x/2, p.y - this._resolution.y*s.y/2, p.z)
            ];

            var points = [
                corners[0], corners[1],
                corners[1], corners[2],
                corners[2], corners[3],
                corners[3], corners[0]
            ];

            this.system.app.renderLines(points, new pc.Color(1,1,1));
        },

        _onResize: function (width, height) {
            if (this._screenSpace) {
                this._resolution.set(width, height);
            }
        }
    });

    Object.defineProperty(ScreenComponent.prototype, "resolution", {
        set: function (value) {
            this._resolution.set(value.x, value.y);
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

