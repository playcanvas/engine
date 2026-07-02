import { expect } from 'chai';

import { Asset } from '../../../src/framework/asset/asset.js';
import { GlbAnimationParser } from '../../../src/framework/parsers/glb-animation.js';
import { JsonAnimationParser } from '../../../src/framework/parsers/json-animation.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('AnimationHandler (parser selection)', function () {

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

    const select = (handler, url) => handler._selectParser(handler._makeContext({ load: url, original: url }));

    it('routes .glb to the glb animation parser', function () {
        const handler = app.loader.getHandler('animation');
        expect(select(handler, 'walk.glb')).to.be.an.instanceof(GlbAnimationParser);
    });

    it('routes non-glb resources to the json animation parser (catch-all)', function () {
        const handler = app.loader.getHandler('animation');
        expect(select(handler, 'walk.json')).to.be.an.instanceof(JsonAnimationParser);
        expect(select(handler, 'walk.anim')).to.be.an.instanceof(JsonAnimationParser);
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

    it('loads a json animation through the json parser', function (done) {
        const asset = new Asset('cube.animation.json', 'animation', {
            url: '/test/assets/cube/cube.animation.json'
        });
        asset.once('load', () => {
            expect(asset.resource).to.exist;
            done();
        });
        asset.once('error', err => done(new Error(err)));
        app.assets.add(asset);
        app.assets.load(asset);
    });
});
