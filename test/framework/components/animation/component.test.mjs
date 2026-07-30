import { expect } from 'chai';

import { Asset } from '../../../../src/framework/asset/asset.js';
import { Entity } from '../../../../src/framework/entity.js';
import { createApp } from '../../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../../jsdom.mjs';

describe('AnimationComponent', function () {
    let app;
    let assets = {};

    const loadAssetList = function (list, cb) {
        // listen for asset load events and fire cb() when all assets are loaded
        let count = 0;
        app.assets.on('load', (asset) => {
            count++;
            if (count === list.length) {
                cb();
            }
        });

        // add and load assets
        for (let i = 0; i < list.length; i++) {
            app.assets.add(list[i]);
            app.assets.load(list[i]);
        }
    };

    const loadAssets = function (cb) {
        const assetlist = [
            new Asset('cube.json', 'model', {
                url: '/test/assets/cube/cube.json'
            }),
            new Asset('cube.animation.json', 'animation', {
                url: '/test/assets/cube/cube.animation.json'
            })
        ];
        assets.model = assetlist[0];
        assets.animation = assetlist[1];

        loadAssetList(assetlist, () => {
            cb();
        });
    };

    describe('preload', function () {

        beforeEach(function (done) {
            jsdomSetup();
            app = createApp();

            loadAssets(() => {
                done();
            });
        });

        afterEach(function () {
            app?.destroy();
            app = null;
            jsdomTeardown();
            assets = {};
        });

        it('can create animation component', function () {
            const entity = new Entity();

            entity.addComponent('model', {
                asset: assets.model
            });

            entity.addComponent('animation', {
                asset: assets.animation
            });

            expect(entity.animation).to.exist;
        });

        it('can create animation and auto play them', function () {
            const entity = new Entity();

            entity.addComponent('model', {
                asset: assets.model
            });

            entity.addComponent('animation', {
                assets: [assets.animation.id],
                activate: true
            });

            app.root.addChild(entity);

            // is currAnim public API?
            expect(entity.animation.currAnim).to.equal(assets.animation.name);
        });

    });

    describe('async', function () {

        beforeEach(function () {
            jsdomSetup();
            app = createApp();
        });

        afterEach(function () {
            app?.destroy();
            app = null;
            jsdomTeardown();
            assets = {};
        });

        it('async assets, can create animation and auto play them', function (done) {
            const entity = new Entity();

            loadAssets(function () {
                // is currAnim public API?
                expect(entity.animation.currAnim).to.equal(assets.animation.name);

                done();
            });

            entity.addComponent('model', {
                asset: assets.model
            });

            entity.addComponent('animation', {
                assets: [assets.animation.id],
                activate: true
            });

            app.root.addChild(entity);

        });

        it('async assets, clone of animation component loads animations', function (done) {
            const entity = new Entity();

            loadAssets(function () {
                // is currAnim public API?
                expect(entity.animation.currAnim).to.equal(assets.animation.name);
                expect(clone.animation.currAnim).to.equal(assets.animation.name); // eslint-disable-line no-use-before-define

                done();
            });

            entity.addComponent('model', {
                asset: assets.model
            });

            entity.addComponent('animation', {
                assets: [assets.animation.id],
                activate: true
            });

            app.root.addChild(entity);

            const clone = entity.clone();
            app.root.addChild(clone);
        });

    });

    describe('asset event unbinding', function () {

        beforeEach(function () {
            jsdomSetup();
            app = createApp();
        });

        afterEach(function () {
            app?.destroy();
            app = null;
            jsdomTeardown();
            assets = {};
        });

        const createAnimationAsset = function () {
            return new Asset('cube.animation.json', 'animation', {
                url: '/test/assets/cube/cube.animation.json'
            });
        };

        const createEntity = function (asset) {
            const entity = new Entity();
            entity.addComponent('animation', {
                assets: [asset.id],
                activate: true
            });
            app.root.addChild(entity);
            return entity;
        };

        it('unsubscribes from an asset in the registry when the entity is destroyed', function () {
            const asset = createAnimationAsset();
            app.assets.add(asset);

            const entity = createEntity(asset);

            expect(asset.hasEvent('change')).to.be.true;
            expect(asset.hasEvent('remove')).to.be.true;

            entity.destroy();

            expect(asset.hasEvent('change')).to.be.false;
            expect(asset.hasEvent('remove')).to.be.false;
        });

        it('unsubscribes from an in-flight asset load when the entity is destroyed', function () {
            const asset = createAnimationAsset();
            app.assets.add(asset);

            const entity = createEntity(asset);

            expect(asset.hasEvent('load')).to.be.true;

            entity.destroy();

            expect(asset.hasEvent('load')).to.be.false;
        });

        it('unsubscribes from an asset added to the registry after the entity is destroyed', function () {
            const asset = createAnimationAsset();

            // the component is waiting for the asset to be added to the registry
            const entity = createEntity(asset);
            expect(app.assets.hasEvent(`add:${asset.id}`)).to.be.true;

            entity.destroy();
            expect(app.assets.hasEvent(`add:${asset.id}`)).to.be.false;

            // the late arrival of the asset must not subscribe the removed component
            app.assets.add(asset);
            expect(asset.hasEvent('change')).to.be.false;
            expect(asset.hasEvent('remove')).to.be.false;
        });

        it('unsubscribes from an asset removed from the registry before the entity is destroyed', function () {
            const asset = createAnimationAsset();
            app.assets.add(asset);

            const entity = createEntity(asset);

            app.assets.remove(asset);
            entity.destroy();

            expect(asset.hasEvent('change')).to.be.false;
            expect(asset.hasEvent('remove')).to.be.false;
        });

        it('unsubscribes from assets that are replaced by assigning a new asset array', function () {
            const asset = createAnimationAsset();
            app.assets.add(asset);

            const pending = createAnimationAsset();

            const entity = createEntity(asset);
            entity.animation.assets = [pending.id];

            expect(asset.hasEvent('change')).to.be.false;
            expect(asset.hasEvent('remove')).to.be.false;
            expect(app.assets.hasEvent(`add:${pending.id}`)).to.be.true;

            entity.animation.assets = [];

            expect(app.assets.hasEvent(`add:${pending.id}`)).to.be.false;
        });

    });

});
