import { EventHandler } from '../core/event-handler.js';
import { Vec2 } from '../core/math/vec2.js';

import { SPRITE_RENDERMODE_SIMPLE, SPRITE_RENDERMODE_SLICED, SPRITE_RENDERMODE_TILED } from './constants.js';
import { Mesh } from './mesh.js';
import { Geometry } from './geometry/geometry.js';

// normals are the same for every mesh
const spriteNormals = [
    0, 0, 1,
    0, 0, 1,
    0, 0, 1,
    0, 0, 1
];

// indices are the same for every mesh
const spriteIndices = [
    0, 1, 3,
    2, 3, 1
];

/**
 * A Sprite contains references to one or more frames of a {@link TextureAtlas}. It can be used by
 * the {@link SpriteComponent} or the {@link ElementComponent} to render a single frame or a sprite
 * animation.
 *
 * @category Graphics
 */
class Sprite extends EventHandler {
    /**
     * Create a new Sprite instance.
     *
     * @param {import('../platform/graphics/graphics-device.js').GraphicsDevice} device - The
     * graphics device of the application.
     * @param {object} [options] - Options for creating the Sprite.
     * @param {number} [options.pixelsPerUnit] - The number of pixels that map to one PlayCanvas
     * unit. Defaults to 1.
     * @param {number} [options.renderMode] - The rendering mode of the sprite. Can be:
     *
     * - {@link SPRITE_RENDERMODE_SIMPLE}
     * - {@link SPRITE_RENDERMODE_SLICED}
     * - {@link SPRITE_RENDERMODE_TILED}
     *
     * Defaults to {@link SPRITE_RENDERMODE_SIMPLE}.
     * @param {import('./texture-atlas.js').TextureAtlas} [options.atlas] - The texture atlas.
     * Defaults to null.
     * @param {string[]} [options.frameKeys] - The keys of the frames in the sprite atlas that this
     * sprite is using. Defaults to null.
     */
    constructor(device, options) {
        super();

        this._device = device;
        this._pixelsPerUnit = options && options.pixelsPerUnit !== undefined ? options.pixelsPerUnit : 1;
        this._renderMode = options && options.renderMode !== undefined ? options.renderMode : SPRITE_RENDERMODE_SIMPLE;
        this._atlas = options && options.atlas !== undefined ? options.atlas : null;
        this._frameKeys = options && options.frameKeys !== undefined ? options.frameKeys : null;
        this._meshes = [];

        // set to true to update multiple
        // properties without re-creating meshes
        this._updatingProperties = false;
        // if true, endUpdate() will re-create meshes when it's called
        this._meshesDirty = false;

        if (this._atlas && this._frameKeys) {
            this._createMeshes();
        }
    }

    /**
     * Sets the keys of the frames in the sprite atlas that this sprite is using.
     *
     * @type {string[]}
     */
    set frameKeys(value) {
        this._frameKeys = value;

        if (this._atlas && this._frameKeys) {
            if (this._updatingProperties) {
                this._meshesDirty = true;
            } else {
                this._createMeshes();
            }
        }

        this.fire('set:frameKeys', value);
    }

    /**
     * Gets the keys of the frames in the sprite atlas that this sprite is using.
     *
     * @type {string[]}
     */
    get frameKeys() {
        return this._frameKeys;
    }

    /**
     * Sets the texture atlas.
     *
     * @type {import('./texture-atlas.js').TextureAtlas}
     */
    set atlas(value) {
        if (value === this._atlas) return;

        if (this._atlas) {
            this._atlas.off('set:frames', this._onSetFrames, this);
            this._atlas.off('set:frame', this._onFrameChanged, this);
            this._atlas.off('remove:frame', this._onFrameRemoved, this);
        }

        this._atlas = value;
        if (this._atlas && this._frameKeys) {
            this._atlas.on('set:frames', this._onSetFrames, this);
            this._atlas.on('set:frame', this._onFrameChanged, this);
            this._atlas.on('remove:frame', this._onFrameRemoved, this);

            if (this._updatingProperties) {
                this._meshesDirty = true;
            } else {
                this._createMeshes();
            }
        }

        this.fire('set:atlas', value);
    }

    /**
     * Gets the texture atlas.
     *
     * @type {import('./texture-atlas.js').TextureAtlas}
     */
    get atlas() {
        return this._atlas;
    }

    /**
     * Sets the number of pixels that map to one PlayCanvas unit.
     *
     * @type {number}
     */
    set pixelsPerUnit(value) {
        if (this._pixelsPerUnit === value) return;

        this._pixelsPerUnit = value;
        this.fire('set:pixelsPerUnit', value);

        // simple mode uses pixelsPerUnit to create the mesh so re-create those meshes
        if (this._atlas && this._frameKeys && this.renderMode === SPRITE_RENDERMODE_SIMPLE) {
            if (this._updatingProperties) {
                this._meshesDirty = true;
            } else {
                this._createMeshes();
            }
        }
    }

    /**
     * Gets the number of pixels that map to one PlayCanvas unit.
     *
     * @type {number}
     */
    get pixelsPerUnit() {
        return this._pixelsPerUnit;
    }

    /**
     * Sets the rendering mode of the sprite. Can be:
     *
     * - {@link SPRITE_RENDERMODE_SIMPLE}
     * - {@link SPRITE_RENDERMODE_SLICED}
     * - {@link SPRITE_RENDERMODE_TILED}
     *
     * @type {number}
     */
    set renderMode(value) {
        if (this._renderMode === value)
            return;

        const prev = this._renderMode;
        this._renderMode = value;
        this.fire('set:renderMode', value);

        // re-create the meshes if we're going from simple to 9-sliced or vice versa
        if (prev === SPRITE_RENDERMODE_SIMPLE || value === SPRITE_RENDERMODE_SIMPLE) {
            if (this._atlas && this._frameKeys) {
                if (this._updatingProperties) {
                    this._meshesDirty = true;
                } else {
                    this._createMeshes();
                }
            }
        }
    }

    /**
     * Sets the rendering mode of the sprite.
     *
     * @type {number}
     */
    get renderMode() {
        return this._renderMode;
    }

    /**
     * An array that contains a mesh for each frame.
     *
     * @type {import('./mesh.js').Mesh[]}
     */
    get meshes() {
        return this._meshes;
    }

    _createMeshes() {
        // destroy old meshes
        const len = this._meshes.length;
        for (let i = 0; i < len; i++) {
            const mesh = this._meshes[i];
            if (mesh) {
                mesh.destroy();
            }
        }

        // clear meshes array
        const count = this._frameKeys.length;
        this._meshes = new Array(count);

        // get function to create meshes
        const createMeshFunc = (this.renderMode === SPRITE_RENDERMODE_SLICED || this._renderMode === SPRITE_RENDERMODE_TILED ? this._create9SliceMesh : this._createSimpleMesh);

        // create a mesh for each frame in the sprite
        for (let i = 0; i < count; i++) {
            const frame = this._atlas.frames[this._frameKeys[i]];
            this._meshes[i] = frame ? createMeshFunc.call(this, frame) : null;
        }

        this.fire('set:meshes');
    }

    _createSimpleMesh(frame) {
        const rect = frame.rect;
        const texWidth = this._atlas.texture.width;
        const texHeight = this._atlas.texture.height;

        const w = rect.z / this._pixelsPerUnit;
        const h = rect.w / this._pixelsPerUnit;
        const hp = frame.pivot.x;
        const vp = frame.pivot.y;

        // positions based on pivot and size of frame
        const positions = [
            -hp * w,      -vp * h,      0,
            (1 - hp) * w, -vp * h,      0,
            (1 - hp) * w, (1 - vp) * h, 0,
            -hp * w,      (1 - vp) * h, 0
        ];

        // uvs based on frame rect
        // uvs
        const lu = rect.x / texWidth;
        const bv = 1.0 - rect.y / texHeight;
        const ru = (rect.x + rect.z) / texWidth;
        const tv = 1.0 - (rect.y + rect.w) / texHeight;

        const uvs = [
            lu, bv,
            ru, bv,
            ru, tv,
            lu, tv
        ];

        const geom = new Geometry();
        geom.positions = positions;
        geom.normals = spriteNormals;
        geom.uvs = uvs;
        geom.indices = spriteIndices;

        return Mesh.fromGeometry(this._device, geom);
    }

    _create9SliceMesh() {
        // Check the supplied options and provide defaults for unspecified ones
        const he = Vec2.ONE;
        const ws = 3;
        const ls = 3;

        // Variable declarations
        const positions = [];
        const normals = [];
        const uvs = [];
        const indices = [];

        // Generate plane as follows (assigned UVs denoted at corners):
        // (0,1)x---------x(1,1)
        //      |         |
        //      |         |
        //      |    O--X |length
        //      |    |    |
        //      |    Z    |
        // (0,0)x---------x(1,0)
        // width
        let vcounter = 0;
        for (let i = 0; i <= ws; i++) {
            const u = (i === 0 || i === ws) ? 0 : 1;

            for (let j = 0; j <= ls; j++) {

                const x = -he.x + 2.0 * he.x * (i <= 1 ? 0 : 3) / ws;
                const y = 0.0;
                const z = -(-he.y + 2.0 * he.y * (j <= 1 ? 0 : 3) / ls);

                const v = (j === 0 || j === ls) ? 0 : 1;

                positions.push(-x, y, z);
                normals.push(0.0, 1.0, 0.0);
                uvs.push(u, v);

                if ((i < ws) && (j < ls)) {
                    indices.push(vcounter + ls + 1, vcounter + 1, vcounter);
                    indices.push(vcounter + ls + 1, vcounter + ls + 2, vcounter + 1);
                }

                vcounter++;
            }
        }

        const geom = new Geometry();
        geom.positions = positions;
        geom.normals = normals;
        geom.uvs = uvs;
        geom.indices = indices;

        return Mesh.fromGeometry(this._device, geom);
    }

    _onSetFrames(frames) {
        if (this._updatingProperties) {
            this._meshesDirty = true;
        } else {
            this._createMeshes();
        }
    }

    _onFrameChanged(frameKey, frame) {
        const idx = this._frameKeys.indexOf(frameKey);
        if (idx < 0) return;

        if (frame) {
            // only re-create frame for simple render mode, since
            // 9-sliced meshes don't need frame info to create their mesh
            if (this.renderMode === SPRITE_RENDERMODE_SIMPLE) {
                this._meshes[idx] = this._createSimpleMesh(frame);
            }
        } else {
            this._meshes[idx] = null;
        }

        this.fire('set:meshes');
    }

    _onFrameRemoved(frameKey) {
        const idx = this._frameKeys.indexOf(frameKey);
        if (idx < 0) return;

        this._meshes[idx] = null;
        this.fire('set:meshes');
    }

    startUpdate() {
        this._updatingProperties = true;
        this._meshesDirty = false;
    }

    endUpdate() {
        this._updatingProperties = false;
        if (this._meshesDirty && this._atlas && this._frameKeys) {
            this._createMeshes();

        }
        this._meshesDirty = false;
    }

    /**
     * Free up the meshes created by the sprite.
     */
    destroy() {
        for (const mesh of this._meshes) {
            if (mesh)
                mesh.destroy();
        }
        this._meshes.length = 0;
    }
}

export { Sprite };
