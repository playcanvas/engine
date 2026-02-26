import { expect } from 'chai';

import { BlockAllocator, MemBlock } from '../../src/core/block-allocator.js';

/**
 * Deterministic PRNG (mulberry32) seeded with a fixed value for reproducible stress tests.
 *
 * @param {number} seed - The seed value.
 * @returns {Function} A function that returns a pseudo-random number in [0, 1).
 */
function mulberry32(seed) {
    return function () {
        seed |= 0;
        seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

/**
 * Verify invariants of the allocator's internal state:
 * - Main list forms a valid doubly-linked list covering the full capacity.
 * - Free list exactly matches all free nodes in the main list.
 * - usedSize + freeSize === capacity.
 * - No adjacent free blocks (they should be merged).
 * - freeRegionCount matches the actual number of free blocks.
 *
 * @param {BlockAllocator} alloc - The allocator to verify.
 */
function verifyInvariants(alloc) {
    const cap = alloc.capacity;

    // Walk main list forwards
    let block = alloc._headAll;
    let totalSize = 0;
    let usedSize = 0;
    let freeSize = 0;
    let freeCount = 0;
    let prevBlock = null;
    const mainBlocks = [];
    const freeBlocks = [];

    while (block) {
        expect(block._prev).to.equal(prevBlock, `broken _prev at offset ${block._offset}`);
        expect(block._offset).to.equal(totalSize, `offset mismatch: expected ${totalSize}, got ${block._offset}`);
        expect(block._size).to.be.above(0, 'block size must be > 0');

        if (block._free) {
            freeSize += block._size;
            freeCount++;
            freeBlocks.push(block);
            if (prevBlock) {
                expect(prevBlock._free).to.be.false;
            }
        } else {
            usedSize += block._size;
        }

        totalSize += block._size;
        mainBlocks.push(block);
        prevBlock = block;
        block = block._next;
    }

    expect(alloc._tailAll).to.equal(prevBlock, 'tailAll mismatch');
    expect(totalSize).to.equal(cap, `main list total ${totalSize} !== capacity ${cap}`);
    expect(usedSize).to.equal(alloc.usedSize, 'usedSize mismatch');
    expect(freeSize).to.equal(alloc.freeSize, 'freeSize mismatch');
    expect(usedSize + freeSize).to.equal(cap, 'usedSize + freeSize !== capacity');
    expect(freeCount).to.equal(alloc._freeRegionCount, 'freeRegionCount mismatch');

    // Walk free list forwards and compare to expected free blocks
    const freeListBlocks = [];
    let fNode = alloc._headFree;
    let prevFree = null;
    while (fNode) {
        expect(fNode._free).to.be.true;
        expect(fNode._prevFree).to.equal(prevFree, `broken _prevFree at offset ${fNode._offset}`);
        freeListBlocks.push(fNode);
        prevFree = fNode;
        fNode = fNode._nextFree;
    }
    expect(alloc._tailFree).to.equal(prevFree, 'tailFree mismatch');
    expect(freeListBlocks).to.deep.equal(freeBlocks, 'free list does not match free blocks in main list');
}

/**
 * Write a marker value into the buffer region owned by a block.
 *
 * @param {Uint32Array} buffer - The buffer to write to.
 * @param {MemBlock} block - The block whose region to fill.
 * @param {number} value - The marker value.
 */
function writeBlock(buffer, block, value) {
    for (let i = block.offset; i < block.offset + block.size; i++) {
        buffer[i] = value;
    }
}

/**
 * Verify every element of the buffer at [block.offset .. block.offset+block.size) equals value.
 *
 * @param {Uint32Array} buffer - The buffer to check.
 * @param {MemBlock} block - The block whose region to verify.
 * @param {number} value - The expected value.
 */
function verifyBlock(buffer, block, value) {
    for (let i = block.offset; i < block.offset + block.size; i++) {
        expect(buffer[i]).to.equal(value, `buffer[${i}] expected ${value}, got ${buffer[i]} (block offset=${block.offset} size=${block.size})`);
    }
}

describe('BlockAllocator', function () {

    describe('#constructor', function () {

        it('creates allocator with given capacity', function () {
            const alloc = new BlockAllocator(100);
            expect(alloc.capacity).to.equal(100);
            expect(alloc.usedSize).to.equal(0);
            expect(alloc.freeSize).to.equal(100);
            expect(alloc.fragmentation).to.equal(0);
            verifyInvariants(alloc);
        });

        it('creates allocator with zero capacity', function () {
            const alloc = new BlockAllocator(0);
            expect(alloc.capacity).to.equal(0);
            expect(alloc.usedSize).to.equal(0);
            expect(alloc.freeSize).to.equal(0);
            expect(alloc.fragmentation).to.equal(0);
            verifyInvariants(alloc);
        });

        it('creates allocator with default capacity', function () {
            const alloc = new BlockAllocator();
            expect(alloc.capacity).to.equal(0);
            verifyInvariants(alloc);
        });

    });

    describe('#allocate()', function () {

        it('allocates a block with correct offset and size', function () {
            const alloc = new BlockAllocator(100);
            const block = alloc.allocate(30);
            expect(block).to.be.an.instanceof(MemBlock);
            expect(block.offset).to.equal(0);
            expect(block.size).to.equal(30);
            expect(alloc.usedSize).to.equal(30);
            expect(alloc.freeSize).to.equal(70);
            verifyInvariants(alloc);
        });

        it('allocates multiple blocks sequentially', function () {
            const alloc = new BlockAllocator(100);
            const a = alloc.allocate(10);
            const b = alloc.allocate(20);
            const c = alloc.allocate(30);
            expect(a.offset).to.equal(0);
            expect(b.offset).to.equal(10);
            expect(c.offset).to.equal(30);
            expect(alloc.usedSize).to.equal(60);
            verifyInvariants(alloc);
        });

        it('returns null when no space is available', function () {
            const alloc = new BlockAllocator(50);
            alloc.allocate(50);
            const result = alloc.allocate(1);
            expect(result).to.be.null;
            verifyInvariants(alloc);
        });

        it('returns null when no block fits', function () {
            const alloc = new BlockAllocator(100);
            alloc.allocate(40);
            const mid = alloc.allocate(20);
            alloc.allocate(40);
            alloc.free(mid);
            // 20 units free but we need 30
            const result = alloc.allocate(30);
            expect(result).to.be.null;
            verifyInvariants(alloc);
        });

        it('allocates perfect-fit block', function () {
            const alloc = new BlockAllocator(100);
            const block = alloc.allocate(100);
            expect(block.offset).to.equal(0);
            expect(block.size).to.equal(100);
            expect(alloc.freeSize).to.equal(0);
            expect(alloc.fragmentation).to.equal(0);
            verifyInvariants(alloc);
        });

    });

    describe('#free()', function () {

        it('frees a single block', function () {
            const alloc = new BlockAllocator(100);
            const block = alloc.allocate(40);
            alloc.free(block);
            expect(alloc.usedSize).to.equal(0);
            expect(alloc.freeSize).to.equal(100);
            expect(alloc.fragmentation).to.equal(0);
            verifyInvariants(alloc);
        });

        it('merges with left free neighbor', function () {
            const alloc = new BlockAllocator(100);
            const a = alloc.allocate(30);
            const b = alloc.allocate(30);
            alloc.allocate(40);
            alloc.free(a);
            verifyInvariants(alloc);
            alloc.free(b);
            verifyInvariants(alloc);
            // a and b should merge into one free block
            expect(alloc._freeRegionCount).to.equal(1);
        });

        it('merges with right free neighbor', function () {
            const alloc = new BlockAllocator(100);
            alloc.allocate(30);
            const b = alloc.allocate(30);
            // 40 units free at end
            alloc.free(b);
            verifyInvariants(alloc);
            // b and tail free should merge
            expect(alloc._freeRegionCount).to.equal(1);
        });

        it('merges with both neighbors', function () {
            const alloc = new BlockAllocator(100);
            const a = alloc.allocate(30);
            const b = alloc.allocate(30);
            const c = alloc.allocate(30);
            alloc.free(a);
            alloc.free(c);
            verifyInvariants(alloc);
            expect(alloc._freeRegionCount).to.equal(2);
            alloc.free(b);
            verifyInvariants(alloc);
            // All should merge into one free block covering the whole capacity
            expect(alloc._freeRegionCount).to.equal(1);
            expect(alloc.freeSize).to.equal(100);
        });

        it('creates fragmentation when freeing middle block', function () {
            const alloc = new BlockAllocator(100);
            alloc.allocate(20);
            const b = alloc.allocate(20);
            alloc.allocate(20);
            // 40 free at end + freeing b creates 2 free regions
            alloc.free(b);
            verifyInvariants(alloc);
            expect(alloc.fragmentation).to.equal(0.5);
        });

    });

    describe('#grow()', function () {

        it('extends capacity', function () {
            const alloc = new BlockAllocator(50);
            alloc.grow(100);
            expect(alloc.capacity).to.equal(100);
            expect(alloc.freeSize).to.equal(100);
            verifyInvariants(alloc);
        });

        it('extends existing tail free block', function () {
            const alloc = new BlockAllocator(100);
            alloc.allocate(30);
            alloc.grow(200);
            expect(alloc.capacity).to.equal(200);
            expect(alloc.freeSize).to.equal(170);
            expect(alloc._freeRegionCount).to.equal(1);
            verifyInvariants(alloc);
        });

        it('creates new free block when tail is allocated', function () {
            const alloc = new BlockAllocator(100);
            alloc.allocate(100);
            alloc.grow(200);
            expect(alloc.capacity).to.equal(200);
            expect(alloc.freeSize).to.equal(100);
            expect(alloc._freeRegionCount).to.equal(1);
            verifyInvariants(alloc);
        });

        it('ignores growth to same or smaller capacity', function () {
            const alloc = new BlockAllocator(100);
            alloc.grow(100);
            expect(alloc.capacity).to.equal(100);
            alloc.grow(50);
            expect(alloc.capacity).to.equal(100);
            verifyInvariants(alloc);
        });

        it('grows from zero', function () {
            const alloc = new BlockAllocator(0);
            alloc.grow(50);
            expect(alloc.capacity).to.equal(50);
            expect(alloc.freeSize).to.equal(50);
            verifyInvariants(alloc);
            const block = alloc.allocate(30);
            expect(block.offset).to.equal(0);
            verifyInvariants(alloc);
        });

    });

    describe('#defrag() - full compaction', function () {

        it('compacts fragmented blocks to start', function () {
            const alloc = new BlockAllocator(100);
            const a = alloc.allocate(20);
            const b = alloc.allocate(20);
            const c = alloc.allocate(20);
            alloc.free(b);
            verifyInvariants(alloc);

            const moved = alloc.defrag(0);
            verifyInvariants(alloc);
            expect(a.offset).to.equal(0);
            expect(c.offset).to.equal(20);
            expect(alloc.fragmentation).to.equal(0);
            expect(moved.has(c)).to.be.true;
            expect(moved.has(a)).to.be.false;
        });

        it('handles already-compacted allocator', function () {
            const alloc = new BlockAllocator(100);
            alloc.allocate(30);
            alloc.allocate(40);
            const moved = alloc.defrag(0);
            verifyInvariants(alloc);
            expect(moved.size).to.equal(0);
        });

        it('handles fully allocated allocator', function () {
            const alloc = new BlockAllocator(100);
            alloc.allocate(50);
            alloc.allocate(50);
            const moved = alloc.defrag(0);
            verifyInvariants(alloc);
            expect(moved.size).to.equal(0);
        });

        it('compacts multiple gaps', function () {
            const alloc = new BlockAllocator(100);
            const a = alloc.allocate(10);
            const b = alloc.allocate(10);
            const c = alloc.allocate(10);
            const d = alloc.allocate(10);
            const e = alloc.allocate(10);
            alloc.free(b);
            alloc.free(d);
            verifyInvariants(alloc);

            const moved = alloc.defrag(0);
            verifyInvariants(alloc);
            expect(a.offset).to.equal(0);
            expect(c.offset).to.equal(10);
            expect(e.offset).to.equal(20);
            expect(alloc.freeSize).to.equal(70);
            expect(alloc._freeRegionCount).to.equal(1);
            expect(moved.size).to.be.at.least(1);
        });

    });

    describe('#defrag() - incremental', function () {

        it('moves blocks incrementally', function () {
            const alloc = new BlockAllocator(100);
            alloc.allocate(10);
            const b = alloc.allocate(10);
            alloc.allocate(10);
            alloc.allocate(10);
            alloc.free(b);
            verifyInvariants(alloc);

            const moved = alloc.defrag(4);
            verifyInvariants(alloc);
            expect(moved.size).to.be.at.least(1);
        });

        it('does nothing when no fragmentation', function () {
            const alloc = new BlockAllocator(100);
            alloc.allocate(40);
            alloc.allocate(30);
            const moved = alloc.defrag(4);
            verifyInvariants(alloc);
            expect(moved.size).to.equal(0);
        });

    });

    describe('#updateAllocation()', function () {

        it('frees and allocates in one call', function () {
            const alloc = new BlockAllocator(100);
            const a = alloc.allocate(30);
            alloc.allocate(30);
            const toAlloc = [20, 15];
            const fullRebuild = alloc.updateAllocation([a], toAlloc);
            expect(fullRebuild).to.be.false;
            expect(toAlloc[0]).to.be.an.instanceof(MemBlock);
            expect(toAlloc[1]).to.be.an.instanceof(MemBlock);
            expect(alloc.usedSize).to.equal(30 + 20 + 15);
            verifyInvariants(alloc);
        });

        it('triggers grow and defrag when space runs out', function () {
            const alloc = new BlockAllocator(50, 50);
            const a = alloc.allocate(25);
            alloc.allocate(25);
            // Full, now try to allocate more
            const toAlloc = [30, 20];
            const fullRebuild = alloc.updateAllocation([a], toAlloc);
            expect(fullRebuild).to.be.true;
            expect(toAlloc[0]).to.be.an.instanceof(MemBlock);
            expect(toAlloc[1]).to.be.an.instanceof(MemBlock);
            expect(alloc.usedSize).to.equal(25 + 30 + 20);
            verifyInvariants(alloc);
        });

        it('handles empty frees and allocates', function () {
            const alloc = new BlockAllocator(100);
            alloc.allocate(50);
            const fullRebuild = alloc.updateAllocation([], []);
            expect(fullRebuild).to.be.false;
            verifyInvariants(alloc);
        });

        it('handles only frees', function () {
            const alloc = new BlockAllocator(100);
            const a = alloc.allocate(50);
            const fullRebuild = alloc.updateAllocation([a], []);
            expect(fullRebuild).to.be.false;
            expect(alloc.usedSize).to.equal(0);
            verifyInvariants(alloc);
        });

    });

    describe('#fragmentation', function () {

        it('returns 0 for no free space', function () {
            const alloc = new BlockAllocator(100);
            alloc.allocate(100);
            expect(alloc.fragmentation).to.equal(0);
        });

        it('returns 0 for single free region', function () {
            const alloc = new BlockAllocator(100);
            alloc.allocate(50);
            expect(alloc.fragmentation).to.equal(0);
        });

        it('returns 0.5 for two free regions', function () {
            const alloc = new BlockAllocator(100);
            alloc.allocate(20);
            const b = alloc.allocate(20);
            alloc.allocate(20);
            alloc.free(b);
            expect(alloc.fragmentation).to.equal(0.5);
        });

    });

    describe('pool reuse', function () {

        it('reuses MemBlock instances from pool', function () {
            const alloc = new BlockAllocator(100);
            const a = alloc.allocate(30);
            const b = alloc.allocate(30);
            alloc.free(a);
            alloc.free(b);
            // Pool should contain recycled blocks
            expect(alloc._pool.length).to.be.above(0);
            const c = alloc.allocate(30);
            expect(c).to.be.an.instanceof(MemBlock);
            verifyInvariants(alloc);
        });

    });

    describe('stress test with buffer validation', function () {

        it('maintains buffer integrity through allocations, frees, and defrags', function () {
            const random = mulberry32(12345);
            const CAPACITY = 10000;
            const alloc = new BlockAllocator(CAPACITY);
            const buffer = new Uint32Array(CAPACITY);
            buffer.fill(0);

            const blocks = [];
            let nextId = 1;

            // Allocate many small blocks
            for (let i = 0; i < 200; i++) {
                const size = 10 + Math.floor(random() * 40);
                const block = alloc.allocate(size);
                if (block) {
                    const id = nextId++;
                    writeBlock(buffer, block, id);
                    blocks.push({ block, id });
                }
            }
            verifyInvariants(alloc);

            // Verify all blocks
            for (const { block, id } of blocks) {
                verifyBlock(buffer, block, id);
            }

            // Free every other block
            const surviving = [];
            for (let i = 0; i < blocks.length; i++) {
                if (i % 2 === 0) {
                    alloc.free(blocks[i].block);
                } else {
                    surviving.push(blocks[i]);
                }
            }
            verifyInvariants(alloc);

            // Verify surviving blocks still intact
            for (const { block, id } of surviving) {
                verifyBlock(buffer, block, id);
            }

            // Allocate more into the gaps
            for (let i = 0; i < 100; i++) {
                const size = 5 + Math.floor(random() * 20);
                const block = alloc.allocate(size);
                if (block) {
                    const id = nextId++;
                    writeBlock(buffer, block, id);
                    surviving.push({ block, id });
                }
            }
            verifyInvariants(alloc);

            // Verify all active blocks
            for (const { block, id } of surviving) {
                verifyBlock(buffer, block, id);
            }

            // Full defrag: must update buffer positions
            alloc.defrag(0);
            verifyInvariants(alloc);

            // Rebuild the buffer based on moved blocks: simulate the caller moving data
            // Sort by offset to relocate correctly (compact buffer)
            const allBlocks = surviving.slice();
            allBlocks.sort((a, b) => a.block.offset - b.block.offset);

            // After full defrag, all blocks are packed from 0 — just rewrite the buffer
            const newBuffer = new Uint32Array(alloc.capacity);
            for (const { block, id } of allBlocks) {
                for (let i = block.offset; i < block.offset + block.size; i++) {
                    newBuffer[i] = id;
                }
            }

            // Verify
            for (const { block, id } of allBlocks) {
                for (let i = block.offset; i < block.offset + block.size; i++) {
                    expect(newBuffer[i]).to.equal(id);
                }
            }
        });

        it('handles many allocations and frees without corruption', function () {
            const random = mulberry32(67890);
            const alloc = new BlockAllocator(5000, 1000);
            const active = new Map();
            let nextId = 1;

            for (let round = 0; round < 50; round++) {
                // Allocate some
                const numAlloc = 10 + Math.floor(random() * 20);
                for (let i = 0; i < numAlloc; i++) {
                    const size = 1 + Math.floor(random() * 50);
                    const block = alloc.allocate(size);
                    if (block) {
                        active.set(nextId++, block);
                    }
                }

                // Free some
                const keys = [...active.keys()];
                const numFree = Math.floor(keys.length / 3);
                for (let i = 0; i < numFree; i++) {
                    const idx = Math.floor(random() * keys.length);
                    const key = keys[idx];
                    alloc.free(active.get(key));
                    active.delete(key);
                    keys.splice(idx, 1);
                }

                verifyInvariants(alloc);

                // Occasionally defrag
                if (round % 5 === 0) {
                    alloc.defrag(4);
                    verifyInvariants(alloc);
                }
            }

            // Full defrag at end
            alloc.defrag(0);
            verifyInvariants(alloc);

            // Verify all remaining blocks are in valid non-overlapping regions
            const blockList = [...active.values()].sort((a, b) => a.offset - b.offset);
            for (let i = 1; i < blockList.length; i++) {
                const prev = blockList[i - 1];
                const curr = blockList[i];
                expect(curr.offset).to.be.at.least(prev.offset + prev.size,
                    `overlap at blocks offset=${prev.offset}+${prev.size} and offset=${curr.offset}`);
            }
        });

        it('updateAllocation stress test with grow', function () {
            const random = mulberry32(24680);
            const alloc = new BlockAllocator(500, 500);
            const active = [];
            let nextId = 1;
            let buffer = new Uint32Array(10000);
            buffer.fill(0);

            // Initial fill
            for (let i = 0; i < 20; i++) {
                const size = 5 + Math.floor(random() * 20);
                const block = alloc.allocate(size);
                if (block) {
                    const id = nextId++;
                    writeBlock(buffer, block, id);
                    active.push({ block, id });
                }
            }
            verifyInvariants(alloc);

            // Multiple rounds of updateAllocation
            for (let round = 0; round < 20; round++) {
                // Pick some to free
                const numFree = Math.min(5, Math.floor(active.length / 3));
                const toFree = [];
                for (let i = 0; i < numFree; i++) {
                    const idx = Math.floor(random() * active.length);
                    toFree.push(active[idx].block);
                    active.splice(idx, 1);
                }

                // Build new allocation requests
                const toAllocSizes = [];
                const numNew = 3 + Math.floor(random() * 5);
                for (let i = 0; i < numNew; i++) {
                    toAllocSizes.push(5 + Math.floor(random() * 20));
                }

                const fullRebuild = alloc.updateAllocation(toFree, toAllocSizes);
                verifyInvariants(alloc);

                if (fullRebuild) {
                    // Resize buffer if capacity grew
                    if (alloc.capacity > buffer.length) {
                        const newBuf = new Uint32Array(alloc.capacity);
                        newBuf.set(buffer);
                        buffer = newBuf;
                    }
                    for (const { block, id } of active) {
                        writeBlock(buffer, block, id);
                    }
                }

                // Write new blocks
                for (const entry of toAllocSizes) {
                    const block = /** @type {MemBlock} */ (entry);
                    const id = nextId++;
                    if (block.offset + block.size <= buffer.length) {
                        writeBlock(buffer, block, id);
                    }
                    active.push({ block, id });
                }
            }

            verifyInvariants(alloc);
        });

    });

});
