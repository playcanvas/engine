Object.assign(pc, function () {
    /**
     * @component
     * @name pc.ScriptComponent
     * @class The ScriptComponent allows you to extend the functionality of an Entity by attaching your own Script Types defined in JavaScript files
     * to be executed with access to the Entity. For more details on scripting see <a href="//developer.playcanvas.com/user-manual/scripting/">Scripting</a>.
     * @param {pc.ScriptComponentSystem} system The ComponentSystem that created this Component
     * @param {pc.Entity} entity The Entity that this Component is attached to.
     * @extends pc.Component
     * @property {ScriptType[]} scripts An array of all script instances attached to an entity. This Array shall not be modified by developer.
     */

    var ScriptComponent = function ScriptComponent(system, entity) {
        pc.Component.call(this, system, entity);

        // holds all script instances for this component
        this._scripts = [];
        // holds all script instances with an update method
        this._updateList = new pc.SortedLoopArray({ sortBy: '__executionOrder' });
        // holds all script instances with a postUpdate method
        this._postUpdateList = new pc.SortedLoopArray({ sortBy: '__executionOrder' });

        this._scriptsIndex = {};
        this._destroyedScripts = [];
        this._destroyed = false;
        this._scriptsData = null;
        this._oldState = true;

        // override default 'enabled' property of base pc.Component
        // because this is faster
        this._enabled = true;

        // whether this component is currently being enabled
        this._beingEnabled = false;
        // if true then we are currently looping through
        // script instances. This is used to prevent a scripts array
        // from being modified while a loop is being executed
        this._isLoopingThroughScripts = false;

        // the order that this component will be updated
        // by the script system. This is set by the system itself.
        this._executionOrder = -1;

        this.on('set_enabled', this._onSetEnabled, this);
    };
    ScriptComponent.prototype = Object.create(pc.Component.prototype);
    ScriptComponent.prototype.constructor = ScriptComponent;

    ScriptComponent.scriptMethods = {
        initialize: 'initialize',
        postInitialize: 'postInitialize',
        update: 'update',
        postUpdate: 'postUpdate',
        swap: 'swap'
    };

    /**
     * @event
     * @name pc.ScriptComponent#enable
     * @description Fired when Component becomes enabled
     * Note: this event does not take in account entity or any of its parent enabled state
     * @example
     * entity.script.on('enable', function () {
     *     // component is enabled
     * });
     */

    /**
     * @event
     * @name pc.ScriptComponent#disable
     * @description Fired when Component becomes disabled
     * Note: this event does not take in account entity or any of its parent enabled state
     * @example
     * entity.script.on('disable', function () {
     *     // component is disabled
     * });
     */

    /**
     * @event
     * @name pc.ScriptComponent#state
     * @description Fired when Component changes state to enabled or disabled
     * Note: this event does not take in account entity or any of its parent enabled state
     * @param {Boolean} enabled True if now enabled, False if disabled
     * @example
     * entity.script.on('state', function (enabled) {
     *     // component changed state
     * });
     */

    /**
     * @event
     * @name pc.ScriptComponent#remove
     * @description Fired when Component is removed from entity
     * @example
     * entity.script.on('remove', function () {
     *     // entity has no more script component
     * });
     */

    /**
     * @event
     * @name pc.ScriptComponent#create
     * @description Fired when a script instance is created and attached to component
     * @param {String} name The name of the Script Type
     * @param {ScriptType} scriptInstance The instance of the {@link ScriptType} that has been created
     * @example
     * entity.script.on('create', function (name, scriptInstance) {
     *     // new script instance added to component
     * });
     */

    /**
     * @event
     * @name pc.ScriptComponent#create:[name]
     * @description Fired when a script instance is created and attached to component
     * @param {ScriptType} scriptInstance The instance of the {@link ScriptType} that has been created
     * @example
     * entity.script.on('create:playerController', function (scriptInstance) {
     *     // new script instance 'playerController' is added to component
     * });
     */

    /**
     * @event
     * @name pc.ScriptComponent#destroy
     * @description Fired when a script instance is destroyed and removed from component
     * @param {String} name The name of the Script Type
     * @param {ScriptType} scriptInstance The instance of the {@link ScriptType} that has been destroyed
     * @example
     * entity.script.on('destroy', function (name, scriptInstance) {
     *     // script instance has been destroyed and removed from component
     * });
     */

    /**
     * @event
     * @name pc.ScriptComponent#destroy:[name]
     * @description Fired when a script instance is destroyed and removed from component
     * @param {ScriptType} scriptInstance The instance of the {@link ScriptType} that has been destroyed
     * @example
     * entity.script.on('destroy:playerController', function (scriptInstance) {
     *     // script instance 'playerController' has been destroyed and removed from component
     * });
     */

    /**
     * @event
     * @name pc.ScriptComponent#move
     * @description Fired when a script instance is moved in component
     * @param {String} name The name of the Script Type
     * @param {ScriptType} scriptInstance The instance of the {@link ScriptType} that has been moved
     * @param {Number} ind New position index
     * @param {Number} indOld Old position index
     * @example
     * entity.script.on('move', function (name, scriptInstance, ind, indOld) {
     *     // script instance has been moved in component
     * });
     */

    /**
     * @event
     * @name pc.ScriptComponent#move:[name]
     * @description Fired when a script instance is moved in component
     * @param {ScriptType} scriptInstance The instance of the {@link ScriptType} that has been moved
     * @param {Number} ind New position index
     * @param {Number} indOld Old position index
     * @example
     * entity.script.on('move:playerController', function (scriptInstance, ind, indOld) {
     *     // script instance 'playerController' has been moved in component
     * });
     */

    /**
     * @event
     * @name pc.ScriptComponent#error
     * @description Fired when a script instance had an exception
     * @param {ScriptType} scriptInstance The instance of the {@link ScriptType} that raised the exception
     * @param {Error} err Native JS Error object with details of an error
     * @param {String} method The method of the script instance that the exception originated from.
     * @example
     * entity.script.on('error', function (scriptInstance, err, method) {
     *     // script instance caught an exception
     * });
     */

    Object.assign(ScriptComponent.prototype, {
        onEnable: function () {
            this._beingEnabled = true;
            this._checkState();

            if (!this.entity._beingEnabled) {
                this.onPostStateChange();
            }

            this._beingEnabled = false;
        },

        onDisable: function () {
            this._checkState();
        },

        onPostStateChange: function () {
            var script;

            var wasLooping = this._beginLooping();

            for (var i = 0, len = this.scripts.length; i < len; i++) {
                script = this.scripts[i];

                if (script._initialized && !script._postInitialized && script.enabled) {
                    script._postInitialized = true;

                    if (script.postInitialize)
                        this._scriptMethod(script, ScriptComponent.scriptMethods.postInitialize);
                }
            }

            this._endLooping(wasLooping);
        },

        // Sets isLoopingThroughScripts to false and returns
        // its previous value
        _beginLooping: function () {
            var looping = this._isLoopingThroughScripts;
            this._isLoopingThroughScripts = true;
            return looping;
        },

        // Restores isLoopingThroughScripts to the specified parameter
        // If all loops are over then remove destroyed scripts form the _scripts array
        _endLooping: function (wasLoopingBefore) {
            this._isLoopingThroughScripts = wasLoopingBefore;
            if (!this._isLoopingThroughScripts) {
                this._removeDestroyedScripts();
            }
        },

        // We also need this handler because it is fired
        // when value === old instead of onEnable and onDisable
        // which are only fired when value !== old
        _onSetEnabled: function (prop, old, value) {
            this._beingEnabled = true;
            this._checkState();
            this._beingEnabled = false;
        },

        _checkState: function () {
            var state = this.enabled && this.entity.enabled;
            if (state === this._oldState)
                return;

            this._oldState = state;

            this.fire(state ? 'enable' : 'disable');
            this.fire('state', state);

            if (state) {
                this.system._addComponentToEnabled(this);
            } else {
                this.system._removeComponentFromEnabled(this);
            }

            var wasLooping = this._beginLooping();

            var script;
            for (var i = 0, len = this.scripts.length; i < len; i++) {
                script = this.scripts[i];
                script.enabled = script._enabled;
            }

            this._endLooping(wasLooping);
        },

        _onBeforeRemove: function () {
            this.fire('remove');

            var wasLooping = this._beginLooping();

            // destroy all scripts
            for (var i = 0; i < this.scripts.length; i++) {
                var script = this.scripts[i];
                if (!script) continue;

                this.destroy(script.__scriptType.__name);
            }

            this._endLooping(wasLooping);
        },

        _removeDestroyedScripts: function () {
            var len = this._destroyedScripts.length;
            if (!len) return;

            var i;
            for (i = 0; i < len; i++) {
                var script = this._destroyedScripts[i];
                this._removeScriptInstance(script);
            }

            this._destroyedScripts.length = 0;

            // update execution order for scripts
            this._resetExecutionOrder(0, this._scripts.length);
        },

        _onInitializeAttributes: function () {
            for (var i = 0, len = this.scripts.length; i < len; i++)
                this.scripts[i].__initializeAttributes();
        },

        _scriptMethod: function (script, method, arg) {
            // #ifdef DEBUG
            try {
            // #endif
                script[method](arg);
            // #ifdef DEBUG
            } catch (ex) {
                // disable script if it fails to call method
                script.enabled = false;

                if (!script._callbacks || !script._callbacks.error) {
                    console.warn('unhandled exception while calling "' + method + '" for "' + script.__scriptType.__name + '" script: ', ex);
                    console.error(ex);
                }

                script.fire('error', ex, method);
                this.fire('error', script, ex, method);
            }
            // #endif
        },

        _onInitialize: function () {
            var script, scripts = this._scripts;

            var wasLooping = this._beginLooping();

            for (var i = 0, len = scripts.length; i < len; i++) {
                script = scripts[i];
                if (!script._initialized && script.enabled) {
                    script._initialized = true;
                    if (script.initialize)
                        this._scriptMethod(script, ScriptComponent.scriptMethods.initialize);
                }
            }

            this._endLooping(wasLooping);
        },

        _onPostInitialize: function () {
            this.onPostStateChange();
        },

        _onUpdate: function (dt) {
            var self = this;
            var list = self._updateList;
            if (! list.length) return;

            var script;

            var wasLooping = self._beginLooping();

            for (list.loopIndex = 0; list.loopIndex < list.length; list.loopIndex++) {
                script = list.items[list.loopIndex];
                if (script.enabled) {
                    self._scriptMethod(script, ScriptComponent.scriptMethods.update, dt);
                }
            }

            self._endLooping(wasLooping);
        },

        _onPostUpdate: function (dt) {
            var self = this;
            var list = self._postUpdateList;
            if (! list.length) return;

            var wasLooping = self._beginLooping();

            var script;

            for (list.loopIndex = 0; list.loopIndex < list.length; list.loopIndex++) {
                script = list.items[list.loopIndex];
                if (script.enabled) {
                    self._scriptMethod(script, ScriptComponent.scriptMethods.postUpdate, dt);
                }
            }

            self._endLooping(wasLooping);
        },

        /**
         * @private
         * Inserts script instance into the scripts array at the specified index. Also inserts the script
         * into the update list if it has an update method and the post update list if it has a postUpdate method.
         * @param {Object} scriptInstance The script instance
         * @param {Number} index The index where to insert the script at. If -1 then append it at the end.
         * @param {Number} scriptsLength The length of the scripts array.
         */
        _insertScriptInstance: function (scriptInstance, index, scriptsLength) {
            if (index === -1) {
                // append script at the end and set execution order
                this._scripts.push(scriptInstance);
                scriptInstance.__executionOrder = scriptsLength;

                // append script to the update list if it has an update method
                if (scriptInstance.update) {
                    this._updateList.append(scriptInstance);
                }

                // add script to the postUpdate list if it has a postUpdate method
                if (scriptInstance.postUpdate) {
                    this._postUpdateList.append(scriptInstance);
                }
            } else {
                // insert script at index and set execution order
                this._scripts.splice(index, 0, scriptInstance);
                scriptInstance.__executionOrder = index;

                // now we also need to update the execution order of all
                // the script instances that come after this script
                this._resetExecutionOrder(index + 1, scriptsLength + 1);

                // insert script to the update list if it has an update method
                // in the right order
                if (scriptInstance.update) {
                    this._updateList.insert(scriptInstance);
                }

                // insert script to the postUpdate list if it has a postUpdate method
                // in the right order
                if (scriptInstance.postUpdate) {
                    this._postUpdateList.insert(scriptInstance);
                }
            }
        },

        _removeScriptInstance: function (scriptInstance) {
            var idx = this._scripts.indexOf(scriptInstance);
            if (idx === -1) return idx;

            this._scripts.splice(idx, 1);

            if (scriptInstance.update) {
                this._updateList.remove(scriptInstance);
            }

            if (scriptInstance.postUpdate) {
                this._postUpdateList.remove(scriptInstance);
            }

            return idx;
        },

        _resetExecutionOrder: function (startIndex, scriptsLength) {
            for (var i = startIndex; i < scriptsLength; i++) {
                this._scripts[i].__executionOrder = i;
            }
        },

        /**
         * @function
         * @name pc.ScriptComponent#has
         * @description Detect if script is attached to an entity using name of {@link ScriptType}.
         * @param {String} name The name of the Script Type
         * @returns {Boolean} If script is attached to an entity
         * @example
         * if (entity.script.has('playerController')) {
         *     // entity has script
         * }
         */
        has: function (name) {
            var scriptType = name;

            // shorthand using script name
            if (typeof scriptType === 'string')
                scriptType = this.system.app.scripts.get(scriptType);

            return !!this._scriptsIndex[scriptType.__name];
        },

        /**
         * @function
         * @name pc.ScriptComponent#create
         * @description Create a script instance using name of a {@link ScriptType} and attach to an entity script component.
         * @param {String} name The name of the Script Type
         * @param {Object} [args] Object with arguments for a script
         * @param {Boolean} [args.enabled] if script instance is enabled after creation
         * @param {Object} [args.attributes] Object with values for attributes, where key is name of an attribute
         * @returns {ScriptType} Returns an instance of a {@link ScriptType} if successfully attached to an entity,
         * or null if it failed because a script with a same name has already been added
         * or if the {@link ScriptType} cannot be found by name in the {@link pc.ScriptRegistry}.
         * @example
         * entity.script.create('playerController', {
         *     attributes: {
         *         speed: 4
         *     }
         * });
         */
        create: function (name, args) {
            var self = this;
            args = args || { };

            var scriptType = name;
            var scriptName = name;

            // shorthand using script name
            if (typeof scriptType === 'string') {
                scriptType = this.system.app.scripts.get(scriptType);
            } else if (scriptType) {
                scriptName = scriptType.__name;
            }

            if (scriptType) {
                if (!this._scriptsIndex[scriptType.__name] || !this._scriptsIndex[scriptType.__name].instance) {
                    // create script instance
                    var scriptInstance = new scriptType({
                        app: this.system.app,
                        entity: this.entity,
                        enabled: args.hasOwnProperty('enabled') ? args.enabled : true,
                        attributes: args.attributes || null
                    });

                    var len = this._scripts.length;
                    var ind = -1;
                    if (typeof args.ind === 'number' && args.ind !== -1 && len > args.ind)
                        ind = args.ind;

                    this._insertScriptInstance(scriptInstance, ind, len);

                    this._scriptsIndex[scriptType.__name] = {
                        instance: scriptInstance,
                        onSwap: function () {
                            self.swap(scriptType.__name);
                        }
                    };

                    this[scriptType.__name] = scriptInstance;

                    if (!args.preloading)
                        scriptInstance.__initializeAttributes();

                    this.fire('create', scriptType.__name, scriptInstance);
                    this.fire('create:' + scriptType.__name, scriptInstance);

                    this.system.app.scripts.on('swap:' + scriptType.__name, this._scriptsIndex[scriptType.__name].onSwap);

                    if (!args.preloading) {

                        if (scriptInstance.enabled && !scriptInstance._initialized) {
                            scriptInstance._initialized = true;

                            if (scriptInstance.initialize)
                                this._scriptMethod(scriptInstance, ScriptComponent.scriptMethods.initialize);
                        }

                        if (scriptInstance.enabled && !scriptInstance._postInitialized) {
                            scriptInstance._postInitialized = true;
                            if (scriptInstance.postInitialize)
                                this._scriptMethod(scriptInstance, ScriptComponent.scriptMethods.postInitialize);
                        }
                    }


                    return scriptInstance;
                }

                console.warn('script \'' + scriptName + '\' is already added to entity \'' + this.entity.name + '\'');
            } else {
                this._scriptsIndex[scriptName] = {
                    awaiting: true,
                    ind: this._scripts.length
                };

                console.warn('script \'' + scriptName + '\' is not found, awaiting it to be added to registry');
            }

            return null;
        },

        /**
         * @function
         * @name pc.ScriptComponent#destroy
         * @description Destroy the script instance that is attached to an entity.
         * @param {String} name The name of the Script Type
         * @returns {Boolean} If it was successfully destroyed
         * @example
         * entity.script.destroy('playerController');
         */
        destroy: function (name) {
            var scriptName = name;
            var scriptType = name;

            // shorthand using script name
            if (typeof scriptType === 'string') {
                scriptType = this.system.app.scripts.get(scriptType);
                if (scriptType)
                    scriptName = scriptType.__name;
            }

            var scriptData = this._scriptsIndex[scriptName];
            delete this._scriptsIndex[scriptName];
            if (!scriptData) return false;

            if (scriptData.instance && !scriptData.instance._destroyed) {
                scriptData.instance.enabled = false;
                scriptData.instance._destroyed = true;

                // if we are not currently looping through our scripts
                // then it's safe to remove the script
                if (!this._isLoopingThroughScripts) {
                    var ind = this._removeScriptInstance(scriptData.instance);
                    if (ind >= 0) {
                        this._resetExecutionOrder(ind, this._scripts.length);
                    }
                } else {
                    // otherwise push the script in _destroyedScripts and
                    // remove it from _scripts when the loop is over
                    this._destroyedScripts.push(scriptData.instance);
                }
            }

            // remove swap event
            this.system.app.scripts.off('swap:' + scriptName, scriptData.onSwap);

            delete this[scriptName];

            this.fire('destroy', scriptName, scriptData.instance || null);
            this.fire('destroy:' + scriptName, scriptData.instance || null);

            if (scriptData.instance)
                scriptData.instance.fire('destroy');

            return true;
        },

        swap: function (script) {
            var scriptType = script;

            // shorthand using script name
            if (typeof scriptType === 'string')
                scriptType = this.system.app.scripts.get(scriptType);

            var old = this._scriptsIndex[scriptType.__name];
            if (!old || !old.instance) return false;

            var scriptInstanceOld = old.instance;
            var ind = this._scripts.indexOf(scriptInstanceOld);

            var scriptInstance = new scriptType({
                app: this.system.app,
                entity: this.entity,
                enabled: scriptInstanceOld.enabled,
                attributes: scriptInstanceOld.__attributes
            });

            if (!scriptInstance.swap)
                return false;

            scriptInstance.__initializeAttributes();

            // add to component
            this._scripts[ind] = scriptInstance;
            this._scriptsIndex[scriptType.__name].instance = scriptInstance;
            this[scriptType.__name] = scriptInstance;

            // set execution order and make sure we update
            // our update and postUpdate lists
            scriptInstance.__executionOrder = ind;
            if (scriptInstanceOld.update) {
                this._updateList.remove(scriptInstanceOld);
            }
            if (scriptInstanceOld.postUpdate) {
                this._postUpdateList.remove(scriptInstanceOld);
            }

            if (scriptInstance.update) {
                this._updateList.insert(scriptInstance);
            }
            if (scriptInstance.postUpdate) {
                this._postUpdateList.insert(scriptInstance);
            }

            this._scriptMethod(scriptInstance, ScriptComponent.scriptMethods.swap, scriptInstanceOld);

            this.fire('swap', scriptType.__name, scriptInstance);
            this.fire('swap:' + scriptType.__name, scriptInstance);

            return true;
        },

        /**
         * @function
         * @private
         * @name pc.ScriptComponent#resolveDuplicatedEntityReferenceProperties
         * @description When an entity is cloned and it has entity script attributes that point
         * to other entities in the same subtree that is cloned, then we want the new script attributes to point
         * at the cloned entities. This method remaps the script attributes for this entity and it assumes that this
         * entity is the result of the clone operation.
         * @param {pc.ScriptComponent} oldScriptComponent The source script component that belongs to the entity that was being cloned.
         * @param {Object} duplicatedIdsMap A dictionary with guid-entity values that contains the entities that were cloned
         */
        resolveDuplicatedEntityReferenceProperties: function (oldScriptComponent, duplicatedIdsMap) {
            var newScriptComponent = this.entity.script;

            // for each script in the old compononent
            for (var scriptName in oldScriptComponent._scriptsIndex) {
                // get the script type from the script registry
                var scriptType = this.system.app.scripts.get(scriptName);
                if (! scriptType) {
                    continue;
                }

                // get the script from the component's index
                var script = oldScriptComponent._scriptsIndex[scriptName];
                if (! script || ! script.instance) {
                    continue;
                }

                // if __attributesRaw exists then it means that the new entity
                // has not yet initialized its attributes so put the new guid in there,
                // otherwise it means that the attributes have already been initialized
                // so convert the new guid to an entity
                // and put it in the new attributes
                var newAttributesRaw = newScriptComponent[scriptName].__attributesRaw;
                var newAttributes = newScriptComponent[scriptName].__attributes;
                if (! newAttributesRaw && ! newAttributes) {
                    continue;
                }

                // get the old script attributes from the instance
                var oldAttributes = script.instance.__attributes;
                for (var attributeName in oldAttributes) {
                    if (! oldAttributes[attributeName]) {
                        continue;
                    }

                    // get the attribute definition from the script type
                    var attribute = scriptType.attributes.get(attributeName);
                    if (! attribute || attribute.type !== 'entity') {
                        continue;
                    }

                    if (attribute.array) {
                        // handle entity array attribute
                        var oldGuidArray = oldAttributes[attributeName];
                        var len = oldGuidArray.length;
                        if (! len) {
                            continue;
                        }

                        var newGuidArray = oldGuidArray.slice();
                        for (var i = 0; i < len; i++) {
                            var guid = newGuidArray[i] instanceof pc.Entity ? newGuidArray[i].getGuid() : newGuidArray[i];
                            if (duplicatedIdsMap[guid]) {
                                // if we are using attributesRaw then use the guid otherwise use the entity
                                newGuidArray[i] = newAttributesRaw ? duplicatedIdsMap[guid].getGuid() : duplicatedIdsMap[guid];
                            }
                        }

                        if (newAttributesRaw) {
                            newAttributesRaw[attributeName] = newGuidArray;
                        } else {
                            newAttributes[attributeName] = newGuidArray;
                        }
                    } else {
                        // handle regular entity attribute
                        var oldGuid = oldAttributes[attributeName];
                        if (oldGuid instanceof pc.Entity) {
                            oldGuid = oldGuid.getGuid();
                        } else if (typeof oldGuid !== 'string') {
                            continue;
                        }

                        if (duplicatedIdsMap[oldGuid]) {
                            if (newAttributesRaw) {
                                newAttributesRaw[attributeName] = duplicatedIdsMap[oldGuid].getGuid();
                            } else {
                                newAttributes[attributeName] = duplicatedIdsMap[oldGuid];
                            }
                        }

                    }
                }
            }
        },

        /**
         * @function
         * @name pc.ScriptComponent#move
         * @description Move script instance to different position to alter update order of scripts within entity.
         * @param {String} name The name of the Script Type
         * @param {Number} ind New position index
         * @returns {Boolean} If it was successfully moved
         * @example
         * entity.script.move('playerController', 0);
         */
        move: function (name, ind) {
            var len = this._scripts.length;
            if (ind >= len || ind < 0)
                return false;

            var scriptName = name;

            if (typeof scriptName !== 'string')
                scriptName = name.__name;

            var scriptData = this._scriptsIndex[scriptName];
            if (!scriptData || !scriptData.instance)
                return false;

            var indOld = this._scripts.indexOf(scriptData.instance);
            if (indOld === -1 || indOld === ind)
                return false;

            // move script to another position
            this._scripts.splice(ind, 0, this._scripts.splice(indOld, 1)[0]);

            // reset execution order for scripts and re-sort update and postUpdate lists
            this._resetExecutionOrder(0, len);
            this._updateList.sort();
            this._postUpdateList.sort();

            this.fire('move', scriptName, scriptData.instance, ind, indOld);
            this.fire('move:' + scriptName, scriptData.instance, ind, indOld);

            return true;
        }
    });

    Object.defineProperty(ScriptComponent.prototype, 'enabled', {
        get: function () {
            return this._enabled;
        },
        set: function (value) {
            var oldValue = this._enabled;
            this._enabled = value;
            this.fire('set', 'enabled', oldValue, value);
        }
    });

    Object.defineProperty(ScriptComponent.prototype, 'scripts', {
        get: function () {
            return this._scripts;
        },
        set: function (value) {
            this._scriptsData = value;

            for (var key in value) {
                if (!value.hasOwnProperty(key))
                    continue;

                var script = this._scriptsIndex[key];
                if (script) {
                    // existing script

                    // enabled
                    if (typeof value[key].enabled === 'boolean')
                        script.enabled = !!value[key].enabled;

                    // attributes
                    if (typeof value[key].attributes === 'object') {
                        for (var attr in value[key].attributes) {
                            if (pc.createScript.reservedAttributes[attr])
                                continue;

                            if (!script.__attributes.hasOwnProperty(attr)) {
                                // new attribute
                                var scriptType = this.system.app.scripts.get(key);
                                if (scriptType)
                                    scriptType.attributes.add(attr, { });
                            }

                            // update attribute
                            script[attr] = value[key].attributes[attr];
                        }
                    }
                } else {
                    // TODO scripts2
                    // new script
                    console.log(this.order);
                }
            }
        }
    });

    return {
        ScriptComponent: ScriptComponent
    };
}());
