import { http } from '../net/http';
var SceneUtils = {
    /**
     * @private
     * @function
     * @name pc.SceneUtils#load
     * @description Loads the scene JSON file from a URL
     * @param {string} url - URL to scene JSON.
     * @param {Function} callback - The callback to the JSON file is loaded.
     */
    load: function (url, callback) {
        if (typeof url === 'string') {
            url = {
                load: url,
                original: url
            };
        }

        http.get(url.load, {
            retry: this.maxRetries > 0,
            maxRetries: this.maxRetries
        }, function (err, response) {
            if (!err) {
                callback(err, response);
            } else {
                var errMsg = 'Error while loading scene JSON ' + url.original;
                if (err.message) {
                    errMsg += ': ' + err.message;
                    if (err.stack) {
                        errMsg += '\n' + err.stack;
                    }
                } else {
                    errMsg += ': ' + err;
                }

                callback(errMsg);
            }
        });
    }
};

export { SceneUtils };
