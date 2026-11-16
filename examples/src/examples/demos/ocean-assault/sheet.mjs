// The sprite sheet of the Ocean Assault demo: sprites by frame name, text drawn with the font of the
// sheet, and pools of entities.

import { Color, Entity, SPRITE_RENDERMODE_SIMPLE, Sprite } from 'playcanvas';

/**
 * @import { GraphicsDevice, TextureAtlas } from 'playcanvas'
 */

/**
 * Makes sprites from the frames of the sheet. A pixel of the sheet is one world unit, and a pixel
 * of the screen.
 */
export class Sheet {
    /**
     * @param {GraphicsDevice} device - The graphics device.
     * @param {TextureAtlas} atlas - The texture atlas of the sheet.
     */
    constructor(device, atlas) {
        this.device = device;
        this.atlas = atlas;

        /** @type {Map<string, Sprite>} */
        this._sprites = new Map();
    }

    /**
     * @param {string} name - The start of the frame names.
     * @returns {string[]} The frames named name-0, name-1 and so on, in the order of the sheet.
     */
    frames(name) {
        const numbered = new RegExp(`^${name}-\\d+$`);
        return Object.keys(this.atlas.frames).filter((key) => numbered.test(key));
    }

    /**
     * @param {string} frame - The name of a frame.
     * @returns {{ width: number, height: number }} The size of the frame, in pixels.
     */
    size(frame) {
        const { rect } = this.atlas.frames[frame];
        return { width: rect.z, height: rect.w };
    }

    /**
     * @param {string[]} frames - The names of the frames of the sprite.
     * @param {number} [renderMode] - Tiled sprites repeat their frame to fill a width and height.
     * @returns {Sprite} The sprite of the frames, shared by every entity that asks for it.
     */
    sprite(frames, renderMode = SPRITE_RENDERMODE_SIMPLE) {
        const key = `${renderMode}:${frames.join()}`;
        let sprite = this._sprites.get(key);
        if (!sprite) {
            sprite = new Sprite(this.device, {
                atlas: this.atlas,
                frameKeys: frames,
                pixelsPerUnit: 1,
                renderMode
            });
            this._sprites.set(key, sprite);
        }
        return sprite;
    }

    /**
     * @param {string} name - The start of the frame names.
     * @returns {Sprite} A sprite of the frames named name-0, name-1 and so on.
     */
    animation(name) {
        return this.sprite(this.frames(name));
    }

    destroy() {
        for (const sprite of this._sprites.values()) {
            sprite.destroy();
        }
        this._sprites.clear();
    }
}

// The characters of the font, in the order of the frames of its sprite
const CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-!:.x';
const GLYPH_NAMES = { '-': 'dash', '!': 'bang', ':': 'colon', '.': 'dot', x: 'times' };
const GLYPH_WIDTH = 6;

/**
 * A line of text, drawn with one sprite for each character.
 */
export class Label {
    /**
     * @param {Sheet} sheet - The sprite sheet.
     * @param {Entity} parent - The entity to add the label to.
     * @param {object} options - The options.
     * @param {number} options.length - The most characters the label shows.
     * @param {number[]} options.position - The x, y and z position: of the left of the text, its
     * middle or its right, depending on how it is aligned.
     * @param {'left'|'center'|'right'} [options.align] - How the text is aligned.
     * @param {Color} [options.color] - The color of the text.
     */
    constructor(sheet, parent, { length, position, align = 'left', color = Color.WHITE }) {
        const font = sheet.sprite(CHARACTERS.split('').map((ch) => `font-${GLYPH_NAMES[ch] ?? ch}`));

        this.align = align;
        this._color = color;
        this.entity = new Entity('label');
        this.entity.setLocalPosition(position[0], position[1], position[2]);
        parent.addChild(this.entity);

        /** @type {Entity[]} */
        this.glyphs = [];
        for (let i = 0; i < length; i++) {
            const glyph = new Entity('glyph');
            glyph.addComponent('sprite', { sprite: font, color });
            glyph.enabled = false;
            this.entity.addChild(glyph);
            this.glyphs.push(glyph);
        }

        this._text = '';
    }

    /**
     * @type {string}
     */
    set text(value) {
        if (value === this._text) return;
        this._text = value;

        const width = value.length * GLYPH_WIDTH;
        const left = this.align === 'left' ? 0 : this.align === 'right' ? -width : -Math.floor(width / 2);
        this.glyphs.forEach((glyph, i) => {
            const frame = i < value.length ? CHARACTERS.indexOf(value[i]) : -1;
            glyph.enabled = frame >= 0;
            if (frame >= 0) {
                glyph.sprite.frame = frame;
                glyph.setLocalPosition(left + i * GLYPH_WIDTH + GLYPH_WIDTH / 2, 0, 0);
            }
        });
    }

    get text() {
        return this._text;
    }

    /**
     * @type {Color}
     */
    set color(value) {
        if (value === this._color) return;
        this._color = value;
        for (const glyph of this.glyphs) {
            glyph.sprite.color = value;
        }
    }

    get color() {
        return this._color;
    }

    /**
     * @type {boolean}
     */
    set visible(value) {
        this.entity.enabled = value;
    }

    get visible() {
        return this.entity.enabled;
    }
}

/**
 * A fixed number of things made up front, such as shots, handed out and taken back as the game
 * needs them, so that nothing is created while it plays.
 *
 * @template {{ entity: Entity, active: boolean }} T
 */
export class Pool {
    /**
     * @param {number} size - The number of items.
     * @param {(index: number) => T} create - Makes an item. Its entity starts disabled.
     */
    constructor(size, create) {
        /** @type {T[]} */
        this.items = [];
        for (let i = 0; i < size; i++) {
            const item = create(i);
            item.active = false;
            item.entity.enabled = false;
            this.items.push(item);
        }
    }

    /**
     * @returns {T|null} An item that was not in use, with its entity enabled, or null if every
     * item is in use.
     */
    spawn() {
        for (const item of this.items) {
            if (!item.active) {
                item.active = true;
                item.entity.enabled = true;
                return item;
            }
        }
        return null;
    }

    /**
     * @param {T} item - The item to take back.
     */
    free(item) {
        item.active = false;
        item.entity.enabled = false;
    }

    freeAll() {
        for (const item of this.items) {
            if (item.active) this.free(item);
        }
    }
}
