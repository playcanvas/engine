pc.extend(pc, function () {
    'use strict';

    function FolderHandler() {
    }

    FolderHandler.prototype = {
        constructor: FolderHandler,

        load: function (url, callback) {
            callback(null, null);
        },

        open: function (url, data) {
            return data;
        }
    };

    return {
        FolderHandler: FolderHandler
    };
}());
