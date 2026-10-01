import { expect } from 'chai';
import { restore, stub } from 'sinon';

import { Debug } from '../../../src/core/debug.js';
import { Asset } from '../../../src/framework/asset/asset.js';
import { Bundle } from '../../../src/framework/bundle/bundle.js';
import { ContainerResource } from '../../../src/framework/handlers/container.js';
import { Texture } from '../../../src/platform/graphics/texture.js';
import { http, Http } from '../../../src/platform/net/http.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('BundleHandler', function () {

    let app;
    let assets;
    let bundleAsset;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();

        // unbundled assets that also exist in the test.tar bundle
        assets = [
            new Asset('binary', 'binary', {
                filename: 'test.bin',
                url: 'test/assets/test.bin'
            }),
            new Asset('container', 'container', {
                filename: 'test.glb',
                url: 'test/assets/test.glb'
            }),
            new Asset('css', 'css', {
                filename: 'test.css',
                url: 'test/assets/test.css'
            }),
            new Asset('html', 'html', {
                filename: 'test.html',
                url: 'test/assets/test.html'
            }),
            new Asset('json', 'json', {
                filename: 'test.json',
                url: 'test/assets/test.json'
            }),
            new Asset('shader', 'shader', {
                filename: 'test.glsl',
                url: 'test/assets/test.glsl'
            }),
            new Asset('text', 'text', {
                filename: 'test.txt',
                url: 'test/assets/test.txt'
            })
        ];

        // the bundle asset (created by calling tar in the root folder of the repo):
        // tar cvf test.tar test\assets\test.bin test\assets\test.css test\assets\test.glb test\assets\test.glsl test\assets\test.html test\assets\test.json test\assets\test.txt
        bundleAsset = new Asset('bundle asset', 'bundle', {
            url: 'http://localhost:3210/test/assets/test.tar',
            size: 9728
        }, {
            assets: assets.map(function (asset) {
                return asset.id;
            })
        });
    });

    afterEach(function () {
        app?.destroy();
        app = null;
        http.withCredentials = false;
        jsdomTeardown();
        restore();
    });

    it('should load bundle asset and its assets', function (done) {
        app.assets.add(bundleAsset);
        assets.forEach((asset) => {
            app.assets.add(asset);
        });

        app.assets.load(bundleAsset);

        app.assets.on(`load:${bundleAsset.id}`, () => {
            expect(bundleAsset.resource instanceof Bundle).to.equal(true);
            assets.forEach((asset) => {
                const url = (app.assets.prefix || '') + asset.file.url;
                expect(bundleAsset.resource.has(url)).to.equal(true);
            });
            done();
        });
    });

    it('should load assets from bundle', function (done) {
        let loaded = 0;

        app.assets.add(bundleAsset);
        assets.forEach((asset) => {
            app.assets.add(asset);
        });

        app.assets.load(bundleAsset);

        const onLoad = function (asset) {
            loaded++;

            const resource = asset.resource;
            expect(resource).to.not.equal(null);

            switch (asset.type) {
                case 'css':
                case 'html':
                case 'shader':
                case 'text':
                    expect(typeof resource).to.equal('string');
                    break;
                case 'json':
                    expect(resource instanceof Object).to.equal(true);
                    break;
                case 'binary':
                    expect(Object.prototype.toString.call(resource)).to.equal('[object ArrayBuffer]');
                    break;
                case 'container':
                    expect(resource instanceof ContainerResource).to.equal(true);
                    break;
                case 'texture':
                    expect(resource instanceof Texture).to.equal(true);
                    break;
            }

            if (assets.length === loaded) {
                done();
            }
        };

        assets.forEach((asset) => {
            asset.on('load', onLoad);
        });
        bundleAsset.on('load', onLoad);
    });

    it('asset should load if bundle with that asset has loaded', function (done) {
        app.assets.add(bundleAsset);
        app.assets.add(assets[0]);

        expect(assets[0].loading).to.equal(false);
        app.assets.load(bundleAsset);
        expect(assets[0].loading).to.equal(true);

        assets[0].ready(() => {
            done();
        });
    });

    it('bundle should load if asset from it has loaded', function (done) {
        app.assets.add(bundleAsset);
        app.assets.add(assets[0]);

        expect(bundleAsset.loading).to.equal(false);
        app.assets.load(assets[0]);
        expect(bundleAsset.loading).to.equal(true);

        bundleAsset.ready(() => {
            done();
        });
    });

    it('bundle should load if asset from it has loaded', function (done) {
        app.assets.add(bundleAsset);
        app.assets.add(assets[0]);

        expect(bundleAsset.loading).to.equal(false);
        app.assets.load(assets[0]);
        expect(bundleAsset.loading).to.equal(true);

        bundleAsset.ready(() => {
            done();
        });
    });

    it('asset loading with bundlesIgnore option should not load bundle', function (done) {
        app.assets.add(bundleAsset);
        app.assets.add(assets[0]);

        let filterCalled = false;

        expect(bundleAsset.loading).to.equal(false);
        app.assets.load(assets[0], {
            bundlesIgnore: true,
            bundlesFilter: (bundles) => {
                filterCalled = true;
            }
        });
        expect(filterCalled).to.equal(false);
        expect(bundleAsset.loading).to.equal(false);

        assets[0].ready(() => {
            done();
        });
    });

    it('asset loading should prefer smallest bundle', function (done) {
        const bundleAsset2 = new Asset('bundle asset 2', 'bundle', {
            url: 'http://localhost:3210/test/assets/test.tar',
            size: 9728 + 1
        }, {
            assets: assets.map(function (asset) {
                return asset.id;
            })
        });

        app.assets.add(bundleAsset2);
        app.assets.add(bundleAsset);
        app.assets.add(assets[0]);

        expect(bundleAsset.loading).to.equal(false);
        app.assets.load(assets[0]);
        expect(bundleAsset.loading).to.equal(true);
        expect(bundleAsset2.loading).to.equal(false);

        assets[0].ready(() => {
            done();
        });
    });

    it('asset loading with bundlesFilter', function (done) {
        const bundleAsset2 = new Asset('bundle asset 2', 'bundle', {
            url: 'http://localhost:3210/test/assets/test.tar',
            size: 133632 + 1
        }, {
            assets: assets.map(function (asset) {
                return asset.id;
            })
        });

        app.assets.add(bundleAsset2);
        app.assets.add(bundleAsset);
        app.assets.add(assets[0]);

        let filterCalled = false;

        expect(bundleAsset2.loading).to.equal(false);

        app.assets.load(assets[0], {
            bundlesFilter: (bundles) => {
                filterCalled = true;
                expect(bundles.length).to.equal(2);

                if (bundles[0].name === 'bundle asset 2') {
                    return bundles[0];
                }
                return bundles[1];

            }
        });
        expect(filterCalled).to.equal(true);
        expect(bundleAsset2.loading).to.equal(true);
        expect(bundleAsset.loading).to.equal(false);

        assets[0].ready(() => {
            done();
        });
    });

    describe('#maxRetries', function () {

        let retryDelay;

        beforeEach(function () {
            retryDelay = Http.retryDelay;
            Http.retryDelay = 1;
            stub(Debug, 'log');
            stub(Debug, 'error');
        });

        afterEach(function () {
            Http.retryDelay = retryDelay;
        });

        // the handler is created before the loader turns retrying on, so the count has to be read
        // when the bundle loads rather than captured at construction
        const attemptsFor = async (maxRetries) => {
            const handler = app.loader.getHandler('bundle');
            handler.maxRetries = maxRetries;
            const fetched = stub(global, 'fetch').rejects(new Error('network'));

            await new Promise((resolve) => {
                handler.load({ load: 'test.tar', original: 'test.tar' }, resolve);
            });

            return fetched.callCount;
        };

        it('gives up after one attempt when retrying is off', async function () {
            expect(await attemptsFor(0)).to.equal(1);
        });

        it('retries a network error maxRetries times', async function () {
            // the retry count the loader enables by default
            expect(await attemptsFor(5)).to.equal(6);
        });

        it('fails an http error status once, rather than retrying or unpacking it', async function () {
            const handler = app.loader.getHandler('bundle');
            handler.maxRetries = 5;
            const fetched = stub(global, 'fetch')
            .resolves(new Response('not found', { status: 404, statusText: 'Not Found' }));

            const results = [];
            await new Promise((resolve) => {
                handler.load({ load: 'test.tar', original: 'test.tar' }, (err, resource) => {
                    results.push({ err, resource });
                    resolve();
                });
            });

            // an error status resolves, so it is not the transient failure a retry recovers from
            expect(fetched.callCount).to.equal(1);

            // and it fails the load, rather than handing over a bundle and failing afterwards
            expect(results.length).to.equal(1);
            expect(results[0].resource).to.equal(undefined);
            expect(String(results[0].err)).to.contain('404 Not Found');
        });

    });

    // the bundle is fetched directly rather than through the http layer, so the handler has to
    // apply the credentials flag itself. The request is failed as soon as its arguments are recorded.
    [false, true].forEach((withCredentials) => {
        it(`fetches the bundle with credentials ${withCredentials ? 'enabled' : 'disabled'}`, function (done) {
            http.withCredentials = withCredentials;
            const fetched = stub(global, 'fetch').rejects(new Error('recorded'));
            stub(Debug, 'error');

            const handler = app.loader.getHandler('bundle');
            handler.maxRetries = 0;   // the arguments are the same on every attempt, so fail fast
            handler.load({ load: 'test.tar', original: 'test.tar' }, () => {
                expect(fetched.firstCall.args[0]).to.equal('test.tar');
                expect(fetched.firstCall.args[1].credentials).to.equal(withCredentials ? 'include' : 'same-origin');
                done();
            });
        });
    });

    it('loadUrl() calls callback if bundle loaded', function (done) {
        app.assets.add(bundleAsset);
        app.assets.add(assets[0]);
        app.assets.load(bundleAsset);

        app.assets.bundles.loadUrl(assets[0].file.url, function (err, dataView) {
            expect(err).to.equal(null);
            expect(dataView instanceof DataView).to.equal(true);
            done();
        });
    });

});
