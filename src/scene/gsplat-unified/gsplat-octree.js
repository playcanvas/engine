import { GSplatOctreeNode } from './gsplat-octree-node.js';
import { buildLodTree } from './gsplat-lod-tree.js';
import { path } from '../../core/path.js';
import { Debug } from '../../core/debug.js';
import { Tracing } from '../../core/tracing.js';
import { TRACEID_OCTREE_RESOURCES } from '../../core/constants.js';
// Temporary array reused to avoid allocations during cooldown ticking
const _toDelete = [];

// Temporaries reused to order file requests by priority
const _requestOrder = [];
const _requestPriority = new Map();


/**
 * @import { GSplatResource } from '../gsplat/gsplat-resource.js'
 * @import { GSplatOctreeNodeLod } from './gsplat-octree-node.js'
 * @import { GSplatAssetLoaderBase } from './gsplat-asset-loader-base.js'
 */

/**
 * The level of detail tree of a streamed GSplat. Every node holds a single LOD level of its region,
 * as a range of splats in one of the octree's files, and is replaced by its children when more
 * detail is needed - the children together cover the same region at the next finer level. A
 * manifest holding its data in the leaves of its octree only, each leaf with every LOD level of its
 * region, is reorganized into such a tree on creation, see buildLodTree.
 *
 * @ignore
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
     * Index of each node's parent node, -1 for the top level nodes. Nodes are stored breadth first,
     * so a parent always precedes its children and the children of a node are contiguous.
     *
     * @type {Int32Array}
     */
    parentIndex;

    /**
     * Index of each node's first child, valid when {@link GSplatOctree#childCount} is not zero.
     *
     * @type {Int32Array}
     */
    childStart;

    /**
     * Number of children of each node, zero for the leaves.
     *
     * @type {Int32Array}
     */
    childCount;

    /**
     * The single LOD level each node holds data for.
     *
     * @type {Int16Array}
     */
    nodeLevel;

    /**
     * Per node, the splat count of its own level and the summed splat counts of its children's
     * levels, for choosing a cut without visiting the children.
     *
     * @type {Float64Array}
     */
    nodeSplats;

    /**
     * @type {Float64Array}
     */
    childrenSplats;

    /**
     * Per node, how many nodes of its subtree, itself included, can render right now - their data
     * is loaded, or they have none. A subtree with none has nothing loaded to fall back on, which
     * lets a walk skip it without visiting it. Kept up to date as files load and unload.
     *
     * @type {Int32Array}
     */
    loadedBelow;

    /**
     * Per file, the nodes whose data it holds.
     *
     * @type {number[][]}
     * @private
     */
    _fileNodes;

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
     * The latest file requests of each instance of this octree, mapped to their load priority.
     * An instance replaces its own set on each of its LOD updates and keeps it in between, so the
     * requests of an instance whose camera is not re-evaluating LOD stay alive.
     *
     * @type {Map<object, Map<number, number>>}
     * @private
     */
    _requesters = new Map();

    /**
     * Files whose request changed since the last {@link GSplatOctree#flushRequests} - those in a
     * newly submitted set, and those an instance stopped requesting. Each is issued again at its
     * current highest priority, or withdrawn when no instance requests it any more.
     *
     * @type {Set<number>}
     * @private
     */
    _changedRequests = new Set();

    /**
     * Token of the last {@link GSplatOctree#updateCooldownTick} that advanced the cooldowns.
     *
     * @type {number|undefined}
     * @private
     */
    _cooldownToken;

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

        // the nodes below the root of the tree, a manifest holding its data in the leaves only
        // reorganized into a tree first
        const nodesData = [];
        this._extractHierarchy((data.hierarchical ? data : buildLodTree(data)).tree, nodesData);

        // Create nodes from the extracted node data
        this.nodes = nodesData.map((nodeData) => {
            /** @type {GSplatOctreeNodeLod[]} */
            const lods = [];

            // Ensure we have exactly lodLevels entries
            for (let i = 0; i < this.lodLevels; i++) {
                const lodData = nodeData.lods[i.toString()];
                if (lodData) {
                    lods.push({
                        file: this.files[lodData.file].url || '',
                        // A level listed with no splats has nothing to load: give it no file, the
                        // same as a level the manifest omits, so nothing downstream places or
                        // fetches it.
                        fileIndex: (lodData.count || 0) > 0 ? lodData.file : -1,
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

        this._initHierarchyCounts();
    }

    /**
     * Fills the per-node counts.
     *
     * @private
     */
    _initHierarchyCounts() {
        const { nodes, parentIndex, childStart, childCount, nodeLevel } = this;
        const nodeCount = nodes.length;
        const own = new Float64Array(nodeCount);
        const children = new Float64Array(nodeCount);
        const loadedBelow = new Int32Array(nodeCount);
        const fileNodes = this.files.map(() => []);

        for (let n = 0; n < nodeCount; n++) {
            const lod = nodes[n].lods[nodeLevel[n]];
            own[n] = lod.count;
            if (lod.fileIndex >= 0) {
                fileNodes[lod.fileIndex].push(n);
            }
        }

        // children are stored after their parent, so a reverse pass sees a subtree before its root
        for (let n = nodeCount - 1; n >= 0; n--) {
            for (let c = childStart[n], end = c + childCount[n]; c < end; c++) {
                children[n] += own[c];
            }

            // a node with no data needs nothing loaded to render
            if (nodes[n].lods[nodeLevel[n]].fileIndex < 0) {
                loadedBelow[n]++;
            }
            const parent = parentIndex[n];
            if (parent >= 0) {
                loadedBelow[parent] += loadedBelow[n];
            }
        }

        this.nodeSplats = own;
        this.childrenSplats = children;
        this.loadedBelow = loadedBelow;
        this._fileNodes = fileNodes;
    }

    /**
     * Updates {@link GSplatOctree#loadedBelow} for a file that loaded or unloaded.
     *
     * @param {number} fileIndex - The file index.
     * @param {number} delta - 1 when the file loaded, -1 when it unloaded.
     * @private
     */
    _updateLoadedBelow(fileIndex, delta) {
        const fileNodes = this._fileNodes;
        if (!fileNodes) return;

        const { parentIndex, loadedBelow } = this;
        const list = fileNodes[fileIndex];
        for (let i = 0; i < list.length; i++) {
            for (let n = list[i]; n >= 0; n = parentIndex[n]) {
                loadedBelow[n] += delta;
            }
        }
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
        this._requesters.clear();
        this._changedRequests.clear();

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
     * Extracts every node below the root of the tree, breadth first, and fills in the hierarchy
     * arrays. The root holds no data, its children are the top level nodes. Each node
     * carries its `level`, the single LOD level of its `lods`.
     *
     * @param {Object} tree - The root of the tree.
     * @param {Array} nodes - Array to collect the nodes.
     * @private
     */
    _extractHierarchy(tree, nodes) {
        const parents = [];
        const starts = [];
        const counts = [];
        const levels = [];

        for (const child of tree.children ?? []) {
            nodes.push(child);
            parents.push(-1);
        }

        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            const children = node.children ?? [];
            starts.push(nodes.length);
            counts.push(children.length);
            levels.push(node.level);
            for (const child of children) {
                nodes.push(child);
                parents.push(i);
            }
        }

        // the node data is read as the leaf node data of a flat tree
        for (let i = 0; i < nodes.length; i++) {
            nodes[i] = { lods: nodes[i].lods ?? {}, bound: nodes[i].bound };
        }

        this.parentIndex = Int32Array.from(parents);
        this.childStart = Int32Array.from(starts);
        this.childCount = Int32Array.from(counts);
        this.nodeLevel = Int16Array.from(levels);
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
            this._updateLoadedBelow(fileIndex, -1);

            // trace updated LOD counts after change
            this._traceLodCounts();
        }
    }

    /**
     * Advances cooldowns for zero-ref files and unloads those whose timers expired.
     *
     * @param {number} cooldownTicks - Number of ticks for new cooldowns, synced from GSplatParams.
     * @param {number} [token] - Per-frame token. Every world using this octree ticks it, one per
     * camera and layer, so a repeated token is ignored to advance the cooldowns once per frame.
     * When omitted, every call advances them.
     */
    updateCooldownTick(cooldownTicks, token) {
        if (token !== undefined) {
            if (token === this._cooldownToken) {
                return;
            }
            this._cooldownToken = token;
        }

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
     * Checks whether a file has finished loading, and stores its resource if so.
     *
     * @param {number} fileIndex - The index of the file in the `files` array.
     * @returns {boolean} True if the file is loaded.
     */
    pollFileResource(fileIndex) {
        Debug.assert(fileIndex >= 0 && fileIndex < this.files.length);

        // resource already loaded
        if (this.fileResources.has(fileIndex)) {
            return true;
        }

        // If octree was destroyed, assetLoader is null - nothing is loading
        if (!this.assetLoader) {
            return false;
        }

        // Check if the resource is now available from the asset loader
        const res = this.assetLoader.getResource(this.files[fileIndex].url);
        if (res) {
            this.fileResources.set(fileIndex, res);
            this._updateLoadedBelow(fileIndex, 1);

            // The octree fully re-creates these resources on device loss, so the CPU-side
            // ImageBitmap sources retained on the textures are not needed for re-upload.
            res.releaseTextureSources?.();

            // if the file finished loading and is no longer needed, schedule a cooldown
            if (this.fileRefCounts[fileIndex] === 0) {
                this.cooldowns.set(fileIndex, this.cooldownTicks);
            }

            // trace updated LOD counts after change
            this._traceLodCounts();

            return true;
        }

        return false;
    }

    /**
     * Ensures a file resource is loaded and available. This function:
     * - Starts loading if not already started
     * - Checks if loading completed and stores the resource if available
     *
     * A load it starts or continues keeps whatever priority it was last requested with.
     *
     * @param {number} fileIndex - The index of the file in the `files` array.
     */
    ensureFileResource(fileIndex) {
        if (!this.pollFileResource(fileIndex) && this.assetLoader) {
            // Start/continue loading (asset loader handles duplicates internally)
            this.assetLoader.load(this.files[fileIndex].url);
        }
    }

    /**
     * Replaces the file requests of one instance of this octree - the files it waits for, mapped to
     * their load priority. Nothing is loaded until {@link GSplatOctree#flushRequests}, which lets
     * every instance sharing this octree contribute before the requests are ordered.
     *
     * @param {object} requester - The instance the requests belong to.
     * @param {Map<number, number>} requests - File indices mapped to their load priority, higher
     * loads first. Copied, so the caller may reuse the map.
     */
    submitRequests(requester, requests) {
        let latest = this._requesters.get(requester);
        if (!latest) {
            latest = new Map();
            this._requesters.set(requester, latest);
        }

        // both the files the requester dropped and the ones it keeps are reconsidered
        const changed = this._changedRequests;
        for (const fileIndex of latest.keys()) {
            changed.add(fileIndex);
        }

        latest.clear();
        for (const [fileIndex, priority] of requests) {
            latest.set(fileIndex, priority);
            changed.add(fileIndex);
        }
    }

    /**
     * Removes all file requests of an instance of this octree, when the instance is destroyed. This
     * takes effect straight away, as there may be no later {@link GSplatOctree#flushRequests} to
     * apply it: the files no other instance requests are withdrawn, and the rest are re-issued at
     * the highest priority the remaining instances give them.
     *
     * @param {object} requester - The instance the requests belong to.
     * @param {boolean} unloadNow - When true, a withdrawn download already in progress is unloaded
     * right away instead of after a cooldown.
     */
    removeRequests(requester, unloadNow) {
        const latest = this._requesters.get(requester);
        if (!latest) {
            return;
        }
        this._requesters.delete(requester);

        for (const fileIndex of latest.keys()) {
            if (!this.fileResources.has(fileIndex)) {
                const priority = this._getRequestPriority(fileIndex);
                if (priority === undefined) {
                    this._changedRequests.delete(fileIndex);
                    this._withdrawRequest(fileIndex, unloadNow);
                } else {
                    // still wanted by another instance, which may have given it a lower priority.
                    // This only changes the priority of a queued load.
                    this.assetLoader?.load(this.files[fileIndex].url, priority);
                }
            }
        }
    }

    /**
     * Issues the requests that changed since the last flush to the asset loader, each at the
     * highest priority any instance gives it and highest first, and withdraws the files no
     * instance requests any more.
     *
     * Every instance re-requests each file it still waits for on every LOD update, so a file no
     * instance's latest requests contain is no longer wanted. If it is still queued it is simply
     * dropped, as nothing has been fetched yet. A download already in progress is left to finish -
     * canceling it would waste the transfer if the camera swings back - and if nothing references
     * the file it gets a cooldown, so it is released once the cooldown expires unless it is
     * requested again.
     */
    flushRequests() {
        const changed = this._changedRequests;
        if (changed.size === 0) {
            return;
        }

        const loader = this.assetLoader;
        if (loader) {
            for (const fileIndex of changed) {
                if (!this.fileResources.has(fileIndex)) {
                    const priority = this._getRequestPriority(fileIndex);
                    if (priority === undefined) {
                        this._withdrawRequest(fileIndex, false);
                    } else {
                        _requestOrder.push(fileIndex);
                        _requestPriority.set(fileIndex, priority);
                    }
                }
            }

            // Issue highest priority first. A free download slot goes to the first request that
            // reaches it, the loader only orders the requests it has to queue.
            _requestOrder.sort((a, b) => _requestPriority.get(b) - _requestPriority.get(a));

            for (let i = 0; i < _requestOrder.length; i++) {
                const fileIndex = _requestOrder[i];

                // wanted again, so cancel a cooldown a withdrawn request left behind
                if (this.fileRefCounts[fileIndex] === 0) {
                    this.cooldowns.delete(fileIndex);
                }

                loader.load(this.files[fileIndex].url, _requestPriority.get(fileIndex));
            }
            _requestOrder.length = 0;
            _requestPriority.clear();
        }

        changed.clear();
    }

    /**
     * Returns the highest load priority any instance requests a file with.
     *
     * @param {number} fileIndex - The index of the file in the `files` array.
     * @returns {number|undefined} The priority, or undefined when no instance requests the file.
     * @private
     */
    _getRequestPriority(fileIndex) {
        let best;
        for (const requests of this._requesters.values()) {
            const priority = requests.get(fileIndex);
            if (priority !== undefined && (best === undefined || priority > best)) {
                best = priority;
            }
        }
        return best;
    }

    /**
     * Withdraws the load of a file no instance requests any more. A queued load is dropped. One
     * already in progress is left running, and if nothing references the file it is unloaded -
     * after a cooldown, or right away when asked to.
     *
     * @param {number} fileIndex - The index of the file in the `files` array.
     * @param {boolean} unloadNow - Unload an unreferenced download right away.
     * @private
     */
    _withdrawRequest(fileIndex, unloadNow) {
        const loader = this.assetLoader;
        if (!loader || loader.dequeue(this.files[fileIndex].url)) {
            return;
        }

        if (this.fileRefCounts[fileIndex] === 0) {
            if (unloadNow) {
                this.unloadResource(fileIndex);
            } else if (!this.cooldowns.has(fileIndex)) {
                this.cooldowns.set(fileIndex, this.cooldownTicks);
            }
        }
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
