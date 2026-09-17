import { expect } from 'chai';

import { GlbParser } from '../../../src/framework/parsers/glb-parser.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('GlbParser', function () {

    let app;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
    });

    afterEach(function () {
        app?.destroy();
        app = null;
        jsdomTeardown();
    });

    const parseMaterial = (occlusionTexture) => {
        const gltf = {
            asset: { version: '2.0' },
            scenes: [],
            nodes: [],
            materials: [{ occlusionTexture }]
        };
        const data = new TextEncoder().encode(JSON.stringify(gltf));

        return new Promise((resolve, reject) => {
            GlbParser.parse('material.gltf', '', data, app.graphicsDevice, app.assets, {}, (err, result) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result.materials[0]);
                }
            });
        });
    };

    it('imports occlusion texture strength', async function () {
        const material = await parseMaterial({ index: 0, strength: 0.5 });

        expect(material.aoIntensity).to.equal(0.5);
    });

    it('imports zero occlusion texture strength', async function () {
        const material = await parseMaterial({ index: 0, strength: 0 });

        expect(material.aoIntensity).to.equal(0);
    });

    it('uses the default occlusion texture strength when omitted', async function () {
        const material = await parseMaterial({ index: 0 });

        expect(material.aoIntensity).to.equal(1);
    });

    it('uses the asset registry application for cameras and lights', async function () {
        const gltf = {
            asset: { version: '2.0' },
            scene: 0,
            scenes: [{ nodes: [0, 1] }],
            nodes: [
                { name: 'CameraNode', camera: 0 },
                {
                    name: 'LightNode',
                    extensions: {
                        KHR_lights_punctual: { light: 0 }
                    }
                }
            ],
            cameras: [{
                name: 'Camera',
                type: 'perspective',
                perspective: {
                    yfov: Math.PI / 4,
                    znear: 0.1,
                    zfar: 1000
                }
            }],
            extensions: {
                KHR_lights_punctual: {
                    lights: [{ type: 'point' }]
                }
            }
        };
        const data = new TextEncoder().encode(JSON.stringify(gltf));
        const app2 = createApp();

        try {
            const result = await new Promise((resolve, reject) => {
                GlbParser.parse('components.gltf', '', data, app.graphicsDevice, app.assets, {}, (err, result) => {
                    if (err) reject(err);
                    else resolve(result);
                });
            });

            const cameraEntity = result.cameras.get(result.gltf.nodes[0]);
            const lightEntity = result.lights.get(result.gltf.nodes[1]);

            expect(cameraEntity._app).to.equal(app);
            expect(cameraEntity.camera.system).to.equal(app.systems.camera);
            expect(lightEntity._app).to.equal(app);
            expect(lightEntity.light.system).to.equal(app.systems.light);
        } finally {
            app2.destroy();
        }
    });

    describe('flat shading of primitives without normals', function () {

        // three vertices, and indices referencing all three of them - enough to form a single
        // triangle, or three points, depending on the primitive mode used
        const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
        const indices = new Uint16Array([0, 1, 2]);
        const bytes = new Uint8Array(positions.byteLength + indices.byteLength);
        bytes.set(new Uint8Array(positions.buffer), 0);
        bytes.set(new Uint8Array(indices.buffer), positions.byteLength);
        const bufferUri = `data:application/octet-stream;base64,${Buffer.from(bytes).toString('base64')}`;

        // glTF primitive modes, see the mesh.primitive.mode schema
        const MODE_POINTS = 0;
        const MODE_TRIANGLE_STRIP = 5;

        /**
         * Parses a glTF containing a single primitive built from the vertex data above. Accessor 0
         * holds the positions, accessor 1 the normals, and accessor 2 the indices.
         *
         * @param {object} [options] - The primitive options.
         * @param {boolean} [options.normals] - True to supply the NORMAL attribute. Defaults to false.
         * @param {number} [options.mode] - The glTF primitive mode. Omitted means triangles, which is
         * the glTF default.
         * @param {boolean} [options.material] - False to leave the primitive without a material of its
         * own. Defaults to true.
         * @returns {Promise<object>} The parse result.
         */
        const parsePrimitive = ({ normals = false, mode, material = true } = {}) => {
            const primitive = {
                attributes: normals ? { POSITION: 0, NORMAL: 1 } : { POSITION: 0 },
                indices: 2
            };
            if (material) {
                primitive.material = 0;
            }
            if (mode !== undefined) {
                primitive.mode = mode;
            }

            const gltf = {
                asset: { version: '2.0' },
                scene: 0,
                scenes: [{ nodes: [0] }],
                nodes: [{ mesh: 0 }],
                meshes: [{ primitives: [primitive] }],
                materials: [{ name: 'primitiveMaterial' }],
                accessors: [
                    { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] },
                    { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3' },
                    { bufferView: 1, componentType: 5123, count: 3, type: 'SCALAR' }
                ],
                bufferViews: [
                    { buffer: 0, byteOffset: 0, byteLength: positions.byteLength },
                    { buffer: 0, byteOffset: positions.byteLength, byteLength: indices.byteLength }
                ],
                buffers: [{ byteLength: bytes.length, uri: bufferUri }]
            };
            const data = new TextEncoder().encode(JSON.stringify(gltf));

            return new Promise((resolve, reject) => {
                GlbParser.parse('primitive.gltf', '', data, app.graphicsDevice, app.assets, {}, (err, result) => {
                    if (err) reject(err);
                    else resolve(result);
                });
            });
        };

        it('flat shades a triangle primitive without normals, using a material clone', async function () {
            const result = await parsePrimitive();

            // the source material is untouched, and a flat shaded clone is appended
            expect(result.materials.length).to.equal(2);
            expect(result.materials[0].flatShading).to.equal(false);
            expect(result.materials[1].flatShading).to.equal(true);
            expect(result.materials[1].name).to.equal('primitiveMaterial-flatShaded');

            // the mesh uses the clone
            const mesh = result.renders[0].meshes[0];
            expect(result.meshDefaultMaterials[mesh.id]).to.equal(1);
        });

        it('flat shades a triangle strip primitive without normals', async function () {
            const result = await parsePrimitive({ mode: MODE_TRIANGLE_STRIP });

            expect(result.materials.length).to.equal(2);
            expect(result.materials[1].flatShading).to.equal(true);
        });

        it('does not flat shade a primitive which supplies normals', async function () {
            const result = await parsePrimitive({ normals: true });

            expect(result.materials.length).to.equal(1);
            expect(result.materials[0].flatShading).to.equal(false);

            const mesh = result.renders[0].meshes[0];
            expect(result.meshDefaultMaterials[mesh.id]).to.equal(0);
        });

        it('does not flat shade a points primitive, which has no face normal', async function () {
            const result = await parsePrimitive({ mode: MODE_POINTS });

            expect(result.materials.length).to.equal(1);
            expect(result.materials[0].flatShading).to.equal(false);
        });

        it('builds a flat shaded default material for a primitive with no material of its own', async function () {
            const result = await parsePrimitive({ material: false });

            // such a primitive is otherwise rendered with the glTF default material, which is shared
            // by the container and so must not be modified - a matching one is appended instead
            expect(result.materials.length).to.equal(2);
            expect(result.materials[1].flatShading).to.equal(true);
            expect(result.materials[1].name).to.equal('defaultGlbMaterial-flatShaded');

            const mesh = result.renders[0].meshes[0];
            expect(result.meshDefaultMaterials[mesh.id]).to.equal(1);
        });
    });
});
