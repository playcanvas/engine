module("pc.SpriteComponent", {
    setup: function () {
        stop();
        this.app = new pc.Application(document.createElement("canvas"));

        this.loadAssets(function () {
            start();
        });
    },

    teardown: function () {
        this.app.destroy();
    },

    loadAssets: function (cb) {
        var i = 0;
        var check = function () {
            i++;
            if (i === 2) {
                return true;
            } else {
                return false;
            }
        };

        this.atlasAsset = new pc.Asset('red-atlas', 'textureatlas', {
            url: '../../../assets/sprite/red-atlas.json'
        });

        this.spriteAsset = new pc.Asset('red-sprite', 'sprite', {
            url: '../../../assets/sprite/red-sprite.json'
        });

        this.app.assets.add(this.atlasAsset);
        this.app.assets.add(this.spriteAsset);

        this.app.assets.load(this.atlasAsset);
        this.app.assets.load(this.spriteAsset);

        this.atlasAsset.ready(function () {
            if (check()) cb();
        });

        this.spriteAsset.ready(function () {
            if (check()) cb();
        });
    }
});


test('Add new Component', function () {
    var e = new pc.Entity();

    e.addComponent('sprite', {
    });

    ok(e.sprite);
});

test('Add / Remove Component', function () {
    var e = new pc.Entity();

    e.addComponent('sprite', {});

    e.removeComponent('sprite');

    ok(!e.sprite);
});

test('Remove after destroy', function () {
    var e = new pc.Entity();
    e.addComponent('sprite', {
        spriteAsset: this.spriteAsset
    });

    e.destroy();

    ok(!e.sprite);
})
