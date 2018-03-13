pc.extend(pc, function () {

    var TextElement = function TextElement (element) {
        this._element = element;
        this._system = element.system;
        this._entity = element.entity;

        // public
        this._text = "";

        this._fontAsset = null;
        this._font = null;

        this._color = new pc.Color(1,1,1,1);

        this._spacing = 1;
        this._fontSize = 32;
        this._lineHeight = 32;

        this._alignment = new pc.Vec2(0.5, 0.5);

        this._autoWidth = true;
        this._autoHeight = true;

        this.width = 0;
        this.height = 0;

        // private
        this._node = new pc.GraphNode();
        this._model = new pc.Model();
        this._model.graph = this._node;
        this._entity.addChild(this._node);

        this._meshInfo = [];
        this._material = null;

        this._noResize = false; // flag used to disable resizing events

        // initialize based on screen
        this._onScreenChange(this._element.screen);

        // start listening for element events
        element.on('resize', this._onParentResize, this);
        this._element.on('set:screen', this._onScreenChange, this);
        element.on('screen:set:screenspace', this._onScreenSpaceChange, this);
        element.on('set:draworder', this._onDrawOrderChange, this);
        element.on('set:pivot', this._onPivotChange, this);
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
            this._element.off('set:pivot', this._onPivotChange, this);
        },

        _onParentResize: function (width, height) {
            if (this._noResize) return;
            if (this._font) this._updateText(this._text);
        },

        _onScreenChange: function (screen) {
            if (screen) {
                this._updateMaterial(screen.screen.screenSpace);
            } else {
                this._updateMaterial(false);
            }
        },

        _onScreenSpaceChange: function (value) {
            this._updateMaterial(value);
        },

        _onDrawOrderChange: function (order) {
            this._drawOrder = order;

            if (this._model) {
                for (var i = 0, len = this._model.meshInstances.length; i<len; i++) {
                    this._model.meshInstances[i].drawOrder = order;
                }
            }
        },

        _onPivotChange: function (pivot) {
            if (this._font)
                this._updateText();
        },

        _updateText: function (text) {
            if (text === undefined) text = this._text;

            var textLength = text.length;
            // handle null string
            if (textLength === 0) {
                textLength = 1;
                text = " ";
            }

            var charactersPerTexture = {};

            for (var i = 0; i<textLength; i++) {
                var code = text.charCodeAt(i);
                var info = this._font.data.chars[code];
                if (! info) continue;

                var map = info.map;

                if (! charactersPerTexture[map])
                    charactersPerTexture[map] = 0;

                charactersPerTexture[map]++;
            }

            var removedModel = ! this._system.app.scene.containsModel(this._model);

            var screenSpace = (this._element.screen && this._element.screen.screen.screenSpace);

            for (var i = 0, len = this._meshInfo.length; i<len; i++) {
                var l = charactersPerTexture[i] || 0;
                var meshInfo = this._meshInfo[i];

                if (meshInfo.count !== l) {
                    if (! removedModel) {
                        this._system.app.scene.removeModel(this._model);
                        removedModel = true;
                    }

                    meshInfo.count = l;
                    meshInfo.positions.length = meshInfo.normals.length = l*3*4;
                    meshInfo.indices.length = l*3*2;
                    meshInfo.uvs.length = l*2*4;

                    // destroy old mesh
                    if (meshInfo.meshInstance) {
                        this._removeMeshInstance(meshInfo.meshInstance);
                    }

                    // if there are no letters for this mesh continue
                    if (l === 0) {
                        meshInfo.meshInstance = null;
                        continue;
                    }

                    // set up indices and normals whose values don't change when we call _updateMeshes
                    for (var v = 0; v < l; v++) {
                        // create index and normal arrays since they don't change
                        // if the length doesn't change
                        meshInfo.indices[v*3*2+0] = v*4;
                        meshInfo.indices[v*3*2+1] = v*4 + 1;
                        meshInfo.indices[v*3*2+2] = v*4 + 3;
                        meshInfo.indices[v*3*2+3] = v*4 + 2;
                        meshInfo.indices[v*3*2+4] = v*4 + 3;
                        meshInfo.indices[v*3*2+5] = v*4 + 1;

                        meshInfo.normals[v*4*3+0] = 0;
                        meshInfo.normals[v*4*3+1] = 0;
                        meshInfo.normals[v*4*3+2] = -1;

                        meshInfo.normals[v*4*3+3] = 0;
                        meshInfo.normals[v*4*3+4] = 0;
                        meshInfo.normals[v*4*3+5] = -1;

                        meshInfo.normals[v*4*3+6] = 0;
                        meshInfo.normals[v*4*3+7] = 0;
                        meshInfo.normals[v*4*3+8] = -1;

                        meshInfo.normals[v*4*3+9] = 0;
                        meshInfo.normals[v*4*3+10] = 0;
                        meshInfo.normals[v*4*3+11] = -1;
                    }

                    var mesh = pc.createMesh(this._system.app.graphicsDevice, meshInfo.positions, {uvs: meshInfo.uvs, normals: meshInfo.normals, indices: meshInfo.indices});

                    var mi = new pc.MeshInstance(this._node, mesh, this._material);
                    mi.castShadow = false;
                    mi.receiveShadow = false;

                    mi.drawOrder = this._drawOrder;
                    if (screenSpace) {
                        mi.layer = pc.scene.LAYER_HUD;
                    }
                    mi.screenSpace = screenSpace;
                    mi.setParameter("texture_msdfMap", this._font.textures[i]);
                    mi.setParameter("material_emissive", this._color.data3);
                    mi.setParameter("material_opacity", this._color.data[3]);
                    mi.setParameter("font_sdfIntensity", this._font.intensity);
                    mi.setParameter("font_pxrange", this._getPxRange(this._font));
                    mi.setParameter("font_textureWidth", this._font.data.info.maps[i].width);

                    meshInfo.meshInstance = mi;

                    this._model.meshInstances.push(mi);
                }
            }

            if (removedModel && this._element.enabled && this._entity.enabled) {
                this._system.app.scene.addModel(this._model);
            }

            this._updateMeshes(text);
        },

        _removeMeshInstance: function (meshInstance) {
            var oldMesh = meshInstance.mesh;
            if (oldMesh) {
                if (oldMesh.vertexBuffer) {
                    oldMesh.vertexBuffer.destroy();
                }
                if (oldMesh.indexBuffer) {
                    for (var ib = 0, iblen = oldMesh.indexBuffer.length; ib<iblen; ib++)
                        oldMesh.indexBuffer[ib].destroy();
                }
            }

            var idx = this._model.meshInstances.indexOf(meshInstance);
            if (idx !== -1)
                this._model.meshInstances.splice(idx, 1);
        },

        _updateMaterial: function (screenSpace) {
            var layer;

            if (screenSpace) {
                this._material = this._system.defaultScreenSpaceTextMaterial;
                layer = pc.scene.LAYER_HUD;
            } else {
                this._material = this._system.defaultTextMaterial;
                layer = pc.scene.LAYER_WORLD;
            }

            if (this._model) {
                for (var i = 0, len = this._model.meshInstances.length; i<len; i++) {
                    var mi = this._model.meshInstances[i];
                    mi.layer = layer;
                    mi.material = this._material;
                    mi.screenSpace = screenSpace;
                }
            }
        },

        _updateMeshes: function (text) {
            var json = this._font.data;

            this.width = 0;
            this.height = 0;
            var lineWidths = [];

            var l = text.length;
            var _x = 0; // cursors
            var _y = 0;
            var _z = 0;

            var lines = 1;

            // todo: move this into font asset?
            // calculate max font extents from all available chars
            var fontMinY = 0;
            var fontMaxY = 0;
            var scale = 1;
            var MAGIC = 32;

            var char, data, i;

            // TODO: Optimize this as it loops through all the chars in the asset
            // every time the text changes...
            for (char in json.chars) {
                data = json.chars[char];
                scale = (data.height / MAGIC) * this._fontSize / data.height;
                if (data.bounds) {
                    fontMinY = Math.min(fontMinY, data.bounds[1] * scale);
                    fontMaxY = Math.max(fontMaxY, data.bounds[3] * scale);
                }
            }

            for (i = 0; i < this._meshInfo.length; i++) {
                this._meshInfo[i].quad = 0;
                this._meshInfo[i].lines = {};
            }

            for (i = 0; i < l; i++) {
                char = text.charCodeAt(i);

                if (char === 10 || char === 13) {
                    // add forced line-break
                    _y -= this._lineHeight;
                    _x = 0;
                    lines++;
                    lineWidths.push(0);
                    continue;
                }

                lineWidths[lines-1] = 0;

                var x = 0;
                var y = 0;
                var advance = 0;
                var quadsize = 1;
                var glyphMinX = 0;
                var glyphWidth = 0;

                data = json.chars[char];
                if (data && data.scale) {
                    var size = (data.width + data.height) / 2;
                    scale = (size/MAGIC) * this._fontSize / size;
                    quadsize = (size/MAGIC) * this._fontSize / data.scale;
                    advance = data.xadvance * scale;
                    x = data.xoffset * scale;
                    y = data.yoffset * scale;

                    if (data.bounds) {
                        glyphWidth = (data.bounds[2] - data.bounds[0]) * scale;
                        glyphMinX = data.bounds[0] * scale;
                    } else {
                        glyphWidth = x;
                        glyphMinX = 0;
                    }
                } else {
                    // missing character
                    advance = 1;
                    x = 0;
                    y = 0;
                    quadsize = this._fontSize;
                }

                var meshInfo = this._meshInfo[(data && data.map) || 0];
                var quad = meshInfo.quad;
                meshInfo.lines[lines-1] = quad;

                meshInfo.positions[quad*4*3+0] = _x - x;
                meshInfo.positions[quad*4*3+1] = _y - y;
                meshInfo.positions[quad*4*3+2] = _z;

                meshInfo.positions[quad*4*3+3] = _x - x + quadsize;
                meshInfo.positions[quad*4*3+4] = _y - y;
                meshInfo.positions[quad*4*3+5] = _z;

                meshInfo.positions[quad*4*3+6] = _x - x + quadsize;
                meshInfo.positions[quad*4*3+7] = _y - y + quadsize;
                meshInfo.positions[quad*4*3+8] = _z;

                meshInfo.positions[quad*4*3+9]  = _x - x;
                meshInfo.positions[quad*4*3+10] = _y - y + quadsize;
                meshInfo.positions[quad*4*3+11] = _z;


                this.width = Math.max(this.width, _x + glyphWidth + glyphMinX);
                lineWidths[lines-1] = Math.max(lineWidths[lines-1], _x + glyphWidth + glyphMinX);
                this.height = Math.max(this.height, fontMaxY - (_y+fontMinY));

                // advance cursor
                _x = _x + (this._spacing*advance);

                var uv = this._getUv(char);

                meshInfo.uvs[quad*4*2+0] = uv[0];
                meshInfo.uvs[quad*4*2+1] = uv[1];

                meshInfo.uvs[quad*4*2+2] = uv[2];
                meshInfo.uvs[quad*4*2+3] = uv[1];

                meshInfo.uvs[quad*4*2+4] = uv[2];
                meshInfo.uvs[quad*4*2+5] = uv[3];

                meshInfo.uvs[quad*4*2+6] = uv[0];
                meshInfo.uvs[quad*4*2+7] = uv[3];

                meshInfo.quad++;
            }

            // force autoWidth / autoHeight change to update width/height of element
            this._noResize = true;
            this.autoWidth = this._autoWidth;
            this.autoHeight = this._autoHeight;
            this._noResize = false;

            // offset for pivot and alignment
            var hp = this._element.pivot.data[0];
            var vp = this._element.pivot.data[1];
            var ha = this._alignment.x;
            var va = this._alignment.y;

            for (i = 0; i < this._meshInfo.length; i++) {
                if (this._meshInfo[i].count === 0) continue;

                var prevQuad = 0;
                for (var line in this._meshInfo[i].lines) {
                    var index = this._meshInfo[i].lines[line];
                    var hoffset = - hp * this._element.width + ha * (this._element.width - lineWidths[parseInt(line,10)]);
                    var voffset = (1 - vp) * this._element.height - fontMaxY - (1 - va) * (this._element.height - this.height);

                    for (var quad = prevQuad; quad <= index; quad++) {
                        this._meshInfo[i].positions[quad*4*3] += hoffset;
                        this._meshInfo[i].positions[quad*4*3 + 3] += hoffset;
                        this._meshInfo[i].positions[quad*4*3 + 6] += hoffset;
                        this._meshInfo[i].positions[quad*4*3 + 9] += hoffset;

                        this._meshInfo[i].positions[quad*4*3 + 1] += voffset;
                        this._meshInfo[i].positions[quad*4*3 + 4] += voffset;
                        this._meshInfo[i].positions[quad*4*3 + 7] += voffset;
                        this._meshInfo[i].positions[quad*4*3 + 10] += voffset;
                    }

                    prevQuad = index + 1;
                }

                // update vertex buffer
                var numVertices = this._meshInfo[i].quad*4;
                var it = new pc.VertexIterator(this._meshInfo[i].meshInstance.mesh.vertexBuffer);
                for (var v = 0; v < numVertices; v++) {
                    it.element[pc.SEMANTIC_POSITION].set(this._meshInfo[i].positions[v*3+0], this._meshInfo[i].positions[v*3+1], this._meshInfo[i].positions[v*3+2]);
                    it.element[pc.SEMANTIC_TEXCOORD0].set(this._meshInfo[i].uvs[v*2+0], this._meshInfo[i].uvs[v*2+1]);
                    it.next();
                }
                it.end();

                this._meshInfo[i].meshInstance.mesh.aabb.compute(this._meshInfo[i].positions);

                // force update meshInstance aabb
                this._meshInfo[i].meshInstance._aabbVer = -1;
            }
        },

        _onFontAdded: function (asset) {
            this._system.app.assets.off('add:' + asset.id, this._onFontAdded, this);

            if (asset.id === this._fontAsset) {
                this._bindFont(asset);
            }
        },

        _bindFont: function (asset) {
            asset.on("load", this._onFontLoad, this);
            asset.on("change", this._onFontChange, this);
            asset.on("remove", this._onFontRemove, this);

            if (asset.resource) {
                this._onFontLoad(asset);
            } else {
                this._system.app.assets.load(asset);
            }
        },

        _onFontLoad: function (asset) {
            if (this.font !== asset.resource) {
                this.font = asset.resource;
            }
        },

        _onFontChange: function (asset, name, _new, _old) {
            if (name === 'data') {
                this._font.data = _new;

                var maps = this._font.data.info.maps.length;
                for (var i = 0; i<maps; i++) {
                    if (! this._meshInfo[i]) continue;

                    var mi = this._meshInfo[i].meshInstance;
                    if (mi) {
                        mi.setParameter("font_sdfIntensity", this._font.intensity);
                        mi.setParameter("font_pxrange", this._getPxRange(this._font));
                        mi.setParameter("font_textureWidth", this._font.data.info.maps[i].width);
                    }
                }
            }
        },

        _onFontRemove: function (asset) {

        },

        _getPxRange: function (font) {
            // calculate pxrange from range and scale properties on a character
            var keys = Object.keys(this._font.data.chars);
            for (var i = 0; i < keys.length; i++) {
                var char = this._font.data.chars[keys[i]];
                if (char.scale && char.range) {
                    return char.scale * char.range;
                }
            }
            return 2; // default
        },

        _getUv: function (char) {
            var data = this._font.data;

            if (!data.chars[char]) {
                // missing char - return "space" if we have it
                if (data.chars[32]) {
                    return this._getUv(32);
                }
                // otherwise - missing char
                return [0,0,1,1];
            }

            var map = data.chars[char].map;
            var width = data.info.maps[map].width;
            var height = data.info.maps[map].height;

            var x = data.chars[char].x;
            var y =  data.chars[char].y;

            var x1 = x;
            var y1 = y;
            var x2 = (x + data.chars[char].width);
            var y2 = (y - data.chars[char].height);
            var edge = 1 - (data.chars[char].height / height);
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
            return this._text;
        },

        set: function (value) {
            var str = value.toString();
            if (this._text !== str) {
                if (this._font) {
                    this._updateText(str);
                }
                this._text = str;
            }
        }
    });

    Object.defineProperty(TextElement.prototype, "color", {
        get: function () {
            return this._color;
        },

        set: function (value) {
            this._color.data[0] = value.data[0];
            this._color.data[1] = value.data[1];
            this._color.data[2] = value.data[2];

            if (this._model) {
                for (var i = 0, len = this._model.meshInstances.length; i<len; i++) {
                    var mi = this._model.meshInstances[i];
                    mi.setParameter('material_emissive', this._color.data3);
                }
            }
        }
    });

    Object.defineProperty(TextElement.prototype, "opacity", {
        get: function () {
            return this._color.data[3];
        },

        set: function (value) {
            this._color.data[3] = value;

            if (this._model) {
                for (var i = 0, len = this._model.meshInstances.length; i<len; i++) {
                    var mi = this._model.meshInstances[i];
                    mi.setParameter('material_opacity', value);
                }
            }
        }
    });

    Object.defineProperty(TextElement.prototype, "lineHeight", {
        get: function () {
            return this._lineHeight;
        },

        set: function (value) {
            var _prev = this._lineHeight;
            this._lineHeight = value;
            if (_prev !== value && this._font) {
                this._updateText();
            }
        }
    });

    Object.defineProperty(TextElement.prototype, "spacing", {
        get: function () {
            return this._spacing;
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

                    if (_prev) {
                        _prev.off("load", this._onFontLoad, this);
                        _prev.off("change", this._onFontChange, this);
                        _prev.off("remove", this._onFontRemove, this);
                    }
                }

                this._fontAsset = _id;
                if (this._fontAsset) {
                    var asset = assets.get(this._fontAsset);
                    if (! asset) {
                        assets.on('add:' + this._fontAsset, this._onFontAdded, this);
                    } else {
                        this._bindFont(asset);
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
            if (! value) return;

            // make sure we have as many meshInfo entries
            // as the number of font textures
            for (var i = 0, len = this._font.textures.length; i<len; i++) {
                if (! this._meshInfo[i]) {
                    this._meshInfo[i] = {
                        count: 0,
                        quad: 0,
                        lines: {},
                        positions: [],
                        normals: [],
                        uvs: [],
                        indices: [],
                        meshInstance: null
                    };
                } else {
                    // keep existing entry but set correct parameters to mesh instance
                    var mi = this._meshInfo[i].meshInstance;
                    if (mi) {
                        mi.setParameter("font_sdfIntensity", this._font.intensity);
                        mi.setParameter("font_pxrange", this._getPxRange(this._font));
                        mi.setParameter("font_textureWidth", this._font.data.info.maps[i].width);
                        mi.setParameter("texture_msdfMap", this._font.textures[i]);
                    }
                }
            }

            // destroy any excess mesh instances
            var removedModel = false;
            for (var i = this._font.textures.length; i < this._meshInfo.length; i++) {
                if (this._meshInfo[i].meshInstance) {
                    if (! removedModel) {
                        // remove model from scene so that excess mesh instances are removed
                        // from the scene as well
                        this._system.app.scene.removeModel(this._model);
                        removedModel = true;
                    }
                    this._removeMeshInstance(this._meshInfo[i].meshInstance);
                }
            }

            if (this._meshInfo.length > this._font.textures.length)
                this._meshInfo.length = this._font.textures.length;

            this._updateText();
        }
    });

    Object.defineProperty(TextElement.prototype, "alignment", {
        get: function () {
            return this._alignment;
        },

        set: function (value) {
            if (value instanceof pc.Vec2) {
                this._alignment.set(value.x, value.y);
            } else {
                this._alignment.set(value[0], value[1]);
            }

            if (this._font)
                this._updateText();
        }
    });

    Object.defineProperty(TextElement.prototype, "autoWidth", {
        get: function () {
            return this._autoWidth;
        },

        set: function (value) {
            this._autoWidth = value;
            if (value) {
                this._element.width = this.width;
            }
        }
    });

    Object.defineProperty(TextElement.prototype, "autoHeight", {
        get: function () {
            return this._autoHeight;
        },

        set: function (value) {
            this._autoHeight = value;
            if (value) {
                this._element.height = this.height;
            }
        }
    });

    return {
        TextElement: TextElement
    };
}());

