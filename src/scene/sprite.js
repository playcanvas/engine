import { EventHandler } from '../core/event-handler.js';

import { Vec2 } from '../math/vec2.js';

import { SPRITE_RENDERMODE_SIMPLE, SPRITE_RENDERMODE_SLICED, SPRITE_RENDERMODE_TILED } from './constants.js';
import { createMesh } from './procedural.js';

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
 * @class
 * @name Sprite
 * @augments EventHandler
 * @classdesc A Sprite contains references to one or more frames of a {@link TextureAtlas}.
 * It can be used by the {@link SpriteComponent} or the {@link ElementComponent} to render a
 * single frame or a sprite animation.
 * @param {GraphicsDevice} device - The graphics device of the application.
 * @param {object} [options] - Options for creating the Sprite.
 * @param {number} [options.pixelsPerUnit] - The number of pixels that map to one PlayCanvas unit.
 * Defaults to 1.
 * @param {number} [options.renderMode] - The rendering mode of the sprite. Can be:
 *
 * * {@link SPRITE_RENDERMODE_SIMPLE}
 * * {@link SPRITE_RENDERMODE_SLICED}
 * * {@link SPRITE_RENDERMODE_TILED}
 *
 * Defaults to {@link SPRITE_RENDERMODE_SIMPLE}.
 * @param {TextureAtlas} [options.atlas] - The texture atlas. Defaults to null.
 * @param {string[]} [options.frameKeys] - The keys of the frames in the sprite atlas that this sprite is
 * using. Defaults to null.
 * @property {number} pixelsPerUnit The number of pixels that map to one PlayCanvas unit.
 * @property {TextureAtlas} atlas The texture atlas.
 * @property {number} renderMode The rendering mode of the sprite. Can be:
 *
 * * {@link SPRITE_RENDERMODE_SIMPLE}
 * * {@link SPRITE_RENDERMODE_SLICED}
 * * {@link SPRITE_RENDERMODE_TILED}
 *
 * @property {string[]} frameKeys The keys of the frames in the sprite atlas that this sprite is using.
 * @property {Mesh[]} meshes An array that contains a mesh for each frame.
 */
class Sprite extends EventHandler {
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

    _createMeshes() {
        var i, len;

        // destroy old meshes
        for (i = 0, len = this._meshes.length; i < len; i++) {
            var mesh = this._meshes[i];
            if (mesh) {
                mesh.destroy();
            }
        }

        // clear meshes array
        var count = this._frameKeys.length;
        this._meshes = new Array(count);

        // get function to create meshes
        var createMeshFunc = (this.renderMode === SPRITE_RENDERMODE_SLICED || this._renderMode === SPRITE_RENDERMODE_TILED ? this._create9SliceMesh : this._createSimpleMesh);

        // create a mesh for each frame in the sprite
        for (i = 0; i < count; i++) {
            var frame = this._atlas.frames[this._frameKeys[i]];
            this._meshes[i] = frame ? createMeshFunc.call(this, frame) : null;
        }

        this.fire('set:meshes');
    }

    _createSimpleMesh(frame) {
        var rect = frame.rect;
        var texWidth = this._atlas.texture.width;
        var texHeight = this._atlas.texture.height;

        var w = rect.z / this._pixelsPerUnit;
        var h = rect.w / this._pixelsPerUnit;
        var hp = frame.pivot.x;
        var vp = frame.pivot.y;

        // positions based on pivot and size of frame
        var positions = [
            -hp * w,      -vp * h,      0,
            (1 - hp) * w, -vp * h,      0,
            (1 - hp) * w, (1 - vp) * h, 0,
            -hp * w,      (1 - vp) * h, 0
        ];

        // uvs based on frame rect
        // uvs
        var lu = rect.x / texWidth;
        var bv = 1.0 - rect.y / texHeight;
        var ru = (rect.x + rect.z) / texWidth;
        var tv = 1.0 - (rect.y + rect.w) / texHeight;

        var uvs = [
            lu, bv,
            ru, bv,
            ru, tv,
            lu, tv
        ];

        var mesh = createMesh(this._device, positions, {
            uvs: uvs,
            normals: spriteNormals,
            indices: spriteIndices
        });

        return mesh;
    }

    _create9SliceMesh() {
        // Check the supplied options and provide defaults for unspecified ones
        var he = Vec2.ONE;
        var ws = 3;
        var ls = 3;

        // Variable declarations
        var i, j;
        var x, y, z, u, v;
        var positions = [];
        var normals = [];
        var uvs = [];
        var indices = [];

        // Generate plane as follows (assigned UVs denoted at corners):
        // (0,1)x---------x(1,1)
        //      |         |
        //      |         |
        //      |    O--X |length
        //      |    |    |
        //      |    Z    |
        // (0,0)x---------x(1,0)
        // width
        var vcounter = 0;
        for (i = 0; i <= ws; i++) {
            u = (i === 0 || i === ws) ? 0 : 1;

            for (j = 0; j <= ls; j++) {

                x = -he.x + 2.0 * he.x * (i <= 1 ? 0 : 3) / ws;
                y = 0.0;
                z = -(-he.y + 2.0 * he.y * (j <= 1 ? 0 : 3) / ls);

                v = (j === 0 || j === ls) ? 0 : 1;

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

        var options = {
            normals: normals, // crashes without normals on mac?
            uvs: uvs,
            indices: indices
        };

        return createMesh(this._device, positions, options);
    }

    _onSetFrames(frames) {
        if (this._updatingProperties) {
            this._meshesDirty = true;
        } else {
            this._createMeshes();
        }
    }

    _onFrameChanged(frameKey, frame) {
        var idx = this._frameKeys.indexOf(frameKey);
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
        var idx = this._frameKeys.indexOf(frameKey);
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
     * @function
     * @name Sprite#destroy
     * @description Free up the meshes created by the sprite.
     */
    destroy() {

        for (const mesh of this._meshes) {
            if (mesh)
                mesh.destroy();
        }
        this._meshes.length = 0;
    }

    get frameKeys() {
        return this._frameKeys;
    }

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

    get atlas() {
        return this._atlas;
    }

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

    get pixelsPerUnit() {
        return this._pixelsPerUnit;
    }

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

    get renderMode() {
        return this._renderMode;
    }

    set renderMode(value) {
        if (this._renderMode === value)
            return;

        var prev = this._renderMode;
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

    get meshes() {
        return this._meshes;
    }
}

export { Sprite };
