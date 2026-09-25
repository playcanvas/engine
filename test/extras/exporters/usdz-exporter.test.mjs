import { expect } from 'chai';
import { strFromU8, unzipSync } from 'fflate';

import { Mat3 } from '../../../src/core/math/mat3.js';
import { Mat4 } from '../../../src/core/math/mat4.js';
import { Vec3 } from '../../../src/core/math/vec3.js';
import { UsdzExporter } from '../../../src/extras/exporters/usdz-exporter.js';
import { Entity } from '../../../src/framework/entity.js';
import {
    SEMANTIC_BLENDINDICES, SEMANTIC_BLENDWEIGHT, TYPE_FLOAT32, TYPE_UINT8
} from '../../../src/platform/graphics/constants.js';
import { StandardMaterial } from '../../../src/scene/materials/standard-material.js';
import { MeshInstance } from '../../../src/scene/mesh-instance.js';
import { Mesh } from '../../../src/scene/mesh.js';
import { Skin } from '../../../src/scene/skin.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

// a 1 x 2 quad standing on the ground and facing +z
const POSITIONS = [0, 0, 0, 1, 0, 0, 1, 2, 0, 0, 2, 0];
const NORMALS = [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1];

// each vertex fully weighted to the first bone
const WEIGHTS = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];

const numbers = text => text.split(/[\s,()]+/).filter(Boolean).map(Number);

const toVec3s = (values) => {
    const result = [];
    for (let i = 0; i < values.length; i += 3) {
        result.push(new Vec3(values[i], values[i + 1], values[i + 2]));
    }
    return result;
};

const expectVec3s = (actual, expected) => {
    expect(actual).to.have.lengthOf(expected.length);
    actual.forEach((v, i) => {
        expect(v.distance(expected[i]), `vertex ${i}: ${v} vs ${expected[i]}`).to.be.below(1e-5);
    });
};

describe('UsdzExporter', function () {

    let app;
    let material;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
        material = new StandardMaterial();
    });

    afterEach(function () {
        app?.destroy();
        app = null;
        jsdomTeardown();
    });

    const createMesh = ({ bones, weights = WEIGHTS, weightType = TYPE_FLOAT32 } = {}) => {
        const mesh = new Mesh(app.graphicsDevice);
        mesh.setPositions(POSITIONS);
        mesh.setNormals(NORMALS);
        if (bones) {
            const indices = [0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0];
            mesh.setVertexStream(SEMANTIC_BLENDINDICES, indices, 4, 4, TYPE_UINT8);
            mesh.setVertexStream(SEMANTIC_BLENDWEIGHT, weights, 4, 4, weightType,
                weightType !== TYPE_FLOAT32);

            // bind the mesh to the bones where they are now
            const inverseBindPose = bones.map(bone => bone.getWorldTransform().clone().invert());
            mesh.skin = new Skin(app.graphicsDevice, inverseBindPose, bones.map(bone => bone.name));
        }
        mesh.setIndices([0, 1, 2, 0, 2, 3]);
        mesh.update();
        return mesh;
    };

    const addRender = (parent, name, mesh, rootBone = null) => {
        const entity = new Entity(name);
        parent.addChild(entity);
        entity.addComponent('render', {
            meshInstances: [new MeshInstance(mesh, material)],
            rootBone
        });
        return entity;
    };

    // exports the entity and returns the Xforms of the root file by name, with their mesh points
    // and normals moved to world space
    const exportScene = async (entity) => {
        const files = unzipSync(new Uint8Array(await new UsdzExporter().build(entity)));
        const root = strFromU8(files['root.usda']);

        const xforms = {};
        for (const xform of root.split('def Xform ').slice(1)) {
            const name = /^"(\w+)"/.exec(xform)[1];
            const fileName = /@\.\/(\S+)@</.exec(xform)[1];
            const transform = new Mat4().set(numbers(/xformOp:transform = (.*)/.exec(xform)[1]));
            const normalMatrix = new Mat3().invertMat4(transform).transpose();
            const mesh = strFromU8(files[fileName]);
            const points = toVec3s(numbers(/point3f\[\] points = \[(.*)\]/.exec(mesh)[1]));
            const normals = toVec3s(numbers(/normal3f\[\] normals = \[(.*)\]/.exec(mesh)[1]));
            xforms[name] = {
                fileName,
                transform,
                points: points.map(p => transform.transformPoint(p)),
                normals: normals.map(n => normalMatrix.transformVector(n).normalize())
            };
        }
        return xforms;
    };

    it('places a skinned mesh by its bones, not by the node it is on', async function () {
        // an FBX style rig: the armature turns and shrinks the mesh node, and the inverse bind
        // matrices undo it, so the mesh renders upright and at full size
        const armature = new Entity('Armature');
        armature.setLocalEulerAngles(90, 0, 0);
        armature.setLocalScale(0.01, 0.01, 0.01);
        const hips = new Entity('Hips');
        armature.addChild(hips);
        app.root.addChild(armature);
        addRender(armature, 'Body', createMesh({ bones: [hips] }), armature);

        const { Body } = await exportScene(armature);

        expectVec3s(Body.points, toVec3s(POSITIONS));
        expectVec3s(Body.normals, toVec3s(NORMALS));
    });

    it('exports a skinned mesh in the current pose of its bones', async function () {
        const hips = new Entity('Hips');
        app.root.addChild(hips);
        addRender(app.root, 'Body', createMesh({ bones: [hips] }), app.root);

        hips.setLocalPosition(0, 1, 0);
        hips.setLocalEulerAngles(0, 90, 0);

        const { Body } = await exportScene(app.root);

        expectVec3s(Body.points, [
            new Vec3(0, 1, 0), new Vec3(0, 1, -1), new Vec3(0, 3, -1), new Vec3(0, 3, 0)
        ]);
        expectVec3s(Body.normals, toVec3s(NORMALS).map(() => new Vec3(1, 0, 0)));
    });

    [
        { title: 'float', weightType: TYPE_FLOAT32, full: 1, half: 0.5 },
        { title: 'normalized integer', weightType: TYPE_UINT8, full: 255, half: 128 }
    ].forEach(({ title, weightType, full, half }) => {
        it(`blends the bones of a skinned mesh by ${title} weights`, async function () {
            const hips = new Entity('Hips');
            const head = new Entity('Head');
            app.root.addChild(hips);
            app.root.addChild(head);

            // the bottom vertices follow the hips, the top ones are shared with the head
            const weights = [
                full, 0, 0, 0, full, 0, 0, 0, half, half, 0, 0, half, half, 0, 0
            ];
            const mesh = createMesh({ bones: [hips, head], weights, weightType });
            addRender(app.root, 'Body', mesh, app.root);

            head.setLocalPosition(0, 1, 0);

            const { Body } = await exportScene(app.root);

            expectVec3s(Body.points, [
                new Vec3(0, 0, 0), new Vec3(1, 0, 0), new Vec3(1, 2.5, 0), new Vec3(0, 2.5, 0)
            ]);
        });
    });

    it('exports each skinned instance of a mesh in its own pose', async function () {
        const left = new Entity('Left');
        const right = new Entity('Right');
        app.root.addChild(left);
        app.root.addChild(right);

        const leftHips = new Entity('Hips');
        const rightHips = new Entity('Hips');
        left.addChild(leftHips);
        right.addChild(rightHips);

        const mesh = createMesh({ bones: [leftHips] });
        addRender(left, 'Body', mesh, left);
        addRender(right, 'Body', mesh, right);

        rightHips.setLocalPosition(5, 0, 0);

        const xforms = Object.values(await exportScene(app.root));

        expect(xforms).to.have.lengthOf(2);
        expect(xforms[0].fileName).to.not.equal(xforms[1].fileName);
        expectVec3s(xforms[0].points, toVec3s(POSITIONS));
        expectVec3s(xforms[1].points, toVec3s(POSITIONS).map(p => p.add(new Vec3(5, 0, 0))));
    });

    it('places an unskinned mesh by its node and shares its mesh file', async function () {
        const mesh = createMesh();
        addRender(app.root, 'A', mesh).setLocalPosition(1, 2, 3);
        addRender(app.root, 'B', mesh).setLocalScale(2, 2, 2);

        const { A, B } = await exportScene(app.root);

        expect(A.fileName).to.equal(B.fileName);
        expect(A.transform.data).to.deep.equal(new Mat4().setTranslate(1, 2, 3).data);
        expect(B.transform.data).to.deep.equal(new Mat4().setScale(2, 2, 2).data);
    });
});
