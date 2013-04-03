pc.extend(editor, function () {
    var LinkInterface = function () {
        this.exposed = {}; // dictionary of exposed variables by system type
        this.added = {}; // dictionary of added variables, deprecated...
        this.scripts =  {}; // dictionary of exposed script variables, not used
        this.systems = []; // list of registered system names
    };

    /** 
     * Expose a Component
     * @param {Object} name
     */
    LinkInterface.prototype.addComponentType = function(name) {
        if (this.systems.indexOf(name) < 0) {
            this.systems.push(name);
        }

        if (!this.exposed[name]) {
            this.exposed[name] = {};
        }
    };

    
    /**
     * Expose a property of an object to the editor. This property will appear in the attribute editor control
     * @param {Object} details
     */
    LinkInterface.prototype.expose = function (system, details) {    
        if(!details.name) {
            throw new Error("Missing option 'name'");
        }
        
        // Add default values
        details.options = details.options || {};        


        if (!this.exposed[system][details.name]) {
            this.exposed[system][details.name] = {};
        }
        
        this.exposed[system][details.name] = details;
    };
    
    /**
     * Add a property to the added list. Added properties are created in the viewmodels and can be used internally.
     * They are never visible in the Designer
     * @param {Object} details
     */
    LinkInterface.prototype.add = function (details) {
        logASSERT(details.system, "Missing option: 'system'");
        logASSERT(details.variable, "Missing option: 'variable'");
        
        if(!this.added[details.system]) {
            this.added[details.system] = {};
        }
        if(!this.added[details.system][details.variable]) {
            this.added[details.system][details.variable] = {};
        }        
        this.added[details.system][details.variable] = details;
    };
    
    LinkInterface.prototype.scriptexpose = function (details) {
        this.scripts[details.script] = details;    
    };
    
    return {
        LinkInterface: LinkInterface,
        link: new LinkInterface()
    };
}());
