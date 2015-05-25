pc.extend(pc, function () {
    'use strict';

    var AudioHandler = function (manager) {
        this.manager = manager;
    };

    AudioHandler.prototype = {
        load: function (url, callback) {
            var sound = this.manager.createSound(url, function (sound) {
                callback(null, sound);
            }, function (error) {
                callback("Error loading: " + url, null);
            });
        },

        open: function (url, data) {
            return data;
        }
    }

    return {
        AudioHandler: AudioHandler
    };
}());
