Object.assign(pc, function () {
    'use strict';

    /**
     * @constructor
     * @name pc.TextureAtlas
     * @classdesc A pc.TextureAtlas contains a number of frames from a texture. Each frame defines a region in
     * a texture. The pc.TextureAtlas is referenced by {@link pc.Sprite}s.
     * @property {pc.Texture} texture The texture atlas.
     * @property {Object} frames Contains frames which define portions of the texture atlas.
     * @example
     * var atlas = new pc.TextureAtlas();
     * atlas.frames = {
     *   '0': {
     *       // rect has u, v, width and height in pixels
     *       rect: new pc.Vec4(0, 0, 256, 256),
     *       // pivot has x, y values between 0-1 which define the point
     *       // within the frame around which rotation and scale is calculated
     *       pivot: new pc.Vec2(0.5, 0.5),
     * .      // border has left, bottom, right and top in pixels defining regions for 9-slicing
     * .      border: new pc.Vec4(5, 5, 5, 5)
     *   },
     *   '1': {
     *       rect: new pc.Vec4(256, 0, 256, 256),
     *       pivot: new pc.Vec2(0.5, 0.5),
     *       border: new pc.Vec4(5, 5, 5, 5)
     *   },
     *   ...
     * };
     */
    var TextureAtlas = function () {
        this._texture = null;
        this._frames = null;
        pc.events.attach(this);
    };

    /**
     * @function
     * @name pc.TextureAtlas#setFrame
     * @param {String} key The key of the frame.
     * @param {Object} data The properties of the frame.
     * @param {pc.Vec4} [data.rect] The u, v, width, height properties of the frame in pixels.
     * @param {pc.Vec2} [data.pivot] The pivot of the frame - values are between 0-1.
     * @param {pc.Vec4} [data.border] The border of the frame for 9-slicing. Values are left, bottom, right, top border in pixels.
     * @example
     * atlas.setFrame('1', {
     *    rect: new pc.Vec4(0,0,128,128),
     *    pivot: new pc.Vec2(0.5, 0.5),
     *    border: new pc.Vec4(5, 5, 5, 5)
     * });
     */
    TextureAtlas.prototype.setFrame = function (key, data) {
        var frame = this._frames[key];
        if (!frame) {
            frame = {
                rect: data.rect.clone(),
                pivot: data.pivot.clone(),
                border: data.border.clone()
            };
            this._frames[key] = frame;
        } else {
            frame.rect.copy(data.rect);
            frame.pivot.copy(data.pivot);
            frame.border.copy(data.border);
        }

        this.fire('set:frame', key.toString(), frame);
    };

    /**
     * @function
     * @name pc.TextureAtlas#removeFrame
     * @param {String} key The key of the frame.
     * @example
     * atlas.removeFrame('1');
     */
    TextureAtlas.prototype.removeFrame = function (key) {
        var frame = this._frames[key];
        if (frame) {
            delete this._frames[key];
            this.fire('remove:frame', key.toString(), frame);
        }
    };

    /**
     * @function
     * @name pc.TextureAtlas#destroy
     * @description Free up the underlying WebGL resource owned by the texture.
     */
    TextureAtlas.prototype.destroy = function () {
        if (this._texture) {
            this._texture.destroy();
        }
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
