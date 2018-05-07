pc.extend(pc, function () {
    var topMasks = [];

    var _debugLogging = false;

    /**
     * @enum pc.ELEMENTTYPE
     * @name pc.ELEMENTTYPE_GROUP
     * @description A {@link pc.ElementComponent} that contains child {@link pc.ElementComponent}s.
     */
    pc.ELEMENTTYPE_GROUP = 'group';
    /**
     * @enum pc.ELEMENTTYPE
     * @name pc.ELEMENTTYPE_IMAGE
     * @description A {@link pc.ElementComponent} that displays an image.
     */
    pc.ELEMENTTYPE_IMAGE = 'image';
    /**
     * @enum pc.ELEMENTTYPE
     * @name pc.ELEMENTTYPE_TEXT
     * @description A {@link pc.ElementComponent} that displays text.
     */
    pc.ELEMENTTYPE_TEXT = 'text';

    var vecA = new pc.Vec3();
    var vecB = new pc.Vec3();
    var matA = new pc.Mat4();
    var matB = new pc.Mat4();
    var matC = new pc.Mat4();
    var matD = new pc.Mat4();

    /**
     * @component
     * @constructor
     * @name pc.ElementComponent
     * @extends pc.Component
     * @classdesc Enables an Entity to be positioned using anchors and screen coordinates under a {@link pc.ScreenComponent} or under other ElementComponents.
     * Depending on its type it can be used to render images, text or just as a layout mechanism to build 2D and 3D user interfaces.
     * If the component is a descendant of a {@link pc.ScreenComponent}, then the Entity's {@link pc.Entity.setLocalPosition} is in the {@link pc.ScreenComponent}'s coordinate system.
     * @param {pc.ElementComponentSystem} system The ComponentSystem that created this Component
     * @param {pc.Entity} entity The Entity that this Component is attached to.
     * @property {String} type The type of the ElementComponent. Can be one of the following:
     * <ul>
     *     <li>pc.ELEMENTTYPE_GROUP: The component can be used as a layout mechanism to create groups of ElementComponents e.g. panels.</li>
     *     <li>pc.ELEMENTTYPE_IMAGE: The component will render an image</li>
     *     <li>pc.ELEMENTTYPE_TEXT: The component will render text</li>
     * </ul>
     * @property {pc.Entity} screen The Entity with a {@link pc.ScreenComponent} that this component belongs to. This is automatically set when the component is a child of a ScreenComponent.
     * @property {Number} drawOrder The draw order of the component. A higher value means that the component will be rendered on top of other components.
     * @property {pc.Vec4} anchor Specifies where the left, bottom, right and top edges of the component are anchored relative to its parent. Each value
     * ranges from 0 to 1. E.g. a value of [0,0,0,0] means that the element will be anchored to the bottom left of its parent. A value of [1, 1, 1, 1] means
     * it will be anchored to the top right. A split anchor is when the left-right or top-bottom pairs of the anchor are not equal. In that case the component will be resized to cover that entire area. E.g. a value of [0,0,1,1] will make the component resize exactly as its parent.
     * @property {pc.Vec2} pivot The position of the pivot of the component relative to its anchor. Each value ranges from 0 to 1 where [0,0] is the bottom left and [1,1] is the top right.
     * @property {pc.Vec4} margin The distance from the left, bottom, right and top edges of the anchor. For example if we are using a split anchor like [0,0,1,1] and the margin is [0,0,0,0] then the component will be the same width and height as its parent.
     * @property {Number} left The distance from the left edge of the anchor. Can be used in combination with a split anchor to make the component's left edge always be 'left' units away from the left.
     * @property {Number} right The distance from the right edge of the anchor. Can be used in combination with a split anchor to make the component's right edge always be 'right' units away from the right.
     * @property {Number} bottom The distance from the bottom edge of the anchor. Can be used in combination with a split anchor to make the component's top edge always be 'top' units away from the top.
     * @property {Number} top The distance from the top edge of the anchor. Can be used in combination with a split anchor to make the component's bottom edge always be 'bottom' units away from the bottom.
     * @property {Number} width The width of the element as set in the editor. Note that in some cases this may not reflect the true width at which the element is rendered, such as when the element is under the control of a {@link pc.LayoutGroupComponent}. See <code>calculatedWidth</code> in order to ensure you are reading the true width at which the element will be rendered.
     * @property {Number} height The height of the element as set in the editor. Note that in some cases this may not reflect the true height at which the element is rendered, such as when the element is under the control of a {@link pc.LayoutGroupComponent}. See <code>calculatedHeight</code> in order to ensure you are reading the true height at which the element will be rendered.
     * @property {Number} calculatedWidth The width at which the element will be rendered. In most cases this will be the same as <code>width</code>. However, in some cases the engine may calculate a different width for the element, such as when the element is under the control of a {@link pc.LayoutGroupComponent}. In these scenarios, <code>calculatedWidth</code> may be smaller or larger than the width that was set in the editor.
     * @property {Number} calculatedHeight The height at which the element will be rendered. In most cases this will be the same as <code>height</code>. However, in some cases the engine may calculate a different height for the element, such as when the element is under the control of a {@link pc.LayoutGroupComponent}. In these scenarios, <code>calculatedHeight</code> may be smaller or larger than the height that was set in the editor.
     * @property {pc.Vec3[]} screenCorners An array of 4 {@link pc.Vec3}s that represent the bottom left, bottom right, top right and top left corners of the component relative to its parent {@link pc.ScreenComponent}.
     * @property {pc.Vec3[]} worldCorners An array of 4 {@link pc.Vec3}s that represent the bottom left, bottom right, top right and top left corners of the component in world space. Only works for 3D ElementComponents.
     * @property {pc.Vec2[]} canvasCorners An array of 4 {@link pc.Vec2}s that represent the bottom left, bottom right, top right and top left corners of the component in canvas pixels. Only works for screen space ElementComponents.
     * @property {Boolean} useInput If true then the component will receive Mouse or Touch input events.
     * @property {pc.Color} color The color of the image for {@link pc.ELEMENTTYPE_IMAGE} types or the color of the text for {@link pc.ELEMENTTYPE_TEXT} types.
     * @property {Number} opacity The opacity of the image for {@link pc.ELEMENTTYPE_IMAGE} types or the text for {@link pc.ELEMENTTYPE_TEXT} types.
     * @property {Number} textWidth The width of the text rendered by the component. Only works for {@link pc.ELEMENTTYPE_TEXT} types.
     * @property {Number} textHeight The height of the text rendered by the component. Only works for {@link pc.ELEMENTTYPE_TEXT} types.
     * @property {Number} autoWidth Automatically set the width of the component to be the same as the textWidth. Only works for {@link pc.ELEMENTTYPE_TEXT} types.
     * @property {Number} autoHeight Automatically set the height of the component to be the same as the textHeight. Only works for {@link pc.ELEMENTTYPE_TEXT} types.
     * @property {Number} fontAsset The id of the font asset used for rendering the text. Only works for {@link pc.ELEMENTTYPE_TEXT} types.
     * @property {pc.Font} font The font used for rendering the text. Only works for {@link pc.ELEMENTTYPE_TEXT} types.
     * @property {Number} fontSize The size of the font. Only works for {@link pc.ELEMENTTYPE_TEXT} types.
     * @property {Number} spacing The spacing between the letters of the text. Only works for {@link pc.ELEMENTTYPE_TEXT} types.
     * @property {Number} lineHeight The height of each line of text. Only works for {@link pc.ELEMENTTYPE_TEXT} types.
     * @property {Boolean} wrapLines Whether to automatically wrap lines based on the element width. Only works for {@link pc.ELEMENTTYPE_TEXT} types, and when autoWidth is set to false.
     * @property {pc.Vec2} alignment The horizontal and vertical alignment of the text. Values range from 0 to 1 where [0,0] is the bottom left and [1,1] is the top right.  Only works for {@link pc.ELEMENTTYPE_TEXT} types.
     * @property {String} text The text to render. Only works for {@link pc.ELEMENTTYPE_TEXT} types.
     * @property {Number} textureAsset The id of the texture asset to render. Only works for {@link pc.ELEMENTTYPE_IMAGE} types.
     * @property {pc.Texture} texture The texture to render. Only works for {@link pc.ELEMENTTYPE_IMAGE} types.
     * @property {Number} spriteAsset The id of the sprite asset to render. Only works for {@link pc.ELEMENTTYPE_IMAGE} types which can render either a texture or a sprite.
     * @property {pc.Sprite} sprite The sprite to render. Only works for {@link pc.ELEMENTTYPE_IMAGE} types which can render either a texture or a sprite.
     * @property {Number} spriteFrame The frame of the sprite to render. Only works for {@link pc.ELEMENTTYPE_IMAGE} types who have a sprite assigned.
     * @property {Number} pixelsPerUnit The number of pixels that map to one PlayCanvas unit. Only works for {@link pc.ELEMENTTYPE_IMAGE} types who have a sliced sprite assigned.
     * @property {Number} materialAsset The id of the material asset to use when rendering an image. Only works for {@link pc.ELEMENTTYPE_IMAGE} types.
     * @property {pc.Material} material The material to use when rendering an image. Only works for {@link pc.ELEMENTTYPE_IMAGE} types.
     * @property {pc.Vec4} rect Specifies which region of the texture to use in order to render an image. Values range from 0 to 1 and indicate u, v, width, height. Only works for {@link pc.ELEMENTTYPE_IMAGE} types.
     * @property {Number} batchGroupId Assign element to a specific batch group (see {@link pc.BatchGroup}). Default value is -1 (no group).
     * @property {Array} layers An array of layer IDs ({@link pc.Layer#id}) to which this element should belong.
     * Don't push/pop/splice or modify this array, if you want to change it - set a new one instead.
     */
    var ElementComponent = function ElementComponent (system, entity) {
        this._anchor = new pc.Vec4();
        this._localAnchor = new pc.Vec4();

        this._pivot = new pc.Vec2();

        this._width = this._calculatedWidth = 32;
        this._height = this._calculatedHeight = 32;

        this._margin = new pc.Vec4(0, 0, -32, -32);

        // the model transform used to render
        this._modelTransform = new pc.Mat4();

        this._screenToWorld = new pc.Mat4();

        // transform that updates local position according to anchor values
        this._anchorTransform = new pc.Mat4();

        this._anchorDirty = true;

        // transforms to calculate screen coordinates
        this._parentWorldTransform = new pc.Mat4();
        this._screenTransform = new pc.Mat4();

        // the corners of the element relative to its screen component.
        // Order is bottom left, bottom right, top right, top left
        this._screenCorners = [new pc.Vec3(), new pc.Vec3(), new pc.Vec3(), new pc.Vec3()];

        // canvas-space corners of the element.
        // Order is bottom left, bottom right, top right, top left
        this._canvasCorners = [new pc.Vec2(), new pc.Vec2(), new pc.Vec2(), new pc.Vec2()];

        // the world-space corners of the element
        // Order is bottom left, bottom right, top right, top left
        this._worldCorners = [new pc.Vec3(), new pc.Vec3(), new pc.Vec3(), new pc.Vec3()];

        this._cornersDirty = true;
        this._canvasCornersDirty = true;
        this._worldCornersDirty = true;

        this.entity.on('insert', this._onInsert, this);

        this._patch();

        this.screen = null;

        this._type = pc.ELEMENTTYPE_GROUP;

        // element types
        this._image = null;
        this._text = null;
        this._group = null;

        // input related
        this._useInput = false;

        this._layers = [pc.LAYERID_UI]; // assign to the default UI layer
        this._addedModel = null;

        this._batchGroupId = -1;
        // #ifdef DEBUG
        this._batchGroup = null;
        // #endif
    };
    ElementComponent = pc.inherits(ElementComponent, pc.Component);


    pc.extend(ElementComponent.prototype, {
        _patch: function () {
            this.entity._sync = this._sync;
            this.entity.setPosition = this._setPosition;
            this.entity.setLocalPosition = this._setLocalPosition;
        },

        _unpatch: function () {
            this.entity._sync = pc.Entity.prototype._sync;
            this.entity.setPosition = pc.Entity.prototype.setPosition;
            this.entity.setLocalPosition = pc.Entity.prototype.setLocalPosition;
        },

        _setPosition: function () {
            var position = new pc.Vec3();
            var invParentWtm = new pc.Mat4();

            return function (x, y, z) {
                if (! this.element.screen)
                    return pc.Entity.prototype.setPosition.call(this, x, y, z);

                if (x instanceof pc.Vec3) {
                    position.copy(x);
                } else {
                    position.set(x, y, z);
                }

                this.getWorldTransform(); // ensure hierarchy is up to date
                invParentWtm.copy(this.element._screenToWorld).invert();
                invParentWtm.transformPoint(position, this.localPosition);

                if (! this._dirtyLocal)
                    this._dirtify(true);
            };
        }(),

        _setLocalPosition: function (x, y, z) {
            if (x instanceof pc.Vec3) {
                this.localPosition.copy(x);
            } else {
                this.localPosition.set(x, y, z);
            }

            // update margin
            var element = this.element;
            var p = this.localPosition.data;
            var pvt = element._pivot.data;
            element._margin.data[0] = p[0] - element._calculatedWidth * pvt[0];
            element._margin.data[2] = (element._localAnchor.data[2] - element._localAnchor.data[0]) - element._calculatedWidth - element._margin.data[0];
            element._margin.data[1] = p[1] - element._calculatedHeight * pvt[1];
            element._margin.data[3] = (element._localAnchor.data[3] - element._localAnchor.data[1]) - element._calculatedHeight - element._margin.data[1];

            if (! this._dirtyLocal)
                this._dirtify(true);
        },

        // this method overwrites GraphNode#sync and so operates in scope of the Entity.
        _sync: function () {
            var element = this.element;
            var screen = element.screen;

            if (screen) {

                if (element._anchorDirty) {
                    var resx = 0;
                    var resy = 0;
                    var px = 0;
                    var py = 1;

                    if (this._parent && this._parent.element) {
                        // use parent rect
                        resx = this._parent.element.calculatedWidth;
                        resy = this._parent.element.calculatedHeight;
                        px = this._parent.element.pivot.x;
                        py = this._parent.element.pivot.y;
                    } else if (screen) {
                        // use screen rect
                        var resolution = screen.screen.resolution;
                        resx = resolution.x / screen.screen.scale;
                        resy = resolution.y / screen.screen.scale;
                    }

                    element._anchorTransform.setTranslate((resx * (element.anchor.x - px)), -(resy * (py - element.anchor.y)), 0);
                    element._anchorDirty = false;
                    element._calculateLocalAnchors();
                }

                // if element size is dirty
                // recalculate its size
                // WARNING: Order is important as calculateSize resets dirtyLocal
                // so this needs to run before resetting dirtyLocal to false below
                if (element._sizeDirty) {
                    element._calculateSize();
                }
            }

            if (this._dirtyLocal) {
                this.localTransform.setTRS(this.localPosition, this.localRotation, this.localScale);

                // update margin
                var p = this.localPosition.data;
                var pvt = element._pivot.data;
                element._margin.data[0] = p[0] - element._calculatedWidth * pvt[0];
                element._margin.data[2] = (element._localAnchor.data[2] - element._localAnchor.data[0]) - element._calculatedWidth - element._margin.data[0];
                element._margin.data[1] = p[1] - element._calculatedHeight * pvt[1];
                element._margin.data[3] = (element._localAnchor.data[3] - element._localAnchor.data[1]) - element._calculatedHeight - element._margin.data[1];

                this._dirtyLocal = false;
            }

            if (! screen) {
                if (this._dirtyWorld) {
                    element._cornersDirty = true;
                    element._canvasCornersDirty = true;
                    element._worldCornersDirty = true;
                }

                return pc.Entity.prototype._sync.call(this);
            }


            if (this._dirtyWorld) {
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

                        // update parent world transform
                        var parentWorldTransform = element._parentWorldTransform;
                        parentWorldTransform.setIdentity();
                        var parent = this._parent;
                        if (parent && parent.element && parent !== screen) {
                            matA.setTRS(pc.Vec3.ZERO, parent.getLocalRotation(), parent.getLocalScale());
                            parentWorldTransform.mul2(parent.element._parentWorldTransform, matA);
                        }

                        // update element transform
                        // rotate and scale around pivot
                        var depthOffset = vecA;
                        depthOffset.set(0, 0, this.localPosition.z);

                        var pivotOffset = vecB;
                        pivotOffset.set(element._absLeft + element._pivot.x * element.calculatedWidth, element._absBottom + element._pivot.y * element.calculatedHeight, 0);

                        matA.setTranslate(-pivotOffset.x, -pivotOffset.y, -pivotOffset.z);
                        matB.setTRS(depthOffset, this.getLocalRotation(), this.getLocalScale());
                        matC.setTranslate(pivotOffset.x, pivotOffset.y, pivotOffset.z);

                        element._screenTransform.mul2(element._parentWorldTransform, matC).mul(matB).mul(matA);

                        element._cornersDirty = true;
                        element._canvasCornersDirty = true;
                        element._worldCornersDirty = true;
                    } else {
                        this.worldTransform.copy(element._modelTransform);
                    }
                }

                this._dirtyWorld = false;
            }
        },

        _onInsert: function (parent) {
            // when the entity is reparented find a possible new screen and mask

            var result = this._parseUpToScreen();

            this.entity._dirtify();

            this._updateScreen(result.screen);

            this._dirtifyMask();
        },

        _dirtifyMask: function () {
            var parent = this.entity;
            while (parent) {
                var next = parent.getParent();
                if ((next === null || next.screen) && parent.element) {
                    if (!this.system._prerender || !this.system._prerender.length) {
                        this.system._prerender = [];
                        this.system.app.once('prerender', this._onPrerender, this);

                        if (_debugLogging) console.log('register prerender');
                    }
                    var i = this.system._prerender.indexOf(this.entity);
                    if (i >= 0) {
                        this.system._prerender.splice(i, 1);
                    }
                    var j = this.system._prerender.indexOf(parent);
                    if (j < 0) {
                        this.system._prerender.push(parent);
                    }
                    if (_debugLogging) console.log('set prerender root to: ' + parent.name);
                }

                parent = next;
            }
        },

        _onPrerender: function () {
            var ref = 0;
            for (var i = 0; i < this.system._prerender.length; i++) {
                var mask = this.system._prerender[i];
                if (_debugLogging) console.log('prerender from: ' + mask.name);
                ref = mask.element.syncMask(ref) + 1;
            }

            this.system._prerender.length = 0;
        },

        _updateScreen: function (screen) {
            if (this.screen && this.screen !== screen) {
                this.screen.screen.off('set:resolution', this._onScreenResize, this);
                this.screen.screen.off('set:referenceresolution', this._onScreenResize, this);
                this.screen.screen.off('set:scaleblend', this._onScreenResize, this);
                this.screen.screen.off('set:screenspace', this._onScreenSpaceChange, this);
                this.screen.screen.off('remove', this._onScreenRemove, this);
            }

            this.screen = screen;
            if (this.screen) {
                this.screen.screen.on('set:resolution', this._onScreenResize, this);
                this.screen.screen.on('set:referenceresolution', this._onScreenResize, this);
                this.screen.screen.on('set:scaleblend', this._onScreenResize, this);
                this.screen.screen.on('set:screenspace', this._onScreenSpaceChange, this);
                this.screen.screen.on('remove', this._onScreenRemove, this);
            }

            this._calculateSize(this._hasSplitAnchorsX, this._hasSplitAnchorsY);

            this.fire('set:screen', this.screen);

            this._anchorDirty = true;

            // update all child screens
            var children = this.entity.getChildren();
            for (var i = 0, l = children.length; i < l; i++) {
                if (children[i].element) children[i].element._updateScreen(screen);
            }

            // calculate draw order
            if (this.screen) this.screen.screen.syncDrawOrder();
        },

        syncMask: function (ref) {
            var result = this._parseUpToScreen();
            return this._updateMask(result.mask, ref);
        },

        _setMaskedBy: function (mask) {
            var i, mi, len;
            var elem = this._image || this._text;
            if (!elem) return;

            if (mask) {
                // if (elem._maskedBy && elem._maskedBy !== mask) {
                //     // already masked by something else
                // }

                var ref = mask.element._image._maskRef;
                if (_debugLogging) console.log("masking: " + this.entity.name + " with " + ref);
                var sp = new pc.StencilParameters({
                    ref: ref,
                    func: pc.FUNC_EQUAL
                });

                for (i = 0, len = elem._model.meshInstances.length; i < len; i++) {
                    mi = elem._model.meshInstances[i];
                    mi.stencilFront = mi.stencilBack = sp;
                }

                elem._maskedBy = mask;
            } else {
                if (_debugLogging) console.log("no masking on: " + this.entity.name);
                // remove mask
                // restore default material
                for (i = 0, len = elem._model.meshInstances.length; i < len; i++) {
                    mi = elem._model.meshInstances[i];
                    mi.stencilFront = mi.stencilBack = null;
                }
                elem._maskedBy = null;
            }
        },

        _getMaskDepth: function () {
            var depth = 1;
            var parent = this.entity;

            while (parent) {
                parent = parent.getParent();
                if (parent && parent.element && parent.element.mask) {
                    depth++;

                }
            }

            return depth;
        },

        // set the mask ancestor on this entity
        _updateMask: function (mask, ref) {
            var i, l, sp, children;

            if (!ref) ref = 1;

            if (mask) {
                this._setMaskedBy(mask);

                if (this.mask) {
                    if (_debugLogging) console.log("masking: " + this.entity.name + " with " + ref);

                    sp = new pc.StencilParameters({
                        ref: ref++,
                        func: pc.FUNC_EQUAL,
                        zpass: pc.STENCILOP_INCREMENT
                    });
                    this._image._meshInstance.stencilFront = sp;
                    this._image._meshInstance.stencilBack = sp;
                    this._image._maskRef = ref;
                    if (_debugLogging) console.log("masking from: " + this.entity.name + " with " + ref);

                    mask = this.entity;
                }

                // recurse through all children
                children = this.entity.getChildren();
                for (i = 0, l = children.length; i < l; i++) {
                    if (children[i].element) {
                        children[i].element._updateMask(mask, ref);
                    }
                }
            } else {
                // clearing mask
                this._setMaskedBy(null);

                // if this is mask we still need to mask children
                if (this.mask) {
                    sp = new pc.StencilParameters({
                        func: pc.FUNC_ALWAYS,
                        zpass: pc.STENCILOP_REPLACE,
                        ref: ref
                    });
                    this._image._meshInstance.stencilFront = sp;
                    this._image._meshInstance.stencilBack = sp;
                    this._image._maskRef = ref;
                    if (_debugLogging) console.log("masking from: " + this.entity.name + " with " + ref);
                    mask = this.entity;
                }

                // recurse through all children
                children = this.entity.getChildren();
                for (i = 0, l = children.length; i < l; i++) {
                    if (children[i].element) {
                        children[i].element._updateMask(mask, ref);
                    }
                }
            }

            return ref;
        },

        // search up the parent hierarchy until we reach a screen
        // this screen is the parent screen
        // also searches for masked elements to get the relevant mask
        _parseUpToScreen: function () {
            var result = {
                screen: null,
                mask: null
            };

            var parent = this.entity._parent;

            while (parent && !parent.screen) {
                if (parent.element && parent.element.mask) {
                    // mask entity
                    if (!result.mask) result.mask = parent;
                }

                parent = parent.parent;
            }
            if (parent && parent.screen) result.screen = parent;

            return result;
        },

        _onScreenResize: function (res) {
            this._anchorDirty = true;
            this._cornersDirty = true;
            this._worldCornersDirty = true;

            this._calculateSize(this._hasSplitAnchorsX, this._hasSplitAnchorsY);

            this.fire('screen:set:resolution', res);
        },

        _onScreenSpaceChange: function () {
            this.fire('screen:set:screenspace', this.screen.screen.screenSpace);
        },

        _onScreenRemove: function () {
            this._updateScreen(null);
        },

        // store pixel positions of anchor relative to current parent resolution
        _calculateLocalAnchors: function () {
            var resx = 1000;
            var resy = 1000;
            var parent = this.entity._parent;
            if (parent && parent.element) {
                resx = parent.element.calculatedWidth;
                resy = parent.element.calculatedHeight;
            } else if (this.screen) {
                var res = this.screen.screen.resolution;
                var scale = this.screen.screen.scale;
                resx = res.x / scale;
                resy = res.y / scale;
            }

            this._localAnchor.set(
                this._anchor.x * resx,
                this._anchor.y * resy,
                this._anchor.z * resx,
                this._anchor.w * resy
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

        onLayersChanged: function(oldComp, newComp) {
            this.addModelToLayers(this._image ? this._image._model : this._text._model);
            oldComp.off("add", this.onLayerAdded, this);
            oldComp.off("remove", this.onLayerRemoved, this);
            newComp.on("add", this.onLayerAdded, this);
            newComp.on("remove", this.onLayerRemoved, this);
        },

        onLayerAdded: function(layer) {
            var index = this.layers.indexOf(layer.id);
            if (index < 0) return;
            if (this._image) {
                layer.addMeshInstances(this._image._model.meshInstances);
            } else if (this._text) {
                layer.addMeshInstances(this._text._model.meshInstances);
            }
        },

        onLayerRemoved: function(layer) {
            var index = this.layers.indexOf(layer.id);
            if (index < 0) return;
            if (this._image) {
                layer.removeMeshInstances(this._image._model.meshInstances);
            } else if (this._text) {
                layer.removeMeshInstances(this._text._model.meshInstances);
            }
        },

        onEnable: function () {
            ElementComponent._super.onEnable.call(this);
            if (this._image) this._image.onEnable();
            if (this._text) this._text.onEnable();
            if (this._group) this._group.onEnable();

            if (this.useInput && this.system.app.elementInput) {
                this.system.app.elementInput.addElement(this);
            }

            if (this.mask) {
                var maskDepth = this._getMaskDepth();
                if (maskDepth === 1) {
                    this._topMask = true;
                    if (topMasks.indexOf(this) < 0) topMasks.push(this);
                }
            }

            this.system.app.scene.on("set:layers", this.onLayersChanged, this);
            if (this.system.app.scene.layers) {
                this.system.app.scene.layers.on("add", this.onLayerAdded, this);
                this.system.app.scene.layers.on("remove", this.onLayerRemoved, this);
            }

            this.fire("enableelement");
        },

        onDisable: function () {
            ElementComponent._super.onDisable.call(this);

            this.system.app.scene.off("set:layers", this.onLayersChanged, this);
            if (this.system.app.scene.layers) {
                this.system.app.scene.layers.off("add", this.onLayerAdded, this);
                this.system.app.scene.layers.off("remove", this.onLayerRemoved, this);
            }

            if (this._image) this._image.onDisable();
            if (this._text) this._text.onDisable();
            if (this._group) this._group.onDisable();

            if (this.system.app.elementInput && this.useInput) {
                this.system.app.elementInput.removeElement(this);
            }

            if (this._topMask) {
                var index = topMasks.indexOf(this);
                if (index >= 0) topMasks.splice(index, 1);
                this._topMask = false;
            }

            this.fire("disableelement");
        },

        onRemove: function () {
            this.entity.off('insert', this._onInsert, this);

            this._unpatch();
            if (this._image) this._image.destroy();
            if (this._text) this._text.destroy();

            if (this.system.app.elementInput && this.useInput) {
                this.system.app.elementInput.removeElement(this);
            }

            if (this._topMask) {
                var index = topMasks.indexOf(this);
                if (index >= 0) topMasks.splice(index, 1);
                this._topMask = false;
            }
        },

        // recalculates
        //   localAnchor, width, height, (local position is updated if anchors are split)
        // assumes these properties are up to date
        //   _margin
        _calculateSize: function (propagateCalculatedWidth, propagateCalculatedHeight) {
            // can't calculate if local anchors are wrong
            if (!this.entity._parent && !this.screen) return;

            this._calculateLocalAnchors();

            var newWidth = this._absRight - this._absLeft;
            var newHeight = this._absTop - this._absBottom;

            if (propagateCalculatedWidth) {
                this._setWidth(newWidth);
            } else {
                this._setCalculatedWidth(newWidth, false);
            }

            if (propagateCalculatedHeight) {
                this._setHeight(newHeight);
            } else {
                this._setCalculatedHeight(newHeight, false);
            }

            var p = this.entity.getLocalPosition();
            p.x = this._margin.data[0] + this._calculatedWidth * this._pivot.data[0];
            p.y = this._margin.data[1] + this._calculatedHeight * this._pivot.data[1];

            this.entity.setLocalPosition(p);

            this._sizeDirty = false;
        },

        // internal set width without updating margin
        _setWidth: function (w) {
            this._width = w;
            this._setCalculatedWidth(w, false);

            this.fire('set:width', this._width);
        },

        // internal set height without updating margin
        _setHeight: function (h) {
            this._height = h;
            this._setCalculatedHeight(h, false);

            this.fire('set:height', this._height);
        },

        _setCalculatedWidth: function(value, updateMargins) {
            var didChange = Math.abs(value - this._calculatedWidth) > 1e-4;

            this._calculatedWidth = value;

            if (updateMargins) {
                var p = this.entity.getLocalPosition().data;
                var pvt = this._pivot.data;
                this._margin.data[0] = p[0] - this._calculatedWidth * pvt[0];
                this._margin.data[2] = (this._localAnchor.data[2] - this._localAnchor.data[0]) - this._calculatedWidth - this._margin.data[0];
            }

            this._flagChildrenAsDirty();

            this.fire('set:calculatedWidth', this._calculatedWidth);

            if (didChange) {
                this.fire('resize', this._calculatedWidth, this._calculatedHeight);
            }
        },

        _setCalculatedHeight: function(value, updateMargins) {
            var didChange = Math.abs(value - this._calculatedHeight) > 1e-4;

            this._calculatedHeight = value;

            if (updateMargins) {
                var p = this.entity.getLocalPosition().data;
                var pvt = this._pivot.data;
                this._margin.data[1] = p[1] - this._calculatedHeight * pvt[1];
                this._margin.data[3] = (this._localAnchor.data[3] - this._localAnchor.data[1]) - this._calculatedHeight - this._margin.data[1];
            }

            this._flagChildrenAsDirty();

            this.fire('set:calculatedHeight', this._calculatedHeight);

            if (didChange) {
                this.fire('resize', this._calculatedWidth, this._calculatedHeight);
            }
        },

        _flagChildrenAsDirty: function() {
            var i, l;
            var c = this.entity._children;
            for (i = 0, l = c.length; i < l; i++) {
                if (c[i].element) {
                    c[i].element._anchorDirty = true;
                    c[i].element._sizeDirty = true;
                }
            }
        },

        addModelToLayers: function(model) {
            var layer;
            this._addedModel = model;
            for (var i = 0; i < this.layers.length; i++) {
                layer = this.system.app.scene.layers.getLayerById(this.layers[i]);
                if (!layer) continue;
                layer.addMeshInstances(model.meshInstances);
            }
        },

        removeModelFromLayers: function(model) {
            var layer;
            this._addedModel = null;
            for (var i = 0; i < this.layers.length; i++) {
                layer = this.system.app.scene.layers.getLayerById(this.layers[i]);
                if (!layer) continue;
                layer.removeMeshInstances(model.meshInstances);
            }
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

    Object.defineProperty(ElementComponent.prototype, "layers", {
        get: function () {
            return this._layers;
        },

        set: function (value) {
            var i, layer;

            if (this._addedModel) {
                for (i = 0; i < this._layers.length; i++) {
                    layer = this.system.app.scene.layers.getLayerById(this._layers[i]);
                    if (layer) {
                        layer.removeMeshInstances(this._addedModel.meshInstances);
                    }
                }
            }

            this._layers = value;

            if (!this.enabled || !this.entity.enabled || ! this._addedModel) return;
            for (i = 0; i < this._layers.length; i++) {
                layer = this.system.app.scene.layers.getLayerById(this._layers[i]);
                if (layer) {
                    layer.addMeshInstances(this._addedModel.meshInstances);
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
            this._calculateSize(true, true);
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

            p.x = value + this._calculatedWidth * this._pivot.data[0];
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
            p.x = (this._localAnchor.data[2] - this._localAnchor.data[0]) - value - (this._calculatedWidth * (1 - this._pivot.data[0]));
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
            this._setHeight(wt - wb);

            p.y = (this._localAnchor.data[3] - this._localAnchor.data[1]) - value - this._calculatedHeight * (1 - this._pivot.data[1]);
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
            this._setHeight(wt - wb);

            p.y = value + this._calculatedHeight * this._pivot.data[1];
            this.entity.setLocalPosition(p);
        }
    });

    Object.defineProperty(ElementComponent.prototype, "width", {
        get: function () {
            return this._width;
        },

        set: function (value) {
            this._width = value;
            this._setCalculatedWidth(value, true);

            this.fire('set:width', this._width);
        }
    });

    Object.defineProperty(ElementComponent.prototype, "height", {
        get: function () {
            return this._height;
        },

        set: function (value) {
            this._height = value;
            this._setCalculatedHeight(value, true);

            this.fire('set:height', this._height);
        }
    });

    Object.defineProperty(ElementComponent.prototype, "calculatedWidth", {
        get: function () {
            return this._calculatedWidth;
        },

        set: function (value) {
            this._setCalculatedWidth(value, true);
        }
    });

    Object.defineProperty(ElementComponent.prototype, "calculatedHeight", {
        get: function () {
            return this._calculatedHeight;
        },

        set: function (value) {
            this._setCalculatedHeight(value, true);
        }
    });

    Object.defineProperty(ElementComponent.prototype, "pivot", {
        get: function () {
            return this._pivot;
        },

        set: function (value) {
            var prevX = this._pivot.x;
            var prevY = this._pivot.y;

            if (value instanceof pc.Vec2) {
                this._pivot.set(value.x, value.y);
            } else {
                this._pivot.set(value[0], value[1]);
            }

            var mx = this._margin.data[0] + this._margin.data[2];
            var dx = this._pivot.x - prevX;
            this._margin.data[0] += mx * dx;
            this._margin.data[2] -= mx * dx;

            var my = this._margin.data[1] + this._margin.data[3];
            var dy = this._pivot.y - prevY;
            this._margin.data[1] += my * dy;
            this._margin.data[3] -= my * dy;

            this._anchorDirty = true;
            this._cornersDirty = true;
            this._worldCornersDirty = true;

            this._calculateSize();

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

            if (!this.entity._parent && !this.screen) {
                this._calculateLocalAnchors();
            } else {
                this._calculateSize(this._hasSplitAnchorsX, this._hasSplitAnchorsY);
            }

            this._anchorDirty = true;

            if (! this.entity._dirtyLocal)
                this.entity._dirtify(true);

            this.fire('set:anchor', this._anchor);
        }
    });

    Object.defineProperty(ElementComponent.prototype, "_hasSplitAnchorsX", {
        get: function () {
            return Math.abs(this._anchor.data[0] - this._anchor.data[2]) > 0.001;
        }
    });

    Object.defineProperty(ElementComponent.prototype, "_hasSplitAnchorsY", {
        get: function () {
            return Math.abs(this._anchor.data[1] - this._anchor.data[3]) > 0.001;
        }
    });

    // Returns the 4 corners of the element relative to its screen component.
    // Only works for elements that have a screen.
    // Order is bottom left, bottom right, top right, top left.
    Object.defineProperty(ElementComponent.prototype, 'screenCorners', {
        get: function () {
            if (! this._cornersDirty || ! this.screen)
                return this._screenCorners;

            var parentBottomLeft = this.entity.parent && this.entity.parent.element && this.entity.parent.element.screenCorners[0];

            // init corners
            this._screenCorners[0].set(this._absLeft, this._absBottom, 0);
            this._screenCorners[1].set(this._absRight, this._absBottom, 0);
            this._screenCorners[2].set(this._absRight, this._absTop, 0);
            this._screenCorners[3].set(this._absLeft, this._absTop, 0);

            // transform corners to screen space
            var screenSpace = this.screen.screen.screenSpace;
            for (var i = 0; i < 4; i++) {
                this._screenTransform.transformPoint(this._screenCorners[i], this._screenCorners[i]);
                if (screenSpace)
                    this._screenCorners[i].scale(this.screen.screen.scale);

                if (parentBottomLeft) {
                    this._screenCorners[i].add(parentBottomLeft);
                }
            }

            this._cornersDirty = false;
            this._canvasCornersDirty = true;
            this._worldCornersDirty = true;

            return this._screenCorners;

        }
    });

    // Returns the 4 corners of the element in canvas pixel space.
    // Only works for 2D elements.
    // Order of the corners is bottom left, bottom right, top right, top left.
    Object.defineProperty(ElementComponent.prototype, 'canvasCorners', {
        get: function () {
            if (! this._canvasCornersDirty || ! this.screen || ! this.screen.screen.screenSpace)
                return this._canvasCorners;

            var device = this.system.app.graphicsDevice;
            var screenCorners = this.screenCorners;
            var sx = device.canvas.clientWidth / device.width;
            var sy = device.canvas.clientHeight / device.height;

            // scale screen corners to canvas size and reverse y
            for (var i = 0; i < 4; i++) {
                this._canvasCorners[i].set(screenCorners[i].x * sx, (device.height - screenCorners[i].y) * sy);
            }

            this._canvasCornersDirty = false;

            return this._canvasCorners;
        }
    });

    // Returns the 4 corners of the element in world space. Only works
    // for 3D elements as the corners of 2D elements in world space will
    // always depend on the camera that is rendering them. Order of the corners is
    // bottom left, bottom right, top right, top left
    Object.defineProperty(ElementComponent.prototype, 'worldCorners', {
        get: function () {
            if (! this._worldCornersDirty) {
                return this._worldCorners;
            }

            if (this.screen) {
                var screenCorners = this.screenCorners;

                if (! this.screen.screen.screenSpace) {
                    matA.copy(this.screen.screen._screenMatrix);

                    // flip screen matrix along the horizontal axis
                    matA.data[13] = -matA.data[13];

                    // create transform that brings screen corners to world space
                    matA.mul2(this.screen.getWorldTransform(), matA);

                    // transform screen corners to world space
                    for (var i = 0; i < 4; i++) {
                        matA.transformPoint(screenCorners[i], this._worldCorners[i]);
                    }
                }
            } else {
                var localPos = this.entity.getLocalPosition();

                // rotate and scale around pivot
                matA.setTranslate(-localPos.x, -localPos.y, -localPos.z);
                matB.setTRS(pc.Vec3.ZERO, this.entity.getLocalRotation(), this.entity.getLocalScale());
                matC.setTranslate(localPos.x, localPos.y, localPos.z);

                matD.copy(this.entity.parent.getWorldTransform());
                matD.mul(matC).mul(matB).mul(matA);

                // bottom left
                vecA.set(localPos.x - this.pivot.x * this.calculatedWidth, localPos.y - this.pivot.y * this.calculatedHeight, localPos.z);
                matD.transformPoint(vecA, this._worldCorners[0]);

                // bottom right
                vecA.set(localPos.x + (1 - this.pivot.x) * this.calculatedWidth, localPos.y - this.pivot.y * this.calculatedHeight, localPos.z);
                matD.transformPoint(vecA, this._worldCorners[1]);

                // top right
                vecA.set(localPos.x + (1 - this.pivot.x) * this.calculatedWidth, localPos.y + (1 - this.pivot.y) * this.calculatedHeight, localPos.z);
                matD.transformPoint(vecA, this._worldCorners[2]);

                // top left
                vecA.set(localPos.x - this.pivot.x * this.calculatedWidth, localPos.y + (1 - this.pivot.y) * this.calculatedHeight, localPos.z);
                matD.transformPoint(vecA, this._worldCorners[3]);
            }


            this._worldCornersDirty = false;

            return this._worldCorners;

        }
    });

    Object.defineProperty(ElementComponent.prototype, "textWidth", {
        get: function () {
            return this._text ? this._text.width : 0;
        }
    });

    Object.defineProperty(ElementComponent.prototype, "textHeight", {
        get: function () {
            return this._text ? this._text.height : 0;
        }
    });


    Object.defineProperty(ElementComponent.prototype, "useInput", {
        get: function () {
            return this._useInput;
        },
        set: function (value) {
            if (this._useInput === value)
                return;

            this._useInput = value;

            if (this.system.app.elementInput) {
                if (value) {
                    if (this.enabled && this.entity.enabled) {
                        this.system.app.elementInput.addElement(this);
                    }
                } else {
                    this.system.app.elementInput.removeElement(this);
                }
            }

            this.fire('set:useInput', value);
        }
    });

    Object.defineProperty(ElementComponent.prototype, "batchGroupId", {
        get: function () {
            return this._batchGroupId;
        },
        set: function (value) {
            if (this._batchGroupId === value)
                return;

            if (this._batchGroupId >= 0) this.system.app.batcher._markGroupDirty(this._batchGroupId);
            if (value >= 0) this.system.app.batcher._markGroupDirty(value);

            if (value < 0 && this._batchGroupId >= 0 && this.enabled && this.entity.enabled) {
                // re-add model to scene, in case it was removed by batching
                if (this._image._model) {
                    this.addModelToLayers(this._image._model);
                } else if (this._text._model) {
                    this.addModelToLayers(this._text._model);
                }
            }

            this._batchGroupId = value;
        }
    });

    var _define = function (name) {
        Object.defineProperty(ElementComponent.prototype, name, {
            get: function () {
                if (this._text) {
                    return this._text[name];
                } else if (this._image) {
                    return this._image[name];
                }
                return null;
            },
            set: function (value) {
                if (this._text) {
                    this._text[name] = value;
                } else if (this._image) {
                    this._image[name] = value;
                }
            }
        });
    };

    _define("fontSize");
    _define("color");
    _define("font");
    _define("fontAsset");
    _define("spacing");
    _define("lineHeight");
    _define("wrapLines");
    _define("lines");
    _define("alignment");
    _define("autoWidth");
    _define("autoHeight");

    _define("text");
    _define("texture");
    _define("textureAsset");
    _define("material");
    _define("materialAsset");
    _define("sprite");
    _define("spriteAsset");
    _define("spriteFrame");
    _define("pixelsPerUnit");
    _define("opacity");
    _define("rect");
    _define("mask");

    return {
        ElementComponent: ElementComponent
    };
}());

// Events Documentation

/**
* @event
* @name pc.ElementComponent#mousedown
* @description Fired when the mouse is pressed while the cursor is on the component. Only fired when useInput is true.
* @param {pc.ElementMouseEvent} event The event
*/

/**
* @event
* @name pc.ElementComponent#mouseup
* @description Fired when the mouse is released while the cursor is on the component. Only fired when useInput is true.
* @param {pc.ElementMouseEvent} event The event
*/

/**
* @event
* @name pc.ElementComponent#mouseenter
* @description Fired when the mouse cursor enters the component. Only fired when useInput is true.
* @param {pc.ElementMouseEvent} event The event
*/
/**
* @event
* @name pc.ElementComponent#mouseleave
* @description Fired when the mouse cursor leaves the component. Only fired when useInput is true.
* @param {pc.ElementMouseEvent} event The event
*/
/**
* @event
* @name pc.ElementComponent#mousemove
* @description Fired when the mouse cursor is moved on the component. Only fired when useInput is true.
* @param {pc.ElementMouseEvent} event The event
*/

/**
* @event
* @name pc.ElementComponent#mousewheel
* @description Fired when the mouse wheel is scrolled on the component. Only fired when useInput is true.
* @param {pc.ElementMouseEvent} event The event
*/

/**
* @event
* @name pc.ElementComponent#click
* @description Fired when the mouse is pressed and released on the component or when a touch starts and ends on the component. Only fired when useInput is true.
* @param {pc.ElementMouseEvent|pc.ElementTouchEvent} event The event
*/

/**
* @event
* @name pc.ElementComponent#touchstart
* @description Fired when a touch starts on the component. Only fired when useInput is true.
* @param {pc.ElementTouchEvent} event The event
*/

/**
* @event
* @name pc.ElementComponent#touchend
* @description Fired when a touch ends on the component. Only fired when useInput is true.
* @param {pc.ElementTouchEvent} event The event
*/

/**
* @event
* @name pc.ElementComponent#touchmove
* @description Fired when a touch moves after it started touching the component. Only fired when useInput is true.
* @param {pc.ElementTouchEvent} event The event
*/

/**
* @event
* @name pc.ElementComponent#touchcancel
* @description Fired when a touch is cancelled on the component. Only fired when useInput is true.
* @param {pc.ElementTouchEvent} event The event
*/
