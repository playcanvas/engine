import { expect } from 'chai';

import { INTERPOLATION_LINEAR } from '../../../../src/framework/anim/constants.js';
import { AnimCurve } from '../../../../src/framework/anim/evaluator/anim-curve.js';
import { AnimData } from '../../../../src/framework/anim/evaluator/anim-data.js';
import { AnimTrack } from '../../../../src/framework/anim/evaluator/anim-track.js';
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
                assets: [assets.animation]
            });

            expect(entity.animation).to.exist;

            // the assets are assigned as given, accepting Asset instances as well as asset ids
            expect(entity.animation.assets).to.have.lengthOf(1);
            expect(entity.animation.assets[0]).to.equal(assets.animation);

            // the asset is already loaded, so its animation is registered straight away
            expect(entity.animation.animations[assets.animation.name]).to.equal(assets.animation.resource);
            expect(entity.animation.animationsIndex[assets.animation.id]).to.equal(assets.animation.name);
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

    describe('anim tracks', function () {

        beforeEach(function () {
            jsdomSetup();
            app = createApp();
        });

        afterEach(function () {
            app?.destroy();
            app = null;
            jsdomTeardown();
        });

        const positionTrack = (name, nodeName, x) => {
            const curve = new AnimCurve([{
                entityPath: ['root', nodeName],
                component: 'graph',
                propertyPath: ['localPosition']
            }], 0, 0, INTERPOLATION_LINEAR);
            return new AnimTrack(name, 1, [new AnimData(1, [0, 1])], [new AnimData(3, [x, 0, 0, x, 0, 0])], [curve]);
        };

        it('stops writing the targets of an animation that is no longer playing', function () {
            const root = new Entity('root', app);
            const a = new Entity('a', app);
            const b = new Entity('b', app);
            root.addChild(a);
            root.addChild(b);
            app.root.addChild(root);

            root.addComponent('model', { type: 'box' });
            root.addComponent('animation');
            root.animation.animations = {
                A: positionTrack('A', 'a', 1),
                B: positionTrack('B', 'b', 2)
            };

            root.animation.play('A');
            app.systems.animation.onUpdate(0.1);
            expect(a.getLocalPosition().x).to.be.closeTo(1, 1e-5);

            root.animation.play('B');
            a.setLocalPosition(5, 0, 0);
            app.systems.animation.onUpdate(0.1);
            expect(a.getLocalPosition().x).to.be.closeTo(5, 1e-5);
            expect(b.getLocalPosition().x).to.be.closeTo(2, 1e-5);

            // blending keeps B and adds A
            root.animation.play('A', 0.2);
            app.systems.animation.onUpdate(0.3);
            expect(a.getLocalPosition().x).to.be.closeTo(1, 1e-5);

            root.animation.play('B');
            a.setLocalPosition(6, 0, 0);
            app.systems.animation.onUpdate(0.1);
            expect(a.getLocalPosition().x).to.be.closeTo(6, 1e-5);
            expect(b.getLocalPosition().x).to.be.closeTo(2, 1e-5);
        });

        it('stops writing the targets of an animation that a blend removes', function () {
            const root = new Entity('root', app);
            const a = new Entity('a', app);
            const b = new Entity('b', app);
            root.addChild(a);
            root.addChild(b);
            app.root.addChild(root);

            root.addComponent('model', { type: 'box' });
            root.addComponent('animation');
            root.animation.animations = {
                A: positionTrack('A', 'a', 1),
                B: positionTrack('B', 'b', 2)
            };

            root.animation.play('A');
            app.systems.animation.onUpdate(0.1);
            root.animation.play('B', 0.2);
            app.systems.animation.onUpdate(0.3);
            expect(a.getLocalPosition().x).to.be.closeTo(1, 1e-5);
            expect(b.getLocalPosition().x).to.be.closeTo(2, 1e-5);

            // blending keeps only the last clip, so A's clip is removed
            root.animation.play('B', 0.2);
            a.setLocalPosition(6, 0, 0);
            app.systems.animation.onUpdate(0.1);
            expect(a.getLocalPosition().x).to.be.closeTo(6, 1e-5);
            app.systems.animation.onUpdate(0.3);
            expect(a.getLocalPosition().x).to.be.closeTo(6, 1e-5);
            expect(b.getLocalPosition().x).to.be.closeTo(2, 1e-5);
        });

    });

});
