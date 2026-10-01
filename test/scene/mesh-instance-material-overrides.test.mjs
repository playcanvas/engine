import { expect } from 'chai';
import sinon from 'sinon';

import { Debug } from '../../src/core/debug.js';
import { Color } from '../../src/core/math/color.js';
import { GraphNode } from '../../src/scene/graph-node.js';
import { getMutatedOverrides, recordAppliedOverrides } from '../../src/scene/materials/material-debug.js';
import { ShaderMaterial } from '../../src/scene/materials/shader-material.js';
import { StandardMaterial } from '../../src/scene/materials/standard-material.js';
import { MeshInstance } from '../../src/scene/mesh-instance.js';
import { Mesh } from '../../src/scene/mesh.js';
import { createApp } from '../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../jsdom.mjs';

describe('MeshInstance material uniform buffer overrides', function () {

    let app;
    let device;
    let material;
    let mesh;

    const prepare = (mat) => {
        mat.update();
        mat.prepareForRender(device, app.scene);
        return mat;
    };

    const storedDiffuse = (uniformBuffer) => {
        const offset = uniformBuffer.format.get('material_diffuse').offset;
        return Array.from(uniformBuffer.storageFloat32.subarray(offset, offset + 3));
    };

    const expectClose = (actual, expected) => {
        for (let i = 0; i < 3; i++) {
            expect(actual[i]).to.be.closeTo(expected[i], 1e-6);
        }
    };

    const linear = (r, g, b) => {
        const color = new Color().linear(new Color(r, g, b));
        return [color.r, color.g, color.b];
    };

    const names = list => list.map(parameter => parameter.name);

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
        device = app.graphicsDevice;
        material = new StandardMaterial();
        material.diffuse = new Color(0.5, 0.5, 0.5);
        prepare(material);
        mesh = new Mesh(device);
    });

    afterEach(function () {
        app.destroy();
        jsdomTeardown();
    });

    describe('parameter lists', function () {

        it('keeps the parameters in a map and splits them between the scope and the material buffer', function () {
            const meshInstance = new MeshInstance(mesh, material);
            meshInstance.setParameter('uScale', 0.9);
            meshInstance.setParameter('material_diffuse', [1, 0, 0]);
            meshInstance.setParameter('uTime', 2);

            expect(meshInstance.parameters).to.be.instanceOf(Map);
            expect(meshInstance.getParameters()).to.equal(meshInstance.parameters);
            expect(meshInstance.getParameter('uTime').data).to.equal(2);
            expect(names(meshInstance._scopeParameters)).to.deep.equal(['uScale', 'uTime']);
            expect(names(meshInstance._materialOverrides)).to.deep.equal(['material_diffuse']);
            expect(meshInstance.getParameter('material_diffuse').override).to.equal(true);
            expect(meshInstance.getParameter('uTime').override).to.equal(false);
        });

        it('removes a deleted parameter from its list and clears everything at once', function () {
            const meshInstance = new MeshInstance(mesh, material);
            meshInstance.setParameter('uScale', 0.9);
            meshInstance.setParameter('material_diffuse', [1, 0, 0]);

            meshInstance.deleteParameter('uScale');
            expect(meshInstance._scopeParameters).to.have.lengthOf(0);
            expect(names(meshInstance._materialOverrides)).to.deep.equal(['material_diffuse']);

            meshInstance.clearParameters();
            expect(meshInstance.parameters.size).to.equal(0);
            expect(meshInstance._materialOverrides).to.have.lengthOf(0);
            expect(meshInstance.getMaterialBindGroup(device)).to.equal(null);
        });

        it('splits the parameters again when the material is assigned after them', function () {
            // a material without typed properties classifies everything as a scope parameter
            const meshInstance = new MeshInstance(mesh, new ShaderMaterial());
            meshInstance.setParameter('material_diffuse', [1, 0, 0]);
            meshInstance.setParameter('uTime', 2);
            expect(names(meshInstance._scopeParameters)).to.deep.equal(['material_diffuse', 'uTime']);

            meshInstance.material = material;
            expect(names(meshInstance._scopeParameters)).to.deep.equal(['uTime']);
            expect(names(meshInstance._materialOverrides)).to.deep.equal(['material_diffuse']);
            expect(meshInstance._materialLayoutVersion).to.equal(material.layoutVersion);
        });

        it('splits the parameters again when the set of typed properties of the material changes', function () {
            const meshInstance = new MeshInstance(mesh, material);
            meshInstance.setParameter('material_diffuse', [1, 0, 0]);

            // simulate a layout change - the split is rebuilt on the next draw
            meshInstance._materialOverrides.length = 0;
            material._layoutVersion++;
            expect(meshInstance.getMaterialBindGroup(device)).to.exist;
            expect(names(meshInstance._materialOverrides)).to.deep.equal(['material_diffuse']);
            expect(meshInstance._materialLayoutVersion).to.equal(material.layoutVersion);
        });

    });

    describe('rendering', function () {

        it('uses the material bind group when no parameter names a uniform of the material buffer', function () {
            const meshInstance = new MeshInstance(mesh, material);
            meshInstance.setParameter('uScale', 0.9);

            expect(meshInstance.getMaterialBindGroup(device)).to.equal(null);
            expect(meshInstance._materialUniformBuffer).to.equal(null);

            // a parameter outside the buffer still reaches the scope
            meshInstance.setParameters(device);
            expect(device.scope.resolve('uScale').value).to.equal(0.9);
        });

        it('applies an override through a copy of the material buffer and keeps it off the scope', function () {
            const meshInstance = new MeshInstance(mesh, material);
            meshInstance.setParameter('material_diffuse', [1, 0, 0]);

            const bindGroup = meshInstance.getMaterialBindGroup(device);
            expect(bindGroup).to.exist;
            expect(bindGroup).to.not.equal(material.uniformBufferBindGroup);
            expect(bindGroup.format).to.equal(material.uniformBufferBindGroup.format);

            const copy = meshInstance._materialUniformBuffer;
            expect(copy.format).to.equal(material.uniformBuffer.format);
            expectClose(storedDiffuse(copy), [1, 0, 0]);
            expectClose(storedDiffuse(material.uniformBuffer), linear(0.5, 0.5, 0.5));

            // the override is not pushed to the scope (a scope id starts out with a null value)
            meshInstance.setParameters(device);
            expect(device.scope.resolve('material_diffuse').value).to.equal(null);
        });

        it('does not warn about overriding a uniform of the material buffer', function () {
            const warn = sinon.stub(console, 'warn');
            try {
                const meshInstance = new MeshInstance(mesh, material);
                meshInstance.setParameter('material_diffuse', [1, 0, 0]);
                meshInstance.getMaterialBindGroup(device);
                expect(warn.called).to.equal(false);
            } finally {
                warn.restore();
            }
        });

        it('synchronizes the copy only when the override or the material data changed', function () {
            const meshInstance = new MeshInstance(mesh, material);
            meshInstance.setParameter('material_diffuse', [1, 0, 0]);
            meshInstance.getMaterialBindGroup(device);

            const copy = meshInstance._materialUniformBuffer;
            const upload = sinon.spy(copy, 'upload');

            // nothing changed
            meshInstance.getMaterialBindGroup(device);
            meshInstance.getMaterialBindGroup(device);
            expect(upload.callCount).to.equal(0);

            // a new override value
            meshInstance.setParameter('material_diffuse', [0, 1, 0]);
            meshInstance.getMaterialBindGroup(device);
            expect(upload.callCount).to.equal(1);
            expectClose(storedDiffuse(copy), [0, 1, 0]);

            // a scope parameter changing does not touch the copy
            meshInstance.setParameter('uTime', 1);
            meshInstance.setParameter('uTime', 2);
            meshInstance.getMaterialBindGroup(device);
            expect(upload.callCount).to.equal(1);

            // a material change re-copies the material data, and the override still wins
            material.diffuse = new Color(0, 0, 1);
            prepare(material);
            meshInstance.getMaterialBindGroup(device);
            expect(upload.callCount).to.equal(2);
            expectClose(storedDiffuse(copy), [0, 1, 0]);
            expect(meshInstance._materialUniformBuffer).to.equal(copy);
        });

        it('returns to the material bind group when the override is deleted, and reuses the copy later', function () {
            const meshInstance = new MeshInstance(mesh, material);
            meshInstance.setParameter('material_diffuse', [1, 0, 0]);
            meshInstance.getMaterialBindGroup(device);
            const copy = meshInstance._materialUniformBuffer;

            meshInstance.deleteParameter('material_diffuse');
            expect(meshInstance.getMaterialBindGroup(device)).to.equal(null);

            meshInstance.setParameter('material_diffuse', [0, 0, 1]);
            expect(meshInstance.getMaterialBindGroup(device)).to.exist;
            expect(meshInstance._materialUniformBuffer).to.equal(copy);
            expectClose(storedDiffuse(copy), [0, 0, 1]);
        });

        it('follows a material change, keeping the copy when the layout is shared', function () {
            const meshInstance = new MeshInstance(mesh, material);
            meshInstance.setParameter('material_diffuse', [1, 0, 0]);
            meshInstance.getMaterialBindGroup(device);
            const copy = meshInstance._materialUniformBuffer;

            const other = new StandardMaterial();
            other.diffuse = new Color(0, 1, 0);
            prepare(other);
            meshInstance.material = other;

            expect(meshInstance.getMaterialBindGroup(device)).to.exist;
            expect(meshInstance._syncedMaterialDataVersion).to.equal(other.uniformDataVersion);
            expect(meshInstance._materialUniformBuffer).to.equal(copy);
            expectClose(storedDiffuse(copy), [1, 0, 0]);
        });

        it('releases the copy on destroy', function () {
            const meshInstance = new MeshInstance(mesh, material);
            meshInstance.setParameter('material_diffuse', [1, 0, 0]);
            meshInstance.getMaterialBindGroup(device);

            meshInstance.destroy();
            expect(meshInstance._materialUniformBuffer).to.equal(null);
            expect(meshInstance._materialBindGroup).to.equal(null);
        });

    });

    describe('material parameters', function () {

        let warn;

        beforeEach(function () {
            warn = sinon.stub(console, 'warn');
        });

        afterEach(function () {
            warn.restore();
            for (const message of Debug._loggedMessages) {
                if (message.includes('Material#setParameter')) Debug._loggedMessages.delete(message);
            }
        });

        it('warns when a material parameter names the uniform of a typed property, and ignores it', function () {
            material.setParameter('material_diffuse', [1, 0, 0]);
            expect(warn.callCount).to.equal(1);
            expect(warn.firstCall.args[0]).to.contain('material_diffuse');

            prepare(material);
            expectClose(storedDiffuse(material.uniformBuffer), linear(0.5, 0.5, 0.5));
        });

        it('does not warn for other material parameters', function () {
            material.setParameter('uTime', 1);
            material.setParameter('uScale', 0.5);
            expect(warn.called).to.equal(false);
        });

        it('restores only the scope parameters of a mesh instance', function () {
            material.setParameter('uTime', 1);
            material.setParameter('uScale', 0.5);
            const meshInstance = new MeshInstance(mesh, material);
            meshInstance.setParameter('uTime', 2);
            meshInstance.setParameter('material_diffuse', [1, 0, 0]);

            material.setParameters(device);
            meshInstance.setParameters(device);
            expect(device.scope.resolve('uTime').value).to.equal(2);

            material.setParameters(device, meshInstance._scopeParameters);
            expect(device.scope.resolve('uTime').value).to.equal(1);
            expect(device.scope.resolve('material_diffuse').value).to.equal(null);
        });

    });

    describe('overrides changed in place', function () {

        let warn;

        beforeEach(function () {
            warn = sinon.stub(console, 'warn');
        });

        afterEach(function () {
            warn.restore();
            for (const message of Debug._loggedMessages) {
                if (message.includes('in place')) Debug._loggedMessages.delete(message);
            }
        });

        it('warns once when an applied array override changes in place, and applies it on the next setParameter', function () {
            const meshInstance = new MeshInstance(mesh, material, new GraphNode('Player'));
            const data = new Float32Array([1, 0, 0]);
            meshInstance.setParameter('material_diffuse', data);
            meshInstance.getMaterialBindGroup(device);
            expect(warn.called).to.equal(false);

            // the copy keeps the applied value; the warning names the parameter and the node
            data[1] = 1;
            meshInstance.getMaterialBindGroup(device);
            expect(warn.callCount).to.equal(1);
            expect(warn.firstCall.args[0]).to.contain('\'material_diffuse\'').and.to.contain('\'Player\'');
            expectClose(storedDiffuse(meshInstance._materialUniformBuffer), [1, 0, 0]);

            // nothing is checked again until the next setParameter
            data[2] = 1;
            meshInstance.getMaterialBindGroup(device);
            expect(warn.callCount).to.equal(1);

            // setParameter with the same array applies its current values, without a warning
            meshInstance.setParameter('material_diffuse', data);
            meshInstance.getMaterialBindGroup(device);
            expectClose(storedDiffuse(meshInstance._materialUniformBuffer), [1, 1, 1]);
            expect(warn.callCount).to.equal(1);
        });

        it('does not warn when the array is changed in place and set again before the next draw', function () {
            const meshInstance = new MeshInstance(mesh, material);
            const data = new Float32Array([1, 0, 0]);
            meshInstance.setParameter('material_diffuse', data);
            meshInstance.getMaterialBindGroup(device);

            // the per-frame animation pattern: mutate, then setParameter with the same array
            for (let i = 0; i < 3; i++) {
                data[1] = (i + 1) * 0.25;
                meshInstance.setParameter('material_diffuse', data);
                meshInstance.getMaterialBindGroup(device);
                expectClose(storedDiffuse(meshInstance._materialUniformBuffer), [1, (i + 1) * 0.25, 0]);
            }
            expect(warn.called).to.equal(false);
        });

        it('does not warn for an unchanged plain array, including values outside float32 precision', function () {
            const meshInstance = new MeshInstance(mesh, material);
            meshInstance.setParameter('material_diffuse', [0.1, 0.2, 0.3]);
            meshInstance.getMaterialBindGroup(device);
            meshInstance.getMaterialBindGroup(device);
            expect(warn.called).to.equal(false);
        });

        it('does not warn for a scope parameter changed in place', function () {
            const meshInstance = new MeshInstance(mesh, material);
            const data = [1, 1, 1];
            meshInstance.setParameter('uColor', data);
            meshInstance.setParameter('material_diffuse', [1, 0, 0]);
            meshInstance.getMaterialBindGroup(device);
            data[0] = 0;
            meshInstance.getMaterialBindGroup(device);
            expect(warn.called).to.equal(false);
        });

        it('keeps the snapshots off the parameters in a weak map and reuses them while the length holds', function () {
            const meshInstance = new MeshInstance(mesh, material);
            const color = { name: 'uColor', data: [1, 0, 0], uniformFormat: { numComponents: 3, count: 0 } };
            const scale = { name: 'uScale', data: new Float32Array([2]), uniformFormat: { numComponents: 1, count: 0 } };
            recordAppliedOverrides(meshInstance, [color, scale]);
            const snapshots = meshInstance._debugOverrideSnapshots;
            expect(snapshots).to.be.instanceOf(WeakMap);
            expect(Object.keys(color)).to.deep.equal(['name', 'data', 'uniformFormat']);
            expect(snapshots.get(color)).to.deep.equal([1, 0, 0]);
            expect(snapshots.get(scale)).to.deep.equal([2]);

            // the same array is written again for the same length
            const snapshot = snapshots.get(color);
            color.data[1] = 1;
            recordAppliedOverrides(meshInstance, [color, scale]);
            expect(snapshots.get(color)).to.equal(snapshot);
            expect(snapshot).to.deep.equal([1, 1, 0]);
        });

        it('records no snapshot for a number', function () {
            const meshInstance = new MeshInstance(mesh, material);
            const override = { name: 'uValue', data: 2, uniformFormat: { numComponents: 1, count: 0 } };
            recordAppliedOverrides(meshInstance, [override]);
            expect(meshInstance._debugOverrideSnapshots.has(override)).to.equal(false);
            expect(getMutatedOverrides(meshInstance, [override])).to.deep.equal([]);
        });

    });

});
