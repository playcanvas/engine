import { expect } from 'chai';

import { Vec2 } from '../../../../src/core/math/vec2.js';
import { ELEMENTTYPE_GROUP, ELEMENTTYPE_IMAGE } from '../../../../src/framework/components/element/constants.js';
import {
    SCROLL_MODE_CLAMP,
    SCROLL_MODE_INFINITE,
    SCROLLBAR_VISIBILITY_SHOW_ALWAYS
} from '../../../../src/framework/components/scroll-view/constants.js';
import { Entity } from '../../../../src/framework/entity.js';
import { ORIENTATION_HORIZONTAL, ORIENTATION_VERTICAL } from '../../../../src/scene/constants.js';
import { createApp } from '../../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../../jsdom.mjs';

function buildScrollViewEntity() {
    const viewport = new Entity('viewport');
    viewport.addComponent('element', { type: ELEMENTTYPE_GROUP });

    const content = new Entity('content');
    content.addComponent('element', { type: ELEMENTTYPE_IMAGE });

    const hScrollbarHandle = new Entity('hScrollbarHandle');
    hScrollbarHandle.addComponent('element', { type: ELEMENTTYPE_IMAGE });
    const hScrollbar = new Entity('hScrollbar');
    hScrollbar.addChild(hScrollbarHandle);
    hScrollbar.addComponent('element', { type: ELEMENTTYPE_IMAGE });
    hScrollbar.addComponent('scrollbar', {
        orientation: ORIENTATION_HORIZONTAL,
        handleEntity: hScrollbarHandle
    });

    const vScrollbarHandle = new Entity('vScrollbarHandle');
    vScrollbarHandle.addComponent('element', { type: ELEMENTTYPE_IMAGE });
    const vScrollbar = new Entity('vScrollbar');
    vScrollbar.addChild(vScrollbarHandle);
    vScrollbar.addComponent('element', { type: ELEMENTTYPE_IMAGE });
    vScrollbar.addComponent('scrollbar', {
        orientation: ORIENTATION_VERTICAL,
        handleEntity: vScrollbarHandle
    });

    const e = new Entity('scrollview');
    e.addChild(viewport);
    e.addChild(content);
    e.addChild(hScrollbar);
    e.addChild(vScrollbar);
    e.addComponent('element', { type: ELEMENTTYPE_GROUP });

    return { e, viewport, content, hScrollbar, vScrollbar };
}

describe('ScrollViewComponent', function () {
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
            e.addComponent('scrollview');

            expect(e.scrollview).to.exist;
            expect(e.scrollview.enabled).to.equal(true);
            expect(e.scrollview.horizontal).to.equal(undefined);
            expect(e.scrollview.vertical).to.equal(undefined);
            expect(e.scrollview.scrollMode).to.equal(undefined);
            expect(e.scrollview.bounceAmount).to.equal(undefined);
            expect(e.scrollview.friction).to.equal(undefined);
            expect(e.scrollview.dragThreshold).to.equal(10);
            expect(e.scrollview.useMouseWheel).to.equal(true);
            expect(e.scrollview.mouseWheelSensitivity).to.be.an.instanceof(Vec2);
            expect(e.scrollview.mouseWheelSensitivity.x).to.equal(1);
            expect(e.scrollview.mouseWheelSensitivity.y).to.equal(1);
            expect(e.scrollview.horizontalScrollbarVisibility).to.equal(SCROLLBAR_VISIBILITY_SHOW_ALWAYS);
            expect(e.scrollview.verticalScrollbarVisibility).to.equal(SCROLLBAR_VISIBILITY_SHOW_ALWAYS);
            expect(e.scrollview.viewportEntity).to.equal(null);
            expect(e.scrollview.contentEntity).to.equal(null);
            expect(e.scrollview.horizontalScrollbarEntity).to.equal(null);
            expect(e.scrollview.verticalScrollbarEntity).to.equal(null);
        });

        it('preserves class-field defaults when data contains explicit undefined values', function () {
            // The legacy initializer normalized dragThreshold / useMouseWheel /
            // mouseWheelSensitivity when they were `=== undefined`, so callers shipping
            // `{ dragThreshold: undefined }` still got the default 10. The refactored
            // loop must do the same so an explicit undefined in the data argument does
            // not clobber the class-field defaults.
            const e = new Entity();
            e.addComponent('scrollview', {
                dragThreshold: undefined,
                useMouseWheel: undefined,
                mouseWheelSensitivity: undefined
            });

            expect(e.scrollview.dragThreshold).to.equal(10);
            expect(e.scrollview.useMouseWheel).to.equal(true);
            expect(e.scrollview.mouseWheelSensitivity).to.be.an.instanceof(Vec2);
            expect(e.scrollview.mouseWheelSensitivity.x).to.equal(1);
            expect(e.scrollview.mouseWheelSensitivity.y).to.equal(1);
        });

        it('round-trips every property passed via the data argument', function () {
            const { e, viewport, content, hScrollbar, vScrollbar } = buildScrollViewEntity();
            const sensitivity = new Vec2(2, 3);

            e.addComponent('scrollview', {
                enabled: false,
                horizontal: true,
                vertical: false,
                scrollMode: SCROLL_MODE_INFINITE,
                bounceAmount: 0.25,
                friction: 0.1,
                dragThreshold: 20,
                useMouseWheel: false,
                mouseWheelSensitivity: sensitivity,
                horizontalScrollbarVisibility: SCROLLBAR_VISIBILITY_SHOW_ALWAYS,
                verticalScrollbarVisibility: SCROLLBAR_VISIBILITY_SHOW_ALWAYS,
                viewportEntity: viewport,
                contentEntity: content,
                horizontalScrollbarEntity: hScrollbar,
                verticalScrollbarEntity: vScrollbar
            });

            expect(e.scrollview.enabled).to.equal(false);
            expect(e.scrollview.horizontal).to.equal(true);
            expect(e.scrollview.vertical).to.equal(false);
            expect(e.scrollview.scrollMode).to.equal(SCROLL_MODE_INFINITE);
            expect(e.scrollview.bounceAmount).to.be.closeTo(0.25, 1e-6);
            expect(e.scrollview.friction).to.be.closeTo(0.1, 1e-6);
            expect(e.scrollview.dragThreshold).to.equal(20);
            expect(e.scrollview.useMouseWheel).to.equal(false);
            expect(e.scrollview.mouseWheelSensitivity.x).to.equal(2);
            expect(e.scrollview.mouseWheelSensitivity.y).to.equal(3);
            expect(e.scrollview.horizontalScrollbarVisibility).to.equal(SCROLLBAR_VISIBILITY_SHOW_ALWAYS);
            expect(e.scrollview.verticalScrollbarVisibility).to.equal(SCROLLBAR_VISIBILITY_SHOW_ALWAYS);
            expect(e.scrollview.viewportEntity).to.equal(viewport);
            expect(e.scrollview.contentEntity).to.equal(content);
            expect(e.scrollview.horizontalScrollbarEntity).to.equal(hScrollbar);
            expect(e.scrollview.verticalScrollbarEntity).to.equal(vScrollbar);
        });

    });

    describe('#mouseWheelSensitivity', function () {

        it('accepts an [x, y] array and stores a Vec2', function () {
            const e = new Entity();
            e.addComponent('scrollview', { mouseWheelSensitivity: [2, 3] });

            expect(e.scrollview.mouseWheelSensitivity).to.be.an.instanceof(Vec2);
            expect(e.scrollview.mouseWheelSensitivity.x).to.equal(2);
            expect(e.scrollview.mouseWheelSensitivity.y).to.equal(3);
        });

        it('clones a Vec2 input so caller mutations do not leak into component state', function () {
            const sensitivity = new Vec2(2, 3);
            const e = new Entity();
            e.addComponent('scrollview', { mouseWheelSensitivity: sensitivity });

            // mutate the caller's Vec2; the component's stored Vec2 must be unaffected
            sensitivity.x = 99;
            sensitivity.y = 99;

            expect(e.scrollview.mouseWheelSensitivity).to.not.equal(sensitivity);
            expect(e.scrollview.mouseWheelSensitivity.x).to.equal(2);
            expect(e.scrollview.mouseWheelSensitivity.y).to.equal(3);
        });

        it('accepts a typed array (any indexable value) the same as a plain array', function () {
            // The old schema-driven `type: 'vec2'` conversion in ComponentSystem.convertValue
            // accepted any indexable input - including typed arrays. The setter must preserve
            // that contract; otherwise scenes/templates that ship a Float32Array would store
            // the raw buffer and later code that reads `.x`/`.y` would NaN out.
            const e = new Entity();
            e.addComponent('scrollview', { mouseWheelSensitivity: new Float32Array([2, 3]) });

            expect(e.scrollview.mouseWheelSensitivity).to.be.an.instanceof(Vec2);
            expect(e.scrollview.mouseWheelSensitivity.x).to.equal(2);
            expect(e.scrollview.mouseWheelSensitivity.y).to.equal(3);
        });

    });

    describe('#horizontal', function () {

        it('syncs the horizontal scrollbar entity enabled state when toggled', function () {
            const { e, hScrollbar } = buildScrollViewEntity();
            e.addComponent('scrollview', {
                horizontal: true,
                vertical: true,
                scrollMode: SCROLL_MODE_CLAMP,
                horizontalScrollbarVisibility: SCROLLBAR_VISIBILITY_SHOW_ALWAYS,
                horizontalScrollbarEntity: hScrollbar
            });
            app.root.addChild(e);

            expect(hScrollbar.enabled).to.equal(true);

            e.scrollview.horizontal = false;
            expect(hScrollbar.enabled).to.equal(false);

            e.scrollview.horizontal = true;
            expect(hScrollbar.enabled).to.equal(true);
        });

        it('is a no-op when the value does not change', function () {
            const { e, hScrollbar } = buildScrollViewEntity();
            e.addComponent('scrollview', {
                horizontal: true,
                horizontalScrollbarVisibility: SCROLLBAR_VISIBILITY_SHOW_ALWAYS,
                horizontalScrollbarEntity: hScrollbar
            });

            // manually flip the scrollbar's enabled state and verify a same-value write
            // does not stomp it (proves the early-return path runs)
            hScrollbar.enabled = false;
            e.scrollview.horizontal = true;
            expect(hScrollbar.enabled).to.equal(false);
        });

    });

    describe('#vertical', function () {

        it('syncs the vertical scrollbar entity enabled state when toggled', function () {
            const { e, vScrollbar } = buildScrollViewEntity();
            e.addComponent('scrollview', {
                horizontal: true,
                vertical: true,
                scrollMode: SCROLL_MODE_CLAMP,
                verticalScrollbarVisibility: SCROLLBAR_VISIBILITY_SHOW_ALWAYS,
                verticalScrollbarEntity: vScrollbar
            });
            app.root.addChild(e);

            expect(vScrollbar.enabled).to.equal(true);

            e.scrollview.vertical = false;
            expect(vScrollbar.enabled).to.equal(false);
        });

    });

    describe('#scroll', function () {

        it('fires set:scroll when the value changes', function () {
            const { e, viewport, content } = buildScrollViewEntity();
            e.addComponent('scrollview', {
                horizontal: true,
                vertical: true,
                // INFINITE so jsdom's zero-sized viewport/content don't clamp the value to 0
                scrollMode: SCROLL_MODE_INFINITE,
                viewportEntity: viewport,
                contentEntity: content
            });
            app.root.addChild(e);

            const captured = [];
            e.scrollview.on('set:scroll', (scroll) => {
                captured.push({ x: scroll.x, y: scroll.y });
            });

            e.scrollview.scroll = new Vec2(0.5, 0.25);

            expect(captured.length).to.equal(1);
            expect(captured[0].x).to.be.closeTo(0.5, 1e-5);
            expect(captured[0].y).to.be.closeTo(0.25, 1e-5);
        });

    });

    describe('#viewportEntity', function () {

        it('accepts an Entity reference', function () {
            const viewport = new Entity();
            viewport.addComponent('element', { type: ELEMENTTYPE_GROUP });

            const e = new Entity();
            e.addComponent('scrollview');

            e.scrollview.viewportEntity = viewport;

            expect(e.scrollview.viewportEntity).to.equal(viewport);
        });

        it('accepts a GUID string and resolves via app.getEntityFromIndex', function () {
            const viewport = new Entity();
            viewport.addComponent('element', { type: ELEMENTTYPE_GROUP });
            const guid = viewport.guid;

            const e = new Entity();
            e.addComponent('scrollview');

            e.scrollview.viewportEntity = guid;

            expect(e.scrollview.viewportEntity).to.equal(viewport);
        });

        it('accepts null', function () {
            const viewport = new Entity();
            viewport.addComponent('element', { type: ELEMENTTYPE_GROUP });

            const e = new Entity();
            e.addComponent('scrollview', { viewportEntity: viewport });

            e.scrollview.viewportEntity = null;

            expect(e.scrollview.viewportEntity).to.equal(null);
        });

        it('unsubscribes from the previous viewport entity when reassigned', function () {
            const viewport1 = new Entity();
            const viewport2 = new Entity();

            const e = new Entity();
            e.addComponent('scrollview', { viewportEntity: viewport1 });

            expect(viewport1.hasEvent('element:add')).to.equal(true);
            expect(viewport2.hasEvent('element:add')).to.equal(false);

            e.scrollview.viewportEntity = viewport2;

            expect(viewport1.hasEvent('element:add')).to.equal(false);
            expect(viewport2.hasEvent('element:add')).to.equal(true);
        });

    });

    describe('#contentEntity', function () {

        it('accepts an Entity reference', function () {
            const content = new Entity();
            content.addComponent('element', { type: ELEMENTTYPE_IMAGE });

            const e = new Entity();
            e.addComponent('scrollview');

            e.scrollview.contentEntity = content;

            expect(e.scrollview.contentEntity).to.equal(content);
        });

        it('accepts a GUID string and resolves via app.getEntityFromIndex', function () {
            const content = new Entity();
            content.addComponent('element', { type: ELEMENTTYPE_IMAGE });
            const guid = content.guid;

            const e = new Entity();
            e.addComponent('scrollview');

            e.scrollview.contentEntity = guid;

            expect(e.scrollview.contentEntity).to.equal(content);
        });

        it('accepts null', function () {
            const content = new Entity();
            content.addComponent('element', { type: ELEMENTTYPE_IMAGE });

            const e = new Entity();
            e.addComponent('scrollview', { contentEntity: content });

            e.scrollview.contentEntity = null;

            expect(e.scrollview.contentEntity).to.equal(null);
        });

        it('unsubscribes from the previous content entity when reassigned', function () {
            const content1 = new Entity();
            const content2 = new Entity();

            const e = new Entity();
            e.addComponent('scrollview', { contentEntity: content1 });

            expect(content1.hasEvent('element:add')).to.equal(true);
            expect(content2.hasEvent('element:add')).to.equal(false);

            e.scrollview.contentEntity = content2;

            expect(content1.hasEvent('element:add')).to.equal(false);
            expect(content2.hasEvent('element:add')).to.equal(true);
        });

    });

    describe('#horizontalScrollbarEntity', function () {

        it('accepts an Entity reference', function () {
            const { hScrollbar } = buildScrollViewEntity();

            const e = new Entity();
            e.addComponent('scrollview');

            e.scrollview.horizontalScrollbarEntity = hScrollbar;

            expect(e.scrollview.horizontalScrollbarEntity).to.equal(hScrollbar);
        });

        it('accepts a GUID string and resolves via app.getEntityFromIndex', function () {
            const { hScrollbar } = buildScrollViewEntity();
            const guid = hScrollbar.guid;

            const e = new Entity();
            e.addComponent('scrollview');

            e.scrollview.horizontalScrollbarEntity = guid;

            expect(e.scrollview.horizontalScrollbarEntity).to.equal(hScrollbar);
        });

        it('accepts null', function () {
            const { hScrollbar } = buildScrollViewEntity();

            const e = new Entity();
            e.addComponent('scrollview', { horizontalScrollbarEntity: hScrollbar });

            e.scrollview.horizontalScrollbarEntity = null;

            expect(e.scrollview.horizontalScrollbarEntity).to.equal(null);
        });

        it('unsubscribes from the previous scrollbar entity when reassigned', function () {
            const scrollbar1 = new Entity();
            const scrollbar2 = new Entity();

            const e = new Entity();
            e.addComponent('scrollview', { horizontalScrollbarEntity: scrollbar1 });

            expect(scrollbar1.hasEvent('scrollbar:add')).to.equal(true);
            expect(scrollbar2.hasEvent('scrollbar:add')).to.equal(false);

            e.scrollview.horizontalScrollbarEntity = scrollbar2;

            expect(scrollbar1.hasEvent('scrollbar:add')).to.equal(false);
            expect(scrollbar2.hasEvent('scrollbar:add')).to.equal(true);
        });

    });

    describe('#verticalScrollbarEntity', function () {

        it('accepts an Entity reference', function () {
            const { vScrollbar } = buildScrollViewEntity();

            const e = new Entity();
            e.addComponent('scrollview');

            e.scrollview.verticalScrollbarEntity = vScrollbar;

            expect(e.scrollview.verticalScrollbarEntity).to.equal(vScrollbar);
        });

        it('accepts null', function () {
            const { vScrollbar } = buildScrollViewEntity();

            const e = new Entity();
            e.addComponent('scrollview', { verticalScrollbarEntity: vScrollbar });

            e.scrollview.verticalScrollbarEntity = null;

            expect(e.scrollview.verticalScrollbarEntity).to.equal(null);
        });

        it('unsubscribes from the previous scrollbar entity when reassigned', function () {
            const scrollbar1 = new Entity();
            const scrollbar2 = new Entity();

            const e = new Entity();
            e.addComponent('scrollview', { verticalScrollbarEntity: scrollbar1 });

            expect(scrollbar1.hasEvent('scrollbar:add')).to.equal(true);

            e.scrollview.verticalScrollbarEntity = scrollbar2;

            expect(scrollbar1.hasEvent('scrollbar:add')).to.equal(false);
            expect(scrollbar2.hasEvent('scrollbar:add')).to.equal(true);
        });

    });

    describe('removeComponent', function () {

        it('tears down every listener it registered on referenced entities', function () {
            const { e, viewport, content, hScrollbar, vScrollbar } = buildScrollViewEntity();
            e.addComponent('scrollview', {
                viewportEntity: viewport,
                contentEntity: content,
                horizontalScrollbarEntity: hScrollbar,
                verticalScrollbarEntity: vScrollbar
            });
            app.root.addChild(e);

            // sanity: the component has wired itself into each referenced entity
            expect(viewport.hasEvent('element:add')).to.equal(true);
            expect(content.hasEvent('element:add')).to.equal(true);
            expect(hScrollbar.hasEvent('scrollbar:add')).to.equal(true);
            expect(vScrollbar.hasEvent('scrollbar:add')).to.equal(true);

            e.removeComponent('scrollview');

            // every listener registered on a referenced entity must be gone, otherwise
            // the entities would keep callbacks pointing at a removed component
            expect(viewport.hasEvent('element:add')).to.equal(false);
            expect(content.hasEvent('element:add')).to.equal(false);
            expect(hScrollbar.hasEvent('scrollbar:add')).to.equal(false);
            expect(vScrollbar.hasEvent('scrollbar:add')).to.equal(false);
        });

    });

    describe('#cloneComponent', function () {

        it('clones every scalar property', function () {
            const e = new Entity();
            e.addComponent('scrollview', {
                enabled: false,
                horizontal: true,
                vertical: false,
                scrollMode: SCROLL_MODE_INFINITE,
                bounceAmount: 0.25,
                friction: 0.1,
                dragThreshold: 20,
                useMouseWheel: false,
                mouseWheelSensitivity: new Vec2(2, 3),
                horizontalScrollbarVisibility: SCROLLBAR_VISIBILITY_SHOW_ALWAYS,
                verticalScrollbarVisibility: SCROLLBAR_VISIBILITY_SHOW_ALWAYS
            });

            const clone = e.clone();
            const c = clone.scrollview;

            expect(c).to.exist;
            expect(c.enabled).to.equal(false);
            expect(c.horizontal).to.equal(true);
            expect(c.vertical).to.equal(false);
            expect(c.scrollMode).to.equal(SCROLL_MODE_INFINITE);
            expect(c.bounceAmount).to.be.closeTo(0.25, 1e-6);
            expect(c.friction).to.be.closeTo(0.1, 1e-6);
            expect(c.dragThreshold).to.equal(20);
            expect(c.useMouseWheel).to.equal(false);
            expect(c.mouseWheelSensitivity.x).to.equal(2);
            expect(c.mouseWheelSensitivity.y).to.equal(3);
        });

        it('remaps every entity ref to the cloned subtree via the duplicated ids map', function () {
            const { e, viewport, content, hScrollbar, vScrollbar } = buildScrollViewEntity();
            e.addComponent('scrollview', {
                viewportEntity: viewport,
                contentEntity: content,
                horizontalScrollbarEntity: hScrollbar,
                verticalScrollbarEntity: vScrollbar
            });

            const clone = e.clone();

            const cloneViewport = clone.findByName('viewport');
            const cloneContent = clone.findByName('content');
            const cloneHScrollbar = clone.findByName('hScrollbar');
            const cloneVScrollbar = clone.findByName('vScrollbar');

            expect(cloneViewport).to.exist;
            expect(cloneViewport).to.not.equal(viewport);
            expect(cloneContent).to.not.equal(content);
            expect(cloneHScrollbar).to.not.equal(hScrollbar);
            expect(cloneVScrollbar).to.not.equal(vScrollbar);

            expect(clone.scrollview.viewportEntity).to.equal(cloneViewport);
            expect(clone.scrollview.contentEntity).to.equal(cloneContent);
            expect(clone.scrollview.horizontalScrollbarEntity).to.equal(cloneHScrollbar);
            expect(clone.scrollview.verticalScrollbarEntity).to.equal(cloneVScrollbar);
        });

    });

    describe('resolveDuplicatedEntityReferenceProperties', function () {

        it('remaps every entity ref through duplicatedIdsMap', function () {
            const viewport = new Entity();
            const content = new Entity();
            const hScrollbar = new Entity();
            const vScrollbar = new Entity();

            const newViewport = new Entity();
            const newContent = new Entity();
            const newHScrollbar = new Entity();
            const newVScrollbar = new Entity();

            const source = new Entity();
            source.addComponent('scrollview', {
                viewportEntity: viewport,
                contentEntity: content,
                horizontalScrollbarEntity: hScrollbar,
                verticalScrollbarEntity: vScrollbar
            });

            const target = new Entity();
            target.addComponent('scrollview');

            const map = {
                [viewport.guid]: newViewport,
                [content.guid]: newContent,
                [hScrollbar.guid]: newHScrollbar,
                [vScrollbar.guid]: newVScrollbar
            };

            target.scrollview.resolveDuplicatedEntityReferenceProperties(source.scrollview, map);

            expect(target.scrollview.viewportEntity).to.equal(newViewport);
            expect(target.scrollview.contentEntity).to.equal(newContent);
            expect(target.scrollview.horizontalScrollbarEntity).to.equal(newHScrollbar);
            expect(target.scrollview.verticalScrollbarEntity).to.equal(newVScrollbar);
        });

    });

});
