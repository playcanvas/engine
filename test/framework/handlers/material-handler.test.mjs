import { expect } from 'chai';

import { Asset } from '../../../src/framework/asset/asset.js';
import { StandardMaterial } from '../../../src/scene/materials/standard-material.js';
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
});
