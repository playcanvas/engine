import { expect } from 'chai';

import { ScreenComponent } from '../../../../src/framework/components/screen/component.js';
import { Entity } from '../../../../src/framework/entity.js';
import { createApp } from '../../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../../jsdom.mjs';

describe('ElementComponent Draw Order', function () {
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

    it('basic hierarchy', function () {
        const screen = new Entity('screen');
        screen.addComponent('screen');

        const p1 = new Entity('p1');
        p1.addComponent('element');

        const c1 = new Entity('c1');
        c1.addComponent('element');

        p1.addChild(c1);
        screen.addChild(p1);
        app.root.addChild(screen);

        // update forces draw order sync
        app.tick();

        expect(p1.element.drawOrder).to.equal(1);
        expect(c1.element.drawOrder).to.equal(2);
    });

    it('clamp max drawOrder', function () {
        const p1 = new Entity('p1');
        p1.addComponent('element');
        p1.element.drawOrder = 0x1FFFFFF;

        expect(p1.element.drawOrder).to.equal(0xFFFFFF);
    });

    it('reorder children', function () {
        const screen = new Entity('screen');
        screen.addComponent('screen');

        const p1 = new Entity('p1');
        p1.addComponent('element');

        const c1 = new Entity('c1');
        c1.addComponent('element');

        const c2 = new Entity('c2');
        c2.addComponent('element');

        p1.addChild(c1);
        screen.addChild(p1);
        app.root.addChild(screen);

        p1.removeChild(c2);
        p1.insertChild(c2, 0);

        // update forces draw order sync
        app.tick();

        expect(p1.element.drawOrder).to.equal(1);
        expect(c2.element.drawOrder).to.equal(2);
        expect(c1.element.drawOrder).to.equal(3);
    });

    it('add screen late', function () {
        const screen = new Entity('screen');

        const p1 = new Entity('p1');
        p1.addComponent('element');

        const c1 = new Entity('c1');
        c1.addComponent('element');

        p1.addChild(c1);
        screen.addChild(p1);
        app.root.addChild(screen);

        screen.addComponent('screen');

        // update forces draw order sync
        app.tick();

        expect(p1.element.drawOrder).to.equal(1);
        expect(c1.element.drawOrder).to.equal(2);
    });

    it('reparent to screen', function () {
        const screen = new Entity('screen');
        screen.addComponent('screen');

        const p1 = new Entity('p1');
        p1.addComponent('element');

        const c1 = new Entity('c1');
        c1.addComponent('element');

        p1.addChild(c1);
        app.root.addChild(p1);
        app.root.addChild(screen);

        p1.reparent(screen);

        // update forces draw order sync
        app.tick();

        expect(p1.element.drawOrder).to.equal(1);
        expect(c1.element.drawOrder).to.equal(2);
    });

    it('single call to _processDrawOrderSync', function () {
        let count = 0;
        // patch to count
        const _processDrawOrderSync = ScreenComponent.prototype._processDrawOrderSync;
        ScreenComponent.prototype._processDrawOrderSync = function () {
            count++;
            _processDrawOrderSync.apply(this, arguments);
        };

        const screen = new Entity('screen');
        screen.addComponent('screen');

        const p1 = new Entity('p1');
        p1.addComponent('element');

        const c1 = new Entity('c1');
        c1.addComponent('element');

        p1.addChild(c1);
        screen.addChild(p1);
        app.root.addChild(screen);

        // update forces draw order sync
        app.tick();

        expect(count).to.equal(1);

        // restore original
        ScreenComponent.prototype._processDrawOrderSync = _processDrawOrderSync;
    });

    it('Unmask drawOrder', function () {
        const screen = new Entity('screen');
        screen.addComponent('screen');

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

        m2.addChild(m3);
        m1.addChild(m2);
        m1.addChild(c1);
        screen.addChild(m1);
        app.root.addChild(screen);

        // update forces draw order sync
        app.tick();

        const m1DrawOrder = m1.element.drawOrder;
        const m2DrawOrder = m2.element.drawOrder;
        const m3DrawOrder = m3.element.drawOrder;
        const c1DrawOrder = c1.element.drawOrder;

        const m1Unmask = m1.element._image._renderable.unmaskMeshInstance.drawOrder;
        const m2Unmask = m2.element._image._renderable.unmaskMeshInstance.drawOrder;
        const m3Unmask = m3.element._image._renderable.unmaskMeshInstance.drawOrder;

        expect(m1Unmask > m1DrawOrder).to.equal(true, 'unmask for m1 drawn after m1');
        expect(m1Unmask > m2DrawOrder).to.equal(true, 'unmask for m1 drawn after m2');
        expect(m1Unmask > m3DrawOrder).to.equal(true, 'unmask for m1 drawn after m3');
        expect(m1Unmask > c1DrawOrder).to.equal(true, 'unmask for m1 drawn after c1');
        expect(m1Unmask > m2Unmask).to.equal(true, 'unmask for m1 drawn after unmask m2');
        expect(m1Unmask > m3Unmask).to.equal(true, 'unmask for m1 drawn after unmask m3');

        expect(m2Unmask > m1DrawOrder).to.equal(true, 'unmask for m2 drawn after m1');
        expect(m2Unmask > m2DrawOrder).to.equal(true, 'unmask for m2 drawn after m2');
        expect(m2Unmask > m3DrawOrder).to.equal(true, 'unmask for m2 drawn after m3');
        expect(m2Unmask < c1DrawOrder).to.equal(true, 'unmask for m2 drawn before c1');
        expect(m2Unmask < m1Unmask).to.equal(true, 'unmask for m2 drawn before unmask m2');
        expect(m2Unmask > m3Unmask).to.equal(true, 'unmask for m2 drawn after unmask m3');

        expect(m3Unmask > m1DrawOrder).to.equal(true, 'unmask for m3 drawn after m1');
        expect(m3Unmask > m2DrawOrder).to.equal(true, 'unmask for m3 drawn after m2');
        expect(m3Unmask > m3DrawOrder).to.equal(true, 'unmask for m3 drawn after m3');
        expect(m3Unmask < c1DrawOrder).to.equal(true, 'unmask for m3 drawn before c1');
        expect(m3Unmask < m1Unmask).to.equal(true, 'unmask for m1 drawn before unmask m2');
        expect(m3Unmask < m2Unmask).to.equal(true, 'unmask for m1 drawn before unmask m3');
    });

    it('Unmask drawOrder - draw order remains the same for repeated calls', function () {
        const screen = new Entity('screen');
        screen.addComponent('screen');

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

        m2.addChild(m3);
        m1.addChild(m2);
        m1.addChild(c1);
        screen.addChild(m1);
        app.root.addChild(screen);

        // force mask and draw order sync
        app.tick();

        const addChild = function (parent) {
            const e = new Entity();
            e.addComponent('element', {
                type: 'image',
                mask: true
            });
            parent.addChild(e);
            return e;
        };

        const beforeResult = {
            m1DrawOrder: m1.element.drawOrder,
            m2DrawOrder: m2.element.drawOrder,
            m3DrawOrder: m3.element.drawOrder,
            c1DrawOrder: c1.element.drawOrder,
            m1Unmask: m1.element._image._renderable.unmaskMeshInstance.drawOrder,
            m2Unmask: m2.element._image._renderable.unmaskMeshInstance.drawOrder,
            m3Unmask: m3.element._image._renderable.unmaskMeshInstance.drawOrder
        };

        const e = addChild(m1);
        app.tick();
        e.destroy();
        app.tick();

        const afterResult = {
            m1DrawOrder: m1.element.drawOrder,
            m2DrawOrder: m2.element.drawOrder,
            m3DrawOrder: m3.element.drawOrder,
            c1DrawOrder: c1.element.drawOrder,
            m1Unmask: m1.element._image._renderable.unmaskMeshInstance.drawOrder,
            m2Unmask: m2.element._image._renderable.unmaskMeshInstance.drawOrder,
            m3Unmask: m3.element._image._renderable.unmaskMeshInstance.drawOrder
        };

        expect(beforeResult.m1DrawOrder).to.equal(afterResult.m1DrawOrder);
        expect(beforeResult.m2DrawOrder).to.equal(afterResult.m2DrawOrder);
        expect(beforeResult.m3DrawOrder).to.equal(afterResult.m3DrawOrder);
        expect(beforeResult.c1DrawOrder).to.equal(afterResult.c1DrawOrder);
        expect(beforeResult.m1Unmask).to.equal(afterResult.m1Unmask);
        expect(beforeResult.m2Unmask).to.equal(afterResult.m2Unmask);
        expect(beforeResult.m3Unmask).to.equal(afterResult.m3Unmask);
    });

});
