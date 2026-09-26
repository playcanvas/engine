import { expect } from 'chai';

import { Color } from '../../../src/core/math/color.js';
import { GltfExporter } from '../../../src/extras/exporters/gltf-exporter.js';
import {
    KHR_materials_diffuse_transmission
} from '../../../src/framework/parsers/glb/extensions/khr-materials-diffuse-transmission.js';
import { StandardMaterial } from '../../../src/scene/materials/standard-material.js';

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
