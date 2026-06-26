import { expect } from 'chai';

import { Asset } from '../../../src/framework/asset/asset.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('FontHandler', function () {

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

    it('loads a font and its textures', function (done) {
        const asset = new Asset('arial', 'font', {
            url: 'http://localhost:3210/test/assets/fonts/arial.json'
        });

        app.assets.add(asset);
        app.assets.load(asset);

        asset.ready(function () {
            const font = asset.resource;
            expect(font).to.exist;
            expect(font.textures).to.be.an('array').with.lengthOf(1);
            done();
        });

        asset.on('error', err => done(new Error(err)));
    });

    // regression test for https://github.com/playcanvas/engine/issues/7033 - unloading a font
    // asset must destroy its textures and remove them from the resource loader cache
    it('destroys its textures and clears the loader cache on unload', function (done) {
        const asset = new Asset('arial', 'font', {
            url: 'http://localhost:3210/test/assets/fonts/arial.json'
        });

        app.assets.add(asset);
        app.assets.load(asset);

        asset.ready(function () {
            // keep a reference to the textures, asset.resource becomes null after unload
            const textures = asset.resource.textures.slice();
            expect(textures).to.have.lengthOf(1);

            // textures are present in the loader cache while loaded
            textures.forEach((texture) => {
                expect(app.loader.getFromCache(texture.name, 'texture')).to.equal(texture);
            });

            asset.unload();

            // textures are destroyed (Texture.destroy clears the device reference) ...
            textures.forEach((texture) => {
                expect(texture.device).to.be.null;
                // ... and removed from the loader cache so a reload does not return a dead texture
                expect(app.loader.getFromCache(texture.name, 'texture')).to.be.undefined;
            });

            done();
        });

        asset.on('error', err => done(new Error(err)));
    });

});
