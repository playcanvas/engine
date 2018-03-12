pc.extend(pc, function () {
    'use strict';

    /**
    * @private
    * @name pc.TextureAtlas
    * @class A pc.TextureAtlas contains a number of frames from a texture. Each frame defines a region in
    * a texture. The pc.TextureAtlas is referenced by {@link pc.Sprite}s.
    * @property {pc.Texture} texture The texture atlas.
    * @property {Object} frames Contains frames which define portions of the texture atlas.
    * @example
    * var atlas = new pc.TextureAtlas();
    * atlas.frames = {
    *   '0': {
    *       // rect has u, v, width and height which are 0-1 values
    *       rect: new pc.Vec4(0, 0, 0.5, 0.5),
    *       // pivot has x, y values between 0-1 which define the point
    *       // within the frame around which rotation and scale is calculated
    *       pivot: new pc.Vec2(0.5, 0.5)
    *   },
    *   '1': {
    *       rect: new pc.Vec4(0.5, 0.5, 0.5, 0.5),
    *       pivot: new pc.Vec2(0.5, 0.5)
    *   },
    *   ...
    * };
    */
    var TextureAtlas = function () {
        this._texture = null;
        this._frames = null;
        pc.events.attach(this);
    };

    Object.defineProperty(TextureAtlas.prototype, 'texture', {
        get: function () {
            return this._texture;
        },
        set: function (value) {
            this._texture = value;
            this.fire('set:texture', value);
        }
    });

    Object.defineProperty(TextureAtlas.prototype, 'frames', {
        get: function () {
            return this._frames;
        },
        set: function (value) {
            this._frames = value;
            this.fire('set:frames', value);
        }
    });

    return {
        TextureAtlas: TextureAtlas
    };
}());
