Object.assign(pc, function () {
    /**
     * @private
     * @component
     * @name pc.ZoneComponent
     * @extends pc.Component
     * @class The ZoneComponent allows you to define an area in world space of certain size.
     * This can be used in various ways, such as affecting audio reverb when audiolistener is within zone.
     * Or create culling system with portals between zones to hide whole indoor sections for performance reasons.
     * And many other possible options. Zones are building blocks and meant to be used in many different ways.
     * @param {pc.ZoneComponentSystem} system The ComponentSystem that created this Component
     * @param {pc.Vec3} size The Size of Box of a Zone.
     */

    var ZoneComponent = function ZoneComponent(system, entity) {
        pc.Component.call(this, system, entity);

        this._oldState = true;
        this._size = new pc.Vec3();
        this.on('set_enabled', this._onSetEnabled, this);
    };
    ZoneComponent.prototype = Object.create(pc.Component.prototype);
    ZoneComponent.prototype.constructor = ZoneComponent;

    /**
     * @private
     * @event
     * @name pc.ZoneComponent#enable
     * @description Fired when Component becomes enabled
     * Note: this event does not take in account entity or any of its parent enabled state
     * @example
     * entity.zone.on('enable', function () {
     *     // component is enabled
     * });
     */

    /**
     * @private
     * @event
     * @name pc.ZoneComponent#disable
     * @description Fired when Component becomes disabled
     * Note: this event does not take in account entity or any of its parent enabled state
     * @example
     * entity.zone.on('disable', function () {
     *     // component is disabled
     * });
     */

    /**
     * @private
     * @event
     * @name pc.ZoneComponent#state
     * @description Fired when Component changes state to enabled or disabled
     * Note: this event does not take in account entity or any of its parent enabled state
     * @param {Boolean} enabled True if now enabled, False if disabled
     * @example
     * entity.zone.on('state', function (enabled) {
     *     // component changed state
     * });
     */

    /**
     * @private
     * @event
     * @name pc.ZoneComponent#remove
     * @description Fired when a zone is removed from an entity
     * @example
     * entity.zone.on('remove', function () {
     *     // zone has been removed from an entity
     * });
     */

    Object.assign(ZoneComponent.prototype, {
        onEnable: function () {
            this._checkState();
        },

        onDisable: function () {
            this._checkState();
        },

        _onSetEnabled: function (prop, old, value) {
            this._checkState();
        },

        _checkState: function () {
            var state = this.enabled && this.entity.enabled;
            if (state === this._oldState)
                return;

            this._oldState = state;

            this.fire('enable');
            this.fire('state', this.enabled);
        },

        _onBeforeRemove: function () {
            this.fire('remove');
        }
    });

    Object.defineProperty(ZoneComponent.prototype, 'size', {
        set: function (data) {
            if (data instanceof pc.Vec3) {
                this._size.copy(data);
            } else if (data instanceof Array && data.length >= 3) {
                this.size.set(data[0], data[1], data[2]);
            }
        },
        get: function () {
            return this._size;
        }
    });

    return {
        ZoneComponent: ZoneComponent
    };
}());
