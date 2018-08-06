QUnit.module("pc.SpriteHandler", {
    setup: function () {
        this.app = new pc.Application(document.createElement('canvas'));
    },

    teardown: function () {
        this.app.destroy();
        this.app = null;
    }
});

test("load from filesystem", function () {
    stop();

    var atlasAsset = new pc.Asset("Red Atlas", "textureatlas", {
        url: 'base/tests/test-assets/sprite/red-atlas.json'
    });

    var spriteAsset = new pc.Asset("Red Sprite", "sprite", {
        url: 'base/tests/test-assets/sprite/red-sprite.json'
    });

    this.app.assets.add(atlasAsset);
    this.app.assets.add(spriteAsset);

    this.app.assets.load(atlasAsset);

    atlasAsset.on('load', function () {
        this.app.assets.load(spriteAsset);

        spriteAsset.ready(function (asset) {
            start();

            ok(asset.resource.atlas);

            strictEqual(asset.loaded, true);

            strictEqual(asset.data.renderMode, 0);
            strictEqual(asset.data.pixelsPerUnit, 100);
            strictEqual(asset.data.textureAtlasAsset, atlasAsset.id);
            strictEqual(asset.data.frameKeys[0], 0);

        }, this);

        spriteAsset.on('error', function (err) {
            start();
            ok(false, err);
        }, this);

    }, this);

    atlasAsset.on('error', function () {
        start();
        ok(false);
    }, this);
});

test("load from asset data", function () {
    stop();

    var atlasAsset = new pc.Asset("Red Atlas", "textureatlas", {
        url: 'base/tests/test-assets/sprite/red-atlas.json'
    });

    var spriteAsset = new pc.Asset("Red Sprite", "sprite", null, {
        "renderMode": 0,
        "pixelsPerUnit": 100,
        "textureAtlasAsset": atlasAsset.id,
        "frameKeys": [0]
    });

    this.app.assets.add(atlasAsset);
    this.app.assets.add(spriteAsset);

    this.app.assets.load(atlasAsset);

    atlasAsset.on('load', function () {
        this.app.assets.load(spriteAsset);

        spriteAsset.ready(function (asset) {
            start();

            strictEqual(asset.loaded, true);

            ok(asset.resource.atlas);

            strictEqual(asset.data.renderMode, 0);
            strictEqual(asset.data.pixelsPerUnit, 100);
            strictEqual(asset.data.textureAtlasAsset, atlasAsset.id);
            strictEqual(asset.data.frameKeys[0], 0);

        }, this);

        spriteAsset.on('error', function (err) {
            start();
            ok(false, err);
        }, this);

    }, this);

    atlasAsset.on('error', function () {
        start();
        ok(false);
    }, this);
});
