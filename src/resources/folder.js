pc.extend(pc, function () {
    'use strict';

    var FolderHandler = function () {
    };

    FolderHandler.prototype = {
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
