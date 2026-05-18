import { expect } from 'chai';

import { ELEMENTTYPE_IMAGE } from '../../../../src/framework/components/element/constants.js';
import { Entity } from '../../../../src/framework/entity.js';
import { ORIENTATION_HORIZONTAL, ORIENTATION_VERTICAL } from '../../../../src/scene/constants.js';
import { createApp } from '../../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../../jsdom.mjs';

describe('ScrollbarComponent', function () {
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
            e.addComponent('scrollbar');

            expect(e.scrollbar).to.exist;
            expect(e.scrollbar.enabled).to.equal(true);
            expect(e.scrollbar.orientation).to.equal(ORIENTATION_HORIZONTAL);
            expect(e.scrollbar.value).to.equal(0);
            expect(e.scrollbar.handleSize).to.equal(0);
            expect(e.scrollbar.handleEntity).to.equal(null);
        });

        it('round-trips every property passed via the data argument', function () {
            const handle = new Entity();
            handle.addComponent('element', { type: ELEMENTTYPE_IMAGE });

            const e = new Entity();
            e.addChild(handle);
            e.addComponent('element', { type: ELEMENTTYPE_IMAGE });
            e.addComponent('scrollbar', {
                enabled: false,
                orientation: ORIENTATION_VERTICAL,
                value: 0.4,
                handleSize: 0.3,
                handleEntity: handle
            });

            expect(e.scrollbar.enabled).to.equal(false);
            expect(e.scrollbar.orientation).to.equal(ORIENTATION_VERTICAL);
            expect(e.scrollbar.value).to.be.closeTo(0.4, 1e-6);
            expect(e.scrollbar.handleSize).to.be.closeTo(0.3, 1e-6);
            expect(e.scrollbar.handleEntity).to.equal(handle);
        });

    });

    describe('#value', function () {

        it('clamps writes outside [0, 1]', function () {
            const e = new Entity();
            e.addComponent('scrollbar');

            e.scrollbar.value = -1;
            expect(e.scrollbar.value).to.equal(0);

            e.scrollbar.value = 2;
            expect(e.scrollbar.value).to.equal(1);
        });

        it('fires set:value with the clamped value when it changes', function () {
            const e = new Entity();
            e.addComponent('scrollbar');

            const captured = [];
            e.scrollbar.on('set:value', (v) => {
                captured.push(v);
            });

            e.scrollbar.value = 1.5;
            expect(captured).to.deep.equal([1]);

            e.scrollbar.value = -0.25;
            expect(captured).to.deep.equal([1, 0]);
        });

        it('does not fire set:value when the change is below 1e-5', function () {
            const e = new Entity();
            e.addComponent('scrollbar', { value: 0.5 });

            let fired = 0;
            e.scrollbar.on('set:value', () => {
                fired++;
            });

            // sub-epsilon delta should be ignored
            e.scrollbar.value = 0.5 + 1e-7;
            expect(fired).to.equal(0);

            // setting to (effectively) the current value should also be a no-op
            e.scrollbar.value = 0.5;
            expect(fired).to.equal(0);
        });

    });

    describe('#handleSize', function () {

        it('clamps writes outside [0, 1]', function () {
            const e = new Entity();
            e.addComponent('scrollbar');

            e.scrollbar.handleSize = -2;
            expect(e.scrollbar.handleSize).to.equal(0);

            e.scrollbar.handleSize = 5;
            expect(e.scrollbar.handleSize).to.equal(1);
        });

        it('ignores writes below the 1e-5 epsilon', function () {
            const e = new Entity();
            e.addComponent('scrollbar', { handleSize: 0.5 });

            // sub-epsilon delta should leave handleSize effectively unchanged
            e.scrollbar.handleSize = 0.5 + 1e-7;
            expect(e.scrollbar.handleSize).to.be.closeTo(0.5, 1e-5);
        });

    });

    describe('#orientation', function () {

        it('zeroes the opposite dimension on the handle element when orientation changes', function () {
            const handle = new Entity();
            handle.addComponent('element', { type: ELEMENTTYPE_IMAGE, width: 50, height: 50 });

            const e = new Entity();
            e.addChild(handle);
            e.addComponent('element', { type: ELEMENTTYPE_IMAGE });
            e.addComponent('scrollbar', { handleEntity: handle, orientation: ORIENTATION_HORIZONTAL });

            expect(e.scrollbar.orientation).to.equal(ORIENTATION_HORIZONTAL);

            // switching to vertical should clear the handle element's width (the opposite of vertical)
            e.scrollbar.orientation = ORIENTATION_VERTICAL;

            expect(e.scrollbar.orientation).to.equal(ORIENTATION_VERTICAL);
            expect(handle.element.width).to.equal(0);
        });

        it('is a no-op when the orientation is unchanged', function () {
            const handle = new Entity();
            handle.addComponent('element', { type: ELEMENTTYPE_IMAGE, width: 50, height: 50 });

            const e = new Entity();
            e.addChild(handle);
            e.addComponent('element', { type: ELEMENTTYPE_IMAGE });
            e.addComponent('scrollbar', { handleEntity: handle, orientation: ORIENTATION_HORIZONTAL });

            const widthBefore = handle.element.width;
            const heightBefore = handle.element.height;

            e.scrollbar.orientation = ORIENTATION_HORIZONTAL;

            expect(handle.element.width).to.equal(widthBefore);
            expect(handle.element.height).to.equal(heightBefore);
        });

        it('rebuilds the drag helper for the new axis when orientation changes at runtime', function () {
            const handle = new Entity();
            handle.addComponent('element', { type: ELEMENTTYPE_IMAGE });

            const e = new Entity();
            e.addChild(handle);
            e.addComponent('element', { type: ELEMENTTYPE_IMAGE });
            e.addComponent('scrollbar', { handleEntity: handle, orientation: ORIENTATION_HORIZONTAL });
            app.root.addChild(e);

            // ElementDragHelper captures its axis at construction, so the helper must be
            // rebuilt for the new axis when orientation flips - otherwise drags stay on the
            // old axis and value updates can stop working
            expect(e.scrollbar._handleDragHelper._axis).to.equal('x');

            e.scrollbar.orientation = ORIENTATION_VERTICAL;

            expect(e.scrollbar._handleDragHelper._axis).to.equal('y');
        });

    });

    describe('#handleEntity', function () {

        it('accepts an Entity reference', function () {
            const handle = new Entity();
            handle.addComponent('element', { type: ELEMENTTYPE_IMAGE });

            const e = new Entity();
            e.addComponent('scrollbar');

            e.scrollbar.handleEntity = handle;

            expect(e.scrollbar.handleEntity).to.equal(handle);
        });

        it('accepts a GUID string and resolves via app.getEntityFromIndex', function () {
            const handle = new Entity();
            handle.addComponent('element', { type: ELEMENTTYPE_IMAGE });
            const handleGuid = handle.getGuid();

            const e = new Entity();
            e.addComponent('scrollbar');

            e.scrollbar.handleEntity = handleGuid;

            expect(e.scrollbar.handleEntity).to.equal(handle);
        });

        it('accepts null', function () {
            const handle = new Entity();
            handle.addComponent('element', { type: ELEMENTTYPE_IMAGE });

            const e = new Entity();
            e.addComponent('scrollbar', { handleEntity: handle });

            e.scrollbar.handleEntity = null;

            expect(e.scrollbar.handleEntity).to.equal(null);
        });

        it('does not leave a newly-built drag helper enabled when the scrollbar is disabled', function () {
            const handle = new Entity();
            // intentionally no element yet — adding it later triggers _onHandleElementGain and
            // builds a fresh ElementDragHelper, which defaults to enabled = true

            const e = new Entity();
            e.addComponent('element', { type: ELEMENTTYPE_IMAGE });
            e.addComponent('scrollbar', { enabled: false, handleEntity: handle });
            app.root.addChild(e);

            handle.addComponent('element', { type: ELEMENTTYPE_IMAGE });

            // helper must mirror the component's disabled state, not its own default
            expect(e.scrollbar._handleDragHelper).to.exist;
            expect(e.scrollbar._handleDragHelper.enabled).to.equal(false);
        });

        it('unsubscribes from the previous handle entity when reassigned', function () {
            const handle1 = new Entity();
            handle1.addComponent('element', { type: ELEMENTTYPE_IMAGE });

            const handle2 = new Entity();
            handle2.addComponent('element', { type: ELEMENTTYPE_IMAGE });

            const e = new Entity();
            e.addComponent('element', { type: ELEMENTTYPE_IMAGE });
            e.addComponent('scrollbar', { handleEntity: handle1 });

            // scrollbar should be listening to handle1's element:add
            expect(handle1.hasEvent('element:add')).to.equal(true);
            expect(handle2.hasEvent('element:add')).to.equal(false);

            e.scrollbar.handleEntity = handle2;

            expect(e.scrollbar.handleEntity).to.equal(handle2);
            expect(handle1.hasEvent('element:add')).to.equal(false);
            expect(handle2.hasEvent('element:add')).to.equal(true);
        });

    });

    describe('#cloneComponent', function () {

        it('clones every scalar property', function () {
            const e = new Entity();
            e.addComponent('scrollbar', {
                enabled: false,
                orientation: ORIENTATION_VERTICAL,
                value: 0.4,
                handleSize: 0.3
            });

            const clone = e.clone();
            const c = clone.scrollbar;

            expect(c).to.exist;
            expect(c.enabled).to.equal(false);
            expect(c.orientation).to.equal(ORIENTATION_VERTICAL);
            expect(c.value).to.be.closeTo(0.4, 1e-6);
            expect(c.handleSize).to.be.closeTo(0.3, 1e-6);
        });

        it('remaps handleEntity to the cloned child via the duplicated ids map', function () {
            const handle = new Entity('handle');
            handle.addComponent('element', { type: ELEMENTTYPE_IMAGE });

            const e = new Entity('parent');
            e.addChild(handle);
            e.addComponent('element', { type: ELEMENTTYPE_IMAGE });
            e.addComponent('scrollbar', { handleEntity: handle });

            const clone = e.clone();
            const cloneHandle = clone.findByName('handle');

            expect(cloneHandle).to.exist;
            expect(cloneHandle).to.not.equal(handle);
            expect(clone.scrollbar.handleEntity).to.equal(cloneHandle);
        });

    });

    describe('resolveDuplicatedEntityReferenceProperties', function () {

        it('remaps the handle entity through duplicatedIdsMap', function () {
            const handle = new Entity();
            handle.addComponent('element', { type: ELEMENTTYPE_IMAGE });

            const replacement = new Entity();
            replacement.addComponent('element', { type: ELEMENTTYPE_IMAGE });

            const source = new Entity();
            source.addComponent('element', { type: ELEMENTTYPE_IMAGE });
            source.addComponent('scrollbar', { handleEntity: handle });

            const target = new Entity();
            target.addComponent('element', { type: ELEMENTTYPE_IMAGE });
            target.addComponent('scrollbar');

            const map = { [handle.getGuid()]: replacement };
            target.scrollbar.resolveDuplicatedEntityReferenceProperties(source.scrollbar, map);

            expect(target.scrollbar.handleEntity).to.equal(replacement);
        });

    });

});
