import { expect } from 'chai';

import { isSpriteSheet, parseSpriteSheet } from '../../../src/framework/parsers/sprite-sheet.js';

// a sprite sheet of 64x32 pixels, with one frame
const sheet = (frame, meta = {}) => ({
    frames: { frame },
    meta: { size: { w: 64, h: 32 }, ...meta }
});

describe('Sprite sheet parser', function () {

    describe('isSpriteSheet', function () {

        it('accepts frames holding a frame rectangle', function () {
            const data = { frames: { a: { frame: { x: 0, y: 0, w: 1, h: 1 } } } };
            expect(isSpriteSheet(data)).to.equal(true);
            expect(isSpriteSheet({ frames: [data.frames.a] })).to.equal(true);
        });

        it('accepts a sheet that names its image', function () {
            expect(isSpriteSheet({ frames: {}, meta: { image: 'sheet.png' } })).to.equal(true);
        });

        it('rejects texture atlas data', function () {
            const frame = { rect: [0, 0, 16, 16], pivot: [0.5, 0.5], border: [0, 0, 0, 0] };
            expect(isSpriteSheet({ frames: { 0: frame } })).to.equal(false);
            expect(isSpriteSheet({ frames: [0, 0, 32, 32], pivot: [0.5, 0.5] })).to.equal(false);
            expect(isSpriteSheet({ frames: {} })).to.equal(false);
            expect(isSpriteSheet(null)).to.equal(false);
        });
    });

    describe('parseSpriteSheet', function () {

        it('measures a frame rectangle from the bottom-left', function () {
            const frames = parseSpriteSheet(sheet({ frame: { x: 8, y: 4, w: 16, h: 12 } }));
            expect(frames.frame).to.deep.equal({
                rect: [8, 16, 16, 12],
                pivot: [0.5, 0.5],
                border: [0, 0, 0, 0]
            });
        });

        it('uses the image size when the sheet has no meta.size', function () {
            const frames = parseSpriteSheet({
                frames: { frame: { frame: { x: 0, y: 0, w: 16, h: 16 } } }
            }, 32, 64);
            expect(frames.frame.rect).to.deep.equal([0, 48, 16, 16]);
        });

        it('keys the frames of an array by filename, in order', function () {
            const frames = parseSpriteSheet({
                frames: [
                    { filename: 'b', frame: { x: 0, y: 0, w: 8, h: 8 } },
                    { filename: 'a', frame: { x: 8, y: 0, w: 8, h: 8 } }
                ],
                meta: { size: { w: 16, h: 8 } }
            });
            expect(Object.keys(frames)).to.deep.equal(['b', 'a']);
            expect(frames.a.rect).to.deep.equal([8, 0, 8, 8]);
        });

        it('flips a pivot measured from the top', function () {
            const frames = parseSpriteSheet(sheet({
                frame: { x: 0, y: 0, w: 16, h: 16 },
                pivot: { x: 0.25, y: 0.75 }
            }));
            expect(frames.frame.pivot).to.deep.equal([0.25, 0.25]);
        });

        it('reads an anchor as the pivot', function () {
            const frames = parseSpriteSheet(sheet({
                frame: { x: 0, y: 0, w: 16, h: 16 },
                anchor: { x: 0, y: 0 }
            }));
            expect(frames.frame.pivot).to.deep.equal([0, 1]);
        });

        it('keeps a pivot from the PlayCanvas exporter, measured from the bottom', function () {
            const frames = parseSpriteSheet(sheet({
                frame: { x: 0, y: 0, w: 16, h: 16 },
                pivot: { x: 0.25, y: 0.75 }
            }, { exporter: 'playcanvas' }));
            expect(frames.frame.pivot).to.deep.equal([0.25, 0.75]);
        });

        it('moves the pivot of a trimmed frame to keep the frame in place', function () {
            // an 8x4 frame trimmed from the top-left corner of a 16x16 sprite
            const frames = parseSpriteSheet(sheet({
                frame: { x: 0, y: 0, w: 8, h: 4 },
                trimmed: true,
                spriteSourceSize: { x: 0, y: 0, w: 8, h: 4 },
                sourceSize: { w: 16, h: 16 }
            }));
            expect(frames.frame.pivot).to.deep.equal([1, -1]);
        });

        it('treats a pivot as relative to a frame that is not trimmed', function () {
            // crop modes record an offset, but mark the frame as untrimmed
            const frames = parseSpriteSheet(sheet({
                frame: { x: 0, y: 0, w: 8, h: 8 },
                trimmed: false,
                spriteSourceSize: { x: 4, y: 4, w: 8, h: 8 },
                sourceSize: { w: 8, h: 8 },
                pivot: { x: 0.25, y: 0.25 }
            }));
            expect(frames.frame.pivot).to.deep.equal([0.25, 0.75]);
        });

        it('converts 9-slice borders', function () {
            const center = parseSpriteSheet(sheet({
                frame: { x: 0, y: 0, w: 16, h: 16 },
                borders: { x: 1, y: 2, w: 12, h: 10 }
            }));
            expect(center.frame.border).to.deep.equal([1, 4, 3, 2]);

            const sides = parseSpriteSheet(sheet({
                frame: { x: 0, y: 0, w: 16, h: 16 },
                borders: { left: 1, top: 2, right: 3, bottom: 4 }
            }));
            expect(sides.frame.border).to.deep.equal([1, 4, 3, 2]);
        });

        it('rejects a rotated frame', function () {
            expect(() => parseSpriteSheet(sheet({
                frame: { x: 0, y: 0, w: 16, h: 8 },
                rotated: true
            }))).to.throw('frame "frame" is rotated');
        });

        it('rejects a frame outside the sheet', function () {
            expect(() => parseSpriteSheet(sheet({
                frame: { x: 56, y: 0, w: 16, h: 8 }
            }))).to.throw('frame "frame" lies outside the 64x32 sheet');
        });

        it('rejects a trimmed frame that does not fit its untrimmed sprite', function () {
            expect(() => parseSpriteSheet(sheet({
                frame: { x: 0, y: 0, w: 8, h: 8 },
                trimmed: true,
                spriteSourceSize: { x: 4, y: 4, w: 8, h: 8 },
                sourceSize: { w: 8, h: 8 }
            }))).to.throw('frame "frame" does not fit in its untrimmed sprite');
        });

        it('rejects a frame without a rectangle', function () {
            expect(() => parseSpriteSheet(sheet({ frame: { x: 0, y: 0, w: 8 } })))
            .to.throw('frame "frame" has no frame rectangle');
        });

        it('rejects an array frame without a filename', function () {
            expect(() => parseSpriteSheet({
                frames: [{ frame: { x: 0, y: 0, w: 8, h: 8 } }],
                meta: { size: { w: 8, h: 8 } }
            })).to.throw('frame 0 has no filename');
        });

        it('rejects a sheet without frames or a size', function () {
            expect(() => parseSpriteSheet({ meta: { size: { w: 8, h: 8 } } }))
            .to.throw('the sheet has no frames');
            expect(() => parseSpriteSheet({ frames: {} }))
            .to.throw('the sheet has no valid meta.size');
        });
    });
});
