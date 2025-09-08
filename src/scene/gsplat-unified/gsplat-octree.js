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
     * @type {string[]}
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
     * Pre-computed base directory for resolving relative URLs.
     *
     * @type {string}
     */
    baseDir;

    /**
     * Resources of individual files, identified by their filename.
     *
     * @type {Map<string, GSplatResource>}
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
     * @param {string} assetFileUrl - The file URL of the container asset.
     * @param {Object} data - The parsed JSON data containing info, filenames and tree.
     */
    constructor(assetFileUrl, data) {

        this.files = data.filenames;
        this.lodLevels = data.lodLevels;
        this.assetFileUrl = assetFileUrl;
        this.baseDir = path.getDirectory(assetFileUrl);

        // initialize per-file ref counts
        this.fileRefCounts = new Int32Array(this.files.length);

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
                        file: this.files[lodData.file] || '',
                        fileIndex: lodData.file,
                        offset: lodData.offset || 0,
                        count: lodData.count || 0
                    });
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
     * Trace out per-LOD counts of currently loaded file resources.
     * @private
     */
    _traceLodCounts() {
        Debug.call(() => {
            if (!Tracing.get(TRACEID_OCTREE_RESOURCES)) return;

            const loadedCounts = new Map();
            for (const url of this.fileResources.keys()) {
                // parse LOD from the first path segment "<lod>_<tile>/..."
                const first = url.split('/')[0] || url;
                const lodStr = first.split('_')[0];
                const lod = parseInt(lodStr, 10);
                if (Number.isFinite(lod)) {
                    loadedCounts.set(lod, (loadedCounts.get(lod) || 0) + 1);
                }
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

    getFullUrl(url) {
        // Use pre-computed base directory for fast path joining
        return path.join(this.baseDir, url);
    }

    getFileResource(url) {
        return this.fileResources.get(url);
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
     * Decrements reference count for a file by index. When it reaches zero, start cooldown.
     *
     * @param {number} fileIndex - Index of the file in `files` array.
     * @param {number} cooldownTicks - Number of update ticks before unloading when unused.
     */
    decRefCount(fileIndex, cooldownTicks) {
        Debug.assert(fileIndex >= 0 && fileIndex < this.files.length);

        const count = this.fileRefCounts[fileIndex] - 1;
        this.fileRefCounts[fileIndex] = count;
        Debug.assert(count >= 0);

        // unload cooldown
        if (count === 0) {
            this.cooldowns.set(fileIndex, cooldownTicks);
        }
    }

    /**
     * Unloads a resource for a file index if currently loaded.
     *
     * @param {number} fileIndex - Index of the file in `files` array.
     * @param {GSplatAssetLoaderBase} assetLoader - Asset loader used to unload the resource.
     */
    unloadResource(fileIndex, assetLoader) {
        Debug.assert(fileIndex >= 0 && fileIndex < this.files.length);
        const url = this.files[fileIndex];

        if (this.fileResources.has(url)) {

            const fullUrl = this.getFullUrl(url);
            assetLoader.unload(fullUrl);
            this.fileResources.delete(url);

            // trace updated LOD counts after change
            this._traceLodCounts();
        }
    }

    /**
     * Advances cooldowns for zero-ref files and unloads those whose timers expired.
     *
     * @param {GSplatAssetLoaderBase} assetLoader - Asset loader used to unload expired resources.
     */
    updateCooldownTick(assetLoader) {
        if (this.cooldowns.size > 0) {
            this.cooldowns.forEach((remaining, fileIndex) => {
                if (remaining <= 1) {

                    // just a safety to avoid unloading a file that was re-referenced
                    if (this.fileRefCounts[fileIndex] === 0) {
                        this.unloadResource(fileIndex, assetLoader);
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
     * @param {string} url - The url of the file.
     * @param {number} fileIndex - The index of the file in the `files` array.
     * @param {GSplatAssetLoaderBase} assetLoader - The asset loader.
     */
    ensureFileResource(url, fileIndex, assetLoader) {

        // resource already loaded
        if (this.fileResources.has(url)) {
            return;
        }

        // Check if the resource is now available from the asset loader
        const fullUrl = this.getFullUrl(url);
        const res = assetLoader.getResource(fullUrl);
        if (res) {
            this.fileResources.set(url, res);

            // if the file finished loading and is no longer needed, schedule a cooldown
            if (this.fileRefCounts[fileIndex] === 0) {
                this.cooldowns.set(fileIndex, assetLoader.cooldownTicks);
            }

            // trace updated LOD counts after change
            this._traceLodCounts();

            return;
        }

        // Start/continue loading (asset loader handles duplicates internally)
        assetLoader.load(fullUrl);
    }
}

export { GSplatOctree };
