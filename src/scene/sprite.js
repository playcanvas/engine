pc.extend(pc, function () {
    'use strict';

    /**
     * @enum pc.SPRITE_RENDERMODE
     * @name pc.SPRITE_RENDERMODE_SIMPLE
     * @description This mode renders a sprite as a simple quad.
     */
    pc.SPRITE_RENDERMODE_SIMPLE = 0;

    /**
     * @enum pc.SPRITE_RENDERMODE
     * @name pc.SPRITE_RENDERMODE_SLICED
     * @description This mode renders a sprite using 9-slicing in 'sliced' mode. Sliced mode stretches the
     * top and bottom regions of the sprite horizontally, the left and right regions vertically and the middle region
     * both horizontally and vertically.
     */
    pc.SPRITE_RENDERMODE_SLICED = 1;

    /**
     * @enum pc.SPRITE_RENDERMODE
     * @name pc.SPRITE_RENDERMODE_TILED
     * @description This mode renders a sprite using 9-slicing in 'tiled' mode. Tiled mode tiles the
     * top and bottom regions of the sprite horizontally, the left and right regions vertically and the middle region
     * both horizontally and vertically.
     */
    pc.SPRITE_RENDERMODE_TILED = 2;

    var nineSlicePositions = [
        // top row
        0,1,0, 0,1,0, 1,1,0, 1,1,0,
        // row below top
        0,1,0, 0,1,0, 1,1,0, 1,1,0,
        // row above bottom
        0,0,0, 0,0,0, 1,0,0, 1,0,0,
        // bottom row
        0,0,0, 0,0,0, 1,0,0, 1,0,0
    ];

    var nineSliceUvs = [
        // top row
        0,1, 0,1, 1,1, 1,1,
        // row below top
        0,1, 0,1, 1,1, 1,1,
        // row above bottom
        0,0, 0,0, 1,0, 1,0,
        // bottom row
        0,0, 0,0, 1,0, 1,0
    ];

    // the final vertex position for each 9-sliced vert is
    // pos.xy = (pos.xy + params.zw) * params.xy * attr.xy;
    // where params = [innerOffsetX, innerOffsetY, innerScaleX, innerScaleY]
    // and only when the respective attribute is 1
    var nineSliceAttributes = [
        0,0, 1,0, 1,0, 0,0,
        0,1, 1,1, 1,1, 0,1,
        0,1, 1,1, 1,1, 0,1,
        0,0, 1,0, 1,0, 0,0
    ];

    var nineSliceNormals = [
        0,0,1, 0,0,1, 0,0,1, 0,0,1,
        0,0,1, 0,0,1, 0,0,1, 0,0,1,
        0,0,1, 0,0,1, 0,0,1, 0,0,1,
        0,0,1, 0,0,1, 0,0,1, 0,0,1
    ];

    var nineSliceIndices = [
        4,  5,  0,  1,  0,  5,
        5,  6,  1,  2,  1,  6,
        6,  7,  2,  3,  2,  7,
        8,  9,  4,  5,  4,  9,
        9,  10, 5,  6,  5,  10,
        10, 11, 6,  7,  6, 11,
        12, 13, 8,  9,  8, 13,
        13, 14, 9,  10, 9, 14,
        14, 15, 10, 11, 10, 15,
    ];

    var simplePositions = [
        0,1,0, 1,1,0,
        0,0,0, 1,0,0
    ];

    var simpleNormals = [
        0,0,1, 0,0,1,
        0,0,1, 0,0,1
    ];

    var simpleIndices = [
        2, 1, 0,
        1, 2, 3
    ];


    /**
    * @private
    * @name pc.Sprite
    * @class Represents the resource of a sprite asset.
    * @param {pc.GraphicsDevice} device The graphics device of the application.
    * @param {Object} options Options for creating the pc.Sprite.
    * @param {Number} [options.pixelsPerUnit] The number of pixels that map to one PlayCanvas unit.
    * @param {pc.SPRITE_RENDERMODE} [options.renderMode] The rendering mode of the Sprite.
    * @param {pc.TextureAtlas} [options.atlas] The texture atlas.
    * @property {String[]} [options.frameKeys] The keys of the frames in the sprite atlas that this sprite is using.
    * @property {Number} pixelsPerUnit The number of pixels that map to one PlayCanvas unit.
    * @property {pc.TextureAtlas} atlas The texture atlas.
    * @property {pc.SPRITE_RENDERMODE} renderMode The rendering mode of the Sprite.
    * @property {String[]} frameKeys The keys of the frames in the sprite atlas that this sprite is using.
    * @property {pc.Mesh[]} meshes An array that contains a mesh for each frame.
    */
    var Sprite = function (device, options) {
        this._device = device;
        this._pixelsPerUnit = options && options.pixelsPerUnit !== undefined ? options.pixelsPerUnit : 1;
        this._renderMode = options && options.renderMode !== undefined ? options.renderMode : pc.SPRITE_RENDERMODE_SIMPLE;
        this._atlas = options && options.atlas !== undefined ? options.atlas : null;
        this._frameKeys = options && options.frameKeys !== undefined ? options.frameKeys : null;
        this._meshes = [];
        pc.events.attach(this);

        if (this._atlas && this._frameKeys) {
            this._createMeshes();
        }
    };

    Sprite.prototype._createMeshes = function () {
        var i, len;

        // destroy old meshes
        for (i = 0, len = this._meshes.length; i < len; i++) {
            var mesh = this._meshes[i];
            if (! mesh) continue;

            mesh.vertexBuffer.destroy();
            for (var j = 0, len2 = mesh.indexBuffer.length; j<len2; j++) {
                mesh.indexBuffer[j].destroy();
            }
        }

        // clear meshes array
        this._meshes.length = 0;

        // create a mesh for each frame in the sprite
        for (i = 0, len = this._frameKeys.length; i < len; i++) {
            var mesh = null;
            var frame = this._atlas.frames[this._frameKeys[i]];

            if (frame) {
                var rect = frame.rect;
                var texWidth = this._atlas.texture.width;
                var texHeight = this._atlas.texture.height;

                // uvs
                var lu = rect.data[0] / texWidth;
                var bv = rect.data[1] / texHeight;
                var ru = (rect.data[0] + rect.data[2]) / texWidth;
                var tv = (rect.data[1] + rect.data[3]) / texHeight;

                if (this._renderMode === pc.SPRITE_RENDERMODE_SLICED || this._renderMode === pc.SPRITE_RENDERMODE_TILED) {
                    var uvs = [
                        // top row
                        lu,tv, lu,tv, ru,tv, ru,tv,
                        // row below top
                        lu,tv, lu,tv, ru,tv, ru,tv,
                        // row above bottom
                        lu,bv, lu,bv, ru,bv, ru,bv,
                        // bottom row
                        lu,bv, lu,bv, ru,bv, ru,bv
                    ];

                    mesh = pc.createMesh(this._device, nineSlicePositions, {
                        uvs: nineSliceUvs,
                        uvs1: nineSliceAttributes,
                        normals: nineSliceNormals,
                        indices: nineSliceIndices
                    });

                    // // wireframe for debugging
                    // var offsets = [[0, 1], [1, 2], [2, 0]];
                    // var base = mesh.primitive[pc.RENDERSTYLE_SOLID].base;
                    // var count = mesh.primitive[pc.RENDERSTYLE_SOLID].count;
                    // var indexBuffer = mesh.indexBuffer[pc.RENDERSTYLE_SOLID];

                    // var srcIndices = new Uint16Array(indexBuffer.lock());

                    // var uniqueLineIndices = {};
                    // var lines = [];
                    // for (var j = base; j < base + count; j+=3) {
                    //     for (var k = 0; k < 3; k++) {
                    //         var i1 = srcIndices[j + offsets[k][0]];
                    //         var i2 = srcIndices[j + offsets[k][1]];
                    //         var line = (i1 > i2) ? ((i2 << 16) | i1) : ((i1 << 16) | i2);
                    //         if (uniqueLineIndices[line] === undefined) {
                    //             uniqueLineIndices[line] = 0;
                    //             lines.push(i1, i2);
                    //         }
                    //     }
                    // }

                    // indexBuffer.unlock();

                    // var wireBuffer = new pc.IndexBuffer(indexBuffer.device, pc.INDEXFORMAT_UINT16, lines.length);
                    // var dstIndices = new Uint16Array(wireBuffer.lock());
                    // dstIndices.set(lines);
                    // wireBuffer.unlock();

                    // mesh.primitive[pc.RENDERSTYLE_WIREFRAME] = {
                    //     type: pc.PRIMITIVE_LINES,
                    //     base: 0,
                    //     count: lines.length,
                    //     indexed: true
                    // };
                    // mesh.indexBuffer[pc.RENDERSTYLE_WIREFRAME] = wireBuffer;

                } else {

                    // var w = rect.data[2] / this._pixelsPerUnit;
                    // var h = rect.data[3] / this._pixelsPerUnit;
                    // var hp = frame.pivot.x;
                    // var vp = frame.pivot.y;

                    // coords
                    // var lx = -hp*w;
                    // var rx = (1 - hp) * w;
                    // var by = -vp*h;
                    // var ty = (1 - vp) * h;

                    // var positions = [
                    //     lx, by, 0,
                    //     rx, by, 0,
                    //     rx, ty, 0,
                    //     lx, ty, 0
                    // ];


                    // uvs based on frame rect
                    var uvs = [
                        lu, tv,
                        ru, tv,
                        lu, bv,
                        ru, bv
                    ];

                    mesh = pc.createMesh(this._device, simplePositions, {
                        uvs: uvs,
                        normals: simpleNormals,
                        indices: simpleIndices
                    });
                }
            }

            this._meshes.push(mesh);
        }

        this.fire('set:meshes');
    };

    Object.defineProperty(Sprite.prototype, 'frameKeys', {
        get: function () {
            return this._frameKeys;
        },
        set: function (value) {
            this._frameKeys = value;
            if (this._atlas && this._frameKeys) {
                this._createMeshes();
            }

            this.fire('set:frameKeys', value);
        }
    });

    Object.defineProperty(Sprite.prototype, 'atlas', {
        get: function () {
            return this._atlas;
        },
        set: function (value) {
            if (value === this._atlas) return;

            this._atlas = value;
            if (this._atlas && this._frameKeys) {
                this._createMeshes();
            }

            this.fire('set:atlas', value);
        }
    });

    Object.defineProperty(Sprite.prototype, 'pixelsPerUnit', {
        get: function () {
            return this._pixelsPerUnit;
        },
        set: function (value) {
            // if (this._pixelsPerUnit === value) return;

            this._pixelsPerUnit = value;
            this.fire('set:pixelsPerUnit', value);
            // if (this._atlas && this._frameKeys)
            //     this._createMeshes();
        }
    });

    Object.defineProperty(Sprite.prototype, 'renderMode', {
        get: function () {
            return this._renderMode;
        },
        set: function (value) {
            if (this._renderMode === value)
                return;

            this._renderMode = value;
            if (this._atlas && this._frameKeys) {
                this._createMeshes();
            }

            this.fire('set:renderMode', value);
        }
    });

    Object.defineProperty(Sprite.prototype, 'meshes', {
        get: function () {
            return this._meshes;
        }
    });

    return {
        Sprite: Sprite
    };
}());
