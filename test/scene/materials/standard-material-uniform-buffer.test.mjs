import { expect } from 'chai';
import sinon from 'sinon';

import { TRACEID_MATERIAL_UPDATE } from '../../../src/core/constants.js';
import { Debug } from '../../../src/core/debug.js';
import { Color } from '../../../src/core/math/color.js';
import { Tracing } from '../../../src/core/tracing.js';
import { UNIFORMTYPE_FLOAT, UNIFORMTYPE_VEC2, UNIFORMTYPE_VEC3 } from '../../../src/platform/graphics/constants.js';
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

    // the value of a uniform currently stored in the material uniform buffer
    const expectStored = (material, uniformName, expected) => {
        const uniformBuffer = material._uniformBuffer;
        const offset = uniformBuffer.format.get(uniformName).offset;
        const stored = uniformBuffer.storageFloat32.subarray(offset, offset + expected.length);
        for (let i = 0; i < expected.length; i++) {
            expect(stored[i]).to.be.closeTo(expected[i], 1e-6);
        }
    };

    describe('descriptors', function () {

        it('describe the colors as vec3 uniforms and the numbers as floats, named after the property', function () {
            const descriptors = new StandardMaterial().propertyDescriptors;
            expect(descriptors).to.have.lengthOf(37);
            const byName = new Map(descriptors.map(descriptor => [descriptor.name, descriptor]));
            for (const name of ['diffuse', 'emissive', 'ambient', 'specular', 'sheen', 'attenuation']) {
                expect(byName.get(name).type, name).to.equal(UNIFORMTYPE_VEC3);
            }
            for (const name of ['emissiveIntensity', 'gloss', 'metalness', 'opacity', 'refractionIndex', 'parallaxShadowSamples']) {
                expect(byName.get(name).type, name).to.equal(UNIFORMTYPE_FLOAT);
            }
            // derived uniforms are named after what they hold
            const derivedUniforms = { attenuationDistance: 'material_invAttenuationDistance', alphaDither: 'material_alphaDitherScale' };
            for (const descriptor of descriptors) {
                expect(descriptor.uniformName).to.equal(derivedUniforms[descriptor.name] ?? `material_${descriptor.name}`);
            }
            expect(byName.get('anisotropyRotation').type).to.equal(UNIFORMTYPE_VEC2);
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
            expect(material._modifiedProperties.size).to.equal(37);
        });

        it('creates the uniform buffer and bind group on the first preparation, holding the defaults', function () {
            const material = prepare(new StandardMaterial());
            expect(material._uniformBuffer).to.exist;
            expect(material._uniformBuffer.persistent).to.equal(true);
            expect(material.uniformBufferBindGroup).to.exist;
            expect(material.uniformBufferBindGroup.uniformBuffers[0]).to.equal(material._uniformBuffer);
            expect(material._modifiedProperties.size).to.equal(0);
            expectStoredDiffuse(material, [1, 1, 1]);
            expectStored(material, 'material_emissive', [0, 0, 0]);
            expectStored(material, 'material_emissiveIntensity', [1]);
        });

        it('no longer publishes the typed properties as parameters', function () {
            const material = prepare(new StandardMaterial());
            expect(material.parameters.material_diffuse).to.equal(undefined);
            expect(material.parameters.material_emissive).to.equal(undefined);
            expect(material.parameters.material_emissiveIntensity).to.equal(undefined);
            expect(material.parameters.material_ambient).to.equal(undefined);
            expect(material.parameters.material_gloss).to.equal(undefined);
            expect(material.parameters.material_opacity).to.equal(undefined);
            expect(material.parameters.material_alphaDitherScale).to.equal(undefined);

            // a material without maps publishes no parameter at all
            expect(Object.keys(material.parameters)).to.deep.equal([]);
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

        it('writes an assigned emissive color and intensity, each marking only its own property', function () {
            const material = prepare(new StandardMaterial());

            material.emissive = new Color(0.5, 0.25, 0.75);
            expect(material._modifiedProperties.size).to.equal(1);
            material.update();
            expectStored(material, 'material_emissive', linear(0.5, 0.25, 0.75));
            expectStored(material, 'material_emissiveIntensity', [1]);

            material.emissiveIntensity = 3;
            expect(material._modifiedProperties.size).to.equal(1);
            expect(material._modifiedProperties.has(material.propertyDescriptors[2])).to.equal(true);
            const version = material._uniformDataVersion;
            material.update();
            expect(material._uniformDataVersion).to.equal(version + 1);
            expectStored(material, 'material_emissiveIntensity', [3]);
            expectStored(material, 'material_emissive', linear(0.5, 0.25, 0.75));

            // an equal intensity is ignored
            material.emissiveIntensity = 3;
            material.update();
            expect(material._uniformDataVersion).to.equal(version + 1);
        });

        it('detects an in-place mutation of the emissive color returned by the getter', function () {
            const material = prepare(new StandardMaterial());
            material.emissive.set(1, 1, 1);
            expect(material._mutableProperties.size).to.equal(1);
            material.update();
            expectStored(material, 'material_emissive', [1, 1, 1]);
        });

        it('keeps the shader variants when emissiveIntensity moves between 0 and 1', function () {
            const material = new StandardMaterial();
            material.update();
            const variant = {};
            material.variants.set(1, variant);

            material.emissiveIntensity = 0;
            material.update();
            material.emissiveIntensity = 1;
            material.update();
            material.emissiveIntensity = 2.5;
            material.update();
            expect(material.variants.get(1)).to.equal(variant);
        });

        it('stores every typed property, colors as linear values and numbers as they are', function () {
            const material = prepare(new StandardMaterial());
            const derived = new Set(['anisotropyRotation', 'attenuationDistance', 'heightMapFactor', 'alphaDither']);
            const descriptors = material.propertyDescriptors.filter(descriptor => !derived.has(descriptor.name));
            descriptors.forEach((descriptor, index) => {
                if (descriptor.type === UNIFORMTYPE_VEC3) {
                    material[descriptor.name] = new Color(0.5, 0.25, 0.75);
                } else {
                    material[descriptor.name] = 0.125 + index;
                }
            });
            material.update();
            descriptors.forEach((descriptor, index) => {
                if (descriptor.type === UNIFORMTYPE_VEC3) {
                    expectStored(material, descriptor.uniformName, linear(0.5, 0.25, 0.75));
                } else {
                    expectStored(material, descriptor.uniformName, [0.125 + index]);
                }
            });
        });

        it('derives the anisotropy direction, the inverse attenuation distance and the height map factor', function () {
            const material = prepare(new StandardMaterial());
            expectStored(material, 'material_anisotropyRotation', [1, 0]);
            expectStored(material, 'material_invAttenuationDistance', [0]);
            expectStored(material, 'material_heightMapFactor', [0.1]);

            material.anisotropyRotation = 90;
            material.attenuationDistance = 4;
            material.heightMapFactor = 2;
            material.update();
            expectStored(material, 'material_anisotropyRotation', [Math.cos(Math.PI / 2), Math.sin(Math.PI / 2)]);
            expectStored(material, 'material_invAttenuationDistance', [0.25]);
            expectStored(material, 'material_heightMapFactor', [0.2]);
        });

        it('derives the dither scale from the dither alpha and the opacity', function () {
            const material = prepare(new StandardMaterial());
            expectStored(material, 'material_alphaDitherScale', [1]);

            // the dither alpha falls back to the opacity, a scale of 1
            material.opacity = 0.5;
            material.update();
            expect(material.alphaDither).to.equal(0.5);
            expectStored(material, 'material_alphaDitherScale', [1]);

            material.alphaDither = 0.25;
            material.update();
            expectStored(material, 'material_alphaDitherScale', [0.5]);

            // a change of the opacity re-derives the scale
            material.opacity = 0.25;
            material.update();
            expectStored(material, 'material_alphaDitherScale', [1]);

            // a zero opacity keeps a safe scale, null restores the fall-through
            material.opacity = 0;
            material.update();
            expectStored(material, 'material_alphaDitherScale', [1]);
            material.opacity = 0.5;
            material.alphaDither = null;
            material.update();
            expect(material.alphaDither).to.equal(0.5);
            expectStored(material, 'material_alphaDitherScale', [1]);
        });

        it('keeps the shader-dirty predicates of the numbers', function () {
            const material = new StandardMaterial();
            material.update();
            const dirtyAfter = (name, value) => {
                material._dirtyShader = false;
                material[name] = value;
                return material._dirtyShader;
            };
            expect(dirtyAfter('metalness', 0.5), 'leaving 1').to.equal(true);
            expect(dirtyAfter('metalness', 0.25), 'staying fractional').to.equal(false);
            expect(dirtyAfter('gloss', 0), 'reaching 0').to.equal(true);
            expect(dirtyAfter('heightMapBase', 1), 'height map base never selects shader code').to.equal(false);
            expect(dirtyAfter('parallaxShadowSamples', 4), 'leaving 0').to.equal(true);
            expect(dirtyAfter('parallaxShadowSamples', 5), 'staying above 0').to.equal(false);
            expect(dirtyAfter('refraction', 0.5), 'leaving 0').to.equal(true);
            expect(dirtyAfter('refraction', 0.7), 'staying fractional').to.equal(false);
            expect(dirtyAfter('refractionIndex', 0.5), 'leaving the default').to.equal(true);
            expect(dirtyAfter('refractionIndex', 0.6), 'staying off the default').to.equal(false);
            expect(dirtyAfter('ambient', new Color(0, 0, 0)), 'colors never do').to.equal(false);
            expect(dirtyAfter('alphaDither', 0.5), 'the dither alpha never does').to.equal(false);
            expect(dirtyAfter('heightMapFactor', 0.5), 'leaving 1').to.equal(true);
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

        it('writes the defaults again after reset', function () {
            const material = prepare(new StandardMaterial());
            material.diffuse = new Color(0, 0, 0);
            material.emissive = new Color(1, 1, 1);
            material.emissiveIntensity = 2;
            material.update();
            expectStoredDiffuse(material, [0, 0, 0]);
            expectStored(material, 'material_emissive', [1, 1, 1]);
            expectStored(material, 'material_emissiveIntensity', [2]);

            material.reset();
            material.update();
            expectStoredDiffuse(material, [1, 1, 1]);
            expectStored(material, 'material_emissive', [0, 0, 0]);
            expectStored(material, 'material_emissiveIntensity', [1]);
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

        it('copies emissive and emissiveIntensity through the setters', function () {
            const source = new StandardMaterial();
            source.emissive = new Color(0.5, 0.25, 0.75);
            source.emissiveIntensity = 4;
            source.update();

            const clone = source.clone();
            expect(clone._emissive.equals(source._emissive)).to.equal(true);
            expect(clone._emissive).to.not.equal(source._emissive);
            expect(clone.emissiveIntensity).to.equal(4);
            expect(source._mutableProperties).to.equal(null);

            prepare(clone);
            expectStored(clone, 'material_emissive', linear(0.5, 0.25, 0.75));
            expectStored(clone, 'material_emissiveIntensity', [4]);
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

});
