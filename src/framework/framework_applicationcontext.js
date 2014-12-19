pc.extend(pc.fw, function() {
    /**
     * @class ApplicationContext contains 'global' data for the Application.
     * The context is available to all Components and all user scripts and can be used to access the EntityManager and the ComponentRegistry.
     * @constructor Create a new ApplicationContext
     * @name pc.fw.ApplicationContext
     * @param {pc.resources.ResourceLoader} loaders LoaderManager which is used to load resources
     * @param {pc.scene.Scene} scene Used to manage models to render
     * @param {pc.GraphicsDevice} graphicsDevice Global graphics device
     * @param {Object} registry ComponentSystemRegistry stores all the ComponentSystems and is used to access Component data
     * @param {Object} [options] Optional extras such as input handlers      
     * @param {Object} [options.controller] Generic controller for getting user input
     * @param {Object} [options.keyboard] Keyboard controller for getting user input
     * @param {Object} [options.mouse] Mouse controller for getting user input
     * @param {Object} [options.gamepads] GamePads controller for getting user input
     */
    var ApplicationContext = function (loader, scene, graphicsDevice, registry, options) {
        this.loader = loader;
        this.scene = scene;
        this.graphicsDevice = graphicsDevice;

        /**
         * @name pc.fw.ApplicationContext#root
         * @description The root node of Entity hierarchy. Use this to access any Entity that was added in the Designer or created in code.
         * @type pc.fw.Entity
         * @example
         * var entity = context.root.findByName("My Entity");
         */
        this.root = new pc.fw.Entity();

        var prefix = options.depot ? options.depot.assets.getServer().getBaseUrl() : null;
        
        /**
        * @name pc.fw.ApplicationContext#assets
        * @description The registry of assets that are available to use.
        * @type pc.fw.AssetRegistry
        * @example
        * var asset = context.assets.find("player_model", pc.asset.ASSET_MODEL);
        * context.assets.load(asset).then(function (models) {
        *     var playerModel = models[0];
        * )});
        */
        this.assets = new pc.asset.AssetRegistry(this.loader, prefix);
        
        /**
         * @name pc.fw.ApplicationContext#systems
         * @description Use this to access all the Component Systems by name. 
         * Component Systems are used to modify properties that relate to an entire Component type. 
         * @type pc.fw.ComponentSystemRegistry
         * @example
         * context.systems.rigidbody.setGravity(0, 10, 0); // set the gravity for all rigidbody components
         */
        this.systems = registry;
            
        options = options || {};
        
        /**
         * @name pc.fw.ApplicationContext#controller
         * @description General input handler
         * @type pc.input.Controller
         */
        this.controller = options.controller;
        /**
         * @name pc.fw.ApplicationContext#keyboard
         * @description Input handler for the keyboard if available
         * @type pc.input.Keyboard
         */
        this.keyboard = options.keyboard;
        
        /**
         * @name pc.fw.ApplicationContext#mouse
         * @description Input handler for the mouse if available
         * @type pc.input.Mouse
         */
        this.mouse = options.mouse;

        /**
         * @name pc.fw.ApplicationContext#touch
         * @description Input handler for touch events if available
         * @type pc.input.TouchDevice
         */
        this.touch = options.touch;

        /**
        * @name pc.fw.ApplicationContext#gamepads
        * @description Input handler for gamepads if available
        * @type pc.input.GamePads
        */
        this.gamepads = options.gamepads;
    };
    
    return {
        ApplicationContext: ApplicationContext
    };
}());
