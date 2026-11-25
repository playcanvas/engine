import { expect } from 'chai';

import { Mat4 } from '../../src/core/math/mat4.js';
import { Vec3 } from '../../src/core/math/vec3.js';
import { BoundingBox } from '../../src/core/shape/bounding-box.js';
import { BoxGeometry } from '../../src/scene/geometry/box-geometry.js';
import { GraphNode } from '../../src/scene/graph-node.js';
import { ShaderMaterial } from '../../src/scene/materials/shader-material.js';
import { MeshInstance } from '../../src/scene/mesh-instance.js';
import { Mesh } from '../../src/scene/mesh.js';
import { createGraphicsDevice } from '../device.mjs';

// The world space bounding box of a mesh instance is cached, and only evaluated again when one of
// its inputs changes: the node transform, the mesh bounds, the custom bounds, or - for a skinned
// mesh - the bone matrices, which the renderer updates once per frame.
describe('MeshInstance#aabb', function () {

    let device;
    let mesh;

    beforeEach(function () {
        device = createGraphicsDevice({ width: 1, height: 1 });
        mesh = Mesh.fromGeometry(device, new BoxGeometry());
    });

    afterEach(function () {
        mesh.destroy();
        device.destroy();
    });

    const nodeAt = (x) => {
        const node = new GraphNode();
        node.setPosition(x, 0, 0);
        node.getWorldTransform();
        return node;
    };

    // a skin instance with a single bone, whose matrix translates the bone bounds by x
    const createSkin = (x) => {
        const matrix = new Mat4().setTranslate(x, 0, 0);
        return { matrices: [matrix], _skinUpdateIndex: 0 };
    };

    // a skinned mesh instance, with the bone bounds of the mesh set up directly
    const createSkinned = (node, skinInstance) => {
        mesh.boneAabb = [new BoundingBox(new Vec3(), new Vec3(0.5, 0.5, 0.5))];
        mesh.boneUsed = [true];
        const meshInstance = new MeshInstance(mesh, new ShaderMaterial(), node);
        meshInstance.skinInstance = skinInstance;
        return meshInstance;
    };

    describe('skinned', function () {

        it('keeps the bounds while the bone matrices are not updated', function () {
            const skin = createSkin(1);
            const meshInstance = createSkinned(nodeAt(0), skin);
            expect(meshInstance.aabb.center.x).to.be.closeTo(1, 1e-6);

            // changing the matrices without a new skin update index does not evaluate the bounds
            skin.matrices[0].setTranslate(5, 0, 0);
            expect(meshInstance.aabb.center.x).to.be.closeTo(1, 1e-6);
        });

        it('updates the bounds when the bone matrices are updated', function () {
            const skin = createSkin(1);
            const meshInstance = createSkinned(nodeAt(0), skin);
            expect(meshInstance.aabb.center.x).to.be.closeTo(1, 1e-6);

            skin.matrices[0].setTranslate(5, 0, 0);
            skin._skinUpdateIndex++;
            expect(meshInstance.aabb.center.x).to.be.closeTo(5, 1e-6);
        });

        it('updates the bounds when the node moves', function () {
            const node = nodeAt(0);
            const meshInstance = createSkinned(node, createSkin(1));
            expect(meshInstance.aabb.center.x).to.be.closeTo(1, 1e-6);

            node.setPosition(10, 0, 0);
            expect(meshInstance.aabb.center.x).to.be.closeTo(11, 1e-6);
        });

        it('updates the bounds for a new skin instance with the same update index', function () {
            const meshInstance = createSkinned(nodeAt(0), createSkin(1));
            expect(meshInstance.aabb.center.x).to.be.closeTo(1, 1e-6);

            meshInstance.skinInstance = createSkin(7);
            expect(meshInstance.aabb.center.x).to.be.closeTo(7, 1e-6);
        });

        it('uses the custom bounds, ignoring bone matrix updates', function () {
            const skin = createSkin(1);
            const meshInstance = createSkinned(nodeAt(0), skin);
            meshInstance.setCustomAabb(new BoundingBox(new Vec3(3, 0, 0), new Vec3(1, 1, 1)));
            expect(meshInstance.aabb.center.x).to.be.closeTo(3, 1e-6);

            skin.matrices[0].setTranslate(5, 0, 0);
            skin._skinUpdateIndex++;
            expect(meshInstance.aabb.center.x).to.be.closeTo(3, 1e-6);

            // removing the custom bounds goes back to the bone bounds
            meshInstance.setCustomAabb(null);
            expect(meshInstance.aabb.center.x).to.be.closeTo(5, 1e-6);
        });
    });

    describe('custom bounds', function () {

        it('keeps the bounds while the node does not move', function () {
            const meshInstance = new MeshInstance(mesh, new ShaderMaterial(), nodeAt(2));
            meshInstance.setCustomAabb(new BoundingBox(new Vec3(1, 0, 0), new Vec3(1, 1, 1)));
            const aabb = meshInstance.aabb;
            expect(aabb.center.x).to.be.closeTo(3, 1e-6);

            // the cached bounds are returned, not evaluated again
            aabb.center.x = 100;
            expect(meshInstance.aabb.center.x).to.equal(100);
        });

        it('updates the bounds when the node moves', function () {
            const node = nodeAt(2);
            const meshInstance = new MeshInstance(mesh, new ShaderMaterial(), node);
            meshInstance.setCustomAabb(new BoundingBox(new Vec3(1, 0, 0), new Vec3(1, 1, 1)));
            expect(meshInstance.aabb.center.x).to.be.closeTo(3, 1e-6);

            node.setPosition(5, 0, 0);
            expect(meshInstance.aabb.center.x).to.be.closeTo(6, 1e-6);
        });

        it('updates the bounds when new custom bounds are set', function () {
            const meshInstance = new MeshInstance(mesh, new ShaderMaterial(), nodeAt(2));
            meshInstance.setCustomAabb(new BoundingBox(new Vec3(1, 0, 0), new Vec3(1, 1, 1)));
            expect(meshInstance.aabb.center.x).to.be.closeTo(3, 1e-6);

            meshInstance.setCustomAabb(new BoundingBox(new Vec3(4, 0, 0), new Vec3(1, 1, 1)));
            expect(meshInstance.aabb.center.x).to.be.closeTo(6, 1e-6);
        });
    });

    describe('mesh', function () {

        it('updates the bounds for a new mesh with the same bounds version', function () {
            const meshInstance = new MeshInstance(mesh, new ShaderMaterial(), nodeAt(0));
            expect(meshInstance.aabb.halfExtents.x).to.be.closeTo(0.5, 1e-6);

            const other = Mesh.fromGeometry(device, new BoxGeometry({ halfExtents: new Vec3(2, 2, 2) }));
            other._aabbVer = mesh._aabbVer;
            meshInstance.mesh = other;
            expect(meshInstance.aabb.halfExtents.x).to.be.closeTo(2, 1e-6);

            meshInstance.mesh = mesh;
            other.destroy();
        });

        it('updates the bounds when the mesh bounds change', function () {
            const meshInstance = new MeshInstance(mesh, new ShaderMaterial(), nodeAt(0));
            expect(meshInstance.aabb.halfExtents.x).to.be.closeTo(0.5, 1e-6);

            mesh.aabb = new BoundingBox(new Vec3(), new Vec3(3, 3, 3));
            expect(meshInstance.aabb.halfExtents.x).to.be.closeTo(3, 1e-6);
        });
    });
});
