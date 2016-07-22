pc.extend(pc, function () {
    var ElementComponent = function ElementComponent (system, entity) {

        this._anchor = new pc.Vec2();
        this._pivot = new pc.Vec2();

        this.screen = this._getScreen();

        // Element transform - this is the equivalent of "worldTransform" for elements in a screen
        this._transform = new pc.Mat4();

        // used to update screenspace shader
        this._projection2d = new pc.Mat4();

        // override hierarchy sync
        if (this.screen) {
            entity.sync = this._sync;
        }

    };
    ElementComponent = pc.inherits(ElementComponent, pc.Component);


    var _modelMat = new pc.Mat4();
    var _projMat = new pc.Mat4();
    var _transform = new pc.Mat4();

    var _calcMVP = function (worldTransform, w, h, anchor, mvp) {
        _modelMat.copy(worldTransform);

        var left;
        var right;
        var bottom;
        var top;
        var near = 1;
        var far = -1;
        var xscale = -1;
        var yscale = -1;


        var ha = anchor.data[0];
        var va = anchor.data[1];

        left = w/2 + ha*w/2;
        right = -w/2 + ha*w/2;
        bottom = -h/2 + va*h/2;
        top = h/2 + va*h/2;

        _projMat.setOrtho(left, right, bottom, top, near, far);

        _modelMat.data[12] *= xscale;
        _modelMat.data[13] *= yscale;

        mvp.copy(_projMat).mul(_modelMat);

        return mvp;
    };

    pc.extend(ElementComponent.prototype, {
        _getScreen: function () {
            var screen = null;
            var parent = this.entity._parent;
            while(parent && !parent.screen) {
                parent = parent._parent;
            }
            if (parent) return parent;
            return null;
        },

        _sync: function () {
            if (this.dirtyLocal) {
                this.localTransform.setTRS(this.localPosition, this.localRotation, this.localScale);

                this.dirtyLocal = false;
                this.dirtyWorld = true;
                this._aabbVer++;
            }

            if (this.dirtyWorld) {
                if (this._parent === null) {
                    this.worldTransform.copy(this.localTransform);
                } else {
                    // get the screen resolution
                    if (this.element.screen) {
                        var resolution = this.element.screen.screen.resolution;
                    }

                    // transform element hierarchy
                    if (this._parent.element) {
                        this.element._transform.mul2(this._parent.element._transform, this.localTransform);
                    } else {
                        this.element._transform.copy(this.localTransform);
                    }

                    _calcMVP(this.element._transform, resolution.x, resolution.y, this.element.anchor, this.element._projection2d);

                    if (!this.element.screen.screen.screenSpace) {
                        _transform.setScale(-0.5*resolution.x, 0.5*resolution.y, 1);
                        _transform.mul2(this.element.screen.worldTransform, _transform);

                        this.worldTransform.mul2(_transform, this.element._projection2d);
                    }
                }

                this.dirtyWorld = false;
                var child;

                for (var i = 0, len = this._children.length; i < len; i++) {
                    child = this._children[i];
                    child.dirtyWorld = true;
                    child._aabbVer++;

                }
            }
        }
    });

    Object.defineProperty(ElementComponent.prototype, "pivot", {
        get: function () {
            return this._pivot;
        },

        set: function (value) {
            if (value instanceof pc.Vec2) {
                this._pivot.set(value.x, value.y);
            } else {
                this._pivot.set(value[0], value[1]);
            }
        }
    });

    Object.defineProperty(ElementComponent.prototype, "anchor", {
        get: function () {
            return this._anchor;
        },

        set: function (value) {
            if (value instanceof pc.Vec2) {
                this._anchor.set(value.x, value.y);
            } else {
                this._anchor.set(value[0], value[1]);
            }
        }
    });

    return {
        ElementComponent: ElementComponent
    };
}());

