pc.extend(pc, function () {
    var TextElement = function TextElement (element) {
        this._element = element;
        this._system = element.system;
        this._entity = element.entity;

        // public
        this._text = "";

        this._fontAsset = null;
        this._font = null;

        this._color = new pc.Color();

        this._spacing = 1;
        this._fontSize = 32;
        this._lineHeight = 32;

        this.width = 0;
        this.height = 0;

        // private
        this._node = new pc.GraphNode();
        this._model = null;
        this._mesh = null;
        this._meshInstance = null;
        this._material = null;

        this._positions = [];
        this._normals = [];
        this._uvs = [];
        this._indices = [];

        this._noResize = false; // flag used to disable resizing events

        // initialize based on screen
        this._onScreenChange(this._element.screen);

        // start listening for element events
        element.on('resize', this._onParentResize, this);
        this._element.on('set:screen', this._onScreenChange, this);
        element.on('screen:set:screenspace', this._onScreenSpaceChange, this);
        element.on('set:draworder', this._onDrawOrderChange, this);
    };

    pc.extend(TextElement.prototype, {
        destroy: function () {
            if (this._model) {
                this._system.app.scene.removeModel(this._model);
                this._model.destroy();
                this._model = null;
            }

            this._element.off('resize', this._onParentResize, this);
            this._element.off('set:screen', this._onScreenChange, this);
            this._element.off('screen:set:screenspace', this._onScreenSpaceChange, this);
            this._element.off('set:draworder', this._onDrawOrderChange, this);
        },

        _onParentResize: function (width, height) {
            if (this._noResize) return;
            if (this._font) this._updateText(this._text);
        },

        _onScreenChange: function (screen) {
            if (screen) {
                this._updateMaterial(screen.screen.screenSpace);
                this._node.setLocalEulerAngles(0,0,0);
            } else {
                this._updateMaterial(false);
                this._node.setLocalEulerAngles(0,180,0);
            }
        },

        _onScreenSpaceChange: function (value) {
            this._updateMaterial(value);
        },

        _onDrawOrderChange: function (order) {
            this._drawOrder = order;
            if (this._meshInstance) {
                this._meshInstance.drawOrder = order;
            }
        },

        _updateText: function (text) {
            if (text === undefined) text = this._text;

            if (!this._mesh || text.length !== this._text.length) {

                if (this._mesh) {
                    // remove model from scene
                    this._system.app.scene.removeModel(this._model);

                    // destroy old mesh
                    this._mesh.vertexBuffer.destroy();
                    for (var i = 0; i < this._mesh.indexBuffer.length; i++) {
                        this._mesh.indexBuffer[i].destroy()
                    }

                    this._model = null;
                    this._mesh = null;
                    this._meshInstance = null;
                }

                var screenSpace = (this._element.screen && this._element.screen.screen.screenSpace);

                this._updateMaterial(screenSpace);

                this._mesh = this._createMesh(text);

                if (this._node.getParent()) {
                    this._node.getParent().removeChild(this._node);
                }

                this._model = new pc.Model();
                this._model.graph = this._node;
                this._meshInstance = new pc.MeshInstance(this._node, this._mesh, this._material);
                this._model.meshInstances.push(this._meshInstance);

                this._meshInstance.drawOrder = this._drawOrder;
                if (screenSpace) this._meshInstance.layer = pc.scene.LAYER_HUD;
                this._meshInstance.setParameter("texture_msdfMap", this._font.texture);
                this._meshInstance.setParameter("material_emissive", this._color.data3);
                this._meshInstance.setParameter("material_opacity", this._color.data[3]);

                // add model to sceen
                if (this._entity.enabled) {
                    this._system.app.scene.addModel(this._model);
                }
                this._entity.addChild(this._model.graph);
                this._model._entity = this._entity;
            } else {
                this._updateMesh(this._mesh, text);
            }
        },

        _updateMaterial: function (screenSpace) {
            if (screenSpace) {
                this._material = this._system.defaultScreenSpaceTextMaterial;
                if (this._meshInstance) this._meshInstance.layer = pc.scene.LAYER_HUD;
            } else {
                this._material = this._system.defaultTextMaterial;
                if (this._meshInstance) this._meshInstance.layer = pc.scene.LAYER_WORLD;
            }
            if (this._meshInstance) this._meshInstance.material = this._material;
        },

        // build the mesh for the text
        _createMesh: function (text) {
            var l = text.length;

            // handle null string
            if (l === 0) {
                l = 1;
                text = " ";
            }

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

            var mesh = pc.createMesh(this._system.app.graphicsDevice, this._positions, {uvs: this._uvs, normals: this._normals, indices: this._indices});
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

            var miny = Number.MAX_VALUE;
            var maxy = Number.MIN_VALUE;

            var lastWordIndex = 0;
            var lastSoftBreak = 0;

            var lines = 1;
            for (var i = 0; i < l; i++) {
                var char = text.charCodeAt(i);

                if (char === 10 || char === 13) {
                    // add forced line-break
                    _y -= this._lineHeight;
                    _x = 0;
                    lastWordIndex = i;
                    lastSoftBreak = i;
                    lines++;
                    continue;
                }

                if (char === 32) {
                    // space
                    lastWordIndex = i+1;
                }

                var x = 0;
                var y = 0;
                var advance = 0;
                var scale = 1;

                var data = json.chars[char];
                if (data && data.scale) {
                    scale = this._fontSize / data.scale;
                    advance = this._fontSize * data.xadvance / data.width;
                    x = this._fontSize * data.xoffset / data.width;
                    y = this._fontSize * data.yoffset / data.height;
                } else {
                    // missing character
                    advance = 0.5;
                    x = 0;
                    y = 0;
                    scale = this._fontSize;
                }

                this._positions[i*4*3+0] = _x - x;
                this._positions[i*4*3+1] = _y - y;
                this._positions[i*4*3+2] = _z;

                this._positions[i*4*3+3] = _x - (x - scale);
                this._positions[i*4*3+4] = _y - y;
                this._positions[i*4*3+5] = _z;

                this._positions[i*4*3+6] = _x - (x - scale);
                this._positions[i*4*3+7] = _y - y + scale;
                this._positions[i*4*3+8] = _z;

                this._positions[i*4*3+9]  = _x - x;
                this._positions[i*4*3+10] = _y - y + scale;
                this._positions[i*4*3+11] = _z;

                this.width = _x - (x - scale);

                if (this._positions[i*4*3+7] > maxy) maxy = this._positions[i*4*3+7];
                if (this._positions[i*4*3+1] < miny) miny = this._positions[i*4*3+1];
                this.height = maxy - miny;

                // advance cursor
                _x = _x + (this._spacing*advance);

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

            // offset for pivot
            var hp = this._element.pivot.data[0];
            var vp = this._element.pivot.data[1];

            for (var i = 0; i < this._positions.length; i += 3) {
                this._positions[i] -= hp*this.width;
                // this._positions[i+1] += (vp-1) + (lines*this._lineHeight*vp);
                this._positions[i+1] += (((1-vp)*lines)-1)*this._lineHeight;
            }

            // update width/height of element
            this._noResize = true;
            this._element.width = this.width;
            this._element.height = this.height;
            this._noResize = false;

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
            if (this.font !== asset.resource) {
                this.font = asset.resource;
                if (this._font) {
                    this._updateText();
                }
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

            if (!data.chars[char]) {
                // missing char
                return [0,0,1,1]
            }

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

    Object.defineProperty(TextElement.prototype, "text", {
        get: function () {
            return this._text
        },

        set: function (value) {
            var str = value.toString();
            if (this._font) {
                this._updateText(str);
            }
            this._text = str;

        }
    });

    Object.defineProperty(TextElement.prototype, "color", {
        get: function () {
            return this._color;
        },

        set: function (value) {
            this._color = value;
            if (this._meshInstance) {
                this._meshInstance.setParameter('material_emissive', this._color.data3);
                this._meshInstance.setParameter('material_opacity', this._color.data[3]);
            }
        }
    });

    Object.defineProperty(TextElement.prototype, "lineHeight", {
        get: function () {
            return this._lineHeight
        },

        set: function (value) {
            var _prev = this._lineHeight
            this._lineHeight = value;
            if (_prev !== value && this._font) {
                this._updateText();
            }
        }
    });

    Object.defineProperty(TextElement.prototype, "spacing", {
        get: function () {
            return this._spacing
        },

        set: function (value) {
            var _prev = this._spacing;
            this._spacing = value;
            if (_prev !== value && this._font) {
                this._updateText();
            }
        }
    });

    Object.defineProperty(TextElement.prototype, "fontSize", {
        get: function () {
            return this._fontSize;
        },

        set: function (value) {
            var _prev = this._fontSize;
            this._fontSize = value;
            if (_prev !== value && this._font) {
                this._updateText();
            }
        }
    });

    Object.defineProperty(TextElement.prototype, "fontAsset", {
        get function () {
            return this._fontAsset;
        },

        set: function (value) {
            var assets = this._system.app.assets;
            var _id = value;

            if (value instanceof pc.Asset) {
                _id = value.id;
            }

            if (this._fontAsset !== _id) {
                if (this._fontAsset) {
                    var _prev = assets.get(this._fontAsset);

                    _prev.off("load", this._onFontLoad, this);
                    _prev.off("change", this._onFontChange, this);
                    _prev.off("remove", this._onFontRemove, this);
                }

                this._fontAsset = _id;
                if (this._fontAsset) {
                    var asset = assets.get(this._fontAsset);

                    asset.on("load", this._onFontLoad, this);
                    asset.on("change", this._onFontChange, this);
                    asset.on("remove", this._onFontRemove, this);

                    if (asset.resource) {
                        this._onFontLoad(asset);
                    } else {
                        assets.load(asset);
                    }

                }
            }
        }
    });

    Object.defineProperty(TextElement.prototype, "font", {
        get: function () {
            return this._font;
        },

        set: function (value) {
            this._font = value;
        }
    });

    return {
        TextElement: TextElement
    };
}());

