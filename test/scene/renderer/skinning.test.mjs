import { expect } from 'chai';
import sinon from 'sinon';

import { Mat4 } from '../../../src/core/math/mat4.js';
import { Vec3 } from '../../../src/core/math/vec3.js';
import { BoundingBox } from '../../../src/core/shape/bounding-box.js';
import { Asset } from '../../../src/framework/asset/asset.js';
import { Entity } from '../../../src/framework/entity.js';
import { GlbContainerResource } from '../../../src/framework/parsers/glb-container-resource.js';
import { GlbParser } from '../../../src/framework/parsers/glb-parser.js';
import {
    FRONTFACE_CCW, FRONTFACE_CW, SEMANTIC_BLENDINDICES, SEMANTIC_BLENDWEIGHT, TYPE_UINT8
} from '../../../src/platform/graphics/constants.js';
import { StandardMaterial } from '../../../src/scene/materials/standard-material.js';
import { MeshInstance } from '../../../src/scene/mesh-instance.js';
import { Mesh } from '../../../src/scene/mesh.js';
import { Skin } from '../../../src/scene/skin.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

const POSITIONS = [0, 0, 0, 1, 0, 0, 0, 1, 0];

const expectArray = (actual, expected) => {
    expect(actual.length).to.equal(expected.length);
    actual.forEach((value, i) => expect(value, `element ${i}`).to.be.closeTo(expected[i], 1e-5));
};

describe('Shared skin rendering', function () {
    let app;
    let root;
    let bone;
    let meshInstances;
    let skin;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();

        root = new Entity('skeleton');
        root.setLocalPosition(3, 2, 0);
        root.setLocalEulerAngles(0, 0, 20);
        root.setLocalScale(2, 1, 1);
        app.root.addChild(root);
        bone = new Entity('bone');
        root.addChild(bone);

        const mesh = new Mesh(app.graphicsDevice);
        mesh.setPositions(POSITIONS);
        mesh.setNormals([0, 0, 1, 0, 0, 1, 0, 0, 1]);
        mesh.setVertexStream(SEMANTIC_BLENDINDICES, new Uint8Array(12), 4, 3, TYPE_UINT8);
        mesh.setVertexStream(SEMANTIC_BLENDWEIGHT, [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4);
        mesh.skin = new Skin(app.graphicsDevice, [bone.getWorldTransform().clone().invert()], ['bone']);
        mesh.update();

        const material = new StandardMaterial();
        material.update();
        meshInstances = [0, 1].map((i) => {
            const entity = new Entity(`part${i}`);
            app.root.addChild(entity);
            entity.setLocalPosition(i ? -8 : 9, 0, 0);
            entity.setLocalEulerAngles(0, 0, i ? -45 : 30);
            entity.setLocalScale(i ? 0.5 : 3, 2, 1);
            entity.addComponent('render', { meshInstances: [new MeshInstance(mesh, material)], rootBone: root });
            return entity.render.meshInstances[0];
        });
        skin = meshInstances[0].skinInstance;
        expect(meshInstances[1].skinInstance).to.equal(skin);

        // animate after binding, so the expected world-space result is not the identity
        bone.setLocalPosition(1, 2, 0);
        bone.setLocalEulerAngles(0, 0, 35);
        app.root.syncHierarchy();

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
        skin.rootBone = root;
        app.destroy();
        jsdomTeardown();
    });

    const expectedWorld = () => new Mat4().mul2(bone.getWorldTransform(), skin.skin.inverseBindPose[0]);

    const expectWorld = (meshInstance) => {
        app.renderer.setMeshInstanceMatrices(meshInstance, true);
        const model = new Mat4().set(app.renderer.modelMatrixId.value);
        expectArray(new Mat4().mul2(model, skin.matrices[0]).data, expectedWorld().data);
    };

    it('renders every part in the same frame regardless of update order', function () {
        const upload = sinon.spy(skin, 'uploadBones');
        for (const order of [meshInstances, meshInstances.slice().reverse(), [meshInstances[1]]]) {
            app.renderer.updateCpuSkinMatrices(order);
            app.renderer.updateGpuSkinMatrices(order);
            meshInstances.forEach(expectWorld);
        }
        expect(upload.callCount).to.equal(3);
    });

    it('keeps the palette local to the skeleton and uploads its normal matrix', function () {
        app.renderer.updateCpuSkinMatrices(meshInstances);
        const expected = new Mat4().mul2(root.getWorldTransform().clone().invert(), expectedWorld());
        expectArray(skin.matrices[0].data, expected.data);
        for (const mi of meshInstances) {
            app.renderer.setMeshInstanceMatrices(mi, true);
            expectArray(app.renderer.normalMatrixId.value, root.normalMatrix.data);
        }
    });

    it('bounds the animated vertices of every part in world space', function () {
        app.renderer.updateCpuSkinMatrices(meshInstances);
        const points = [];
        const world = expectedWorld();
        for (let i = 0; i < POSITIONS.length; i += 3) {
            const point = world.transformPoint(new Vec3(...POSITIONS.slice(i, i + 3)));
            points.push(point.x, point.y, point.z);
        }
        const expectedCenter = world.transformPoint(new Vec3(0.5, 0.5, 0));
        for (const mi of meshInstances) {
            const bounds = mi.aabb;
            for (let i = 0; i < points.length; i += 3) {
                const offset = new Vec3(...points.slice(i, i + 3)).sub(bounds.center);
                expect(Math.abs(offset.x)).to.be.at.most(bounds.halfExtents.x + 1e-5);
                expect(Math.abs(offset.y)).to.be.at.most(bounds.halfExtents.y + 1e-5);
                expect(Math.abs(offset.z)).to.be.at.most(bounds.halfExtents.z + 1e-5);
            }
            expectArray(bounds.center.toArray(), expectedCenter.toArray());
        }
    });

    it('updates the palette after culling when custom bounds skip the CPU update', function () {
        meshInstances.forEach(mi => mi.setCustomAabb(new BoundingBox()));
        expect(skin._updateBeforeCull).to.equal(false);
        app.renderer.updateCpuSkinMatrices(meshInstances);
        app.renderer.updateGpuSkinMatrices(meshInstances.slice().reverse());
        meshInstances.forEach(expectWorld);
    });

    it('preserves explicitly supplied bounds in mesh-node space', function () {
        const local = new BoundingBox(new Vec3(1, 2, 3), new Vec3(4, 5, 6));
        for (const mi of meshInstances) {
            mi.setCustomAabb(local);
            const expected = new BoundingBox();
            expected.setFromTransformedAabb(local, mi.node.getWorldTransform());
            expectArray(mi.aabb.center.toArray(), expected.center.toArray());
            expectArray(mi.aabb.halfExtents.toArray(), expected.halfExtents.toArray());
        }
    });

    it('uses the skeleton reflection for front-face winding', function () {
        const frontFace = sinon.spy(app.graphicsDevice, 'setFrontFace');
        meshInstances[0].node.setLocalScale(-1, 1, 1);
        app.root.syncHierarchy();
        app.renderer.setupCullModeAndFrontFace(true, 1, meshInstances[0]);
        expect(frontFace.lastCall.args[0]).to.equal(FRONTFACE_CCW);
        root.setLocalScale(-2, 1, 1);
        app.root.syncHierarchy();
        app.renderer.setupCullModeAndFrontFace(true, 1, meshInstances[1]);
        expect(frontFace.lastCall.args[0]).to.equal(FRONTFACE_CW);
    });

    it('retains the node frame for legacy skins without a root bone', function () {
        skin.rootBone = null;
        app.renderer.updateCpuSkinMatrices([meshInstances[0]]);
        app.renderer.updateGpuSkinMatrices([meshInstances[0]]);
        expectWorld(meshInstances[0]);
        app.renderer.setMeshInstanceMatrices(meshInstances[0], true);
        expectArray(app.renderer.normalMatrixId.value, meshInstances[0].node.normalMatrix.data);
        skin.rootBone = root;
    });

    it('allows explicit node-relative palettes for vertex animation baking', function () {
        const node = meshInstances[0].node;
        skin.updateMatrixPalette(node, 100000);
        expectArray(new Mat4().mul2(node.getWorldTransform(), skin.matrices[0]).data, expectedWorld().data);
    });

    it('draws forward and shadow passes with the shared frame after hiding a part', function () {
        const matrices = sinon.spy(app.renderer, 'setMeshInstanceMatrices');
        const storage = app.graphicsDevice.meshInstanceStorage;
        const writes = storage && sinon.spy(storage, 'write');
        for (const hidden of [false, true]) {
            meshInstances[0].visible = !hidden;
            app.render();
            expect(matrices.getCalls().some(call => call.args[1] === true)).to.equal(true);
            expect(matrices.getCalls().some(call => call.args[1] !== true)).to.equal(true);
            expect(meshInstances[1].visibleThisFrame).to.equal(true);
            meshInstances.forEach(expectWorld);
        }
        if (app.graphicsDevice.isWebGPU) {
            for (const mi of meshInstances) {
                const write = writes.getCalls().find(call => call.args[0] === mi.storageSlot);
                expect(write, mi.node.name).to.exist;
                expectArray(write.args[1], root.worldTransform.data);
                expectArray(write.args[2], root.normalMatrix.data);
            }
            writes.resetHistory();
            const shader = Array.from(meshInstances[1]._shaderCache.values())[0].shader;
            const replacement = new Entity('replacement');
            replacement.setLocalPosition(-5, 4, 0);
            app.root.addChild(replacement);
            replacement.getWorldTransform();
            // different nodes can have the same transform version
            replacement._aabbVer = root._aabbVer;
            skin.rootBone = replacement;
            app.renderer.updateStorageSlot(meshInstances[1], shader);
            expect(writes.callCount).to.equal(1);
            expectArray(writes.lastCall.args[1], replacement.worldTransform.data);
            expectArray(writes.lastCall.args[2], replacement.normalMatrix.data);
            app.renderer.updateStorageSlot(meshInstances[1], shader);
            expect(writes.callCount).to.equal(1);
            skin.rootBone = root;
            const mi = meshInstances[1];
            mi.skinInstance = null;
            app.renderer.updateStorageSlot(mi, shader);
            expect(writes.callCount).to.equal(2);
            expectArray(writes.lastCall.args[1], mi.node.worldTransform.data);
            expectArray(writes.lastCall.args[2], mi.node.normalMatrix.data);
            mi.skinInstance = skin;
        }
    });

    it('loads a glTF skin shared by differently transformed mesh nodes', async function () {
        // A self-contained glTF with one joint and two instances of the same skinned triangle.
        const views = [
            new Float32Array(POSITIONS),
            new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
            new Uint8Array(12),
            new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]),
            new Mat4().setTranslate(-0.25, 0, 0).data
        ];
        const buffer = new Uint8Array(views.reduce((size, view) => size + view.byteLength, 0));
        let byteOffset = 0;
        const bufferViews = views.map((view) => {
            const result = { buffer: 0, byteOffset, byteLength: view.byteLength };
            buffer.set(new Uint8Array(view.buffer, view.byteOffset, view.byteLength), byteOffset);
            byteOffset += view.byteLength;
            return result;
        });
        const gltf = {
            asset: { version: '2.0' },
            scene: 0,
            scenes: [{ nodes: [0] }],
            nodes: [
                { name: 'rig', children: [1, 2, 3] },
                { name: 'joint', translation: [0.25, 0, 0] },
                { name: 'left', mesh: 0, skin: 0, translation: [10, 0, 0] },
                { name: 'right', mesh: 0, skin: 0, translation: [-10, 0, 0], scale: [2, 1, 1] }
            ],
            skins: [{ joints: [1], inverseBindMatrices: 4 }],
            meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1, JOINTS_0: 2, WEIGHTS_0: 3 } }] }],
            buffers: [{ byteLength: buffer.byteLength, uri: `data:application/octet-stream;base64,${Buffer.from(buffer).toString('base64')}` }],
            bufferViews,
            accessors: [
                { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] },
                { bufferView: 1, componentType: 5126, count: 3, type: 'VEC3' },
                { bufferView: 2, componentType: 5121, count: 3, type: 'VEC4' },
                { bufferView: 3, componentType: 5126, count: 3, type: 'VEC4' },
                { bufferView: 4, componentType: 5126, count: 1, type: 'MAT4' }
            ]
        };
        const data = new TextEncoder().encode(JSON.stringify(gltf));
        const parsed = await new Promise((resolve, reject) => {
            GlbParser.parse('shared-skin.gltf', '', data, app.graphicsDevice, app.assets, {}, [], (err, result) => {
                if (err) reject(err);
                else resolve(result);
            });
        });
        const resource = new GlbContainerResource(parsed, new Asset('rig', 'container'), app.assets, GlbParser.createDefaultMaterial());
        const entity = resource.instantiateRenderEntity();
        app.root.addChild(entity);
        entity.setLocalPosition(3, 2, 0);
        entity.setLocalEulerAngles(0, 0, 20);
        entity.setLocalScale(2, 1, 1);
        const joint = entity.findByName('joint');
        joint.setLocalPosition(1, 2, 0);
        joint.setLocalEulerAngles(0, 0, 35);
        const instances = entity.findComponents('render').flatMap(render => render.meshInstances);
        expect(instances).to.have.lengthOf(2);
        expect(instances[0].skinInstance).to.equal(instances[1].skinInstance);

        app.render();
        const world = new Mat4().mul2(joint.getWorldTransform(), new Mat4().setTranslate(-0.25, 0, 0));
        for (const mi of instances) {
            expect(mi.visibleThisFrame).to.equal(true);
            app.renderer.setMeshInstanceMatrices(mi);
            const model = new Mat4().set(app.renderer.modelMatrixId.value);
            expectArray(new Mat4().mul2(model, mi.skinInstance.matrices[0]).data, world.data);
        }
    });
});
