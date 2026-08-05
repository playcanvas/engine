import { Debug } from '../../core/debug.js';

/**
 * @import { BlockAllocator, MemBlock } from '../../core/block-allocator.js'
 * @import { GSplatInfo } from './gsplat-info.js'
 * @import { GSplatOctree } from './gsplat-octree.js'
 */

const _newAllocIds = new Set();
const _toAllocateIds = [];
const _toAllocate = [];
const _toFree = [];

class GSplatWorldState {
    /**
     * The version of the world state.
     */
    version = 0;

    /**
     * Whether the sort parameters have been set on the sorter.
     */
    sortParametersSet = false;

    /**
     * Whether the world state has been sorted before.
     */
    sortedBefore = false;

    /**
     * An array of all splats managed by this world state.
     *
     * @type {GSplatInfo[]}
     */
    splats = [];

    /**
     * The texture size of work buffer.
     */
    textureSize = 0;

    /**
     * Total number of active splats across all placements.
     */
    totalActiveSplats = 0;

    /**
     * Total number of intervals across all placements. Each placement contributes
     * either its interval count (intervals.length / 2) or 1 if it has no intervals.
     */
    totalIntervals = 0;

    /**
     * Deduplicated list of splat groups sharing the same parent placement. Multiple child
     * placements (e.g. octree file nodes) that reference the same parent share a single
     * set of bounding spheres and a single world transform, so they are grouped together.
     * Each entry contains a representative splat, the starting index into the bounds/transforms
     * textures (boundsBaseIndex), and the number of bounding sphere entries for the group.
     *
     * @type {Array<{splat: GSplatInfo, boundsBaseIndex: number, numBoundsEntries: number}>}
     */
    boundsGroups = [];

    /**
     * Files to decrement when this state becomes active.
     * Array of tuples: [octree, fileIndex]
     *
     * @type {Array<[GSplatOctree, number]>}
     */
    pendingReleases = [];

    /**
     * Splats that need to be rendered to the work buffer. Contains newly allocated or
     * re-allocated splats, or all splats when fullRebuild is true.
     *
     * @type {GSplatInfo[]}
     */
    needsUpload = [];

    /**
     * AllocIds of splats in needsUpload, for fast membership checks during merge.
     *
     * @type {Set<number>}
     */
    needsUploadIds = new Set();

    /**
     * Reverse map from allocId to the GSplatInfo that owns it, for efficient merge lookups
     * in cleanupOldWorldStates without scanning all splats.
     *
     * @type {Map<number, GSplatInfo>}
     */
    allocIdToSplat = new Map();

    /**
     * True when the allocator grew or defragmented, meaning all block offsets may have
     * changed and every splat must be re-rendered to the work buffer.
     */
    fullRebuild = false;


    /**
     * @param {import('../../platform/graphics/graphics-device.js').GraphicsDevice} device - The graphics device.
     * @param {number} version - The version number.
     * @param {GSplatInfo[]} splats - The splats for this world state.
     * @param {BlockAllocator} allocator - Persistent block allocator (owned by GSplatManager).
     * @param {Map<number, MemBlock>} allocationMap - Persistent allocId-to-MemBlock map (owned by GSplatManager).
     */
    constructor(device, version, splats, allocator, allocationMap) {
        this.version = version;
        this.splats = splats;

        if (splats.length === 0) {
            // Free all remaining allocations
            for (const [, block] of allocationMap) {
                allocator.free(block);
            }
            allocationMap.clear();
            this.totalActiveSplats = 0;
            this.totalIntervals = 0;
            this.textureSize = 1;
            return;
        }

        this.computeAllocationDiff(splats, allocationMap);
        const { fullRebuild, changedAllocIds } = this.applyAllocations(device, allocator, allocationMap);
        this.assignSplatOffsets(splats, allocationMap, fullRebuild, changedAllocIds);
        this.buildBoundsGroups(splats);
    }

    destroy() {
        this.splats.forEach(splat => splat.destroy());
        this.splats.length = 0;
        this.needsUpload.length = 0;
        this.needsUploadIds.clear();
        this.allocIdToSplat.clear();
        this.boundsGroups.length = 0;
    }

    /**
     * Populates module-scope scratch arrays with allocations to free/create by diffing the
     * current splat set against the existing allocation map.
     *
     * @param {GSplatInfo[]} splats - Active splats for this state.
     * @param {Map<number, MemBlock>} allocationMap - Persistent allocId-to-MemBlock map.
     * @private
     */
    computeAllocationDiff(splats, allocationMap) {
        for (let i = 0; i < splats.length; i++) {
            const splat = splats[i];
            const allocIds = splat.intervalAllocIds;
            const intervals = splat.intervals;
            const numIntervals = intervals.length / 2;

            if (numIntervals > 0 && allocIds.length === numIntervals) {
                for (let j = 0; j < numIntervals; j++) {
                    this._diffAlloc(allocIds[j], intervals[j * 2 + 1] - intervals[j * 2], allocationMap);
                }
            } else {
                this._diffAlloc(splat.allocId, splat.activeSplats, allocationMap);
            }
        }

        // Free allocations no longer present in the new state.
        // Deletion during Map iteration is safe per the JS spec — deleted entries
        // that have not yet been visited are skipped.
        for (const [allocId, block] of allocationMap) {
            if (!_newAllocIds.has(allocId)) {
                _toFree.push(block);
                allocationMap.delete(allocId);
            }
        }
    }

    /**
     * Process a single allocId/size pair: mark as seen, check for size changes, and
     * queue allocations or frees as needed.
     *
     * @param {number} allocId - The allocation identifier.
     * @param {number} size - Required size for this allocation.
     * @param {Map<number, MemBlock>} allocationMap - Persistent allocId-to-MemBlock map.
     * @private
     */
    _diffAlloc(allocId, size, allocationMap) {
        _newAllocIds.add(allocId);

        const existing = allocationMap.get(allocId);
        if (existing) {
            if (existing.size !== size) {
                _toFree.push(existing);
                allocationMap.delete(allocId);
                if (size > 0) {
                    _toAllocateIds.push(allocId);
                    _toAllocate.push(size);
                }
            }
        } else if (size > 0) {
            _toAllocateIds.push(allocId);
            _toAllocate.push(size);
        }
    }

    /**
     * Executes pending allocation changes via the BlockAllocator, runs incremental defrag,
     * derives the texture size, and releases scratch arrays.
     *
     * @param {import('../../platform/graphics/graphics-device.js').GraphicsDevice} device - The graphics device.
     * @param {BlockAllocator} allocator - The block allocator.
     * @param {Map<number, MemBlock>} allocationMap - Persistent allocId-to-MemBlock map.
     * @returns {{ fullRebuild: boolean, changedAllocIds: Set<number>|null }} Whether a full
     * rebuild was triggered and the set of changed allocation ids.
     * @private
     */
    applyAllocations(device, allocator, allocationMap) {
        let fullRebuild = false;
        if (_toFree.length > 0 || _toAllocate.length > 0) {
            fullRebuild = allocator.updateAllocation(_toFree, _toAllocate);
            for (let i = 0; i < _toAllocateIds.length; i++) {
                allocationMap.set(_toAllocateIds[i], /** @type {MemBlock} */ (/** @type {unknown} */ (_toAllocate[i])));
            }
        }
        this.fullRebuild = fullRebuild;

        // Proactive incremental defrag to avoid future full defrag.
        // Scale moves to match the allocation churn so defrag keeps pace.
        const churn = _toFree.length + _toAllocateIds.length;
        const incrementalDefragMoves = Math.max(50, churn);
        if (!fullRebuild && allocator.fragmentation > 0.3) {
            const moved = allocator.defrag(incrementalDefragMoves);
            if (moved.size > 0) {
                for (const [allocId, block] of allocationMap) {
                    if (moved.has(block)) {
                        _toAllocateIds.push(allocId);
                    }
                }
            }
        }

        // Derive texture size from allocator capacity (square texture)
        const cap = allocator.capacity;
        this.textureSize = cap > 0 ? Math.ceil(Math.sqrt(cap)) : 1;
        Debug.assert(this.textureSize <= device.maxTextureSize,
            `GSplatWorldState: required texture size ${this.textureSize} exceeds device limit ${device.maxTextureSize}`);

        const changedAllocIds = _toAllocateIds.length > 0 ? new Set(_toAllocateIds) : null;

        // Release scratch structures for reuse
        _newAllocIds.clear();
        _toAllocateIds.length = 0;
        _toAllocate.length = 0;
        _toFree.length = 0;

        return { fullRebuild, changedAllocIds };
    }

    /**
     * Assigns work-buffer offsets to each splat from allocated blocks and builds the
     * needsUpload list for splats that require re-rendering.
     *
     * @param {GSplatInfo[]} splats - Active splats for this state.
     * @param {Map<number, MemBlock>} allocationMap - Persistent allocId-to-MemBlock map.
     * @param {boolean} fullRebuild - Whether all splats must be re-rendered.
     * @param {Set<number>|null} changedAllocIds - Allocation ids that were newly allocated or moved.
     * @private
     */
    assignSplatOffsets(splats, allocationMap, fullRebuild, changedAllocIds) {
        let totalActiveSplats = 0;
        let totalIntervals = 0;

        for (let i = 0; i < splats.length; i++) {
            const splat = splats[i];
            const allocIds = splat.intervalAllocIds;
            const intervals = splat.intervals;
            const numIntervals = intervals.length / 2;

            totalIntervals += numIntervals > 0 ? numIntervals : 1;

            let splatChanged = fullRebuild;
            const intervalOffsets = [];

            if (numIntervals > 0 && allocIds.length === numIntervals) {
                for (let j = 0; j < numIntervals; j++) {
                    this.allocIdToSplat.set(allocIds[j], splat);
                    const block = allocationMap.get(allocIds[j]);
                    if (block) {
                        intervalOffsets.push(block.offset);
                        totalActiveSplats += intervals[j * 2 + 1] - intervals[j * 2];
                        if (changedAllocIds && changedAllocIds.has(allocIds[j])) {
                            splatChanged = true;
                            this.needsUploadIds.add(allocIds[j]);
                        }
                    }
                }
            } else {
                this.allocIdToSplat.set(splat.allocId, splat);
                const block = allocationMap.get(splat.allocId);
                if (block) {
                    intervalOffsets.push(block.offset);
                    totalActiveSplats += splat.activeSplats;
                    if (changedAllocIds && changedAllocIds.has(splat.allocId)) {
                        splatChanged = true;
                        this.needsUploadIds.add(splat.allocId);
                    }
                }
            }

            if (intervalOffsets.length > 0) {
                splat.setLayout(intervalOffsets);

                if (splatChanged) {
                    this.needsUpload.push(splat);
                    if (fullRebuild) {
                        for (let j = 0; j < allocIds.length; j++) {
                            this.needsUploadIds.add(allocIds[j]);
                        }
                    }
                }
            }
        }

        this.totalActiveSplats = totalActiveSplats;
        this.totalIntervals = totalIntervals;
    }

    /**
     * Builds boundsGroups by grouping splats that share a parentPlacementId, assigns
     * sequential boundsBaseIndex to each group, and propagates it back to splats.
     *
     * @param {GSplatInfo[]} splats - Active splats for this state.
     * @private
     */
    buildBoundsGroups(splats) {
        const groupMap = new Map();
        for (let i = 0; i < splats.length; i++) {
            const splat = splats[i];
            const key = splat.parentPlacementId;
            if (!groupMap.has(key)) {
                groupMap.set(key, {
                    splat: splat,
                    boundsBaseIndex: 0,
                    numBoundsEntries: splat.numBoundsEntries
                });
            }
        }

        let boundsIndex = 0;
        for (const group of groupMap.values()) {
            group.boundsBaseIndex = boundsIndex;
            boundsIndex += group.numBoundsEntries;
            this.boundsGroups.push(group);
        }

        for (let i = 0; i < splats.length; i++) {
            const group = groupMap.get(splats[i].parentPlacementId);
            splats[i].boundsBaseIndex = group.boundsBaseIndex;
        }
    }
}

export { GSplatWorldState };
