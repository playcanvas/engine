import { Debug, DebugHelper } from '../../core/debug.js';
import { BUFFERUSAGE_COPY_DST, BUFFERUSAGE_COPY_SRC } from './constants.js';
import { StorageBuffer } from './storage-buffer.js';

/**
 * @import { GraphicsDevice } from './graphics-device.js'
 */

// the data of a slot: the model matrix, followed by the normal matrix as three vec4 columns, the
// storage layout of a mat3x3f - read by the meshInstanceStorageVS chunk as an array of vec4
const FLOATS_PER_SLOT = 28;
const BYTES_PER_SLOT = FLOATS_PER_SLOT * 4;

// dirty slots closer than this are uploaded in one write, the clean slots between them included, as
// a write costs more than copying a few slots of data
const MAX_SLOT_GAP = 16;

/**
 * The per mesh instance data the vertex shaders read from a storage buffer instead of a per draw
 * uniform buffer: a slot per mesh instance, holding its model and normal matrix. A draw passes
 * the slot as its first instance, and the shader indexes the buffer by the instance index. The
 * data persists between frames, so only the slots of the mesh instances whose transform changed
 * are written, into a CPU copy of the buffer, and uploaded when the device submits its command
 * buffers - before those run. The buffer grows when it runs out of slots, and never shrinks.
 *
 * WebGPU only, see {@link GraphicsDevice#supportsMeshInstanceStorage}.
 *
 * @ignore
 */
class MeshInstanceStorage {
    /**
     * The number of slots the buffer holds.
     *
     * @type {number}
     */
    capacity = 0;

    /**
     * The number of slots ever allocated, the freed ones included.
     *
     * @type {number}
     */
    count = 0;

    /**
     * Incremented when the buffer is replaced by a larger one, so that the bind groups holding it
     * are updated.
     *
     * @type {number}
     */
    version = 0;

    /** @type {StorageBuffer|null} */
    buffer = null;

    /**
     * The CPU copy of the buffer.
     *
     * @type {Float32Array}
     */
    data = new Float32Array(0);

    /**
     * The slots which can be allocated.
     *
     * @type {number[]}
     * @private
     */
    _freeSlots = [];

    /**
     * The slots released since the last submit, which can be allocated once it is done. The
     * draws recorded before it may still use them, and the data of the slots is uploaded once
     * for all of these draws.
     *
     * @type {number[]}
     * @private
     */
    _releasedSlots = [];

    /**
     * A bit per slot, set when the slot was written since the last upload, which walks them in
     * slot order.
     *
     * @type {Uint32Array}
     * @private
     */
    _dirtyBits = new Uint32Array(0);

    /**
     * True when any slot was written since the last upload.
     *
     * @type {boolean}
     * @private
     */
    _dirty = false;

    /**
     * @param {GraphicsDevice} device - The graphics device.
     * @param {number} [capacity] - The initial number of slots. Defaults to 1024.
     */
    constructor(device, capacity = 1024) {
        this.device = device;
        this.scopeId = device.scope.resolve('meshInstanceStorage');
        this._resize(capacity);
    }

    destroy() {
        this.buffer?.destroy();
        this.buffer = null;
    }

    /**
     * Uploads all the slots again after the device was lost and restored, which recreates the
     * buffer empty. The slots and their CPU copy are kept, as the mesh instances hold on to them.
     */
    restoreContext() {

        // the upload covers the slots written since the last one, and no draws are pending
        this._dirtyBits.fill(0);
        this._dirty = false;
        this._recycleReleasedSlots();

        if (this.count > 0) {
            this._writeRange(0, this.count - 1);
        }
    }

    /**
     * Allocates a slot, growing the buffer when all are in use.
     *
     * @returns {number} The slot.
     */
    allocate() {
        if (this._freeSlots.length > 0) {
            return this._freeSlots.pop();
        }
        if (this.count === this.capacity) {
            this._resize(this.capacity * 2);
        }
        return this.count++;
    }

    /**
     * Returns a slot for reuse.
     *
     * @param {number} slot - The slot.
     */
    free(slot) {
        Debug.assert(slot >= 0 && slot < this.count && !this._freeSlots.includes(slot) && !this._releasedSlots.includes(slot), `Freeing an invalid mesh instance storage slot ${slot}`);
        this._releasedSlots.push(slot);
    }

    /**
     * Writes the matrices of a slot, uploaded on the next submit.
     *
     * @param {number} slot - The slot.
     * @param {Float32Array} model - The 16 floats of the model matrix.
     * @param {Float32Array} normal - The 9 floats of the normal matrix.
     */
    write(slot, model, normal) {
        const data = this.data;
        const o = slot * FLOATS_PER_SLOT;
        data.set(model, o);
        data[o + 16] = normal[0];
        data[o + 17] = normal[1];
        data[o + 18] = normal[2];
        data[o + 20] = normal[3];
        data[o + 21] = normal[4];
        data[o + 22] = normal[5];
        data[o + 24] = normal[6];
        data[o + 25] = normal[7];
        data[o + 26] = normal[8];

        // all draws recorded before the next submit read the data written last, so a slot is
        // expected to be written once between the submits
        Debug.call(() => {
            if (this._dirtyBits[slot >> 5] & (1 << (slot & 31))) {
                Debug.warnOnce('The transform of a node changed after its mesh instance was drawn in this frame. On WebGPU all draws of a mesh instance in a frame use its last transform, so transforms need to be final before the frame renders.');
            }
        });

        this._dirtyBits[slot >> 5] |= 1 << (slot & 31);
        this._dirty = true;
    }

    /**
     * Uploads the slots written since the last upload, merging slots close together into one
     * write, and makes the slots released since available for allocation. Called by the device
     * before it submits its command buffers, which then run after the upload.
     */
    upload() {
        this._uploadDirtySlots();
        this._recycleReleasedSlots();
    }

    /**
     * Makes the released slots available for allocation, once no draws recorded before their
     * release are pending.
     *
     * @private
     */
    _recycleReleasedSlots() {
        const released = this._releasedSlots;
        while (released.length > 0) {
            this._freeSlots.push(released.pop());
        }
    }

    /**
     * @private
     */
    _uploadDirtySlots() {
        if (!this._dirty) {
            return;
        }
        this._dirty = false;

        // the range of slots being gathered into one write
        let start = -1;
        let end = -1;

        const words = this._dirtyBits;
        for (let w = 0; w < words.length; w++) {
            let bits = words[w];
            if (bits === 0) {
                continue;
            }
            words[w] = 0;
            const base = w << 5;

            // all 32 slots of the word, the common case when everything moves
            if (bits === 0xffffffff) {
                if (start < 0) {
                    start = base;
                } else if (base - end > MAX_SLOT_GAP) {
                    this._writeRange(start, end);
                    start = base;
                }
                end = base + 31;
                continue;
            }

            // each set bit, lowest first
            while (bits !== 0) {
                const slot = base + 31 - Math.clz32(bits & -bits);
                bits &= bits - 1;
                if (start < 0) {
                    start = slot;
                } else if (slot - end > MAX_SLOT_GAP) {
                    this._writeRange(start, end);
                    start = slot;
                }
                end = slot;
            }
        }

        this._writeRange(start, end);
    }

    /**
     * @param {number} first - The first slot.
     * @param {number} last - The last slot, included.
     * @private
     */
    _writeRange(first, last) {
        this.buffer.write(first * BYTES_PER_SLOT, this.data, first * FLOATS_PER_SLOT, (last - first + 1) * FLOATS_PER_SLOT);
    }

    /**
     * Replaces the buffer with one of a new capacity, keeping the data. The old buffer is still
     * used by the commands recorded this frame, so the writes pending for it are uploaded to it
     * first, and its destruction is deferred until the commands are submitted.
     *
     * @param {number} capacity - The number of slots.
     * @private
     */
    _resize(capacity) {

        const old = this.buffer;
        if (old) {
            this._uploadDirtySlots();
            old.destroy();
        }

        const data = new Float32Array(capacity * FLOATS_PER_SLOT);
        data.set(this.data);
        this.data = data;

        // the pending writes were uploaded above, so no slot is dirty
        this._dirtyBits = new Uint32Array(Math.ceil(capacity / 32));

        this.capacity = capacity;
        // copy source for reading it back, when debugging
        this.buffer = new StorageBuffer(this.device, capacity * BYTES_PER_SLOT, BUFFERUSAGE_COPY_DST | BUFFERUSAGE_COPY_SRC);
        DebugHelper.setName(this.buffer, `MeshInstanceStorage_${capacity}`);
        if (this.count > 0) {
            this._writeRange(0, this.count - 1);
        }

        this.scopeId.setValue(this.buffer);
        this.version++;
    }
}

export { MeshInstanceStorage };
