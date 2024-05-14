import { DebugHelper } from '../../core/debug.js';
import { BindGroupFormat, BindUniformBufferFormat } from './bind-group-format.js';
import { BindGroup } from './bind-group.js';
import { SHADERSTAGE_FRAGMENT, SHADERSTAGE_VERTEX, UNIFORM_BUFFER_DEFAULT_SLOT_NAME } from './constants.js';

/**
 * A base class representing a single per platform buffer.
 *
 * @ignore
 */
class DynamicBuffer {
    /** @type {import('./graphics-device.js').GraphicsDevice} */
    device;

    /**
     * A cache of bind groups for each uniform buffer size, which is used to avoid creating a new
     * bind group for each uniform buffer.
     *
     * @type {Map<number, BindGroup>}
     */
    bindGroupCache = new Map();

    constructor(device) {
        this.device = device;

        // format of the bind group
        this.bindGroupFormat = new BindGroupFormat(this.device, [
            new BindUniformBufferFormat(UNIFORM_BUFFER_DEFAULT_SLOT_NAME, SHADERSTAGE_VERTEX | SHADERSTAGE_FRAGMENT)
        ]);
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
