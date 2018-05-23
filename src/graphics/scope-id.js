pc.extend(pc, function () {
    'use strict';

    function ScopeId(name) {
        // Set the name
        this.name = name;

        // Set the default value
        this.value = null;

        // Create the version object
        this.versionObject = new pc.VersionedObject();
    }

    ScopeId.prototype = {
        constructor: ScopeId,

        setValue: function (value) {
            // Set the new value
            this.value = value;

            // Increment the revision
            this.versionObject.increment();
        },

        getValue: function (value) {
            return this.value;
        }
    };

    return {
        ScopeId: ScopeId
    };
}());
