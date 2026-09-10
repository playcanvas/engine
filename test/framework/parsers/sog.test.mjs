import { expect } from 'chai';
import { strToU8, zipSync } from 'fflate';
import { restore, stub } from 'sinon';

import { Asset } from '../../../src/framework/asset/asset.js';
import { SogBundleParser } from '../../../src/framework/parsers/sog-bundle.js';
import { SogParser } from '../../../src/framework/parsers/sog.js';
import { Texture } from '../../../src/platform/graphics/texture.js';
import { http } from '../../../src/platform/net/http.js';
import { GSplatSogData } from '../../../src/scene/gsplat/gsplat-sog-data.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

const BASE_URL = 'http://localhost:3210/static/';
const META_URL = 'assets/splats/meta.json';
const META = {
    version: 2,
    count: 1,
    means: {
        files: ['means_l.webp', 'means_u.webp']
    },
    quats: {
        files: ['quats.webp']
    },
    scales: {
        files: ['scales.webp']
    },
    sh0: {
        files: ['sh0.webp']
    }
};

describe('SogParser', function () {
    let app;

    beforeEach(function () {
        jsdomSetup();

        const base = document.createElement('base');
        base.href = BASE_URL;
        document.head.appendChild(base);

        app = createApp();
    });

    afterEach(function () {
        app?.destroy();
        app = null;

        jsdomTeardown();
        restore();
    });

    it('resolves texture urls from the document base uri', function (done) {
        const parser = new SogParser(app);
        parser.handler = app.loader.getHandler('gsplat');
        const sog = new Asset('sog', 'gsplat', {
            url: META_URL
        });
        const urls = [];
        let removed = false;

        app.assets.add(sog);

        stub(http, 'get').callsFake((url, options, callback) => {
            expect(url).to.equal(META_URL);
            callback(null, META);
        });

        stub(app.assets, 'load').callsFake((texture) => {
            urls.push(texture.file.url);

            if (!removed) {
                removed = true;
                app.assets.remove(sog);
            }

            texture.fire('load', texture);
        });

        parser.load(META_URL, (err, resource) => {
            expect(err).to.equal(null);
            expect(resource).to.equal(null);
            expect(urls).to.deep.equal([
                'http://localhost:3210/static/assets/splats/means_l.webp',
                'http://localhost:3210/static/assets/splats/means_u.webp',
                'http://localhost:3210/static/assets/splats/quats.webp',
                'http://localhost:3210/static/assets/splats/scales.webp',
                'http://localhost:3210/static/assets/splats/sh0.webp'
            ]);
            done();
        }, sog);
    });

    [SogParser, SogBundleParser].forEach((Parser) => {
        it(`${Parser.name} cancels a recovery wait when the asset unloads`, async function () {
            const parser = new Parser(app);
            parser.handler = app.loader.getHandler('gsplat');
            const archive = zipSync({ 'meta.json': strToU8(JSON.stringify(META)) }, { level: 0 });
            const sog = new Asset('sog', 'gsplat', {
                url: META_URL,
                contents: archive.buffer
            });
            app.assets.add(sog);

            stub(http, 'get').callsFake((url, options, callback) => callback(null, META));
            stub(app.assets, 'load').callsFake((asset) => {
                asset.resource = new Texture(app.graphicsDevice, { width: 1, height: 1 });
                asset.loaded = true;
                asset.fire('load', asset);
            });
            stub(GSplatSogData.prototype, 'prepareCodebook');

            let started;
            const preparing = new Promise((resolve) => {
                started = resolve;
            });
            const prepare = GSplatSogData.prototype.prepareGpuData;
            stub(GSplatSogData.prototype, 'prepareGpuData').callsFake(function () {
                const pending = prepare.call(this);
                started();
                return pending;
            });

            const device = app.graphicsDevice;
            device.loseContext();
            const listenersBefore = device._callbacks.get('devicerestored')?.length ?? 0;
            const loaded = new Promise((resolve) => {
                parser.load({ load: META_URL, original: META_URL }, (err, resource) => {
                    resolve({ err, resource });
                }, sog);
            });

            await preparing;
            // The streaming loader fires unload explicitly for assets still being loaded.
            sog.fire('unload', sog);
            expect(await loaded).to.deep.equal({ err: null, resource: null });
            expect(device.contextLost).to.be.true;
            expect(device._callbacks.get('devicerestored')?.length ?? 0).to.equal(listenersBefore);
        });
    });

    // Nothing cancels an in-flight request, so a load callback can run after app.destroy(). That
    // drops the asset registry before it marks the graphics device destroyed, leaving a window where
    // app.assets is null while the device still looks alive - which used to throw out of
    // _shouldAbort rather than aborting the load.
    describe('#_shouldAbort', function () {

        const parsers = () => [new SogParser(app), new SogBundleParser(app)];

        it('does not abort while the asset is registered and the device is alive', function () {
            const asset = new Asset('sog', 'gsplat', { url: META_URL });
            app.assets.add(asset);

            for (const parser of parsers()) {
                expect(parser._shouldAbort(asset, false)).to.equal(false);
                expect(parser._shouldAbort(asset, true)).to.equal(true, 'unloaded wins');
            }
        });

        it('aborts rather than throwing once the app has dropped its asset registry', function () {
            const asset = new Asset('sog', 'gsplat', { url: META_URL });
            const device = app.graphicsDevice;

            for (const parser of parsers()) {
                // app.destroy() nulls assets before it destroys the device, so this state is real
                parser.app = { assets: null, graphicsDevice: device };
                expect(() => parser._shouldAbort(asset, false)).to.not.throw();
                expect(parser._shouldAbort(asset, false)).to.equal(true);
            }
        });

        it('aborts when the graphics device is gone or destroyed', function () {
            const asset = new Asset('sog', 'gsplat', { url: META_URL });
            app.assets.add(asset);

            for (const parser of parsers()) {
                parser.app = { assets: app.assets, graphicsDevice: { _destroyed: true } };
                expect(parser._shouldAbort(asset, false)).to.equal(true);

                parser.app = { assets: app.assets, graphicsDevice: null };
                expect(parser._shouldAbort(asset, false)).to.equal(true);
            }
        });

        it('aborts when the asset is no longer registered', function () {
            const asset = new Asset('sog', 'gsplat', { url: META_URL });

            for (const parser of parsers()) {
                expect(parser._shouldAbort(asset, false)).to.equal(true);
            }
        });
    });
});
