import { expect } from 'chai';

import { Entity } from '../../../../src/framework/entity.js';
import { LAYERID_UI } from '../../../../src/scene/constants.js';
import { createApp } from '../../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../../jsdom.mjs';

describe('ElementComponent', function () {
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

    describe('#constructor', function () {

        it('creates a default element component', function () {
            const e = new Entity();
            e.addComponent('element');

            expect(e.element.alignment).to.equal(null);
            expect(e.element.anchor.x).to.equal(0);
            expect(e.element.anchor.y).to.equal(0);
            expect(e.element.anchor.z).to.equal(0);
            expect(e.element.anchor.w).to.equal(0);
            expect(e.element.autoFitHeight).to.equal(null);
            expect(e.element.autoFitWidth).to.equal(null);
            expect(e.element.autoHeight).to.equal(null);
            expect(e.element.autoWidth).to.equal(null);
            expect(e.element.batchGroupId).to.equal(-1);
            expect(e.element.bottom).to.equal(0);
            expect(e.element.calculatedHeight).to.equal(32);
            expect(e.element.calculatedWidth).to.equal(32);
            expect(e.element.canvasCorners[0].x).to.equal(0);
            expect(e.element.canvasCorners[0].y).to.equal(0);
            expect(e.element.canvasCorners[1].x).to.equal(0);
            expect(e.element.canvasCorners[1].y).to.equal(0);
            expect(e.element.canvasCorners[2].x).to.equal(0);
            expect(e.element.canvasCorners[2].y).to.equal(0);
            expect(e.element.canvasCorners[3].x).to.equal(0);
            expect(e.element.canvasCorners[3].y).to.equal(0);
            expect(e.element.color).to.equal(null);
            expect(e.element.drawOrder).to.equal(0);
            expect(e.element.enableMarkup).to.equal(null);
            expect(e.element.font).to.equal(null);
            expect(e.element.fontAsset).to.equal(null);
            expect(e.element.fontSize).to.equal(null);
            expect(e.element.height).to.equal(32);
            expect(e.element.layers).to.contain(LAYERID_UI);
            expect(e.element.left).to.equal(0);
            expect(e.element.lineHeight).to.equal(null);
            expect(e.element.margin.x).to.equal(0);
            expect(e.element.margin.y).to.equal(0);
            expect(e.element.margin.z).to.equal(-32);
            expect(e.element.margin.w).to.equal(-32);
            expect(e.element.mask).to.equal(null);
            expect(e.element.material).to.equal(null);
            expect(e.element.materialAsset).to.equal(null);
            expect(e.element.maxFontSize).to.equal(null);
            expect(e.element.maxLines).to.equal(null);
            expect(e.element.minFontSize).to.equal(null);
            expect(e.element.opacity).to.equal(null);
            expect(e.element.outlineColor).to.equal(null);
            expect(e.element.outlineThickness).to.equal(null);
            expect(e.element.pivot.x).to.equal(0);
            expect(e.element.pivot.y).to.equal(0);
            expect(e.element.pixelsPerUnit).to.equal(null);
            expect(e.element.rangeEnd).to.equal(null);
            expect(e.element.rangeStart).to.equal(null);
            expect(e.element.rect).to.equal(null);
            expect(e.element.right).to.equal(-32);
            expect(e.element.rtlReorder).to.equal(null);
            expect(e.element.screen).to.equal(null);
            expect(e.element.screenCorners[0].x).to.equal(0);
            expect(e.element.screenCorners[0].y).to.equal(0);
            expect(e.element.screenCorners[0].z).to.equal(0);
            expect(e.element.screenCorners[1].x).to.equal(0);
            expect(e.element.screenCorners[1].y).to.equal(0);
            expect(e.element.screenCorners[1].z).to.equal(0);
            expect(e.element.screenCorners[2].x).to.equal(0);
            expect(e.element.screenCorners[2].y).to.equal(0);
            expect(e.element.screenCorners[2].z).to.equal(0);
            expect(e.element.screenCorners[3].x).to.equal(0);
            expect(e.element.screenCorners[3].y).to.equal(0);
            expect(e.element.screenCorners[3].z).to.equal(0);
            expect(e.element.shadowColor).to.equal(null);
            expect(e.element.shadowOffset).to.equal(null);
            expect(e.element.spacing).to.equal(null);
            expect(e.element.sprite).to.equal(null);
            expect(e.element.spriteAsset).to.equal(null);
            expect(e.element.spriteFrame).to.equal(null);
            expect(e.element.text).to.equal(null);
            expect(e.element.textHeight).to.equal(0);
            expect(e.element.textWidth).to.equal(0);
            expect(e.element.texture).to.equal(null);
            expect(e.element.textureAsset).to.equal(null);
            expect(e.element.top).to.equal(-32);
            expect(e.element.type).to.equal('group');
            expect(e.element.unicodeConverter).to.equal(null);
            expect(e.element.useInput).to.equal(false);
            expect(e.element.width).to.equal(32);
            expect(e.element.worldCorners[0].x).to.equal(0);
            expect(e.element.worldCorners[0].y).to.equal(0);
            expect(e.element.worldCorners[0].z).to.equal(0);
            expect(e.element.worldCorners[1].x).to.equal(32);
            expect(e.element.worldCorners[1].y).to.equal(0);
            expect(e.element.worldCorners[1].z).to.equal(0);
            expect(e.element.worldCorners[2].x).to.equal(32);
            expect(e.element.worldCorners[2].y).to.equal(32);
            expect(e.element.worldCorners[2].z).to.equal(0);
            expect(e.element.worldCorners[3].x).to.equal(0);
            expect(e.element.worldCorners[3].y).to.equal(32);
            expect(e.element.worldCorners[3].z).to.equal(0);
            expect(e.element.wrapLines).to.equal(null);
        });

    });

    it('unbinds screen component on reparent', function () {
        const screen = new Entity();
        screen.addComponent('screen');
        app.root.addChild(screen);

        const e = new Entity();
        e.addComponent('element');

        screen.addChild(e);

        expect(screen.screen._elements).to.include(e.element);

        e.reparent(app.root);

        expect(screen.screen._elements).to.not.include(e.element);
    });

    it('unbinds screen component on destroy', function () {
        const screen = new Entity();
        screen.addComponent('screen');
        app.root.addChild(screen);

        const e = new Entity();
        e.addComponent('element');

        screen.addChild(e);

        expect(screen.screen._elements).to.include(e.element);

        e.destroy();

        expect(screen.screen._elements).to.not.include(e.element);
    });

    it('can be reparented after its screen has been destroyed (#1151)', function () {
        const screen = new Entity();
        screen.addComponent('screen');
        app.root.addChild(screen);

        const e = new Entity();
        e.addComponent('element');
        screen.addChild(e);

        // detach the element for later reuse, then destroy its screen (e.g. on scene unload)
        e.reparent(null);
        screen.destroy();

        // the dangling screen reference should have been cleared
        expect(e.element.screen).to.equal(null);

        // reparenting the element again should not throw
        const newParent = new Entity();
        app.root.addChild(newParent);
        expect(() => newParent.addChild(e)).to.not.throw();
    });

    describe('position', function () {

        let screen;

        beforeEach(function () {
            screen = new Entity('screen');
            screen.addComponent('screen', { screenSpace: true });
            app.root.addChild(screen);
        });

        it('keeps the position of an entity that is already under a screen', function () {
            const e = new Entity();
            screen.addChild(e);
            e.setLocalPosition(0, -40, 0);

            e.addComponent('element', {
                type: 'image',
                anchor: [0.5, 1, 0.5, 1],
                pivot: [0.5, 1]
            });

            const position = e.getLocalPosition();
            expect(position.x).to.equal(0);
            expect(position.y).to.equal(-40);
        });

        it('keeps the position under a screen when the default size is given', function () {
            const e = new Entity();
            screen.addChild(e);
            e.setLocalPosition(0, -40, 0);

            e.addComponent('element', {
                type: 'image',
                anchor: [0.5, 1, 0.5, 1],
                pivot: [0.5, 1],
                width: 32,
                height: 32
            });

            const position = e.getLocalPosition();
            expect(position.x).to.equal(0);
            expect(position.y).to.equal(-40);
        });

        it('keeps the position of an entity that is added to a screen afterwards', function () {
            const e = new Entity();
            e.setLocalPosition(10, 20, 0);
            e.addComponent('element', {
                type: 'image',
                anchor: [0.5, 0.5, 0.5, 0.5],
                pivot: [0.5, 0.5]
            });

            screen.addChild(e);

            const position = e.getLocalPosition();
            expect(position.x).to.equal(10);
            expect(position.y).to.equal(20);
        });

        it('keeps a position set before the element is added to a screen', function () {
            const e = new Entity();
            e.addComponent('element', {
                type: 'image',
                anchor: [0.5, 0.5, 0.5, 0.5],
                pivot: [0.5, 0.5]
            });
            e.setLocalPosition(10, 20, 0);

            screen.addChild(e);

            const position = e.getLocalPosition();
            expect(position.x).to.equal(10);
            expect(position.y).to.equal(20);
        });

        it('keeps the position of an entity added to a screen with its parent', function () {
            const panel = new Entity('panel');
            panel.addComponent('element', {
                type: 'group',
                anchor: [0, 0, 1, 1],
                margin: [0, 0, 0, 0]
            });

            const e = new Entity();
            panel.addChild(e);
            e.setLocalPosition(0, -40, 0);
            e.addComponent('element', {
                type: 'image',
                anchor: [0.5, 1, 0.5, 1],
                pivot: [0.5, 1]
            });

            screen.addChild(panel);

            const position = e.getLocalPosition();
            expect(position.x).to.equal(0);
            expect(position.y).to.equal(-40);
        });

        it('keeps the position of an entity whose screen is added afterwards', function () {
            const ui = new Entity('ui');
            app.root.addChild(ui);

            const e = new Entity();
            ui.addChild(e);
            e.setLocalPosition(0, -40, 0);
            e.addComponent('element', {
                type: 'image',
                anchor: [0.5, 1, 0.5, 1],
                pivot: [0.5, 1]
            });

            ui.addComponent('screen', { screenSpace: true });

            const position = e.getLocalPosition();
            expect(position.x).to.equal(0);
            expect(position.y).to.equal(-40);
        });

        it('keeps the position of an entity when it is cloned', function () {
            const e = new Entity();
            screen.addChild(e);
            e.setLocalPosition(0, -40, 0);
            e.addComponent('element', {
                type: 'image',
                anchor: [0.5, 1, 0.5, 1],
                pivot: [0.5, 1]
            });

            const clone = e.clone();
            screen.addChild(clone);

            const position = clone.getLocalPosition();
            expect(position.x).to.equal(0);
            expect(position.y).to.equal(-40);
        });

        it('keeps the vertical position when only horizontal margins are given', function () {
            const e = new Entity();
            screen.addChild(e);
            e.setLocalPosition(0, -40, 0);

            // a bar stretched across the top of the screen
            e.addComponent('element', {
                type: 'image',
                anchor: [0, 1, 1, 1],
                pivot: [0.5, 1],
                left: 0,
                right: 0
            });

            expect(e.getLocalPosition().y).to.equal(-40);
        });

        it('keeps the horizontal position when only vertical margins are given', function () {
            const e = new Entity();
            screen.addChild(e);
            e.setLocalPosition(25, 0, 0);

            // a bar stretched down the left of the screen
            e.addComponent('element', {
                type: 'image',
                anchor: [0, 0, 0, 1],
                pivot: [0, 0.5],
                bottom: 0,
                top: 0
            });

            expect(e.getLocalPosition().x).to.equal(25);
        });

        it('keeps a position set after the element is added when the screen resizes', function () {
            const e = new Entity();
            screen.addChild(e);
            e.addComponent('element', {
                type: 'image',
                anchor: [0.5, 1, 0.5, 1],
                pivot: [0.5, 1]
            });
            e.setLocalPosition(0, -40, 0);

            app.graphicsDevice.setResolution(640, 320);

            const position = e.getLocalPosition();
            expect(position.x).to.equal(0);
            expect(position.y).to.equal(-40);
        });

        it('keeps a translation after the element is added when the screen resizes', function () {
            const e = new Entity();
            screen.addChild(e);
            e.addComponent('element', {
                type: 'image',
                anchor: [0.5, 1, 0.5, 1],
                pivot: [0.5, 1]
            });
            e.translateLocal(0, -40, 0);

            // the next frame syncs the hierarchy, which updates the margins
            app.root.syncHierarchy();
            app.graphicsDevice.setResolution(640, 320);

            const position = e.getLocalPosition();
            expect(position.x).to.equal(0);
            expect(position.y).to.equal(-40);
        });

        it('places the element with the margins it is given', function () {
            const e = new Entity();
            screen.addChild(e);

            e.addComponent('element', {
                type: 'image',
                anchor: [0, 0, 0, 0],
                pivot: [0, 0],
                margin: [10, 20, -42, -52]
            });

            const position = e.getLocalPosition();
            expect(position.x).to.equal(10);
            expect(position.y).to.equal(20);
            expect(e.element.calculatedWidth).to.equal(32);
            expect(e.element.calculatedHeight).to.equal(32);
        });

    });

    describe('#type', function () {

        it('adds model to layers when type is set to image after entity is in hierarchy', function () {
            // This tests the fix for: https://github.com/playcanvas/engine/issues/1989
            // When entity is added to hierarchy before element type is set, the image should still render
            const e = new Entity();
            app.root.addChild(e);

            e.addComponent('element');
            e.element.type = 'image';

            // Verify that the image element's model has been added to the layers
            const uiLayer = app.scene.layers.getLayerById(LAYERID_UI);
            expect(uiLayer).to.not.be.null;
            expect(e.element._image).to.not.be.null;
            expect(e.element._image._renderable.model).to.not.be.null;
            expect(e.element._addedModels).to.include(e.element._image._renderable.model);
        });

        it('adds model to layers when type is set to text after entity is in hierarchy', function () {
            const e = new Entity();
            app.root.addChild(e);

            e.addComponent('element');
            e.element.type = 'text';

            // Verify that the text element's model has been added to the layers
            expect(e.element._text).to.not.be.null;
            expect(e.element._text._model).to.not.be.null;
            expect(e.element._addedModels).to.include(e.element._text._model);
        });

        it('does not accumulate graph nodes when the type changes (#4333)', function () {
            const e = new Entity();
            app.root.addChild(e);

            e.addComponent('element', { type: 'text' });
            expect(e.children.length).to.equal(1);

            e.element.type = 'image';
            expect(e.children.length).to.equal(1);

            e.element.type = 'text';
            expect(e.children.length).to.equal(1);

            e.element.type = 'group';
            expect(e.children.length).to.equal(0);
        });

    });

    describe('#onBeforeRemove', function () {

        it('removes the text element graph node from the entity (#4333)', function () {
            const e = new Entity();
            app.root.addChild(e);

            e.addComponent('element', { type: 'text' });
            e.removeComponent('element');

            expect(e.children.length).to.equal(0);
        });

        it('removes the image element graph node from the entity (#4333)', function () {
            const e = new Entity();
            app.root.addChild(e);

            e.addComponent('element', { type: 'image' });
            e.removeComponent('element');

            expect(e.children.length).to.equal(0);
        });

    });
});
