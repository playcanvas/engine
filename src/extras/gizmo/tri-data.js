import { Vec3 } from '../../core/math/vec3.js';
import { Quat } from '../../core/math/quat.js';
import { Mat4 } from '../../core/math/mat4.js';
import { Geometry } from '../../scene/geometry/geometry.js';

/**
 * The class for holding triangle data.
 *
 * @ignore
 */
class TriData {
    /**
     * The priority of the triangle data (Used for intersection ordering):
     *     - priority = 0 - no priority
     *     - priority > 0 - higher value represents a higher priority
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
    _ptm = new Mat4();

    /**
     * The array of triangles for the geometry.
     *
     * @type {import('../../core/shape/tri.js').Tri[]}
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

    get ptm() {
        return this._ptm;
    }

    get priority() {
        return this._priority;
    }

    setTransform(pos = new Vec3(), rot = new Quat(), scale = new Vec3()) {
        this.ptm.setTRS(pos, rot, scale);
    }

    fromGeometry(geometry) {
        if (!geometry || !(geometry instanceof Geometry)) {
            throw new Error('No geometry provided.');
        }
        geometry.calculateTris();
        if (!geometry.tris) {
            throw new Error('No tris found in geometry.');
        }
        this.tris = geometry.tris;
    }
}

export { TriData };
