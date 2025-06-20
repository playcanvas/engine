import { expect } from 'chai';

import { AssetListLoader } from '../../../src/framework/asset/asset-list-loader.js';
import { Asset } from '../../../src/framework/asset/asset.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('AssetListLoader', function () {

    let app;
    const assetPath = 'http://localhost:3000/test/assets/';

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
    });

    afterEach(function () {
        app?.destroy();
        app = null;
        jsdomTeardown();
    });

    describe('#constructor', function () {

        it('instantiates correctly', function () {
            const assetListLoader = new AssetListLoader([], app.assets);
            expect(assetListLoader).to.be.ok;
        });

        it('stores a single asset', function () {
            const assets = [
                new Asset('model', 'container', { url: `${assetPath}test.glb` })
            ];
            const assetListLoader = new AssetListLoader(Object.values(assets), app.assets);
            expect(assetListLoader._assets.has(assets[0])).to.equal(true);
        });

        it('stores multiple assets', function () {
            const assets = [
                new Asset('model', 'container', { url: `${assetPath}test.glb` }),
                new Asset('styling', 'css', { url: `${assetPath}test.css` })
            ];
            const assetListLoader = new AssetListLoader(assets, app.assets);
            expect(assetListLoader._assets.has(assets[0])).to.equal(true);
            expect(assetListLoader._assets.has(assets[1])).to.equal(true);
        });

        it('stores single copies of duplicated assets', function () {
            const assets = [
                new Asset('model', 'container', { url: `${assetPath}test.glb` })
            ];
            const assetListLoader = new AssetListLoader([assets[0], assets[0]], app.assets);
            expect(assetListLoader._assets.size).to.equal(1);
        });

        it('adds the supplied registry to any assets that do not have one', function () {
            const assets = [
                new Asset('model', 'container', { url: `${assetPath}test.glb` })
            ];
            expect(assets[0].registry).to.equal(null);
            const assetListLoader = new AssetListLoader([assets[0], assets[0]], app.assets);
            assetListLoader._assets.forEach((asset) => {
                expect(asset.registry).to.equal(app.assets);
            });
        });

    });

    describe('#ready', function () {

        it('can return a single loaded asset', (done) => {
            const asset = new Asset('model', 'container', { url: `${assetPath}test.glb` });
            const assetListLoader = new AssetListLoader([asset], app.assets);
            assetListLoader.ready((assets) => {
                expect(assets.length).to.equal(1);
                expect(assets[0].name).to.equal('model');
                expect(assets[0].loaded).to.equal(true);
                done();
            });
            assetListLoader.load();
        });

        it('can return multiple loaded assets', (done) => {
            const assets = [
                new Asset('model', 'container', { url: `${assetPath}test.glb` }),
                new Asset('styling', 'css', { url: `${assetPath}test.css` })
            ];
            const assetListLoader = new AssetListLoader(assets, app.assets);
            assetListLoader.ready((assets) => {
                expect(assets.length).to.equal(2);
                expect(assets[0].name).to.equal('model');
                expect(assets[0].loaded).to.equal(true);
                expect(assets[1].name).to.equal('styling');
                expect(assets[1].loaded).to.equal(true);
                done();
            });
            assetListLoader.load();
        });

        it('can return a single duplicated loaded asset', (done) => {
            const asset = new Asset('model', 'container', { url: `${assetPath}test.glb` });
            const assetListLoader = new AssetListLoader([asset, asset], app.assets);
            assetListLoader.ready((assets) => {
                expect(assets.length).to.equal(1);
                expect(assets[0].name).to.equal('model');
                expect(assets[0].loaded).to.equal(true);
                done();
            });
            assetListLoader.load();
        });

    });

    describe('#load', function () {

        it('can call the ready callback if an asset is already loaded', (done) => {
            const asset = new Asset('model', 'container', { url: `${assetPath}test.glb` });
            const assetListLoader = new AssetListLoader([asset], app.assets);
            asset.on('load', (asset) => {
                expect(asset.loaded).to.equal(true);
                assetListLoader.ready((assets) => {
                    expect(assets.length).to.equal(1);
                    expect(assets[0].name).to.equal('model');
                    expect(assets[0].loaded).to.equal(true);
                    done();
                });
                assetListLoader.load();
            });
            app.assets.add(asset);
            app.assets.load(asset);
        });

        it('can call the load callback if an asset is already loaded', (done) => {
            const asset = new Asset('model', 'container', { url: `${assetPath}test.glb` });
            const assetListLoader = new AssetListLoader([asset], app.assets);
            asset.on('load', (asset) => {
                expect(asset.loaded).to.equal(true);
                assetListLoader.load(() => {
                    done();
                });
            });
            app.assets.add(asset);
            app.assets.load(asset);
        });

        it('can succeed if one asset is already loaded and another is not', (done) => {
            const assets = [
                new Asset('model', 'container', { url: `${assetPath}test.glb` }),
                new Asset('styling', 'css', { url: `${assetPath}test.css` })
            ];
            const assetListLoader = new AssetListLoader(assets, app.assets);
            assets[0].on('load', (asset) => {
                expect(asset.name).to.equal('model');
                expect(asset.loaded).to.equal(true);
                assetListLoader.ready((assets) => {
                    expect(assets.length).to.equal(2);
                    expect(assets[0].name).to.equal('model');
                    expect(assets[0].loaded).to.equal(true);
                    expect(assets[1].name).to.equal('styling');
                    expect(assets[1].loaded).to.equal(true);
                    done();
                });
                assetListLoader.load();
            });
            app.assets.add(assets[0]);
            app.assets.load(assets[0]);
        });

        it('can succeed if an asset is already loading', (done) => {
            const asset = new Asset('model', 'container', { url: `${assetPath}test.glb` });
            const assetListLoader = new AssetListLoader([asset], app.assets);
            app.assets.add(asset);
            app.assets.load(asset);
            expect(asset.loading).to.equal(true);
            assetListLoader.ready((assets) => {
                expect(assets.length).to.equal(1);
                expect(assets[0].name).to.equal('model');
                expect(assets[0].loaded).to.equal(true);
                done();
            });
            assetListLoader.load();
        });

        it('can succeed if one asset is already loading and another is not', (done) => {
            const assets = [
                new Asset('model', 'container', { url: `${assetPath}test.glb` }),
                new Asset('styling', 'css', { url: `${assetPath}test.css` })
            ];
            const assetListLoader = new AssetListLoader(assets, app.assets);
            app.assets.add(assets[0]);
            app.assets.load(assets[0]);
            expect(assets[0].loading).to.equal(true);
            assetListLoader.ready((assets) => {
                expect(assets.length).to.equal(2);
                expect(assets[0].name).to.equal('model');
                expect(assets[0].loaded).to.equal(true);
                expect(assets[1].name).to.equal('styling');
                expect(assets[1].loaded).to.equal(true);
                done();
            });
            assetListLoader.load();
        });

        it('can succeed if one asset is already loaded, another is loading and one is not loaded', (done) => {
            const assets = [
                new Asset('model', 'container', { url: `${assetPath}test.glb` }),
                new Asset('styling', 'css', { url: `${assetPath}test.css` }),
                new Asset('binfile', 'binary', { url: `${assetPath}test.bin` })
            ];
            const assetListLoader = new AssetListLoader(assets, app.assets);
            assets[0].on('load', (asset) => {
                expect(asset.name).to.equal('model');
                expect(asset.loaded).to.equal(true);
                app.assets.add(assets[1]);
                app.assets.load(assets[1]);
                expect(assets[1].loading).to.equal(true);
                assetListLoader.ready((assets) => {
                    expect(assets.length).to.equal(3);
                    expect(assets[0].name).to.equal('model');
                    expect(assets[0].loaded).to.equal(true);
                    expect(assets[1].name).to.equal('styling');
                    expect(assets[1].loaded).to.equal(true);
                    expect(assets[2].name).to.equal('binfile');
                    expect(assets[2].loaded).to.equal(true);
                    done();
                });
                assetListLoader.load();
            });
            app.assets.add(assets[0]);
            app.assets.load(assets[0]);
        });

        it('can succeed if multiple assets load the same url', (done) => {
            const assets = [
                new Asset('model1', 'container', { url: `${assetPath}test.glb` }),
                new Asset('model2', 'container', { url: `${assetPath}test.glb` })
            ];
            const assetListLoader = new AssetListLoader(assets, app.assets);
            assetListLoader.ready((assets) => {
                expect(assets.length).to.equal(2);
                expect(assets[0].name).to.equal('model1');
                expect(assets[0].loaded).to.equal(true);
                expect(assets[1].name).to.equal('model2');
                expect(assets[1].loaded).to.equal(true);
                done();
            });
            assetListLoader.load();
        });

        it('can succeed if an empty list is passed in', (done) => {
            const assetListLoader = new AssetListLoader([], app.assets);
            assetListLoader.ready((assets) => {
                expect(assets.length).to.equal(0);
                done();
            });
            assetListLoader.load();
        });

        it('can successfully load assets from ids that are in the registry', (done) => {
            const assets = [
                new Asset('model', 'container', { url: `${assetPath}test.glb` }),
                new Asset('styling', 'css', { url: `${assetPath}test.css` })
            ];
            app.assets.add(assets[0]);
            app.assets.add(assets[1]);
            const assetListLoader = new AssetListLoader([assets[0].id, assets[1].id], app.assets);
            assetListLoader.ready((assets) => {
                expect(assets.length).to.equal(2);
                done();
            });
            assetListLoader.load();
        });

        it('can successfully load assets from ids that are not yet in the registry', (done) => {
            const assets = [
                new Asset('model', 'container', { url: `${assetPath}test.glb` }),
                new Asset('styling', 'css', { url: `${assetPath}test.css` })
            ];
            const assetListLoader = new AssetListLoader([assets[0].id, assets[1].id], app.assets);
            assetListLoader.ready((assets) => {
                expect(assets.length).to.equal(2);
                done();
            });
            assetListLoader.load();
            app.assets.add(assets[0]);
            app.assets.add(assets[1]);
        });

        it('can be called multiple times', (done) => {
            const assets = [
                new Asset('model', 'container', { url: `${assetPath}test.glb` }),
                new Asset('styling', 'css', { url: `${assetPath}test.css` })
            ];
            const assetListLoader = new AssetListLoader(assets, app.assets);
            assetListLoader.ready((assets) => {
                expect(assets.length).to.equal(2);
                done();
            });
            assetListLoader.load();
            assetListLoader.load();
        });

        it('can fail gracefully', (done) => {
            const assets = [
                new Asset('model', 'container', { url: `${assetPath}test.glb` }),
                new Asset('styling', 'css', { url: `${assetPath}test.css` })
            ];
            const assetListLoader = new AssetListLoader(assets, app.assets);
            assetListLoader.load((err, failedItems) => {
                expect(err).to.equal('Failed to load some assets');
                expect(failedItems.length).to.equal(1);
                expect(failedItems[0].name).to.equal('model');
                done();
            });
            assetListLoader._onError(undefined, assets[0]);
        });

    });

    describe('#multi-app', function () {

        let app2;

        beforeEach(function () {
            app2 = createApp();
        });

        afterEach(function () {
            app2?.destroy();
            app2 = null;
        });

        it('can successfully load assets correctly in multi-app', async () => {

            const loadAssets = () => new Promise((resolve, reject) => {
                const asset = new Asset('render', 'container', { url: `${assetPath}test.glb` });
                const assetListLoader = new AssetListLoader([asset], app.assets);
                assetListLoader.load(() => {
                    const e = asset.resource.instantiateRenderEntity();
                    expect(e._app === app).to.be.true;
                    resolve(e._app);
                });
            });

            await Promise.all([
                loadAssets(app),
                loadAssets(app2)
            ]);
        });
    });

});
