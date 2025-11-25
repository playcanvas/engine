import { expect } from 'chai';
import { restore, spy } from 'sinon';

import { AssetRegistry } from '../../../src/framework/asset/asset-registry.js';
import { Asset } from '../../../src/framework/asset/asset.js';
import { ResourceLoader } from '../../../src/framework/handlers/loader.js';
import { GlbContainerResource } from '../../../src/framework/parsers/glb-container-resource.js';
import { Texture } from '../../../src/platform/graphics/texture.js';
import { http, Http } from '../../../src/platform/net/http.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('AssetRegistry', function () {

    let app;
    let retryDelay;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();

        retryDelay = Http.retryDelay;
        Http.retryDelay = 1;
    });

    afterEach(function () {
        Http.retryDelay = retryDelay;

        app?.destroy();
        app = null;
        jsdomTeardown();
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

        it('should not load an asset with preload set to true', function () {
            const asset = new Asset('Test Asset', 'text', {
                url: 'fake/url/file.txt'
            });
            asset.preload = true;
            app.assets.add(asset);

            expect(asset.loading).to.equal(false);
            expect(asset.loaded).to.equal(false);
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

    describe('#find + rename', function () {

        it('works after renaming an asset', function () {
            const asset1 = new Asset('Asset 1', 'text', {
                url: 'fake/one/file.txt'
            });

            app.assets.add(asset1);

            asset1.name = 'Asset 1 renamed';

            expect(app.assets.find('Asset 1')).to.equal(null);
            expect(app.assets.find('Asset 1 renamed')).to.equal(asset1);

            app.assets.remove(asset1);
            asset1.name = 'Asset 1 renamed again';

            expect(app.assets.find('Asset 1')).to.equal(null);
            expect(app.assets.find('Asset 1 renamed')).to.equal(null);
            expect(app.assets.find('Asset 1 renamed again')).to.equal(null);
        });

    });

    describe('#find + type', function () {

        it('finds assets by name filtered by type', function () {
            const asset1 = new Asset('Asset 1', 'text', {
                url: 'fake/one/file.txt'
            });
            const asset2 = new Asset('Asset 1', 'json', {
                url: 'fake/two/file.json'
            });

            app.assets.add(asset1);
            app.assets.add(asset2);

            expect(app.assets.find('Asset 1', 'text')).to.equal(asset1);
            expect(app.assets.find('Asset 1', 'json')).to.equal(asset2);
        });

    });

    describe('#findAll + type', function () {

        it('finds all assets by name filtered by type', function () {
            const asset1 = new Asset('Asset 1', 'text', {
                url: 'fake/one/file.txt'
            });
            const asset2 = new Asset('Asset 1', 'json', {
                url: 'fake/two/file.json'
            });
            const asset3 = new Asset('Asset 1', 'text', {
                url: 'fake/two/file.txt'
            });
            const asset4 = new Asset('Asset 1', 'text', {
                url: 'fake/two/file.txt'
            });

            app.assets.add(asset1);
            app.assets.add(asset2);
            app.assets.add(asset3);
            app.assets.add(asset4);

            // ensure renaming updates indexes
            asset3.name = 'Asset 1 renamed';

            // ensure removing updates indexes
            app.assets.remove(asset4);

            expect(app.assets.findAll('Asset 1', 'text').length).to.equal(1);
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

        const assetPath = 'http://localhost:3000/test/assets/';

        it('loads binary assets', (done) => {
            app.assets.loadFromUrl(`${assetPath}test.bin`, 'binary', (err, asset) => {
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

        it('loads container assets', (done) => {
            app.assets.loadFromUrl(`${assetPath}test.glb`, 'container', (err, asset) => {
                expect(err).to.be.null;
                expect(asset).to.be.instanceof(Asset);
                expect(asset.resource).to.be.instanceof(GlbContainerResource);
                done();
            });
        });

        it('supports retry loading of container assets', (done) => {
            spy(http, 'request');
            app.loader.enableRetry(2);
            app.assets.loadFromUrl(`${assetPath}someurl.glb`, 'container', (err, asset) => {
                expect(http.request.callCount).to.equal(3);
                done();
            });
        });

        it('loads css assets', (done) => {
            app.assets.loadFromUrl(`${assetPath}test.css`, 'css', (err, asset) => {
                expect(err).to.be.null;
                expect(asset).to.be.instanceof(Asset);
                expect(asset.resource).to.be.a('string');
                expect(asset.resource).to.equal('body { color: red }');
                done();
            });
        });

        it('loads html assets', (done) => {
            app.assets.loadFromUrl(`${assetPath}test.html`, 'html', (err, asset) => {
                expect(err).to.be.null;
                expect(asset).to.be.instanceof(Asset);
                expect(asset.resource).to.be.a('string');
                done();
            });
        });

        it('loads json assets', (done) => {
            app.assets.loadFromUrl(`${assetPath}test.json`, 'json', (err, asset) => {
                expect(err).to.be.null;
                expect(asset).to.be.instanceof(Asset);
                expect(asset.resource).to.be.an.instanceof(Object);
                expect(asset.resource.a).to.equal(1);
                expect(asset.resource.b).to.equal(true);
                expect(asset.resource.c).to.equal('hello world');
                done();
            });
        });

        it('loads shader assets', (done) => {
            app.assets.loadFromUrl(`${assetPath}test.glsl`, 'shader', (err, asset) => {
                expect(err).to.be.null;
                expect(asset).to.be.instanceof(Asset);
                expect(asset.resource).to.be.a('string');
                done();
            });
        });

        it('loads text assets', (done) => {
            app.assets.loadFromUrl(`${assetPath}test.txt`, 'text', (err, asset) => {
                expect(err).to.be.null;
                expect(asset).to.be.instanceof(Asset);
                expect(asset.resource).to.be.a('string');
                expect(asset.resource).to.equal('hello world');
                done();
            });
        });

        it('loads texture assets', (done) => {
            app.assets.loadFromUrl(`${assetPath}test.png`, 'texture', (err, asset) => {
                expect(err).to.be.null;
                expect(asset).to.be.instanceof(Asset);
                expect(asset.resource).to.be.instanceof(Texture);
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
