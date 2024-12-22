import { expect } from 'chai';
import { fake } from 'sinon';

import { Asset } from '../../../src/framework/asset/asset.js';
import { AssetRegistry } from '../../../src/framework/asset/asset-registry.js';
import { BundleRegistry } from '../../../src/framework/bundle/bundle-registry.js';

describe('BundleRegistry', () => {
    let loader;
    let assetRegistry;
    let bundleRegistry;

    beforeEach(function () {
        loader = fake();
        assetRegistry = new AssetRegistry(loader);
        bundleRegistry = new BundleRegistry(assetRegistry);
    });

    afterEach(function () {
        const assetsList = assetRegistry.list();
        for (const asset of assetsList) {
            asset.unload();
            asset.off();
        }
        assetRegistry.off();
        assetRegistry = null;

        bundleRegistry.destroy();
        bundleRegistry = null;
    });

    it('bundle asset is added to the bundle registry', function () {
        let asset = new Asset('bundle', 'bundle', null, { assets: [] });
        assetRegistry.add(asset);
        let assets = bundleRegistry.list();
        expect(assets).to.deep.equal([asset]);
    });

    it('bundle asset is removed from the bundle registry', function () {
        let asset = new Asset('bundle', 'bundle', null, { assets: [] });
        assetRegistry.add(asset);
        let bundles = bundleRegistry.list();
        expect(bundles).to.deep.equal([asset]);

        assetRegistry.remove(asset);
        bundles = bundleRegistry.list();
        expect(bundles).to.deep.equal([]);
    });

    it('listBundlesForAsset() returns null for assets not in bundles', function () {
        let asset = new Asset('asset', 'text', {
            url: 'text.txt'
        });
        assetRegistry.add(asset);

        let notInBundle = new Asset('asset', 'text', {
            url: 'text2.txt'
        });
        assetRegistry.add(notInBundle);

        let bundleAsset = new Asset('bundle', 'bundle', null, {
            assets: [asset.id]
        });
        assetRegistry.add(bundleAsset);

        let bundles = bundleRegistry.listBundlesForAsset(notInBundle);
        expect(bundles).to.equal(null);
    });

    it('listBundlesForAsset() lists bundles for asset if asset added before bundle', function () {
        let asset = new Asset('asset', 'text', {
            url: 'text.txt'
        });
        assetRegistry.add(asset);

        let bundleAsset = new Asset('bundle', 'bundle', null, {
            assets: [asset.id]
        });
        assetRegistry.add(bundleAsset);

        let bundles = bundleRegistry.listBundlesForAsset(asset);
        expect(bundles).to.deep.equal([bundleAsset]);
    });

    it('listBundlesForAsset() lists bundles for asset if asset added after bundle', function () {
        let asset = new Asset('asset', 'text', {
            url: 'text.txt'
        });

        let bundleAsset = new Asset('bundle', 'bundle', null, {
            assets: [asset.id]
        });

        assetRegistry.add(bundleAsset);
        assetRegistry.add(asset);

        let bundles = bundleRegistry.listBundlesForAsset(asset);
        expect(bundles).to.deep.equal([bundleAsset]);
    });

    it('listBundlesForAsset() does not return removed bundle asset', function () {
        let asset = new Asset('asset', 'text', {
            url: 'text.txt'
        });
        assetRegistry.add(asset);

        let bundleAsset = new Asset('bundle', 'bundle', null, {
            assets: [asset.id]
        });
        assetRegistry.add(bundleAsset);

        assetRegistry.remove(bundleAsset);

        let bundles = bundleRegistry.listBundlesForAsset(asset);
        expect(bundles).to.equal(null);
    });

    it('listBundlesForAsset() does not return bundle for removed asset', function () {
        let asset = new Asset('asset', 'text', {
            url: 'text.txt'
        });
        assetRegistry.add(asset);

        let bundleAsset = new Asset('bundle', 'bundle', null, {
            assets: [asset.id]
        });
        assetRegistry.add(bundleAsset);

        assetRegistry.remove(asset);

        let bundles = bundleRegistry.listBundlesForAsset(asset);
        expect(bundles).to.equal(null);
    });

    it('hasUrl() returns true for url in bundle', function () {
        let asset = new Asset('asset', 'text', {
            url: 'text.txt'
        });
        assetRegistry.add(asset);

        let bundleAsset = new Asset('bundle', 'bundle', null, {
            assets: [asset.id]
        });
        assetRegistry.add(bundleAsset);

        expect(bundleRegistry.hasUrl('text.txt')).to.equal(true);
    });

    it('hasUrl() returns false for url not in bundle', function () {
        expect(bundleRegistry.hasUrl('missing.txt')).to.equal(false);
    });

    it('hasUrl() returns true for url with query parameters in bundle', function () {
        let asset = new Asset('asset', 'text', {
            url: 'text.txt?query=true&query2=true'
        });
        assetRegistry.add(asset);

        let bundleAsset = new Asset('bundle', 'bundle', null, {
            assets: [asset.id]
        });
        assetRegistry.add(bundleAsset);

        expect(bundleRegistry.hasUrl('text.txt')).to.equal(true);
    });

    it('hasUrl() returns true for all font asset urls', function () {
        let asset = new Asset('asset', 'font', {
            url: 'test.png'
        }, {
            info: {
                maps: [{
                    width: 128, height: 128
                }, {
                    width: 128, height: 128
                }]
            }
        });
        assetRegistry.add(asset);

        let bundleAsset = new Asset('bundle', 'bundle', null, {
            assets: [asset.id]
        });
        assetRegistry.add(bundleAsset);

        expect(bundleRegistry.hasUrl('test.png')).to.equal(true);
        expect(bundleRegistry.hasUrl('test1.png')).to.equal(true);
    });

    it('hasUrl() returns false after asset is removed', function () {
        let asset = new Asset('asset', 'text', {
            url: 'text.txt'
        });
        assetRegistry.add(asset);

        let bundleAsset = new Asset('bundle', 'bundle', null, {
            assets: [asset.id]
        });
        assetRegistry.add(bundleAsset);

        assetRegistry.remove(asset);

        expect(bundleRegistry.hasUrl('text.txt')).to.equal(false);
    });

    it('urlIsLoadedOrLoading() returns false if bundle not loaded', function () {
        let asset = new Asset('asset', 'text', {
            url: 'text.txt'
        });
        assetRegistry.add(asset);

        let bundleAsset = new Asset('bundle', 'bundle', null, {
            assets: [asset.id]
        });
        assetRegistry.add(bundleAsset);

        expect(bundleRegistry.urlIsLoadedOrLoading('text.txt')).to.equal(false);
    });

    it('urlIsLoadedOrLoading() returns false if bundle loaded without a resource', function () {
        let asset = new Asset('asset', 'text', {
            url: 'text.txt'
        });
        assetRegistry.add(asset);

        let bundleAsset = new Asset('bundle', 'bundle', null, {
            assets: [asset.id]
        });
        assetRegistry.add(bundleAsset);
        bundleAsset.loaded = true;

        expect(bundleRegistry.urlIsLoadedOrLoading('text.txt')).to.equal(false);
    });

    it('urlIsLoadedOrLoading() returns true if bundle loaded', function () {
        let asset = new Asset('asset', 'text', {
            url: 'text.txt'
        });
        assetRegistry.add(asset);

        let bundleAsset = new Asset('bundle', 'bundle', null, {
            assets: [asset.id]
        });
        assetRegistry.add(bundleAsset);

        bundleAsset.loaded = true;
        bundleAsset.resource = fake();

        expect(bundleRegistry.urlIsLoadedOrLoading('text.txt')).to.equal(true);
    });

    it('urlIsLoadedOrLoading() returns true if bundle being loaded', function () {
        let asset = new Asset('asset', 'text', {
            url: 'text.txt'
        });
        assetRegistry.add(asset);

        let bundleAsset = new Asset('bundle', 'bundle', null, {
            assets: [asset.id]
        });
        assetRegistry.add(bundleAsset);
        bundleAsset.loading = true;

        expect(bundleRegistry.urlIsLoadedOrLoading('text.txt')).to.equal(true);
    });

    it('loadUrl() calls callback with error if bundle fails to load', function (done) {
        let asset = new Asset('asset', 'text', {
            url: 'text.txt'
        });
        assetRegistry.add(asset);

        let bundleAsset = new Asset('bundle', 'bundle', null, {
            assets: [asset.id]
        });
        assetRegistry.add(bundleAsset);
        bundleAsset.loading = true;

        bundleRegistry.loadUrl('text.txt', function (err, blobUrl) {
            expect(err).to.equal('error');
            done();
        });

        setTimeout(function () {
            bundleAsset.loading = false;
            bundleAsset.loaded = true;
            assetRegistry.fire('error:' + bundleAsset.id, 'error');
        }.bind(this));
    });

});