pc.extend(pc, function () {
    'use strict';

    var _schema = ['enabled'];

    // TODO: remove this once sprites are deployed
    var warningShown = false;

    var nineSliceBasePS = [
        "varying vec2 vMask;",
        "varying vec2 vTiledUv;",
        "uniform vec4 innerOffset;",
        "uniform vec2 outerScale;",
        "uniform vec4 atlasRect;",
        "vec2 nineSlicedUv;"
    ].join('\n');

    var nineSliceUvPs = [
        "vec2 tileMask = step(vMask, vec2(0.99999));",
        "vec2 clampedUv = mix(innerOffset.xy*0.5, vec2(1.0) - innerOffset.zw*0.5, fract(vTiledUv));",
        "clampedUv = clampedUv * atlasRect.zw + atlasRect.xy;",
        "nineSlicedUv = vUv0 * tileMask + clampedUv * (vec2(1.0) - tileMask);"
    ].join('\n');


    /**
     * @private
     * @constructor
     * @name pc.SpriteComponentSystem
     * @classdesc Manages creation of {@link pc.SpriteComponent}s.
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
        this._defaultTexture = new pc.Texture(app.graphicsDevice, { width: 1, height: 1, format: pc.PIXELFORMAT_R8_G8_B8_A8 });
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
        this.defaultMaterial.diffuse = new pc.Color(0, 0, 0, 1); // black diffuse color to prevent ambient light being included
        this.defaultMaterial.emissive = new pc.Color(0.5, 0.5, 0.5, 1); // use non-white to compile shader correctly
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

        // material used for 9-slicing in sliced mode
        this.default9SlicedMaterialSlicedMode = this.defaultMaterial.clone();
        this.default9SlicedMaterialSlicedMode.chunks.basePS = pc.shaderChunks.basePS + nineSliceBasePS;
        this.default9SlicedMaterialSlicedMode.chunks.startPS = pc.shaderChunks.startPS + "nineSlicedUv = vUv0;\n";
        this.default9SlicedMaterialSlicedMode.chunks.emissivePS = pc.shaderChunks.emissivePS.replace("$UV", "nineSlicedUv");
        this.default9SlicedMaterialSlicedMode.chunks.opacityPS = pc.shaderChunks.opacityPS.replace("$UV", "nineSlicedUv");
        this.default9SlicedMaterialSlicedMode.chunks.transformVS = "#define NINESLICED\n" + pc.shaderChunks.transformVS;
        this.default9SlicedMaterialSlicedMode.chunks.uv0VS = pc.shaderChunks.uv9SliceVS;
        this.default9SlicedMaterialSlicedMode.update();

        // material used for 9-slicing in tiled mode
        this.default9SlicedMaterialTiledMode = this.defaultMaterial.clone();
        this.default9SlicedMaterialTiledMode.chunks.basePS = pc.shaderChunks.basePS + "#define NINESLICETILED\n" + nineSliceBasePS;
        this.default9SlicedMaterialTiledMode.chunks.startPS = pc.shaderChunks.startPS + nineSliceUvPs;
        this.default9SlicedMaterialTiledMode.chunks.emissivePS = pc.shaderChunks.emissivePS.replace("$UV", "nineSlicedUv, -1000.0");
        this.default9SlicedMaterialTiledMode.chunks.opacityPS = pc.shaderChunks.opacityPS.replace("$UV", "nineSlicedUv, -1000.0");
        this.default9SlicedMaterialTiledMode.chunks.transformVS = "#define NINESLICED\n" + pc.shaderChunks.transformVS;
        this.default9SlicedMaterialTiledMode.chunks.uv0VS = pc.shaderChunks.uv9SliceVS;
        this.default9SlicedMaterialTiledMode.update();

        pc.ComponentSystem.on('update', this.onUpdate, this);
        this.on('beforeremove', this.onBeforeRemove, this);
    };
    SpriteComponentSystem = pc.inherits(SpriteComponentSystem, pc.ComponentSystem);

    pc.Component._buildAccessors(pc.SpriteComponent.prototype, _schema);

    pc.extend(SpriteComponentSystem.prototype, {
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

            SpriteComponentSystem._super.initializeComponentData.call(this, component, data, properties);

            if (! warningShown) {
                console.warn('The Sprite component is in beta and might change without notice.');
                warningShown = true;
            }
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
                batchGroupId: source.batchGroupId
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
