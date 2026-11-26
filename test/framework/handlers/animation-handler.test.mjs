import { expect } from 'chai';
import { restore, stub } from 'sinon';

import { Debug } from '../../../src/core/debug.js';
import { Asset } from '../../../src/framework/asset/asset.js';
import { GlbAnimationParser } from '../../../src/framework/parsers/glb-animation.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('AnimationHandler (parser selection)', function () {

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
    .filter(m => m.startsWith('REMOVED:') && m.includes('JSON animation format'));

    it('routes .glb to the glb animation parser', function () {
        const handler = app.loader.getHandler('animation');
        expect(select(handler, 'walk.glb')).to.be.an.instanceof(GlbAnimationParser);
    });

    it('has no parser for non-glb resources (the legacy JSON format was removed)', function () {
        const handler = app.loader.getHandler('animation');
        expect(select(handler, 'walk.json')).to.equal(null);
        expect(select(handler, 'walk.anim')).to.equal(null);
    });

    it('loads a glb animation through the glb parser', function (done) {
        const asset = new Asset('cube.animation.glb', 'animation', {
            url: '/test/assets/cube/cube.animation.glb'
        });
        asset.once('load', () => {
            // the glb parsed into a playable animation resource
            expect(asset.resource).to.exist;
            done();
        });
        asset.once('error', err => done(new Error(err)));
        app.assets.add(asset);
        app.assets.load(asset);
    });

    it('fails to load a json animation and reports the removed format', function (done) {
        Debug._loggedMessages.clear();
        const errorStub = stub(console, 'error');
        const asset = new Asset('walk.json', 'animation', {
            url: '/test/assets/walk.json'
        });
        asset.once('load', () => done(new Error('a json animation should not load')));
        asset.once('error', () => {
            expect(removedMessages(errorStub)).to.have.lengthOf(1);
            done();
        });
        app.assets.add(asset);
        app.assets.load(asset);
    });

    it('uses a user-registered parser for non-glb resources, without reporting the removed format', function (done) {
        Debug._loggedMessages.clear();
        const errorStub = stub(console, 'error');
        const resource = {};
        app.loader.getHandler('animation').addParser({
            canParse: context => context.ext === 'json',
            load: (url, callback) => callback(null, resource)
        });

        const asset = new Asset('walk.json', 'animation', {
            url: '/test/assets/walk.json'
        });
        asset.once('load', () => {
            expect(asset.resource).to.equal(resource);
            expect(removedMessages(errorStub)).to.have.lengthOf(0);
            done();
        });
        asset.once('error', err => done(new Error(err)));
        app.assets.add(asset);
        app.assets.load(asset);
    });
});
