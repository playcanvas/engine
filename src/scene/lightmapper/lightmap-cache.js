import { RefCountedCache } from '../../core/ref-counted-cache.js';

// Pure static class, implementing the cache of lightmaps generated at runtime using Lightmapper
// this allows us to automatically release realtime baked lightmaps when mesh instances using them are destroyed
class LightmapCache {
    static cache = new RefCountedCache();

    // add texture reference to lightmap cache
    static incRef(texture) {
        this.cache.incRef(texture);
    }

    // remove texture reference from lightmap cache
    static decRef(texture) {
        this.cache.decRef(texture);
    }

    static destroy() {
        this.cache.destroy();
    }
}

export { LightmapCache };
