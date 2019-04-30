describe('pc.LocalizedAsset', function () {
    var app;
    var canvas;

    beforeEach(function () {
        canvas = document.createElement("canvas");
        app = new pc.Application(canvas);
    });

    afterEach(function () {
        app.destroy();
        app = null;
        canvas = null;
    });

    it('Setting defaultAsset sets localizedAsset to the same value if default asset has no localizations', function () {
        var asset = new pc.Asset("Default Asset", "texture");

        app.assets.add(asset);

        var la = new pc.LocalizedAsset(app);
        la.defaultAsset = asset.id;

        expect(la.defaultAsset).to.equal(asset.id);
        expect(la.localizedAsset).to.equal(asset.id);
    });

    it('destroy removes asset references and events', function () {
        var asset = new pc.Asset("Default Asset", "texture");

        var la = new pc.LocalizedAsset(app);
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

        var la2 = new pc.LocalizedAsset(app);
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

    it('no load and change events are added to the asset when autoLoad is false', function () {
        var asset = new pc.Asset("Default Asset", "texture");

        app.assets.add(asset);

        var la = new pc.LocalizedAsset(app);
        la.defaultAsset = asset.id;

        expect(asset.hasEvent('load')).to.equal(false);
        expect(asset.hasEvent('change')).to.equal(false);
    });

    it('load, change and remove events are added to the asset when autoLoad is true', function () {
        var asset = new pc.Asset("Default Asset", "texture");

        app.assets.add(asset);

        var la = new pc.LocalizedAsset(app);
        la.autoLoad = true;
        la.defaultAsset = asset.id;

        expect(asset.hasEvent('load')).to.equal(true);
        expect(asset.hasEvent('change')).to.equal(true);
        expect(asset.hasEvent('remove')).to.equal(true);
    });

    it('events are added to the asset when autoLoad becomes true later', function () {
        var asset = new pc.Asset("Default Asset", "texture");

        app.assets.add(asset);

        var la = new pc.LocalizedAsset(app);
        la.defaultAsset = asset.id;

        la.autoLoad = true;

        expect(asset.hasEvent('load')).to.equal(true);
        expect(asset.hasEvent('change')).to.equal(true);
        expect(asset.hasEvent('remove')).to.equal(true);
    });

    it('setting defaultAsset picks the correct localizedAsset when the locale is already different', function () {
        var asset = new pc.Asset("Default Asset", "texture");
        var asset2 = new pc.Asset("Localized Asset", "texture");

        asset.addLocalizedAssetId('fr', asset2.id);

        app.assets.add(asset);
        app.assets.add(asset2);

        app.i18n.locale = 'fr';

        var la = new pc.LocalizedAsset(app);
        la.defaultAsset = asset.id;

        expect(la.defaultAsset).to.equal(asset.id);
        expect(la.localizedAsset).to.equal(asset2.id);
    });

    it('changing the locale after defaultAsset is set changes the localized asset', function () {
        var asset = new pc.Asset("Default Asset", "texture");
        var asset2 = new pc.Asset("Localized Asset", "texture");

        asset.addLocalizedAssetId('fr', asset2.id);

        app.assets.add(asset);
        app.assets.add(asset2);

        var la = new pc.LocalizedAsset(app);
        la.defaultAsset = asset.id;

        expect(la.defaultAsset).to.equal(asset.id);

        app.i18n.locale = 'fr';

        expect(la.localizedAsset).to.equal(asset2.id);
    });

    it('changing the localizedAsset removes events from the defaultAsset', function () {
        var asset = new pc.Asset("Default Asset", "texture");
        var asset2 = new pc.Asset("Localized Asset", "texture");

        asset.addLocalizedAssetId('fr', asset2.id);

        app.assets.add(asset);
        app.assets.add(asset2);

        var la = new pc.LocalizedAsset(app);
        la.autoLoad = true;
        la.defaultAsset = asset.id;

        expect(asset.hasEvent('load')).to.equal(true);
        expect(asset.hasEvent('change')).to.equal(true);
        expect(asset.hasEvent('remove')).to.equal(true);
        // there should be 2 remove events one for the defaultAsset
        // and one for the localizedAsset
        expect(asset._callbacks['remove'].length).to.equal(2);

        app.i18n.locale = 'fr';

        expect(asset.hasEvent('load')).to.equal(false);
        expect(asset.hasEvent('change')).to.equal(false);
        // there should now be only 1 remove event for the defaultAsset
        expect(asset._callbacks['remove'].length).to.equal(1);

        expect(asset2.hasEvent('load')).to.equal(true);
        expect(asset2.hasEvent('change')).to.equal(true);
        expect(asset2.hasEvent('remove')).to.equal(true);
    });

    it('asset events are propagated to pc.LocalizedAsset', function () {
        var asset = new pc.Asset("Default Asset", "texture");

        app.assets.add(asset);

        var la = new pc.LocalizedAsset(app);
        la.autoLoad = true;
        la.defaultAsset = asset.id;

        var loadFired = false;
        var changeFired = false;
        var removeFired = false;

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

    it('when disableLocalization is true only the defaultAsset is used', function () {
        var asset = new pc.Asset("Default Asset", "texture");
        var asset2 = new pc.Asset("Localized Asset", "texture");

        asset.addLocalizedAssetId('fr', asset2.id);

        app.assets.add(asset);
        app.assets.add(asset2);

        app.i18n.locale = 'fr';

        var la = new pc.LocalizedAsset(app);
        la.disableLocalization = true;
        la.defaultAsset = asset.id;

        expect(la.defaultAsset).to.equal(asset.id);
        expect(la.localizedAsset).to.equal(asset.id);
    });

    it('setting null asset for locale falls back to defaultAsset', function () {
        var asset = new pc.Asset("Default Asset", "texture");
        var asset2 = new pc.Asset("Localized Asset", "texture");

        asset.addLocalizedAssetId('fr', null);

        app.assets.add(asset);
        app.assets.add(asset2);

        app.i18n.locale = 'fr';

        var la = new pc.LocalizedAsset(app);
        la.defaultAsset = asset.id;

        expect(la.defaultAsset).to.equal(asset.id);
        expect(la.localizedAsset).to.equal(asset.id);
    });

    it('setting a new locale fires add:localized', function (done) {
        var asset = new pc.Asset("Default Asset", "texture");
        var asset2 = new pc.Asset("Localized Asset", "texture");

        asset.on('add:localized', function (locale, assetId) {
            expect(locale).to.equal('fr');
            expect(assetId).to.equal(asset2.id);
            done();
        });

        asset.addLocalizedAssetId('fr', asset2.id);
    });

    it('removing a locale fires remove:localized', function (done) {
        var asset = new pc.Asset("Default Asset", "texture");
        var asset2 = new pc.Asset("Localized Asset", "texture");

        asset.addLocalizedAssetId('fr', asset2.id);

        asset.on('remove:localized', function (locale, assetId) {
            expect(locale).to.equal('fr');
            expect(assetId).to.equal(asset2.id);
            done();
        });

        asset.removeLocalizedAssetId('fr');
    });

    it('setting a localized asset for the current locale updates the localizedAsset', function () {
        var asset = new pc.Asset("Default Asset", "texture");
        app.assets.add(asset);
        var asset2 = new pc.Asset("Localized Asset", "texture");
        app.assets.add(asset2);

        var la = new pc.LocalizedAsset(app);
        la.defaultAsset = asset;
        app.i18n.locale = 'fr';
        expect(la.localizedAsset).to.equal(asset.id);

        asset.addLocalizedAssetId('fr', asset2.id);
        expect(la.localizedAsset).to.equal(asset2.id);
    });

    it('removing a localized asset for the current locale updates the localizedAsset to the defaultAsset', function () {
        var asset = new pc.Asset("Default Asset", "texture");
        app.assets.add(asset);
        var asset2 = new pc.Asset("Localized Asset", "texture");
        app.assets.add(asset2);

        asset.addLocalizedAssetId('fr', asset2.id);
        app.i18n.locale = 'fr';

        var la = new pc.LocalizedAsset(app);
        la.defaultAsset = asset;
        expect(la.localizedAsset).to.equal(asset2.id);

        asset.removeLocalizedAssetId('fr');
        expect(la.localizedAsset).to.equal(asset.id);
    });

    it('setting a localized asset for the current locale updates the localizedAsset even if defaultAsset is added to the registry later', function () {
        var asset = new pc.Asset("Default Asset", "texture");
        var asset2 = new pc.Asset("Localized Asset", "texture");
        app.assets.add(asset2);

        var la = new pc.LocalizedAsset(app);
        la.defaultAsset = asset;
        app.i18n.locale = 'fr';
        expect(la.localizedAsset).to.equal(asset.id);

        app.assets.add(asset);

        asset.addLocalizedAssetId('fr', asset2.id);
        expect(la.localizedAsset).to.equal(asset2.id);
    });


    it('removing a localized asset from the registry makes the pc.LocalizedAsset switch to the defaultAsset', function () {
        var asset = new pc.Asset("Default Asset", "texture");
        app.assets.add(asset);
        var asset2 = new pc.Asset("Localized Asset", "texture");
        app.assets.add(asset2);

        asset.addLocalizedAssetId('fr', asset2.id);
        app.i18n.locale = 'fr';

        var la = new pc.LocalizedAsset(app);
        la.autoLoad = true;
        la.defaultAsset = asset;
        expect(la.localizedAsset).to.equal(asset2.id);

        app.assets.remove(asset2);
        expect(la.localizedAsset).to.equal(asset.id);
    });

    it('removing the defaultAsset from the registry keeps same localizedAsset and adds "add" event handler', function () {
        var asset = new pc.Asset("Default Asset", "texture");
        app.assets.add(asset);
        var asset2 = new pc.Asset("Localized Asset", "texture");
        app.assets.add(asset2);

        asset.addLocalizedAssetId('fr', asset2.id);
        app.i18n.locale = 'fr';

        var la = new pc.LocalizedAsset(app);
        la.autoLoad = true;
        la.defaultAsset = asset;
        expect(la.localizedAsset).to.equal(asset2.id);

        expect(app.assets.hasEvent('add:' + asset.id)).to.equal(false);

        app.assets.remove(asset);
        expect(la.localizedAsset).to.equal(asset2.id);

        expect(app.assets.hasEvent('add:' + asset.id)).to.equal(true);
    });
});
