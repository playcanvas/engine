import { expect } from 'chai';
import sinon from 'sinon';

import { TRACEID_MATERIAL_UPDATE } from '../../../src/core/constants.js';
import { Debug } from '../../../src/core/debug.js';
import { Color } from '../../../src/core/math/color.js';
import { Vec2 } from '../../../src/core/math/vec2.js';
import { Vec3 } from '../../../src/core/math/vec3.js';
import { BoundingBox } from '../../../src/core/shape/bounding-box.js';
import { Tracing } from '../../../src/core/tracing.js';
import { UNIFORMTYPE_FLOAT, UNIFORMTYPE_VEC2, UNIFORMTYPE_VEC3 } from '../../../src/platform/graphics/constants.js';
import { Texture } from '../../../src/platform/graphics/texture.js';
import { CUBEPROJ_BOX, CUBEPROJ_NONE } from '../../../src/scene/constants.js';
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
            expect(descriptors).to.have.lengthOf(39);
            const byName = new Map(descriptors.map(descriptor => [descriptor.name, descriptor]));
            for (const name of ['diffuse', 'emissive', 'ambient', 'specular', 'sheen', 'attenuation']) {
                expect(byName.get(name).type, name).to.equal(UNIFORMTYPE_VEC3);
            }
            for (const name of ['emissiveIntensity', 'gloss', 'metalness', 'opacity', 'refractionIndex', 'parallaxShadowSamples']) {
                expect(byName.get(name).type, name).to.equal(UNIFORMTYPE_FLOAT);
            }
            // derived uniforms are named after what they hold, the projection box feeds two of them
            const derivedUniforms = { attenuationDistance: 'material_invAttenuationDistance', alphaDither: 'material_alphaDitherScale' };
            for (const descriptor of descriptors) {
                if (descriptor.name !== 'cubeMapProjectionBox') {
                    expect(descriptor.uniformName).to.equal(derivedUniforms[descriptor.name] ?? `material_${descriptor.name}`);
                }
            }
            expect(descriptors.filter(descriptor => descriptor.name === 'cubeMapProjectionBox').map(descriptor => descriptor.uniformName)).to.deep.equal(['envBoxMin', 'envBoxMax']);
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
            expect(material._modifiedProperties.size).to.equal(39);
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
            const derived = new Set(['anisotropyRotation', 'attenuationDistance', 'heightMapFactor', 'alphaDither', 'cubeMapProjectionBox']);
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

    describe('texture transforms', function () {

        let texture;

        beforeEach(function () {
            texture = new Texture(app.graphicsDevice, { width: 4, height: 4 });
        });

        afterEach(function () {
            texture.destroy();
        });

        // the transform of a map as the shader reads it: two vec3s from tiling, offset and rotation
        const transformOf = (tiling, offset, rotation) => {
            const cr = Math.cos(rotation * Math.PI / 180);
            const sr = Math.sin(rotation * Math.PI / 180);
            return [[cr * tiling[0], -sr * tiling[1], offset[0]], [sr * tiling[0], cr * tiling[1], 1 - tiling[1] - offset[1]]];
        };

        const assign = (material, name = 'diffuse') => {
            material[`${name}Map`] = texture;
            material.update();
            return prepare(material);
        };

        it('adds the transform uniforms of an assigned map to the layout and moves the values to a new buffer', function () {
            const material = prepare(new StandardMaterial());
            const buffer = material._uniformBuffer;
            const bindGroup = material.uniformBufferBindGroup;
            const layoutVersion = material.layoutVersion;
            expect(buffer.format.get('texture_diffuseMapTransform0')).to.equal(undefined);
            expect(material.propertyDescriptors).to.have.lengthOf(39);

            material.diffuse = new Color(0.5, 0.25, 0.75);
            assign(material);
            expect(material.layoutVersion).to.equal(layoutVersion + 1);
            expect(material._uniformBuffer).to.not.equal(buffer);
            expect(material.uniformBufferBindGroup).to.not.equal(bindGroup);
            expect(material.propertyDescriptors).to.have.lengthOf(41);
            expect(material._uniformBuffer.format.get('texture_diffuseMapTransform0')).to.exist;
            expect(material._uniformBuffer.format.get('texture_diffuseMapTransform1')).to.exist;

            // the identity transform of the new map, and the values written before the move
            expectStored(material, 'material_diffuse', linear(0.5, 0.25, 0.75));
            expectStored(material, 'texture_diffuseMapTransform0', [1, 0, 0]);
            expectStored(material, 'texture_diffuseMapTransform1', [0, 1, 0]);

            // the sampler stays a parameter, the transform is not one anymore
            expect(material.parameters.texture_diffuseMap).to.exist;
            expect(material.parameters.texture_diffuseMapTransform0).to.equal(undefined);
        });

        it('writes the transform from tiling, offset and rotation, assigned or changed in place', function () {
            const material = assign(new StandardMaterial());
            material.diffuseMapTiling = new Vec2(2, 3);
            material.diffuseMapOffset = new Vec2(0.25, 0.5);
            material.diffuseMapRotation = 90;
            const version = material._uniformDataVersion;
            material.update();
            expect(material._uniformDataVersion).to.equal(version + 1);
            const [t0, t1] = transformOf([2, 3], [0.25, 0.5], 90);
            expectStored(material, 'texture_diffuseMapTransform0', t0);
            expectStored(material, 'texture_diffuseMapTransform1', t1);

            // a change in place of the vector returned by the getter
            material.diffuseMapTiling.set(4, 5);
            material.update();
            const [u0, u1] = transformOf([4, 5], [0.25, 0.5], 90);
            expectStored(material, 'texture_diffuseMapTransform0', u0);
            expectStored(material, 'texture_diffuseMapTransform1', u1);

            // nothing changed - nothing written
            const settled = material._uniformDataVersion;
            material.update();
            expect(material._uniformDataVersion).to.equal(settled);
        });

        it('removes the transform uniforms when the map is removed, and after reset', function () {
            const material = assign(new StandardMaterial());
            material.diffuseMap = null;
            material.update();
            prepare(material);
            expect(material.propertyDescriptors).to.have.lengthOf(39);
            expect(material._uniformBuffer.format.get('texture_diffuseMapTransform0')).to.equal(undefined);

            assign(material);
            expect(material._uniformBuffer.format.get('texture_diffuseMapTransform0')).to.exist;
            material.reset();
            material.update();
            prepare(material);
            expect(material._uniformBuffer.format.get('texture_diffuseMapTransform0')).to.equal(undefined);
            expectStoredDiffuse(material, [1, 1, 1]);
        });

        it('groups the maps sharing a transform on a uv set, and gives an identity transform no group', function () {
            const material = new StandardMaterial();
            material.diffuseMap = texture;
            material.normalMap = texture;
            material.glossMap = texture;
            material.update();
            expect(material._getMapTransformId('diffuse')).to.equal(0);

            material.diffuseMapTiling = new Vec2(2, 2);
            material.normalMapTiling = new Vec2(2, 2);
            material.glossMapTiling = new Vec2(3, 3);
            material.update();
            const diffuseId = material._getMapTransformId('diffuse');
            expect(diffuseId).to.be.greaterThan(0);
            expect(material._getMapTransformId('normal')).to.equal(diffuseId);
            expect(material._getMapTransformId('gloss')).to.not.equal(diffuseId);

            // a different uv set is transformed separately
            material.normalMapUv = 1;
            material.update();
            expect(material._getMapTransformId('normal')).to.not.equal(diffuseId);
        });

        it('lets a mesh instance override a transform uniform once its map is assigned', function () {
            const material = prepare(new StandardMaterial());
            const meshInstance = new MeshInstance(new Mesh(app.graphicsDevice), material);
            meshInstance.setParameter('texture_diffuseMapTransform0', [2, 0, 0.5]);
            expect(meshInstance.getParameter('texture_diffuseMapTransform0').override).to.equal(false);

            assign(material);
            const bindGroup = meshInstance.getMaterialBindGroup(app.graphicsDevice);
            expect(bindGroup).to.exist;
            expect(meshInstance.getParameter('texture_diffuseMapTransform0').override).to.equal(true);
            const copy = meshInstance._materialUniformBuffer;
            const offset = copy.format.get('texture_diffuseMapTransform0').offset;
            expect(Array.from(copy.storageFloat32.subarray(offset, offset + 3))).to.deep.equal([2, 0, 0.5]);
            meshInstance.destroy();
        });

        it('reports a tiling changed in place without update()', function () {
            const warn = sinon.stub(console, 'warn');
            try {
                const material = assign(new StandardMaterial());
                material.diffuseMapTiling.set(2, 2);
                prepare(material);
                expect(warn.callCount).to.equal(1);
                expect(warn.firstCall.args[0]).to.contain('diffuseMapTiling');
            } finally {
                warn.restore();
                for (const message of Debug._loggedMessages) {
                    if (message.includes('diffuseMapTiling')) Debug._loggedMessages.delete(message);
                }
            }
        });

    });

    describe('cube map projection box', function () {

        const boxOf = (cx, cy, cz, hx, hy, hz) => new BoundingBox(new Vec3(cx, cy, cz), new Vec3(hx, hy, hz));

        const useBox = (material, box) => {
            material.cubeMapProjection = CUBEPROJ_BOX;
            material.cubeMapProjectionBox = box;
            material.update();
            return prepare(material);
        };

        it('always holds the box uniforms, zero without a box, and does not change the layout with the projection mode', function () {
            const material = prepare(new StandardMaterial());
            const buffer = material._uniformBuffer;
            const layoutVersion = material.layoutVersion;
            expectStored(material, 'envBoxMin', [0, 0, 0]);
            expectStored(material, 'envBoxMax', [0, 0, 0]);
            expect(material.getUniformBufferProperty('envBoxMin')).to.exist;
            expect(material.parameters.envBoxMin).to.equal(undefined);

            // the box is stored whatever the projection mode, which only selects the shader code
            material.cubeMapProjectionBox = boxOf(1, 2, 3, 4, 5, 6);
            material.update();
            expectStored(material, 'envBoxMin', [-3, -3, -3]);
            expectStored(material, 'envBoxMax', [5, 7, 9]);

            material.cubeMapProjection = CUBEPROJ_BOX;
            material.update();
            prepare(material);
            material.cubeMapProjection = CUBEPROJ_NONE;
            material.update();
            prepare(material);
            expect(material.layoutVersion).to.equal(layoutVersion);
            expect(material._uniformBuffer).to.equal(buffer);

            // removing the box writes zeros again
            material.cubeMapProjectionBox = null;
            material.update();
            expectStored(material, 'envBoxMin', [0, 0, 0]);
            expectStored(material, 'envBoxMax', [0, 0, 0]);
        });

        it('copies the box, and applies a change made through the getter on update()', function () {
            const box = boxOf(0, 0, 0, 1, 1, 1);
            const material = useBox(new StandardMaterial(), box);
            expect(material.cubeMapProjectionBox).to.not.equal(box);
            expect(material.cubeMapProjectionBox.equals(box)).to.equal(true);
            expectStored(material, 'envBoxMin', [-1, -1, -1]);

            // the box of the caller is not the box of the material
            box.center.set(10, 0, 0);
            material.update();
            expectStored(material, 'envBoxMin', [-1, -1, -1]);

            // a change of the box exposed by the getter is applied
            material.cubeMapProjectionBox.center.set(10, 0, 0);
            material.cubeMapProjectionBox.halfExtents.set(2, 2, 2);
            const version = material._uniformDataVersion;
            material.update();
            expect(material._uniformDataVersion).to.equal(version + 1);
            expectStored(material, 'envBoxMin', [8, -2, -2]);
            expectStored(material, 'envBoxMax', [12, 2, 2]);

            // an unchanged box, or an equal box assigned, writes nothing
            material.update();
            material.cubeMapProjectionBox = boxOf(10, 0, 0, 2, 2, 2);
            material.update();
            expect(material._uniformDataVersion).to.equal(version + 1);

            // a different box is copied in, null removes it
            material.cubeMapProjectionBox = boxOf(0, 5, 0, 1, 1, 1);
            material.update();
            expectStored(material, 'envBoxMax', [1, 6, 1]);
            material.cubeMapProjectionBox = null;
            material.update();
            expect(material.cubeMapProjectionBox).to.equal(null);
            expectStored(material, 'envBoxMin', [0, 0, 0]);
            material.update();
        });

        it('keeps the shader variants when the box changes, and reports a change without update()', function () {
            const material = useBox(new StandardMaterial(), boxOf(0, 0, 0, 1, 1, 1));
            const variant = {};
            material.variants.set(1, variant);
            material.cubeMapProjectionBox.center.set(1, 1, 1);
            material.update();
            expect(material.variants.get(1)).to.equal(variant);

            const warn = sinon.stub(console, 'warn');
            try {
                material.cubeMapProjectionBox.center.set(2, 2, 2);
                prepare(material);
                expect(warn.callCount).to.equal(1);
                expect(warn.firstCall.args[0]).to.contain('cubeMapProjectionBox');
            } finally {
                warn.restore();
                for (const message of Debug._loggedMessages) {
                    if (message.includes('cubeMapProjectionBox')) Debug._loggedMessages.delete(message);
                }
            }
        });

        it('lets a mesh instance override the box uniforms', function () {
            const material = useBox(new StandardMaterial(), boxOf(0, 0, 0, 1, 1, 1));
            const meshInstance = new MeshInstance(new Mesh(app.graphicsDevice), material);
            meshInstance.setParameter('envBoxMax', [3, 3, 3]);
            expect(meshInstance.getParameter('envBoxMax').override).to.equal(true);
            const copy = meshInstance._materialUniformBuffer ?? (meshInstance.getMaterialBindGroup(app.graphicsDevice), meshInstance._materialUniformBuffer);
            const offset = copy.format.get('envBoxMax').offset;
            expect(Array.from(copy.storageFloat32.subarray(offset, offset + 3))).to.deep.equal([3, 3, 3]);
            meshInstance.destroy();
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

    describe('textures', function () {

        // the material only holds its textures where there are bind groups to hold them
        const withBindGroups = () => {
            app.graphicsDevice.usesMeshBindGroups = true;
        };

        const texture = name => new Texture(app.graphicsDevice, { name: name, width: 4, height: 4 });

        const slots = material => material.uniformBufferBindGroup.format.textureFormats.map(format => format.name);

        it('holds one slot per texture, so maps sharing one texture share its slot', function () {
            withBindGroups();
            const shared = texture('shared');
            const material = new StandardMaterial();
            material.diffuseMap = shared;
            material.metalnessMap = shared;
            material.update();
            prepare(material);

            expect(slots(material)).to.eql(['texture_diffuseMap']);
        });

        it('follows a map moving from a shared texture to one of its own, and back', function () {
            withBindGroups();
            const shared = texture('shared');
            const own = texture('own');
            const material = new StandardMaterial();
            material.diffuseMap = shared;
            material.metalnessMap = shared;
            material.update();
            prepare(material);
            expect(slots(material)).to.eql(['texture_diffuseMap']);
            const sharedBindGroup = material.uniformBufferBindGroup;

            // the maps no longer share a texture, so the second one needs a slot of its own - and
            // the shaders built against the previous slots can no longer be used with this group
            material.metalnessMap = own;
            material.update();
            const cleared = sinon.spy(material, 'clearVariants');
            prepare(material);
            expect(slots(material)).to.eql(['texture_diffuseMap', 'texture_metalnessMap']);
            expect(material.uniformBufferBindGroup).to.not.equal(sharedBindGroup);
            expect(cleared.called).to.equal(true);
            cleared.restore();

            // and back to sharing
            material.metalnessMap = shared;
            material.update();
            prepare(material);
            expect(slots(material)).to.eql(['texture_diffuseMap']);
        });

        it('keeps the slots of a material whose maps are pointed at other textures without sharing changing', function () {
            withBindGroups();
            const material = new StandardMaterial();
            material.diffuseMap = texture('first');
            material.metalnessMap = texture('second');
            material.update();
            prepare(material);
            const before = material.uniformBufferBindGroup;
            expect(slots(material)).to.eql(['texture_diffuseMap', 'texture_metalnessMap']);

            material.metalnessMap = texture('third');
            material.update();
            const cleared = sinon.spy(material, 'clearVariants');
            prepare(material);

            expect(slots(material)).to.eql(['texture_diffuseMap', 'texture_metalnessMap']);
            expect(material.uniformBufferBindGroup).to.equal(before);
            expect(cleared.called).to.equal(false);
            cleared.restore();
        });

        it('leaves the textures on the scope when the device has no bind groups', function () {
            const material = new StandardMaterial();
            material.diffuseMap = texture('diffuse');
            material.update();
            prepare(material);

            expect(app.graphicsDevice.usesMeshBindGroups).to.equal(false);
            expect(slots(material)).to.eql([]);
        });

    });

});
