import { EventHandler } from '../../core/event-handler.js';
import { Color } from '../../core/math/color.js';
import { Entity } from '../../framework/entity.js';
import { FramePass } from '../../platform/graphics/frame-pass.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { GraphNode } from '../../scene/graph-node.js';
import { WireRenderer } from '../renderers/wire-renderer.js';

import { buildPassModel, captureFrameGraph, passRows } from './frame-graph-view.js';
import { HierarchyView } from './hierarchy-view.js';
import { ListView } from './list-view.js';
import { passDisplayName } from './model.js';
import { buildNodeModel } from './node-model.js';
import { AmmoDebugDraw, DEBUG_DRAW } from './physics-debug.js';
import { bodyRows, drawCollisionShape, drawJoint, jointRows, physicsStats } from './physics-view.js';
import { PropertyView } from './property-view.js';
import { buildRenderTargetModel, renderTargetRows } from './render-target-view.js';
import { styles } from './styles.js';

/** @import { AppBase } from '../../framework/app-base.js' */
/** @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js' */
/** @import { FrameSnapshot } from './frame-graph-view.js' */
/** @import { PropertySection } from './model.js' */

/**
 * Options for {@link Inspector}.
 *
 * @typedef {object} InspectorOptions
 * @property {boolean} [visible] - Whether the panel starts shown. Defaults to true.
 * @property {'left'|'right'} [dock] - The side of the viewport the panel docks to. Defaults to
 * 'right'.
 * @property {number} [width] - The width of the docked panel in CSS pixels. Defaults to 420.
 * @property {number} [top] - A gap left above the panel in CSS pixels, to keep it clear of other
 * overlays. Defaults to 0.
 * @property {string} [toggleKey] - The `KeyboardEvent.code` or `key` that shows and hides the
 * panel. Defaults to 'Backquote'. Empty disables the key.
 * @property {string} [pauseKey] - The key that pauses and resumes the app. Defaults to 'F9'.
 * @property {string} [stepKey] - The key that advances one frame while paused. Defaults to 'F10'.
 * @property {boolean} [highlight] - Whether the selected node is outlined in the viewport.
 * Defaults to true.
 * @property {Color} [highlightColor] - The color of the outline. Defaults to orange.
 * @property {number} [hierarchyInterval] - Seconds between list refreshes. Defaults to 0.5.
 * @property {number} [propertyInterval] - Seconds between property refreshes. Defaults to 0.1.
 * @property {GraphNode|null} [lockedNode] - A node whose enabled checkbox, and those of its
 * ancestors, are withheld. A script hosting the inspector passes its own entity so the panel
 * cannot switch itself off. Defaults to null.
 * @property {boolean} [physicsDraw] - Whether the physics world is drawn from the start. Defaults
 * to false.
 * @property {InspectorPhysicsDrawOptions} [physicsDrawOptions] - Which parts of the physics world
 * are drawn. Defaults to the wireframe only.
 */

/**
 * Which parts of the physics world the Physics tab draws. Each option is a checkbox on the tab.
 *
 * @typedef {object} InspectorPhysicsDrawOptions
 * @property {boolean} [wireframe] - Collision shapes, colored by activation state. Defaults to
 * true.
 * @property {boolean} [aabb] - Axis-aligned bounds of each body.
 * @property {boolean} [contacts] - Contact points and normals from the last step.
 * @property {boolean} [constraints] - Joint frames.
 * @property {boolean} [limits] - Joint limits.
 * @property {boolean} [normals] - Face normals of mesh shapes.
 * @property {boolean} [frames] - Local axes of each body.
 * @property {boolean} [keepAwake] - Stop bodies from falling asleep while drawing.
 * @property {boolean} [depthTest] - Hide lines behind geometry.
 * @property {number} [range] - Only draw lines within this distance of the camera, in meters. Zero
 * draws everything.
 */

// the Bullet debug flag behind each boolean option
const PHYSICS_FLAGS = {
    wireframe: DEBUG_DRAW.WIREFRAME,
    aabb: DEBUG_DRAW.AABB,
    contacts: DEBUG_DRAW.CONTACT_POINTS,
    constraints: DEBUG_DRAW.CONSTRAINTS,
    limits: DEBUG_DRAW.CONSTRAINT_LIMITS,
    normals: DEBUG_DRAW.NORMALS,
    frames: DEBUG_DRAW.FRAMES,
    keepAwake: DEBUG_DRAW.NO_DEACTIVATION
};

// events the panel swallows so that they never reach the input handlers of the app underneath
const SWALLOWED_EVENTS = ['keydown', 'keyup', 'keypress', 'pointerdown', 'mousedown', 'wheel', 'touchstart', 'contextmenu'];

/**
 * @param {string} tag - The element tag.
 * @param {string} className - The class name.
 * @param {string} [text] - The text content.
 * @returns {HTMLElement} The element.
 */
function el(tag, className, text) {
    const element = document.createElement(tag);
    element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
}

/**
 * @param {Event} e - A keyboard event.
 * @returns {boolean} Whether the key went to a text field.
 */
function isTextTarget(e) {
    const target = /** @type {HTMLInputElement|undefined} */ (e.composedPath()[0]);
    if (!target) return false;
    const tag = target.tagName;
    if (tag === 'INPUT') {
        // checkboxes and buttons take no text, so hotkeys stay live while one has focus
        return !['checkbox', 'radio', 'button', 'range'].includes(target.type);
    }
    return tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

/**
 * An in-page inspector for a running application. It docks a panel over the canvas with four
 * tabs above a live property view of whatever is selected:
 *
 * - Hierarchy: the entity tree. The property view shows the node's transform, every component it
 *   carries and every script instance with its attributes. The selected node is outlined in the
 *   viewport.
 * - Frame graph: the render passes of the last frame in execution order, as the render pass trace
 *   prints them, with the layer steps of forward passes, the light of shadow passes and optional
 *   GPU timings. Render target cells link to the next tab.
 * - Render targets: every render target on the device including the backbuffer, with its
 *   attachments and the passes that rendered into it this frame, linking back to the frame graph.
 * - Physics: the rigid bodies and joints of the scene, with the physics world drawn over the scene
 *   through the engine's debug drawer when Ammo is loaded.
 *
 * The app can be paused and stepped a frame at a time, and the panel can be popped out into its own
 * window to leave the canvas unobscured.
 *
 * The view is read-only, with one exception: the checkbox on each hierarchy row flips the node's
 * enabled flag.
 *
 * ```javascript
 * const inspector = new Inspector(app, { dock: 'left' });
 * inspector.visible = false; // toggle with the backquote key
 * ```
 *
 * Default keys: backquote toggles the panel, F9 pauses and resumes, F10 steps one frame while
 * paused. Pausing sets {@link AppBase#timeScale} to zero and suspends the sound manager, so
 * rendering continues while every time-driven system stands still. Scripts that read the wall
 * clock rather than the frame delta keep moving.
 *
 * The property view is generic: it reflects on the public getters of each component and script,
 * so components it has never heard of show up with all of their state.
 *
 * @category Debug
 */
class Inspector extends EventHandler {
    /**
     * Fired when the panel is shown or hidden, whether through {@link visible}, the toggle key or
     * the panel's own close button. The handler is passed the new visibility.
     *
     * @event
     * @example
     * inspector.on('visible', (visible) => {
     *     console.log(`inspector ${visible ? 'shown' : 'hidden'}`);
     * });
     */
    static EVENT_VISIBLE = 'visible';

    /**
     * The app being inspected.
     *
     * @type {AppBase}
     */
    app;

    /**
     * The `KeyboardEvent.code` or `key` that shows and hides the panel. Empty disables the key.
     *
     * @type {string}
     */
    toggleKey = 'Backquote';

    /**
     * The key that pauses and resumes the app. Empty disables the key.
     *
     * @type {string}
     */
    pauseKey = 'F9';

    /**
     * The key that advances one frame while paused. Empty disables the key.
     *
     * @type {string}
     */
    stepKey = 'F10';

    /**
     * Outline the selected node in the viewport: the bounds of its mesh instances, the frustum of
     * its camera, the shape of its light, or its axes when it has none of those. On the Physics
     * tab, the collision shape or joint of the selected entity.
     *
     * @type {boolean}
     */
    highlight = true;

    /**
     * The color of the viewport outline.
     *
     * @type {Color}
     */
    highlightColor = new Color(1, 0.55, 0.1);

    /**
     * Seconds between refreshes of the active list while the app runs. Structure changes show up
     * within this interval. Refreshes are cheap, but not free on very large scenes.
     *
     * @type {number}
     */
    hierarchyInterval = 0.5;

    /**
     * Seconds between property refreshes of the selected item while the app runs.
     *
     * @type {number}
     */
    propertyInterval = 0.1;

    /**
     * A node whose enabled checkbox, and those of its ancestors, are withheld from the hierarchy.
     *
     * @type {GraphNode|null}
     */
    lockedNode = null;

    /** @private */
    _visible = true;

    /** @private */
    _dock = 'right';

    /** @private */
    _width = 420;

    /** @private */
    _top = 0;

    /** @private */
    _paused = false;

    /** @private */
    _savedTimeScale = 1;

    /** @private */
    _destroyed = false;

    /**
     * @type {Window|null}
     * @private
     */
    _popup = null;

    /**
     * @type {GraphNode|null}
     * @private
     */
    _selected = null;

    /**
     * @type {HTMLElement|null}
     * @private
     */
    _host = null;

    /**
     * @type {HTMLElement}
     * @private
     */
    _panel;

    /**
     * @type {HTMLElement}
     * @private
     */
    _hierarchyEl;

    /**
     * @type {HTMLInputElement}
     * @private
     */
    _filterInput;

    /**
     * @type {HTMLButtonElement}
     * @private
     */
    _pauseBtn;

    /**
     * @type {HTMLButtonElement}
     * @private
     */
    _stepBtn;

    /**
     * @type {HTMLButtonElement}
     * @private
     */
    _popBtn;

    /**
     * @type {HTMLElement}
     * @private
     */
    _countsEl;

    /**
     * @type {HTMLElement}
     * @private
     */
    _pausedEl;

    /**
     * @type {HTMLElement}
     * @private
     */
    _pathEl;

    /**
     * @type {HierarchyView}
     * @private
     */
    _hierarchy;

    /**
     * @type {PropertyView}
     * @private
     */
    _properties;

    /**
     * @type {WireRenderer}
     * @private
     */
    _wire;

    /** @private */
    _nextListRefresh = 0;

    /** @private */
    _nextPropertyRefresh = 0;

    /**
     * @type {'hierarchy'|'passes'|'targets'|'physics'}
     * @private
     */
    _tab = 'hierarchy';

    /**
     * @type {FrameSnapshot|null}
     * @private
     */
    _frame = null;

    /** @private */
    _frozen = false;

    /** @private */
    _gpuWasEnabled = false;

    /**
     * @type {Record<string, HTMLElement>}
     * @private
     */
    _tabButtons = {};

    /**
     * @type {Record<string, HTMLElement>}
     * @private
     */
    _panels = {};

    /**
     * @type {ListView}
     * @private
     */
    _passList;

    /**
     * @type {ListView}
     * @private
     */
    _targetList;

    /**
     * @type {ListView}
     * @private
     */
    _bodyList;

    /**
     * @type {HTMLInputElement}
     * @private
     */
    _gpuToggle;

    /**
     * @type {HTMLInputElement}
     * @private
     */
    _freezeToggle;

    /**
     * @type {AmmoDebugDraw|null}
     * @private
     */
    _physics = null;

    /**
     * @type {HTMLInputElement}
     * @private
     */
    _drawToggle;

    /**
     * @type {HTMLInputElement}
     * @private
     */
    _depthToggle;

    /**
     * @type {HTMLInputElement}
     * @private
     */
    _rangeInput;

    /**
     * The checkbox of each boolean physics draw option, by option name.
     *
     * @type {Record<string, HTMLInputElement>}
     * @private
     */
    _physicsToggles = {};

    /**
     * @type {HTMLElement}
     * @private
     */
    _physicsNote;

    /**
     * The bar holding the options governed by the Draw switch.
     *
     * @type {HTMLElement}
     * @private
     */
    _physicsOptionsBar;

    /**
     * Bodies excluded from the physics drawing, with the native body the exclusion was applied to,
     * or null while the entity has no native body yet.
     *
     * @type {Map<Entity, any>}
     * @private
     */
    _hiddenBodies = new Map();

    /**
     * Model builder for the property view when a pass is selected.
     *
     * @param {FramePass} pass - The pass.
     * @returns {PropertySection[]} The sections.
     * @private
     */
    _passModel = pass => buildPassModel(pass, this._context());

    /**
     * Model builder for the property view when a render target is selected.
     *
     * @param {RenderTarget} rt - The render target.
     * @returns {PropertySection[]} The sections.
     * @private
     */
    _targetModel = rt => buildRenderTargetModel(rt, this._context());

    /**
     * Creates the inspector and shows its panel. The panel is appended to the document body and
     * follows the app until {@link destroy} is called, or the app is destroyed.
     *
     * @param {AppBase} app - The app to inspect.
     * @param {InspectorOptions} [options] - The options.
     * @example
     * const inspector = new Inspector(app, { dock: 'left', width: 480 });
     */
    constructor(app, options = {}) {
        super();
        this.app = app;

        if (options.toggleKey !== undefined) this.toggleKey = options.toggleKey;
        if (options.pauseKey !== undefined) this.pauseKey = options.pauseKey;
        if (options.stepKey !== undefined) this.stepKey = options.stepKey;
        if (options.highlight !== undefined) this.highlight = options.highlight;
        if (options.highlightColor) this.highlightColor.copy(options.highlightColor);
        if (options.hierarchyInterval !== undefined) this.hierarchyInterval = options.hierarchyInterval;
        if (options.propertyInterval !== undefined) this.propertyInterval = options.propertyInterval;
        this.lockedNode = options.lockedNode ?? null;
        this._visible = options.visible ?? true;
        this._dock = options.dock === 'left' ? 'left' : 'right';
        this._width = Math.max(240, Math.min(1600, options.width ?? 420));
        this._top = Math.max(0, options.top ?? 0);

        this._wire = new WireRenderer(app);
        this._buildDom();
        this._hierarchy.setRoot(app.root);
        this._gpuWasEnabled = !!app.graphicsDevice.gpuProfiler?.enabled;
        this._physics = new AmmoDebugDraw(app);
        this.physicsDrawOptions = { wireframe: true, ...options.physicsDrawOptions };
        this.physicsDraw = !!options.physicsDraw;
        this._setTab('hierarchy');
        this._applyLayout();
        this._applyVisibility();
        this._applyPauseState();
        this.refresh();

        window.addEventListener('keydown', this._onKeyDown);
        // the app fires 'update' after every component system has updated, so the physics step of
        // the frame is done by the time the world is drawn
        app.on('update', this._onUpdate, this);
        app.on('destroy', this.destroy, this);
    }

    /**
     * Removes the panel, releases every hook into the app and restores anything the inspector
     * changed: the time scale while paused, the GPU profiler, the physics debug drawer.
     */
    destroy() {
        if (this._destroyed) return;
        this._destroyed = true;

        const app = this.app;
        app.off('update', this._onUpdate, this);
        app.off('destroy', this.destroy, this);
        window.removeEventListener('keydown', this._onKeyDown);

        this.paused = false;
        const profiler = app.graphicsDevice?.gpuProfiler;
        if (profiler) profiler.enabled = this._gpuWasEnabled;
        this._pruneHiddenBodies();
        this._physics?.detach();
        this._physics = null;
        this._hiddenBodies.clear();

        if (this._popup) this.dockBack();
        this._host?.remove();
        this._host = null;
    }

    /**
     * Whether the panel is shown. Toggled by {@link toggleKey}.
     *
     * @type {boolean}
     */
    set visible(value) {
        value = !!value;
        const changed = value !== this._visible;
        this._visible = value;
        if (this._host) {
            if (!value && this._popup) this.dockBack();
            this._applyVisibility();
            if (value) this.refresh();
        }
        if (changed) this.fire(Inspector.EVENT_VISIBLE, value);
    }

    get visible() {
        return this._visible;
    }

    /**
     * The side of the viewport the panel docks to.
     *
     * @type {'left'|'right'}
     */
    set dock(value) {
        this._dock = value === 'left' ? 'left' : 'right';
        this._applyLayout();
    }

    get dock() {
        return this._dock;
    }

    /**
     * The width of the docked panel in CSS pixels. Also adjustable by dragging its inner edge.
     *
     * @type {number}
     */
    set width(value) {
        this._width = Math.max(240, Math.min(1600, value || 420));
        this._applyLayout();
    }

    get width() {
        return this._width;
    }

    /**
     * A gap left above the docked panel in CSS pixels, to keep it clear of other overlays.
     *
     * @type {number}
     */
    set top(value) {
        this._top = Math.max(0, value || 0);
        this._applyLayout();
    }

    get top() {
        return this._top;
    }

    /**
     * Whether the app is paused. Pausing sets {@link AppBase#timeScale} to zero and suspends the
     * sound manager; resuming restores the time scale that was in effect.
     *
     * @type {boolean}
     */
    set paused(value) {
        value = !!value;
        if (value === this._paused) return;
        this._paused = value;

        const app = this.app;
        if (value) {
            this._savedTimeScale = app.timeScale;
            app.timeScale = 0;
            app.soundManager?.suspend();
        } else {
            app.timeScale = this._savedTimeScale;
            app.soundManager?.resume();
        }

        this._applyPauseState();
        if (value) this.refresh();
    }

    get paused() {
        return this._paused;
    }

    /**
     * The node selected in the hierarchy, or null.
     *
     * @type {GraphNode|null}
     */
    get selected() {
        return this._selected;
    }

    /**
     * Whether the physics world is drawn over the scene while the panel is shown. The same as the
     * Draw checkbox of the Physics tab. Hiding the panel suspends the drawing; showing it again
     * resumes it.
     *
     * @type {boolean}
     */
    set physicsDraw(value) {
        this._drawToggle.checked = !!value;
        this._applyPhysicsSettings();
    }

    get physicsDraw() {
        return this._drawToggle.checked;
    }

    /**
     * Which parts of the physics world are drawn, mirroring the checkboxes of the Physics tab.
     * Assigning a partial object changes only the options it names.
     *
     * @type {InspectorPhysicsDrawOptions}
     * @example
     * inspector.physicsDrawOptions = { constraints: true, limits: true };
     */
    set physicsDrawOptions(value) {
        for (const key of Object.keys(PHYSICS_FLAGS)) {
            if (value[key] !== undefined) this._physicsToggles[key].checked = !!value[key];
        }
        if (value.depthTest !== undefined) this._depthToggle.checked = !!value.depthTest;
        if (value.range !== undefined) this._rangeInput.value = String(Math.max(0, value.range || 0));
        this._applyPhysicsSettings();
    }

    get physicsDrawOptions() {
        const options = {};
        for (const key of Object.keys(PHYSICS_FLAGS)) {
            options[key] = this._physicsToggles[key].checked;
        }
        options.depthTest = this._depthToggle.checked;
        options.range = Math.max(0, parseFloat(this._rangeInput.value) || 0);
        return options;
    }

    /**
     * Selects a node, revealing it in the hierarchy and showing its properties.
     *
     * @param {GraphNode|null} node - The node, or null to clear the selection.
     */
    select(node) {
        if (node) this._setTab('hierarchy');
        this._hierarchy.select(node);
    }

    /**
     * Advances the app by one frame. Only meaningful while paused.
     */
    step() {
        if (!this._paused) return;
        const app = this.app;
        app.timeScale = this._savedTimeScale;
        app.once('frameend', () => {
            if (this._paused) app.timeScale = 0;
        });
    }

    /**
     * Refreshes the active list and the property view immediately.
     */
    refresh() {
        if (!this._host) return;
        this._refreshLists(true);
        this._properties.refresh();
    }

    /**
     * Moves the panel into its own browser window, leaving the canvas unobscured. Must be called
     * from a user gesture, or the browser blocks the window.
     */
    popOut() {
        if (this._popup) {
            this._popup.focus();
            return;
        }

        const height = Math.max(480, Math.round(window.innerHeight * 0.9));
        const popup = window.open('', 'pc-inspector', `popup=yes,width=${this._width},height=${height}`);
        if (!popup) {
            // blocked by the browser: say so on the button rather than silently doing nothing
            this._popBtn.textContent = 'Blocked';
            setTimeout(() => this._applyLayout(), 1500);
            return;
        }

        const doc = popup.document;
        doc.title = 'Inspector';
        doc.documentElement.style.height = '100%';
        doc.body.style.cssText = 'margin: 0; height: 100%; background: #1b1d21; overflow: hidden;';
        doc.body.appendChild(doc.adoptNode(this._host));

        popup.addEventListener('pagehide', this._onPopupHide);
        popup.addEventListener('keydown', this._onKeyDown);

        this._popup = popup;
        this._applyLayout();
    }

    /**
     * Brings a popped-out panel back into the page and closes its window.
     */
    dockBack() {
        const popup = this._popup;
        if (!popup) return;
        this._popup = null;

        popup.removeEventListener('pagehide', this._onPopupHide);
        popup.removeEventListener('keydown', this._onKeyDown);

        try {
            document.body.appendChild(document.adoptNode(this._host));
        } catch {
            // the document that held the panel is gone, so the panel is too: build it anew
            const selected = this._selected;
            this._host.remove?.();
            this._buildDom();
            this._hierarchy.setRoot(this.app.root);
            if (selected) this._hierarchy.select(selected);
            this._applyPauseState();
        }

        if (!popup.closed) popup.close();
        this._applyLayout();
        this._applyVisibility();
    }

    /**
     * @param {number} dt - The frame delta, scaled by the app time scale.
     * @private
     */
    _onUpdate(dt) {
        this._drawPhysics();

        // the user closed the pop-out window: bring the panel home
        if (this._popup?.closed) this.dockBack();

        if (!this._visible) return;

        // wall clock, as the frame delta is zero while paused
        const now = performance.now();
        if (now >= this._nextListRefresh) {
            this._nextListRefresh = now + this.hierarchyInterval * 1000;
            this._refreshLists(true);
        }
        if (now >= this._nextPropertyRefresh) {
            this._nextPropertyRefresh = now + this.propertyInterval * 1000;
            this._properties.refresh();
        }

        if (this.highlight) {
            if (this._tab === 'hierarchy' && this._selected) {
                this._drawHighlight(this._selected);
            } else if (this._tab === 'physics') {
                const entity = this._bodyList.selected;
                if (entity) {
                    this._wire.color.copy(this.highlightColor);
                    this._wire.depthTest = false;
                    const jointDrawn = drawJoint(this._wire, entity);
                    const shapeDrawn = drawCollisionShape(this._wire, entity);
                    if (!jointDrawn && !shapeDrawn) this._drawHighlight(entity);
                }
            }
        }
    }

    /**
     * Draws the physics world for this frame. Runs from the app's update event, which fires after
     * the rigid body system has stepped, so the drawn world matches the frame being rendered.
     *
     * @private
     */
    _drawPhysics() {
        const physics = this._physics;
        if (!physics) return;

        // hiding the panel switches the drawing off with it; while disabled the drawer also stops
        // Bullet from reporting contacts, so nothing accumulates unseen
        physics.enabled = this._visible && this._drawToggle.checked;

        if (physics.range > 0) {
            const camera = this.app.systems.camera?.cameras[0];
            physics.center = camera ? camera.entity.getPosition() : null;
        }
        this._pruneHiddenBodies();
        physics.update();
    }

    /**
     * Builds the panel inside a shadow root on a host element appended to the document body.
     *
     * @private
     */
    _buildDom() {
        const host = el('div', 'pc-inspector');
        const shadow = host.attachShadow({ mode: 'open' });

        const style = document.createElement('style');
        style.textContent = styles;

        const panel = el('div', 'pci-panel');

        // toolbar
        const toolbar = el('div', 'pci-toolbar');
        const title = el('span', 'pci-title', 'Inspector');
        this._pauseBtn = /** @type {HTMLButtonElement} */ (el('button', 'pci-btn', 'Pause'));
        this._stepBtn = /** @type {HTMLButtonElement} */ (el('button', 'pci-btn', 'Step'));
        const refreshBtn = el('button', 'pci-btn', 'Refresh');
        this._popBtn = /** @type {HTMLButtonElement} */ (el('button', 'pci-btn', 'Pop out'));
        const closeBtn = el('button', 'pci-btn', '✕');
        const toggleLabel = Inspector._keyLabel(this.toggleKey);
        closeBtn.title = `Hide the panel${toggleLabel ? `. Press ${toggleLabel} to show it again` : ''}`;
        toolbar.append(title, this._pauseBtn, this._stepBtn, refreshBtn, el('span', 'pci-spacer'), this._popBtn, closeBtn);

        this._pauseBtn.addEventListener('click', () => {
            this.paused = !this._paused;
        });
        this._stepBtn.addEventListener('click', () => this.step());
        refreshBtn.addEventListener('click', () => this.refresh());
        this._popBtn.addEventListener('click', () => {
            if (this._popup) this.dockBack();
            else this.popOut();
        });
        closeBtn.addEventListener('click', () => {
            this.visible = false;
        });

        // body: a tabbed list over the properties, with a draggable splitter
        const body = el('div', 'pci-body');
        this._hierarchyEl = el('div', 'pci-hierarchy');

        const tabs = el('div', 'pci-tabs');
        this._tabButtons = {};
        for (const [id, label] of [['hierarchy', 'Hierarchy'], ['passes', 'Frame graph'], ['targets', 'Render targets'], ['physics', 'Physics']]) {
            const tab = el('button', 'pci-tab', label);
            tab.addEventListener('click', () => this._setTab(/** @type {any} */ (id)));
            tabs.appendChild(tab);
            this._tabButtons[id] = tab;
        }

        const filter = el('div', 'pci-filter');
        this._filterInput = /** @type {HTMLInputElement} */ (document.createElement('input'));
        this._filterInput.placeholder = 'Filter by name…';
        this._filterInput.spellcheck = false;
        filter.appendChild(this._filterInput);

        const tree = el('div', 'pci-tree');

        const passPanel = el('div', 'pci-listpanel');
        const passBar = el('div', 'pci-subbar');
        this._gpuToggle = this._makeToggle(passBar, 'GPU timings', 'Enable the GPU profiler and show the time of each pass');
        this._freezeToggle = this._makeToggle(passBar, 'Freeze', 'Stop refreshing the list, to read one frame at leisure');
        const passList = el('div', 'pci-list');
        passPanel.append(passBar, passList);

        const targetList = el('div', 'pci-list');

        // physics: a master switch, the options it governs, then the list of bodies
        const physicsPanel = el('div', 'pci-listpanel');
        const physicsMaster = el('div', 'pci-subbar pci-master');
        this._drawToggle = this._makeToggle(physicsMaster, 'Draw physics world',
            'Draw the physics world over the scene through the engine\'s debug drawer. The options below only apply while this is on');
        this._drawToggle.parentElement.classList.add('pci-strong');
        physicsMaster.appendChild(el('span', 'pci-hint', 'options below apply while on'));
        const physicsBar = el('div', 'pci-subbar pci-wrap pci-options');
        this._physicsOptionsBar = physicsBar;
        const options = [
            ['wireframe', 'Wireframe', 'Collision shapes. White: awake, green: asleep, cyan: about to sleep, red: never sleeps, yellow: not simulated'],
            ['aabb', 'AABB', 'Axis-aligned bounds of each body'],
            ['contacts', 'Contacts', 'Contact points and normals from the last step'],
            ['constraints', 'Constraints', 'Joint frames'],
            ['limits', 'Limits', 'Joint limits'],
            ['normals', 'Normals', 'Face normals of mesh shapes'],
            ['frames', 'Frames', 'Local axes of each body'],
            ['keepAwake', 'Keep awake', 'Stop bodies from falling asleep while drawing']
        ];
        this._physicsToggles = {};
        for (const [key, label, title] of options) {
            const toggle = this._makeToggle(physicsBar, label, title);
            toggle.addEventListener('change', () => this._applyPhysicsSettings());
            this._physicsToggles[key] = toggle;
        }
        this._depthToggle = this._makeToggle(physicsBar, 'Depth test', 'Hide lines behind geometry');
        const range = el('label', 'pci-check', 'Range');
        range.title = 'Only draw lines within this distance of the camera, in meters. 0 draws everything';
        this._rangeInput = /** @type {HTMLInputElement} */ (document.createElement('input'));
        this._rangeInput.type = 'number';
        this._rangeInput.className = 'pci-number';
        this._rangeInput.min = '0';
        this._rangeInput.step = '1';
        this._rangeInput.value = '0';
        range.appendChild(this._rangeInput);
        physicsBar.appendChild(range);
        this._physicsNote = el('div', 'pci-note');
        const bodyList = el('div', 'pci-list');
        physicsPanel.append(physicsMaster, physicsBar, this._physicsNote, bodyList);

        for (const input of [this._drawToggle, this._depthToggle, this._rangeInput]) {
            input.addEventListener('change', () => this._applyPhysicsSettings());
        }
        this._rangeInput.addEventListener('input', () => this._applyPhysicsSettings());

        this._panels = { hierarchy: tree, passes: passPanel, targets: targetList, physics: physicsPanel };
        this._hierarchyEl.append(tabs, filter, tree, passPanel, targetList, physicsPanel);

        const splitter = el('div', 'pci-splitter');
        const properties = el('div', 'pci-properties');
        body.append(this._hierarchyEl, splitter, properties);

        this._gpuToggle.addEventListener('change', () => {
            const profiler = this.app.graphicsDevice.gpuProfiler;
            if (profiler) profiler.enabled = this._gpuToggle.checked;
        });
        this._freezeToggle.addEventListener('change', () => {
            this._frozen = this._freezeToggle.checked;
            this._updateStatus();
        });

        this._filterInput.addEventListener('input', () => this._applyFilter(this._filterInput.value));
        this._filterInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this._filterInput.value = '';
                this._applyFilter('');
                this._filterInput.blur();
            }
        });

        this._makeDraggable(splitter, (e) => {
            const rect = body.getBoundingClientRect();
            const height = Math.max(60, Math.min(rect.height - 60, e.clientY - rect.top));
            this._hierarchyEl.style.flexBasis = `${height}px`;
        });

        // status bar
        const status = el('div', 'pci-status');
        this._countsEl = el('span', 'pci-counts');
        this._pausedEl = el('span', 'pci-paused');
        this._pathEl = el('span', 'pci-path');
        status.append(this._countsEl, this._pausedEl, this._pathEl);

        // width handle on the inner edge
        const edge = el('div', 'pci-edge');
        this._makeDraggable(edge, (e) => {
            const view = /** @type {Window} */ (edge.ownerDocument.defaultView);
            this.width = this._dock === 'right' ? view.innerWidth - e.clientX : e.clientX;
        });

        panel.append(toolbar, body, status, edge);
        shadow.append(style, panel);

        // keep the app's input handlers from seeing interaction with the panel
        for (const type of SWALLOWED_EVENTS) {
            host.addEventListener(type, (e) => {
                e.stopPropagation();
                if (type === 'keydown' && !isTextTarget(e)) this._onKeyDown(/** @type {KeyboardEvent} */ (e));
            });
        }

        document.body.appendChild(host);

        this._host = host;
        this._panel = panel;
        this._properties = new PropertyView(properties, target => this._selectAny(target));
        this._hierarchy = new HierarchyView(tree, (node) => {
            this._selected = node;
            if (this._tab === 'hierarchy') this._properties.setSubject(node, buildNodeModel);
            this._updateStatus();
        });
        this._hierarchy.isLocked = node => this._isLocked(node);
        this._hierarchy.onToggle = () => this._properties.refresh();
        this._passList = new ListView(passList, (pass, key) => {
            if (this._tab === 'passes') this._properties.setSubject(pass, this._passModel, key);
            this._updateStatus();
        }, target => this._selectAny(target));
        this._targetList = new ListView(targetList, (rt, key) => {
            if (this._tab === 'targets') this._properties.setSubject(rt, this._targetModel, key);
            this._updateStatus();
        }, target => this._selectAny(target));
        this._bodyList = new ListView(bodyList, (entity) => {
            if (this._tab === 'physics') this._properties.setSubject(entity, buildNodeModel);
            this._updateStatus();
        }, target => this._selectAny(target));
        this._bodyList.onToggle = (entity, drawn) => this._setBodyDrawn(entity, drawn);
    }

    /**
     * @param {HTMLElement} handle - The element to drag.
     * @param {(e: PointerEvent) => void} onMove - Called with every pointer move while dragging.
     * @private
     */
    _makeDraggable(handle, onMove) {
        handle.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            handle.setPointerCapture(e.pointerId);
            const move = onMove;
            const up = () => {
                handle.removeEventListener('pointermove', move);
                handle.removeEventListener('pointerup', up);
                handle.removeEventListener('pointercancel', up);
            };
            handle.addEventListener('pointermove', move);
            handle.addEventListener('pointerup', up);
            handle.addEventListener('pointercancel', up);
        });
    }

    /**
     * Includes or excludes one body from the physics drawing, from its checkbox in the list.
     *
     * @param {Entity} entity - The entity carrying the rigid body.
     * @param {boolean} drawn - Whether the body is drawn.
     * @private
     */
    _setBodyDrawn(entity, drawn) {
        const physics = this._physics;
        if (drawn) {
            const body = this._hiddenBodies.get(entity);
            this._hiddenBodies.delete(entity);
            if (body && physics) physics.showBody(body);
        } else {
            const body = entity.rigidbody?.body ?? null;
            this._hiddenBodies.set(entity, body);
            if (body && physics) physics.hideBody(body);
        }
        if (this._tab === 'physics') this._refreshLists(false);
    }

    /**
     * Keeps the exclusions in step with the engine: a body the engine rebuilt is excluded again, a
     * destroyed one is forgotten without being touched, and an entity that lost its component
     * drops out.
     *
     * @private
     */
    _pruneHiddenBodies() {
        const physics = this._physics;
        for (const [entity, body] of this._hiddenBodies) {
            const rigidbody = entity.rigidbody;
            const current = rigidbody?.body ?? null;
            if (current === body) continue;
            if (body && physics) physics.forgetBody(body);
            if (!rigidbody) {
                this._hiddenBodies.delete(entity);
            } else {
                this._hiddenBodies.set(entity, current);
                if (current && physics) physics.hideBody(current);
            }
        }
    }

    /**
     * Pushes the physics tab's controls into the debug drawer.
     *
     * @private
     */
    _applyPhysicsSettings() {
        const physics = this._physics;
        if (!physics) return;

        let mode = 0;
        for (const [key, flag] of Object.entries(PHYSICS_FLAGS)) {
            if (this._physicsToggles[key].checked) mode |= flag;
        }

        const draw = this._drawToggle.checked;
        physics.enabled = this._visible && draw;
        physics.mode = mode;
        physics.depthTest = this._depthToggle.checked;
        physics.range = Math.max(0, parseFloat(this._rangeInput.value) || 0);

        // the options and the per-body checkboxes mean nothing while the master switch is off
        this._physicsOptionsBar.classList.toggle('pci-inactive', !draw);
        for (const input of this._physicsOptionsBar.querySelectorAll('input')) {
            input.disabled = !draw;
        }
        if (this._tab === 'physics') this._refreshLists(false);
    }

    /**
     * @param {HTMLElement} parent - The bar to add the toggle to.
     * @param {string} label - The label.
     * @param {string} title - The tooltip.
     * @returns {HTMLInputElement} The checkbox.
     * @private
     */
    _makeToggle(parent, label, title) {
        const wrap = el('label', 'pci-check', label);
        wrap.title = title;
        const input = /** @type {HTMLInputElement} */ (document.createElement('input'));
        input.type = 'checkbox';
        wrap.prepend(input);
        parent.appendChild(wrap);
        return input;
    }

    /**
     * Switches the list tab and points the property view at that tab's selection.
     *
     * @param {'hierarchy'|'passes'|'targets'|'physics'} tab - The tab.
     * @private
     */
    _setTab(tab) {
        this._tab = tab;
        for (const [id, button] of Object.entries(this._tabButtons)) {
            button.classList.toggle('pci-active', id === tab);
        }
        for (const [id, panel] of Object.entries(this._panels)) {
            panel.style.display = id === tab ? '' : 'none';
        }
        this._refreshLists(false);
        if (tab === 'hierarchy') {
            this._properties.setSubject(this._hierarchy.selected, buildNodeModel);
        }
        this._updateStatus();
    }

    /**
     * Refreshes the active list. The frame graph is re-captured only when asked and not frozen, so
     * switching tabs keeps the frame the links were built from. Forward passes are recreated every
     * frame, so the property view is pointed at the current object under the selected row's key.
     *
     * @param {boolean} capture - Whether to take a fresh frame snapshot first.
     * @private
     */
    _refreshLists(capture) {
        const device = this.app.graphicsDevice;

        if (this._tab === 'hierarchy') {
            this._hierarchy.refresh();
        } else if (this._tab === 'physics') {
            const system = this.app.systems.rigidbody;
            const note = !system ? 'No rigid body component system is registered in this app.' :
                !system.dynamicsWorld ? 'The physics world has not been created. Is Ammo loaded?' :
                    !AmmoDebugDraw.isAvailable(this.app) ? 'This Ammo build has no DebugDrawer, so the world cannot be drawn.' : '';
            this._physicsNote.textContent = note;
            this._physicsNote.style.display = note ? '' : 'none';

            this._bodyList.setRows([...bodyRows(this.app, this._hiddenBodies, this._drawToggle.checked), ...jointRows(this.app)]);
            const entity = this._bodyList.selected;
            if (entity !== this._properties.subject) {
                this._properties.setSubject(entity, buildNodeModel);
            }
        } else {
            if ((capture && !this._frozen) || !this._frame) {
                this._frame = captureFrameGraph(this.app);
            }
            if (this._tab === 'passes') {
                this._passList.setRows(passRows(this._frame, device));
                const pass = this._passList.selected;
                if (pass !== this._properties.subject) {
                    this._properties.setSubject(pass, this._passModel, this._passList.selectedKey);
                }
            } else {
                this._targetList.setRows(renderTargetRows(device, this._frame));
                const rt = this._targetList.selected;
                if (rt !== this._properties.subject) {
                    this._properties.setSubject(rt, this._targetModel, this._targetList.selectedKey);
                }
            }
        }

        this._updateStatus();
    }

    /**
     * @param {string} value - The filter text, applied to every list.
     * @private
     */
    _applyFilter(value) {
        this._hierarchy.filter = value;
        this._passList.filter = value;
        this._targetList.filter = value;
        this._bodyList.filter = value;
        this._refreshLists(false);
    }

    /**
     * Reveals a linked object in the tab that lists it: nodes in the hierarchy, passes in the frame
     * graph, render targets in their list.
     *
     * @param {*} target - The object.
     * @private
     */
    _selectAny(target) {
        if (target instanceof GraphNode) {
            this._setTab('hierarchy');
            this._hierarchy.select(target);
        } else if (target instanceof RenderTarget) {
            this._setTab('targets');
            this._targetList.selectItem(target);
        } else if (target instanceof FramePass) {
            this._setTab('passes');
            this._passList.selectItem(target);
        }
    }

    /**
     * @returns {{ device: GraphicsDevice, frame: FrameSnapshot|null }} What the pass and target
     * model builders need besides their subject.
     * @private
     */
    _context() {
        return { device: this.app.graphicsDevice, frame: this._frame };
    }

    /**
     * @param {KeyboardEvent} e - The event.
     * @private
     */
    _onKeyDown = (e) => {
        if (e.repeat) return;

        // match on either the physical code ('Backquote') or the logical key ('`')
        const matches = key => !!key && (e.code === key || e.key === key);

        if (matches(this.toggleKey)) {
            e.preventDefault();
            this.visible = !this._visible;
        } else if (matches(this.pauseKey)) {
            e.preventDefault();
            this.paused = !this._paused;
        } else if (matches(this.stepKey)) {
            e.preventDefault();
            this.step();
        }
    };

    /**
     * @private
     */
    _onPopupHide = () => {
        this.dockBack();
    };

    /**
     * @private
     */
    _applyVisibility() {
        if (!this._host) return;
        this._host.style.display = this._visible ? '' : 'none';
    }

    /**
     * @private
     */
    _applyLayout() {
        if (!this._panel) return;
        const popped = !!this._popup;
        this._panel.classList.toggle('pci-popout', popped);
        this._panel.classList.toggle('pci-dock-left', !popped && this._dock === 'left');
        this._panel.style.width = popped ? '' : `${this._width}px`;
        this._panel.style.top = popped ? '' : `${this._top}px`;
        this._popBtn.textContent = popped ? 'Dock' : 'Pop out';
    }

    /**
     * @param {string} key - A `KeyboardEvent.code` or `key`.
     * @returns {string} The key as shown on a button, or an empty string when unset.
     */
    static _keyLabel(key) {
        if (!key) return '';
        const labels = { Backquote: '`', Space: 'Space', Escape: 'Esc' };
        return labels[key] ?? key.replace(/^Key|^Digit/, '');
    }

    /**
     * @param {string} key - A `KeyboardEvent.code` or `key`.
     * @returns {string} The key in brackets for a button label, or an empty string when unset.
     */
    static _keyHint(key) {
        const label = Inspector._keyLabel(key);
        return label ? ` (${label})` : '';
    }

    /**
     * @private
     */
    _applyPauseState() {
        if (!this._pauseBtn) return;
        const paused = this._paused;
        this._pauseBtn.textContent = `${paused ? 'Resume' : 'Pause'}${Inspector._keyHint(this.pauseKey)}`;
        this._pauseBtn.title = paused ? 'Resume the app' : 'Pause the app: rendering continues, time stands still';
        this._pauseBtn.classList.toggle('pci-active', paused);
        this._stepBtn.textContent = `Step${Inspector._keyHint(this.stepKey)}`;
        this._stepBtn.title = 'Advance one frame while paused';
        this._stepBtn.disabled = !paused;
        this._pausedEl.textContent = paused ? 'PAUSED' : '';
    }

    /**
     * @private
     */
    _updateStatus() {
        if (!this._countsEl) return;
        const device = this.app.graphicsDevice;
        let counts = '';
        let selected = '';

        switch (this._tab) {
            case 'passes': {
                const gpu = this._frame?.frameTime;
                // WebGL times the frame with a single query; only WebGPU timestamps each pass
                const perPass = device.isWebGPU ? '' : ' (per-pass times need WebGPU)';
                counts = `${this._frame?.entries.length ?? 0} passes` +
                    `${gpu !== undefined ? ` · GPU ${gpu.toFixed(2)} ms${perPass}` : ''}${this._frozen ? ' · frozen' : ''}`;
                const pass = this._passList.selected;
                selected = pass ? passDisplayName(pass) : '';
                break;
            }
            case 'targets': {
                counts = `${this._targetList.rowCount} render targets · ${this._frame?.usage.size ?? 0} used this frame`;
                const rt = this._targetList.selected;
                selected = rt ? (rt === device.backBuffer ? 'Backbuffer' : rt.name) : '';
                break;
            }
            case 'physics': {
                const stats = physicsStats(this.app);
                const physics = this._physics;
                counts = `${stats.bodies} bodies · ${stats.active} awake · ${stats.contacts} contacts` +
                    `${stats.joints ? ` · ${stats.joints} joints` : ''}` +
                    ` · step ${stats.time.toFixed(2)} ms${physics?.enabled ? ` · ${physics.lineCount} lines` : ''}` +
                    `${physics?.culledCount ? ` (${physics.culledCount} out of range)` : ''}`;
                selected = this._bodyList.selected?.name ?? '';
                break;
            }
            default: {
                const { nodeCount, entityCount } = this._hierarchy;
                counts = `${entityCount} entities · ${nodeCount - entityCount} graph nodes`;
                selected = this._selected?.path ?? '';
            }
        }

        this._countsEl.textContent = counts;
        this._pathEl.textContent = selected;
        this._pathEl.title = selected;
    }

    /**
     * Outlines a node in the viewport for the current frame.
     *
     * @param {GraphNode} node - The node.
     * @private
     */
    _drawHighlight(node) {
        const wire = this._wire;
        wire.color.copy(this.highlightColor);
        wire.depthTest = false;

        let drawn = false;

        if (node instanceof Entity) {
            const meshInstances = node.render?.meshInstances ?? node.model?.meshInstances;
            if (meshInstances) {
                for (const meshInstance of meshInstances) {
                    if (meshInstance.visible) {
                        wire.box(meshInstance.aabb);
                        drawn = true;
                    }
                }
            }

            const splatAabb = node.gsplat?.customAabb;
            if (splatAabb) {
                wire.box(splatAabb);
                drawn = true;
            }

            if (node.camera) {
                wire.frustum(node.camera);
                drawn = true;
            }

            if (node.light) {
                wire.light(node.light, this._highlightSize(node));
                drawn = true;
            }

            const corners = node.element?.worldCorners;
            if (corners) {
                wire.loop(corners);
                drawn = true;
            }
        }

        if (!drawn) {
            wire.axes(node.getWorldTransform(), this._highlightSize(node));
        }
    }

    /**
     * {@link lockedNode} and its ancestors cannot be disabled from the panel, as that would switch
     * the panel off with them.
     *
     * @param {GraphNode} node - The node.
     * @returns {boolean} Whether the node's enabled checkbox is withheld.
     * @private
     */
    _isLocked(node) {
        for (let current = this.lockedNode; current; current = current.parent) {
            if (current === node) return true;
        }
        return false;
    }

    /**
     * @param {GraphNode} node - The node.
     * @returns {number} A size that reads well from the closest camera.
     * @private
     */
    _highlightSize(node) {
        const cameras = this.app.systems.camera?.cameras;
        let distance = 10;
        if (cameras?.length) {
            distance = Infinity;
            for (const camera of cameras) {
                distance = Math.min(distance, camera.entity.getPosition().distance(node.getPosition()));
            }
        }
        return Math.max(0.05, distance * 0.06);
    }
}

export { Inspector };
