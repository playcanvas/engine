import { Application } from '../../../src/framework/application.js';
import { Asset } from '../../../src/framework/asset/asset.js';
import { AssetRegistry } from '../../../src/framework/asset/asset-registry.js';
import { GlbContainerResource } from '../../../src/framework/parsers/glb-container-resource.js';
import { ResourceLoader } from '../../../src/framework/handlers/loader.js';
import { http, Http } from '../../../src/platform/net/http.js';

import { HTMLCanvasElement } from '@playcanvas/canvas-mock';

import { expect } from 'chai';
import { restore, spy } from 'sinon';

describe('AssetRegistry', function () {

    let app;
    let retryDelay;

    beforeEach(function () {
        retryDelay = Http.retryDelay;
        Http.retryDelay = 1;
        const canvas = new HTMLCanvasElement(500, 500);
        app = new Application(canvas);
    });

    afterEach(function () {
        app.destroy();
        Http.retryDelay = retryDelay;
        restore();
    });

    describe('#constructor', function () {

        it('instantiates correctly', function () {
            const resourceLoader = new ResourceLoader(app);
            const assetRegistry = new AssetRegistry(resourceLoader);

            expect(assetRegistry).to.be.ok;
        });

    });

    describe('#add', function () {

        it('adds an asset', function () {
            const asset = new Asset('Test Asset', 'text', {
                url: 'fake/url/file.txt'
            });
            app.assets.add(asset);

            const assets = app.assets.list();
            expect(assets.length).to.equal(1);
            expect(assets[0].name).to.equal(asset.name);
        });

    });

    describe('#find', function () {

        it('works after removing an asset', function () {
            const asset1 = new Asset('Asset 1', 'text', {
                url: 'fake/one/file.txt'
            });
            const asset2 = new Asset('Asset 2', 'text', {
                url: 'fake/two/file.txt'
            });
            const asset3 = new Asset('Asset 3', 'text', {
                url: 'fake/three/file.txt'
            });

            app.assets.add(asset1);
            app.assets.add(asset2);
            app.assets.add(asset3);

            app.assets.remove(asset1);

            expect(app.assets.find(asset1.name)).to.equal(null);
            expect(app.assets.find(asset2.name)).to.equal(asset2);
            expect(app.assets.find(asset3.name)).to.equal(asset3);
        });

    });

    describe('#get', function () {

        it('retrieves an asset by id', function () {
            const asset = new Asset('Test Asset', 'text', {
                url: 'fake/url/file.txt'
            });
            app.assets.add(asset);

            const assetFromRegistry = app.assets.get(asset.id);

            expect(asset).to.equal(assetFromRegistry);
        });

    });

    describe('#getByUrl', function () {

        it('retrieves an asset by url', function () {
            const asset = new Asset('Test Asset', 'text', {
                url: 'fake/url/file.txt'
            });
            app.assets.add(asset);

            const assetFromRegistry = app.assets.getByUrl(asset.file.url);

            expect(asset).to.equal(assetFromRegistry);
        });

        it('works after removing an asset', function () {
            const asset1 = new Asset('Asset 1', 'text', {
                url: 'fake/one/file.txt'
            });
            const asset2 = new Asset('Asset 2', 'text', {
                url: 'fake/two/file.txt'
            });
            const asset3 = new Asset('Asset 3', 'text', {
                url: 'fake/three/file.txt'
            });

            app.assets.add(asset1);
            app.assets.add(asset2);
            app.assets.add(asset3);

            app.assets.remove(asset1);

            expect(app.assets.getByUrl(asset1.file.url)).to.equal(undefined);
            expect(app.assets.getByUrl(asset2.file.url)).to.equal(asset2);
            expect(app.assets.getByUrl(asset3.file.url)).to.equal(asset3);
        });

    });

    describe('#list', function () {

        it('lists all assets', function () {
            const asset1 = new Asset('Asset 1', 'text', {
                url: 'fake/one/file.txt'
            });
            const asset2 = new Asset('Asset 2', 'text', {
                url: 'fake/two/file.txt'
            });
            const asset3 = new Asset('Asset 3', 'text', {
                url: 'fake/three/file.txt'
            });

            app.assets.add(asset1);
            app.assets.add(asset2);
            app.assets.add(asset3);

            const assets = app.assets.list();

            expect(assets[0]).to.equal(asset1);
            expect(assets[1]).to.equal(asset2);
            expect(assets[2]).to.equal(asset3);
        });

    });

    describe('#loadFromUrl', function () {

        const assetPath = 'http://localhost:3000/test/test-assets/';

        it('loads binary assets', function (done) {
            app.assets.loadFromUrl(`${assetPath}test.bin`, 'binary', function (err, asset) {
                expect(err).to.be.null;
                expect(asset).to.be.instanceof(Asset);
                expect(asset.resource).to.be.instanceof(ArrayBuffer);
                expect(asset.resource.byteLength).to.equal(8);
                const bytes = new Uint8Array(asset.resource);
                for (let i = 0; i < 8; i++) {
                    expect(bytes[i]).to.equal(i);
                }
                done();
            });
        });

        it('loads container assets', function (done) {
            app.assets.loadFromUrl(`${assetPath}test.glb`, 'container', function (err, asset) {
                expect(err).to.be.null;
                expect(asset).to.be.instanceof(Asset);
                expect(asset.resource).to.be.instanceof(GlbContainerResource);
                done();
            });
        });

        it('supports retry loading of container assets', function (done) {
            spy(http, 'request');
            app.loader.enableRetry(2);
            app.assets.loadFromUrl(`${assetPath}someurl.glb`, 'container', function (err, asset) {
                expect(http.request.callCount).to.equal(3);
                done();
            });
        });

        it('loads css assets', function (done) {
            app.assets.loadFromUrl(`${assetPath}test.css`, 'css', function (err, asset) {
                expect(err).to.be.null;
                expect(asset).to.be.instanceof(Asset);
                expect(asset.resource).to.be.a('string');
                expect(asset.resource).to.equal('body { color: red }');
                done();
            });
        });

        it.skip('loads html assets', function (done) {
            app.assets.loadFromUrl(`${assetPath}test.html`, 'html', function (err, asset) {
                expect(err).to.be.null;
                expect(asset).to.be.instanceof(Asset);
                expect(asset.resource).to.be.a('string');
                done();
            });
        });

        it('loads json assets', function (done) {
            app.assets.loadFromUrl(`${assetPath}test.json`, 'json', function (err, asset) {
                expect(err).to.be.null;
                expect(asset).to.be.instanceof(Asset);
                expect(asset.resource).to.be.an.instanceof(Object);
                expect(asset.resource.a).to.equal(1);
                expect(asset.resource.b).to.equal(true);
                expect(asset.resource.c).to.equal('hello world');
                done();
            });
        });

        it('loads shader assets', function (done) {
            app.assets.loadFromUrl(`${assetPath}test.glsl`, 'shader', function (err, asset) {
                expect(err).to.be.null;
                expect(asset).to.be.instanceof(Asset);
                expect(asset.resource).to.be.a('string');
                done();
            });
        });

        it('loads text assets', function (done) {
            app.assets.loadFromUrl(`${assetPath}test.txt`, 'text', function (err, asset) {
                expect(err).to.be.null;
                expect(asset).to.be.instanceof(Asset);
                expect(asset.resource).to.be.a('string');
                expect(asset.resource).to.equal('hello world');
                done();
            });
        });

    });

    describe('#remove', function () {

        it('removes by id', function () {
            const asset1 = new Asset('Asset 1', 'text', {
                url: 'fake/one/file.txt'
            });
            const asset2 = new Asset('Asset 2', 'text', {
                url: 'fake/two/file.txt'
            });
            const asset3 = new Asset('Asset 3', 'text', {
                url: 'fake/three/file.txt'
            });

            app.assets.add(asset1);
            app.assets.add(asset2);
            app.assets.add(asset3);

            app.assets.remove(asset2);

            const assets = app.assets.list();

            expect(app.assets.get(asset1.id)).to.equal(asset1);
            expect(app.assets.get(asset2.id)).to.equal(undefined);
            expect(app.assets.get(asset3.id)).to.equal(asset3);

            expect(app.assets.findAll(asset1.name)[0]).to.equal(asset1);
            expect(app.assets.findAll(asset2.name).length).to.equal(0);
            expect(app.assets.findAll(asset3.name)[0]).to.equal(asset3);

            expect(assets[0].id).to.equal(asset1.id);
            expect(assets[1].id).to.equal(asset3.id);
        });

    });

});
