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
        this._textureAsset = null;
        this._jsonAsset = null;
        this._font = new pc.BitmapFont();
        this._font.on("load", this._onFontLoad, this);
        this._color = new pc.Color();
        this._pivot = pc.PIVOT_CENTER;

        // private
        this._texture = null;
        this._json = null;
        this._node = null;
        this._model = null;
        this._mesh = null;
        this._meshInstance = null;
    };
    TextComponent = pc.inherits(TextComponent, pc.Component);


    pc.extend(TextComponent.prototype, {
        updateText: function () {
            this._mesh = this._createMesh(this._text, this._json);

            this._node = new pc.GraphNode();
            this._model = new pc.Model();
            this._model.graph = this._node;
            this._meshInstance = new pc.MeshInstance(this._node, this._mesh, this.system.material);
            this._model.meshInstances.push(this._meshInstance);

            this._meshInstance.setParameter("texture_atlas", this._texture);
            this._meshInstance.setParameter("material_foreground", this._color.data);

            // Temporary create a model component...
            if (!this.entity.model) {
                this.entity.addComponent("model");
            }
            this.entity.model.model = this._model;
        },

        // build the mesh for the text
        _createMesh: function (text, json) {
            var positions = [];
            var uvs = [];
            var normals = [];
            var indices = [];

            var width = 0;
            var height = 0;

            var l = text.length;
            var _x = 0; // cursors
            var _y = 0;
            var _z = 0;
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

                positions.push(_x + x,         _y - y,          _z);
                positions.push(_x + x - scale, _y - y,          _z);
                positions.push(_x + x - scale, _y - y + scale,  _z);
                positions.push(_x + x,         _y - y + scale,  _z);

                width = _x + x - scale;
                height = _y - y + scale;

                // advance cursor
                _x = _x - advance;

                normals.push(0, 0, -1);
                normals.push(0, 0, -1);
                normals.push(0, 0, -1);
                normals.push(0, 0, -1);

                var uv = this._getUv(char);
                uvs.push(uv[0], uv[1]);
                uvs.push(uv[2], uv[1]);
                uvs.push(uv[2], uv[3]);
                uvs.push(uv[0], uv[3]);

                indices.push((i*4), (i*4)+1, (i*4)+3);
                indices.push((i*4)+2, (i*4)+3, (i*4)+1);
            }

            // offset to pivot
            for (var i = 0; i < positions.length; i += 3) {
                if (this._pivot === pc.PIVOT_TOP ||
                    this._pivot === pc.PIVOT_CENTER ||
                    this._pivot === pc.PIVOT_BOTTOM) {
                    // center
                    positions[i] -= width/2;
                } else if (this._pivot === pc.PIVOT_TOPRIGHT ||
                    this._pivot === pc.PIVOT_RIGHT ||
                    this._pivot === pc.PIVOT_BOTTOMRIGHT) {
                    // right format
                    positions[i] -= width;
                }

                if (this._pivot === pc.PIVOT_LEFT ||
                    this._pivot === pc.PIVOT_CENTER ||
                    this._pivot === pc.PIVOT_RIGHT) {
                    // center
                    positions[i+1] -= height/2;
                } else if (this._pivot === pc.PIVOT_TOP ||
                    this._pivot === pc.PIVOT_TOPLEFT ||
                    this._pivot === pc.PIVOT_TOPRIGHT) {
                    // top
                    positions[i+1] -= height;
                }
            }

            return pc.createMesh(this.system.app.graphicsDevice, positions, {uvs: uvs, normals: normals, indices: indices});
        },

        _onFontLoad: function (font) {
            this._texture = font.texture;
            this._json = font.data;
            if (this._texture && this._json) {
                this.updateText();
            }
        },

        _getUv: function (char) {
            var width = this._json.info.width;
            var height = this._json.info.height;


            var x = this._json.chars[char].x;
            var y =  this._json.chars[char].y;

            var x1 = x;
            var y1 = y;
            var x2 = (x + this._json.chars[char].width);
            var y2 = (y - this._json.chars[char].height);
            var edge = 1 - (this._json.chars[char].height / height)
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
            this._text = value;
            if (this._texture && this._json) {
                this.updateText();
            }
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
            if (_prev !== value && this._texture && this._json) {
                this.updateText();
            }
        }
    });

    Object.defineProperty(TextComponent.prototype, "jsonAsset", {
        get: function () {
            return this._jsonAsset
        },

        set: function (value) {
            this._jsonAsset = value;
            if (value instanceof pc.Asset) {
                this._jsonAsset = value.id;
            }
            if (this._textureAsset && this._jsonAsset) {
                this._font.load(this.system.app, this._textureAsset, this._jsonAsset);
            }
        }
    });

    Object.defineProperty(TextComponent.prototype, "textureAsset", {
        get: function () {
            return this._textureAsset
        },

        set: function (value) {
            this._textureAsset = value;
            if (value instanceof pc.Asset) {
                this._textureAsset = value.id
            }
            if (this._textureAsset && this._jsonAsset) {
                this._font.load(this.system.app, this._textureAsset, this._jsonAsset);
            }
        }
    });

    return {
        TextComponent: TextComponent
    };
}());
