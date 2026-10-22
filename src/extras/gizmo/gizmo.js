import { math } from '../../core/math/math.js';
import { Quat } from '../../core/math/quat.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Mat4 } from '../../core/math/mat4.js';
import { Ray } from '../../core/shape/ray.js';
import { EventHandler } from '../../core/event-handler.js';
import { PROJECTION_PERSPECTIVE, SORTMODE_MANUAL, SORTMODE_NONE } from '../../scene/constants.js';
import { Entity } from '../../framework/entity.js';
import { Layer } from '../../scene/layer.js';

/**
 * @import { AppBase } from '../../framework/app-base.js'
 * @import { CameraComponent } from '../../framework/components/camera/component.js';
 * @import { GraphNode } from '../../scene/graph-node.js'
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { MeshInstance } from '../../scene/mesh-instance.js'
 * @import { EventHandle } from '../../core/event-handle.js'
 * @import { Shape } from './shape/shape.js'
 * @import { GizmoSpace } from './constants.js'
 */

const v = new Vec3();
const position = new Vec3();
const dir = new Vec3();
const hit = new Vec3();
const rotation = new Quat();
const m1 = new Mat4();
const m2 = new Mat4();
const ray = new Ray();
const claimed = new WeakSet();

const MIN_SCALE = 1e-4;
const PERS_SCALE_RATIO = 0.3;
const ORTHO_SCALE_RATIO = 0.32;
const UPDATE_EPSILON = 1e-6;
const DIST_EPSILON = 1e-4;

/**
 * The base class for all gizmos.
 *
 * A gizmo draws in its own {@link Layer} (see {@link createLayer}) for a {@link CameraComponent},
 * acts on the {@link GraphNode}s passed to {@link attach}, and updates itself each frame until
 * {@link destroy}. Where gizmos overlap, a press goes to the first one created that it hits, so
 * create the gizmos that should win, such as transform gizmos, first.
 *
 * @category Gizmo
 */
class Gizmo extends EventHandler {
    /**
     * Fired when the pointer is down on the gizmo.
     *
     * @event
     * @example
     * const gizmo = new Gizmo(camera, layer);
     * gizmo.on('pointer:down', (x, y, meshInstance) => {
     *     console.log(`Pointer was down on ${meshInstance.node.name} at ${x}, ${y}`);
     * });
     */
    static EVENT_POINTERDOWN = 'pointer:down';

    /**
     * Fired when the pointer is moving over the gizmo.
     *
     * @event
     * @example
     * const gizmo = new Gizmo(camera, layer);
     * gizmo.on('pointer:move', (x, y, meshInstance) => {
     *     console.log(`Pointer was moving on ${meshInstance.node.name} at ${x}, ${y}`);
     * });
     */
    static EVENT_POINTERMOVE = 'pointer:move';

    /**
     * Fired when the pointer is up off the gizmo.
     *
     * @event
     * @example
     * const gizmo = new Gizmo(camera, layer);
     * gizmo.on('pointer:up', (x, y, meshInstance) => {
     *     console.log(`Pointer was up on ${meshInstance.node.name} at ${x}, ${y}`);
     * })
     */
    static EVENT_POINTERUP = 'pointer:up';

    /**
     * Fired when the gizmo's position is updated.
     *
     * @event
     * @example
     * const gizmo = new Gizmo(camera, layer);
     * gizmo.on('position:update', (position) => {
     *     console.log(`The gizmo's position was updated to ${position}`);
     * })
     */
    static EVENT_POSITIONUPDATE = 'position:update';

    /**
     * Fired when the gizmo's rotation is updated.
     *
     * @event
     * @example
     * const gizmo = new Gizmo(camera, layer);
     * gizmo.on('rotation:update', (rotation) => {
     *     console.log(`The gizmo's rotation was updated to ${rotation}`);
     * });
     */
    static EVENT_ROTATIONUPDATE = 'rotation:update';

    /**
     * Fired when the gizmo's scale is updated.
     *
     * @event
     * @example
     * const gizmo = new Gizmo(camera, layer);
     * gizmo.on('scale:update', (scale) => {
     *     console.log(`The gizmo's scale was updated to ${scale}`);
     * });
     */
    static EVENT_SCALEUPDATE = 'scale:update';

    /**
     * Fired when graph nodes are attached.
     *
     * @event
     * @example
     * const gizmo = new Gizmo(camera, layer);
     * gizmo.on('nodes:attach', () => {
     *     console.log('Graph nodes attached');
     * });
     */
    static EVENT_NODESATTACH = 'nodes:attach';

    /**
     * Fired when graph nodes are detached.
     *
     * @event
     * @example
     * const gizmo = new Gizmo(camera, layer);
     * gizmo.on('nodes:detach', () => {
     *     console.log('Graph nodes detached');
     * });
     */
    static EVENT_NODESDETACH = 'nodes:detach';

    /**
     * Fired when the gizmo render has updated.
     *
     * @event
     * @example
     * const gizmo = new TransformGizmo(camera, layer);
     * gizmo.on('render:update', () => {
     *     console.log('Gizmo render has been updated');
     * });
     */
    static EVENT_RENDERUPDATE = 'render:update';

    /**
     * The gizmo size.
     *
     * @private
     */
    _size = 1;

    /**
     * The gizmo scale.
     *
     * @protected
     */
    _scale = 1;

    /**
     * The coordinate space.
     *
     * @type {GizmoSpace}
     * @protected
     */
    _coordSpace = 'world';

    /**
     * The app.
     *
     * @type {AppBase}
     * @protected
     */
    _app;

    /**
     * The graphics device.
     *
     * @type {GraphicsDevice}
     * @protected
     */
    _device;

    /**
     * The app event handles.
     *
     * @type {EventHandle[]}
     * @protected
     */
    _handles = [];

    /**
     * The mouse buttons that interact.
     *
     * @type {[boolean, boolean, boolean]}
     * @protected
     */
    _mouseButtons = [true, true, true];

    /**
     * The camera viewing the gizmo.
     *
     * @type {CameraComponent}
     * @protected
     */
    _camera;

    /**
     * The render layer.
     *
     * @type {Layer}
     * @protected
     */
    _layer;

    /**
     * Whether a render update is due.
     *
     * @protected
     */
    _renderUpdate = false;

    /**
     * The enabled state the user requested.
     *
     * @private
     */
    _enabled = true;

    /**
     * The id of the interacting pointer.
     *
     * @private
     */
    _pointerId = -1;

    /**
     * Whether the gizmo is destroyed.
     *
     * @private
     */
    _destroyed = false;

    /**
     * The graph nodes attached to the gizmo.
     *
     * @type {GraphNode[]}
     */
    nodes = [];

    /**
     * The root gizmo entity.
     *
     * @type {Entity}
     */
    root;

    /**
     * The shapes the gizmo picks.
     *
     * @type {Shape[]}
     */
    intersectShapes = [];

    /**
     * Whether to call `preventDefault` on pointer events.
     */
    preventDefault = true;

    /**
     * Creates a new gizmo layer and adds it to the scene.
     *
     * @param {AppBase} app - The app.
     * @param {string} [layerName] - The layer name. Defaults to 'Gizmo'.
     * @param {number} [layerIndex] - The layer index. Defaults to the end of the layer list.
     * @param {boolean} [depth] - Whether the layer keeps the scene depth and sorts transparent mesh
     * instances manually, as overlay gizmos need so occluded parts draw faint. Otherwise it clears
     * depth and draws on top, as transform gizmos need. Defaults to false.
     * @returns {Layer} The new layer.
     * @example
     * const layer = Gizmo.createLayer(app, 'Overlays', undefined, true);
     */
    static createLayer(app, layerName = 'Gizmo', layerIndex = app.scene.layers.layerList.length, depth = false) {
        const layer = new Layer({
            name: layerName,
            clearDepthBuffer: !depth,
            opaqueSortMode: SORTMODE_NONE,
            transparentSortMode: depth ? SORTMODE_MANUAL : SORTMODE_NONE
        });
        app.scene.layers.insert(layer, layerIndex);
        return layer;
    }

    /**
     * Creates a new Gizmo object.
     *
     * @param {CameraComponent} camera - The camera component.
     * @param {Layer} layer - The render layer, added to the camera. Gizmos can share it; it leaves
     * the camera with the last gizmo using it there.
     * @param {string} [name] - The name of the gizmo. Defaults to 'gizmo'.
     * @example
     * const gizmo = new Gizmo(camera, layer);
     */
    constructor(camera, layer, name = 'gizmo') {
        super();

        this._layer = layer;
        this._camera = camera;
        this._camera.layers = this._camera.layers.concat(this._layer.id);

        this._app = this._camera.system.app;
        this._device = this._app.graphicsDevice;

        this.root = new Entity(name);
        this._app.root.addChild(this.root);
        this.root.enabled = false;

        this._updateScale();

        this._onPointerDown = this._onPointerDown.bind(this);
        this._onPointerMove = this._onPointerMove.bind(this);
        this._onPointerUp = this._onPointerUp.bind(this);

        this._device.canvas.addEventListener('pointerdown', this._onPointerDown);
        this._device.canvas.addEventListener('pointermove', this._onPointerMove);
        this._device.canvas.addEventListener('pointerup', this._onPointerUp);

        this._handles.push(this._app.on('prerender', () => this.prerender()));
        this._handles.push(this._app.on('update', () => this.update()));
        this._handles.push(this._app.on('destroy', () => this.destroy()));
    }

    /**
     * Gets whether the gizmo shows only with attached nodes. A getter, so a subclass's value
     * applies while the base constructor runs.
     *
     * @type {boolean}
     * @protected
     */
    get _requiresNodes() {
        return true;
    }

    /**
     * Sets the gizmo enabled state.
     *
     * @type {boolean}
     */
    set enabled(state) {
        this._enabled = state;
        const cameraDist = this.root.getLocalPosition().distance(this.camera.entity.getPosition());

        // gizmos without nodes draw away from the root, so the camera can sit on it
        const enabled = state && (!this._requiresNodes || (this.nodes.length > 0 && cameraDist > DIST_EPSILON));
        if (enabled !== this.root.enabled) {
            this.root.enabled = enabled;
            this._renderUpdate = true;
        }
    }

    /**
     * Gets the gizmo enabled state.
     *
     * @type {boolean}
     */
    get enabled() {
        return this.root.enabled;
    }

    /**
     * The mouse buttons that interact with the gizmo, by
     * {@link https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/button | button index}:
     * 0 left, 1 middle, 2 right.
     *
     * @type {[boolean, boolean, boolean]}
     */
    get mouseButtons() {
        return this._mouseButtons;
    }

    /**
     * Sets the gizmo render layer.
     *
     * @param {Layer} layer - The layer to render the gizmo.
     */
    set layer(layer) {
        if (this._layer === layer) {
            return;
        }
        this._releaseCameraLayer();
        this._layer = layer;
        this._camera.layers = this._camera.layers.concat(this._layer.id);

        const ids = [layer.id];
        this.root.forEach((node) => {
            const { render } = /** @type {Entity} */ (node);
            if (render) {
                render.layers = ids;
            }
        });

        this.enabled = this._enabled;
    }

    /**
     * Gets the gizmo render layer.
     *
     * @type {Layer}
     */
    get layer() {
        return this._layer;
    }

    /**
     * Sets the camera component to view the gizmo.
     *
     * @type {CameraComponent} camera - The camera component.
     */
    set camera(camera) {
        if (this._camera === camera) {
            return;
        }
        this._releaseCameraLayer();
        this._camera = camera;
        this._camera.layers = this._camera.layers.concat(this._layer.id);

        this.enabled = this._enabled;
    }

    /**
     * Gets the camera component to view the gizmo.
     *
     * @type {CameraComponent} The camera component.
     */
    get camera() {
        return this._camera;
    }

    /**
     * Sets the gizmo coordinate space. Defaults to 'world'.
     *
     * @type {GizmoSpace}
     */
    set coordSpace(value) {
        this._coordSpace = value ?? this._coordSpace;
        this._updateRotation();
    }

    /**
     * Gets the gizmo coordinate space.
     *
     * @type {GizmoSpace}
     */
    get coordSpace() {
        return this._coordSpace;
    }

    /**
     * Sets the gizmo size. Defaults to 1.
     *
     * @type {number}
     */
    set size(value) {
        this._size = value;
        this._updateScale();
    }

    /**
     * Gets the gizmo size.
     *
     * @type {number}
     */
    get size() {
        return this._size;
    }

    /**
     * @type {Vec3}
     * @protected
     */
    get facingDir() {
        if (this._camera.projection === PROJECTION_PERSPECTIVE) {
            const gizmoPos = this.root.getLocalPosition();
            const cameraPos = this._camera.entity.getPosition();
            return dir.sub2(cameraPos, gizmoPos).normalize();
        }
        return dir.copy(this._camera.entity.forward).mulScalar(-1);
    }

    /**
     * @type {Vec3}
     * @protected
     */
    get cameraDir() {
        const cameraPos = this._camera.entity.getPosition();
        const gizmoPos = this.root.getLocalPosition();
        return dir.sub2(cameraPos, gizmoPos).normalize();
    }

    /**
     * @param {PointerEvent} e - The pointer event.
     * @private
     */
    _onPointerDown(e) {
        if (!this.enabled || document.pointerLockElement) {
            return;
        }
        if (!this.mouseButtons[e.button]) {
            return;
        }

        // ignore other pointers while one is pressed
        const { canvas } = this._device;
        if (e.pointerId !== this._pointerId && canvas.hasPointerCapture(this._pointerId)) {
            return;
        }

        // the first gizmo hit claims the press, so overlapping gizmos don't drag together
        if (claimed.has(e)) {
            return;
        }
        const selection = this._getSelection(e.offsetX, e.offsetY);
        if (selection[0]) {
            claimed.add(e);
            if (this.preventDefault) {
                e.preventDefault();
            }
            e.stopPropagation();
        }

        this._pointerId = e.pointerId;
        canvas.setPointerCapture(e.pointerId);

        this.fire(Gizmo.EVENT_POINTERDOWN, e.offsetX, e.offsetY, selection[0]);
    }

    /**
     * @param {PointerEvent} e - The pointer event.
     * @private
     */
    _onPointerMove(e) {
        if (!this.enabled || document.pointerLockElement) {
            return;
        }
        if (e.pointerId !== this._pointerId && this._device.canvas.hasPointerCapture(this._pointerId)) {
            return;
        }
        const selection = this._getSelection(e.offsetX, e.offsetY);
        if (selection[0]) {
            if (this.preventDefault) {
                e.preventDefault();
            }
            e.stopPropagation();
        }
        this.fire(Gizmo.EVENT_POINTERMOVE, e.offsetX, e.offsetY, selection[0]);
    }

    /**
     * @param {PointerEvent} e - The pointer event.
     * @private
     */
    _onPointerUp(e) {
        if (!this.mouseButtons[e.button] || e.pointerId !== this._pointerId) {
            return;
        }

        // end the drag even if disabled or pointer locked mid-drag
        const active = this.enabled && !document.pointerLockElement;
        const selection = active ? this._getSelection(e.offsetX, e.offsetY) : [];
        if (selection[0]) {
            if (this.preventDefault) {
                e.preventDefault();
            }
            e.stopPropagation();
        }

        const { canvas } = this._device;
        canvas.releasePointerCapture(e.pointerId);

        this.fire(Gizmo.EVENT_POINTERUP, e.offsetX, e.offsetY, selection[0]);
    }

    /**
     * Removes one reference to the layer from the camera, which other gizmos may share.
     *
     * @private
     */
    _releaseCameraLayer() {
        const ids = this._camera.layers.slice();
        const index = ids.indexOf(this._layer.id);
        if (index !== -1) {
            ids.splice(index, 1);
        }
        this._camera.layers = ids;
    }

    /**
     * @protected
     */
    _updatePosition() {
        position.set(0, 0, 0);
        if (this._coordSpace === 'local' && this.nodes.length !== 0) {
            position.copy(this.nodes[this.nodes.length - 1].getPosition());
        } else {
            for (let i = 0; i < this.nodes.length; i++) {
                const node = this.nodes[i];
                position.add(node.getPosition());
            }
            position.mulScalar(1.0 / (this.nodes.length || 1));
        }

        if (position.equalsApprox(this.root.getLocalPosition(), UPDATE_EPSILON)) {
            return;
        }

        this.root.setLocalPosition(position);
        this.fire(Gizmo.EVENT_POSITIONUPDATE, position);

        this._renderUpdate = true;
    }

    /**
     * @protected
     */
    _updateRotation() {
        rotation.set(0, 0, 0, 1);
        if (this._coordSpace === 'local' && this.nodes.length !== 0) {
            rotation.copy(this.nodes[this.nodes.length - 1].getRotation());
        }

        if (rotation.equalsApprox(this.root.getRotation(), UPDATE_EPSILON)) {
            return;
        }

        this.root.setRotation(rotation);
        this.fire(Gizmo.EVENT_ROTATIONUPDATE, rotation.getEulerAngles());

        this._renderUpdate = true;
    }

    /**
     * Gets the scale keeping geometry at a world position a constant size on screen.
     *
     * @param {Vec3} pos - The world position.
     * @returns {number} The scale.
     * @protected
     */
    _getScreenScale(pos) {
        let scale;
        if (this._camera.projection === PROJECTION_PERSPECTIVE) {
            const cameraPos = this._camera.entity.getPosition();
            const dist = v.sub2(pos, cameraPos).dot(this._camera.entity.forward);
            scale = Math.tan(0.5 * this._camera.fov * math.DEG_TO_RAD) * dist * PERS_SCALE_RATIO;
        } else {
            scale = this._camera.orthoHeight * ORTHO_SCALE_RATIO;
        }
        return Math.max(scale * this._size, MIN_SCALE);
    }

    /**
     * @protected
     */
    _updateScale() {
        this._scale = this._getScreenScale(this.root.getLocalPosition());

        if (Math.abs(this._scale - this.root.getLocalScale().x) < UPDATE_EPSILON) {
            return;
        }

        this.root.setLocalScale(this._scale, this._scale, this._scale);
        this.fire(Gizmo.EVENT_SCALEUPDATE, this._scale);

        this._renderUpdate = true;
    }

    /**
     * @param {Vec3} mouseWPos - The mouse world position.
     * @returns {Ray} - The ray.
     * @protected
     */
    _createRay(mouseWPos) {
        if (this._camera.projection === PROJECTION_PERSPECTIVE) {
            ray.origin.copy(this._camera.entity.getPosition());
            ray.direction.sub2(mouseWPos, ray.origin).normalize();
            return ray;
        }
        const orthoDepth = this._camera.farClip - this._camera.nearClip;
        ray.origin.sub2(mouseWPos, v.copy(this._camera.entity.forward).mulScalar(orthoDepth));
        ray.direction.copy(this._camera.entity.forward);
        return ray;
    }

    /**
     * @param {number} x - The x coordinate.
     * @param {number} y - The y coordinate.
     * @returns {MeshInstance[]} - The mesh instances.
     * @private
     */
    _getSelection(x, y) {
        const start = this._camera.screenToWorld(x, y, 0);
        const end = this._camera.screenToWorld(x, y, this._camera.farClip - this._camera.nearClip);
        const dir = v.copy(end).sub(start).normalize();

        /**
         * @type {MeshInstance[] | null}
         */
        let best = null;
        let bestDist = 0;
        let bestPriority = 0;
        for (let i = 0; i < this.intersectShapes.length; i++) {
            const shape = this.intersectShapes[i];
            if (shape.disabled || !shape.entity.enabled) {
                continue;
            }

            const parentTM = shape.entity.getWorldTransform();
            for (let j = 0; j < shape.triData.length; j++) {
                const { tris, transform, priority } = shape.triData[j];

                const triWTM = m1.copy(parentTM).mul(transform);
                const invTriWTM = m2.copy(triWTM).invert();

                invTriWTM.transformPoint(start, ray.origin);
                invTriWTM.transformVector(dir, ray.direction);
                ray.direction.normalize();

                for (let k = 0; k < tris.length; k++) {
                    if (tris[k].intersectsRay(ray, hit)) {
                        const dist = triWTM.transformPoint(hit).sub(start).length();

                        // priority decides between prioritized hits, otherwise distance
                        const wins = !best || (bestPriority !== 0 && priority !== 0 && priority !== bestPriority ?
                            priority > bestPriority : dist < bestDist);
                        if (wins) {
                            best = shape.meshInstances;
                            bestDist = dist;
                            bestPriority = priority;
                        }
                    }
                }
            }
        }

        return best ?? [];
    }

    /**
     * Attach an array of graph nodes to the gizmo.
     *
     * @param {GraphNode[] | GraphNode} [nodes] - The graph nodes. Defaults to [].
     * @example
     * const gizmo = new Gizmo(camera, layer);
     * gizmo.attach([boxA, boxB]);
     */
    attach(nodes = []) {
        if (Array.isArray(nodes)) {
            if (nodes.length === 0) {
                return;
            }
            this.nodes = nodes;
        } else {
            this.nodes = [nodes];
        }

        this._updatePosition();
        this._updateRotation();
        this._updateScale();

        this.fire(Gizmo.EVENT_NODESATTACH);

        this.enabled = true;
    }

    /**
     * Detaches all graph nodes from the gizmo.
     *
     * @example
     * const gizmo = new Gizmo(camera, layer);
     * gizmo.attach([boxA, boxB]);
     * gizmo.detach();
     */
    detach() {
        this.enabled = false;

        this.fire(Gizmo.EVENT_NODESDETACH);

        this.nodes = [];
    }

    /**
     * Called before the gizmo renders.
     *
     * @example
     * const gizmo = new Gizmo(camera, layer);
     * gizmo.attach([boxA, boxB]);
     * gizmo.prerender();
     */
    prerender() {
    }

    /**
     * Updates the gizmo position, rotation, and scale.
     *
     * @example
     * const gizmo = new Gizmo(camera, layer);
     * gizmo.attach([boxA, boxB]);
     * gizmo.update();
     */
    update() {

        // recheck a gizmo hidden only because the camera sat on it
        if (this._enabled && !this.root.enabled) {
            this.enabled = true;
        }

        if (this._renderUpdate) {
            this._renderUpdate = false;
            this.fire(Gizmo.EVENT_RENDERUPDATE);
        }

        if (!this.enabled) {
            return;
        }

        this._updatePosition();
        this._updateRotation();
        this._updateScale();
    }

    /**
     * Detaches all graph nodes and destroys the gizmo instance.
     *
     * @example
     * const gizmo = new Gizmo(camera, layer);
     * gizmo.attach([boxA, boxB]);
     * gizmo.destroy();
     */
    destroy() {

        // the app destroy event may call this again
        if (this._destroyed) {
            return;
        }
        this._destroyed = true;

        this.detach();

        this._releaseCameraLayer();

        this._device.canvas.removeEventListener('pointerdown', this._onPointerDown);
        this._device.canvas.removeEventListener('pointermove', this._onPointerMove);
        this._device.canvas.removeEventListener('pointerup', this._onPointerUp);

        this._handles.forEach(handle => handle.off());

        this.root.destroy();

    }
}

export { Gizmo };
