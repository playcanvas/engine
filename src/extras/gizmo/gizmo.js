import { Debug } from '../../core/debug.js';
import { math } from '../../core/math/math.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Mat4 } from '../../core/math/mat4.js';
import { Ray } from '../../core/shape/ray.js';
import { EventHandler } from '../../core/event-handler.js';
import { CameraComponent } from '../../framework/components/camera/component.js';
import { PROJECTION_PERSPECTIVE, SORTMODE_NONE } from '../../scene/constants.js';
import { Entity } from '../../framework/entity.js';
import { Layer } from '../../scene/layer.js';

import { GIZMOSPACE_LOCAL, GIZMOSPACE_WORLD } from './constants.js';

/**
 * @import { AppBase } from '../../framework/app-base.js'
 * @import { GraphNode } from '../../scene/graph-node.js'
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { MeshInstance } from '../../scene/mesh-instance.js'
 * @import { EventHandle } from '../../core/event-handle.js'
 * @import { Shape } from './shape/shape.js'
 */

// temporary variables
const tmpV1 = new Vec3();
const tmpV2 = new Vec3();
const tmpM1 = new Mat4();
const tmpM2 = new Mat4();
const tmpR1 = new Ray();

// constants
const MIN_SCALE = 1e-4;
const PERS_SCALE_RATIO = 0.3;
const ORTHO_SCALE_RATIO = 0.32;
const UPDATE_EPSILON = 1e-6;

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
     * const gizmo = new pc.Gizmo(camera, layer);
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
     * const gizmo = new pc.Gizmo(camera, layer);
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
     * const gizmo = new pc.Gizmo(camera, layer);
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
     * const gizmo = new pc.Gizmo(camera, layer);
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
     * const gizmo = new pc.Gizmo(camera, layer);
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
     * const gizmo = new pc.Gizmo(camera, layer);
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
     * const gizmo = new pc.Gizmo(camera, layer);
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
     * const gizmo = new pc.Gizmo(camera, layer);
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
     * const gizmo = new pc.TransformGizmo(camera, layer);
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
     * Internal version of coordinate space. Defaults to {@link GIZMOSPACE_WORLD}.
     *
     * @type {string}
     * @protected
     */
    _coordSpace = GIZMOSPACE_WORLD;

    /**
     * Internal reference to the app containing the gizmo.
     *
     * @type {AppBase}
     * @protected
     */
    _app;

    /**
     * Internal reference to the graphics device of the app.
     *
     * @type {GraphicsDevice}
     * @protected
     */
    _device;

    /**
     * Internal list of app event handles for the gizmo.
     *
     * @type {EventHandle[]}
     * @protected
     */
    _handles = [];

    /**
     * Internal reference to camera component to view the gizmo.
     *
     * @type {CameraComponent}
     * @protected
     */
    _camera;

    /**
     * Internal reference to layer to render the gizmo..
     *
     * @type {Layer}
     * @protected
     */
    _layer;

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
     * The intersection shapes for the gizmo.
     *
     * @type {Shape[]}
     */
    intersectShapes = [];

    /**
     * Creates a new gizmo layer and adds it to the scene.
     *
     * @param {AppBase} app - The app.
     * @param {string} [layerName] - The layer name. Defaults to 'Gizmo'.
     * @param {number} [layerIndex] - The layer index. Defaults to the end of the layer list.
     * @returns {Layer} The new layer.
     */
    static createLayer(app, layerName = 'Gizmo', layerIndex = app.scene.layers.layerList.length) {
        const layer = new Layer({
            name: layerName,
            clearDepthBuffer: true,
            opaqueSortMode: SORTMODE_NONE,
            transparentSortMode: SORTMODE_NONE
        });
        app.scene.layers.insert(layer, layerIndex);
        return layer;
    }

    /**
     * Creates a new Gizmo object.
     *
     * @param {CameraComponent} camera - The camera component.
     * @param {Layer} layer - The render layer. This can be provided by the user or will be created
     * and added to the scene and camera if not provided. Successive gizmos will share the same layer
     * and will be removed from the camera and scene when the last gizmo is destroyed.
     * const gizmo = new pc.Gizmo(camera, layer);
     */
    constructor(camera, layer) {
        Debug.assert(camera instanceof CameraComponent, 'Incorrect parameters for Gizmos\'s constructor. Use new Gizmo(camera, layer)');
        super();

        this._layer = layer;
        this._camera = camera;
        this._camera.layers = this._camera.layers.concat(this._layer.id);

        this._app = this._camera.system.app;
        this._device = this._app.graphicsDevice;

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

        this._handles.push(this._app.on('prerender', () => this.prerender()));
        this._handles.push(this._app.on('update', () => this.update()));
        this._handles.push(this._app.on('destroy', () => this.destroy()));
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
        this._camera.layers = this._camera.layers.filter(id => id !== this._layer.id);
        this._layer = layer;
        this._camera.layers = this._camera.layers.concat(this._layer.id);
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
        this._camera.layers = this._camera.layers.filter(id => id !== this._layer.id);
        this._camera = camera;
        this._camera.layers = this._camera.layers.concat(this._layer.id);
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
     * Sets the gizmo coordinate space. Can be:
     *
     * - {@link GIZMOSPACE_LOCAL}
     * - {@link GIZMOSPACE_WORLD}
     *
     * Defaults to {@link GIZMOSPACE_WORLD}.
     *
     * @type {string}
     */
    set coordSpace(value) {
        this._coordSpace = value ?? GIZMOSPACE_WORLD;
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
     * @type {Vec3}
     * @protected
     */
    get facingDir() {
        if (this._camera.projection === PROJECTION_PERSPECTIVE) {
            const gizmoPos = this.root.getPosition();
            const cameraPos = this._camera.entity.getPosition();
            return tmpV2.sub2(cameraPos, gizmoPos).normalize();
        }
        return tmpV2.copy(this._camera.entity.forward).mulScalar(-1);
    }

    /**
     * @type {Vec3}
     * @protected
     */
    get cameraDir() {
        const cameraPos = this._camera.entity.getPosition();
        const gizmoPos = this.root.getPosition();
        return tmpV2.sub2(cameraPos, gizmoPos).normalize();
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

        // capture the pointer during drag
        const { canvas } = this._device;
        canvas.setPointerCapture(e.pointerId);

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
     * @param {PointerEvent} e - The pointer event.
     * @private
     */
    _onPointerUp(e) {
        if (!this.root.enabled || document.pointerLockElement) {
            return;
        }
        const selection = this._getSelection(e.offsetX, e.offsetY);
        if (selection[0]) {
            e.preventDefault();
            e.stopPropagation();
        }

        const { canvas } = this._device;
        canvas.releasePointerCapture(e.pointerId);

        this.fire(Gizmo.EVENT_POINTERUP, e.offsetX, e.offsetY, selection[0]);
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

        if (tmpV1.distance(this.root.getPosition()) < UPDATE_EPSILON) {
            return;
        }

        this.root.setPosition(tmpV1);
        this.fire(Gizmo.EVENT_POSITIONUPDATE, tmpV1);
    }

    /**
     * @protected
     */
    _updateRotation() {
        tmpV1.set(0, 0, 0);
        if (this._coordSpace === GIZMOSPACE_LOCAL && this.nodes.length !== 0) {
            tmpV1.copy(this.nodes[this.nodes.length - 1].getEulerAngles());
        }

        if (tmpV1.distance(this.root.getEulerAngles()) < UPDATE_EPSILON) {
            return;
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
        this._scale = Math.max(this._scale * this._size, MIN_SCALE);

        if (Math.abs(this._scale - this.root.getLocalScale().x) < UPDATE_EPSILON) {
            return;
        }

        this.root.setLocalScale(this._scale, this._scale, this._scale);
        this.fire(Gizmo.EVENT_SCALEUPDATE, this._scale);
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
        const dir = tmpV1.copy(end).sub(start).normalize();

        const selection = [];
        for (let i = 0; i < this.intersectShapes.length; i++) {
            const shape = this.intersectShapes[i];
            if (shape.disabled || !shape.entity.enabled) {
                continue;
            }

            const parentTM = shape.entity.getWorldTransform();
            for (let j = 0; j < shape.triData.length; j++) {
                const { tris, transform, priority } = shape.triData[j];

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
                            meshInstances: shape.meshInstances,
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
     * @param {GraphNode[] | GraphNode} [nodes] - The graph nodes. Defaults to [].
     * @example
     * const gizmo = new pc.Gizmo(camera, layer);
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

        this.root.enabled = true;

        this.fire(Gizmo.EVENT_RENDERUPDATE);
    }

    /**
     * Detaches all graph nodes from the gizmo.
     *
     * @example
     * const gizmo = new pc.Gizmo(camera, layer);
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
     * Pre-render method. This is called before the gizmo is rendered.
     *
     * @example
     * const gizmo = new pc.Gizmo(camera, layer);
     * gizmo.attach([boxA, boxB]);
     * gizmo.prerender();
     */
    prerender() {
    }

    /**
     * Updates the gizmo position, rotation, and scale.
     *
     * @example
     * const gizmo = new pc.Gizmo(camera, layer);
     * gizmo.attach([boxA, boxB]);
     * gizmo.update();
     */
    update() {
        this._updatePosition();
        this._updateRotation();
        this._updateScale();
    }

    /**
     * Detaches all graph nodes and destroys the gizmo instance.
     *
     * @example
     * const gizmo = new pc.Gizmo(camera, layer);
     * gizmo.attach([boxA, boxB]);
     * gizmo.destroy();
     */
    destroy() {
        this.detach();

        this._device.canvas.removeEventListener('pointerdown', this._onPointerDown);
        this._device.canvas.removeEventListener('pointermove', this._onPointerMove);
        this._device.canvas.removeEventListener('pointerup', this._onPointerUp);

        this._handles.forEach(handle => handle.off());

        this.root.destroy();

    }
}

export { Gizmo };
