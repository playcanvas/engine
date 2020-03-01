Object.assign(pc, function () {
    /**
     * @static
     * @function
     * @name pc.createScript
     * @description Method to create named {@link pc.ScriptType}.
     * It returns new function (class) "Script Type", which is auto-registered to {@link pc.ScriptRegistry} using it's name.
     * This is the main interface to create Script Types, to define custom logic using JavaScript, that is used to create interaction for entities.
     * @param {string} name - Unique Name of a Script Type.
     * If a Script Type with the same name has already been registered and the new one has a `swap` method defined in its prototype,
     * then it will perform hot swapping of existing Script Instances on entities using this new Script Type.
     * Note: There is a reserved list of names that cannot be used, such as list below as well as some starting from `_` (underscore):
     * system, entity, create, destroy, swap, move, scripts, onEnable, onDisable, onPostStateChange, has, on, off, fire, once, hasEvent.
     * @param {pc.Application} [app] - Optional application handler, to choose which {@link pc.ScriptRegistry} to add a script to.
     * By default it will use `pc.Application.getApplication()` to get current {@link pc.Application}.
     * @returns {pc.ScriptType} The constructor of a {@link pc.ScriptType}, which the developer is meant to extend by adding attributes and prototype methods.
     * @example
     * var Turning = pc.createScript('turn');
     *
     * // define `speed` attribute that is available in Editor UI
     * Turning.attributes.add('speed', {
     *     type: 'number',
     *     default: 180,
     *     placeholder: 'deg/s'
     * });
     *
     * // runs every tick
     * Turning.prototype.update = function (dt) {
     *     this.entity.rotate(0, this.speed * dt, 0);
     * };
     */
    var createScript = function (name, app) {
        if (pc.script.legacy) {
            // #ifdef DEBUG
            console.error("This project is using the legacy script system. You cannot call pc.createScript(). See: http://developer.playcanvas.com/en/user-manual/scripting/legacy/");
            // #endif
            return null;
        }

        if (createScript.reservedScripts[name])
            throw new Error('script name: \'' + name + '\' is reserved, please change script name');

        var script = function (args) {
            pc.ScriptType.call(this, args);
        };

        script.prototype = Object.create(pc.ScriptType.prototype);

        script.__name = name;

        script.attributes = new pc.ScriptAttributes(script);

        // add to scripts registry
        var registry = app ? app.scripts : pc.Application.getApplication().scripts;
        registry.add(script);

        pc.ScriptHandler._push(script);

        return script;
    };

    // reserved scripts
    createScript.reservedScripts = [
        'system', 'entity', 'create', 'destroy', 'swap', 'move',
        'scripts', '_scripts', '_scriptsIndex', '_scriptsData',
        'enabled', '_oldState', 'onEnable', 'onDisable', 'onPostStateChange',
        '_onSetEnabled', '_checkState', '_onBeforeRemove',
        '_onInitializeAttributes', '_onInitialize', '_onPostInitialize',
        '_onUpdate', '_onPostUpdate',
        '_callbacks', 'has', 'on', 'off', 'fire', 'once', 'hasEvent'
    ];
    var reservedScripts = { };
    var i;
    for (i = 0; i < createScript.reservedScripts.length; i++)
        reservedScripts[createScript.reservedScripts[i]] = 1;
    createScript.reservedScripts = reservedScripts;


    // reserved script attribute names
    createScript.reservedAttributes = [
        'app', 'entity', 'enabled', '_enabled', '_enabledOld', '_destroyed',
        '__attributes', '__attributesRaw', '__scriptType', '__executionOrder',
        '_callbacks', 'has', 'on', 'off', 'fire', 'once', 'hasEvent'
    ];
    var reservedAttributes = { };
    for (i = 0; i < createScript.reservedAttributes.length; i++)
        reservedAttributes[createScript.reservedAttributes[i]] = 1;
    createScript.reservedAttributes = reservedAttributes;


    return {
        createScript: createScript
    };
}());
