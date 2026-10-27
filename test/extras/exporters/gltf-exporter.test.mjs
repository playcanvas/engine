import { expect } from 'chai';
import { restore, stub } from 'sinon';

import { GltfExporter } from '../../../src/extras/exporters/gltf-exporter.js';
import { GlbParser } from '../../../src/framework/parsers/glb-parser.js';
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

    // the material layers whose gloss is exported as the roughness of a glTF extension, with the
    // material properties that enable each layer
    const layers = [{
        extension: 'KHR_materials_clearcoat',
        enable: { clearCoat: 0.25 },
        gloss: 'clearCoatGloss',
        factor: 'clearcoatRoughnessFactor',
        texture: 'clearcoatRoughnessTexture'
    }, {
        extension: 'KHR_materials_sheen',
        enable: { useSheen: true },
        gloss: 'sheenGloss',
        factor: 'sheenRoughnessFactor',
        texture: 'sheenRoughnessTexture'
    }];

    layers.forEach(({ extension, enable, gloss, factor, texture }) => {

        describe(extension, function () {

            afterEach(function () {
                restore();
            });

            const createMaterial = (value, invert, map = null) => {
                const material = new StandardMaterial();
                Object.assign(material, enable);
                material[gloss] = value;
                material[`${gloss}Invert`] = invert;
                material[`${gloss}Map`] = map;
                return material;
            };

            // the roughness the material renders with
            const roughnessOf = (material) => {
                return material[`${gloss}Invert`] ? material[gloss] : 1 - material[gloss];
            };

            const writeMaterial = (material, textures = []) => {
                const json = {};
                new GltfExporter().writeMaterials({ materials: [material], textures }, json);
                return json;
            };

            const exportExtension = (material, textures) => {
                return writeMaterial(material, textures).materials[0].extensions[extension];
            };

            it('exports gloss as roughness', function () {
                const data = exportExtension(createMaterial(0.8, false));

                expect(data[factor]).to.be.closeTo(0.2, 1e-6);
            });

            it('exports inverted gloss as roughness unchanged', function () {
                const data = exportExtension(createMaterial(0.3, true));

                expect(data[factor]).to.equal(0.3);
            });

            it('omits the default roughness of zero', function () {
                expect(exportExtension(createMaterial(1, false))).not.to.have.property(factor);
                expect(exportExtension(createMaterial(0, true))).not.to.have.property(factor);
            });

            it('exports an inverted gloss map as the roughness texture', function () {
                const warn = stub(console, 'warn');
                const map = { name: 'roughness' };
                const data = exportExtension(createMaterial(1, true, map), [map]);

                expect(data[texture]).to.deep.equal({ index: 0 });
                expect(warn.called).to.equal(false);
            });

            it('warns that a gloss map is exported as the roughness texture unchanged', function () {
                const warn = stub(console, 'warn');
                const map = { name: 'gloss' };
                const data = exportExtension(createMaterial(1, false, map), [map]);

                expect(data[texture]).to.deep.equal({ index: 0 });
                expect(warn.calledOnce).to.equal(true);
                expect(warn.firstCall.args[0]).to.include(`${gloss}Map`);
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

                [[0.8, false], [0.3, true], [1, false], [0, false]].forEach(([value, invert]) => {
                    it(`reimports ${invert ? 'inverted ' : ''}gloss of ${value} as the same roughness`, async function () {
                        const material = createMaterial(value, invert);
                        const reimported = await reimport(material);

                        expect(reimported).to.include(enable);
                        expect(roughnessOf(reimported)).to.be.closeTo(roughnessOf(material), 1e-6);
                    });
                });
            });
        });
    });
});
