pc.extend(pc, function () {
    'use strict';

    var Sprite = function () {
        this.pixelsPerUnit = 1;
        this.atlas = null;
        this.frameKeys = null;
    };

    return {
        Sprite: Sprite
    };
}());
