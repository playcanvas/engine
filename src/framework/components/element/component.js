pc.extend(pc, function () {
    var ElementComponent = function ElementComponent (system, entity) {
        this._hAlign = pc.ALIGN_LEFT;
        this._vAlign = pc.ALIGN_TOP;

        this._hAnchor = pc.ALIGN_LEFT;
        this._vAnchor = pc.ALIGN_TOP;

        this.screen = this._getScreen();
        entity.sync = this._sync;


        this._projection2d = new pc.Mat4();

    };
    ElementComponent = pc.inherits(ElementComponent, pc.Component);


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

    pc.extend(ElementComponent.prototype, {
        _getScreen: function () {
            var screen = null;
            var parent = this.entity._parent;
            while(parent && !parent.screen) {
                parent = parent._parent;
            }
            if (parent) return parent;
            return null;
        },

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
                    if (this.element.screen) {
                        var resolution = this.element.screen.screen.resolution;
                    }

                    if (this.element.screen.screen.screenSpace) {
                        // this.worldTransform.mul2(this._parent.worldTransform, this.localTransform);
                        _calcMVP(this.localTransform, resolution.x, resolution.y, this.element.hAnchor, this.element.vAnchor, this.element._projection2d);
                    } else {
                        var modelProjMat = new pc.Mat4();
                        var transform = new pc.Mat4();

                        _calcMVP(this.localTransform, resolution.x, resolution.y, this.element.hAnchor, this.element.vAnchor, modelProjMat);

                        transform.setScale(-0.5*resolution.x, 0.5*resolution.y, 1);
                        transform.mul2(this._parent.worldTransform, transform);

                        this.worldTransform.mul2(transform, modelProjMat);
                    }
                }

                this.dirtyWorld = false;
                var child;

                for (var i = 0, len = this._children.length; i < len; i++) {
                    child = this._children[i];
                    child.dirtyWorld = true;
                    child._aabbVer++;

                }
            }
        }
    });

    Object.defineProperty(ElementComponent.prototype, "hAlign", {
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

    Object.defineProperty(ElementComponent.prototype, "vAlign", {
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

    Object.defineProperty(ElementComponent.prototype, "hAnchor", {
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

    Object.defineProperty(ElementComponent.prototype, "vAnchor", {
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

    return {
        ElementComponent: ElementComponent
    };
}());

