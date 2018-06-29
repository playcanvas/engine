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
        // listen for asset load events and fire cb() when all assets are loaded
        var count = 0;
        this.app.assets.on('load', function (asset) {
            count++;
            if (count === assets.length) {
                cb();
            }
        });

        // list of assets to load
        var assets = [
            new pc.Asset('red-atlas', 'textureatlas', {
                url: '../../../test-assets/sprite/red-atlas.json'
            }),
            new pc.Asset('red-sprite', 'sprite', {
                url: '../../../test-assets/sprite/red-sprite.json'
            }),
            new pc.Asset('red-texture', 'texture', {
                url: '../../../test-assets/sprite/red-atlas.png'
            }),
            new pc.Asset('red-material', 'material', {
                url: '../../../test-assets/sprite/red-material.json'
            })
        ];

        // add and load assets
        for (var i = 0; i < assets.length; i++) {
            this.app.assets.add(assets[i]);
            this.app.assets.load(assets[i]);
        }

        // convenient access to assets by type
        this.assets = {
            textureatlas: assets[0],
            sprite: assets[1],
            texture: assets[2],
            material: assets[3]
        };
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
        spriteAsset: this.assets.sprite
    });

    e.destroy();
    destroyed = true;

    ok(!e.element);
});

test('Destroy Texture Image Element', function () {
    stop();

    // patch
    var destroyed = false;
    var _onTextureLoad = pc.ImageElement.prototype._onTextureLoad;
    pc.ImageElement.prototype._onTextureLoad = function () {
        if (destroyed) {
            ok(false, "_onTextureLoad called after Element is destroyed");
        } else {
            _onTextureLoad.apply(this, arguments);
        }
    };


    var e = new pc.Entity();
    e.addComponent('element', {
        type: 'image',
        textureAsset: this.assets.texture
    });

    e.destroy();
    destroyed = true;

    this.assets.texture.unload();
    this.app.assets.load(this.assets.texture);

    this.assets.texture.once('load', function () {
        ok(!e.element);
        start();
    });
});

test('Destroy Material Image Element', function () {
    stop();

    // patch
    var destroyed = false;
    var _onMaterialLoad = pc.ImageElement.prototype._onMaterialLoad;
    pc.ImageElement.prototype._onMaterialLoad = function () {
        if (destroyed) {
            ok(false, "_onMaterialLoad called after Element is destroyed");
        } else {
            _onMaterialLoad.apply(this, arguments);
        }
    };


    var e = new pc.Entity();
    e.addComponent('element', {
        type: 'image',
        materialAsset: this.assets.material
    });

    e.destroy();
    destroyed = true;

    this.assets.material.unload();
    this.app.assets.load(this.assets.material);
    this.assets.material.once('load', function () {
        ok(!e.element);
        start();
    });
});


test('Sprites assets unbound on destroy', function () {
    ok(!this.assets.sprite.hasEvent('add'));
    ok(!this.assets.sprite.hasEvent('load'));
    ok(!this.assets.sprite.hasEvent('remove'));

    var e = new pc.Entity();
    e.addComponent('element', {
        type: 'image',
        spriteAsset: this.assets.sprite
    });

    e.destroy();

    ok(!this.assets.sprite.hasEvent('add'));
    ok(!this.assets.sprite.hasEvent('load'));
    ok(!this.assets.sprite.hasEvent('remove'));
});

test('Sprites assets unbound when reset', function () {
    ok(!this.assets.sprite.hasEvent('add'));
    ok(!this.assets.sprite.hasEvent('load'));
    ok(!this.assets.sprite.hasEvent('remove'));

    var e = new pc.Entity();
    e.addComponent('element', {
        type: 'image',
        spriteAsset: this.assets.sprite
    });

    e.element.spriteAsset = null;

    ok(!this.assets.sprite.hasEvent('add'));
    ok(!this.assets.sprite.hasEvent('load'));
    ok(!this.assets.sprite.hasEvent('remove'));
});


test('Sprite resource unbound on destroy', function () {
    var atlas = this.assets.textureatlas;

    var e = new pc.Entity();
    e.addComponent('element', {
        type: 'image',
        spriteAsset: this.assets.sprite
    });

    // var sprite = e.element.sprite;
    // ok(!e.element.sprite.hasEvent('add'));
    // ok(!e.element.sprite.hasEvent('load'));
    // ok(!e.element.sprite.hasEvent('remove'));

    ok(atlas.resource.hasEvent('set:texture'));

    e.destroy();

    ok(!atlas.resource.hasEvent('set:texture'));

    // ok(!this.assets.sprite.hasEvent('add'));
    // ok(!this.assets.sprite.hasEvent('load'));
    // ok(!this.assets.sprite.hasEvent('remove'));
});
