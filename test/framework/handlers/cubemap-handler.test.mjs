import { expect } from 'chai';

import { CubemapHandler } from '../../../src/framework/handlers/cubemap.js';

describe('CubemapHandler', function () {

    const loadUrlAssets = (file, textures) => {
        const createdAssets = [];
        const registry = {
            add(asset) {
                createdAssets.push(asset);
            },
            once() {},
            load() {}
        };
        const handler = new CubemapHandler({
            assets: registry,
            graphicsDevice: null,
            loader: {}
        });

        handler.loadAssets({
            data: { textures },
            file,
            loadFaces: true,
            name: 'test-cubemap'
        }, () => {});

        return createdAssets;
    };

    it('loads URL face images as sRGB textures rather than RGBP', function () {
        const textures = [
            'posx.png', 'negx.png', 'posy.png', 'negy.png', 'posz.png', 'negz.png'
        ];
        const assets = loadUrlAssets(null, textures);

        expect(assets).to.have.lengthOf(6);
        for (const asset of assets) {
            expect(asset.data).to.deep.equal({ srgb: true });
        }
    });

    it('keeps RGBP state on a URL prefiltered env atlas only', function () {
        const textures = [
            'posx.png', 'negx.png', 'posy.png', 'negy.png', 'posz.png', 'negz.png'
        ];
        const assets = loadUrlAssets({ url: 'sky.png', filename: 'sky.png' }, textures);

        expect(assets).to.have.lengthOf(7);
        expect(assets[0].data).to.deep.equal({
            type: 'rgbp',
            addressu: 'clamp',
            addressv: 'clamp',
            mipmaps: false
        });
        for (const asset of assets.slice(1)) {
            expect(asset.data).to.deep.equal({ srgb: true });
        }
    });

    it('does not override format-specific face URLs', function () {
        for (const extension of ['basis', 'dds', 'hdr', 'ktx', 'ktx2']) {
            const assets = loadUrlAssets(null, [
                `posx.${extension}`, `negx.${extension}`, `posy.${extension}`,
                `negy.${extension}`, `posz.${extension}`, `negz.${extension}`
            ]);

            for (const asset of assets) {
                expect(asset.data).to.deep.equal({});
            }
        }
    });
});
