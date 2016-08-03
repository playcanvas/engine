pc.extend(pc, function () {
    var ImageComponent = function ImageComponent (system, entity) {
        // public
        this._materialAsset = null;
        this._material = system.defaultMaterial;
        // this._texture = null;

        // private
        this._node = null;
        this._model = null;
        this._mesh = null;
        this._meshInstance = null;

        this._positions = [];
        this._normals = [];
        this._uvs = [];
        this._indices = [];

        this._mesh = this._createMesh();
        this._node = new pc.GraphNode();
        this._model = new pc.Model();
        this._model.graph = this._node;
        this._meshInstance = new pc.MeshInstance(this._node, this._mesh, this._material);
        this._model.meshInstances.push(this._meshInstance);

        // add model to sceen
        this.system.app.scene.addModel(this._model);
        this.entity.addChild(this._model.graph);
        this._model._entity = this.entity;
    };
    ImageComponent = pc.inherits(ImageComponent, pc.Component);

    pc.extend(ImageComponent.prototype, {
        // build a quad for the image
        _createMesh: function () {
            var w = 32, h = 32;
            if (this.entity.element) {
                w = this.entity.element.width;
                h = this.entity.element.height;
            }

            this._positions[0] = 0;
            this._positions[1] = 0;
            this._positions[2] = 0;
            this._positions[3] = -w;
            this._positions[4] = 0;
            this._positions[5] = 0;
            this._positions[6] = -w;
            this._positions[7] = h;
            this._positions[8] = 0;
            this._positions[9] = 0;
            this._positions[10] = h;
            this._positions[11] = 0;

            for (var i = 0; i < 12; i+=3) {
                this._normals[i] = 0;
                this._normals[i+1] = 0;
                this._normals[i+2] = -1;
            }

            this._uvs[0] = 0;
            this._uvs[1] = 0;
            this._uvs[2] = 1;
            this._uvs[3] = 0;
            this._uvs[4] = 1;
            this._uvs[5] = 1;
            this._uvs[6] = 0;
            this._uvs[7] = 1;

            this._indices[0] = 0;
            this._indices[1] = 1;
            this._indices[2] = 3;
            this._indices[3] = 2;
            this._indices[4] = 3;
            this._indices[5] = 1;

            var mesh = pc.createMesh(this.system.app.graphicsDevice, this._positions, {uvs: this._uvs, normals: this._normals, indices: this._indices});
            this._updateMesh(mesh);

            return mesh;
        },

        _updateMesh: function (mesh) {
            var w = 32, h = 32;
            if (this.entity.element) {
                w = this.entity.element.width;
                h = this.entity.element.height;
            }

            this._positions[0] = 0;
            this._positions[1] = 0;
            this._positions[2] = 0;
            this._positions[3] = -w;
            this._positions[4] = 0;
            this._positions[5] = 0;
            this._positions[6] = -w;
            this._positions[7] = h;
            this._positions[8] = 0;
            this._positions[9] = 0;
            this._positions[10] = h;
            this._positions[11] = 0;

            // offset for pivot
            var hp = this.entity.element.pivot.data[0];
            var vp = this.entity.element.pivot.data[1];

            for (var i = 0; i < this._positions.length; i += 3) {
                this._positions[i] += (hp+1)*w/2
                this._positions[i+1] += (vp-1)*h/2;
            }

            var vb = mesh.vertexBuffer;
            var it = new pc.VertexIterator(vb);
            var numVertices = 4;
            for (var i = 0; i < numVertices; i++) {
                it.element[pc.SEMANTIC_POSITION].set(this._positions[i*3+0], this._positions[i*3+1], this._positions[i*3+2]);
                it.element[pc.SEMANTIC_NORMAL].set(this._normals[i*3+0], this._normals[i*3+1], this._normals[i*3+2]);
                it.element[pc.SEMANTIC_TEXCOORD0].set(this._uvs[i*2+0], this._uvs[i*2+1]);

                it.next();
            }
            it.end();
        },

        _onMaterialLoad: function (asset) {
            this._material = asset.resource;
            this._meshInstance.material = this._material;
        },

        _onMaterialChange: function () {

        },

        _onMaterialRemove: function () {

        },

        _onTextureLoad: function (asset) {
            this._texture = asset.resource;

            // default texture just uses emissive and opacity maps
            this._meshInstance.setParameter("texture_emissiveMap", this._texture);
            this._meshInstance.setParameter("texture_opacityMap", this._texture);
        },

        _onTextureChange: function (asset) {

        },

        _onTextureRemove: function (asset) {

        }
    });

    Object.defineProperty(ImageComponent.prototype, "material", {
        get: function () {
            return this._material;
        },
        set: function (value) {
            this._material = value;
            this._meshInstance.material = this._material;

            if (this._textureAsset || this._texture) {
                this.textureAsset = null;
            }
        }
    });

    Object.defineProperty(ImageComponent.prototype, "materialAsset", {
        get: function () {
            return this._materialAsset;
        },

        set: function (value) {
            var assets = this.system.app.assets;
            var _id = value;

            if (value instanceof pc.Asset) {
                _id = value.id;
            }

            if (this._materialAsset !== _id) {
                if (this._materialAsset) {
                    var _prev = assets.get(this._materialAsset);

                    _prev.off("load", this._onMaterialLoad, this);
                    _prev.off("change", this._onMaterialChange, this);
                    _prev.off("remove", this._onMaterialRemove, this);
                }

                this._materialAsset = _id;
                if (this._materialAsset) {
                    var asset = assets.get(this._materialAsset);

                    asset.on("load", this._onMaterialLoad, this);
                    asset.on("change", this._onMaterialChange, this);
                    asset.on("remove", this._onMaterialRemove, this);

                    if (asset.resource) {
                        this._onMaterialLoad(asset);
                    } else {
                        assets.load(asset);
                    }
                } else {
                    this.material = null;
                }
            }
        }
    });

    Object.defineProperty(ImageComponent.prototype, "texture", {
        get: function () {
            return this._texture;
        },
        set: function (value) {
            this._texture = value;

            // use default material
            if (this._materialAsset || this._material) {
                this.materialAsset = null;
                this.material = this.system.defaultMaterial;
            }
        }
    });

    Object.defineProperty(ImageComponent.prototype, "textureAsset", {
        get: function () {
            return this._textureAsset;
        },

        set: function (value) {
            var assets = this.system.app.assets;
            var _id = value;

            if (value instanceof pc.Asset) {
                _id = value.id;
            }

            if (this._textureAsset !== _id) {
                if (this._textureAsset) {
                    var _prev = assets.get(this._textureAsset);

                    _prev.off("load", this._onTextureLoad, this);
                    _prev.off("change", this._onTextureChange, this);
                    _prev.off("remove", this._onTextureRemove, this);
                }

                this._textureAsset = _id;
                if (this._textureAsset) {
                    var asset = assets.get(this._textureAsset);

                    asset.on("load", this._onTextureLoad, this);
                    asset.on("change", this._onTextureChange, this);
                    asset.on("remove", this._onTextureRemove, this);

                    if (asset.resource) {
                        this._onTextureLoad(asset);
                    } else {
                        assets.load(asset);
                    }
                } else {
                    this._texture = null;
                }
            }
        }
    });

    return {
        ImageComponent: ImageComponent
    };
}());

