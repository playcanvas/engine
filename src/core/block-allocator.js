import { Debug } from './debug.js';

/**
 * A node in the {@link BlockAllocator}'s linked list, representing either an allocated block or a
 * free region. Callers receive MemBlock instances as handles from {@link BlockAllocator#allocate}
 * and must not modify any properties directly.
 *
 * @ignore
 */
class MemBlock {
    /**
     * Position in the address space.
     *
     * @private
     */
    _offset = 0;

    /**
     * Size of this block.
     *
     * @private
     */
    _size = 0;

    /**
     * True if this is a free region, false if allocated.
     *
     * @private
     */
    _free = true;

    /**
     * Previous node in the main (all-nodes) list.
     *
     * @type {MemBlock|null}
     * @private
     */
    _prev = null;

    /**
     * Next node in the main (all-nodes) list.
     *
     * @type {MemBlock|null}
     * @private
     */
    _next = null;

    /**
     * Previous node in the bucket free-list.
     *
     * @type {MemBlock|null}
     * @private
     */
    _prevFree = null;

    /**
     * Next node in the bucket free-list.
     *
     * @type {MemBlock|null}
     * @private
     */
    _nextFree = null;

    /**
     * Index of the size bucket this free block belongs to, or -1 if not in any bucket.
     *
     * @private
     */
    _bucket = -1;

    /**
     * The offset of this block in the address space.
     *
     * @type {number}
     */
    get offset() {
        return this._offset;
    }

    /**
     * The size of this block.
     *
     * @type {number}
     */
    get size() {
        return this._size;
    }
}

/**
 * A general-purpose 1D block allocator backed by a doubly-linked list with segregated free-list
 * buckets. Manages a linear address space where contiguous blocks can be allocated and freed.
 * Supports incremental defragmentation and automatic growth.
 *
 * Free blocks are organized into power-of-2 size buckets for best-fit allocation, which reduces
 * fragmentation compared to a single first-fit free list.
 *
 * @ignore
 */
class BlockAllocator {
    /**
     * Head of the main list (all blocks, offset-ordered).
     *
     * @type {MemBlock|null}
     * @private
     */
    _headAll = null;

    /**
     * Tail of the main list.
     *
     * @type {MemBlock|null}
     * @private
     */
    _tailAll = null;

    /**
     * Segregated free-list bucket heads. Each entry is the head of a doubly-linked list of free
     * blocks whose size falls in that power-of-2 range. Bucket i covers sizes [2^i, 2^(i+1)).
     * The array grows dynamically as larger free blocks appear.
     *
     * @type {Array<MemBlock|null>}
     * @private
     */
    _freeBucketHeads = [];

    /**
     * Pool of recycled MemBlock objects.
     *
     * @type {MemBlock[]}
     * @private
     */
    _pool = [];

    /**
     * Total address space.
     *
     * @private
     */
    _capacity = 0;

    /**
     * Sum of all allocated block sizes.
     *
     * @private
     */
    _usedSize = 0;

    /**
     * Sum of all free region sizes.
     *
     * @private
     */
    _freeSize = 0;

    /**
     * Number of free regions. Maintained O(1) for the fragmentation metric.
     *
     * @private
     */
    _freeRegionCount = 0;

    /**
     * Multiplicative growth factor used by {@link updateAllocation}. When growing, the new
     * capacity is at least `capacity * growMultiplier`.
     *
     * @type {number}
     * @private
     */
    _growMultiplier;

    /**
     * Create a new BlockAllocator.
     *
     * @param {number} [capacity] - Initial address space capacity. Defaults to 0.
     * @param {number} [growMultiplier] - Multiplicative growth factor for auto-grow in
     * {@link updateAllocation}. Defaults to 1.1 (10% extra).
     */
    constructor(capacity = 0, growMultiplier = 1.1) {
        this._growMultiplier = growMultiplier;
        if (capacity > 0) {
            this._capacity = capacity;
            this._freeSize = capacity;
            const block = this._obtain(0, capacity, true);
            this._headAll = block;
            this._tailAll = block;
            this._addToBucket(block);
        }
    }

    /**
     * Total address space capacity.
     *
     * @type {number}
     */
    get capacity() {
        return this._capacity;
    }

    /**
     * Total size of all allocated blocks.
     *
     * @type {number}
     */
    get usedSize() {
        return this._usedSize;
    }

    /**
     * Total size of all free regions.
     *
     * @type {number}
     */
    get freeSize() {
        return this._freeSize;
    }

    /**
     * Fragmentation ratio in the range [0, 1]. Returns 0 when all free space is one contiguous
     * block (ideal), and approaches 1 when free space is split into many pieces. Computed O(1)
     * from the internally maintained free region count.
     *
     * @type {number}
     */
    get fragmentation() {
        return this._freeSize > 0 ? 1 - 1 / this._freeRegionCount : 0;
    }

    /**
     * Compute the bucket index for a given block size. Uses floor(log2(size)) via the CLZ
     * intrinsic for integer math.
     *
     * @param {number} size - Block size (must be > 0).
     * @returns {number} Bucket index.
     * @private
     */
    _bucketFor(size) {
        return 31 - Math.clz32(size);
    }

    /**
     * Add a free block to the appropriate size bucket. Prepends to the bucket list for O(1)
     * insertion. Grows the bucket array if needed.
     *
     * @param {MemBlock} block - The free block to add.
     * @private
     */
    _addToBucket(block) {
        const b = this._bucketFor(block._size);
        block._bucket = b;
        while (b >= this._freeBucketHeads.length) {
            this._freeBucketHeads.push(null);
        }
        block._prevFree = null;
        block._nextFree = this._freeBucketHeads[b];
        if (this._freeBucketHeads[b]) this._freeBucketHeads[b]._prevFree = block;
        this._freeBucketHeads[b] = block;
        this._freeRegionCount++;
    }

    /**
     * Remove a free block from its current size bucket.
     *
     * @param {MemBlock} block - The free block to remove.
     * @private
     */
    _removeFromBucket(block) {
        const b = block._bucket;
        if (block._prevFree) block._prevFree._nextFree = block._nextFree;
        else this._freeBucketHeads[b] = block._nextFree;
        if (block._nextFree) block._nextFree._prevFree = block._prevFree;
        block._prevFree = null;
        block._nextFree = null;
        block._bucket = -1;
        this._freeRegionCount--;
    }

    /**
     * Move a free block to the correct bucket after its size changed (e.g. due to merging or
     * splitting). Only performs the remove+add if the bucket actually changed.
     *
     * @param {MemBlock} block - The free block whose size has changed.
     * @private
     */
    _rebucket(block) {
        const newBucket = this._bucketFor(block._size);
        if (newBucket !== block._bucket) {
            this._removeFromBucket(block);
            this._addToBucket(block);
        }
    }

    /**
     * Obtain a MemBlock from the pool or create a new one.
     *
     * @param {number} offset - The offset.
     * @param {number} size - The size.
     * @param {boolean} free - Whether the block is free.
     * @returns {MemBlock} The block.
     * @private
     */
    _obtain(offset, size, free) {
        let block;
        if (this._pool.length > 0) {
            block = /** @type {MemBlock} */ (this._pool.pop());
        } else {
            block = new MemBlock();
        }
        block._offset = offset;
        block._size = size;
        block._free = free;
        block._prev = null;
        block._next = null;
        block._prevFree = null;
        block._nextFree = null;
        block._bucket = -1;
        return block;
    }

    /**
     * Return a MemBlock to the pool.
     *
     * @param {MemBlock} block - The block to release.
     * @private
     */
    _release(block) {
        block._prev = null;
        block._next = null;
        block._prevFree = null;
        block._nextFree = null;
        block._bucket = -1;
        this._pool.push(block);
    }

    /**
     * Insert a block into the main list after a given node.
     *
     * @param {MemBlock} block - The block to insert.
     * @param {MemBlock|null} after - Insert after this node (null = insert at head).
     * @private
     */
    _insertAfterInMainList(block, after) {
        if (after === null) {
            block._prev = null;
            block._next = this._headAll;
            if (this._headAll) this._headAll._prev = block;
            this._headAll = block;
            if (!this._tailAll) this._tailAll = block;
        } else {
            block._prev = after;
            block._next = after._next;
            if (after._next) after._next._prev = block;
            after._next = block;
            if (this._tailAll === after) this._tailAll = block;
        }
    }

    /**
     * Remove a block from the main list.
     *
     * @param {MemBlock} block - The block to remove.
     * @private
     */
    _removeFromMainList(block) {
        if (block._prev) block._prev._next = block._next;
        else this._headAll = block._next;
        if (block._next) block._next._prev = block._prev;
        else this._tailAll = block._prev;
        block._prev = null;
        block._next = null;
    }

    /**
     * Find the best-fit free block for the requested size using segregated buckets. Scans the
     * target bucket for the smallest block >= size (best-fit), then falls through to higher
     * buckets where any block is guaranteed large enough (first-fit).
     *
     * @param {number} size - Minimum size needed.
     * @returns {MemBlock|null} The best fitting free block, or null.
     * @private
     */
    _findFreeBlock(size) {
        const startBucket = this._bucketFor(size);
        const len = this._freeBucketHeads.length;

        // Target bucket: best-fit (smallest block >= size)
        if (startBucket < len) {
            let best = null;
            let node = this._freeBucketHeads[startBucket];
            while (node) {
                if (node._size >= size) {
                    if (!best || node._size < best._size) {
                        best = node;
                        if (node._size === size) break;
                    }
                }
                node = node._nextFree;
            }
            if (best) return best;
        }

        // Higher buckets: first-fit (any block is large enough)
        for (let b = startBucket + 1; b < len; b++) {
            if (this._freeBucketHeads[b]) {
                return this._freeBucketHeads[b];
            }
        }
        return null;
    }

    /**
     * Allocate a contiguous block of the given size.
     *
     * @param {number} size - The number of units to allocate. Must be > 0.
     * @returns {MemBlock|null} A MemBlock handle, or null if no space is available.
     */
    allocate(size) {
        Debug.assert(size > 0, 'BlockAllocator.allocate: size must be > 0');

        const gap = this._findFreeBlock(size);
        if (!gap) return null;

        this._usedSize += size;
        this._freeSize -= size;

        if (gap._size === size) {
            // Perfect fit: convert free block to allocated
            gap._free = false;
            this._removeFromBucket(gap);
            return gap;
        }

        // Split: create allocated block at start of gap, shrink gap
        const alloc = this._obtain(gap._offset, size, false);
        gap._offset += size;
        gap._size -= size;
        this._rebucket(gap);
        this._insertAfterInMainList(alloc, gap._prev);
        return alloc;
    }

    /**
     * Free a previously allocated block. Adjacent free regions are merged automatically.
     *
     * @param {MemBlock} block - The block to free (must have been returned by {@link allocate}).
     */
    free(block) {
        Debug.assert(block && !block._free, 'BlockAllocator.free: block is null or already free');

        block._free = true;
        this._usedSize -= block._size;
        this._freeSize += block._size;

        const prev = block._prev;
        const next = block._next;
        const prevFree = prev && prev._free;
        const nextFree = next && next._free;

        if (prevFree && nextFree) {
            // Both neighbors free: merge all three into prev
            prev._size += block._size + next._size;
            this._removeFromMainList(block);
            this._removeFromMainList(next);
            this._removeFromBucket(next);
            this._release(block);
            this._release(next);
            this._rebucket(prev);
        } else if (prevFree) {
            // Left neighbor free: merge into prev
            prev._size += block._size;
            this._removeFromMainList(block);
            this._release(block);
            this._rebucket(prev);
        } else if (nextFree) {
            // Right neighbor free: absorb right into block
            block._size += next._size;
            this._removeFromMainList(next);
            this._removeFromBucket(next);
            this._release(next);
            this._addToBucket(block);
        } else {
            // Neither neighbor free: insert into bucket
            this._addToBucket(block);
        }
    }

    /**
     * Grow the address space. Only increases capacity, never decreases.
     *
     * @param {number} newCapacity - The new capacity. Must be > current capacity.
     */
    grow(newCapacity) {
        if (newCapacity <= this._capacity) return;

        const added = newCapacity - this._capacity;
        this._capacity = newCapacity;
        this._freeSize += added;

        if (this._tailAll && this._tailAll._free) {
            // Extend existing tail free block
            this._tailAll._size += added;
            this._rebucket(this._tailAll);
        } else {
            // Append new free block
            const block = this._obtain(this._capacity - added, added, true);
            this._insertAfterInMainList(block, this._tailAll);
            this._addToBucket(block);
        }
    }

    /**
     * Defragment the allocator by moving allocated blocks to reduce fragmentation.
     *
     * When maxMoves is 0, performs a full compaction in a single O(n) pass: all allocated blocks
     * are packed contiguously from offset 0 and a single free block is placed at the end.
     *
     * When maxMoves > 0, performs incremental defragmentation in two phases:
     * - Phase 1 (up to maxMoves/2): relocates the last allocated block to the first fitting free
     *   gap (maximizes tail free space).
     * - Phase 2 (up to maxMoves/2): slides allocated blocks left into adjacent free gaps
     *   (cleans up interior fragmentation).
     *
     * @param {number} [maxMoves] - Maximum number of block moves. 0 = full compaction. Defaults
     * to 0.
     * @param {Set<MemBlock>} [result] - Optional Set to receive moved blocks. Defaults to a new
     * Set.
     * @returns {Set<MemBlock>} The set of MemBlocks that were moved.
     */
    defrag(maxMoves = 0, result = new Set()) {
        result.clear();

        if (this._freeRegionCount === 0) return result;

        if (maxMoves === 0) {
            this._defragFull(result);
        } else {
            this._defragIncremental(maxMoves, result);
        }

        return result;
    }

    /**
     * Full compaction: single-pass, pack all allocated blocks from offset 0.
     *
     * @param {Set<MemBlock>} result - Set to receive moved blocks.
     * @private
     */
    _defragFull(result) {
        // Remove all free blocks from all buckets and pool them
        for (let b = 0; b < this._freeBucketHeads.length; b++) {
            let node = this._freeBucketHeads[b];
            while (node) {
                const nextFree = node._nextFree;
                this._removeFromMainList(node);
                node._prevFree = null;
                node._nextFree = null;
                node._bucket = -1;
                this._pool.push(node);
                node = nextFree;
            }
            this._freeBucketHeads[b] = null;
        }
        this._freeRegionCount = 0;

        // Walk remaining (all allocated) blocks, assign sequential offsets
        let offset = 0;
        let block = this._headAll;
        while (block) {
            if (block._offset !== offset) {
                block._offset = offset;
                result.add(block);
            }
            offset += block._size;
            block = block._next;
        }

        // Create single free block at end if there is remaining capacity
        const remaining = this._capacity - offset;
        if (remaining > 0) {
            const freeBlock = this._obtain(offset, remaining, true);
            this._insertAfterInMainList(freeBlock, this._tailAll);
            this._addToBucket(freeBlock);
        }
    }

    /**
     * Incremental defragmentation with two phases.
     *
     * @param {number} maxMoves - Maximum total moves.
     * @param {Set<MemBlock>} result - Set to receive moved blocks.
     * @private
     */
    _defragIncremental(maxMoves, result) {
        const phase1Moves = Math.ceil(maxMoves / 2);
        const phase2Moves = maxMoves - phase1Moves;

        // Phase 1: relocate last allocated block to first fitting gap
        for (let i = 0; i < phase1Moves; i++) {
            // Find last allocated block
            let lastAlloc = this._tailAll;
            while (lastAlloc && lastAlloc._free) lastAlloc = lastAlloc._prev;
            if (!lastAlloc) break;

            // Find first gap that fits and is at a lower offset
            const gap = this._findFreeBlock(lastAlloc._size);
            if (!gap || gap._offset >= lastAlloc._offset) break;

            this._moveBlock(lastAlloc, gap);
            result.add(lastAlloc);
        }

        // Phase 2: slide blocks left into adjacent free gaps
        let block = this._headAll;
        for (let i = 0; i < phase2Moves && block;) {
            const next = block._next;

            if (block._free && next && !next._free) {
                // Swap: slide next (allocated) left into block (free)
                const allocBlock = next;
                const freeBlock = block;

                allocBlock._offset = freeBlock._offset;
                freeBlock._offset = allocBlock._offset + allocBlock._size;

                // Swap in main list
                const a = freeBlock._prev;
                const b = allocBlock._next;

                allocBlock._prev = a;
                allocBlock._next = freeBlock;
                freeBlock._prev = allocBlock;
                freeBlock._next = b;
                if (a) a._next = allocBlock;
                else this._headAll = allocBlock;
                if (b) b._prev = freeBlock;
                else this._tailAll = freeBlock;

                // Merge free block with its new right neighbor if also free
                if (freeBlock._next && freeBlock._next._free) {
                    const right = freeBlock._next;
                    freeBlock._size += right._size;
                    this._removeFromMainList(right);
                    this._removeFromBucket(right);
                    this._release(right);
                    this._rebucket(freeBlock);
                }

                result.add(allocBlock);
                i++;

                // Continue from the block after freeBlock to find more opportunities
                block = freeBlock._next;
            } else {
                block = next;
            }
        }
    }

    /**
     * Move an allocated block to a free gap. The block's offset is updated in-place so caller
     * handles stay valid.
     *
     * @param {MemBlock} block - The allocated block to move.
     * @param {MemBlock} gap - The free gap to move into (must be >= block size).
     * @private
     */
    _moveBlock(block, gap) {
        Debug.assert(!block._free, '_moveBlock: block must be allocated');
        Debug.assert(gap._free, '_moveBlock: gap must be free');
        Debug.assert(gap._size >= block._size, '_moveBlock: gap too small');

        const blockSize = block._size;
        const newOffset = gap._offset;

        // 1. Remove block from its current position, freeing that space
        const prev = block._prev;
        this._removeFromMainList(block);

        // Create free region where block was
        const freed = this._obtain(block._offset, blockSize, true);

        // Insert freed region into main list
        this._insertAfterInMainList(freed, prev);
        this._addToBucket(freed);

        // Merge freed with right neighbor
        if (freed._next && freed._next._free) {
            const right = freed._next;
            freed._size += right._size;
            this._removeFromMainList(right);
            this._removeFromBucket(right);
            this._release(right);
            this._rebucket(freed);
        }
        // Merge freed with left neighbor
        if (freed._prev && freed._prev._free) {
            const left = freed._prev;
            left._size += freed._size;
            this._removeFromMainList(freed);
            this._removeFromBucket(freed);
            this._release(freed);
            this._rebucket(left);
        }

        // 2. Place block at gap
        block._offset = newOffset;

        if (gap._size === blockSize) {
            // Perfect fit: replace gap with block
            const gapPrev = gap._prev;
            this._removeFromMainList(gap);
            this._removeFromBucket(gap);
            this._release(gap);
            this._insertAfterInMainList(block, gapPrev);
        } else {
            // Partial fit: shrink gap, insert block before it
            gap._offset += blockSize;
            gap._size -= blockSize;
            this._rebucket(gap);
            this._insertAfterInMainList(block, gap._prev);
        }
    }

    /**
     * Batch update: free a set of blocks and allocate new ones. Handles growth and compaction
     * internally when allocations cannot be satisfied.
     *
     * The `toAllocate` array is modified in-place: each numeric size entry is replaced with the
     * allocated {@link MemBlock}.
     *
     * @param {MemBlock[]} toFree - Blocks to release.
     * @param {Array<number|MemBlock>} toAllocate - Sizes to allocate. Modified in-place: numbers
     * are replaced with MemBlock instances.
     * @returns {boolean} True if a full defrag was performed (all existing blocks have new
     * offsets and must be re-rendered), false if only incremental allocations were made.
     */
    updateAllocation(toFree, toAllocate) {
        // Phase 1: free old blocks
        for (let i = 0; i < toFree.length; i++) {
            this.free(toFree[i]);
        }

        // Phase 2: try to allocate all new blocks
        for (let i = 0; i < toAllocate.length; i++) {
            const size = /** @type {number} */ (toAllocate[i]);
            const block = this.allocate(size);
            if (block) {
                toAllocate[i] = block;
            } else {
                // Allocation failed at index i
                // toAllocate[0..i-1] are MemBlocks (survive defrag)
                // toAllocate[i..n-1] are still numbers

                // Compute total remaining space needed
                let totalRemaining = size;
                for (let j = i + 1; j < toAllocate.length; j++) {
                    totalRemaining += /** @type {number} */ (toAllocate[j]);
                }

                // Grow if needed, or if free space would be below headroom threshold
                const neededCapacity = this._usedSize + totalRemaining;
                const headroomCapacity = Math.ceil(neededCapacity * this._growMultiplier);
                if (headroomCapacity > this._capacity) {
                    this.grow(headroomCapacity);
                }

                // Full defrag: compact everything
                this.defrag(0);

                // Allocate remaining (guaranteed to succeed)
                for (let j = i; j < toAllocate.length; j++) {
                    const s = /** @type {number} */ (toAllocate[j]);
                    const b = this.allocate(s);
                    Debug.assert(b, 'BlockAllocator.updateAllocation: allocation failed after defrag');
                    toAllocate[j] = b;
                }

                return true;
            }
        }

        return false;
    }
}

export { BlockAllocator, MemBlock };
