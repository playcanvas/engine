pc.extend(pc, function () {
    pc.ELEMENTTYPE_GROUP    = 'group';
    pc.ELEMENTTYPE_IMAGE    = 'image';
    pc.ELEMENTTYPE_TEXT     = 'text';

    var _warning = false;

    /**
     * @component
     * @name pc.ElementComponent
     * @description Create a new ElementComponent
     * @class Allows an entity to participate in UI element hierarchy. Attaching this component to an entity makes it compute its
     * world transform using UI layout rules. The key principle of the UI layout is that every element has its own coordinate space
     * represented by a box with a specific width and height. The values for width and height are computed based on his parent's
     * dimensions using the concept of anchors and corners. Anchors specify the minimum and maximum offsets with parent's box, while
     * corners specify the offsets of element's corners from the anchors. This allows the elements to respond to screen size changes
     * in dynamic manner without any additional code.
     * The elements also have a notion of local transformation, which can be modified using standard methods, like rotateLocal and
     * translateLocal. When the local transform of an entity with an element is non-identity, it's always computed after anchors and
     * corners computation and happen around the pivot point – the point that lies within the current element (as opposed to anchors, 
     * which are in parent's coordinate system). This allows to perform rotations and other transformations around some specific point
     * of an element, for instance, lower right corner.
     * The elements can also have a module attached, i.e. text module, which allows to text output.
     * @param {pc.ElementComponentSystem} system The ComponentSystem that created this Component
     * @param {pc.Entity} entity The Entity this Component is attached to
     * @extends pc.Component
     * @property {String} type Type of the element extension to attach.
     * @property {pc.Color} debugColor Color of the debug outline.
     * @property {pc.Vec4} corners Corner offsets from anchor points.
     * @property {Number} drawOrder Drawing priority of the element.
     * @property {Number} width Effective width of the element.
     * @property {Number} height Effective height of the element.
     * @property {Number} left Left side offset from left anchor line.
     * @property {Number} right Right side offset from right anchor line.
     * @property {Number} top Top side offset from top anchor line.
     * @property {Number} bottom Bottom side offset from bottom anchor line.
     * @property {pc.Vec2} pivot Pivot point location.
     * @property {pc.Vec4} anchor Anchor location.
     */

    var ElementComponent = function ElementComponent (system, entity) {
        this._anchor = new pc.Vec4();
        this._worldAnchor = new pc.Vec4();

        this._pivot = new pc.Vec2(0.5, 0.5);

        this._debugColor = null;

        // default stencil layer of the element
        this._stencilLayer = 255;
        this._masksChildren = false;

        // corner offsets in relation to anchors
        this._corners = new pc.Vec4(0, 0, 0, 0);

        // the model transform used to render
        this._modelTransform = new pc.Mat4();
        // parent-to-local transform (like regular localTransform, but with anchors and stuff)
        this._localModelTransform = new pc.Mat4();

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
        
        // Prepares stencil params for the inner components to be utilized during
        // rendering. To keep things the least obtrusive way, it assumes the default stencil
        // buffer value is 0, meaning the topmost mask (mind masking elements can be nested 
        // into each other) should fill the buffer with a const using GREATEREQUAL function,
        // while children should be drawn with smaller ref value and LESSEQUAL function.
        _getStencilParameters: function() {
            return new pc.StencilParameters({
                // if stencil layer is 255 it means we are the topmost mask in the heirarchy.
                // and as default camera stencil clearing value is 0, it's better to not change
                // it and work on top of it
                func:  this._stencilLayer == 255 ? pc.FUNC_GREATEREQUAL : pc.FUNC_LESSEQUAL,
                ref:   this._stencilLayer,
                mask:  0xFF,
                zfail: pc.STENCILOP_KEEP,
                zpass: pc.STENCILOP_REPLACE,
                fail:  pc.STENCILOP_KEEP
            });
        },

        // Updates children's stencil parameters to current value - 1 (if applyMask = true)
        // or removes it. Effectively enables children to be masked by this element or
        // removes this settings.
        //
        _setMasksChildren: function(applyMask) {
            this._masksChildren = applyMask;
            var childStencilLayer = this._masksChildren ? (this._stencilLayer - 1) : this._stencilLayer;

            var children = this.entity.getChildren();
            for (var i = 0; i < children.length; i++) {
                var element = children[i].element;

                if (element) {
                    element._stencilLayer = childStencilLayer;
                    element._setMasksChildren( element._masksChildren );
                }
            }

            this.fire("set:stencillayer", this._stencilLayer);
        },
 
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
            if (this.dirtyLocal) {
                this.localTransform.setTRS(this.localPosition, this.localRotation, this.localScale);

                this.dirtyLocal = false;
                this.dirtyWorld = true;
                this._aabbVer++;
            }

            var screen = this.element.screen;
            var rect = null;

            if (this._parent && this._parent.element) {
                rect = new pc.Vec4(
                    this._parent.element._width  * this.element._anchor.x + this.element._corners.x,
                    this._parent.element._height * this.element._anchor.y + this.element._corners.y,
                    this._parent.element._width  * this.element._anchor.z + this.element._corners.z,
                    this._parent.element._height * this.element._anchor.w + this.element._corners.w
                );
            } else if (screen) {
                resolution = new pc.Vec2( screen.screen._width, screen.screen._height );

                rect = new pc.Vec4(
                    resolution.x * this.element._anchor.x + this.element._corners.x,
                    resolution.y * this.element._anchor.y + this.element._corners.y,
                    resolution.x * this.element._anchor.z + this.element._corners.z,
                    resolution.y * this.element._anchor.w + this.element._corners.w
                );
            }

            if (!rect) {
                return;
            }

            this.element._width = rect.z - rect.x;
            this.element._height = rect.w - rect.y;

            // the rect is going to be Vec4 storing the following values:
            // [ left offset, bottom offset, right offset, top offset ]
            if (this.element._anchorDirty || this.element._cornerDirty) {               
                this.element._anchorTransform.setTranslate(rect.x, rect.y, 0);
                this.element._anchorDirty = false;
            }

            if (this.dirtyWorld) {
                // before recomputing the transforms let's agree on a few matrices used below:
                //
                //    * world: it's either clip box of the WebGL (for screen and camera screen types) OR
                //             real world box (for world screen type).
                //             basically, the "ouput" coords sans local transforms of the element
                //    * _screenToWorld: transforms screen point to the "world" point
                //    * _modelTransform: transforms screen point further down the heirarchy
                //    * localTransform: this is normal entity transforms (local, of course)
                //    * _anchorTransform: just the offset to satisfy anchoring settings (the offset of lower left corner)
                //    * toPivotTransform: just the offset to pivot point of the element
                //
                if (this._parent === null) {
                    // no parent? _screenToWorld is basically the local transform
                    this.element._screenToWorld.copy(this.localTransform);
                } else {
                    // ok, we have a parent. does it own an element?
                    // TODO: lookup up to the scene root would be more correct – what if there is a blank 
                    //       object between two elements?
                    if (this._parent.element) {
                        // our _screenToWorld starts off by offsetting current transform (which is parent's) by
                        // anchor offset – like we move the box to match the anchor settings first
                        this.element._screenToWorld.mul2(this._parent.element._modelTransform, this.element._anchorTransform);
                    } else {
                        // no element means we start with plain anchoring transform
                        this.element._screenToWorld.copy(this.element._anchorTransform);
                    }

                    // let's compute the pivot point – remember it's local to element coord space
                    var pivotPoint          = new pc.Vec3( this.element._width * this.element.pivot.x, this.element._height * this.element.pivot.y, 0 );
                    // and compose a transform to move TO the pivot – as all local transformations,
                    // i.e. rotation should happen around the pivot
                    var toPivotTransform    = new pc.Mat4().setTRS( pivotPoint, pc.Quat.IDENTITY, pc.Vec3.ONE );
                    var fromPivotTransform  = toPivotTransform.clone().invert();

                    // we will maintain parent-to-local transform for optimization purposes as well
                    this.element._localModelTransform.copy(this.element._anchorTransform);
                    // ... then we move onto pivot point
                    this.element._localModelTransform.mul( toPivotTransform );
                    // ... then we transform the model using local transformation matrix
                    this.element._localModelTransform.mul( this.localTransform )
                    // ... and get away from our pivot point
                    this.element._localModelTransform.mul( fromPivotTransform );
                    // ... and finally invert the matrix
                    this.element._localModelTransform.invert();

                    // our model transform starts off with what we've got from parent
                    this.element._modelTransform.copy( this.element._screenToWorld );
                    // ... then we move onto pivot point
                    this.element._modelTransform.mul( toPivotTransform );
                    // ... then we transform the model using local transformation matrix
                    this.element._modelTransform.mul( this.localTransform )
                    // ... and get away from our pivot point
                    this.element._modelTransform.mul( fromPivotTransform );

                    if (screen) {
                        // if we have the screen somewhere is our heirarchy we apply screen matrix
                        this.element._screenToWorld.mul2(screen.screen._screenMatrix, this.element._screenToWorld);

                        // unless it's screen-space we need to account screen's world transform as well
                        if (screen.screen.screenType != pc.SCREEN_TYPE_SCREEN) {
                            this.element._screenToWorld.mul2(screen.worldTransform, this.element._screenToWorld);
                        }

                        // world transform if effectively the same as model transform,
                        // BUT should account screen transformations applied on top of it
                        this.worldTransform.copy( this.element._screenToWorld );
                        this.worldTransform.mul( toPivotTransform ).mul( this.localTransform ).mul( fromPivotTransform );
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

                this.element.fire("resize", this.element._width, this.element._height);
            }
        },

        _drawDebugBox: function(dt) {
            var bottomLeft = new pc.Vec3();
            var r = new pc.Vec3( this._width, 0, 0 );
            var u = new pc.Vec3( 0, this._height, 0 );

            var corners = [
                bottomLeft.clone(),
                bottomLeft.clone().add(u),
                bottomLeft.clone().add(r).add(u),
                bottomLeft.clone().add(r)
            ];

            var points = [
                corners[0], corners[1],
                corners[1], corners[2],
                corners[2], corners[3],
                corners[3], corners[0]
            ];

            var transform = this.entity.worldTransform;

            for(var i = 0; i < points.length; i++) {
                points[i] = transform.transformPoint( points[i] );
            }

            if (this.screen && this.screen.screen) {
                this.system.app.renderLines(points, this._debugColor, this.screen.screen._screenType == pc.SCREEN_TYPE_SCREEN ? pc.LINEBATCH_SCREEN : pc.LINEBATCH_WORLD);
            }
        },

        _onInsert: function (parent) {
            // when the entity is reparented find a possible new screen
            var screen = this._findScreen();
            this._updateScreen(screen);

            if (parent && parent.element) {
                parent.element._setMasksChildren( parent.element._masksChildren );
            }
        },

        _updateScreen: function (screen) {
            if (this.screen && this.screen !== screen) {
                this.screen.screen.off('set:resolution', this._onScreenResize, this);
                this.screen.screen.off('set:referenceresolution', this._onScreenResize, this);
                this.screen.screen.off('set:scaleblend', this._onScreenResize, this);
                this.screen.screen.off('set:screentype', this._onScreenTypeChange, this);
            }

            this.screen = screen;
            if (this.screen) {
                this.screen.screen.on('set:resolution', this._onScreenResize, this);
                this.screen.screen.on('set:referenceresolution', this._onScreenResize, this);
                this.screen.screen.on('set:scaleblend', this._onScreenResize, this);
                this.screen.screen.on('set:screentype', this._onScreenTypeChange, this);

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
            this.entity.dirtyWorld = true;
            this._anchorDirty = true;

            this.fire('screen:set:resolution', res);
        },

        _onScreenTypeChange: function () {
            this.entity.dirtyWorld = true;
            this.fire('screen:set:screentype', this.screen.screen.screenType);
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

    /**
    * @name pc.ElementComponent#type
    * @type pc.Color
    * @description The type of the extension attached to the element. Allowed values are pc.ELEMENTTYPE_GROUP,
    * pc.ELEMENTTYPE_TEXT and pc.ELEMENTTYPE_IMAGE.
    */
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

    /**
    * @name pc.ElementComponent#debugColor
    * @type pc.Color
    * @description The color for the debug outline of the element. When set to a non-null value, the element will draw
    * a box to indicate what are the actual bounds it takes. Please use that for debugging purposes only as the debug outline
    * has very poor rendering performance.
    * @example
    * // make element show it's layout box in red.
    * var element = this.entity.element;
    * element.debugColor = new pc.Color( 1, 0, 0 );
    */
    Object.defineProperty(ElementComponent.prototype, "debugColor", {
        get: function () {
            return this._debugColor;
        },

        set: function (value) {
            this._debugColor = value;

            if (this._debugColor) {
                pc.ComponentSystem.on("update", this._drawDebugBox, this);
            } else {
                pc.ComponentSystem.off("update", this._drawDebugBox, this);
            }
        }
    });

    /**
    * @name pc.ElementComponent#corners
    * @type pc.Vec4
    * @description The corners of the component set in a form of {@link pc.Vec4} with coords meaning offsets from:
    * left anchor, bottom anchor, right anchor, top anchor
    * @example
    * // make element occupy central quarter of the parent with an inner padding of 10 px (or units, depending on screen 
    * // overlay flag)
    * var element = this.entity.element;
    * element.anchors = new pc.Vec4( 0.25, 0.75, 0.75, 0.25 );
    * element.corners = new pc.Vec4( 10, 10, -10, -10 );
    */
    Object.defineProperty(ElementComponent.prototype, "corners", {
        get: function () {
            return this._corners;
        },

        set: function (value) {
            this._corners = value;
            this._cornerDirty = true;

            this.getWorldTransform();
        }
    });

    /**
    * @name pc.ElementComponent#drawOrder
    * @type Number
    * @description Drawing priority of the element.
    */
    Object.defineProperty(ElementComponent.prototype, "drawOrder", {
        get: function () {
            return this._drawOrder;
        },

        set: function (value) {
            this._drawOrder = value;
            this.fire('set:draworder', this._drawOrder);
        }
    });

    /**
    * @readonly
    * @name pc.ElementComponent#width
    * @type Number
    * @description Effective width of the element
    */
    Object.defineProperty(ElementComponent.prototype, "width", {
        get: function () {
            return this._width;
        }
    });

    /**
    * @readonly
    * @name pc.ElementComponent#height
    * @type Number
    * @description Effective height of the element
    */
    Object.defineProperty(ElementComponent.prototype, "height", {
        get: function () {
            return this._height;
        }
    });

    /**
    * @name pc.ElementComponent#left
    * @type Number
    * @description The left side offset from left anchor line.
    */
    Object.defineProperty(ElementComponent.prototype, "left", {
        get: function () {
            return this._corners.x;
        },

        set: function (value) {
            this._corners.x = value;
            this._cornerDirty = true;

            this.getWorldTransform();
        }
    });

    /**
    * @name pc.ElementComponent#right
    * @type Number
    * @description The right side offset from right anchor line.
    */
    Object.defineProperty(ElementComponent.prototype, "right", {
        get: function () {
            return this._corners.z;
        },

        set: function (value) {
            this._corners.z = value;
            this._cornerDirty = true;

            this.getWorldTransform();
        }
    });

    /**
    * @name pc.ElementComponent#top
    * @type Number
    * @description The top side offset from top anchor line.
    */
    Object.defineProperty(ElementComponent.prototype, "top", {
        get: function () {
            return this._corners.w;
        },

        set: function (value) {
            this._corners.w = value;
            this._cornerDirty = true;

            this.getWorldTransform();
        }
    });

    /**
    * @name pc.ElementComponent#bottom
    * @type Number
    * @description The bottom side offset from bottom anchor line.
    */
    Object.defineProperty(ElementComponent.prototype, "bottom", {
        get: function () {
            return this._corners.y;
        },

        set: function (value) {
            this._corners.y = value;
            this._cornerDirty = true;

            this.getWorldTransform();
        }
    });

    /**
    * @name pc.ElementComponent#pivot
    * @type pc.Vec2
    * @description The location of the pivot point within the element, x and y being fractions of
    * width and height respectively.
    * @example
    * // rotate an element around lower left corner
    * var element = entity.element;
    * element.pivot = new pc.Vec2( 0, 0 );
    * entity.setLocalEulerAngles(0, 0, 30);
    */
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

    /**
    * @name pc.ElementComponent#anchor
    * @type pc.Vec4
    * @description The anchor points of the element in the coordinate system of a parent. The anchors set the fraction
    * of respective parent's dimension in the form of {@link pc.Vec4} in the following order:
    * left anchor, bottom anchor, right anchor, top anchor
    * @example
    * // make element occupy central quarter of the parent
    * var element = this.entity.element;
    * element.anchors = new pc.Vec4( 0.25, 0.75, 0.75, 0.25 );
    */
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
    _define("align");
    _define("verticalAlign");

    _define("text");
    _define("texture");
    _define("textureAsset");
    _define("material");
    _define("materialAsset");
    _define("opacity");
    _define("rect");
    _define("masksChildren");
    _define("alphaTest");
    _define("border");

    return {
        ElementComponent: ElementComponent
    };
}());

//**** Events Documentation *****//

/**
* @event
* @name pc.POINTEREVER_DOWN
* @description Fired when a mouse button or a figner presses the element.
* @param {pc.Vec3} point The coordinate of the cursor or finger in local coordinate space of the element.
*/

/**
* @event
* @name pc.POINTEREVER_UP
* @description Fired when a mouse button or a figner releases the element.
* @param {pc.Vec3} point The coordinate of the cursor or finger in local coordinate space of the element.
*/

/**
* @event
* @name pc.POINTEREVER_MOVE
* @description Fired when a mouse or a figner moves within the element.
* @param {pc.Vec3} point The coordinate of the cursor or finger in local coordinate space of the element.
*/

/**
* @event
* @name pc.POINTEREVER_ENTER
* @description Fired when a mouse or a figner enters the element.
* @param {pc.Vec3} point The coordinate of the cursor or finger in local coordinate space of the element.
*/

/**
* @event
* @name pc.POINTEREVER_LEAVE
* @description Fired when a mouse or a figner leave the element.
* @param {pc.Vec3} point The coordinate of the cursor or finger in screen coordinate space.
*/

/**
* @event
* @name pc.POINTEREVER_SCROLL
* @description Fired when a mouse wheel is scrolled with the element.
* @param {pc.Vec3} point The coordinate of the cursor or finger in local coordinate space.
* @param {Number} amount The amount of the scroll.
*/
