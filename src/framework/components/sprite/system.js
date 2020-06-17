Object.assign(pc, function () {
    'use strict';

    var _schema = ['enabled'];

    /**
     * @class
     * @name pc.SpriteComponentSystem
     * @augments pc.ComponentSystem
     * @classdesc Manages creation of {@link pc.SpriteComponent}s.
     * @param {pc.Application} app - The application.
     */
    var SpriteComponentSystem = function SpriteComponentSystem(app) {
        pc.ComponentSystem.call(this, app);

        this.id = 'sprite';

        this.ComponentType = pc.SpriteComponent;
        this.DataType = pc.SpriteComponentData;

        this.schema = _schema;

        // default texture - make white so we can tint it with emissive color
        this._defaultTexture = null;

        // default material used by sprites
        this._defaultMaterial = null;

        // material used for 9-slicing in sliced mode
        this._default9SlicedMaterialSlicedMode = null;

        // material used for 9-slicing in tiled mode
        this._default9SlicedMaterialTiledMode = null;

        pc.ComponentSystem.bind('update', this.onUpdate, this);
        this.on('beforeremove', this.onBeforeRemove, this);
    };
    SpriteComponentSystem.prototype = Object.create(pc.ComponentSystem.prototype);
    SpriteComponentSystem.prototype.constructor = SpriteComponentSystem;

    pc.Component._buildAccessors(pc.SpriteComponent.prototype, _schema);

    Object.defineProperties(SpriteComponentSystem.prototype, {
        defaultMaterial: {
            get: function () {
                if (!this._defaultMaterial) {
                    var texture = new pc.Texture(this.app.graphicsDevice, {
                        width: 1,
                        height: 1,
                        format: pc.PIXELFORMAT_R8_G8_B8_A8
                    });
                    var pixels = new Uint8Array(texture.lock());
                    pixels[0] = pixels[1] = pixels[2] = pixels[3] = 255;
                    texture.name = 'sprite';
                    texture.unlock();

                    var material = new pc.StandardMaterial();
                    material.diffuse.set(0, 0, 0); // black diffuse color to prevent ambient light being included
                    material.emissive.set(0.5, 0.5, 0.5); // use non-white to compile shader correctly
                    material.emissiveMap = texture;
                    material.emissiveMapTint = true;
                    material.opacityMap = texture;
                    material.opacityMapChannel = "a";
                    material.opacityTint = true;
                    material.opacity = 0; // use non-1 opacity to compile shader correctly
                    material.useLighting = false;
                    material.useGammaTonemap = false;
                    material.useFog = false;
                    material.useSkybox = false;
                    material.blendType = pc.BLEND_PREMULTIPLIED;
                    material.depthWrite = false;
                    material.pixelSnap = false;
                    material.cull = pc.CULLFACE_NONE; // don't cull because we might flipX or flipY which uses negative scale on the graph node
                    material.update();

                    this._defaultTexture = texture;
                    this._defaultMaterial = material;
                }
                return this._defaultMaterial;
            },
            set: function (material) {
                this._defaultMaterial = material;
            }
        },
        default9SlicedMaterialSlicedMode: {
            get: function () {
                if (!this._default9SlicedMaterialSlicedMode) {
                    var material = this.defaultMaterial.clone();
                    material.nineSlicedMode = pc.SPRITE_RENDERMODE_SLICED;
                    material.update();

                    this._default9SlicedMaterialSlicedMode = material;
                }
                return this._default9SlicedMaterialSlicedMode;
            },
            set: function (material) {
                this._default9SlicedMaterialSlicedMode = material;
            }
        },
        default9SlicedMaterialTiledMode: {
            get: function () {
                if (!this._default9SlicedMaterialTiledMode) {
                    var material = this.defaultMaterial.clone();
                    material.nineSlicedMode = pc.SPRITE_RENDERMODE_TILED;
                    material.update();

                    this._default9SlicedMaterialTiledMode = material;
                }
                return this._default9SlicedMaterialTiledMode;
            },
            set: function (material) {
                this._default9SlicedMaterialTiledMode = material;
            }
        }
    });

    Object.assign(SpriteComponentSystem.prototype, {
        destroy: function () {
            if (this._defaultTexture) {
                this._defaultTexture.destroy();
                this._defaultTexture = null;
            }
        },

        initializeComponentData: function (component, data, properties) {
            if (data.enabled !== undefined) {
                component.enabled = data.enabled;
            }

            component.type = data.type;

            if (data.layers && pc.type(data.layers) === 'array') {
                component.layers = data.layers.slice(0);
            }

            if (data.drawOrder !== undefined) {
                component.drawOrder = data.drawOrder;
            }

            if (data.color !== undefined) {
                if (data.color instanceof pc.Color) {
                    component.color.set(data.color.r, data.color.g, data.color.b, data.opacity !== undefined ? data.opacity : 1);
                } else {
                    component.color.set(data.color[0], data.color[1], data.color[2], data.opacity !== undefined ? data.opacity : 1);
                }

                /* eslint-disable no-self-assign */
                // force update
                component.color = component.color;
                /* eslint-enable no-self-assign */
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

            if (data.width !== undefined) {
                component.width = data.width;
            }

            if (data.height !== undefined) {
                component.height = data.height;
            }

            if (data.spriteAsset !== undefined) {
                component.spriteAsset = data.spriteAsset;
            }

            if (data.sprite) {
                component.sprite = data.sprite;
            }

            if (data.frame !== undefined) {
                component.frame = data.frame;
            }

            if (data.clips) {
                for (var name in data.clips) {
                    component.addClip(data.clips[name]);
                }
            }

            if (data.speed !== undefined)  {
                component.speed = data.speed;
            }

            if (data.autoPlayClip) {
                component.autoPlayClip = data.autoPlayClip;
            }

            component.batchGroupId = data.batchGroupId === undefined || data.batchGroupId === null ? -1 : data.batchGroupId;

            pc.ComponentSystem.prototype.initializeComponentData.call(this, component, data, properties);
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
                clips: source.clips,
                autoPlayClip: source.autoPlayClip,
                batchGroupId: source.batchGroupId,
                drawOrder: source.drawOrder,
                layers: source.layers.slice(0)
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
                        if (sprite._currentClip) {
                            sprite._currentClip._update(dt);
                        }
                    }
                }
            }
        },

        onBeforeRemove: function (entity, component) {
            component.onDestroy();
        }
    });

    return {
        SpriteComponentSystem: SpriteComponentSystem
    };
}());
