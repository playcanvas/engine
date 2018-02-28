pc.extend(pc, function () {
    var maskCounter = 1;

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
        this._frame = 0;

        this._rect = new pc.Vec4(0,0,1,1); // x, y, w, h

        this._color = new pc.Color(1,1,1,1);

        this._mask = false; // this image element is a mask
        this._maskRef = 0; // id used in stencil buffer to mask

        // private
        this._positions = [];
        this._normals = [];
        this._uvs = [];
        this._indices = [];

        this._mesh = this._createMesh();
        this._node = new pc.GraphNode();
        this._model = new pc.Model();
        this._model.graph = this._node;
        this._meshInstance = new pc.MeshInstance(this._node, this._mesh, this._material);
        this._meshInstance.castShadow = false;
        this._meshInstance.receiveShadow = false;
        this._model.meshInstances.push(this._meshInstance);
        this._drawOrder = 0;

        this._entity.addChild(this._model.graph);
        this._model._entity = this._entity;

        // initialize based on screen
        this._onScreenChange(this._element.screen);

        // listen for events
        this._element.on('resize', this._onParentResize, this);
        this._element.on('screen:set:screenspace', this._onScreenSpaceChange, this);
        this._element.on('set:screen', this._onScreenChange, this);
        this._element.on('set:draworder', this._onDrawOrderChange, this);
        this._element.on('screen:set:resolution', this._onResolutionChange, this);
    };

    ImageElement.incCounter = function () {
        maskCounter++;
    };

    ImageElement.maskCounter = function () {
        return maskCounter;
    };

    pc.extend(ImageElement.prototype, {
        destroy: function () {
            if (this._model) {
                this._system.app.scene.removeModel(this._model);
                this._model.destroy();
                this._model = null;
            }

            this._element.off('resize', this._onParentResize, this);
            this._element.off('screen:set:screenspace', this._onScreenSpaceChange, this);
            this._element.off('set:screen', this._onScreenChange, this);
            this._element.off('set:draworder', this._onDrawOrderChange, this);
            this._element.off('screen:set:resolution', this._onResolutionChange, this);
        },

        _onResolutionChange: function (res) {
        },

        _onParentResize: function () {
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
                   this._material !== this._system.defaultScreenSpaceImageMaterial &&
                   this._material !== this._system.defaultImageMaterial &&
                   this._material !== this._system.defaultImageMaskMaterial &&
                   this._material !== this._system.defaultScreenSpaceImageMaskMaterial);
        },

        // assign a material internally without updating everything
        // _setMaterial: function (material) {
        //     this._material = material;
        //     this._meshInstance.material = material;
        // },

        _updateMaterial: function (screenSpace) {
            if (screenSpace) {
                if (!this._hasUserMaterial()) {
                    if (this._mask) {
                        this._material = this._system.defaultScreenSpaceImageMaskMaterial;
                    } else {
                        this._material = this._system.defaultScreenSpaceImageMaterial;
                    }

                }
                if (this._meshInstance) this._meshInstance.layer = pc.scene.LAYER_HUD;
            } else {
                if (!this._hasUserMaterial()) {
                    if (this._mask) {
                        this._material = this._system.defaultImageMaskMaterial;
                    } else {
                        this._material = this._system.defaultImageMaterial;
                    }
                }
                if (this._meshInstance) this._meshInstance.layer = pc.scene.LAYER_WORLD;
            }
            if (this._meshInstance) {
                this._meshInstance.material = this._material;
                this._meshInstance.screenSpace = screenSpace;
            }
        },

        // build a quad for the image
        _createMesh: function () {
            var w = this._element.width;
            var h = this._element.height;

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

            for (var i = 0; i < 12; i+=3) {
                this._normals[i] = 0;
                this._normals[i+1] = 0;
                this._normals[i+2] = 1;
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

            var mesh = pc.createMesh(this._system.app.graphicsDevice, this._positions, {uvs: this._uvs, normals: this._normals, indices: this._indices});
            this._updateMesh(mesh);

            return mesh;
        },

        _updateMesh: function (mesh) {
            var i;
            var w = this._element.width;
            var h = this._element.height;

            // update material
            if (this._element.screen) {
                this._updateMaterial(this._element.screen.screen.screenSpace);
            } else {
                this._updateMaterial();
            }

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
                this._positions[i] -= hp*w;
                this._positions[i+1] -= vp*h;
            }

            var rect = this._rect;
            if (this._sprite && this._sprite.frameKeys[this._frame] && this._sprite.atlas) {
                var frame = this._sprite.atlas.frames[this._sprite.frameKeys[this._frame]];
                if (frame) {
                    rect = frame.rect;
                }
            }

            this._uvs[0] = rect.data[0];
            this._uvs[1] = rect.data[1];
            this._uvs[2] = rect.data[0] + rect.data[2];
            this._uvs[3] = rect.data[1];
            this._uvs[4] = rect.data[0] + rect.data[2];
            this._uvs[5] = rect.data[1] + rect.data[3];
            this._uvs[6] = rect.data[0];
            this._uvs[7] = rect.data[1] + rect.data[3];

            var vb = mesh.vertexBuffer;
            var it = new pc.VertexIterator(vb);
            var numVertices = 4;
            for (i = 0; i < numVertices; i++) {
                it.element[pc.SEMANTIC_POSITION].set(this._positions[i*3+0], this._positions[i*3+1], this._positions[i*3+2]);
                it.element[pc.SEMANTIC_NORMAL].set(this._normals[i*3+0], this._normals[i*3+1], this._normals[i*3+2]);
                it.element[pc.SEMANTIC_TEXCOORD0].set(this._uvs[i*2+0], this._uvs[i*2+1]);

                it.next();
            }
            it.end();

            mesh.aabb.compute(this._positions);

            // force update meshInstance aabb
            if (this._meshInstance)
                this._meshInstance._aabbVer = -1;
        },

        _setMaskedBy: function (mask) {
            if (mask) {
                if (this._maskedBy && this._maskedBy !== mask) {
                    // already masked by something else
                }

                var ref = mask.element._image._maskRef;

                var sp = new pc.StencilParameters({
                    ref: ref,
                    func: pc.FUNC_EQUAL,
                });

                for (var i = 0, len = this._model.meshInstances.length; i<len; i++) {
                    var mi = this._model.meshInstances[i];
                    mi.stencilFront = mi.stencilBack = sp;
                }

                this._maskedBy = mask;
            } else {
                // remove mask
                // restore default material
                for (var i = 0, len = this._model.meshInstances.length; i<len; i++) {
                    var mi = this._model.meshInstances[i];
                    mi.stencilFront = mi.stencilBack = null;
                }
                this._maskedBy = null;
            }
        },

        _getHigherMask: function () {
            var parent = this._entity;

            while(parent) {
                parent = parent.getParent();
                if (parent && parent.element && parent.element.mask) {
                    return parent;
                }
            }

            return null;
        },

        _getMaskDepth: function () {
            var depth = 1;
            var parent = this._entity;

            while(parent) {
                parent = parent.getParent();
                if (parent && parent.element && parent.element.mask) {
                    depth++;

                }
            }

            return depth;
        },

        _toggleMask: function () {
            if (this._mask) {
                // enable mask

                // get the reference value to use
                this._maskRef = this._getMaskDepth();

                // set material stencil parameters
                // to write the _maskRef value into
                // the stencil buffer
                var sp = new pc.StencilParameters({
                    ref: this._maskRef,
                    func: pc.FUNC_ALWAYS,
                    zpass: pc.STENCILOP_REPLACE // assume top mask, this will be updated in component._updateMask if it is nested
                });

                this._meshInstance.stencilFront = this._meshInstance.stencilBack = sp;

                var screenSpace = this._element.screen ? this._element.screen.screen.screenSpace : false;
                var maskMat = screenSpace ? this._system.defaultScreenSpaceImageMaskMaterial : this._system.defaultImageMaskMaterial;

                this._material = maskMat;
                this._meshInstance.material = maskMat;

                var material;

                var parentMask = this._getHigherMask();
                if (parentMask) {
                    this._meshInstance.stencilFront.zpass = pc.STENCILOP_INCREMENT;
                    this._meshInstance.stencilBack.zpass = pc.STENCILOP_INCREMENT;
                } else {
                    // no parent mask
                    // no changes necessary
                }
            } else {
                // disable mask
                this._maskRef = 0;

                this._meshInstance.stencilFront = null;
                this._meshInstance.stencilBack = null;
            }

            // update all children with new mask properties
            this._element.syncMask();
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
            if (this._model && !this._system.app.scene.containsModel(this._model)) {
                this._system.app.scene.addModel(this._model);
            }
        },

        onDisable: function () {
            if (this._model && this._system.app.scene.containsModel(this._model)) {
                this._system.app.scene.removeModel(this._model);
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
                if (value !== this._system.defaultScreenSpaceImageMaterial
                    && value !== this._system.defaultImageMaterial
                    && value !== this._system.defaultImageMaskMaterial
                    && value !== this._system.defaultScreenSpaceImageMaskMaterial) {
                    this._meshInstance.deleteParameter('material_opacity');
                    this._meshInstance.deleteParameter('material_emissive');
                }
                // otherwise if we are back to the defaults reset the color and opacity
                else {
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
            this._sprite = value;

            if (this._sprite && this._sprite.atlas && this._sprite.atlas.texture) {
                // default texture just uses emissive and opacity maps
                this._meshInstance.setParameter("texture_emissiveMap", this._sprite.atlas.texture);
                this._meshInstance.setParameter("texture_opacityMap", this._sprite.atlas.texture);
                this.frame = this.frame; // force update frame
            } else {
                // clear texture params
                this._meshInstance.deleteParameter("texture_emissiveMap");
                this._meshInstance.deleteParameter("texture_opacityMap");
            }
        }
    });

    Object.defineProperty(ImageElement.prototype, "frame", {
        get: function () {
            return this._frame;
        },
        set: function (value) {
            this._frame = value;
            if (this._sprite && this._sprite.atlas) {
                if (value < 0 || value >= this._sprite.frameKeys.length) return;

                var frame = this._sprite.atlas.frames[this._sprite.frameKeys[value]];
                if (! frame) return;
                if (! this._sprite) return;

                this._uvs[0] = frame.rect.data[0];
                this._uvs[1] = frame.rect.data[1];
                this._uvs[2] = frame.rect.data[0] + frame.rect.data[2];
                this._uvs[3] = frame.rect.data[1];
                this._uvs[4] = frame.rect.data[0] + frame.rect.data[2];
                this._uvs[5] = frame.rect.data[1] + frame.rect.data[3];
                this._uvs[6] = frame.rect.data[0];
                this._uvs[7] = frame.rect.data[1] + frame.rect.data[3];

                var vb = this._mesh.vertexBuffer;
                var it = new pc.VertexIterator(vb);
                var numVertices = 4;
                for (var i = 0; i < numVertices; i++) {
                    it.element[pc.SEMANTIC_TEXCOORD0].set(this._uvs[i*2+0], this._uvs[i*2+1]);
                    it.next();
                }
                it.end();
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

    return {
        ImageElement: ImageElement
    };
}());

