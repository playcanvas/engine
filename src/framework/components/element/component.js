pc.extend(pc, function () {
    var ElementComponent = function ElementComponent (system, entity) {

        this._anchor = new pc.Vec4();
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
        entity.sync = this._sync;
    };
    ElementComponent = pc.inherits(ElementComponent, pc.Component);


    pc.extend(ElementComponent.prototype, {
        _onInsert: function (parent) {
            // when the entity is reparented find a possible new screen
            this._findScreen();
            if (this.screen) {
                this.entity.sync = this._sync;

                // calculate draw order
                this.screen.screen.syncDrawOrder();
            }
        },

        _findScreen: function () {
            var screen = this.entity._parent;
            while(screen && !screen.screen) {
                screen = screen._parent;
            }

            if (this.screen && this.screen !== screen) {
                this.screen.screen.off('set:resolution', this._onScreenResize, this);
                this.screen.screen.off('set:screenspace', this._onScreenSpaceChange, this);
            }

            this.screen = screen;
            if (this.screen) {
                this.screen.screen.on('set:resolution', this._onScreenResize, this);
                this.screen.screen.on('set:screenspace', this._onScreenSpaceChange, this);

                this.fire('set:screen', this.screen);
            }
        },

        _onScreenResize: function (res) {
            this._anchorDirty = true;
            this.entity.dirtyWorld = true;

            var minx = this._anchor.x;
            var miny = this._anchor.y;
            var maxx = this._anchor.z;
            var maxy = this._anchor.w;

            if (minx) {

            }

            // this.left = -100;
            // this.right = -100;
            // this.top = -100;
            // this.bottom = -100;

            // var dx = (maxx-minx);
            // if (dx > 0) {
            //     this.width = res.x*dx;
            // }
            // var dy = (maxy-miny);
            // if (dy > 0) {
            //     this.height = res.y*dy;
            // }

            // var p = this.entity.getLocalPosition();
            // if (dx > 0) p.x = -res.x*dx*this.pivot.x;
            // if (dy > 0) p.y = -res.y*dy*this.pivot.y;
            // this.entity.setLocalPosition(p);

            this.fire('screen:set:resolution', res);
        },

        _onScreenSpaceChange: function () {
            this.entity.dirtyWorld = true;
            this.fire('screen:set:screenspace', this.screen.screen.screenSpace);
        },

        _sync: function () {
            if (this.dirtyLocal) {
                this.localTransform.setTRS(this.localPosition, this.localRotation, this.localScale);

                this.dirtyLocal = false;
                this.dirtyWorld = true;
                this._aabbVer++;
            }

            var resx = 0;
            var resy = 0;
            var screen = this.element.screen;

            if (this.element._anchorDirty) {
                var px = 0;
                var py = 0;
                if (this._parent && this._parent.element) {
                    // use parent rect
                    resx = this._parent.element.width;
                    resy = this._parent.element.height;
                    px = this._parent.element.pivot.x - 0.5;
                    py = this._parent.element.pivot.y - 0.5;
                } else if (screen) {
                    // use screen rect
                    var resolution = screen.screen.resolution;
                    resx = resolution.x;
                    resy = resolution.y;
                }
                this.element._anchorTransform.setTranslate(-(resx*(this.element.anchor.x-px-0.5)), -(resy * (this.element.anchor.y-py-0.5)), 0);
                this.element._anchorDirty = false;
            }

            if (this.dirtyWorld) {
                if (this._parent === null) {
                    this.worldTransform.copy(this.localTransform);
                } else {
                    // transform element hierarchy
                    if (this._parent.element) {
                        this.element._worldTransform.mul2(this.element._anchorTransform, this.localTransform);
                        this.element._worldTransform.copy(this.localTransform);
                        this.element._worldTransform.mul2(this._parent.element._worldTransform, this.element._worldTransform);
                    } else {
                        this.element._worldTransform.mul2(this.element._anchorTransform, this.localTransform);
                        this.element._worldTransform.copy(this.localTransform);
                    }

                    if (screen) {
                        this.element._modelTransform.mul2(screen.screen._screenMatrix, this.element._worldTransform);

                        if (!screen.screen.screenSpace) {
                            this.worldTransform.mul2(screen.worldTransform, this.element._modelTransform);
                        } else {
                            this.worldTransform.copy(this.element._modelTransform);
                        }
                    } else {
                        this.worldTransform.copy(this.element._worldTransform);
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

    Object.defineProperty(ElementComponent.prototype, "drawOrder", {
        get: function () {
            return this._drawOrder;
        },

        set: function (value) {
            this._drawOrder = value;
            this.fire('set:draworder', this._drawOrder);
        }
    });

    Object.defineProperty(ElementComponent.prototype, "left", {
        get: function () {
            var p = this.entity.getLocalPosition();
            var px = this.pivot.x;
            var resx = this.screen.screen.resolution.x;

            return p.x + resx*this._anchor.x + px*this.width;
        },

        set: function (value) {
            var p = this.entity.getLocalPosition();
            var resx = this.screen.screen.resolution.x;

            if (this._anchor.x === this._anchor.z) {
                p.x = value - this.pivot.x*this.width;
            } else {
                var diff = this.left - value;
                this.width += diff;
                p.x = this.pivot.x*this.width;
            }
            this.entity.setLocalPosition(p);

            // this.fire('set:left', this._width);
            // this.fire('resize', this._width, this._height);
        }
    });

    Object.defineProperty(ElementComponent.prototype, "right", {
        get: function () {
            var p = this.entity.getLocalPosition();
            var px = this.pivot.x;
            var resx = this.screen.screen.resolution.x;

            return p.x + resx*this._anchor.z - px*this.width;
        },

        set: function (value) {
            var p = this.entity.getLocalPosition();
            var resx = this.screen.screen.resolution.x;

            var diff = this.right - value;
            this.width += diff;

            p.x = resx*this._anchor.z - this.pivot.x*this.width;
            this.entity.setLocalPosition(p);
            // this.fire('set:left', this._width);
            // this.fire('resize', this._width, this._height);
        }
    });

    Object.defineProperty(ElementComponent.prototype, "top", {
        get: function () {
            var p = this.entity.getLocalPosition();
            return p.y - this.pivot.y*this.height;
        },

        set: function (value) {
            var p = this.entity.getLocalPosition();
            p.y = value - this.pivot.y*this.height;
            this.entity.setLocalPosition(p);

            // this.fire('set:left', this._width);
            // this.fire('resize', this._width, this._height);
        }
    });

    Object.defineProperty(ElementComponent.prototype, "bottom", {
        get: function () {
            var p = this.entity.getLocalPosition();
            return p.y + this.pivot.y*this.height;
        },

        set: function (value) {
            var p = this.entity.getLocalPosition();
            p.y = value + this.pivot.y*this.height;
            this.entity.setLocalPosition(p);

            // this.fire('set:left', this._width);
            // this.fire('resize', this._width, this._height);
        }
    });

    Object.defineProperty(ElementComponent.prototype, "width", {
        get: function () {
            return this._width;
        },

        set: function (value) {
            this._width = value;
            this.fire('set:width', this._width);
            this.fire('resize', this._width, this._height);
        }
    });

    Object.defineProperty(ElementComponent.prototype, "height", {
        get: function () {
            return this._height;
        },

        set: function (value) {
            this._height = value;
            this.fire('set:height', this._height);
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
            this.fire('set:pivot', this._pivot);
        }
    });

    Object.defineProperty(ElementComponent.prototype, "anchor", {
        get: function () {
            return this._anchor;
        },

        set: function (value) {
            if (value instanceof pc.Vec4) {
                this._anchor.set(value.x, value.y, value.z, value.w);
            } else {
                this._anchor.set(value[0], value[1], value[2], value[3]);
            }
            this._anchorDirty = true;
            this.fire('set:anchor', this._anchor);
        }
    });

    return {
        ElementComponent: ElementComponent
    };
}());

