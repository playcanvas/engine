import {
    Vec3
} from 'playcanvas';

// temporary variables
const tmpV1 = new Vec3();
const tmpV2 = new Vec3();
const tmpV3 = new Vec3();

const e1 = new Vec3();
const e2 = new Vec3();
const h = new Vec3();
const s = new Vec3();
const q = new Vec3();

// constants
const EPSILON = 1e-6;

class Tri {
    v0 = new Vec3();

    v1 = new Vec3();

    v2 = new Vec3();

    static trisFromMesh(mesh) {
        const tris = [];
        const pos = [];
        const indices = [];
        mesh.getPositions(pos);
        mesh.getIndices(indices);

        for (let k = 0; k < indices.length; k += 3) {
            const i1 = indices[k];
            const i2 = indices[k + 1];
            const i3 = indices[k + 2];

            tmpV1.set(pos[i1 * 3], pos[i1 * 3 + 1], pos[i1 * 3 + 2]);
            tmpV2.set(pos[i2 * 3], pos[i2 * 3 + 1], pos[i2 * 3 + 2]);
            tmpV3.set(pos[i3 * 3], pos[i3 * 3 + 1], pos[i3 * 3 + 2]);
            const tri = new Tri(tmpV1, tmpV2, tmpV3);
            tris.push(tri);
        }
        return tris;
    }

    constructor(v0 = new Vec3(), v1 = new Vec3(), v2 = new Vec3()) {
        if (v0.length === 3) {
            this.v0.copy(v0[0]);
            this.v1.copy(v0[1]);
            this.v2.copy(v0[2]);
        } else {
            this.v0.copy(v0);
            this.v1.copy(v1);
            this.v2.copy(v2);
        }
    }

    set(v0, v1, v2) {
        this.v0.copy(v0);
        this.v1.copy(v1);
        this.v2.copy(v2);

        return this;
    }

    intersectRay(origin, dir, out = new Vec3(), epsilon = EPSILON) {
        e1.sub2(this.v1, this.v0);
        e2.sub2(this.v2, this.v0);
        h.cross(dir, e2);
        const a = e1.dot(h);
        if (a > -epsilon && a < epsilon) {
            return false;
        }

        const f = 1 / a;
        s.sub2(origin, this.v0);
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
        if (t > epsilon) {
            out.copy(dir).scale(t).add(origin);
            return true;
        }

        return false;
    }
}

export { Tri };
