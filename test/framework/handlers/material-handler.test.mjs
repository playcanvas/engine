import { expect } from 'chai';

import { Asset } from '../../../src/framework/asset/asset.js';
import { Entity } from '../../../src/framework/entity.js';
import { PIXELFORMAT_RGBA8, TEXTURETYPE_SWIZZLEGGGR } from '../../../src/platform/graphics/constants.js';
import { Texture } from '../../../src/platform/graphics/texture.js';
import { CameraShaderParams } from '../../../src/scene/camera-shader-params.js';
import { SHADER_FORWARD } from '../../../src/scene/constants.js';
import { BoxGeometry } from '../../../src/scene/geometry/box-geometry.js';
import { GraphNode } from '../../../src/scene/graph-node.js';
import { LightList } from '../../../src/scene/lighting/light-list.js';
import { StandardMaterial } from '../../../src/scene/materials/standard-material.js';
import { MeshInstance } from '../../../src/scene/mesh-instance.js';
import { Mesh } from '../../../src/scene/mesh.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('MaterialHandler', function () {

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

    // engine-only path: material loaded from a json url
    it('loads a material from a url', function (done) {
        const asset = new Asset('red', 'material', {
            url: '/test/assets/sprites/red-material.json'
        });

        asset.ready(() => {
            const material = asset.resource;
            expect(material).to.be.an.instanceof(StandardMaterial);
            expect(material.diffuse.r).to.equal(1);
            expect(material.diffuse.g).to.equal(0);
            expect(material.diffuse.b).to.equal(0);
            done();
        });
        asset.on('error', err => done(new Error(err)));

        app.assets.add(asset);
        app.assets.load(asset);
    });

    // the url-loaded source data is copied into the asset during patch (the _engine flow), and the
    // asset name is patched over the material name
    it('copies url-loaded data into the asset and patches the name', function (done) {
        const asset = new Asset('red-material-name', 'material', {
            url: '/test/assets/sprites/red-material.json'
        });

        asset.ready(() => {
            expect(asset.data.diffuse).to.deep.equal([1, 0, 0]);
            expect(asset.data.name).to.equal('red-material-name');
            expect(asset.resource.name).to.equal('red-material-name');
            done();
        });
        asset.on('error', err => done(new Error(err)));

        app.assets.add(asset);
        app.assets.load(asset);
    });

    // the editor-dominant path: a material asset with no file is opened directly from its data
    it('opens a material from asset data when there is no file', function (done) {
        const asset = new Asset('green', 'material', null, {
            diffuse: [0, 1, 0]
        });

        asset.ready(() => {
            const material = asset.resource;
            expect(material).to.be.an.instanceof(StandardMaterial);
            expect(material.diffuse.r).to.equal(0);
            expect(material.diffuse.g).to.equal(1);
            expect(material.diffuse.b).to.equal(0);
            done();
        });
        asset.on('error', err => done(new Error(err)));

        app.assets.add(asset);
        app.assets.load(asset);
    });

    // legacy data is migrated on parse (mapping_format is the old name for mappingFormat)
    it('migrates legacy data fields when parsing', function (done) {
        const asset = new Asset('legacy', 'material', null, {
            diffuse: [0, 0, 1],
            mapping_format: 'path'
        });

        asset.ready(() => {
            expect(asset.data.mappingFormat).to.equal('path');
            expect(asset.data.mapping_format).to.be.undefined;
            done();
        });
        asset.on('error', err => done(new Error(err)));

        app.assets.add(asset);
        app.assets.load(asset);
    });

    describe('placeholder textures', function () {

        const lightList = new LightList();
        const cameraShaderParams = new CameraShaderParams();

        const PATH_MAPPED_URL = '/test/assets/materials/path-mapped.json';
        const textureUrl = name => `/test/assets/materials/textures/${name}.png`;

        // a texture asset whose load the test completes, see completeLoad
        const pendingTexture = (name, data = {}, file = { url: textureUrl(name) }, id) => {
            const asset = new Asset(name, 'texture', file, data);
            if (id !== undefined) {
                asset.id = id;
            }
            asset.loading = true;
            app.assets.add(asset);
            return asset;
        };

        // completes the load of a pending texture asset with the texture the texture handler
        // creates for a PNG or JPG image, and fires the events the asset registry fires
        const completeLoad = (asset) => {
            const options = app.loader.getHandler('texture')._getTextureOptions(asset);
            asset.resource = new Texture(app.graphicsDevice, { width: 4, height: 4, format: PIXELFORMAT_RGBA8, ...options });
            asset.loading = false;
            asset.loaded = true;
            app.assets.fire('load', asset);
            app.assets.fire(`load:${asset.id}`, asset);
            app.assets.fire(`load:url:${asset.file.url}`, asset);
            asset.fire('load', asset);
        };

        const loadMaterial = asset => new Promise((resolve, reject) => {
            asset.ready(() => resolve(asset.resource));
            asset.on('error', err => reject(new Error(err)));
            app.assets.add(asset);
            app.assets.load(asset);
        });

        const meshInstance = material => new MeshInstance(Mesh.fromGeometry(app.graphicsDevice, new BoxGeometry()), material, new GraphNode());

        // the shader the renderer draws the mesh instance with in the forward pass
        const drawnShader = (instance) => {
            instance.material.prepareForRender(app.graphicsDevice, app.scene);
            const viewUniformFormat = app.renderer.getViewUniformFormat(false, lightList);
            return instance.getShaderInstance(SHADER_FORWARD, lightList, app.scene, cameraShaderParams, viewUniformFormat).shader;
        };

        // the shader the material needs as it is now, generated again rather than taken from the
        // shaders of the material, which a change it did not detect leaves in place
        const neededShader = (instance) => {
            instance.material.clearVariants();
            return drawnShader(instance);
        };

        // the shader drawn with placeholders is the one the loaded textures need: no shader is
        // generated when they load, and the one drawn is not a stale one
        const expectSameShaderAfterLoad = (material, textureAssets) => {
            const instance = meshInstance(material);
            const shader = drawnShader(instance);
            for (const asset of textureAssets) {
                completeLoad(asset);
                expect(material[asset.name]).to.equal(asset.resource);
                expect(drawnShader(instance)).to.equal(shader);
            }
            expect(neededShader(instance)).to.equal(shader);
        };

        const loadById = (diffuse, gloss) => loadMaterial(new Asset('material', 'material', null, {
            useMetalness: true, diffuseMap: diffuse.id, glossMap: gloss.id
        }));

        // the ways a material references its textures: by the ids of the assets of a project, by
        // the ids of assets created at runtime, which are negative, and by paths from the material
        const referenceKinds = [
            { label: 'asset ids', ids: [1001, 1002], load: loadById },
            { label: 'ids of runtime assets', ids: [undefined, undefined], load: loadById },
            { label: 'paths', ids: [undefined, undefined], load: () => loadMaterial(new Asset('material', 'material', { url: PATH_MAPPED_URL })) }
        ];

        // an sRGB color map and a linear map, the placeholders of which were of one format
        const colorAndGloss = kind => [
            pendingTexture('diffuseMap', { srgb: true }, { url: textureUrl('diffuse') }, kind.ids[0]),
            pendingTexture('glossMap', {}, { url: textureUrl('gloss') }, kind.ids[1])
        ];

        referenceKinds.forEach((kind) => {
            it(`assigns placeholders to maps referencing textures by ${kind.label}, which load without changing the shader`, async function () {
                const [diffuse, gloss] = colorAndGloss(kind);
                const material = await kind.load(diffuse, gloss);

                const placeholders = app.loader.getHandler('material')._placeholders;
                expect(placeholders.has(material.diffuseMap)).to.equal(true);
                expect(placeholders.has(material.glossMap)).to.equal(true);
                expect(material.diffuseMap).to.not.equal(material.glossMap);
                expect(material.diffuseMap.encoding).to.equal('linear');
                expect(material.glossMap.encoding).to.equal('srgb');

                expectSameShaderAfterLoad(material, [gloss, diffuse]);
            });

            it(`keeps the loaded textures of maps referencing them by ${kind.label}`, async function () {
                const [diffuse, gloss] = colorAndGloss(kind);
                completeLoad(diffuse);
                completeLoad(gloss);
                const material = await kind.load(diffuse, gloss);

                expect(material.diffuseMap).to.equal(diffuse.resource);
                expect(material.glossMap).to.equal(gloss.resource);
            });
        });

        it('gives maps referencing one texture asset one placeholder, and others their own', async function () {
            const packed = pendingTexture('packed');
            const normal = pendingTexture('normalMap');
            const material = await loadMaterial(new Asset('material', 'material', null, {
                useMetalness: true, aoMap: packed.id, glossMap: packed.id, metalnessMap: packed.id, normalMap: normal.id
            }));

            const placeholders = app.loader.getHandler('material')._placeholders;
            expect(placeholders.has(material.aoMap)).to.equal(true);
            expect(material.glossMap).to.equal(material.aoMap);
            expect(material.metalnessMap).to.equal(material.aoMap);
            expect(placeholders.has(material.normalMap)).to.equal(true);
            expect(material.normalMap).to.not.equal(material.aoMap);

            const instance = meshInstance(material);
            const shader = drawnShader(instance);
            completeLoad(packed);
            completeLoad(normal);
            expect(material.glossMap).to.equal(packed.resource);
            expect(material.metalnessMap).to.equal(packed.resource);
            expect(drawnShader(instance)).to.equal(shader);
            expect(neededShader(instance)).to.equal(shader);
        });

        // the value the placeholder of a map shows in the channel the map samples, in the range 0..1
        const sampledValue = (material, name) => {
            const index = 'rgba'.indexOf(material[`${name}Channel`]);
            return material[name]._levels[0][index] / 255;
        };

        it('shows the neutral value of each map packed into the channels of one texture asset', async function () {
            const packed = pendingTexture('packed');
            const material = await loadMaterial(new Asset('material', 'material', null, {
                useMetalness: true,
                aoMap: packed.id,
                aoMapChannel: 'r',
                glossMap: packed.id,
                glossMapChannel: 'g',
                metalnessMap: packed.id,
                metalnessMapChannel: 'b'
            }));

            expect(material.glossMap).to.equal(material.aoMap);
            expect(material.metalnessMap).to.equal(material.aoMap);
            expect(sampledValue(material, 'aoMap')).to.equal(1);
            expect(sampledValue(material, 'glossMap')).to.be.closeTo(0.5, 0.01);
            expect(sampledValue(material, 'metalnessMap')).to.equal(0);
        });

        it('shows no metalness where the metalness and the occlusion maps sample one channel', async function () {
            // both sample the green channel by default
            const packed = pendingTexture('packed');
            const material = await loadMaterial(new Asset('material', 'material', null, {
                useMetalness: true, aoMap: packed.id, metalnessMap: packed.id
            }));

            expect(material.metalnessMap).to.equal(material.aoMap);
            expect(sampledValue(material, 'metalnessMap')).to.equal(0);
        });

        it('samples the neutral value of a map using its value from the placeholder of an sRGB texture', async function () {
            const gloss = pendingTexture('glossMap', { srgb: true });
            const material = await loadMaterial(new Asset('material', 'material', null, {
                useMetalness: true, glossMap: gloss.id
            }));

            // the value sampling decodes from the sRGB texel
            const c = sampledValue(material, 'glossMap');
            const value = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
            expect(material.glossMap.encoding).to.equal('linear');
            expect(value).to.be.closeTo(0.5, 0.01);
        });

        it('assigns an .hdr file a placeholder of the rgbe type before the hdr parser records the type', async function () {
            const emissive = pendingTexture('emissiveMap', {}, { url: textureUrl('emissive').replace('.png', '.hdr') });
            const material = await loadMaterial(new Asset('material', 'material', null, {
                emissiveMap: emissive.id, emissive: [1, 1, 1]
            }));
            expect(material.emissiveMap.encoding).to.equal('rgbe');

            // the hdr parser records the type in the asset data as it starts loading the file
            emissive.data.type = 'rgbe';
            expectSameShaderAfterLoad(material, [emissive]);
        });

        it('keeps the placeholder of maps sharing a texture asset shared when the asset is removed', async function () {
            const packed = pendingTexture('packed');
            const material = await loadMaterial(new Asset('material', 'material', null, {
                useMetalness: true, aoMap: packed.id, glossMap: packed.id
            }));
            const placeholder = material.aoMap;

            const instance = meshInstance(material);
            const shader = drawnShader(instance);
            completeLoad(packed);

            app.assets.remove(packed);
            expect(material.aoMap).to.equal(placeholder);
            expect(material.glossMap).to.equal(placeholder);
            expect(drawnShader(instance)).to.equal(shader);
            expect(neededShader(instance)).to.equal(shader);
        });

        it('assigns placeholders of the encoded types, which load without changing the shader', async function () {
            const light = pendingTexture('lightMap', { type: 'rgbm' });
            const emissive = pendingTexture('emissiveMap', { rgbm: true });
            const specular = pendingTexture('specularMap', { type: 'rgbe' });
            const sheen = pendingTexture('sheenMap', { type: 'rgbp' });
            const normal = pendingTexture('normalMap', {}, { url: '/test/assets/materials/textures/normal.basis', opt: 8 });
            const material = await loadMaterial(new Asset('material', 'material', null, {
                lightMap: light.id,
                emissiveMap: emissive.id,
                emissive: [1, 1, 1],
                useMetalness: false,
                specularMap: specular.id,
                sheenMap: sheen.id,
                useSheen: true,
                normalMap: normal.id
            }));

            expect(material.lightMap.encoding).to.equal('rgbm');
            expect(material.emissiveMap.encoding).to.equal('rgbm');
            expect(material.specularMap.encoding).to.equal('rgbe');
            expect(material.sheenMap.encoding).to.equal('rgbp');
            expect(material.normalMap.type).to.equal(TEXTURETYPE_SWIZZLEGGGR);

            expectSameShaderAfterLoad(material, [light, emissive, specular, sheen, normal]);
        });

        it('assigns a placeholder of the environment atlas type', async function () {
            const atlas = pendingTexture('envAtlas', { type: 'rgbp' });
            const material = await loadMaterial(new Asset('material', 'material', null, { envAtlas: atlas.id }));

            expect(material.envAtlas.encoding).to.equal('rgbp');
            expectSameShaderAfterLoad(material, [atlas]);
        });

        it('assigns the same placeholders again when the textures unload', async function () {
            const diffuse = pendingTexture('diffuseMap', { srgb: true });
            const packed = pendingTexture('packed');
            const material = await loadMaterial(new Asset('material', 'material', null, {
                useMetalness: true, diffuseMap: diffuse.id, glossMap: packed.id, metalnessMap: packed.id
            }));
            const placeholders = [material.diffuseMap, material.glossMap];

            const instance = meshInstance(material);
            const shader = drawnShader(instance);
            completeLoad(diffuse);
            completeLoad(packed);

            diffuse.unload();
            packed.unload();
            expect([material.diffuseMap, material.glossMap]).to.eql(placeholders);
            expect(material.metalnessMap).to.equal(material.glossMap);
            expect(drawnShader(instance)).to.equal(shader);
            expect(neededShader(instance)).to.equal(shader);
        });

        describe('copies', function () {

            referenceKinds.forEach((kind) => {
                it(`gives a copy made while the material waits the textures it references by ${kind.label}, without changing the shader of the copy`, async function () {
                    const [diffuse, gloss] = colorAndGloss(kind);
                    const material = await kind.load(diffuse, gloss);
                    const copy = material.clone();

                    expectSameShaderAfterLoad(copy, [gloss, diffuse]);
                    expect(material.diffuseMap).to.equal(diffuse.resource);
                    expect(material.glossMap).to.equal(gloss.resource);
                });
            });

            it('gives copies of copies the textures, and a texture asset referenced by several maps to each of them', async function () {
                const packed = pendingTexture('packed');
                const normal = pendingTexture('normalMap');
                const material = await loadMaterial(new Asset('material', 'material', null, {
                    useMetalness: true, aoMap: packed.id, glossMap: packed.id, normalMap: normal.id
                }));
                const copy = material.clone();
                const copyOfCopy = copy.clone();

                completeLoad(packed);
                completeLoad(normal);
                for (const target of [copy, copyOfCopy]) {
                    expect(target.aoMap).to.equal(packed.resource);
                    expect(target.glossMap).to.equal(packed.resource);
                    expect(target.normalMap).to.equal(normal.resource);
                }
            });

            it('keeps a texture assigned to a copy', async function () {
                const [diffuse, gloss] = colorAndGloss(referenceKinds[0]);
                const material = await loadById(diffuse, gloss);
                const copy = material.clone();
                const texture = new Texture(app.graphicsDevice, { width: 4, height: 4, format: PIXELFORMAT_RGBA8 });
                copy.diffuseMap = texture;

                completeLoad(diffuse);
                completeLoad(gloss);
                expect(copy.diffuseMap).to.equal(texture);
                expect(copy.glossMap).to.equal(gloss.resource);
            });

            it('gives a copy the textures of the material it was copied from last', async function () {
                const [diffuse, gloss] = colorAndGloss(referenceKinds[0]);
                const material = await loadById(diffuse, gloss);
                const other = pendingTexture('other');
                const otherMaterial = await loadMaterial(new Asset('other', 'material', null, { diffuseMap: other.id }));
                const copy = material.clone().copy(otherMaterial);

                completeLoad(diffuse);
                completeLoad(other);
                expect(copy.diffuseMap).to.equal(other.resource);
            });

            // two waiting material assets, the material of the first of which is a copy of the
            // material of the second, so it receives the textures of both assets
            const copiedInto = async () => {
                const own = pendingTexture('own');
                const diffuse = pendingTexture('diffuse');
                const emissive = pendingTexture('emissive');
                const material = await loadMaterial(new Asset('material', 'material', null, { diffuseMap: own.id }));
                const source = await loadMaterial(new Asset('source', 'material', null, {
                    diffuseMap: diffuse.id, emissiveMap: emissive.id
                }));
                material.copy(source);
                return { material, source, textures: [emissive, own, diffuse] };
            };

            it('gives a copy of a material which is a copy itself the textures the material receives', async function () {
                const { material, textures } = await copiedInto();
                const copy = material.clone();

                textures.forEach(completeLoad);
                const [emissive, own] = textures;
                expect(material.diffuseMap).to.equal(own.resource);
                expect(material.emissiveMap).to.equal(emissive.resource);
                expect(copy.diffuseMap).to.equal(material.diffuseMap);
                expect(copy.emissiveMap).to.equal(material.emissiveMap);
            });

            it('gives materials copied into each other the textures', async function () {
                const { material, source, textures } = await copiedInto();
                source.copy(material);

                textures.forEach(completeLoad);
                const [emissive] = textures;
                expect(material.emissiveMap).to.equal(emissive.resource);
                expect(source.emissiveMap).to.equal(emissive.resource);
            });

            [null, 'a texture'].forEach((assigned) => {
                it(`gives the copies of a material which is a copy itself the textures, after assigning ${assigned ?? 'null'} to the map of the material`, async function () {
                    const { material, textures } = await copiedInto();
                    const copy = material.clone();
                    const texture = assigned && new Texture(app.graphicsDevice, { width: 4, height: 4, format: PIXELFORMAT_RGBA8 });
                    material.emissiveMap = texture;

                    textures.forEach(completeLoad);
                    const [emissive] = textures;
                    expect(material.emissiveMap).to.equal(texture);
                    expect(copy.emissiveMap).to.equal(emissive.resource);
                });
            });

            it('ends passing a texture on between materials copied into each other, after assigning to their maps', async function () {
                const { material, source, textures } = await copiedInto();
                source.copy(material);
                const copy = material.clone();
                material.emissiveMap = null;
                source.emissiveMap = null;

                textures.forEach(completeLoad);
                const [emissive] = textures;
                expect(copy.emissiveMap).to.equal(emissive.resource);
            });

            [
                { label: 'its own textures', order: [1, 0, 2] },
                { label: 'the textures it receives as a copy', order: [0, 2, 1] }
            ].forEach(({ label, order }) => {
                it(`stops tracking the copies of a material which is a copy itself, loading ${label} first`, async function () {
                    const { material, source, textures } = await copiedInto();
                    const copy = material.clone();

                    order.forEach(index => completeLoad(textures[index]));
                    expect(copy.emissiveMap).to.equal(textures[0].resource);
                    expect(source._pendingCopies).to.equal(null);
                    expect(material._pendingCopies).to.equal(null);
                    expect(material._pendingSource).to.equal(null);
                    expect(copy._pendingSource).to.equal(null);
                });
            });

            it('stops tracking the copies once the material has all its textures', async function () {
                const [diffuse, gloss] = colorAndGloss(referenceKinds[0]);
                const material = await loadById(diffuse, gloss);
                const copy = material.clone();

                completeLoad(diffuse);
                expect(material._pendingCopies.size).to.equal(1);
                expect(copy._pendingSource).to.equal(material);

                completeLoad(gloss);
                expect(material._pendingCopies).to.equal(null);
                expect(copy._pendingSource).to.equal(null);
                expect(material.clone()._pendingSource).to.equal(null);
            });

            it('skips a destroyed copy', async function () {
                const [diffuse, gloss] = colorAndGloss(referenceKinds[0]);
                const material = await loadById(diffuse, gloss);
                material.clone().destroy();

                completeLoad(diffuse);
                expect(material.diffuseMap).to.equal(diffuse.resource);
                expect(material._pendingCopies.size).to.equal(0);
            });

            it('gives a copy made while a texture is unloaded the texture when it loads again', async function () {
                const diffuse = pendingTexture('diffuseMap', { srgb: true });
                completeLoad(diffuse);
                const material = await loadMaterial(new Asset('material', 'material', null, { diffuseMap: diffuse.id }));
                expect(material._pendingCopies).to.equal(null);

                diffuse.unload();
                const copy = material.clone();
                completeLoad(diffuse);
                expect(copy.diffuseMap).to.equal(diffuse.resource);
            });

            it('gives a dynamic batch built while the material waits the textures', async function () {
                const diffuse = pendingTexture('diffuseMap', { srgb: true });
                const materialAsset = new Asset('material', 'material', null, { diffuseMap: diffuse.id });
                const material = await loadMaterial(materialAsset);

                const group = app.batcher.addGroup('dynamic', true, 100);
                for (let i = 0; i < 2; i++) {
                    const entity = new Entity();
                    entity.addComponent('render', { type: 'box', materialAssets: [materialAsset.id], batchGroupId: group.id });
                    app.root.addChild(entity);
                }
                app.batcher.updateAll();
                const batchMaterial = app.batcher._batchList[0].meshInstance.material;
                expect(batchMaterial).to.not.equal(material);

                completeLoad(diffuse);
                expect(batchMaterial.diffuseMap).to.equal(diffuse.resource);
            });

            // runs the garbage collector until the referent is gone or the attempts run out; a
            // deref keeps its target alive for the rest of the current job, so gc and deref run
            // in different jobs
            const tick = () => new Promise((resolve) => {
                setTimeout(resolve, 0);
            });
            const collected = async (ref, attempts = 10) => {
                if (attempts === 0) {
                    return false;
                }
                global.gc();
                await tick();
                const alive = ref.deref() !== undefined;
                await tick();
                return alive ? collected(ref, attempts - 1) : true;
            };

            it('lets a copy dropped while the material waits be garbage collected', async function () {
                if (typeof global.gc !== 'function') {
                    this.skip();
                }

                const [diffuse, gloss] = colorAndGloss(referenceKinds[0]);
                const material = await loadById(diffuse, gloss);
                const ref = new WeakRef(material.clone());

                expect(await collected(ref)).to.equal(true);
                completeLoad(diffuse);
                expect(material._pendingCopies.size).to.equal(0);
            });
        });
    });
});
