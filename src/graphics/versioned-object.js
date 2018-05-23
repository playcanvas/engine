pc.extend(pc, function () {
    'use strict';

    var idCounter = 0;

    function VersionedObject() {
        // Increment the global object ID counter
        idCounter++;

        // Create a version for this object
        this.version = new pc.Version();

        // Set the unique object ID
        this.version.globalId = idCounter;
    }

    VersionedObject.prototype = {
        constructor: VersionedObject,

        increment: function () {
            // Increment the revision number
            this.version.revision++;
        }
    };

    return {
        VersionedObject: VersionedObject
    };
}());
