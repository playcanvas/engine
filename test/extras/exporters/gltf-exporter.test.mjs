import { expect } from 'chai';
import { restore, stub } from 'sinon';

import { Color } from '../../../src/core/math/color.js';
import { GltfExporter } from '../../../src/extras/exporters/gltf-exporter.js';
import { Entity } from '../../../src/framework/entity.js';
import {
    KHR_materials_diffuse_transmission
} from '../../../src/framework/parsers/glb/extensions/khr-materials-diffuse-transmission.js';
import { GlbParser } from '../../../src/framework/parsers/glb-parser.js';
import { PIXELFORMAT_RGBA8 } from '../../../src/platform/graphics/constants.js';
import { StandardMaterial } from '../../../src/scene/materials/standard-material.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('GltfExporter', function () {

    afterEach(function () {
        restore();
    });

    const exportMaterial = (aoIntensity) => {
        const texture = { name: 'ao' };
        const material = new StandardMaterial();
        material.aoMap = texture;
        material.aoMapChannel = 'r';
        material.aoIntensity = aoIntensity;

        const json = {};
        const resources = {
            materials: [material],
            textures: [texture]
        };

        new GltfExporter().writeMaterials(resources, json);

        return json.materials[0];
    };

    it('exports occlusion texture strength', function () {
        const material = exportMaterial(0.5);

        expect(material.occlusionTexture.strength).to.equal(0.5);
    });

    it('exports zero occlusion texture strength', function () {
        const material = exportMaterial(0);

        expect(material.occlusionTexture.strength).to.equal(0);
    });

    it('omits the default occlusion texture strength', function () {
        const material = exportMaterial(1);

        expect(material.occlusionTexture).not.to.have.property('strength');
    });

    const writeMaterial = (material, textures = []) => {
        const json = {};
        new GltfExporter().writeMaterials({ materials: [material], textures }, json);
        return json;
    };

    // the material layers whose gloss is exported as the roughness of a glTF extension, with the
    // material properties that enable each layer and the channel glTF reads the roughness from
    const layers = [{
        extension: 'KHR_materials_clearcoat',
        enable: { clearCoat: 0.25 },
        gloss: 'clearCoatGloss',
        factor: 'clearcoatRoughnessFactor',
        texture: 'clearcoatRoughnessTexture',
        channel: 'g'
    }, {
        extension: 'KHR_materials_sheen',
        enable: { useSheen: true },
        gloss: 'sheenGloss',
        factor: 'sheenRoughnessFactor',
        texture: 'sheenRoughnessTexture',
        channel: 'a'
    }];

    const createMaterial = ({ enable, gloss, channel }, value, invert, map = null) => {
        const material = new StandardMaterial();
        Object.assign(material, enable);
        material[gloss] = value;
        material[`${gloss}Invert`] = invert;
        material[`${gloss}Map`] = map;
        material[`${gloss}MapChannel`] = channel;
        return material;
    };

    // the roughness the layer renders with
    const roughnessOf = ({ gloss }, material) => {
        return material[`${gloss}Invert`] ? material[gloss] : 1 - material[gloss];
    };

    layers.forEach((layer) => {
        const { extension, gloss, factor, texture } = layer;

        describe(extension, function () {

            const exportExtension = (material, textures) => {
                return writeMaterial(material, textures).materials[0].extensions[extension];
            };

            it('exports gloss as roughness', function () {
                const data = exportExtension(createMaterial(layer, 0.8, false));

                expect(data[factor]).to.be.closeTo(0.2, 1e-6);
            });

            it('exports inverted gloss as roughness unchanged', function () {
                const data = exportExtension(createMaterial(layer, 0.3, true));

                expect(data[factor]).to.equal(0.3);
            });

            it('omits the default roughness of zero', function () {
                expect(exportExtension(createMaterial(layer, 1, false))).not.to.have.property(factor);
                expect(exportExtension(createMaterial(layer, 0, true))).not.to.have.property(factor);
            });

            it('exports an inverted gloss map as the roughness texture', function () {
                const warn = stub(console, 'warn');
                const map = { name: 'roughness' };
                const data = exportExtension(createMaterial(layer, 1, true, map), [map]);

                expect(data[texture]).to.deep.equal({ index: 0 });
                expect(warn.called).to.equal(false);
            });

            it('warns that a gloss map is exported as the roughness texture unchanged', function () {
                const warn = stub(console, 'warn');
                const map = { name: 'gloss' };
                const data = exportExtension(createMaterial(layer, 1, false, map), [map]);

                expect(data[texture]).to.deep.equal({ index: 0 });
                expect(warn.calledOnce).to.equal(true);
                expect(warn.firstCall.args[0]).to.include(`${gloss}Map`);
            });
        });
    });

    it('omits a black sheen, which disables the sheen layer', function () {
        const material = new StandardMaterial();
        material.useSheen = true;
        material.sheen.set(0, 0, 0);

        expect(writeMaterial(material).extensionsUsed ?? []).not.to.include('KHR_materials_sheen');
    });

    // the glTF textures that are read from fixed channels, by their path in a glTF material, with
    // the maps exported as each texture, the channel glTF reads each map from, the material
    // properties that export the texture, and whether the exporter moves the channel the material
    // samples into the one glTF reads
    const channelTextures = [{
        path: ['pbrMetallicRoughness', 'baseColorTexture'],
        maps: { diffuseMap: 'rgb' }
    }, {
        path: ['pbrMetallicRoughness', 'metallicRoughnessTexture'],
        maps: { metalnessMap: 'b', glossMap: 'g' },
        enable: { glossInvert: true }
    }, {
        path: ['occlusionTexture'],
        maps: { aoMap: 'r' }
    }, {
        path: ['emissiveTexture'],
        maps: { emissiveMap: 'rgb' }
    }, {
        path: ['extensions', 'KHR_materials_clearcoat', 'clearcoatTexture'],
        maps: { clearCoatMap: 'r' },
        enable: { clearCoat: 0.25 }
    }, {
        path: ['extensions', 'KHR_materials_clearcoat', 'clearcoatRoughnessTexture'],
        maps: { clearCoatGlossMap: 'g' },
        enable: { clearCoat: 0.25, clearCoatGlossInvert: true }
    }, {
        path: ['extensions', 'KHR_materials_diffuse_transmission', 'diffuseTransmissionTexture'],
        maps: { diffuseTransmissionMap: 'a' },
        enable: { diffuseTransmission: 1 },
        moved: true
    }, {
        path: ['extensions', 'KHR_materials_diffuse_transmission', 'diffuseTransmissionColorTexture'],
        maps: { diffuseTransmissionColorMap: 'rgb' },
        enable: { diffuseTransmission: 1 }
    }, {
        path: ['extensions', 'KHR_materials_iridescence', 'iridescenceTexture'],
        maps: { iridescenceMap: 'r' },
        enable: { useIridescence: true }
    }, {
        path: ['extensions', 'KHR_materials_iridescence', 'iridescenceThicknessTexture'],
        maps: { iridescenceThicknessMap: 'g' },
        enable: { useIridescence: true }
    }, {
        path: ['extensions', 'KHR_materials_sheen', 'sheenColorTexture'],
        maps: { sheenMap: 'rgb' },
        enable: { useSheen: true }
    }, {
        path: ['extensions', 'KHR_materials_sheen', 'sheenRoughnessTexture'],
        maps: { sheenGlossMap: 'a' },
        enable: { useSheen: true, sheenGlossInvert: true }
    }, {
        path: ['extensions', 'KHR_materials_specular', 'specularColorTexture'],
        maps: { specularMap: 'rgb' },
        enable: { useMetalnessSpecularColor: true }
    }, {
        path: ['extensions', 'KHR_materials_specular', 'specularTexture'],
        maps: { specularityFactorMap: 'a' },
        enable: { useMetalnessSpecularColor: true }
    }, {
        path: ['extensions', 'KHR_materials_transmission', 'transmissionTexture'],
        maps: { refractionMap: 'r' },
        enable: { useDynamicRefraction: true }
    }, {
        path: ['extensions', 'KHR_materials_volume', 'thicknessTexture'],
        maps: { thicknessMap: 'g' },
        enable: { useDynamicRefraction: true }
    }];

    const valueAt = (object, path) => path.reduce((value, key) => value?.[key], object);

    describe('texture channels', function () {

        channelTextures.forEach(({ path, maps, enable, moved }) => {

            const name = path[path.length - 1];

            describe(name, function () {

                // exports a material that samples each map from the given channel of one texture
                const exportTexture = (channels) => {
                    const texture = { name: 'texture' };
                    const material = new StandardMaterial();
                    Object.assign(material, enable);
                    Object.entries(channels).forEach(([map, channel]) => {
                        material[map] = texture;
                        material[`${map}Channel`] = channel;
                    });

                    const json = {};
                    new GltfExporter().writeMaterials({ materials: [material], textures: [texture] }, json);
                    return valueAt(json.materials[0], path);
                };

                const sampled = Object.entries(maps).map(([map, channel]) => `${map} from channel '${channel}'`);

                it(`exports ${sampled.join(' and ')}`, function () {
                    const warn = stub(console, 'warn');

                    expect(exportTexture(maps)).to.deep.equal({ index: 0 });
                    expect(warn.called).to.equal(false);
                });

                // a map whose channel the exporter moves is covered by the KHR_materials_diffuse_transmission tests
                if (moved) {
                    return;
                }

                Object.entries(maps).forEach(([map, channel]) => {
                    const other = channel === 'g' ? 'r' : 'g';

                    it(`warns that ${map} sampled from channel '${other}' is exported unchanged`, function () {
                        const warn = stub(console, 'warn');

                        expect(exportTexture({ ...maps, [map]: other })).to.deep.equal({ index: 0 });
                        expect(warn.calledOnce).to.equal(true);
                        expect(warn.firstCall.args[0]).to.include(`${map}Channel set to '${other}'`);
                        expect(warn.firstCall.args[0]).to.include(`reads ${name} from channel '${channel}'`);
                    });
                });
            });
        });

        describe('gloss map', function () {

            // exports the metallic-roughness properties of a material that samples its maps from the
            // channels glTF reads, where only the metalness map can be exported
            const exportPbr = (glossMap, metalnessMap, glossInvert = true) => {
                const material = new StandardMaterial();
                material.glossMap = glossMap;
                material.glossInvert = glossInvert;
                material.metalnessMap = metalnessMap;
                material.metalnessMapChannel = 'b';

                const json = {};
                new GltfExporter().writeMaterials({ materials: [material], textures: [metalnessMap] }, json);
                return json.materials[0].pbrMetallicRoughness;
            };

            it('warns that a gloss map is exported as the roughness texture unchanged', function () {
                const warn = stub(console, 'warn');
                const map = { name: 'metalnessGloss' };
                const pbr = exportPbr(map, map, false);

                expect(pbr.metallicRoughnessTexture).to.deep.equal({ index: 0 });
                expect(warn.calledOnce).to.equal(true);
                expect(warn.firstCall.args[0]).to.include('glossInvert set to false');
            });

            it('warns that a gloss map without a metalness map isn\'t exported', function () {
                const warn = stub(console, 'warn');
                const pbr = exportPbr({ name: 'gloss' }, null);

                expect(pbr).not.to.have.property('metallicRoughnessTexture');
                expect(warn.calledOnce).to.equal(true);
                expect(warn.firstCall.args[0]).to.include('the same texture for glossMap and metalnessMap');
            });

            it('warns that a gloss map other than the metalness map isn\'t exported', function () {
                const warn = stub(console, 'warn');
                const pbr = exportPbr({ name: 'gloss' }, { name: 'metalness' });

                expect(pbr.metallicRoughnessTexture).to.deep.equal({ index: 0 });
                expect(warn.calledOnce).to.equal(true);
                expect(warn.firstCall.args[0]).to.include('the same texture for glossMap and metalnessMap');
            });

            it('warns that glTF reads roughness from a metalness map without a gloss map', function () {
                const warn = stub(console, 'warn');
                const pbr = exportPbr(null, { name: 'metalness' });

                expect(pbr.metallicRoughnessTexture).to.deep.equal({ index: 0 });
                expect(warn.calledOnce).to.equal(true);
                expect(warn.firstCall.args[0]).to.include('reads roughness from channel \'g\' of metallicRoughnessTexture');
            });
        });
    });

    describe('round trip', function () {

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

        // exports the material and imports it back with the glTF parser
        const reimport = (material) => {
            const gltf = {
                asset: { version: '2.0' },
                scenes: [],
                nodes: [],
                ...writeMaterial(material)
            };
            const data = new TextEncoder().encode(JSON.stringify(gltf));

            return new Promise((resolve, reject) => {
                GlbParser.parse('material.gltf', '', data, app.graphicsDevice, app.assets, {}, [], (err, result) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(result.materials[0]);
                    }
                });
            });
        };

        layers.forEach((layer) => {
            [[0.8, false], [0.3, true], [1, false], [0, false]].forEach(([value, invert]) => {
                it(`reimports ${layer.extension} with ${invert ? 'inverted ' : ''}gloss of ${value} as the same roughness`, async function () {
                    const material = createMaterial(layer, value, invert);
                    const reimported = await reimport(material);

                    expect(reimported).to.include(layer.enable);
                    expect(roughnessOf(layer, reimported)).to.be.closeTo(roughnessOf(layer, material), 1e-6);
                });
            });
        });

        // the sheen color the material renders with, which is black when the sheen layer is off
        const sheenOf = material => (material.useSheen ? material.sheen : Color.BLACK);

        [['black', [0, 0, 0]], ['white', [1, 1, 1]], ['colored', [0.5, 0.25, 1]]].forEach(([name, [r, g, b]]) => {
            it(`reimports a ${name} sheen with the default gloss as the same sheen color`, async function () {
                const material = new StandardMaterial();
                material.useSheen = true;
                material.sheen.set(r, g, b);

                const expected = sheenOf(material);
                const actual = sheenOf(await reimport(material));

                expect(actual.r).to.be.closeTo(expected.r, 1e-6);
                expect(actual.g).to.be.closeTo(expected.g, 1e-6);
                expect(actual.b).to.be.closeTo(expected.b, 1e-6);
            });
        });

        it('exports the textures of a material imported from glTF without warnings', async function () {
            // a glTF material with each texture, using an image of its own
            const gltfMaterial = {
                extensions: {
                    KHR_materials_clearcoat: { clearcoatFactor: 1 },
                    KHR_materials_diffuse_transmission: { diffuseTransmissionFactor: 1 }
                }
            };
            channelTextures.forEach(({ path }, index) => {
                const parent = path.slice(0, -1).reduce((object, key) => {
                    object[key] = object[key] ?? {};
                    return object[key];
                }, gltfMaterial);
                parent[path[path.length - 1]] = { index };
            });

            const images = channelTextures.map((texture, index) => ({ name: `image${index}` }));
            const gltf = {
                asset: { version: '2.0' },
                scenes: [],
                nodes: [],
                images,
                textures: images.map((image, index) => ({ source: index })),
                materials: [gltfMaterial]
            };
            const data = new TextEncoder().encode(JSON.stringify(gltf));

            // supply each image as a texture rather than loading it
            const imageTextures = images.map(({ name }) => ({ name }));
            const options = {
                image: {
                    processAsync: (gltfImage, callback) => {
                        callback(null, { resource: imageTextures.find(texture => texture.name === gltfImage.name) });
                    }
                }
            };

            const material = await new Promise((resolve, reject) => {
                GlbParser.parse('material.gltf', '', data, app.graphicsDevice, app.assets, options, [], (err, result) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(result.materials[0]);
                    }
                });
            });

            const warn = stub(console, 'warn');
            const json = {};
            new GltfExporter().writeMaterials({ materials: [material], textures: imageTextures }, json);

            channelTextures.forEach(({ path }, index) => {
                expect(valueAt(json.materials[0], path)).to.deep.equal({ index });
            });
            expect(warn.called).to.equal(false);
        });
    });

    describe('KHR_materials_diffuse_transmission', function () {

        const exportTransmission = (setup) => {
            const material = new StandardMaterial();
            setup(material);

            const json = {};
            const maps = [material.diffuseTransmissionMap, material.diffuseTransmissionColorMap];
            const textures = maps.filter(Boolean);
            new GltfExporter().writeMaterials({ materials: [material], textures }, json);

            return { json, textures };
        };

        it('exports the transmission, its linear color and its textures', function () {
            const { json } = exportTransmission((material) => {
                material.diffuseTransmission = 0.25;
                material.diffuseTransmissionColor = new Color(1, 0.5, 0.25);
                material.diffuseTransmissionMap = { name: 'transmission' };
                material.diffuseTransmissionMapChannel = 'a';
                material.diffuseTransmissionColorMap = { name: 'transmission color' };
                material.diffuseTransmissionColorMapUv = 1;
            });

            const extension = json.materials[0].extensions.KHR_materials_diffuse_transmission;
            expect(extension.diffuseTransmissionFactor).to.equal(0.25);
            const { r, g, b } = new Color(1, 0.5, 0.25).linear();
            expect(extension.diffuseTransmissionColorFactor).to.deep.equal([r, g, b]);
            expect(extension.diffuseTransmissionTexture).to.deep.equal({ index: 0 });
            const colorTexture = extension.diffuseTransmissionColorTexture;
            expect(colorTexture).to.deep.equal({ index: 1, texCoord: 1 });
            expect(json.extensionsUsed).to.include('KHR_materials_diffuse_transmission');
        });

        it('omits the default color', function () {
            const { json } = exportTransmission((material) => {
                material.diffuseTransmission = 1;
            });

            const extension = json.materials[0].extensions.KHR_materials_diffuse_transmission;
            expect(extension).to.deep.equal({ diffuseTransmissionFactor: 1 });
        });

        it('omits the extension when the material transmits no light', function () {
            const { json } = exportTransmission((material) => {
                material.diffuseTransmissionColor = new Color(1, 0, 0);
            });

            const extensions = json.materials[0].extensions ?? {};
            expect(extensions).not.to.have.property('KHR_materials_diffuse_transmission');
            expect(json.extensionsUsed ?? []).not.to.include('KHR_materials_diffuse_transmission');
        });

        describe('the channel of the transmission map', function () {

            let app;

            beforeEach(function () {
                jsdomSetup();
                app = createApp();
            });

            afterEach(function () {
                app.destroy();
                jsdomTeardown();
            });

            // the resources of an export of a box rendered with the material
            const collect = (exporter, material) => {
                const entity = new Entity('box', app);
                entity.addComponent('render', { type: 'box', material });
                return exporter.collectResources(entity);
            };

            const transmissive = (texture) => {
                const material = new StandardMaterial();
                material.diffuseTransmission = 1;
                material.diffuseTransmissionMap = texture;
                return material;
            };

            it('exports a map read from another channel as a copy, not the texture', function () {
                const exporter = new GltfExporter();
                const texture = { name: 'transmission' };
                const material = transmissive(texture);
                material.diffuseMap = texture;
                const resources = collect(exporter, material);

                // glTF reads the transmission from alpha, the material from green by default
                const json = {};
                exporter.writeMaterials(resources, json);
                const extension = json.materials[0].extensions.KHR_materials_diffuse_transmission;
                const copy = resources.textures[extension.diffuseTransmissionTexture.index];
                expect(copy).to.not.equal(texture);
                expect(copy).to.include({ texture, source: 'g', target: 'a' });

                const baseColorTexture = json.materials[0].pbrMetallicRoughness.baseColorTexture;
                expect(resources.textures[baseColorTexture.index]).to.equal(texture);
            });

            it('exports a map read from alpha as it is', function () {
                const exporter = new GltfExporter();
                const texture = { name: 'transmission' };
                const material = transmissive(texture);
                material.diffuseTransmissionMapChannel = 'a';
                const resources = collect(exporter, material);

                expect(resources.textures).to.deep.equal([texture]);
            });

            it('moves the sampled channel into alpha, before a canvas holds it', async function () {
                const exporter = new GltfExporter();
                const material = transmissive({ name: 'transmission', width: 3, height: 1 });
                const resources = collect(exporter, material);

                // An opaque black texel transmits nothing, and a green one with zero alpha
                // everything - a canvas would have lost its green, as it premultiplies by alpha.
                // The texture is sampled into a linear target, which decodes sRGB.
                const read = [];
                exporter.readTexturePixels = (texture, width, height, format) => {
                    read.push({ width, height, format });
                    const texels = [0, 0, 0, 255, 0, 255, 0, 0, 0, 55, 0, 255];
                    return Promise.resolve(new Uint8Array(texels));
                };
                exporter.pixelsToCanvas = (pixels, width, height) => ({ pixels, width, height });
                const canvases = exporter.convertTextures(resources.textures, {});
                const [converted] = await Promise.all(canvases);

                expect(read).to.deep.equal([{ width: 3, height: 1, format: PIXELFORMAT_RGBA8 }]);
                const moved = [0, 0, 0, 0, 0, 255, 0, 255, 0, 55, 0, 55];
                expect(Array.from(converted.pixels)).to.deep.equal(moved);
            });
        });

        it('exports what the importer reads back', function () {
            const { json, textures } = exportTransmission((material) => {
                material.diffuseTransmission = 0.75;
                material.diffuseTransmissionColor = new Color(0.2, 0.4, 0.6);
            });

            const imported = new StandardMaterial();
            const extension = json.materials[0].extensions.KHR_materials_diffuse_transmission;
            KHR_materials_diffuse_transmission.apply(extension, imported, textures);
            expect(imported.diffuseTransmission).to.equal(0.75);
            expect(imported.diffuseTransmissionColor.r).to.be.closeTo(0.2, 1e-6);
            expect(imported.diffuseTransmissionColor.g).to.be.closeTo(0.4, 1e-6);
            expect(imported.diffuseTransmissionColor.b).to.be.closeTo(0.6, 1e-6);
        });
    });
});
