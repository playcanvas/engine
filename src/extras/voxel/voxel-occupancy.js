import { Debug } from '../../core/debug.js';
import { Vec3 } from '../../core/math/vec3.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';
import { ADDRESS_CLAMP_TO_EDGE, FILTER_NEAREST, PIXELFORMAT_RG32U } from '../../platform/graphics/constants.js';
import { Texture } from '../../platform/graphics/texture.js';

/**
 * @import { Ray } from '../../core/shape/ray.js'
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 */

/**
 * The contents of the `.voxel.json` file splat-transform writes, which describes the voxels of
 * its `.voxel.bin` file. See {@link VoxelOccupancy}.
 *
 * @typedef {object} VoxelOccupancyMetadata
 * @property {string} version - The version of the voxel format.
 * @property {number} voxelResolution - The size of a voxel, in world units.
 * @property {number} leafSize - The number of voxels along each axis of a block of the octree.
 * @property {number} treeDepth - The depth of the octree.
 * @property {number} nodeCount - The number of nodes of the octree, a 32 bit word each.
 * @property {number} leafDataCount - The number of 32 bit words of the voxel masks of the blocks.
 * @property {{ min: number[], max: number[] }} gridBounds - The bounds of the voxel grid, in the
 * space of the voxels.
 */

// an octree node which is solid throughout
const SOLID_NODE = 0xff000000;

// the results of looking up a block of voxels, other than the index of the masks of a mixed block
const BLOCK_EMPTY = -1;
const BLOCK_SOLID = -2;

// the masks of a block, for the queries reading the blocks
const tmpBlock = new Uint32Array(2);

/**
 * The number of set bits of an 8 bit value.
 *
 * @param {number} value - The value.
 * @returns {number} The number of set bits.
 */
const countBits8 = (value) => {
    value -= (value >> 1) & 0x55;
    value = (value & 0x33) + ((value >> 2) & 0x33);
    return (value + (value >> 4)) & 0x0f;
};

/**
 * The solid voxels of a scene, which
 * [splat-transform](https://github.com/playcanvas/splat-transform) generates from a gaussian splat
 * in its voxel format: a grid of voxels, each of them either solid or empty, written as a
 * `.voxel.json` file and a `.voxel.bin` file. A VoxelOccupancy answers queries on the CPU, such as
 * whether a position is inside a solid voxel, or where a ray hits the first one, for collision
 * logic such as character controllers to be built on. It also provides the voxels as a texture,
 * for shaders to query them on the GPU.
 *
 * The voxels are kept in the sparse octree they are stored in, which takes a fraction of the
 * memory of the full grid. The queries take positions in the space of the voxel data, which is the
 * space of the gaussian splat they were generated from, rotated by 180 degrees around the Z axis.
 * That is the usual rotation of a splat entity, so a splat entity rotated by it, and not otherwise
 * transformed, lines up with the voxels.
 *
 * The voxels outside of the grid are empty.
 *
 * @category Graphics
 */
class VoxelOccupancy {
    /**
     * The octree nodes.
     *
     * @type {Uint32Array}
     * @private
     */
    _nodes;

    /**
     * The voxel masks of the mixed blocks, two 32 bit words for each.
     *
     * @type {Uint32Array}
     * @private
     */
    _leafData;

    /**
     * The depth of the octree, its leaves are the blocks.
     *
     * @type {number}
     * @private
     */
    _treeDepth;

    /**
     * The number of blocks the root of the octree spans along each axis. It can span fewer blocks
     * than the grid: splat-transform ends the octree at a smaller root when its occupied blocks
     * all fit in it, and the blocks outside of the root are empty.
     *
     * @type {number}
     * @private
     */
    _rootSpan;

    /** @private */
    _voxelSize;

    /** @private */
    _bounds = new BoundingBox();

    /** @private */
    _min = new Vec3();

    /** @private */
    _gridSize = new Vec3();

    // the number of voxels and of blocks along each axis
    /** @private */
    _nx;

    /** @private */
    _ny;

    /** @private */
    _nz;

    /** @private */
    _nbx;

    /** @private */
    _nby;

    /** @private */
    _nbz;

    /**
     * The texture of the voxels, created on request.
     *
     * @type {Texture|null}
     * @private
     */
    _texture = null;

    /**
     * Creates a new VoxelOccupancy from the two files splat-transform writes, which load as a json
     * asset and a binary asset.
     *
     * @param {VoxelOccupancyMetadata} metadata - The contents of the `.voxel.json` file.
     * @param {ArrayBuffer} data - The contents of the `.voxel.bin` file.
     * @example
     * const voxels = new VoxelOccupancy(jsonAsset.resource, binaryAsset.resource);
     * if (voxels.isSolid(entity.getPosition())) {
     *     console.log('inside a wall');
     * }
     */
    constructor(metadata, data) {
        Debug.call(() => {
            // the versions before 1.1 have their voxels mirrored along x and y
            const [major, minor] = String(metadata.version).split('.').map(Number);
            if (major !== 1 || !(minor >= 1)) {
                Debug.warn(`VoxelOccupancy: voxel format version ${metadata.version} is not supported. Regenerate the voxels with a current version of splat-transform.`);
            }
        });
        Debug.assert(metadata.leafSize === 4, `VoxelOccupancy: only blocks of 4x4x4 voxels are supported, not ${metadata.leafSize}.`);

        const words = new Uint32Array(data);
        this._nodes = words.subarray(0, metadata.nodeCount);
        this._leafData = words.subarray(metadata.nodeCount, metadata.nodeCount + metadata.leafDataCount);
        this._treeDepth = metadata.treeDepth;
        this._rootSpan = 2 ** metadata.treeDepth;
        this._voxelSize = metadata.voxelResolution;

        const { min, max } = metadata.gridBounds;
        const blockSize = 4 * this._voxelSize;
        this._nbx = Math.round((max[0] - min[0]) / blockSize);
        this._nby = Math.round((max[1] - min[1]) / blockSize);
        this._nbz = Math.round((max[2] - min[2]) / blockSize);
        this._nx = this._nbx * 4;
        this._ny = this._nby * 4;
        this._nz = this._nbz * 4;

        this._min.set(min[0], min[1], min[2]);
        this._gridSize.set(this._nx, this._ny, this._nz);
        this._bounds.setMinMax(this._min, new Vec3(this._nx, this._ny, this._nz).mulScalar(this._voxelSize).add(this._min));
    }

    /**
     * Frees the texture of the voxels.
     */
    destroy() {
        if (this._texture) {
            this._texture.device?.off('devicerestored', this._uploadTexture, this);
            this._texture.destroy();
            this._texture = null;
        }
    }

    /**
     * Gets the size of a voxel, in world units.
     *
     * @type {number}
     */
    get voxelSize() {
        return this._voxelSize;
    }

    /**
     * Gets the bounds of the grid of voxels. Do not modify it.
     *
     * @type {BoundingBox}
     */
    get bounds() {
        return this._bounds;
    }

    /**
     * Gets the number of voxels of the grid along each axis. Do not modify it.
     *
     * @type {Vec3}
     */
    get gridSize() {
        return this._gridSize;
    }

    /**
     * Finds the block of voxels at the given block coordinates, which must be inside the grid. The
     * blocks outside of the root of the octree are empty.
     *
     * @param {number} bx - The x coordinate of the block.
     * @param {number} by - The y coordinate of the block.
     * @param {number} bz - The z coordinate of the block.
     * @returns {number} BLOCK_EMPTY, BLOCK_SOLID, or the index of the masks of a mixed block.
     * @private
     */
    _findBlock(bx, by, bz) {
        const nodes = this._nodes;
        const span = this._rootSpan;
        if (nodes.length === 0 || bx >= span || by >= span || bz >= span) {
            return BLOCK_EMPTY;
        }

        // descend from the root, which covers 2^treeDepth blocks along each axis, a bit of the block
        // coordinates selecting the octant at each level
        let index = 0;
        let level = this._treeDepth;
        for (;;) {
            const word = nodes[index];
            if (word === SOLID_NODE) {
                return BLOCK_SOLID;
            }

            // a mixed leaf holds the index of its masks
            const childMask = word >>> 24;
            if (childMask === 0) {
                return word;
            }

            // the children of an interior node are stored in the order of their octants
            level--;
            const octant = ((bx >> level) & 1) | (((by >> level) & 1) << 1) | (((bz >> level) & 1) << 2);
            const bit = 1 << octant;
            if ((childMask & bit) === 0) {
                return BLOCK_EMPTY;
            }
            index = (word & 0xffffff) + countBits8(childMask & (bit - 1));
        }
    }

    /**
     * Reads the masks of a block of 4x4x4 voxels. The voxel at (x, y, z) within the block is bit
     * `x + y * 4 + z * 16` of the 64 bit mask, of which `out[0]` holds the low 32 bits and
     * `out[1]` the high 32 bits. A block outside the grid is empty.
     *
     * @param {number} bx - The x coordinate of the block, the x coordinate of its voxels divided
     * by 4.
     * @param {number} by - The y coordinate of the block.
     * @param {number} bz - The z coordinate of the block.
     * @param {Uint32Array|number[]} out - Receives the two masks.
     * @returns {Uint32Array|number[]} The out array.
     */
    readBlock(bx, by, bz, out) {
        let lo = 0;
        let hi = 0;
        if (bx >= 0 && by >= 0 && bz >= 0 && bx < this._nbx && by < this._nby && bz < this._nbz) {
            const block = this._findBlock(bx, by, bz);
            if (block === BLOCK_SOLID) {
                lo = 0xffffffff;
                hi = 0xffffffff;
            } else if (block !== BLOCK_EMPTY) {
                lo = this._leafData[block * 2];
                hi = this._leafData[block * 2 + 1];
            }
        }
        out[0] = lo;
        out[1] = hi;
        return out;
    }

    /**
     * Tests whether the voxel at the given voxel coordinates is solid, for the queries working on
     * the grid, such as stepping between neighboring voxels. See {@link isSolid} for positions.
     *
     * @param {number} ix - The x coordinate of the voxel.
     * @param {number} iy - The y coordinate of the voxel.
     * @param {number} iz - The z coordinate of the voxel.
     * @returns {boolean} True if the voxel is solid, false if it is empty or outside the grid.
     */
    isVoxelSolid(ix, iy, iz) {
        if (ix < 0 || iy < 0 || iz < 0 || ix >= this._nx || iy >= this._ny || iz >= this._nz) {
            return false;
        }
        const block = this._findBlock(ix >> 2, iy >> 2, iz >> 2);
        if (block === BLOCK_EMPTY) {
            return false;
        }
        if (block === BLOCK_SOLID) {
            return true;
        }
        const bit = (ix & 3) | ((iy & 3) << 2) | ((iz & 3) << 4);
        return ((this._leafData[block * 2 + (bit >> 5)] >>> (bit & 31)) & 1) === 1;
    }

    /**
     * Tests whether a position is inside a solid voxel.
     *
     * @param {Vec3} position - The position, in the space of the voxels.
     * @returns {boolean} True if the voxel at the position is solid.
     * @example
     * if (voxels.isSolid(position)) {
     *     position.copy(previousPosition);
     * }
     */
    isSolid(position) {
        const min = this._min;
        const size = this._voxelSize;
        return this.isVoxelSolid(
            Math.floor((position.x - min.x) / size),
            Math.floor((position.y - min.y) / size),
            Math.floor((position.z - min.z) / size)
        );
    }

    /**
     * Finds the first solid voxel along a ray. A ray starting inside a solid voxel hits it at its
     * origin.
     *
     * @param {Ray} ray - The ray, in the space of the voxels. Its direction must be normalized.
     * @param {number} [maxDistance] - The distance along the ray to search to. Defaults to
     * Infinity.
     * @param {Vec3} [point] - Receives the position where the ray enters the solid voxel.
     * @param {Vec3} [normal] - Receives the normal of the face of the voxel the ray enters through,
     * or the reversed direction of the ray when it starts inside the voxel.
     * @returns {boolean} True if the ray hits a solid voxel.
     * @example
     * camera.camera.screenToWorld(x, y, camera.camera.nearClip, ray.origin);
     * camera.camera.screenToWorld(x, y, camera.camera.farClip, ray.direction);
     * ray.direction.sub(ray.origin).normalize();
     * if (voxels.raycast(ray, 100, hitPoint, hitNormal)) {
     *     marker.setPosition(hitPoint);
     * }
     */
    raycast(ray, maxDistance = Infinity, point, normal) {
        const { origin, direction } = ray;
        const size = this._voxelSize;
        const min = this._min;
        const nx = this._nx;
        const ny = this._ny;
        const nz = this._nz;

        // the ray in voxel units, where the voxel (i, j, k) spans [i, i + 1] along x, and so on. The
        // direction keeps its length of 1, so the distances along it scale by the voxel size.
        const ox = (origin.x - min.x) / size;
        const oy = (origin.y - min.y) / size;
        const oz = (origin.z - min.z) / size;
        const dx = direction.x;
        const dy = direction.y;
        const dz = direction.z;

        // clip the ray to the grid, remembering the axis of the face it enters through
        let tEnter = 0;
        let tExit = maxDistance / size;
        let axis = -1;
        if (dx === 0) {
            if (ox < 0 || ox >= nx) return false;
        } else {
            const t0 = -ox / dx;
            const t1 = (nx - ox) / dx;
            if (Math.min(t0, t1) > tEnter) {
                tEnter = Math.min(t0, t1);
                axis = 0;
            }
            tExit = Math.min(tExit, Math.max(t0, t1));
        }
        if (dy === 0) {
            if (oy < 0 || oy >= ny) return false;
        } else {
            const t0 = -oy / dy;
            const t1 = (ny - oy) / dy;
            if (Math.min(t0, t1) > tEnter) {
                tEnter = Math.min(t0, t1);
                axis = 1;
            }
            tExit = Math.min(tExit, Math.max(t0, t1));
        }
        if (dz === 0) {
            if (oz < 0 || oz >= nz) return false;
        } else {
            const t0 = -oz / dz;
            const t1 = (nz - oz) / dz;
            if (Math.min(t0, t1) > tEnter) {
                tEnter = Math.min(t0, t1);
                axis = 2;
            }
            tExit = Math.min(tExit, Math.max(t0, t1));
        }
        if (tEnter > tExit) {
            return false;
        }

        // the voxel the ray starts in, kept inside the grid against rounding
        let ix = Math.min(Math.max(Math.floor(ox + dx * tEnter), 0), nx - 1);
        let iy = Math.min(Math.max(Math.floor(oy + dy * tEnter), 0), ny - 1);
        let iz = Math.min(Math.max(Math.floor(oz + dz * tEnter), 0), nz - 1);

        // step from voxel to voxel, through the face the ray leaves the voxel through first
        const stepX = Math.sign(dx);
        const stepY = Math.sign(dy);
        const stepZ = Math.sign(dz);
        const deltaX = Math.abs(1 / dx);
        const deltaY = Math.abs(1 / dy);
        const deltaZ = Math.abs(1 / dz);
        let nextX = dx > 0 ? (ix + 1 - ox) / dx : dx < 0 ? (ix - ox) / dx : Infinity;
        let nextY = dy > 0 ? (iy + 1 - oy) / dy : dy < 0 ? (iy - oy) / dy : Infinity;
        let nextZ = dz > 0 ? (iz + 1 - oz) / dz : dz < 0 ? (iz - oz) / dz : Infinity;
        let t = tEnter;

        // the voxels of a block are tested from its masks, read once for the block
        let blockIndex = -1;
        for (;;) {
            const index = (ix >> 2) + this._nbx * ((iy >> 2) + this._nby * (iz >> 2));
            if (index !== blockIndex) {
                blockIndex = index;
                this.readBlock(ix >> 2, iy >> 2, iz >> 2, tmpBlock);
            }
            const bit = (ix & 3) | ((iy & 3) << 2) | ((iz & 3) << 4);
            if ((tmpBlock[bit >> 5] >>> (bit & 31)) & 1) {
                point?.copy(direction).mulScalar(t * size).add(origin);
                if (normal) {
                    if (axis === 0) {
                        normal.set(-stepX, 0, 0);
                    } else if (axis === 1) {
                        normal.set(0, -stepY, 0);
                    } else if (axis === 2) {
                        normal.set(0, 0, -stepZ);
                    } else {
                        normal.copy(direction).mulScalar(-1);
                    }
                }
                return true;
            }

            if (nextX < nextY && nextX < nextZ) {
                t = nextX;
                nextX += deltaX;
                ix += stepX;
                axis = 0;
            } else if (nextY < nextZ) {
                t = nextY;
                nextY += deltaY;
                iy += stepY;
                axis = 1;
            } else {
                t = nextZ;
                nextZ += deltaZ;
                iz += stepZ;
                axis = 2;
            }
            if (t > tExit || ix < 0 || iy < 0 || iz < 0 || ix >= nx || iy >= ny || iz >= nz) {
                return false;
            }
        }
    }

    /**
     * Gets the texture of the voxels, for shaders to query them. It is a volume texture of the
     * format {@link PIXELFORMAT_RG32U}, with a texel for each block of 4x4x4 voxels, the size of
     * {@link gridSize} divided by 4. The red channel of a texel holds the low 32 bits and the green
     * channel the high 32 bits of the mask of its block, see {@link readBlock}. It is sampled with
     * nearest filtering, and would usually be read with `textureLoad` in WGSL and `texelFetch` in
     * GLSL. A shader finds the voxel at a position like this:
     *
     * ```wgsl
     * let voxel = vec3i(floor((position - gridMin) / voxelSize));
     * let masks = textureLoad(voxels, voxel >> vec3u(2u), 0).rg;
     * let bit = u32((voxel.x & 3) | ((voxel.y & 3) << 2) | ((voxel.z & 3) << 4));
     * let solid = ((select(masks.x, masks.y, bit >= 32u) >> (bit & 31u)) & 1u) != 0u;
     * ```
     *
     * ```glsl
     * ivec3 voxel = ivec3(floor((position - gridMin) / voxelSize));
     * uvec2 masks = texelFetch(voxels, voxel >> 2, 0).rg;
     * int bit = (voxel.x & 3) | ((voxel.y & 3) << 2) | ((voxel.z & 3) << 4);
     * bool solid = (((bit < 32 ? masks.x : masks.y) >> (bit & 31)) & 1u) != 0u;
     * ```
     *
     * The voxels outside of the grid are empty, which the shader tests for separately.
     *
     * The texture is created on the first call, and is owned by the VoxelOccupancy, which destroys
     * it in {@link destroy}. It holds no copy of the voxels in CPU memory, as the voxels are
     * written to it again from the octree when the graphics device is restored after it was lost.
     *
     * @param {GraphicsDevice} device - The graphics device.
     * @returns {Texture} The texture.
     */
    getTexture(device) {
        if (!this._texture) {
            Debug.assert(Math.max(this._nbx, this._nby, this._nbz) <= device.maxVolumeSize,
                `VoxelOccupancy: the grid of ${this._nbx}x${this._nby}x${this._nbz} blocks exceeds the volume texture size limit of ${device.maxVolumeSize}.`);

            this._texture = new Texture(device, {
                name: 'VoxelOccupancy',
                width: this._nbx,
                height: this._nby,
                depth: this._nbz,
                volume: true,
                format: PIXELFORMAT_RG32U,
                mipmaps: false,
                minFilter: FILTER_NEAREST,
                magFilter: FILTER_NEAREST,
                addressU: ADDRESS_CLAMP_TO_EDGE,
                addressV: ADDRESS_CLAMP_TO_EDGE,
                addressW: ADDRESS_CLAMP_TO_EDGE
            });
            this._uploadTexture();

            // the texture loses its content with the device
            device.on('devicerestored', this._uploadTexture, this);
        }

        Debug.assert(this._texture.device === device, 'VoxelOccupancy#getTexture: the texture was created for another graphics device.');
        return this._texture;
    }

    /**
     * Writes the voxels to the texture. The full grid of blocks is only needed for the upload, so
     * the texture releases it once uploaded.
     *
     * @private
     */
    _uploadTexture() {
        const texture = /** @type {Texture} */ (this._texture);
        const blocks = /** @type {Uint32Array} */ (texture.lock());
        blocks.fill(0);
        this._decodeBlocks(blocks);
        texture.setReleaseSourceAfterUpload();
        texture.unlock();
    }

    /**
     * Writes the masks of all blocks of the octree to the full grid of blocks.
     *
     * @param {Uint32Array} blocks - The grid of blocks, two 32 bit words for each, ordered by x,
     * then y, then z. The empty blocks are not written to.
     * @private
     */
    _decodeBlocks(blocks) {
        const nodes = this._nodes;
        const leafData = this._leafData;
        const nbx = this._nbx;
        const nby = this._nby;
        const nbz = this._nbz;

        // the nodes to visit: their index, the block coordinates of their min corner, and the
        // number of blocks they span along each axis
        const stack = nodes.length ? [0, 0, 0, 0, this._rootSpan] : [];
        while (stack.length) {
            const span = /** @type {number} */ (stack.pop());
            const bz = /** @type {number} */ (stack.pop());
            const by = /** @type {number} */ (stack.pop());
            const bx = /** @type {number} */ (stack.pop());
            const word = nodes[/** @type {number} */ (stack.pop())];

            if (word === SOLID_NODE) {
                // a solid node can extend past the grid
                for (let z = bz; z < Math.min(bz + span, nbz); z++) {
                    for (let y = by; y < Math.min(by + span, nby); y++) {
                        const row = (nbx * (y + nby * z)) * 2;
                        blocks.fill(0xffffffff, row + bx * 2, row + Math.min(bx + span, nbx) * 2);
                    }
                }
            } else if (word >>> 24 === 0) {
                if (bx < nbx && by < nby && bz < nbz) {
                    const i = (bx + nbx * (by + nby * bz)) * 2;
                    blocks[i] = leafData[word * 2];
                    blocks[i + 1] = leafData[word * 2 + 1];
                }
            } else {
                const childMask = word >>> 24;
                const half = span >> 1;
                let child = word & 0xffffff;
                for (let octant = 0; octant < 8; octant++) {
                    if (childMask & (1 << octant)) {
                        stack.push(
                            child++,
                            bx + (octant & 1) * half,
                            by + ((octant >> 1) & 1) * half,
                            bz + ((octant >> 2) & 1) * half,
                            half
                        );
                    }
                }
            }
        }
    }
}

export { VoxelOccupancy };
