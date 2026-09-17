import { DebugHelper } from '../../core/debug.js';
import { BindGroupFormat, BindUniformBufferFormat } from './bind-group-format.js';
import { BindGroup } from './bind-group.js';
import { SHADERSTAGE_FRAGMENT, SHADERSTAGE_VERTEX, UNIFORM_BUFFER_DEFAULT_SLOT_NAME } from './constants.js';

/**
 * @import { GraphicsDevice } from './graphics-device.js'
 */

/**
 * A base class representing a single per platform buffer.
 *
 * @ignore
 */
class DynamicBuffer {
    /** @type {GraphicsDevice} */
    device;

    /**
     * A cache of bind groups for each uniform buffer size, which is used to avoid creating a new
     * bind group for each uniform buffer.
     *
     * @type {Map<number, BindGroup>}
     */
    bindGroupCache = new Map();

    /**
     * Int32 access over the CPU accessible memory of the whole buffer, or null when the buffer has
     * none. The views span the whole buffer and an allocation is addressed by an offset into them,
     * so handing out an allocation creates no views of its own - which matters, as that happens for
     * every draw.
     *
     * @type {Int32Array|null}
     */
    storageInt32 = null;

    /**
     * Uint32 access over the whole buffer. See {@link DynamicBuffer#storageInt32}.
     *
     * @type {Uint32Array|null}
     */
    storageUint32 = null;

    /**
     * Float32 access over the whole buffer. See {@link DynamicBuffer#storageInt32}.
     *
     * @type {Float32Array|null}
     */
    storageFloat32 = null;

    constructor(device) {
        this.device = device;

        // format of the bind group
        this.bindGroupFormat = new BindGroupFormat(this.device, [
            new BindUniformBufferFormat(UNIFORM_BUFFER_DEFAULT_SLOT_NAME, SHADERSTAGE_VERTEX | SHADERSTAGE_FRAGMENT)
        ]);
    }

    /**
     * Create the storage views over the CPU accessible memory of the whole buffer.
     *
     * @param {ArrayBuffer|null} arrayBuffer - The memory of the whole buffer, or null to release
     * the views when the memory is no longer accessible.
     */
    setStorage(arrayBuffer) {
        this.storageInt32 = arrayBuffer ? new Int32Array(arrayBuffer) : null;
        this.storageUint32 = arrayBuffer ? new Uint32Array(arrayBuffer) : null;
        this.storageFloat32 = arrayBuffer ? new Float32Array(arrayBuffer) : null;
    }

    /**
     * Upload the buffer's data to the GPU. A no-op on backends (such as WebGPU) that copy the data
     * to the GPU separately; WebGL overrides this to eagerly upload, as it has no buffer mapping and
     * executes draws immediately.
     */
    upload() {
    }

    getBindGroup(ub) {
        const ubSize = ub.format.byteSize;
        let bindGroup = this.bindGroupCache.get(ubSize);
        if (!bindGroup) {

            // bind group
            // we pass ub to it, but internally only its size is used
            bindGroup = new BindGroup(this.device, this.bindGroupFormat, ub);
            DebugHelper.setName(bindGroup, `DynamicBuffer-BindGroup_${bindGroup.id}-${ubSize}`);
            bindGroup.update();

            this.bindGroupCache.set(ubSize, bindGroup);
        }

        return bindGroup;
    }
}

export { DynamicBuffer };
