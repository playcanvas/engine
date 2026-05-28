import { Vec3 } from '../../core/math/vec3.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';
import { GSplatOctree } from './gsplat-octree.js';

class GSplatOctreeResource {
    /** @type {BoundingBox} */
    aabb = new BoundingBox();

    /**
     * Version counter for centers array changes. Always 0 for octree resources (static).
     *
     * @ignore
     */
    centersVersion = 0;

    /** @type {GSplatOctree|null} */
    octree;

    /**
     * Raw parsed manifest data, retained for consumers that read custom or extension
     * fields the octree itself does not consume (for example application-specific
     * metadata accompanying a `lod-meta.json`). The `tree` field is nulled out by the
     * constructor since {@link GSplatOctree} consumes it — access node hierarchy via
     * {@link GSplatOctreeResource#octree} instead.
     *
     * @type {object}
     */
    data;

    /**
     * @param {string} assetFileUrl - The file URL of the container asset.
     * @param {object} data - Parsed JSON data.
     * @param {object} assetLoader - Asset loader instance (framework-level object).
     */
    constructor(assetFileUrl, data, assetLoader) {
        this.octree = new GSplatOctree(assetFileUrl, data);
        this.octree.assetLoader = assetLoader;
        this.aabb.setMinMax(new Vec3(data.tree.bound.min), new Vec3(data.tree.bound.max));
        this.data = data;
        // Tree hierarchy is fully consumed by GSplatOctree above; null it out so this
        // retained reference doesn't keep the (typically large) tree data alive.
        this.data.tree = null;
    }

    /**
     * Destroys the octree resource and cleans up all associated resources.
     */
    destroy() {
        this.octree?.destroy();
        this.octree = null;
    }
}

export { GSplatOctreeResource };
