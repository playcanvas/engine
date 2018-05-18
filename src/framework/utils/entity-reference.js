pc.extend(pc, function () {
    // TODO Docs
    // TODO Tests
    function EntityReference(parentComponent, entityPropertyName, eventConfig) {
        if (!parentComponent || !(parentComponent instanceof pc.Component)) {
            throw new Error('The parentComponent argument is required and must be a Component');
        } else if (!entityPropertyName || typeof entityPropertyName !== 'string') {
            throw new Error('The propertyName argument is required and must be a string');
        } else if (eventConfig && typeof eventConfig !== 'object') {
            throw new Error('If provided, the eventConfig argument must be an object');
        }

        this._parentComponent = parentComponent;
        this._entityPropertyName = entityPropertyName;
        this._entity = null;
        this._app = parentComponent.system.app;

        this._configureEventListeners(eventConfig || {}, {
            'entity#destroy': this._onEntityDestroy
        });
        this._toggleLifecycleListeners('on');
    }

    pc.extend(EntityReference.prototype, {
        _configureEventListeners: function(externalEventConfig, internalEventConfig) {
            var externalEventListenerConfigs = this._parseEventListenerConfig(externalEventConfig, 'external', this._parentComponent);
            var internalEventListenerConfigs = this._parseEventListenerConfig(internalEventConfig, 'internal', this);

            this._eventListenerConfigs = externalEventListenerConfigs.concat(internalEventListenerConfigs);
            this._listenerStatusFlags = {};
            this._gainListeners = {};
            this._loseListeners = {};
        },

        _parseEventListenerConfig: function(eventConfig, prefix, scope) {
            return Object.keys(eventConfig).map(function(listenerDescription, index) {
                var listenerDescriptionParts = listenerDescription.split('#');
                var sourceName = listenerDescriptionParts[0];
                var eventName = listenerDescriptionParts[1];
                var callback = eventConfig[listenerDescription];

                if (listenerDescriptionParts.length !== 2 ||
                    typeof sourceName !== 'string' || sourceName.length === 0 ||
                    typeof eventName !== 'string' || eventName.length === 0) {
                    throw new Error('Invalid event listener description: `' + listenerDescription + '`');
                }

                if (typeof callback !== 'function') {
                    throw new Error('Invalid or missing callback for event listener `' + listenerDescription + '`');
                }

                return {
                    id: prefix + '_' + index + '_' + listenerDescription,
                    sourceName: sourceName,
                    eventName: eventName,
                    callback: callback,
                    scope: scope
                };
            }, this);
        },

        _toggleLifecycleListeners: function(onOrOff) {
            this._parentComponent[onOrOff]('set_' + this._entityPropertyName, this._onSetEntityGuid, this);
            this._parentComponent.system[onOrOff]('beforeremove', this._onParentComponentRemove, this);

            pc.ComponentSystem[onOrOff]('postInitialize', this._onPostInitialize, this);

            // For any event listeners that relate to the gain/loss of a component, register
            // listeners that will forward the add/remove component events
            for (var i = 0; i < this._eventListenerConfigs.length; ++i) {
                var config = this._eventListenerConfigs[i];
                var componentSystem = this._app.systems[config.sourceName];

                if (componentSystem && config.eventName === 'gain') {
                    this._gainListeners[config.sourceName] = config;
                    componentSystem[onOrOff]('add', this._onComponentAdd, this);
                }

                if (componentSystem && config.eventName === 'lose') {
                    this._loseListeners[config.sourceName] = config;
                    componentSystem[onOrOff]('beforeremove', this._onComponentRemove, this);
                }
            }
        },

        _onComponentAdd: function(entity, component) {
            if (entity === this._entity && this._gainListeners[component.system.name]) {
                this._callListener(this._gainListeners[component.system.name]);
            }
        },

        _onComponentRemove: function(entity, component) {
            if (entity === this._entity && this._loseListeners[component.system.name]) {
                this._callListener(this._loseListeners[component.system.name]);
            }
        },

        _callListener: function(config) {
            config.callback.call(config.scope);
        },

        _onSetEntityGuid: function(name, oldGuid, newGuid) {
            if (oldGuid !== newGuid) {
                this._updateEntityReference();
            }
        },

        _onPostInitialize: function() {
            this._updateEntityReference();
        },

        _updateEntityReference: function() {
            var entityGuid = this._parentComponent.data[this._entityPropertyName];
            var hasChanged = !this._entity || this._entity.getGuid() !== entityGuid;

            if (hasChanged) {
                if (this._entity) {
                    this._onBeforeEntityChange();
                }

                this._entity = entityGuid ? this._parentComponent.system.app.root.findByGuid(entityGuid) : null;

                if (this._entity) {
                    this._onAfterEntityChange();
                } else {
                    this._parentComponent.data[this._entityPropertyName] = null;
                }
            }
        },

        _onBeforeEntityChange: function() {
            this._toggleEntityListeners('off');
            this._callAllGainOrLoseListeners(this._loseListeners);
        },

        _onAfterEntityChange: function() {
            this._toggleEntityListeners('on');
            this._callAllGainOrLoseListeners(this._gainListeners);
        },

        _callAllGainOrLoseListeners: function(listenerMap) {
            for (var componentName in this._entity.c) {
                if (this._entity.c.hasOwnProperty(componentName) && listenerMap[componentName]) {
                    this._callListener(listenerMap[componentName]);
                }
            }
        },

        _toggleEntityListeners: function(onOrOff) {
            if (this._entity) {
                for (var i = 0; i < this._eventListenerConfigs.length; ++i) {
                    this._safeToggleListener(onOrOff, this._eventListenerConfigs[i]);
                }
            }
        },

        _safeToggleListener: function(onOrOff, config, isDestroying) {
            var isAdding = (onOrOff === 'on');

            // Prevent duplicate listeners
            if (isAdding && this._listenerStatusFlags[config.id]) {
                return;
            }

            var source = this._getEventSource(config.sourceName, isDestroying);

            if (source) {
                source[onOrOff](config.eventName, config.callback, config.scope);
                this._listenerStatusFlags[config.id] = isAdding;
            }
        },

        _getEventSource: function(sourceName, isDestroying) {
            // The 'entity' source name is a special case - we just want to return
            // a reference to the entity itself. For all other cases the source name
            // should refer to a component.
            if (sourceName === 'entity') {
                return this._entity;
            }

            var component = this._entity[sourceName];

            if (component) {
                return component;
            }

            if (!isDestroying) {
                console.warn('Entity has no component with name ' + sourceName);
            }

            return null;
        },

        _onEntityDestroy: function(entity) {
            if (this._entity === entity) {
                this._toggleEntityListeners('off', true);
                this._entity = null;
            }
        },

        _onParentComponentRemove: function(entity, component) {
            if (component === this._parentComponent) {
                this._toggleLifecycleListeners('off');
                this._toggleEntityListeners('off', true);
            }
        }
    });

    Object.defineProperty(EntityReference.prototype, 'entity', {
        get: function () {
            return this._entity;
        }
    });

    Object.defineProperty(EntityReference.prototype, 'hasEntity', {
        get: function () {
            return !!this._entity;
        }
    });

    return {
        EntityReference: EntityReference
    };
}());
