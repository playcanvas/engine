Object.assign(pc, function () {
    /**
     * @enum pc.SCALEMODE
     * @name pc.SCALEMODE_NONE
     * @description Always use the application's resolution as the resolution for the {@link pc.ScreenComponent}.
     */
    pc.SCALEMODE_NONE = "none";
    /**
     * @enum pc.SCALEMODE
     * @name pc.SCALEMODE_BLEND
     * @description Scale the {@link pc.ScreenComponent} when the application's resolution is different than the ScreenComponent's referenceResolution.
     */
    pc.SCALEMODE_BLEND = "blend";

    // var counter = 1;
    /**
     * @component
     * @constructor
     * @name pc.ScreenComponent
     * @classdesc A ScreenComponent enables the Entity to render child {@link pc.ElementComponent}s using anchors and positions in the ScreenComponent's space.
     * @description Create a new ScreenComponent
     * @param {pc.ScreenComponentSystem} system The ComponentSystem that created this Component
     * @param {pc.Entity} entity The Entity that this Component is attached to.
     * @extends pc.Component
     * @property {Boolean} screenSpace If true then the ScreenComponent will render its child {@link pc.ElementComponent}s in screen space instead of world space. Enable this to create 2D user interfaces.
     * @property {Boolean} cull If true then elements inside this screen will be not be rendered when outside of the screen (only valid when screenSpace is true)
     * @property {String} scaleMode Can either be {@link pc.SCALEMODE_NONE} or {@link pc.SCALEMODE_BLEND}. See the description of referenceResolution for more information.
     * @property {Number} scaleBlend A value between 0 and 1 that is used when scaleMode is equal to {@link pc.SCALEMODE_BLEND}. Scales the ScreenComponent with width as a reference (when value is 0), the height as a reference (when value is 1) or anything in between.
     * @property {pc.Vec2} resolution The width and height of the ScreenComponent. When screenSpace is true the resolution will always be equal to {@link pc.GraphicsDevice#width} x {@link pc.GraphicsDevice#height}.
     * @property {pc.Vec2} referenceResolution The resolution that the ScreenComponent is designed for. This is only taken into account when screenSpace is true and scaleMode is {@link pc.SCALEMODE_BLEND}. If the actual resolution is different then the ScreenComponent will be scaled according to the scaleBlend value.
     */
    var ScreenComponent = function ScreenComponent(system, entity) {
        pc.Component.call(this, system, entity);

        this._resolution = new pc.Vec2(640, 320);
        this._referenceResolution = new pc.Vec2(640, 320);
        this._scaleMode = pc.SCALEMODE_NONE;
        this.scale = 1;
        this._scaleBlend = 0.5;

        // priority determines the order in which screens components are rendered
        // priority is set into the top 8 bits of the drawOrder property in an element
        this._priority = 0;

        this._screenSpace = false;
        this.cull = this._screenSpace;
        this._screenMatrix = new pc.Mat4();

        system.app.graphicsDevice.on("resizecanvas", this._onResize, this);
    };
    ScreenComponent.prototype = Object.create(pc.Component.prototype);
    ScreenComponent.prototype.constructor = ScreenComponent;

    var _transform = new pc.Mat4();

    Object.assign(ScreenComponent.prototype, {
        /**
         * @function
         * @name pc.ScreenComponent#syncDrawOrder
         * @description Set the drawOrder of each child {@link pc.ElementComponent}
         * so that ElementComponents which are last in the hierarchy are rendered on top.
         * Draw Order sync is queued and will be updated by the next update loop.
         */
        syncDrawOrder: function () {
            this.system.queueDrawOrderSync(this.entity.getGuid(), this._processDrawOrderSync, this);
        },

        _recurseDrawOrderSync: function (e, i) {
            if (!(e instanceof pc.Entity)) {
                return i;
            }

            if (e.element) {
                var prevDrawOrder = e.element.drawOrder;
                e.element.drawOrder = i++;

                if (e.element._batchGroupId >= 0 && prevDrawOrder != e.element.drawOrder) {
                    this.system.app.batcher.markGroupDirty(e.element._batchGroupId);
                }
            }

            var children = e.getChildren();
            for (var j = 0; j < children.length; j++) {
                i = this._recurseDrawOrderSync(children[j], i);
            }

            return i;
        },

        _processDrawOrderSync: function () {
            var i = 1;

            this._recurseDrawOrderSync(this.entity, i);

            // fire internal event after all screen hierarchy is synced
            this.fire('syncdraworder');
        },

        _calcProjectionMatrix: function () {
            var left;
            var right;
            var bottom;
            var top;
            var near = 1;
            var far = -1;

            var w = this._resolution.x / this.scale;
            var h = this._resolution.y / this.scale;

            left = 0;
            right = w;
            bottom = -h;
            top = 0;

            this._screenMatrix.setOrtho(left, right, bottom, top, near, far);

            if (!this._screenSpace) {
                _transform.setScale(0.5 * w, 0.5 * h, 1);
                this._screenMatrix.mul2(_transform, this._screenMatrix);
            }
        },

        _updateScale: function () {
            this.scale = this._calcScale(this._resolution, this.referenceResolution);
        },

        _calcScale: function (resolution, referenceResolution) {
            // Using log of scale values
            // This produces a nicer outcome where if you have a xscale = 2 and yscale = 0.5
            // the combined scale is 1 for an even blend
            var lx = Math.log2(resolution.x / referenceResolution.x);
            var ly = Math.log2(resolution.y / referenceResolution.y);
            return Math.pow(2, (lx * (1 - this._scaleBlend) + ly * this._scaleBlend));
        },

        _onResize: function (width, height) {
            if (this._screenSpace) {
                this._resolution.set(width, height);
                this.resolution = this._resolution; // force update
            }
        },

        onRemove: function () {
            this.system.app.graphicsDevice.off("resizecanvas", this._onResize, this);
            this.fire('remove');

            // remove all events used by elements
            this.off();
        }
    });

    Object.defineProperty(ScreenComponent.prototype, "resolution", {
        set: function (value) {
            if (!this._screenSpace) {
                this._resolution.set(value.x, value.y);
            } else {
                // ignore input when using screenspace.
                this._resolution.set(this.system.app.graphicsDevice.width, this.system.app.graphicsDevice.height);
            }

            this._updateScale();

            this._calcProjectionMatrix();

            if (!this.entity._dirtyLocal)
                this.entity._dirtifyLocal();

            this.fire("set:resolution", this._resolution);
        },
        get: function () {
            return this._resolution;
        }
    });

    Object.defineProperty(ScreenComponent.prototype, "referenceResolution", {
        set: function (value) {
            this._referenceResolution.set(value.x, value.y);
            this._updateScale();
            this._calcProjectionMatrix();

            if (!this.entity._dirtyLocal)
                this.entity._dirtifyLocal();

            this.fire("set:referenceresolution", this._resolution);
        },
        get: function () {
            if (this._scaleMode === pc.SCALEMODE_NONE) {
                return this._resolution;
            }
            return this._referenceResolution;

        }
    });

    Object.defineProperty(ScreenComponent.prototype, "screenSpace", {
        set: function (value) {
            this._screenSpace = value;
            if (this._screenSpace) {
                this._resolution.set(this.system.app.graphicsDevice.width, this.system.app.graphicsDevice.height);
            }
            this.resolution = this._resolution; // force update either way

            if (!this.entity._dirtyLocal)
                this.entity._dirtifyLocal();

            this.fire('set:screenspace', this._screenSpace);
        },
        get: function () {
            return this._screenSpace;
        }
    });


    Object.defineProperty(ScreenComponent.prototype, "scaleMode", {
        set: function (value) {
            if (value !== pc.SCALEMODE_NONE && value !== pc.SCALEMODE_BLEND) {
                value = pc.SCALEMODE_NONE;
            }

            // world space screens do not support scale modes
            if (!this._screenSpace && value !== pc.SCALEMODE_NONE) {
                value = pc.SCALEMODE_NONE;
            }

            this._scaleMode = value;
            this.resolution = this._resolution; // force update
            this.fire("set:scalemode", this._scaleMode);
        },
        get: function () {
            return this._scaleMode;
        }
    });

    Object.defineProperty(ScreenComponent.prototype, "scaleBlend", {
        set: function (value) {
            this._scaleBlend = value;
            this._updateScale();
            this._calcProjectionMatrix();

            if (!this.entity._dirtyLocal)
                this.entity._dirtifyLocal();

            this.fire("set:scaleblend", this._scaleBlend);
        },
        get: function () {
            return this._scaleBlend;
        }
    });

    Object.defineProperty(ScreenComponent.prototype, "priority", {
        get: function () {
            return this._priority;
        },

        set: function (value) {
            if (value > 0xFF) {
                // #ifdef DEBUG
                console.warn('Clamping screen priority from ' + value + ' to 255');
                // #endif
                value = 0xFF;
            }

            this._priority = value;
        }
    });
    return {
        ScreenComponent: ScreenComponent
    };
}());
