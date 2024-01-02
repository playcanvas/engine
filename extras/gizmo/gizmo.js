import {
    math,
    PROJECTION_PERSPECTIVE,
    SORTMODE_NONE,
    EventHandler,
    Layer,
    Entity,
    Quat,
    Vec3
} from 'playcanvas'

// temp variables
const tmpV1 = new Vec3();
const tmpV2 = new Vec3();
const tmpQ = new Quat();

// constants
const MIN_GIZMO_SCALE = 1e-4;
const EPSILON = 1e-6;

class Gizmo extends EventHandler {
    app;

    camera;

    nodes = [];

    nodeLocalPositions = new Map();

    nodePositions = new Map();

    nodeScale = new Map();

    gizmo;

    _startProjFrustWidth;

    _coordSpace = 'world';

    constructor(app, camera) {
        super();

        this.app = app;
        this.camera = camera;

        this._createLayer();
        this._createGizmo();

        this._startProjFrustWidth = this._getProjFrustumWidth();

        const onPointerMove = (e) => {
            if (!this.gizmo.enabled) {
                return;
            }
            const selection = this._getSelection(e.clientX, e.clientY);
            this.fire('pointer:move', e.clientX, e.clientY, selection[0]);
        };
        const onPointerDown = (e) => {
            if (!this.gizmo.enabled) {
                return;
            }
            const selection = this._getSelection(e.clientX, e.clientY);
            this.fire('pointer:down', e.clientX, e.clientY, selection[0]);
        };
        const onPointerUp = (e) => {
            if (!this.gizmo.enabled) {
                return;
            }
            this.fire('pointer:up');
        };

        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerdown', onPointerDown);
        window.addEventListener('pointerup', onPointerUp);

        app.on('destroy', () => {
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerdown', onPointerDown);
            window.removeEventListener('pointerup', onPointerUp);
        });
    }

    set coordSpace(value) {
        this._coordSpace = value ?? 'world';
        this.setGizmoRotation();
    }

    get coordSpace() {
        return this._coordSpace;
    }

    attach(nodes) {
        this.nodes = nodes;
        this.gizmo.enabled = true;

        this.setGizmoPosition();
        this.setGizmoRotation();
    }

    detach() {
        this.nodes = [];
        this.nodeLocalPositions.clear();
        this.nodePositions.clear();
        this.gizmo.enabled = false;
    }

    storeNodePositions() {
        for (let i = 0; i < this.nodes.length; i++) {
            const node = this.nodes[i];
            this.nodeLocalPositions.set(node, node.getLocalPosition().clone());
            this.nodePositions.set(node, node.getPosition().clone());
        }
    }

    updateNodePositions(point) {
        for (let i = 0; i < this.nodes.length; i++) {
            const node = this.nodes[i];
            if (this._coordSpace === 'local') {
                tmpV1.copy(point);
                node.parent.getWorldTransform().getScale(tmpV2);
                tmpV2.x = 1 / tmpV2.x;
                tmpV2.y = 1 / tmpV2.y;
                tmpV2.z = 1 / tmpV2.z;
                tmpQ.copy(node.getLocalRotation()).transformVector(tmpV1, tmpV1);
                tmpV1.mul(tmpV2);
                node.setLocalPosition(this.nodeLocalPositions.get(node).clone().add(tmpV1));
            } else {
                node.setPosition(this.nodePositions.get(node).clone().add(point));
            }
        }

        this.setGizmoPosition();
    }

    storeNodeScale() {
        for (let i = 0; i < this.nodes.length; i++) {
            const node = this.nodes[i];
            this.nodeScale.set(node, node.getLocalScale().clone());
        }
    }

    updateNodeScale(point) {
        for (let i = 0; i < this.nodes.length; i++) {
            const node = this.nodes[i];
            node.setLocalScale(this.nodeScale.get(node).clone().mul(point));
        }
    }

    setGizmoPosition() {
        tmpV1.set(0, 0, 0);
        for (let i = 0; i < this.nodes.length; i++) {
            const node = this.nodes[i];
            tmpV1.add(node.getPosition());
        }
        tmpV1.scale(1.0 / this.nodes.length);
        this.gizmo.setPosition(tmpV1);
    }

    setGizmoRotation() {
        if (this._coordSpace === 'local') {
            tmpV1.set(0, 0, 0);
            for (let i = 0; i < this.nodes.length; i++) {
                const node = this.nodes[i];
                tmpV1.add(node.getEulerAngles());
            }
            this.gizmo.setEulerAngles(tmpV1.scale(1.0 / this.nodes.length));
        } else {
            this.gizmo.setEulerAngles(0, 0, 0);
        }
    }

    updateGizmoScale() {
        // scale to screen space
        let scale = 1;
        if (this.camera.camera.projection === PROJECTION_PERSPECTIVE) {
            scale = this._getProjFrustumWidth() / this._startProjFrustWidth;
        } else {
            scale = this.camera.camera.orthoHeight / 3;
        }
        // scale *= this.size;
        scale = Math.max(scale, MIN_GIZMO_SCALE);
        this.gizmo.setLocalScale(scale, scale, scale);
    }

    _getProjFrustumWidth() {
        const gizmoPos = this.gizmo.getPosition();
        const cameraPos = this.camera.getPosition();
        const dist = tmpV1.copy(gizmoPos).sub(cameraPos).dot(this.camera.forward);
        return dist * Math.tan(this.camera.camera.fov * math.DEG_TO_RAD / 2);
    }

    _createLayer() {
        this.layerGizmo = new Layer({
            name: 'Gizmo',
            clearDepthBuffer: true,
            opaqueSortMode: SORTMODE_NONE,
            transparentSortMode: SORTMODE_NONE
        });
        this.app.scene.layers.push(this.layerGizmo);
        this.camera.camera.layers = this.camera.camera.layers.concat(this.layerGizmo.id);
    }

    _createGizmo() {
        this.gizmo = new Entity('gizmo');
        this.app.root.addChild(this.gizmo);
        this.gizmo.enabled = false;
    }

    _getSelection(x, y) {
        const start = this.camera.camera.screenToWorld(x, y, 1);
        const end = this.camera.camera.screenToWorld(x, y, this.camera.camera.farClip);
        const dir = end.clone().sub(start).normalize();

        const xstart = new Vec3();
        const xdir = new Vec3();
        const v1 = new Vec3();
        const v2 = new Vec3();
        const v3 = new Vec3();

        const selection = [];
        const renders = this.gizmo.findComponents('render');
        for (let i = 0; i < renders.length; i++) {
            const meshInstances = renders[i].meshInstances;
            for (let j = 0; j < meshInstances.length; j++) {
                const meshInstance = meshInstances[j];
                const mesh = meshInstance.mesh;
                const wtm = meshInstance.node.getWorldTransform().clone();
                wtm.invert();

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

                    v1.set(pos[i1 * 3], pos[i1 * 3 + 1], pos[i1 * 3 + 2]);
                    v2.set(pos[i2 * 3], pos[i2 * 3 + 1], pos[i2 * 3 + 2]);
                    v3.set(pos[i3 * 3], pos[i3 * 3 + 1], pos[i3 * 3 + 2]);

                    if (this._rayIntersectsTriangle(xstart, xdir, v1, v2, v3, tmpV1)) {
                        selection.push(meshInstance);
                    }
                }

            }
        }
        return selection;
    }

    _rayIntersectsTriangle(origin, dir, v0, v1, v2, out) {
        const e1 = new Vec3();
        const e2 = new Vec3();
        const h = new Vec3();
        const s = new Vec3();
        const q = new Vec3();

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
}

export { Gizmo };
