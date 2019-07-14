Object.assign(pc, function () {
    /**
     * @private
     * @name pc.EntityReference
     * @description Helper class used for managing component properties that represent entity references.
     * @classdesc An EntityReference can be used in scenarios where a component has one or more properties that
     * refer to entities in the scene graph. Using an EntityReference simplifies the job of dealing with the
     * presence or non-presence of the underlying entity and its components, especially when it comes to dealing
     * with the runtime addition or removal of components, and addition/removal of associated event listeners.
     *
     * <h2>Usage Scenario</h2>
     *
     * Imagine that you're creating a Checkbox component, which has a reference to an entity representing
     * the checkmark/tickmark that is rendered in the Checkbox. The reference is modelled as an entity guid
     * property on the Checkbox component, called simply 'checkmark'. We have to implement a basic piece of
     * functionality whereby when the 'checkmark' entity reference is set, the Checkbox component must toggle
     * the tint of an ImageElementComponent present on the checkmark entity to indicate whether the Checkbox
     * is currently in the active or inactive state.
     *
     * Without using an EntityReference, the Checkbox component must implement some or all of the following:
     *
     *  - Listen for its 'checkmark' property being set to a valid guid, and retrieve a reference to the
     *    entity associated with this guid whenever it changes (i.e. via app.root.findByGuid()).
     *  - Once a valid entity is received, check to see whether it has already has an ImageElementComponent
     *    or not:
     *      - If it has one, proceed to set the tint of the ImageElementComponent based on whether the Checkbox
     *        is currently active or inactive.
     *      - If it doesn't have one, add a listener to wait for the addition of an ImageElementComponent,
     *        and then apply the tint once one becomes present.
     *  - If the checkmark entity is then reassigned (such as if the user reassigns the field in the editor,
     *    or if this is done at runtime via a script), a well-behaved Checkbox component must also undo the
     *    tinting so that no lasting effect is applied to the old entity.
     *  - If the checkmark entity's ImageElementComponent is removed and then another ImageElementComponent
     *    is added, the Checkbox component must handle this in order to re-apply the tint.
     *  - To prevent memory leaks, the Checkbox component must also make sure to correctly remove listeners
     *    in each of the following scenarios:
     *      - Destruction of the Checkbox component.
     *      - Reassignment of the checkmark entity.
     *      - Removal of the ImageElementComponent.
     *  - It must also be careful not to double-add listeners in any of the above code paths, to avoid various
     *    forms of undesirable behavior.
     *
     * If the Checkbox component becomes more complicated and has multiple entity reference properties,
     * all of the above must be done correctly for each entity. Similarly, if it depends on multiple different
     * component types being present on the entities it has references to, it must correctly handle the presence
     * and non-presence of each of these components in the various possible sequences of addition and removal.
     * In addition to generating a lot of boilerplate, it's also very easy for subtle mistakes to be made that
     * lead to memory leaks, null reference errors or visual bugs.
     *
     * By using an EntityReference, all of the above can be reduced to the following:
     *
     * <code class="javascript hljs">
     * function CheckboxComponent() {
     *    this._checkmarkReference = new pc.EntityReference(this, 'checkmark', {
     *        'element#gain': this._onCheckmarkImageElementGain,
     *        'element#lose': this._onCheckmarkImageElementLose
     *    });
     * }
     * </code>
     *
     * Using the above code snippet, the <code>_onCheckmarkImageElementGain()</code> listener will be called
     * in either of the following scenarios:
     *
     *   1. A checkmark entity is assigned and already has an ElementComponent.
     *   2. A checkmark entity is assigned that does not have an ElementComponent, but one is added later.
     *
     * Similarly, the <code>_onCheckmarkImageElementLose()</code> listener will be called in either of the
     * following scenarios:
     *
     *   1. An ElementComponent is removed from the checkmark entity.
     *   2. The checkmark entity is re-assigned (i.e. to another entity), or nullified. In this scenario the
     *      callback will only be called if the entity actually had an ElementComponent.
     *
     * <h2>Event String Format</h2>
     *
     * The event string (i.e. "element#gain" in the above examples) is of the format <code>sourceName#eventName</code>,
     * and is defined as follows:
     *
     *   - <code>sourceName</code>: May be any component name, or the special string "entity", which refers
     *     to the entity itself.
     *   - <code>eventName</code>: May be the name of any event dispatched by the relevant component or
     *     entity, as well as the special strings "gain" or "lose".
     *
     * Some examples are as follows:
     *
     * <code class="javascript hljs">
     * "entity#destroy"    // Called when the entity managed by the entity reference is destroyed.
     * "element#set:width" // Called when the width of an ElementComponent is set.
     * </code>
     *
     * <h2>Ownership and Destruction</h2>
     *
     * The lifetime of an ElementReference is tied to the parent component that instantiated it. This
     * coupling is indicated by the provision of the `this` keyword to the ElementReference's constructor
     * in the above examples (i.e. <code>new pc.EntityReference(this, ...</code>).
     *
     * Any event listeners managed by the ElementReference are automatically cleaned up when the parent
     * component is removed or the parent component's entity is destroyed – as such you should never have
     * to worry about dangling listeners.
     *
     * Additionally, any callbacks listed in the event config will automatically be called in the scope
     * of the parent component – you should never have to worry about manually calling <code>Function.bind()</code>.
     *
     * @param {pc.Component} parentComponent A reference to the parent component that owns this entity reference.
     * @param {String} entityPropertyName The name of the component property that contains the entity guid.
     * @param {Object<String, Function>} [eventConfig] A map of event listener configurations.
     * @property {Entity} entity A reference to the entity, if present.
     */
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

    Object.assign(EntityReference.prototype, {
        _configureEventListeners: function (externalEventConfig, internalEventConfig) {
            var externalEventListenerConfigs = this._parseEventListenerConfig(externalEventConfig, 'external', this._parentComponent);
            var internalEventListenerConfigs = this._parseEventListenerConfig(internalEventConfig, 'internal', this);

            this._eventListenerConfigs = externalEventListenerConfigs.concat(internalEventListenerConfigs);
            this._listenerStatusFlags = {};
            this._gainListeners = {};
            this._loseListeners = {};
        },

        _parseEventListenerConfig: function (eventConfig, prefix, scope) {
            return Object.keys(eventConfig).map(function (listenerDescription, index) {
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

        _toggleLifecycleListeners: function (onOrOff) {
            this._parentComponent[onOrOff]('set_' + this._entityPropertyName, this._onSetEntity, this);
            this._parentComponent.system[onOrOff]('beforeremove', this._onParentComponentRemove, this);

            pc.ComponentSystem[onOrOff]('postinitialize', this._onPostInitialize, this);
            this._app[onOrOff]('tools:sceneloaded', this._onSceneLoaded, this);

            // For any event listeners that relate to the gain/loss of a component, register
            // listeners that will forward the add/remove component events
            var allComponentSystems = [];

            for (var i = 0; i < this._eventListenerConfigs.length; ++i) {
                var config = this._eventListenerConfigs[i];
                var componentSystem = this._app.systems[config.sourceName];

                if (componentSystem) {
                    if (allComponentSystems.indexOf(componentSystem) === -1) {
                        allComponentSystems.push(componentSystem);
                    }

                    if (componentSystem && config.eventName === 'gain') {
                        this._gainListeners[config.sourceName] = config;
                    }

                    if (componentSystem && config.eventName === 'lose') {
                        this._loseListeners[config.sourceName] = config;
                    }
                }
            }

            for (var j = 0; j < allComponentSystems.length; ++j) {
                allComponentSystems[j][onOrOff]('add', this._onComponentAdd, this);
                allComponentSystems[j][onOrOff]('beforeremove', this._onComponentRemove, this);
            }
        },

        _onSetEntity: function (name, oldValue, newValue) {
            if (newValue instanceof pc.Entity) {
                this._updateEntityReference();
            } else  {
                if (newValue !== null && newValue !== undefined && typeof newValue !== 'string') {
                    console.warn("Entity field `" + this._entityPropertyName + "` was set to unexpected type '" + (typeof newValue) + "'");
                    return;
                }

                if (oldValue !== newValue) {
                    this._updateEntityReference();
                }
            }
        },

        _onPostInitialize: function () {
            this._updateEntityReference();
        },

        /**
         * Must be called from the parent component's onEnable() method in order for entity
         * references to be correctly resolved when {@link pc.Entity#clone} is called.
         */
        onParentComponentEnable: function () {
            // When an entity is cloned via the JS API, we won't be able to resolve the
            // entity reference until the cloned entity has been added to the scene graph.
            // We can detect this by waiting for the parent component to be enabled, in the
            // specific case where we haven't yet been able to resolve an entity reference.
            if (!this._entity) {
                this._updateEntityReference();
            }
        },

        // When running within the editor, postInitialize is fired before the scene graph
        // has been fully constructed. As such we use the special tools:sceneloaded event
        // in order to know when the graph is ready to traverse.
        _onSceneLoaded: function () {
            this._updateEntityReference();
        },

        _updateEntityReference: function () {
            var nextEntityGuid = this._parentComponent.data[this._entityPropertyName];
            var nextEntity;

            if (nextEntityGuid instanceof pc.Entity) {
                // if value is set to a Entity itself replace value with the GUID
                nextEntity = nextEntityGuid;
                nextEntityGuid = nextEntity.getGuid();
                this._parentComponent.data[this._entityPropertyName] = nextEntityGuid;
            } else {
                var root = this._parentComponent.system.app.root;
                var isOnSceneGraph = this._parentComponent.entity.isDescendantOf(root);

                nextEntity = (isOnSceneGraph && nextEntityGuid) ? root.findByGuid(nextEntityGuid) : null;
            }

            var hasChanged = this._entity !== nextEntity;

            if (hasChanged) {
                if (this._entity) {
                    this._onBeforeEntityChange();
                }

                this._entity = nextEntity;

                if (this._entity) {
                    this._onAfterEntityChange();
                }
            }
        },

        _onBeforeEntityChange: function () {
            this._toggleEntityListeners('off');
            this._callAllGainOrLoseListeners(this._loseListeners);
        },

        _onAfterEntityChange: function () {
            this._toggleEntityListeners('on');
            this._callAllGainOrLoseListeners(this._gainListeners);
        },

        _onComponentAdd: function (entity, component) {
            var componentName = component.system.id;

            if (entity === this._entity) {
                this._callGainOrLoseListener(componentName, this._gainListeners);
                this._toggleComponentListeners('on', componentName);
            }
        },

        _onComponentRemove: function (entity, component) {
            var componentName = component.system.id;

            if (entity === this._entity) {
                this._callGainOrLoseListener(componentName, this._loseListeners);
                this._toggleComponentListeners('off', componentName, true);
            }
        },

        _callAllGainOrLoseListeners: function (listenerMap) {
            for (var componentName in this._entity.c) {
                this._callGainOrLoseListener(componentName, listenerMap);
            }
        },

        _callGainOrLoseListener: function (componentName, listenerMap) {
            if (this._entity.c.hasOwnProperty(componentName) && listenerMap[componentName]) {
                var config = listenerMap[componentName];
                config.callback.call(config.scope);
            }
        },

        _toggleEntityListeners: function (onOrOff, isDestroying) {
            if (this._entity) {
                for (var i = 0; i < this._eventListenerConfigs.length; ++i) {
                    this._safeToggleListener(onOrOff, this._eventListenerConfigs[i], isDestroying);
                }
            }
        },

        _toggleComponentListeners: function (onOrOff, componentName, isDestroying) {
            for (var i = 0; i < this._eventListenerConfigs.length; ++i) {
                var config = this._eventListenerConfigs[i];

                if (config.sourceName === componentName) {
                    this._safeToggleListener(onOrOff, config, isDestroying);
                }
            }
        },

        _safeToggleListener: function (onOrOff, config, isDestroying) {
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

        _getEventSource: function (sourceName, isDestroying) {
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

        _onEntityDestroy: function (entity) {
            if (this._entity === entity) {
                this._toggleEntityListeners('off', true);
                this._entity = null;
            }
        },

        _onParentComponentRemove: function (entity, component) {
            if (component === this._parentComponent) {
                this._toggleLifecycleListeners('off');
                this._toggleEntityListeners('off', true);
            }
        },

        /**
         * Convenience method indicating whether the entity exists and has a component of the provided type.
         *
         * @param {String} componentName Name of the component.
         * @returns {Boolean} True if the entity exists and has a component of the provided type.
         */
        hasComponent: function (componentName) {
            return (this._entity && this._entity.c) ? !!this._entity.c[componentName] : false;
        }
    });

    Object.defineProperty(EntityReference.prototype, 'entity', {
        get: function () {
            return this._entity;
        }
    });

    return {
        EntityReference: EntityReference
    };
}());
