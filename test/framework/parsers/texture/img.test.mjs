import { expect } from 'chai';
import { restore, spy, stub } from 'sinon';

import { Asset } from '../../../../src/framework/asset/asset.js';
import { webpInitialize } from '../../../../src/framework/parsers/webp-decoder.js';
import { PIXELFORMAT_RGBA8 } from '../../../../src/platform/graphics/constants.js';
import { http } from '../../../../src/platform/net/http.js';
import { createApp } from '../../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../../jsdom.mjs';

describe('ImgParser', function () {

    // the file bytes, and the pixels a fake decoder returns for them: 2x1 RGBA with alpha below
    // 255, which an ImageBitmap on WebKit would premultiply
    const fileBytes = new Uint8Array([82, 73, 70, 70, 1, 2, 3, 4]);
    const width = 2;
    const height = 1;

    let app;
    let rgba;
    let decoder;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();

        rgba = new Uint8Array([200, 100, 50, 10, 17, 34, 51, 1]);
        decoder = {
            decodeRGBA: spy(() => ({ rgba, width, height }))
        };
    });

    afterEach(function () {
        webpInitialize(null);
        restore();
        app?.destroy();
        app = null;
        jsdomTeardown();
    });

    // loads a texture asset and resolves with its texture
    const loadTexture = (file) => {
        return new Promise((resolve, reject) => {
            const asset = new Asset('tex', 'texture', file, { mipmaps: false });
            asset.on('load', () => resolve(asset.resource));
            asset.on('error', reject);
            app.assets.add(asset);
            app.assets.load(asset);
        });
    };

    const expectDecodedTexture = (texture) => {
        expect(texture._levels[0]).to.equal(rgba);
        expect(texture.width).to.equal(width);
        expect(texture.height).to.equal(height);
        expect(texture.format).to.equal(PIXELFORMAT_RGBA8);
        expect(texture.mipmaps).to.equal(false);
    };

    describe('#load', function () {

        it('decodes a .webp file with the configured decoder', async function () {
            stub(http, 'get').callsFake((url, options, callback) => {
                callback(null, fileBytes.slice().buffer);
            });
            webpInitialize({ decoder });

            const texture = await loadTexture({ url: 'tex.webp', filename: 'tex.webp' });

            expect(decoder.decodeRGBA.calledOnce).to.equal(true);
            expect(decoder.decodeRGBA.firstCall.args[0]).to.deep.equal(fileBytes);
            expectDecodedTexture(texture);
        });

        it('creates the decoder with the create() method of the WebPCodec export of a module url', async function () {
            stub(http, 'get').callsFake((url, options, callback) => {
                callback(null, fileBytes.slice().buffer);
            });
            const module = 'export const WebPCodec = { create: async () => ({ decodeRGBA: () => ' +
                '({ rgba: new Uint8Array([1, 2, 3, 4]), width: 1, height: 1 }) }) };';
            webpInitialize({ url: `data:text/javascript,${encodeURIComponent(module)}` });

            const texture = await loadTexture({ url: 'tex.webp', filename: 'tex.webp' });

            expect(Array.from(texture._levels[0])).to.deep.equal([1, 2, 3, 4]);
            expect(texture.width).to.equal(1);
        });

        it('decodes the asset file contents of a .webp file without downloading it', async function () {
            const get = spy(http, 'get');
            webpInitialize({ decoder });

            // a view into a larger buffer, as a bundle supplies the files it holds
            const bundle = new Uint8Array(fileBytes.length + 4);
            bundle.set(fileBytes, 4);
            const contents = bundle.subarray(4);

            const texture = await loadTexture({ url: 'tex.webp', filename: 'tex.webp', contents });

            expect(get.called).to.equal(false);
            expect(decoder.decodeRGBA.firstCall.args[0]).to.deep.equal(fileBytes);
            expectDecodedTexture(texture);
        });

        it('loads other image formats in the browser when a decoder is configured', function () {
            webpInitialize({ decoder });
            const parser = app.loader.getHandler('texture').imgParser;
            const loadImage = stub(parser, '_loadImage');

            app.loader.getHandler('texture').load('tex.png', () => {});

            expect(loadImage.calledOnce).to.equal(true);
            expect(decoder.decodeRGBA.called).to.equal(false);
        });

        it('loads a .webp file in the browser when no decoder is configured', function () {
            const parser = app.loader.getHandler('texture').imgParser;
            const loadImage = stub(parser, '_loadImage');

            app.loader.getHandler('texture').load('tex.webp', () => {});

            expect(loadImage.calledOnce).to.equal(true);
        });
    });
});
