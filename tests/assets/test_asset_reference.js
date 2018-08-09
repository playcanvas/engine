QUnit.module('pc.AssetReference', {
    setup: function () {
        this.parent = sinon.fake();

        this.app = new pc.Application(document.createElement('canvas'));

        this.load = sinon.fake();
        this.remove = sinon.fake();
        this.add = sinon.fake();
    },

    teardown: function () {
    }
});

test('pc.AssetReference, load callback', function () {
    var reg = new pc.AssetReference('propName', this.parent, this.app.assets, {
        load: this.load
    });

    stop();

    var asset = new pc.Asset("Reference Test", "texture", {
        url: 'base/tests/test-assets/sprite/red-atlas.png'
    });

    reg.id = asset.id;

    asset.once('load', function () {
        start();

        equal(this.load.callCount, 1);
        equal(this.load.args[0][0], 'propName');
        equal(this.load.args[0][1], this.parent);
        equal(this.load.args[0][2].id, asset.id);

    }, this);

    this.app.assets.add(asset);
    this.app.assets.load(asset);
});

test('pc.AssetReference, add callback', function () {
    var reg = new pc.AssetReference('propName', this.parent, this.app.assets, {
        add: this.add
    });

    stop();

    var asset = new pc.Asset("Reference Test", "texture", {
        url: 'base/tests/test-assets/sprite/red-atlas.png'
    });

    reg.id = asset.id;

    this.app.assets.once('add', function () {
        setTimeout(function () {
            start();

            equal(this.add.callCount, 1);
            equal(this.add.args[0][0], 'propName');
            equal(this.add.args[0][1], this.parent);
            equal(this.add.args[0][2].id, asset.id);

        }.bind(this), 0);
    }, this);

    this.app.assets.add(asset);
});

test('pc.AssetReference, remove callback', function () {
    var reg = new pc.AssetReference('propName', this.parent, this.app.assets, {
        remove: this.remove
    });

    stop();


    var asset = new pc.Asset("Reference Test", "texture", {
        url: 'base/tests/test-assets/sprite/red-atlas.png'
    });

    reg.id = asset.id;

    asset.once('remove', function () {
        setTimeout(function () {
            start();

            equal(this.remove.callCount, 1);
            equal(this.remove.args[0][0], 'propName');
            equal(this.remove.args[0][1], this.parent);
            equal(this.remove.args[0][2].id, asset.id);
        }.bind(this), 0);
    }, this);

    this.app.assets.add(asset);
    this.app.assets.remove(asset);
});
