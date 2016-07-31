pc.extend(pc, function () {
    var ElementComponent = function ElementComponent (system, entity) {

        this._anchor = new pc.Vec2();
        this._pivot = new pc.Vec2();

        this._width = 32;
        this._height = 32;

        this.screen = this._getScreen();

        // the world transform in the 2D space
        this._worldTransform = new pc.Mat4();
        // the model transform used to render
        this._modelTransform = new pc.Mat4();

        // override hierarchy sync
        if (this.screen) {
            entity.sync = this._sync;
        }

    };
    ElementComponent = pc.inherits(ElementComponent, pc.Component);


    // var _modelMat = new pc.Mat4();
    // var _projMat = new pc.Mat4();
    // var _transform = new pc.Mat4();

    // var _calcMVP = function (worldTransform, w, h, anchor, mvp) {
    //     _modelMat.copy(worldTransform);

    //     var left;
    //     var right;
    //     var bottom;
    //     var top;
    //     var near = 1;
    //     var far = -1;
    //     // var xscale = -1;
    //     // var yscale = -1;


    //     var ha = anchor.data[0];
    //     var va = anchor.data[1];

    //     left = w/2 + ha*w/2;
    //     right = -w/2 + ha*w/2;
    //     bottom = -h/2 + va*h/2;
    //     top = h/2 + va*h/2;

    //     _projMat.setOrtho(left, right, bottom, top, near, far);

    //     // _modelMat.data[12] *= xscale;
    //     // _modelMat.data[13] *= yscale;

    //     mvp.copy(_projMat).mul(_modelMat);

    //     return mvp;
    // };

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
                        var screenMat = this.element.screen.screen._screenMatrix;
                    }

                    // transform element hierarchy
                    if (this._parent.element) {
                        this.element._worldTransform.mul2(this._parent.element._worldTransform, this.localTransform);
                    } else {
                        this.element._worldTransform.copy(this.localTransform);
                    }

                    // translate for anchor
                    this.element._modelTransform.copy(this.element._worldTransform);
                    this.element._modelTransform.data[12] -= (resolution.x * this.element.anchor.x / 2);
                    this.element._modelTransform.data[13] -= (resolution.y * this.element.anchor.y / 2);
                    this.element._modelTransform.mul2(screenMat, this.element._modelTransform);

                    if (!this.element.screen.screen.screenSpace) {
                        this.worldTransform.mul2(this.element.screen.worldTransform, this.element._modelTransform);
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

    Object.defineProperty(ElementComponent.prototype, "width", {
        get: function () {
            return this._width;
        },

        set: function (value) {
            this._width = value;
        }
    });

    Object.defineProperty(ElementComponent.prototype, "height", {
        get: function () {
            return this._height;
        },

        set: function (value) {
            this._height = value;
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

