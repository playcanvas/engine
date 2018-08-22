Object.assign(pc, function () {
    'use strict';

    var idCounter = 0;

    var VersionedObject = function () {
        // Increment the global object ID counter
        idCounter++;

        // Create a version for this object
        this.version = new pc.Version();

        // Set the unique object ID
        this.version.globalId = idCounter;
    };

    Object.assign(VersionedObject.prototype, {
        increment: function () {
            // Increment the revision number
            this.version.revision++;
        }
    });

    return {
        VersionedObject: VersionedObject
    };
}());
