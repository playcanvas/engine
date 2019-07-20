describe("async pc.AnimationComponent", function () {
    var app;
    var assets = {};
    var assetlist;

    beforeEach(function () {
        app = new pc.Application(document.createElement("canvas"));
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
        assetlist = [
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

    it("async assets, can create animation and auto play them", function (done) {
        var entity = new pc.Entity();

        loadAssets(function () {
            // is currAnim public API?
            expect(entity.animation.currAnim).to.equal(assetlist[1].name);

            done();
        });

        entity.addComponent("model", {
            asset: assets.model
        });

        entity.addComponent("animation", {
            assets: [assetlist[1].id],
            activate: true
        });

        app.root.addChild(entity);

    });

    it("async assets, clone of animation component loads animations", function (done) {
        var entity = new pc.Entity();

        loadAssets(function () {
            // is currAnim public API?
            expect(entity.animation.currAnim).to.equal(assetlist[1].name);
            expect(clone.animation.currAnim).to.equal(assetlist[1].name);

            done();
        });

        entity.addComponent("model", {
            asset: assets.model
        });

        entity.addComponent("animation", {
            assets: [assetlist[1].id],
            activate: true
        });

        app.root.addChild(entity);

        var clone = entity.clone();
        app.root.addChild(clone);
    });
});
