import { expect } from 'chai';
import sinon from 'sinon';

import { Debug } from '../../../src/core/debug.js';
import { AssetRegistry } from '../../../src/framework/asset/asset-registry.js';
import { Asset } from '../../../src/framework/asset/asset.js';
import { BundleRegistry } from '../../../src/framework/bundle/bundle-registry.js';
import { FEATURE_BUNDLES } from '../../../src/framework/features/constants.js';
import { featureBundles } from '../../../src/framework/features/feature-bundles.js';
import { BundleHandler } from '../../../src/framework/handlers/bundle.js';
import { ResourceLoader } from '../../../src/framework/handlers/loader.js';
import { installFeatures } from '../../../src/scene/features/install-features.js';
import { createApp } from '../../app.mjs';
import { createGraphicsDevice } from '../../device.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('Bundles feature', function () {

    describe('installation', function () {
        let device;
        let host;

        beforeEach(function () {
            device = createGraphicsDevice({ width: 1, height: 1 });
            host = { graphicsDevice: device, bundles: null };
            host.loader = new ResourceLoader(host);
            host.assets = new AssetRegistry(host.loader);
        });

        afterEach(function () {
            host.bundles?.destroy();
            host.loader.destroy();
            device.destroy();
        });

        it('creates the bundle registry and the bundle handler', function () {
            installFeatures(host, [featureBundles]);

            expect(device.features.has(FEATURE_BUNDLES)).to.equal(true);
            expect(host.bundles).to.be.an.instanceof(BundleRegistry);
            expect(host.assets.bundles).to.equal(host.bundles);
            expect(host.loader.getHandler('bundle')).to.be.an.instanceof(BundleHandler);
        });
    });

    describe('application', function () {
        let app;

        beforeEach(function () {
            jsdomSetup();
            app = createApp();
        });

        afterEach(function () {
            sinon.restore();
            app.destroy();
            jsdomTeardown();
        });

        it('is installed by the application', function () {
            expect(app.graphicsDevice.features.has(FEATURE_BUNDLES)).to.equal(true);
            expect(app.bundles).to.be.an.instanceof(BundleRegistry);
            expect(app.loader.getHandler('bundle')).to.be.an.instanceof(BundleHandler);
        });

        it('loads assets directly without the bundle registry', function () {
            // as if the application did not install the bundles feature
            app.bundles.destroy();
            app.bundles = null;

            const load = sinon.stub(app.loader.getHandler('text'), 'load');
            const asset = new Asset('text', 'text', { filename: 'test.txt', url: 'test/assets/test.txt' });
            app.assets.add(asset);
            app.assets.load(asset);

            expect(load.calledOnce).to.equal(true);
            expect(load.firstCall.args[0]).to.deep.equal({ load: 'test/assets/test.txt', original: 'test.txt' });
        });

        it('asserts when a bundle asset is parsed without the feature', function () {
            app.graphicsDevice.features.delete(FEATURE_BUNDLES);
            const assert = sinon.stub(Debug, 'assert');

            app._parseAssets({
                1: { id: 1, name: 'my bundle', type: 'bundle', file: null, data: { assets: [] }, tags: [], preload: false, meta: null }
            });

            const failed = assert.getCalls().filter(call => !call.args[0]).map(call => call.args[1]);
            expect(failed).to.include('Bundle asset [my bundle] needs the bundles feature to be installed.');
        });
    });
});
