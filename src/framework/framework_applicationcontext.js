pc.extend(pc.fw, function() {
    /**
     * @class ApplicationContext contains 'global' data for the Application.
     * The context is available to all Components and all user scripts and can be used to access the EntityManager and the ComponentRegistry.
     * @constructor Create a new ApplicationContext
     * @name pc.fw.ApplicationContext
     * @param {pc.resources.ResourceLoader} loaders LoaderManager which is used to load resources
     * @param {Object} scene Used to manage models to render
     * @param {Object} registry ComponentSystemRegistry stores all the ComponentSystems and is used to access Component data
     * @param {Object} [controller] Generic controller for getting user input
     * @param {Object} [keyboard] Keyboard controller for getting user input
     * @param {Object} [mouse] Mouse controller for getting user input
     */
    var ApplicationContext = function (loader, scene, registry, controller, keyboard, mouse) {
        this.loader = loader;
        this.scene = scene;
        this.root = new pc.fw.Entity();
        
        /**
         * @name pc.fw.ApplicationContext#components
         * @description The ComponentSystemRegistry instance.
         */
        this.systems = registry;
        
        /**
         * @name pc.fw.ApplicationContext#controller
         * @description General input handler
         */
        this.controller = controller;
        /**
         * @name pc.fw.ApplicationContext#keyboard
         * @description Input handler for the keyboard if available
         */
        this.keyboard = keyboard;
        
        /**
         * @name pc.fw.ApplicationContext#mouse
         * @description Input handler for the mouse if available
         */
        this.mouse = mouse;
    }
    
    return {
        ApplicationContext: ApplicationContext
    }
}());
