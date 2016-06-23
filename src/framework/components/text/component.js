pc.extend(pc, function () {
    pc.PIVOT_TOPLEFT = 0;
    pc.PIVOT_TOP = 1;
    pc.PIVOT_TOPRIGHT = 2;
    pc.PIVOT_LEFT = 3;
    pc.PIVOT_CENTER = 4;
    pc.PIVOT_RIGHT = 5;
    pc.PIVOT_BOTTOMLEFT = 6;
    pc.PIVOT_BOTTOM = 7;
    pc.PIVOT_BOTTOMRIGHT = 8;

    var TextComponent = function TextComponent (system, entity) {
        // public
        this._text = "";
        // this._textureAsset = null;
        // this._jsonAsset = null;
        this._asset = null;
        this._font = null;//new pc.BitmapFont();
        // this._font.on("load", this._onFontLoad, this);
        this._color = new pc.Color();
        this._pivot = pc.PIVOT_CENTER;

        this.width = 0;
        this.height = 0;

        // private
        // this._texture = null;
        // this._json = null;
        this._node = null;
        this._model = null;
        this._mesh = null;
        this._meshInstance = null;

        this._positions = [];
        this._normals = [];
        this._uvs = [];
        this._indices = [];
    };
    TextComponent = pc.inherits(TextComponent, pc.Component);


    pc.extend(TextComponent.prototype, {
        _updateText: function (text) {
            if (!text) text = this._text;

            if (!this._mesh || text.length !== this._text.length) {
                this._mesh = this._createMesh(text);

                this._node = new pc.GraphNode();
                this._model = new pc.Model();
                this._model.graph = this._node;
                this._meshInstance = new pc.MeshInstance(this._node, this._mesh, this.system.material);
                this._model.meshInstances.push(this._meshInstance);

                this._meshInstance.setParameter("texture_atlas", this._font.texture);
                this._meshInstance.setParameter("material_foreground", this._color.data);

                // Temporary create a model component...
                if (!this.entity.model) {
                    this.entity.addComponent("model");
                }
                this.entity.model.model = this._model;
            } else {
                this._updateMesh(this._mesh, text);
            }
        },

        // build the mesh for the text
        _createMesh: function (text) {
            var l = text.length;

            // create empty arrays
            this._positions = new Array(l*3*4);
            this._normals = new Array(l*3*4);
            this._uvs = new Array(l*2*4);
            this._indices = new Array(l*3*2);

            // create index buffer now
            // index buffer doesn't change as long as text length stays the same
            for (var i = 0; i < l; i++) {
                this._indices.push((i*4), (i*4)+1, (i*4)+3);
                this._indices.push((i*4)+2, (i*4)+3, (i*4)+1);
            };


            var mesh = pc.createMesh(this.system.app.graphicsDevice, this._positions, {uvs: this._uvs, normals: this._normals, indices: this._indices});
            this._updateMesh(mesh, text);
            return mesh;
        },

        _updateMesh: function (mesh, text) {
            var json = this._font.data;
            var vb = mesh.vertexBuffer;
            var it = new pc.VertexIterator(vb);

            var width = 0;
            var height = 0;

            var l = text.length;
            var _x = 0; // cursors
            var _y = 0;
            var _z = 0;

            this._positions.length = 0;
            this._normals.length = 0;
            this._uvs.length = 0;

            for (var i = 0; i < l; i++) {
                var char = text.charCodeAt(i);

                var x = 0;
                var y = 0;
                var advance = 0;
                var scale = 1;

                var data = json.chars[char];
                if (data && data.scale) {
                    scale = 1 / data.scale;
                    advance = data.xadvance / data.width;
                    x = data.xoffset / data.width;
                    y = data.yoffset / data.height;
                } else {
                    // missing character
                    advance = 0.25;
                    x = 0;
                    y = 0;
                    scale = 0.01;
                }

                this._positions[i*4*3+0] = _x + x;
                this._positions[i*4*3+1] = _y - y;
                this._positions[i*4*3+2] = _z;

                this._positions[i*4*3+3] = _x + x - scale;
                this._positions[i*4*3+4] = _y - y;
                this._positions[i*4*3+5] = _z;

                this._positions[i*4*3+6] = _x + x - scale;
                this._positions[i*4*3+7] = _y - y + scale;
                this._positions[i*4*3+8] = _z;

                this._positions[i*4*3+9]  = _x + x;
                this._positions[i*4*3+10] = _y - y + scale;
                this._positions[i*4*3+11] = _z;

                this.width = _x + x - scale;
                this.height = _y - y + scale;

                // advance cursor
                _x = _x - advance;

                this._normals[i*4*3+0] = 0;
                this._normals[i*4*3+1] = 0;
                this._normals[i*4*3+2] = -1;

                this._normals[i*4*3+3] = 0;
                this._normals[i*4*3+4] = 0;
                this._normals[i*4*3+5] = -1;

                this._normals[i*4*3+6] = 0;
                this._normals[i*4*3+7] = 0;
                this._normals[i*4*3+8] = -1;

                this._normals[i*4*3+9] = 0;
                this._normals[i*4*3+10] = 0;
                this._normals[i*4*3+11] = -1;

                var uv = this._getUv(char);

                this._uvs[i*4*2+0] = uv[0];
                this._uvs[i*4*2+1] = uv[1];

                this._uvs[i*4*2+2] = uv[2];
                this._uvs[i*4*2+3] = uv[1];

                this._uvs[i*4*2+4] = uv[2];
                this._uvs[i*4*2+5] = uv[3];

                this._uvs[i*4*2+6] = uv[0];
                this._uvs[i*4*2+7] = uv[3];

                this._indices.push((i*4), (i*4)+1, (i*4)+3);
                this._indices.push((i*4)+2, (i*4)+3, (i*4)+1);
            }

            // offset to pivot
            for (var i = 0; i < this._positions.length; i += 3) {
                if (this._pivot === pc.PIVOT_TOP ||
                    this._pivot === pc.PIVOT_CENTER ||
                    this._pivot === pc.PIVOT_BOTTOM) {
                    // center
                    this._positions[i] -= this.width/2;
                } else if (this._pivot === pc.PIVOT_TOPRIGHT ||
                    this._pivot === pc.PIVOT_RIGHT ||
                    this._pivot === pc.PIVOT_BOTTOMRIGHT) {
                    // right format
                    this._positions[i] -= this.width;
                }

                if (this._pivot === pc.PIVOT_LEFT ||
                    this._pivot === pc.PIVOT_CENTER ||
                    this._pivot === pc.PIVOT_RIGHT) {
                    // center
                    this._positions[i+1] -= this.height/2;
                } else if (this._pivot === pc.PIVOT_TOP ||
                    this._pivot === pc.PIVOT_TOPLEFT ||
                    this._pivot === pc.PIVOT_TOPRIGHT) {
                    // top
                    this._positions[i+1] -= this.height;
                }
            }

            // update vertex buffer
            var numVertices = l*4;
            for (var i = 0; i < numVertices; i++) {
                it.element[pc.SEMANTIC_POSITION].set(this._positions[i*3+0], this._positions[i*3+1], this._positions[i*3+2]);
                it.element[pc.SEMANTIC_NORMAL].set(this._normals[i*3+0], this._normals[i*3+1], this._normals[i*3+2]);
                it.element[pc.SEMANTIC_TEXCOORD0].set(this._uvs[i*2+0], this._uvs[i*2+1]);

                it.next();
            }
            it.end();
        },


        _onFontLoad: function (asset) {
            // this._texture = font.texture;
            // this._json = font.data;
            // if (this._texture && this._json) {
            //     this._updateText();
            // }

            this._font = asset.resource;
            if (this._font) {
                this._updateText();
            }
        },

        _onFontChange: function (asset) {

        },

        _onFontRemove: function (asset) {

        },

        _getUv: function (char) {
            var data = this._font.data;
            var width = data.info.width;
            var height = data.info.height;

            var x = data.chars[char].x;
            var y =  data.chars[char].y;

            var x1 = x;
            var y1 = y;
            var x2 = (x + data.chars[char].width);
            var y2 = (y - data.chars[char].height);
            var edge = 1 - (data.chars[char].height / height)
            return [
                x1 / width,
                edge - (y1 / height), // bottom left

                (x2 / width),
                edge - (y2 / height)  // top right
            ];
        },
    });

    Object.defineProperty(TextComponent.prototype, "text", {
        get: function () {
            return this._text
        },

        set: function (value) {
            if (this._font) {
                this._updateText(value);
            }
            // if (this._texture && this._json) {
            //     this._updateText(value);
            // }
            this._text = value;
        }
    });

    Object.defineProperty(TextComponent.prototype, "color", {
        get: function () {
            return this._color;
        },

        set: function (value) {
            this._color = value;
            if (this._meshInstance) {
                this._meshInstance.setParameter('material_foreground', this._color.data);
            }
        }
    });


    Object.defineProperty(TextComponent.prototype, "pivot", {
        get: function () {
            return this._pivot
        },

        set: function (value) {
            var _prev = this._pivot;
            this._pivot = value;
            if (_prev !== value && this._font) {
                this._updateText();
            }
            // if (_prev !== value && this._texture && this._json) {
            //     this._updateText();
            // }
        }
    });

    Object.defineProperty(TextComponent.prototype, "asset", {
        get function () {
            return this._asset;
        },

        set: function (value) {
            var assets = this.system.app.assets;
            var _id = value;

            if (value instanceof pc.Asset) {
                _id = value.id;
            }

            if (this._asset !== _id) {
                if (this._asset) {
                    var _prev = assets.get(this._asset);

                    _prev.off("load", this._onFontLoad, this);
                    _prev.off("change", this._onFontChange, this);
                    _prev.off("remove", this._onFontRemove, this);
                }

                this._asset = _id;
                if (this._asset) {
                    var asset = assets.get(this._asset);

                    asset.on("load", this._onFontLoad, this);
                    asset.on("change", this._onFontChange, this);
                    asset.on("remove", this._onFontRemove, this);

                    if (asset.resource) {
                        this._onFontLoad(asset.resource);
                    } else {
                        assets.load(asset);
                    }

                }
            }
        }
    });

    // Object.defineProperty(TextComponent.prototype, "jsonAsset", {
    //     get: function () {
    //         return this._jsonAsset
    //     },

    //     set: function (value) {
    //         this._jsonAsset = value;
    //         if (value instanceof pc.Asset) {
    //             this._jsonAsset = value.id;
    //         }
    //         if (this._textureAsset && this._jsonAsset) {
    //             this._font.load(this.system.app, this._textureAsset, this._jsonAsset);
    //         }
    //     }
    // });

    // Object.defineProperty(TextComponent.prototype, "textureAsset", {
    //     get: function () {
    //         return this._textureAsset
    //     },

    //     set: function (value) {
    //         this._textureAsset = value;
    //         if (value instanceof pc.Asset) {
    //             this._textureAsset = value.id
    //         }
    //         if (this._textureAsset && this._jsonAsset) {
    //             this._font.load(this.system.app, this._textureAsset, this._jsonAsset);
    //         }
    //     }
    // });

    return {
        TextComponent: TextComponent
    };
}());
