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

    it('no events are added to the asset when autoLoad is false', function () {
        var asset = new pc.Asset("Default Asset", "texture");

        app.assets.add(asset);

        var la = new pc.LocalizedAsset(app);
        la.defaultAsset = asset.id;

        expect(asset.hasEvent('load')).to.equal(false);
        expect(asset.hasEvent('change')).to.equal(false);
        expect(asset.hasEvent('remove')).to.equal(false);
    });

    it('events are added to the asset when autoLoad is true', function () {
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

        asset.setLocalizedAssetId('fr', asset2.id);

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

        asset.setLocalizedAssetId('fr', asset2.id);

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

        asset.setLocalizedAssetId('fr', asset2.id);

        app.assets.add(asset);
        app.assets.add(asset2);

        var la = new pc.LocalizedAsset(app);
        la.autoLoad = true;
        la.defaultAsset = asset.id;

        expect(asset.hasEvent('load')).to.equal(true);
        expect(asset.hasEvent('change')).to.equal(true);
        expect(asset.hasEvent('remove')).to.equal(true);

        app.i18n.locale = 'fr';

        expect(asset.hasEvent('load')).to.equal(false);
        expect(asset.hasEvent('change')).to.equal(false);
        expect(asset.hasEvent('remove')).to.equal(false);

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

        asset.fire('load');
        asset.fire('change');
        asset.fire('remove');

        expect(loadFired).to.equal(true);
        expect(changeFired).to.equal(true);
        expect(removeFired).to.equal(true);

    });
});
