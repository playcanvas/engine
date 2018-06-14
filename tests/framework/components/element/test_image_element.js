module('pc.ImageElement', {
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

test('Add Image Element', function () {
    var e = new pc.Entity();
    e.addComponent('element', {
        type: 'image'
    });

    equal(e.element.type, 'image');
});

test('Add / Remove Image Element', function () {
    var e = new pc.Entity();
    e.addComponent('element', {
        type: 'image'
    });

    e.removeComponent('element');

    ok(!e.element);
});

test('Destroy Sprite Image Element', function () {
    var e = new pc.Entity();

    e.addComponent('element', {
        type: 'image',
        spriteAsset: this.spriteAsset
    });

    e.destroy();

    ok(!e.element);
})
