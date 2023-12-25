import {
    SORTMODE_NONE,
    Layer,
    Entity,
    Vec3
} from 'playcanvas'

class Gizmo {
    gizmo;

    constructor(app, camera, nodes) {
        this.app = app;
        this.camera = camera;
        this.nodes = nodes;

        this._createLayer();
        this._createGizmo();

        const onPointerMove = (e) => {
            const start = this.camera.camera.screenToWorld(e.clientX, e.clientY, 1);
            const end = this.camera.camera.screenToWorld(e.clientX, e.clientY, this.camera.camera.farClip);
            const dir = end.clone().sub(start).normalize();

            const xstart = new Vec3();
            const xdir = new Vec3();

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

                    const v1 = new Vec3();
                    const v2 = new Vec3();
                    const v3 = new Vec3();
                    const out = new Vec3();

                    for (let k = 0; k < idx.length; k += 3) {
                        const i1 = idx[k];
                        const i2 = idx[k + 1];
                        const i3 = idx[k + 2];

                        v1.set(pos[i1 * 3], pos[i1 * 3 + 1], pos[i1 * 3 + 2]);
                        v2.set(pos[i2 * 3], pos[i2 * 3 + 1], pos[i2 * 3 + 2]);
                        v3.set(pos[i3 * 3], pos[i3 * 3 + 1], pos[i3 * 3 + 2]);

                        if (this._rayIntersectsTriangle(xstart, xdir, v1, v2, v3, out)) {
                            selection.push(meshInstance);
                        }
                    }

                }
            }

            this._handleHover(selection[0] ?? null);

        };

        window.addEventListener('pointermove', onPointerMove);
        app.on('destroy', () => {
            window.removeEventListener('pointermove', onPointerMove);
        });
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
    }

    _handleHover(selection) {
        // override in child class
    }

    _rayIntersectsTriangle(origin, dir, v0, v1, v2, out) {
        const EPSILON = 1e-6;
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
