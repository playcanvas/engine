import { expect } from 'chai';

import { Color } from '../../../src/core/math/color.js';
import { GltfExporter } from '../../../src/extras/exporters/gltf-exporter.js';
import { Entity } from '../../../src/framework/entity.js';
import {
    KHR_materials_diffuse_transmission
} from '../../../src/framework/parsers/glb/extensions/khr-materials-diffuse-transmission.js';
import { PIXELFORMAT_RGBA8 } from '../../../src/platform/graphics/constants.js';
import { StandardMaterial } from '../../../src/scene/materials/standard-material.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('GltfExporter', function () {

    const exportMaterial = (aoIntensity) => {
        const texture = { name: 'ao' };
        const material = new StandardMaterial();
        material.aoMap = texture;
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
