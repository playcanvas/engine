/**
 * @import { Plane } from '../core/shape/plane.js'
 */

// the largest number of clipping planes of a mesh instance or a camera, matching the size of the
// uniform arrays of the clipPlanesPS chunk
const MAX_CLIP_PLANES = 8;

/**
 * Copies planes into the copies made by a previous assignment, which can be the same array. Only
 * planes beyond the number of the previous assignment allocate.
 *
 * @param {Plane[]} copies - The copies of the previous assignment, updated in place.
 * @param {Plane[]|null|undefined} planes - The assigned planes.
 * @param {number} [maxCount] - The largest number of planes to copy.
 * @ignore
 */
function copyPlanes(copies, planes, maxCount = Infinity) {
    const count = Math.min(planes?.length ?? 0, maxCount);
    for (let i = 0; i < count; i++) {
        if (copies[i]) {
            copies[i].copy(planes[i]);
        } else {
            copies[i] = planes[i].clone();
        }
    }
    copies.length = count;
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

export { MAX_CLIP_PLANES, copyPlanes, writeClipPlanes };
