import { Color } from '../../core/math/color.js';
import { Asset } from '../../framework/asset/asset.js';
import { Entity } from '../../framework/entity.js';
import { FramePass } from '../../platform/graphics/frame-pass.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { Shader } from '../../platform/graphics/shader.js';
import { Texture } from '../../platform/graphics/texture.js';
import { LAYERID_UI } from '../../scene/constants.js';
import { GraphNode } from '../../scene/graph-node.js';
import { RenderPassForward } from '../../scene/renderer/render-pass-forward.js';
import { TextureRenderer } from '../renderers/texture-renderer.js';
import { WireRenderer } from '../renderers/wire-renderer.js';

import { ASSET_SORTS, assetRows, buildAssetModel, collectAssets } from './asset-view.js';
import { INSTANCES_PER_PAGE, LayerStepSelection, buildPassModel, buildStepModel, captureFrameGraph, passRows } from './frame-graph-view.js';
import { BUFFER_KINDS, bufferBytes, bufferKind, bufferOwners, bufferRows, buildBufferModel, collectBuffers, idOf, memorySummary } from './memory-view.js';
import { HierarchyView } from './hierarchy-view.js';
import { ListView } from './list-view.js';
import { formatBytes, formatName, passDisplayName } from './model.js';
import { buildNodeModel } from './node-model.js';
import { AmmoDebugDraw, DEBUG_DRAW } from './physics-debug.js';
import { bodyRows, drawCollisionShape, drawJoint, jointRows, physicsStats } from './physics-view.js';
import { PropertyView } from './property-view.js';
import { buildRenderTargetModel, formatChannels, isDepthFormat, previewAttachments, previewSupport, renderTargetRows, storedBottomUp } from './render-target-view.js';
import { buildShaderModel, collectShaders, shaderRows, stateName } from './shader-view.js';
import { styles } from './styles.js';
import { installTooltip, setTip } from './tooltip.js';
import { buildTextureModel, collectTextures, textureRows } from './texture-view.js';

/** @import { AppBase } from '../../framework/app-base.js' */
/** @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js' */
/** @import { FrameSnapshot, PassModelContext } from './frame-graph-view.js' */
/** @import { MeshInstance } from '../../scene/mesh-instance.js' */
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
 * @property {GraphNode|null} [lockedNode] - A node whose enabled checkbox, and those of its
 * ancestors, are withheld. A script hosting the inspector passes its own entity so the panel
 * cannot switch itself off. Defaults to null.
 * @property {(visible: boolean) => void} [onVisibleChange] - Called with the new visibility
 * whenever the panel is shown or hidden, whether through {@link Inspector#visible}, the toggle key
 * or the panel's own close button.
 * @property {string|null} [storageKey] - The local storage key the panel's settings are kept
 * under, so they survive a reload or a restart of the app: the physics drawing switch and options,
 * the bodies excluded from it (by entity path), the active tab, the panel width and the GPU
 * timings switch. Stored settings take precedence over the defaults given here. Defaults to
 * 'pc-inspector'; null keeps nothing.
 */

/**
 * Which parts of the physics world the Physics tab draws. Each option is a checkbox on the tab.
 *
 * @typedef {object} InspectorPhysicsDrawOptions
 * @ignore
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

// seconds between refreshes of the active list, and of the selected item's properties
const LIST_INTERVAL = 0.5;
const PROPERTY_INTERVAL = 0.1;

// the tooltips of the tabs
const TAB_TIPS = {
    hierarchy: 'The entity tree, and the components and properties of the selected entity',
    assets: 'The assets of the registry, and what uses each',
    passes: 'The passes that rendered the last frame, with the layers, draws and targets of each',
    targets: 'The render targets on the device, with a live preview of their textures',
    textures: 'The textures on the device, largest first, with a live preview',
    memory: 'The vertex, index, uniform and storage buffers on the device, and what uses each',
    shaders: 'The compiled shaders, with their sources',
    physics: 'The rigid bodies and joints of the physics world, and its debug drawing'
};

const CHANNELS_TIP = 'Which channels of the texture to show. A single channel shows as grayscale';

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
 *   The selected target's attachment can be previewed live in a corner of the viewport.
 * - Textures: every texture on the device, largest GPU footprint first, with the same live preview.
 *   Texture values elsewhere, such as the maps of a material, link here.
 * - Memory: video memory by kind of resource, and every buffer on the device, largest first, named
 *   after the mesh, material or asset it was found to belong to. Buffer values elsewhere link here.
 * - Shaders: every shader on the device with its language, state and vertex attributes. The
 *   compiled variants listed on a material link here.
 * - Assets: every asset in the registry with its file, load state and the components using it.
 *   Asset references on a component link here, and a texture names the asset it came from.
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
 * inspector.visible = false; // show again with the backquote key
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
class Inspector {
    /**
     * Called with the new visibility whenever the panel is shown or hidden, whether through
     * {@link visible}, the toggle key or the panel's own close button. Set from the
     * {@link InspectorOptions#onVisibleChange} option, or assigned later.
     *
     * @type {((visible: boolean) => void)|null}
     */
    onVisibleChange = null;

    /**
     * @type {AppBase}
     * @private
     */
    _app;

    /** @private */
    _toggleKey = 'Backquote';

    /** @private */
    _pauseKey = 'F9';

    /** @private */
    _stepKey = 'F10';

    /**
     * @type {Color}
     * @private
     */
    _highlightColor = new Color(1, 0.55, 0.1);

    /**
     * @type {GraphNode|null}
     * @private
     */
    _lockedNode = null;

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
     * @type {'hierarchy'|'assets'|'passes'|'targets'|'textures'|'memory'|'shaders'|'physics'}
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
     * Draws the selected render target's texture over the canvas, straight from the GPU.
     *
     * @type {TextureRenderer}
     * @private
     */
    _textures;

    /**
     * @type {HTMLInputElement}
     * @private
     */
    _previewToggle;

    /**
     * @type {HTMLSelectElement}
     * @private
     */
    _previewAttachment;

    /**
     * @type {HTMLSelectElement}
     * @private
     */
    _previewChannels;

    /**
     * @type {HTMLElement}
     * @private
     */
    _previewNote;

    /**
     * The attachment keys the selector currently offers, to rebuild it only when they change.
     *
     * @private
     */
    _previewKeys = '';

    /**
     * @type {ListView}
     * @private
     */
    _textureList;

    /**
     * @type {ListView}
     * @private
     */
    _shaderList;

    /**
     * @type {ListView}
     * @private
     */
    _assetList;

    /**
     * @type {ListView}
     * @private
     */
    _bufferList;

    /**
     * @type {HTMLInputElement}
     * @private
     */
    _passPreviewToggle;

    /**
     * @type {HTMLInputElement}
     * @private
     */
    _debugFrameToggle;

    /**
     * @type {HTMLElement}
     * @private
     */
    _passNote;

    /**
     * @type {HTMLElement}
     * @private
     */
    _debugEl;

    /**
     * The debug frame while it is on: the layer step it stops in, by its list key, the draw it stops
     * at within that step's list, and the instance drawn last, which keeps the choice when the sort
     * order shifts. Null while it is off.
     *
     * @type {{ stepKey: string|null, index: number, instance: MeshInstance|null, wasPaused: boolean }|null}
     * @private
     */
    _debugFrame = null;

    /**
     * The page each forward pass layer step shows, by pass row key and step, kept across refreshes.
     *
     * @type {Map<string, number>}
     * @private
     */
    _instancePages = new Map();

    /**
     * @type {HTMLSelectElement}
     * @private
     */
    _bufferKind;

    /**
     * @type {HTMLElement}
     * @private
     */
    _memoryNote;

    /**
     * Model builder for the property view when a buffer is selected.
     *
     * @param {*} buffer - The buffer.
     * @returns {PropertySection[]} The sections.
     * @private
     */
    _bufferModel = buffer => buildBufferModel(buffer, this._context());

    /**
     * @type {HTMLSelectElement}
     * @private
     */
    _assetSort;

    /**
     * Model builder for the property view when an asset is selected.
     *
     * @param {Asset} asset - The asset.
     * @returns {PropertySection[]} The sections.
     * @private
     */
    _assetModel = asset => buildAssetModel(asset, this._context());

    /**
     * @type {HTMLInputElement}
     * @private
     */
    _texturePreviewToggle;

    /**
     * @type {HTMLSelectElement}
     * @private
     */
    _textureChannels;

    /**
     * @type {HTMLElement}
     * @private
     */
    _textureNote;

    /**
     * Model builder for the property view when a texture is selected.
     *
     * @param {Texture} texture - The texture.
     * @returns {PropertySection[]} The sections.
     * @private
     */
    _textureModel = texture => buildTextureModel(texture, this._context());

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
     * Entity paths of excluded bodies restored from storage, waiting for the entities to exist.
     *
     * @type {Set<string>}
     * @private
     */
    _pendingHiddenPaths = new Set();

    /**
     * @type {string|null}
     * @private
     */
    _storageKey = 'pc-inspector';

    /**
     * True while the panel is being built and restored, when nothing should be saved.
     *
     * @private
     */
    _restoring = true;

    /**
     * Model builder for the property view when a pass is selected.
     *
     * @param {FramePass} pass - The pass.
     * @returns {PropertySection[]} The sections.
     * @private
     */
    _passModel = pass => buildPassModel(pass, this._context());

    /**
     * Model builder for the property view when a layer step of a forward pass is selected.
     *
     * @param {LayerStepSelection} selection - The step and its pass.
     * @returns {PropertySection[]} The sections.
     * @private
     */
    _stepModel = selection => buildStepModel(selection, this._context());

    /**
     * @param {*} item - What a row of the pass list selects: a pass, or one of its layer steps.
     * @returns {(subject: *) => PropertySection[]} The model builder that shows it.
     * @private
     */
    _passListModel(item) {
        return item instanceof LayerStepSelection ? this._stepModel : this._passModel;
    }

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
        this._app = app;

        if (options.toggleKey !== undefined) this._toggleKey = options.toggleKey;
        if (options.pauseKey !== undefined) this._pauseKey = options.pauseKey;
        if (options.stepKey !== undefined) this._stepKey = options.stepKey;
        this._lockedNode = options.lockedNode ?? null;
        this.onVisibleChange = options.onVisibleChange ?? null;
        this._visible = options.visible ?? true;
        this._dock = options.dock === 'left' ? 'left' : 'right';
        this._width = Math.max(240, Math.min(1600, options.width ?? 420));
        this._top = Math.max(0, options.top ?? 0);

        this._wire = new WireRenderer(app);
        this._textures = new TextureRenderer(app);
        this._buildDom();
        this._hierarchy.setRoot(app.root);
        this._gpuWasEnabled = !!app.graphicsDevice.gpuProfiler?.enabled;
        this._physics = new AmmoDebugDraw(app);
        this._physicsDrawOptions = { wireframe: true };
        this._physicsDraw = false;
        this._setTab('hierarchy');
        this._storageKey = options.storageKey === undefined ? 'pc-inspector' : options.storageKey;
        this._loadSettings();
        this._applyLayout();
        this._applyVisibility();
        this._applyPauseState();
        this._refresh();
        this._restoring = false;

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

        const app = this._app;
        app.off('update', this._onUpdate, this);
        app.off('destroy', this.destroy, this);
        window.removeEventListener('keydown', this._onKeyDown);
        this._setDebugFrame(false);

        this.paused = false;
        const profiler = app.graphicsDevice?.gpuProfiler;
        if (profiler) profiler.enabled = this._gpuWasEnabled;
        this._pruneHiddenBodies();
        this._physics?.detach();
        this._physics = null;
        this._hiddenBodies.clear();

        if (this._popup) this._dockBack();
        this._textures.destroy();
        this._host?.remove();
        this._host = null;
    }

    /**
     * Whether the panel is shown. Toggled by the toggle key.
     *
     * @type {boolean}
     */
    set visible(value) {
        value = !!value;
        // a hidden panel leaves nothing on screen saying the frame is cut short
        if (!value && this._debugFrame) this._setDebugFrame(false);
        const changed = value !== this._visible;
        this._visible = value;
        if (this._host) {
            if (!value && this._popup) this._dockBack();
            this._applyVisibility();
            if (value) this._refresh();
        }
        if (changed) this.onVisibleChange?.(value);
    }

    get visible() {
        return this._visible;
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

        const app = this._app;
        if (value) {
            this._savedTimeScale = app.timeScale;
            app.timeScale = 0;
            app.soundManager?.suspend();
        } else {
            app.timeScale = this._savedTimeScale;
            app.soundManager?.resume();
        }

        this._applyPauseState();
        if (value) this._refresh();
    }

    get paused() {
        return this._paused;
    }

    /**
     * Whether the physics world is drawn over the scene while the panel is shown: the Draw checkbox
     * of the Physics tab. Hiding the panel suspends the drawing; showing it again resumes it.
     *
     * @type {boolean}
     * @private
     */
    set _physicsDraw(value) {
        this._drawToggle.checked = !!value;
        this._applyPhysicsSettings();
    }

    get _physicsDraw() {
        return this._drawToggle.checked;
    }

    /**
     * Which parts of the physics world are drawn, mirroring the checkboxes of the Physics tab.
     * Assigning a partial object changes only the options it names.
     *
     * @type {InspectorPhysicsDrawOptions}
     * @private
     */
    set _physicsDrawOptions(value) {
        for (const key of Object.keys(PHYSICS_FLAGS)) {
            if (value[key] !== undefined) this._physicsToggles[key].checked = !!value[key];
        }
        if (value.depthTest !== undefined) this._depthToggle.checked = !!value.depthTest;
        if (value.range !== undefined) this._rangeInput.value = String(Math.max(0, value.range || 0));
        this._applyPhysicsSettings();
    }

    get _physicsDrawOptions() {
        /** @type {InspectorPhysicsDrawOptions} */
        const options = {};
        for (const key of Object.keys(PHYSICS_FLAGS)) {
            options[key] = this._physicsToggles[key].checked;
        }
        options.depthTest = this._depthToggle.checked;
        options.range = Math.max(0, parseFloat(this._rangeInput.value) || 0);
        return options;
    }

    /**
     * Advances the app by one frame. Only meaningful while paused.
     */
    step() {
        if (!this._paused) return;
        const app = this._app;
        app.timeScale = this._savedTimeScale;
        app.once('frameend', () => {
            if (this._paused) app.timeScale = 0;
        });
    }

    /**
     * Refreshes the active list and the property view immediately.
     *
     * @private
     */
    _refresh() {
        if (!this._host) return;
        this._refreshLists(true);
        this._properties.refresh();
    }

    /**
     * Moves the panel into its own browser window, leaving the canvas unobscured. Must be called
     * from a user gesture, or the browser blocks the window.
     *
     * @private
     */
    _popOut() {
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
     *
     * @private
     */
    _dockBack() {
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
            this._hierarchy.setRoot(this._app.root);
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
        if (this._popup?.closed) this._dockBack();

        if (!this._visible) return;

        // wall clock, as the frame delta is zero while paused
        const now = performance.now();
        if (now >= this._nextListRefresh) {
            this._nextListRefresh = now + LIST_INTERVAL * 1000;
            this._refreshLists(true);
        }
        if (now >= this._nextPropertyRefresh) {
            this._nextPropertyRefresh = now + PROPERTY_INTERVAL * 1000;
            this._properties.refresh();
        }

        if (this._tab === 'hierarchy' && this._selected) {
            this._drawHighlight(this._selected);
        } else if (this._tab === 'physics') {
            const entity = this._bodyList.selected;
            if (entity) {
                this._wire.color.copy(this._highlightColor);
                this._wire.depthTest = false;
                const jointDrawn = drawJoint(this._wire, entity, this._highlightSize(entity));
                const shapeDrawn = drawCollisionShape(this._wire, entity);
                if (!jointDrawn && !shapeDrawn) this._drawHighlight(entity);
            }
        }

        if (this._tab === 'targets') {
            this._drawTargetPreview();
        } else if (this._tab === 'textures') {
            this._drawTexturePreview();
        } else if (this._tab === 'passes') {
            this._drawPassPreview();
        }

        // written every frame, as the forward passes it matches are rebuilt every frame
        if (this._debugFrame) this._applyDebugFrame();
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
            const camera = this._app.systems.camera?.cameras[0];
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
        const toggleLabel = Inspector._keyLabel(this._toggleKey);
        setTip(closeBtn, `Hide the panel${toggleLabel ? `. Press ${toggleLabel} to show it again` : ''}`);
        setTip(refreshBtn, 'Rebuild the list and the properties now, instead of at the next refresh');
        toolbar.append(title, this._pauseBtn, this._stepBtn, refreshBtn, el('span', 'pci-spacer'), this._popBtn, closeBtn);

        this._pauseBtn.addEventListener('click', () => {
            this.paused = !this._paused;
        });
        this._stepBtn.addEventListener('click', () => this.step());
        refreshBtn.addEventListener('click', () => this._refresh());
        this._popBtn.addEventListener('click', () => {
            if (this._popup) this._dockBack();
            else this._popOut();
        });
        closeBtn.addEventListener('click', () => {
            this.visible = false;
        });

        // body: a tabbed list over the properties, with a draggable splitter
        const body = el('div', 'pci-body');
        this._hierarchyEl = el('div', 'pci-hierarchy');

        const tabs = el('div', 'pci-tabs');
        this._tabButtons = {};
        const tabList = [
            ['hierarchy', 'Hierarchy'], ['assets', 'Assets'], ['passes', 'Frame graph'],
            ['targets', 'Render targets'], ['textures', 'Textures'], ['memory', 'Memory'],
            ['shaders', 'Shaders'], ['physics', 'Physics']
        ];
        for (const [id, label] of tabList) {
            const tab = el('button', 'pci-tab', label);
            setTip(tab, TAB_TIPS[id]);
            tab.addEventListener('click', () => this._setTab(/** @type {any} */ (id)));
            tabs.appendChild(tab);
            this._tabButtons[id] = tab;
        }

        const filter = el('div', 'pci-filter');
        this._filterInput = /** @type {HTMLInputElement} */ (document.createElement('input'));
        this._filterInput.placeholder = 'Filter by name…';
        setTip(this._filterInput, 'Show only the items of this tab whose name contains the text');
        this._filterInput.spellcheck = false;
        filter.appendChild(this._filterInput);

        const tree = el('div', 'pci-tree');

        const passPanel = el('div', 'pci-listpanel');
        const passBar = el('div', 'pci-subbar');
        this._gpuToggle = this._makeToggle(passBar, 'GPU timings',
            'Enable the GPU profiler and show the time each pass takes on the GPU. Measuring adds a little overhead');
        this._freezeToggle = this._makeToggle(passBar, 'Freeze',
            'Keep showing the frame captured now while the app runs on, to read it at leisure. Pause stops the app itself');
        this._passPreviewToggle = this._makeToggle(passBar, 'Preview',
            'Draw the selected pass\'s render target over the free part of the viewport');
        this._passPreviewToggle.checked = true;
        this._debugFrameToggle = this._makeToggle(passBar, 'Debug frame',
            'Pause and draw the selected forward pass only up to a chosen draw, stepping with the arrow keys');
        if (!this._app.renderer?.debugDrawLimitSupported) {
            this._debugFrameToggle.disabled = true;
            setTip(this._debugFrameToggle.parentElement, 'Stepping through draws needs the debug engine');
        }
        this._passNote = el('div', 'pci-note pci-note-info');
        this._passNote.style.display = 'none';
        const passList = el('div', 'pci-list');
        passPanel.append(passBar, this._passNote, passList);

        // render targets: a live preview of the selected target, drawn over the canvas
        const targetPanel = el('div', 'pci-listpanel');
        const targetBar = el('div', 'pci-subbar');
        this._previewToggle = this._makeToggle(targetBar, 'Preview',
            'Draw the selected target\'s texture in the corner of the viewport, sampled on the GPU every frame');
        this._previewToggle.checked = true;
        this._previewAttachment = this._makeSelect(targetBar, 'Attachment', [['color0', 'color']],
            'Which texture of the render target to preview');
        this._previewChannels = this._makeSelect(targetBar, 'Channels', [
            ['rgb', 'color'], ['rrr', 'red'], ['ggg', 'green'], ['bbb', 'blue'], ['aaa', 'alpha']
        ], CHANNELS_TIP);
        this._previewNote = el('div', 'pci-note pci-note-info');
        this._previewNote.style.display = 'none';
        const targetList = el('div', 'pci-list');
        targetPanel.append(targetBar, this._previewNote, targetList);

        // textures: the same live preview for the selected texture
        const texturePanel = el('div', 'pci-listpanel');
        const textureBar = el('div', 'pci-subbar');
        this._texturePreviewToggle = this._makeToggle(textureBar, 'Preview',
            'Draw the selected texture in the corner of the viewport, sampled on the GPU every frame');
        this._texturePreviewToggle.checked = true;
        this._textureChannels = this._makeSelect(textureBar, 'Channels', [
            ['rgb', 'color'], ['rrr', 'red'], ['ggg', 'green'], ['bbb', 'blue'], ['aaa', 'alpha']
        ], CHANNELS_TIP);
        this._textureNote = el('div', 'pci-note pci-note-info');
        this._textureNote.style.display = 'none';
        const textureList = el('div', 'pci-list');
        texturePanel.append(textureBar, this._textureNote, textureList);

        // assets: the registry, in a chosen order
        const assetPanel = el('div', 'pci-listpanel');
        const assetBar = el('div', 'pci-subbar');
        this._assetSort = this._makeSelect(assetBar, 'Sort by', ASSET_SORTS, 'The order of the asset list');
        const assetList = el('div', 'pci-list');
        assetPanel.append(assetBar, assetList);

        // memory: the totals over the buffers, which can be narrowed to one kind
        const memoryPanel = el('div', 'pci-listpanel');
        const memoryBar = el('div', 'pci-subbar');
        this._bufferKind = this._makeSelect(memoryBar, 'Show', BUFFER_KINDS, 'List and total only the buffers of this kind');
        this._memoryNote = el('div', 'pci-note pci-note-info');
        this._memoryNote.style.whiteSpace = 'pre-line';
        const bufferList = el('div', 'pci-list');
        memoryPanel.append(memoryBar, this._memoryNote, bufferList);

        // shaders: a plain list
        const shaderPanel = el('div', 'pci-listpanel');
        const shaderList = el('div', 'pci-list');
        shaderPanel.append(shaderList);

        for (const input of [this._previewToggle, this._previewAttachment, this._previewChannels, this._texturePreviewToggle, this._textureChannels, this._assetSort, this._bufferKind]) {
            input.addEventListener('change', () => this._saveSettings());
        }

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
        setTip(range, 'Only draw lines within this distance of the camera, in meters. 0 draws everything');
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

        this._panels = {
            hierarchy: tree,
            assets: assetPanel,
            passes: passPanel,
            targets: targetPanel,
            textures: texturePanel,
            memory: memoryPanel,
            shaders: shaderPanel,
            physics: physicsPanel
        };
        this._hierarchyEl.append(tabs, filter, tree, assetPanel, passPanel, targetPanel, texturePanel, memoryPanel, shaderPanel, physicsPanel);

        const splitter = el('div', 'pci-splitter');
        const properties = el('div', 'pci-properties');
        body.append(this._hierarchyEl, splitter, properties);

        this._gpuToggle.addEventListener('change', () => {
            const profiler = this._app.graphicsDevice.gpuProfiler;
            if (profiler) profiler.enabled = this._gpuToggle.checked;
            this._saveSettings();
        });
        this._passPreviewToggle.addEventListener('change', () => this._saveSettings());
        this._debugFrameToggle.addEventListener('change', () => this._setDebugFrame(this._debugFrameToggle.checked));
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
        this._debugEl = el('span', 'pci-paused');
        this._pathEl = el('span', 'pci-path');
        status.append(this._countsEl, this._pausedEl, this._debugEl, this._pathEl);

        // width handle on the inner edge
        const edge = el('div', 'pci-edge');
        this._makeDraggable(edge, (e) => {
            const view = /** @type {Window} */ (edge.ownerDocument.defaultView);
            this._setWidth(this._dock === 'right' ? view.innerWidth - e.clientX : e.clientX);
        });

        panel.append(toolbar, body, status, edge);
        installTooltip(panel);
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
        this._passList = new ListView(passList, (item, key) => {
            if (this._tab === 'passes') this._properties.setSubject(item, this._passListModel(item), key);
            if (this._debugFrame) this._moveDebugFrameTo(item, key);
            this._updateStatus();
        }, target => this._selectAny(target));
        this._targetList = new ListView(targetList, (rt, key) => {
            if (this._tab === 'targets') this._properties.setSubject(rt, this._targetModel, key);
            this._updateStatus();
        }, target => this._selectAny(target));
        this._textureList = new ListView(textureList, (texture, key) => {
            if (this._tab === 'textures') this._properties.setSubject(texture, this._textureModel, key);
            this._updateStatus();
        }, target => this._selectAny(target));
        this._shaderList = new ListView(shaderList, (shader, key) => {
            if (this._tab === 'shaders') this._properties.setSubject(shader, buildShaderModel, key);
            this._updateStatus();
        }, target => this._selectAny(target));
        this._bufferList = new ListView(bufferList, (buffer, key) => {
            if (this._tab === 'memory') this._properties.setSubject(buffer, this._bufferModel, key);
            this._updateStatus();
        }, target => this._selectAny(target));
        this._assetList = new ListView(assetList, (asset, key) => {
            if (this._tab === 'assets') this._properties.setSubject(asset, this._assetModel, key);
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
     * @returns {Storage|null} The window's local storage, or null where there is none or reading
     * it throws, as in some sandboxed frames.
     * @private
     */
    static _storage() {
        try {
            return typeof window !== 'undefined' ? window.localStorage ?? null : null;
        } catch (e) {
            return null;
        }
    }

    /**
     * Restores the settings kept under {@link InspectorOptions#storageKey}, if any.
     *
     * @private
     */
    _loadSettings() {
        if (!this._storageKey) return;

        let stored;
        try {
            const json = Inspector._storage()?.getItem(this._storageKey);
            stored = json ? JSON.parse(json) : null;
        } catch (e) {
            // storage unavailable, e.g. a sandboxed frame, or unreadable content
        }
        if (!stored || typeof stored !== 'object') return;

        if (stored.physicsDrawOptions && typeof stored.physicsDrawOptions === 'object') {
            this._physicsDrawOptions = stored.physicsDrawOptions;
        }
        if (typeof stored.physicsDraw === 'boolean') this._physicsDraw = stored.physicsDraw;
        if (Array.isArray(stored.hiddenBodies)) {
            this._pendingHiddenPaths = new Set(stored.hiddenBodies.filter(path => typeof path === 'string'));
        }
        if (typeof stored.width === 'number') this._setWidth(stored.width);
        if (typeof stored.passPreview === 'boolean') this._passPreviewToggle.checked = stored.passPreview;
        if (typeof stored.gpuTimings === 'boolean') {
            this._gpuToggle.checked = stored.gpuTimings;
            const profiler = this._app.graphicsDevice.gpuProfiler;
            if (profiler) profiler.enabled = stored.gpuTimings;
        }
        if (stored.targetPreview && typeof stored.targetPreview === 'object') {
            if (typeof stored.targetPreview.enabled === 'boolean') this._previewToggle.checked = stored.targetPreview.enabled;
            if (typeof stored.targetPreview.channels === 'string') this._previewChannels.value = stored.targetPreview.channels;
        }
        if (typeof stored.assetSort === 'string') this._assetSort.value = stored.assetSort;
        if (typeof stored.bufferKind === 'string') this._bufferKind.value = stored.bufferKind;
        if (stored.texturePreview && typeof stored.texturePreview === 'object') {
            if (typeof stored.texturePreview.enabled === 'boolean') this._texturePreviewToggle.checked = stored.texturePreview.enabled;
            if (typeof stored.texturePreview.channels === 'string') this._textureChannels.value = stored.texturePreview.channels;
        }
        if (stored.tab in this._panels) this._setTab(stored.tab);
    }

    /**
     * Writes the settings kept under {@link InspectorOptions#storageKey}, if any. Called whenever
     * one of them changes; suppressed while the panel is being built and restored.
     *
     * @private
     */
    _saveSettings() {
        if (!this._storageKey || this._restoring || !this._host) return;

        const hiddenBodies = [...this._pendingHiddenPaths];
        for (const entity of this._hiddenBodies.keys()) {
            hiddenBodies.push(entity.path);
        }

        try {
            Inspector._storage()?.setItem(this._storageKey, JSON.stringify({
                physicsDraw: this._physicsDraw,
                physicsDrawOptions: this._physicsDrawOptions,
                hiddenBodies,
                tab: this._tab,
                width: this._width,
                gpuTimings: this._gpuToggle.checked,
                passPreview: this._passPreviewToggle.checked,
                targetPreview: { enabled: this._previewToggle.checked, channels: this._previewChannels.value },
                texturePreview: { enabled: this._texturePreviewToggle.checked, channels: this._textureChannels.value },
                assetSort: this._assetSort.value,
                bufferKind: this._bufferKind.value
            }));
        } catch (e) {
            // storage unavailable or full: settings simply do not persist
        }
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
        this._saveSettings();
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

        // exclusions restored from storage attach to the entities once they exist
        if (this._pendingHiddenPaths.size) {
            const store = this._app.systems.rigidbody?.store;
            for (const record of Object.values(store ?? {})) {
                const entity = record.entity;
                if (this._pendingHiddenPaths.delete(entity.path)) {
                    const body = entity.rigidbody?.body ?? null;
                    this._hiddenBodies.set(entity, body);
                    if (body && physics) physics.hideBody(body);
                }
            }
        }

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
        this._saveSettings();
    }

    /**
     * @param {HTMLElement} parent - The bar to add the selector to.
     * @param {string} label - The label.
     * @param {[string, string][]} options - Value and label pairs.
     * @param {string} title - The tooltip.
     * @returns {HTMLSelectElement} The selector.
     * @private
     */
    _makeSelect(parent, label, options, title) {
        const wrap = el('label', 'pci-check', label);
        setTip(wrap, title);
        const select = /** @type {HTMLSelectElement} */ (document.createElement('select'));
        select.className = 'pci-select';
        this._fillSelect(select, options);
        wrap.appendChild(select);
        parent.appendChild(wrap);
        return select;
    }

    /**
     * @param {HTMLSelectElement} select - The selector.
     * @param {[string, string][]} options - Value and label pairs.
     * @private
     */
    _fillSelect(select, options) {
        const previous = select.value;
        select.textContent = '';
        for (const [value, label] of options) {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = label;
            select.appendChild(option);
        }
        if (options.some(([value]) => value === previous)) select.value = previous;
    }

    /**
     * Draws the selected render target's texture in the free corner of the viewport, on the UI
     * layer: it renders after a camera frame's post-processing and into the backbuffer, so
     * previewing the scene's own color target never samples a texture being rendered to. Runs
     * every frame while the Render targets tab is active; the renderer only shows what is
     * submitted that frame.
     *
     * @private
     */
    _drawTargetPreview() {
        const rt = this._targetList.selected;
        const device = this._app.graphicsDevice;
        let note = '';

        if (rt && this._previewToggle.checked) {
            const attachments = previewAttachments(rt, device);
            const keys = attachments.map(a => a.key).join(',');
            if (keys !== this._previewKeys) {
                this._previewKeys = keys;
                this._fillSelect(this._previewAttachment, attachments.map(a => [a.key, a.label]));
            }
            const attachment = attachments.find(a => a.key === this._previewAttachment.value) ?? attachments[0];

            if (!attachment) {
                note = rt === device.backBuffer ? 'The backbuffer is the screen itself, there is nothing to preview.' : 'This target has no texture to preview.';
            } else {
                note = this._drawPreviewQuad(attachment.texture, `the ${attachment.label} attachment`, attachment.key === 'depth', this._previewChannels, 'corner', rt);
            }
        }

        Inspector._setNote(this._previewNote, note);
    }

    /**
     * Draws the texture selected on the textures tab, when its preview is enabled. Runs every frame
     * while the tab is active.
     *
     * @private
     */
    _drawTexturePreview() {
        const texture = this._textureList.selected;
        let note = '';
        if (texture && this._texturePreviewToggle.checked) {
            note = this._drawPreviewQuad(texture, `Texture "${texture.name}"`, isDepthFormat(texture.format), this._textureChannels);
        }
        Inspector._setNote(this._textureNote, note);
    }

    /**
     * Draws a texture keeping its aspect, either at 30% of the viewport height in the corner the
     * panel leaves free, or as large as fits the part of the viewport the panel leaves free. The
     * quad goes on the UI layer, drawn by the last camera rendering that layer to the screen:
     * cameras rendering into a texture would put the quad in their target, and the UI layer
     * renders after a camera frame's post-processing, so previewing the scene's own color target
     * never samples a texture being rendered to.
     *
     * @param {Texture} texture - The texture.
     * @param {string} label - What is being previewed, for the note.
     * @param {boolean} depth - Whether it is a raw depth texture, which the channel selection
     * does not apply to.
     * @param {HTMLSelectElement|null} channelsSelect - The channel selection to apply, or null for
     * color.
     * @param {'corner'|'large'} [size] - Where and how large to draw it. Defaults to the corner.
     * @param {RenderTarget|null} [renderTarget] - The render target the texture is attached to,
     * which decides whether it is stored upside down. Looked up on the device when not given.
     * @returns {string} What is shown where, or why nothing is.
     * @private
     */
    _drawPreviewQuad(texture, label, depth, channelsSelect, size = 'corner', renderTarget) {
        const device = this._app.graphicsDevice;
        const uiLayer = this._app.scene?.layers?.getLayerById(LAYERID_UI) ?? null;
        const cameras = uiLayer ? this._app.systems.camera?.cameras ?? [] : [];
        const uiCamera = cameras.filter(camera => !camera.renderTarget && camera.layers.includes(LAYERID_UI)).at(-1) ?? null;
        if (!uiCamera) return 'The preview is drawn on the UI layer, which no camera renders to the screen in this scene.';

        const support = previewSupport(texture, device);
        if (!support.ok) return `Cannot preview ${label}: ${support.reason}.`;

        const right = this._dock === 'left' || !!this._popup;
        let rect;
        if (size === 'large') {
            rect = this._freePreviewRect(texture);
        } else {
            const margin = 0.02;
            const height = 0.3;
            const width = texture.height > 0 && device.width > 0 ?
                height * (texture.width / texture.height) * (device.height / device.width) : height;
            rect = { x: right ? 1 - width - margin : margin, y: 1 - height - margin, width, height };
        }

        // a channel the format does not store samples as a constant, so show the color instead and say why
        const selected = channelsSelect?.value ?? 'rgb';
        const selectedLabel = channelsSelect?.selectedOptions[0]?.textContent ?? 'color';
        const stored = depth ? '' : formatChannels(texture.format);
        const missing = selected !== 'rgb' && stored !== '' && !stored.includes(selected[0]);

        this._textures.layer = uiLayer;
        this._textures.camera = uiCamera;
        this._textures.channels = missing ? 'rgb' : selected;
        // a negative height draws the rows from the bottom edge up, turning a bottom-up image upright
        if (storedBottomUp(texture, device, renderTarget)) {
            this._textures.draw(texture, rect.x, rect.y + rect.height, rect.width, -rect.height);
        } else {
            this._textures.draw(texture, rect.x, rect.y, rect.width, rect.height);
        }

        // depth previews are raw grayscale, the channel selection does not apply to them
        const channels = depth ? '' : ` (${missing ? 'color' : selectedLabel})`;
        const where = size === 'large' ? 'over the free part of the viewport' : `at the bottom ${right ? 'right' : 'left'} of the viewport`;
        let note = `Previewing ${label}${channels} ${where}.`;
        if (missing) note += ` ${formatName(texture.format)} has no ${selectedLabel} channel.`;
        return note;
    }

    /**
     * The largest rectangle of the texture's aspect that fits the part of the viewport the panel
     * leaves free, in normalized viewport coordinates. The whole viewport is free while the panel
     * is popped out.
     *
     * @param {Texture} texture - The texture to fit.
     * @returns {{ x: number, y: number, width: number, height: number }} The rectangle.
     * @private
     */
    _freePreviewRect(texture) {
        const device = this._app.graphicsDevice;
        const canvasRect = /** @type {any} */ (device).canvas?.getBoundingClientRect?.();
        let left = 0;
        let right = 1;
        if (canvasRect?.width > 0 && !this._popup) {
            const panelRect = this._panel?.getBoundingClientRect?.();
            if (panelRect?.width > 0) {
                if (this._dock === 'left') {
                    left = Math.min(1, Math.max(0, (panelRect.right - canvasRect.left) / canvasRect.width));
                } else {
                    right = Math.max(0, Math.min(1, (panelRect.left - canvasRect.left) / canvasRect.width));
                }
            }
        }

        const margin = 0.02;
        const freeWidth = Math.max(0.05, right - left - 2 * margin);
        const freeHeight = 1 - 2 * margin;
        const textureAspect = texture.height > 0 ? texture.width / texture.height : 1;
        const viewAspect = device.height > 0 ? device.width / device.height : 1;
        let height = freeHeight;
        let width = height * textureAspect / viewAspect;
        if (width > freeWidth) {
            width = freeWidth;
            height = width * viewAspect / textureAspect;
        }
        return { x: left + margin + (freeWidth - width) / 2, y: margin + (freeHeight - height) / 2, width, height };
    }

    /**
     * Draws the render target of the pass selected on the frame graph tab, large, when its preview
     * is on. A pass drawing to the screen needs no preview: the view is its output.
     *
     * @private
     */
    _drawPassPreview() {
        const item = this._passList.selected;
        const pass = item instanceof LayerStepSelection ? item.pass : item;
        const device = this._app.graphicsDevice;
        let note = '';

        if (pass && this._passPreviewToggle.checked) {
            const renderTarget = this._frame?.entries.find(entry => entry.pass === pass)?.renderTarget;
            if (renderTarget === device.backBuffer) {
                note = 'This pass draws to the screen, which is the view itself.';
            } else if (renderTarget) {
                const attachment = previewAttachments(renderTarget, device)[0];
                note = attachment ?
                    this._drawPreviewQuad(attachment.texture, `the ${attachment.label} of ${renderTarget.name || 'its target'}`,
                        attachment.key === 'depth', null, 'large', renderTarget) :
                    'This pass\'s target has no texture to preview.';
            }
        }
        Inspector._setNote(this._passNote, note);
    }

    /**
     * Turns the debug frame on or off. On, it pauses the app, stops the selected forward pass at its
     * last draw, and takes the arrow keys ahead of the app to step through the draws. Off, the pass
     * draws in full again and the app returns to its earlier pause state.
     *
     * @param {boolean} on - Whether to turn it on.
     * @private
     */
    _setDebugFrame(on) {
        if (on === !!this._debugFrame) return;
        const renderer = this._app.renderer;
        if (on) {
            if (!renderer?.debugDrawLimitSupported) return;
            this._debugFrame = { stepKey: null, index: 0, instance: null, wasPaused: this._paused };
            this.paused = true;
            this._moveDebugFrameTo(this._passList.selected, this._passList.selectedKey);
            // ahead of the app's own listeners, which would otherwise move the camera
            window.addEventListener('keydown', this._onDebugKey, true);
        } else {
            const wasPaused = this._debugFrame.wasPaused;
            this._debugFrame = null;
            window.removeEventListener('keydown', this._onDebugKey, true);
            if (renderer) renderer.debugDrawLimit = null;
            this.paused = wasPaused;
        }
        if (this._debugFrameToggle) this._debugFrameToggle.checked = on;
        this._updateDebugStatus(null);
        this._properties?.refresh();
    }

    /**
     * Moves the debug frame to the last draw of a selected pass or layer step. Selecting anything
     * else leaves it where it was.
     *
     * @param {*} item - What the pass list selected.
     * @param {string|null} key - The key of its row.
     * @private
     */
    _moveDebugFrameTo(item, key) {
        const state = this._debugFrame;
        if (!state || !key) return;
        const visible = this._frame?.visible;
        let stepKey = null;
        let list = null;
        if (item instanceof LayerStepSelection) {
            stepKey = key;
            list = visible?.get(item.step) ?? null;
        } else if (item instanceof RenderPassForward) {
            // the last step that drew anything
            item.layerRenderSteps.forEach((step, i) => {
                const drawn = visible?.get(step) ?? null;
                if (drawn?.instances.length) {
                    stepKey = `${key}/${i}`;
                    list = drawn;
                }
            });
        }
        if (!stepKey) return;
        state.stepKey = stepKey;
        state.index = Math.max(0, (list?.instances.length ?? 1) - 1);
        state.instance = list?.instances[state.index] ?? null;
        this._revealDebugDraw();
    }

    /**
     * @param {string} stepKey - The list key of a layer step.
     * @param {number} index - A draw in its list.
     * @param {MeshInstance} instance - The instance at that draw.
     * @private
     */
    _chooseDebugDraw(stepKey, index, instance) {
        const state = this._debugFrame;
        if (!state) return;
        state.stepKey = stepKey;
        state.index = index;
        state.instance = instance;
    }

    /**
     * Finds the layer step the debug frame stops in, in the latest captured frame. Forward passes
     * are rebuilt every frame, so the step is found again by its list key each time.
     *
     * @returns {{ pass: RenderPassForward, step: *, stepIndex: number, passKey: string, list: import('./frame-graph-view.js').VisibleList|null }|null}
     * The step, or null when it is not in the frame.
     * @private
     */
    _resolveDebugStep() {
        const stepKey = this._debugFrame?.stepKey;
        if (!stepKey || !this._frame) return null;
        const slash = stepKey.lastIndexOf('/');
        const passKey = stepKey.slice(0, slash);
        const stepIndex = Number(stepKey.slice(slash + 1));
        const pass = this._frame.entries.find(entry => entry.key === passKey)?.pass;
        const step = pass instanceof RenderPassForward ? pass.layerRenderSteps[stepIndex] : undefined;
        if (!step) return null;
        return { pass, step, stepIndex, passKey, list: this._frame.visible?.get(step) ?? null };
    }

    /**
     * Hands the renderer the limit for this frame: the steps of the pass before the chosen one
     * draw in full, the chosen one draws up to and including its instance, and the rest draw
     * nothing, so the pass's target shows exactly what that draw left behind.
     *
     * @private
     */
    _applyDebugFrame() {
        const renderer = this._app.renderer;
        const state = this._debugFrame;
        const found = this._resolveDebugStep();
        if (!renderer || !state || !found?.list) {
            if (renderer) renderer.debugDrawLimit = null;
            this._updateDebugStatus(null);
            return;
        }

        // keep the chosen instance where the latest list put it
        const instances = found.list.instances;
        const at = state.instance ? instances.indexOf(state.instance) : -1;
        if (at >= 0) state.index = at;
        state.index = Math.min(Math.max(0, state.index), Math.max(0, instances.length - 1));
        state.instance = instances[state.index] ?? null;

        const camera = found.step.cameraComponent?.camera;
        const renderTarget = found.step.renderTarget ?? this._app.graphicsDevice.backBuffer;
        const layers = new Map();
        found.pass.layerRenderSteps.forEach((step, i) => {
            if (step.cameraComponent?.camera !== camera || i < found.stepIndex) return;
            const entry = layers.get(step.layer) ?? [undefined, undefined];
            entry[step.transparent ? 1 : 0] = i === found.stepIndex ? { instance: state.instance, index: state.index } : 0;
            layers.set(step.layer, entry);
        });
        renderer.debugDrawLimit = { camera, renderTarget, layers };

        // outline the draw on the UI layer, drawn after a camera frame's scene pass so the limit
        // does not cut it
        const aabb = state.instance?.aabb;
        if (aabb) {
            const wire = this._wire;
            const previous = wire.layer;
            wire.layer = this._app.scene?.layers?.getLayerById(LAYERID_UI) ?? previous;
            wire.color.copy(this._highlightColor);
            wire.depthTest = false;
            wire.box(aabb);
            wire.layer = previous;
        }
        this._updateDebugStatus(found);
    }

    /**
     * Steps the debug frame one draw on or back, carrying on into the neighboring steps of the same
     * camera in the pass, and skipping those that drew nothing.
     *
     * @param {number} delta - 1 for the next draw, -1 for the previous.
     * @private
     */
    _stepDebugDraw(delta) {
        const state = this._debugFrame;
        const found = this._resolveDebugStep();
        if (!state || !found?.list) return;
        const steps = found.pass.layerRenderSteps;
        const camera = found.step.cameraComponent?.camera;
        const listOf = i => (steps[i].cameraComponent?.camera === camera ? this._frame?.visible?.get(steps[i]) ?? null : null);

        let stepIndex = found.stepIndex;
        let index = state.index + delta;
        if (index >= found.list.instances.length) {
            index = found.list.instances.length - 1;
            for (let i = stepIndex + 1; i < steps.length; i++) {
                if (listOf(i)?.instances.length) {
                    stepIndex = i;
                    index = 0;
                    break;
                }
            }
        } else if (index < 0) {
            index = 0;
            for (let i = stepIndex - 1; i >= 0; i--) {
                const list = listOf(i);
                if (list?.instances.length) {
                    stepIndex = i;
                    index = list.instances.length - 1;
                    break;
                }
            }
        }

        const stepKey = `${found.passKey}/${stepIndex}`;
        // follow into a new step in the list when a step, rather than the whole pass, is shown
        if (stepKey !== state.stepKey && this._passList.selected instanceof LayerStepSelection) {
            this._passList.select(stepKey);
        }
        state.stepKey = stepKey;
        state.index = index;
        state.instance = listOf(stepIndex)?.instances[index] ?? null;
        this._revealDebugDraw();
    }

    /**
     * Brings the draw the debug frame stops at into view: its page, and its row.
     *
     * @private
     */
    _revealDebugDraw() {
        const state = this._debugFrame;
        if (!state?.stepKey) return;
        this._instancePages.set(state.stepKey, Math.floor(state.index / INSTANCES_PER_PAGE));
        this._properties.refresh();
        this._properties.container.querySelector('.pci-prop.pci-active')?.scrollIntoView?.({ block: 'nearest' });
    }

    /**
     * Takes the arrow keys while the debug frame is on, ahead of the app, unless typing in a field.
     *
     * @param {KeyboardEvent} e - The event.
     * @returns {boolean} Whether the key stepped the frame.
     * @private
     */
    _onDebugKey = (e) => {
        if (!this._debugFrame || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return false;
        // events from inside the panel's shadow root reach the window retargeted to its host
        const target = /** @type {any} */ (e.composedPath?.()[0] ?? e.target);
        if (['INPUT', 'SELECT', 'TEXTAREA'].includes(target?.tagName)) return false;
        e.preventDefault();
        e.stopImmediatePropagation();
        this._stepDebugDraw(e.key === 'ArrowDown' ? 1 : -1);
        return true;
    };

    /**
     * @param {{ step: *, list: import('./frame-graph-view.js').VisibleList|null }|null} found - The
     * step the debug frame stops in, or null.
     * @private
     */
    _updateDebugStatus(found) {
        const state = this._debugFrame;
        let text = '';
        if (state) {
            text = found?.list ?
                `DEBUG FRAME · draw ${state.index} of ${found.list.instances.length} · ${found.step.layer.name} ${found.step.transparent ? 'transparent' : 'opaque'}` :
                'DEBUG FRAME · select a forward pass';
        }
        if (this._debugEl && this._debugEl.textContent !== text) this._debugEl.textContent = text;
    }

    /**
     * @param {HTMLElement} element - A note element.
     * @param {string} text - The text, empty to hide the note.
     * @private
     */
    static _setNote(element, text) {
        if (element.textContent !== text) element.textContent = text;
        const display = text ? '' : 'none';
        if (element.style.display !== display) element.style.display = display;
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
        setTip(wrap, title);
        const input = /** @type {HTMLInputElement} */ (document.createElement('input'));
        input.type = 'checkbox';
        wrap.prepend(input);
        parent.appendChild(wrap);
        return input;
    }

    /**
     * Switches the list tab and points the property view at that tab's selection.
     *
     * @param {'hierarchy'|'assets'|'passes'|'targets'|'textures'|'memory'|'shaders'|'physics'} tab - The tab.
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
        this._saveSettings();
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
        const device = this._app.graphicsDevice;

        if (this._tab === 'hierarchy') {
            this._hierarchy.refresh();
        } else if (this._tab === 'physics') {
            const system = this._app.systems.rigidbody;
            const note = !system ? 'No rigid body component system is registered in this app.' :
                !system.dynamicsWorld ? 'The physics world has not been created. Is Ammo loaded?' :
                    !AmmoDebugDraw.isAvailable(this._app) ? 'This Ammo build has no DebugDrawer, so the world cannot be drawn.' : '';
            this._physicsNote.textContent = note;
            this._physicsNote.style.display = note ? '' : 'none';

            this._bodyList.setRows([...bodyRows(this._app, this._hiddenBodies, this._drawToggle.checked), ...jointRows(this._app)]);
            const entity = this._bodyList.selected;
            if (entity !== this._properties.subject) {
                this._properties.setSubject(entity, buildNodeModel);
            }
        } else if (this._tab === 'textures') {
            this._textureList.setRows(textureRows(device));
            const texture = this._textureList.selected;
            if (texture !== this._properties.subject) {
                this._properties.setSubject(texture, this._textureModel, this._textureList.selectedKey);
            }
        } else if (this._tab === 'memory') {
            Inspector._setNote(this._memoryNote, memorySummary(device));
            this._bufferList.setRows(bufferRows(device, bufferOwners(this._app), this._bufferKind.value));
            const buffer = this._bufferList.selected;
            if (buffer !== this._properties.subject) {
                this._properties.setSubject(buffer, this._bufferModel, this._bufferList.selectedKey);
            }
        } else if (this._tab === 'assets') {
            this._assetList.setRows(assetRows(this._app.assets, this._assetSort.value));
            const asset = this._assetList.selected;
            if (asset !== this._properties.subject) {
                this._properties.setSubject(asset, this._assetModel, this._assetList.selectedKey);
            }
        } else if (this._tab === 'shaders') {
            this._shaderList.setRows(shaderRows(device));
            const shader = this._shaderList.selected;
            if (shader !== this._properties.subject) {
                this._properties.setSubject(shader, buildShaderModel, this._shaderList.selectedKey);
            }
        } else {
            if ((capture && !this._frozen) || !this._frame) {
                this._frame = captureFrameGraph(this._app);
            }
            if (this._tab === 'passes') {
                this._passList.setRows(passRows(this._frame, device));
                const item = this._passList.selected;
                if (item !== this._properties.subject) {
                    this._properties.setSubject(item, this._passListModel(item), this._passList.selectedKey);
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
        this._textureList.filter = value;
        this._shaderList.filter = value;
        this._assetList.filter = value;
        this._bufferList.filter = value;
        this._bodyList.filter = value;
        this._refreshLists(false);
        // the instances listed under a forward pass narrow with the filter too
        this._properties.refresh();
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
        } else if (target instanceof Texture) {
            this._setTab('textures');
            this._textureList.selectItem(target);
        } else if (target instanceof Shader) {
            this._setTab('shaders');
            this._shaderList.selectItem(target);
        } else if (target instanceof Asset) {
            this._setTab('assets');
            this._assetList.selectItem(target);
        } else if (bufferKind(target)) {
            // a filter hiding the buffer's kind would leave nothing to select
            if (this._bufferKind.value !== 'all' && this._bufferKind.value !== bufferKind(target)) this._bufferKind.value = 'all';
            this._setTab('memory');
            this._bufferList.selectItem(target);
        }
    }

    /**
     * @returns {PassModelContext & { app: AppBase }} What the model builders need besides their
     * subject: the app and device, the captured frame, and the paging state and filter of the
     * instances listed under a forward pass.
     * @private
     */
    _context() {
        return {
            app: this._app,
            device: this._app.graphicsDevice,
            frame: this._frame,
            passKey: this._passList?.selectedKey ?? null,
            pages: this._instancePages,
            filter: this._filterInput?.value.trim().toLowerCase() ?? '',
            stable: this._frozen || this._paused,
            debug: this._debugFrame ? {
                stepKey: this._debugFrame.stepKey,
                index: this._debugFrame.index,
                instance: this._debugFrame.instance,
                choose: (stepKey, index, instance) => this._chooseDebugDraw(stepKey, index, instance)
            } : null
        };
    }

    /**
     * @param {KeyboardEvent} e - The event.
     * @private
     */
    _onKeyDown = (e) => {
        if (this._onDebugKey(e)) return;
        if (e.repeat) return;

        // match on either the physical code ('Backquote') or the logical key ('`')
        const matches = key => !!key && (e.code === key || e.key === key);

        if (matches(this._toggleKey)) {
            e.preventDefault();
            this.visible = !this._visible;
        } else if (matches(this._pauseKey)) {
            e.preventDefault();
            this.paused = !this._paused;
        } else if (matches(this._stepKey)) {
            e.preventDefault();
            this.step();
        }
    };

    /**
     * @private
     */
    _onPopupHide = () => {
        this._dockBack();
    };

    /**
     * @private
     */
    _applyVisibility() {
        if (!this._host) return;
        this._host.style.display = this._visible ? '' : 'none';
    }

    /**
     * @param {number} value - The panel width in CSS pixels, clamped to a usable range.
     * @private
     */
    _setWidth(value) {
        this._width = Math.max(240, Math.min(1600, value || 420));
        this._applyLayout();
        this._saveSettings();
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
        setTip(this._popBtn, popped ? 'Bring the panel back into the page' : 'Move the panel to a window of its own');
    }

    /**
     * @param {string} key - A `KeyboardEvent.code` or `key`.
     * @returns {string} The key as shown on a button, or an empty string when unset.
     * @private
     */
    static _keyLabel(key) {
        if (!key) return '';
        const labels = { Backquote: '`', Space: 'Space', Escape: 'Esc' };
        return labels[key] ?? key.replace(/^Key|^Digit/, '');
    }

    /**
     * @param {string} key - A `KeyboardEvent.code` or `key`.
     * @returns {string} The key in brackets for a button label, or an empty string when unset.
     * @private
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
        this._pauseBtn.textContent = `${paused ? 'Resume' : 'Pause'}${Inspector._keyHint(this._pauseKey)}`;
        setTip(this._pauseBtn, paused ? 'Resume the app' : 'Pause the app: rendering continues, time stands still');
        this._pauseBtn.classList.toggle('pci-active', paused);
        this._stepBtn.textContent = `Step${Inspector._keyHint(this._stepKey)}`;
        setTip(this._stepBtn, 'Advance one frame while paused');
        this._stepBtn.disabled = !paused;
        this._pausedEl.textContent = paused ? 'PAUSED' : '';
    }

    /**
     * @private
     */
    _updateStatus() {
        if (!this._countsEl) return;
        const device = this._app.graphicsDevice;
        let counts = '';
        let selected = '';

        switch (this._tab) {
            case 'passes': {
                const gpu = this._frame?.frameTime;
                // WebGL times the frame with a single query; only WebGPU timestamps each pass
                const perPass = device.isWebGPU ? '' : ' (per-pass times need WebGPU)';
                counts = `${this._frame?.entries.length ?? 0} passes` +
                    `${gpu !== undefined ? ` · GPU ${gpu.toFixed(2)} ms${perPass}` : ''}${this._frozen ? ' · frozen' : ''}`;
                const item = this._passList.selected;
                selected = item instanceof LayerStepSelection ?
                    `${passDisplayName(item.pass)} › ${item.step.layer.name} ${item.step.transparent ? 'transparent' : 'opaque'}` :
                    item ? passDisplayName(item) : '';
                break;
            }
            case 'targets': {
                counts = `${this._targetList.rowCount} render targets · ${this._frame?.usage.size ?? 0} used this frame`;
                const rt = this._targetList.selected;
                selected = rt ? (rt === device.backBuffer ? 'Backbuffer' : rt.name) : '';
                break;
            }
            case 'textures': {
                const textures = collectTextures(device);
                const bytes = textures.reduce((sum, texture) => sum + texture.gpuSize, 0);
                counts = `${textures.length} textures · ${formatBytes(bytes)}`;
                selected = this._textureList.selected?.name ?? '';
                break;
            }
            case 'memory': {
                const buffers = collectBuffers(device, this._bufferKind.value);
                const bytes = buffers.reduce((sum, buffer) => sum + bufferBytes(buffer), 0);
                counts = `${buffers.length} buffers · ${formatBytes(bytes)}`;
                const buffer = this._bufferList.selected;
                selected = buffer ? `${buffer.constructor.name} #${idOf(buffer)}` : '';
                break;
            }
            case 'assets': {
                const assets = collectAssets(this._app.assets);
                const loaded = assets.filter(asset => asset.loaded).length;
                const bytes = assets.reduce((sum, asset) => sum + (asset.file?.size ?? 0), 0);
                counts = `${assets.length} assets · ${loaded} loaded${bytes ? ` · ${formatBytes(bytes)}` : ''}`;
                selected = this._assetList.selected?.name ?? '';
                break;
            }
            case 'shaders': {
                const shaders = collectShaders(device);
                const failed = shaders.filter(shader => shader.failed).length;
                const compiling = shaders.filter(shader => !shader.ready && !shader.failed).length;
                counts = `${shaders.length} shaders${compiling ? ` · ${compiling} compiling` : ''}${failed ? ` · ${failed} failed` : ''}`;
                const shader = this._shaderList.selected;
                selected = shader ? `${shader.name} (${stateName(shader)})` : '';
                break;
            }
            case 'physics': {
                const stats = physicsStats(this._app);
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
        setTip(this._pathEl, selected);
    }

    /**
     * Outlines a node in the viewport for the current frame.
     *
     * @param {GraphNode} node - The node.
     * @private
     */
    _drawHighlight(node) {
        const wire = this._wire;
        wire.color.copy(this._highlightColor);
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
        for (let current = this._lockedNode; current; current = current.parent) {
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
        const cameras = this._app.systems.camera?.cameras;
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
