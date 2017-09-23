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

        this._rect = new pc.Vec4(0,0,1,1); // x, y, w, h

        this._color = new pc.Color(1,1,1,1);

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
                   this._material !== this._system.defaultImageMaterial);
        },

        _updateMaterial: function (screenSpace) {
            if (screenSpace) {
                if (!this._hasUserMaterial()) {
                    this._material = this._system.defaultScreenSpaceImageMaterial;
                }
                if (this._meshInstance) this._meshInstance.layer = pc.scene.LAYER_HUD;
            } else {
                if (!this._hasUserMaterial()) {
                    this._material = this._system.defaultImageMaterial;
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

            this._uvs[0] = this._rect.data[0];
            this._uvs[1] = this._rect.data[1];
            this._uvs[2] = this._rect.data[0] + this._rect.data[2];
            this._uvs[3] = this._rect.data[1];
            this._uvs[4] = this._rect.data[0] + this._rect.data[2];
            this._uvs[5] = this._rect.data[1] + this._rect.data[3];
            this._uvs[6] = this._rect.data[0];
            this._uvs[7] = this._rect.data[1] + this._rect.data[3];

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
            }

            this._material = value;
            if (value) {
                this._meshInstance.material = value;

                // if this is not the default material then clear color and opacity overrides
                if (value !== this._system.defaultScreenSpaceImageMaterial && value !== this._system.defaultImageMaterial) {
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

    return {
        ImageElement: ImageElement
    };
}());

