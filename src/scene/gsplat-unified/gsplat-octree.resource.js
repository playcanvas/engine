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
     * Cached total splat count at full detail (LOD 0). Lazily computed by {@link numSplats}.
     *
     * @type {number|null}
     * @private
     */
    _numSplats = null;

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
     * Total number of splats across all leaf nodes at the highest LOD (LOD 0) — the full-detail
     * splat count of the captured scene. Not all of these are resident at runtime: the LOD
     * streaming system selects a subset per node based on view distance and the configured
     * splat budget.
     *
     * @type {number}
     */
    get numSplats() {
        if (this._numSplats === null) {
            let total = 0;
            const nodes = this.octree?.nodes ?? [];
            for (let i = 0; i < nodes.length; i++) {
                // LOD 0 is the highest resolution; missing LOD entries have count 0
                total += nodes[i].lods[0]?.count ?? 0;
            }
            this._numSplats = total;
        }
        return this._numSplats;
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
