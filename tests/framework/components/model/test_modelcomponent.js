describe("pc.ModelComponent", function () {
    var app;
    var assets = {};

    beforeEach(function (done) {
        app = new pc.Application(document.createElement("canvas"));

        loadAssets(function () {
            done();
        });
    });

    afterEach(function () {
        app.destroy();
    });

    var loadAssetList = function (list, cb) {
        // listen for asset load events and fire cb() when all assets are loaded
        var count = 0;
        app.assets.on('load', function (asset) {
            count++;
            if (count === list.length) {
                cb();
            }
        });

        // add and load assets
        for (var i = 0; i < list.length; i++) {
            app.assets.add(list[i]);
            app.assets.load(list[i]);
        }
    };

    var loadAssets = function (cb) {
        var assetlist = [
            new pc.Asset('Statue_1.json', 'model', {
                url: 'base/examples/assets/statue/Statue_1.json'
            }),
            new pc.Asset('Statue_Material', 'material', {
                url: 'base/examples/assets/statue/11268/phong9.json'
            })
        ];

        loadAssetList(assetlist, function () {
            assets.model = assetlist[0];
            assets.material = assetlist[1];
            cb();
        });
    };


    it('Create default model component', function () {
        var e = new pc.Entity();
        e.addComponent("model");

        expect(e.model.type).to.equal('asset');
        expect(e.model.asset).to.equal(null);
        expect(e.model.castShadows).to.equal(true);
        expect(e.model.receiveShadows).to.equal(true);
        expect(e.model.castShadowsLightmap).to.equal(true);
        expect(e.model.lightmapped).to.equal(false);
        expect(e.model.lightmapSizeMultiplier).to.equal(1);
        expect(e.model.isStatic).to.equal(false);
        expect(e.model.model).to.equal(null);
        // expect(e.model.material).to.equal(app.systems.model.defaultMaterial);
        expect(e.model.mapping).to.equal(null);
        expect(e.model.layers).to.contain(pc.LAYERID_WORLD);
        expect(e.model.batchGroupId).to.equal(-1);

    });

    it('Set modelAsset and model', function () {
        var e = new pc.Entity();
        e.addComponent('model', {
            asset: assets.model
        });

        expect(e.model.asset).to.not.be.null;
        expect(e.model.asset).to.equal(assets.model);
        expect(e.model.model).to.not.be.null;
    });

    it('ModelAsset unbinds on destroy', function () {
        var e = new pc.Entity();
        app.root.addChild(e);
        e.addComponent('model', {
            asset: assets.model
        });

        expect(assets.model.hasEvent('load')).to.be.true;
        expect(assets.model.hasEvent('unload')).to.be.true;
        expect(assets.model.hasEvent('change')).to.be.true;
        expect(assets.model.hasEvent('remove')).to.be.true;

        e.destroy();

        expect(assets.model.hasEvent('load')).to.be.false;
        expect(assets.model.hasEvent('remove')).to.be.false;
        expect(assets.model.hasEvent('change')).to.be.false;
        expect(assets.model.hasEvent('unload')).to.be.false;
    });

    it('ModelAsset unbinds on reset', function () {
        var e = new pc.Entity();
        app.root.addChild(e);
        e.addComponent('model', {
            asset: assets.model
        });

        expect(assets.model.hasEvent('load')).to.be.true;
        expect(assets.model.hasEvent('unload')).to.be.true;
        expect(assets.model.hasEvent('change')).to.be.true;
        expect(assets.model.hasEvent('remove')).to.be.true;

        e.model.asset = null;

        expect(assets.model.hasEvent('load')).to.be.false;
        expect(assets.model.hasEvent('remove')).to.be.false;
        expect(assets.model.hasEvent('change')).to.be.false;
        expect(assets.model.hasEvent('unload')).to.be.false;
    });

    it('Material Asset unbinds on destroy', function () {
        var e = new pc.Entity();
        app.root.addChild(e);
        e.addComponent('model', {
            type: "box",
            materialAsset: assets.material
        });

        expect(assets.material.hasEvent('load')).to.be.true;
        expect(assets.material.hasEvent('unload')).to.be.true;
        expect(assets.material.hasEvent('change')).to.be.true;
        expect(assets.material.hasEvent('remove')).to.be.true;

        e.destroy();

        expect(assets.material.hasEvent('load')).to.be.false;
        expect(assets.material._callbacks.unload.length).to.equal(1);
        expect(assets.material.hasEvent('change')).to.be.false;
        expect(assets.material.hasEvent('remove')).to.be.false;
    });

    it('Material Asset unbinds on reset', function () {
        var e = new pc.Entity();
        app.root.addChild(e);
        e.addComponent('model', {
            type: "box",
            materialAsset: assets.material
        });

        expect(assets.material.hasEvent('load')).to.be.true;
        expect(assets.material.hasEvent('unload')).to.be.true;
        expect(assets.material.hasEvent('change')).to.be.true;
        expect(assets.material.hasEvent('remove')).to.be.true;

        e.model.materialAsset = null

        expect(assets.material.hasEvent('load')).to.be.false;
        expect(assets.material.hasEvent('remove')).to.be.false;
        expect(assets.material.hasEvent('change')).to.be.false;
        expect(assets.material._callbacks.unload.length).to.equal(1);
    });

});
