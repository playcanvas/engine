import { Ray } from "src/shape/ray";
import { Vec3 } from "./vec3";

class Tri {
    /**
     * Creates a new Triangle Object.
     * @param {Vec3} [vertex0] - Vertex 0 value
     * @param {Vec3} [vertex1] - Vertex 1 value
     * @param {Vec3} [vertex2] - Vertex 2 value
     * @param {Vec3} [centroid] - Centroid value
     */
    constructor(vertex0, vertex1, vertex2, centroid) {
        this.vertex0 = vertex0;
        this.vertex1 = vertex1;
        this.vertex2 = vertex2;
        this.centroid = centroid;
    }

    /**
     * Creates a new Vec3 object.
     * @param {Ray} [ray] - Ray to interect triangle with
     */
    intersectWithRay(ray) {
        const edge1 = new Vec3();
        const negativeVertex0 = this.vertex0.clone();
        negativeVertex0.mulScalar(-1);
        edge1.add2(this.vertex1, negativeVertex0);

        const edge2 = new Vec3();
        edge2.add2(this.vertex2, negativeVertex0);
        const h = (new Vec3()).cross(ray.direction, edge2);
        const a = edge1.dot(h);
        if (a > -0.0001 && a < 0.0001) {
            return;
        }
        const f = 1 / a;
        const s = new Vec3();
        s.add2(ray.origin, negativeVertex0);
        const u = f * s.dot(h);
        if (u < 0 || u > 1) {
            return;
        }
        const q = (new Vec3()).cross(s, edge1);
        const v = f * ray.direction.dot(q);
        if (v < 0 || u + v > 1) {
            return;
        }
        const t = f * edge2.dot(q);
        if (t > 0.0001) {
            return t;
        }
    }
}


export { Tri };