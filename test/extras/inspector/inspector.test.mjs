import { expect } from 'chai';

import { EventHandler } from '../../../src/core/event-handler.js';
import { Color } from '../../../src/core/math/color.js';
import { Vec3 } from '../../../src/core/math/vec3.js';
import { assetRows, assetUsers, buildAssetModel, collectAssets, describeAssetValue, resourceAssets } from '../../../src/extras/inspector/asset-view.js';
import { collectProperties, describeValue, formatNumber } from '../../../src/extras/inspector/describe.js';
import { LayerStepSelection, buildPassModel, buildStepModel, captureFrameGraph, passRows } from '../../../src/extras/inspector/frame-graph-view.js';
import { Inspector } from '../../../src/extras/inspector/inspector.js';
import { ListView } from '../../../src/extras/inspector/list-view.js';
import {
    buildMaterialModel, materialListRows, materialsUsingShader, materialsUsingTexture, surveyMaterials, usedByMaterialsSection
} from '../../../src/extras/inspector/material-view.js';
import { bufferOwners, bufferRows, buildBufferModel, collectBuffers, memorySummary } from '../../../src/extras/inspector/memory-view.js';
import { buildMeshModel, meshListRows, meshNote, surveyMeshes } from '../../../src/extras/inspector/mesh-view.js';
import { formatBytes } from '../../../src/extras/inspector/model.js';
import { buildNodeModel, materialRows as buildMaterialRows, meshInstanceRows, meshRows as buildMeshRows } from '../../../src/extras/inspector/node-model.js';
import { PropertyView } from '../../../src/extras/inspector/property-view.js';
import { formatChannels, previewAttachments, previewSupport, storedBottomUp } from '../../../src/extras/inspector/render-target-view.js';
import { buildShaderModel, formatBindGroup, formatUniformBuffer, shaderRows } from '../../../src/extras/inspector/shader-view.js';
import { buildTextureModel, collectTextures, textureRows } from '../../../src/extras/inspector/texture-view.js';
import { installTooltip, setTip } from '../../../src/extras/inspector/tooltip.js';
import { AssetRegistry } from '../../../src/framework/asset/asset-registry.js';
import { Asset } from '../../../src/framework/asset/asset.js';
import { Entity } from '../../../src/framework/entity.js';
import { BindGroupFormat, BindStorageBufferFormat, BindTextureFormat, BindUniformBufferFormat } from '../../../src/platform/graphics/bind-group-format.js';
import {
    FILTER_LINEAR, FILTER_NEAREST, FUNC_LESS, PIXELFORMAT_111110F, SAMPLETYPE_DEPTH, SEMANTIC_POSITION, SHADERLANGUAGE_WGSL,
    SHADERSTAGE_COMPUTE, SHADERSTAGE_FRAGMENT, SHADERSTAGE_VERTEX, TEXTUREDIMENSION_2D, UNIFORMTYPE_FLOAT, UNIFORMTYPE_MAT4, UNIFORMTYPE_VEC3, PIXELFORMAT_BGRA8, PIXELFORMAT_DEPTH, PIXELFORMAT_DXT1,
    PIXELFORMAT_R32U, PIXELFORMAT_R8, PIXELFORMAT_RG16F, PIXELFORMAT_RGB10A2, PIXELFORMAT_RGBA32F, PIXELFORMAT_RGBA8,
    PIXELFORMAT_SRGB8
} from '../../../src/platform/graphics/constants.js';
import { NullGraphicsDevice } from '../../../src/platform/graphics/null/null-graphics-device.js';
import { RenderTarget } from '../../../src/platform/graphics/render-target.js';
import { Shader } from '../../../src/platform/graphics/shader.js';
import { StorageBuffer } from '../../../src/platform/graphics/storage-buffer.js';
import { Texture } from '../../../src/platform/graphics/texture.js';
import { UniformBufferFormat, UniformFormat } from '../../../src/platform/graphics/uniform-buffer-format.js';
import { UniformBuffer } from '../../../src/platform/graphics/uniform-buffer.js';
import { BLEND_NORMAL } from '../../../src/scene/constants.js';
import { GraphNode } from '../../../src/scene/graph-node.js';
import { StandardMaterial } from '../../../src/scene/materials/standard-material.js';
import { MeshInstance } from '../../../src/scene/mesh-instance.js';
import { Mesh } from '../../../src/scene/mesh.js';
import { RenderPassForward } from '../../../src/scene/renderer/render-pass-forward.js';
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
    app.assets = new AssetRegistry(null);
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

    it('resolves a component asset id to a linked asset and opens it on the assets tab', function () {
        const inspector = /** @type {any} */ (new Inspector(app));
        const texture = new Asset('bricks', 'texture', { url: 'bricks.png', size: 2048 });
        const material = new Asset('wall', 'material', null);
        app.assets.add(texture);
        app.assets.add(material);

        const entity = new Entity('wall', app);
        entity.c.render = /** @type {any} */ ({
            enabled: true,
            system: { app },
            asset: texture.id,
            materialAssets: [material.id, 999]
        });

        const section = buildNodeModel(entity).find(s => s.key === 'c:render');
        const row = label => section.rows.find(r => r.label === label);
        expect(row('asset').value.target).to.equal(texture);
        expect(row('asset').value.text).to.match(/^Asset #-?\d+ "bricks" \(texture\)$/);
        // arrays expand entry by entry, and an id the registry does not know says so
        expect(row('materialAssets').value.text).to.equal('Array(2) of asset');
        expect(section.rows.find(r => r.key === 'materialAssets[0]').value.target).to.equal(material);
        expect(section.rows.find(r => r.key === 'materialAssets[1]').value.text).to.match(/not in the registry/);

        inspector._selectAny(texture);
        expect(inspector._tab).to.equal('assets');
        expect(inspector._assetList.selected).to.equal(texture);
        expect(inspector._properties.subject).to.equal(texture);
        const names = [...panel(inspector).querySelectorAll('.pci-lrow .pci-cell-name')].map(cell => cell.textContent);
        // the default order is by type
        expect(names).to.deep.equal(['wall', 'bricks']);
        inspector.destroy();
    });

    it('opens a linked buffer on the memory tab, showing every kind when a filter would hide it', function () {
        const inspector = /** @type {any} */ (new Inspector(app));
        const mesh = new Mesh(app.graphicsDevice);
        mesh.setPositions([0, 0, 0, 1, 0, 0, 0, 1, 0]);
        mesh.setIndices([0, 1, 2]);
        mesh.update();

        inspector._bufferKind.value = 'index';
        inspector._selectAny(mesh.vertexBuffer);
        expect(inspector._tab).to.equal('memory');
        expect(inspector._bufferKind.value).to.equal('all');
        expect(inspector._bufferList.selected).to.equal(mesh.vertexBuffer);
        expect(inspector._properties.subject).to.equal(mesh.vertexBuffer);
        expect(inspector._memoryNote.textContent).to.match(/^VRAM: textures/);

        // with the kind filter matching, it is left alone
        inspector._bufferKind.value = 'index';
        inspector._selectAny(mesh.indexBuffer[0]);
        expect(inspector._bufferKind.value).to.equal('index');
        expect(inspector._bufferList.selected).to.equal(mesh.indexBuffer[0]);

        mesh.destroy();
        inspector.destroy();
    });

    it('lists the device shaders and selects a linked shader on the shaders tab', function () {
        const inspector = /** @type {any} */ (new Inspector(app));
        const device = app.graphicsDevice;
        const glsl = new Shader(device, { name: 'lit', vshader: 'void main() {}', fshader: 'void main() {}', attributes: { vertex_position: SEMANTIC_POSITION } });
        const wgsl = new Shader(device, { name: 'blit', vshader: 'fn main() {}', fshader: 'fn main() {}', shaderLanguage: SHADERLANGUAGE_WGSL });
        expect(device.shaders).to.include.members([glsl, wgsl]);

        inspector._selectAny(wgsl);
        expect(inspector._tab).to.equal('shaders');
        expect(inspector._shaderList.selected).to.equal(wgsl);
        expect(inspector._properties.subject).to.equal(wgsl);
        const rows = [...panel(inspector).querySelectorAll('.pci-lrow')].map(row => row.textContent);
        expect(rows.some(text => text.startsWith('lit') && text.includes('GLSL'))).to.be.true;
        expect(rows.some(text => text.startsWith('blit') && text.includes('WGSL'))).to.be.true;

        glsl.destroy();
        wgsl.destroy();
        expect(device.shaders).to.not.include.members([glsl, wgsl]);
        inspector.destroy();
    });

    it('names the layers a component renders in', function () {
        app.scene.layers = /** @type {any} */ ({
            getLayerById: id => ({ 0: { name: 'World' }, 2: { name: 'Depth' }, 4: { name: 'UI' } })[id] ?? null
        });
        const entity = new Entity('camera', app);
        entity.c.camera = /** @type {any} */ ({ enabled: true, system: { app }, layers: [0, 2, 4, 77] });
        entity.c.light = /** @type {any} */ ({ enabled: true, system: { app }, layers: [] });

        const section = key => buildNodeModel(entity).find(s => s.key === key);
        const row = (key, label) => section(key).rows.find(r => r.label === label).value;
        expect(row('c:camera', 'layers').text).to.equal('World (0), Depth (2), UI (4), #77 (not in the composition)');
        // an empty list reads as one, and a component without layers gets no row
        expect(row('c:light', 'layers').text).to.equal('[]');
        entity.c.light = /** @type {any} */ ({ enabled: true, system: { app } });
        expect(section('c:light').rows.map(r => r.label)).to.not.include('layers');
    });

    it('lists mesh instances that open into their properties, linking their mesh and material', function () {
        const device = app.graphicsDevice;
        const texture = new Texture(device, { name: 'albedo', width: 4, height: 4, format: PIXELFORMAT_RGBA8 });
        const material = new StandardMaterial();
        material.name = 'painted';
        material.diffuseMap = texture;
        const mesh = new Mesh(device);
        mesh.setPositions([0, 0, 0, 1, 0, 0, 0, 1, 0]);
        mesh.setNormals([0, 0, 1, 0, 0, 1, 0, 0, 1]);
        mesh.setIndices([0, 1, 2]);
        mesh.update();
        const entity = new Entity('robot', app);
        entity.c.render = /** @type {any} */ ({
            enabled: true,
            system: { app },
            meshInstances: [new MeshInstance(mesh, material, entity), new MeshInstance(mesh, material, entity)]
        });

        const sections = buildNodeModel(entity);
        // no separate sections any more: everything hangs off the component's own row
        expect(sections.map(section => section.key)).to.deep.equal(['node', 'transform', 'c:render']);
        const rows = sections[2].rows;
        const list = rows.find(row => row.label === 'meshInstances');
        expect(list.value.text).to.equal('Array(2) of MeshInstance');
        const items = rows.filter(row => row.depth === 1);
        expect(items.map(row => row.label)).to.deep.equal(['[0]', '[1]']);
        // each entry of an array starts a group, so the expanded entries read apart
        expect(items.every(row => row.group)).to.be.true;
        expect(rows.find(row => row.label === 'meshInstances').group).to.equal(undefined);
        // the item is the instance itself, so clicking it opens rather than jumping to its node
        expect(list.value.items[0].target).to.equal(undefined);

        const instanceRows = list.value.items[0].expand();
        expect(instanceRows.slice(0, 4).map(row => row.label)).to.deep.equal(['node', 'mesh', 'material', 'visible']);
        expect(instanceRows.map(row => row.label)).to.include('castShadow');
        expect(instanceRows[0].value.target).to.equal(entity);

        // the mesh links to its tab, which shows its geometry
        expect(instanceRows[1].value.target).to.equal(mesh);
        expect(instanceRows[1].value.expand).to.equal(undefined);
        const meshRows = buildMeshRows(mesh);
        const byLabel = (list2, label) => list2.find(row => row.label === label).value;
        expect(byLabel(meshRows, 'vertex buffer').text).to.equal('3 vertices, 72 B');
        // the buffers link to the memory tab
        expect(byLabel(meshRows, 'vertex buffer').target).to.equal(mesh.vertexBuffer);
        expect(byLabel(meshRows, 'index buffer').target).to.equal(mesh.indexBuffer[0]);
        expect(byLabel(meshRows, 'index buffer').text).to.equal('3 indices, UINT16, 6 B');
        expect(byLabel(meshRows, 'primitive').text).to.equal('TRIANGLES  count 3  base 0  indexed');
        // several draw ranges list one entry each
        mesh.primitive.push({ type: 1, base: 3, baseVertex: 2, count: 4 });
        const many = byLabel(buildMeshRows(mesh), 'primitive');
        expect(many.text).to.equal('2 primitives');
        expect(many.items.map(item => item.text)).to.deep.equal([
            'TRIANGLES  count 3  base 0  indexed', 'LINES  count 4  base 3  base vertex 2'
        ]);
        mesh.primitive.length = 1;
        expect(meshRows.map(row => row.label)).to.include('aabb');

        const format = byLabel(meshRows, 'vertex format');
        // a mesh built through setPositions is non-interleaved, one block of each element
        expect(format.text).to.equal('2 elements, 24 bytes per vertex');
        const elements = format.expand();
        expect(elements.map(row => row.label)).to.deep.equal(['POSITION', 'NORMAL']);
        expect(elements[0].value.text).to.equal('3 × FLOAT32  offset 0  stride 12  size 12');
        expect(elements[1].value.text).to.equal('3 × FLOAT32  offset 36  stride 12  size 12');

        // the material links to its tab too, which shows its properties
        expect(instanceRows[2].value.target).to.equal(material);
        expect(instanceRows[2].value.expand).to.equal(undefined);
        const materialRows = buildMaterialRows(material);
        expect(materialRows[0].label).to.equal('variants');
        const labels = materialRows.map(row => row.label);
        expect(labels).to.include.members(['diffuse', 'diffuseMap', 'blendType']);
        // getters that only warn about their removal or deprecation are left out
        expect(labels).to.not.include.members(['chunks', 'shader', 'dirty', 'diffuseTint']);
        expect(materialRows.find(row => row.label === 'diffuseMap').value.target).to.equal(texture);

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

    it('expands a code row into a numbered block with a copy button', function () {
        const container = document.createElement('div');
        const view = new PropertyView(container, () => {});
        let code = 'void main() {\n}';
        const model = () => [{ key: 's', title: 'Sources', rows: [{ key: 'v', label: 'vertex', value: { text: '2 lines', cls: 'num', code } }] }];
        view.setSubject({}, model);
        const row = container.querySelector('.pci-prop');
        expect(row.classList.contains('pci-expandable')).to.be.true;
        expect(row.querySelector('.pci-value').textContent).to.equal('▸ 2 lines');
        expect(row.querySelector('.pci-copy')).to.exist;
        expect(container.querySelector('.pci-code')).to.equal(null);

        row.querySelector('.pci-value').click();
        const block = container.querySelector('.pci-code');
        expect(row.querySelector('.pci-value').textContent).to.equal('▾ 2 lines');
        expect(block.previousSibling).to.equal(row);
        expect([...block.querySelectorAll('.pci-code-line')].map(line => line.textContent)).to.deep.equal(['void main() {', '}']);

        // a refresh with changed code rewrites the block in place, and the state survives it
        code = 'a\nb\nc';
        view.refresh();
        expect(container.querySelectorAll('.pci-code-line')).to.have.lengthOf(3);
        row.querySelector('.pci-value').click();
        expect(container.querySelector('.pci-code')).to.equal(null);
        expect(row.querySelector('.pci-copy')).to.exist;
    });

    it('returns a subject to where it was last read', function () {
        const container = document.createElement('div');
        // jsdom performs no layout, so stand in for the scroller
        let top = 0;
        Object.defineProperty(container, 'scrollTop', {
            get: () => top,
            set: (value) => {
                top = value;
            }
        });
        const view = new PropertyView(container, () => {});
        const model = () => [{ key: 's', title: 'S', rows: [{ key: 'a', label: 'a', value: { text: 'x' } }] }];
        const entity = { name: 'entity' };
        const texture = { name: 'texture' };

        view.setSubject(entity, model);
        container.scrollTop = 420;

        // following a link to another subject starts at the top
        view.setSubject(texture, model);
        expect(container.scrollTop).to.equal(0);
        container.scrollTop = 90;

        // coming back to either lands where it was left
        view.setSubject(entity, model);
        expect(container.scrollTop).to.equal(420);
        view.setSubject(texture, model);
        expect(container.scrollTop).to.equal(90);

        // a subject identified by a key, such as a render pass recreated every frame
        view.setSubject({ pass: 1 }, model, 'pass:1');
        container.scrollTop = 30;
        view.setSubject(entity, model);
        view.setSubject({ pass: 1 }, model, 'pass:1');
        expect(container.scrollTop).to.equal(30);

        // nothing selected reads from the top, and a refresh of the same subject leaves it alone
        view.setSubject(null);
        expect(container.scrollTop).to.equal(0);
        view.setSubject(entity, model);
        container.scrollTop = 200;
        view.setSubject(entity, model);
        expect(container.scrollTop).to.equal(200);
    });

    it('closes a collection under the last row its final entry opened', function () {
        const container = document.createElement('div');
        const view = new PropertyView(container, () => {});
        const child = () => [{ key: 'deep', label: 'deep', value: { text: 'inner' } }];
        const model = () => [{
            key: 's',
            title: 'S',
            rows: [
                { key: 'list', label: 'list', value: { text: 'Array(2)' } },
                { key: 'list[0]', label: '[0]', value: { text: 'first', expand: child }, depth: 1, group: true },
                { key: 'list[1]', label: '[1]', value: { text: 'second', expand: child }, depth: 1, group: true },
                { key: 'after', label: 'after', value: { text: 'tail' } }
            ]
        }];
        view.setSubject({}, model);
        const labels = () => [...container.querySelectorAll('.pci-prop')].map(el => [
            el.querySelector('.pci-label').textContent,
            el.classList.contains('pci-group') ? 'start' : el.classList.contains('pci-group-end') ? 'end' : ''
        ]);
        expect(labels()).to.deep.equal([['list', ''], ['[0]', 'start'], ['[1]', 'start'], ['after', '']]);
        expect([...container.querySelectorAll('.pci-prop')][2].classList.contains('pci-group-end')).to.be.true;

        // with the last entry open, the divider moves below the rows it opened
        [...container.querySelectorAll('.pci-prop')][2].querySelector('.pci-value').click();
        const rows = [...container.querySelectorAll('.pci-prop')];
        expect(rows.map(el => el.querySelector('.pci-label').textContent)).to.deep.equal(['list', '[0]', '[1]', 'deep', 'after']);
        expect(rows[2].classList.contains('pci-group-end')).to.be.false;
        expect(rows[3].classList.contains('pci-group-end')).to.be.true;
    });

    it('opens a value in place, indenting and grouping the rows it expands into', function () {
        const container = document.createElement('div');
        const view = new PropertyView(container, () => {});
        const children = () => [
            { key: 'a', label: 'a', value: { text: '1' } },
            { key: 'b', label: 'b', value: { text: '2' }, depth: 1, group: true }
        ];
        const model = () => [{
            key: 's',
            title: 'S',
            rows: [{ key: 'list', label: 'list', value: { text: 'Array(1)', expand: children } }]
        }];
        view.setSubject({}, model);
        const parent = container.querySelector('.pci-prop');
        expect(parent.querySelector('.pci-value').textContent).to.equal('▸ Array(1)');
        expect(container.querySelectorAll('.pci-prop')).to.have.lengthOf(1);

        parent.querySelector('.pci-value').click();
        const rows = [...container.querySelectorAll('.pci-prop')];
        expect(rows).to.have.lengthOf(3);
        expect(rows[0].querySelector('.pci-value').textContent).to.equal('▾ Array(1)');
        // children indent one level below their parent, and a grouped child gets the divider
        expect([rows[1].style.paddingLeft, rows[2].style.paddingLeft]).to.deep.equal(['22px', '36px']);
        // one guide per level, cycling through the palette, at each level's own offset
        expect(rows[0].style.backgroundImage).to.equal('');
        expect(rows[1].style.backgroundImage.match(/linear-gradient/g)).to.have.lengthOf(1);
        expect(rows[1].style.backgroundPosition).to.equal('8px 0px');
        expect(rows[2].style.backgroundImage.match(/linear-gradient/g)).to.have.lengthOf(2);
        expect(rows[2].style.backgroundPosition).to.equal('8px 0px, 22px 0px');
        expect(rows[2].style.backgroundSize).to.equal('1px 100%');
        expect(rows[1].style.backgroundImage).to.not.equal(rows[2].style.backgroundImage.split(', ')[1]);
        expect(rows[1].classList.contains('pci-group')).to.be.false;
        expect(rows[2].classList.contains('pci-group')).to.be.true;
        // the collection is closed under its last entry
        expect(rows[2].classList.contains('pci-group-end')).to.be.true;
        expect(rows[1].classList.contains('pci-group-end')).to.be.false;

        // collapsing removes them again
        parent.querySelector('.pci-value').click();
        expect(container.querySelectorAll('.pci-prop')).to.have.lengthOf(1);
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

    it('flips the preview of textures a render target stores bottom-up', function () {
        const color = texture();
        const depth = texture({ format: PIXELFORMAT_DEPTH });
        const target = origin => /** @type {any} */ ({ origin, colorBufferCount: 1, getColorBuffer: () => color, depthBuffer: depth });
        const on = (device, origin) => ({ ...device, targets: new Set([target(origin)]) });

        // native is bottom-up on WebGL2 only, the explicit origins mean the same on both
        expect(storedBottomUp(color, on(webgl2, 'native'))).to.be.true;
        expect(storedBottomUp(depth, on(webgl2, 'native'))).to.be.true;
        expect(storedBottomUp(color, on(webgpu, 'native'))).to.be.false;
        expect(storedBottomUp(color, on(webgl2, 'top'))).to.be.false;
        expect(storedBottomUp(color, on(webgpu, 'bottom'))).to.be.true;

        // a given target wins over the lookup, and a texture no target owns is shown as it is
        expect(storedBottomUp(color, on(webgl2, 'native'), target('top'))).to.be.false;
        expect(storedBottomUp(texture(), on(webgl2, 'native'))).to.be.false;
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

describe('Inspector asset view', function () {
    let registry;
    let big;
    let small;
    let unloaded;

    beforeEach(function () {
        jsdomSetup();
        registry = new AssetRegistry(null);
        big = new Asset('sky', 'cubemap', { url: 'sky.dds', size: 4096, hash: 'abc' });
        small = new Asset('bricks', 'texture', { url: 'bricks.png', size: 1024 });
        unloaded = new Asset('clip', 'audio', { url: 'clip.mp3' });
        for (const asset of [small, big, unloaded]) registry.add(asset);
        big.loaded = true;
        small.loaded = true;
    });

    afterEach(jsdomTeardown);

    it('sorts the registry and tags each row with its type and load state', function () {
        expect(collectAssets(registry).map(a => a.type)).to.deep.equal(['audio', 'cubemap', 'texture']);
        expect(collectAssets(registry, 'size').map(a => a.name)).to.deep.equal(['sky', 'bricks', 'clip']);
        expect(collectAssets(registry, 'name').map(a => a.name)).to.deep.equal(['bricks', 'clip', 'sky']);
        expect(collectAssets(registry, 'type').map(a => a.type)).to.deep.equal(['audio', 'cubemap', 'texture']);
        expect(collectAssets(registry, 'id').map(a => a.id)).to.deep.equal([small, big, unloaded].map(a => a.id).sort((x, y) => x - y));
        expect(collectAssets(null)).to.deep.equal([]);

        // an asset built in memory has nothing to download, unlike one whose descriptor omits the size
        const inMemory = new Asset('atlas frame', 'sprite', null);
        registry.add(inMemory);
        expect(assetRows(registry, 'name')[0].cells.map(c => c.text)).to.include('no file');
        registry.remove(inMemory);

        const rows = assetRows(registry, 'size');
        expect(rows[0].cells.map(c => c.text)).to.deep.equal(['sky', 'cubemap', '4.0 KB', `#${big.id}`]);
        expect(rows[0].dim).to.be.false;
        // a file without a size in its descriptor is not the same as no file at all
        expect(rows[2].cells.map(c => c.text)).to.deep.equal(['clip', 'audio', 'not loaded', 'size unknown', `#${unloaded.id}`]);
        expect(rows[2].dim).to.be.true;
        expect(rows[0].title).to.match(/sky\ncubemap, loaded, 4.0 KB\nsky.dds/);
    });

    it('describes asset references, resolving ids and arrays through the registry', function () {
        expect(describeAssetValue(small.id, registry).target).to.equal(small);
        expect(describeAssetValue(small, registry).target).to.equal(small);
        expect(describeAssetValue(4242, registry).text).to.match(/not in the registry/);
        expect(describeAssetValue(null, registry).text).to.equal('null');
        const array = describeAssetValue([big.id, small], registry);
        expect(array.text).to.equal('Array(2) of asset');
        expect(array.items.map(item => item.target)).to.deep.equal([big, small]);
        expect(describeAssetValue([], registry).text).to.equal('[]');
    });

    it('finds the components using an asset by walking the scene', function () {
        const app = /** @type {any} */ ({ root: null });
        const child = { name: 'child', c: { sprite: { spriteAsset: small.id } }, children: [] };
        const other = { name: 'other', c: { render: { asset: 77, materialAssets: [big.id] } }, children: [] };
        app.root = { name: 'root', c: {}, children: [child, other] };

        const users = assetUsers(app, small);
        expect(users).to.have.lengthOf(1);
        expect(users[0].entity).to.equal(child);
        expect(users[0].name).to.equal('sprite');
        expect(users[0].property).to.equal('spriteAsset');
        // an array reference counts, and an unused asset has no users
        expect(assetUsers(app, big).map(u => u.property)).to.deep.equal(['materialAssets']);
        expect(assetUsers(app, unloaded)).to.deep.equal([]);
    });

    it('shows where an asset came from, its resources and its users', function () {
        const app = /** @type {any} */ ({ root: { name: 'root', c: { sprite: { spriteAsset: big.id } }, children: [] } });
        const [general, resources, users, props] = buildAssetModel(big, { app });
        const byLabel = (section, label) => section.rows.find(r => r.label === label).value;

        expect(byLabel(general, 'type').text).to.equal('cubemap');
        expect(byLabel(general, 'state').text).to.equal('loaded');
        expect(byLabel(general, 'url').text).to.equal('"sky.dds"');
        expect(byLabel(general, 'file size').text).to.equal('4.0 KB');
        expect(byLabel(general, 'hash').text).to.equal('"abc"');
        expect(byLabel(users, 'components').text).to.equal('1 component');
        expect(byLabel(users, 'components').items[0].label).to.equal('sprite.spriteAsset');
        expect(props.rows.map(r => r.label)).to.not.include.members(['id', 'name', 'type', 'file', 'registry']);

        // an asset that never loaded says so instead of showing an empty resource
        expect(byLabel(buildAssetModel(unloaded, { app })[1], 'resource').text).to.match(/not loaded/);
        expect(byLabel(resources, 'resource').text).to.equal('undefined');
    });

    it('maps loaded resources back to the asset they came from', function () {
        const resource = { name: 'sky texture' };
        big._resources = [resource];
        const map = resourceAssets(registry);
        expect(map.get(resource)).to.equal(big);
        expect(map.size).to.equal(1);
        expect(resourceAssets(null).size).to.equal(0);
    });
});

describe('Inspector mesh view', function () {
    let device;
    let meshes;

    beforeEach(function () {
        jsdomSetup();
        device = new NullGraphicsDevice(document.createElement('canvas'));
        meshes = [];
    });

    afterEach(function () {
        meshes.forEach(mesh => mesh.destroy());
        device.destroy();
        jsdomTeardown();
    });

    const build = (count) => {
        const mesh = new Mesh(device);
        const positions = [];
        for (let i = 0; i < count; i++) positions.push(i, 0, 0);
        mesh.setPositions(positions);
        mesh.setIndices([...Array(count).keys()]);
        mesh.update();
        meshes.push(mesh);
        return mesh;
    };

    /**
     * @returns {any} An app whose meshes are reachable in every way the survey looks: a disabled
     * entity's component, a layer, a render and a model asset and the debug lines, plus one mesh
     * nothing reachable holds and one whose buffer only serves as instancing data.
     */
    function sceneApp() {
        const shared = build(30);
        const disabled = build(12);
        const rendered = build(3);
        const modelled = build(6);
        const lines = build(2);
        const orphan = build(9);
        const instancing = build(4);

        const root = new GraphNode('root');
        const wall = new GraphNode('wall');
        const door = new GraphNode('door');
        const hidden = new GraphNode('hidden');
        root.addChild(wall);
        root.addChild(door);
        root.addChild(hidden);

        const material = new StandardMaterial();
        const wallInstance = new MeshInstance(shared, material, wall);
        const doorInstance = new MeshInstance(shared, material, door);
        const hiddenInstance = new MeshInstance(disabled, material, hidden);
        /** @type {any} */ (doorInstance).instancingData = { vertexBuffer: instancing.vertexBuffer };
        // the components hold their instances whether or not the layers draw them
        /** @type {any} */ (wall).c = { render: { meshInstances: [wallInstance] } };
        /** @type {any} */ (hidden).c = { render: { meshInstances: [hiddenInstance] } };

        const assets = new AssetRegistry(null);
        const renderAsset = new Asset('robot', 'render', null);
        renderAsset.loaded = true;
        /** @type {any} */ (renderAsset)._resources = [{ meshes: [rendered] }];
        assets.add(renderAsset);
        const modelAsset = new Asset('crate', 'model', null);
        modelAsset.loaded = true;
        /** @type {any} */ (modelAsset)._resources = [{ meshInstances: [{ mesh: modelled }] }];
        assets.add(modelAsset);

        const immediate = { batchesMap: new Map([[{ name: 'Immediate' }, { map: new Map([['material', { mesh: lines }]]) }]]) };
        return {
            graphicsDevice: device,
            root,
            assets,
            scene: { immediate, layers: { layerList: [{ name: 'World', meshInstances: [wallInstance, doorInstance] }] } },
            parts: { shared, disabled, rendered, modelled, lines, orphan, instancing, wall, door, renderAsset, modelAsset, wallInstance }
        };
    }

    it('finds meshes through components, layers, assets and debug lines, counting each instance once', function () {
        const app = sceneApp();
        const { shared, disabled, rendered, modelled, lines, orphan, instancing, wall, door, renderAsset, modelAsset } = app.parts;
        const survey = surveyMeshes(app);
        const users = mesh => (survey.users.get(mesh) ?? []).map(user => [user.role, user.label, user.target]);

        // the wall is found through its component first and not again through the layer
        expect(users(shared)).to.deep.equal([['render component', 'wall', wall], ['drawn on "World"', 'door', door]]);
        expect(users(disabled)[0][0]).to.equal('render component');
        expect(users(rendered)).to.deep.equal([['render asset', 'Asset "robot"', renderAsset]]);
        expect(users(modelled)).to.deep.equal([['model asset', 'Asset "crate"', modelAsset]]);
        expect(users(lines)).to.deep.equal([['debug lines', 'Lines on "Immediate"', null]]);
        expect(survey.users.has(orphan)).to.be.false;
        expect(survey.users.has(instancing)).to.be.false;
        expect(survey.instances).to.equal(3);

        // the orphan's buffer is the one vertex buffer no found mesh, instancing data or the
        // device's quad accounts for
        expect(survey.unaccounted).to.equal(1);
        expect(meshNote(survey)).to.match(/^1 of the \d+ vertex buffers on the device belong to no mesh found/);
        orphan.destroy();
        expect(meshNote(surveyMeshes(app))).to.equal('');
    });

    it('lists meshes largest first, dimming those no instance draws, and matches any user', function () {
        const app = sceneApp();
        const rows = meshListRows(surveyMeshes(app));
        expect(rows.map(row => row.name)).to.deep.equal(['wall', 'hidden', 'Asset "crate"', 'Asset "robot"', 'Lines on "Immediate"']);
        expect(rows[0].cells.map(cell => cell.text).slice(1, 2)).to.deep.equal(['30 verts, 30 indices · 2 instances']);
        expect(rows[0].dim).to.be.false;
        expect(rows[3].dim).to.be.true;
        // a shared mesh is named after its first user but found by any of them
        expect(rows[0].matches('door')).to.be.true;
        expect(rows[0].matches('robot')).to.be.false;
    });

    it('shows a mesh with its geometry and its users, the instances opening in place', function () {
        const app = sceneApp();
        const { shared, wall, wallInstance } = app.parts;
        const [geometry, usage] = buildMeshModel(shared, { app });
        expect(geometry.title).to.equal(`Mesh #${shared.id}`);
        expect(geometry.rows.map(row => row.label)).to.include.members(['size', 'vertex buffer', 'vertex format', 'index buffer', 'primitive']);

        const users = usage.rows[0].value;
        expect(users.text).to.equal('2 mesh instances');
        expect(users.items[0].text).to.equal('wall');
        expect(users.items[0].target).to.equal(wall);
        expect(users.items[0].expand().map(row => row.label)).to.include('material');

        // elsewhere a mesh links here, including under each of its mesh instances
        expect(describeValue(shared).target).to.equal(shared);
        expect(meshInstanceRows(wallInstance).find(row => row.label === 'mesh').value.target).to.equal(shared);
    });
});

describe('Inspector material view', function () {
    let device;

    beforeEach(function () {
        jsdomSetup();
        device = new NullGraphicsDevice(document.createElement('canvas'));
    });

    afterEach(function () {
        device.destroy();
        jsdomTeardown();
    });

    /**
     * @returns {any} An app whose materials are reachable in every way the survey looks: a disabled
     * entity's component, a layer, the debug lines and a material asset nothing draws with.
     */
    function sceneApp() {
        const mesh = new Mesh(device);
        const texture = new Texture(device, { name: 'bricks', width: 4, height: 4 });
        const custom = new Texture(device, { name: 'custom', width: 4, height: 4 });

        const brick = new StandardMaterial();
        brick.name = 'brick';
        brick.diffuseMap = texture;
        const glass = new StandardMaterial();
        glass.name = 'glass';
        glass.blendType = BLEND_NORMAL;
        // a texture set as a parameter, as a ShaderMaterial carries its textures
        glass.setParameter('texture_custom', custom);
        const hiddenMaterial = new StandardMaterial();
        hiddenMaterial.name = 'hidden';
        const lineMaterial = new StandardMaterial();
        lineMaterial.name = 'lines';
        const unused = new StandardMaterial();
        unused.name = 'unused';

        const root = new GraphNode('root');
        const wall = new GraphNode('wall');
        const window2 = new GraphNode('window');
        const hidden = new GraphNode('hidden');
        root.addChild(wall);
        root.addChild(window2);
        root.addChild(hidden);
        const wallInstance = new MeshInstance(mesh, brick, wall);
        const wallInstance2 = new MeshInstance(mesh, brick, wall);
        const windowInstance = new MeshInstance(mesh, glass, window2);
        const hiddenInstance = new MeshInstance(mesh, hiddenMaterial, hidden);
        // an instance only the app's own code holds, which its material still lists
        const held = new MeshInstance(mesh, brick, new GraphNode('held'));
        /** @type {any} */ (wall).c = { render: { meshInstances: [wallInstance, wallInstance2] } };
        /** @type {any} */ (hidden).c = { render: { meshInstances: [hiddenInstance] } };

        const assets = new AssetRegistry(null);
        const asset = new Asset('unused', 'material', null);
        asset.loaded = true;
        /** @type {any} */ (asset)._resources = [unused];
        assets.add(asset);

        const immediate = { batchesMap: new Map([[{ name: 'Immediate' }, { map: new Map([[lineMaterial, { material: lineMaterial }]]) }]]) };
        return {
            graphicsDevice: device,
            root,
            assets,
            scene: { immediate, layers: { layerList: [{ name: 'World', meshInstances: [wallInstance, windowInstance] }] } },
            parts: { mesh, texture, custom, brick, glass, hiddenMaterial, lineMaterial, unused, wall, held, asset }
        };
    }

    it('finds materials through the mesh instances, the debug lines and the material assets', function () {
        const app = sceneApp();
        const { brick, glass, hiddenMaterial, lineMaterial, unused, asset } = app.parts;
        const survey = surveyMaterials(app);
        expect([...survey.keys()]).to.deep.equal([brick, hiddenMaterial, glass, lineMaterial, unused]);
        expect(survey.get(lineMaterial).lines).to.deep.equal(['Immediate']);
        expect(survey.get(unused).assets).to.deep.equal([asset]);
    });

    it('lists materials the most used first, dimming those no instance uses', function () {
        const app = sceneApp();
        const rows = materialListRows(surveyMaterials(app));
        // the held instance counts: the material lists every instance using it, found or not
        expect(rows.map(row => row.name)).to.deep.equal(['brick', 'glass', 'hidden', 'lines', 'unused']);
        expect(rows[0].cells.map(cell => cell.text).slice(0, 3)).to.deep.equal(['brick', 'Standard', '3 instances · 1 texture · 0 variants']);
        expect(rows[1].cells.map(cell => cell.text).slice(1, 4)).to.deep.equal(['Standard', 'transparent', '1 instance · 1 texture · 0 variants']);
        expect(rows.map(row => row.dim)).to.deep.equal([false, false, false, true, true]);
    });

    it('shows a material with its textures and its users, the instances opening in place', function () {
        const app = sceneApp();
        const { brick, unused, texture, wall, held, asset } = app.parts;
        const byLabel = (section, label) => section.rows.find(row => row.label === label).value;

        const [general, usage] = buildMaterialModel(brick, { app });
        expect(general.title).to.equal('StandardMaterial "brick"');
        expect(byLabel(general, 'textures').items.map(item => item.target)).to.deep.equal([texture]);
        expect(general.rows.map(row => row.label)).to.include.members(['variants', 'diffuseMap']);

        const instances = byLabel(usage, 'mesh instances');
        expect(instances.text).to.equal('3 mesh instances');
        expect(instances.items.map(item => item.text)).to.deep.equal(['wall', 'wall', 'held']);
        expect(instances.items[0].target).to.equal(wall);
        expect(instances.items[2].target).to.equal(held.node);
        expect(instances.items[0].expand().map(row => row.label)).to.include('mesh');

        const [, unusedUsage] = buildMaterialModel(unused, { app });
        expect(byLabel(unusedUsage, 'mesh instances').text).to.equal('none');
        expect(byLabel(unusedUsage, 'assets').items[0].target).to.equal(asset);

        // elsewhere a material links here
        expect(describeValue(brick).target).to.equal(brick);
    });

    it('finds the materials sampling a texture or compiling a shader', function () {
        const app = sceneApp();
        const { brick, glass, texture, custom } = app.parts;
        expect(materialsUsingTexture(app, texture)).to.deep.equal([brick]);
        expect(materialsUsingTexture(app, custom)).to.deep.equal([glass]);

        const shader = {};
        glass.variants.set('variant', /** @type {any} */ (shader));
        expect(materialsUsingShader(app, /** @type {any} */ (shader))).to.deep.equal([glass]);

        const section = usedByMaterialsSection([glass]);
        expect(section.title).to.equal('Used by materials');
        expect(section.rows[0].value.text).to.equal('1 material');
        expect(section.rows[1].value.target).to.equal(glass);
        expect(usedByMaterialsSection([]).rows[0].value.text).to.equal('none found');
    });
});

describe('Inspector memory view', function () {
    let device;
    let mesh;
    let loose;
    let uniforms;
    let storage;

    beforeEach(function () {
        jsdomSetup();
        device = new NullGraphicsDevice(document.createElement('canvas'));
        const build = (count) => {
            const m = new Mesh(device);
            const positions = [];
            for (let i = 0; i < count; i++) positions.push(i, 0, 0);
            m.setPositions(positions);
            m.setIndices([...Array(count).keys()]);
            m.update();
            return m;
        };
        mesh = build(30);
        loose = build(3);
        uniforms = new UniformBuffer(device, new UniformBufferFormat(device, [new UniformFormat('tint', UNIFORMTYPE_VEC3)]), true);
        // the null device cannot back a storage buffer, so stand in for one
        storage = Object.assign(Object.create(StorageBuffer.prototype), { byteSize: 4096, id: 7 });
        device.buffers.add(storage);
    });

    afterEach(function () {
        mesh.destroy();
        loose.destroy();
        uniforms.destroy();
        device.buffers.delete(storage);
        device.destroy();
        jsdomTeardown();
    });

    /**
     * @returns {any} An app with the first mesh drawn by one instance in two layers, and the
     * second mesh only reachable through a render asset.
     */
    function sceneApp() {
        const node = new GraphNode('wall');
        const material = new StandardMaterial();
        material.name = 'brick';
        /** @type {any} */ (material)._uniformBuffer = uniforms;
        const instance = new MeshInstance(mesh, material, node);
        const assets = new AssetRegistry(null);
        const asset = new Asset('robot', 'render', null);
        asset.loaded = true;
        /** @type {any} */ (asset)._resources = [{ meshes: [loose] }];
        assets.add(asset);
        // debug lines live in the immediate renderer's batches, never in a layer's own list
        const lines = new Mesh(device);
        lines.setPositions([0, 0, 0, 1, 1, 1]);
        lines.update();
        const immediate = { batchesMap: new Map([[{ name: 'Immediate' }, { map: new Map([['material', { mesh: lines }]]) }]]) };
        return {
            graphicsDevice: device,
            assets,
            node,
            asset,
            lines,
            instance,
            scene: { immediate, layers: { layerList: [{ meshInstances: [instance] }, { meshInstances: [instance] }] } }
        };
    }

    it('lists the device buffers largest first, narrowed by kind', function () {
        const all = collectBuffers(device);
        expect(all).to.include.members([mesh.vertexBuffer, mesh.indexBuffer[0], uniforms, storage]);
        expect(all[0]).to.equal(storage);
        expect(collectBuffers(device, 'uniform')).to.deep.equal([uniforms]);
        expect(collectBuffers(device, 'index')).to.include.members([mesh.indexBuffer[0], loose.indexBuffer[0]]);
    });

    it('finds owners from the layers, the assets and the device, counting each instance once', function () {
        const app = sceneApp();
        const owners = bufferOwners(app);
        const of = buffer => owners.get(buffer) ?? [];

        expect(of(mesh.vertexBuffer)).to.deep.equal([{ role: 'vertices', label: 'wall', target: app.node }]);
        expect(of(mesh.indexBuffer[0])[0].role).to.equal('indices');
        // a material's buffer belongs to the material, listed once however many instances share it
        expect(of(uniforms)).to.deep.equal([{ role: 'material uniforms', label: 'Material "brick"', target: app.instance.material }]);
        expect(of(loose.vertexBuffer)).to.deep.equal([{ role: 'vertices', label: 'Asset "robot"', target: app.asset }]);
        expect(owners.has(storage)).to.be.false;
        // the quad the device shares with every full screen pass, and the debug line batches
        expect(of(device.quadIndexBuffer)[0].role).to.equal('full screen quad indices');
        expect(of(app.lines.vertexBuffer)).to.deep.equal([{ role: 'debug lines', label: 'Lines on "Immediate"', target: null }]);
        app.lines.destroy();
        expect(of(device.quadVertexBuffer)[0].label).to.equal('Graphics device');

        const rows = bufferRows(device, owners, 'all');
        const row = buffer => rows.find(r => r.item === buffer);
        expect(row(mesh.vertexBuffer).cells.map(c => c.text).slice(0, 3)).to.deep.equal(['wall', 'vertex', '30 vertices, 1 elements · vertices']);
        expect(row(mesh.vertexBuffer).dim).to.be.false;
        // nothing reachable holds the storage buffer, so it keeps a generated name and is dimmed
        expect(row(storage).name).to.match(/^StorageBuffer #\d+$/);
        expect(row(storage).dim).to.be.true;
    });

    it('names owners with their parent and tells the index buffers of a mesh apart', function () {
        const app = sceneApp();
        const root = new GraphNode('root');
        const group = new GraphNode('Walls6');
        root.addChild(group);
        group.addChild(app.node);
        // a mesh keeps one index buffer per render style, the wireframe one built on demand
        mesh.generateWireframe();
        const owners = bufferOwners(app);
        expect(owners.get(mesh.vertexBuffer)[0].label).to.equal('Walls6 › wall');
        expect(owners.get(mesh.indexBuffer[1])[0].role).to.equal('wireframe indices');
    });

    it('shows a buffer with its layout and the links to what uses it', function () {
        const app = sceneApp();
        const byLabel = (section, label) => section.rows.find(r => r.label === label).value;

        const [vertex, vertexUsers] = buildBufferModel(mesh.vertexBuffer, { app });
        expect(byLabel(vertex, 'vertices').text).to.equal('30');
        expect(byLabel(vertex, 'vertex format').expand().map(r => r.label)).to.deep.equal(['POSITION']);
        expect(byLabel(vertex, 'usage').text).to.equal('BUFFER_STATIC');
        expect(byLabel(vertexUsers, 'owners').items[0].target).to.equal(app.node);

        const [uniform] = buildBufferModel(uniforms, { app });
        expect(byLabel(uniform, 'layout').code).to.match(/vec3 +tint/);

        const [, storageUsers] = buildBufferModel(storage, { app });
        expect(byLabel(storageUsers, 'owners').text).to.match(/^not found/);
    });

    it('sums video memory by kind of resource', function () {
        const summary = memorySummary(device);
        expect(summary.split('\n')[0]).to.match(/^VRAM: textures .* · vertex .* · index .* · uniform .* · storage /);
        expect(summary).to.match(/shaders \d+/);

        // a pool of fixed blocks reads as count and size, one of whole buffers as a count
        const withPool = pool => memorySummary(/** @type {any} */ (Object.assign(Object.create(device), { dynamicBuffers: pool })));
        expect(withPool({ bufferCount: 2, bufferSize: 102400 })).to.match(/per-draw uniform pool: 2 × 100.0 KB/);
        expect(withPool({ bufferCount: 38, bufferSize: 0 })).to.match(/per-draw uniform pool: 38 buffers/);
        expect(withPool({ bufferCount: 0, bufferSize: 0 })).to.not.match(/uniform pool/);
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

    it('lays out uniform buffer and bind group formats as aligned text', function () {
        const uniforms = new UniformBufferFormat(device, [
            new UniformFormat('matrix_model', UNIFORMTYPE_MAT4),
            new UniformFormat('view_position', UNIFORMTYPE_VEC3),
            new UniformFormat('light_radius', UNIFORMTYPE_FLOAT, 2)
        ]);
        const layout = formatUniformBuffer(uniforms);
        expect(layout.split('\n')[0]).to.equal(`uniform buffer, ${uniforms.byteSize} bytes, 3 uniforms`);
        expect(layout).to.match(/^0 +64 +mat4 +matrix_model$/m);
        expect(layout).to.match(/^64 +12 +vec3 +view_position$/m);
        expect(layout).to.match(/float\[2\] +light_radius\[0\]$/m);

        const bindings = new BindGroupFormat(device, [
            new BindUniformBufferFormat('ub_mesh', SHADERSTAGE_VERTEX | SHADERSTAGE_FRAGMENT),
            new BindTextureFormat('texture_diffuseMap', SHADERSTAGE_FRAGMENT),
            new BindTextureFormat('shadowMap', SHADERSTAGE_FRAGMENT, TEXTUREDIMENSION_2D, SAMPLETYPE_DEPTH, false),
            new BindStorageBufferFormat('particles', SHADERSTAGE_COMPUTE, true)
        ]);
        const text = formatBindGroup(bindings);
        expect(text.split('\n')[0]).to.equal('bind group, 4 bindings');
        expect(text).to.match(/uniform buffer +ub_mesh +vertex, fragment$/m);
        expect(text).to.match(/texture +texture_diffuseMap +2d float \+ sampler texture_diffuseMap_sampler +fragment$/m);
        expect(text).to.match(/texture +shadowMap +2d depth +fragment$/m);
        expect(text).to.match(/storage buffer +particles +read-only +compute$/m);
        bindings.destroy();
    });

    it('formats byte counts in the largest fitting unit', function () {
        expect(formatBytes(512)).to.equal('512 B');
        expect(formatBytes(1536)).to.equal('1.5 KB');
        expect(formatBytes(3 * 1024 * 1024)).to.equal('3.00 MB');
        expect(formatBytes(2.5 * 1024 * 1024 * 1024)).to.equal('2.50 GB');
    });
});

describe('Inspector shader view', function () {
    let device;

    beforeEach(function () {
        jsdomSetup();
        device = new NullGraphicsDevice(document.createElement('canvas'));
    });

    afterEach(function () {
        device.destroy();
        jsdomTeardown();
    });

    it('rows carry the language, compute and failure tags and the model reads the definition', function () {
        const lit = new Shader(device, { name: 'lit', vshader: 'a\nb\nc', fshader: 'd', attributes: { vertex_position: SEMANTIC_POSITION } });
        const compute = new Shader(device, { name: 'sort', cshader: 'fn main() {}', shaderLanguage: SHADERLANGUAGE_WGSL });
        // a definition without source never reaches the device, so it is not listed
        const broken = new Shader(device, { name: 'broken', vshader: '', fshader: '' });
        lit.ready = true;
        compute.failed = true;

        const rows = shaderRows(device);
        expect(rows.map(row => row.name)).to.deep.equal(['lit', 'sort']);
        expect(rows[0].cells.map(cell => cell.text)).to.deep.equal(['lit', 'GLSL', `#${lit.id}`]);
        expect(rows[0].dim).to.be.false;
        expect(rows[1].cells.map(cell => cell.text)).to.deep.equal(['sort', 'WGSL', 'compute', 'failed', `#${compute.id}`]);
        expect(rows[1].dim).to.be.true;

        const [general, sources, groups, attributes] = buildShaderModel(lit);
        const byLabel = (section, label) => section.rows.find(row => row.label === label).value.text;
        expect(byLabel(general, 'language')).to.equal('GLSL');
        expect(byLabel(general, 'state')).to.equal('ready');
        expect(byLabel(attributes, 'declared')).to.match(/vertex_position/);
        expect(byLabel(buildShaderModel(broken)[0], 'state')).to.equal('failed');

        // every kept version of a stage is an expandable code block, listed under the stage
        expect(sources.rows.map(row => row.label)).to.deep.equal(['vertex', 'original', 'preprocessed', 'fragment', 'original', 'preprocessed']);
        const vertex = sources.rows[0];
        expect(vertex.value.text).to.equal('2 versions');
        expect(vertex.value.items[0].code).to.equal('a\nb\nc');
        expect(vertex.value.items[0].text).to.equal('3 lines');
        // the null device does not rewrite sources, so nothing beyond the preprocessed text is kept
        expect(vertex.value.items[1].label).to.equal('preprocessed');
        expect(vertex.value.items[1].code).to.be.a('string');
        expect(sources.rows[1].depth).to.equal(1);
        expect(buildShaderModel(compute)[1].rows[0].label).to.equal('compute');

        // shaders not processed against bind groups say so
        expect(groups.rows[0].value.text).to.match(/not processed/);

        expect(broken.failed).to.be.true;
        lit.destroy();
        compute.destroy();
    });
});

describe('Inspector frame graph capture', function () {
    /**
     * @param {string} name - The pass name.
     * @param {object} [props] - Extra fields.
     * @returns {any} A pass stub.
     */
    const pass = (name, props = {}) => ({ name, beforePasses: [], afterPasses: [], executeEnabled: true, ...props });

    /**
     * @param {string} name - The node name.
     * @param {object} [props] - Extra fields.
     * @returns {any} A mesh instance stub, drawn in every shader pass.
     */
    const instance = (name, props = {}) => ({
        node: { name, parent: null },
        material: { name: 'brick' },
        mesh: { vertexBuffer: { numVertices: 3 } },
        shaderPassMask: 0xFFFFFFFF,
        ...props
    });

    /**
     * A forward pass whose one layer step drew the given instances, out of a larger layer.
     *
     * @param {any[]} drawn - The instances the camera culled in, in draw order.
     * @param {any[]} [extra] - Further instances the layer holds but did not draw.
     * @returns {any} The pieces: the app, the pass, its step and its layer.
     */
    const forwardScene = (drawn, extra = []) => {
        const camera = { shaderPassInfo: null };
        const layer = {
            name: 'World',
            enabled: true,
            meshInstances: [...drawn, ...extra],
            _visibleInstances: new WeakMap([[camera, { opaque: drawn, transparent: [] }]])
        };
        const step = { layer, transparent: false, cameraComponent: { camera, entity: { name: 'Camera' } } };
        const forward = Object.assign(Object.create(RenderPassForward.prototype), {
            name: 'RenderPassForward', beforePasses: [], afterPasses: [], executeEnabled: true, renderTarget: null, layerRenderSteps: [step]
        });
        const backBuffer = { name: 'Backbuffer', width: 4, height: 4, samples: 1, mipLevel: 0 };
        const app = { graphicsDevice: { backBuffer, gpuProfiler: null }, frameGraph: { renderPasses: [forward] }, scene: {} };
        return { app, forward, step, layer };
    };

    it('captures what each forward layer step drew, leaving out what the renderer skips', function () {
        const masked = instance('masked', { shaderPassMask: 0 });
        const empty = instance('empty', { instancingData: { count: 0 }, getDrawCommands: () => null });
        const lines = instance('');
        const drawn = [instance('a'), masked, empty, lines];
        const { app, step } = forwardScene(drawn, [instance('culled')]);
        app.scene.immediate = { batchesMap: new Map([[{}, { map: new Map([['m', { meshInstance: lines }]]) }]]) };

        const frame = captureFrameGraph(app);
        const list = frame.visible.get(step);
        expect(list.instances).to.deep.equal(drawn);
        // a copy, so a frozen frame keeps its list when the next cull refills the engine's
        expect(list.instances).to.not.equal(drawn);
        expect(list.drawn).to.equal(2);
        expect([...list.skipped]).to.deep.equal([masked, empty]);
        expect(list.debugLines.has(lines)).to.be.true;

        // a camera that never culled the layer has nothing to show
        step.cameraComponent = { camera: {}, entity: { name: 'Other' } };
        expect(captureFrameGraph(app).visible.get(step)).to.equal(null);
    });

    it('counts drawn meshes on the list and matches the filter by what was drawn', function () {
        const { app, forward } = forwardScene([instance('wall'), instance('door')], [instance('roof')]);
        const frame = captureFrameGraph(app);
        const rows = passRows(frame, app.graphicsDevice);
        const [passRow, stepRow] = rows;
        expect(stepRow.cells.at(-1).text).to.match(/· World · opaque · 2 of 3 meshes/);
        expect(passRow.item).to.equal(forward);

        // a name finds the pass and the step that drew it, but not one drawn nothing by that name
        expect(passRow.matches('door')).to.be.true;
        expect(stepRow.matches('door')).to.be.true;
        expect(stepRow.matches('roof')).to.be.false;
        expect(stepRow.matches('forward')).to.be.true;
    });

    it('selects a single layer step from its row, showing its drawn instances straight away', function () {
        const drawn = [];
        for (let i = 0; i < 250; i++) drawn.push(instance(`item-${i}`));
        const { app, forward, step } = forwardScene(drawn, [instance('culled')]);
        const frame = captureFrameGraph(app);
        const [passRow, stepRow] = passRows(frame, app.graphicsDevice);

        // the pass row selects the pass, the step row only its step
        expect(passRow.item).to.equal(forward);
        expect(stepRow.item).to.be.an.instanceOf(LayerStepSelection);
        expect(stepRow.item.pass).to.equal(forward);
        expect(stepRow.item.step).to.equal(step);
        expect(stepRow.item.index).to.equal(0);

        const pages = new Map();
        const stepCtx = { device: app.graphicsDevice, frame, passKey: stepRow.key, pages, filter: '', stable: true };
        const sections = buildStepModel(stepRow.item, stepCtx);
        expect(sections.map(section => section.key)).to.deep.equal(['step', 'instances']);
        expect(sections[0].title).to.equal('Forward › World opaque');
        const byLabel = label => sections[0].rows.find(row => row.label === label).value;
        expect(byLabel('pass').target).to.equal(forward);
        expect(byLabel('draws').text).to.equal('250 of 251 meshes');
        expect(byLabel('sub-layer').text).to.equal('opaque');

        // the instances are listed, not behind a row to open, and page like they do under the pass
        const rows = sections[1].rows;
        expect(rows[0].value.text).to.equal('1–200 of 250');
        expect(rows).to.have.lengthOf(201);
        rows[0].value.actions[1].run();

        // the step view and the pass view share the page of the step
        const passCtx = { ...stepCtx, passKey: passRow.key };
        const draws = buildPassModel(forward, passCtx).find(section => section.key === 'steps').rows.find(row => row.label === '[0] draws').value;
        expect(draws.expand()[0].value.text).to.equal('201–250 of 250');

        // a camera that never culled the layer says so in place of the list
        step.cameraComponent = { camera: {}, entity: { name: 'Other' } };
        const unculled = captureFrameGraph(app);
        const [, row] = passRows(unculled, app.graphicsDevice);
        expect(buildStepModel(row.item, { ...stepCtx, frame: unculled })[1].rows[0].value.text).to.match(/has not culled/);
    });

    it('shows a step when its row is clicked and the pass when the pass row is', function () {
        jsdomSetup();
        const app = createApp();
        const { forward } = forwardScene([instance('wall')]);
        app.frameGraph = { renderPasses: [forward] };
        const inspector = /** @type {any} */ (new Inspector(app));
        inspector._setTab('passes');
        const rows = [...inspector._panels.passes.querySelectorAll('.pci-lrow')];

        rows[1].click();
        expect(inspector._properties.subject).to.be.an.instanceOf(LayerStepSelection);
        expect(panel(inspector).querySelector('.pci-section-title').textContent).to.equal('Forward › World opaque');
        expect(inspector._countsEl.parentElement.textContent).to.match(/Forward › World opaque/);

        rows[0].click();
        expect(inspector._properties.subject).to.equal(forward);
        // a link to the pass selects the pass row, not the first of its steps
        inspector._selectAny(forward);
        expect(inspector._passList.selectedKey).to.equal(inspector._passList._rows[0].key);

        inspector.destroy();
        jsdomTeardown();
    });

    it('steps a debug frame through the draws of a layer step, driving the renderer limit', function () {
        jsdomSetup();
        const app = createApp();
        app.renderer = { debugDrawLimitSupported: true, debugDrawLimit: null };
        const drawn = [instance('a'), instance('b'), instance('c')];
        const { forward, step, layer } = forwardScene(drawn);
        app.frameGraph = { renderPasses: [forward] };
        const inspector = /** @type {any} */ (new Inspector(app));
        inspector._setTab('passes');
        const rows = [...inspector._panels.passes.querySelectorAll('.pci-lrow')];
        rows[1].click();

        // on: paused, stopped at the last draw of the selected step
        inspector._debugFrameToggle.checked = true;
        inspector._debugFrameToggle.dispatchEvent(new window.Event('change'));
        expect(inspector.paused).to.be.true;
        app.fire('update', 0);
        let limit = app.renderer.debugDrawLimit;
        expect(limit.camera).to.equal(step.cameraComponent.camera);
        expect(limit.renderTarget).to.equal(app.graphicsDevice.backBuffer);
        expect(limit.layers.get(layer)).to.deep.equal([{ instance: drawn[2], index: 2 }, undefined]);
        expect(inspector._debugEl.textContent).to.equal('DEBUG FRAME · draw 2 of 3 · World opaque');

        // the arrow keys step back and on, taken ahead of the app
        let appSaw = 0;
        const appListener = () => appSaw++;
        window.addEventListener('keydown', appListener);
        window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
        window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
        window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
        app.fire('update', 0);
        limit = app.renderer.debugDrawLimit;
        expect(limit.layers.get(layer)[0]).to.deep.equal({ instance: drawn[0], index: 0 });
        expect(appSaw).to.equal(0);
        window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        app.fire('update', 0);
        expect(app.renderer.debugDrawLimit.layers.get(layer)[0].instance).to.equal(drawn[1]);

        // a click on a drawn instance chooses it, and the step view names it
        const choice = [...panel(inspector).querySelectorAll('.pci-prop.pci-selectable')].find(row => row.querySelector('.pci-label').textContent === '2');
        choice.querySelector('.pci-value').click();
        app.fire('update', 0);
        expect(app.renderer.debugDrawLimit.layers.get(layer)[0].instance).to.equal(drawn[2]);
        expect(choice.classList.contains('pci-active')).to.be.true;

        // off: the pass draws in full again and the earlier pause state returns
        inspector._debugFrameToggle.checked = false;
        inspector._debugFrameToggle.dispatchEvent(new window.Event('change'));
        expect(app.renderer.debugDrawLimit).to.equal(null);
        expect(inspector.paused).to.be.false;
        expect(inspector._debugEl.textContent).to.equal('');
        window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
        expect(appSaw).to.equal(1);

        // hiding the panel ends it too
        inspector._setDebugFrame(true);
        inspector.visible = false;
        expect(inspector._debugFrame).to.equal(null);
        expect(app.renderer.debugDrawLimit).to.equal(null);

        window.removeEventListener('keydown', appListener);
        inspector.destroy();
        jsdomTeardown();
    });

    it('carries a debug frame across the layer steps of a pass', function () {
        jsdomSetup();
        const app = createApp();
        app.renderer = { debugDrawLimitSupported: true, debugDrawLimit: null };
        const { forward, step, layer } = forwardScene([instance('a'), instance('b')]);
        // a second step of the same camera, the transparent sub-layer of the same layer
        const culled = layer._visibleInstances.get(step.cameraComponent.camera);
        const glass = instance('glass');
        culled.transparent = [glass];
        const transparentStep = { ...step, transparent: true };
        forward.layerRenderSteps.push(transparentStep);
        app.frameGraph = { renderPasses: [forward] };
        const inspector = /** @type {any} */ (new Inspector(app));
        inspector._setTab('passes');
        [...inspector._panels.passes.querySelectorAll('.pci-lrow')][1].click();
        inspector._setDebugFrame(true);

        // on past the last opaque draw into the transparent step, which then draws its first
        inspector._stepDebugDraw(1);
        app.fire('update', 0);
        expect(app.renderer.debugDrawLimit.layers.get(layer)).to.deep.equal([undefined, { instance: glass, index: 0 }]);
        expect(inspector._passList.selectedKey).to.match(/\/1$/);
        // and back, where the later transparent step draws nothing
        inspector._stepDebugDraw(-1);
        app.fire('update', 0);
        expect(app.renderer.debugDrawLimit.layers.get(layer)[1]).to.equal(0);

        inspector.destroy();
        jsdomTeardown();
    });

    it('offers the debug frame only on the debug engine', function () {
        jsdomSetup();
        const app = createApp();
        app.renderer = { debugDrawLimitSupported: false, debugDrawLimit: null };
        const inspector = /** @type {any} */ (new Inspector(app));
        expect(inspector._debugFrameToggle.disabled).to.be.true;
        inspector._setDebugFrame(true);
        expect(inspector._debugFrame).to.equal(null);
        inspector.destroy();
        jsdomTeardown();
    });

    it('pages the instances a layer step drew and narrows them with the filter', function () {
        const drawn = [];
        for (let i = 0; i < 450; i++) drawn.push(instance(`item-${i}`));
        const { app, forward } = forwardScene(drawn);
        const frame = captureFrameGraph(app);
        const ctx = { device: app.graphicsDevice, frame, passKey: 'p', pages: new Map(), filter: '', stable: false };

        const draws = () => buildPassModel(forward, ctx).find(section => section.key === 'steps').rows.find(row => row.label === '[0] draws').value;
        expect(draws().text).to.match(/^opaque, 450 of 450 meshes/);
        let rows = draws().expand();
        expect(rows[0].value.text).to.equal('1–200 of 450 · live: pause or freeze to page steadily');
        expect(rows).to.have.lengthOf(201);
        expect(rows[1].label).to.equal('0');
        expect(rows[1].value.text).to.equal('item-0 · material "brick" · 3 verts');
        expect(rows[1].group).to.be.true;
        expect(rows[0].value.actions[0].disabled).to.be.true;

        // the next page, and the last, which stops the pager
        rows[0].value.actions[1].run();
        rows = draws().expand();
        expect(rows[0].value.text).to.match(/^201–400 of 450/);
        expect(rows[1].label).to.equal('200');
        rows[0].value.actions[1].run();
        rows = draws().expand();
        expect(rows[0].value.text).to.match(/^401–450 of 450/);
        expect(rows[0].value.actions[1].disabled).to.be.true;

        // the filter narrows before paging, keeping the draw order indices, and snaps the page back
        ctx.filter = 'item-44';
        ctx.stable = true;
        rows = draws().expand();
        expect(rows[0].value.text).to.equal('1–11 of 11 matching "item-44"');
        expect(rows.slice(1).map(row => row.label)).to.deep.equal(['44', '440', '441', '442', '443', '444', '445', '446', '447', '448', '449']);
        ctx.filter = 'nothing like this';
        expect(draws().expand()[0].value.text).to.equal('none of 0 matching "nothing like this"');
    });

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

describe('Inspector list view', function () {
    beforeEach(jsdomSetup);
    afterEach(jsdomTeardown);

    it('lets a row decide whether it matches the filter', function () {
        const container = document.createElement('div');
        const list = new ListView(container, () => {});
        list.setRows([
            { key: 'a', item: 1, name: 'Forward', matches: filter => filter === 'wall', cells: [{ text: 'Forward' }] },
            { key: 'b', item: 2, name: 'Shadow', cells: [{ text: 'Shadow' }] }
        ]);
        const shown = () => [...container.querySelectorAll('.pci-lrow')].filter(row => row.style.display !== 'none').map(row => row.textContent);
        list.filter = 'wall';
        list.render();
        expect(shown()).to.deep.equal(['Forward']);
        list.filter = 'shad';
        list.render();
        expect(shown()).to.deep.equal(['Shadow']);
    });
});

describe('Inspector link hover', function () {
    beforeEach(jsdomSetup);
    afterEach(jsdomTeardown);

    const enter = el => el.dispatchEvent(new window.Event('pointerenter'));
    const leave = el => el.dispatchEvent(new window.Event('pointerleave'));

    it('reports the links of the property view as they are hovered, reading the current target', function () {
        const container = document.createElement('div');
        const view = new PropertyView(container, () => {});
        const hovered = [];
        view.onHover = (el, target) => hovered.push(target ? target() : null);
        let target = { first: true };
        view.setSubject({}, () => [{
            key: 's', title: 'S', rows: [{ key: 'a', label: 'a', value: { text: 'x', target } }, { key: 'b', label: 'b', value: { text: 'y' } }]
        }]);
        const [link, plain] = [...container.querySelectorAll('.pci-value')];

        enter(link);
        leave(link);
        // a value that links nowhere reports nothing
        enter(plain);
        expect(hovered).to.deep.equal([target, null]);

        // a refresh pointing the same element elsewhere is read when asked
        const first = target;
        target = { second: true };
        view.refresh();
        let read = null;
        view.onHover = (el, current) => {
            read = current;
        };
        enter(link);
        expect(read()).to.equal(target);
        expect(read()).to.not.equal(first);
    });

    it('reports the link cells of a list as they are hovered', function () {
        const container = document.createElement('div');
        const list = new ListView(container, () => {});
        const hovered = [];
        list.onHover = (el, target) => hovered.push(target ? target() : null);
        const target = {};
        list.setRows([{ key: 'a', item: 1, name: 'a', cells: [{ text: 'a' }, { text: 'link', target }] }]);
        const [plain, link] = [...container.querySelectorAll('.pci-lrow span')];

        enter(plain);
        enter(link);
        leave(link);
        expect(hovered).to.deep.equal([target, null]);
    });

    it('previews the texture of a hovered link only while it is still on screen', function () {
        const app = createApp();
        const inspector = new Inspector(app);
        const texture = new Texture(app.graphicsDevice, { name: 'bricks', width: 4, height: 4 });
        const el = document.createElement('span');
        document.body.appendChild(el);
        // jsdom lays nothing out, so stand in for a link that is shown, then hidden with its tab
        let shown = true;
        el.getClientRects = () => /** @type {any} */ (shown ? [{}] : []);

        const hover = /** @type {any} */ (inspector);
        hover._hoverLink = { el, target: () => texture };
        expect(hover._hoveredTexture()).to.equal(texture);

        // something other than a texture is not previewed
        hover._hoverLink = { el, target: () => ({}) };
        expect(hover._hoveredTexture()).to.equal(null);

        // a link hidden with its tab, or removed by a refresh, without a leave event is forgotten
        hover._hoverLink = { el, target: () => texture };
        shown = false;
        expect(hover._hoveredTexture()).to.equal(null);
        expect(hover._hoverLink).to.equal(null);
        shown = true;
        hover._hoverLink = { el, target: () => texture };
        el.remove();
        expect(hover._hoveredTexture()).to.equal(null);

        texture.destroy();
        inspector.destroy();
    });
});

describe('Inspector property view choices', function () {
    beforeEach(jsdomSetup);
    afterEach(jsdomTeardown);

    it('opens a selectable row from its caret and chooses it from the rest', function () {
        const container = document.createElement('div');
        const view = new PropertyView(container, () => {});
        let chosen = 0;
        let active = false;
        const model = () => [{
            key: 's',
            title: 'S',
            rows: [{
                key: 'draw',
                label: '0',
                value: {
                    text: 'wall',
                    active,
                    select: () => {
                        chosen++;
                        active = true;
                    },
                    expand: () => [{ key: 'child', label: 'mesh', value: { text: 'Mesh' } }]
                }
            }]
        }];
        view.setSubject({}, model);
        const row = container.querySelector('.pci-prop');
        expect(row.classList.contains('pci-selectable')).to.be.true;
        expect(row.classList.contains('pci-active')).to.be.false;

        // the text chooses, highlighting the row, and does not open it
        row.querySelector('.pci-value').lastChild.parentElement.click();
        expect(chosen).to.equal(1);
        expect(row.classList.contains('pci-active')).to.be.true;
        expect(container.querySelectorAll('.pci-prop')).to.have.lengthOf(1);

        // the caret opens it, without choosing again
        row.querySelector('.pci-caret').click();
        expect(chosen).to.equal(1);
        expect([...container.querySelectorAll('.pci-prop')].map(el => el.querySelector('.pci-label').textContent)).to.deep.equal(['0', 'mesh']);
        expect(row.querySelector('.pci-value').textContent).to.equal('▾ wall');

        // anywhere else on the row chooses too
        row.querySelector('.pci-label').click();
        expect(chosen).to.equal(2);
    });

    it('follows a link from the value only', function () {
        const container = document.createElement('div');
        const followed = [];
        const view = new PropertyView(container, target => followed.push(target));
        const target = {};
        view.setSubject({}, () => [{ key: 's', title: 'S', rows: [{ key: 'a', label: 'texture', value: { text: 'x', target } }] }]);
        const row = container.querySelector('.pci-prop');

        row.querySelector('.pci-label').click();
        expect(followed).to.have.lengthOf(0);
        row.querySelector('.pci-value').click();
        expect(followed).to.deep.equal([target]);
    });
});

describe('Inspector tooltip', function () {
    beforeEach(jsdomSetup);
    afterEach(jsdomTeardown);

    it('shows the tip of the hovered element after a rest, and hides it on leaving', async function () {
        const panel = document.createElement('div');
        document.body.appendChild(panel);
        installTooltip(panel);
        const button = document.createElement('button');
        const plain = document.createElement('span');
        panel.append(button, plain);
        setTip(button, 'Does a thing');
        expect(button.hasAttribute('title')).to.be.false;

        const tip = /** @type {HTMLElement} */ (panel.querySelector('.pci-tip'));
        button.dispatchEvent(new window.Event('pointerover', { bubbles: true }));
        expect(tip.style.display).to.not.equal('block');
        await new Promise((resolve) => {
            setTimeout(resolve, 400);
        });
        expect(tip.style.display).to.equal('block');
        expect(tip.textContent).to.equal('Does a thing');

        plain.dispatchEvent(new window.Event('pointerover', { bubbles: true }));
        expect(tip.style.display).to.equal('none');

        setTip(button, '');
        expect(button.dataset.tip).to.equal(undefined);
    });
});

describe('Inspector property view actions', function () {
    beforeEach(jsdomSetup);
    afterEach(jsdomTeardown);

    it('runs a row button and refreshes, rebuilding the buttons only when they change', function () {
        const container = document.createElement('div');
        const view = new PropertyView(container, () => {});
        let page = 0;
        const model = () => [{
            key: 's',
            title: 'S',
            rows: [{
                key: 'pager',
                label: 'showing',
                value: {
                    text: `page ${page}`,
                    actions: [
                        { text: '‹', disabled: page === 0, run: () => page-- },
                        { text: '›', disabled: page === 2, run: () => page++ }
                    ]
                }
            }]
        }];
        view.setSubject({}, model);
        const buttons = () => [...container.querySelectorAll('.pci-action')];
        expect(buttons().map(b => b.disabled)).to.deep.equal([true, false]);

        buttons()[1].click();
        expect(container.querySelector('.pci-value').textContent).to.equal('page 1');
        expect(buttons().map(b => b.disabled)).to.deep.equal([false, false]);
        const kept = buttons()[1];
        view.refresh();
        expect(buttons()[1]).to.equal(kept);
        kept.click();
        expect(buttons().map(b => b.disabled)).to.deep.equal([false, true]);
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
