import { expect } from 'chai';
import sinon from 'sinon';

import { Vec2 } from '../../../src/core/math/vec2.js';
import { Vec4 } from '../../../src/core/math/vec4.js';
import { Entity } from '../../../src/framework/entity.js';
import { UNUSED_UNIFORM_NAME } from '../../../src/platform/graphics/constants.js';
import { Texture } from '../../../src/platform/graphics/texture.js';
import { VertexBuffer } from '../../../src/platform/graphics/vertex-buffer.js';
import { VertexFormat } from '../../../src/platform/graphics/vertex-format.js';
import { Layer } from '../../../src/scene/layer.js';
import { StandardMaterial } from '../../../src/scene/materials/standard-material.js';
import { Sprite } from '../../../src/scene/sprite.js';
import { TextureAtlas } from '../../../src/scene/texture-atlas.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

// On WebGPU the vertex shaders read the model and normal matrices of a mesh instance from the mesh
// data storage of the device, in a slot passed as the first instance of the draw, instead of from a
// per draw uniform buffer. Under `npm run test:webgpu` the writes to the GPU buffers are recorded
// into a copy of each, as the null backend of Dawn does not keep their content.
describe('Mesh instance storage', function () {

    let app;

    /** @type {Map<object, Float32Array>} */
    let gpuCopies;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();

        gpuCopies = new Map();
        const device = app.graphicsDevice;
        if (device.isWebGPU) {
            sinon.stub(device, 'writeStorageBuffer').callsFake((buffer, bufferOffset, data, dataOffset, size) => {
                let copy = gpuCopies.get(buffer);
                if (!copy) {
                    copy = new Float32Array(device.meshInstanceStorage.capacity * 28);
                    gpuCopies.set(buffer, copy);
                }
                copy.set(data.subarray(dataOffset, dataOffset + size), bufferOffset / 4);
            });
        }

        const camera = new Entity('camera');
        camera.addComponent('camera');
        camera.setPosition(0, 0, 60);
        app.root.addChild(camera);

        const light = new Entity('light');
        light.addComponent('light', { type: 'directional', castShadows: true });
        light.setEulerAngles(45, 30, 0);
        app.root.addChild(light);
    });

    afterEach(function () {
        sinon.restore();
        app.destroy();
        jsdomTeardown();
    });

    const material = () => {
        const m = new StandardMaterial();
        m.update();
        return m;
    };

    const addBoxes = (count, mat) => {
        const boxes = [];
        for (let i = 0; i < count; i++) {
            const entity = new Entity(`box${i}`);
            entity.addComponent('render', { type: 'box', material: mat });
            entity.setPosition(((i % 40) - 20) * 0.5, (Math.floor(i / 40) - 15) * 0.5, 0);
            entity.setEulerAngles(i, 2 * i, 0);
            entity.setLocalScale(0.5, 0.5 + (i % 3) * 0.25, 0.5);
            app.root.addChild(entity);
            boxes.push(entity);
        }
        return boxes;
    };

    const shadersOf = meshInstance => Array.from(meshInstance._shaderCache.values()).map(instance => instance.shader);

    // the slot data of each mesh instance in the GPU buffer, once the device submitted the frame
    const readSlots = (meshInstances) => {
        const meshInstanceStorage = app.graphicsDevice.meshInstanceStorage;
        app.graphicsDevice.submit();
        const data = gpuCopies.get(meshInstanceStorage.buffer.impl);
        expect(data, 'no writes to the current buffer').to.exist;
        return meshInstances.map((meshInstance) => {
            const o = meshInstance.storageSlot * 28;
            return data.slice(o, o + 28);
        });
    };

    // the slot data a mesh instance is expected to hold: the model matrix and the normal matrix
    // in three vec4 columns
    const expectedSlot = (node) => {
        const model = node.getWorldTransform().data;
        const normal = node.normalMatrix.data;
        const slot = new Float32Array(28);
        slot.set(model);
        for (let c = 0; c < 3; c++) {
            for (let r = 0; r < 3; r++) {
                slot[16 + c * 4 + r] = normal[c * 3 + r];
            }
        }
        return slot;
    };

    const expectSlots = (meshInstances) => {
        const slots = readSlots(meshInstances);
        meshInstances.forEach((meshInstance, i) => {
            const expected = expectedSlot(meshInstance.node);
            for (const j of [0, 1, 2, 4, 5, 6, 8, 9, 10, 12, 13, 14, 16, 17, 18, 20, 21, 22, 24, 25, 26]) {
                expect(slots[i][j]).to.be.closeTo(expected[j], 1e-5, `${meshInstance.node.name} [${j}]`);
            }
        });
    };

    it('is supported on WebGPU only', function () {
        const device = app.graphicsDevice;
        expect(device.supportsMeshInstanceStorage).to.equal(device.isWebGPU);
        expect(!!device.meshInstanceStorage).to.equal(device.isWebGPU);
    });

    it('draws the forward and the shadow passes with the matrices in the storage and an empty mesh uniform buffer', function () {
        if (!app.graphicsDevice.isWebGPU) this.skip();

        const [box] = addBoxes(1, material());
        app.render();

        const meshInstance = box.render.meshInstances[0];
        const shaders = shadersOf(meshInstance);
        expect(shaders.map(shader => shader.label).some(label => label.includes('ShadowPass'))).to.equal(true);
        for (const shader of shaders) {
            expect(shader.usesMeshInstanceStorage, shader.label).to.equal(true);
            expect(shader.meshUniformBufferEmpty, shader.label).to.equal(true);
            expect(shader.meshUniformBufferFormat.uniforms.map(uniform => uniform.name)).to.deep.equal([UNUSED_UNIFORM_NAME]);
            expect(shader.viewBindGroupFormat.storageBufferFormats.map(format => format.name)).to.deep.equal(['meshInstanceStorage']);
        }
        expect(meshInstance.storageSlot).to.be.at.least(0);
    });

    it('grows the storage, and uploads the matrices of the nodes, and again when they move', function () {
        if (!app.graphicsDevice.isWebGPU) this.skip();

        const meshInstanceStorage = app.graphicsDevice.meshInstanceStorage;
        const capacity = meshInstanceStorage.capacity;
        const version = meshInstanceStorage.version;

        const boxes = addBoxes(capacity + 100, material());
        const meshInstances = boxes.map(box => box.render.meshInstances[0]);
        app.render();

        expect(meshInstanceStorage.capacity).to.be.above(capacity);
        expect(meshInstanceStorage.version).to.be.above(version);
        expect(new Set(meshInstances.map(mi => mi.storageSlot)).size).to.equal(meshInstances.length);
        expectSlots(meshInstances);

        // move every third box, the others keep their data
        boxes.forEach((box, i) => {
            if (i % 3 === 0) {
                box.translate(0, 0, -1);
                box.rotate(10, 0, 0);
            }
        });
        app.render();
        expectSlots(meshInstances);
    });

    it('keeps the slots across a device loss, and uploads them all to the recreated buffer', function () {
        if (!app.graphicsDevice.isWebGPU) this.skip();

        const device = app.graphicsDevice;
        const boxes = addBoxes(20, material());
        const meshInstances = boxes.map(box => box.render.meshInstances[0]);
        app.render();

        const meshInstanceStorage = device.meshInstanceStorage;
        const count = meshInstanceStorage.count;
        const slots = meshInstances.map(mi => mi.storageSlot);

        // the sequence of a device loss and its recovery, on the same native device: the device
        // resources are released, created again by postInit, and the buffers restored
        device.loseContext();
        device.postInit();
        gpuCopies.clear();
        device.restoreContext();

        expect(device.meshInstanceStorage).to.equal(meshInstanceStorage);
        expect(meshInstanceStorage.count).to.equal(count);
        expect(meshInstances.map(mi => mi.storageSlot)).to.deep.equal(slots);

        // uploaded without a draw
        expectSlots(meshInstances);
    });

    it('writes the matrices of a new node given to a mesh instance, at the same transform version', function () {
        if (!app.graphicsDevice.isWebGPU) this.skip();

        const [box, other] = addBoxes(2, material());
        app.render();

        // a node of the same transform version, which the slot does not tell apart
        const meshInstance = box.render.meshInstances[0];
        const node = new Entity('node');
        node.setPosition(3, 2, 1);
        app.root.addChild(node);
        node.getWorldTransform();
        node._aabbVer = meshInstance.node._aabbVer;

        meshInstance.node = node;
        app.render();
        expectSlots([meshInstance, other.render.meshInstances[0]]);
    });

    it('releases the slot of a mesh instance losing its mesh, and gives it a new one when drawn with a mesh', function () {
        if (!app.graphicsDevice.isWebGPU) this.skip();

        const mat = material();
        const [box] = addBoxes(1, mat);
        app.render();

        const meshInstanceStorage = app.graphicsDevice.meshInstanceStorage;
        const meshInstance = box.render.meshInstances[0];
        const mesh = meshInstance.mesh;
        const slot = meshInstance.storageSlot;
        expect(slot).to.be.at.least(0);

        // hidden while it has no mesh, as a mesh instance without one cannot be culled
        meshInstance.mesh = null;
        meshInstance.visible = false;
        expect(meshInstance.storageSlot).to.equal(-1);

        // the released slot is the next one allocated, once the frame using it was submitted
        app.render();
        const [other] = addBoxes(1, mat);
        app.render();
        expect(other.render.meshInstances[0].storageSlot).to.equal(slot);

        meshInstance.mesh = mesh;
        meshInstance.visible = true;
        app.render();
        expect(meshInstance.storageSlot).to.be.at.least(0);
        expect(meshInstance.storageSlot).not.to.equal(slot);
        expectSlots([meshInstance, other.render.meshInstances[0]]);

        // destroying it releases its slot once
        const count = meshInstanceStorage.count;
        const released = meshInstance.storageSlot;
        box.destroy();
        app.render();
        expect(meshInstanceStorage.allocate()).to.equal(released);
        expect(meshInstanceStorage.count).to.equal(count);
    });

    it('releases the slot of a removed sprite, for the next sprite to reuse', function () {
        if (!app.graphicsDevice.isWebGPU) this.skip();

        const atlas = new TextureAtlas();
        atlas.texture = new Texture(app.graphicsDevice, { width: 4, height: 4 });
        atlas.frames = { 0: { rect: new Vec4(0, 0, 4, 4), pivot: new Vec2(0.5, 0.5), border: new Vec4() } };
        const sprite = new Sprite(app.graphicsDevice, { atlas, frameKeys: ['0'], pixelsPerUnit: 1 });

        const addSprite = () => {
            const entity = new Entity('sprite');
            entity.addComponent('sprite', { type: 'simple', sprite });
            app.root.addChild(entity);
            return entity;
        };

        const first = addSprite();
        app.render();
        const slot = first.sprite._meshInstance.storageSlot;
        expect(slot).to.be.at.least(0);

        // removing the component drops its mesh instance without destroying it
        first.removeComponent('sprite');
        app.render();

        const second = addSprite();
        app.render();
        expect(second.sprite._meshInstance.storageSlot).to.equal(slot);
    });

    it('keeps a slot released during a frame for the draws recorded before, until the frame is submitted', function () {
        if (!app.graphicsDevice.isWebGPU) this.skip();

        // a layer rendered after the world layer
        const lateLayer = new Layer({ name: 'Late' });
        app.scene.layers.push(lateLayer);
        const camera = app.root.findByName('camera');
        camera.camera.layers = camera.camera.layers.concat(lateLayer.id);

        const mat = material();
        const [early] = addBoxes(1, mat);
        app.render();

        const earlyMeshInstance = early.render.meshInstances[0];
        const slot = earlyMeshInstance.storageSlot;
        const expected = expectedSlot(earlyMeshInstance.node);

        // a box first drawn in the late layer, after the early box loses its mesh in the same frame
        const late = new Entity('late');
        late.addComponent('render', { type: 'box', material: mat, layers: [lateLayer.id] });
        late.setPosition(-3, 1, 0);
        app.root.addChild(late);

        app.scene.on('postrender:layer', (cameraComponent, layer, transparent) => {
            if (layer.name === 'World' && !transparent && earlyMeshInstance.mesh) {
                earlyMeshInstance.mesh = null;
                earlyMeshInstance.visible = false;
            }
        });
        app.render();

        const lateMeshInstance = late.render.meshInstances[0];
        expect(lateMeshInstance.storageSlot).to.be.at.least(0);
        expect(lateMeshInstance.storageSlot).not.to.equal(slot);

        // the draw of the early box reads its own matrix, the late box its own
        expectSlots([lateMeshInstance]);
        const data = gpuCopies.get(app.graphicsDevice.meshInstanceStorage.buffer.impl);
        const uploaded = data.slice(slot * 28, slot * 28 + 16);
        for (let i = 0; i < 16; i++) {
            expect(uploaded[i]).to.be.closeTo(expected[i], 1e-5);
        }
    });

    it('reuses the slots of destroyed mesh instances', function () {
        if (!app.graphicsDevice.isWebGPU) this.skip();

        const mat = material();
        const boxes = addBoxes(10, mat);
        app.render();

        const meshInstanceStorage = app.graphicsDevice.meshInstanceStorage;
        const count = meshInstanceStorage.count;
        const freed = boxes.slice(0, 4).map(box => box.render.meshInstances[0].storageSlot);
        boxes.slice(0, 4).forEach(box => box.destroy());
        app.render();

        const added = addBoxes(4, mat);
        app.render();

        expect(meshInstanceStorage.count).to.equal(count);
        expect(added.map(box => box.render.meshInstances[0].storageSlot).sort()).to.deep.equal(freed.sort());
    });

    it('keeps the uniforms for instancing and draw commands, which use the instance index themselves', function () {
        if (!app.graphicsDevice.isWebGPU) this.skip();

        const device = app.graphicsDevice;
        const mat = material();
        const [instanced, multiDraw, attributeless] = addBoxes(3, mat);

        const instancedMeshInstance = instanced.render.meshInstances[0];
        const matrices = new Float32Array(2 * 16);
        matrices.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
        matrices.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 2, 0, 0, 1], 16);
        const vertexBuffer = new VertexBuffer(device, VertexFormat.getDefaultInstancingFormat(device), 2, { data: matrices });
        instancedMeshInstance.setInstancing(vertexBuffer);

        const multiDrawMeshInstance = multiDraw.render.meshInstances[0];
        const cmd = multiDrawMeshInstance.setMultiDraw(null, 1);
        cmd.add(0, multiDrawMeshInstance.mesh.primitive[0].count, 1, 0);
        cmd.update(1);

        // instancing without a vertex buffer, whose shaders index the instance data by the instance
        // index
        const attributelessMeshInstance = attributeless.render.meshInstances[0];
        attributelessMeshInstance.setInstancing(true);
        attributelessMeshInstance.instancingCount = 2;

        app.render();

        for (const meshInstance of [instancedMeshInstance, multiDrawMeshInstance, attributelessMeshInstance]) {
            const shaders = shadersOf(meshInstance);
            expect(shaders.length).to.be.above(0);
            for (const shader of shaders) {
                expect(shader.usesMeshInstanceStorage, shader.label).to.equal(false);
                expect(shader.meshUniformBufferFormat.get('matrix_model'), shader.label).to.exist;
            }
            expect(meshInstance.storageSlot).to.equal(-1);
        }

        // without the draw commands the mesh instance reads the storage again
        multiDrawMeshInstance.setMultiDraw(null, 0);
        app.render();
        expect(shadersOf(multiDrawMeshInstance).every(shader => shader.usesMeshInstanceStorage)).to.equal(true);
    });
});
