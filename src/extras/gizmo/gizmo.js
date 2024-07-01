import { math } from '../../core/math/math.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Mat4 } from '../../core/math/mat4.js';
import { Ray } from '../../core/shape/ray.js';
import { EventHandler } from '../../core/event-handler.js';
import { PROJECTION_PERSPECTIVE } from '../../scene/constants.js';
import { Entity } from '../../framework/entity.js';

// temporary variables
const tmpV1 = new Vec3();
const tmpM1 = new Mat4();
const tmpM2 = new Mat4();
const tmpR1 = new Ray();

// constants
const MIN_GIZMO_SCALE = 1e-4;
const PERS_SCALE_RATIO = 0.3;
const ORTHO_SCALE_RATIO = 0.32;

/**
 * Local coordinate space.
 *
 * @type {string}
 * @category Gizmo
 */
export const GIZMO_LOCAL = 'local';

/**
 * World coordinate space.
 *
 * @type {string}
 * @category Gizmo
 */
export const GIZMO_WORLD = 'world';

/**
 * The base class for all gizmos.
 *
 * @category Gizmo
 */
class Gizmo extends EventHandler {
    /**
     * Fired when the pointer is down on the gizmo.
     *
     * @event
     * @example
     * const gizmo = new pc.Gizmo(app, camera, layer);
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
     * const gizmo = new pc.Gizmo(app, camera, layer);
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
     * const gizmo = new pc.Gizmo(app, camera, layer);
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
     * const gizmo = new pc.Gizmo(app, camera, layer);
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
     * const gizmo = new pc.Gizmo(app, camera, layer);
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
     * const gizmo = new pc.Gizmo(app, camera, layer);
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
     * const gizmo = new pc.Gizmo(app, camera, layer);
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
     * const gizmo = new pc.Gizmo(app, camera, layer);
     * gizmo.on('nodes:detach', () => {
     *     console.log('Graph nodes detached');
     * });
     */
    static EVENT_NODESDETACH = 'nodes:detach';

    /**
     * Fired when when the gizmo render has updated.
     *
     * @event
     * @example
     * const gizmo = new pc.TransformGizmo(app, camera, layer);
     * gizmo.on('render:update', () => {
     *     console.log('Gizmo render has been updated');
     * });
     */
    static EVENT_RENDERUPDATE = 'render:update';

    /**
     * Internal version of the gizmo size. Defaults to 1.
     *
     * @type {number}
     * @private
     */
    _size = 1;

    /**
     * Internal version of the gizmo scale. Defaults to 1.
     *
     * @type {number}
     * @protected
     */
    _scale = 1;

    /**
     * Internal version of coordinate space. Defaults to {@link GIZMO_WORLD}.
     *
     * @type {string}
     * @protected
     */
    _coordSpace = GIZMO_WORLD;

    /**
     * Internal reference to the app containing the gizmo.
     *
     * @type {import('../../framework/app-base.js').AppBase}
     * @protected
     */
    _app;

    /**
     * Internal reference to the graphics device of the app.
     *
     * @type {import('../../platform/graphics/graphics-device.js').GraphicsDevice}
     * @protected
     */
    _device;

    /**
     * Internal reference to camera component to view the gizmo.
     *
     * @type {import('../../framework/components/camera/component.js').CameraComponent}
     * @protected
     */
    _camera;

    /**
     * Internal reference to layer to render the gizmo..
     *
     * @type {import('../../scene/layer.js').Layer}
     * @protected
     */
    _layer;

    /**
     * The graph nodes attached to the gizmo.
     *
     * @type {import('../../scene/graph-node.js').GraphNode[]}
     */
    nodes = [];

    /**
     * The root gizmo entity.
     *
     * @type {import('../../framework/entity.js').Entity}
     */
    root;

    /**
     * @typedef IntersectData
     * @property {import('./tri-data.js').TriData[]} triData - The array of {@link TriData}
     * @property {import('../../scene/graph-node.js').GraphNode} parent - The mesh parent node.
     * @property {import('../../scene/mesh-instance.js').MeshInstance[]} meshInstances -
     * array of mesh instances for rendering
     */
    /**
     * The intersection data object.
     *
     * @type {IntersectData[]}
     */
    intersectData = [];

    /**
     * Creates a new Gizmo object.
     *
     * @param {import('../../framework/app-base.js').AppBase} app - The application instance.
     * @param {import('../../framework/components/camera/component.js').CameraComponent} camera -
     * The camera component.
     * @param {import('../../scene/layer.js').Layer} layer - The render layer.
     * @example
     * const gizmo = new pc.Gizmo(app, camera, layer);
     */
    constructor(app, camera, layer) {
        super();

        this._app = app;
        this._device = app.graphicsDevice;
        this._camera = camera;
        this._layer = layer;

        this.root = new Entity('gizmo');
        this._app.root.addChild(this.root);
        this.root.enabled = false;

        this._updateScale();

        this._onPointerDown = this._onPointerDown.bind(this);
        this._onPointerMove = this._onPointerMove.bind(this);
        this._onPointerUp = this._onPointerUp.bind(this);

        this._device.canvas.addEventListener('pointerdown', this._onPointerDown);
        this._device.canvas.addEventListener('pointermove', this._onPointerMove);
        this._device.canvas.addEventListener('pointerup', this._onPointerUp);

        app.on('update', () => this._updateScale());

        app.on('destroy', () => this.destroy());
    }

    /**
     * Sets the gizmo coordinate space. Can be:
     *
     * - {@link GIZMO_LOCAL}
     * - {@link GIZMO_WORLD}
     *
     * Defaults to {@link GIZMO_WORLD}.
     *
     * @type {string}
     */
    set coordSpace(value) {
        this._coordSpace = value ?? GIZMO_WORLD;
        this._updateRotation();
    }

    /**
     * Gets the gizmo coordinate space.
     *
     * @type {string}
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
     * @param {PointerEvent} e - The pointer event.
     * @private
     */
    _onPointerDown(e) {
        if (!this.root.enabled || document.pointerLockElement) {
            return;
        }
        const selection = this._getSelection(e.offsetX, e.offsetY);
        if (selection[0]) {
            e.preventDefault();
            e.stopPropagation();
        }
        this.fire(Gizmo.EVENT_POINTERDOWN, e.offsetX, e.offsetY, selection[0]);
    }

    /**
     * @param {PointerEvent} e - The pointer event.
     * @private
     */
    _onPointerMove(e) {
        if (!this.root.enabled || document.pointerLockElement) {
            return;
        }
        const selection = this._getSelection(e.offsetX, e.offsetY);
        if (selection[0]) {
            e.preventDefault();
            e.stopPropagation();
        }
        this.fire(Gizmo.EVENT_POINTERMOVE, e.offsetX, e.offsetY, selection[0]);
    }

    /**
     * @private
     */
    _onPointerUp() {
        if (!this.root.enabled || document.pointerLockElement) {
            return;
        }
        this.fire(Gizmo.EVENT_POINTERUP);
    }

    /**
     * @protected
     */
    _updatePosition() {
        tmpV1.set(0, 0, 0);
        for (let i = 0; i < this.nodes.length; i++) {
            const node = this.nodes[i];
            tmpV1.add(node.getPosition());
        }
        tmpV1.mulScalar(1.0 / (this.nodes.length || 1));
        this.root.setPosition(tmpV1);

        this.fire(Gizmo.EVENT_POSITIONUPDATE, tmpV1);
    }

    /**
     * @protected
     */
    _updateRotation() {
        tmpV1.set(0, 0, 0);
        if (this._coordSpace === GIZMO_LOCAL && this.nodes.length !== 0) {
            tmpV1.copy(this.nodes[this.nodes.length - 1].getEulerAngles());
        }
        this.root.setEulerAngles(tmpV1);

        this.fire(Gizmo.EVENT_ROTATIONUPDATE, tmpV1);
    }

    /**
     * @protected
     */
    _updateScale() {
        if (this._camera.projection === PROJECTION_PERSPECTIVE) {
            const gizmoPos = this.root.getPosition();
            const cameraPos = this._camera.entity.getPosition();
            const dist = gizmoPos.distance(cameraPos);
            this._scale = Math.tan(0.5 * this._camera.fov * math.DEG_TO_RAD) * dist * PERS_SCALE_RATIO;
        } else {
            this._scale = this._camera.orthoHeight * ORTHO_SCALE_RATIO;
        }
        this._scale = Math.max(this._scale * this._size, MIN_GIZMO_SCALE);
        this.root.setLocalScale(this._scale, this._scale, this._scale);

        this.fire(Gizmo.EVENT_SCALEUPDATE, this._scale);
    }

    /**
     * @param {number} x - The x coordinate.
     * @param {number} y - The y coordinate.
     * @returns {import('../../scene/mesh-instance.js').MeshInstance[]} - The mesh instances.
     * @private
     */
    _getSelection(x, y) {
        const start = this._camera.screenToWorld(x, y, this._camera.nearClip);
        const end = this._camera.screenToWorld(x, y, this._camera.farClip);
        const dir = end.clone().sub(start).normalize();

        const selection = [];
        for (let i = 0; i < this.intersectData.length; i++) {
            const { triData, parent, meshInstances } = this.intersectData[i];
            const parentTM = parent.getWorldTransform();
            for (let j = 0; j < triData.length; j++) {
                const { tris, transform, priority } = triData[j];

                // combine node world transform with transform of tri relative to parent
                const triWTM = tmpM1.copy(parentTM).mul(transform);
                const invTriWTM = tmpM2.copy(triWTM).invert();

                const ray = tmpR1;
                invTriWTM.transformPoint(start, ray.origin);
                invTriWTM.transformVector(dir, ray.direction);
                ray.direction.normalize();

                for (let k = 0; k < tris.length; k++) {
                    if (tris[k].intersectsRay(ray, tmpV1)) {
                        selection.push({
                            dist: triWTM.transformPoint(tmpV1).sub(start).length(),
                            meshInstances: meshInstances,
                            priority: priority
                        });
                    }
                }
            }
        }

        if (selection.length) {
            selection.sort((s0, s1) => {
                if (s0.priority !== 0 && s1.priority !== 0) {
                    return s1.priority - s0.priority;
                }
                return s0.dist - s1.dist;
            });
            return selection[0].meshInstances;
        }

        return [];
    }

    /**
     * Attach an array of graph nodes to the gizmo.
     *
     * @param {import('../../scene/graph-node.js').GraphNode[]} [nodes] - The graph nodes. Defaults to [].
     * @example
     * const gizmo = new pc.Gizmo(app, camera, layer);
     * gizmo.attach([boxA, boxB]);
     */
    attach(nodes = []) {
        if (nodes.length === 0) {
            return;
        }

        this.nodes = nodes;
        this._updatePosition();
        this._updateRotation();

        this.fire(Gizmo.EVENT_NODESATTACH);

        this.root.enabled = true;

        this.fire(Gizmo.EVENT_RENDERUPDATE);
    }

    /**
     * Detaches all graph nodes from the gizmo.
     *
     * @example
     * const gizmo = new pc.Gizmo(app, camera, layer);
     * gizmo.attach([boxA, boxB]);
     * gizmo.detach();
     */
    detach() {
        this.root.enabled = false;

        this.fire(Gizmo.EVENT_RENDERUPDATE);
        this.fire(Gizmo.EVENT_NODESDETACH);

        this.nodes = [];
    }

    /**
     * Destroys the gizmo instance; detaches
     * all graph nodes.
     *
     * @example
     * const gizmo = new pc.Gizmo(app, camera, layer);
     * gizmo.attach([boxA, boxB]);
     * gizmo.destroy();
     */
    destroy() {
        this.detach();

        this._device.canvas.removeEventListener('pointerdown', this._onPointerDown);
        this._device.canvas.removeEventListener('pointermove', this._onPointerMove);
        this._device.canvas.removeEventListener('pointerup', this._onPointerUp);

        this.root.destroy();
    }
}

export { Gizmo };
