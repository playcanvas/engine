import {
    math,
    PROJECTION_PERSPECTIVE,
    SORTMODE_NONE,
    EventHandler,
    Layer,
    Entity,
    Vec3
} from 'playcanvas';

// temporary variables
const tmpV1 = new Vec3();
const tmpV2 = new Vec3();
const tmpV3 = new Vec3();
const tmpV4 = new Vec3();

const xstart = new Vec3();
const xdir = new Vec3();

const e1 = new Vec3();
const e2 = new Vec3();
const h = new Vec3();
const s = new Vec3();
const q = new Vec3();

// constants
const GIZMO_LAYER_ID = 1e5;
const MIN_GIZMO_SCALE = 1e-4;
const EPSILON = 1e-6;
const PERS_SCALE_RATIO = 0.3;
const ORTHO_SCALE_RATIO = 0.32;

function rayIntersectsTriangle(origin, dir, v0, v1, v2, out) {
    e1.sub2(v1, v0);
    e2.sub2(v2, v0);
    h.cross(dir, e2);
    const a = e1.dot(h);
    if (a > -EPSILON && a < EPSILON) {
        return false;
    }

    const f = 1 / a;
    s.sub2(origin, v0);
    const u = f * s.dot(h);
    if (u < 0 || u > 1) {
        return false;
    }

    q.cross(s, e1);
    const v = f * dir.dot(q);
    if (v < 0 || u + v > 1) {
        return false;
    }

    const t = f * e2.dot(q);
    if (t > EPSILON) {
        out.copy(dir).scale(t).add(origin);
        return true;
    }

    return false;
}

/**
 * The base class for all gizmos.
 */
class Gizmo extends EventHandler {
    /**
     * Internal version of the gizmo size.
     *
     * @type {number}
     * @private
     */
    _size = 1;

    /**
     * Internal version of the gizmo scale.
     *
     * @type {number}
     * @protected
     */
    _scale = 1;

    /**
     * Internal version of coordinate space.
     *
     * @type {string}
     * @protected
     */
    _coordSpace = 'world';

    /**
     * The application instance containing the gizmo.
     *
     * @type {import('playcanvas').AppBase}
     */
    app;

    /**
     * The camera entity that displays the gizmo.
     *
     * @type {Entity}
     */
    camera;

    /**
     * The graph nodes attached to the gizmo.
     *
     * @type {import('playcanvas').GraphNode}
     */
    nodes = [];

    /**
     * The root gizmo entity.
     *
     * @type {import('playcanvas').Entity}
     */
    gizmo;


    /**
     * Creates a new Gizmo object.
     *
     * @param {import('playcanvas').AppBase} app - The application instance.
     * @param {import('playcanvas').CameraComponent} camera - The camera component.
     * @example
     * const gizmo = new pcx.Gizmo(app, camera);
     */
    constructor(app, camera) {
        super();

        this.app = app;
        this.camera = camera;

        this._createLayer();
        this._createGizmo();

        this._updateScale();

        this._onPointerDown = (e) => {
            if (!this.gizmo.enabled || document.pointerLockElement) {
                return;
            }
            const selection = this._getSelection(e.clientX, e.clientY);
            if (selection[0]) {
                e.preventDefault();
            }
            this.fire('pointer:down', e.clientX, e.clientY, selection[0]);
        };
        this._onPointerMove = (e) => {
            if (!this.gizmo.enabled || document.pointerLockElement) {
                return;
            }
            const selection = this._getSelection(e.clientX, e.clientY);
            if (selection[0]) {
                e.preventDefault();
            }
            this.fire('pointer:move', e.clientX, e.clientY, selection[0]);
        };
        this._onPointerUp = (e) => {
            if (!this.gizmo.enabled || document.pointerLockElement) {
                return;
            }
            this.fire('pointer:up');
        };
        this._onKeyDown = (e) => {
            if (!this.gizmo.enabled) {
                return;
            }
            this.fire('key:down', e.key, e.shiftKey, e.ctrlKey, e.metaKey);
        };
        this._onKeyUp = (e) => {
            if (!this.gizmo.enabled) {
                return;
            }
            this.fire('key:up');
        };

        app.on('update', () => this._updateScale());

        app.on('destroy', () => this.detach());
    }

    set coordSpace(value) {
        this._coordSpace = value ?? 'world';
        this._updateRotation();
    }

    get coordSpace() {
        return this._coordSpace;
    }

    set size(value) {
        this._size = value;
        this._updateScale();
    }

    get size() {
        return this._size;
    }

    _getProjFrustumWidth() {
        const gizmoPos = this.gizmo.getPosition();
        const cameraPos = this.camera.entity.getPosition();
        const dist = tmpV1.copy(gizmoPos).sub(cameraPos).dot(this.camera.entity.forward);
        return dist * Math.tan(this.camera.fov * math.DEG_TO_RAD / 2);
    }

    _createLayer() {
        const layerMap = this.app.scene.layers.layerIdMap;
        if (layerMap.has(GIZMO_LAYER_ID)) {
            this.layer = layerMap.get(GIZMO_LAYER_ID);
        } else {
            this.layer = new Layer({
                id: GIZMO_LAYER_ID,
                name: 'Gizmo',
                clearDepthBuffer: true,
                opaqueSortMode: SORTMODE_NONE,
                transparentSortMode: SORTMODE_NONE
            });
            this.app.scene.layers.push(this.layer);
        }
        if (this.camera.layers.indexOf(this.layer.id) === -1) {
            this.camera.layers = this.camera.layers.concat(this.layer.id);
        }
    }

    _createGizmo() {
        this.gizmo = new Entity('gizmo');
        this.app.root.addChild(this.gizmo);
        this.gizmo.enabled = false;
    }

    _updatePosition() {
        tmpV1.set(0, 0, 0);
        for (let i = 0; i < this.nodes.length; i++) {
            const node = this.nodes[i];
            tmpV1.add(node.getPosition());
        }
        tmpV1.scale(1.0 / (this.nodes.length || 1));
        this.gizmo.setPosition(tmpV1);

        this.fire('position:set', tmpV1);
    }

    _updateRotation() {
        tmpV1.set(0, 0, 0);
        if (this._coordSpace === 'local') {
            for (let i = 0; i < this.nodes.length; i++) {
                const node = this.nodes[i];
                tmpV1.add(node.getEulerAngles());
            }
            tmpV1.scale(1.0 / (this.nodes.length || 1));
        }
        this.gizmo.setEulerAngles(tmpV1);

        this.fire('eulerAngles:set', tmpV1);
    }

    _updateScale() {
        if (this.camera.projection === PROJECTION_PERSPECTIVE) {
            this._scale = this._getProjFrustumWidth() * PERS_SCALE_RATIO;
        } else {
            this._scale = this.camera.orthoHeight * ORTHO_SCALE_RATIO;
        }
        this._scale = Math.max(this._scale * this._size, MIN_GIZMO_SCALE);
        this.gizmo.setLocalScale(this._scale, this._scale, this._scale);

        this.fire('scale:set', this._scale);
    }

    _getSelection(x, y) {
        const start = this.camera.screenToWorld(x, y, 1);
        const end = this.camera.screenToWorld(x, y, this.camera.farClip);
        const dir = end.clone().sub(start).normalize();

        const selection = [];
        const renders = this.gizmo.findComponents('render');
        for (let i = 0; i < renders.length; i++) {
            const meshInstances = renders[i].meshInstances;
            for (let j = 0; j < meshInstances.length; j++) {
                const meshInstance = meshInstances[j];
                if (!meshInstance.visible) {
                    continue;
                }
                const mesh = meshInstance.mesh;
                const wtm = meshInstance.node.getWorldTransform().clone().invert();

                wtm.transformPoint(start, xstart);
                wtm.transformVector(dir, xdir);
                xdir.normalize();

                const pos = [];
                const idx = [];
                mesh.getPositions(pos);
                mesh.getIndices(idx);

                for (let k = 0; k < idx.length; k += 3) {
                    const i1 = idx[k];
                    const i2 = idx[k + 1];
                    const i3 = idx[k + 2];

                    tmpV1.set(pos[i1 * 3], pos[i1 * 3 + 1], pos[i1 * 3 + 2]);
                    tmpV2.set(pos[i2 * 3], pos[i2 * 3 + 1], pos[i2 * 3 + 2]);
                    tmpV3.set(pos[i3 * 3], pos[i3 * 3 + 1], pos[i3 * 3 + 2]);

                    if (rayIntersectsTriangle(xstart, xdir, tmpV1, tmpV2, tmpV3, tmpV4)) {
                        selection.push(meshInstance);
                    }
                }

            }
        }
        return selection;
    }

    /**
     * Attach an array of graph nodes to the gizmo.
     *
     * @param {import('playcanvas').GraphNode} [nodes] - The graph nodes. Defaults to [].
     * @example
     * const gizmo = new pcx.Gizmo();
     * gizmo.attach([boxA, boxB]);
     */
    attach(nodes = []) {
        this.nodes = nodes;
        this._updatePosition();
        this._updateRotation();

        window.addEventListener('pointerdown', this._onPointerDown);
        window.addEventListener('pointermove', this._onPointerMove);
        window.addEventListener('pointerup', this._onPointerUp);
        window.addEventListener('keydown', this._onKeyDown);
        window.addEventListener('keyup', this._onKeyUp);

        this.fire('nodes:attach');

        this.gizmo.enabled = true;
    }

    /**
     * Detaches all graph nodes from the gizmo.
     *
     * @example
     * const gizmo = new pcx.Gizmo();
     * gizmo.attach([boxA, boxB]);
     * gizmo.detach();
     */
    detach() {
        this.gizmo.enabled = false;

        this.fire('nodes:detach');

        this.nodes = [];

        window.removeEventListener('pointerdown', this._onPointerDown);
        window.removeEventListener('pointermove', this._onPointerMove);
        window.removeEventListener('pointerup', this._onPointerUp);
        window.removeEventListener('keydown', this._onKeyDown);
        window.removeEventListener('keyup', this._onKeyUp);
    }
}

export { Gizmo };
