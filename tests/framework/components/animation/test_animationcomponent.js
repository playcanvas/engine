describe("pc.AnimationComponent", function () {
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
            new pc.Asset('Playbot.json', 'model', {
                url: 'base/examples/assets/Playbot/Playbot.json'
            }),
            new pc.Asset('Playbot_idle.json', 'animation', {
                url: 'base/examples/assets/Playbot/Playbot_idle.json'
            })
        ];

        loadAssetList(assetlist, function () {
            assets.model = assetlist[0];
            assets.animation = assetlist[1];
            cb();
        });
    };

    it("can create animation component", function () {
        var entity = new pc.Entity();

        entity.addComponent("model", {
            asset: assets.model
        });

        entity.addComponent("animation", {
            asset: assets.animation
        });

        expect(entity.animation).to.exist;
    });

    it("can create animation and auto play them", function () {
        var entity = new pc.Entity();

        entity.addComponent("model", {
            asset: assets.model
        });

        entity.addComponent("animation", {
            assets: [assets.animation.id],
            activate: true
        });

        app.root.addChild(entity);

        // is currAnim public API?
        expect(entity.animation.currAnim).to.equal(assets.animation.name);
    });

});
