pc.extend(pc, function () {
    'use strict';

    /**
    * @name pc.Sprite
    * @class Represents the resource of a sprite asset.
    * @property {Number} pixelsPerUnit The number of pixels that map to one PlayCanvas unit.
    * @property {pc.SpriteAtlas} atlas The sprite atlas.
    * @property {String[]} frameKeys The keys of the frames in the sprite atlas that this sprite is using.
    */
    var Sprite = function () {
        this.pixelsPerUnit = 1;
        this.atlas = null;
        this.frameKeys = null;
    };

    return {
        Sprite: Sprite
    };
}());
