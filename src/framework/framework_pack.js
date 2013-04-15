pc.extend(pc.fw, function () {
    return {
        /**
         * @function
         * @name pc.fw.loadPack
         * @description Load and initialise a new Pack. The Pack is loaded, added to the root of the hierarchy and any new scripts are initialized.
         * @param {String} guid The GUID of the Pack to load
         * @param {pc.fw.ApplicationContext} context The ApplicationContext containing the root hierarchy and the ScriptComponentSystem
         * @param {Function} success Callback fired when the Pack is loaded and initialized, passed the new Entity that was created
         * @param {Function} error Callback fired if there are problems, passed a list of error messages
         * @param {Function} progress Callback fired on each progress event, usually when a file or Entity is loaded, passed a percentage complete value
         */
        loadPack: function (guid, context, success, error, progress) {
            var request = new pc.resources.PackRequest(guid);
            context.loader.request(request, function (resources) {
                var pack = resources[guid];

                // add to hierarchy
                context.root.addChild(pack.hierarchy);
                
                // Initialise any systems with an initialize() method after pack is loaded
                pc.fw.ComponentSystem.initialize(pack.hierarchy);
                
                // callback
                if (success) {
                    success(pack);    
                }
            }.bind(this), function (errors) {
                // error
                if (error) {
                    error(errors);    
                }
            }.bind(this), function (value) {
                // progress
                if (progress) {
                    progress(value); 
                }
            }.bind(this));            
        }
    };
}());