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
        // transform that updates local position according to anchor values
        this._anchorTransform = new pc.Mat4();

        this._anchorDirty = true;

        // override hierarchy sync
        if (this.screen) {
            entity.sync = this._sync;
        }

    };
    ElementComponent = pc.inherits(ElementComponent, pc.Component);


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
                    var resx, rexy;
                    // get the screen resolution
                    if (this.element.screen) {
                        var screenMat = this.element.screen.screen._screenMatrix;

                        if (this.element._anchorDirty) {
                            if (this._parent.element) {
                                // use parent rect
                                resx = this._parent.element.width;
                                resy = this._parent.element.height;
                            } else {
                                // use screen rect
                                var resolution = this.element.screen.screen.resolution;
                                resx = resolution.x;
                                resy = resolution.y;
                            }
                            this.element._anchorTransform.setTranslate(-(resx * this.element.anchor.x / 2), -(resy * this.element.anchor.y / 2), 0);
                            this.element._anchorDirty = false;
                        }
                    }

                    // transform element hierarchy
                    if (this._parent.element) {
                        this.element._worldTransform.mul2(this.element._anchorTransform, this.localTransform);
                        this.element._worldTransform.mul2(this._parent.element._worldTransform, this.element._worldTransform);
                    } else {
                        this.element._worldTransform.mul2(this.element._anchorTransform, this.localTransform);
                    }

                    this.element._modelTransform.mul2(screenMat, this.element._worldTransform);

                    if (!this.element.screen.screen.screenSpace) {
                        this.worldTransform.mul2(this.element.screen.worldTransform, this.element._modelTransform);
                    } else {
                        this.worldTransform.copy(this.element._modelTransform);
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
            this._anchorDirty = true;
        }
    });

    return {
        ElementComponent: ElementComponent
    };
}());

