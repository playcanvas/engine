import { expect } from 'chai';

import { Asset } from '../../../src/framework/asset/asset.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('SpriteHandler', function () {

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

    it('loads from filesystem', function (done) {

        const atlasAsset = new Asset('Red Atlas', 'textureatlas', {
            url: 'http://localhost:3000/test/assets/sprites/red-atlas.json'
        });

        const spriteAsset = new Asset('Red Sprite', 'sprite', {
            url: 'http://localhost:3000/test/assets/sprites/red-sprite.json'
        });

        app.assets.add(atlasAsset);
        app.assets.add(spriteAsset);

        app.assets.load(atlasAsset);

        atlasAsset.on('load', function () {
            app.assets.load(spriteAsset);

            spriteAsset.ready(function (asset) {
                expect(asset.resource.atlas).to.exist;

                expect(asset.loaded).to.be.true;

                expect(asset.data.renderMode).to.equal(0);
                expect(asset.data.pixelsPerUnit).to.equal(100);
                expect(asset.data.textureAtlasAsset).to.equal(atlasAsset.id);
                expect(asset.data.frameKeys[0]).to.equal(0);
                done();
            }, this);

            spriteAsset.on('error', function (err) {
                done(err);
            }, this);

        }, this);

        atlasAsset.on('error', function (err) {
            done(err);
        }, this);
    });

    it('loads from asset data', function (done) {
        const atlasAsset = new Asset('Red Atlas', 'textureatlas', {
            url: 'http://localhost:3000/test/assets/sprites/red-atlas.json'
        });

        const spriteAsset = new Asset('Red Sprite', 'sprite', null, {
            'renderMode': 0,
            'pixelsPerUnit': 100,
            'textureAtlasAsset': atlasAsset.id,
            'frameKeys': [0]
        });

        app.assets.add(atlasAsset);
        app.assets.add(spriteAsset);

        app.assets.load(atlasAsset);

        atlasAsset.on('load', function () {
            app.assets.load(spriteAsset);

            spriteAsset.ready(function (asset) {
                expect(asset.resource.atlas).to.exist;

                expect(asset.loaded).to.be.true;

                expect(asset.data.renderMode).to.equal(0);
                expect(asset.data.pixelsPerUnit).to.equal(100);
                expect(asset.data.textureAtlasAsset).to.equal(atlasAsset.id);
                expect(asset.data.frameKeys[0]).to.equal(0);
                done();
            }, this);

            spriteAsset.on('error', function (err) {
                done(err);
            }, this);

        }, this);

        atlasAsset.on('error', function (err) {
            done(err);
        }, this);
    });

});
