describe("pc.ParticleSystemComponent", function () {
    var app;
    var assets = {};

    beforeEach(function (done) {
        app = new pc.Application(document.createElement('canvas'));
        loadAssets(function () {
            done();
        });
    });

    afterEach(function () {
        app.destroy();
        assets = {};
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
            new pc.Asset('Box', 'model', {
                url: 'base/tests/test-assets/box/box.json'
            }),
            new pc.Asset('ColorMap', 'texture', {
                url: 'base/tests/test-assets/particlesystem/colormap.png'
            }),
            new pc.Asset('NormalMap', 'texture', {
                url: 'base/tests/test-assets/particlesystem/normalmap.png'
            })
        ];

        loadAssetList(assetlist, function () {
            assets.mesh = assetlist[0];
            assets.colorMap = assetlist[1];
            assets.normalMap = assetlist[2];
            cb();
        });
    };

    it("Add particlesystem", function () {
        var e = new pc.Entity();

        e.addComponent("particlesystem");

        expect(e.particlesystem).to.exist;
    });

    it("Remove particlesystem", function () {
        var e = new pc.Entity();

        e.addComponent("particlesystem");
        e.removeComponent("particlesystem");

        expect(e.particlesystem).to.not.exist;
    });

    it('ColorMap Asset unbinds on destroy', function () {
        var e = new pc.Entity();
        app.root.addChild(e);
        e.addComponent('particlesystem', {
            colorMapAsset: assets.colorMap.id
        });

        expect(assets.colorMap.hasEvent('load')).to.be.true;
        expect(assets.colorMap.hasEvent('unload')).to.be.true;
        expect(assets.colorMap.hasEvent('change')).to.be.true;
        expect(assets.colorMap.hasEvent('remove')).to.be.true;

        e.destroy();

        expect(assets.colorMap.hasEvent('load')).to.be.false;
        expect(assets.colorMap.hasEvent('unload')).to.be.false;
        expect(assets.colorMap.hasEvent('change')).to.be.false;
        expect(assets.colorMap.hasEvent('remove')).to.be.false;
    });

    it('ColorMap Asset unbinds on reset', function () {
        var e = new pc.Entity();
        app.root.addChild(e);
        e.addComponent('particlesystem', {
            colorMapAsset: assets.colorMap.id
        });

        expect(assets.colorMap.hasEvent('load')).to.be.true;
        expect(assets.colorMap.hasEvent('unload')).to.be.true;
        expect(assets.colorMap.hasEvent('change')).to.be.true;
        expect(assets.colorMap.hasEvent('remove')).to.be.true;

        e.particlesystem.colorMapAsset = null;

        expect(assets.colorMap.hasEvent('load')).to.be.false;
        expect(assets.colorMap.hasEvent('unload')).to.be.false;
        expect(assets.colorMap.hasEvent('change')).to.be.false;
        expect(assets.colorMap.hasEvent('remove')).to.be.false;
    });

    it('NormalMap Asset unbinds on destroy', function () {
        var e = new pc.Entity();
        app.root.addChild(e);
        e.addComponent('particlesystem', {
            normalMapAsset: assets.normalMap.id
        });

        expect(assets.normalMap.hasEvent('load')).to.be.true;
        expect(assets.normalMap.hasEvent('unload')).to.be.true;
        expect(assets.normalMap.hasEvent('change')).to.be.true;
        expect(assets.normalMap.hasEvent('remove')).to.be.true;

        e.destroy();

        expect(assets.normalMap.hasEvent('load')).to.be.false;
        expect(assets.normalMap.hasEvent('unload')).to.be.false;
        expect(assets.normalMap.hasEvent('change')).to.be.false;
        expect(assets.normalMap.hasEvent('remove')).to.be.false;
    });

    it('NormalMap Asset unbinds on reset', function () {
        var e = new pc.Entity();
        app.root.addChild(e);
        e.addComponent('particlesystem', {
            normalMapAsset: assets.normalMap.id
        });

        expect(assets.normalMap.hasEvent('load')).to.be.true;
        expect(assets.normalMap.hasEvent('unload')).to.be.true;
        expect(assets.normalMap.hasEvent('change')).to.be.true;
        expect(assets.normalMap.hasEvent('remove')).to.be.true;

        e.particlesystem.normalMapAsset = null;

        expect(assets.normalMap.hasEvent('load')).to.be.false;
        expect(assets.normalMap.hasEvent('unload')).to.be.false;
        expect(assets.normalMap.hasEvent('change')).to.be.false;
        expect(assets.normalMap.hasEvent('remove')).to.be.false;
    });

    it('Mesh Asset unbinds on destroy', function () {
        var e = new pc.Entity();
        app.root.addChild(e);
        e.addComponent('particlesystem', {
            meshAsset: assets.mesh.id
        });

        expect(assets.mesh.hasEvent('load')).to.be.true;
        expect(assets.mesh.hasEvent('unload')).to.be.true;
        expect(assets.mesh.hasEvent('change')).to.be.true;
        expect(assets.mesh.hasEvent('remove')).to.be.true;

        e.destroy();

        expect(assets.mesh.hasEvent('load')).to.be.false;
        expect(assets.mesh.hasEvent('unload')).to.be.false;
        expect(assets.mesh.hasEvent('change')).to.be.false;
        expect(assets.mesh.hasEvent('remove')).to.be.false;
    });

    it('Mesh Asset unbinds on reset', function () {
        var e = new pc.Entity();
        app.root.addChild(e);
        e.addComponent('particlesystem', {
            meshAsset: assets.mesh.id
        });

        expect(assets.mesh.hasEvent('load')).to.be.true;
        expect(assets.mesh.hasEvent('unload')).to.be.true;
        expect(assets.mesh.hasEvent('change')).to.be.true;
        expect(assets.mesh.hasEvent('remove')).to.be.true;

        e.particlesystem.meshAsset = null;

        expect(assets.mesh.hasEvent('load')).to.be.false;
        expect(assets.mesh.hasEvent('unload')).to.be.false;
        expect(assets.mesh.hasEvent('change')).to.be.false;
        expect(assets.mesh.hasEvent('remove')).to.be.false;
    });
});
