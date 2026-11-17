// Converts the sprite sheet JSON that TexturePacker and Aseprite export into texture atlas
// frames. Each frame of a sprite sheet has a rectangle on the sheet measured from the top-left, and
// a trimmed frame records where it sat in its untrimmed sprite. A texture atlas frame has a
// rectangle measured from the bottom-left and no untrimmed sprite, so the pivot of a trimmed frame
// moves to keep the frame where it sat.

const isNumber = value => typeof value === 'number' && Number.isFinite(value);

/**
 * Returns whether parsed JSON is a sprite sheet, rather than texture atlas data. A sprite sheet
 * names its image in `meta.image`, or its frames hold a `frame` rectangle.
 *
 * @param {object} data - The parsed JSON.
 * @returns {boolean} True if the JSON is a sprite sheet.
 * @ignore
 */
const isSpriteSheet = (data) => {
    if (typeof data?.meta?.image === 'string') {
        return true;
    }

    // the first frame decides
    const frames = data?.frames;
    const first = frames && typeof frames === 'object' ? Object.values(frames)[0] : null;
    return !!first?.frame && typeof first.frame === 'object';
};

/**
 * Converts the frames of a sprite sheet into the frames of texture atlas data, keyed by frame
 * name. Rejects a sheet whose frames would sample the wrong part of the image.
 *
 * @param {object} data - The sprite sheet JSON.
 * @param {number} width - The width of the sheet image, used when the sheet has no `meta.size`.
 * @param {number} height - The height of the sheet image, used when the sheet has no `meta.size`.
 * @returns {object} The texture atlas frames, each with `rect`, `pivot` and `border` arrays.
 * @throws {Error} If the sheet has no frames, or a frame is rotated, lies outside the sheet or
 * does not fit its untrimmed sprite.
 * @ignore
 */
const parseSpriteSheet = (data, width, height) => {
    const meta = data.meta ?? {};
    const sheetWidth = meta.size ? meta.size.w : width;
    const sheetHeight = meta.size ? meta.size.h : height;
    if (!isNumber(sheetWidth) || !isNumber(sheetHeight) || sheetWidth <= 0 || sheetHeight <= 0) {
        throw new Error('the sheet has no valid meta.size');
    }

    let entries;
    if (Array.isArray(data.frames)) {
        entries = data.frames.map((entry, index) => {
            if (typeof entry?.filename !== 'string') {
                throw new Error(`frame ${index} has no filename`);
            }
            return [entry.filename, entry];
        });
    } else if (data.frames && typeof data.frames === 'object') {
        entries = Object.entries(data.frames);
    } else {
        throw new Error('the sheet has no frames');
    }

    // TexturePacker's PlayCanvas exporter measures pivots from the bottom, the others from the top
    const pivotFromBottom = meta.exporter === 'playcanvas';

    const frames = {};
    for (const [name, entry] of entries) {
        const rect = entry?.frame;
        if (!isNumber(rect?.x) || !isNumber(rect.y) || !isNumber(rect.w) || !isNumber(rect.h)) {
            throw new Error(`frame "${name}" has no frame rectangle`);
        }

        if (entry.rotated) {
            throw new Error(`frame "${name}" is rotated, which is not supported. ` +
                'Export the sheet with rotation disabled.');
        }

        const { x, y, w, h } = rect;
        if (x < 0 || y < 0 || w < 0 || h < 0 || x + w > sheetWidth || y + h > sheetHeight) {
            throw new Error(`frame "${name}" lies outside the ${sheetWidth}x${sheetHeight} sheet`);
        }

        // a trimmed frame sits at an offset in its untrimmed sprite, which the pivot is relative
        // to. Crop modes mark their frames as untrimmed, as their pivots are relative to the frame.
        const source = entry.sourceSize;
        const offset = entry.spriteSourceSize;
        const trimmed = entry.trimmed !== false && !!source && !!offset;
        const sourceWidth = trimmed ? source.w : w;
        const sourceHeight = trimmed ? source.h : h;
        const offsetX = trimmed ? offset.x : 0;
        const offsetY = trimmed ? offset.y : 0;

        // written so that a missing size or offset fails too
        const fits = offsetX >= 0 && offsetY >= 0 &&
            offsetX + w <= sourceWidth && offsetY + h <= sourceHeight;
        if (!fits) {
            throw new Error(`frame "${name}" does not fit in its untrimmed sprite (sourceSize)`);
        }

        // the pivot in pixels from the top-left of the untrimmed sprite, centered by default
        const pivot = entry.pivot ?? entry.anchor;
        const px = pivot?.x ?? 0.5;
        const py = pivot?.y ?? 0.5;
        const pivotX = px * sourceWidth;
        const pivotY = (pivotFromBottom ? 1 - py : py) * sourceHeight;

        // 9-slice borders, as the center rectangle from TexturePacker or the four borders
        const borders = entry.borders;
        let border = [0, 0, 0, 0];
        if (borders && 'left' in borders) {
            border = [borders.left, borders.bottom, borders.right, borders.top];
        } else if (borders) {
            border = [
                Math.max(0, borders.x),
                Math.max(0, h - borders.y - borders.h),
                Math.max(0, w - borders.x - borders.w),
                Math.max(0, borders.y)
            ];
        }

        frames[name] = {
            rect: [x, sheetHeight - y - h, w, h],
            pivot: [
                w > 0 ? (pivotX - offsetX) / w : 0.5,
                h > 0 ? 1 - (pivotY - offsetY) / h : 0.5
            ],
            border
        };
    }

    return frames;
};

export { isSpriteSheet, parseSpriteSheet };
