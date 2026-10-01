import { expect } from 'chai';

import { BoxGeometry } from '../../src/scene/geometry/box-geometry.js';
import { GraphNode } from '../../src/scene/graph-node.js';
import { ShaderMaterial } from '../../src/scene/materials/shader-material.js';
import { MeshInstance } from '../../src/scene/mesh-instance.js';
import { Mesh } from '../../src/scene/mesh.js';
import { createGraphicsDevice } from '../device.mjs';

// The data a mesh instance caches from its node - its world bounding box, and its slot in the mesh
// instance storage - is tagged with the transform version of the node, a counter of each node. A
// different node can hold the same count, so assigning a node invalidates the cached data.
describe('MeshInstance#node', function () {

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

    it('returns the node it was given', function () {
        const a = nodeAt(0);
        const b = nodeAt(1);
        const meshInstance = new MeshInstance(mesh, new ShaderMaterial(), a);
        expect(meshInstance.node).to.equal(a);
        meshInstance.node = b;
        expect(meshInstance.node).to.equal(b);
    });

    it('updates the bounding box for a new node with the same transform version', function () {
        const a = nodeAt(0);
        const b = nodeAt(10);
        b._aabbVer = a._aabbVer;

        const meshInstance = new MeshInstance(mesh, new ShaderMaterial(), a);
        expect(meshInstance.aabb.center.x).to.be.closeTo(0, 1e-6);

        meshInstance.node = b;
        expect(meshInstance.aabb.center.x).to.be.closeTo(10, 1e-6);
    });

    it('keeps the cached data when given the node it has', function () {
        const a = nodeAt(0);
        const meshInstance = new MeshInstance(mesh, new ShaderMaterial(), a);
        meshInstance.aabb;
        meshInstance.storageSlotVersion = a._aabbVer;

        meshInstance.node = a;
        expect(meshInstance._aabbVer).to.equal(a._aabbVer);
        expect(meshInstance.storageSlotVersion).to.equal(a._aabbVer);
    });

    it('invalidates the storage slot data for a new node', function () {
        const a = nodeAt(0);
        const b = nodeAt(10);
        const meshInstance = new MeshInstance(mesh, new ShaderMaterial(), a);
        meshInstance.storageSlotVersion = a._aabbVer;

        meshInstance.node = b;
        expect(meshInstance.storageSlotVersion).to.equal(-1);
    });
});
