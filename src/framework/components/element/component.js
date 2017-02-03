pc.extend(pc, function () {
    pc.ELEMENTTYPE_GROUP = 'group';
    pc.ELEMENTTYPE_IMAGE = 'image';
    pc.ELEMENTTYPE_TEXT = 'text';

    var _warning = false;

    var ElementComponent = function ElementComponent (system, entity) {
        this._anchor = new pc.Vec4();
        this._localAnchor = new pc.Vec4();

        this._pivot = new pc.Vec2();

        this._width = 32;
        this._height = 32;

        this._margin = new pc.Vec4(0,0,-32,-32);

        // the model transform used to render
        this._modelTransform = new pc.Mat4();

        this._screenToWorld = new pc.Mat4();

        // the position of the element in canvas co-ordinate system. (0,0 = top left)
        this._canvasPosition = new pc.Vec2();

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
        _patch: function () {
            this.entity.sync = this._sync;
            this.entity.setPosition = this._setPosition;
        },

        _unpatch: function () {
            this.entity.sync = pc.Entity.prototype.sync;
            this.entity.setPosition = pc.Entity.prototype.setPosition;
        },

        _setPosition: function () {
            var position = new pc.Vec3();
            var invParentWtm = new pc.Mat4();

            return function (x, y, z) {
                if (x instanceof pc.Vec3) {
                    position.copy(x);
                } else {
                    position.set(x, y, z);
                }

                this.getWorldTransform(); // ensure hierarchy is up to date
                invParentWtm.copy(this.element._screenToWorld).invert();
                invParentWtm.transformPoint(position, this.localPosition);

                this.dirtyLocal = true;
            };
        }(),

        // this method overwrites GraphNode#sync and so operates in scope of the Entity.
        _sync: function () {
            var element = this.element;
            var parent = this.element._parent;

            if (this.dirtyLocal) {
                this.localTransform.setTRS(this.localPosition, this.localRotation, this.localScale);

                this.dirtyLocal = false;
                this.dirtyWorld = true;
                this._aabbVer++;
            }

            var resx = 0;
            var resy = 0;
            var screen = element.screen;

            if (element._anchorDirty) {
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
                    resx = resolution.x / screen.screen.scale;
                    resy = resolution.y / screen.screen.scale;
                }
                element._anchorTransform.setTranslate((resx*(element.anchor.x - px)), -(resy * (py-element.anchor.y)), 0);
                element._anchorDirty = false;
                element._calculateLocalAnchors();
            }

            if (element._sizeDirty) {
                this.element._calculateSize();
            }


            if (this.dirtyWorld) {
                if (this._parent === null) {
                    this.worldTransform.copy(this.localTransform);
                } else {
                    // transform element hierarchy
                    if (this._parent.element) {
                        element._screenToWorld.mul2(this._parent.element._modelTransform, element._anchorTransform);
                    } else {
                        element._screenToWorld.copy(element._anchorTransform);
                    }

                    element._modelTransform.mul2(element._screenToWorld, this.localTransform);

                    if (screen) {
                        element._screenToWorld.mul2(screen.screen._screenMatrix, element._screenToWorld);

                        if (!screen.screen.screenSpace) {
                            element._screenToWorld.mul2(screen.worldTransform, element._screenToWorld);
                        }

                        this.worldTransform.mul2(element._screenToWorld, this.localTransform);
                    } else {
                        this.worldTransform.copy(element._modelTransform);
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

            this._calculateSize();
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

                this._calculateLocalAnchors();
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

            var minx = this._localAnchor.x;
            var miny = this._localAnchor.y;
            var maxx = this._localAnchor.z;
            var maxy = this._localAnchor.w;
            var oldWidth = this.width;
            var oldHeight = this.height;
            var px = this.pivot.x;
            var py = this.pivot.y;

            this._calculateSize();

            this.fire('screen:set:resolution', res);
        },

        _onScreenSpaceChange: function () {
            this.entity.dirtyWorld = true;
            this.fire('screen:set:screenspace', this.screen.screen.screenSpace);
        },

        // store pixel positions of anchor relative to current parent resolution
        _calculateLocalAnchors: function () {
            var resx = 1000;
            var resy = 1000;
            var parent = this.entity._parent;
            if (parent && parent.element) {
                resx = parent.element.width;
                resy = parent.element.height;
            } else if (this.screen) {
                var res = this.screen.screen.resolution
                var scale = this.screen.screen.scale;
                resx = res.x / scale;
                resy = res.y / scale;
            }

            this._localAnchor.set(
                this._anchor.x*resx,
                this._anchor.y*resy,
                this._anchor.z*resx,
                this._anchor.w*resy
            );
        },

        // internal - apply offset x,y to local position and find point in world space
        getOffsetPosition: function (x, y) {
            var p = this.entity.getLocalPosition().clone();

            p.x += x;
            p.y += y;

            this._screenToWorld.transformPoint(p, p);

            return p;
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
        },

        // recalculates
        //   localAnchor, width, height, (local position is updated if anchors are split)
        // assumes these properties are up to date
        //   _margin
        _calculateSize: function () {
            // can't calculate if local anchors are wrong
            if (!this.entity._parent && !this.screen) return;

            this._calculateLocalAnchors();

            var anchor = this._anchor.data;
            var p = this.entity.getLocalPosition();

            this._setWidth(this._absRight - this._absLeft);
            this._setHeight(this._absTop - this._absBottom);

            if (anchor[0] !== anchor[2]) {
                p.x = this._margin.data[0] + this._width * this._pivot.data[0];
            }
            if (anchor[1] !== anchor[3]) {
                p.y = this._margin.data[1] + this._height * this._pivot.data[1];
            }

            this.entity.setLocalPosition(p);

            this._sizeDirty = false;
        },

        // internal set width without updating margin
        _setWidth: function (w) {
            this._width = w;

            var i,l;
            var c = this.entity._children;
            for (i = 0, l = c.length; i < l; i++) {
                if (c[i].element) {
                    c[i].element._anchorDirty = true;
                    c[i].element._sizeDirty = true;
                }
            }

            this.fire('set:width', this._width);
            this.fire('resize', this._width, this._height);
        },

        // internal set height without updating margin
        _setHeight: function (h) {
            this._height = h;

            var i,l;
            var c = this.entity._children;
            for (i = 0, l = c.length; i < l; i++) {
                if (c[i].element) {
                    c[i].element._anchorDirty = true;
                    c[i].element._sizeDirty = true;
                }
            }

            this.fire('set:height', this._height);
            this.fire('resize', this._width, this._height);
        }
    });

    Object.defineProperty(ElementComponent.prototype, "type", {
        get: function () {
            return this._type;
        },

        set: function (value) {
            if (value !== this._type) {
                this._type = value;

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

    Object.defineProperty(ElementComponent.prototype, "_absLeft", {
        get: function () {
            return this._localAnchor.data[0] + this._margin.data[0];
        }
    });

    Object.defineProperty(ElementComponent.prototype, "_absRight", {
        get: function () {
            return this._localAnchor.data[2] - this._margin.data[2];
        }
    });

    Object.defineProperty(ElementComponent.prototype, "_absTop", {
        get: function () {
            return this._localAnchor.data[3] - this._margin.data[3];
        }
    });

    Object.defineProperty(ElementComponent.prototype, "_absBottom", {
        get: function () {
            return this._localAnchor.data[1] + this._margin.data[1];
        }
    });

    Object.defineProperty(ElementComponent.prototype, "margin", {
        get: function () {
            return this._margin;
        },

        set: function (value) {
            this._margin.copy(value);
            this._calculateSize();
        }
    });

    Object.defineProperty(ElementComponent.prototype, "left", {
        get: function () {
            return this._margin.data[0];
        },

        set: function (value) {
            this._margin.data[0] = value;
            var p = this.entity.getLocalPosition();
            var wr = this._absRight;
            var wl = this._localAnchor.data[0] + value;
            this._setWidth(wr - wl);

            p.x = value + this._width * this._pivot.data[0];
            this.entity.setLocalPosition(p);
        }
    });

    Object.defineProperty(ElementComponent.prototype, "right", {
        get: function () {
            return this._margin.data[2];
        },

        set: function (value) {
            this._margin.data[2] = value;

            // update width
            var p = this.entity.getLocalPosition();
            var wl = this._absLeft;
            var wr = this._localAnchor.data[2] - value;
            this._setWidth(wr - wl);

            // update position
            p.x = (this._localAnchor.data[2]-this._localAnchor.data[0]) - value - (this._width*(1-this._pivot.data[0]));
            this.entity.setLocalPosition(p);
        }
    });

    Object.defineProperty(ElementComponent.prototype, "top", {
        get: function () {
            return this._margin.data[3];
        },

        set: function (value) {
            this._margin.data[3] = value;
            var p = this.entity.getLocalPosition();
            var wb = this._absBottom;
            var wt = this._localAnchor.data[3] - value;
            this._setHeight(wt-wb);

            p.y = (this._localAnchor.data[3] - this._localAnchor.data[1]) - value - this._height*(1-this._pivot.data[1]);
            this.entity.setLocalPosition(p);
        }
    });

    Object.defineProperty(ElementComponent.prototype, "bottom", {
        get: function () {
            return this._margin.data[1];
        },

        set: function (value) {
            this._margin.data[1] = value;
            var p = this.entity.getLocalPosition();
            var wt = this._absTop;
            var wb = this._localAnchor.data[1] + value;
            this._setHeight(wt-wb);

            p.y = value + this._height*this._pivot.data[1];
            this.entity.setLocalPosition(p);
        }
    });

    Object.defineProperty(ElementComponent.prototype, "width", {
        get: function () {
            return this._width;
        },

        set: function (value) {
            this._width = value;

            var p = this.entity.getLocalPosition();
            var pvt = this.pivot.data;

            // reset margin data
            this._margin.data[0] = p.x - this._width * pvt[0];
            this._margin.data[2] = (this._localAnchor.data[2] - this._localAnchor.data[0]) - this._width - this._margin.data[0]; //this._margin.data[0] + this._width;

            var i,l;
            var c = this.entity._children;
            for (i = 0, l = c.length; i < l; i++) {
                if (c[i].element) {
                    c[i].element._anchorDirty = true;
                    c[i].element._sizeDirty = true;
                }
            }
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

            // reset margin data
            var p = this.entity.getLocalPosition();
            var pvt = this.pivot.data;
            this._margin.data[1] = p.y - this._height * pvt[1];
            this._margin.data[3] = (this._localAnchor.data[3]-this._localAnchor.data[1]) - this._height - this._margin.data[1]; //this._margin.data[1] + this._height;

            var i,l;
            var c = this.entity._children;
            for (i = 0, l = c.length; i < l; i++) {
                if (c[i].element) {
                    c[i].element._anchorDirty = true;
                    c[i].element._sizeDirty = true;
                }
            }

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

            this._calculateLocalAnchors();

            this._anchorDirty = true;
            this.entity.dirtyWorld = true;
            this.fire('set:anchor', this._anchor);
        }
    });

    // return the position of the element in the canvas co-ordinate system
    Object.defineProperty(ElementComponent.prototype, "canvasPosition", {
        get: function () {
            // scale the co-ordinates to be in css pixels
            // then they fit nicely into the screentoworld method
            if (this.screen) {
                var device = this.system.app.graphicsDevice;
                var ratio = device.width / device.canvas.clientWidth;
                var scale = ratio / this.screen.screen.scale;
                this._canvasPosition.set(this._modelTransform.data[12]/scale, -this._modelTransform.data[13]/scale);
            }
            return this._canvasPosition;
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
