/**
 * @name pc.script
 * @namespace User Scripts
 */
pc.script = (function () {
    var _main = null;
    var _loader = null;

    var script = {
        // set during script load to be used for initializing script
        app: null,

        /**
         * Register the main game script resource, this is executed by called pc.script.start()
         * @function
         * @name pc.script.main
         */
        // main: function (callback) {
        //     if(_main) {
        //         throw new Error("'main' Object already registered");
        //     }
        //     _main = callback;
        // },

        // setLoader: function(loader) {
        //     if(loader && _loader) {
        //         throw new Error("pc.script already has loader object.");
        //     }

        //     _loader = loader;
        // },

        /**
         * @function
         * @name pc.script.create
         * @description Create a script resource object. A script file should contain a single call to pc.script.create and the callback should return a script object which will be
         * instanciated when attached to Entities.
         * @param {string} name The name of the script object.
         * @param {function} callback The callback function which is passed an {pc.Application} object,
         * which is used to access Entities and Components, and should return the Type of the script resource
         * to be instanced for each Entity.
         * @example
         * pc.script.create( function (app) {
         *  var Scriptable = function (entity) {
         *      // store entity
         *      this.entity = entity;
         *
         *      // use app
         *      app.components.model.addComponent(entity, {...});
         *  };
         *
         *  return Scriptable;
         * }
         */
        create: function (name, callback) {
            if (callback === undefined) {
                callback = attributes;
            }

            // get the ScriptType from the callback
            var ScriptType = callback(pc.script.app);

            // store the script name
            ScriptType._pcScriptName = name;

            // Push this onto loading stack
            pc.ScriptHandler._push(ScriptType);

            this.fire("created", name, callback);
        },

        /**
        * @function
        * @name pc.script.attribute
        * @description Creates a script attribute for the current script. The script attribute can be accessed
        * inside the script instance like so 'this.attributeName' or outside a script instance like so 'entity.script.attributeName'.
        * Script attributes can be edited from the Attribute Editor of the PlayCanvas Editor like normal Components.
        * @param {string} name The name of the attribute
        * @param {string} type The type of the attribute. Can be one of the following: 'number', 'string', 'boolean', 'asset', 'entity', 'rgb', 'rgba', 'vector', 'enumeration', 'curve', 'colorcurve'
        * @param {Object} defaultValue The default value of the attribute
        * @param {Object} options Optional parameters for the attribute. Valid values are:
        * <ul>
        *   <li>{Number} min: The minimum value of the attribute</li>
        *   <li>{Number} max: The maximum value of the attribute</li>
        *   <li>{Number} step: The step that will be used when changing the attribute value in the PlayCanvas Editor</li>
        *   <li>{Number} decimalPrecision: A number that specifies the number of decimal digits allowed for the value</li>
        *   <li>{Array} enumerations: An array of name, value pairs from which the user can select one if the attribute type is an enumeration</li>
        *   <li>{Array} curves: (For 'curve' attributes only) An array of strings that define the names of each curve in the curve editor.</li>
        *   <li>{Array} color: (For 'curve' attributes only) If true then the curve attribute will be a color curve.</li>
        * </ul>
        * @example
        * pc.script.attribute('speed', 'number', 5);
        * pc.script.attribute('message', 'string', "My message");
        * pc.script.attribute('enemyPosition', 'vector', [1,0,0]);
        * pc.script.attribute('spellType', 'enumeration', 0, {
        *     enumerations: [{
        *        name: "Fire",
        *        value: 0
        *     }, {
        *        name: "Ice",
        *        value: 1
        *     }]
        *  });
        * pc.script.attribute('enemy', 'entity');
        * pc.script.attribute('enemySpeed', 'curve');
        * pc.script.attribute('enemyPosition', 'curve', null, {
        *     curves: ['x', 'y', 'z']
        * });
        * pc.script.attribute('color', 'colorcurve', null, {
        *     type: 'rgba'
        * });
        *
        * pc.script.create('scriptable', function (app) {
        *  var Scriptable = function (entity) {
        *      // store entity
        *      this.entity = entity;
        *  };
        *
        *  return Scriptable;
        * }
        */
        attribute: function (name, type, defaultValue, options) {
            // only works when parsing the script...
        },

        /**
         * @function
         * @name pc.script.createLoadingScreen
         * @description Handles the creation of the loading screen of the application. A script can subscribe to
         * the events of a {@link pc.Application} to show a loading screen, progress bar etc. In order for this to work
         * you need to set the project's loading screen script to the script that calls this method.
         * @param  {Function} callback A function which can set up and tear down a customised loading screen.
         * @example
         * pc.script.createLoadingScreen(function (app) {
         *     var showSplashScreen = function () { // }
         *     var hideSplashScreen = function () { // }
         *     var showProgress = function (progress) { // }
         *     app.on("preload:start", showSplashScreen);
         *     app.on("preload:progress", showProgress);
         *     app.on("start", hideSplashScreen);
         * });
         */
        createLoadingScreen: function (callback) {
            var app = pc.Application.getApplication();
            callback(app);
        },

        /**
         * Begin the scripted application by calling the function passed in to pc.script.main()
         * @function
         * @name pc.script.start
         */
        // start: function () {
        //     _main();
        // }
    };

    pc.events.attach(script);

    return script;
}());
