pc.extend(pc, function () {
    'use strict';

    /**
     * @enum pc.SPRITETYPE
     * @name pc.SPRITETYPE_SIMPLE
     * @description A {@link pc.SpriteComponent} that displays a single frame from a sprite asset.
     */
    pc.SPRITETYPE_SIMPLE = 'simple';


    /**
     * @enum pc.SPRITETYPE
     * @name pc.SPRITETYPE_ANIMATED
     * @description A {@link pc.SpriteComponent} that renders sprite animations.
     */
    pc.SPRITETYPE_ANIMATED = 'animated';

    /**
     * @component
     * @name pc.SpriteComponent
     * @extends pc.Component
     * @class Enables an Entity to render a simple static sprite as a sprite animation.
     * @param {pc.SpriteComponentSystem} system The ComponentSystem that created this Component
     * @param {pc.Entity} entity The Entity that this Component is attached to.
     * @property {String} type The type of the SpriteComponent. Can be one of the following:
     * <ul>
     *     <li>pc.SPRITETYPE_SIMPLE: The component renders a single frame from a sprite asset.
     *     <li>pc.SPRITETYPE_ANIMATED: The component can play sprite animation clips.
     * </ul>
     * @property {pc.Color} color The color tint of the sprite.
     * @property {Number} opacity The opacity of the sprite.
     * @property {Number} spriteAsset The id of the sprite asset to render. Only works for 'simple' types.
     * @property {Number} frame The frame counter of the sprite. Specifies which frame from the sprite asset to render.
     */
    var SpriteComponent = function SpriteComponent (system, entity) {
        this._type = pc.SPRITETYPE_SIMPLE;
        this._frame = 0;
        this._spriteAsset = null;
        this._sprite = null;
        this._material = system.defaultMaterial;
        this._color = new pc.Color(1,1,1,1);

        this._meshes = [];
        this._node = new pc.GraphNode();
        this._model = new pc.Model();
        this._model.graph = this._node;
        this._drawOrder = 0;

        entity.addChild(this._model.graph);
        this._model._entity = entity;
    };
    SpriteComponent = pc.inherits(SpriteComponent, pc.Component);

    pc.extend(SpriteComponent.prototype, {
        onEnable: function () {
            SpriteComponent._super.onEnable.call(this);

            if (this._model && this._meshInstance && !this.system.app.scene.containsModel(this._model)) {
                this.system.app.scene.addModel(this._model);
            }
        },

        onDisable: function () {
            SpriteComponent._super.onDisable.call(this);

            if (this._model) {
                this.system.app.scene.removeModel(this._model);
            }
        },

        _createMeshes: function () {
            var i;
            this._meshes.length = 0;

            // create normals (same for every mesh)
            var normals = [];
            for (i = 0; i < 12; i+=3) {
                normals[i] = 0;
                normals[i+1] = 0;
                normals[i+2] = 1;
            }

            // create indices (same for every mesh)
            var indices = [];
            indices[0] = 0;
            indices[1] = 1;
            indices[2] = 3;
            indices[3] = 2;
            indices[4] = 3;
            indices[5] = 1;

            var count = this._sprite.frameKeys.length;

            // create a mesh for each frame in the sprite
            for (i = 0; i < count; i++) {
                var frame = this._sprite.atlas.frames[this._sprite.frameKeys[i]];
                var rect = frame.rect;
                var w = this._sprite.atlas.texture.width * rect.data[2] / this._sprite.pixelsPerUnit;
                var h = this._sprite.atlas.texture.height * rect.data[3] / this._sprite.pixelsPerUnit;
                var hp = frame.pivot.x;
                var vp = frame.pivot.y;

                // positions based on pivot and size of frame
                var positions = [];
                positions[0] = -hp*w;
                positions[1] = -vp*h;
                positions[2] = 0;
                positions[3] = (1 - hp) * w;
                positions[4] = -vp*h;
                positions[5] = 0;
                positions[6] = (1 - hp) * w;
                positions[7] = (1 - vp) * h;
                positions[8] = 0;
                positions[9] = -hp*w;
                positions[10] = (1 - vp) * h;
                positions[11] = 0;

                // uvs based on frame rect
                var uvs = [];
                uvs[0] = rect.data[0];
                uvs[1] = rect.data[1];
                uvs[2] = rect.data[0] + rect.data[2];
                uvs[3] = rect.data[1];
                uvs[4] = rect.data[0] + rect.data[2];
                uvs[5] = rect.data[1] + rect.data[3];
                uvs[6] = rect.data[0];
                uvs[7] = rect.data[1] + rect.data[3];

                // create mesh and add it to our list
                var mesh = pc.createMesh(this.system.app.graphicsDevice, positions, {uvs: uvs, normals: normals, indices: indices});
                mesh.aabb.compute(positions);
                this._meshes.push(mesh);
            }

            // create mesh instance if it doesn't exist yet
            if (! this._meshInstance && count) {
                var frame = this.frame < count ? this.frame : 0;
                this._meshInstance = new pc.MeshInstance(this._node, this._meshes[frame], this._material);
                this._meshInstance.castShadow = false;
                this._meshInstance.receiveShadow = false;
                this._model.meshInstances.push(this._meshInstance);

                this._meshInstance.setParameter('material_emissive', this._color.data3);
                this._meshInstance.setParameter('material_opacity', this._color.data[3]);

                if (this.sprite.atlas.texture) {
                    this._meshInstance.setParameter('texture_emissiveMap', this.sprite.atlas.texture);
                    this._meshInstance.setParameter('texture_opacityMap', this.sprite.atlas.texture);
                }


                if (this.enabled && this.entity.enabled && !this.system.app.scene.containsModel(this._model)) {
                    this.system.app.scene.addModel(this._model);
                }
            }
        },

        _showFrame: function (frame) {
            var mesh = this._meshes[frame];
            if (! mesh) return;

            this._meshInstance.mesh = mesh;
        },

        _onSpriteAssetAdded: function (asset) {
            this.system.app.assets.off('add:' + asset.id, this._onSpriteAssetAdded, this);
            if (this._spriteAsset === asset.id) {
                this._bindSpriteAsset(asset);
            }
        },

        _bindSpriteAsset: function (asset) {
            asset.on("load", this._onSpriteAssetLoad, this);
            asset.on("change", this._onSpriteAssetChange, this);
            asset.on("remove", this._onSpriteAssetRemove, this);

            if (asset.resource) {
                this._onSpriteAssetLoad(asset);
            } else {
                this.system.app.assets.load(asset);
            }
        },

        _onSpriteAssetLoad: function (asset) {
            if (! asset.resource) {
                this.sprite = null;
            } else {
                if (! asset.resource.atlas) {
                    var atlasAssetId = asset.data.spriteAtlasAsset;
                    this.system.app.assets.off('load:' + atlasAssetId, this._onSpriteAtlasLoad, this);
                    this.system.app.assets.once('load:' + atlasAssetId, this._onSpriteAtlasLoad, this);
                } else {
                    this.sprite = asset.resource;
                }
            }
        },

        _onSpriteAtlasLoad: function (atlasAsset) {
            var spriteAsset = this._spriteAsset;
            if (spriteAsset instanceof pc.Asset) {
                this._onSpriteAssetLoad(spriteAsset);
            } else {
                this._onSpriteAssetLoad(this.system.app.assets.get(spriteAsset));
            }
        },

        _onSpriteAssetChange: function (asset) {
            this.sprite = asset.resource;
        },

        _onSpriteAssetRemove: function (asset) {
            if (this._model) {
                this.system.app.scene.removeModel(this._model);
            }
        },
    });

    Object.defineProperty(SpriteComponent.prototype, "type", {
        get: function () {
            return this._type;
        },

        set: function (value) {
            if (value !== this._type) {
                this._type = value;
            }
        }
    });

    Object.defineProperty(SpriteComponent.prototype, "frame", {
        get: function () {
            return this._frame;
        },

        set: function (value) {
            this._frame = value;

            if (this._sprite && this._meshInstance) {
                this._showFrame(value);
            }

            this.fire('set:frame', this._frame);
        }
    });

    Object.defineProperty(SpriteComponent.prototype, "spriteAsset", {
        get: function () {
            return this._spriteAsset;
        },
        set: function (value) {
            var assets = this.system.app.assets;
            var _id = value;

            if (value instanceof pc.Asset) {
                _id = value.id;
            }

            if (this._spriteAsset !== _id) {
                if (this._spriteAsset) {
                    var _prev = assets.get(this._spriteAsset);
                    if (_prev) {
                        _prev.off("load", this._onSpriteAssetLoad, this);
                        _prev.off("change", this._onSpriteAssetChange, this);
                        _prev.off("remove", this._onSpriteAssetRemove, this);
                    }
                }

                this._spriteAsset = _id;
                if (this._spriteAsset) {
                    var asset = assets.get(this._spriteAsset);
                    if (! asset) {
                        this.sprite = null;
                        assets.on('add:' + this._spriteAsset, this._onSpriteAssetAdded, this);
                    } else {
                        this._bindSpriteAsset(asset);
                    }
                } else {
                    this.sprite = null;
                }
            }
        }
    });

    Object.defineProperty(SpriteComponent.prototype, "sprite", {
        get: function () {
            return this._sprite;
        },
        set: function (value) {
            this._sprite = value;

            if (value && value.atlas)
                this._createMeshes();

            if (this._meshInstance && (!value || !value.atlas)) {
                this._meshInstance.deleteParameter('texture_emissiveMap');
                this._meshInstance.deleteParameter('texture_opacityMap');
            }
        }
    });

    Object.defineProperty(SpriteComponent.prototype, "material", {
        get: function () {
            return this._material;
        },
        set: function (value) {
            this._material = value;
            if (this._meshInstance) {
                this._meshInstance.material = value;
            }
        }
    });

    Object.defineProperty(SpriteComponent.prototype, "color", {
        get: function () {
            return this._color;
        },
        set: function (value) {
            this._color.data[0] = value.data[0];
            this._color.data[1] = value.data[1];
            this._color.data[2] = value.data[2];

            if (this._meshInstance) {
                this._meshInstance.setParameter('material_emissive', this._color.data3);
            }
        }
    });

    Object.defineProperty(SpriteComponent.prototype, "opacity", {
        get: function () {
            return this._color.data[3];
        },
        set: function (value) {
            this._color.data[3] = value;
            if (this._meshInstance) {
                this._meshInstance.setParameter('material_opacity', value);
            }
        }
    });

    return {
        SpriteComponent: SpriteComponent
    };
}());
