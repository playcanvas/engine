import { Plane } from '../core/shape/plane.js';

/**
 * @import { Vec3 } from '../core/math/vec3.js'
 */

// the largest number of clipping planes of a mesh instance or a camera, matching the size of the
// uniform arrays of the clipPlanesPS chunk
const MAX_CLIP_PLANES = 8;

// the values of the assigned planes, read before any copy is written, because the assigned planes
// can be the returned ones, in any order
const _values = [];

/**
 * The clipping of a mesh instance, a camera or a render component: its planes, whether they clip
 * by intersection, and the uniforms the clipPlanesPS chunk reads.
 *
 * It keeps the planes as last assigned, which the owner uses, apart from the copies the getter of
 * the owner returns, which can be changed and assigned again. It owns the planes of both, and
 * their normals, so the entries of the returned array are independent copies after each
 * assignment, whatever had been put into the array or its planes.
 *
 * @ignore
 */
class ClipPlanes {
    /**
     * The planes as last assigned. They are not exposed, so only assignments change them.
     *
     * @type {Plane[]}
     */
    assigned = [];

    /**
     * Copies of the assigned planes, which the getter of the owner returns.
     *
     * @type {Plane[]}
     */
    returned = [];

    /**
     * Whether only the parts behind all of the planes are clipped, instead of the parts behind any
     * of them.
     *
     * @type {boolean}
     */
    intersection = false;

    /**
     * The assigned planes as the uniform the shader reads, (normal, distance) per plane. Allocated
     * by the first {@link ClipPlanes#updateUniforms}.
     *
     * @type {Float32Array|null}
     */
    planesData = null;

    /**
     * The number of assigned planes, and 1 for intersection clipping, as the uniform the shader
     * reads. Allocated by the first {@link ClipPlanes#updateUniforms}.
     *
     * @type {Float32Array|null}
     */
    paramsData = null;

    /**
     * The planes owned for {@link ClipPlanes#assigned}, kept when there are fewer planes.
     *
     * @type {Plane[]}
     * @private
     */
    _assignedPlanes = [];

    /**
     * The planes owned for {@link ClipPlanes#returned}, kept when there are fewer planes.
     *
     * @type {Plane[]}
     * @private
     */
    _returnedPlanes = [];

    /**
     * The normals of {@link ClipPlanes#_returnedPlanes}. The normal of a returned plane can be
     * replaced through the returned array, so each assignment gives the plane its own back.
     *
     * @type {Vec3[]}
     * @private
     */
    _returnedNormals = [];

    /**
     * Assigns planes, which can include planes of the returned array, in any order.
     *
     * @param {Plane[]|null|undefined} planes - The planes.
     * @param {number} [maxCount] - The largest number of planes to keep.
     */
    set(planes, maxCount = MAX_CLIP_PLANES) {
        const count = Math.min(planes?.length ?? 0, maxCount);
        for (let i = 0; i < count; i++) {
            (_values[i] ??= new Plane()).copy(planes[i]);
        }

        const { assigned, returned, _assignedPlanes, _returnedPlanes, _returnedNormals } = this;
        for (let i = 0; i < count; i++) {
            assigned[i] = (_assignedPlanes[i] ??= new Plane()).copy(_values[i]);

            let plane = _returnedPlanes[i];
            if (!plane) {
                plane = _returnedPlanes[i] = new Plane();
                _returnedNormals[i] = plane.normal;
            }
            plane.normal = _returnedNormals[i];
            returned[i] = plane.copy(_values[i]);
        }
        assigned.length = count;
        returned.length = count;
    }

    /**
     * Copies the assigned planes and the mode of other clipping, or removes the planes and resets
     * the mode when there is none.
     *
     * @param {ClipPlanes|null} other - The clipping to copy, or null for none.
     * @returns {ClipPlanes} Self for chaining.
     */
    copy(other) {
        this.set(other?.assigned);
        this.intersection = other?.intersection ?? false;
        return this;
    }

    /**
     * Writes the assigned planes and the mode into the uniform data, allocating it on first use.
     */
    updateUniforms() {
        const planes = this.assigned;
        const data = (this.planesData ??= new Float32Array(MAX_CLIP_PLANES * 4));
        for (let i = 0; i < planes.length; i++) {
            const { normal, distance } = planes[i];
            data[i * 4] = normal.x;
            data[i * 4 + 1] = normal.y;
            data[i * 4 + 2] = normal.z;
            data[i * 4 + 3] = distance;
        }

        const params = (this.paramsData ??= new Float32Array(2));
        params[0] = planes.length;
        params[1] = this.intersection ? 1 : 0;
    }
}

export { ClipPlanes, MAX_CLIP_PLANES };
