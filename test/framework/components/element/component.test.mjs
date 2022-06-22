import { LAYERID_UI } from '../../../../src/scene/constants.js';
import { Application } from '../../../../src/framework/application.js';
import { Entity } from '../../../../src/framework/entity.js';

import { HTMLCanvasElement } from '@playcanvas/canvas-mock';

import { expect } from 'chai';

describe('ElementComponent', function () {
    let app;

    beforeEach(function () {
        const canvas = new HTMLCanvasElement(500, 500);
        app = new Application(canvas);
    });

    afterEach(function () {
        app.destroy();
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
});
