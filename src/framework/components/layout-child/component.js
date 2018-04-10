pc.extend(pc, function () {
    var DEFAULTS = {
        minWidth: 0,
        minHeight: 0,
        maxWidth: null,
        maxHeight: null,
        width: null,
        height: null,
        fitWidthProportion: 0,
        fitHeightProportion: 0,
    };

    /**
     * @component
     * @name pc.LayoutChildComponent
     * @description Create a new LayoutChildComponent
     * @class A LayoutChildComponent enables the Entity to control the sizing applied to it by its parent {@link pc.LayoutGroup}.
     * @param {pc.LayoutChildComponentSystem} system The ComponentSystem that created this Component
     * @param {pc.Entity} entity The Entity that this Component is attached to.
     * @extends pc.Component
     * TODO Add properties
     */
    var LayoutChildComponent = function LayoutChildComponent (system, entity) {
        this._minWidth = DEFAULTS.minWidth;
        this._minHeight = DEFAULTS.minHeight;
        this._maxWidth = DEFAULTS.maxWidth;
        this._maxHeight = DEFAULTS.maxHeight;
        this._width = DEFAULTS.width;
        this._height = DEFAULTS.height;
        this._fitWidthProportion = DEFAULTS.fitWidthProportion;
        this._fitHeightProportion = DEFAULTS.fitHeightProportion;
    };
    LayoutChildComponent = pc.inherits(LayoutChildComponent, pc.Component);

    // These are exposed for use by layout-calculator.js in the case where an
    // element does not have a LayoutChildComponent.
    LayoutChildComponent.DEFAULTS = DEFAULTS;

    pc.extend(LayoutChildComponent.prototype, {
        onRemove: function () {
            // TODO Implement
        }
    });

    Object.defineProperty(LayoutChildComponent.prototype, "minWidth", {
        get: function () {
            return this._minWidth;
        },

        set: function (value) {
            this._minWidth = value;
            this.fire('set:minWidth', this._minWidth);
        }
    });

    Object.defineProperty(LayoutChildComponent.prototype, "minHeight", {
        get: function () {
            return this._minHeight;
        },

        set: function (value) {
            this._minHeight = value;
            this.fire('set:minHeight', this._minHeight);
        }
    });

    Object.defineProperty(LayoutChildComponent.prototype, "maxWidth", {
        get: function () {
            return this._maxWidth;
        },

        set: function (value) {
            this._maxWidth = value;
            this.fire('set:maxWidth', this._maxWidth);
        }
    });

    Object.defineProperty(LayoutChildComponent.prototype, "maxHeight", {
        get: function () {
            return this._maxHeight;
        },

        set: function (value) {
            this._maxHeight = value;
            this.fire('set:maxHeight', this._maxHeight);
        }
    });

    Object.defineProperty(LayoutChildComponent.prototype, "width", {
        get: function () {
            return this._width;
        },

        set: function (value) {
            this._width = value;
            this.fire('set:width', this._width);
        }
    });

    Object.defineProperty(LayoutChildComponent.prototype, "height", {
        get: function () {
            return this._height;
        },

        set: function (value) {
            this._height = value;
            this.fire('set:height', this._height);
        }
    });

    Object.defineProperty(LayoutChildComponent.prototype, "fitWidthProportion", {
        get: function () {
            return this._fitWidthProportion;
        },

        set: function (value) {
            this._fitWidthProportion = value;
            this.fire('set:fitWidthProportion', this._fitWidthProportion);
        }
    });

    Object.defineProperty(LayoutChildComponent.prototype, "fitHeightProportion", {
        get: function () {
            return this._fitHeightProportion;
        },

        set: function (value) {
            this._fitHeightProportion = value;
            this.fire('set:fitHeightProportion', this._fitHeightProportion);
        }
    });

    return {
        LayoutChildComponent: LayoutChildComponent
    };
}());
