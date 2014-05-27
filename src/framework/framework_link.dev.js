pc.extend(editor, function () {
    var LinkInterface = function () {
        this.exposed = {}; // dictionary of exposed variables by system type
        this.added = {}; // dictionary of added variables, deprecated...
        this.scripts =  {}; // dictionary of exposed script variables, not used
        this.systems = []; // list of registered system names
    };

    /**
     * Expose a Component
     * @param {Object} componentSystem
     */
    LinkInterface.prototype.addComponentType = function(componentSystem) {
        var name = componentSystem.id;
        var i;
        var systems = this.systems;
        var length = systems.length;
        var exists = false;

        for( i=0; i<length; i++ ) {
            if( systems[i].name === name ) {
                exists = true;
                break;
            }
        }

        if (!exists) {
            this.systems.push({"name" : name, "description" : componentSystem.description});
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

        if (details.type === 'vector') {
            // indicate that this is an array type (and therefore is a reference type and needs copying)
            details.array = true;
            // Provide an RuntimeType which is instatiated after passing an object over livelink
            if (details.defaultValue) {
                switch(details.defaultValue.length) {
                    case 2:
                        details.RuntimeType = pc.Vec2;
                        break;
                    case 3:
                        details.RuntimeType = pc.Vec3;
                        break;
                    case 4:
                        details.RuntimeType = pc.Vec4;
                        break;
                }
            } else {
                details.RuntimeType = pc.Vec3;
            }
        }

        if (details.type === 'rgb' ||
            details.type === 'rgba') {
            // indicate that this is an array type (and therefore is a reference type and needs copying)
            details.array = true;
            // Provide an RuntimeType which is instatiated after passing an object over livelink
            details.RuntimeType = pc.Color;
        }

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
