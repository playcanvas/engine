import { Version } from './version.js';

var idCounter = 0;

function VersionedObject() {
    // Increment the global object ID counter
    idCounter++;

    // Create a version for this object
    this.version = new Version();

    // Set the unique object ID
    this.version.globalId = idCounter;
}

Object.assign(VersionedObject.prototype, {
    increment: function () {
        // Increment the revision number
        this.version.revision++;
    }
});

export { VersionedObject };