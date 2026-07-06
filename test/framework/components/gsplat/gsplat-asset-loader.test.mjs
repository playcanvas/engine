import { expect } from 'chai';
import { restore, spy } from 'sinon';

import { GSplatAssetLoader } from '../../../../src/framework/components/gsplat/gsplat-asset-loader.js';

describe('GSplatAssetLoader', function () {
    let registry;
    let loader;
    let loadCalls;

    beforeEach(function () {
        loadCalls = 0;
        registry = {
            add(asset) {
                asset.registry = registry;
            },
            remove() {},
            fire() {},
            getByUrl() {
                return null;
            },
            load(asset) {
                loadCalls++;
            },
            loader: {
                getHandler: () => ({})
            },
            _loader: {
                clearCache() {}
            }
        };
        loader = new GSplatAssetLoader(registry);
    });

    afterEach(function () {
        restore();
    });

    const lastAsset = () => {
        const url = [...loader._urlToAsset.keys()].at(-1);
        return loader._urlToAsset.get(url);
    };

    // Simulates a load that was cancelled mid-flight (e.g. LOD moved on) and resolved via the
    // success callback with no resource, as opposed to a genuine error.
    const resolveAsCancelledWithNoResource = () => {
        const asset = lastAsset();
        asset.loading = false;
        asset.loaded = true;
        asset.resource = null;
        asset.fire('load', asset);
    };

    const resolveWithResource = (resource) => {
        const asset = lastAsset();
        asset.loading = false;
        asset.loaded = true;
        asset.resource = resource;
        asset.fire('load', asset);
    };

    // Simulates a genuine load error (network/parse failure), which the registry always
    // reports via 'error', not a null-resource 'load'.
    const resolveWithError = (message = 'simulated error') => {
        const asset = lastAsset();
        asset.loading = false;
        asset.loaded = true;
        asset.fire('error', message, asset);
    };

    describe('#load', function () {

        it('retries indefinitely when a previous load was cancelled with no resource', function () {
            const url = 'http://example.com/chunk.json';

            loader.load(url);
            resolveAsCancelledWithNoResource();
            expect(loadCalls).to.equal(1);
            expect(loader.getResource(url)).to.equal(null);

            // Cancellation can repeat many times (routine LOD churn) without ever giving up.
            for (let i = 0; i < 10; i++) {
                loader.load(url);
                resolveAsCancelledWithNoResource();
            }
            expect(loadCalls).to.equal(11);

            loader.load(url);
            resolveWithResource({ ok: true });
            expect(loader.getResource(url)).to.deep.equal({ ok: true });
        });

        it('does not retry a URL that has genuinely, permanently failed', function () {
            const url = 'http://example.com/chunk.json';

            loader.load(url);
            for (let i = 0; i < loader.maxRetries; i++) {
                resolveWithError();
            }
            resolveWithError();

            expect(loader.hasFailed(url)).to.equal(true);
            const callsAtFailure = loadCalls;

            loader.load(url);
            expect(loadCalls).to.equal(callsAtFailure);
        });

        it('does not accumulate duplicate load listeners across error retries', function () {
            const url = 'http://example.com/chunk.json';

            loader.load(url);
            resolveWithError();
            resolveWithError();

            // Two retries consumed (each attaches a fresh 'error' listener). If the original
            // 'load' listener from the initial _startLoading() call had been duplicated by
            // either retry, _onAssetLoadSuccess (and so _processQueue) would run once per
            // duplicate on the eventual success below instead of exactly once.
            const processQueueSpy = spy(loader, '_processQueue');
            resolveWithResource({ ok: true });

            expect(processQueueSpy.callCount).to.equal(1);
            expect(loader.getResource(url)).to.deep.equal({ ok: true });
        });

        it('retries a URL again after it is unloaded and re-requested', function () {
            const url = 'http://example.com/chunk.json';

            loader.load(url);
            for (let i = 0; i < loader.maxRetries; i++) {
                resolveWithError();
            }
            resolveWithError();
            expect(loader.hasFailed(url)).to.equal(true);

            loader.unload(url);
            expect(loader.hasFailed(url)).to.equal(false);

            loader.load(url);
            resolveWithResource({ ok: true });
            expect(loader.getResource(url)).to.deep.equal({ ok: true });
        });

    });

    describe('#hasFailed', function () {

        it('returns false while a load is in progress, cancelled, or never attempted', function () {
            const url = 'http://example.com/chunk.json';
            expect(loader.hasFailed(url)).to.equal(false);

            loader.load(url);
            expect(loader.hasFailed(url)).to.equal(false);

            resolveAsCancelledWithNoResource();
            expect(loader.hasFailed(url)).to.equal(false);
        });

        it('returns false once a load succeeds with a real resource', function () {
            const url = 'http://example.com/chunk.json';
            loader.load(url);
            resolveWithResource({ ok: true });
            expect(loader.hasFailed(url)).to.equal(false);
        });

        it('returns true once genuine error retries are exhausted', function () {
            const url = 'http://example.com/chunk.json';

            loader.load(url);
            for (let i = 0; i < loader.maxRetries; i++) {
                resolveWithError();
            }
            resolveWithError();

            expect(loader.hasFailed(url)).to.equal(true);
        });

    });

    describe('cancellation while in flight', function () {

        it('does not warn or error when a load is cancelled before it resolves (routine LOD churn)', function () {
            const url = 'http://example.com/chunk.json';
            const warnSpy = spy(console, 'warn');
            const errorSpy = spy(console, 'error');

            loader.load(url);
            const asset = loader._urlToAsset.get(url);

            // The octree no longer wants this file (e.g. its ref count reached zero as the
            // camera moved on) before the in-flight load resolved - this is the routine,
            // high-frequency cancellation path during scene traversal, not an error condition.
            loader.unload(url);

            // The in-flight request finally settles (as an error, in this case) after
            // cancellation. Since unload() already tore down our listeners, this should be a
            // no-op from GSplatAssetLoader's point of view.
            asset.fire('error', 'simulated late network error', asset);

            expect(warnSpy.called).to.equal(false);
            expect(errorSpy.called).to.equal(false);
            expect(loader.hasFailed(url)).to.equal(false);

            // A later re-request (e.g. the camera swings back) starts a fresh attempt rather
            // than being blocked by residual state from the cancelled one.
            loader.load(url);
            expect(loadCalls).to.equal(2);
        });

    });
});
