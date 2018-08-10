QUnit.module("pc.SpriteComponent", {
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
            if (i === 3) {
                return true;
            } else {
                return false;
            }
        };

        this.atlasAsset = new pc.Asset('red-atlas', 'textureatlas', {
            url: 'base/tests/test-assets/sprite/red-atlas.json'
        });

        this.spriteAsset = new pc.Asset('red-sprite', 'sprite', {
            url: 'base/tests/test-assets/sprite/red-sprite.json'
        });

        this.spriteAsset2 = new pc.Asset('red-sprite-2', 'sprite', {
            url: 'base/tests/test-assets/sprite/red-sprite.json'
        });

        this.app.assets.add(this.atlasAsset);
        this.app.assets.add(this.spriteAsset);
        this.app.assets.add(this.spriteAsset2);

        this.app.assets.load(this.atlasAsset);
        this.app.assets.load(this.spriteAsset);
        this.app.assets.load(this.spriteAsset2);

        this.atlasAsset.ready(function () {
            if (check()) cb();
        });

        this.spriteAsset.ready(function () {
            if (check()) cb();
        });

        this.spriteAsset2.ready(function () {
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

// TODO This and other tests in this file are skipped because of the following error:
//
//      Uncaught TypeError: Cannot read property 'length' of undefined
//        at SpriteAnimationClip._setFrame (sprite-animation-clip.js:183)
//        atSpriteAnimationClip.set (sprite-animation-clip.js:381)
//        atSpriteAnimationClip.set (sprite-animation-clip.js:368)
//        atSpriteAnimationClip._onSpriteAssetLoad (sprite-animation-clip.js:84)
//        atSpriteAnimationClip._bindSpriteAsset (sprite-animation-clip.js:56)
//        atSpriteAnimationClip.set (sprite-animation-clip.js:298)
//        atSpriteComponent.set (component.js:586)
//        atSpriteComponentSystem.initializeComponentData (system.js:149)
//        atSpriteComponentSystem.addComponent (system.js:84)
//        atEntity.addComponent (entity.js:116)
//
// Once this has been addressed they can be re-enabled.
test('Add / Remove Component', function () {
    var e = new pc.Entity();

    e.addComponent('sprite', {});

    ok(e.sprite);

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
});

test('Sprites assets unbound on destroy', function () {
    ok(!this.spriteAsset.hasEvent('add'));
    ok(!this.spriteAsset.hasEvent('load'));
    ok(!this.spriteAsset.hasEvent('remove'));

    var e = new pc.Entity();
    e.addComponent('sprite', {
        spriteAsset: this.spriteAsset
    });

    e.destroy();

    ok(!this.spriteAsset.hasEvent('add'));
    ok(!this.spriteAsset.hasEvent('load'));
    ok(!this.spriteAsset.hasEvent('remove'));
});

test('Sprites assets unbound when reset', function () {
    ok(!this.spriteAsset.hasEvent('add'));
    ok(!this.spriteAsset.hasEvent('load'));
    ok(!this.spriteAsset.hasEvent('remove'));

    var e = new pc.Entity();
    e.addComponent('sprite', {
        spriteAsset: this.spriteAsset
    });

    e.sprite.spriteAsset = this.spriteAsset2;

    ok(!this.spriteAsset.hasEvent('add'));
    ok(!this.spriteAsset.hasEvent('load'));
    ok(!this.spriteAsset.hasEvent('remove'));
});
