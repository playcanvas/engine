import { expect } from 'chai';

import { Asset } from '../../../../src/framework/asset/asset.js';
import { Entity } from '../../../../src/framework/entity.js';
import { createApp } from '../../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../../jsdom.mjs';

describe('SpriteComponent', function () {
    let app;
    let atlasAsset = null;
    let spriteAsset = null;
    let spriteAsset2 = null;

    beforeEach(function (done) {
        jsdomSetup();
        app = createApp();

        loadAssets(done);
    });

    afterEach(function () {
        app?.destroy();
        app = null;
        jsdomTeardown();
        atlasAsset = null;
        spriteAsset = null;
        spriteAsset2 = null;
    });

    let loadAssets = function (cb) {
        let i = 0;
        let check = function () {
            i++;
            if (i === 3) {
                return true;
            } else {
                return false;
            }
        };

        atlasAsset = new Asset('red-atlas', 'textureatlas', {
            url: 'http://localhost:3000/test/assets/sprites/red-atlas.json'
        });

        spriteAsset = new Asset('red-sprite', 'sprite', {
            url: 'http://localhost:3000/test/assets/sprites/red-sprite.json'
        });

        spriteAsset2 = new Asset('red-sprite-2', 'sprite', {
            url: 'http://localhost:3000/test/assets/sprites/red-sprite.json'
        });

        app.assets.add(atlasAsset);
        app.assets.add(spriteAsset);
        app.assets.add(spriteAsset2);

        app.assets.load(atlasAsset);
        app.assets.load(spriteAsset);
        app.assets.load(spriteAsset2);

        atlasAsset.ready(function () {
            if (check()) cb();
        });

        spriteAsset.ready(function () {
            if (check()) cb();
        });

        spriteAsset2.ready(function () {
            if (check()) cb();
        });
    }

    it('Add new Component', function () {
        let e = new Entity();

        e.addComponent('sprite', {});

        expect(e.sprite).to.exist;
    });

    // TODO This and other tests in this file are skipped because of the following error:
    //
    //      Uncaught TypeError: Cannot read property 'length' of undefined
    //        at SpriteAnimationClip._setFrame (sprite-animation-clip.js:183)
    //        atSpriteAnimationClip.set (sprite-animation-clip.js:381)
    //        atSpriteAnimationClip.set (sprite-animation-clip.js:368)
    //        atSpriteAnimationClip._onSpriteAssetLoad (sprite-animation-clip.js:84)
    //        atSpriteAnimationClip._bindSpriteAsset (sprite-animation-clip.js:56)
    //        atSpriteAnimationClip.set (sprite-animation-clip.js:298)
    //        atSpriteComponent.set (component.js:586)
    //        atSpriteComponentSystem.initializeComponentData (system.js:149)
    //        atSpriteComponentSystem.addComponent (system.js:84)
    //        atEntity.addComponent (entity.js:116)
    //
    // Once this has been addressed they can be re-enabled.
    it('Add / Remove Component', function () {
        let e = new Entity();

        e.addComponent('sprite', {});

        expect(e.sprite).to.exist;

        e.removeComponent('sprite');

        expect(!e.sprite).to.exist;
    });

    it('Remove after destroy', function () {
        let e = new Entity();
        e.addComponent('sprite', {
            spriteAsset: spriteAsset
        });

        e.destroy();

        expect(!e.sprite).to.exist;
    });

    it('Sprites assets unbound on destroy', function () {
        expect(!spriteAsset.hasEvent('add')).to.exist;
        expect(!spriteAsset.hasEvent('load')).to.exist;
        expect(!spriteAsset.hasEvent('remove')).to.exist;

        let e = new Entity();
        e.addComponent('sprite', {
            spriteAsset: spriteAsset
        });

        e.destroy();

        expect(!spriteAsset.hasEvent('add')).to.exist;
        expect(!spriteAsset.hasEvent('load')).to.exist;
        expect(!spriteAsset.hasEvent('remove')).to.exist;
    });

    it('Sprites assets unbound when reset', function () {
        expect(!spriteAsset.hasEvent('add')).to.exist;
        expect(!spriteAsset.hasEvent('load')).to.exist;
        expect(!spriteAsset.hasEvent('remove')).to.exist;

        let e = new Entity();
        e.addComponent('sprite', {
            spriteAsset: spriteAsset
        });

        e.sprite.spriteAsset = spriteAsset2;

        expect(!spriteAsset.hasEvent('add')).to.exist;
        expect(!spriteAsset.hasEvent('load')).to.exist;
        expect(!spriteAsset.hasEvent('remove')).to.exist;
    });

});
