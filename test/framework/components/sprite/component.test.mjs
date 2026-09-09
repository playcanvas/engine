import { expect } from 'chai';

import { Color } from '../../../../src/core/math/color.js';
import { Asset } from '../../../../src/framework/asset/asset.js';
import { Entity } from '../../../../src/framework/entity.js';
import { createApp } from '../../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../../jsdom.mjs';

describe('SpriteComponent', function () {
    let app;
    let atlasAsset = null;
    let spriteAsset = null;
    let spriteAsset2 = null;

    const loadAssets = function (cb) {
        let i = 0;
        const check = function () {
            i++;
            if (i === 3) {
                return true;
            }
            return false;

        };

        atlasAsset = new Asset('red-atlas', 'textureatlas', {
            url: '/test/assets/sprites/red-atlas.json'
        });

        spriteAsset = new Asset('red-sprite', 'sprite', {
            url: '/test/assets/sprites/red-sprite.json'
        });

        spriteAsset2 = new Asset('red-sprite-2', 'sprite', {
            url: '/test/assets/sprites/red-sprite.json'
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
        atlasAsset = null;
        spriteAsset = null;
        spriteAsset2 = null;
    });

    it('Add new Component', function () {
        const e = new Entity();

        e.addComponent('sprite');

        expect(e.sprite).to.exist;
    });

    [true, false].forEach((tintBeforeSprite) => {
        it(`Converts sRGB tint set ${tintBeforeSprite ? 'before' : 'after'} the sprite is assigned`, function () {
            const e = new Entity();
            app.root.addChild(e);
            e.addComponent('sprite');

            const color = new Color(0.5, 0.25, 0.75);
            e.sprite.opacity = 0.4;

            if (!tintBeforeSprite) {
                e.sprite.spriteAsset = spriteAsset;
            }

            e.sprite.color = color;

            if (tintBeforeSprite) {
                e.sprite.spriteAsset = spriteAsset;
            }

            const emissive = e.sprite._meshInstance.getParameter('material_emissive').data;
            expect(emissive[0]).to.be.closeTo(0.217638, 0.000001);
            expect(emissive[1]).to.be.closeTo(0.047366, 0.000001);
            expect(emissive[2]).to.be.closeTo(0.531049, 0.000001);
            expect(e.sprite.color.r).to.equal(0.5);
            expect(e.sprite.color.g).to.equal(0.25);
            expect(e.sprite.color.b).to.equal(0.75);
            expect(color).to.deep.equal(new Color(0.5, 0.25, 0.75));
            expect(e.sprite.opacity).to.equal(0.4);
            expect(e.sprite._meshInstance.getParameter('material_opacity').data).to.equal(0.4);
        });
    });

    it('Add / Remove Component', function () {
        const e = new Entity();

        e.addComponent('sprite', {});

        expect(e.sprite).to.exist;

        e.removeComponent('sprite');

        expect(!e.sprite).to.exist;
    });

    it('Remove after destroy', function () {
        const e = new Entity();
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

        const e = new Entity();
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

        const e = new Entity();
        e.addComponent('sprite', {
            spriteAsset: spriteAsset
        });

        e.sprite.spriteAsset = spriteAsset2;

        expect(!spriteAsset.hasEvent('add')).to.exist;
        expect(!spriteAsset.hasEvent('load')).to.exist;
        expect(!spriteAsset.hasEvent('remove')).to.exist;
    });

});
