module("pc.ParticleSystemComponent", {
    setup: function () {
        this.app = new pc.Application(document.createElement('canvas'));
    },

    teardown: function () {
        this.app.destroy();
    },

    loadAsset: function (name, url, type, callback) {
        var asset = new pc.Asset(name, type, {
            url: url
        });

        this.app.assets.add(asset);

        this.app.assets.once("load", callback, this);

        this.app.assets.load(asset);
    }
});

test("Add particlesystem", function () {
    var e = new pc.Entity();

    e.addComponent("particlesystem");

    ok(e.particlesystem);
});

test("Remove particlesystem", function () {
    var e = new pc.Entity();

    e.addComponent("particlesystem");
    e.removeComponent("particlesystem");

    ok(!e.particlesystem);
});

test("colorMapAsset removes events", function () {
    var e = new pc.Entity();

    stop();

    this.loadAsset('RedPng', '../../../test-assets/sprite/red-atlas.png', 'texture', function (asset) {
        start();

        e.addComponent('particlesystem', {
            colorMapAsset: asset.id
        });

        e.removeComponent('particlesystem');


        equal(asset.hasEvent('remove'), false);
    });
});

test("meshAsset removes events", function () {
    var e = new pc.Entity();

    stop();

    this.loadAsset('Box', '../../../test-assets/box/box.json', 'model', function (asset) {
        start();

        e.addComponent('particlesystem', {
            mesh: asset.id
        });

        e.removeComponent('particlesystem');

        equal(asset.hasEvent('remove'), false);
    });
});
