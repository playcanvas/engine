Object.assign(pc, function () {
    'use strict';

    var Version = function () {
        // Set the variables
        this.globalId = 0;
        this.revision = 0;
    };

    Object.assign(Version.prototype, {
        equals: function (other) {
            return this.globalId === other.globalId &&
                   this.revision === other.revision;
        },

        notequals: function (other) {
            return this.globalId !== other.globalId ||
                   this.revision !== other.revision;
        },

        copy: function (other) {
            this.globalId = other.globalId;
            this.revision = other.revision;
        },

        reset: function () {
            this.globalId = 0;
            this.revision = 0;
        }
    });

    return {
        Version: Version
    };
}());
