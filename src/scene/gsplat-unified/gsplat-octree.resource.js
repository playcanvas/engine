import { Vec3 } from '../../core/math/vec3.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';
import { GSplatOctree } from './gsplat-octree.js';

/**
 * A Gaussian splat resource for streamed level-of-detail data, created when loading a
 * `lod-meta.json` or `.lcc2` file. Its splats are loaded in chunks on demand, based on the view
 * distance and the splat budget.
 *
 * @category Graphics
 */
class GSplatOctreeResource {
    /**
     * @type {BoundingBox}
     * @private
     */
    _aabb = new BoundingBox();

    /**
     * Version counter for centers array changes. Always 0 for octree resources (static).
     *
     * @ignore
     */
    centersVersion = 0;

    /**
     * @type {GSplatOctree|null}
     * @ignore
     */
    octree;

    /**
     * Cached total splat count at full detail (LOD 0). Lazily computed by {@link numSplats}.
     *
     * @type {number|null}
     * @private
     */
    _numSplats = null;

    /**
     * @type {boolean}
     * @private
     */
    _antiAlias = false;

    /**
     * Raw parsed manifest data, retained for consumers that read custom or extension
     * fields the octree itself does not consume (for example application-specific
     * metadata accompanying a `lod-meta.json`). Its `tree` field is null, as the node hierarchy
     * is consumed when the resource is created.
     *
     * @type {object}
     */
    data;

    /**
     * @param {string} assetFileUrl - The file URL of the container asset.
     * @param {object} data - Parsed JSON data.
     * @param {object} assetLoader - Asset loader instance (framework-level object).
     * @ignore
     */
    constructor(assetFileUrl, data, assetLoader) {
        this.octree = new GSplatOctree(assetFileUrl, data);
        this.octree.assetLoader = assetLoader;
        this._aabb.setMinMax(new Vec3(data.tree.bound.min), new Vec3(data.tree.bound.max));
        this.data = data;
        // Tree hierarchy is fully consumed by GSplatOctree above; null it out so this
        // retained reference doesn't keep the (typically large) tree data alive.
        this.data.tree = null;

        // the training mode is recorded once for the whole tree, the same way SOG files record it
        this.antiAlias = data.model === 'antialiased';
    }

    /**
     * Gets the bounding box of the splats, in the local space of the resource. It is read from the
     * level-of-detail data; use {@link GSplatComponent#customAabb} to override the bounds of a
     * component.
     *
     * @type {BoundingBox}
     */
    get aabb() {
        return this._aabb;
    }

    /**
     * Sets whether the splats were trained with anti-aliasing (a screen-space filter with opacity
     * compensation, as in Mip-Splatting), which they need to be rendered with to look right. Set
     * from the `model` field of the `lod-meta.json` file when it records the training mode, and
     * applies to all the files the splats are streamed from. Set it for files that do not record
     * the training mode. Used when {@link GSplatParams#antiAlias} is undefined, its default.
     * Defaults to false.
     *
     * @type {boolean}
     */
    set antiAlias(value) {
        this._antiAlias = value;
        if (this.octree) {
            this.octree.antiAlias = value;
        }
    }

    /**
     * Gets whether the splats were trained with anti-aliasing.
     *
     * @type {boolean}
     */
    get antiAlias() {
        return this._antiAlias;
    }

    /**
     * Application-defined data stored with the streamed splat scene, as in glTF's `extras`: the
     * `extras` value of its lod-meta.json. The engine attaches no meaning to it. Undefined when
     * the manifest has none.
     *
     * @type {*}
     */
    get extras() {
        return this.data?.extras;
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
