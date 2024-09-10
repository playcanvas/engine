import { RefCountedKeyCache } from '../../core/ref-counted-key-cache.js';
import { DeviceCache } from './device-cache.js';

/**
 * Reference counted cache storing multi-sampled versions of depth buffers, which are reference
 * counted and shared between render targets using the same user-specified depth-buffer. This is
 * needed for the cases where the user provided depth buffer is used for depth-pre-pass and then
 * the main render pass - those need to share the same multi-sampled depth buffer.
 */
class MultisampledTextureCache extends RefCountedKeyCache {
    loseContext(device) {
        this.clear(); // just clear the cache when the context is lost
    }
}

// a device cache storing per device instance of MultisampledTextureCache
const multisampledTextureCache = new DeviceCache();

const getMultisampledTextureCache = (device) => {
    return multisampledTextureCache.get(device, () => {
        return new MultisampledTextureCache();
    });
};

export { getMultisampledTextureCache };
