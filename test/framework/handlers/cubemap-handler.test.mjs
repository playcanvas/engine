import { expect } from 'chai';

import { Asset } from '../../../src/framework/asset/asset.js';
import {
    PIXELFORMAT_RGBA8, TEXTURETYPE_DEFAULT, TEXTURETYPE_RGBM, TEXTURETYPE_RGBP
} from '../../../src/platform/graphics/constants.js';
import { Texture } from '../../../src/platform/graphics/texture.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('CubemapHandler', function () {

    let app;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();

        // images can't be decoded here, so the image parser skips the decode and creates the
        // texture it would create for a PNG or JPG image
        const imgParser = app.loader.getHandler('texture').imgParser;
        imgParser.load = (url, callback) => callback(null, {});
        imgParser.open = (url, data, device, textureOptions) => new Texture(device, {
            width: 4,
            height: 4,
            format: PIXELFORMAT_RGBA8,
            ...textureOptions
        });
    });

    afterEach(function () {
        app?.destroy();
        app = null;
        jsdomTeardown();
    });

    const faceUrls = ['posx.png', 'negx.png', 'posy.png', 'negy.png', 'posz.png', 'negz.png'];

    // loads a cubemap asset, resolving with it once it is loaded
    const loadCubemap = (file, data) => new Promise((resolve, reject) => {
        const asset = new Asset('sky', 'cubemap', file, data);
        asset.loadFaces = true;
        asset.ready(resolve);
        asset.once('error', err => reject(new Error(err)));
        app.assets.add(asset);
        app.assets.load(asset);
    });

    describe('faces given as urls', function () {

        it('are sRGB color textures', async function () {
            const cubemap = await loadCubemap(null, { textures: faceUrls });

            expect(cubemap.resource.type).to.equal(TEXTURETYPE_DEFAULT);
            expect(cubemap.resource.srgb).to.be.true;
        });

        for (const data of [{ rgbm: false }, { type: TEXTURETYPE_DEFAULT }]) {
            it(`are sRGB when the cubemap specifies the default type with ${JSON.stringify(data)}`, async function () {
                const cubemap = await loadCubemap(null, { textures: faceUrls, ...data });

                expect(cubemap.resource.type).to.equal(TEXTURETYPE_DEFAULT);
                expect(cubemap.resource.srgb).to.be.true;
            });
        }

        const encodings = [
            [{ rgbm: true }, TEXTURETYPE_RGBM],
            [{ type: TEXTURETYPE_RGBM }, TEXTURETYPE_RGBM],
            [{ type: TEXTURETYPE_RGBP }, TEXTURETYPE_RGBP]
        ];
        for (const [data, type] of encodings) {
            it(`are linear when the cubemap specifies an encoding with ${JSON.stringify(data)}`, async function () {
                const cubemap = await loadCubemap(null, { textures: faceUrls, ...data });

                expect(cubemap.resource.type).to.equal(type);
                expect(cubemap.resource.srgb).to.be.false;
            });
        }
    });

    it('loads a prefiltered url as an rgbp env atlas', async function () {
        const cubemap = await loadCubemap({ url: 'sky.png', filename: 'sky.png' }, { textures: faceUrls });
        const envAtlas = cubemap.resources[1];

        expect(envAtlas.type).to.equal(TEXTURETYPE_RGBP);
        expect(envAtlas.srgb).to.be.false;
        expect(envAtlas.mipmaps).to.be.false;

        // the faces are not affected by the env atlas state
        expect(cubemap.resource.type).to.equal(TEXTURETYPE_DEFAULT);
        expect(cubemap.resource.srgb).to.be.true;
    });
});
