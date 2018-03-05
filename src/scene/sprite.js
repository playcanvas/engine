pc.extend(pc, function () {
    'use strict';

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
    * @class Represents the resource of a sprite asset.
    * @param {pc.GraphicsDevice} device The graphics device of the application.
    * @property {Number} pixelsPerUnit The number of pixels that map to one PlayCanvas unit.
    * @property {pc.TextureAtlas} atlas The texture atlas.
    * @property {String[]} frameKeys The keys of the frames in the sprite atlas that this sprite is using.
    * @property {pc.Mesh[]} meshes An array that contains a mesh for each frame.
    */
    var Sprite = function (device) {
        this._device = device;
        this._pixelsPerUnit = 1;
        this._atlas = null;
        this._meshes = [];
        this._frameKeys = null;
        pc.events.attach(this);
    };

    Sprite.prototype._createMeshes = function () {
        var i, len;

        // destroy old meshes
        for (i = 0, len = this._meshes.length; i < len; i++) {
            this._meshes[i].vertexBuffer.destroy();
            for (var j = 0, len2 = this._meshes[i].indexBuffer.length; j<len2; j++) {
                this._meshes[i].indexBuffer[j].destroy();
            }
        }

        // clear meshes array
        this._meshes.length = 0;

        var count = this._frameKeys.length;

        // create a mesh for each frame in the sprite
        for (i = 0; i < count; i++) {
            var mesh = null;
            var frame = this._atlas.frames[this._frameKeys[i]];

            if (frame) {
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
                var uvs = [
                    rect.data[0] / texWidth,                  rect.data[1] / texHeight,
                    (rect.data[0] + rect.data[2]) / texWidth, rect.data[1] / texHeight,
                    (rect.data[0] + rect.data[2]) / texWidth, (rect.data[1] + rect.data[3]) / texHeight,
                    rect.data[0] / texWidth,                  (rect.data[1] + rect.data[3]) / texHeight
                ];

                // create mesh and add it to our list
                mesh = pc.createMesh(this._device, positions, {uvs: uvs, normals: normals, indices: indices});
                mesh.aabb.compute(positions);
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
            if (this._atlas && this._frameKeys)
                this._createMeshes();
        }
    });

    Object.defineProperty(Sprite.prototype, 'atlas', {
        get: function () {
            return this._atlas;
        },
        set: function (value) {
            if (value === this._atlas) return;

            this._atlas = value;
            if (this._atlas && this._frameKeys)
                this._createMeshes();
        }
    });

    Object.defineProperty(Sprite.prototype, 'pixelsPerUnit', {
        get: function () {
            return this._pixelsPerUnit;
        },
        set: function (value) {
            if (this._pixelsPerUnit === value) return;

            this._pixelsPerUnit = value;
            if (this._atlas && this._frameKeys)
                this._createMeshes();
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
