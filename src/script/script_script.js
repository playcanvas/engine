/**
 * @namespace Functionality for starting the user scripted part of the engine
 * @name pc.script
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
         * Create a script resource object. A script file should contain a single call to pc.script.create and the callback should return a script object which will be
         * instanciated when attached to Entities.
         * @param {Object} name The name of the script object.
         * @param {Object} callback The callback function which is passed an {pc.fw.ApplicationContext} object, 
         * which is used to access Entities and Components, and should return the Type of the script resource 
         * to be instanced for each Entity.
         * @example
         * pc.script.create( function (context) {
         *  var Scriptable = function (entity) {
         *      // store entity
         *      this.entity = entity;
         *      
         *      // use context ...
         *      context.components.model.createComponent(entity);
         *  };
         *  
         *  return Scriptable;
         * }
         */
        create: function (name, callback) {
            //_loader.add(name, callback);
            this.fire("created", name, callback);
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
    
    pc.extend(script, pc.events);
        
    return script;
}());