pc.extend(pc, function () {
    pc.ELEMENTTYPE_GROUP = 'group';
    pc.ELEMENTTYPE_IMAGE = 'image';
    pc.ELEMENTTYPE_TEXT = 'text';

    var _warning = false;

    var ElementComponent = function ElementComponent (system, entity) {
        this._anchor = new pc.Vec4();
        this._worldAnchor = new pc.Vec4();

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

        this._type = pc.ELEMENTTYPE_GROUP;

        // element types
        this._image = null;
        this._text = null;
        this._group = null;

        if (!_warning) {
            console.warn("Message from PlayCanvas: The element component is currently in Beta. APIs may change without notice.");
            _warning = true;
        }
    };
    ElementComponent = pc.inherits(ElementComponent, pc.Component);


    pc.extend(ElementComponent.prototype, {
        // internal used to get the element world transform
        // and ensure it is synced before returning
        _getWorldTransform: function () {
            var syncList = [];

            return function () {
                var current = this.entity;
                syncList.length = 0;

                while (current !== null) {
                    syncList.push(current);
                    current = current._parent;
                }

                for (var i = syncList.length - 1; i >= 0; i--) {
                    syncList[i].sync();
                }

                return this._worldTransform;
            };
        }(),

        _patch: function () {
            this.entity.sync = this._sync;
            this.entity.setPosition = this._setPosition;
            this.entity.getPosition = this._getPosition;
            this.entity.getRotation = this._getRotation;
        },

        _unpatch: function () {
            this.entity.sync = pc.Entity.prototype.sync;
            this.entity.setPosition = pc.Entity.prototype.setPosition;
            this.entity.getPosition = pc.Entity.prototype.getPosition;
            this.entity.getRotation = pc.Entity.prototype.getRotation;
        },

        _getPosition: function () {
            this.element._getWorldTransform().getTranslation(this.position);
            return this.position;
        },

        _setPosition: function () {
            var position = new pc.Vec3();
            var invParentWtm = new pc.Mat4();

            return function () {
                if (arguments.length === 1) {
                    position.copy(arguments[0]);
                } else {
                    position.set(arguments[0], arguments[1], arguments[2]);
                }

                if (this._parent === null || this._parent && !this._parent.element) {
                    this.localPosition.copy(position);
                } else {
                    invParentWtm.copy(this._parent.element._getWorldTransform()).invert();
                    invParentWtm.transformPoint(position, this.localPosition);
                }
                this.dirtyLocal = true;
            };
        }(),

        _getRotation: function () {
            this.rotation.setFromMat4(this.element._getWorldTransform());
            return this.rotation;
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
                var py = 1;
                if (this._parent && this._parent.element) {
                    // use parent rect
                    resx = this._parent.element.width;
                    resy = this._parent.element.height;
                    px = this._parent.element.pivot.x;
                    py = this._parent.element.pivot.y;
                } else if (screen) {
                    // use screen rect
                    var resolution = screen.screen.resolution;
                    resx = resolution.x * screen.screen.scale;
                    resy = resolution.y * screen.screen.scale;
                }
                this.element._anchorTransform.setTranslate((resx*(this.element.anchor.x - px)), -(resy * (py-this.element.anchor.y)), 0);
                this.element._anchorDirty = false;
            }

            if (this.dirtyWorld) {
                if (this._parent === null) {
                    this.worldTransform.copy(this.localTransform);
                } else {
                    // transform element hierarchy
                    if (this._parent.element) {
                        this.element._worldTransform.mul2(this._parent.element._worldTransform, this.localTransform);

                        this.element._modelTransform.mul2(this.element._anchorTransform, this.localTransform);
                        this.element._modelTransform.mul2(this._parent.element._modelTransform, this.element._modelTransform);
                        // this.element._worldTransform.mul2(this.element._anchorTransform, this.localTransform);
                        // this.element._worldTransform.mul2(this._parent.element._worldTransform, this.element._worldTransform);
                    } else {
                        this.element._worldTransform.copy(this.localTransform);
                        this.element._modelTransform.mul2(this.element._anchorTransform, this.localTransform);

                        // this.element._worldTransform.mul2(this.element._anchorTransform, this.localTransform);
                    }

                    if (screen) {
                        this.worldTransform.mul2(screen.screen._screenMatrix, this.element._modelTransform);
                        // this.element._modelTransform.mul2(screen.screen._screenMatrix, this.element._worldTransform);


                        if (!screen.screen.screenSpace) {
                            this.worldTransform.mul2(screen.worldTransform, this.worldTransform);
                            // this.worldTransform.mul2(screen.worldTransform, this.element._modelTransform);
                        } else {
                            // this.worldTransform.copy(this.element._modelTransform);
                        }
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
        },

        _onInsert: function (parent) {
            // when the entity is reparented find a possible new screen
            var screen = this._findScreen();
            this._updateScreen(screen);
        },

        _updateScreen: function (screen) {
            if (this.screen && this.screen !== screen) {
                this.screen.screen.off('set:resolution', this._onScreenResize, this);
                this.screen.screen.off('set:referenceresolution', this._onScreenResize, this);
                this.screen.screen.off('set:scaleblend', this._onScreenResize, this);
                this.screen.screen.off('set:screenspace', this._onScreenSpaceChange, this);
            }

            this.screen = screen;
            if (this.screen) {
                this.screen.screen.on('set:resolution', this._onScreenResize, this);
                this.screen.screen.on('set:referenceresolution', this._onScreenResize, this);
                this.screen.screen.on('set:scaleblend', this._onScreenResize, this);
                this.screen.screen.on('set:screenspace', this._onScreenSpaceChange, this);

                this._setAnchors();
                this._patch();
            } else {
                this._unpatch();
            }

            this.fire('set:screen', this.screen);

            this._anchorDirty = true;
            this.entity.dirtyWorld = true;

            // update all child screens
            var children = this.entity.getChildren();
            for (var i = 0, l = children.length; i < l; i++) {
                if (children[i].element) children[i].element._updateScreen(screen);
            }

            // calculate draw order
            if (this.screen) this.screen.screen.syncDrawOrder();
        },

        _findScreen: function () {
            var screen = this.entity._parent;
            while(screen && !screen.screen) {
                screen = screen._parent;
            }
            return screen;
        },

        _onScreenResize: function (res) {
            this._anchorDirty = true;
            this.entity.dirtyWorld = true;

            var minx = this._worldAnchor.x;
            var miny = this._worldAnchor.y;
            var maxx = this._worldAnchor.z;
            var maxy = this._worldAnchor.w;
            var oldWidth = this.width;
            var oldHeight = this.height;
            var px = this.pivot.x;
            var py = this.pivot.y;

            this._setAnchors();

            var p = this.entity.getLocalPosition();

            // calculate new width
            var l = minx + p.x - this.pivot.x * this.width;
            var r = minx + p.x + (1 - this.pivot.x) * this.width;
            var ldist = l - minx;
            var rdist = r - maxx;
            var newl = this._worldAnchor.x + ldist;
            var newr = this._worldAnchor.z + rdist;
            var newleft = newl - this._worldAnchor.x;
            var newright = newr - this._worldAnchor.x;
            this.width = newright - newleft;

            // calculate new height
            var b = miny + p.y - (1 - this.pivot.y) * this.height;
            var t = miny + p.y + this.pivot.y*this.height;
            var bdist = b - miny;
            var tdist = t - maxy;
            var newb = this._worldAnchor.y + bdist;
            var newt = this._worldAnchor.w + tdist;
            var newbottom = newb - this._worldAnchor.y;
            var newtop = newt - this._worldAnchor.y;
            this.height = newtop - newbottom;

            // shift position based on pivot
            p.x = p.x - px*oldWidth + px*this.width;
            p.y = p.y - py*oldHeight + py*this.height;
            this.entity.setLocalPosition(p);

            this.fire('screen:set:resolution', res);
        },

        _onScreenSpaceChange: function () {
            this.entity.dirtyWorld = true;
            this.fire('screen:set:screenspace', this.screen.screen.screenSpace);
        },

        // override regular entity.sync method with this one


        // store pixel positions of anchor relative to current parent resolution
        _setAnchors: function () {
            var resx = 0;
            var resy = 0;
            if (this._parent && this._parent.element) {
                resx = this._parent.element.width;
                resy = this._parent.element.height;
            } else if (this.screen) {
                var res = this.screen.screen.resolution
                resx = res.x;
                resy = res.y;
            }

            this._worldAnchor.set(
                this._anchor.x*resx,
                this._anchor.y*resy,
                this._anchor.z*resx,
                this._anchor.w*resy
            );
        },

        onEnable: function () {
            ElementComponent._super.onEnable.call(this);
            if (this._image) this._image.onEnable();
            if (this._text) this._text.onEnable();
            if (this._group) this._group.onEnable();
        },

        onDisable: function () {
            ElementComponent._super.onDisable.call(this);
            if (this._image) this._image.onDisable();
            if (this._text) this._text.onDisable();
            if (this._group) this._group.onDisable();
        },

        onRemove: function () {
            this._unpatch();
            if (this._image) this._image.destroy();
            if (this._text) this._text.destroy();
        }
    });

    Object.defineProperty(ElementComponent.prototype, "type", {
        get: function () {
            return this._type;
        },

        set: function (value) {
            if (value !== this._type) {
                if (this._image) {
                    this._image.destroy();
                    this._image = null;
                }
                if (this._text) {
                    this._text.destroy();
                    this._text = null;
                }

                if (value === pc.ELEMENTTYPE_IMAGE) {
                    this._image = new pc.ImageElement(this);
                } else if (value === pc.ELEMENTTYPE_TEXT) {
                    this._text = new pc.TextElement(this);
                }

            }
            this._type = value;
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

    // Object.defineProperty(ElementComponent.prototype, "left", {
    //     get: function () {
    //         var p = this.entity.getLocalPosition();
    //         return p.x - this.pivot.x * this.width;
    //     },

    //     set: function (value) {
    //         var change = value - this.left;
    //         this.width = this.right - value;
    //         this.entity.translateLocal(change/2,0,0);

    //         // this.fire('set:left', this._width);
    //         // this.fire('resize', this._width, this._height);
    //     }
    // });

    // Object.defineProperty(ElementComponent.prototype, "right", {
    //     get: function () {
    //         var p = this.entity.getLocalPosition();

    //         return p.x + (1 - this.pivot.x) * this.width;
    //     },

    //     set: function (value) {
    //         var change = value - this.right;
    //         this.width = value - this.left;
    //         this.entity.translateLocal(change/2, 0, 0);
    //         // this.fire('set:left', this._width);
    //         // this.fire('resize', this._width, this._height);
    //     }
    // });

    // Object.defineProperty(ElementComponent.prototype, "top", {
    //     get: function () {
    //         var p = this.entity.getLocalPosition();
    //         return p.y + this.pivot.y*this.height;
    //     },

    //     set: function (value) {
    //         var change = value - this.top;
    //         this.height = value - this.bottom;
    //         this.entity.translateLocal(0, change/2, 0);
    //         // this.fire('set:left', this._width);
    //         // this.fire('resize', this._width, this._height);
    //     }
    // });

    // Object.defineProperty(ElementComponent.prototype, "bottom", {
    //     get: function () {
    //         var p = this.entity.getLocalPosition();
    //         return p.y - (1 - this.pivot.y) * this.height;
    //     },

    //     set: function (value) {
    //         var change = value - this.bottom;
    //         this.height = this.top - value;
    //         this.entity.translateLocal(0, change/2, 0);
    //         // this.fire('set:left', this._width);
    //         // this.fire('resize', this._width, this._height);
    //     }
    // });

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

            this._onScreenResize();
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

            this._setAnchors();

            this._anchorDirty = true;
            this.entity.dirtyWorld = true;
            this.fire('set:anchor', this._anchor);
        }
    });

    var _define = function (name) {
        Object.defineProperty(ElementComponent.prototype, name, {
            get: function () {
                if (this._text) {
                    return this._text[name];
                } else if (this._image) {
                    return this._image[name];
                } else {
                    return null;
                }
            },
            set: function (value) {
                if (this._text) {
                    this._text[name] = value;
                } else if (this._image) {
                    this._image[name] = value;
                }
            }
        })
    };

    _define("fontSize");
    _define("color");
    _define("font");
    _define("fontAsset");
    _define("spacing");
    _define("lineHeight");

    _define("text");
    _define("texture");
    _define("textureAsset");
    _define("material");
    _define("materialAsset");
    _define("opacity");
    _define("rect");

    return {
        ElementComponent: ElementComponent
    };
}());

