import { Vec3 } from '../math/vec3.js';

const tmpVecA = new Vec3();
const tmpVecB = new Vec3();
const tmpVecC = new Vec3();
const tmpVecD = new Vec3();

/**
 * @class
 * @name pc.BoundingSphere
 * @classdesc A bounding sphere is a volume for facilitating fast intersection testing.
 * @description Creates a new bounding sphere.
 * @example
 * // Create a new bounding sphere centered on the origin with a radius of 0.5
 * var sphere = new pc.BoundingSphere();
 * @param {pc.Vec3} [center] - The world space coordinate marking the center of the sphere. The constructor takes a reference of this parameter.
 * @param {number} [radius] - The radius of the bounding sphere. Defaults to 0.5.
 */
class BoundingSphere {
    constructor(center = new Vec3(0, 0, 0), radius = 0.5) {
        this.center = center;
        this.radius = radius;
    }

    containsPoint(point) {
        const lenSq = tmpVecA.sub2(point, this.center).lengthSq();
        const r = this.radius;
        return lenSq < r * r;
    }

    compute(vertices) {
        const numVerts = vertices.length / 3;

        const vertex = tmpVecA;
        const avgVertex = tmpVecB;
        const sum = tmpVecC;

        // FIRST PASS:
        // Find the "average vertex", which is the sphere's center...

        for (let i = 0; i < numVerts; i++) {
            vertex.set(vertices[i * 3], vertices[i * 3 + 1], vertices[i * 3 + 2]);
            sum.addSelf(vertex);

            // apply a part-result to avoid float-overflows
            if (i % 100 === 0) {
                sum.scale(1 / numVerts);
                avgVertex.add(sum);
                sum.set(0, 0, 0);
            }
        }

        sum.scale(1 / numVerts);
        avgVertex.add(sum);

        this.center.copy(avgVertex);

        // SECOND PASS:
        // Find the maximum (squared) distance of all vertices to the center...
        let maxDistSq = 0;
        const centerToVert = tmpVecD;

        for (let i = 0; i < numVerts; i++) {
            vertex.set(vertices[i * 3], vertices[i * 3 + 1], vertices[i * 3 + 2]);

            centerToVert.sub2(vertex, this.center);
            maxDistSq = Math.max(centerToVert.lengthSq(), maxDistSq);
        }

        this.radius = Math.sqrt(maxDistSq);
    }

    /**
     * @function
     * @name pc.BoundingSphere#intersectsRay
     * @description Test if a ray intersects with the sphere.
     * @param {pc.Ray} ray - Ray to test against (direction must be normalized).
     * @param {pc.Vec3} [point] - If there is an intersection, the intersection point will be copied into here.
     * @returns {boolean} True if there is an intersection.
     */
    intersectsRay(ray, point) {
        const m = tmpVecA.copy(ray.origin).sub(this.center);
        const b = m.dot(tmpVecB.copy(ray.direction).normalize());
        const c = m.dot(m) - this.radius * this.radius;

        // exit if ray's origin outside of sphere (c > 0) and ray pointing away from s (b > 0)
        if (c > 0 && b > 0)
            return null;

        const discr = b * b - c;
        // a negative discriminant corresponds to ray missing sphere
        if (discr < 0)
            return false;

        // ray intersects sphere, compute smallest t value of intersection
        const t = Math.abs(-b - Math.sqrt(discr));

        // if t is negative, ray started inside sphere so clamp t to zero
        if (point)
            point.copy(ray.direction).scale(t).add(ray.origin);

        return true;
    }

    /**
     * @function
     * @name pc.BoundingSphere#intersectsBoundingSphere
     * @description Test if a Bounding Sphere is overlapping, enveloping, or inside this Bounding Sphere.
     * @param {pc.BoundingSphere} sphere - Bounding Sphere to test.
     * @returns {boolean} True if the Bounding Sphere is overlapping, enveloping, or inside this Bounding Sphere and false otherwise.
     */
    intersectsBoundingSphere(sphere) {
        tmpVecA.sub2(sphere.center, this.center);
        const totalRadius = sphere.radius + this.radius;
        if (tmpVecA.lengthSq() <= totalRadius * totalRadius) {
            return true;
        }

        return false;
    }
}

export { BoundingSphere };
