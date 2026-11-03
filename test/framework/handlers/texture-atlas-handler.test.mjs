import { expect } from 'chai';

import { Asset } from '../../../src/framework/asset/asset.js';
import { FILTER_NEAREST } from '../../../src/platform/graphics/constants.js';
import { Sprite } from '../../../src/scene/sprite.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

const frameData = frame => ({
    rect: [frame.rect.x, frame.rect.y, frame.rect.z, frame.rect.w],
    pivot: [frame.pivot.x, frame.pivot.y],
    border: [frame.border.x, frame.border.y, frame.border.z, frame.border.w]
});

describe('TextureAtlasHandler', function () {

    let app;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
    });

    afterEach(function () {
        app?.destroy();
        app = null;
        jsdomTeardown();
    });

    const loadAtlas = (url, data, callback) => {
        const asset = new Asset('atlas', 'textureatlas', { url }, data);
        app.assets.add(asset);
        asset.once('load', () => callback(null, asset));
        asset.once('error', err => callback(err, asset));
        app.assets.load(asset);
    };

    describe('sprite sheets', function () {

        it('loads a TexturePacker sheet with its frames as a hash', function (done) {
            loadAtlas('/test/assets/sprites/texturepacker-hash.json', null, (err, asset) => {
                if (err) {
                    done(err);
                    return;
                }

                const frames = asset.resource.frames;
                expect(Object.keys(frames)).to.deep.equal([
                    'pivot.png', 'trimmed.png', 'sliced.png'
                ]);

                // a pivot at the bottom, measured from the top
                expect(frameData(frames['pivot.png'])).to.deep.equal({
                    rect: [0, 16, 16, 16],
                    pivot: [0.5, 0],
                    border: [0, 0, 0, 0]
                });

                // a frame trimmed from the center of a 16x16 sprite
                expect(frameData(frames['trimmed.png'])).to.deep.equal({
                    rect: [16, 24, 8, 8],
                    pivot: [0.75, 0.75],
                    border: [0, 0, 0, 0]
                });

                // 9-slice borders as left, bottom, right and top
                expect(frameData(frames['sliced.png'])).to.deep.equal({
                    rect: [0, 0, 16, 16],
                    pivot: [0.5, 0.5],
                    border: [2, 5, 4, 3]
                });

                done();
            });
        });

        it('loads an Aseprite sheet with its frames as an array', function (done) {
            loadAtlas('/test/assets/sprites/aseprite-array.json', null, (err, asset) => {
                if (err) {
                    done(err);
                    return;
                }

                const frames = asset.resource.frames;
                expect(Object.keys(frames)).to.deep.equal(['walk 0', 'walk 1']);
                expect(frameData(frames['walk 1'])).to.deep.equal({
                    rect: [16, 0, 16, 32],
                    pivot: [0.5, 0.5],
                    border: [0, 0, 0, 0]
                });
                done();
            });
        });

        it('places a trimmed frame where it sat in its untrimmed sprite', function (done) {
            loadAtlas('/test/assets/sprites/texturepacker-hash.json', null, (err, asset) => {
                if (err) {
                    done(err);
                    return;
                }

                const sprite = new Sprite(app.graphicsDevice, {
                    atlas: asset.resource,
                    frameKeys: ['trimmed.png'],
                    pixelsPerUnit: 1
                });

                // the frame covers x 2 to 10 and y 6 to 14 (from the top) of the 16x16 sprite,
                // so its corners sit at these offsets from the sprite's center
                const positions = [];
                sprite.meshes[0].getPositions(positions);
                const xs = positions.filter((v, i) => i % 3 === 0);
                const ys = positions.filter((v, i) => i % 3 === 1);
                expect([Math.min(...xs), Math.max(...xs)]).to.deep.equal([-6, 2]);
                expect([Math.min(...ys), Math.max(...ys)]).to.deep.equal([-6, 2]);

                sprite.destroy();
                done();
            });
        });

        it('creates the image with the texture settings in the asset data', function (done) {
            const data = { srgb: true, minfilter: 'nearest', mipmaps: false };
            loadAtlas('/test/assets/sprites/aseprite-array.json', data, (err, asset) => {
                if (err) {
                    done(err);
                    return;
                }

                const texture = asset.resource.texture;
                expect(texture.srgb).to.equal(true);
                expect(texture.minFilter).to.equal(FILTER_NEAREST);
                expect(texture.mipmaps).to.equal(false);
                done();
            });
        });

        it('loads the image named by meta.image, beside the sheet', function (done) {
            const url = '/test/assets/sprites/texturepacker-hash.json';
            app.assets.loadFromUrl(url, 'textureatlas', (err, asset) => {
                if (err) {
                    done(err);
                    return;
                }

                expect(asset.resource.texture).to.exist;
                expect(Object.keys(asset.resource.frames)).to.have.length(3);
                done();
            });
        });

        it('fails to load a sheet with a rotated frame', function (done) {
            loadAtlas('/test/assets/sprites/sprite-sheet-rotated.json', null, (err) => {
                expect(err).to.be.a('string');
                expect(err).to.include('sprite-sheet-rotated.json');
                expect(err).to.include('frame "rotated.png" is rotated');
                done();
            });
        });

        it('fails to load a sheet whose image is missing', function (done) {
            app.loader.getHandler('texture').maxRetries = 0;
            loadAtlas('/test/assets/sprites/sprite-sheet-missing-image.json', null, (err) => {
                expect(String(err)).to.include('missing.png');
                done();
            });
        });
    });

    describe('texture atlas JSON', function () {

        it('loads the PNG of the same name beside the JSON file', function (done) {
            const url = '/test/assets/sprites/red-atlas.json';
            app.assets.loadFromUrl(url, 'textureatlas', (err, asset) => {
                if (err) {
                    done(err);
                    return;
                }

                expect(asset.resource.texture).to.exist;
                done();
            });
        });
    });

    describe('reloading', function () {

        // unloading destroys the texture, so loading again needs a new one
        const reload = (url, done) => {
            loadAtlas(url, null, (err, asset) => {
                if (err) {
                    done(err);
                    return;
                }

                const first = asset.resource.texture;

                // unload outside the load event
                setTimeout(() => {
                    asset.unload();
                    asset.once('load', () => {
                        const texture = asset.resource.texture;
                        expect(texture).to.not.equal(first);
                        expect(texture.device).to.exist;
                        done();
                    });
                    asset.once('error', done);
                    app.assets.load(asset);
                });
            });
        };

        it('loads a new texture for texture atlas JSON', function (done) {
            reload('/test/assets/sprites/red-atlas.json', done);
        });

        it('loads a new texture for a sprite sheet', function (done) {
            reload('/test/assets/sprites/aseprite-array.json', done);
        });
    });
});
