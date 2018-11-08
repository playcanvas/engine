Object.assign(pc, function () {
    'use strict';

    var BundleHandler = function () {};

    var HTTP_OPTIONS = {
        cache: true,
        responseType: 'blob'
    };

    Object.assign(BundleHandler.prototype, {
        load: function (url, callback) {
            if (typeof url === 'string') {
                url = {
                    load: url,
                    original: url
                };
            }

            pc.http.get(url.load, HTTP_OPTIONS, function (err, response) {
                if (! err) {
                    // TODO: check if we need a FileReader
                    // TODO: more error handling for FileReader and untar
                    var fileReader = new FileReader();
                    fileReader.onload = function (event) {
                        var arrayBuffer = event.target.result;
                        untar(arrayBuffer).then(function (files) {
                            callback(null, files);
                        });
                    };
                    fileReader.readAsArrayBuffer(response);
                } else {
                    callback("Error loading bundle resource " + url.original + ": " + err);
                }
            });
        },

        open: function (url, data) {
            return new pc.Bundle(data);
        },

        patch: function (asset, assets) {
        }

    });

    return {
        BundleHandler: BundleHandler
    };
}());
