pc.extend(pc, function () {
    'use strict';

    var _schema = [ 'enabled' ];

    /**
     * @name pc.SpriteComponentSystem
     * @private
     * @class Manages creation of {@link pc.SpriteComponent}s.
     * @param {pc.Application} app The application
     * @extends pc.ComponentSystem
     */
    var SpriteComponentSystem = function SpriteComponentSystem(app) {
        this.id = 'sprite';
        this.app = app;
        app.systems.add(this.id, this);

        this.ComponentType = pc.SpriteComponent;
        this.DataType = pc.SpriteComponentData;

        this.schema = _schema;

        // default texture - make white so we can tint it with emissive color
        this._defaultTexture = new pc.Texture(app.graphicsDevice, {width:1, height:1, format:pc.PIXELFORMAT_R8_G8_B8_A8});
        var pixels = this._defaultTexture.lock();
        var pixelData = new Uint8Array(4);
        pixelData[0] = 255.0;
        pixelData[1] = 255.0;
        pixelData[2] = 255.0;
        pixelData[3] = 255.0;
        pixels.set(pixelData);
        this._defaultTexture.unlock();

        // default material used by sprites
        this.defaultMaterial = new pc.StandardMaterial();
        this.defaultMaterial.diffuse = new pc.Color(0,0,0,1); // black diffuse color to prevent ambient light being included
        this.defaultMaterial.emissive = new pc.Color(0.5,0.5,0.5,1); // use non-white to compile shader correctly
        this.defaultMaterial.emissiveMap = this._defaultTexture;
        this.defaultMaterial.emissiveMapTint = true;
        this.defaultMaterial.opacityMap = this._defaultTexture;
        this.defaultMaterial.opacityMapChannel = "a";
        this.defaultMaterial.opacityTint = true;
        this.defaultMaterial.opacity = 0; // use non-1 opacity to compile shader correctly
        this.defaultMaterial.useLighting = false;
        this.defaultMaterial.useGammaTonemap = false;
        this.defaultMaterial.useFog = false;
        this.defaultMaterial.useSkybox = false;
        this.defaultMaterial.blendType = pc.BLEND_PREMULTIPLIED;
        this.defaultMaterial.depthWrite = false;
        this.defaultMaterial.pixelSnap = false;
        this.defaultMaterial.cull = pc.CULLFACE_NONE; // don't cull because we might flipX or flipY which uses negative scale on the graph node
        this.defaultMaterial.update();

        pc.ComponentSystem.on('update', this.onUpdate, this);
    };
    SpriteComponentSystem = pc.inherits(SpriteComponentSystem, pc.ComponentSystem);

    pc.Component._buildAccessors(pc.SpriteComponent.prototype, _schema);

    pc.extend(SpriteComponentSystem.prototype, {
        initializeComponentData: function (component, data, properties) {
            if (data.enabled !== undefined) {
                component.enabled = data.enabled;
            }

            component.type = data.type;

            if (data.color !== undefined) {
                if (data.color instanceof pc.Color) {
                    component.color.set(data.color.data[0], data.color.data[1], data.color.data[2], data.opacity !== undefined ? data.opacity : 1);
                } else {
                    component.color.set(data.color[0], data.color[1], data.color[2], data.opacity !== undefined ? data.opacity : 1);
                }
                // force update
                component.color = component.color;
            }

            if (data.opacity !== undefined) {
                component.opacity = data.opacity;
            }

            if (data.flipX !== undefined) {
                component.flipX = data.flipX;
            }

            if (data.flipY !== undefined) {
                component.flipY = data.flipY;
            }

            if (data.type === pc.SPRITETYPE_SIMPLE) {
                if (data.spriteAsset !== undefined) {
                    component.spriteAsset = data.spriteAsset;
                }

                if (data.sprite) {
                    component.sprite = data.sprite;
                }

                if (data.frame !== undefined) {
                    component.frame = data.frame;
                }
            } else if (data.type === pc.SPRITETYPE_ANIMATED) {
                if (data.clips) {
                    for (var name in data.clips) {
                        component.addClip(name, data.clips[name]);
                    }
                }

                if (data.speed !== undefined)  {
                    component.speed = data.speed;
                }
            }

            SpriteComponentSystem._super.initializeComponentData.call(this, component, data, properties);
        },

        cloneComponent: function (entity, clone) {
            var source = entity.sprite;

            return this.addComponent(clone, {
                enabled: source.enabled,
                type: source.type,
                spriteAsset: source.spriteAsset,
                sprite: source.sprite,
                frame: source.frame,
                color: source.color.clone(),
                opacity: source.opacity,
                flipX: source.flipX,
                flipY: source.flipY,
                speed: source.speed,
                clips: source.clips
            });
        },

        onUpdate: function (dt) {
            var components = this.store;

            for (var id in components) {
                if (components.hasOwnProperty(id)) {
                    var component = components[id];
                    // if sprite component is enabled advance its current clip
                    if (component.data.enabled && component.entity.enabled) {
                        var sprite = component.entity.sprite;
                        if (sprite._currentClip)
                            sprite._currentClip._update(dt);
                    }
                }
            }
        }
    });

    return {
        SpriteComponentSystem: SpriteComponentSystem
    };
}());
