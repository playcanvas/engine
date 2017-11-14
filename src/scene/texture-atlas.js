pc.extend(pc, function () {
    'use strict';

    /**
    * @name pc.TextureAtlas
    * @class Represents the resource of a texture atlas asset.
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
        this.texture = null;
        this.frames = null;
    };

    return {
        TextureAtlas: TextureAtlas
    };
}());
