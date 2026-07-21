import { expect } from 'chai';

import { GltfExporter } from '../../../src/extras/exporters/gltf-exporter.js';
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
});
