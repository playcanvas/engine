import { LocalizedAsset } from '../../../src/framework/asset/asset-localized.js';
import { Application } from '../../../src/framework/application.js';
import { Asset } from '../../../src/framework/asset/asset.js';

import { HTMLCanvasElement } from '@playcanvas/canvas-mock';

import { expect } from 'chai';

describe('LocalizedAsset', function () {

    let app;

    beforeEach(function () {
        const canvas = new HTMLCanvasElement(500, 500);
        app = new Application(canvas);
    });

    afterEach(function () {
        app.destroy();
    });

    it('sets defaultAsset and localizedAsset to the same id if defaultAsset has no localization', function () {
        const asset = new Asset('Default Asset', 'texture');

        app.assets.add(asset);

        const la = new LocalizedAsset(app);
        la.defaultAsset = asset.id;

        expect(la.defaultAsset).to.equal(asset.id);
        expect(la.localizedAsset).to.equal(asset.id);
    });

    it('does not add load and change events to the asset when autoLoad is false', function () {
        const asset = new Asset('Default Asset', 'texture');

        app.assets.add(asset);

        const la = new LocalizedAsset(app);
        la.defaultAsset = asset.id;

        expect(asset.hasEvent('load')).to.equal(false);
        expect(asset.hasEvent('change')).to.equal(false);
    });

    it('adds load, change and remove events to the asset when autoLoad is true', function () {
        const asset = new Asset('Default Asset', 'texture');

        app.assets.add(asset);

        const la = new LocalizedAsset(app);
        la.autoLoad = true;
        la.defaultAsset = asset.id;

        expect(asset.hasEvent('load')).to.equal(true);
        expect(asset.hasEvent('change')).to.equal(true);
        expect(asset.hasEvent('remove')).to.equal(true);
    });

    it('adds events to the asset when autoLoad becomes true later', function () {
        const asset = new Asset('Default Asset', 'texture');

        app.assets.add(asset);

        const la = new LocalizedAsset(app);
        la.defaultAsset = asset.id;

        la.autoLoad = true;

        expect(asset.hasEvent('load')).to.equal(true);
        expect(asset.hasEvent('change')).to.equal(true);
        expect(asset.hasEvent('remove')).to.equal(true);
    });

    it('picks the correct localizedAsset when the locale is already different', function () {
        const asset = new Asset('Default Asset', 'texture');
        const asset2 = new Asset('Localized Asset', 'texture');

        asset.addLocalizedAssetId('fr', asset2.id);

        app.assets.add(asset);
        app.assets.add(asset2);

        app.i18n.locale = 'fr';

        const la = new LocalizedAsset(app);
        la.defaultAsset = asset.id;

        expect(la.defaultAsset).to.equal(asset.id);
        expect(la.localizedAsset).to.equal(asset2.id);
    });

    it('changes the localized asset after defaultAsset and then the locale change', function () {
        const asset = new Asset('Default Asset', 'texture');
        const asset2 = new Asset('Localized Asset', 'texture');

        asset.addLocalizedAssetId('fr', asset2.id);

        app.assets.add(asset);
        app.assets.add(asset2);

        const la = new LocalizedAsset(app);
        la.defaultAsset = asset.id;

        expect(la.defaultAsset).to.equal(asset.id);

        app.i18n.locale = 'fr';

        expect(la.localizedAsset).to.equal(asset2.id);
    });

    it('removes events from the defaultAsset and localizedAsset is changed', function () {
        const asset = new Asset('Default Asset', 'texture');
        const asset2 = new Asset('Localized Asset', 'texture');

        asset.addLocalizedAssetId('fr', asset2.id);

        app.assets.add(asset);
        app.assets.add(asset2);

        const la = new LocalizedAsset(app);
        la.autoLoad = true;
        la.defaultAsset = asset.id;

        expect(asset.hasEvent('load')).to.equal(true);
        expect(asset.hasEvent('change')).to.equal(true);
        expect(asset.hasEvent('remove')).to.equal(true);
        // there should be 2 remove events one for the defaultAsset
        // and one for the localizedAsset
        expect(asset._callbacks.remove.length).to.equal(2);

        app.i18n.locale = 'fr';

        expect(asset.hasEvent('load')).to.equal(false);
        expect(asset.hasEvent('change')).to.equal(false);
        // there should now be only 1 remove event for the defaultAsset
        expect(asset._callbacks.remove.length).to.equal(1);

        expect(asset2.hasEvent('load')).to.equal(true);
        expect(asset2.hasEvent('change')).to.equal(true);
        expect(asset2.hasEvent('remove')).to.equal(true);
    });

    it('propagates asset events to LocalizedAsset', function () {
        const asset = new Asset('Default Asset', 'texture');

        app.assets.add(asset);

        const la = new LocalizedAsset(app);
        la.autoLoad = true;
        la.defaultAsset = asset.id;

        let loadFired = false;
        let changeFired = false;
        let removeFired = false;

        la.on('load', function () {
            loadFired = true;
        });

        la.on('change', function () {
            changeFired = true;
        });

        la.on('remove', function () {
            removeFired = true;
        });

        asset.fire('load', asset);
        asset.fire('change', asset);
        asset.fire('remove', asset);

        expect(loadFired).to.equal(true);
        expect(changeFired).to.equal(true);
        expect(removeFired).to.equal(true);
    });

    it('uses only the defaultAsset when disableLocalization is true', function () {
        const asset = new Asset('Default Asset', 'texture');
        const asset2 = new Asset('Localized Asset', 'texture');

        asset.addLocalizedAssetId('fr', asset2.id);

        app.assets.add(asset);
        app.assets.add(asset2);

        app.i18n.locale = 'fr';

        const la = new LocalizedAsset(app);
        la.disableLocalization = true;
        la.defaultAsset = asset.id;

        expect(la.defaultAsset).to.equal(asset.id);
        expect(la.localizedAsset).to.equal(asset.id);
    });

    it('falls back to defaultAsset when a null asset is set for a locale', function () {
        const asset = new Asset('Default Asset', 'texture');
        const asset2 = new Asset('Localized Asset', 'texture');

        asset.addLocalizedAssetId('fr', null);

        app.assets.add(asset);
        app.assets.add(asset2);

        app.i18n.locale = 'fr';

        const la = new LocalizedAsset(app);
        la.defaultAsset = asset.id;

        expect(la.defaultAsset).to.equal(asset.id);
        expect(la.localizedAsset).to.equal(asset.id);
    });

    it('fires add:localized on setting a new locale', function (done) {
        const asset = new Asset('Default Asset', 'texture');
        const asset2 = new Asset('Localized Asset', 'texture');

        asset.on('add:localized', function (locale, assetId) {
            expect(locale).to.equal('fr');
            expect(assetId).to.equal(asset2.id);
            done();
        });

        asset.addLocalizedAssetId('fr', asset2.id);
    });

    it('fires remove:localized on removing a locale', function (done) {
        const asset = new Asset('Default Asset', 'texture');
        const asset2 = new Asset('Localized Asset', 'texture');

        asset.addLocalizedAssetId('fr', asset2.id);

        asset.on('remove:localized', function (locale, assetId) {
            expect(locale).to.equal('fr');
            expect(assetId).to.equal(asset2.id);
            done();
        });

        asset.removeLocalizedAssetId('fr');
    });

    it('updates the localizedAsset on setting a localized asset for the current locale', function () {
        const asset = new Asset('Default Asset', 'texture');
        app.assets.add(asset);
        const asset2 = new Asset('Localized Asset', 'texture');
        app.assets.add(asset2);

        const la = new LocalizedAsset(app);
        la.defaultAsset = asset;
        app.i18n.locale = 'fr';
        expect(la.localizedAsset).to.equal(asset.id);

        asset.addLocalizedAssetId('fr', asset2.id);
        expect(la.localizedAsset).to.equal(asset2.id);
    });

    it('updates the localizedAsset to the defaultAsset on removing a localized asset for the current locale', function () {
        const asset = new Asset('Default Asset', 'texture');
        app.assets.add(asset);
        const asset2 = new Asset('Localized Asset', 'texture');
        app.assets.add(asset2);

        asset.addLocalizedAssetId('fr', asset2.id);
        app.i18n.locale = 'fr';

        const la = new LocalizedAsset(app);
        la.defaultAsset = asset;
        expect(la.localizedAsset).to.equal(asset2.id);

        asset.removeLocalizedAssetId('fr');
        expect(la.localizedAsset).to.equal(asset.id);
    });

    it('updates the localizedAsset on setting a localized asset for the current locale even if defaultAsset is added to the registry later', function () {
        const asset = new Asset('Default Asset', 'texture');
        const asset2 = new Asset('Localized Asset', 'texture');
        app.assets.add(asset2);

        const la = new LocalizedAsset(app);
        la.defaultAsset = asset;
        app.i18n.locale = 'fr';
        expect(la.localizedAsset).to.equal(asset.id);

        app.assets.add(asset);

        asset.addLocalizedAssetId('fr', asset2.id);
        expect(la.localizedAsset).to.equal(asset2.id);
    });


    it('switches LocalizedAsset to the defaultAsset by removing a localized asset from the registry', function () {
        const asset = new Asset('Default Asset', 'texture');
        app.assets.add(asset);
        const asset2 = new Asset('Localized Asset', 'texture');
        app.assets.add(asset2);

        asset.addLocalizedAssetId('fr', asset2.id);
        app.i18n.locale = 'fr';

        const la = new LocalizedAsset(app);
        la.autoLoad = true;
        la.defaultAsset = asset;
        expect(la.localizedAsset).to.equal(asset2.id);

        app.assets.remove(asset2);
        expect(la.localizedAsset).to.equal(asset.id);
    });

    it('keeps same localizedAsset and adds "add" event handler on removing the defaultAsset from the registry', function () {
        const asset = new Asset('Default Asset', 'texture');
        app.assets.add(asset);
        const asset2 = new Asset('Localized Asset', 'texture');
        app.assets.add(asset2);

        asset.addLocalizedAssetId('fr', asset2.id);
        app.i18n.locale = 'fr';

        const la = new LocalizedAsset(app);
        la.autoLoad = true;
        la.defaultAsset = asset;
        expect(la.localizedAsset).to.equal(asset2.id);

        expect(app.assets.hasEvent('add:' + asset.id)).to.equal(false);

        app.assets.remove(asset);
        expect(la.localizedAsset).to.equal(asset2.id);

        expect(app.assets.hasEvent('add:' + asset.id)).to.equal(true);
    });

    describe('#destroy', function () {

        it('removes asset references and events', function () {
            const asset = new Asset('Default Asset', 'texture');

            const la = new LocalizedAsset(app);
            la.defaultAsset = asset.id;

            la.on('load', function () {});
            la.on('change', function () {});
            la.on('remove', function () {});

            expect(app.assets.hasEvent('add:' + asset.id)).to.equal(true);
            expect(la.hasEvent('load')).to.equal(true);
            expect(la.hasEvent('change')).to.equal(true);
            expect(la.hasEvent('remove')).to.equal(true);

            la.destroy();

            expect(app.assets.hasEvent('add:' + asset.id)).to.equal(false);
            expect(la.hasEvent('load')).to.equal(false);
            expect(la.hasEvent('change')).to.equal(false);
            expect(la.hasEvent('remove')).to.equal(false);

            const la2 = new LocalizedAsset(app);
            la2.defaultAsset = asset.id;
            la2.autoLoad = true;

            expect(app.assets.hasEvent('add:' + asset.id)).to.equal(true);

            app.assets.add(asset);

            expect(app.assets.hasEvent('add:' + asset.id)).to.equal(false);

            expect(asset.hasEvent('load')).to.equal(true);
            expect(asset.hasEvent('change')).to.equal(true);
            expect(asset.hasEvent('remove')).to.equal(true);

            la2.destroy();

            expect(asset.hasEvent('load')).to.equal(false);
            expect(asset.hasEvent('change')).to.equal(false);
            expect(asset.hasEvent('remove')).to.equal(false);
        });

    });

});
