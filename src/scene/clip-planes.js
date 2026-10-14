import { Plane } from '../core/shape/plane.js';

// the largest number of clipping planes of a mesh instance or a camera, matching the size of the
// uniform arrays of the clipPlanesPS chunk
const MAX_CLIP_PLANES = 8;

// the values of the assigned planes, read before any copy is written, because the assigned planes
// can be the returned ones, in any order
const _values = [];

/**
 * The clipping planes of a mesh instance, a camera or a render component. It keeps the planes as
 * last assigned, which the owner uses, apart from the copies its getter returns, which can be
 * changed and assigned again. The set owns the planes of both, so the entries of the returned array
 * are independent copies after each assignment, whatever had been put into the array.
 *
 * @ignore
 */
class ClipPlaneSet {
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
     * The planes the set owns for {@link ClipPlaneSet#assigned}, kept when there are fewer planes.
     *
     * @type {Plane[]}
     * @private
     */
    _assignedPlanes = [];

    /**
     * The planes the set owns for {@link ClipPlaneSet#returned}, kept when there are fewer planes.
     *
     * @type {Plane[]}
     * @private
     */
    _returnedPlanes = [];

    /**
     * Assigns planes, which can include planes of the returned array, in any order.
     *
     * @param {Plane[]|null|undefined} planes - The planes.
     * @param {number} maxCount - The largest number of planes to keep.
     */
    set(planes, maxCount) {
        const count = Math.min(planes?.length ?? 0, maxCount);
        for (let i = 0; i < count; i++) {
            (_values[i] ??= new Plane()).copy(planes[i]);
        }

        const { assigned, returned, _assignedPlanes, _returnedPlanes } = this;
        for (let i = 0; i < count; i++) {
            assigned[i] = (_assignedPlanes[i] ??= new Plane()).copy(_values[i]);
            returned[i] = (_returnedPlanes[i] ??= new Plane()).copy(_values[i]);
        }
        assigned.length = count;
        returned.length = count;
    }
}

/**
 * Writes planes into the uniform the clipPlanesPS chunk reads, as (normal, distance) per plane.
 *
 * @param {Plane[]} planes - The planes, at most MAX_CLIP_PLANES of them.
 * @param {Float32Array} data - The uniform data, with room for MAX_CLIP_PLANES planes.
 * @ignore
 */
function writeClipPlanes(planes, data) {
    for (let i = 0; i < planes.length; i++) {
        const { normal, distance } = planes[i];
        data[i * 4] = normal.x;
        data[i * 4 + 1] = normal.y;
        data[i * 4 + 2] = normal.z;
        data[i * 4 + 3] = distance;
    }
}

export { ClipPlaneSet, MAX_CLIP_PLANES, writeClipPlanes };
