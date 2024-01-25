import {
    Vec3
} from 'playcanvas';

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

    constructor(v0, v1, v2) {
        this.set(v0, v1, v2);
    }

    set(v0, v1, v2) {
        this.v0.copy(v0);
        this.v1.copy(v1);
        this.v2.copy(v2);

        return this;
    }

    intersectRay(origin, dir, out, epsilon = EPSILON) {
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
            if (out instanceof Vec3) {
                out.copy(dir).mulScalar(t).add(origin);
            }
            return true;
        }

        return false;
    }
}

export { Tri };
