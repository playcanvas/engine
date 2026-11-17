import { expect } from 'chai';
import { restore, spy } from 'sinon';

import { Vec3 } from '../../../src/core/math/vec3.js';
import { Ray } from '../../../src/core/shape/ray.js';
import { VoxelOccupancy } from '../../../src/extras/voxel/voxel-occupancy.js';
import { PIXELFORMAT_RG32U } from '../../../src/platform/graphics/constants.js';
import { createGraphicsDevice } from '../../device.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

const SOLID_NODE = 0xff000000;

/**
 * Encodes a grid of voxels into the sparse octree of the voxel format splat-transform writes: the
 * nodes are stored breadth first, the children of a node contiguously in the order of their
 * octants, a node solid throughout as SOLID_NODE, a mixed block as the index of its two masks.
 *
 * @param {number[]} size - The number of voxels along each axis, multiples of 4.
 * @param {(x: number, y: number, z: number) => boolean} solid - Whether a voxel is solid.
 * @param {object} [options] - The options.
 * @param {number[]} [options.min] - The min corner of the grid.
 * @param {number} [options.voxelSize] - The size of a voxel.
 * @returns {{ metadata: object, data: ArrayBuffer }} The two files.
 */
const encode = ([nx, ny, nz], solid, { min = [0, 0, 0], voxelSize = 1 } = {}) => {
    const [nbx, nby, nbz] = [nx / 4, ny / 4, nz / 4];
    let treeDepth = 0;
    while ((1 << treeDepth) < Math.max(nbx, nby, nbz)) {
        treeDepth++;
    }

    const EMPTY = { type: 'empty' };
    const SOLID = { type: 'solid' };

    const build = (bx, by, bz, span) => {
        if (bx >= nbx || by >= nby || bz >= nbz) {
            return EMPTY;
        }
        if (span === 1) {
            const masks = [0, 0];
            for (let bit = 0; bit < 64; bit++) {
                if (solid(bx * 4 + (bit & 3), by * 4 + ((bit >> 2) & 3), bz * 4 + (bit >> 4))) {
                    masks[bit >> 5] = (masks[bit >> 5] | (1 << (bit & 31))) >>> 0;
                }
            }
            if (masks[0] === 0 && masks[1] === 0) return EMPTY;
            if (masks[0] === 0xffffffff && masks[1] === 0xffffffff) return SOLID;
            return { type: 'mixed', masks };
        }
        const half = span / 2;
        const children = [];
        for (let octant = 0; octant < 8; octant++) {
            children.push(build(bx + (octant & 1) * half, by + ((octant >> 1) & 1) * half, bz + ((octant >> 2) & 1) * half, half));
        }
        if (children.every(c => c === EMPTY)) return EMPTY;
        if (children.every(c => c === SOLID)) return SOLID;
        return { type: 'interior', children };
    };

    const root = build(0, 0, 0, 1 << treeDepth);
    const nodes = [];
    const leafData = [];
    const queue = root === EMPTY ? [] : [root];
    for (let i = 0; i < queue.length; i++) {
        const node = queue[i];
        if (node === SOLID) {
            nodes.push(SOLID_NODE);
        } else if (node.type === 'mixed') {
            nodes.push(leafData.length / 2);
            leafData.push(...node.masks);
        } else {
            let childMask = 0;
            const first = queue.length;
            node.children.forEach((child, octant) => {
                if (child !== EMPTY) {
                    childMask |= 1 << octant;
                    queue.push(child);
                }
            });
            nodes.push(((childMask << 24) | first) >>> 0);
        }
    }

    const words = new Uint32Array([...nodes, ...leafData]);
    return {
        metadata: {
            version: '1.1',
            voxelResolution: voxelSize,
            leafSize: 4,
            treeDepth,
            nodeCount: nodes.length,
            leafDataCount: leafData.length,
            gridBounds: {
                min,
                max: [min[0] + nx * voxelSize, min[1] + ny * voxelSize, min[2] + nz * voxelSize]
            }
        },
        data: words.buffer
    };
};

// a room: a floor at y = 0 with a hole at (5, 0, 5), a wall at x = 11, a solid block of 4x4x4
// voxels at the far corner, and a scattering of voxels
const SIZE = [12, 8, 16];
const roomSolid = (x, y, z) => {
    if (y === 0) return !(x === 5 && z === 5);
    if (x === 11) return true;
    if (x >= 4 && x < 8 && y >= 4 && z >= 12) return true;
    return (x * 7 + y * 13 + z * 29) % 31 === 0;
};

describe('VoxelOccupancy', function () {

    afterEach(function () {
        restore();
    });

    describe('#constructor', function () {

        it('reads the grid size, voxel size and bounds', function () {
            const { metadata, data } = encode(SIZE, roomSolid, { min: [-1, -2, -3], voxelSize: 0.5 });
            const voxels = new VoxelOccupancy(metadata, data);
            expect(voxels.voxelSize).to.equal(0.5);
            expect(voxels.gridSize.x).to.equal(12);
            expect(voxels.gridSize.y).to.equal(8);
            expect(voxels.gridSize.z).to.equal(16);
            expect(voxels.bounds.getMin().toString()).to.equal('[-1, -2, -3]');
            expect(voxels.bounds.getMax().toString()).to.equal('[5, 2, 5]');
        });
    });

    describe('#isVoxelSolid', function () {

        it('matches every voxel of the grid', function () {
            const { metadata, data } = encode(SIZE, roomSolid);
            const voxels = new VoxelOccupancy(metadata, data);
            for (let z = 0; z < SIZE[2]; z++) {
                for (let y = 0; y < SIZE[1]; y++) {
                    for (let x = 0; x < SIZE[0]; x++) {
                        expect(voxels.isVoxelSolid(x, y, z), `voxel ${x} ${y} ${z}`).to.equal(roomSolid(x, y, z));
                    }
                }
            }
        });

        it('treats the voxels outside the grid as empty', function () {
            const { metadata, data } = encode(SIZE, () => true);
            const voxels = new VoxelOccupancy(metadata, data);
            expect(voxels.isVoxelSolid(0, 0, 0)).to.be.true;
            expect(voxels.isVoxelSolid(-1, 0, 0)).to.be.false;
            expect(voxels.isVoxelSolid(0, 8, 0)).to.be.false;
            expect(voxels.isVoxelSolid(0, 0, 16)).to.be.false;
        });

        it('clips a solid node extending past the grid', function () {
            // a grid of 2x1x1 blocks, under a solid root spanning 2x2x2 blocks
            const metadata = {
                version: '1.1',
                voxelResolution: 1,
                leafSize: 4,
                treeDepth: 1,
                nodeCount: 1,
                leafDataCount: 0,
                gridBounds: { min: [0, 0, 0], max: [8, 4, 4] }
            };
            const voxels = new VoxelOccupancy(metadata, new Uint32Array([SOLID_NODE]).buffer);
            expect(voxels.isVoxelSolid(7, 3, 3)).to.be.true;
            expect(voxels.isVoxelSolid(7, 4, 3)).to.be.false;

            const blocks = new Uint32Array(2 * 2);
            voxels._decodeBlocks(blocks);
            expect(Array.from(blocks)).to.deep.equal([0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff]);
        });

        it('treats the blocks outside the root of the octree as empty', function () {
            // a grid of 4x1x1 blocks, of which only the first is occupied, so splat-transform ends
            // the octree at a root spanning 2x2x2 blocks: its voxel (0, 0, 0) is solid
            const metadata = {
                version: '1.1',
                voxelResolution: 1,
                leafSize: 4,
                treeDepth: 1,
                nodeCount: 2,
                leafDataCount: 2,
                gridBounds: { min: [0, 0, 0], max: [16, 4, 4] }
            };
            const voxels = new VoxelOccupancy(metadata, new Uint32Array([0x01000001, 0, 1, 0]).buffer);
            expect(voxels.isVoxelSolid(0, 0, 0)).to.be.true;
            expect(voxels.isVoxelSolid(8, 0, 0)).to.be.false;
            expect(Array.from(voxels.readBlock(2, 0, 0, new Uint32Array(2)))).to.deep.equal([0, 0]);

            // a ray from the far end of the grid passes the blocks outside the root
            const point = new Vec3();
            expect(voxels.raycast(new Ray(new Vec3(15.5, 0.5, 0.5), new Vec3(-1, 0, 0)), Infinity, point)).to.be.true;
            expect(point.toString()).to.equal('[1, 0.5, 0.5]');

            const blocks = new Uint32Array(4 * 2);
            voxels._decodeBlocks(blocks);
            expect(Array.from(blocks)).to.deep.equal([1, 0, 0, 0, 0, 0, 0, 0]);
        });

        it('treats an empty grid as empty', function () {
            const { metadata, data } = encode(SIZE, () => false);
            expect(metadata.nodeCount).to.equal(0);
            const voxels = new VoxelOccupancy(metadata, data);
            expect(voxels.isVoxelSolid(1, 1, 1)).to.be.false;
        });
    });

    describe('#isSolid', function () {

        it('finds the voxel at a position', function () {
            const { metadata, data } = encode(SIZE, roomSolid, { min: [-1, -2, -3], voxelSize: 0.5 });
            const voxels = new VoxelOccupancy(metadata, data);

            // the floor, and the hole in it at voxel (5, 0, 5)
            expect(voxels.isSolid(new Vec3(-1 + 0.25, -2 + 0.25, -3 + 0.25))).to.be.true;
            expect(voxels.isSolid(new Vec3(-1 + 5 * 0.5 + 0.25, -2 + 0.25, -3 + 5 * 0.5 + 0.25))).to.be.false;

            // the wall at voxel x = 11, its faces at x = 4.5 and x = 5
            expect(voxels.isSolid(new Vec3(4.49, 0, 0))).to.be.false;
            expect(voxels.isSolid(new Vec3(4.5, 0, 0))).to.be.true;
            expect(voxels.isSolid(new Vec3(5, 0, 0))).to.be.false;
        });
    });

    describe('#readBlock', function () {

        it('reads the masks of the empty, solid and mixed blocks', function () {
            const { metadata, data } = encode(SIZE, roomSolid);
            const voxels = new VoxelOccupancy(metadata, data);
            const out = new Uint32Array(2);

            // the solid block at the far corner
            expect(Array.from(voxels.readBlock(1, 1, 3, out))).to.deep.equal([0xffffffff, 0xffffffff]);

            // a block of the floor, each of its voxels at y = 0 solid but the hole at (5, 0, 5)
            voxels.readBlock(1, 0, 1, out);
            for (let bit = 0; bit < 64; bit++) {
                const solid = ((out[bit >> 5] >>> (bit & 31)) & 1) === 1;
                expect(solid).to.equal(roomSolid(4 + (bit & 3), (bit >> 2) & 3, 4 + (bit >> 4)));
            }

            // outside the grid
            expect(Array.from(voxels.readBlock(3, 0, 0, out))).to.deep.equal([0, 0]);
            expect(Array.from(voxels.readBlock(0, -1, 0, out))).to.deep.equal([0, 0]);
        });
    });

    describe('#raycast', function () {

        const { metadata, data } = encode([12, 8, 16], (x, y, z) => y === 0 || x === 11);

        it('hits the voxel a ray from outside the grid enters', function () {
            const voxels = new VoxelOccupancy(metadata, data);
            const point = new Vec3();
            const normal = new Vec3();
            const ray = new Ray(new Vec3(4.5, 20, 4.5), new Vec3(0, -1, 0));
            expect(voxels.raycast(ray, Infinity, point, normal)).to.be.true;
            expect(point.toString()).to.equal('[4.5, 1, 4.5]');
            expect(normal.toString()).to.equal('[0, 1, 0]');
        });

        it('hits the wall a ray inside the grid reaches', function () {
            const voxels = new VoxelOccupancy(metadata, data);
            const point = new Vec3();
            const normal = new Vec3();
            const ray = new Ray(new Vec3(2.5, 3.5, 7.5), new Vec3(1, 0, 0));
            expect(voxels.raycast(ray, Infinity, point, normal)).to.be.true;
            expect(point.toString()).to.equal('[11, 3.5, 7.5]');
            expect(normal.toString()).to.equal('[-1, 0, 0]');
        });

        it('hits along a diagonal', function () {
            const voxels = new VoxelOccupancy(metadata, data);
            const point = new Vec3();
            const normal = new Vec3();
            const ray = new Ray(new Vec3(2, 5, 3), new Vec3(1, -1, 0.5).normalize());
            expect(voxels.raycast(ray, Infinity, point, normal)).to.be.true;
            expect(point.y).to.be.closeTo(1, 1e-6);
            expect(point.x).to.be.closeTo(6, 1e-6);
            expect(point.z).to.be.closeTo(5, 1e-6);
            expect(normal.toString()).to.equal('[0, 1, 0]');
        });

        it('misses beyond the max distance', function () {
            const voxels = new VoxelOccupancy(metadata, data);
            const ray = new Ray(new Vec3(2.5, 3.5, 7.5), new Vec3(1, 0, 0));
            expect(voxels.raycast(ray, 8)).to.be.false;
            expect(voxels.raycast(ray, 8.6)).to.be.true;
        });

        it('hits at the origin of a ray starting inside a solid voxel', function () {
            const voxels = new VoxelOccupancy(metadata, data);
            const point = new Vec3();
            const normal = new Vec3();
            const ray = new Ray(new Vec3(3.5, 0.5, 3.5), new Vec3(0, 1, 0));
            expect(voxels.raycast(ray, Infinity, point, normal)).to.be.true;
            expect(point.toString()).to.equal('[3.5, 0.5, 3.5]');
            expect(normal.toString()).to.equal('[0, -1, 0]');
        });

        it('misses when the ray leaves the grid or does not reach it', function () {
            const voxels = new VoxelOccupancy(metadata, data);
            expect(voxels.raycast(new Ray(new Vec3(2.5, 3.5, 7.5), new Vec3(0, 0, 1)))).to.be.false;
            expect(voxels.raycast(new Ray(new Vec3(2.5, 3.5, 7.5), new Vec3(0, 1, 0)))).to.be.false;
            expect(voxels.raycast(new Ray(new Vec3(2.5, 20, 7.5), new Vec3(0, 1, 0)))).to.be.false;
            expect(voxels.raycast(new Ray(new Vec3(-5, 3.5, 7.5), new Vec3(0, -1, 0)))).to.be.false;
        });
    });

    describe('#getTexture', function () {

        let device;

        beforeEach(function () {
            jsdomSetup();
            device = createGraphicsDevice(document.createElement('canvas'));
        });

        afterEach(function () {
            device.destroy();
            device = null;
            jsdomTeardown();
        });

        it('creates a volume texture with a texel for each block', function () {
            const { metadata, data } = encode(SIZE, roomSolid);
            const voxels = new VoxelOccupancy(metadata, data);
            const texture = voxels.getTexture(device);
            expect(texture.volume).to.be.true;
            expect(texture.format).to.equal(PIXELFORMAT_RG32U);
            expect([texture.width, texture.height, texture.depth]).to.deep.equal([3, 2, 4]);
            expect(texture.mipmaps).to.be.false;
            expect(voxels.getTexture(device)).to.equal(texture);
            voxels.destroy();
            expect(texture.device).to.equal(null);
        });

        it('writes the masks of every block', function () {
            const { metadata, data } = encode(SIZE, roomSolid);
            const voxels = new VoxelOccupancy(metadata, data);
            const blocks = new Uint32Array(3 * 2 * 4 * 2);
            voxels._decodeBlocks(blocks);

            const out = new Uint32Array(2);
            for (let bz = 0; bz < 4; bz++) {
                for (let by = 0; by < 2; by++) {
                    for (let bx = 0; bx < 3; bx++) {
                        const i = (bx + 3 * (by + 2 * bz)) * 2;
                        voxels.readBlock(bx, by, bz, out);
                        expect([blocks[i], blocks[i + 1]], `block ${bx} ${by} ${bz}`).to.deep.equal(Array.from(out));
                    }
                }
            }
        });

        it('writes the voxels again when the device is restored, until destroyed', function () {
            const { metadata, data } = encode(SIZE, roomSolid);
            const voxels = new VoxelOccupancy(metadata, data);
            voxels.getTexture(device);
            const decode = spy(voxels, '_decodeBlocks');

            device.fire('devicerestored');
            expect(decode.calledOnce).to.be.true;

            voxels.destroy();
            device.fire('devicerestored');
            expect(decode.calledOnce).to.be.true;
        });
    });
});
