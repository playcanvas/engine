import { Application } from '../../src/framework/application.js';
import { Asset } from '../../src/asset/asset.js';
import { AssetRegistry } from '../../src/asset/asset-registry.js';
import { GlbContainerResource } from '../../src/resources/parser/glb-container-resource.js';
import { ResourceLoader } from '../../src/resources/loader.js';

import { HTMLCanvasElement } from '@playcanvas/canvas-mock';

import { expect } from 'chai';

describe('AssetRegistry', function () {

    let app;

    beforeEach(function () {
        const canvas = new HTMLCanvasElement(500, 500);
        app = new Application(canvas);
    });

    afterEach(function () {
        app.destroy();
    });

    describe('#constructor', function () {

        it('instantiates correctly', function () {
            const resourceLoader = new ResourceLoader();
            const assetRegistry = new AssetRegistry(resourceLoader);
            expect(assetRegistry).to.be.ok;
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

});
