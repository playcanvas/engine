import { expect } from 'chai';

import { EventHandler } from '../../../src/core/event-handler.js';
import { Color } from '../../../src/core/math/color.js';
import { Vec3 } from '../../../src/core/math/vec3.js';
import { collectProperties, describeValue, formatNumber } from '../../../src/extras/inspector/describe.js';
import { captureFrameGraph } from '../../../src/extras/inspector/frame-graph-view.js';
import { Inspector } from '../../../src/extras/inspector/inspector.js';
import { NullGraphicsDevice } from '../../../src/platform/graphics/null/null-graphics-device.js';
import { GraphNode } from '../../../src/scene/graph-node.js';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

/**
 * @returns {any} An app stub with just what the inspector touches.
 */
function createApp() {
    const app = /** @type {any} */ (new EventHandler());
    const canvas = document.createElement('canvas');
    app.graphicsDevice = new NullGraphicsDevice(canvas);
    app.scene = { immediate: {}, defaultDrawLayer: null };
    app.systems = {};
    app.stats = { frame: {} };
    app.timeScale = 1;
    app.root = new GraphNode('root');
    return app;
}

/**
 * @param {Inspector} inspector - The inspector.
 * @returns {ShadowRoot} Its panel's shadow root.
 */
function panel(inspector) {
    return /** @type {any} */ (inspector)._host.shadowRoot;
}

describe('Inspector', function () {
    let app;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
    });

    afterEach(function () {
        jsdomTeardown();
    });

    it('appends its panel to the document and removes it on destroy', function () {
        const inspector = new Inspector(app);
        const host = document.querySelector('.pc-inspector');
        expect(host).to.exist;
        expect(host.shadowRoot.querySelector('.pci-panel')).to.exist;
        expect(app.hasEvent('update')).to.be.true;

        inspector.destroy();
        expect(document.querySelector('.pc-inspector')).to.not.exist;
        expect(app.hasEvent('update')).to.be.false;
    });

    it('is destroyed with the app', function () {
        const inspector = new Inspector(app);
        expect(inspector.visible).to.be.true;
        app.fire('destroy');
        expect(document.querySelector('.pc-inspector')).to.not.exist;
    });

    it('shows and hides through visible and the toggle key', function () {
        const inspector = new Inspector(app, { visible: false });
        const host = /** @type {HTMLElement} */ (document.querySelector('.pc-inspector'));
        expect(host.style.display).to.equal('none');

        inspector.visible = true;
        expect(host.style.display).to.equal('');

        window.dispatchEvent(new window.KeyboardEvent('keydown', { code: 'Backquote' }));
        expect(inspector.visible).to.be.false;
        expect(host.style.display).to.equal('none');

        inspector.destroy();
    });

    it('reports visibility changes as an event', function () {
        const inspector = new Inspector(app);
        const states = [];
        inspector.on('visible', state => states.push(state));

        inspector.visible = false;
        inspector.visible = false;
        inspector.visible = true;
        panel(inspector).querySelector('.pci-toolbar .pci-btn:last-child').click();

        expect(states).to.deep.equal([false, true, false]);
        inspector.destroy();
    });

    it('applies dock, width and top to the panel', function () {
        const inspector = new Inspector(app, { dock: 'left', width: 500, top: 40 });
        const panelEl = panel(inspector).querySelector('.pci-panel');
        expect(panelEl.classList.contains('pci-dock-left')).to.be.true;
        expect(panelEl.style.width).to.equal('500px');
        expect(panelEl.style.top).to.equal('40px');

        inspector.dock = 'right';
        expect(panelEl.classList.contains('pci-dock-left')).to.be.false;

        inspector.destroy();
    });

    it('lists the hierarchy and withholds the checkbox of the locked node and its ancestors', function () {
        const group = new GraphNode('group');
        const leaf = new GraphNode('leaf');
        app.root.addChild(group);
        group.addChild(leaf);

        const inspector = new Inspector(app, { lockedNode: group });
        const rows = [...panel(inspector).querySelectorAll('.pci-row')];
        const byName = Object.fromEntries(rows.map(row => [row.querySelector('.pci-name').textContent, row]));

        expect(Object.keys(byName)).to.include.members(['root', 'group']);
        expect(byName.root.querySelector('.pci-toggle').style.visibility).to.equal('hidden');
        expect(byName.group.querySelector('.pci-toggle').style.visibility).to.equal('hidden');

        // the leaf sits in a collapsed subtree until its parent is expanded
        expect(byName.leaf).to.be.undefined;
        inspector.select(leaf);
        const leafRow = [...panel(inspector).querySelectorAll('.pci-row')].find(row => row.querySelector('.pci-name').textContent === 'leaf');
        expect(leafRow).to.exist;
        expect(leafRow.classList.contains('pci-selected')).to.be.true;
        expect(leafRow.querySelector('.pci-toggle').style.visibility).to.equal('');
        expect(inspector.selected).to.equal(leaf);

        inspector.destroy();
    });

    it('flips a node\'s enabled flag from its checkbox', function () {
        const node = new GraphNode('node');
        app.root.addChild(node);

        const inspector = new Inspector(app);
        const row = [...panel(inspector).querySelectorAll('.pci-row')].find(r => r.querySelector('.pci-name').textContent === 'node');
        const toggle = /** @type {HTMLInputElement} */ (row.querySelector('.pci-toggle'));
        expect(toggle.checked).to.be.true;

        toggle.checked = false;
        toggle.dispatchEvent(new window.Event('change'));
        expect(node.enabled).to.be.false;
        expect(row.classList.contains('pci-disabled')).to.be.true;

        inspector.destroy();
    });

    it('pauses by zeroing the time scale and steps one frame', function () {
        app.timeScale = 0.5;
        const inspector = new Inspector(app);

        inspector.paused = true;
        expect(app.timeScale).to.equal(0);

        inspector.step();
        expect(app.timeScale).to.equal(0.5);
        app.fire('frameend');
        expect(app.timeScale).to.equal(0);

        inspector.paused = false;
        expect(app.timeScale).to.equal(0.5);

        inspector.destroy();
    });

    it('restores the time scale when destroyed while paused', function () {
        const inspector = new Inspector(app);
        inspector.paused = true;
        inspector.destroy();
        expect(app.timeScale).to.equal(1);
    });

    it('suspends physics drawing while the panel is hidden', function () {
        const inspector = new Inspector(app, { physicsDraw: true });
        const physics = /** @type {any} */ (inspector)._physics;
        expect(inspector.physicsDraw).to.be.true;

        app.fire('update', 0.016);
        expect(physics.enabled).to.be.true;

        inspector.visible = false;
        app.fire('update', 0.016);
        expect(physics.enabled).to.be.false;
        expect(inspector.physicsDraw).to.be.true;

        inspector.visible = true;
        app.fire('update', 0.016);
        expect(physics.enabled).to.be.true;

        inspector.destroy();
    });

    it('exposes the physics draw options as booleans mirroring the checkboxes', function () {
        const inspector = new Inspector(app, { physicsDrawOptions: { constraints: true, depthTest: true, range: 12 } });
        const physics = /** @type {any} */ (inspector)._physics;

        expect(inspector.physicsDrawOptions).to.deep.equal({
            wireframe: true,
            aabb: false,
            contacts: false,
            constraints: true,
            limits: false,
            normals: false,
            frames: false,
            keepAwake: false,
            depthTest: true,
            range: 12
        });
        expect(physics.mode).to.equal(1 | 2048);
        expect(physics.depthTest).to.be.true;
        expect(physics.range).to.equal(12);

        // a partial assignment leaves the other options alone
        inspector.physicsDrawOptions = { wireframe: false, aabb: true };
        expect(inspector.physicsDrawOptions.wireframe).to.be.false;
        expect(inspector.physicsDrawOptions.aabb).to.be.true;
        expect(inspector.physicsDrawOptions.constraints).to.be.true;
        expect(physics.mode).to.equal(2 | 2048);

        // the checkboxes drive the same state
        const label = [...panel(inspector).querySelectorAll('.pci-check')].find(l => l.textContent === 'Contacts');
        const toggle = /** @type {HTMLInputElement} */ (label.querySelector('input'));
        toggle.checked = true;
        toggle.dispatchEvent(new window.Event('change'));
        expect(inspector.physicsDrawOptions.contacts).to.be.true;
        expect(physics.mode & 8).to.equal(8);

        inspector.destroy();
    });

    it('excludes a body from the physics drawing through its checkbox', function () {
        // a rigid body system stub with one static body whose native flags we can watch
        const nativeBody = {
            flags: 1,
            getCollisionFlags() {
                return this.flags;
            },
            setCollisionFlags(flags) {
                this.flags = flags;
            }
        };
        const crate = /** @type {any} */ (new GraphNode('crate'));
        crate.guid = 'crate-guid';
        crate.rigidbody = { type: 'static', enabled: true, entity: crate, body: nativeBody, mass: 0, isActive: () => false };
        app.root.addChild(crate);
        app.systems.rigidbody = { store: { [crate.guid]: { entity: crate } } };

        const inspector = new Inspector(app, { physicsDraw: true });
        [...panel(inspector).querySelectorAll('.pci-tab')].find(tab => tab.textContent === 'Physics').click();

        const row = [...panel(inspector).querySelectorAll('.pci-lrow')].find(r => r.textContent.includes('crate'));
        const toggle = /** @type {HTMLInputElement} */ (row.querySelector('.pci-cell-toggle'));
        expect(toggle.checked).to.be.true;
        expect(toggle.disabled).to.be.false;

        toggle.checked = false;
        toggle.dispatchEvent(new window.Event('change'));
        expect(nativeBody.flags & 32).to.equal(32);
        expect(nativeBody.flags & 1).to.equal(1);

        // the engine rebuilt the body: the exclusion follows the new one on the next frame
        const rebuilt = { ...nativeBody, flags: 1 };
        crate.rigidbody.body = rebuilt;
        app.fire('update', 0.016);
        expect(rebuilt.flags & 32).to.equal(32);

        const rowAfter = [...panel(inspector).querySelectorAll('.pci-lrow')].find(r => r.textContent.includes('crate'));
        const toggleAfter = /** @type {HTMLInputElement} */ (rowAfter.querySelector('.pci-cell-toggle'));
        toggleAfter.checked = true;
        toggleAfter.dispatchEvent(new window.Event('change'));
        expect(rebuilt.flags).to.equal(1);

        // the master switch disables the per-body checkboxes
        inspector.physicsDraw = false;
        const rowOff = [...panel(inspector).querySelectorAll('.pci-lrow')].find(r => r.textContent.includes('crate'));
        expect(/** @type {HTMLInputElement} */ (rowOff.querySelector('.pci-cell-toggle')).disabled).to.be.true;

        inspector.destroy();
    });

    it('explains a missing physics system on the physics tab', function () {
        const inspector = new Inspector(app);
        const tabs = [...panel(inspector).querySelectorAll('.pci-tab')];
        tabs.find(tab => tab.textContent === 'Physics').click();
        expect(panel(inspector).querySelector('.pci-note').textContent).to.match(/No rigid body component system/);
        inspector.destroy();
    });
});

describe('Inspector frame graph capture', function () {
    /**
     * @param {string} name - The pass name.
     * @param {object} [props] - Extra fields.
     * @returns {any} A pass stub.
     */
    const pass = (name, props = {}) => ({ name, beforePasses: [], afterPasses: [], executeEnabled: true, ...props });

    it('flattens passes in execution order with wrapper depth and target usage', function () {
        const backBuffer = { name: 'Backbuffer' };
        const shadowMap = { name: 'ShadowMap' };
        const shadow = pass('RenderPassShadow', { renderTarget: shadowMap });
        const wrapper = pass('FramePassUpdateClustered', { beforePasses: [shadow] });
        const forward = pass('RenderPassForward', { renderTarget: null });

        const app = /** @type {any} */ ({
            graphicsDevice: { backBuffer, gpuProfiler: null },
            frameGraph: { renderPasses: [shadow, wrapper, forward] }
        });
        const frame = captureFrameGraph(app);

        expect(frame.entries.map(e => e.pass.name)).to.deep.equal(['RenderPassShadow', 'FramePassUpdateClustered', 'RenderPassForward']);
        expect(frame.entries.map(e => e.index)).to.deep.equal([0, 1, 2]);
        expect(frame.entries[0].parent).to.equal(wrapper);
        expect(frame.entries[0].depth).to.equal(1);
        expect(frame.entries[1].children).to.equal(1);
        expect(frame.entries[1].renderTarget).to.be.undefined;
        expect(frame.entries[2].renderTarget).to.equal(backBuffer);
        expect(frame.usage.get(shadowMap).map(e => e.pass)).to.deep.equal([shadow]);
        expect(frame.usage.get(backBuffer).map(e => e.pass)).to.deep.equal([forward]);
        expect(frame.nameCounts.get('Shadow')).to.equal(1);
        expect(frame.timings).to.be.null;
    });
});

describe('Inspector value formatting', function () {
    it('formats numbers compactly', function () {
        expect(formatNumber(3)).to.equal('3');
        expect(formatNumber(1.23456)).to.equal('1.2346');
        expect(formatNumber(1.5e-15)).to.equal('0');
        expect(formatNumber(12345678.9)).to.equal('1.235e+7');
    });

    it('describes engine values', function () {
        expect(describeValue(new Vec3(1, 2.5, 0)).text).to.equal('(1, 2.5, 0)');
        expect(describeValue(new Color(1, 0, 0, 1)).swatch).to.equal('rgba(255, 0, 0, 1)');
        const node = new GraphNode('thing');
        const described = describeValue(node);
        expect(described.text).to.equal('GraphNode "thing"');
        expect(described.target).to.equal(node);
        expect(describeValue([1, 2, 3]).text).to.equal('[1, 2, 3]');
        expect(describeValue([node, node]).items).to.have.length(2);
        expect(describeValue(null).cls).to.equal('null');
    });

    it('collects public getters and own fields, skipping privates and methods', function () {
        class Base {
            get inherited() {
                return 1;
            }
        }
        class Thing extends Base {
            field = 1;

            _private = 2;

            get accessor() {
                return 3;
            }

            method() {}
        }
        expect(collectProperties(new Thing(), [])).to.deep.equal(['accessor', 'inherited', 'field']);
        expect(collectProperties(new Thing(), [Base.prototype], ['field'])).to.deep.equal(['accessor']);
    });
});
