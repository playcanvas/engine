import { Vec3 } from '../../core/math/vec3.js';
import { Quat } from '../../core/math/quat.js';
import { Mat4 } from '../../core/math/mat4.js';
import { Tri } from '../../core/shape/tri.js';
import { Geometry } from '../../scene/geometry/geometry.js';

const tmpV1 = new Vec3();
const tmpV2 = new Vec3();
const tmpV3 = new Vec3();

/**
 * The class for holding triangle data.
 *
 * @ignore
 */
class TriData {
    /**
     * The priority of the triangle data (Used for intersection ordering):
     *   - priority = 0 - no priority
     *   - priority > 0 - higher value represents a higher priority
     * defaults to 0.
     *
     * @type {number}
     */
    _priority = 0;

    /**
     * The transform of the triangles.
     *
     * @type {Mat4}
     */
    _transform = new Mat4();

    /**
     * The array of triangles for the geometry.
     *
     * @type {Tri[]}
     */
    tris = [];

    /**
     * @param {Geometry} geometry - The geometry to create the triangle data from.
     * @param {number} [priority] - The priority of the triangle data.
     */
    constructor(geometry, priority = 0) {
        this.fromGeometry(geometry);
        this._priority = priority;
    }

    get transform() {
        return this._transform;
    }

    get priority() {
        return this._priority;
    }

    setTransform(pos = new Vec3(), rot = new Quat(), scale = new Vec3()) {
        this.transform.setTRS(pos, rot, scale);
    }

    calculateTris(geometry) {
        const positions = geometry.positions;
        const indices = geometry.indices;
        this.tris = [];
        for (let k = 0; k < indices.length; k += 3) {
            const i1 = indices[k];
            const i2 = indices[k + 1];
            const i3 = indices[k + 2];

            tmpV1.set(positions[i1 * 3], positions[i1 * 3 + 1], positions[i1 * 3 + 2]);
            tmpV2.set(positions[i2 * 3], positions[i2 * 3 + 1], positions[i2 * 3 + 2]);
            tmpV3.set(positions[i3 * 3], positions[i3 * 3 + 1], positions[i3 * 3 + 2]);
            const tri = new Tri(tmpV1, tmpV2, tmpV3);
            this.tris.push(tri);
        }
    }

    fromGeometry(geometry) {
        if (!geometry || !(geometry instanceof Geometry)) {
            throw new Error('No geometry provided.');
        }
        this.calculateTris(geometry);
    }
}

export { TriData };
