import { http } from '../net/http.js';

const SceneUtils = {
    /**
     * @private
     * @function
     * @static
     * @name SceneUtils.load
     * @description Loads the scene JSON file from a URL.
     * @param {string} url - URL to scene JSON.
     * @param {number} maxRetries - Number of http load retry attempts.
     * @param {Function} callback - The callback to the JSON file is loaded.
     */
    load: function (url, maxRetries, callback) {
        if (typeof url === 'string') {
            url = {
                load: url,
                original: url
            };
        }

        http.get(url.load, {
            retry: maxRetries > 0,
            maxRetries: maxRetries
        }, function (err, response) {
            if (!err) {
                callback(err, response);
            } else {
                let errMsg = 'Error while loading scene JSON ' + url.original;
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
