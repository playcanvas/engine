pc.extend(pc, function () {

    var ImageElement = function ImageElement (element) {
        this._element = element;
        this._entity = element.entity;
        this._system = element.system;

        // public
        this._textureAsset = null;
        this._texture = null;
        this._materialAsset = null;
        this._material = null;
        this._spriteAsset = null;
        this._sprite = null;
        this._spriteFrame = 0;
        this._pixelsPerUnit = null;

        this._rect = new pc.Vec4(0, 0, 1, 1); // x, y, w, h

        this._color = new pc.Color(1, 1, 1, 1);

        this._mask = false; // this image element is a mask
        this._maskRef = 0; // id used in stencil buffer to mask

        // private
        this._positions = [];
        this._normals = [];
        this._uvs = [];
        this._indices = [];

        // 9-slicing
        this._outerScale = new pc.Vec2();
        this._innerOffset = new pc.Vec4();
        this._atlasRect = new pc.Vec4();

        this._defaultMesh = this._createMesh();
        this._mesh = this._defaultMesh;
        this._node = new pc.GraphNode();
        this._model = new pc.Model();
        this._model.graph = this._node;
        this._meshInstance = new pc.MeshInstance(this._node, this._mesh, this._material);
        this._meshInstance.castShadow = false;
        this._meshInstance.receiveShadow = false;
        this._model.meshInstances.push(this._meshInstance);
        this._drawOrder = 0;

        this._updateAabbFunc = this._updateAabb.bind(this);

        this._entity.addChild(this._model.graph);
        this._model._entity = this._entity;

        // initialize based on screen
        this._onScreenChange(this._element.screen);

        // listen for events
        this._element.on('resize', this._onParentResizeOrPivotChange, this);
        this._element.on('set:pivot', this._onParentResizeOrPivotChange, this);
        this._element.on('screen:set:screenspace', this._onScreenSpaceChange, this);
        this._element.on('set:screen', this._onScreenChange, this);
        this._element.on('set:draworder', this._onDrawOrderChange, this);
        this._element.on('screen:set:resolution', this._onResolutionChange, this);
    };

    pc.extend(ImageElement.prototype, {
        destroy: function () {
            if (this._model) {
                this._element.removeModelFromLayers(this._model);
                // reset mesh to the default because that's the mesh we want destroyed
                // and not possible a mesh from the sprite asset that might be
                // used elsewhere
                this._meshInstance.mesh = this._defaultMesh;
                this._model.destroy();
                this._model = null;
            }

            this._element.off('resize', this._onParentResizeOrPivotChange, this);
            this._element.off('set:pivot', this._onParentResizeOrPivotChange, this);
            this._element.off('screen:set:screenspace', this._onScreenSpaceChange, this);
            this._element.off('set:screen', this._onScreenChange, this);
            this._element.off('set:draworder', this._onDrawOrderChange, this);
            this._element.off('screen:set:resolution', this._onResolutionChange, this);
        },

        _onResolutionChange: function (res) {
        },

        _onParentResizeOrPivotChange: function () {
            if (this._mesh) this._updateMesh(this._mesh);
        },

        _onScreenSpaceChange: function (value) {
            this._updateMaterial(value);
        },

        _onScreenChange: function (screen) {
            if (screen) {
                this._updateMaterial(screen.screen.screenSpace);
            } else {
                this._updateMaterial(false);
            }
        },

        _onDrawOrderChange: function (order) {
            this._drawOrder = order;
            if (this._meshInstance) {
                this._meshInstance.drawOrder = order;
            }
        },

        // Returns true if we are using a material
        // other than the default materials
        _hasUserMaterial: function () {
            return !!this._materialAsset ||
                   (!!this._material &&
                    this._system.defaultImageMaterials.indexOf(this._material) === -1);
        },

        // assign a material internally without updating everything
        // _setMaterial: function (material) {
        //     this._material = material;
        //     this._meshInstance.material = material;
        // },

        _use9Slicing: function () {
            return this.sprite && (this.sprite.renderMode === pc.SPRITE_RENDERMODE_SLICED || this.sprite.renderMode === pc.SPRITE_RENDERMODE_TILED);
        },

        _updateMaterial: function (screenSpace) {
            if (screenSpace) {
                if (!this._hasUserMaterial()) {
                    if (this._mask) {
                        if (this.sprite) {
                            if (this.sprite.renderMode === pc.SPRITE_RENDERMODE_SLICED) {
                                this._material = this._system.defaultScreenSpaceImageMask9SlicedMaterial;
                            } else if (this.sprite.renderMode === pc.SPRITE_RENDERMODE_TILED) {
                                this._material = this._system.defaultScreenSpaceImageMask9TiledMaterial;
                            } else {
                                this._material = this._system.defaultScreenSpaceImageMaskMaterial;
                            }
                        } else {
                            this._material = this._system.defaultScreenSpaceImageMaskMaterial;
                        }
                    } else {
                        if (this.sprite) {
                            if (this.sprite.renderMode === pc.SPRITE_RENDERMODE_SLICED) {
                                this._material = this._system.defaultScreenSpaceImage9SlicedMaterial;
                            } else if (this.sprite.renderMode === pc.SPRITE_RENDERMODE_TILED) {
                                this._material = this._system.defaultScreenSpaceImage9TiledMaterial;
                            } else {
                                this._material = this._system.defaultScreenSpaceImageMaterial;
                            }
                        } else {
                            this._material = this._system.defaultScreenSpaceImageMaterial;
                        }
                    }

                }
                if (this._meshInstance) this._meshInstance.cull = false;

            } else {
                if (!this._hasUserMaterial()) {
                    if (this._mask) {
                        if (this.sprite) {
                            if (this.sprite.renderMode === pc.SPRITE_RENDERMODE_SLICED) {
                                this._material = this._system.defaultImage9SlicedMaskMaterial;
                            } else if (this.sprite.renderMode === pc.SPRITE_RENDERMODE_TILED) {
                                this._material = this._system.defaultImage9TiledMaskMaterial;
                            } else {
                                this._material = this._system.defaultImageMaskMaterial;
                            }
                        } else {
                            this._material = this._system.defaultImageMaskMaterial;
                        }
                    } else {
                        if (this.sprite) {
                            if (this.sprite.renderMode === pc.SPRITE_RENDERMODE_SLICED) {
                                this._material = this._system.defaultImage9SlicedMaterial;
                            } else if (this.sprite.renderMode === pc.SPRITE_RENDERMODE_TILED) {
                                this._material = this._system.defaultImage9TiledMaterial;
                            } else {
                                this._material = this._system.defaultImageMaterial;
                            }
                        } else {
                            this._material = this._system.defaultImageMaterial;
                        }
                    }
                }

                if (this._meshInstance) this._meshInstance.cull = true;
            }
            if (this._meshInstance) {
                this._meshInstance.material = this._material;
                this._meshInstance.screenSpace = screenSpace;
                this._meshInstance.layer = screenSpace ? pc.scene.LAYER_HUD : pc.scene.LAYER_WORLD;
            }
        },

        // build a quad for the image
        _createMesh: function () {
            var w = this._element.calculatedWidth;
            var h = this._element.calculatedHeight;

            this._positions[0] = 0;
            this._positions[1] = 0;
            this._positions[2] = 0;
            this._positions[3] = w;
            this._positions[4] = 0;
            this._positions[5] = 0;
            this._positions[6] = w;
            this._positions[7] = h;
            this._positions[8] = 0;
            this._positions[9] = 0;
            this._positions[10] = h;
            this._positions[11] = 0;

            for (var i = 0; i < 12; i += 3) {
                this._normals[i] = 0;
                this._normals[i + 1] = 0;
                this._normals[i + 2] = 1;
            }

            this._uvs[0] = this._rect.data[0];
            this._uvs[1] = this._rect.data[1];
            this._uvs[2] = this._rect.data[0] + this._rect.data[2];
            this._uvs[3] = this._rect.data[1];
            this._uvs[4] = this._rect.data[0] + this._rect.data[2];
            this._uvs[5] = this._rect.data[1] + this._rect.data[3];
            this._uvs[6] = this._rect.data[0];
            this._uvs[7] = this._rect.data[1] + this._rect.data[3];

            this._indices[0] = 0;
            this._indices[1] = 1;
            this._indices[2] = 3;
            this._indices[3] = 2;
            this._indices[4] = 3;
            this._indices[5] = 1;

            var mesh = pc.createMesh(this._system.app.graphicsDevice, this._positions, { uvs: this._uvs, normals: this._normals, indices: this._indices });
            this._updateMesh(mesh);

            return mesh;
        },

        _updateMesh: function (mesh) {
            var i;
            var w = this._element.calculatedWidth;
            var h = this._element.calculatedHeight;

            // update material
            if (this._element.screen) {
                this._updateMaterial(this._element.screen.screen.screenSpace);
            } else {
                this._updateMaterial();
            }

            // force update meshInstance aabb
            if (this._meshInstance) {
                this._meshInstance._aabbVer = -1;
            }

            if (this.sprite && (this.sprite.renderMode === pc.SPRITE_RENDERMODE_SLICED || this.sprite.renderMode === pc.SPRITE_RENDERMODE_TILED)) {

                // calculate inner offset from the frame's border
                var frameData = this._sprite.atlas.frames[this._sprite.frameKeys[this._spriteFrame]];
                var borderWidthScale = 2 / frameData.rect.z;
                var borderHeightScale = 2 / frameData.rect.w;

                this._innerOffset.set(
                    frameData.border.x * borderWidthScale,
                    frameData.border.y * borderHeightScale,
                    frameData.border.z * borderWidthScale,
                    frameData.border.w * borderHeightScale
                );

                var tex = this.sprite.atlas.texture;
                this._atlasRect.set(frameData.rect.x / tex.width,
                                    frameData.rect.y / tex.height,
                                    frameData.rect.z / tex.width,
                                    frameData.rect.w / tex.height);

                // scale: apply PPU
                var ppu = this._pixelsPerUnit !== null ? this._pixelsPerUnit : this.sprite.pixelsPerUnit;
                var scaleMulX = frameData.rect.z / ppu;
                var scaleMulY = frameData.rect.w / ppu;

                // scale borders if necessary instead of overlapping
                this._outerScale.set(Math.max(w, this._innerOffset.x * scaleMulX), Math.max(h, this._innerOffset.y * scaleMulY));

                var scaleX = scaleMulX;
                var scaleY = scaleMulY;

                this._outerScale.x /= scaleMulX;
                this._outerScale.y /= scaleMulY;

                // scale: shrinking below 1
                scaleX *= pc.math.clamp(w / (this._innerOffset.x * scaleMulX), 0.0001, 1);
                scaleY *= pc.math.clamp(h / (this._innerOffset.y * scaleMulY), 0.0001, 1);

                // set scale
                if (this._meshInstance) {
                    // set inner offset
                    this._meshInstance.setParameter("innerOffset", this._innerOffset.data);
                    // set atlas rect
                    this._meshInstance.setParameter("atlasRect", this._atlasRect.data);
                    // set outer scale
                    // use outerScale in ALL passes (depth, picker, etc) so the shape is correct
                    this._meshInstance.setParameter("outerScale", this._outerScale.data, 0xFFFFFFFF);
                    // set aabb update function
                    this._meshInstance._updateAabbFunc = this._updateAabbFunc;
                }

                // set scale and pivot
                if (this._node) {
                    this._node.setLocalScale(scaleX, scaleY, 1);
                    this._node.setLocalPosition((0.5 - this._element.pivot.x) * w, (0.5 - this._element.pivot.y) * h, 0);
                }
            } else {
                this._positions[0] = 0;
                this._positions[1] = 0;
                this._positions[2] = 0;
                this._positions[3] = w;
                this._positions[4] = 0;
                this._positions[5] = 0;
                this._positions[6] = w;
                this._positions[7] = h;
                this._positions[8] = 0;
                this._positions[9] = 0;
                this._positions[10] = h;
                this._positions[11] = 0;

                // offset for pivot
                var hp = this._element.pivot.data[0];
                var vp = this._element.pivot.data[1];

                for (i = 0; i < this._positions.length; i += 3) {
                    this._positions[i] -= hp * w;
                    this._positions[i + 1] -= vp * h;
                }

                w = 1;
                h = 1;
                var rect = this._rect;

                if (this._sprite && this._sprite.frameKeys[this._spriteFrame] && this._sprite.atlas) {
                    var frame = this._sprite.atlas.frames[this._sprite.frameKeys[this._spriteFrame]];
                    if (frame) {
                        rect = frame.rect;
                        w = this._sprite.atlas.texture.width;
                        h = this._sprite.atlas.texture.height;
                    }
                }

                this._uvs[0] = rect.data[0] / w;
                this._uvs[1] = rect.data[1] / h;
                this._uvs[2] = (rect.data[0] + rect.data[2]) / w;
                this._uvs[3] = rect.data[1] / h;
                this._uvs[4] = (rect.data[0] + rect.data[2]) / w;
                this._uvs[5] = (rect.data[1] + rect.data[3]) / h;
                this._uvs[6] = rect.data[0] / w;
                this._uvs[7] = (rect.data[1] + rect.data[3]) / h;

                var vb = mesh.vertexBuffer;
                var it = new pc.VertexIterator(vb);
                var numVertices = 4;
                for (i = 0; i < numVertices; i++) {
                    it.element[pc.SEMANTIC_POSITION].set(this._positions[i * 3 + 0], this._positions[i * 3 + 1], this._positions[i * 3 + 2]);
                    it.element[pc.SEMANTIC_NORMAL].set(this._normals[i * 3 + 0], this._normals[i * 3 + 1], this._normals[i * 3 + 2]);
                    it.element[pc.SEMANTIC_TEXCOORD0].set(this._uvs[i * 2 + 0], this._uvs[i * 2 + 1]);

                    it.next();
                }
                it.end();

                mesh.aabb.compute(this._positions);

                if (this._node) {
                    this._node.setLocalScale(1, 1, 1);
                    this._node.setLocalPosition(0, 0, 0);
                }

                if (this._meshInstance) {
                    this._meshInstance._updateAabbFunc = null;
                }

            }
        },

        // updates AABB while 9-slicing
        _updateAabb: function (aabb) {
            aabb.center.set(0, 0, 0);
            aabb.halfExtents.set(this._outerScale.x * 0.5, this._outerScale.y * 0.5, 0.001);
            aabb.setFromTransformedAabb(aabb, this._node.getWorldTransform());
            return aabb;
        },

        _getHigherMask: function () {
            var parent = this._entity;

            while (parent) {
                parent = parent.getParent();
                if (parent && parent.element && parent.element.mask) {
                    return parent;
                }
            }

            return null;
        },

        _toggleMask: function () {
            this._element._dirtifyMask();

            var screenSpace = this._element.screen ? this._element.screen.screen.screenSpace : false;
            this._updateMaterial(screenSpace);
        },

        _onMaterialLoad: function (asset) {
            this.material = asset.resource;
        },

        _onMaterialAdded: function (asset) {
            this._system.app.assets.off('add:' + asset.id, this._onMaterialAdded, this);
            if (this._materialAsset === asset.id) {
                this._bindMaterialAsset(asset);
            }
        },

        _bindMaterialAsset: function (asset) {
            asset.on("load", this._onMaterialLoad, this);
            asset.on("change", this._onMaterialChange, this);
            asset.on("remove", this._onMaterialRemove, this);

            if (asset.resource) {
                this._onMaterialLoad(asset);
            } else {
                this._system.app.assets.load(asset);
            }
        },

        _onMaterialChange: function () {

        },

        _onMaterialRemove: function () {

        },

        _onTextureAdded: function (asset) {
            this._system.app.assets.off('add:' + asset.id, this._onTextureAdded, this);
            if (this._textureAsset === asset.id) {
                this._bindTextureAsset(asset);
            }
        },

        _bindTextureAsset: function (asset) {
            asset.on("load", this._onTextureLoad, this);
            asset.on("change", this._onTextureChange, this);
            asset.on("remove", this._onTextureRemove, this);

            if (asset.resource) {
                this._onTextureLoad(asset);
            } else {
                this._system.app.assets.load(asset);
            }
        },

        _onTextureLoad: function (asset) {
            this.texture = asset.resource;
        },

        _onTextureChange: function (asset) {

        },

        _onTextureRemove: function (asset) {

        },

        // When sprite asset is added bind it
        _onSpriteAssetAdded: function (asset) {
            this._system.app.assets.off('add:' + asset.id, this._onSpriteAssetAdded, this);
            if (this._spriteAsset === asset.id) {
                this._bindSpriteAsset(asset);
            }
        },

        // Hook up event handlers on sprite asset
        _bindSpriteAsset: function (asset) {
            asset.on("load", this._onSpriteAssetLoad, this);
            asset.on("change", this._onSpriteAssetChange, this);
            asset.on("remove", this._onSpriteAssetRemove, this);

            if (asset.resource) {
                this._onSpriteAssetLoad(asset);
            } else {
                this._system.app.assets.load(asset);
            }
        },

        // When sprite asset is loaded make sure the texture atlas asset is loaded too
        // If so then set the sprite, otherwise wait for the atlas to be loaded first
        _onSpriteAssetLoad: function (asset) {
            if (! asset.resource) {
                this.sprite = null;
            } else {
                if (! asset.resource.atlas) {
                    var atlasAssetId = asset.data.textureAtlasAsset;
                    var assets = this._system.app.assets;
                    assets.off('load:' + atlasAssetId, this._onTextureAtlasLoad, this);
                    assets.once('load:' + atlasAssetId, this._onTextureAtlasLoad, this);
                } else {
                    this.sprite = asset.resource;
                }
            }
        },

        _onSpriteMeshesChange: function () {
            // force update
            this.spriteFrame = this.spriteFrame;
        },

        _onSpritePpuChange: function () {
            // on force update when the sprite is 9-sliced. If it's not
            // then its mesh will change when the ppu changes which will
            // be handled by onSpriteMeshesChange
            if (this.sprite.renderMode !== pc.SPRITE_RENDERMODE_SIMPLE && this._pixelsPerUnit === null) {
                // force update
                this.spriteFrame = this.spriteFrame;
            }
        },

        _onAtlasTextureChange: function () {
            if (this.sprite && this.sprite.atlas && this.sprite.atlas.texture) {
                this._meshInstance.setParameter("texture_emissiveMap", this._sprite.atlas.texture);
                this._meshInstance.setParameter("texture_opacityMap", this._sprite.atlas.texture);
            } else {
                this._meshInstance.deleteParameter("texture_emissiveMap");
                this._meshInstance.deleteParameter("texture_opacityMap");
            }
        },

        // When atlas is loaded try to reset the sprite asset
        _onTextureAtlasLoad: function (atlasAsset) {
            var spriteAsset = this._spriteAsset;
            if (spriteAsset instanceof pc.Asset) {
                this._onSpriteAssetLoad(spriteAsset);
            } else {
                this._onSpriteAssetLoad(this._system.app.assets.get(spriteAsset));
            }
        },

        // When the sprite asset changes reset it
        _onSpriteAssetChange: function (asset) {
            this._onSpriteAssetLoad(asset);
        },

        _onSpriteAssetRemove: function (asset) {
        },

        onEnable: function () {
            if (this._model) {
                this._element.addModelToLayers(this._model);
            }
        },

        onDisable: function () {
            if (this._model) {
                this._element.removeModelFromLayers(this._model);
            }
        }
    });

    Object.defineProperty(ImageElement.prototype, "color", {
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

    Object.defineProperty(ImageElement.prototype, "opacity", {
        get: function () {
            return this._color.data[3];
        },

        set: function (value) {
            this._color.data[3] = value;
            this._meshInstance.setParameter("material_opacity", value);
        }
    });

    Object.defineProperty(ImageElement.prototype, "rect", {
        get: function () {
            return this._rect;
        },

        set: function (value) {
            if (value instanceof pc.Vec4) {
                this._rect.set(value.x, value.y, value.z, value.w);
            } else {
                this._rect.set(value[0], value[1], value[2], value[3]);
            }
            if (this._mesh) this._updateMesh(this._mesh);
        }
    });

    Object.defineProperty(ImageElement.prototype, "material", {
        get: function () {
            return this._material;
        },
        set: function (value) {
            if (! value) {
                var screenSpace = this._element.screen ? this._element.screen.screen.screenSpace : false;
                value = screenSpace ? this._system.defaultScreenSpaceImageMaterial : this._system.defaultImageMaterial;
                value = this._mask ? this._system.defaultScreenSpaceImageMaskMaterial : this._system.defaultImageMaskMaterial;
            }

            this._material = value;
            if (value) {
                this._meshInstance.material = value;

                // if this is not the default material then clear color and opacity overrides
                if (value !== this._system.defaultScreenSpaceImageMaterial &&
                    value !== this._system.defaultImageMaterial &&
                    value !== this._system.defaultImageMaskMaterial &&
                    value !== this._system.defaultScreenSpaceImageMaskMaterial) {
                    this._meshInstance.deleteParameter('material_opacity');
                    this._meshInstance.deleteParameter('material_emissive');
                } else {
                    // otherwise if we are back to the defaults reset the color and opacity
                    this._meshInstance.setParameter('material_emissive', this._color.data3);
                    this._meshInstance.setParameter('material_opacity', this._color.data[3]);
                }
            }
        }
    });

    Object.defineProperty(ImageElement.prototype, "materialAsset", {
        get: function () {
            return this._materialAsset;
        },

        set: function (value) {
            var assets = this._system.app.assets;
            var _id = value;

            if (value instanceof pc.Asset) {
                _id = value.id;
            }

            if (this._materialAsset !== _id) {
                if (this._materialAsset) {
                    var _prev = assets.get(this._materialAsset);
                    if (_prev) {
                        _prev.off("load", this._onMaterialLoad, this);
                        _prev.off("change", this._onMaterialChange, this);
                        _prev.off("remove", this._onMaterialRemove, this);
                    }
                }

                this._materialAsset = _id;
                if (this._materialAsset) {
                    var asset = assets.get(this._materialAsset);
                    if (! asset) {
                        this.material = null;
                        assets.on('add:' + this._materialAsset, this._onMaterialAdded, this);
                    } else {
                        this._bindMaterialAsset(asset);
                    }
                } else {
                    this.material = null;
                }
            }
        }
    });

    Object.defineProperty(ImageElement.prototype, "texture", {
        get: function () {
            return this._texture;
        },
        set: function (value) {
            this._texture = value;

            if (value) {
                // default texture just uses emissive and opacity maps
                this._meshInstance.setParameter("texture_emissiveMap", this._texture);
                this._meshInstance.setParameter("texture_opacityMap", this._texture);
                this._meshInstance.setParameter("material_emissive", this._color.data3);
                this._meshInstance.setParameter("material_opacity", this._color.data[3]);
            } else {
                // clear texture params
                this._meshInstance.deleteParameter("texture_emissiveMap");
                this._meshInstance.deleteParameter("texture_opacityMap");
            }
        }
    });

    Object.defineProperty(ImageElement.prototype, "textureAsset", {
        get: function () {
            return this._textureAsset;
        },

        set: function (value) {
            var assets = this._system.app.assets;
            var _id = value;

            if (value instanceof pc.Asset) {
                _id = value.id;
            }

            if (this._textureAsset !== _id) {
                if (this._textureAsset) {
                    var _prev = assets.get(this._textureAsset);
                    if (_prev) {
                        _prev.off("load", this._onTextureLoad, this);
                        _prev.off("change", this._onTextureChange, this);
                        _prev.off("remove", this._onTextureRemove, this);
                    }
                }

                this._textureAsset = _id;
                if (this._textureAsset) {
                    var asset = assets.get(this._textureAsset);
                    if (! asset) {
                        this.texture = null;
                        assets.on('add:' + this._textureAsset, this._onTextureAdded, this);
                    } else {
                        this._bindTextureAsset(asset);
                    }
                } else {
                    this.texture = null;
                }
            }
        }
    });

    Object.defineProperty(ImageElement.prototype, "spriteAsset", {
        get: function () {
            return this._spriteAsset;
        },
        set: function (value) {
            var assets = this._system.app.assets;
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

    Object.defineProperty(ImageElement.prototype, "sprite", {
        get: function () {
            return this._sprite;
        },
        set: function (value) {
            if (this._sprite) {
                this._sprite.off('set:meshes', this._onSpriteMeshesChange, this);
                this._sprite.off('set:pixelsPerUnit', this._onSpritePpuChange, this);
                this._sprite.off('set:atlas', this._onAtlasTextureChange, this);
                if (this._sprite.atlas) {
                    this._sprite.atlas.off('set:texture', this._onAtlasTextureChange, this);
                }
            }

            this._sprite = value;

            if (this._sprite) {
                this._sprite.on('set:meshes', this._onSpriteMeshesChange, this);
                this._sprite.on('set:pixelsPerUnit', this._onSpritePpuChange, this);
                this._sprite.on('set:atlas', this._onAtlasTextureChange, this);
                if (this._sprite.atlas) {
                    this._sprite.atlas.on('set:texture', this._onAtlasTextureChange, this);
                }
            }

            if (this._meshInstance) {
                if (this._sprite && this._sprite.atlas && this._sprite.atlas.texture) {
                    // default texture just uses emissive and opacity maps
                    this._meshInstance.setParameter("texture_emissiveMap", this._sprite.atlas.texture);
                    this._meshInstance.setParameter("texture_opacityMap", this._sprite.atlas.texture);
                } else {
                    // clear texture params
                    this._meshInstance.deleteParameter("texture_emissiveMap");
                    this._meshInstance.deleteParameter("texture_opacityMap");
                }
            }

            this.spriteFrame = this.spriteFrame; // force update frame
        }
    });

    Object.defineProperty(ImageElement.prototype, "spriteFrame", {
        get: function () {
            return this._spriteFrame;
        },
        set: function (value) {
            if (this._sprite) {
                // clamp frame
                this._spriteFrame = pc.math.clamp(value, 0, this._sprite.frameKeys.length - 1);
            } else {
                this._spriteFrame = value;
            }

            var nineSlice = false;
            var mesh = null;

            // take mesh from sprite
            if (this._sprite && this._sprite.atlas) {
                mesh = this._sprite.meshes[this.spriteFrame];
                nineSlice = this._sprite.renderMode === pc.SPRITE_RENDERMODE_SLICED || this._sprite.renderMode === pc.SPRITE_RENDERMODE_TILED;
            }

            // if we use 9 slicing then use that mesh otherwise keep using the default mesh
            this.mesh = nineSlice ? mesh : this._defaultMesh;

            if (this.mesh) {
                this._updateMesh(this.mesh);
            }
        }
    });

    Object.defineProperty(ImageElement.prototype, "mesh", {
        get: function () {
            return this._mesh;
        },
        set: function (value) {
            this._mesh = value;
            if (this._meshInstance) {
                this._meshInstance.mesh = this._mesh;
                this._meshInstance.visible = !!this._mesh;
                this._meshInstance._aabbVer = -1;
                if (this._mesh === this._defaultMesh) {
                    this._meshInstance._updateAabbFunc = null;
                } else {
                    this._meshInstance._updateAabbFunc = this._updateAabbFunc;
                }
            }
        }
    });

    Object.defineProperty(ImageElement.prototype, "mask", {
        get: function () {
            return this._mask;
        },
        set: function (value) {
            if (this._mask !== value) {
                this._mask = value;
                this._toggleMask();
            }
        }
    });

    Object.defineProperty(ImageElement.prototype, "pixelsPerUnit", {
        get: function () {
            return this._pixelsPerUnit;
        },
        set: function (value) {
            if (this._pixelsPerUnit === value) return;

            this._pixelsPerUnit = value;
            if (this._sprite && (this._sprite.renderMode === pc.SPRITE_RENDERMODE_SLICED || this._sprite.renderMode === pc.SPRITE_RENDERMODE_TILED)) {
                // force update
                this.spriteFrame = this.spriteFrame;
            }

        }
    });

    return {
        ImageElement: ImageElement
    };
}());

