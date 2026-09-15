import { expect } from 'chai';
import sinon from 'sinon';

import { TRACEID_MATERIAL_UPDATE } from '../../../src/core/constants.js';
import { Debug } from '../../../src/core/debug.js';
import { Color } from '../../../src/core/math/color.js';
import { Tracing } from '../../../src/core/tracing.js';
import { UNIFORMTYPE_VEC3 } from '../../../src/platform/graphics/constants.js';
import { GraphNode } from '../../../src/scene/graph-node.js';
import { StandardMaterial } from '../../../src/scene/materials/standard-material.js';
import { MeshInstance } from '../../../src/scene/mesh-instance.js';
import { Mesh } from '../../../src/scene/mesh.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('StandardMaterial uniform buffer', function () {

    let app;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
    });

    afterEach(function () {
        app.destroy();
        jsdomTeardown();
    });

    const prepare = (material) => {
        material.prepareForRender(app.graphicsDevice, app.scene);
        return material;
    };

    // the linear diffuse color currently stored in the material uniform buffer
    const storedDiffuse = (material) => {
        const uniformBuffer = material._uniformBuffer;
        const offset = uniformBuffer.format.get('material_diffuse').offset;
        return Array.from(uniformBuffer.storageFloat32.subarray(offset, offset + 3));
    };

    const linear = (r, g, b) => {
        const color = new Color().linear(new Color(r, g, b));
        return [color.r, color.g, color.b];
    };

    const expectStoredDiffuse = (material, expected) => {
        const stored = storedDiffuse(material);
        for (let i = 0; i < 3; i++) {
            expect(stored[i]).to.be.closeTo(expected[i], 1e-6);
        }
    };

    describe('descriptors', function () {

        it('describe diffuse as a linear vec3 uniform', function () {
            const material = new StandardMaterial();
            const descriptors = material.propertyDescriptors;
            expect(descriptors).to.have.lengthOf(1);
            expect(descriptors[0].name).to.equal('diffuse');
            expect(descriptors[0].uniformName).to.equal('material_diffuse');
            expect(descriptors[0].type).to.equal(UNIFORMTYPE_VEC3);
        });

        it('are static and shared between materials', function () {
            expect(new StandardMaterial().propertyDescriptors).to.equal(new StandardMaterial().propertyDescriptors);
        });

    });

    describe('creation', function () {

        it('has no uniform buffer before the first preparation, and keeps the properties pending', function () {
            const material = new StandardMaterial();
            material.update();
            expect(material.uniformBufferBindGroup).to.equal(null);
            expect(material._uniformBuffer).to.equal(null);
            expect(material._modifiedProperties.size).to.equal(1);
        });

        it('creates the uniform buffer and bind group on the first preparation, holding the default diffuse', function () {
            const material = prepare(new StandardMaterial());
            expect(material._uniformBuffer).to.exist;
            expect(material._uniformBuffer.persistent).to.equal(true);
            expect(material.uniformBufferBindGroup).to.exist;
            expect(material.uniformBufferBindGroup.uniformBuffers[0]).to.equal(material._uniformBuffer);
            expect(material._modifiedProperties.size).to.equal(0);
            expectStoredDiffuse(material, [1, 1, 1]);
        });

        it('no longer publishes diffuse as a parameter', function () {
            const material = prepare(new StandardMaterial());
            expect(material.parameters.material_diffuse).to.equal(undefined);
            expect(material.parameters.material_ambient).to.exist;
        });

        it('shares the uniform buffer format between materials', function () {
            const a = prepare(new StandardMaterial());
            const b = prepare(new StandardMaterial());
            expect(b._uniformBuffer.format).to.equal(a._uniformBuffer.format);
            expect(b.uniformBufferBindGroup.format).to.equal(a.uniformBufferBindGroup.format);
            expect(b._uniformBuffer).to.not.equal(a._uniformBuffer);
        });

        it('releases the uniform buffer and bind group on destroy', function () {
            const material = prepare(new StandardMaterial());
            material.destroy();
            expect(material._uniformBuffer).to.equal(null);
            expect(material.uniformBufferBindGroup).to.equal(null);
        });

    });

    describe('tracking', function () {

        it('writes an assigned diffuse to the buffer on update and uploads once on the next preparation', function () {
            const material = prepare(new StandardMaterial());
            const upload = sinon.spy(material._uniformBuffer, 'upload');

            material.diffuse = new Color(0.5, 0.25, 0.75);
            const version = material._uniformDataVersion;
            material.update();
            expect(material._uniformDataVersion).to.equal(version + 1);
            expectStoredDiffuse(material, linear(0.5, 0.25, 0.75));

            prepare(material);
            expect(upload.callCount).to.equal(1);

            // nothing changed - no upload
            prepare(material);
            prepare(material);
            expect(upload.callCount).to.equal(1);
        });

        it('does not mark a property modified when the assigned value is equal', function () {
            const material = prepare(new StandardMaterial());
            const version = material._uniformDataVersion;
            material.diffuse = new Color(1, 1, 1);
            material.update();
            expect(material._uniformDataVersion).to.equal(version);
        });

        it('detects an in-place mutation of the color returned by the getter', function () {
            const material = prepare(new StandardMaterial());
            material.diffuse.set(0, 0, 0);
            expect(material._mutableProperties.size).to.equal(1);

            material.update();
            expectStoredDiffuse(material, [0, 0, 0]);

            // the snapshot was synchronized - a further update writes nothing
            const version = material._uniformDataVersion;
            material.update();
            expect(material._uniformDataVersion).to.equal(version);
        });

        it('applies changes made before the first preparation without update()', function () {
            const material = new StandardMaterial();
            material.diffuse.set(0.5, 0.5, 0.5);
            prepare(material);
            expectStoredDiffuse(material, linear(0.5, 0.5, 0.5));
        });

        it('keeps the shader variants when diffuse changes', function () {
            const material = new StandardMaterial();
            material.update();
            const variant = {};
            material.variants.set(1, variant);

            material.diffuse = new Color(0.2, 0.4, 0.6);
            material.update();
            material.diffuse.set(0.1, 0.1, 0.1);
            material.update();
            expect(material.variants.get(1)).to.equal(variant);
        });

        it('writes the default diffuse again after reset', function () {
            const material = prepare(new StandardMaterial());
            material.diffuse = new Color(0, 0, 0);
            material.update();
            expectStoredDiffuse(material, [0, 0, 0]);

            material.reset();
            material.update();
            expectStoredDiffuse(material, [1, 1, 1]);
        });

    });

    describe('copy', function () {

        it('copies diffuse through the setter without marking the source as mutated', function () {
            const source = new StandardMaterial();
            source.diffuse = new Color(0.5, 0.25, 0.75);
            source.update();

            const clone = source.clone();
            expect(clone._diffuse.equals(source._diffuse)).to.equal(true);
            expect(clone._diffuse).to.not.equal(source._diffuse);
            expect(source._mutableProperties).to.equal(null);
            expect(clone._modifiedProperties.has(clone.propertyDescriptors[0])).to.equal(true);

            prepare(clone);
            expectStoredDiffuse(clone, linear(0.5, 0.25, 0.75));
        });

    });

    describe('changes without update()', function () {

        let warn;

        beforeEach(function () {
            warn = sinon.stub(console, 'warn');
        });

        afterEach(function () {
            warn.restore();
            for (const message of Debug._loggedMessages) {
                if (message.includes('without calling update()')) Debug._loggedMessages.delete(message);
            }
        });

        it('does not apply an in-place mutation on preparation, warns, and applies it on the next update()', function () {
            const material = prepare(new StandardMaterial());
            material.name = 'mutated-without-update';

            material.diffuse.set(0.5, 0.5, 0.5);
            prepare(material);
            expectStoredDiffuse(material, [1, 1, 1]);
            expect(warn.callCount).to.equal(1);
            expect(warn.firstCall.args[0]).to.contain('mutated-without-update');

            // nothing was dropped - the change is applied by update()
            material.update();
            prepare(material);
            expectStoredDiffuse(material, linear(0.5, 0.5, 0.5));
        });

        it('does not apply an assignment on preparation, warns, and applies it on the next update()', function () {
            const material = prepare(new StandardMaterial());
            material.name = 'assigned-without-update';

            material.diffuse = new Color(0, 0, 0);
            prepare(material);
            expectStoredDiffuse(material, [1, 1, 1]);
            expect(warn.callCount).to.equal(1);
            expect(warn.firstCall.args[0]).to.contain('assigned-without-update');

            material.update();
            prepare(material);
            expectStoredDiffuse(material, [0, 0, 0]);
        });

        it('does not warn when update() is called after changes', function () {
            const material = prepare(new StandardMaterial());
            material.name = 'updated';
            material.diffuse.set(0.5, 0.5, 0.5);
            material.update();
            prepare(material);
            material.diffuse = new Color(0, 0, 0);
            material.update();
            prepare(material);
            expect(warn.called).to.equal(false);
        });

        it('does not warn for changes made before the first preparation', function () {
            const material = new StandardMaterial();
            material.name = 'unprepared';
            material.diffuse.set(0.5, 0.5, 0.5);
            material.diffuse = new Color(0.25, 0.25, 0.25);
            prepare(material);
            prepare(material);
            expect(warn.called).to.equal(false);
        });

        it('identifies the material, the changed property and the nodes rendering it', function () {
            const material = prepare(new StandardMaterial());
            material.name = 'body-paint';

            const root = new GraphNode('Root');
            const car = new GraphNode('Car');
            const body = new GraphNode('Body');
            root.addChild(car);
            car.addChild(body);
            const meshInstance = new MeshInstance(new Mesh(app.graphicsDevice), material, body);
            expect(material.meshInstances.has(meshInstance)).to.equal(true);

            material.diffuse = new Color(0, 0, 0);
            prepare(material);

            const message = warn.firstCall.args[0];
            expect(message).to.contain(`Material 'body-paint' (id ${material.id}, used by 1 mesh instance on 'Car/Body') changed diffuse`);
            expect(message).to.contain('Tracing.set(TRACEID_MATERIAL_UPDATE, true)');
            expect(warn.firstCall.args).to.have.lengthOf(2);
        });

        it('lists distinct nodes once, the first three, and counts the rest', function () {
            const material = prepare(new StandardMaterial());
            material.name = 'shared';
            const root = new GraphNode('Root');
            const mesh = new Mesh(app.graphicsDevice);
            for (const name of ['Body', 'Body', 'Door', 'Hood', 'Roof', 'Trunk']) {
                const node = new GraphNode(name);
                root.addChild(node);
                new MeshInstance(mesh, material, node);  // eslint-disable-line no-new
            }

            material.diffuse = new Color(0, 0, 0);
            prepare(material);

            const message = warn.firstCall.args[0];
            expect(message).to.contain('used by 6 mesh instances on \'Body\', \'Door\', \'Hood\' and 2 more nodes)');
        });

        it('reports where the material was created and last changed when the trace channel is enabled', function () {
            Tracing.set(TRACEID_MATERIAL_UPDATE, true);
            try {
                const material = prepare(new StandardMaterial());
                material.name = 'traced';
                material.diffuse.set(0, 0, 0);
                prepare(material);

                const args = warn.firstCall.args;
                expect(args[0]).to.not.contain('Tracing.set(');
                expect(args).to.have.lengthOf(4);
                expect(args[2]).to.be.instanceOf(Error);
                expect(args[2].message).to.equal('Material created at');
                expect(args[3]).to.be.instanceOf(Error);
                expect(args[3].message).to.equal('Material last changed at');
            } finally {
                Tracing.set(TRACEID_MATERIAL_UPDATE, false);
            }
        });

        it('warns once per update cycle and skips the detection until the next update()', function () {
            const material = prepare(new StandardMaterial());
            material.name = 'once';

            material.diffuse = new Color(0, 0, 0);
            prepare(material);
            expect(warn.callCount).to.equal(1);
            expect(material._debugWarnedUnapplied).to.equal(true);

            // more unapplied changes and more frames: nothing else is reported
            material.diffuse.set(0.5, 0.5, 0.5);
            prepare(material);
            prepare(material);
            expect(warn.callCount).to.equal(1);

            // update() applies the change and arms the detection again
            material.update();
            prepare(material);
            expect(material._debugWarnedUnapplied).to.equal(false);
            expectStoredDiffuse(material, linear(0.5, 0.5, 0.5));

            material.name = 'once-again';
            material.diffuse = new Color(1, 1, 1);
            prepare(material);
            expect(warn.callCount).to.equal(2);
            expect(warn.secondCall.args[0]).to.contain('once-again');
        });

        it('records nothing when the trace channel is disabled', function () {
            const material = prepare(new StandardMaterial());
            material.diffuse = new Color(0, 0, 0);
            expect(material._debugCreationStack).to.equal(null);
            expect(material._debugChangeStack).to.equal(null);
        });

    });

    describe('mesh instance overrides', function () {

        let warn;

        beforeEach(function () {
            warn = sinon.stub(console, 'warn');
        });

        afterEach(function () {
            warn.restore();
            for (const message of Debug._loggedMessages) {
                if (message.includes('material_diffuse')) Debug._loggedMessages.delete(message);
            }
        });

        it('warns when a mesh instance overrides a uniform stored in the material uniform buffer', function () {
            const material = new StandardMaterial();
            const meshInstance = new MeshInstance(new Mesh(app.graphicsDevice), material);
            meshInstance.setParameter('material_emissive', [1, 1, 1]);
            expect(warn.called).to.equal(false);

            meshInstance.setParameter('material_diffuse', [1, 1, 1]);
            expect(warn.callCount).to.equal(1);
            expect(warn.firstCall.args[0]).to.contain('material_diffuse');
        });

    });

});
