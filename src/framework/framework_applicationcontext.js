pc.extend(pc.fw, function() {
    /**
     * @class ApplicationContext contains 'global' data for the Application.
     * The context is available to all Components and all user scripts and can be used to access the EntityManager and the ComponentRegistry.
     * @constructor Create a new ApplicationContext
     * @name pc.fw.ApplicationContext
     * @param {pc.resources.ResourceLoader} loaders LoaderManager which is used to load resources
     * @param {Object} scene Used to manage models to render
     * @param {Object} registry ComponentSystemRegistry stores all the ComponentSystems and is used to access Component data
     * @param {Object} [options] Optional extras such as input handlers      
     * @param {Object} [options.controller] Generic controller for getting user input
     * @param {Object} [options.keyboard] Keyboard controller for getting user input
     * @param {Object} [options.mouse] Mouse controller for getting user input
     * @param {Object} [options.gamepads] GamePads controller for getting user input
     */
    var ApplicationContext = function (loader, scene, registry, options) {
        this.loader = loader;
        this.scene = scene;
        this.root = new pc.fw.Entity();

        var prefix = options.depot ? options.depot.assets.getServer().getBaseUrl() : null;
        this.assets = new pc.fw.AssetCache(prefix);
        
        /**
         * @name pc.fw.ApplicationContext#components
         * @description The ComponentSystemRegistry instance.
         */
        this.systems = registry;
            
        options = options || {};
        /**
         * @name pc.fw.ApplicationContext#controller
         * @description General input handler
         */
        this.controller = options.controller;
        /**
         * @name pc.fw.ApplicationContext#keyboard
         * @description Input handler for the keyboard if available
         */
        this.keyboard = options.keyboard;
        
        /**
         * @name pc.fw.ApplicationContext#mouse
         * @description Input handler for the mouse if available
         */
        this.mouse = options.mouse;

        /**
        * @name pc.fw.ApplicationContext#gamepads
        * @description INput handler for gamepads if available
        */
        this.gamepads = options.gamepads;
    };
    
    return {
        ApplicationContext: ApplicationContext
    };
}());
