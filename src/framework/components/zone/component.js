pc.extend(pc, function () {
    /**
    * @component
    * @name pc.ZoneComponent
    * @extends pc.Component
    * @class The ZoneComponent allows you to extend the functionality of an Entity by attaching your own Script Types defined in javascript files
    * to be executed with access to the Entity. For more details on scripting see <a href="//developer.playcanvas.com/user-manual/scripting/">Scripting</a>.
    * @param {pc.ZoneComponentSystem} system The ComponentSystem that created this Component
    * @param {pc.Entity} entity The Entity that this Component is attached to.
    */

    var ZoneComponent = function ZoneComponent(system, entity) {
        this._oldState = true;
        this._size = new pc.Vec3();
        this.on('set_enabled', this._onSetEnabled, this);
    };
    ZoneComponent = pc.inherits(ZoneComponent, pc.Component);

    /**
    * @event
    * @name pc.ZoneComponent#enable
    * @description Fired when Component becomes enabled
    * Note: this event does not takes in account entity or any of its parent enabled state
    * @example
    * entity.script.on('enable', function () {
    *     // component is enabled
    * });
    */

    /**
    * @event
    * @name pc.ZoneComponent#disable
    * @description Fired when Component becomes disabled
    * Note: this event does not takes in account entity or any of its parent enabled state
    * @example
    * entity.script.on('disable', function () {
    *     // component is disabled
    * });
    */

    /**
    * @event
    * @name pc.ZoneComponent#state
    * @description Fired when Component changes state to enabled or disabled
    * Note: this event does not takes in account entity or any of its parent enabled state
    * @param {Boolean} enabled True if now enabled, False if disabled
    * @example
    * entity.script.on('state', function (enabled) {
    *     // component changed state
    * });
    */

    /**
    * @event
    * @name pc.ZoneComponent#remove
    * @description Fired when a zone is removed from an entity
    * @example
    * entity.zone.on('remove', function () {
    *     // zone has been removed from an entity
    * });
    */

    pc.extend(ZoneComponent.prototype, {
        onEnable: function () {
            ZoneComponent._super.onEnable.call(this);
            this._checkState();
        },

        onDisable: function () {
            ZoneComponent._super.onDisable.call(this);
            this._checkState();
        },

        _onSetEnabled: function(prop, old, value) {
            this._checkState();
        },

        _checkState: function() {
            var state = this.enabled && this.entity.enabled;
            if (state === this._oldState)
                return;

            this._oldState = state;

            this.fire('enable');
            this.fire('state', this.enabled);
        },

        _onBeforeRemove: function() {
            this.fire('remove');
        }
    });

    Object.defineProperty(ZoneComponent.prototype, 'size', {
        set: function(data) {
            if (data instanceof pc.Vec3) {
                this._size.copy(data);
            } else if (data instanceof Array && data.length >= 3) {
                this.size.set(data[0], data[1], data[2]);
            }
        },
        get: function() {
            return this._size;
        }
    });

    return {
        ZoneComponent: ZoneComponent
    };
}());
