import { expect } from 'chai';
import { restore, stub } from 'sinon';

import { Debug } from '../../../src/core/debug.js';
import { Asset } from '../../../src/framework/asset/asset.js';
import { GlbModelParser } from '../../../src/framework/parsers/glb-model.js';
import { Model } from '../../../src/scene/model.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('ModelHandler', function () {

    let app;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
    });

    afterEach(function () {
        restore();
        app?.destroy();
        app = null;
        jsdomTeardown();
    });

    const select = (handler, url) => handler._selectParser(handler._makeContext({ load: url, original: url }));

    const removedMessages = errorStub => errorStub.args
    .map(args => String(args[0]))
    .filter(m => m.startsWith('REMOVED:') && m.includes('JSON model format'));

    it('routes .glb to the glb model parser', function () {
        const handler = app.loader.getHandler('model');
        expect(select(handler, 'cube.glb')).to.be.an.instanceof(GlbModelParser);
    });

    it('has no parser for .json (the legacy JSON format was removed)', function () {
        const handler = app.loader.getHandler('model');
        expect(select(handler, 'cube.json')).to.equal(null);
    });

    it('loads a glb model', function (done) {
        const asset = new Asset('cube.glb', 'model', {
            url: '/test/assets/cube/cube.glb'
        });
        asset.once('load', () => {
            expect(asset.resource).to.be.an.instanceof(Model);
            done();
        });
        asset.once('error', err => done(new Error(err)));
        app.assets.add(asset);
        app.assets.load(asset);
    });

    it('fails to load a json model and reports the removed format', function (done) {
        Debug._loggedMessages.clear();
        const errorStub = stub(console, 'error');
        const asset = new Asset('cube.json', 'model', {
            url: '/test/assets/cube.json'
        });
        asset.once('load', () => done(new Error('a json model should not load')));
        asset.once('error', () => {
            expect(removedMessages(errorStub)).to.have.lengthOf(1);
            done();
        });
        app.assets.add(asset);
        app.assets.load(asset);
    });

    it('does not report the removed format for other unsupported extensions', function (done) {
        Debug._loggedMessages.clear();
        const errorStub = stub(console, 'error');
        const asset = new Asset('cube.obj', 'model', {
            url: '/test/assets/cube.obj'
        });
        asset.once('load', () => done(new Error('an obj model should not load without a parser')));
        asset.once('error', () => {
            expect(removedMessages(errorStub)).to.have.lengthOf(0);
            done();
        });
        app.assets.add(asset);
        app.assets.load(asset);
    });

    it('uses a user-registered parser (for example an OBJ parser)', function (done) {
        const model = new Model();
        app.loader.getHandler('model').addParser({
            canParse: context => context.ext === 'obj',
            load: (url, callback) => callback(null, model)
        });

        const asset = new Asset('cube.obj', 'model', {
            url: '/test/assets/cube.obj'
        });
        asset.once('load', () => {
            expect(asset.resource).to.equal(model);
            done();
        });
        asset.once('error', err => done(new Error(err)));
        app.assets.add(asset);
        app.assets.load(asset);
    });

    it('uses a user-registered .json parser, without reporting the removed format', function (done) {
        Debug._loggedMessages.clear();
        const errorStub = stub(console, 'error');
        const model = new Model();
        app.loader.getHandler('model').addParser({
            canParse: context => context.ext === 'json',
            load: (url, callback) => callback(null, model)
        });

        const asset = new Asset('cube.json', 'model', {
            url: '/test/assets/cube.json'
        });
        asset.once('load', () => {
            expect(asset.resource).to.equal(model);
            expect(removedMessages(errorStub)).to.have.lengthOf(0);
            done();
        });
        asset.once('error', err => done(new Error(err)));
        app.assets.add(asset);
        app.assets.load(asset);
    });
});
