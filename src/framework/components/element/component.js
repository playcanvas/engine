import { Debug } from '../../../core/debug.js';
import { TRACE_ID_ELEMENT } from '../../../core/constants.js';

import { Mat4 } from '../../../core/math/mat4.js';
import { Vec2 } from '../../../core/math/vec2.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { Vec4 } from '../../../core/math/vec4.js';

import { FUNC_ALWAYS, FUNC_EQUAL, STENCILOP_INCREMENT, STENCILOP_REPLACE } from '../../../platform/graphics/constants.js';

import { LAYERID_UI } from '../../../scene/constants.js';
import { BatchGroup } from '../../../scene/batching/batch-group.js';
import { StencilParameters } from '../../../platform/graphics/stencil-parameters.js';

import { Entity } from '../../entity.js';

import { Component } from '../component.js';

import { ELEMENTTYPE_GROUP, ELEMENTTYPE_IMAGE, ELEMENTTYPE_TEXT, FITMODE_STRETCH } from './constants.js';
import { ImageElement } from './image-element.js';
import { TextElement } from './text-element.js';

const position = new Vec3();
const invParentWtm = new Mat4();

const vecA = new Vec3();
const vecB = new Vec3();
const matA = new Mat4();
const matB = new Mat4();
const matC = new Mat4();
const matD = new Mat4();

/**
 * ElementComponents are used to construct user interfaces. The {@link ElementComponent#type}
 * property can be configured in 3 main ways: as a text element, as an image element or as a group
 * element. If the ElementComponent has a {@link ScreenComponent} ancestor in the hierarchy, it
 * will be transformed with respect to the coordinate system of the screen. If there is no
 * {@link ScreenComponent} ancestor, the ElementComponent will be transformed like any other
 * entity.
 *
 * You should never need to use the ElementComponent constructor. To add an ElementComponent to a
 * {@link Entity}, use {@link Entity#addComponent}:
 *
 * ```javascript
 * // Add an element component to an entity with the default options
 * const entity = pc.Entity();
 * entity.addComponent("element"); // This defaults to a 'group' element
 * ```
 *
 * To create a simple text-based element:
 *
 * ```javascript
 * entity.addComponent("element", {
 *     anchor: new pc.Vec4(0.5, 0.5, 0.5, 0.5), // centered anchor
 *     fontAsset: fontAsset,
 *     fontSize: 128,
 *     pivot: new pc.Vec2(0.5, 0.5),            // centered pivot
 *     text: "Hello World!",
 *     type: pc.ELEMENTTYPE_TEXT
 * });
 * ```
 *
 * Once the ElementComponent is added to the entity, you can set and get any of its properties:
 *
 * ```javascript
 * entity.element.color = pc.Color.RED; // Set the element's color to red
 *
 * console.log(entity.element.color);   // Get the element's color and print it
 * ```
 *
 * Relevant 'Engine-only' examples:
 *
 * - [Basic text rendering](https://playcanvas.github.io/#/user-interface/text)
 * - [Auto font sizing](https://playcanvas.github.io/#/user-interface/text-auto-font-size)
 * - [Emojis](https://playcanvas.github.io/#/user-interface/text-emojis)
 * - [Text localization](https://playcanvas.github.io/#/user-interface/text-localization)
 * - [Typewriter text](https://playcanvas.github.io/#/user-interface/text-typewriter)
 *
 * @category User Interface
 */
class ElementComponent extends Component {
    /**
     * Fired when the mouse is pressed while the cursor is on the component. Only fired when
     * useInput is true. The handler is passed an {@link ElementMouseEvent}.
     *
     * @event
     * @example
     * entity.element.on('mousedown', (event) => {
     *     console.log(`Mouse down event on entity ${entity.name}`);
     * });
     */
    static EVENT_MOUSEDOWN = 'mousedown';

    /**
     * Fired when the mouse is released while the cursor is on the component. Only fired when
     * useInput is true. The handler is passed an {@link ElementMouseEvent}.
     *
     * @event
     * @example
     * entity.element.on('mouseup', (event) => {
     *     console.log(`Mouse up event on entity ${entity.name}`);
     * });
     */
    static EVENT_MOUSEUP = 'mouseup';

    /**
     * Fired when the mouse cursor enters the component. Only fired when useInput is true. The
     * handler is passed an {@link ElementMouseEvent}.
     *
     * @event
     * @example
     * entity.element.on('mouseenter', (event) => {
     *     console.log(`Mouse enter event on entity ${entity.name}`);
     * });
     */
    static EVENT_MOUSEENTER = 'mouseenter';

    /**
     * Fired when the mouse cursor leaves the component. Only fired when useInput is true. The
     * handler is passed an {@link ElementMouseEvent}.
     *
     * @event
     * @example
     * entity.element.on('mouseleave', (event) => {
     *     console.log(`Mouse leave event on entity ${entity.name}`);
     * });
     */
    static EVENT_MOUSELEAVE = 'mouseleave';

    /**
     * Fired when the mouse cursor is moved on the component. Only fired when useInput is true. The
     * handler is passed an {@link ElementMouseEvent}.
     *
     * @event
     * @example
     * entity.element.on('mousemove', (event) => {
     *     console.log(`Mouse move event on entity ${entity.name}`);
     * });
     */
    static EVENT_MOUSEMOVE = 'mousemove';

    /**
     * Fired when the mouse wheel is scrolled on the component. Only fired when useInput is true.
     * The handler is passed an {@link ElementMouseEvent}.
     *
     * @event
     * @example
     * entity.element.on('mousewheel', (event) => {
     *     console.log(`Mouse wheel event on entity ${entity.name}`);
     * });
     */
    static EVENT_MOUSEWHEEL = 'mousewheel';

    /**
     * Fired when the mouse is pressed and released on the component or when a touch starts and
     * ends on the component. Only fired when useInput is true. The handler is passed an
     * {@link ElementMouseEvent} or {@link ElementTouchEvent}.
     *
     * @event
     * @example
     * entity.element.on('click', (event) => {
     *     console.log(`Click event on entity ${entity.name}`);
     * });
     */
    static EVENT_CLICK = 'click';

    /**
     * Fired when a touch starts on the component. Only fired when useInput is true. The handler is
     * passed an {@link ElementTouchEvent}.
     *
     * @event
     * @example
     * entity.element.on('touchstart', (event) => {
     *     console.log(`Touch start event on entity ${entity.name}`);
     * });
     */
    static EVENT_TOUCHSTART = 'touchstart';

    /**
     * Fired when a touch ends on the component. Only fired when useInput is true. The handler is
     * passed an {@link ElementTouchEvent}.
     *
     * @event
     * @example
     * entity.element.on('touchend', (event) => {
     *     console.log(`Touch end event on entity ${entity.name}`);
     * });
     */
    static EVENT_TOUCHEND = 'touchend';

    /**
     * Fired when a touch moves after it started touching the component. Only fired when useInput
     * is true. The handler is passed an {@link ElementTouchEvent}.
     *
     * @event
     * @example
     * entity.element.on('touchmove', (event) => {
     *     console.log(`Touch move event on entity ${entity.name}`);
     * });
     */
    static EVENT_TOUCHMOVE = 'touchmove';

    /**
     * Fired when a touch is canceled on the component. Only fired when useInput is true. The
     * handler is passed an {@link ElementTouchEvent}.
     *
     * @event
     * @example
     * entity.element.on('touchcancel', (event) => {
     *     console.log(`Touch cancel event on entity ${entity.name}`);
     * });
     */
    static EVENT_TOUCHCANCEL = 'touchcancel';

    /**
     * Create a new ElementComponent instance.
     *
     * @param {import('./system.js').ElementComponentSystem} system - The ComponentSystem that
     * created this Component.
     * @param {Entity} entity - The Entity that this Component is attached to.
     */
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

        // the world space corners of the element
        // Order is bottom left, bottom right, top right, top left
        this._worldCorners = [new Vec3(), new Vec3(), new Vec3(), new Vec3()];

        this._cornersDirty = true;
        this._canvasCornersDirty = true;
        this._worldCornersDirty = true;

        this.entity.on('insert', this._onInsert, this);

        this._patch();

        /**
         * The Entity with a {@link ScreenComponent} that this component belongs to. This is
         * automatically set when the component is a child of a ScreenComponent.
         *
         * @type {Entity|null}
         */
        this.screen = null;

        this._type = ELEMENTTYPE_GROUP;

        // element types
        this._image = null;
        this._text = null;
        this._group = null;

        this._drawOrder = 0;

        // Fit mode
        this._fitMode = FITMODE_STRETCH;

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

    // TODO: Remove this override in upgrading component
    /**
     * @type {import('./data.js').ElementComponentData}
     * @ignore
     */
    get data() {
        const record = this.system.store[this.entity.getGuid()];
        return record ? record.data : null;
    }

    /**
     * Sets the enabled state of the component.
     *
     * @type {boolean}
     */
    set enabled(value) {
        const data = this.data;
        const oldValue = data.enabled;
        data.enabled = value;
        this.fire('set', 'enabled', oldValue, value);
    }

    /**
     * Gets the enabled state of the component.
     *
     * @type {boolean}
     */
    get enabled() {
        return this.data.enabled;
    }

    /**
     * @type {number}
     * @private
     */
    get _absLeft() {
        return this._localAnchor.x + this._margin.x;
    }

    /**
     * @type {number}
     * @private
     */
    get _absRight() {
        return this._localAnchor.z - this._margin.z;
    }

    /**
     * @type {number}
     * @private
     */
    get _absTop() {
        return this._localAnchor.w - this._margin.w;
    }

    /**
     * @type {number}
     * @private
     */
    get _absBottom() {
        return this._localAnchor.y + this._margin.y;
    }

    /**
     * @type {boolean}
     * @private
     */
    get _hasSplitAnchorsX() {
        return Math.abs(this._anchor.x - this._anchor.z) > 0.001;
    }

    /**
     * @type {boolean}
     * @private
     */
    get _hasSplitAnchorsY() {
        return Math.abs(this._anchor.y - this._anchor.w) > 0.001;
    }

    /**
     * Gets the world space axis-aligned bounding box for this element component.
     *
     * @type {import('../../../core/shape/bounding-box.js').BoundingBox | null}
     */
    get aabb() {
        if (this._image) {
            return this._image.aabb;
        }
        if (this._text) {
            return this._text.aabb;
        }

        return null;
    }

    /**
     * Sets the anchor for this element component. Specifies where the left, bottom, right and top
     * edges of the component are anchored relative to its parent. Each value ranges from 0 to 1.
     * e.g. a value of `[0, 0, 0, 0]` means that the element will be anchored to the bottom left of
     * its parent. A value of `[1, 1, 1, 1]` means it will be anchored to the top right. A split
     * anchor is when the left-right or top-bottom pairs of the anchor are not equal. In that case,
     * the component will be resized to cover that entire area. For example, a value of `[0, 0, 1, 1]`
     * will make the component resize exactly as its parent.
     *
     * @example
     * this.entity.element.anchor = new pc.Vec4(Math.random() * 0.1, 0, 1, 0);
     * @example
     * this.entity.element.anchor = [Math.random() * 0.1, 0, 1, 0];
     *
     * @type {Vec4 | number[]}
     */
    set anchor(value) {
        if (value instanceof Vec4) {
            this._anchor.copy(value);
        } else {
            this._anchor.set(...value);
        }

        if (!this.entity._parent && !this.screen) {
            this._calculateLocalAnchors();
        } else {
            this._calculateSize(this._hasSplitAnchorsX, this._hasSplitAnchorsY);
        }

        this._anchorDirty = true;

        if (!this.entity._dirtyLocal) {
            this.entity._dirtifyLocal();
        }

        this.fire('set:anchor', this._anchor);
    }

    /**
     * Gets the anchor for this element component.
     *
     * @type {Vec4 | number[]}
     */
    get anchor() {
        return this._anchor;
    }

    /**
     * Sets the batch group (see {@link BatchGroup}) for this element. Default is -1 (no group).
     *
     * @type {number}
     */
    set batchGroupId(value) {
        if (this._batchGroupId === value) {
            return;
        }

        if (this.entity.enabled && this._batchGroupId >= 0) {
            this.system.app.batcher?.remove(BatchGroup.ELEMENT, this.batchGroupId, this.entity);
        }

        if (this.entity.enabled && value >= 0) {
            this.system.app.batcher?.insert(BatchGroup.ELEMENT, value, this.entity);
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

    /**
     * Gets the batch group (see {@link BatchGroup}) for this element.
     *
     * @type {number}
     */
    get batchGroupId() {
        return this._batchGroupId;
    }

    /**
     * Sets the distance from the bottom edge of the anchor. Can be used in combination with a
     * split anchor to make the component's top edge always be 'top' units away from the top.
     *
     * @type {number}
     */
    set bottom(value) {
        this._margin.y = value;
        const p = this.entity.getLocalPosition();
        const wt = this._absTop;
        const wb = this._localAnchor.y + value;
        this._setHeight(wt - wb);

        p.y = value + this._calculatedHeight * this._pivot.y;
        this.entity.setLocalPosition(p);
    }

    /**
     * Gets the distance from the bottom edge of the anchor.
     *
     * @type {number}
     */
    get bottom() {
        return this._margin.y;
    }

    /**
     * Sets the width at which the element will be rendered. In most cases this will be the same as
     * {@link width}. However, in some cases the engine may calculate a different width for the
     * element, such as when the element is under the control of a {@link LayoutGroupComponent}. In
     * these scenarios, `calculatedWidth` may be smaller or larger than the width that was set in
     * the editor.
     *
     * @type {number}
     */
    set calculatedWidth(value) {
        this._setCalculatedWidth(value, true);
    }

    /**
     * Gets the width at which the element will be rendered.
     *
     * @type {number}
     */
    get calculatedWidth() {
        return this._calculatedWidth;
    }

    /**
     * Sets the height at which the element will be rendered. In most cases this will be the same
     * as {@link height}. However, in some cases the engine may calculate a different height for
     * the element, such as when the element is under the control of a {@link LayoutGroupComponent}.
     * In these scenarios, `calculatedHeight` may be smaller or larger than the height that was set
     * in the editor.
     *
     * @type {number}
     */
    set calculatedHeight(value) {
        this._setCalculatedHeight(value, true);
    }

    /**
     * Gets the height at which the element will be rendered.
     *
     * @type {number}
     */
    get calculatedHeight() {
        return this._calculatedHeight;
    }

    /**
     * Gets the array of 4 {@link Vec2}s that represent the bottom left, bottom right, top right
     * and top left corners of the component in canvas pixels. Only works for screen space element
     * components.
     *
     * @type {Vec2[]}
     */
    get canvasCorners() {
        if (!this._canvasCornersDirty || !this.screen || !this.screen.screen.screenSpace) {
            return this._canvasCorners;
        }

        const device = this.system.app.graphicsDevice;
        const screenCorners = this.screenCorners;
        const sx = device.canvas.clientWidth / device.width;
        const sy = device.canvas.clientHeight / device.height;

        // scale screen corners to canvas size and reverse y
        for (let i = 0; i < 4; i++) {
            this._canvasCorners[i].set(screenCorners[i].x * sx, (device.height - screenCorners[i].y) * sy);
        }

        this._canvasCornersDirty = false;

        return this._canvasCorners;
    }

    /**
     * Sets the draw order of the component. A higher value means that the component will be
     * rendered on top of other components.
     *
     * @type {number}
     */
    set drawOrder(value) {
        let priority = 0;
        if (this.screen) {
            priority = this.screen.screen.priority;
        }

        if (value > 0xFFFFFF) {
            Debug.warn('Element.drawOrder larger than max size of: ' + 0xFFFFFF);
            value = 0xFFFFFF;
        }

        // screen priority is stored in the top 8 bits
        this._drawOrder = (priority << 24) + value;
        this.fire('set:draworder', this._drawOrder);
    }

    /**
     * Gets the draw order of the component.
     *
     * @type {number}
     */
    get drawOrder() {
        return this._drawOrder;
    }

    /**
     * Sets the height of the element as set in the editor. Note that in some cases this may not
     * reflect the true height at which the element is rendered, such as when the element is under
     * the control of a {@link LayoutGroupComponent}. See {@link calculatedHeight} in order to
     * ensure you are reading the true height at which the element will be rendered.
     *
     * @type {number}
     */
    set height(value) {
        this._height = value;

        if (!this._hasSplitAnchorsY) {
            this._setCalculatedHeight(value, true);
        }

        this.fire('set:height', this._height);
    }

    /**
     * Gets the height of the element.
     *
     * @type {number}
     */
    get height() {
        return this._height;
    }

    /**
     * Sets the array of layer IDs ({@link Layer#id}) to which this element should belong. Don't
     * push, pop, splice or modify this array. If you want to change it, set a new one instead.
     *
     * @type {number[]}
     */
    set layers(value) {
        if (this._addedModels.length) {
            for (let i = 0; i < this._layers.length; i++) {
                const layer = this.system.app.scene.layers.getLayerById(this._layers[i]);
                if (layer) {
                    for (let j = 0; j < this._addedModels.length; j++) {
                        layer.removeMeshInstances(this._addedModels[j].meshInstances);
                    }
                }
            }
        }

        this._layers = value;

        if (!this.enabled || !this.entity.enabled || !this._addedModels.length) {
            return;
        }

        for (let i = 0; i < this._layers.length; i++) {
            const layer = this.system.app.scene.layers.getLayerById(this._layers[i]);
            if (layer) {
                for (let j = 0; j < this._addedModels.length; j++) {
                    layer.addMeshInstances(this._addedModels[j].meshInstances);
                }
            }
        }
    }

    /**
     * Gets the array of layer IDs ({@link Layer#id}) to which this element belongs.
     *
     * @type {number[]}
     */
    get layers() {
        return this._layers;
    }

    /**
     * Sets the distance from the left edge of the anchor. Can be used in combination with a split
     * anchor to make the component's left edge always be 'left' units away from the left.
     *
     * @type {number}
     */
    set left(value) {
        this._margin.x = value;
        const p = this.entity.getLocalPosition();
        const wr = this._absRight;
        const wl = this._localAnchor.x + value;
        this._setWidth(wr - wl);

        p.x = value + this._calculatedWidth * this._pivot.x;
        this.entity.setLocalPosition(p);
    }

    /**
     * Gets the distance from the left edge of the anchor.
     *
     * @type {number}
     */
    get left() {
        return this._margin.x;
    }

    /**
     * Sets the distance from the left, bottom, right and top edges of the anchor. For example, if
     * we are using a split anchor like `[0, 0, 1, 1]` and the margin is `[0, 0, 0, 0]` then the
     * component will be the same width and height as its parent.
     *
     * @type {Vec4}
     */
    set margin(value) {
        this._margin.copy(value);
        this._calculateSize(true, true);
        this.fire('set:margin', this._margin);
    }

    /**
     * Gets the distance from the left, bottom, right and top edges of the anchor.
     *
     * @type {Vec4}
     */
    get margin() {
        return this._margin;
    }

    /**
     * Gets the entity that is currently masking this element.
     *
     * @type {Entity}
     * @private
     */
    get maskedBy() {
        return this._maskedBy;
    }

    /**
     * Sets the position of the pivot of the component relative to its anchor. Each value ranges
     * from 0 to 1 where `[0, 0]` is the bottom left and `[1, 1]` is the top right.
     *
     * @example
     * this.entity.element.pivot = [Math.random() * 0.1, Math.random() * 0.1];
     * @example
     * this.entity.element.pivot = new pc.Vec2(Math.random() * 0.1, Math.random() * 0.1);
     *
     * @type {Vec2 | number[]}
     */
    set pivot(value) {
        const { pivot, margin } = this;
        const prevX = pivot.x;
        const prevY = pivot.y;

        if (value instanceof Vec2) {
            pivot.copy(value);
        } else {
            pivot.set(...value);
        }

        const mx = margin.x + margin.z;
        const dx = pivot.x - prevX;
        margin.x += mx * dx;
        margin.z -= mx * dx;

        const my = margin.y + margin.w;
        const dy = pivot.y - prevY;
        margin.y += my * dy;
        margin.w -= my * dy;

        this._anchorDirty = true;
        this._cornersDirty = true;
        this._worldCornersDirty = true;

        this._calculateSize(false, false);

        // we need to flag children as dirty too
        // in order for them to update their position
        this._flagChildrenAsDirty();

        this.fire('set:pivot', pivot);
    }

    /**
     * Gets the position of the pivot of the component relative to its anchor.
     *
     * @type {Vec2 | number[]}
     */
    get pivot() {
        return this._pivot;
    }

    /**
     * Sets the distance from the right edge of the anchor. Can be used in combination with a split
     * anchor to make the component's right edge always be 'right' units away from the right.
     *
     * @type {number}
     */
    set right(value) {
        this._margin.z = value;

        // update width
        const p = this.entity.getLocalPosition();
        const wl = this._absLeft;
        const wr = this._localAnchor.z - value;
        this._setWidth(wr - wl);

        // update position
        p.x = this._localAnchor.z - this._localAnchor.x - value - this._calculatedWidth * (1 - this._pivot.x);
        this.entity.setLocalPosition(p);
    }

    /**
     * Gets the distance from the right edge of the anchor.
     *
     * @type {number}
     */
    get right() {
        return this._margin.z;
    }

    /**
     * Gets the array of 4 {@link Vec3}s that represent the bottom left, bottom right, top right
     * and top left corners of the component relative to its parent {@link ScreenComponent}.
     *
     * @type {Vec3[]}
     */
    get screenCorners() {
        if (!this._cornersDirty || !this.screen) {
            return this._screenCorners;
        }

        const parentBottomLeft = this.entity.parent && this.entity.parent.element && this.entity.parent.element.screenCorners[0];

        // init corners
        this._screenCorners[0].set(this._absLeft, this._absBottom, 0);
        this._screenCorners[1].set(this._absRight, this._absBottom, 0);
        this._screenCorners[2].set(this._absRight, this._absTop, 0);
        this._screenCorners[3].set(this._absLeft, this._absTop, 0);

        // transform corners to screen space
        const screenSpace = this.screen.screen.screenSpace;
        for (let i = 0; i < 4; i++) {
            this._screenTransform.transformPoint(this._screenCorners[i], this._screenCorners[i]);
            if (screenSpace) {
                this._screenCorners[i].mulScalar(this.screen.screen.scale);
            }

            if (parentBottomLeft) {
                this._screenCorners[i].add(parentBottomLeft);
            }
        }

        this._cornersDirty = false;
        this._canvasCornersDirty = true;
        this._worldCornersDirty = true;

        return this._screenCorners;
    }

    /**
     * Gets the width of the text rendered by the component. Only works for
     * {@link ELEMENTTYPE_TEXT} types.
     *
     * @type {number}
     */
    get textWidth() {
        return this._text ? this._text.width : 0;
    }

    /**
     * Gets the height of the text rendered by the component. Only works for
     * {@link ELEMENTTYPE_TEXT} types.
     *
     * @type {number}
     */
    get textHeight() {
        return this._text ? this._text.height : 0;
    }

    /**
     * Sets the distance from the top edge of the anchor. Can be used in combination with a split
     * anchor to make the component's bottom edge always be 'bottom' units away from the bottom.
     *
     * @type {number}
     */
    set top(value) {
        this._margin.w = value;
        const p = this.entity.getLocalPosition();
        const wb = this._absBottom;
        const wt = this._localAnchor.w - value;
        this._setHeight(wt - wb);

        p.y = this._localAnchor.w - this._localAnchor.y - value - this._calculatedHeight * (1 - this._pivot.y);
        this.entity.setLocalPosition(p);
    }

    /**
     * Gets the distance from the top edge of the anchor.
     *
     * @type {number}
     */
    get top() {
        return this._margin.w;
    }

    /**
     * Sets the type of the ElementComponent. Can be:
     *
     * - {@link ELEMENTTYPE_GROUP}: The component can be used as a layout mechanism to create
     * groups of ElementComponents e.g. panels.
     * - {@link ELEMENTTYPE_IMAGE}: The component will render an image
     * - {@link ELEMENTTYPE_TEXT}: The component will render text
     *
     * @type {string}
     */
    set type(value) {
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

    /**
     * Gets the type of the ElementComponent.
     *
     * @type {string}
     */
    get type() {
        return this._type;
    }

    /**
     * Sets whether the component will receive mouse and touch input events.
     *
     * @type {boolean}
     */
    set useInput(value) {
        if (this._useInput === value) {
            return;
        }

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
                Debug.warn('Elements will not get any input events because this.system.app.elementInput is not created');
            }
        }

        this.fire('set:useInput', value);
    }

    /**
     * Gets whether the component will receive mouse and touch input events.
     *
     * @type {boolean}
     */
    get useInput() {
        return this._useInput;
    }

    /**
     * Sets the fit mode of the element. Controls how the content should be fitted and preserve the
     * aspect ratio of the source texture or sprite. Only works for {@link ELEMENTTYPE_IMAGE}
     * types. Can be:
     *
     * - {@link FITMODE_STRETCH}: Fit the content exactly to Element's bounding box.
     * - {@link FITMODE_CONTAIN}: Fit the content within the Element's bounding box while
     * preserving its Aspect Ratio.
     * - {@link FITMODE_COVER}: Fit the content to cover the entire Element's bounding box while
     * preserving its Aspect Ratio.
     *
     * @type {string}
     */
    set fitMode(value) {
        this._fitMode = value;
        this._calculateSize(true, true);
        if (this._image) {
            this._image.refreshMesh();
        }
    }

    /**
     * Gets the fit mode of the element.
     *
     * @type {string}
     */
    get fitMode() {
        return this._fitMode;
    }

    /**
     * Sets the width of the element as set in the editor. Note that in some cases this may not
     * reflect the true width at which the element is rendered, such as when the element is under
     * the control of a {@link LayoutGroupComponent}. See {@link calculatedWidth} in order to
     * ensure you are reading the true width at which the element will be rendered.
     *
     * @type {number}
     */
    set width(value) {
        this._width = value;

        if (!this._hasSplitAnchorsX) {
            this._setCalculatedWidth(value, true);
        }

        this.fire('set:width', this._width);
    }

    /**
     * Gets the width of the element.
     *
     * @type {number}
     */
    get width() {
        return this._width;
    }

    /**
     * Gets the array of 4 {@link Vec3}s that represent the bottom left, bottom right, top right
     * and top left corners of the component in world space. Only works for 3D element components.
     *
     * @type {Vec3[]}
     */
    get worldCorners() {
        if (!this._worldCornersDirty) {
            return this._worldCorners;
        }

        if (this.screen) {
            const screenCorners = this.screenCorners;

            if (!this.screen.screen.screenSpace) {
                matA.copy(this.screen.screen._screenMatrix);

                // flip screen matrix along the horizontal axis
                matA.data[13] = -matA.data[13];

                // create transform that brings screen corners to world space
                matA.mul2(this.screen.getWorldTransform(), matA);

                // transform screen corners to world space
                for (let i = 0; i < 4; i++) {
                    matA.transformPoint(screenCorners[i], this._worldCorners[i]);
                }
            }
        } else {
            const localPos = this.entity.getLocalPosition();

            // rotate and scale around pivot
            matA.setTranslate(-localPos.x, -localPos.y, -localPos.z);
            matB.setTRS(Vec3.ZERO, this.entity.getLocalRotation(), this.entity.getLocalScale());
            matC.setTranslate(localPos.x, localPos.y, localPos.z);

            // get parent world transform (but use this entity if there is no parent)
            const entity = this.entity.parent ? this.entity.parent : this.entity;
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

    /**
     * Sets the size of the font. Only works for {@link ELEMENTTYPE_TEXT} types.
     *
     * @type {number}
     */
    set fontSize(arg) {
        this._setValue('fontSize', arg);
    }

    /**
     * Gets the size of the font.
     *
     * @type {number}
     */
    get fontSize() {
        if (this._text) {
            return this._text.fontSize;
        }

        return null;
    }

    /**
     * Sets the minimum size that the font can scale to when {@link autoFitWidth} or
     * {@link autoFitHeight} are true.
     *
     * @type {number}
     */
    set minFontSize(arg) {
        this._setValue('minFontSize', arg);
    }

    /**
     * Gets the minimum size that the font can scale to when {@link autoFitWidth} or
     * {@link autoFitHeight} are true.
     *
     * @type {number}
     */
    get minFontSize() {
        if (this._text) {
            return this._text.minFontSize;
        }

        return null;
    }

    /**
     * Sets the maximum size that the font can scale to when {@link autoFitWidth} or
     * {@link autoFitHeight} are true.
     *
     * @type {number}
     */
    set maxFontSize(arg) {
        this._setValue('maxFontSize', arg);
    }

    /**
     * Gets the maximum size that the font can scale to when {@link autoFitWidth} or
     * {@link autoFitHeight} are true.
     *
     * @type {number}
     */
    get maxFontSize() {
        if (this._text) {
            return this._text.maxFontSize;
        }

        return null;
    }

    /**
     * Sets the maximum number of lines that the Element can wrap to. Any leftover text will be
     * appended to the last line. Set this to null to allow unlimited lines.
     *
     * @type {number|null}
     */
    set maxLines(arg) {
        this._setValue('maxLines', arg);
    }

    /**
     * Gets the maximum number of lines that the Element can wrap to. Returns null for unlimited
     * lines.
     *
     * @type {number|null}
     */
    get maxLines() {
        if (this._text) {
            return this._text.maxLines;
        }

        return null;
    }

    /**
     * Sets whether the font size and line height will scale so that the text fits inside the width
     * of the Element. The font size will be scaled between {@link minFontSize} and
     * {@link maxFontSize}. The value of {@link autoFitWidth} will be ignored if {@link autoWidth}
     * is true.
     *
     * @type {boolean}
     */
    set autoFitWidth(arg) {
        this._setValue('autoFitWidth', arg);
    }

    /**
     * Gets whether the font size and line height will scale so that the text fits inside the width
     * of the Element.
     *
     * @type {boolean}
     */
    get autoFitWidth() {
        if (this._text) {
            return this._text.autoFitWidth;
        }

        return null;
    }

    /**
     * Sets whether the font size and line height will scale so that the text fits inside the
     * height of the Element. The font size will be scaled between {@link minFontSize} and
     * {@link maxFontSize}. The value of {@link autoFitHeight} will be ignored if
     * {@link autoHeight} is true.
     *
     * @type {boolean}
     */
    set autoFitHeight(arg) {
        this._setValue('autoFitHeight', arg);
    }

    /**
     * Gets whether the font size and line height will scale so that the text fits inside the
     * height of the Element.
     *
     * @type {boolean}
     */
    get autoFitHeight() {
        if (this._text) {
            return this._text.autoFitHeight;
        }

        return null;
    }

    /**
     * Sets the color of the image for {@link ELEMENTTYPE_IMAGE} types or the color of the text for
     * {@link ELEMENTTYPE_TEXT} types.
     *
     * @type {import('../../../core/math/color.js').Color}
     */
    set color(arg) {
        this._setValue('color', arg);
    }

    /**
     * Gets the color of the element.
     *
     * @type {import('../../../core/math/color.js').Color}
     */
    get color() {
        if (this._text) {
            return this._text.color;
        }

        if (this._image) {
            return this._image.color;
        }

        return null;
    }

    /**
     * Sets the font used for rendering the text. Only works for {@link ELEMENTTYPE_TEXT} types.
     *
     * @type {import('../../../framework/font/font.js').Font | import('../../../framework/font/canvas-font.js').CanvasFont}
     */
    set font(arg) {
        this._setValue('font', arg);
    }

    /**
     * Gets the font used for rendering the text.
     *
     * @type {import('../../../framework/font/font.js').Font | import('../../../framework/font/canvas-font.js').CanvasFont}
     */
    get font() {
        if (this._text) {
            return this._text.font;
        }

        return null;
    }

    /**
     * Sets the id of the font asset used for rendering the text. Only works for {@link ELEMENTTYPE_TEXT}
     * types.
     *
     * @type {number}
     */
    set fontAsset(arg) {
        this._setValue('fontAsset', arg);
    }

    /**
     * Gets the id of the font asset used for rendering the text.
     *
     * @type {number}
     */
    get fontAsset() {
        if (this._text && typeof this._text.fontAsset === 'number') {
            return this._text.fontAsset;
        }

        return null;
    }

    /**
     * Sets the spacing between the letters of the text. Only works for {@link ELEMENTTYPE_TEXT} types.
     *
     * @type {number}
     */
    set spacing(arg) {
        this._setValue('spacing', arg);
    }

    /**
     * Gets the spacing between the letters of the text.
     *
     * @type {number}
     */
    get spacing() {
        if (this._text) {
            return this._text.spacing;
        }

        return null;
    }

    /**
     * Sets the height of each line of text. Only works for {@link ELEMENTTYPE_TEXT} types.
     *
     * @type {number}
     */
    set lineHeight(arg) {
        this._setValue('lineHeight', arg);
    }

    /**
     * Gets the height of each line of text.
     *
     * @type {number}
     */
    get lineHeight() {
        if (this._text) {
            return this._text.lineHeight;
        }

        return null;
    }

    /**
     * Sets whether to automatically wrap lines based on the element width. Only works for
     * {@link ELEMENTTYPE_TEXT} types, and when {@link autoWidth} is set to false.
     *
     * @type {boolean}
     */
    set wrapLines(arg) {
        this._setValue('wrapLines', arg);
    }

    /**
     * Gets whether to automatically wrap lines based on the element width.
     *
     * @type {boolean}
     */
    get wrapLines() {
        if (this._text) {
            return this._text.wrapLines;
        }

        return null;
    }

    set lines(arg) {
        this._setValue('lines', arg);
    }

    get lines() {
        if (this._text) {
            return this._text.lines;
        }

        return null;
    }

    /**
     * Sets the horizontal and vertical alignment of the text. Values range from 0 to 1 where
     * `[0, 0]` is the bottom left and `[1, 1]` is the top right.  Only works for
     * {@link ELEMENTTYPE_TEXT} types.
     *
     * @type {Vec2}
     */
    set alignment(arg) {
        this._setValue('alignment', arg);
    }

    /**
     * Gets the horizontal and vertical alignment of the text.
     *
     * @type {Vec2}
     */
    get alignment() {
        if (this._text) {
            return this._text.alignment;
        }

        return null;
    }

    /**
     * Sets whether to automatically set the width of the component to be the same as the
     * {@link textWidth}. Only works for {@link ELEMENTTYPE_TEXT} types.
     *
     * @type {boolean}
     */
    set autoWidth(arg) {
        this._setValue('autoWidth', arg);
    }

    /**
     * Gets whether to automatically set the width of the component to be the same as the
     * {@link textWidth}.
     *
     * @type {boolean}
     */
    get autoWidth() {
        if (this._text) {
            return this._text.autoWidth;
        }

        return null;
    }

    /**
     * Sets whether to automatically set the height of the component to be the same as the
     * {@link textHeight}. Only works for {@link ELEMENTTYPE_TEXT} types.
     *
     * @type {boolean}
     */
    set autoHeight(arg) {
        this._setValue('autoHeight', arg);
    }

    /**
     * Gets whether to automatically set the height of the component to be the same as the
     * {@link textHeight}.
     *
     * @type {boolean}
     */
    get autoHeight() {
        if (this._text) {
            return this._text.autoHeight;
        }

        return null;
    }

    /**
     * Sets whether to reorder the text for RTL languages. The reordering uses a function
     * registered by `app.systems.element.registerUnicodeConverter`.
     *
     * @type {boolean}
     */
    set rtlReorder(arg) {
        this._setValue('rtlReorder', arg);
    }

    /**
     * Gets whether to reorder the text for RTL languages.
     *
     * @type {boolean}
     */
    get rtlReorder() {
        if (this._text) {
            return this._text.rtlReorder;
        }

        return null;
    }

    /**
     * Sets whether to convert unicode characters. This uses a function registered by
     * `app.systems.element.registerUnicodeConverter`.
     *
     * @type {boolean}
     */
    set unicodeConverter(arg) {
        this._setValue('unicodeConverter', arg);
    }

    /**
     * Gets whether to convert unicode characters.
     *
     * @type {boolean}
     */
    get unicodeConverter() {
        if (this._text) {
            return this._text.unicodeConverter;
        }

        return null;
    }

    /**
     * Sets the text to render. Only works for {@link ELEMENTTYPE_TEXT} types. To override certain
     * text styling properties on a per-character basis, the text can optionally include markup
     * tags contained within square brackets. Supported tags are:
     *
     * 1. `color` - override the element's {@link color} property. Examples:
     *     - `[color="#ff0000"]red text[/color]`
     *     - `[color="#00ff00"]green text[/color]`
     *     - `[color="#0000ff"]blue text[/color]`
     * 2. `outline` - override the element's {@link outlineColor} and {@link outlineThickness}
     * properties. Example:
     *     - `[outline color="#ffffff" thickness="0.5"]text[/outline]`
     * 3. `shadow` - override the element's {@link shadowColor} and {@link shadowOffset}
     * properties. Examples:
     *     - `[shadow color="#ffffff" offset="0.5"]text[/shadow]`
     *     - `[shadow color="#000000" offsetX="0.1" offsetY="0.2"]text[/shadow]`
     *
     * Note that markup tags are only processed if the text element's {@link enableMarkup} property
     * is set to true.
     *
     * @type {string}
     */
    set text(arg) {
        this._setValue('text', arg);
    }

    /**
     * Gets the text to render.
     *
     * @type {string}
     */
    get text() {
        if (this._text) {
            return this._text.text;
        }

        return null;
    }

    /**
     * Sets the localization key to use to get the localized text from {@link Application#i18n}.
     * Only works for {@link ELEMENTTYPE_TEXT} types.
     *
     * @type {string}
     */
    set key(arg) {
        this._setValue('key', arg);
    }

    /**
     * Gets the localization key to use to get the localized text from {@link Application#i18n}.
     *
     * @type {string}
     */
    get key() {
        if (this._text) {
            return this._text.key;
        }

        return null;
    }

    /**
     * Sets the texture to render. Only works for {@link ELEMENTTYPE_IMAGE} types.
     *
     * @type {import('../../../platform/graphics/texture.js').Texture}
     */
    set texture(arg) {
        this._setValue('texture', arg);
    }

    /**
     * Gets the texture to render.
     *
     * @type {import('../../../platform/graphics/texture.js').Texture}
     */
    get texture() {
        if (this._image) {
            return this._image.texture;
        }

        return null;
    }

    /**
     * Sets the id of the texture asset to render. Only works for {@link ELEMENTTYPE_IMAGE} types.
     *
     * @type {number}
     */
    set textureAsset(arg) {
        this._setValue('textureAsset', arg);
    }

    /**
     * Gets the id of the texture asset to render.
     *
     * @type {number}
     */
    get textureAsset() {
        if (this._image) {
            return this._image.textureAsset;
        }

        return null;
    }

    /**
     * Sets the material to use when rendering an image. Only works for {@link ELEMENTTYPE_IMAGE} types.
     *
     * @type {import('../../../scene/materials/material.js').Material}
     */
    set material(arg) {
        this._setValue('material', arg);
    }

    /**
     * Gets the material to use when rendering an image.
     *
     * @type {import('../../../scene/materials/material.js').Material}
     */
    get material() {
        if (this._image) {
            return this._image.material;
        }

        return null;
    }

    /**
     * Sets the id of the material asset to use when rendering an image. Only works for
     * {@link ELEMENTTYPE_IMAGE} types.
     *
     * @type {number}
     */
    set materialAsset(arg) {
        this._setValue('materialAsset', arg);
    }

    /**
     * Gets the id of the material asset to use when rendering an image.
     *
     * @type {number}
     */
    get materialAsset() {
        if (this._image) {
            return this._image.materialAsset;
        }

        return null;
    }

    /**
     * Sets the sprite to render. Only works for {@link ELEMENTTYPE_IMAGE} types which can render
     * either a texture or a sprite.
     *
     * @type {import('../../../scene/sprite.js').Sprite}
     */
    set sprite(arg) {
        this._setValue('sprite', arg);
    }

    /**
     * Gets the sprite to render.
     *
     * @type {import('../../../scene/sprite.js').Sprite}
     */
    get sprite() {
        if (this._image) {
            return this._image.sprite;
        }

        return null;
    }

    /**
     * Sets the id of the sprite asset to render. Only works for {@link ELEMENTTYPE_IMAGE} types which
     * can render either a texture or a sprite.
     *
     * @type {number}
     */
    set spriteAsset(arg) {
        this._setValue('spriteAsset', arg);
    }

    /**
     * Gets the id of the sprite asset to render.
     *
     * @type {number}
     */
    get spriteAsset() {
        if (this._image) {
            return this._image.spriteAsset;
        }

        return null;
    }

    /**
     * Sets the frame of the sprite to render. Only works for {@link ELEMENTTYPE_IMAGE} types who have a
     * sprite assigned.
     *
     * @type {number}
     */
    set spriteFrame(arg) {
        this._setValue('spriteFrame', arg);
    }

    /**
     * Gets the frame of the sprite to render.
     *
     * @type {number}
     */
    get spriteFrame() {
        if (this._image) {
            return this._image.spriteFrame;
        }

        return null;
    }

    /**
     * Sets the number of pixels that map to one PlayCanvas unit. Only works for
     * {@link ELEMENTTYPE_IMAGE} types who have a sliced sprite assigned.
     *
     * @type {number}
     */
    set pixelsPerUnit(arg) {
        this._setValue('pixelsPerUnit', arg);
    }

    /**
     * Gets the number of pixels that map to one PlayCanvas unit.
     *
     * @type {number}
     */
    get pixelsPerUnit() {
        if (this._image) {
            return this._image.pixelsPerUnit;
        }

        return null;
    }

    /**
     * Sets the opacity of the element. This works for both {@link ELEMENTTYPE_IMAGE} and
     * {@link ELEMENTTYPE_TEXT} element types.
     *
     * @type {number}
     */
    set opacity(arg) {
        this._setValue('opacity', arg);
    }

    /**
     * Gets the opacity of the element.
     *
     * @type {number}
     */
    get opacity() {
        if (this._text) {
            return this._text.opacity;
        }

        if (this._image) {
            return this._image.opacity;
        }

        return null;
    }

    /**
     * Sets the region of the texture to use in order to render an image. Values range from 0 to 1
     * and indicate u, v, width, height. Only works for {@link ELEMENTTYPE_IMAGE} types.
     *
     * @type {Vec4}
     */
    set rect(arg) {
        this._setValue('rect', arg);
    }

    /**
     * Gets the region of the texture to use in order to render an image.
     *
     * @type {Vec4}
     */
    get rect() {
        if (this._image) {
            return this._image.rect;
        }

        return null;
    }

    /**
     * Sets whether the Image Element should be treated as a mask. Masks do not render into the
     * scene, but instead limit child elements to only be rendered where this element is rendered.
     *
     * @type {boolean}
     */
    set mask(arg) {
        this._setValue('mask', arg);
    }

    /**
     * Gets whether the Image Element should be treated as a mask.
     *
     * @type {boolean}
     */
    get mask() {
        if (this._image) {
            return this._image.mask;
        }

        return null;
    }

    /**
     * Sets the text outline effect color and opacity. Only works for {@link ELEMENTTYPE_TEXT} types.
     *
     * @type {import('../../../core/math/color.js').Color}
     */
    set outlineColor(arg) {
        this._setValue('outlineColor', arg);
    }

    /**
     * Gets the text outline effect color and opacity.
     *
     * @type {import('../../../core/math/color.js').Color}
     */
    get outlineColor() {
        if (this._text) {
            return this._text.outlineColor;
        }
        return null;
    }

    /**
     * Sets the width of the text outline effect. Only works for {@link ELEMENTTYPE_TEXT} types.
     *
     * @type {number}
     */
    set outlineThickness(arg) {
        this._setValue('outlineThickness', arg);
    }

    /**
     * Gets the width of the text outline effect.
     *
     * @type {number}
     */
    get outlineThickness() {
        if (this._text) {
            return this._text.outlineThickness;
        }

        return null;
    }

    /**
     * Sets the text shadow effect color and opacity. Only works for {@link ELEMENTTYPE_TEXT} types.
     *
     * @type {import('../../../core/math/color.js').Color}
     */
    set shadowColor(arg) {
        this._setValue('shadowColor', arg);
    }

    /**
     * Gets the text shadow effect color and opacity.
     *
     * @type {import('../../../core/math/color.js').Color}
     */
    get shadowColor() {
        if (this._text) {
            return this._text.shadowColor;
        }

        return null;
    }

    /**
     * Sets the text shadow effect shift amount from original text. Only works for
     * {@link ELEMENTTYPE_TEXT} types.
     *
     * @type {number}
     */
    set shadowOffset(arg) {
        this._setValue('shadowOffset', arg);
    }

    /**
     * Gets the text shadow effect shift amount from original text.
     *
     * @type {number}
     */
    get shadowOffset() {
        if (this._text) {
            return this._text.shadowOffset;
        }

        return null;
    }

    /**
     * Sets whether markup processing is enabled for this element. Only works for
     * {@link ELEMENTTYPE_TEXT} types. Defaults to false.
     *
     * @type {boolean}
     */
    set enableMarkup(arg) {
        this._setValue('enableMarkup', arg);
    }

    /**
     * Gets whether markup processing is enabled for this element.
     *
     * @type {boolean}
     */
    get enableMarkup() {
        if (this._text) {
            return this._text.enableMarkup;
        }

        return null;
    }

    /**
     * Sets the index of the first character to render. Only works for {@link ELEMENTTYPE_TEXT} types.
     *
     * @type {number}
     */
    set rangeStart(arg) {
        this._setValue('rangeStart', arg);
    }

    /**
     * Gets the index of the first character to render.
     *
     * @type {number}
     */
    get rangeStart() {
        if (this._text) {
            return this._text.rangeStart;
        }

        return null;
    }

    /**
     * Sets the index of the last character to render. Only works for {@link ELEMENTTYPE_TEXT} types.
     *
     * @type {number}
     */
    set rangeEnd(arg) {
        this._setValue('rangeEnd', arg);
    }

    /**
     * Gets the index of the last character to render.
     *
     * @type {number}
     */
    get rangeEnd() {
        if (this._text) {
            return this._text.rangeEnd;
        }

        return null;
    }

    /** @ignore */
    _setValue(name, value) {
        if (this._text) {
            if (this._text[name] !== value) {
                this._dirtyBatch();
            }

            this._text[name] = value;
        } else if (this._image) {
            if (this._image[name] !== value) {
                this._dirtyBatch();
            }

            this._image[name] = value;
        }
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

    /**
     * Patched method for setting the position.
     *
     * @param {number|Vec3} x - The x coordinate or Vec3
     * @param {number} [y] - The y coordinate
     * @param {number} [z] - The z coordinate
     * @private
     */
    _setPosition(x, y, z) {
        if (!this.element.screen) {
            Entity.prototype.setPosition.call(this, x, y, z);
            return;
        }

        if (x instanceof Vec3) {
            position.copy(x);
        } else {
            position.set(x, y, z);
        }

        this.getWorldTransform(); // ensure hierarchy is up to date
        invParentWtm.copy(this.element._screenToWorld).invert();
        invParentWtm.transformPoint(position, this.localPosition);

        if (!this._dirtyLocal) {
            this._dirtifyLocal();
        }
    }

    /**
     * Patched method for setting the local position.
     *
     * @param {number|Vec3} x - The x coordinate or Vec3
     * @param {number} [y] - The y coordinate
     * @param {number} [z] - The z coordinate
     * @private
     */
    _setLocalPosition(x, y, z) {
        if (x instanceof Vec3) {
            this.localPosition.copy(x);
        } else {
            this.localPosition.set(x, y, z);
        }

        // update margin
        const element = this.element;
        const p = this.localPosition;
        const pvt = element._pivot;
        element._margin.x = p.x - element._calculatedWidth * pvt.x;
        element._margin.z = element._localAnchor.z - element._localAnchor.x - element._calculatedWidth - element._margin.x;
        element._margin.y = p.y - element._calculatedHeight * pvt.y;
        element._margin.w = element._localAnchor.w - element._localAnchor.y - element._calculatedHeight - element._margin.y;

        if (!this._dirtyLocal) {
            this._dirtifyLocal();
        }
    }

    // this method overwrites GraphNode#sync and so operates in scope of the Entity.
    _sync() {
        const element = this.element;
        const screen = element.screen;

        if (screen) {
            if (element._anchorDirty) {
                let resx = 0;
                let resy = 0;
                let px = 0;
                let py = 1;

                if (this._parent && this._parent.element) {
                    // use parent rect
                    resx = this._parent.element.calculatedWidth;
                    resy = this._parent.element.calculatedHeight;
                    px = this._parent.element.pivot.x;
                    py = this._parent.element.pivot.y;
                } else {
                    // use screen rect
                    const resolution = screen.screen.resolution;
                    resx = resolution.x / screen.screen.scale;
                    resy = resolution.y / screen.screen.scale;
                }

                element._anchorTransform.setTranslate(resx * (element.anchor.x - px), -(resy * (py - element.anchor.y)), 0);
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
            const p = this.localPosition;
            const pvt = element._pivot;
            element._margin.x = p.x - element._calculatedWidth * pvt.x;
            element._margin.z = element._localAnchor.z - element._localAnchor.x - element._calculatedWidth - element._margin.x;
            element._margin.y = p.y - element._calculatedHeight * pvt.y;
            element._margin.w = element._localAnchor.w - element._localAnchor.y - element._calculatedHeight - element._margin.y;

            this._dirtyLocal = false;
        }

        if (!screen) {
            if (this._dirtyWorld) {
                element._cornersDirty = true;
                element._canvasCornersDirty = true;
                element._worldCornersDirty = true;
            }

            Entity.prototype._sync.call(this);
            return;
        }

        if (this._dirtyWorld) {
            if (this._parent === null) {
                this.worldTransform.copy(this.localTransform);
            } else {
                // transform element hierarchy
                if (this._parent.element) {
                    element._screenToWorld.mul2(this._parent.element._modelTransform,
                                                element._anchorTransform);
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
                    const parentWorldTransform = element._parentWorldTransform;
                    parentWorldTransform.setIdentity();
                    const parent = this._parent;
                    if (parent && parent.element && parent !== screen) {
                        matA.setTRS(Vec3.ZERO, parent.getLocalRotation(), parent.getLocalScale());
                        parentWorldTransform.mul2(parent.element._parentWorldTransform, matA);
                    }

                    // update element transform
                    // rotate and scale around pivot
                    const depthOffset = vecA;
                    depthOffset.set(0, 0, this.localPosition.z);

                    const pivotOffset = vecB;
                    pivotOffset.set(element._absLeft + element._pivot.x * element.calculatedWidth,
                                    element._absBottom + element._pivot.y * element.calculatedHeight, 0);

                    matA.setTranslate(-pivotOffset.x, -pivotOffset.y, -pivotOffset.z);
                    matB.setTRS(depthOffset, this.getLocalRotation(), this.getLocalScale());
                    matC.setTranslate(pivotOffset.x, pivotOffset.y, pivotOffset.z);

                    element._screenTransform
                        .mul2(element._parentWorldTransform, matC)
                        .mul(matB)
                        .mul(matA);

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

        const result = this._parseUpToScreen();

        this.entity._dirtifyWorld();

        this._updateScreen(result.screen);

        this._dirtifyMask();
    }

    _dirtifyMask() {
        let current = this.entity;
        while (current) {
            // search up the hierarchy until we find an entity which has:
            // - no parent
            // - screen component on parent
            const next = current.parent;
            if ((next === null || next.screen) && current.element) {
                if (!this.system._prerender || !this.system._prerender.length) {
                    this.system._prerender = [];
                    this.system.app.once('prerender', this._onPrerender, this);

                    Debug.trace(TRACE_ID_ELEMENT, 'register prerender');
                }
                const i = this.system._prerender.indexOf(this.entity);
                if (i >= 0) {
                    this.system._prerender.splice(i, 1);
                }
                const j = this.system._prerender.indexOf(current);
                if (j < 0) {
                    this.system._prerender.push(current);
                }
                Debug.trace(TRACE_ID_ELEMENT, 'set prerender root to: ' + current.name);
            }

            current = next;
        }
    }

    _onPrerender() {
        for (let i = 0; i < this.system._prerender.length; i++) {
            const mask = this.system._prerender[i];
            Debug.trace(TRACE_ID_ELEMENT, 'prerender from: ' + mask.name);

            // prevent call if element has been removed since being added
            if (mask.element) {
                const depth = 1;
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

        const previousScreen = this.screen;
        this.screen = screen;
        if (this.screen) {
            this._bindScreen(this.screen.screen);
        }

        this._calculateSize(this._hasSplitAnchorsX, this._hasSplitAnchorsY);

        this.fire('set:screen', this.screen, previousScreen);

        this._anchorDirty = true;

        // update all child screens
        const children = this.entity.children;
        for (let i = 0, l = children.length; i < l; i++) {
            if (children[i].element) {
                children[i].element._updateScreen(screen);
            }
        }

        // calculate draw order
        if (this.screen) {
            this.screen.screen.syncDrawOrder();
        }
    }

    syncMask(depth) {
        const result = this._parseUpToScreen();
        this._updateMask(result.mask, depth);
    }

    // set the maskedby property to the entity that is masking this element
    // - set the stencil buffer to check the mask value
    //   so as to only render inside the mask
    //   Note: if this entity is itself a mask the stencil params
    //   will be updated in updateMask to include masking
    _setMaskedBy(mask) {
        const renderableElement = this._image || this._text;

        if (mask) {
            const ref = mask.element._image._maskRef;
            Debug.trace(TRACE_ID_ELEMENT, 'masking: ' + this.entity.name + ' with ' + ref);

            // if this is image or text, set the stencil parameters
            renderableElement?._setStencil(new StencilParameters({
                ref: ref,
                func: FUNC_EQUAL
            }));

            this._maskedBy = mask;
        } else {
            Debug.trace(TRACE_ID_ELEMENT, 'no masking on: ' + this.entity.name);

            // remove stencil params if this is image or text
            renderableElement?._setStencil(null);

            this._maskedBy = null;
        }
    }

    // recursively update entity's stencil params
    // to render the correct value into the stencil buffer
    _updateMask(currentMask, depth) {
        if (currentMask) {
            this._setMaskedBy(currentMask);

            // this element is also masking others
            if (this.mask) {
                const ref = currentMask.element._image._maskRef;
                const sp = new StencilParameters({
                    ref: ref,
                    func: FUNC_EQUAL,
                    zpass: STENCILOP_INCREMENT
                });
                this._image._setStencil(sp);
                this._image._maskRef = depth;

                // increment counter to count mask depth
                depth++;

                Debug.trace(TRACE_ID_ELEMENT, 'masking from: ' + this.entity.name + ' with ' + (sp.ref + 1));
                Debug.trace(TRACE_ID_ELEMENT, 'depth++ to: ', depth);

                currentMask = this.entity;
            }

            // recurse through all children
            const children = this.entity.children;
            for (let i = 0, l = children.length; i < l; i++) {
                children[i].element?._updateMask(currentMask, depth);
            }

            // if mask counter was increased, decrement it as we come back up the hierarchy
            if (this.mask) depth--;
        } else {
            // clearing mask
            this._setMaskedBy(null);

            if (this.mask) {
                const sp = new StencilParameters({
                    ref: depth,
                    func: FUNC_ALWAYS,
                    zpass: STENCILOP_REPLACE
                });
                this._image._setStencil(sp);
                this._image._maskRef = depth;

                // increment mask counter to count depth of masks
                depth++;

                Debug.trace(TRACE_ID_ELEMENT, 'masking from: ' + this.entity.name + ' with ' + sp.ref);
                Debug.trace(TRACE_ID_ELEMENT, 'depth++ to: ', depth);

                currentMask = this.entity;
            }

            // recurse through all children
            const children = this.entity.children;
            for (let i = 0, l = children.length; i < l; i++) {
                children[i].element?._updateMask(currentMask, depth);
            }

            // decrement mask counter as we come back up the hierarchy
            if (this.mask) {
                depth--;
            }
        }
    }

    // search up the parent hierarchy until we reach a screen
    // this screen is the parent screen
    // also searches for masked elements to get the relevant mask
    _parseUpToScreen() {
        const result = {
            screen: null,
            mask: null
        };

        let parent = this.entity._parent;

        while (parent && !parent.screen) {
            if (parent.element && parent.element.mask) {
                // mask entity
                if (!result.mask) result.mask = parent;
            }

            parent = parent.parent;
        }
        if (parent && parent.screen) {
            result.screen = parent;
        }

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
        let resx = 1000;
        let resy = 1000;
        const parent = this.entity._parent;
        if (parent && parent.element) {
            resx = parent.element.calculatedWidth;
            resy = parent.element.calculatedHeight;
        } else if (this.screen) {
            const res = this.screen.screen.resolution;
            const scale = this.screen.screen.scale;
            resx = res.x / scale;
            resy = res.y / scale;
        }

        this._localAnchor.set(this._anchor.x * resx, this._anchor.y * resy, this._anchor.z * resx,
                              this._anchor.w * resy);
    }

    // internal - apply offset x,y to local position and find point in world space
    getOffsetPosition(x, y) {
        const p = this.entity.getLocalPosition().clone();

        p.x += x;
        p.y += y;

        this._screenToWorld.transformPoint(p, p);

        return p;
    }

    onLayersChanged(oldComp, newComp) {
        this.addModelToLayers(this._image ? this._image._renderable.model : this._text._model);
        oldComp.off('add', this.onLayerAdded, this);
        oldComp.off('remove', this.onLayerRemoved, this);
        newComp.on('add', this.onLayerAdded, this);
        newComp.on('remove', this.onLayerRemoved, this);
    }

    onLayerAdded(layer) {
        const index = this.layers.indexOf(layer.id);
        if (index < 0) return;
        if (this._image) {
            layer.addMeshInstances(this._image._renderable.model.meshInstances);
        } else if (this._text) {
            layer.addMeshInstances(this._text._model.meshInstances);
        }
    }

    onLayerRemoved(layer) {
        const index = this.layers.indexOf(layer.id);
        if (index < 0) return;
        if (this._image) {
            layer.removeMeshInstances(this._image._renderable.model.meshInstances);
        } else if (this._text) {
            layer.removeMeshInstances(this._text._model.meshInstances);
        }
    }

    onEnable() {
        if (this._image) {
            this._image.onEnable();
        }
        if (this._text) {
            this._text.onEnable();
        }
        if (this._group) {
            this._group.onEnable();
        }

        if (this.useInput && this.system.app.elementInput) {
            this.system.app.elementInput.addElement(this);
        }

        this.system.app.scene.on('set:layers', this.onLayersChanged, this);
        if (this.system.app.scene.layers) {
            this.system.app.scene.layers.on('add', this.onLayerAdded, this);
            this.system.app.scene.layers.on('remove', this.onLayerRemoved, this);
        }

        if (this._batchGroupId >= 0) {
            this.system.app.batcher?.insert(BatchGroup.ELEMENT, this.batchGroupId, this.entity);
        }

        this.fire('enableelement');
    }

    onDisable() {
        this.system.app.scene.off('set:layers', this.onLayersChanged, this);
        if (this.system.app.scene.layers) {
            this.system.app.scene.layers.off('add', this.onLayerAdded, this);
            this.system.app.scene.layers.off('remove', this.onLayerRemoved, this);
        }

        if (this._image) this._image.onDisable();
        if (this._text) this._text.onDisable();
        if (this._group) this._group.onDisable();

        if (this.system.app.elementInput && this.useInput) {
            this.system.app.elementInput.removeElement(this);
        }

        if (this._batchGroupId >= 0) {
            this.system.app.batcher?.remove(BatchGroup.ELEMENT, this.batchGroupId, this.entity);
        }

        this.fire('disableelement');
    }

    onRemove() {
        this.entity.off('insert', this._onInsert, this);
        this._unpatch();
        if (this._image) {
            this._image.destroy();
        }
        if (this._text) {
            this._text.destroy();
        }

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

    /**
     * Recalculates these properties:
     *   - `_localAnchor`
     *   - `width`
     *   - `height`
     *   - Local position is updated if anchors are split
     *
     * Assumes these properties are up to date:
     *   - `_margin`
     *
     * @param {boolean} propagateCalculatedWidth - If true, call `_setWidth` instead
     * of `_setCalculatedWidth`
     * @param {boolean} propagateCalculatedHeight - If true, call `_setHeight` instead
     * of `_setCalculatedHeight`
     * @private
     */
    _calculateSize(propagateCalculatedWidth, propagateCalculatedHeight) {
        // can't calculate if local anchors are wrong
        if (!this.entity._parent && !this.screen) {
            return;
        }

        this._calculateLocalAnchors();

        const newWidth = this._absRight - this._absLeft;
        const newHeight = this._absTop - this._absBottom;

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

        const p = this.entity.getLocalPosition();
        p.x = this._margin.x + this._calculatedWidth * this._pivot.x;
        p.y = this._margin.y + this._calculatedHeight * this._pivot.y;

        this.entity.setLocalPosition(p);

        this._sizeDirty = false;
    }

    /**
     * Internal set width without updating margin.
     *
     * @param {number} w - The new width.
     * @private
     */
    _setWidth(w) {
        this._width = w;
        this._setCalculatedWidth(w, false);

        this.fire('set:width', this._width);
    }

    /**
     * Internal set height without updating margin.
     *
     * @param {number} h - The new height.
     * @private
     */
    _setHeight(h) {
        this._height = h;
        this._setCalculatedHeight(h, false);

        this.fire('set:height', this._height);
    }

    /**
     * This method sets the calculated width value and optionally updates the margins.
     *
     * @param {number} value - The new calculated width.
     * @param {boolean} updateMargins - Update margins or not.
     * @private
     */
    _setCalculatedWidth(value, updateMargins) {
        if (Math.abs(value - this._calculatedWidth) <= 1e-4) {
            return;
        }

        this._calculatedWidth = value;
        this.entity._dirtifyLocal();

        if (updateMargins) {
            const p = this.entity.getLocalPosition();
            const pvt = this._pivot;
            this._margin.x = p.x - this._calculatedWidth * pvt.x;
            this._margin.z = this._localAnchor.z - this._localAnchor.x - this._calculatedWidth - this._margin.x;
        }

        this._flagChildrenAsDirty();
        this.fire('set:calculatedWidth', this._calculatedWidth);
        this.fire('resize', this._calculatedWidth, this._calculatedHeight);
    }

    /**
     * This method sets the calculated height value and optionally updates the margins.
     *
     * @param {number} value - The new calculated height.
     * @param {boolean} updateMargins - Update margins or not.
     * @private
     */
    _setCalculatedHeight(value, updateMargins) {
        if (Math.abs(value - this._calculatedHeight) <= 1e-4) {
            return;
        }

        this._calculatedHeight = value;
        this.entity._dirtifyLocal();

        if (updateMargins) {
            const p = this.entity.getLocalPosition();
            const pvt = this._pivot;
            this._margin.y = p.y - this._calculatedHeight * pvt.y;
            this._margin.w = this._localAnchor.w - this._localAnchor.y - this._calculatedHeight - this._margin.y;
        }

        this._flagChildrenAsDirty();
        this.fire('set:calculatedHeight', this._calculatedHeight);
        this.fire('resize', this._calculatedWidth, this._calculatedHeight);
    }

    _flagChildrenAsDirty() {
        const c = this.entity._children;
        for (let i = 0, l = c.length; i < l; i++) {
            if (c[i].element) {
                c[i].element._anchorDirty = true;
                c[i].element._sizeDirty = true;
            }
        }
    }

    addModelToLayers(model) {
        this._addedModels.push(model);
        for (let i = 0; i < this.layers.length; i++) {
            const layer = this.system.app.scene.layers.getLayerById(this.layers[i]);
            if (!layer) continue;
            layer.addMeshInstances(model.meshInstances);
        }
    }

    removeModelFromLayers(model) {
        const idx = this._addedModels.indexOf(model);
        if (idx >= 0) {
            this._addedModels.splice(idx, 1);
        }
        for (let i = 0; i < this.layers.length; i++) {
            const layer = this.system.app.scene.layers.getLayerById(this.layers[i]);
            if (!layer) {
                continue;
            }
            layer.removeMeshInstances(model.meshInstances);
        }
    }

    getMaskOffset() {
        // reset offset on new frame
        // we always count offset down from 0.5
        const frame = this.system.app.frame;
        if (this._offsetReadAt !== frame) {
            this._maskOffset = 0.5;
            this._offsetReadAt = frame;
        }
        const mo = this._maskOffset;
        this._maskOffset -= 0.001;
        return mo;
    }

    isVisibleForCamera(camera) {
        let clipL, clipR, clipT, clipB;

        if (this.maskedBy) {
            const corners = this.maskedBy.element.screenCorners;

            clipL = Math.min(Math.min(corners[0].x, corners[1].x), Math.min(corners[2].x, corners[3].x));
            clipR = Math.max(Math.max(corners[0].x, corners[1].x), Math.max(corners[2].x, corners[3].x));
            clipB = Math.min(Math.min(corners[0].y, corners[1].y), Math.min(corners[2].y, corners[3].y));
            clipT = Math.max(Math.max(corners[0].y, corners[1].y), Math.max(corners[2].y, corners[3].y));
        } else {
            const sw = this.system.app.graphicsDevice.width;
            const sh = this.system.app.graphicsDevice.height;

            const cameraWidth = camera._rect.z * sw;
            const cameraHeight = camera._rect.w * sh;
            clipL = camera._rect.x * sw;
            clipR = clipL + cameraWidth;
            clipT = (1 - camera._rect.y) * sh;
            clipB = clipT - cameraHeight;
        }

        const hitCorners = this.screenCorners;

        const left = Math.min(Math.min(hitCorners[0].x, hitCorners[1].x), Math.min(hitCorners[2].x, hitCorners[3].x));
        const right = Math.max(Math.max(hitCorners[0].x, hitCorners[1].x), Math.max(hitCorners[2].x, hitCorners[3].x));
        const bottom = Math.min(Math.min(hitCorners[0].y, hitCorners[1].y), Math.min(hitCorners[2].y, hitCorners[3].y));
        const top = Math.max(Math.max(hitCorners[0].y, hitCorners[1].y), Math.max(hitCorners[2].y, hitCorners[3].y));

        if (right < clipL || left > clipR || bottom > clipT || top < clipB) {
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

    _dirtyBatch() {
        if (this.batchGroupId !== -1) {
            this.system.app.batcher?.markGroupDirty(this.batchGroupId);
        }
    }
}

export { ElementComponent };
