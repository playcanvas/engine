pc.extend(pc, function () {
    'use strict';

    /**
     * @private
     * @enum pc.SPRITE_RENDERMODE
     * @name pc.SPRITE_RENDERMODE_SIMPLE
     * @description This mode renders a sprite as a simple quad.
     */
    pc.SPRITE_RENDERMODE_SIMPLE = 0;

    /**
     * @private
     * @enum pc.SPRITE_RENDERMODE
     * @name pc.SPRITE_RENDERMODE_SLICED
     * @description This mode renders a sprite using 9-slicing in 'sliced' mode. Sliced mode stretches the
     * top and bottom regions of the sprite horizontally, the left and right regions vertically and the middle region
     * both horizontally and vertically.
     */
    pc.SPRITE_RENDERMODE_SLICED = 1;

    /**
     * @private
     * @enum pc.SPRITE_RENDERMODE
     * @name pc.SPRITE_RENDERMODE_TILED
     * @description This mode renders a sprite using 9-slicing in 'tiled' mode. Tiled mode tiles the
     * top and bottom regions of the sprite horizontally, the left and right regions vertically and the middle region
     * both horizontally and vertically.
     */
    pc.SPRITE_RENDERMODE_TILED = 2;

    // normals are the same for every mesh
    var normals = [
        0, 0, 1,
        0, 0, 1,
        0, 0, 1,
        0, 0, 1
    ];

    // indices are the same for every mesh
    var indices = [
        0, 1, 3,
        2, 3, 1
    ];


    /**
    * @private
    * @name pc.Sprite
    * @class A pc.Sprite is contains references to one or more frames of a {@link pc.TextureAtlas}. It can be used by the {@link pc.SpriteComponent} or the
    * {@link pc.ElementComponent} to render a single frame or a sprite animation.
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
        var count = this._frameKeys.length;
        this._meshes = new Array(count);

        // create a mesh for each frame in the sprite
        for (i = 0; i < count; i++) {
            var frame = this._atlas.frames[this._frameKeys[i]];
            this._meshes[i] = this._createMesh(frame);
        }

        this.fire('set:meshes');
    };

    Sprite.prototype._createMesh = function (frame) {
        if (! frame) return null;

        var rect = frame.rect;
        var texWidth = this._atlas.texture.width;
        var texHeight = this._atlas.texture.height;

        var w = rect.data[2] / this._pixelsPerUnit;
        var h = rect.data[3] / this._pixelsPerUnit;
        var hp = frame.pivot.x;
        var vp = frame.pivot.y;

        // positions based on pivot and size of frame
        var positions = [
            -hp*w,          -vp*h,          0,
            (1 - hp) * w,   -vp*h,          0,
            (1 - hp) * w,   (1 - vp) * h,   0,
            -hp*w,          (1 - vp) * h,   0
        ];


        // uvs based on frame rect
        // uvs
        var lu = rect.data[0] / texWidth;
        var bv = rect.data[1] / texHeight;
        var ru = (rect.data[0] + rect.data[2]) / texWidth;
        var tv = (rect.data[1] + rect.data[3]) / texHeight;

        var uvs = [
            lu, bv,
            ru, bv,
            ru, tv,
            lu, tv
        ];

        var mesh = pc.createMesh(this._device, positions, {
            uvs: uvs,
            normals: normals,
            indices: indices
        });

        return mesh;
    };

    Sprite.prototype._onSetFrames = function (frames) {
        this._createMeshes();
    };

    Sprite.prototype._onFrameChanged = function (frameKey, frame) {
        var idx = this._frameKeys.indexOf(frameKey);
        if (idx < 0) return;

        this._meshes[idx] = this._createMesh(frame);
        this.fire('set:meshes');
    };

    Sprite.prototype._onFrameRemoved = function (frameKey) {
        var idx = this._frameKeys.indexOf(frameKey);
        if (idx < 0) return;

        this._meshes[idx] = null;
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
