pc.extend(pc, function () {
    pc.ALIGN_LEFT = 'left';
    pc.ALIGN_RIGHT = 'right';
    pc.ALIGN_CENTER = 'center';

    pc.ALIGN_TOP = 'top';
    pc.ALIGN_MIDDLE = 'middle';
    pc.ALIGN_BASELINE = 'baseline';
    pc.ALIGN_BOTTOM = 'bottom';

    var TextComponent = function TextComponent (system, entity) {
        // public
        this._text = "";

        this._asset = null;
        this._font = null;

        this._color = new pc.Color();

        this._hAlign = pc.ALIGN_LEFT;
        this._vAlign = pc.ALIGN_TOP;

        this._hAnchor = pc.ALIGN_LEFT;
        this._vAnchor = pc.ALIGN_TOP;

        this._lineHeight = 1.2;
        this._spacing = 1;

        this.width = 0;
        this.height = 0;

        this._maxWidth = null;

        this._screenSpace = false;

        // private
        this._node = null;
        this._model = null;
        this._mesh = null;
        this._meshInstance = null;

        this._positions = [];
        this._normals = [];
        this._uvs = [];
        this._indices = [];

        this._modelMat = new pc.Mat4();
        this._projMat = new pc.Mat4();
        this._modelProjMat = new pc.Mat4();

        // update transform if it has changed
        // this.entity.on('sync', function () {
        //     if (this._meshInstance) {
        //         this._updateModelProjection();
        //     }
        // }, this);

        this.system.app.graphicsDevice.on("resizecanvas", function (width, height) {
            if (this._meshInstance) {
                this._updateModelProjection();
            }
        }, this);
    };
    TextComponent = pc.inherits(TextComponent, pc.Component);


    pc.extend(TextComponent.prototype, {
        _updateText: function (text) {
            if (!text) text = this._text;

            if (!this._mesh || text.length !== this._text.length) {
                var material = this._screenSpace ? this.system.material2d : this.system.material;
                this._mesh = this._createMesh(text);

                this._node = new pc.GraphNode();
                this._model = new pc.Model();
                this._model.graph = this._node;
                this._meshInstance = new pc.MeshInstance(this._node, this._mesh, material);
                this._model.meshInstances.push(this._meshInstance);

                this._meshInstance.setParameter("texture_atlas", this._font.texture);
                this._meshInstance.setParameter("material_foreground", this._color.data);

                if(this._screenSpace) {
                    this._updateModelProjection();
                } else {
                    this._updateWorldTransform();
                }

                // add model to sceen
                this.system.app.scene.addModel(this._model);
                this.entity.addChild(this._model.graph);
                this._model._entity = this.entity;

            } else {
                this._updateMesh(this._mesh, text);
            }
        },

        _updateModelProjection: function () {
            this._modelMat.copy(this.entity.worldTransform);

            var w = this.system.resolution[0]/32;
            var h = this.system.resolution[1]/32;

            var left;
            var right;
            var bottom;
            var top;
            var near = 2;
            var far = 0;
            var xscale = -1/32;
            var yscale = -1/32;

            if (this._hAnchor === pc.ALIGN_LEFT) {
                left = 0;
                right = -w;
                xscale = -1/32;
            } else if (this._hAnchor === pc.ALIGN_RIGHT) {
                left = w;
                right = 0;
                xscale = 1/32;
            } else {
                left = w/2;
                right = -w/2;
                xscale = -1/32;
            }

            if (this._vAnchor === pc.ALIGN_TOP) {
                bottom = -h;
                top = 0;
                yscale = -1/32;
            } else if (this._vAnchor === pc.ALIGN_BOTTOM) {
                bottom = 0;
                top = h;
                yscale = 1/32;
            } else {
                bottom = -h/2;
                top = h/2;
                yscale = -1/32;
            }
            this._projMat.setOrtho(left, right, bottom, top, near, far);

            this._modelMat.data[12] *= xscale;
            this._modelMat.data[13] *= yscale;

            this._modelProjMat.copy(this._projMat).mul(this._modelMat);
            this._meshInstance.setParameter('uProjection2d', this._modelProjMat.data);
        },

        _updateWorldTransform: function () {
            var transform = new pc.Mat4();
            var translate = new pc.Mat4();

            var lt = this.entity.localTransform;

            var pwt = this.entity.getParent().getWorldTransform();

            var resolution = [640,320];

            var w = resolution[0];
            var h = resolution[1];
            var tx = 0, ty = 0;
            if (this._hAnchor === pc.ALIGN_LEFT) {
                tx = w/2;
                // lt.data[12] =
            } else if (this._hAnchor === pc.ALIGN_RIGHT) {
                tx = -w/2;
            }
            if (this._vAnchor === pc.ALIGN_TOP) {
                ty = h/2;
            } else if (this._vAnchor === pc.ALIGN_BOTTOM) {
                ty = -h/2;
            }

            var scale = new pc.Vec3(1/w, 1/h, 1);
            transform.setTRS(new pc.Vec3(tx, ty, 0), new pc.Quat(), scale);
            // translate.setTranslate(tx, ty, 0);
            // translate.setTRS(new pc.Vec3(tx, ty, 0), new pc.Quat(), new pc.Vec3(1/w, 1/h, 1));

            // transform.copy(this.entity.localTransform);
            // transform.data[12] *= 1/resolution[0];
            // transform.data[13] *= 1/resolution[1];

            // translate.setTranslate(w/2, h/2, 0); // top left
            // translate.setTranslate(w/2, -h/2, 0); // bottom left
            // translate.setTranslate(-w/2, -h/2, 0); // bottom right
            // translate.setTranslate(-w/2, h/2, 0); // top right

            // lt.data[12] = -w + lt.data[12]/32;
            // lt.data[13] = -h + lt.data[13]/32;

            // transform.data[12]
            // translate.setTRS(new pc.Vec3(w/2,h/2,0), new pc.Quat(), new pc.Vec3(-1,-1,1));

            // transform.setScale(1 / w, 1 / h, 1);
            // transform.mul2(pwt, transform);

            // this.entity.worldTransform.mul2(transform, this.entity.localTransform).mul(translate);
            var lt = new pc.Mat4().copy(this.entity.localTransform).mul(transform);
            this.entity.worldTransform.mul2(pwt, lt);//.mul(transform);

            this.entity.dirtyWorld = false;
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

            var lineHeight = this._lineHeight * this._font.em;

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

            var lines = 0;
            for (var i = 0; i < l; i++) {
                var char = text.charCodeAt(i);

                if (char === 10 || char === 13) {
                    // add forced line-break
                    _y -= lineHeight;
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
                    scale = 1 / data.scale;
                    advance = data.xadvance / data.width;
                    x = data.xoffset / data.width;
                    y = data.yoffset / data.height;
                } else {
                    // missing character
                    advance = 0.5;
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

                this.width = -(_x + x - scale);

                // if (this.maxWidth && this.width > this.maxWidth) {
                //     // wrap line
                //     if (lastSoftBreak !== i) {
                //         lastSoftBreak = i;

                //         // new line
                //         _y -= lineHeight;
                //         _x = 0;
                //         lines++;


                //         // reset and redo last word
                //         i = lastWordIndex-1;
                //         //lastWordIndex = 0;

                //         this.width = 0;
                //         continue;
                //     } else {
                //         lastSoftBreak = i;
                //     }
                // }

                if (this._positions[i*4*3+7] > maxy) maxy = this._positions[i*4*3+7];
                if (this._positions[i*4*3+1] < miny) miny = this._positions[i*4*3+1];
                this.height = maxy - miny;

                // advance cursor
                _x = _x - (this._spacing*advance);

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

            // offset for alignment
            for (var i = 0; i < this._positions.length; i += 3) {
                width = this.maxWidth ? this.maxWidth : this.width;
                if (this._hAlign === pc.ALIGN_CENTER) {
                    this._positions[i] += width/2;
                } else if (this._hAlign === pc.ALIGN_RIGHT) {
                    this._positions[i] += width;
                }

                if (this._vAlign === pc.ALIGN_BOTTOM) {
                    this._positions[i+1] += lines*lineHeight;
                } else if (this._vAlign === pc.ALIGN_MIDDLE) {
                    this._positions[i+1] += (this.height/2 - this.font.em);
                } else if (this._vAlign === pc.ALIGN_TOP) {
                    this._positions[i+1] -= this.font.em;
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
            this.font = asset.resource;
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
    });

    Object.defineProperty(TextComponent.prototype, "text", {
        get: function () {
            return this._text
        },

        set: function (value) {
            if (this._font) {
                this._updateText(value);
            }
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

    Object.defineProperty(TextComponent.prototype, "hAlign", {
        get: function () {
            return this._hAlign
        },

        set: function (value) {
            var _prev = this._hAlign;
            this._hAlign = value;
            if (_prev !== value && this._font) {
                this._updateText();
            }
        }
    });

    Object.defineProperty(TextComponent.prototype, "vAlign", {
        get: function () {
            return this._vAlign
        },

        set: function (value) {
            var _prev = this._vAlign;
            this._vAlign = value;
            if (_prev !== value && this._font) {
                this._updateText();
            }
        }
    });

    Object.defineProperty(TextComponent.prototype, "hAnchor", {
        get: function () {
            return this._hAnchor
        },

        set: function (value) {
            var _prev = this._hAnchor;
            this._hAnchor = value;
            if (_prev !== value && this._font) {
                this._updateText();
            }
        }
    });

    Object.defineProperty(TextComponent.prototype, "vAnchor", {
        get: function () {
            return this._vAnchor
        },

        set: function (value) {
            var _prev = this._vAnchor;
            this._vAnchor = value;
            if (_prev !== value && this._font) {
                this._updateText();
            }
        }
    });

    Object.defineProperty(TextComponent.prototype, "lineHeight", {
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

    Object.defineProperty(TextComponent.prototype, "spacing", {
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

    Object.defineProperty(TextComponent.prototype, "maxWidth", {
        get: function () {
            return this._maxWidth;
        },

        set: function (value) {
            var _prev = this._maxWidth;
            this._maxWidth = value;
            if (_prev !== value && this._font) {
                this._updateText();
            }
        }
    });

    Object.defineProperty(TextComponent.prototype, "screenSpace", {
        get: function () {
            return this._screenSpace;
        },

        set: function (value) {
            var _prev = this._screenSpace;
            this._screenSpace = value;
            if (_prev !== value && this._font) {
                if (value) {
                    this._meshInstance.material = this.system.material2d;
                } else {
                    this._meshInstance.material = this.system.material;
                }

            }
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
                        this._onFontLoad(asset);
                    } else {
                        assets.load(asset);
                    }

                }
            }
        }
    });

    Object.defineProperty(TextComponent.prototype, "font", {
        get: function () {
            return this._font;
        },

        set: function (value) {
            this._font = value;
        }
    });

    return {
        TextComponent: TextComponent
    };
}());

