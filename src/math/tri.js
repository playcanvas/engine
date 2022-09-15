import { Vec3 } from "./vec3.js";

/** @typedef {import('../shape/ray.js').Ray} Ray */

// Internal variables
const h = new Vec3();
const s = new Vec3();
const q = new Vec3();

/**
 * Class for representing a triangle in 3D space
 */
class Tri {
    /**
     * Creates a new Triangle Object.
     *
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
        this.edge1 = new Vec3();
        this.edge1.sub2(this.vertex1, this.vertex0);
        this.edge2 = new Vec3();
        this.edge2.sub2(this.vertex2, this.vertex0);
    }

    // Recalculate the edge values
    resetEdges() {
        this.edge1.sub2(this.vertex1, this.vertex0);
        this.edge2.sub2(this.vertex2, this.vertex0);
    }

    /**
     * Checks for an intersection with a ray and a triangle
     * and returns the distance between the ray origin
     * and intersection point if there is an intersection.
     *
     * @param {Ray} [ray] - Ray to interect triangle with
     * @returns {number} Distance between ray origin and intersection
     */
    intersectWithRay(ray) {
        h.cross(ray.direction, this.edge2);
        const a = this.edge1.dot(h);
        if (a > -0.0001 && a < 0.0001) {
            return;
        }
        const f = 1 / a;
        s.sub2(ray.origin, this.vertex0);
        const u = f * s.dot(h);
        if (u < 0 || u > 1) {
            return;
        }
        q.cross(s, this.edge1);
        const v = f * ray.direction.dot(q);
        if (v < 0 || u + v > 1) {
            return;
        }
        const t = f * this.edge2.dot(q);
        if (t > 0.0001) {
            return t;
        }
    }
}


export { Tri };
