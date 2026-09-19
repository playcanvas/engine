import { expect } from 'chai';

import { EventHandler } from '../../../src/core/event-handler.js';
import { Color } from '../../../src/core/math/color.js';
import { Vec3 } from '../../../src/core/math/vec3.js';
import { collectProperties, describeValue, formatNumber } from '../../../src/extras/inspector/describe.js';
import { captureFrameGraph } from '../../../src/extras/inspector/frame-graph-view.js';
import { Inspector } from '../../../src/extras/inspector/inspector.js';
import { buildNodeModel } from '../../../src/extras/inspector/node-model.js';
import { PropertyView } from '../../../src/extras/inspector/property-view.js';
import { formatChannels, previewAttachments, previewSupport } from '../../../src/extras/inspector/render-target-view.js';
import { buildTextureModel, collectTextures, formatBytes, textureRows } from '../../../src/extras/inspector/texture-view.js';
import { Entity } from '../../../src/framework/entity.js';
import {
    FILTER_LINEAR, FILTER_NEAREST, FUNC_LESS, PIXELFORMAT_111110F, PIXELFORMAT_BGRA8, PIXELFORMAT_DEPTH, PIXELFORMAT_DXT1,
    PIXELFORMAT_R32U, PIXELFORMAT_R8, PIXELFORMAT_RG16F, PIXELFORMAT_RGB10A2, PIXELFORMAT_RGBA32F, PIXELFORMAT_RGBA8,
    PIXELFORMAT_SRGB8
} from '../../../src/platform/graphics/constants.js';
import { NullGraphicsDevice } from '../../../src/platform/graphics/null/null-graphics-device.js';
import { RenderTarget } from '../../../src/platform/graphics/render-target.js';
import { Texture } from '../../../src/platform/graphics/texture.js';
import { GraphNode } from '../../../src/scene/graph-node.js';
import { StandardMaterial } from '../../../src/scene/materials/standard-material.js';
import { MeshInstance } from '../../../src/scene/mesh-instance.js';
import { Mesh } from '../../../src/scene/mesh.js';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

/**
 * @returns {any} An app stub with just what the inspector touches.
 */
function createApp() {
    const app = /** @type {any} */ (new EventHandler());
    const canvas = document.createElement('canvas');
    app.graphicsDevice = new NullGraphicsDevice(canvas);
    // the texture renderer the panel owns listens for layer render events on the scene
    app.scene = Object.assign(new EventHandler(), { immediate: {}, defaultDrawLayer: null });
    app.systems = {};
    app.stats = { frame: {} };
    app.timeScale = 1;
    app.root = new GraphNode('root');
    // entities register themselves by guid
    app._entityIndex = {};
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

    it('reports visibility changes through the callback', function () {
        const states = [];
        const inspector = new Inspector(app, { onVisibleChange: state => states.push(state) });

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
        /** @type {any} */ (inspector)._selectAny(leaf);
        const leafRow = [...panel(inspector).querySelectorAll('.pci-row')].find(row => row.querySelector('.pci-name').textContent === 'leaf');
        expect(leafRow).to.exist;
        expect(leafRow.classList.contains('pci-selected')).to.be.true;
        expect(leafRow.querySelector('.pci-toggle').style.visibility).to.equal('');
        expect(/** @type {any} */ (inspector)._selected).to.equal(leaf);

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
        const inspector = /** @type {any} */ (new Inspector(app));
        inspector._physicsDraw = true;
        const physics = inspector._physics;
        expect(inspector._physicsDraw).to.be.true;

        app.fire('update', 0.016);
        expect(physics.enabled).to.be.true;

        inspector.visible = false;
        app.fire('update', 0.016);
        expect(physics.enabled).to.be.false;
        expect(inspector._physicsDraw).to.be.true;

        inspector.visible = true;
        app.fire('update', 0.016);
        expect(physics.enabled).to.be.true;

        inspector.destroy();
    });

    it('mirrors the physics draw checkboxes as boolean options', function () {
        const inspector = /** @type {any} */ (new Inspector(app));
        inspector._physicsDrawOptions = { constraints: true, depthTest: true, range: 12 };
        const physics = inspector._physics;

        expect(inspector._physicsDrawOptions).to.deep.equal({
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
        inspector._physicsDrawOptions = { wireframe: false, aabb: true };
        expect(inspector._physicsDrawOptions.wireframe).to.be.false;
        expect(inspector._physicsDrawOptions.aabb).to.be.true;
        expect(inspector._physicsDrawOptions.constraints).to.be.true;
        expect(physics.mode).to.equal(2 | 2048);

        // the checkboxes drive the same state
        const label = [...panel(inspector).querySelectorAll('.pci-check')].find(l => l.textContent === 'Contacts');
        const toggle = /** @type {HTMLInputElement} */ (label.querySelector('input'));
        toggle.checked = true;
        toggle.dispatchEvent(new window.Event('change'));
        expect(inspector._physicsDrawOptions.contacts).to.be.true;
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

        const inspector = /** @type {any} */ (new Inspector(app));
        inspector._physicsDraw = true;
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
        inspector._physicsDraw = false;
        const rowOff = [...panel(inspector).querySelectorAll('.pci-lrow')].find(r => r.textContent.includes('crate'));
        expect(/** @type {HTMLInputElement} */ (rowOff.querySelector('.pci-cell-toggle')).disabled).to.be.true;

        inspector.destroy();
    });

    it('keeps its settings in storage and restores them for the next instance', function () {
        const stored = {};
        Object.defineProperty(window, 'localStorage', {
            configurable: true,
            value: {
                getItem: key => stored[key] ?? null,
                setItem: (key, value) => {
                    stored[key] = value;
                }
            }
        });

        const first = /** @type {any} */ (new Inspector(app, { storageKey: 'test-inspector' }));
        first._physicsDraw = true;
        first._physicsDrawOptions = { contacts: true, range: 5 };
        first._setWidth(600);
        [...panel(first).querySelectorAll('.pci-tab')].find(tab => tab.textContent === 'Frame graph').click();
        first.destroy();

        expect(stored['test-inspector']).to.be.a('string');
        const saved = JSON.parse(stored['test-inspector']);
        expect(saved.tab).to.equal('passes');

        // what the user left behind comes back
        const second = /** @type {any} */ (new Inspector(app, { storageKey: 'test-inspector' }));
        expect(second._physicsDraw).to.be.true;
        expect(second._physicsDrawOptions.contacts).to.be.true;
        expect(second._physicsDrawOptions.range).to.equal(5);
        expect(panel(second).querySelector('.pci-panel').style.width).to.equal('600px');
        expect(panel(second).querySelector('.pci-tab.pci-active').textContent).to.equal('Frame graph');
        second.destroy();

        // nothing is kept without a key
        delete stored['test-inspector'];
        const third = /** @type {any} */ (new Inspector(app, { storageKey: null }));
        third._physicsDraw = true;
        third.destroy();
        expect(Object.keys(stored)).to.deep.equal([]);
    });

    it('adds collapsed sections for mesh instances and their shared material, with texture links', function () {
        const device = app.graphicsDevice;
        const texture = new Texture(device, { name: 'albedo', width: 4, height: 4, format: PIXELFORMAT_RGBA8 });
        const material = new StandardMaterial();
        material.name = 'painted';
        material.diffuseMap = texture;
        const mesh = new Mesh(device);
        const entity = new Entity('robot', app);
        entity.c.render = /** @type {any} */ ({
            enabled: true,
            meshInstances: [new MeshInstance(mesh, material, entity), new MeshInstance(mesh, material, entity)]
        });

        const sections = buildNodeModel(entity);
        const keys = sections.map(section => section.key);
        expect(keys).to.include.members(['c:render', 'mi:render:0', 'mi:render:1', 'mat:render:0']);
        // a material shared by both instances is listed once
        expect(keys.filter(key => key.startsWith('mat:'))).to.have.lengthOf(1);

        const instance = sections.find(section => section.key === 'mi:render:0');
        expect(instance.collapsed).to.be.true;
        expect(instance.title).to.equal('render › mesh instance 0');
        expect(instance.rows.slice(0, 4).map(row => row.label)).to.deep.equal(['node', 'mesh', 'material', 'visible']);
        expect(instance.rows.map(row => row.label)).to.include('castShadow');

        const painted = sections.find(section => section.key === 'mat:render:0');
        expect(painted.collapsed).to.be.true;
        expect(painted.title).to.equal('render › StandardMaterial "painted"');
        expect(painted.rows[0].label).to.equal('used by');
        expect(painted.rows[0].value.text).to.equal('["mesh instance 0", "mesh instance 1"]');
        const labels = painted.rows.map(row => row.label);
        expect(labels).to.include.members(['diffuse', 'diffuseMap', 'blendType']);
        // getters that only warn about their removal or deprecation are left out
        expect(labels).to.not.include.members(['chunks', 'shader', 'dirty', 'anisotropy', 'diffuseTint', 'sheenGlossiness']);
        expect(painted.rows.find(row => row.label === 'diffuseMap').value.target).to.equal(texture);

        texture.destroy();
    });

    it('lists the device textures largest first and selects a linked texture on the textures tab', function () {
        const inspector = /** @type {any} */ (new Inspector(app));
        const device = app.graphicsDevice;
        const small = new Texture(device, { name: 'small', width: 4, height: 4, format: PIXELFORMAT_RGBA8, mipmaps: false });
        const large = new Texture(device, { name: 'large', width: 64, height: 64, format: PIXELFORMAT_RGBA8, mipmaps: false });
        // the WebGL and WebGPU devices register their textures; the null device does not
        device.textures.add(small).add(large);

        // a texture value in any property panel links to the textures tab
        inspector._selectAny(small);
        expect(inspector._tab).to.equal('textures');
        expect(inspector._textureList.selected).to.equal(small);
        expect(inspector._properties.subject).to.equal(small);
        const names = [...panel(inspector).querySelectorAll('.pci-lrow .pci-cell-name')].map(cell => cell.textContent);
        expect(names.indexOf('large')).to.be.below(names.indexOf('small'));

        // the preview is drawn from the update, and explained when it cannot be
        app.fire('update', 0.016);
        expect(inspector._textureNote.textContent).to.match(/no camera renders to the screen/);
        inspector._texturePreviewToggle.checked = false;
        app.fire('update', 0.016);
        expect(inspector._textureNote.style.display).to.equal('none');

        const sections = [...panel(inspector).querySelectorAll('.pci-section-title')].map(title => title.textContent);
        expect(sections).to.include.members(['Texture', 'Properties']);
        small.destroy();
        large.destroy();
        inspector.destroy();
    });

    it('explains a missing physics system on the physics tab', function () {
        const inspector = new Inspector(app);
        const tabs = [...panel(inspector).querySelectorAll('.pci-tab')];
        tabs.find(tab => tab.textContent === 'Physics').click();
        const note = /** @type {any} */ (inspector)._panels.physics.querySelector('.pci-note');
        expect(note.textContent).to.match(/No rigid body component system/);
        inspector.destroy();
    });
});

describe('Inspector property view', function () {
    beforeEach(jsdomSetup);
    afterEach(jsdomTeardown);

    it('starts sections collapsed when the model says so', function () {
        const container = document.createElement('div');
        const view = new PropertyView(container, () => {});
        const target = {};
        const model = () => [
            { key: 'open', title: 'Open', rows: [{ key: 'a', label: 'a', value: { text: 'x', target } }] },
            { key: 'closed', title: 'Closed', rows: [{ key: 'b', label: 'b', value: { text: 'y' } }], collapsed: true }
        ];
        view.setSubject({}, model);
        const sections = [...container.querySelectorAll('.pci-section')];
        expect(sections[0].classList.contains('pci-collapsed')).to.be.false;
        expect(sections[1].classList.contains('pci-collapsed')).to.be.true;
        expect(container.querySelector('.pci-prop .pci-value').classList.contains('pci-link')).to.be.true;

        // the title still toggles a section that started collapsed
        sections[1].querySelector('.pci-section-title').click();
        expect(sections[1].classList.contains('pci-collapsed')).to.be.false;
        expect(sections[1].querySelector('.pci-value').textContent).to.equal('y');
    });
});

describe('Inspector render target preview', function () {
    const texture = (props = {}) => ({
        cubemap: false,
        volume: false,
        arrayLength: 0,
        samples: 1,
        format: PIXELFORMAT_RGBA8,
        compareOnRead: false,
        minFilter: FILTER_LINEAR,
        magFilter: FILTER_LINEAR,
        mipmaps: false,
        width: 256,
        height: 128,
        ...props
    });
    const webgl2 = { isWebGL2: true, textureFloatFilterable: false };
    const webgpu = { isWebGL2: false, textureFloatFilterable: true };

    it('lists the color attachments, the resolve texture first, and the depth texture', function () {
        const color0 = texture();
        const color1 = texture();
        const resolve = texture();
        const depth = texture({ format: PIXELFORMAT_DEPTH });
        const device = /** @type {any} */ ({ backBuffer: {} });
        const rt = /** @type {any} */ ({ colorBufferCount: 2, resolveBuffer: resolve, getColorBuffer: i => [color0, color1][i], depthBuffer: depth });

        expect(previewAttachments(rt, device).map(a => [a.key, a.label, a.texture])).to.deep.equal([
            ['color0', 'color 0', resolve], ['color1', 'color 1', color1], ['depth', 'depth', depth]
        ]);
        expect(previewAttachments(device.backBuffer, device)).to.deep.equal([]);
    });

    it('explains what the texture renderer cannot show', function () {
        expect(previewSupport(texture(), webgl2).ok).to.be.true;
        expect(previewSupport(texture({ cubemap: true }), webgpu).reason).to.match(/cube/);
        expect(previewSupport(texture({ samples: 4 }), webgpu).reason).to.match(/multisampled/);
        expect(previewSupport(texture({ format: PIXELFORMAT_R32U }), webgpu).reason).to.match(/integer/);

        const shadowMap = texture({ format: PIXELFORMAT_DEPTH, compareOnRead: true, minFilter: FILTER_NEAREST, magFilter: FILTER_NEAREST });
        expect(previewSupport(shadowMap, webgl2).reason).to.match(/comparison/);
        expect(previewSupport(shadowMap, webgpu).ok).to.be.true;

        const rawDepth = texture({ format: PIXELFORMAT_DEPTH });
        expect(previewSupport(rawDepth, webgl2).reason).to.match(/nearest filtering/);
        expect(previewSupport({ ...rawDepth, minFilter: FILTER_NEAREST, magFilter: FILTER_NEAREST }, webgl2).ok).to.be.true;

        const float = texture({ format: PIXELFORMAT_RGBA32F });
        expect(previewSupport(float, webgl2).reason).to.match(/float/);
        expect(previewSupport(float, webgpu).ok).to.be.true;
    });

    it('reads the channels a format stores from its name', function () {
        expect(formatChannels(PIXELFORMAT_R8)).to.equal('r');
        expect(formatChannels(PIXELFORMAT_RG16F)).to.equal('rg');
        expect(formatChannels(PIXELFORMAT_SRGB8)).to.equal('rgb');
        expect(formatChannels(PIXELFORMAT_RGBA8)).to.equal('rgba');
        expect(formatChannels(PIXELFORMAT_BGRA8)).to.equal('rgba');
        expect(formatChannels(PIXELFORMAT_RGB10A2)).to.equal('rgba');

        // nothing to say about depth, packed or compressed formats
        expect(formatChannels(PIXELFORMAT_DEPTH)).to.equal('');
        expect(formatChannels(PIXELFORMAT_111110F)).to.equal('');
        expect(formatChannels(PIXELFORMAT_DXT1)).to.equal('');
        expect(formatChannels(-1)).to.equal('');
    });
});

describe('Inspector texture view', function () {
    let device;

    beforeEach(function () {
        jsdomSetup();
        device = new NullGraphicsDevice(document.createElement('canvas'));
    });

    afterEach(function () {
        device.destroy();
        jsdomTeardown();
    });

    it('lists textures by GPU size, tags render target attachments and links them from the model', function () {
        const small = new Texture(device, { name: 'small', width: 4, height: 4, format: PIXELFORMAT_RGBA8, mipmaps: false });
        const large = new Texture(device, { name: 'large', width: 64, height: 64, format: PIXELFORMAT_RGBA8, mipmaps: false });
        const depth = new Texture(device, { name: 'shadow', width: 32, height: 32, format: PIXELFORMAT_DEPTH, mipmaps: false });
        const rt = new RenderTarget({ name: 'shadow map', depthBuffer: depth });
        device.textures.add(small).add(large).add(depth);
        device.targets.add(rt);

        expect(collectTextures(device)).to.deep.equal([large, depth, small]);

        const rows = textureRows(device);
        expect(rows.map(row => row.name)).to.deep.equal(['large', 'shadow', 'small']);
        expect(rows[0].cells.map(cell => cell.text)).to.deep.equal(['large', '64×64 RGBA8', '16.0 KB']);
        expect(rows[1].cells.map(cell => cell.text)).to.deep.equal(['shadow', 'target', '32×32 DEPTH', '4.0 KB']);
        expect(rows[0].key).to.not.equal(rows[2].key);
        expect(textureRows(device)[0].key).to.equal(rows[0].key);

        const [general, sampling, props] = buildTextureModel(depth, { device });
        expect(general.rows.map(row => row.label)).to.include.members(['name', 'size', 'format', 'gpu size', 'mipmaps', 'attached to']);
        const attached = general.rows.find(row => row.label === 'attached to');
        expect(attached.value.text).to.equal('1 render target');
        expect(attached.value.items[0].target).to.equal(rt);

        // sampler state reads as constant names
        const byLabel = label => sampling.rows.find(row => row.label === label).value.text;
        expect(byLabel('min filter')).to.equal('FILTER_LINEAR_MIPMAP_LINEAR');
        expect(byLabel('mag filter')).to.equal('FILTER_LINEAR');
        expect(byLabel('address u')).to.equal('ADDRESS_REPEAT');
        expect(sampling.rows.map(row => row.label)).to.not.include('compare func');
        depth.compareOnRead = true;
        depth.compareFunc = FUNC_LESS;
        expect(buildTextureModel(depth, { device })[1].rows.find(row => row.label === 'compare func').value.text).to.equal('FUNC_LESS');

        const labels = props.rows.map(row => row.label);
        expect(labels).to.include.members(['flipY', 'premultiplyAlpha']);
        expect(labels).to.not.include.members(['minFilter', 'addressU', 'rgbm', 'swizzleGGGR', 'width']);

        rt.destroy();
    });

    it('formats byte counts in the largest fitting unit', function () {
        expect(formatBytes(512)).to.equal('512 B');
        expect(formatBytes(1536)).to.equal('1.5 KB');
        expect(formatBytes(3 * 1024 * 1024)).to.equal('3.00 MB');
        expect(formatBytes(2.5 * 1024 * 1024 * 1024)).to.equal('2.50 GB');
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
