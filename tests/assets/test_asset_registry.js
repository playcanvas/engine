QUnit.module('pc.AssetRegistry', {
    setup: function () {
        this.loader = sinon.fake();

        this.assets = new pc.AssetRegistry(this.loader);

        this.asset = new pc.Asset("Test Asset", 'text', {
            url: 'fake/url/file.txt'
        });
    },

    teardown: function () {

    }
});

test('new pc.AssetRegistry', function () {
    var reg = new pc.AssetRegistry(this.loader);

    ok(reg instanceof pc.AssetRegistry)
});

test('add() adds asset', function () {
    this.assets.add(this.asset);

    var assets = this.assets.list();

    strictEqual(assets.length, 1);
    strictEqual(assets[0].name, this.asset.name);
});

test('get() retrieves asset by id', function () {
    this.assets.add(this.asset);

    var asset = this.assets.get(this.asset.id);

    strictEqual(asset, this.asset);
});

test('getByUrl() retrieves asset by url', function () {
    this.assets.add(this.asset);

    var asset = this.assets.getByUrl(this.asset.file.url);

    strictEqual(asset, this.asset);
});

test('list() lists all assets', function () {
    var asset1 = new pc.Asset("Asset 1", "text", {
        url: "fake/one/file.txt"
    });
    var asset2 = new pc.Asset("Asset 2", "text", {
        url: "fake/two/file.txt"
    });
    var asset3 = new pc.Asset("Asset 3", "text", {
        url: "fake/three/file.txt"
    });

    this.assets.add(asset1);
    this.assets.add(asset2);
    this.assets.add(asset3);

    var assets = this.assets.list()

    strictEqual(assets[0], asset1);
    strictEqual(assets[1], asset2);
    strictEqual(assets[2], asset3);
});


test('remove() removes by id', function () {
    var asset1 = new pc.Asset("Asset 1", "text", {
        url: "fake/one/file.txt"
    });
    var asset2 = new pc.Asset("Asset 2", "text", {
        url: "fake/two/file.txt"
    });
    var asset3 = new pc.Asset("Asset 3", "text", {
        url: "fake/three/file.txt"
    });

    this.assets.add(asset1);
    this.assets.add(asset2);
    this.assets.add(asset3);

    this.assets.remove(asset2);

    var assets = this.assets.list()

    strictEqual(this.assets.get(asset1.id), asset1);
    strictEqual(this.assets.get(asset2.id), undefined);
    strictEqual(this.assets.get(asset3.id), asset3);

    strictEqual(this.assets.findAll(asset1.name)[0], asset1);
    strictEqual(this.assets.findAll(asset2.name).length, 0);
    strictEqual(this.assets.findAll(asset3.name)[0], asset3);

    strictEqual(assets[0].id, asset1.id);
    strictEqual(assets[1].id, asset3.id);
});
