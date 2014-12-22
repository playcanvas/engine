/**
 * @name pc.script
 * @namespace User Scripts
 */
pc.script = (function () {
    var _main = null;
    var _loader = null;

    var script = {
        /**
         * Register the main game script resource, this is executed by called pc.script.start()
         * @function
         * @name pc.script.main
         */
        main: function (callback) {
            if(_main) {
                throw new Error("'main' Object already registered");
            }
            _main = callback;
        },

        setLoader: function(loader) {
            if(loader && _loader) {
                throw new Error("pc.script already has loader object.");
            }

            _loader = loader;
        },

        /**
         * @function
         * @name pc.script.create
         * @description Create a script resource object. A script file should contain a single call to pc.script.create and the callback should return a script object which will be
         * instanciated when attached to Entities.
         * @param {Object} name The name of the script object.
         * @param {Object} callback The callback function which is passed an {pc.ApplicationContext} object,
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
            //_loader.add(name, callback);
            this.fire("created", name, callback);
        },

        /**
        * @function
        * @name pc.script.attribute
        * @description Creates a script attribute for the current script. The script attribute can be accessed
        * inside the script instance like so 'this.attributeName' or outside a script instance like so 'entity.script.attributeName'.
        * Script attributes can be edited from the Attribute Editor of the designer like normal Components.
        * @param {string} name The name of the attribute
        * @param {string} type The type of the attribute. Can be one of the following: 'number', 'string', 'boolean', 'asset', 'rgb', 'rgba', 'vector', 'enumeration'
        * @param {Object} defaultValue The default value of the attribute
        * @param {Object} options Optional parameters for the attribute. Valid values are:
        * <ul>
        *   <li>{Number} min: The minimum value of the attribute</li>
        *   <li>{Number} max: The maximum value of the attribute</li>
        *   <li>{Number} step: The step that will be used when changing the attribute value in the designer</li>
        *   <li>{Number} decimalPrecision: A number that specifies the number of decimal digits allowed for the value</li>
        *   <li>{Array} enumerations: An array of name, value pairs from which the user can select one if the attribute type is an enumeration</li>
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
         * Begin the scripted application by calling the function passed in to pc.script.main()
         * @function
         * @name pc.script.start
         */
        start: function () {
            _main();
        }
    };

    pc.events.attach(script);

    return script;
}());
