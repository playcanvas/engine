import {
    math,
    PROJECTION_PERSPECTIVE,
    EventHandler,
    Entity,
    Mat4,
    Vec3
} from 'playcanvas';

// temporary variables
const tmpV1 = new Vec3();
const tmpM1 = new Mat4();

const xstart = new Vec3();
const xdir = new Vec3();

// constants
const MIN_GIZMO_SCALE = 1e-4;
const PERS_SCALE_RATIO = 0.3;
const ORTHO_SCALE_RATIO = 0.32;

/**
 * Local coordinate space.
 *
 * @type {string}
 */
export const LOCAL_COORD_SPACE = 'local';

/**
 * World coordinate space.
 *
 * @type {string}
 */
export const WORLD_COORD_SPACE = 'world';

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
     * Internal version of coordinate space. Defaults to {@link WORLD_COORD_SPACE}.
     *
     * @type {string}
     * @protected
     */
    _coordSpace = WORLD_COORD_SPACE;

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
     * @typedef IntersectData
     * @property {import('./mesh-tri-data.js').MeshTriData[]} meshTriDataList -
     * The array of {@link MeshTriData}
     * @property {import('playcanvas').GraphNode} parent - The mesh parent node.
     * @property {import('playcanvas').MeshInstance[]} meshInstances -
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
     * @param {import('playcanvas').AppBase} app - The application instance.
     * @param {import('playcanvas').CameraComponent} camera - The camera component.
     * @param {import('playcanvas').Layer} layer - The render layer.
     * @example
     * const gizmo = new pcx.Gizmo(app, camera);
     */
    constructor(app, camera, layer) {
        super();

        this.app = app;
        this.camera = camera;
        this.layer = layer;

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

        if (window) {
            window.addEventListener('pointerdown', this._onPointerDown);
            window.addEventListener('pointermove', this._onPointerMove);
            window.addEventListener('pointerup', this._onPointerUp);
            window.addEventListener('keydown', this._onKeyDown);
            window.addEventListener('keyup', this._onKeyUp);
        }

        app.on('update', () => this._updateScale());

        app.on('destroy', () => this.destroy());
    }

    set coordSpace(value) {
        this._coordSpace = value ?? WORLD_COORD_SPACE;
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
        if (this._coordSpace === LOCAL_COORD_SPACE) {
            tmpV1.copy(this.nodes[this.nodes.length - 1].getEulerAngles());
        }
        this.gizmo.setEulerAngles(tmpV1);

        this.fire('rotation:set', tmpV1);
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
        for (let i = 0; i < this.intersectData.length; i++) {
            const { meshTriDataList, parent, meshInstances } = this.intersectData[i];
            const wtm = parent.getWorldTransform().clone();
            for (let j = 0; j < meshTriDataList.length; j++) {
                const { tris, ptm } = meshTriDataList[j];
                tmpM1.copy(wtm).mul(ptm);
                tmpM1.invert();
                tmpM1.transformPoint(start, xstart);
                tmpM1.transformVector(dir, xdir);
                xdir.normalize();

                for (let k = 0; k < tris.length; k++) {
                    if (tris[k].intersectRay(xstart, xdir, tmpV1)) {
                        selection.push({
                            dist: tmpV1.sub(xstart).length(),
                            meshInstances: meshInstances
                        });
                    }
                }
            }
        }

        if (selection.length) {
            selection.sort((s0, s1) => s0.dist - s1.dist);
            return selection[0].meshInstances;
        }

        return [];
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
        if (nodes.length === 0) {
            return;
        }

        this.nodes = nodes;
        this._updatePosition();
        this._updateRotation();

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
    }

    /**
     * Destroys the gizmo instance; detaches
     * all graph nodes.
     *
     * @example
     * const gizmo = new pcx.Gizmo();
     * gizmo.attach([boxA, boxB]);
     * gizmo.destroy();
     */
    destroy() {
        this.detach();

        if (window) {
            window.removeEventListener('pointerdown', this._onPointerDown);
            window.removeEventListener('pointermove', this._onPointerMove);
            window.removeEventListener('pointerup', this._onPointerUp);
            window.removeEventListener('keydown', this._onKeyDown);
            window.removeEventListener('keyup', this._onKeyUp);
        }

        this.gizmo.destroy();
    }
}

export { Gizmo };
