describe("pc.SpriteComponent", function () {
    var app = null;
    var atlasAsset = null;
    var spriteAsset = null;
    var spriteAsset2 = null;

    beforeEach(function (done) {
        app = new pc.Application(document.createElement("canvas"));

        loadAssets(function () {
            done();
        });
    });

    afterEach(function () {
        app.destroy();
    });


    var loadAssets = function (cb) {
        var i = 0;
        var check = function () {
            i++;
            if (i === 3) {
                return true;
            } else {
                return false;
            }
        };

        atlasAsset = new pc.Asset('red-atlas', 'textureatlas', {
            url: 'base/tests/test-assets/sprite/red-atlas.json'
        });

        spriteAsset = new pc.Asset('red-sprite', 'sprite', {
            url: 'base/tests/test-assets/sprite/red-sprite.json'
        });

        spriteAsset2 = new pc.Asset('red-sprite-2', 'sprite', {
            url: 'base/tests/test-assets/sprite/red-sprite.json'
        });

        app.assets.add(atlasAsset);
        app.assets.add(spriteAsset);
        app.assets.add(spriteAsset2);

        app.assets.load(atlasAsset);
        app.assets.load(spriteAsset);
        app.assets.load(spriteAsset2);

        atlasAsset.ready(function () {
            if (check()) cb();
        });

        spriteAsset.ready(function () {
            if (check()) cb();
        });

        spriteAsset2.ready(function () {
            if (check()) cb();
        });
    }

    it('Add new Component', function () {
        var e = new pc.Entity();

        e.addComponent('sprite', {});

        expect(e.sprite).to.exist;
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
    it('Add / Remove Component', function () {
        var e = new pc.Entity();

        e.addComponent('sprite', {});

        expect(e.sprite).to.exist;

        e.removeComponent('sprite');

        expect(!e.sprite).to.exist;
    });

    it('Remove after destroy', function () {
        var e = new pc.Entity();
        e.addComponent('sprite', {
            spriteAsset: spriteAsset
        });

        e.destroy();

        expect(!e.sprite).to.exist;
    });

    it('Sprites assets unbound on destroy', function () {
        expect(!spriteAsset.hasEvent('add')).to.exist;
        expect(!spriteAsset.hasEvent('load')).to.exist;
        expect(!spriteAsset.hasEvent('remove')).to.exist;

        var e = new pc.Entity();
        e.addComponent('sprite', {
            spriteAsset: spriteAsset
        });

        e.destroy();

        expect(!spriteAsset.hasEvent('add')).to.exist;
        expect(!spriteAsset.hasEvent('load')).to.exist;
        expect(!spriteAsset.hasEvent('remove')).to.exist;
    });

    it('Sprites assets unbound when reset', function () {
        expect(!spriteAsset.hasEvent('add')).to.exist;
        expect(!spriteAsset.hasEvent('load')).to.exist;
        expect(!spriteAsset.hasEvent('remove')).to.exist;

        var e = new pc.Entity();
        e.addComponent('sprite', {
            spriteAsset: spriteAsset
        });

        e.sprite.spriteAsset = spriteAsset2;

        expect(!spriteAsset.hasEvent('add')).to.exist;
        expect(!spriteAsset.hasEvent('load')).to.exist;
        expect(!spriteAsset.hasEvent('remove')).to.exist;
    });
});


