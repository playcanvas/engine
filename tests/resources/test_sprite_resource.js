describe("pc.SpriteHandler", function () {
    beforeEach(function () {
        this.app = new pc.Application(document.createElement('canvas'));
    })

    afterEach(function () {
        this.app.destroy();
        this.app = null;
    });

    it("load from filesystem", function (done) {

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
                ok(asset.resource.atlas);

                strictEqual(asset.loaded, true);

                strictEqual(asset.data.renderMode, 0);
                strictEqual(asset.data.pixelsPerUnit, 100);
                strictEqual(asset.data.textureAtlasAsset, atlasAsset.id);
                strictEqual(asset.data.frameKeys[0], 0);
                done();
            }, this);

            spriteAsset.on('error', function (err) {
                fail(err);
            }, this);

        }, this);

        atlasAsset.on('error', function (err) {
            fail(err);
        }, this);
    });

    it("load from asset data", function (done) {
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

                strictEqual(asset.loaded, true);

                ok(asset.resource.atlas);

                strictEqual(asset.data.renderMode, 0);
                strictEqual(asset.data.pixelsPerUnit, 100);
                strictEqual(asset.data.textureAtlasAsset, atlasAsset.id);
                strictEqual(asset.data.frameKeys[0], 0);
                done();

            }, this);

            spriteAsset.on('error', function (err) {
                fail(err);
            }, this);

        }, this);

        atlasAsset.on('error', function (err) {
            fail(err);
        }, this);
    });

});

