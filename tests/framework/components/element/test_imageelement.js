describe('pc.ImageElement', function () {
    var app;
    var assets;
    var sandbox;
    var canvas;

    beforeEach(function (done) {
        canvas = document.createElement("canvas");
        sandbox = sinon.createSandbox();
        app = new pc.Application(canvas);

        loadAllAssets(function () {
            done();
        });
    });

    afterEach(function () {
        sandbox.restore();
        app.destroy();
        app = null;
        canvas = null;
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
            assets.textureatlas = assetsToPreload[0];

            loadAssets(assetsToLoad, function () {
                assets.sprite = assetsToLoad[0];
                assets.texture = assetsToLoad[1];
                assets.material = assetsToLoad[2];

                cb();
            });
        });
    };


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

            pc.ImageElement.prototype._onTextureLoad = _onTextureLoad;
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
            pc.ImageElement.prototype._onMaterialLoad = _onMaterialLoad;
            done();
        });
    });

    it('Texture asset unbound on destroy', function () {
        expect(assets.texture.hasEvent('change')).to.be.false;
        expect(assets.texture.hasEvent('load')).to.be.false;
        expect(assets.texture.hasEvent('remove')).to.be.false;

        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image',
            textureAsset: assets.texture
        });
        app.root.addChild(e);

        expect(assets.texture.hasEvent('change')).to.be.true;
        expect(assets.texture.hasEvent('load')).to.be.true;
        expect(assets.texture.hasEvent('remove')).to.be.true;

        e.destroy();

        expect(assets.texture.hasEvent('change')).to.be.false;
        expect(assets.texture.hasEvent('load')).to.be.false;
        expect(assets.texture.hasEvent('remove')).to.be.false;
    });

    it('Texture asset unbound on reset', function () {
        expect(assets.texture.hasEvent('change')).to.be.false;
        expect(assets.texture.hasEvent('load')).to.be.false;
        expect(assets.texture.hasEvent('remove')).to.be.false;

        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image',
            textureAsset: assets.texture
        });
        app.root.addChild(e);

        expect(assets.texture.hasEvent('change')).to.be.true;
        expect(assets.texture.hasEvent('load')).to.be.true;
        expect(assets.texture.hasEvent('remove')).to.be.true;

        e.element.textureAsset = null;

        expect(assets.texture.hasEvent('change')).to.be.false;
        expect(assets.texture.hasEvent('load')).to.be.false;
        expect(assets.texture.hasEvent('remove')).to.be.false;
    });

    it('Texture asset unbound when sprite assigned', function () {
        expect(assets.texture.hasEvent('change')).to.be.false;
        expect(assets.texture.hasEvent('load')).to.be.false;
        expect(assets.texture.hasEvent('remove')).to.be.false;

        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image',
            textureAsset: assets.texture
        });
        app.root.addChild(e);

        expect(assets.texture.hasEvent('change')).to.be.true;
        expect(assets.texture.hasEvent('load')).to.be.true;
        expect(assets.texture.hasEvent('remove')).to.be.true;

        e.element.sprite = assets.sprite.resource;

        expect(assets.texture.hasEvent('change')).to.be.false;
        expect(assets.texture.hasEvent('load')).to.be.false;
        expect(assets.texture.hasEvent('remove')).to.be.false;
    });

    it('Sprites assets unbound on destroy', function () {
        // expect(assets.sprite.hasEvent('change')).to.be.false;
        expect(assets.sprite.hasEvent('load')).to.be.false;
        expect(assets.sprite.hasEvent('remove')).to.be.false;

        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image',
            spriteAsset: assets.sprite
        });
        app.root.addChild(e);

        // expect(assets.sprite.hasEvent('change')).to.be.true;
        expect(assets.sprite.hasEvent('load')).to.be.true;
        expect(assets.sprite.hasEvent('remove')).to.be.true;

        e.destroy();

        // expect(assets.sprite.hasEvent('change')).to.be.false;
        expect(assets.sprite.hasEvent('load')).to.be.false;
        expect(assets.sprite.hasEvent('remove')).to.be.false;
    });

    it('Sprites assets unbound when reset', function () {
        // expect(assets.sprite.hasEvent('change')).to.be.false;
        expect(assets.sprite.hasEvent('load')).to.be.false;
        expect(assets.sprite.hasEvent('remove')).to.be.false;

        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image',
            spriteAsset: assets.sprite
        });
        app.root.addChild(e);

        // expect(assets.sprite.hasEvent('change')).to.be.true;
        expect(assets.sprite.hasEvent('load')).to.be.true;
        expect(assets.sprite.hasEvent('remove')).to.be.true;

        e.element.spriteAsset = null;

        // expect(assets.sprite.hasEvent('change')).to.be.false;
        expect(assets.sprite.hasEvent('load')).to.be.false;
        expect(assets.sprite.hasEvent('remove')).to.be.false;
    });


    it('Sprites assets unbound when texture set', function () {
        // expect(assets.sprite.hasEvent('change')).to.be.false;
        expect(assets.sprite.hasEvent('load')).to.be.false;
        expect(assets.sprite.hasEvent('remove')).to.be.false;

        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image',
            spriteAsset: assets.sprite
        });
        app.root.addChild(e);

        // expect(assets.sprite.hasEvent('change')).to.be.true;
        expect(assets.sprite.hasEvent('load')).to.be.true;
        expect(assets.sprite.hasEvent('remove')).to.be.true;

        e.element.texture = assets.texture.resource;

        // expect(assets.sprite.hasEvent('change')).to.be.false;
        expect(assets.sprite.hasEvent('load')).to.be.false;
        expect(assets.sprite.hasEvent('remove')).to.be.false;
    });

    it('Sprite resource unbound on destroy', function () {
        var atlas = assets.textureatlas;

        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image',
            spriteAsset: assets.sprite
        });
        app.root.addChild(e);

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

    it('Image element calls _updateMesh once when rect changes', function () {
        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image'
        });
        app.root.addChild(e);

        var spy = sandbox.spy(pc.ImageElement.prototype, '_updateMesh');
        e.element.rect = [1, 1, 1, 1];
        expect(spy.calledOnce).to.equal(true);
    });

    it('Image element does not call _updateMesh if rect is the same', function () {
        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image'
        });
        app.root.addChild(e);

        var spy = sandbox.spy(pc.ImageElement.prototype, '_updateMesh');
        e.element.rect = [0, 0, 1, 1];
        e.element.rect = new pc.Vec4(0, 0, 1, 1);
        expect(spy.notCalled).to.equal(true);
    });

    it('Image element calls _updateMesh once at the start and once at the end when all properties that call it are passed into the data', function () {
        var spy = sandbox.spy(pc.ImageElement.prototype, '_updateMesh');

        var sprite = new pc.Sprite(app.graphicsDevice, {
            frameKeys: [1, 2]
        });

        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image',
            rect: [1, 1, 1, 1],
            spriteFrame: 1,
            sprite: sprite
        });
        app.root.addChild(e);

        expect(spy.calledTwice).to.equal(true);

        expect(e.element.sprite).to.equal(sprite);
        expect(e.element.spriteFrame).to.equal(1);
        expect(e.element.rect.x).to.equal(1);
        expect(e.element.rect.y).to.equal(1);
        expect(e.element.rect.z).to.equal(1);
        expect(e.element.rect.w).to.equal(1);
    });

    it('Image element calls _updateMesh once when sprite changes', function () {

        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image'
        });
        app.root.addChild(e);

        var spy = sandbox.spy(pc.ImageElement.prototype, '_updateMesh');
        e.element.sprite = new pc.Sprite(app.graphicsDevice, {
            frameKeys: []
        });
        expect(spy.calledOnce).to.equal(true);
    });

    it('Image element does not call _updateMesh if sprite is the same', function () {
        var sprite = new pc.Sprite(app.graphicsDevice, {
            frameKeys: []
        });

        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image',
            sprite: sprite
        });
        app.root.addChild(e);

        var spy = sandbox.spy(pc.ImageElement.prototype, '_updateMesh');
        e.element.sprite = sprite;
        expect(spy.notCalled).to.equal(true);
    });

    it('Image element calls _updateMesh once when spriteFrame changes', function () {

        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image',
            spriteFrame: 1,
            sprite: new pc.Sprite(app.graphicsDevice, {
                frameKeys: [1, 2]
            })
        });
        app.root.addChild(e);

        var spy = sandbox.spy(pc.ImageElement.prototype, '_updateMesh');
        e.element.spriteFrame = 0;
        expect(spy.calledOnce).to.equal(true);
    });

    it('Image element does not call _updateMesh if spriteFrame is the same', function () {
        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image',
            sprite: new pc.Sprite(app.graphicsDevice, {
                frameKeys: [1, 2]
            }),
            spriteFrame: 1
        });
        app.root.addChild(e);

        var spy = sandbox.spy(pc.ImageElement.prototype, '_updateMesh');
        e.element.spriteFrame = 1;
        expect(spy.notCalled).to.equal(true);
    });

    it('Image element spriteFrame clamped to the latest frame available to the sprite asset', function () {
        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image',
            sprite: new pc.Sprite(app.graphicsDevice, {
                frameKeys: [1, 2]
            }),
            spriteFrame: 2
        });
        app.root.addChild(e);

        expect(e.element.spriteFrame).to.equal(1);
    });

    it('Image element spriteFrame clamped to the latest frame available to the sprite when a different sprite is assigned', function () {
        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image',
            sprite: new pc.Sprite(app.graphicsDevice, {
                frameKeys: [1, 2]
            }),
            spriteFrame: 1
        });
        app.root.addChild(e);
        expect(e.element.spriteFrame).to.equal(1);

        e.element.sprite = new pc.Sprite(app.graphicsDevice, {
            frameKeys: [1]
        });
        expect(e.element.spriteFrame).to.equal(0);
    });

    it('Image element spriteFrame clamped to the latest frame available to the sprite when the frame keys of the sprite change', function () {
        var atlas = new pc.TextureAtlas();
        atlas.frames = {
            0: { rect: new pc.Vec4(), pivot: new pc.Vec2() },
            1: { rect: new pc.Vec4(), pivot: new pc.Vec2() }
        };
        atlas.texture = new pc.Texture(app.graphicsDevice);

        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image',
            sprite: new pc.Sprite(app.graphicsDevice, {
                frameKeys: [0, 1],
                atlas: atlas
            }),
            spriteFrame: 1
        });
        app.root.addChild(e);
        expect(e.element.spriteFrame).to.equal(1);

        e.element.sprite.frameKeys = [0];
        expect(e.element.spriteFrame).to.equal(0);
    });

    it('Image element calls _updateMesh when its sprite is 9-sliced and the sprite\'s PPU changes', function () {
        var atlas = new pc.TextureAtlas();
        atlas.frames = {
            0: { rect: new pc.Vec4(), pivot: new pc.Vec2(), border: new pc.Vec4() },
            1: { rect: new pc.Vec4(), pivot: new pc.Vec2(), border: new pc.Vec4() }
        };
        atlas.texture = new pc.Texture(app.graphicsDevice);

        var sprite = new pc.Sprite(app.graphicsDevice, {
            atlas: atlas,
            frameKeys: [0, 1],
            pixelsPerUnit: 1,
            renderMode: pc.SPRITE_RENDERMODE_SLICED
        });

        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image',
            sprite: sprite,
            spriteFrame: 0
        });
        app.root.addChild(e);

        var spy = sandbox.spy(pc.ImageElement.prototype, '_updateMesh');
        sprite.pixelsPerUnit = 2;
        expect(spy.calledOnce).to.equal(true);
    });

    it('Image element calls _updateMesh once when its sprite is not 9-sliced and the sprite\'s PPU changes', function () {
        var atlas = new pc.TextureAtlas();
        atlas.frames = {
            0: { rect: new pc.Vec4(), pivot: new pc.Vec2(), border: new pc.Vec4() },
            1: { rect: new pc.Vec4(), pivot: new pc.Vec2(), border: new pc.Vec4() }
        };
        atlas.texture = new pc.Texture(app.graphicsDevice);

        var sprite = new pc.Sprite(app.graphicsDevice, {
            atlas: atlas,
            frameKeys: [0, 1],
            pixelsPerUnit: 1,
            renderMode: pc.SPRITE_RENDERMODE_SIMPLE
        });

        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image',
            sprite: sprite,
            spriteFrame: 0
        });
        app.root.addChild(e);

        var spy = sandbox.spy(pc.ImageElement.prototype, '_updateMesh');
        sprite.pixelsPerUnit = 2;
        expect(spy.calledOnce).to.equal(true);
    });

    it('Image element defaults to white color and opacity 1', function () {
        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image'
        });

        expect(e.element.color.r).to.equal(1);
        expect(e.element.color.g).to.equal(1);
        expect(e.element.color.b).to.equal(1);
        expect(e.element.opacity).to.equal(1);

        var emissive = e.element._image._renderable.meshInstance.getParameter('material_emissive').data;
        expect(emissive[0]).to.equal(1);
        expect(emissive[1]).to.equal(1);
        expect(emissive[2]).to.equal(1);

        var opacity = e.element._image._renderable.meshInstance.getParameter('material_opacity').data;
        expect(opacity).to.equal(1);
    });

    it('Image element initializes to color and opacity 1 specified in data', function () {
        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image',
            color: [0.5, 0.6, 0.7],
            opacity: 0.1
        });

        expect(e.element.color.r).to.be.closeTo(0.5, 0.001);
        expect(e.element.color.g).to.be.closeTo(0.6, 0.001);
        expect(e.element.color.b).to.be.closeTo(0.7, 0.001);

        var emissive = e.element._image._renderable.meshInstance.getParameter('material_emissive').data;
        expect(emissive[0]).to.be.closeTo(0.5, 0.001);
        expect(emissive[1]).to.be.closeTo(0.6, 0.001);
        expect(emissive[2]).to.be.closeTo(0.7, 0.001);

        var opacity = e.element._image._renderable.meshInstance.getParameter('material_opacity').data;
        expect(opacity).to.be.closeTo(0.1, 0.001);
    });

    it('Image element color changes', function () {
        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image'
        });

        e.element.color = new pc.Color(0, 0, 0);

        expect(e.element.color.r).to.equal(0);
        expect(e.element.color.g).to.equal(0);
        expect(e.element.color.b).to.equal(0);
        expect(e.element.opacity).to.equal(1);

        var emissive = e.element._image._renderable.meshInstance.getParameter('material_emissive').data;
        expect(emissive[0]).to.equal(0);
        expect(emissive[1]).to.equal(0);
        expect(emissive[2]).to.equal(0);

        var opacity = e.element._image._renderable.meshInstance.getParameter('material_opacity').data;
        expect(opacity).to.equal(1);
    });

    it('Image element opacity changes', function () {
        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image'
        });

        e.element.opacity = 0;

        expect(e.element.opacity).to.equal(0);

        var opacity = e.element._image._renderable.meshInstance.getParameter('material_opacity').data;
        expect(opacity).to.equal(0);
    });

    it('Image element reverts back to the previous color, opacity and material if we clear its material', function () {
        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image',
            color: [0.1, 0.2, 0.3],
            opacity: 0.4
        });

        var defaultMaterial = e.element.material;
        e.element.material = new pc.StandardMaterial();
        e.element.material = null;

        expect(e.element.material).to.equal(defaultMaterial);

        var emissive = e.element._image._renderable.meshInstance.getParameter('material_emissive').data;
        expect(emissive[0]).to.be.closeTo(0.1, 0.001);
        expect(emissive[1]).to.be.closeTo(0.2, 0.001);
        expect(emissive[2]).to.be.closeTo(0.3, 0.001);

        var opacity = e.element._image._renderable.meshInstance.getParameter('material_opacity').data;
        expect(opacity).to.be.closeTo(0.4, 0.001);

    });

    it('Image element with mask reverts back to the previous color, opacity and material if we clear its material', function () {
        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image',
            color: [0.1, 0.2, 0.3],
            opacity: 0.4,
            mask: true
        });

        var defaultMaterial = e.element.material;
        e.element.material = new pc.StandardMaterial();
        e.element.material = null;

        expect(e.element.material).to.equal(defaultMaterial);

        var emissive = e.element._image._renderable.meshInstance.getParameter('material_emissive').data;
        expect(emissive[0]).to.be.closeTo(0.1, 0.001);
        expect(emissive[1]).to.be.closeTo(0.2, 0.001);
        expect(emissive[2]).to.be.closeTo(0.3, 0.001);

        var opacity = e.element._image._renderable.meshInstance.getParameter('material_opacity').data;
        expect(opacity).to.be.closeTo(0.4, 0.001);

    });

    it('Screenspace Image element reverts back to the previous color, opacity and material if we clear its material', function () {
        var screen = new pc.Entity();
        screen.addComponent('screen', {
            screenSpace: true
        });
        app.root.addChild(screen);

        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image',
            color: [0.1, 0.2, 0.3],
            opacity: 0.4
        });
        screen.addChild(e);

        var defaultMaterial = e.element.material;
        e.element.material = new pc.StandardMaterial();
        e.element.material = null;

        expect(e.element.material).to.equal(defaultMaterial);

        var emissive = e.element._image._renderable.meshInstance.getParameter('material_emissive').data;
        expect(emissive[0]).to.be.closeTo(0.1, 0.001);
        expect(emissive[1]).to.be.closeTo(0.2, 0.001);
        expect(emissive[2]).to.be.closeTo(0.3, 0.001);

        var opacity = e.element._image._renderable.meshInstance.getParameter('material_opacity').data;
        expect(opacity).to.be.closeTo(0.4, 0.001);

    });

    it('Screenspace Image element with mask reverts back to the previous color, opacity and material if we clear its material', function () {
        var screen = new pc.Entity();
        screen.addComponent('screen', {
            screenSpace: true
        });
        app.root.addChild(screen);

        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image',
            color: [0.1, 0.2, 0.3],
            opacity: 0.4,
            mask: true
        });
        screen.addChild(e);

        var defaultMaterial = e.element.material;
        e.element.material = new pc.StandardMaterial();
        e.element.material = null;

        expect(e.element.material).to.equal(defaultMaterial);

        var emissive = e.element._image._renderable.meshInstance.getParameter('material_emissive').data;
        expect(emissive[0]).to.be.closeTo(0.1, 0.001);
        expect(emissive[1]).to.be.closeTo(0.2, 0.001);
        expect(emissive[2]).to.be.closeTo(0.3, 0.001);

        var opacity = e.element._image._renderable.meshInstance.getParameter('material_opacity').data;
        expect(opacity).to.be.closeTo(0.4, 0.001);

    });

    it('Offscreen element is culled', function () {
        var canvasWidth = app.graphicsDevice.width;
        var canvasHeight = app.graphicsDevice.height;

        var screen = new pc.Entity();
        screen.addComponent('screen', {
            screenSpace: true
        });
        app.root.addChild(screen);

        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image',
            width: 100,
            height: 100,
            pivot: [0.5,0.5]
        });
        screen.addChild(e);

        var camera = new pc.Entity();
        camera.addComponent('camera');
        app.root.addChild(camera);

        // update transform
        app.update(0.1);
        app.render();
        expect(e.element.isVisibleForCamera(camera.camera.camera)).to.be.true;

        // move just off screen
        e.translateLocal(canvasWidth+(100/2)+0.001,0,0);

        app.update(0.1);
        app.render();
        expect(e.element.isVisibleForCamera(camera.camera.camera)).to.be.false;

        // move just on screen
        e.translateLocal(-1, 0, 0);

        app.update(0.1);
        app.render();
        expect(e.element.isVisibleForCamera(camera.camera.camera)).to.be.true;

    });


    it('Offscreen child element is culled', function () {
        var canvasWidth = app.graphicsDevice.width;
        var canvasHeight = app.graphicsDevice.height;

        var screen = new pc.Entity();
        screen.addComponent('screen', {
            screenSpace: true
        });
        app.root.addChild(screen);

        var parent = new pc.Entity();
        parent.addComponent('element', {
            type: 'image',
            width: 100,
            height: 100,
            pivot: [0.5,0.5]
        });
        screen.addChild(parent);

        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image',
            width: 100,
            height: 100,
            pivot: [0.5,0.5]
        });
        parent.addChild(e);

        var camera = new pc.Entity();
        camera.addComponent('camera');
        app.root.addChild(camera);

        // update transform
        app.update(0.1);
        app.render();
        expect(e.element.isVisibleForCamera(camera.camera.camera)).to.be.true;

        // move just off screen
        parent.translateLocal(50, 50, 0);
        e.translateLocal(351, 50, 0);

        // update transform
        app.update(0.1);
        app.render();
        expect(e.element.isVisibleForCamera(camera.camera.camera)).to.be.false;
    });

    it('Offscreen rotated element is culled', function () {
        var canvasWidth = app.graphicsDevice.width;
        var canvasHeight = app.graphicsDevice.height;

        var screen = new pc.Entity();
        screen.addComponent('screen', {
            screenSpace: true
        });
        app.root.addChild(screen);

        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image',
            width: 100,
            height: 100,
            pivot: [0.5,0.5]
        });
        screen.addChild(e);

        var camera = new pc.Entity();
        camera.addComponent('camera');
        app.root.addChild(camera);

        // move just off screen (when rotated 45°)
        e.translateLocal(300 + (50*Math.sqrt(2)), 0, 0);
        e.rotateLocal(0, 0, 45);

        // update transform
        app.update(0.1);
        app.render();
        expect(e.element.isVisibleForCamera(camera.camera.camera)).to.be.false;
    });

    it('Offscreen rotated out of plane is culled', function () {
        var canvasWidth = app.graphicsDevice.width;
        var canvasHeight = app.graphicsDevice.height;

        var screen = new pc.Entity();
        screen.addComponent('screen', {
            screenSpace: true
        });
        app.root.addChild(screen);

        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image',
            width: 100,
            height: 100,
            pivot: [0.5,0.5]
        });
        screen.addChild(e);

        var camera = new pc.Entity();
        camera.addComponent('camera');
        app.root.addChild(camera);

        // move just off screen (when rotated 45°)
        e.translateLocal(300, 0, 0);
        e.rotateLocal(0, 90, 0);

        // update transform
        app.update(0.1);
        app.render();
        expect(e.element.isVisibleForCamera(camera.camera.camera)).to.be.false;
    });

    it.skip('TextureAtlas asset events are unbound if sprite is changed while loading', function (done) {

        app.assets.list().forEach(function (asset) {
            asset.unload();
        });


        var spriteAsset = new pc.Asset('red-sprite', 'sprite', {
            url: 'base/tests/test-assets/sprite/red-sprite.json'
        });
        var textureAtlasAsset = new pc.Asset('red-texture', 'texture', {
            url: 'base/tests/test-assets/sprite/red-atlas.json'
        });

        spriteAsset.once("load", function () {
            expect(app.assets.hasEvent('load:' + textureAtlasAsset.id)).to.be.true;

            e.element.spriteAsset = null;

            // check that no event listeners come from this image element
            app.assets._callbacks['load:' + textureAtlasAsset.id].forEach(function (callback) {
                expect(callback.scope).to.not.equal(e.element._image);
            });

            done();
        });

        app.assets.add(spriteAsset);
        app.assets.add(textureAtlasAsset);

        expect(app.assets.hasEvent('load:' + textureAtlasAsset.id)).to.be.false;

        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image',
            spriteAsset: spriteAsset.id
        });
        app.root.addChild(e);

    });

    it('Cloning image element with texture works', function () {
        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image',
            textureAsset: assets.texture.id
        });

        var copy = e.clone();

        expect(copy.element.textureAsset).to.equal(assets.texture.id);
        expect(copy.element.texture).to.equal(e.element.texture);
    });

    it('Setting texture on image element clears texture asset', function () {
        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image',
            textureAsset: assets.texture.id
        });

        var texture = new pc.Texture();

        e.element.texture = texture;

        expect(e.element.textureAsset).to.be.null;
        expect(e.element.texture).to.be.equal(texture);
    });

    it('Setting texture on image element clears sprite asset', function () {
        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image',
            spriteAsset: assets.sprite.id
        });

        expect(e.element.spriteAsset).to.be.not.null;
        // expect(e.element.sprite).to.be.not.null;

        var texture = new pc.Texture();

        e.element.texture = texture;

        expect(e.element.spriteAsset).to.be.null;
        expect(e.element.sprite).to.be.null;
        expect(e.element.texture).to.be.equal(texture);
    });

    it('Setting texture on image element then cloning works', function () {
        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image',
            textureAsset: assets.texture.id
        });

        var texture = new pc.Texture();

        e.element.texture = texture;

        var copy = e.clone();

        expect(e.element.textureAsset).to.be.null;
        expect(e.element.texture).to.equal(texture);

        expect(copy.element.textureAsset).to.be.null;
        expect(copy.element.texture).to.equal(e.element.texture);
    });

    it('Cloning image element with sprite works', function () {
        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image',
            spriteAsset: assets.sprite.id
        });

        var copy = e.clone();

        expect(copy.element.spriteAsset).to.equal(assets.sprite.id);
        expect(copy.element.sprite).to.equal(e.element.sprite);
    });

    it('Setting sprite on image element clears sprite asset', function () {
        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image',
            spriteAsset: assets.sprite
        });

        var sprite = new pc.Sprite(app.graphicsDevice, {
            frameKeys: []
        });

        e.element.sprite = sprite;

        expect(e.element.spriteAsset).to.be.null;
        expect(e.element.sprite).to.be.equal(sprite);
    });

    it('Setting sprite on image element clears texture asset', function () {
        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image',
            textureAsset: assets.texture
        });

        expect(e.element.textureAsset).to.be.not.null;
        // expect(e.element.texture).to.be.not.null;

        var sprite = new pc.Sprite(app.graphicsDevice, {
            frameKeys: []
        });

        e.element.sprite = sprite;

        expect(e.element.textureAsset).to.be.null;
        expect(e.element.texture).to.be.null;
        expect(e.element.sprite).to.be.equal(sprite);
    });

    it('Setting sprite on image element then cloning works', function () {
        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'image',
            spriteAsset: assets.sprite
        });

        var sprite = new pc.Sprite(app.graphicsDevice, {
            frameKeys: []
        });

        e.element.sprite = sprite;

        var copy = e.clone();

        expect(e.element.spriteAsset).to.be.null;
        expect(e.element.sprite).to.equal(e.element.sprite);

        expect(copy.element.spriteAsset).to.be.null;
        expect(copy.element.sprite).to.equal(e.element.sprite);
    });
});
