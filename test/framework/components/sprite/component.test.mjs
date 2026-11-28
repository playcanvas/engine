import { expect } from 'chai';
import { stub } from 'sinon';

import { Color } from '../../../../src/core/math/color.js';
import { Vec2 } from '../../../../src/core/math/vec2.js';
import { Vec4 } from '../../../../src/core/math/vec4.js';
import { Asset } from '../../../../src/framework/asset/asset.js';
import { SPRITETYPE_ANIMATED, SPRITETYPE_SIMPLE } from '../../../../src/framework/components/sprite/constants.js';
import { Entity } from '../../../../src/framework/entity.js';
import { PIXELFORMAT_SRGBA8 } from '../../../../src/platform/graphics/constants.js';
import { Texture } from '../../../../src/platform/graphics/texture.js';
import { Sprite } from '../../../../src/scene/sprite.js';
import { TextureAtlas } from '../../../../src/scene/texture-atlas.js';
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

    it('Defaults type to SPRITETYPE_SIMPLE', function () {
        expect(new Entity().addComponent('sprite').type).to.equal(SPRITETYPE_SIMPLE);
        expect(new Entity().addComponent('sprite', { type: undefined }).type).to.equal(SPRITETYPE_SIMPLE);
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

            const meshColor = e.sprite._meshInstance.getParameter('mesh_color').data;
            expect(meshColor).to.have.lengthOf(4);
            expect(meshColor[0]).to.be.closeTo(0.214041, 0.000001);
            expect(meshColor[1]).to.be.closeTo(0.050876, 0.000001);
            expect(meshColor[2]).to.be.closeTo(0.522522, 0.000001);
            expect(meshColor[3]).to.be.closeTo(0.4, 0.000001);
            expect(e.sprite.color.r).to.equal(0.5);
            expect(e.sprite.color.g).to.equal(0.25);
            expect(e.sprite.color.b).to.equal(0.75);
            expect(color).to.deep.equal(new Color(0.5, 0.25, 0.75));
            expect(e.sprite.opacity).to.equal(0.4);
            expect(e.sprite._meshInstance.getParameter('material_emissive')).to.be.undefined;
            expect(e.sprite._meshInstance.getParameter('material_opacity')).to.be.undefined;
        });
    });

    it('Updates color and opacity independently without changing another sprite or the shared material', function () {
        const a = new Entity();
        const b = new Entity();
        app.root.addChild(a);
        app.root.addChild(b);
        a.addComponent('sprite', { spriteAsset });
        b.addComponent('sprite', { spriteAsset });

        const material = a.sprite._meshInstance.material;
        expect(b.sprite._meshInstance.material).to.equal(material);
        const meshColor = a.sprite._meshInstance.getParameter('mesh_color').data;
        expect(Array.from(meshColor)).to.deep.equal([1, 1, 1, 1]);

        a.sprite.opacity = 0.25;
        expect(Array.from(meshColor)).to.deep.equal([1, 1, 1, 0.25]);
        a.sprite.color = new Color(0.5, 0.25, 0.75, 0);
        expect(meshColor[3]).to.equal(0.25);
        const rgb = Array.from(meshColor).slice(0, 3);
        a.sprite.opacity = 0.75;
        expect(Array.from(meshColor).slice(0, 3)).to.deep.equal(rgb);
        expect(meshColor[3]).to.equal(0.75);
        expect(a.sprite._meshInstance.getParameter('mesh_color').data).to.equal(meshColor);
        expect(Array.from(b.sprite._meshInstance.getParameter('mesh_color').data)).to.deep.equal([1, 1, 1, 1]);
        expect(material.emissive).to.deep.equal(new Color(1, 1, 1));
        expect(material.opacity).to.equal(1);
        expect(material.getParameter('mesh_color')).to.be.undefined;
    });

    it('Enables mesh color on all shared sprite material variants', function () {
        const system = app.systems.sprite;
        for (const material of [system.defaultMaterial, system.default9SlicedMaterialSlicedMode, system.default9SlicedMaterialTiledMode]) {
            expect(material.defines.get('MESH_COLOR')).to.equal(true);
        }
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

    describe('clips that play a sprite', function () {
        // a sprite of four frames of an atlas built in code, with no sprite asset
        const createSprite = () => {
            const device = app.graphicsDevice;
            const atlas = new TextureAtlas();
            atlas.frames = {};
            for (let i = 0; i < 4; i++) {
                atlas.setFrame(`walk-${i}`, {
                    rect: new Vec4(i * 16, 0, 16, 16),
                    pivot: new Vec2(0.5, 0.5),
                    border: new Vec4()
                });
            }
            atlas.texture = new Texture(device, { width: 64, height: 16, format: PIXELFORMAT_SRGBA8 });
            return new Sprite(device, {
                atlas,
                frameKeys: ['walk-0', 'walk-1', 'walk-2', 'walk-3'],
                pixelsPerUnit: 16
            });
        };

        it('plays a clip added with a sprite', function () {
            const sprite = createSprite();
            const e = new Entity();
            e.addComponent('sprite', { type: SPRITETYPE_ANIMATED });
            app.root.addChild(e);

            const clip = e.sprite.addClip({ name: 'walk', fps: 10, loop: true, sprite });
            expect(clip.sprite).to.equal(sprite);

            e.sprite.play('walk');
            expect(e.sprite.currentClip).to.equal(clip);
            expect(e.sprite._meshInstance.mesh).to.equal(sprite.meshes[0]);

            app.systems.fire('update', 0.15);
            expect(e.sprite.frame).to.equal(1);
            expect(e.sprite._meshInstance.mesh).to.equal(sprite.meshes[1]);

            sprite.atlas.destroy();
            sprite.destroy();
        });

        it('takes the sprite of a clip with a sprite asset from the asset', function () {
            const sprite = createSprite();
            const e = new Entity();
            e.addComponent('sprite', { type: SPRITETYPE_ANIMATED });

            const clip = e.sprite.addClip({ name: 'walk', fps: 10, loop: true, spriteAsset, sprite });
            expect(clip.spriteAsset).to.equal(spriteAsset.id);
            expect(clip.sprite).to.equal(spriteAsset.resource);

            sprite.atlas.destroy();
            sprite.destroy();
        });

        it('names a clip of the component data by its key', function () {
            const sprite = createSprite();
            const e = new Entity();
            e.addComponent('sprite', {
                type: SPRITETYPE_ANIMATED,
                clips: {
                    walk: { fps: 10, loop: true, sprite },
                    other: { name: 'run', fps: 20, loop: false, sprite }
                },
                autoPlayClip: 'walk'
            });
            app.root.addChild(e);

            expect(Object.keys(e.sprite.clips)).to.have.members(['walk', 'run']);
            expect(e.sprite.clip('walk').name).to.equal('walk');
            expect(e.sprite.clip('walk').sprite).to.equal(sprite);
            expect(e.sprite.clip('run').fps).to.equal(20);
            expect(e.sprite.currentClip.name).to.equal('walk');
            expect(e.sprite.currentClip.isPlaying).to.equal(true);

            sprite.atlas.destroy();
            sprite.destroy();
        });

        it('names a clip set through the clips property by its key', function () {
            const sprite = createSprite();
            const e = new Entity();
            e.addComponent('sprite', { type: SPRITETYPE_ANIMATED });

            e.sprite.clips = { walk: { fps: 10, loop: true, sprite } };
            const clip = e.sprite.clip('walk');
            expect(clip.name).to.equal('walk');
            expect(clip.sprite).to.equal(sprite);

            // setting the same entry again updates the clip rather than adding another
            e.sprite.clips = { walk: { fps: 5, loop: false, sprite } };
            expect(e.sprite.clip('walk')).to.equal(clip);
            expect(clip.fps).to.equal(5);
            expect(Object.keys(e.sprite.clips)).to.deep.equal(['walk']);

            sprite.atlas.destroy();
            sprite.destroy();
        });

        it('clones the clips with their sprites', function () {
            const sprite = createSprite();
            const e = new Entity();
            e.addComponent('sprite', {
                type: SPRITETYPE_ANIMATED,
                clips: { walk: { fps: 10, loop: true, sprite } },
                autoPlayClip: 'walk'
            });
            app.root.addChild(e);

            const clone = e.clone();
            app.root.addChild(clone);

            expect(clone.sprite.clip('walk')).to.not.equal(e.sprite.clip('walk'));
            expect(clone.sprite.clip('walk').sprite).to.equal(sprite);
            expect(clone.sprite.clip('walk').fps).to.equal(10);
            expect(clone.sprite.currentClip.name).to.equal('walk');
            expect(clone.sprite.currentClip.isPlaying).to.equal(true);
            expect(clone.sprite._meshInstance.mesh).to.equal(sprite.meshes[0]);

            sprite.atlas.destroy();
            sprite.destroy();
        });

        it('keeps playing the current clip when asked to play a clip that does not exist', function () {
            const sprite = createSprite();
            const e = new Entity();
            e.addComponent('sprite', { type: SPRITETYPE_ANIMATED });
            app.root.addChild(e);

            const clip = e.sprite.addClip({ name: 'walk', fps: 10, loop: true, sprite });
            e.sprite.play('walk');
            app.systems.fire('update', 0.15);

            const warn = stub(console, 'warn');
            const result = e.sprite.play('missing');
            warn.restore();
            expect(result).to.be.undefined;
            expect(warn.calledOnce).to.equal(true);
            expect(e.sprite.currentClip).to.equal(clip);
            expect(clip.isPlaying).to.equal(true);
            expect(e.sprite.frame).to.equal(1);
            expect(e.sprite.sprite).to.equal(sprite);

            e.sprite.pause();
            expect(clip.isPaused).to.equal(true);
            e.sprite.resume();
            expect(clip.isPaused).to.equal(false);
            e.sprite.stop();
            expect(clip.isPlaying).to.equal(false);
            expect(() => {
                e.enabled = false;
            }).to.not.throw();

            sprite.atlas.destroy();
            sprite.destroy();
        });

        it('keeps the default clip when asked to play a clip that does not exist', function () {
            const e = new Entity();
            e.addComponent('sprite', { type: SPRITETYPE_ANIMATED });
            app.root.addChild(e);

            const defaultClip = e.sprite.currentClip;
            const warn = stub(console, 'warn');
            const result = e.sprite.play('missing');
            warn.restore();
            expect(result).to.be.undefined;
            expect(warn.calledOnce).to.equal(true);
            expect(e.sprite.currentClip).to.equal(defaultClip);
            expect(e.sprite.frame).to.equal(0);
            expect(() => {
                e.sprite.stop();
                e.enabled = false;
            }).to.not.throw();
        });
    });

});
