import { Mat4 } from '../../../math/mat4.js';
import { Vec2 } from '../../../math/vec2.js';
import { Vec3 } from '../../../math/vec3.js';
import { Vec4 } from '../../../math/vec4.js';

import { FUNC_ALWAYS, FUNC_EQUAL, STENCILOP_INCREMENT, STENCILOP_REPLACE } from '../../../graphics/constants.js';

import { LAYERID_UI } from '../../../scene/constants.js';
import { BatchGroup } from '../../../scene/batching/batch-group.js';
import { StencilParameters } from '../../../scene/stencil-parameters.js';

import { Entity } from '../../entity.js';

import { Component } from '../component.js';

import { ELEMENTTYPE_GROUP, ELEMENTTYPE_IMAGE, ELEMENTTYPE_TEXT } from './constants.js';
import { ImageElement } from './image-element.js';
import { TextElement } from './text-element.js';

// #if _DEBUG
var _debugLogging = false;
// #endif

var position = new Vec3();
var invParentWtm = new Mat4();

var vecA = new Vec3();
var vecB = new Vec3();
var matA = new Mat4();
var matB = new Mat4();
var matC = new Mat4();
var matD = new Mat4();

/**
 * @component
 * @class
 * @name ElementComponent
 * @augments Component
 * @classdesc ElementComponents are used to construct user interfaces. An ElementComponent's [type](#type)
 * property can be configured in 3 main ways: as a text element, as an image element or as a group element.
 * If the ElementComponent has a {@link ScreenComponent} ancestor in the hierarchy, it will be transformed
 * with respect to the coordinate system of the screen. If there is no {@link ScreenComponent} ancestor,
 * the ElementComponent will be transformed like any other entity.
 *
 * You should never need to use the ElementComponent constructor. To add an ElementComponent to a {@link Entity},
 * use {@link Entity#addComponent}:
 *
 * ~~~javascript
 * // Add an element component to an entity with the default options
 * let entity = pc.Entity();
 * entity.addComponent("element"); // This defaults to a 'group' element
 * ~~~
 *
 * To create a simple text-based element:
 *
 * ~~~javascript
 * entity.addComponent("element", {
 *     anchor: new pc.Vec4(0.5, 0.5, 0.5, 0.5), // centered anchor
 *     fontAsset: fontAsset,
 *     fontSize: 128,
 *     pivot: new pc.Vec2(0.5, 0.5),            // centered pivot
 *     text: "Hello World!",
 *     type: pc.ELEMENTTYPE_TEXT
 * });
 * ~~~
 *
 * Once the ElementComponent is added to the entity, you can set and get any of its properties:
 *
 * ~~~javascript
 * entity.element.color = pc.Color.RED; // Set the element's color to red
 *
 * console.log(entity.element.color);   // Get the element's color and print it
 * ~~~
 *
 * Relevant 'Engine-only' examples:
 * * [Basic text rendering](http://playcanvas.github.io/#user-interface/text-basic.html)
 * * [Rendering text outlines](http://playcanvas.github.io/#user-interface/text-outline.html)
 * * [Adding drop shadows to text](http://playcanvas.github.io/#user-interface/text-drop-shadow.html)
 * * [Coloring text with markup](http://playcanvas.github.io/#user-interface/text-markup.html)
 * * [Wrapping text](http://playcanvas.github.io/#user-interface/text-wrap.html)
 * * [Typewriter text](http://playcanvas.github.io/#user-interface/text-typewriter.html)
 *
 * @param {ElementComponentSystem} system - The ComponentSystem that created this Component.
 * @param {Entity} entity - The Entity that this Component is attached to.
 * @property {string} type The type of the ElementComponent. Can be:
 *
 * * {@link ELEMENTTYPE_GROUP}: The component can be used as a layout mechanism to create groups of ElementComponents e.g. panels.
 * * {@link ELEMENTTYPE_IMAGE}: The component will render an image
 * * {@link ELEMENTTYPE_TEXT}: The component will render text
 *
 * @property {Entity} screen The Entity with a {@link ScreenComponent} that this component belongs to. This is automatically set when the component is a child of a ScreenComponent.
 * @property {number} drawOrder The draw order of the component. A higher value means that the component will be rendered on top of other components.
 * @property {Vec4} anchor Specifies where the left, bottom, right and top edges of the component are anchored relative to its parent. Each value
 * ranges from 0 to 1. E.g. a value of [0,0,0,0] means that the element will be anchored to the bottom left of its parent. A value of [1, 1, 1, 1] means
 * it will be anchored to the top right. A split anchor is when the left-right or top-bottom pairs of the anchor are not equal. In that case the component will be resized to cover that entire area. E.g. a value of [0,0,1,1] will make the component resize exactly as its parent.
 * @property {Vec2} pivot The position of the pivot of the component relative to its anchor. Each value ranges from 0 to 1 where [0,0] is the bottom left and [1,1] is the top right.
 * @property {Vec4} margin The distance from the left, bottom, right and top edges of the anchor. For example if we are using a split anchor like [0,0,1,1] and the margin is [0,0,0,0] then the component will be the same width and height as its parent.
 * @property {number} left The distance from the left edge of the anchor. Can be used in combination with a split anchor to make the component's left edge always be 'left' units away from the left.
 * @property {number} right The distance from the right edge of the anchor. Can be used in combination with a split anchor to make the component's right edge always be 'right' units away from the right.
 * @property {number} bottom The distance from the bottom edge of the anchor. Can be used in combination with a split anchor to make the component's top edge always be 'top' units away from the top.
 * @property {number} top The distance from the top edge of the anchor. Can be used in combination with a split anchor to make the component's bottom edge always be 'bottom' units away from the bottom.
 * @property {number} width The width of the element as set in the editor. Note that in some cases this may not reflect the true width at which the element is rendered, such as when the element is under the control of a {@link LayoutGroupComponent}. See `calculatedWidth` in order to ensure you are reading the true width at which the element will be rendered.
 * @property {number} height The height of the element as set in the editor. Note that in some cases this may not reflect the true height at which the element is rendered, such as when the element is under the control of a {@link LayoutGroupComponent}. See `calculatedHeight` in order to ensure you are reading the true height at which the element will be rendered.
 * @property {number} calculatedWidth The width at which the element will be rendered. In most cases this will be the same as `width`. However, in some cases the engine may calculate a different width for the element, such as when the element is under the control of a {@link LayoutGroupComponent}. In these scenarios, `calculatedWidth` may be smaller or larger than the width that was set in the editor.
 * @property {number} calculatedHeight The height at which the element will be rendered. In most cases this will be the same as `height`. However, in some cases the engine may calculate a different height for the element, such as when the element is under the control of a {@link LayoutGroupComponent}. In these scenarios, `calculatedHeight` may be smaller or larger than the height that was set in the editor.
 * @property {Vec3[]} screenCorners An array of 4 {@link Vec3}s that represent the bottom left, bottom right, top right and top left corners of the component relative to its parent {@link ScreenComponent}.
 * @property {Vec3[]} worldCorners An array of 4 {@link Vec3}s that represent the bottom left, bottom right, top right and top left corners of the component in world space. Only works for 3D ElementComponents.
 * @property {Vec2[]} canvasCorners An array of 4 {@link Vec2}s that represent the bottom left, bottom right, top right and top left corners of the component in canvas pixels. Only works for screen space ElementComponents.
 * @property {boolean} useInput If true then the component will receive Mouse or Touch input events.
 * @property {Color} color The color of the image for {@link ELEMENTTYPE_IMAGE} types or the color of the text for {@link ELEMENTTYPE_TEXT} types.
 * @property {number} opacity The opacity of the image for {@link ELEMENTTYPE_IMAGE} types or the text for {@link ELEMENTTYPE_TEXT} types.
 * @property {Color} outlineColor The text outline effect color and opacity. Only works for {@link ELEMENTTYPE_TEXT} types.
 * @property {number} outlineThickness The width of the text outline effect. Only works for {@link ELEMENTTYPE_TEXT} types.
 * @property {Color} shadowColor The text shadow effect color and opacity. Only works for {@link ELEMENTTYPE_TEXT} types.
 * @property {Vec2} shadowOffset The text shadow effect shift amount from original text. Only works for {@link ELEMENTTYPE_TEXT} types.
 * @property {number} textWidth The width of the text rendered by the component. Only works for {@link ELEMENTTYPE_TEXT} types.
 * @property {number} textHeight The height of the text rendered by the component. Only works for {@link ELEMENTTYPE_TEXT} types.
 * @property {boolean} autoWidth Automatically set the width of the component to be the same as the textWidth. Only works for {@link ELEMENTTYPE_TEXT} types.
 * @property {boolean} autoHeight Automatically set the height of the component to be the same as the textHeight. Only works for {@link ELEMENTTYPE_TEXT} types.
 * @property {number} fontAsset The id of the font asset used for rendering the text. Only works for {@link ELEMENTTYPE_TEXT} types.
 * @property {Font} font The font used for rendering the text. Only works for {@link ELEMENTTYPE_TEXT} types.
 * @property {number} fontSize The size of the font. Only works for {@link ELEMENTTYPE_TEXT} types.
 * @property {boolean} autoFitWidth When true the font size and line height will scale so that the text fits inside the width of the Element. The font size will be scaled between minFontSize and maxFontSize. The value of autoFitWidth will be ignored if autoWidth is true.
 * @property {boolean} autoFitHeight When true the font size and line height will scale so that the text fits inside the height of the Element. The font size will be scaled between minFontSize and maxFontSize. The value of autoFitHeight will be ignored if autoHeight is true.
 * @property {number} minFontSize The minimum size that the font can scale to when autoFitWidth or autoFitHeight are true.
 * @property {number} maxFontSize The maximum size that the font can scale to when autoFitWidth or autoFitHeight are true.
 * @property {number} spacing The spacing between the letters of the text. Only works for {@link ELEMENTTYPE_TEXT} types.
 * @property {number} lineHeight The height of each line of text. Only works for {@link ELEMENTTYPE_TEXT} types.
 * @property {boolean} wrapLines Whether to automatically wrap lines based on the element width. Only works for {@link ELEMENTTYPE_TEXT} types, and when autoWidth is set to false.
 * @property {number} maxLines The maximum number of lines that the Element can wrap to. Any leftover text will be appended to the last line. Set this to null to allow unlimited lines.
 * @property {Vec2} alignment The horizontal and vertical alignment of the text. Values range from 0 to 1 where [0,0] is the bottom left and [1,1] is the top right.  Only works for {@link ELEMENTTYPE_TEXT} types.
 * @property {string} text The text to render. Only works for {@link ELEMENTTYPE_TEXT} types.
 * @property {string} key The localization key to use to get the localized text from {@link Application#i18n}. Only works for {@link ELEMENTTYPE_TEXT} types.
 * @property {number} textureAsset The id of the texture asset to render. Only works for {@link ELEMENTTYPE_IMAGE} types.
 * @property {Texture} texture The texture to render. Only works for {@link ELEMENTTYPE_IMAGE} types.
 * @property {number} spriteAsset The id of the sprite asset to render. Only works for {@link ELEMENTTYPE_IMAGE} types which can render either a texture or a sprite.
 * @property {Sprite} sprite The sprite to render. Only works for {@link ELEMENTTYPE_IMAGE} types which can render either a texture or a sprite.
 * @property {number} spriteFrame The frame of the sprite to render. Only works for {@link ELEMENTTYPE_IMAGE} types who have a sprite assigned.
 * @property {number} pixelsPerUnit The number of pixels that map to one PlayCanvas unit. Only works for {@link ELEMENTTYPE_IMAGE} types who have a sliced sprite assigned.
 * @property {number} materialAsset The id of the material asset to use when rendering an image. Only works for {@link ELEMENTTYPE_IMAGE} types.
 * @property {Material} material The material to use when rendering an image. Only works for {@link ELEMENTTYPE_IMAGE} types.
 * @property {Vec4} rect Specifies which region of the texture to use in order to render an image. Values range from 0 to 1 and indicate u, v, width, height. Only works for {@link ELEMENTTYPE_IMAGE} types.
 * @property {boolean} rtlReorder Reorder the text for RTL languages using a function registered by `app.systems.element.registerUnicodeConverter`.
 * @property {boolean} unicodeConverter Convert unicode characters using a function registered by `app.systems.element.registerUnicodeConverter`.
 * @property {number} batchGroupId Assign element to a specific batch group (see {@link BatchGroup}). Default value is -1 (no group).
 * @property {number[]} layers An array of layer IDs ({@link Layer#id}) to which this element should belong.
 * Don't push/pop/splice or modify this array, if you want to change it - set a new one instead.
 * @property {boolean} enableMarkup Flag for enabling markup processing. Only works for {@link ELEMENTTYPE_TEXT} types. The only supported tag is `[color]` with a hex color value. E.g `[color="#ff0000"]red text[/color]`
 * @property {number} rangeStart Index of the first character to render. Only works for {@link ELEMENTTYPE_TEXT} types.
 * @property {number} rangeEnd Index of the last character to render. Only works for {@link ELEMENTTYPE_TEXT} types.
 * @property {boolean} mask Switch Image Element into a mask. Masks do not render into the scene, but instead limit child elements to only be rendered where this element is rendered.
 */
class ElementComponent extends Component {
    constructor(system, entity) {
        super(system, entity);

        // set to true by the ElementComponentSystem while
        // the component is being initialized
        this._beingInitialized = false;

        this._anchor = new Vec4();
        this._localAnchor = new Vec4();

        this._pivot = new Vec2();

        this._width = this._calculatedWidth = 32;
        this._height = this._calculatedHeight = 32;

        this._margin = new Vec4(0, 0, -32, -32);

        // the model transform used to render
        this._modelTransform = new Mat4();

        this._screenToWorld = new Mat4();

        // transform that updates local position according to anchor values
        this._anchorTransform = new Mat4();

        this._anchorDirty = true;

        // transforms to calculate screen coordinates
        this._parentWorldTransform = new Mat4();
        this._screenTransform = new Mat4();

        // the corners of the element relative to its screen component.
        // Order is bottom left, bottom right, top right, top left
        this._screenCorners = [new Vec3(), new Vec3(), new Vec3(), new Vec3()];

        // canvas-space corners of the element.
        // Order is bottom left, bottom right, top right, top left
        this._canvasCorners = [new Vec2(), new Vec2(), new Vec2(), new Vec2()];

        // the world-space corners of the element
        // Order is bottom left, bottom right, top right, top left
        this._worldCorners = [new Vec3(), new Vec3(), new Vec3(), new Vec3()];

        this._cornersDirty = true;
        this._canvasCornersDirty = true;
        this._worldCornersDirty = true;

        this.entity.on('insert', this._onInsert, this);

        this._patch();

        this.screen = null;

        this._type = ELEMENTTYPE_GROUP;

        // element types
        this._image = null;
        this._text = null;
        this._group = null;

        this._drawOrder = 0;

        // input related
        this._useInput = false;

        this._layers = [LAYERID_UI]; // assign to the default UI layer
        this._addedModels = []; // store models that have been added to layer so we can re-add when layer is changed

        this._batchGroupId = -1;
        // #if _DEBUG
        this._batchGroup = null;
        // #endif
        //

        this._offsetReadAt = 0;
        this._maskOffset = 0.5;
        this._maskedBy = null; // the entity that is masking this element
    }

    _patch() {
        this.entity._sync = this._sync;
        this.entity.setPosition = this._setPosition;
        this.entity.setLocalPosition = this._setLocalPosition;
    }

    _unpatch() {
        this.entity._sync = Entity.prototype._sync;
        this.entity.setPosition = Entity.prototype.setPosition;
        this.entity.setLocalPosition = Entity.prototype.setLocalPosition;
    }

    _setPosition(x, y, z) {
        if (!this.element.screen)
            return Entity.prototype.setPosition.call(this, x, y, z);

        if (x instanceof Vec3) {
            position.copy(x);
        } else {
            position.set(x, y, z);
        }

        this.getWorldTransform(); // ensure hierarchy is up to date
        invParentWtm.copy(this.element._screenToWorld).invert();
        invParentWtm.transformPoint(position, this.localPosition);

        if (!this._dirtyLocal)
            this._dirtifyLocal();
    }

    _setLocalPosition(x, y, z) {
        if (x instanceof Vec3) {
            this.localPosition.copy(x);
        } else {
            this.localPosition.set(x, y, z);
        }

        // update margin
        var element = this.element;
        var p = this.localPosition;
        var pvt = element._pivot;
        element._margin.x = p.x - element._calculatedWidth * pvt.x;
        element._margin.z = (element._localAnchor.z - element._localAnchor.x) - element._calculatedWidth - element._margin.x;
        element._margin.y = p.y - element._calculatedHeight * pvt.y;
        element._margin.w = (element._localAnchor.w - element._localAnchor.y) - element._calculatedHeight - element._margin.y;

        if (!this._dirtyLocal)
            this._dirtifyLocal();
    }

    // this method overwrites GraphNode#sync and so operates in scope of the Entity.
    _sync() {
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
                } else {
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
                element._calculateSize(false, false);
            }
        }

        if (this._dirtyLocal) {
            this.localTransform.setTRS(this.localPosition, this.localRotation, this.localScale);

            // update margin
            var p = this.localPosition;
            var pvt = element._pivot;
            element._margin.x = p.x - element._calculatedWidth * pvt.x;
            element._margin.z = (element._localAnchor.z - element._localAnchor.x) - element._calculatedWidth - element._margin.x;
            element._margin.y = p.y - element._calculatedHeight * pvt.y;
            element._margin.w = (element._localAnchor.w - element._localAnchor.y) - element._calculatedHeight - element._margin.y;

            this._dirtyLocal = false;
        }

        if (!screen) {
            if (this._dirtyWorld) {
                element._cornersDirty = true;
                element._canvasCornersDirty = true;
                element._worldCornersDirty = true;
            }

            return Entity.prototype._sync.call(this);
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
                        matA.setTRS(Vec3.ZERO, parent.getLocalRotation(), parent.getLocalScale());
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
    }

    _onInsert(parent) {
        // when the entity is reparented find a possible new screen and mask

        var result = this._parseUpToScreen();

        this.entity._dirtifyWorld();

        this._updateScreen(result.screen);

        this._dirtifyMask();
    }

    _dirtifyMask() {
        var current = this.entity;
        while (current) {
            // search up the hierarchy until we find an entity which has:
            // - no parent
            // - screen component on parent
            var next = current.parent;
            if ((next === null || next.screen) && current.element) {
                if (!this.system._prerender || !this.system._prerender.length) {
                    this.system._prerender = [];
                    this.system.app.once('prerender', this._onPrerender, this);

                    // #if _DEBUG
                    if (_debugLogging) console.log('register prerender');
                    // #endif
                }
                var i = this.system._prerender.indexOf(this.entity);
                if (i >= 0) {
                    this.system._prerender.splice(i, 1);
                }
                var j = this.system._prerender.indexOf(current);
                if (j < 0) {
                    this.system._prerender.push(current);
                }
                // #if _DEBUG
                if (_debugLogging) console.log('set prerender root to: ' + current.name);
                // #endif
            }

            current = next;
        }
    }

    _onPrerender() {
        for (var i = 0; i < this.system._prerender.length; i++) {
            var mask = this.system._prerender[i];
            // #if _DEBUG
            if (_debugLogging) console.log('prerender from: ' + mask.name);
            // #endif

            // prevent call if element has been removed since being added
            if (mask.element) {
                var depth = 1;
                mask.element.syncMask(depth);
            }
        }

        this.system._prerender.length = 0;
    }

    _bindScreen(screen) {
        // Bind the Element to the Screen. We used to subscribe to Screen events here. However,
        // that was very slow when there are thousands of Elements. When the time comes to unbind
        // the Element from the Screen, finding the event callbacks to remove takes a considerable
        // amount of time. So instead, the Screen stores the Element component and calls its
        // functions directly.
        screen._bindElement(this);
    }

    _unbindScreen(screen) {
        screen._unbindElement(this);
    }

    _updateScreen(screen) {
        if (this.screen && this.screen !== screen) {
            this._unbindScreen(this.screen.screen);
        }

        var previousScreen = this.screen;
        this.screen = screen;
        if (this.screen) {
            this._bindScreen(this.screen.screen);
        }

        this._calculateSize(this._hasSplitAnchorsX, this._hasSplitAnchorsY);

        this.fire('set:screen', this.screen, previousScreen);

        this._anchorDirty = true;

        // update all child screens
        var children = this.entity.children;
        for (var i = 0, l = children.length; i < l; i++) {
            if (children[i].element) children[i].element._updateScreen(screen);
        }

        // calculate draw order
        if (this.screen) this.screen.screen.syncDrawOrder();
    }

    syncMask(depth) {
        var result = this._parseUpToScreen();
        this._updateMask(result.mask, depth);
    }

    // set the maskedby property to the entity that is masking this element
    // - set the stencil buffer to check the mask value
    //   so as to only render inside the mask
    //   Note: if this entity is itself a mask the stencil params
    //   will be updated in updateMask to include masking
    _setMaskedBy(mask) {
        var renderableElement = this._image || this._text;

        if (mask) {
            var ref = mask.element._image._maskRef;
            // #if _DEBUG
            if (_debugLogging) console.log("masking: " + this.entity.name + " with " + ref);
            // #endif

            var sp = new StencilParameters({
                ref: ref,
                func: FUNC_EQUAL
            });

            // if this is image or text, set the stencil parameters
            if (renderableElement && renderableElement._setStencil) {
                renderableElement._setStencil(sp);
            }

            this._maskedBy = mask;
        } else {
            // #if _DEBUG
            if (_debugLogging) console.log("no masking on: " + this.entity.name);
            // #endif

            // remove stencil params if this is image or text
            if (renderableElement && renderableElement._setStencil) {
                renderableElement._setStencil(null);
            }
            this._maskedBy = null;
        }
    }

    // recursively update entity's stencil params
    // to render the correct value into the stencil buffer
    _updateMask(currentMask, depth) {
        var i, l, sp, children;

        if (currentMask) {
            this._setMaskedBy(currentMask);

            // this element is also masking others
            if (this.mask) {
                var ref = currentMask.element._image._maskRef;
                sp = new StencilParameters({
                    ref: ref,
                    func: FUNC_EQUAL,
                    zpass: STENCILOP_INCREMENT
                });
                this._image._setStencil(sp);
                this._image._maskRef = depth;

                // increment counter to count mask depth
                depth++;

                // #if _DEBUG
                if (_debugLogging) {
                    console.log("masking from: " + this.entity.name + " with " + (sp.ref + 1));
                    console.log("depth++ to: ", depth);
                }
                // #endif

                currentMask = this.entity;
            }

            // recurse through all children
            children = this.entity.children;
            for (i = 0, l = children.length; i < l; i++) {
                if (children[i].element) {
                    children[i].element._updateMask(currentMask, depth);
                }
            }

            // if mask counter was increased, decrement it as we come back up the hierarchy
            if (this.mask) depth--;

        } else {
            // clearing mask
            this._setMaskedBy(null);

            if (this.mask) {
                sp = new StencilParameters({
                    ref: depth,
                    func: FUNC_ALWAYS,
                    zpass: STENCILOP_REPLACE
                });
                this._image._setStencil(sp);
                this._image._maskRef = depth;

                // increment mask counter to count depth of masks
                depth++;

                // #if _DEBUG
                if (_debugLogging) {
                    console.log("masking from: " + this.entity.name + " with " + sp.ref);
                    console.log("depth++ to: ", depth);
                }
                // #endif

                currentMask = this.entity;
            }

            // recurse through all children
            children = this.entity.children;
            for (i = 0, l = children.length; i < l; i++) {
                if (children[i].element) {
                    children[i].element._updateMask(currentMask, depth);
                }
            }

            // decrement mask counter as we come back up the hierarchy
            if (this.mask) depth--;
        }
    }

    // search up the parent hierarchy until we reach a screen
    // this screen is the parent screen
    // also searches for masked elements to get the relevant mask
    _parseUpToScreen() {
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
    }

    _onScreenResize(res) {
        this._anchorDirty = true;
        this._cornersDirty = true;
        this._worldCornersDirty = true;

        this._calculateSize(this._hasSplitAnchorsX, this._hasSplitAnchorsY);

        this.fire('screen:set:resolution', res);
    }

    _onScreenSpaceChange() {
        this.fire('screen:set:screenspace', this.screen.screen.screenSpace);
    }

    _onScreenRemove() {
        if (this.screen) {
            if (this.screen._destroying) {
                // If the screen entity is being destroyed, we don't call
                // _updateScreen() as an optimization but we should still
                // set it to null to clean up dangling references
                this.screen = null;
            } else {
                this._updateScreen(null);
            }
        }
    }

    // store pixel positions of anchor relative to current parent resolution
    _calculateLocalAnchors() {
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
    }

    // internal - apply offset x,y to local position and find point in world space
    getOffsetPosition(x, y) {
        var p = this.entity.getLocalPosition().clone();

        p.x += x;
        p.y += y;

        this._screenToWorld.transformPoint(p, p);

        return p;
    }

    onLayersChanged(oldComp, newComp) {
        this.addModelToLayers(this._image ? this._image._renderable.model : this._text._model);
        oldComp.off("add", this.onLayerAdded, this);
        oldComp.off("remove", this.onLayerRemoved, this);
        newComp.on("add", this.onLayerAdded, this);
        newComp.on("remove", this.onLayerRemoved, this);
    }

    onLayerAdded(layer) {
        var index = this.layers.indexOf(layer.id);
        if (index < 0) return;
        if (this._image) {
            layer.addMeshInstances(this._image._renderable.model.meshInstances);
        } else if (this._text) {
            layer.addMeshInstances(this._text._model.meshInstances);
        }
    }

    onLayerRemoved(layer) {
        var index = this.layers.indexOf(layer.id);
        if (index < 0) return;
        if (this._image) {
            layer.removeMeshInstances(this._image._renderable.model.meshInstances);
        } else if (this._text) {
            layer.removeMeshInstances(this._text._model.meshInstances);
        }
    }

    onEnable() {
        if (this._image) this._image.onEnable();
        if (this._text) this._text.onEnable();
        if (this._group) this._group.onEnable();

        if (this.useInput && this.system.app.elementInput) {
            this.system.app.elementInput.addElement(this);
        }

        this.system.app.scene.on("set:layers", this.onLayersChanged, this);
        if (this.system.app.scene.layers) {
            this.system.app.scene.layers.on("add", this.onLayerAdded, this);
            this.system.app.scene.layers.on("remove", this.onLayerRemoved, this);
        }

        if (this._batchGroupId >= 0) {
            this.system.app.batcher.insert(BatchGroup.ELEMENT, this.batchGroupId, this.entity);
        }

        this.fire("enableelement");
    }

    onDisable() {
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

        if (this._batchGroupId >= 0) {
            this.system.app.batcher.remove(BatchGroup.ELEMENT, this.batchGroupId, this.entity);
        }

        this.fire("disableelement");
    }

    onRemove() {
        this.entity.off('insert', this._onInsert, this);
        this._unpatch();
        if (this._image) this._image.destroy();
        if (this._text) this._text.destroy();

        if (this.system.app.elementInput && this.useInput) {
            this.system.app.elementInput.removeElement(this);
        }

        // if there is a screen, update draw-order
        if (this.screen && this.screen.screen) {
            this._unbindScreen(this.screen.screen);
            this.screen.screen.syncDrawOrder();
        }

        this.off();
    }

    // recalculates
    // localAnchor, width, height, (local position is updated if anchors are split)
    // assumes these properties are up to date
    // _margin
    _calculateSize(propagateCalculatedWidth, propagateCalculatedHeight) {
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
        p.x = this._margin.x + this._calculatedWidth * this._pivot.x;
        p.y = this._margin.y + this._calculatedHeight * this._pivot.y;

        this.entity.setLocalPosition(p);

        this._sizeDirty = false;
    }

    // internal set width without updating margin
    _setWidth(w) {
        this._width = w;
        this._setCalculatedWidth(w, false);

        this.fire('set:width', this._width);
    }

    // internal set height without updating margin
    _setHeight(h) {
        this._height = h;
        this._setCalculatedHeight(h, false);

        this.fire('set:height', this._height);
    }

    _setCalculatedWidth(value, updateMargins) {
        if (Math.abs(value - this._calculatedWidth) <= 1e-4)
            return;

        this._calculatedWidth = value;
        this.entity._dirtifyLocal();

        if (updateMargins) {
            var p = this.entity.getLocalPosition();
            var pvt = this._pivot;
            this._margin.x = p.x - this._calculatedWidth * pvt.x;
            this._margin.z = (this._localAnchor.z - this._localAnchor.x) - this._calculatedWidth - this._margin.x;
        }

        this._flagChildrenAsDirty();
        this.fire('set:calculatedWidth', this._calculatedWidth);
        this.fire('resize', this._calculatedWidth, this._calculatedHeight);
    }

    _setCalculatedHeight(value, updateMargins) {
        if (Math.abs(value - this._calculatedHeight) <= 1e-4)
            return;

        this._calculatedHeight = value;
        this.entity._dirtifyLocal();

        if (updateMargins) {
            var p = this.entity.getLocalPosition();
            var pvt = this._pivot;
            this._margin.y = p.y - this._calculatedHeight * pvt.y;
            this._margin.w = (this._localAnchor.w - this._localAnchor.y) - this._calculatedHeight - this._margin.y;
        }

        this._flagChildrenAsDirty();
        this.fire('set:calculatedHeight', this._calculatedHeight);
        this.fire('resize', this._calculatedWidth, this._calculatedHeight);
    }

    _flagChildrenAsDirty() {
        var i, l;
        var c = this.entity._children;
        for (i = 0, l = c.length; i < l; i++) {
            if (c[i].element) {
                c[i].element._anchorDirty = true;
                c[i].element._sizeDirty = true;
            }
        }
    }

    addModelToLayers(model) {
        var layer;
        this._addedModels.push(model);
        for (var i = 0; i < this.layers.length; i++) {
            layer = this.system.app.scene.layers.getLayerById(this.layers[i]);
            if (!layer) continue;
            layer.addMeshInstances(model.meshInstances);
        }
    }

    removeModelFromLayers(model) {
        var layer;
        var idx = this._addedModels.indexOf(model);
        if (idx >= 0) {
            this._addedModels.splice(idx, 1);
        }
        for (var i = 0; i < this.layers.length; i++) {
            layer = this.system.app.scene.layers.getLayerById(this.layers[i]);
            if (!layer) continue;
            layer.removeMeshInstances(model.meshInstances);
        }
    }

    getMaskOffset() {
        // reset offset on new frame
        // we always count offset down from 0.5
        var frame = this.system.app.frame;
        if (this._offsetReadAt !== frame) {
            this._maskOffset = 0.5;
            this._offsetReadAt = frame;
        }
        var mo = this._maskOffset;
        this._maskOffset -= 0.001;
        return mo;
    }

    isVisibleForCamera(camera) {
        var clipL, clipR, clipT, clipB;

        if (this.maskedBy) {
            var corners = this.maskedBy.element.screenCorners;

            clipL = Math.min(Math.min(corners[0].x, corners[1].x), Math.min(corners[2].x, corners[3].x));
            clipR = Math.max(Math.max(corners[0].x, corners[1].x), Math.max(corners[2].x, corners[3].x));
            clipB = Math.min(Math.min(corners[0].y, corners[1].y), Math.min(corners[2].y, corners[3].y));
            clipT = Math.max(Math.max(corners[0].y, corners[1].y), Math.max(corners[2].y, corners[3].y));
        } else {
            var sw = this.system.app.graphicsDevice.width;
            var sh = this.system.app.graphicsDevice.height;

            var cameraWidth = camera._rect.z * sw;
            var cameraHeight = camera._rect.w * sh;
            clipL = camera._rect.x * sw;
            clipR = clipL + cameraWidth;
            clipT = (1 - camera._rect.y) * sh;
            clipB = clipT - cameraHeight;
        }

        var hitCorners = this.screenCorners;

        var left = Math.min(Math.min(hitCorners[0].x, hitCorners[1].x), Math.min(hitCorners[2].x, hitCorners[3].x));
        var right = Math.max(Math.max(hitCorners[0].x, hitCorners[1].x), Math.max(hitCorners[2].x, hitCorners[3].x));
        var bottom = Math.min(Math.min(hitCorners[0].y, hitCorners[1].y), Math.min(hitCorners[2].y, hitCorners[3].y));
        var top = Math.max(Math.max(hitCorners[0].y, hitCorners[1].y), Math.max(hitCorners[2].y, hitCorners[3].y));

        if (right < clipL ||
            left > clipR ||
            bottom > clipT ||
            top < clipB) {
            return false;
        }

        return true;
    }

    _isScreenSpace() {
        if (this.screen && this.screen.screen) {
            return this.screen.screen.screenSpace;
        }

        return false;
    }

    _isScreenCulled() {
        if (this.screen && this.screen.screen) {
            return this.screen.screen.cull;
        }

        return false;
    }
}

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

            if (value === ELEMENTTYPE_IMAGE) {
                this._image = new ImageElement(this);
            } else if (value === ELEMENTTYPE_TEXT) {
                this._text = new TextElement(this);
            }
        }
    }
});

Object.defineProperty(ElementComponent.prototype, "layers", {
    get: function () {
        return this._layers;
    },

    set: function (value) {
        var i, j, layer;

        if (this._addedModels.length) {
            for (i = 0; i < this._layers.length; i++) {
                layer = this.system.app.scene.layers.getLayerById(this._layers[i]);
                if (layer) {
                    for (j = 0; j < this._addedModels.length; j++) {
                        layer.removeMeshInstances(this._addedModels[j].meshInstances);
                    }
                }
            }
        }

        this._layers = value;

        if (!this.enabled || !this.entity.enabled || !this._addedModels.length) return;

        for (i = 0; i < this._layers.length; i++) {
            layer = this.system.app.scene.layers.getLayerById(this._layers[i]);
            if (layer) {
                for (j = 0; j < this._addedModels.length; j++) {
                    layer.addMeshInstances(this._addedModels[j].meshInstances);
                }
            }
        }
    }
});

Object.defineProperty(ElementComponent.prototype, "drawOrder", {
    get: function () {
        return this._drawOrder;
    },

    set: function (value) {
        var priority = 0;
        if (this.screen) {
            priority = this.screen.screen.priority;
        }

        if (value > 0xFFFFFF) {
            // #if _DEBUG
            console.warn("Element.drawOrder larger than max size of: " + 0xFFFFFF);
            // #endif
            value = 0xFFFFFF;
        }

        // screen priority is stored in the top 8 bits
        this._drawOrder = (priority << 24) + value;
        this.fire('set:draworder', this._drawOrder);
    }
});

Object.defineProperty(ElementComponent.prototype, "_absLeft", {
    get: function () {
        return this._localAnchor.x + this._margin.x;
    }
});

Object.defineProperty(ElementComponent.prototype, "_absRight", {
    get: function () {
        return this._localAnchor.z - this._margin.z;
    }
});

Object.defineProperty(ElementComponent.prototype, "_absTop", {
    get: function () {
        return this._localAnchor.w - this._margin.w;
    }
});

Object.defineProperty(ElementComponent.prototype, "_absBottom", {
    get: function () {
        return this._localAnchor.y + this._margin.y;
    }
});

Object.defineProperty(ElementComponent.prototype, "margin", {
    get: function () {
        return this._margin;
    },

    set: function (value) {
        this._margin.copy(value);
        this._calculateSize(true, true);
        this.fire('set:margin', this._margin);
    }
});

Object.defineProperty(ElementComponent.prototype, "left", {
    get: function () {
        return this._margin.x;
    },

    set: function (value) {
        this._margin.x = value;
        var p = this.entity.getLocalPosition();
        var wr = this._absRight;
        var wl = this._localAnchor.x + value;
        this._setWidth(wr - wl);

        p.x = value + this._calculatedWidth * this._pivot.x;
        this.entity.setLocalPosition(p);
    }
});

Object.defineProperty(ElementComponent.prototype, "right", {
    get: function () {
        return this._margin.z;
    },

    set: function (value) {
        this._margin.z = value;

        // update width
        var p = this.entity.getLocalPosition();
        var wl = this._absLeft;
        var wr = this._localAnchor.z - value;
        this._setWidth(wr - wl);

        // update position
        p.x = (this._localAnchor.z - this._localAnchor.x) - value - (this._calculatedWidth * (1 - this._pivot.x));
        this.entity.setLocalPosition(p);
    }
});

Object.defineProperty(ElementComponent.prototype, "top", {
    get: function () {
        return this._margin.w;
    },

    set: function (value) {
        this._margin.w = value;
        var p = this.entity.getLocalPosition();
        var wb = this._absBottom;
        var wt = this._localAnchor.w - value;
        this._setHeight(wt - wb);

        p.y = (this._localAnchor.w - this._localAnchor.y) - value - this._calculatedHeight * (1 - this._pivot.y);
        this.entity.setLocalPosition(p);
    }
});

Object.defineProperty(ElementComponent.prototype, "bottom", {
    get: function () {
        return this._margin.y;
    },

    set: function (value) {
        this._margin.y = value;
        var p = this.entity.getLocalPosition();
        var wt = this._absTop;
        var wb = this._localAnchor.y + value;
        this._setHeight(wt - wb);

        p.y = value + this._calculatedHeight * this._pivot.y;
        this.entity.setLocalPosition(p);
    }
});

Object.defineProperty(ElementComponent.prototype, "width", {
    get: function () {
        return this._width;
    },

    set: function (value) {
        this._width = value;

        if (!this._hasSplitAnchorsX) {
            this._setCalculatedWidth(value, true);
        }

        this.fire('set:width', this._width);
    }
});

Object.defineProperty(ElementComponent.prototype, "height", {
    get: function () {
        return this._height;
    },

    set: function (value) {
        this._height = value;

        if (!this._hasSplitAnchorsY) {
            this._setCalculatedHeight(value, true);
        }

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

        if (value instanceof Vec2) {
            this._pivot.set(value.x, value.y);
        } else {
            this._pivot.set(value[0], value[1]);
        }

        var mx = this._margin.x + this._margin.z;
        var dx = this._pivot.x - prevX;
        this._margin.x += mx * dx;
        this._margin.z -= mx * dx;

        var my = this._margin.y + this._margin.w;
        var dy = this._pivot.y - prevY;
        this._margin.y += my * dy;
        this._margin.w -= my * dy;

        this._anchorDirty = true;
        this._cornersDirty = true;
        this._worldCornersDirty = true;

        this._calculateSize(false, false);

        // we need to flag children as dirty too
        // in order for them to update their position
        this._flagChildrenAsDirty();

        this.fire('set:pivot', this._pivot);
    }
});

Object.defineProperty(ElementComponent.prototype, "anchor", {
    get: function () {
        return this._anchor;
    },

    set: function (value) {

        if (value instanceof Vec4) {
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

        if (!this.entity._dirtyLocal)
            this.entity._dirtifyLocal();

        this.fire('set:anchor', this._anchor);
    }
});

Object.defineProperty(ElementComponent.prototype, "_hasSplitAnchorsX", {
    get: function () {
        return Math.abs(this._anchor.x - this._anchor.z) > 0.001;
    }
});

Object.defineProperty(ElementComponent.prototype, "_hasSplitAnchorsY", {
    get: function () {
        return Math.abs(this._anchor.y - this._anchor.w) > 0.001;
    }
});

Object.defineProperty(ElementComponent.prototype, "aabb", {
    get: function () {
        if (this._image) return this._image.aabb;
        if (this._text) return this._text.aabb;

        return null;
    }
});

// Returns the 4 corners of the element relative to its screen component.
// Only works for elements that have a screen.
// Order is bottom left, bottom right, top right, top left.
Object.defineProperty(ElementComponent.prototype, 'screenCorners', {
    get: function () {
        if (!this._cornersDirty || !this.screen)
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
                this._screenCorners[i].mulScalar(this.screen.screen.scale);

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
        if (!this._canvasCornersDirty || !this.screen || !this.screen.screen.screenSpace)
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
        if (!this._worldCornersDirty) {
            return this._worldCorners;
        }

        if (this.screen) {
            var screenCorners = this.screenCorners;

            if (!this.screen.screen.screenSpace) {
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
            matB.setTRS(Vec3.ZERO, this.entity.getLocalRotation(), this.entity.getLocalScale());
            matC.setTranslate(localPos.x, localPos.y, localPos.z);

            // get parent world transform (but use this entity if there is no parent)
            var entity = this.entity.parent ? this.entity.parent : this.entity;
            matD.copy(entity.getWorldTransform());
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
        } else {
            if (this._useInput === true) {
                console.warn("Elements will not get any input events because this.system.app.elementInput is not created");
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

        if (this.entity.enabled && this._batchGroupId >= 0) {
            this.system.app.batcher.remove(BatchGroup.ELEMENT, this.batchGroupId, this.entity);
        }

        if (this.entity.enabled && value >= 0) {
            this.system.app.batcher.insert(BatchGroup.ELEMENT, value, this.entity);
        }

        if (value < 0 && this._batchGroupId >= 0 && this.enabled && this.entity.enabled) {
            // re-add model to scene, in case it was removed by batching
            if (this._image && this._image._renderable.model) {
                this.addModelToLayers(this._image._renderable.model);
            } else if (this._text && this._text._model) {
                this.addModelToLayers(this._text._model);
            }
        }

        this._batchGroupId = value;
    }
});

// read-only, get the entity that is currently masking this element
Object.defineProperty(ElementComponent.prototype, "maskedBy", {
    get: function () {
        return this._maskedBy;
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
_define("minFontSize");
_define("maxFontSize");
_define("maxLines");
_define("autoFitWidth");
_define("autoFitHeight");
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
_define("rtlReorder");
_define("unicodeConverter");
_define("text");
_define("key");
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
_define("outlineColor");
_define("outlineThickness");
_define("shadowColor");
_define("shadowOffset");
_define("enableMarkup");
_define("rangeStart");
_define("rangeEnd");

// Events Documentation

/**
 * @event
 * @name ElementComponent#mousedown
 * @description Fired when the mouse is pressed while the cursor is on the component. Only fired when useInput is true.
 * @param {ElementMouseEvent} event - The event.
 */

/**
 * @event
 * @name ElementComponent#mouseup
 * @description Fired when the mouse is released while the cursor is on the component. Only fired when useInput is true.
 * @param {ElementMouseEvent} event - The event.
 */

/**
 * @event
 * @name ElementComponent#mouseenter
 * @description Fired when the mouse cursor enters the component. Only fired when useInput is true.
 * @param {ElementMouseEvent} event - The event.
 */
/**
 * @event
 * @name ElementComponent#mouseleave
 * @description Fired when the mouse cursor leaves the component. Only fired when useInput is true.
 * @param {ElementMouseEvent} event - The event.
 */
/**
 * @event
 * @name ElementComponent#mousemove
 * @description Fired when the mouse cursor is moved on the component. Only fired when useInput is true.
 * @param {ElementMouseEvent} event - The event.
 */

/**
 * @event
 * @name ElementComponent#mousewheel
 * @description Fired when the mouse wheel is scrolled on the component. Only fired when useInput is true.
 * @param {ElementMouseEvent} event - The event.
 */

/**
 * @event
 * @name ElementComponent#click
 * @description Fired when the mouse is pressed and released on the component or when a touch starts and ends on the component. Only fired when useInput is true.
 * @param {ElementMouseEvent|ElementTouchEvent} event - The event.
 */

/**
 * @event
 * @name ElementComponent#touchstart
 * @description Fired when a touch starts on the component. Only fired when useInput is true.
 * @param {ElementTouchEvent} event - The event.
 */

/**
 * @event
 * @name ElementComponent#touchend
 * @description Fired when a touch ends on the component. Only fired when useInput is true.
 * @param {ElementTouchEvent} event - The event.
 */

/**
 * @event
 * @name ElementComponent#touchmove
 * @description Fired when a touch moves after it started touching the component. Only fired when useInput is true.
 * @param {ElementTouchEvent} event - The event.
 */

/**
 * @event
 * @name ElementComponent#touchcancel
 * @description Fired when a touch is canceled on the component. Only fired when useInput is true.
 * @param {ElementTouchEvent} event - The event.
 */

export { ElementComponent };
