import { EventHandler } from '../core/event-handler.js';

/**
 * @class
 * @name TextureAtlas
 * @augments EventHandler
 * @classdesc A pc.TextureAtlas contains a number of frames from a texture. Each frame
 * defines a region in a texture. The pc.TextureAtlas is referenced by {@link Sprite}s.
 * @property {pc.Texture} texture The texture atlas.
 * @property {object} frames Contains frames which define portions of the texture atlas.
 * @example
 * var atlas = new pc.TextureAtlas();
 * atlas.frames = {
 *     '0': {
 *         // rect has u, v, width and height in pixels
 *         rect: new pc.Vec4(0, 0, 256, 256),
 *         // pivot has x, y values between 0-1 which define the point
 *         // within the frame around which rotation and scale is calculated
 *         pivot: new pc.Vec2(0.5, 0.5),
 *         // border has left, bottom, right and top in pixels defining regions for 9-slicing
 *         border: new pc.Vec4(5, 5, 5, 5)
 *     },
 *     '1': {
 *         rect: new pc.Vec4(256, 0, 256, 256),
 *         pivot: new pc.Vec2(0.5, 0.5),
 *         border: new pc.Vec4(5, 5, 5, 5)
 *     }
 * };
 */
class TextureAtlas extends EventHandler {
    constructor() {
        super();

        this._texture = null;
        this._frames = null;
    }

    /**
     * @function
     * @name TextureAtlas#setFrame
     * @param {string} key - The key of the frame.
     * @param {object} data - The properties of the frame.
     * @param {pc.Vec4} data.rect - The u, v, width, height properties of the frame in pixels.
     * @param {pc.Vec2} data.pivot - The pivot of the frame - values are between 0-1.
     * @param {pc.Vec4} data.border - The border of the frame for 9-slicing. Values are ordered
     * as follows: left, bottom, right, top border in pixels.
     * @example
     * atlas.setFrame('1', {
     *     rect: new pc.Vec4(0, 0, 128, 128),
     *     pivot: new pc.Vec2(0.5, 0.5),
     *     border: new pc.Vec4(5, 5, 5, 5)
     * });
     */
    setFrame(key, data) {
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
    }

    /**
     * @function
     * @name TextureAtlas#removeFrame
     * @param {string} key - The key of the frame.
     * @example
     * atlas.removeFrame('1');
     */
    removeFrame(key) {
        var frame = this._frames[key];
        if (frame) {
            delete this._frames[key];
            this.fire('remove:frame', key.toString(), frame);
        }
    }

    /**
     * @function
     * @name TextureAtlas#destroy
     * @description Free up the underlying texture owned by the atlas.
     */
    destroy() {
        if (this._texture) {
            this._texture.destroy();
        }
    }

    get texture() {
        return this._texture;
    }

    set texture(value) {
        this._texture = value;
        this.fire('set:texture', value);
    }

    get frames() {
        return this._frames;
    }

    set frames(value) {
        this._frames = value;
        this.fire('set:frames', value);
    }
}

export { TextureAtlas };
