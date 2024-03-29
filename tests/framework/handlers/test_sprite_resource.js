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
                expect(asset.resource.atlas).to.exist;

                expect(asset.loaded).to.be.true;

                expect(asset.data.renderMode).to.equal(0);
                expect(asset.data.pixelsPerUnit).to.equal(100);
                expect(asset.data.textureAtlasAsset).to.equal(atlasAsset.id);
                expect(asset.data.frameKeys[0]).to.equal(0);
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
                expect(asset.resource.atlas).to.exist;

                expect(asset.loaded).to.be.true;

                expect(asset.data.renderMode).to.equal(0);
                expect(asset.data.pixelsPerUnit).to.equal(100);
                expect(asset.data.textureAtlasAsset).to.equal(atlasAsset.id);
                expect(asset.data.frameKeys[0]).to.equal(0);
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

