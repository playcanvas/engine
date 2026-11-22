import { expect } from 'chai';
import { strToU8, zipSync } from 'fflate';
import { restore, stub } from 'sinon';

import { Debug } from '../../../src/core/debug.js';
import { Asset } from '../../../src/framework/asset/asset.js';
import { SogTextureCache } from '../../../src/framework/parsers/sog-texture-cache.js';
import { Texture } from '../../../src/platform/graphics/texture.js';
import { http } from '../../../src/platform/net/http.js';
import { GSplatSogResource } from '../../../src/scene/gsplat/gsplat-sog-resource.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

const BASE_URL = 'http://localhost:3210/static/';
const SPLATS = `${BASE_URL}assets/splats/`;
const PALETTE_URL = `${SPLATS}shared/shN_centroids.webp`;

const codebook = offset => Array.from({ length: 256 }, (_, i) => (i - 128 + offset) / 64);

// a v2 SOG meta with 2 SH bands whose palette lives at `palette`, relative to the meta.json
const makeMeta = (palette, shNCodebook = codebook(0)) => ({
    version: 2,
    count: 1,
    means: { mins: [0, 0, 0], maxs: [1, 1, 1], files: ['means_l.webp', 'means_u.webp'] },
    quats: { files: ['quats.webp'] },
    scales: { codebook: codebook(1), files: ['scales.webp'] },
    sh0: { codebook: codebook(2), files: ['sh0.webp'] },
    shN: { count: 1, bands: 2, codebook: shNCodebook, files: [palette, 'shN_labels.webp'] }
});

const destroyed = texture => texture.device === null;

describe('SogTextureCache', function () {
    let app;
    let cache;

    // urls of the texture loads the registry was asked for, in order
    let loads;

    // texture assets whose load is held back, by url
    let pending;

    // when set, texture loads stay pending until completeLoad()
    let deferLoads;

    // urls whose texture load fails
    let failing;

    // completes a held-back texture load and returns the texture it created
    const completeLoad = (url) => {
        const asset = pending.get(url);
        pending.delete(url);
        const texture = new Texture(app.graphicsDevice, { width: asset.file.url.includes('centroids') ? 512 : 1, height: 1 });
        asset.resource = texture;
        asset.loaded = true;
        asset.loading = false;
        asset.fire('load', asset);
        return texture;
    };

    beforeEach(function () {
        jsdomSetup();

        const base = document.createElement('base');
        base.href = BASE_URL;
        document.head.appendChild(base);

        app = createApp();

        // no centers readback on the null device
        app.scene.gsplatCentersEnabled = false;

        cache = app.loader.getHandler('gsplat').sogTextureCache;
        loads = [];
        pending = new Map();
        deferLoads = false;
        failing = new Set();

        const load = app.assets.load;
        stub(app.assets, 'load').callsFake((asset) => {
            if (asset.type !== 'texture') {
                load.call(app.assets, asset);
                return;
            }

            const url = asset.file.url;
            loads.push(url);
            asset.loading = true;
            pending.set(url, asset);

            if (failing.has(url)) {
                pending.delete(url);
                asset.loaded = true;
                asset.loading = false;
                asset.fire('error', 'decode failed', asset);
            } else if (!deferLoads) {
                completeLoad(url);
            }
        });
    });

    afterEach(function () {
        app?.destroy();
        app = null;
        jsdomTeardown();
        restore();
    });

    describe('#acquire', function () {
        it('loads a url once and hands every holder the same texture', async function () {
            const a = cache.acquire(PALETTE_URL);
            const b = cache.acquire(PALETTE_URL);

            const [ta, tb] = await Promise.all([a.promise, b.promise]);
            expect(loads).to.deep.equal([PALETTE_URL]);
            expect(ta).to.be.an.instanceof(Texture);
            expect(tb).to.equal(ta);
            expect(a.texture).to.equal(ta);
            expect(a.asset).to.equal(b.asset);
            expect(a.shared).to.be.true;
            expect(app.assets.getByUrl(PALETTE_URL)).to.equal(a.asset);
        });

        it('joins a load that is still in flight', async function () {
            deferLoads = true;
            const a = cache.acquire(PALETTE_URL);
            const b = cache.acquire(PALETTE_URL);
            expect(loads).to.deep.equal([PALETTE_URL]);

            completeLoad(PALETTE_URL);
            expect(await b.promise).to.equal(await a.promise);
        });

        it('uses the given contents and drops them once decoded', async function () {
            deferLoads = true;
            const contents = new Uint8Array(4);
            const ref = cache.acquire(PALETTE_URL, { filename: 'shN_centroids.webp', contents });
            expect(ref.asset.name).to.equal('shN_centroids.webp');
            expect(ref.asset.file.contents).to.equal(contents);

            completeLoad(PALETTE_URL);
            await ref.promise;
            expect(ref.asset.file.contents).to.equal(null);
        });
    });

    describe('#release', function () {
        it('destroys the texture only when its last holder releases it', async function () {
            const a = cache.acquire(PALETTE_URL);
            const b = cache.acquire(PALETTE_URL);
            const texture = await a.promise;
            const asset = a.asset;

            a.release();
            expect(destroyed(texture)).to.be.false;
            expect(b.shared).to.be.false;
            expect(cache.size).to.equal(1);

            b.release();
            expect(destroyed(texture)).to.be.true;
            expect(cache.size).to.equal(0);
            expect(app.assets.list()).to.not.include(asset);
            expect(app.loader.getFromCache(PALETTE_URL, 'texture')).to.equal(undefined);
        });

        it('ignores a second release of the same handle', async function () {
            const a = cache.acquire(PALETTE_URL);
            const b = cache.acquire(PALETTE_URL);
            const texture = await a.promise;

            a.release();
            a.release();
            expect(destroyed(texture)).to.be.false;

            b.release();
            expect(destroyed(texture)).to.be.true;
        });

        it('loads the url again after its texture was destroyed', async function () {
            const a = cache.acquire(PALETTE_URL);
            const first = await a.promise;
            a.release();

            const b = cache.acquire(PALETTE_URL);
            const second = await b.promise;
            expect(loads).to.deep.equal([PALETTE_URL, PALETTE_URL]);
            expect(second).to.not.equal(first);
            expect(destroyed(second)).to.be.false;
        });

        it('destroys a texture released while loading once the load completes', async function () {
            deferLoads = true;
            const a = cache.acquire(PALETTE_URL);
            const asset = a.asset;
            a.release();

            // gone from the cache and the registry straight away
            expect(cache.size).to.equal(0);
            expect(app.assets.list()).to.not.include(asset);

            completeLoad(PALETTE_URL);
            const texture = await a.promise;
            expect(destroyed(texture)).to.be.true;
        });
    });

    describe('failed loads', function () {
        it('rejects every holder and loads again on the next request', async function () {
            failing.add(PALETTE_URL);
            const a = cache.acquire(PALETTE_URL);
            const results = await Promise.allSettled([a.promise]);
            expect(results[0].status).to.equal('rejected');
            expect(cache.size).to.equal(0);

            failing.delete(PALETTE_URL);
            const b = cache.acquire(PALETTE_URL);
            expect(await b.promise).to.be.an.instanceof(Texture);
            expect(loads).to.deep.equal([PALETTE_URL, PALETTE_URL]);

            // releasing the failed handle leaves the new texture alone
            a.release();
            expect(destroyed(b.texture)).to.be.false;
        });
    });

    describe('#releaseSource', function () {
        it('drops the CPU source only once every holder has asked', async function () {
            const a = cache.acquire(PALETTE_URL);
            const b = cache.acquire(PALETTE_URL);
            const texture = await a.promise;

            a.releaseSource();
            expect(texture.releaseSourceAfterUpload).to.not.equal(true);

            b.releaseSource();
            expect(texture.releaseSourceAfterUpload).to.equal(true);
        });

        it('drops it when the holder that kept it leaves', async function () {
            const a = cache.acquire(PALETTE_URL);
            const b = cache.acquire(PALETTE_URL);
            const texture = await a.promise;

            a.releaseSource();
            b.release();
            expect(texture.releaseSourceAfterUpload).to.equal(true);
        });
    });

    describe('SOG files sharing an SH palette', function () {
        const META_A = `${SPLATS}a/meta.json`;
        const META_B = `${SPLATS}b/meta.json`;

        let metas;

        const loadSog = (url) => {
            const asset = new Asset(url, 'gsplat', { url });
            app.assets.add(asset);
            return new Promise((resolve, reject) => {
                asset.once('load', () => resolve(asset));
                asset.once('error', reject);
                app.assets.load(asset);
            });
        };

        beforeEach(function () {
            metas = new Map([
                [META_A, makeMeta('../shared/shN_centroids.webp')],
                [META_B, makeMeta('../shared/shN_centroids.webp')]
            ]);
            stub(http, 'get').callsFake((url, options, callback) => callback(null, metas.get(url)));
        });

        it('load the palette once and share its texture', async function () {
            const [a, b] = await Promise.all([loadSog(META_A), loadSog(META_B)]);
            const ra = /** @type {GSplatSogResource} */ (a.resource);
            const rb = /** @type {GSplatSogResource} */ (b.resource);

            expect(ra).to.be.an.instanceof(GSplatSogResource);
            expect(loads.filter(url => url === PALETTE_URL)).to.have.lengthOf(1);
            expect(ra.gsplatData.sh_centroids).to.equal(rb.gsplatData.sh_centroids);
            expect(ra.gsplatData.shBands).to.equal(2);

            // labels and the other per-splat textures stay per file
            expect(ra.gsplatData.sh_labels).to.not.equal(rb.gsplatData.sh_labels);
            expect(ra.gsplatData.means_l).to.not.equal(rb.gsplatData.means_l);
        });

        it('keep the palette while any file using it is loaded', async function () {
            const [a, b] = await Promise.all([loadSog(META_A), loadSog(META_B)]);
            const da = a.resource.gsplatData;
            const db = b.resource.gsplatData;
            const palette = da.sh_centroids;

            a.unload();
            expect(destroyed(da.means_l)).to.be.true;
            expect(destroyed(da.sh_labels)).to.be.true;
            expect(destroyed(palette)).to.be.false;
            expect(destroyed(db.means_l)).to.be.false;

            // a file loaded now reuses the palette still held by the second one
            const c = await loadSog(META_A);
            expect(c.resource.gsplatData.sh_centroids).to.equal(palette);
            expect(loads.filter(url => url === PALETTE_URL)).to.have.lengthOf(1);

            b.unload();
            c.unload();
            expect(destroyed(palette)).to.be.true;
            expect(cache.size).to.equal(0);
            expect(app.assets.list().filter(asset => asset.type === 'texture')).to.be.empty;
        });

        it('keep the palette when a file sharing it unloads while loading', async function () {
            const a = await loadSog(META_A);
            const palette = a.resource.gsplatData.sh_centroids;

            deferLoads = true;
            const b = new Asset(META_B, 'gsplat', { url: META_B });
            app.assets.add(b);
            app.assets.load(b);
            await new Promise((resolve) => {
                setTimeout(resolve);
            });
            b.unload();

            expect(destroyed(palette)).to.be.false;
            expect(a.resource.gsplatData.sh_centroids).to.equal(palette);

            // the cancelled file's own textures are destroyed as their loads complete, leaving
            // the first file's six and the palette
            const cancelled = [...pending.keys()];
            expect(cancelled).to.have.lengthOf(6);
            const textures = cancelled.map(url => completeLoad(url));
            expect(textures.every(destroyed)).to.be.true;
            expect(app.assets.list().filter(asset => asset.type === 'texture')).to.have.lengthOf(7);
        });

        it('keep a palette the application holds while no file uses it', async function () {
            const hold = cache.acquire(PALETTE_URL);
            const a = await loadSog(META_A);
            const palette = a.resource.gsplatData.sh_centroids;
            expect(palette).to.equal(hold.texture);

            a.unload();
            expect(destroyed(palette)).to.be.false;

            const b = await loadSog(META_B);
            expect(b.resource.gsplatData.sh_centroids).to.equal(palette);
            expect(loads.filter(url => url === PALETTE_URL)).to.have.lengthOf(1);

            b.unload();
            hold.release();
            expect(destroyed(palette)).to.be.true;
        });

        it('share a palette between a SOG bundle and a meta.json', async function () {
            // the bundle embeds its own textures and points at the palette by its absolute url
            const bundleMeta = makeMeta(PALETTE_URL);
            const embedded = { 'meta.json': strToU8(JSON.stringify(bundleMeta)) };
            ['means_l', 'means_u', 'quats', 'scales', 'sh0', 'shN_labels'].forEach((name) => {
                embedded[`${name}.webp`] = new Uint8Array(4);
            });
            const archive = zipSync(embedded, { level: 0 });
            const bundleUrl = `${SPLATS}c.sog`;
            const bundle = new Asset(bundleUrl, 'gsplat', { url: bundleUrl, contents: archive.buffer });
            app.assets.add(bundle);

            const loaded = new Promise((resolve, reject) => {
                bundle.once('load', resolve);
                bundle.once('error', reject);
            });
            app.assets.load(bundle);
            const [a] = await Promise.all([loadSog(META_A), loaded]);

            expect(bundle.resource.gsplatData.sh_centroids).to.equal(a.resource.gsplatData.sh_centroids);
            expect(loads.filter(url => url === PALETTE_URL)).to.have.lengthOf(1);
        });

        it('release their textures when a malformed meta fails the load', async function () {
            // no means: the other textures load, then building the data throws
            const malformed = makeMeta('../shared/shN_centroids.webp');
            delete malformed.means;
            metas.set(META_B, malformed);

            const archive = zipSync({ 'meta.json': strToU8(JSON.stringify(malformed)) }, { level: 0 });
            const bundleUrl = `${SPLATS}c.sog`;
            const bundle = new Asset(bundleUrl, 'gsplat', { url: bundleUrl, contents: archive.buffer });
            app.assets.add(bundle);
            const bundleFailed = new Promise((resolve, reject) => {
                bundle.once('load', () => reject(new Error('loaded')));
                bundle.once('error', resolve);
            });
            app.assets.load(bundle);

            const a = await loadSog(META_A);
            const err = await loadSog(META_B).then(() => null, e => e);
            expect(String(err)).to.contain('TypeError');
            expect(String(await bundleFailed)).to.contain('TypeError');

            // only the healthy file's textures are left, the palette held by it alone
            expect(app.assets.list().filter(asset => asset.type === 'texture')).to.have.lengthOf(7);
            a.unload();
            expect(cache.size).to.equal(0);
        });

        it('are released, and the palette destroyed, when the app is destroyed', async function () {
            const [a] = await Promise.all([loadSog(META_A), loadSog(META_B)]);
            const palette = a.resource.gsplatData.sh_centroids;

            // nothing destroys the cache itself: the app unloads every registered asset, the
            // texture assets and the files whose resources release their handles alike
            app.destroy();
            app = null;

            expect(destroyed(palette)).to.be.true;
            expect(cache.size).to.equal(0);
        });

        it('leave a texture the application still holds to the app teardown', async function () {
            const hold = cache.acquire(PALETTE_URL);
            const palette = await hold.promise;

            app.destroy();
            app = null;

            // the texture asset was registered, so the teardown destroyed its texture; the entry
            // stays until the holder releases it, which no longer touches the destroyed app
            expect(destroyed(palette)).to.be.true;
            expect(cache.size).to.equal(1);
            expect(() => hold.release()).to.not.throw();
            expect(cache.size).to.equal(0);
        });

        it('warn when files sharing a palette disagree on its codebook', async function () {
            metas.set(META_B, makeMeta('../shared/shN_centroids.webp', codebook(5)));
            const warn = stub(Debug, 'warnOnce');

            await Promise.all([loadSog(META_A), loadSog(META_B)]);
            expect(warn.calledOnce).to.be.true;
            expect(warn.firstCall.args[0]).to.contain(PALETTE_URL);
        });

        it('do not warn when they agree', async function () {
            const warn = stub(Debug, 'warnOnce');
            await Promise.all([loadSog(META_A), loadSog(META_B)]);
            expect(warn.called).to.be.false;
        });
    });

    it('is created per app by the gsplat handler', function () {
        expect(cache).to.be.an.instanceof(SogTextureCache);
        expect(cache.size).to.equal(0);
    });
});
