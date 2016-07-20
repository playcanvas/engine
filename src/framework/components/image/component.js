pc.extend(pc, function () {
    pc.ALIGN_LEFT = 'left';
    pc.ALIGN_RIGHT = 'right';
    pc.ALIGN_CENTER = 'center';

    pc.ALIGN_TOP = 'top';
    pc.ALIGN_MIDDLE = 'middle';
    pc.ALIGN_BASELINE = 'baseline';
    pc.ALIGN_BOTTOM = 'bottom';

    var ImageComponent = function ImageComponent (system, entity) {
        // public
        this._asset = null;

        this._color = new pc.Color();

        this._hAlign = pc.ALIGN_LEFT;
        this._vAlign = pc.ALIGN_TOP;

        this._hAnchor = pc.ALIGN_LEFT;
        this._vAnchor = pc.ALIGN_TOP;

        this.width = 64;
        this.height = 32;
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

        this.system.app.graphicsDevice.on("resizecanvas", function (width, height) {
            if (this._meshInstance) {
                this._updateModelProjection();
            }
        }, this);

        this.entity.sync = this._sync;
    };
    ImageComponent = pc.inherits(ImageComponent, pc.Component);


    var _modelMat = new pc.Mat4();
    var _projMat = new pc.Mat4();
    var _calcMVP = function (worldTransform, w, h, hAnchor, vAnchor, mvp) {
        _modelMat.copy(worldTransform);

        var left;
        var right;
        var bottom;
        var top;
        var near = 1;
        var far = -1;
        var xscale = -1;
        var yscale = -1;

        if (hAnchor === pc.ALIGN_LEFT) {
            left = 0;
            right = -w;
            xscale = -1;
        } else if (hAnchor === pc.ALIGN_RIGHT) {
            left = w;
            right = 0;
            xscale = 1;
        } else {
            left = w/2;
            right = -w/2;
            xscale = -1;
        }

        if (vAnchor === pc.ALIGN_TOP) {
            bottom = -h;
            top = 0;
            yscale = -1;
        } else if (vAnchor === pc.ALIGN_BOTTOM) {
            bottom = 0;
            top = h;
            yscale = 1;
        } else {
            bottom = -h/2;
            top = h/2;
            yscale = -1;
        }
        _projMat.setOrtho(left, right, bottom, top, near, far);

        _modelMat.data[12] *= xscale;
        _modelMat.data[13] *= yscale;

        mvp.copy(_projMat).mul(_modelMat);

        return mvp;
    };

    pc.extend(ImageComponent.prototype, {
        _sync: function () {
            if (this.dirtyLocal) {
                this.localTransform.setTRS(this.localPosition, this.localRotation, this.localScale);

                this.dirtyLocal = false;
                this.dirtyWorld = true;
                this._aabbVer++;
            }

            if (this.dirtyWorld) {
                if (this._parent === null) {
                    this.worldTransform.copy(this.localTransform);
                } else {
                    var resolution = [640, 320];
                    var modelProjMat = new pc.Mat4();
                    var transform = new pc.Mat4();

                    _calcMVP(this.localTransform, resolution[0], resolution[1], this.image.hAnchor, this.image.vAnchor, modelProjMat);

                    transform.setScale(-0.5*resolution[0], 0.5*resolution[1], 1);
                    transform.mul2(this._parent.worldTransform, transform);

                    this.worldTransform.mul2(transform, modelProjMat);
                }

                this.dirtyWorld = false;
                var child;

                for (var i = 0, len = this._children.length; i < len; i++) {
                    child = this._children[i];
                    child.dirtyWorld = true;
                    child._aabbVer++;

                }
            }
        },

        _update: function () {
            if (!this._mesh) {
                var material = this._screenSpace ? this.system.material2d : new pc.StandardMaterial();

                material.setParameter("material_foreground", [1,1,1,1])
                this._mesh = this._createMesh();
                this._node = new pc.GraphNode();
                this._model = new pc.Model();
                this._model.graph = this._node;
                this._meshInstance = new pc.MeshInstance(this._node, this._mesh, material);
                this._model.meshInstances.push(this._meshInstance);

                if(this._screenSpace) {
                    this._updateModelProjection();
                } else {
                    // this._updateWorldTransform();
                }

                // add model to sceen
                this.system.app.scene.addModel(this._model);
                this.entity.addChild(this._model.graph);
                this._model._entity = this.entity;
            }
        },

        // calculate the model-projection used to map the object into a screen space
        _calcMVP: function (worldTransform, w, h, mvp) {
            this._modelMat.copy(worldTransform);

            var left;
            var right;
            var bottom;
            var top;
            var near = 1;
            var far = -1;
            var xscale = -1;
            var yscale = -1;

            // calculate co-ordinate system from anchors
            if (this._hAnchor === pc.ALIGN_LEFT) {
                left = 0;
                right = -w;
                xscale = -1;
            } else if (this._hAnchor === pc.ALIGN_RIGHT) {
                left = w;
                right = 0;
                xscale = 1;
            } else {
                left = w/2;
                right = -w/2;
                xscale = -1;
            }

            if (this._vAnchor === pc.ALIGN_TOP) {
                bottom = -h;
                top = 0;
                yscale = -1;
            } else if (this._vAnchor === pc.ALIGN_BOTTOM) {
                bottom = 0;
                top = h;
                yscale = 1;
            } else {
                bottom = -h/2;
                top = h/2;
                yscale = -1;
            }
            this._projMat.setOrtho(left, right, bottom, top, near, far);

            this._modelMat.data[12] *= xscale;
            this._modelMat.data[13] *= yscale;

            mvp.copy(this._projMat).mul(this._modelMat);

            return mvp;
        },

        _updateModelProjection: function () {
            this._calcMVP(this.entity.getWorldTransform(), this.system.resolution[0], this.system.resolution[1], this._modelProjMat);
            this._meshInstance.setParameter('uProjection2d', this._modelProjMat.data);
        },

        _updateWorldTransform: function () {
            return;
            var resolution = [640,320];

            this._calcMVP(this.entity.getWorldTransform(), resolution[0], resolution[1], this._modelProjMat);

            if (!this.entity._parent) return;

            var pwt = this.entity._parent.getWorldTransform();

            var transform = new pc.Mat4();
            transform.setScale(-0.5*resolution[0], 0.5*resolution[1], 1);
            transform.mul2(pwt, transform);
            this.entity.worldTransform.mul2(transform, this._modelProjMat);
            this.entity.dirtyWorld = false;
        },

        // build a
        _createMesh: function () {
            this._positions = [
                0, 0, 0,
                -this.width, 0,  0,
                -this.width, this.height, 0,
                0, this.height, 0,
            ];

            this._normals = [
                0,0,-1,
                0,0,-1,
                0,0,-1,
                0,0,-1
            ]

            this._uvs = [
                0,0,
                1,0,
                1,1,
                0,1
            ];

            this._indices = [
                0, 1, 3,
                2, 3, 1
            ];

            // offset for alignment
            for (var i = 0; i < this._positions.length; i += 3) {
                var width = this.width;
                var height = this.height;
                if (this._hAlign === pc.ALIGN_CENTER) {
                    this._positions[i] += width/2;
                } else if (this._hAlign === pc.ALIGN_RIGHT) {
                    this._positions[i] += width;
                }

                if (this._vAlign === pc.ALIGN_BOTTOM) {
                    // this._positions[i+1] += 0;
                } else if (this._vAlign === pc.ALIGN_MIDDLE) {
                    this._positions[i+1] -= this.height/2;
                } else if (this._vAlign === pc.ALIGN_TOP) {
                    this._positions[i+1] -= this.height;
                }
            }

            var mesh = pc.createMesh(this.system.app.graphicsDevice, this._positions, {uvs: this._uvs, normals: this._normals, indices: this._indices});
            // this._updateMesh(mesh, text);
            return mesh;
        }
    });

    Object.defineProperty(ImageComponent.prototype, "hAlign", {
        get: function () {
            return this._hAlign
        },

        set: function (value) {
            var _prev = this._hAlign;
            this._hAlign = value;
            if (_prev !== value && this._font) {
                this._update();
            }
        }
    });

    Object.defineProperty(ImageComponent.prototype, "vAlign", {
        get: function () {
            return this._vAlign
        },

        set: function (value) {
            var _prev = this._vAlign;
            this._vAlign = value;
            if (_prev !== value && this._font) {
                this._update();
            }
        }
    });

    Object.defineProperty(ImageComponent.prototype, "hAnchor", {
        get: function () {
            return this._hAnchor
        },

        set: function (value) {
            var _prev = this._hAnchor;
            this._hAnchor = value;
            if (_prev !== value && this._font) {
                this._update();
            }
        }
    });

    Object.defineProperty(ImageComponent.prototype, "vAnchor", {
        get: function () {
            return this._vAnchor
        },

        set: function (value) {
            var _prev = this._vAnchor;
            this._vAnchor = value;
            if (_prev !== value && this._font) {
                this._update();
            }
        }
    });

    Object.defineProperty(ImageComponent.prototype, "screenSpace", {
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

    Object.defineProperty(ImageComponent.prototype, "asset", {
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

    Object.defineProperty(ImageComponent.prototype, "texture", {
        get: function () {
            return this._texture;
        },

        set: function (value) {
            this._texture = value;
        }
    });

    return {
        ImageComponent: ImageComponent
    };
}());

