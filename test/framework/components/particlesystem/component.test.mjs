import { expect } from 'chai';

import { AssetListLoader } from '../../../../src/framework/asset/asset-list-loader.js';
import { Asset } from '../../../../src/framework/asset/asset.js';
import { Entity } from '../../../../src/framework/entity.js';
import { createApp } from '../../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../../jsdom.mjs';

describe('ParticleSystemComponent', function () {
    let app;
    let assets = {};

    const loadAssets = function (cb) {
        const assetList = [
            new Asset('Box', 'model', {
                url: 'http://localhost:3000/test/assets/cube/cube.json'
            }),
            new Asset('ColorMap', 'texture', {
                url: 'http://localhost:3000/test/assets/test.png'
            }, {
                srgb: true
            }),
            new Asset('NormalMap', 'texture', {
                url: 'http://localhost:3000/test/assets/test.png'
            })
        ];
        const loader = new AssetListLoader(assetList, app.assets);
        loader.ready(function () {
            assets.mesh = assetList[0];
            assets.colorMap = assetList[1];
            assets.normalMap = assetList[2];
            cb();
        });
        loader.load();
    };

    beforeEach(function (done) {
        jsdomSetup();
        app = createApp();

        loadAssets(done);
    });

    afterEach(function () {
        app?.destroy();
        app = null;
        jsdomTeardown();
        assets = {};
    });

    it('Add particlesystem', function () {
        const e = new Entity();

        e.addComponent('particlesystem');

        expect(e.particlesystem).to.exist;
    });

    it('Remove particlesystem', function () {
        const e = new Entity();

        e.addComponent('particlesystem');
        e.removeComponent('particlesystem');

        expect(e.particlesystem).to.not.exist;
    });

    it('ColorMap Asset unbinds on destroy', function () {
        const e = new Entity();
        app.root.addChild(e);
        e.addComponent('particlesystem', {
            colorMapAsset: assets.colorMap.id
        });

        expect(assets.colorMap.hasEvent('load')).to.be.true;
        expect(assets.colorMap.hasEvent('unload')).to.be.true;
        expect(assets.colorMap.hasEvent('change')).to.be.true;
        expect(assets.colorMap.hasEvent('remove')).to.be.true;

        e.destroy();

        expect(assets.colorMap.hasEvent('load')).to.be.false;
        expect(assets.colorMap.hasEvent('unload')).to.be.false;
        expect(assets.colorMap.hasEvent('change')).to.be.false;
        expect(assets.colorMap.hasEvent('remove')).to.be.false;
    });

    it('ColorMap Asset unbinds on reset', function () {
        const e = new Entity();
        app.root.addChild(e);
        e.addComponent('particlesystem', {
            colorMapAsset: assets.colorMap.id
        });

        expect(assets.colorMap.hasEvent('load')).to.be.true;
        expect(assets.colorMap.hasEvent('unload')).to.be.true;
        expect(assets.colorMap.hasEvent('change')).to.be.true;
        expect(assets.colorMap.hasEvent('remove')).to.be.true;

        e.particlesystem.colorMapAsset = null;

        expect(assets.colorMap.hasEvent('load')).to.be.false;
        expect(assets.colorMap.hasEvent('unload')).to.be.false;
        expect(assets.colorMap.hasEvent('change')).to.be.false;
        expect(assets.colorMap.hasEvent('remove')).to.be.false;
    });

    it('NormalMap Asset unbinds on destroy', function () {
        const e = new Entity();
        app.root.addChild(e);
        e.addComponent('particlesystem', {
            normalMapAsset: assets.normalMap.id
        });

        expect(assets.normalMap.hasEvent('load')).to.be.true;
        expect(assets.normalMap.hasEvent('unload')).to.be.true;
        expect(assets.normalMap.hasEvent('change')).to.be.true;
        expect(assets.normalMap.hasEvent('remove')).to.be.true;

        e.destroy();

        expect(assets.normalMap.hasEvent('load')).to.be.false;
        expect(assets.normalMap.hasEvent('unload')).to.be.false;
        expect(assets.normalMap.hasEvent('change')).to.be.false;
        expect(assets.normalMap.hasEvent('remove')).to.be.false;
    });

    it('NormalMap Asset unbinds on reset', function () {
        const e = new Entity();
        app.root.addChild(e);
        e.addComponent('particlesystem', {
            normalMapAsset: assets.normalMap.id
        });

        expect(assets.normalMap.hasEvent('load')).to.be.true;
        expect(assets.normalMap.hasEvent('unload')).to.be.true;
        expect(assets.normalMap.hasEvent('change')).to.be.true;
        expect(assets.normalMap.hasEvent('remove')).to.be.true;

        e.particlesystem.normalMapAsset = null;

        expect(assets.normalMap.hasEvent('load')).to.be.false;
        expect(assets.normalMap.hasEvent('unload')).to.be.false;
        expect(assets.normalMap.hasEvent('change')).to.be.false;
        expect(assets.normalMap.hasEvent('remove')).to.be.false;
    });

    it('Mesh Asset unbinds on destroy', function () {
        const e = new Entity();
        app.root.addChild(e);
        e.addComponent('particlesystem', {
            meshAsset: assets.mesh.id
        });

        expect(assets.mesh.hasEvent('load')).to.be.true;
        expect(assets.mesh.hasEvent('unload')).to.be.true;
        expect(assets.mesh.hasEvent('change')).to.be.true;
        expect(assets.mesh.hasEvent('remove')).to.be.true;

        e.destroy();

        expect(assets.mesh.hasEvent('load')).to.be.false;
        expect(assets.mesh.hasEvent('unload')).to.be.false;
        expect(assets.mesh.hasEvent('change')).to.be.false;
        expect(assets.mesh.hasEvent('remove')).to.be.false;
    });

    it('Mesh Asset unbinds on reset', function () {
        const e = new Entity();
        app.root.addChild(e);
        e.addComponent('particlesystem', {
            meshAsset: assets.mesh.id
        });

        expect(assets.mesh.hasEvent('load')).to.be.true;
        expect(assets.mesh.hasEvent('unload')).to.be.true;
        expect(assets.mesh.hasEvent('change')).to.be.true;
        expect(assets.mesh.hasEvent('remove')).to.be.true;

        e.particlesystem.meshAsset = null;

        expect(assets.mesh.hasEvent('load')).to.be.false;
        expect(assets.mesh.hasEvent('unload')).to.be.false;
        expect(assets.mesh.hasEvent('change')).to.be.false;
        expect(assets.mesh.hasEvent('remove')).to.be.false;
    });
});
