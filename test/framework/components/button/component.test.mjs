import { expect } from 'chai';

import { Color } from '../../../../src/core/math/color.js';
import { Vec4 } from '../../../../src/core/math/vec4.js';
import { BUTTON_TRANSITION_MODE_SPRITE_CHANGE, BUTTON_TRANSITION_MODE_TINT } from '../../../../src/framework/components/button/constants.js';
import { ELEMENTTYPE_IMAGE } from '../../../../src/framework/components/element/constants.js';
import { Entity } from '../../../../src/framework/entity.js';
import { createApp } from '../../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../../jsdom.mjs';

/**
 * @param {object} [data] - Additional button component data.
 * @returns {{ image: Entity, button: Entity }} A button entity wired to an image entity.
 */
function createButton(data = {}) {
    const image = new Entity('image');
    image.addComponent('element', { type: ELEMENTTYPE_IMAGE });

    const button = new Entity('button');
    button.addChild(image);
    button.addComponent('element', { type: ELEMENTTYPE_IMAGE, useInput: true });
    button.addComponent('button', { ...data, imageEntity: image });

    return { image, button };
}

describe('ButtonComponent', function () {
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

    describe('#addComponent', function () {

        it('creates a component with sensible defaults', function () {
            const e = new Entity();
            e.addComponent('button');

            expect(e.button).to.exist;
            expect(e.button.enabled).to.equal(true);
            expect(e.button.active).to.equal(true);
            expect(e.button.imageEntity).to.equal(null);
            expect(e.button.hitPadding).to.be.an.instanceof(Vec4);
            expect(e.button.hitPadding.equals(new Vec4())).to.equal(true);
            expect(e.button.transitionMode).to.equal(BUTTON_TRANSITION_MODE_TINT);
            expect(e.button.hoverTint.equals(new Color(0.75, 0.75, 0.75))).to.equal(true);
            expect(e.button.pressedTint.equals(new Color(0.5, 0.5, 0.5))).to.equal(true);
            expect(e.button.inactiveTint.equals(new Color(0.25, 0.25, 0.25))).to.equal(true);
            expect(e.button.fadeDuration).to.equal(0);
            expect(e.button.hoverSpriteAsset).to.equal(null);
            expect(e.button.hoverSpriteFrame).to.equal(0);
            expect(e.button.pressedSpriteAsset).to.equal(null);
            expect(e.button.pressedSpriteFrame).to.equal(0);
            expect(e.button.inactiveSpriteAsset).to.equal(null);
            expect(e.button.inactiveSpriteFrame).to.equal(0);
        });

        it('round-trips every property passed via the data argument', function () {
            const { image, button } = createButton({
                enabled: false,
                active: false,
                hitPadding: new Vec4(1, 2, 3, 4),
                transitionMode: BUTTON_TRANSITION_MODE_SPRITE_CHANGE,
                hoverTint: new Color(0.1, 0.2, 0.3, 0.4),
                pressedTint: new Color(0.5, 0.6, 0.7, 0.8),
                inactiveTint: new Color(0.9, 0.8, 0.7, 0.6),
                fadeDuration: 100,
                hoverSpriteAsset: 11,
                hoverSpriteFrame: 1,
                pressedSpriteAsset: 22,
                pressedSpriteFrame: 2,
                inactiveSpriteAsset: 33,
                inactiveSpriteFrame: 3
            });

            const c = button.button;
            expect(c.enabled).to.equal(false);
            expect(c.active).to.equal(false);
            expect(c.imageEntity).to.equal(image);
            expect(c.hitPadding.equals(new Vec4(1, 2, 3, 4))).to.equal(true);
            expect(c.transitionMode).to.equal(BUTTON_TRANSITION_MODE_SPRITE_CHANGE);
            expect(c.hoverTint.equals(new Color(0.1, 0.2, 0.3, 0.4))).to.equal(true);
            expect(c.pressedTint.equals(new Color(0.5, 0.6, 0.7, 0.8))).to.equal(true);
            expect(c.inactiveTint.equals(new Color(0.9, 0.8, 0.7, 0.6))).to.equal(true);
            expect(c.fadeDuration).to.equal(100);
            expect(c.hoverSpriteAsset).to.equal(11);
            expect(c.hoverSpriteFrame).to.equal(1);
            expect(c.pressedSpriteAsset).to.equal(22);
            expect(c.pressedSpriteFrame).to.equal(2);
            expect(c.inactiveSpriteAsset).to.equal(33);
            expect(c.inactiveSpriteFrame).to.equal(3);
        });

        it('preserves class-field defaults when properties are passed as explicit undefined', function () {
            const e = new Entity();
            e.addComponent('button', {
                hoverTint: undefined,
                hitPadding: undefined,
                fadeDuration: undefined
            });

            expect(e.button.hoverTint.equals(new Color(0.75, 0.75, 0.75))).to.equal(true);
            expect(e.button.hitPadding.equals(new Vec4())).to.equal(true);
            expect(e.button.fadeDuration).to.equal(0);
        });

    });

    describe('#hoverTint', function () {

        it('accepts an [r, g, b, a] array', function () {
            const e = new Entity();
            e.addComponent('button');

            e.button.hoverTint = [0.1, 0.2, 0.3, 0.4];

            expect(e.button.hoverTint).to.be.an.instanceof(Color);
            expect(e.button.hoverTint.equals(new Color(0.1, 0.2, 0.3, 0.4))).to.equal(true);
        });

        it('defaults alpha to 1 for an [r, g, b] array', function () {
            const e = new Entity();
            e.addComponent('button');

            e.button.hoverTint = [0.1, 0.2, 0.3];

            expect(e.button.hoverTint.a).to.equal(1);
        });

        it('clones Color inputs so caller mutations do not leak into component state', function () {
            const e = new Entity();
            e.addComponent('button');

            const source = new Color(0.1, 0.2, 0.3, 0.4);
            e.button.hoverTint = source;

            expect(e.button.hoverTint).to.not.equal(source);

            source.r = 0.9;
            expect(e.button.hoverTint.r).to.be.closeTo(0.1, 1e-6);
        });

    });

    describe('#hitPadding', function () {

        it('accepts an [x, y, z, w] array', function () {
            const e = new Entity();
            e.addComponent('button');

            e.button.hitPadding = [1, 2, 3, 4];

            expect(e.button.hitPadding).to.be.an.instanceof(Vec4);
            expect(e.button.hitPadding.equals(new Vec4(1, 2, 3, 4))).to.equal(true);
        });

        it('clones Vec4 inputs so caller mutations do not leak into component state', function () {
            const e = new Entity();
            e.addComponent('button');

            const source = new Vec4(1, 2, 3, 4);
            e.button.hitPadding = source;

            expect(e.button.hitPadding).to.not.equal(source);

            source.x = 9;
            expect(e.button.hitPadding.x).to.equal(1);
        });

        it('passes falsy values through untouched', function () {
            const e = new Entity();
            e.addComponent('button');

            e.button.hitPadding = null;

            expect(e.button.hitPadding).to.equal(null);
        });

    });

    describe('#active', function () {

        it('applies the inactive tint to the image element when deactivated', function () {
            const { image, button } = createButton();
            app.root.addChild(button);

            // image element starts at its default white tint
            expect(image.element.color.r).to.be.closeTo(1, 1e-6);

            button.button.active = false;

            expect(image.element.color.r).to.be.closeTo(0.25, 1e-6);
            expect(image.element.color.g).to.be.closeTo(0.25, 1e-6);
            expect(image.element.color.b).to.be.closeTo(0.25, 1e-6);
            expect(image.element.opacity).to.be.closeTo(1, 1e-6);
        });

        it('reapplies the inactive tint when it changes while inactive', function () {
            const { image, button } = createButton({ active: false });
            app.root.addChild(button);

            button.button.inactiveTint = new Color(0.2, 0.4, 0.6);

            expect(image.element.color.r).to.be.closeTo(0.2, 1e-6);
            expect(image.element.color.g).to.be.closeTo(0.4, 1e-6);
            expect(image.element.color.b).to.be.closeTo(0.6, 1e-6);
        });

        it('suppresses button events while inactive', function () {
            const { button } = createButton({ active: false });
            app.root.addChild(button);

            let clicks = 0;
            button.button.on('click', () => {
                clicks++;
            });

            button.element.fire('click', {});
            expect(clicks).to.equal(0);

            button.button.active = true;

            button.element.fire('click', {});
            expect(clicks).to.equal(1);
        });

    });

    describe('#transitionMode', function () {

        it('restores the default tint and applies the state sprite when switching to sprite mode', function () {
            const { image, button } = createButton({
                active: false,
                inactiveSpriteFrame: 2
            });
            app.root.addChild(button);

            // tint mode has applied the inactive tint
            expect(image.element.color.r).to.be.closeTo(0.25, 1e-6);

            button.button.transitionMode = BUTTON_TRANSITION_MODE_SPRITE_CHANGE;

            // the previous mode's tint is reset to the stored default...
            expect(image.element.color.r).to.be.closeTo(1, 1e-6);
            // ...and the sprite for the current (inactive) state is applied
            expect(image.element.spriteFrame).to.equal(2);
        });

        it('is a no-op when the mode is unchanged', function () {
            const { image, button } = createButton({ active: false });
            app.root.addChild(button);

            button.button.transitionMode = BUTTON_TRANSITION_MODE_TINT;

            // the inactive tint remains applied - no reset to the default tint occurred
            expect(image.element.color.r).to.be.closeTo(0.25, 1e-6);
        });

    });

    describe('#imageEntity', function () {

        it('accepts an Entity reference', function () {
            const image = new Entity();
            image.addComponent('element', { type: ELEMENTTYPE_IMAGE });

            const e = new Entity();
            e.addComponent('button');

            e.button.imageEntity = image;

            expect(e.button.imageEntity).to.equal(image);
        });

        it('accepts a GUID string and resolves via app.getEntityFromIndex', function () {
            const image = new Entity();
            image.addComponent('element', { type: ELEMENTTYPE_IMAGE });

            const e = new Entity();
            e.addComponent('button');

            e.button.imageEntity = image.guid;

            expect(e.button.imageEntity).to.equal(image);
        });

        it('accepts null', function () {
            const image = new Entity();
            image.addComponent('element', { type: ELEMENTTYPE_IMAGE });

            const e = new Entity();
            e.addComponent('button', { imageEntity: image });

            e.button.imageEntity = null;

            expect(e.button.imageEntity).to.equal(null);
        });

        it('unsubscribes from the previous image entity when reassigned', function () {
            const image1 = new Entity();
            image1.addComponent('element', { type: ELEMENTTYPE_IMAGE });

            const image2 = new Entity();
            image2.addComponent('element', { type: ELEMENTTYPE_IMAGE });

            const e = new Entity();
            e.addComponent('button', { imageEntity: image1 });

            // button should be listening to image1's element:add
            expect(image1.hasEvent('element:add')).to.equal(true);
            expect(image2.hasEvent('element:add')).to.equal(false);

            e.button.imageEntity = image2;

            expect(e.button.imageEntity).to.equal(image2);
            expect(image1.hasEvent('element:add')).to.equal(false);
            expect(image2.hasEvent('element:add')).to.equal(true);
        });

    });

    describe('#cloneComponent', function () {

        it('clones every property', function () {
            const { button } = createButton({
                enabled: false,
                active: false,
                hitPadding: new Vec4(1, 2, 3, 4),
                hoverTint: new Color(0.1, 0.2, 0.3, 0.4),
                pressedTint: new Color(0.5, 0.6, 0.7, 0.8),
                inactiveTint: new Color(0.9, 0.8, 0.7, 0.6),
                fadeDuration: 100,
                hoverSpriteAsset: 11,
                hoverSpriteFrame: 1,
                pressedSpriteAsset: 22,
                pressedSpriteFrame: 2,
                inactiveSpriteAsset: 33,
                inactiveSpriteFrame: 3
            });

            const clone = button.clone();
            const c = clone.button;

            expect(c).to.exist;
            expect(c.enabled).to.equal(false);
            expect(c.active).to.equal(false);
            expect(c.hitPadding.equals(new Vec4(1, 2, 3, 4))).to.equal(true);
            expect(c.hitPadding).to.not.equal(button.button.hitPadding);
            expect(c.hoverTint.equals(new Color(0.1, 0.2, 0.3, 0.4))).to.equal(true);
            expect(c.hoverTint).to.not.equal(button.button.hoverTint);
            expect(c.pressedTint.equals(new Color(0.5, 0.6, 0.7, 0.8))).to.equal(true);
            expect(c.inactiveTint.equals(new Color(0.9, 0.8, 0.7, 0.6))).to.equal(true);
            expect(c.fadeDuration).to.equal(100);
            expect(c.hoverSpriteAsset).to.equal(11);
            expect(c.hoverSpriteFrame).to.equal(1);
            expect(c.pressedSpriteAsset).to.equal(22);
            expect(c.pressedSpriteFrame).to.equal(2);
            expect(c.inactiveSpriteAsset).to.equal(33);
            expect(c.inactiveSpriteFrame).to.equal(3);
        });

        it('remaps imageEntity to the cloned child via the duplicated ids map', function () {
            const { image, button } = createButton();

            const clone = button.clone();
            const cloneImage = clone.findByName('image');

            expect(cloneImage).to.exist;
            expect(cloneImage).to.not.equal(image);
            expect(clone.button.imageEntity).to.equal(cloneImage);
        });

    });

    describe('resolveDuplicatedEntityReferenceProperties', function () {

        it('remaps the image entity through duplicatedIdsMap', function () {
            const image = new Entity();
            image.addComponent('element', { type: ELEMENTTYPE_IMAGE });

            const replacement = new Entity();
            replacement.addComponent('element', { type: ELEMENTTYPE_IMAGE });

            const source = new Entity();
            source.addComponent('button', { imageEntity: image });

            const target = new Entity();
            target.addComponent('button');

            const map = { [image.guid]: replacement };
            target.button.resolveDuplicatedEntityReferenceProperties(source.button, map);

            expect(target.button.imageEntity).to.equal(replacement);
        });

    });

});
