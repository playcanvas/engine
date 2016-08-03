pc.extend(pc, function () {
    var ElementComponent = function ElementComponent (system, entity) {

        this._anchor = new pc.Vec2();
        this._pivot = new pc.Vec2();

        this._width = 32;
        this._height = 32;

        // the world transform in the 2D space
        this._worldTransform = new pc.Mat4();
        // the model transform used to render
        this._modelTransform = new pc.Mat4();
        // transform that updates local position according to anchor values
        this._anchorTransform = new pc.Mat4();

        this._anchorDirty = true;

        this.entity.on('insert', this._onInsert, this);

        this.screen = null;

        this._findScreen();
        if (this.screen) {
            entity.sync = this._sync;
        }

    };
    ElementComponent = pc.inherits(ElementComponent, pc.Component);


    pc.extend(ElementComponent.prototype, {
        _onInsert: function (parent) {
            // when the entity is reparented find a possible new screen
            this._findScreen();
            if (this.screen) {
                this.entity.sync = this._sync;
            }
        },

        _findScreen: function () {
            var screen = this.entity._parent;
            while(screen && !screen.screen) {
                screen = screen._parent;
            }

            if (this.screen && this.screen !== screen) {
                this.screen.screen.off('projectionchange', this._onScreenResize, this);
                this.screen.screen.off('change:screenspace', this._onScreenSpaceChange, this);
            }

            this.screen = screen;
            if (this.screen) {
                this.screen.screen.on('projectionchange', this._onScreenResize, this);
                this.screen.screen.on('change:screenspace', this._onScreenSpaceChange, this);

                this.fire('change:screen', this.screen);
            }
        },

        _onScreenResize: function () {
            this._anchorDirty = true;
            this.entity.dirtyWorld = true;
        },

        _onScreenSpaceChange: function () {
            this.entity.dirtyWorld = true;
            this.fire('screenspacechange', this.screen.screen.screenSpace);
        },

        _sync: function () {
            if (this.dirtyLocal) {
                this.localTransform.setTRS(this.localPosition, this.localRotation, this.localScale);

                this.dirtyLocal = false;
                this.dirtyWorld = true;
                this._aabbVer++;
            }

            var resx, rexy;
            var screen = this.element.screen;

            if (this.element._anchorDirty && screen) {
                var px = 0;
                var py = 0;
                if (this._parent && this._parent.element) {
                    // use parent rect
                    resx = this._parent.element.width;
                    resy = this._parent.element.height;
                    px = this._parent.element.pivot.x;
                    py = this._parent.element.pivot.y;
                } else {
                    // use screen rect
                    var resolution = this.element.screen.screen.resolution;
                    resx = resolution.x;
                    resy = resolution.y;
                }
                this.element._anchorTransform.setTranslate(-(resx * (this.element.anchor.x - px) / 2), -(resy * (this.element.anchor.y - py) / 2), 0);
                this.element._anchorDirty = false;
            }

            if (this.dirtyWorld) {
                if (this._parent === null) {
                    this.worldTransform.copy(this.localTransform);
                } else {
                    if (screen) {
                        var screenMat = screen.screen._screenMatrix;
                    }

                    // transform element hierarchy
                    if (this._parent.element) {
                        this.element._worldTransform.mul2(this.element._anchorTransform, this.localTransform);
                        this.element._worldTransform.mul2(this._parent.element._worldTransform, this.element._worldTransform);
                    } else {
                        this.element._worldTransform.mul2(this.element._anchorTransform, this.localTransform);
                    }

                    this.element._modelTransform.mul2(screenMat, this.element._worldTransform);

                    if (!screen.screen.screenSpace) {
                        this.worldTransform.mul2(screen.worldTransform, this.element._modelTransform);
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
            this.fire('resize', this._width, this._height);
        }
    });

    Object.defineProperty(ElementComponent.prototype, "height", {
        get: function () {
            return this._height;
        },

        set: function (value) {
            this._height = value;
            this.fire('resize', this._width, this._height);
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

