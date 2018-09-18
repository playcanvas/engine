Object.assign(pc, function () {
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

    // normals are the same for every mesh
    var spriteNormals = [
        0, 0, 1,
        0, 0, 1,
        0, 0, 1,
        0, 0, 1
    ];

    // indices are the same for every mesh
    var spriteIndices = [
        0, 1, 3,
        2, 3, 1
    ];


    /**
     * @constructor
     * @name pc.Sprite
     * @classdesc A pc.Sprite is contains references to one or more frames of a {@link pc.TextureAtlas}. It can be used
     * by the {@link pc.SpriteComponent} or the {@link pc.ElementComponent} to render a single frame or a sprite animation.
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

        // set to true to update multiple
        // properties without re-creating meshes
        this._updatingProperties = false;
        // if true, endUpdate() will re-create meshes when it's called
        this._meshesDirty = false;

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
            if (!mesh) continue;

            mesh.vertexBuffer.destroy();
            for (var j = 0, len2 = mesh.indexBuffer.length; j < len2; j++) {
                mesh.indexBuffer[j].destroy();
            }
        }

        // clear meshes array
        var count = this._frameKeys.length;
        this._meshes = new Array(count);

        // get function to create meshes
        var createMeshFunc = (this.renderMode === pc.SPRITE_RENDERMODE_SLICED || this._renderMode === pc.SPRITE_RENDERMODE_TILED ? this._create9SliceMesh : this._createSimpleMesh);

        // create a mesh for each frame in the sprite
        for (i = 0; i < count; i++) {
            var frame = this._atlas.frames[this._frameKeys[i]];
            this._meshes[i] = frame ? createMeshFunc.call(this, frame) : null;
        }

        this.fire('set:meshes');
    };

    Sprite.prototype._createSimpleMesh = function (frame) {
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
        var bv = rect.y / texHeight;
        var ru = (rect.x + rect.z) / texWidth;
        var tv = (rect.y + rect.w) / texHeight;

        var uvs = [
            lu, bv,
            ru, bv,
            ru, tv,
            lu, tv
        ];

        var mesh = pc.createMesh(this._device, positions, {
            uvs: uvs,
            normals: spriteNormals,
            indices: spriteIndices
        });

        return mesh;
    };

    Sprite.prototype._create9SliceMesh = function () {
        // Check the supplied options and provide defaults for unspecified ones
        var he = pc.Vec2.ONE;
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

        return pc.createMesh(this._device, positions, options);
    };

    Sprite.prototype._onSetFrames = function (frames) {
        if (this._updatingProperties) {
            this._meshesDirty = true;
        } else {
            this._createMeshes();
        }
    };

    Sprite.prototype._onFrameChanged = function (frameKey, frame) {
        var idx = this._frameKeys.indexOf(frameKey);
        if (idx < 0) return;

        if (frame) {
            // only re-create frame for simple render mode, since
            // 9-sliced meshes don't need frame info to create their mesh
            if (this.renderMode === pc.SPRITE_RENDERMODE_SIMPLE) {
                this._meshes[idx] = this._createSimpleMesh(frame);
            }
        } else {
            this._meshes[idx] = null;
        }

        this.fire('set:meshes');
    };

    Sprite.prototype._onFrameRemoved = function (frameKey) {
        var idx = this._frameKeys.indexOf(frameKey);
        if (idx < 0) return;

        this._meshes[idx] = null;
        this.fire('set:meshes');
    };

    Sprite.prototype.startUpdate = function () {
        this._updatingProperties = true;
        this._meshesDirty = false;
    };

    Sprite.prototype.endUpdate = function () {
        this._updatingProperties = false;
        if (this._meshesDirty && this._atlas && this._frameKeys) {
            this._createMeshes();

        }
        this._meshesDirty = false;
    };

    /**
     * @function
     * @name pc.Sprite#destroy
     * @description Free up the meshes created by the sprite.
     */
    Sprite.prototype.destroy = function () {
        var i;
        var len;

        // destroy old meshes
        for (i = 0, len = this._meshes.length; i < len; i++) {
            var mesh = this._meshes[i];
            if (!mesh) continue;

            mesh.vertexBuffer.destroy();
            for (var j = 0, len2 = mesh.indexBuffer.length; j < len2; j++) {
                mesh.indexBuffer[j].destroy();
            }
        }
        this._meshes.length = 0;
    };

    Object.defineProperty(Sprite.prototype, 'frameKeys', {
        get: function () {
            return this._frameKeys;
        },
        set: function (value) {
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
    });

    Object.defineProperty(Sprite.prototype, 'atlas', {
        get: function () {
            return this._atlas;
        },
        set: function (value) {
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
    });

    Object.defineProperty(Sprite.prototype, 'pixelsPerUnit', {
        get: function () {
            return this._pixelsPerUnit;
        },
        set: function (value) {
            if (this._pixelsPerUnit === value) return;

            this._pixelsPerUnit = value;
            this.fire('set:pixelsPerUnit', value);

            // simple mode uses pixelsPerUnit to create the mesh so re-create those meshes
            if (this._atlas && this._frameKeys && this.renderMode === pc.SPRITE_RENDERMODE_SIMPLE) {
                if (this._updatingProperties) {
                    this._meshesDirty = true;
                } else {
                    this._createMeshes();
                }
            }

        }
    });

    Object.defineProperty(Sprite.prototype, 'renderMode', {
        get: function () {
            return this._renderMode;
        },
        set: function (value) {
            if (this._renderMode === value)
                return;

            var prev = this._renderMode;
            this._renderMode = value;
            this.fire('set:renderMode', value);

            // re-create the meshes if we're going from simple to 9-sliced or vice versa
            if (prev === pc.SPRITE_RENDERMODE_SIMPLE || value === pc.SPRITE_RENDERMODE_SIMPLE) {
                if (this._atlas && this._frameKeys) {
                    if (this._updatingProperties) {
                        this._meshesDirty = true;
                    } else {
                        this._createMeshes();
                    }
                }
            }
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
