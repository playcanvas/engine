describe("pc.ParticleSystemComponent", function () {
    beforeEach(function () {
        app = new pc.Application(document.createElement('canvas'));
    });

    afterEach(function () {
        app.destroy();
    });

    var addAsset = function (name, url, type, callback) {
        var asset = new pc.Asset(name, type, {
            url: url
        });

        app.assets.add(asset);

        return asset;
    };

    var loadAsset = function (name, url, type, callback) {
        var asset = new pc.Asset(name, type, {
            url: url
        });

        app.assets.add(asset);

        app.assets.once("load", callback, this);

        app.assets.load(asset);
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

    it("colorMapAsset removes events", function () {
        var e = new pc.Entity();

        var asset = addAsset('RedPng', 'base/tests/test-assets/sprite/red-atlas.png', 'texture');
        e.addComponent('particlesystem', {
            colorMapAsset: asset.id
        });

        e.removeComponent('particlesystem');

        expect(asset.hasEvent('load')).to.equal(false);
        expect(asset.hasEvent('remove')).to.equal(false);
    });


    it("colorMapAsset assign to null removes events", function () {
        var e = new pc.Entity();

        var asset = addAsset('RedPng', 'base/tests/test-assets/sprite/red-atlas.png', 'texture');
        e.addComponent('particlesystem', {
            colorMapAsset: asset.id
        });

        e.particlesystem.colorMapAsset = null;

        expect(asset.hasEvent('load')).to.equal(false);
        expect(asset.hasEvent('remove')).to.equal(false);
    });

    it("normalMapAsset removes events", function () {
        var e = new pc.Entity();

        var asset = addAsset('RedPng', 'base/tests/test-assets/sprite/red-atlas.png', 'texture');
        e.addComponent('particlesystem', {
            normalMapAsset: asset.id
        });

        e.removeComponent('particlesystem');

        expect(asset.hasEvent('load')).to.equal(false);
        expect(asset.hasEvent('remove')).to.equal(false);
    });


    it("normalMapAsset assign to null removes events", function () {
        var e = new pc.Entity();

        var asset = addAsset('RedPng', 'base/tests/test-assets/sprite/red-atlas.png', 'texture');
        e.addComponent('particlesystem', {
            normalMapAsset: asset.id
        });

        e.particlesystem.normalMapAsset = null;

        expect(asset.hasEvent('load')).to.equal(false);
        expect(asset.hasEvent('remove')).to.equal(false);
    });


    it("meshAsset removes events", function (done) {
        var e = new pc.Entity();

        loadAsset('Box', 'base/tests/test-assets/box/box.json', 'model', function (asset) {
            e.addComponent('particlesystem', {
                mesh: asset.id
            });

            e.removeComponent('particlesystem');

            expect(asset.hasEvent('load')).to.equal(false);
            expect(asset.hasEvent('remove')).to.equal(false);
            done();
        });
    });

});

