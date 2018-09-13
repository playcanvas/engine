describe('pc.ImageElement', function () {
    var app;
    var assets;

    beforeEach(function (done) {
        app = new pc.Application(document.createElement("canvas"));

        loadAllAssets(function () {
            done();
        });
    });

    afterEach(function () {
        app.destroy();
    });

    var loadAssets = function (list, cb) {
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

    var loadAllAssets = function (cb) {
        app.assets.prefix = '../../';

        // load atlas first so that sprite is set up with out waiting for next frame
        var assetsToPreload = [
            new pc.Asset('red-atlas', 'textureatlas', {
                url: 'base/tests/test-assets/sprite/red-atlas.json'
            })
        ];

        // list of assets to load
        var assetsToLoad = [
            new pc.Asset('red-sprite', 'sprite', {
                url: 'base/tests/test-assets/sprite/red-sprite.json'
            }),
            new pc.Asset('red-texture', 'texture', {
                url: 'base/tests/test-assets/sprite/red-atlas.png'
            }),
            new pc.Asset('red-material', 'material', {
                url: 'base/tests/test-assets/sprite/red-material.json'
            })
        ];

        assets = {};

        loadAssets(assetsToPreload, function () {
            assets.textureatlas = assetsToPreload[0]

            loadAssets(assetsToLoad, function () {
                assets.sprite = assetsToLoad[0];
                assets.texture = assetsToLoad[1];
                assets.material = assetsToLoad[2];

                cb();
            })
        });
    }

    it('Add Image Element', function () {
        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image'
        });

        expect(e.element.type).to.equal('image');
    });

    it('Add / Remove Image Element', function () {
        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image'
        });

        e.removeComponent('element');

        expect(!e.element).to.exist;
    });

    it('Destroy Sprite Image Element', function () {
        var e = new pc.Entity();

        // patch
        var destroyed = false;
        var _onSpriteAssetLoaded = pc.ImageElement.prototype._onSpriteAssetLoaded;
        pc.ImageElement.prototype._onSpriteAssetLoaded = function () {
            if (destroyed) {
                ok(false, "_onSpriteAssetLoaded called after Element is destroyed");
            } else {
                _onSpriteAssetLoaded.apply(this, arguments);
            }
        };

        e.addComponent('element', {
            type: 'image',
            spriteAsset: assets.sprite
        });

        e.destroy();
        destroyed = true;

        expect(!e.element).to.exist;
    });

    it('Destroy Texture Image Element', function (done) {
        // patch
        var destroyed = false;
        var _onTextureLoad = pc.ImageElement.prototype._onTextureLoad;
        pc.ImageElement.prototype._onTextureLoad = function () {
            if (destroyed) {
                fail("_onTextureLoad called after Element is destroyed");
                done();
            } else {
                _onTextureLoad.apply(this, arguments);
            }
        };


        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image',
            textureAsset: assets.texture
        });

        e.destroy();
        destroyed = true;

        assets.texture.unload();
        app.assets.load(assets.texture);

        assets.texture.once('load', function () {
            expect(!e.element).to.exist;
            done();
        });
    });

    it('Destroy Material Image Element', function (done) {
        // patch
        var destroyed = false;
        var _onMaterialLoad = pc.ImageElement.prototype._onMaterialLoad;
        pc.ImageElement.prototype._onMaterialLoad = function () {
            if (destroyed) {
                fail(false, "_onMaterialLoad called after Element is destroyed");
                done();
            } else {
                _onMaterialLoad.apply(this, arguments);
            }
        };


        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image',
            materialAsset: assets.material
        });

        e.destroy();
        destroyed = true;

        assets.material.unload();
        app.assets.load(assets.material);
        assets.material.once('load', function () {
            expect(!e.element).to.exist;
            done();
        });
    });


    it('Sprites assets unbound on destroy', function () {
        expect(!assets.sprite.hasEvent('add')).to.exist;
        expect(!assets.sprite.hasEvent('load')).to.exist;
        expect(!assets.sprite.hasEvent('remove')).to.exist;

        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image',
            spriteAsset: assets.sprite
        });

        e.destroy();

        expect(!assets.sprite.hasEvent('add')).to.exist;
        expect(!assets.sprite.hasEvent('load')).to.exist;
        expect(!assets.sprite.hasEvent('remove')).to.exist;
    });

    it('Sprites assets unbound when reset', function () {
        expect(!assets.sprite.hasEvent('add')).to.exist;
        expect(!assets.sprite.hasEvent('load')).to.exist;
        expect(!assets.sprite.hasEvent('remove')).to.exist;

        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image',
            spriteAsset: assets.sprite
        });

        e.element.spriteAsset = null;

        expect(!assets.sprite.hasEvent('add')).to.exist;
        expect(!assets.sprite.hasEvent('load')).to.exist;
        expect(!assets.sprite.hasEvent('remove')).to.exist;
    });


    it('Sprite resource unbound on destroy', function () {
        var atlas = assets.textureatlas;

        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image',
            spriteAsset: assets.sprite
        });

        var sprite = e.element.sprite;
        expect(sprite).to.be.not.null;
        expect(sprite.hasEvent('set:meshes')).to.be.true;
        expect(sprite.hasEvent('set:pixelsPerUnit')).to.be.true;
        expect(sprite.hasEvent('set:atlas')).to.be.true;

        expect(atlas.resource.hasEvent('set:texture')).to.equal(true);

        e.destroy();

        expect(atlas.resource.hasEvent('set:texture')).to.equal(false);

        expect(sprite.hasEvent('set:meshes')).to.be.false;
        expect(sprite.hasEvent('set:pixelsPerUnit')).to.be.false;
        expect(sprite.hasEvent('set:atlas')).to.be.false;
    });


    it('AssetRegistry events unbound on destroy for texture asset', function () {
        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image',
            textureAsset: 123456
        });

        expect(app.assets.hasEvent('add:123456')).to.equal(true);

        e.destroy();

        expect(app.assets.hasEvent('add:123456')).to.equal(false);
    });

    it('AssetRegistry events unbound on destroy for sprite asset', function () {
        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image',
            spriteAsset: 123456
        });

        expect(app.assets.hasEvent('add:123456')).to.equal(true);

        e.destroy();

        expect(app.assets.hasEvent('add:123456')).to.equal(false);
    });

    it('AssetRegistry events unbound on destroy for material asset', function () {
        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image',
            materialAsset: 123456
        });

        expect(app.assets.hasEvent('add:123456')).to.equal(true);

        e.destroy();

        expect(app.assets.hasEvent('add:123456')).to.equal(false);
    });

});

