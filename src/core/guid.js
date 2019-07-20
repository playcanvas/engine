/**
 * @name pc.guid
 * @namespace
 * @description Basically a very large random number (128-bit) which means the probability of creating two that clash is vanishingly small.
 * GUIDs are used as the unique identifiers for Entities.
 */
pc.guid = function () {
    return {
        /**
         * @function
         * @name pc.guid.create
         * @description Create an RFC4122 version 4 compliant GUID
         * @returns {String} A new GUID
         */
        create: function () {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                var r = Math.random() * 16 | 0,
                    v = (c == 'x') ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        }
    };
}();
