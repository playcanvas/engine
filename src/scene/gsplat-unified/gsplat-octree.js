import { GSplatOctreeNode } from './gsplat-octree-node.js';
import { path } from '../../core/path.js';
import { Debug } from '../../core/debug.js';
import { Tracing } from '../../core/tracing.js';
import { TRACEID_OCTREE_RESOURCES } from '../../core/constants.js';

// Temporary array reused to avoid allocations during cooldown ticking
const _toDelete = [];

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
     * @type {{ url: string, lodLevel: number }[]}
     */
    files;

    /**
     * @type {number}
     */
    lodLevels;

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
     *
     * @type {number}
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
     *
     * @type {boolean}
     */
    destroyed = false;

    /**
     * Number of update ticks before unloading unused file resources. Set from GSplatParams.
     *
     * @type {number}
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

        // Create nodes from the extracted leaf nodes
        this.nodes = leafNodes.map((nodeData) => {
            /** @type {GSplatOctreeNodeLod[]} */
            const lods = [];

            // Ensure we have exactly lodLevels entries
            for (let i = 0; i < this.lodLevels; i++) {
                const lodData = nodeData.lods[i.toString()];
                if (lodData) {
                    lods.push({
                        file: this.files[lodData.file].url || '',
                        fileIndex: lodData.file,
                        offset: lodData.offset || 0,
                        count: lodData.count || 0
                    });

                    // record LOD level for the file index
                    this.files[lodData.file].lodLevel = i;
                } else {
                    // Missing LOD entry - fill with defaults
                    lods.push({
                        file: '',
                        fileIndex: -1,
                        offset: 0,
                        count: 0
                    });
                }
            }

            return new GSplatOctreeNode(lods, nodeData.bound);
        });
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
        this.fileResources.clear();
        this.cooldowns.clear();

        // Destroy and clear references
        this.assetLoader?.destroy();
        this.assetLoader = null;
        this.environmentResource = null;
    }

    /**
     * Trace out per-LOD counts of currently loaded file resources.
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
                bound: node.bound
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
        Debug.assert(this.assetLoader);

        // resource already loaded
        if (this.fileResources.has(fileIndex)) {
            return;
        }

        // Check if the resource is now available from the asset loader
        const fullUrl = this.files[fileIndex].url;
        const res = this.assetLoader?.getResource(fullUrl);
        if (res) {
            this.fileResources.set(fileIndex, res);

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
