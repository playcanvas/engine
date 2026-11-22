import { expect } from 'chai';
import sinon from 'sinon';

import { Vec2 } from '../../src/core/math/vec2.js';
import { Vec4 } from '../../src/core/math/vec4.js';
import { NullGraphicsDevice } from '../../src/platform/graphics/null/null-graphics-device.js';
import { Texture } from '../../src/platform/graphics/texture.js';
import { SPRITE_RENDERMODE_SLICED } from '../../src/scene/constants.js';
import { Sprite } from '../../src/scene/sprite.js';
import { TextureAtlas } from '../../src/scene/texture-atlas.js';

describe('Sprite', function () {
    let device;

    const frame = (size = 8) => ({
        rect: new Vec4(0, 0, size, size),
        pivot: new Vec2(0.5, 0.5),
        border: new Vec4()
    });

    const atlas = () => {
        const result = new TextureAtlas();
        result.frames = {};
        result.setFrame('walk', frame());
        result.texture = new Texture(device, { width: 16, height: 16 });
        return result;
    };

    beforeEach(function () {
        device = new NullGraphicsDevice({ width: 16, height: 16 });
    });

    afterEach(function () {
        device.destroy();
        sinon.restore();
    });

    it('follows atlas frame changes for every property assignment order', function () {
        const textureAtlas = atlas();
        const sprites = [
            new Sprite(device, { atlas: textureAtlas, frameKeys: ['walk'] }),
            new Sprite(device, { frameKeys: ['walk'] }),
            new Sprite(device, { atlas: textureAtlas })
        ];
        sprites[1].atlas = textureAtlas;
        sprites[2].frameKeys = ['walk'];

        const oldMeshes = sprites.map(sprite => sprite.meshes[0]);
        const changed = sprites.map(sprite => sinon.spy(sprite, 'fire'));
        textureAtlas.setFrame('walk', frame(12));

        for (let i = 0; i < sprites.length; i++) {
            expect(sprites[i].meshes[0]).not.to.equal(oldMeshes[i]);
            expect(changed[i].calledWith('set:meshes')).to.be.true;
            sprites[i].destroy();
        }
        textureAtlas.destroy();
    });

    it('subscribes only once when frame keys are reassigned', function () {
        const textureAtlas = atlas();
        const sprite = new Sprite(device, { atlas: textureAtlas });
        sprite.frameKeys = ['walk'];
        sprite.frameKeys = ['walk'];
        const changed = sinon.spy(sprite, 'fire');

        textureAtlas.setFrame('walk', frame(12));

        expect(changed.withArgs('set:meshes').callCount).to.equal(1);
        sprite.destroy();
        textureAtlas.destroy();
    });

    it('updates duplicate frame keys and destroys the replaced meshes', function () {
        const textureAtlas = atlas();
        const sprite = new Sprite(device, { atlas: textureAtlas, frameKeys: ['walk', 'walk'] });
        const oldMeshes = sprite.meshes.slice();
        const destroy = oldMeshes.map(mesh => sinon.spy(mesh, 'destroy'));

        textureAtlas.setFrame('walk', frame(12));

        expect(sprite.meshes[0]).not.to.equal(oldMeshes[0]);
        expect(sprite.meshes[1]).not.to.equal(oldMeshes[1]);
        expect(destroy[0].calledOnce).to.be.true;
        expect(destroy[1].calledOnce).to.be.true;
        sprite.destroy();
        textureAtlas.destroy();
    });

    it('adds and removes sliced meshes when atlas frames change', function () {
        const textureAtlas = atlas();
        const sprite = new Sprite(device, {
            atlas: textureAtlas,
            frameKeys: ['missing'],
            renderMode: SPRITE_RENDERMODE_SLICED
        });
        expect(sprite.meshes[0]).to.be.null;

        textureAtlas.setFrame('missing', frame());
        const mesh = sprite.meshes[0];
        const destroy = sinon.spy(mesh, 'destroy');
        expect(mesh).not.to.be.null;

        textureAtlas.removeFrame('missing');
        expect(sprite.meshes[0]).to.be.null;
        expect(destroy.calledOnce).to.be.true;
        sprite.destroy();
        textureAtlas.destroy();
    });

    it('stops following an atlas after replacement or destruction', function () {
        const firstAtlas = atlas();
        const secondAtlas = atlas();
        const sprite = new Sprite(device, { atlas: firstAtlas, frameKeys: ['walk'] });
        sprite.atlas = secondAtlas;
        const changed = sinon.spy(sprite, 'fire');

        firstAtlas.setFrame('walk', frame(10));
        expect(changed.withArgs('set:meshes').callCount).to.equal(0);
        secondAtlas.setFrame('walk', frame(12));
        expect(changed.withArgs('set:meshes').callCount).to.equal(1);

        sprite.destroy();
        secondAtlas.setFrame('walk', frame(14));
        expect(changed.withArgs('set:meshes').callCount).to.equal(1);
        expect(sprite.meshes).to.be.empty;
        firstAtlas.destroy();
        secondAtlas.destroy();
    });
});
