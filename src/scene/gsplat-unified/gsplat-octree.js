import { GSplatOctreeNode } from './gsplat-octree-node.js';
import { GSplatLodTable } from './gsplat-lod-table.js';
import { path } from '../../core/path.js';
import { Debug } from '../../core/debug.js';
import { Tracing } from '../../core/tracing.js';
import { TRACEID_OCTREE_RESOURCES } from '../../core/constants.js';
// Temporary array reused to avoid allocations during cooldown ticking
const _toDelete = [];

// How many LOD selection tables one octree keeps. Sized for the number of distinct LOD ranges that
// can be live at once - a few quality presets - not for every range ever requested.
const MAX_LOD_TABLES = 4;


/**
 * @import { GSplatResource } from '../gsplat/gsplat-resource.js'
 * @import { GSplatOctreeNodeLod } from './gsplat-octree-node.js'
 * @import { GSplatAssetLoaderBase } from './gsplat-asset-loader-base.js'
 */

class GSplatOctree {
    /**
     * @type {GSplatOctreeNode[]}
     */
    nodes;

    /**
     * Packed per-node axis-aligned bounds in octree local space for CPU hot paths (e.g. LOD).
     * Length is {@link GSplatOctree.nodes}.length * 6. For node index `i`, base `b = i * 6`:
     * `[minX, minY, minZ, maxX, maxY, maxZ]` matching {@link GSplatOctreeNode.bounds}.
     *
     * @type {Float32Array}
     */
    nodeBoundsMinMax;

    /**
     * @type {{ url: string, lodLevel: number }[]}
     */
    files;

    /**
     * @type {number}
     */
    lodLevels;

    /**
     * Where the per-level approximation errors in {@link GSplatOctreeNode#lods} came from.
     * `'file'` when the manifest declared `lodErrors` and every renderable level supplied a usable
     * value, `'derived'` when they were computed from splat counts instead. Errors always exist
     * either way - this is for diagnostics only, there is no separate code path.
     *
     * @type {'file'|'derived'}
     */
    lodErrorSource = 'derived';

    /**
     * Precomputed LOD selection tables, keyed by the LOD range they were built for, and shared by
     * every instance of this octree using that range.
     *
     * More than one is kept because `lodRangeMin`/`lodRangeMax` are per placement, so instances of
     * one octree may legitimately differ - holding only the last would rebuild on every request
     * once two ranges are live. The map is bounded, and the oldest entry is evicted rather than
     * retained indefinitely, so a range that falls out of use does not hold its table forever.
     *
     * @type {Map<number, GSplatLodTable>}
     * @private
     */
    _lodTables = new Map();

    /**
     * How many times {@link GSplatOctree#getLodTable} has had to rebuild. Debug-only, to catch more
     * concurrently-live LOD ranges than the map holds, which would rebuild on every request.
     *
     * @type {number}
     * @private
     */
    _lodTableRebuilds = 0;

    /**
     * The file URL of the container asset, used as the base for resolving relative URLs.
     *
     * @type {string}
     */
    assetFileUrl;

    /**
     * Resources of individual files, identified by their file index.
     *
     * @type {Map<number, GSplatResource>}
     */
    fileResources = new Map();

    /**
     * Reference counts for each file by file index. Index is fileIndex, value is reference count.
     * When a file reaches zero references, it is scheduled for cooldown and unload.
     *
     * @type {Int32Array}
     */
    fileRefCounts;

    /**
     * Cooldown timers for files that reached zero references. Key is fileIndex, value is ticks
     * remaining.
     *
     * @type {Map<number, number>}
     */
    cooldowns = new Map();

    /**
     * Optional environment asset URL.
     *
     * @type {string|null}
     */
    environmentUrl = null;

    /**
     * Loaded environment resource.
     *
     * @type {GSplatResource|null}
     */
    environmentResource = null;

    /**
     * Reference count for environment usage.
     */
    environmentRefCount = 0;

    /**
     * Asset loader used for loading/unloading resources.
     *
     * @type {GSplatAssetLoaderBase|null}
     */
    assetLoader = null;

    /**
     * Whether this octree has been destroyed.
     */
    destroyed = false;

    /**
     * Number of update ticks before unloading unused file resources. Set from GSplatParams.
     *
     * @private
     */
    cooldownTicks = 100;

    /**
     * @param {string} assetFileUrl - The file URL of the container asset.
     * @param {Object} data - The parsed JSON data containing info, filenames and tree.
     */
    constructor(assetFileUrl, data) {

        this.lodLevels = data.lodLevels;
        this.assetFileUrl = assetFileUrl;

        // expand all file paths to full URLs upfront to avoid repeated joins later
        const baseDir = path.getDirectory(assetFileUrl);
        this.files = data.filenames.map(url => ({
            url: path.isRelativePath(url) ? path.join(baseDir, url) : url,
            lodLevel: -1
        }));

        // initialize per-file ref counts
        this.fileRefCounts = new Int32Array(this.files.length);

        // parse optional environment field and resolve path
        if (data.environment) {
            this.environmentUrl = path.isRelativePath(data.environment) ?
                path.join(baseDir, data.environment) :
                data.environment;
        }

        // Extract leaf nodes from hierarchical tree structure
        const leafNodes = [];
        this._extractLeafNodes(data.tree, leafNodes);

        // The manifest declares whether it carries error tables; the values themselves are
        // confirmed while the nodes are built, so one bad entry anywhere falls the whole asset
        // back to derived errors rather than mixing the two.
        let fileErrors = data.lodErrors === true;

        // Create nodes from the extracted leaf nodes
        this.nodes = leafNodes.map((nodeData) => {
            /** @type {GSplatOctreeNodeLod[]} */
            const lods = [];

            // Ensure we have exactly lodLevels entries
            for (let i = 0; i < this.lodLevels; i++) {
                const lodData = nodeData.lods[i.toString()];
                const error = nodeData.errors?.[i];
                if (lodData) {
                    lods.push({
                        file: this.files[lodData.file].url || '',
                        fileIndex: lodData.file,
                        offset: lodData.offset || 0,
                        count: lodData.count || 0,
                        error: 0
                    });

                    // record LOD level for the file index
                    this.files[lodData.file].lodLevel = i;
                } else {
                    // Missing LOD entry - fill with defaults
                    lods.push({
                        file: '',
                        fileIndex: -1,
                        offset: 0,
                        count: 0,
                        error: 0
                    });
                }

                // A level that can be rendered must supply an error that is finite and
                // non-negative. Errors are magnitudes relative to the finest level, so a negative
                // one is meaningless - and more dangerous than a non-finite one, since it would
                // pass a finiteness check and then dominate every finer level on the frontier.
                if (fileErrors) {
                    if (lods[i].count > 0 && !(Number.isFinite(error) && error >= 0)) {
                        fileErrors = false;
                    } else {
                        lods[i].error = error ?? 0;
                    }
                }
            }

            return new GSplatOctreeNode(lods, nodeData.bound);
        });

        this.lodErrorSource = fileErrors ? 'file' : 'derived';
        if (data.lodErrors === true && !fileErrors) {
            Debug.warn(`GSplatOctree: ${assetFileUrl} declares lodErrors but does not supply a finite, non-negative error for every renderable LOD level, deriving errors from splat counts instead.`);
        }
        if (!fileErrors) {
            this._deriveLodErrors();
        }

        // precompute node bounds for CPU hot paths
        const nodeCount = this.nodes.length;
        const boundsFlat = new Float32Array(nodeCount * 6);
        for (let i = 0; i < nodeCount; i++) {
            const bounds = this.nodes[i].bounds;
            const mn = bounds.getMin();
            const mx = bounds.getMax();
            const b = i * 6;
            boundsFlat[b + 0] = mn.x;
            boundsFlat[b + 1] = mn.y;
            boundsFlat[b + 2] = mn.z;
            boundsFlat[b + 3] = mx.x;
            boundsFlat[b + 4] = mx.y;
            boundsFlat[b + 5] = mx.z;
        }
        this.nodeBoundsMinMax = boundsFlat;
    }

    /**
     * Destroys the octree and clears internal state. Does not force-unload resources as they may
     * still be referenced by managers. Resources will be cleaned up when their reference counts
     * reach zero through the normal cleanup mechanisms.
     */
    destroy() {
        // Mark as destroyed so instances can detect forced cleanup
        this.destroyed = true;

        // Clear internal state
        this._lodTables.clear();
        this.fileResources.clear();
        this.cooldowns.clear();

        // Destroy and clear references
        this.assetLoader?.destroy();
        this.assetLoader = null;
        this.environmentResource = null;
    }

    /**
     * Trace out per-LOD counts of currently loaded file resources.
     *
     * @private
     */
    _traceLodCounts() {
        Debug.call(() => {
            if (!Tracing.get(TRACEID_OCTREE_RESOURCES)) return;

            const loadedCounts = new Map();
            for (const fileIndex of this.fileResources.keys()) {
                const lod = this.files[fileIndex].lodLevel;
                loadedCounts.set(lod, (loadedCounts.get(lod) || 0) + 1);
            }

            // report all LODs from 0..lodLevels-1
            const maxLod = Math.max(0, this.lodLevels - 1);
            const loadedSummary = Array.from({ length: maxLod + 1 }, (_, i) => loadedCounts.get(i) || 0).join(' / ');
            Debug.trace(TRACEID_OCTREE_RESOURCES, `${this.assetFileUrl}: LOD resources in memory: ${loadedSummary}`);
        });
    }

    /**
     * Derives per-level approximation errors from splat counts, used when the manifest supplies
     * none. The measure is the log of the level's decimation factor against the node's finest
     * renderable level.
     *
     * The allocator only ever consumes the *difference* between adjacent levels, and decimation is
     * geometric - each level holds roughly half the splats of the one below it. A log therefore
     * gives equal error steps for equal count ratios, which matches how the levels were actually
     * produced, and it beat a cube-root spacing proxy on every capture measured - by 2 percentage
     * points on a finely partitioned one and by over 20 on a coarse one.
     *
     * Deliberately scale-free. Reweighting a node by its physical size, as `ln(ref/c) * V^p` over
     * AABB volume `V`, was swept for `p` in 1/12 .. 1/3 against real splat-transform errors on
     * three captures: it never helped, and cost up to +120% on the finely partitioned one. Two
     * reasons it should not help - {@link NodeInfo#lodCoverage} already accounts for apparent size,
     * so a size term double-counts it, and splat-transform's own error is a mass-weighted *mean*,
     * itself scale-free, so a scale-free proxy matches it in kind.
     *
     * How close it gets depends mostly on how finely the asset is partitioned, since a count-only
     * proxy has less to work with when a node covers more varied content. Against authored errors:
     * ~2-6% on captures with thousands of nodes, ~13-17% on one with only ~500.
     *
     * The result is clamped monotone non-decreasing, because nothing upstream guarantees that a
     * coarser level holds fewer splats and a coarser level must never advertise less error than
     * the finer one it stands in for.
     *
     * @private
     */
    _deriveLodErrors() {
        const levels = this.lodLevels;
        const nodes = this.nodes;
        for (let n = 0; n < nodes.length; n++) {
            const lods = nodes[n].lods;

            // finest renderable level is the reference, and carries no error
            let refCount = 0;
            for (let i = 0; i < levels; i++) {
                if (lods[i].count > 0) {
                    refCount = lods[i].count;
                    break;
                }
            }
            if (refCount === 0) continue;

            let previous = 0;
            for (let i = 0; i < levels; i++) {
                const count = lods[i].count;
                const error = count > 0 ? Math.log(refCount / count) : 0;
                previous = Math.max(previous, error);
                lods[i].error = previous;
            }
        }
    }

    /**
     * Returns the LOD selection table for a LOD range, building it on first use. Tables for ranges
     * still in use are kept, so instances of this octree that differ in range do not rebuild each
     * other's table on every request.
     *
     * The table has to be per range rather than derived from a single full-range one, because a
     * sub-range's Pareto frontier is not the full frontier filtered down to it - when `rangeMax`
     * lands inside a run of levels with equal error, a level that the full range discards becomes
     * the sub-range's cheapest entry.
     *
     * @param {number} rangeMin - Finest allowed LOD index.
     * @param {number} rangeMax - Coarsest allowed LOD index.
     * @returns {GSplatLodTable} The selection table.
     */
    getLodTable(rangeMin, rangeMax) {
        const key = rangeMin * 256 + rangeMax;
        let table = this._lodTables.get(key);
        if (!table) {
            // Evict the oldest rather than growing without bound - Map iterates in insertion order.
            // The cap only needs to cover the ranges live at one time, which is a handful of quality
            // presets in practice.
            if (this._lodTables.size >= MAX_LOD_TABLES) {
                this._lodTables.delete(this._lodTables.keys().next().value);
            }
            table = new GSplatLodTable(this, rangeMin, rangeMax);
            this._lodTables.set(key, table);

            Debug.call(() => {
                // Rebuilding a handful of times as ranges settle is expected; rebuilding constantly
                // means more ranges are live than the map holds, and every request pays a build.
                if (++this._lodTableRebuilds === 64) {
                    Debug.warnOnce(`GSplatOctree: ${this.assetFileUrl} has rebuilt its LOD selection table ${this._lodTableRebuilds} times, so more than ${MAX_LOD_TABLES} LOD ranges are in use at once and each request is rebuilding. Share ranges between instances, or raise MAX_LOD_TABLES.`);
                }
            });
        }
        return table;
    }

    /**
     * Recursively extracts leaf nodes (nodes with 'lods' property) from the hierarchical tree.
     *
     * @param {Object} node - The current tree node to process.
     * @param {Array} leafNodes - Array to collect leaf nodes.
     * @private
     */
    _extractLeafNodes(node, leafNodes) {
        if (node.lods) {
            // This is a leaf node with LOD data
            leafNodes.push({
                lods: node.lods,
                bound: node.bound,
                errors: node.errors
            });
        } else if (node.children) {
            // This is a branch node, recurse into children
            for (const child of node.children) {
                this._extractLeafNodes(child, leafNodes);
            }
        }
    }

    getFileResource(fileIndex) {
        return this.fileResources.get(fileIndex);
    }

    /**
     * Increments reference count for a file by index and cancels any pending cooldown.
     *
     * @param {number} fileIndex - Index of the file in `files` array.
     */
    incRefCount(fileIndex) {
        Debug.assert(fileIndex >= 0 && fileIndex < this.files.length);

        const count = this.fileRefCounts[fileIndex] + 1;
        this.fileRefCounts[fileIndex] = count;

        // cancel any pending cooldown
        this.cooldowns.delete(fileIndex);
    }

    /**
     * Decrements reference count for a file by index. When it reaches zero, either unload
     * immediately (if cooldownTicks is 0) or schedule for cooldown.
     *
     * @param {number} fileIndex - Index of the file in `files` array.
     * @param {number} cooldownTicks - Number of update ticks before unloading when unused. If 0,
     * unload immediately.
     */
    decRefCount(fileIndex, cooldownTicks) {
        Debug.assert(fileIndex >= 0 && fileIndex < this.files.length);

        const count = this.fileRefCounts[fileIndex] - 1;
        this.fileRefCounts[fileIndex] = count;
        Debug.assert(count >= 0);

        // When ref count reaches zero
        if (count === 0) {
            if (cooldownTicks === 0) {
                // Unload immediately (e.g., during device loss)
                this.unloadResource(fileIndex);
            } else {
                // Schedule for cooldown
                this.cooldowns.set(fileIndex, cooldownTicks);
            }
        }
    }

    /**
     * Unloads a resource for a file index if currently loaded.
     *
     * @param {number} fileIndex - Index of the file in `files` array.
     */
    unloadResource(fileIndex) {
        Debug.assert(fileIndex >= 0 && fileIndex < this.files.length);

        // If octree was destroyed, assetLoader is null - nothing to unload
        if (!this.assetLoader) {
            return;
        }

        const fullUrl = this.files[fileIndex].url;

        // Always call unload - it handles loaded, loading, and queued resources
        this.assetLoader.unload(fullUrl);

        // Clean up loaded resource if present
        if (this.fileResources.has(fileIndex)) {
            this.fileResources.delete(fileIndex);

            // trace updated LOD counts after change
            this._traceLodCounts();
        }
    }

    /**
     * Advances cooldowns for zero-ref files and unloads those whose timers expired.
     *
     * @param {number} cooldownTicks - Number of ticks for new cooldowns, synced from GSplatParams.
     */
    updateCooldownTick(cooldownTicks) {
        this.cooldownTicks = cooldownTicks;

        if (this.cooldowns.size > 0) {
            this.cooldowns.forEach((remaining, fileIndex) => {
                if (remaining <= 1) {

                    // just a safety to avoid unloading a file that was re-referenced
                    if (this.fileRefCounts[fileIndex] === 0) {
                        this.unloadResource(fileIndex);
                    }
                    _toDelete.push(fileIndex);
                } else {

                    // decrement cooldown timer
                    this.cooldowns.set(fileIndex, remaining - 1);
                }
            });

            // delete them from the cooldowns map
            _toDelete.forEach(idx => this.cooldowns.delete(idx));
            _toDelete.length = 0;
        }
    }

    /**
     * Ensures a file resource is loaded and available. This function:
     * - Starts loading if not already started
     * - Checks if loading completed and stores the resource if available
     *
     * @param {number} fileIndex - The index of the file in the `files` array.
     */
    ensureFileResource(fileIndex) {
        Debug.assert(fileIndex >= 0 && fileIndex < this.files.length);

        // If octree was destroyed, assetLoader is null - nothing to load
        if (!this.assetLoader) {
            return;
        }

        // resource already loaded
        if (this.fileResources.has(fileIndex)) {
            return;
        }

        // Check if the resource is now available from the asset loader
        const fullUrl = this.files[fileIndex].url;
        const res = this.assetLoader?.getResource(fullUrl);
        if (res) {
            this.fileResources.set(fileIndex, res);

            // The octree fully re-creates these resources on device loss, so the CPU-side
            // ImageBitmap sources retained on the textures are not needed for re-upload.
            res.releaseTextureSources?.();

            // if the file finished loading and is no longer needed, schedule a cooldown
            if (this.fileRefCounts[fileIndex] === 0) {
                this.cooldowns.set(fileIndex, this.cooldownTicks);
            }

            // trace updated LOD counts after change
            this._traceLodCounts();

            return;
        }

        // Start/continue loading (asset loader handles duplicates internally)
        this.assetLoader?.load(fullUrl);
    }

    /**
     * Increments reference count for environment.
     */
    incEnvironmentRefCount() {
        this.environmentRefCount++;
    }

    /**
     * Decrements reference count for environment. When it reaches zero, immediately unload.
     */
    decEnvironmentRefCount() {
        this.environmentRefCount--;
        Debug.assert(this.environmentRefCount >= 0);

        // unload immediately when reaching zero
        if (this.environmentRefCount === 0) {
            this.unloadEnvironmentResource();
        }
    }

    /**
     * Ensures environment resource is loaded and available.
     */
    ensureEnvironmentResource() {
        // If octree was destroyed, don't load anything
        if (!this.assetLoader) {
            return;
        }

        // no environment configured
        if (!this.environmentUrl) {
            return;
        }

        // resource already loaded
        if (this.environmentResource) {
            return;
        }

        // Check if the resource is now available from the asset loader
        const res = this.assetLoader.getResource(this.environmentUrl);
        if (res) {
            this.environmentResource = res;

            // if loaded but not needed, immediately unload
            if (this.environmentRefCount === 0) {
                this.unloadEnvironmentResource();
            }

            return;
        }

        // Start/continue loading (asset loader handles duplicates internally)
        this.assetLoader.load(this.environmentUrl);
    }

    /**
     * Unloads environment resource if currently loaded.
     */
    unloadEnvironmentResource() {
        // If octree was destroyed, assetLoader is null - nothing to unload
        if (!this.assetLoader) {
            return;
        }

        if (this.environmentResource && this.environmentUrl) {
            this.assetLoader.unload(this.environmentUrl);
            this.environmentResource = null;
        }
    }
}

export { GSplatOctree };
