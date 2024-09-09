import { Application } from '../../../../src/framework/application.js';
import { Entity } from '../../../../src/framework/entity.js';
import { NullGraphicsDevice } from '../../../../src/platform/graphics/null/null-graphics-device.js';

import { createCanvas } from 'canvas';

import { expect } from 'chai';

describe('ElementComponent Masks', function () {
    let app;

    beforeEach(function () {
        const canvas = createCanvas(500, 500);
        canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 500, height: 500 });
        app = new Application(canvas, { graphicsDevice: new NullGraphicsDevice(canvas) });
    });

    afterEach(function () {
        app.destroy();
    });

    it('add / remove', function () {
        const e = new Entity();
        e.addComponent('element', {
            type: 'image',
            mask: true
        });

        app.root.addChild(e);

        e.destroy();

        expect(!e.element).to.exist;
    });

    it('masked children', function () {
        const m1 = new Entity();
        m1.addComponent('element', {
            type: 'image',
            mask: true
        });

        const c1 = new Entity();
        c1.addComponent('element', {
            type: 'image'
        });

        m1.addChild(c1);
        app.root.addChild(m1);

        app.fire('prerender');

        expect(c1.element.maskedBy.name).to.equal(m1.name);
    });

    it('sub-masked children', function () {
        const m1 = new Entity('m1');
        m1.addComponent('element', {
            type: 'image',
            mask: true
        });

        const c1 = new Entity('c1');
        c1.addComponent('element', {
            type: 'image',
            mask: true
        });

        const c2 = new Entity('c2');
        c2.addComponent('element', {
            type: 'image'
        });

        c1.addChild(c2);
        m1.addChild(c1);
        app.root.addChild(m1);

        app.fire('prerender');

        expect(c1.element.maskedBy.name).to.equal(m1.name);
        expect(c2.element.maskedBy.name).to.equal(c1.name);

        expect(m1.element._image._maskRef).to.equal(1);
        expect(c1.element._image._maskRef).to.equal(2);
    });

    it('sibling masks, correct maskref', function () {

        // m1   m2
        // |    |
        // c1   c2

        const m1 = new Entity('m1');
        m1.addComponent('element', {
            type: 'image',
            mask: true
        });

        const m2 = new Entity('m2');
        m2.addComponent('element', {
            type: 'image',
            mask: true
        });

        const c1 = new Entity('c1');
        c1.addComponent('element', {
            type: 'image'
        });

        const c2 = new Entity('c2');
        c2.addComponent('element', {
            type: 'image'
        });

        m1.addChild(c1);
        m2.addChild(c2);
        app.root.addChild(m1);
        app.root.addChild(m2);

        app.fire('prerender');

        expect(c1.element.maskedBy.name).to.equal(m1.name);
        expect(c2.element.maskedBy.name).to.equal(m2.name);

        expect(m1.element._image._maskRef).to.equal(1);
        expect(m2.element._image._maskRef).to.equal(1);
    });

    it('sub-masked and sibling children', function () {

        //    top
        // /        \
        // m11       m12
        // |        |
        // m21       m22
        // |  \     |
        // c31 c32  d31

        const top = new Entity('top');
        top.addComponent('element', {
            type: 'group'
        });

        const m11 = new Entity('m11');
        m11.addComponent('element', {
            type: 'image',
            mask: true
        });

        const m12 = new Entity('m12');
        m12.addComponent('element', {
            type: 'image',
            mask: true
        });

        const m21 = new Entity('m21');
        m21.addComponent('element', {
            type: 'image',
            mask: true
        });

        const c31 = new Entity('c31');
        c31.addComponent('element', {
            type: 'image'
        });

        const c32 = new Entity('c32');
        c32.addComponent('element', {
            type: 'image'
        });

        const m22 = new Entity('m22');
        m22.addComponent('element', {
            type: 'image',
            mask: true
        });

        const d31 = new Entity('d31');
        d31.addComponent('element', {
            type: 'image'
        });

        m21.addChild(c31);
        m21.addChild(c32);
        m11.addChild(m21);

        m22.addChild(d31);
        m12.addChild(m22);

        top.addChild(m11);
        top.addChild(m12);

        app.root.addChild(top);

        app.fire('prerender');

        expect(m11.element._image._maskRef).to.equal(1);
        expect(m21.element.maskedBy.name).to.equal(m11.name);
        expect(m21.element._image._maskRef).to.equal(2);
        expect(c31.element.maskedBy.name).to.equal(m21.name);
        expect(c32.element.maskedBy.name).to.equal(m21.name);
        expect(m12.element._image._maskRef).to.equal(1);
        expect(m22.element.maskedBy.name).to.equal(m12.name);
        expect(m22.element._image._maskRef).to.equal(2);
        expect(d31.element.maskedBy.name).to.equal(m22.name);
    });

    it('parallel parents - sub-masked and sibling children', function () {

        // m11  m12
        // |    |
        // m21  m22
        // |    |
        // c1   d1
        //

        const m11 = new Entity('m11');
        m11.addComponent('element', {
            type: 'image',
            mask: true
        });

        const m12 = new Entity('m12');
        m12.addComponent('element', {
            type: 'image',
            mask: true
        });

        const m21 = new Entity('m21');
        m21.addComponent('element', {
            type: 'image',
            mask: true
        });

        const c1 = new Entity('c1');
        c1.addComponent('element', {
            type: 'image'
        });

        const m22 = new Entity('m22');
        m22.addComponent('element', {
            type: 'image',
            mask: true
        });

        const d1 = new Entity('d1');
        d1.addComponent('element', {
            type: 'image'
        });

        m21.addChild(c1);
        m11.addChild(m21);

        m22.addChild(d1);
        m12.addChild(m22);

        app.root.addChild(m11);
        app.root.addChild(m12);

        app.fire('prerender');

        expect(m11.element._image._maskRef).to.equal(1);
        expect(m21.element.maskedBy.name).to.equal(m11.name);
        expect(m21.element._image._maskRef).to.equal(2);
        expect(c1.element.maskedBy.name).to.equal(m21.name);
        expect(m12.element._image._maskRef).to.equal(1);
        expect(m22.element.maskedBy.name).to.equal(m12.name);
        expect(m22.element._image._maskRef).to.equal(2);
        expect(d1.element.maskedBy.name).to.equal(m22.name);
    });

    it('sub-masked and later children', function () {

        // m1
        // |  \
        // m2 c2
        // |
        // c1

        const m1 = new Entity('m1');
        m1.addComponent('element', {
            type: 'image',
            mask: true
        });

        const m2 = new Entity('m2');
        m2.addComponent('element', {
            type: 'image',
            mask: true
        });

        const c1 = new Entity('c1');
        c1.addComponent('element', {
            type: 'image'
        });

        const c2 = new Entity('c2');
        c2.addComponent('element', {
            type: 'image'
        });

        m2.addChild(c1);
        m1.addChild(m2);
        m1.addChild(c2);

        app.root.addChild(m1);

        app.fire('prerender');

        expect(m1.element._image._maskRef).to.equal(1);
        expect(m2.element.maskedBy.name).to.equal(m1.name);
        expect(m2.element._image._maskRef).to.equal(2);
        expect(c1.element.maskedBy.name).to.equal(m2.name);
        expect(c2.element.maskedBy.name).to.equal(m1.name);
    });


    it('multiple child masks and later children', function () {

        //    m1
        // /  |  \
        // m2 m3 c2
        // |
        // c1

        const m1 = new Entity('m1');
        m1.addComponent('element', {
            type: 'image',
            mask: true
        });

        const m2 = new Entity('m2');
        m2.addComponent('element', {
            type: 'image',
            mask: true
        });

        const m3 = new Entity('m3');
        m3.addComponent('element', {
            type: 'image',
            mask: true
        });

        const c1 = new Entity('c1');
        c1.addComponent('element', {
            type: 'image'
        });

        const c2 = new Entity('c2');
        c2.addComponent('element', {
            type: 'image'
        });

        m2.addChild(c1);
        m1.addChild(m2);
        m1.addChild(m3);
        m1.addChild(c2);

        app.root.addChild(m1);

        app.fire('prerender');

        expect(m1.element._image._maskRef).to.equal(1);
        expect(m2.element.maskedBy.name).to.equal(m1.name);
        expect(m2.element._image._maskRef).to.equal(2);
        expect(c1.element.maskedBy.name).to.equal(m2.name);
        expect(m3.element._image._maskRef).to.equal(2);
        expect(c2.element.maskedBy.name).to.equal(m1.name);
    });

    it('ImageElement outside a mask is culled', function () {
        const screen = new Entity();
        screen.addComponent('screen', {
            screenSpace: true
        });
        app.root.addChild(screen);

        const mask = new Entity();
        mask.addComponent('element', {
            type: 'image',
            width: 100,
            height: 100,
            pivot: [0.5, 0.5],
            mask: true
        });
        screen.addChild(mask);

        const e = new Entity();
        e.addComponent('element', {
            type: 'image',
            width: 50,
            height: 50,
            anchor: [0.5, 0.5, 0.5, 0.5],
            pivot: [0.5, 0.5]
        });
        mask.addChild(e);

        const camera = new Entity();
        camera.addComponent('camera');
        app.root.addChild(camera);

        // move just out of parent
        e.translateLocal(76, 0, 0);

        // update transform
        app.update(0.1);
        app.render();
        expect(e.element.isVisibleForCamera(camera.camera.camera)).to.be.false;

        // move just into parent
        e.translateLocal(-2, 0, 0);

        // update transform
        app.update(0.1);
        app.render();
        expect(e.element.isVisibleForCamera(camera.camera.camera)).to.be.true;
    });

    it('TextElement outside a mask is culled', function () {
        const screen = new Entity();
        screen.addComponent('screen', {
            screenSpace: true
        });
        app.root.addChild(screen);

        const mask = new Entity();
        mask.addComponent('element', {
            type: 'image',
            width: 100,
            height: 100,
            pivot: [0.5, 0.5],
            mask: true
        });
        screen.addChild(mask);

        const e = new Entity();
        e.addComponent('element', {
            type: 'text',
            width: 50,
            height: 50,
            anchor: [0.5, 0.5, 0.5, 0.5],
            pivot: [0.5, 0.5]
        });
        mask.addChild(e);

        const camera = new Entity();
        camera.addComponent('camera');
        app.root.addChild(camera);

        // move just out of parent
        e.translateLocal(76, 0, 0);

        // update transform
        app.update(0.1);
        app.render();
        expect(e.element.isVisibleForCamera(camera.camera.camera)).to.be.false;

        // move just into parent
        e.translateLocal(-2, 0, 0);

        // update transform
        app.update(0.1);
        app.render();
        expect(e.element.isVisibleForCamera(camera.camera.camera)).to.be.true;
    });

});
