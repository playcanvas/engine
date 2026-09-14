import { expect } from 'chai';
import sinon from 'sinon';

import { NullGraphicsDevice } from '../../src/platform/graphics/null/null-graphics-device.js';
import { Layer } from '../../src/scene/layer.js';
import { StandardMaterial } from '../../src/scene/materials/standard-material.js';
import { MeshInstance } from '../../src/scene/mesh-instance.js';
import { Mesh } from '../../src/scene/mesh.js';

describe('Layer mesh membership', function () {
    let device;
    let material;
    let instances;
    let layer;

    beforeEach(function () {
        device = new NullGraphicsDevice({ id: 'layer-test' });
        material = new StandardMaterial();
        const mesh = new Mesh(device);
        instances = Array.from({ length: 8 }, () => {
            const instance = new MeshInstance(mesh, material);
            instance.castShadow = true;
            return instance;
        });
        layer = new Layer();
    });

    afterEach(function () {
        sinon.restore();
        layer.clearMeshInstances();
        instances.forEach(instance => instance.destroy());
        material.destroy();
        device.destroy();
    });

    it('appends unique instances to clean caches without rebuilding', function () {
        const meshes = layer.meshInstances;
        const casters = layer.shadowCasters;
        const meshIterator = sinon.spy(layer.meshInstancesSet, Symbol.iterator);
        const casterIterator = sinon.spy(layer.shadowCastersSet, Symbol.iterator);

        instances[1].castShadow = false;
        layer.addMeshInstances([instances[0], instances[1], instances[0]]);
        layer.addMeshInstances([instances[2]]);

        expect(layer.meshInstances).to.equal(meshes);
        expect(layer.shadowCasters).to.equal(casters);
        expect(meshes).to.deep.equal(instances.slice(0, 3));
        expect(casters).to.deep.equal([instances[0], instances[2]]);
        expect(meshIterator.called).to.be.false;
        expect(casterIterator.called).to.be.false;
    });

    it('coalesces removals and additions until either cache is read', function () {
        layer.addMeshInstances(instances.slice(0, 4));
        const meshes = layer.meshInstances;
        const casters = layer.shadowCasters;
        const meshIterator = sinon.spy(layer.meshInstancesSet, Symbol.iterator);
        const casterIterator = sinon.spy(layer.shadowCastersSet, Symbol.iterator);

        layer.removeMeshInstances([instances[0], instances[2]]);
        layer.addMeshInstances([instances[4], instances[0]]);
        layer.removeMeshInstances([instances[3]]);
        expect(meshIterator.called).to.be.false;
        expect(casterIterator.called).to.be.false;

        expect(layer.meshInstances).to.equal(meshes);
        expect(meshes).to.deep.equal([instances[1], instances[4], instances[0]]);
        expect(meshIterator.callCount).to.equal(1);
        expect(casterIterator.callCount).to.equal(1);
        expect(layer.shadowCasters).to.equal(casters);
        expect(casters).to.deep.equal(meshes);
        expect(casterIterator.callCount).to.equal(1);

        expect(layer.meshInstances).to.equal(meshes);
        expect(layer.shadowCasters).to.equal(casters);
        expect(meshIterator.callCount).to.equal(1);
        expect(casterIterator.callCount).to.equal(1);
    });

    it('does not invalidate caches for duplicate additions or missing removals', function () {
        layer.addMeshInstances([instances[0]]);
        const meshIterator = sinon.spy(layer.meshInstancesSet, Symbol.iterator);
        const casterIterator = sinon.spy(layer.shadowCastersSet, Symbol.iterator);
        layer.addMeshInstances([instances[0], instances[0]]);
        layer.removeMeshInstances([instances[1], instances[1]]);

        expect(layer.meshInstances).to.deep.equal([instances[0]]);
        expect(layer.shadowCasters).to.deep.equal([instances[0]]);
        expect(meshIterator.called).to.be.false;
        expect(casterIterator.called).to.be.false;
    });

    it('releases removed references without another getter or render', function () {
        layer.addMeshInstances(instances.slice(0, 6));
        const meshes = layer.meshInstances;
        const casters = layer.shadowCasters;

        layer.removeMeshInstances(instances.slice(0, 6));
        layer.addMeshInstances(instances.slice(6));

        // Inspect the retained arrays directly: a getter would hide a reference-retention bug.
        expect(meshes).to.be.empty;
        expect(casters).to.be.empty;
        expect([...layer.meshInstancesSet]).to.deep.equal(instances.slice(6));
        expect([...layer.shadowCastersSet]).to.deep.equal(instances.slice(6));
    });

    it('refreshes both caches through the shadow getter and resumes cheap appends', function () {
        layer.addMeshInstances(instances.slice(0, 3));
        const meshes = layer.meshInstances;
        const casters = layer.shadowCasters;
        layer.removeMeshInstances([instances[0]]);
        const meshIterator = sinon.spy(layer.meshInstancesSet, Symbol.iterator);
        const casterIterator = sinon.spy(layer.shadowCastersSet, Symbol.iterator);

        expect(layer.shadowCasters).to.equal(casters);
        expect(meshes).to.deep.equal(instances.slice(1, 3));
        expect(casters).to.deep.equal(meshes);
        layer.addMeshInstances([instances[3]]);
        expect(layer.meshInstances).to.equal(meshes);
        expect(meshes).to.deep.equal(instances.slice(1, 4));
        expect(casters).to.deep.equal(meshes);
        expect(meshIterator.callCount).to.equal(1);
        expect(casterIterator.callCount).to.equal(1);
    });

    it('releases cached references for shadow-only removals', function () {
        layer.addShadowCasters(instances);
        const casters = layer.shadowCasters;
        layer.removeShadowCasters(instances);
        expect(casters).to.be.empty;
        expect(layer.shadowCastersSet.size).to.equal(0);
    });

    it('removes every entry when passed the layer arrays themselves', function () {
        layer.addMeshInstances(instances);
        layer.removeMeshInstances(layer.meshInstances);
        expect(layer.meshInstances).to.be.empty;
        expect(layer.shadowCasters).to.be.empty;

        layer.addShadowCasters(instances);
        layer.removeShadowCasters(layer.shadowCasters);
        expect(layer.shadowCasters).to.be.empty;
    });

    it('accepts either cached array as input to either removal method', function () {
        layer.addMeshInstances(instances);
        layer.removeMeshInstances(layer.shadowCasters);
        expect(layer.meshInstancesSet.size).to.equal(0);
        expect(layer.shadowCastersSet.size).to.equal(0);

        layer.addMeshInstances(instances);
        layer.removeShadowCasters(layer.meshInstances);
        expect(layer.shadowCastersSet.size).to.equal(0);
        expect(layer.meshInstances).to.deep.equal(instances);

        layer.addShadowCasters(instances);
        layer.removeMeshInstances(layer.meshInstances, true);
        expect(layer.meshInstancesSet.size).to.equal(0);
        expect(layer.shadowCasters).to.deep.equal(instances);
    });

    it('keeps shadow-only membership independent from visible membership', function () {
        layer.addMeshInstances([instances[0]], true);
        layer.addShadowCasters([instances[1]]);
        expect(layer.meshInstances).to.deep.equal([instances[0]]);
        expect(layer.shadowCasters).to.deep.equal([instances[1]]);

        layer.addMeshInstances([instances[2]]);
        layer.removeMeshInstances([instances[2]], true);
        layer.addMeshInstances([instances[3]], true);
        expect(layer.meshInstances).to.deep.equal([instances[0], instances[3]]);
        expect(layer.shadowCasters).to.deep.equal([instances[1], instances[2]]);

        layer.removeMeshInstances([instances[1]]);
        expect(layer.shadowCasters).to.deep.equal([instances[2]]);
    });

    it('updates shadows even when the visible instance is already registered', function () {
        instances[0].castShadow = false;
        layer.addMeshInstances([instances[0]]);
        expect(layer.shadowCasters).to.be.empty;

        instances[0].castShadow = true;
        layer.addMeshInstances([instances[0]]);
        expect(layer.meshInstances).to.deep.equal([instances[0]]);
        expect(layer.shadowCasters).to.deep.equal([instances[0]]);

        instances[0].castShadow = false;
        layer.removeShadowCasters([instances[0]]);
        expect(layer.shadowCasters).to.be.empty;
        expect(layer.meshInstances).to.deep.equal([instances[0]]);
    });

    it('clears dirty caches immediately and resumes cheap appends', function () {
        layer.addMeshInstances(instances);
        const meshes = layer.meshInstances;
        const casters = layer.shadowCasters;
        layer.removeMeshInstances([instances[0]]);
        const meshIterator = sinon.spy(layer.meshInstancesSet, Symbol.iterator);
        const casterIterator = sinon.spy(layer.shadowCastersSet, Symbol.iterator);

        layer.clearMeshInstances();
        expect(meshes).to.be.empty;
        expect(casters).to.be.empty;
        expect(layer.meshInstancesSet.size).to.equal(0);
        expect(layer.shadowCastersSet.size).to.equal(0);
        layer.addMeshInstances([instances[1]]);
        expect(layer.meshInstances).to.equal(meshes);
        expect(layer.shadowCasters).to.equal(casters);
        expect(meshes).to.deep.equal([instances[1]]);
        expect(casters).to.deep.equal([instances[1]]);
        expect(meshIterator.called).to.be.false;
        expect(casterIterator.called).to.be.false;
    });

    it('can clear visible instances while preserving a dirty shadow cache', function () {
        layer.addMeshInstances(instances.slice(0, 3));
        layer.removeShadowCasters([instances[1]]);
        layer.clearMeshInstances(true);
        layer.addMeshInstances([instances[3]], true);

        expect(layer.meshInstances).to.deep.equal([instances[3]]);
        expect(layer.shadowCasters).to.deep.equal([instances[0], instances[2]]);
    });

    it('invalidates material variants immediately when adding to a dirty layer', function () {
        material.getShaderVariant = () => null;
        const clearVariants = sinon.spy(material, 'clearVariants');
        layer.addMeshInstances([instances[0]]);
        layer.removeMeshInstances([instances[0]]);
        layer._shaderVersion = material._shaderVersion + 1;
        layer.addMeshInstances([instances[1], instances[2]]);

        expect(clearVariants.callCount).to.equal(1);
        expect(material._shaderVersion).to.equal(layer._shaderVersion);
        expect(layer.meshInstances).to.deep.equal([instances[1], instances[2]]);
    });

    it('matches ordered membership through mixed operations and intermittent reads', function () {
        const meshes = new Set();
        const casters = new Set();
        let seed = 123456;
        for (let step = 0; step < 500; step++) {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            const instance = instances[(seed >>> 16) % instances.length];
            const skip = !!(seed & 256);
            const operation = (seed >>> 8) % 7;
            switch (operation) {
                case 0:
                case 1:
                    layer.addMeshInstances([instance], skip);
                    meshes.add(instance);
                    if (!skip && instance.castShadow) casters.add(instance);
                    break;
                case 2:
                    layer.removeMeshInstances([instance], skip);
                    meshes.delete(instance);
                    if (!skip) casters.delete(instance);
                    break;
                case 3:
                    layer.addShadowCasters([instance]);
                    if (instance.castShadow) casters.add(instance);
                    break;
                case 4:
                    layer.removeShadowCasters([instance]);
                    casters.delete(instance);
                    break;
                case 5:
                    instance.castShadow = !instance.castShadow;
                    break;
                case 6:
                    layer.clearMeshInstances(skip);
                    meshes.clear();
                    if (!skip) casters.clear();
                    break;
            }

            if (step % 11 === 0 || step === 499) {
                expect(layer.meshInstances).to.deep.equal([...meshes]);
                expect(layer.shadowCasters).to.deep.equal([...casters]);
                expect([...layer.meshInstancesSet]).to.deep.equal([...meshes]);
                expect([...layer.shadowCastersSet]).to.deep.equal([...casters]);
            }
        }
    });
});
