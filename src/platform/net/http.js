import { extend } from '../../core/core.js';
import { now } from '../../core/time.js';
import { path } from '../../core/path.js';
import { URI } from '../../core/uri.js';

import { math } from '../../core/math/math.js';

/**
 * Callback used by {@link Http#get}, {@link Http#post}, {@link Http#put}, {@link Http#del}, and
 * {@link Http#request}.
 *
 * @callback HttpResponseCallback
 * @param {number|string|Error|null} err - The error code, message, or exception in the case where the request fails.
 * @param {*} [response] - The response data if no errors were encountered. (format depends on response type: text, Object, ArrayBuffer, XML).
 */

/**
 * Used to send and receive HTTP requests.
 */
class Http {
    static ContentType = {
        AAC: 'audio/aac',
        BASIS: 'image/basis',
        BIN: 'application/octet-stream',
        DDS: 'image/dds',
        FORM_URLENCODED: 'application/x-www-form-urlencoded',
        GIF: 'image/gif',
        GLB: 'model/gltf-binary',
        JPEG: 'image/jpeg',
        JSON: 'application/json',
        MP3: 'audio/mpeg',
        MP4: 'audio/mp4',
        OGG: 'audio/ogg',
        OPUS: 'audio/ogg; codecs="opus"',
        PNG: 'image/png',
        TEXT: 'text/plain',
        WAV: 'audio/x-wav',
        XML: 'application/xml'
    };

    static ResponseType = {
        TEXT: 'text',
        ARRAY_BUFFER: 'arraybuffer',
        BLOB: 'blob',
        DOCUMENT: 'document',
        JSON: 'json'
    };

    static binaryExtensions = [
        '.model',
        '.wav',
        '.ogg',
        '.mp3',
        '.mp4',
        '.m4a',
        '.aac',
        '.dds',
        '.basis',
        '.glb',
        '.opus'
    ];

    static retryDelay = 100;

    /**
     * @function
     * @name Http#get
     * @description Perform an HTTP GET request to the given url.
     * @param {string} url - The URL to make the request to.
     * @param {HttpResponseCallback} callback - The callback used when the response has returned. Passed (err, data)
     * where data is the response (format depends on response type: text, Object, ArrayBuffer, XML) and
     * err is the error code.
     * @example
     * pc.http.get("http://example.com/", function (err, response) {
     *     console.log(response);
     * });
     * @returns {XMLHttpRequest} The request object.
     */
    /**
     * @function
     * @name Http#get
     * @variation 2
     * @description Perform an HTTP GET request to the given url with additional options such as headers, retries, credentials, etc.
     * @param {string} url - The URL to make the request to.
     * @param {object} options - Additional options.
     * @param {object} [options.headers] - HTTP headers to add to the request.
     * @param {boolean} [options.async] - Make the request asynchronously. Defaults to true.
     * @param {boolean} [options.cache] - If false, then add a timestamp to the request to prevent caching.
     * @param {boolean} [options.withCredentials] - Send cookies with this request. Defaults to false.
     * @param {string} [options.responseType] - Override the response type.
     * @param {Document|object} [options.postdata] - Data to send in the body of the request.
     * Some content types are handled automatically. If postdata is an XML Document, it is handled. If
     * the Content-Type header is set to 'application/json' then the postdata is JSON stringified.
     * Otherwise, by default, the data is sent as form-urlencoded.
     * @param {boolean} [options.retry] - If true then if the request fails it will be retried with an exponential backoff.
     * @param {number} [options.maxRetries] - If options.retry is true this specifies the maximum number of retries. Defaults to 5.
     * @param {number} [options.maxRetryDelay] - If options.retry is true this specifies the maximum amount of time to wait between retries in milliseconds. Defaults to 5000.
     * @param {HttpResponseCallback} callback - The callback used when the response has returned. Passed (err, data)
     * where data is the response (format depends on response type: text, Object, ArrayBuffer, XML) and
     * err is the error code.
     * @example
     * pc.http.get("http://example.com/", { "retry": true, "maxRetries": 5 }, function (err, response) {
     *     console.log(response);
     * });
     * @returns {XMLHttpRequest} The request object.
     */
    get(url, options, callback) {
        if (typeof options === 'function') {
            callback = options;
            options = {};
        }
        return this.request('GET', url, options, callback);
    }

    /**
     * @function
     * @name Http#post
     * @description Perform an HTTP POST request to the given url.
     * @param {string} url - The URL to make the request to.
     * @param {object} data - Data to send in the body of the request.
     * Some content types are handled automatically. If postdata is an XML Document, it is handled. If
     * the Content-Type header is set to 'application/json' then the postdata is JSON stringified.
     * Otherwise, by default, the data is sent as form-urlencoded.
     * @param {HttpResponseCallback} callback - The callback used when the response has returned. Passed (err, data)
     * where data is the response (format depends on response type: text, Object, ArrayBuffer, XML) and
     * err is the error code.
     * @example
     * pc.http.post("http://example.com/", { "name": "Alix" }, function (err, response) {
     *     console.log(response);
     * });
     * @returns {XMLHttpRequest} The request object.
     */
    /**
     * @function
     * @name Http#post
     * @variation 2
     * @description Perform an HTTP POST request to the given url with additional options such as headers, retries, credentials, etc.
     * @param {string} url - The URL to make the request to.
     * @param {object} data - Data to send in the body of the request.
     * Some content types are handled automatically. If postdata is an XML Document, it is handled. If
     * the Content-Type header is set to 'application/json' then the postdata is JSON stringified.
     * Otherwise, by default, the data is sent as form-urlencoded.
     * @param {object} options - Additional options.
     * @param {object} [options.headers] - HTTP headers to add to the request.
     * @param {boolean} [options.async] - Make the request asynchronously. Defaults to true.
     * @param {boolean} [options.cache] - If false, then add a timestamp to the request to prevent caching.
     * @param {boolean} [options.withCredentials] - Send cookies with this request. Defaults to false.
     * @param {string} [options.responseType] - Override the response type.
     * @param {boolean} [options.retry] - If true then if the request fails it will be retried with an exponential backoff.
     * @param {number} [options.maxRetries] - If options.retry is true this specifies the maximum number of retries. Defaults to 5.
     * @param {number} [options.maxRetryDelay] - If options.retry is true this specifies the maximum amount of time to wait between retries in milliseconds. Defaults to 5000.
     * @param {HttpResponseCallback} callback - The callback used when the response has returned. Passed (err, data)
     * where data is the response (format depends on response type: text, Object, ArrayBuffer, XML) and
     * err is the error code.
     * @example
     * pc.http.post("http://example.com/", { "name": "Alix" }, { "retry": true, "maxRetries": 5 }, function (err, response) {
     *     console.log(response);
     * });
     * @returns {XMLHttpRequest} The request object.
     */
    post(url, data, options, callback) {
        if (typeof options === 'function') {
            callback = options;
            options = {};
        }
        options.postdata = data;
        return this.request('POST', url, options, callback);
    }

    /**
     * @function
     * @name Http#put
     * @description Perform an HTTP PUT request to the given url.
     * @param {string} url - The URL to make the request to.
     * @param {Document|object} data - Data to send in the body of the request.
     * Some content types are handled automatically. If postdata is an XML Document, it is handled. If
     * the Content-Type header is set to 'application/json' then the postdata is JSON stringified.
     * Otherwise, by default, the data is sent as form-urlencoded.
     * @param {HttpResponseCallback} callback - The callback used when the response has returned. Passed (err, data)
     * where data is the response (format depends on response type: text, Object, ArrayBuffer, XML) and
     * err is the error code.
     * @example
     * pc.http.put("http://example.com/", { "name": "Alix" }, function (err, response) {
     *     console.log(response);
     * });
     * @returns {XMLHttpRequest} The request object.
     */
    /**
     * @function
     * @name Http#put
     * @variation 2
     * @description Perform an HTTP PUT request to the given url with additional options such as headers, retries, credentials, etc.
     * @param {string} url - The URL to make the request to.
     * @param {Document|object} data - Data to send in the body of the request.
     * Some content types are handled automatically. If postdata is an XML Document, it is handled. If
     * the Content-Type header is set to 'application/json' then the postdata is JSON stringified.
     * Otherwise, by default, the data is sent as form-urlencoded.
     * @param {object} options - Additional options.
     * @param {object} [options.headers] - HTTP headers to add to the request.
     * @param {boolean} [options.async] - Make the request asynchronously. Defaults to true.
     * @param {boolean} [options.cache] - If false, then add a timestamp to the request to prevent caching.
     * @param {boolean} [options.withCredentials] - Send cookies with this request. Defaults to false.
     * @param {string} [options.responseType] - Override the response type.
     * @param {boolean} [options.retry] - If true then if the request fails it will be retried with an exponential backoff.
     * @param {number} [options.maxRetries] - If options.retry is true this specifies the maximum number of retries. Defaults to 5.
     * @param {number} [options.maxRetryDelay] - If options.retry is true this specifies the maximum amount of time to wait between retries in milliseconds. Defaults to 5000.
     * @param {HttpResponseCallback} callback - The callback used when the response has returned. Passed (err, data)
     * where data is the response (format depends on response type: text, Object, ArrayBuffer, XML) and
     * err is the error code.
     * @example
     * pc.http.put("http://example.com/", { "name": "Alix" }, { "retry": true, "maxRetries": 5 }, function (err, response) {
     *     console.log(response);
     * });
     * @returns {XMLHttpRequest} The request object.
     */
    put(url, data, options, callback) {
        if (typeof options === 'function') {
            callback = options;
            options = {};
        }
        options.postdata = data;
        return this.request('PUT', url, options, callback);
    }

    /**
     * @function
     * @name Http#del
     * @description Perform an HTTP DELETE request to the given url.
     * @param {object} url - The URL to make the request to.
     * @param {HttpResponseCallback} callback - The callback used when the response has returned. Passed (err, data)
     * where data is the response (format depends on response type: text, Object, ArrayBuffer, XML) and
     * err is the error code.
     * @example
     * pc.http.del("http://example.com/", function (err, response) {
     *     console.log(response);
     * });
     * @returns {XMLHttpRequest} The request object.
     */
    /**
     * @function
     * @name Http#del
     * @variation 2
     * @description Perform an HTTP DELETE request to the given url with additional options such as headers, retries, credentials, etc.
     * @param {object} url - The URL to make the request to.
     * @param {object} options - Additional options.
     * @param {object} [options.headers] - HTTP headers to add to the request.
     * @param {boolean} [options.async] - Make the request asynchronously. Defaults to true.
     * @param {boolean} [options.cache] - If false, then add a timestamp to the request to prevent caching.
     * @param {boolean} [options.withCredentials] - Send cookies with this request. Defaults to false.
     * @param {string} [options.responseType] - Override the response type.
     * @param {Document|object} [options.postdata] - Data to send in the body of the request.
     * Some content types are handled automatically. If postdata is an XML Document, it is handled. If
     * the Content-Type header is set to 'application/json' then the postdata is JSON stringified.
     * Otherwise, by default, the data is sent as form-urlencoded.
     * @param {boolean} [options.retry] - If true then if the request fails it will be retried with an exponential backoff.
     * @param {number} [options.maxRetries] - If options.retry is true this specifies the maximum number of retries. Defaults to 5.
     * @param {number} [options.maxRetryDelay] - If options.retry is true this specifies the maximum amount of time to wait between retries in milliseconds. Defaults to 5000.
     * @param {HttpResponseCallback} callback - The callback used when the response has returned. Passed (err, data)
     * where data is the response (format depends on response type: text, Object, ArrayBuffer, XML) and
     * err is the error code.
     * @example
     * pc.http.del("http://example.com/", { "retry": true, "maxRetries": 5 }, function (err, response) {
     *     console.log(response);
     * });
     * @returns {XMLHttpRequest} The request object.
     */
    del(url, options, callback) {
        if (typeof options === 'function') {
            callback = options;
            options = {};
        }
        return this.request('DELETE', url, options, callback);
    }

    /**
     * @function
     * @name Http#request
     * @description Make a general purpose HTTP request.
     * @param {string} method - The HTTP method "GET", "POST", "PUT", "DELETE".
     * @param {string} url - The url to make the request to.
     * @param {HttpResponseCallback} callback - The callback used when the response has returned. Passed (err, data)
     * where data is the response (format depends on response type: text, Object, ArrayBuffer, XML) and
     * err is the error code.
     * @example
     * pc.http.request("get", "http://example.com/", function (err, response) {
     *     console.log(response);
     * });
     * @returns {XMLHttpRequest} The request object.
     */
    /**
     * @function
     * @name Http#request
     * @variation 2
     * @description Make a general purpose HTTP request with additional options such as headers, retries, credentials, etc.
     * @param {string} method - The HTTP method "GET", "POST", "PUT", "DELETE".
     * @param {string} url - The url to make the request to.
     * @param {object} options - Additional options.
     * @param {object} [options.headers] - HTTP headers to add to the request.
     * @param {boolean} [options.async] - Make the request asynchronously. Defaults to true.
     * @param {boolean} [options.cache] - If false, then add a timestamp to the request to prevent caching.
     * @param {boolean} [options.withCredentials] - Send cookies with this request. Defaults to false.
     * @param {boolean} [options.retry] - If true then if the request fails it will be retried with an exponential backoff.
     * @param {number} [options.maxRetries] - If options.retry is true this specifies the maximum number of retries. Defaults to 5.
     * @param {number} [options.maxRetryDelay] - If options.retry is true this specifies the maximum amount of time to wait between retries in milliseconds. Defaults to 5000.
     * @param {string} [options.responseType] - Override the response type.
     * @param {Document|object} [options.postdata] - Data to send in the body of the request.
     * Some content types are handled automatically. If postdata is an XML Document, it is handled. If
     * the Content-Type header is set to 'application/json' then the postdata is JSON stringified.
     * Otherwise, by default, the data is sent as form-urlencoded.
     * @param {HttpResponseCallback} callback - The callback used when the response has returned. Passed (err, data)
     * where data is the response (format depends on response type: text, Object, ArrayBuffer, XML) and
     * err is the error code.
     * @example
     * pc.http.request("get", "http://example.com/", { "retry": true, "maxRetries": 5 }, function (err, response) {
     *     console.log(response);
     * });
     * @returns {XMLHttpRequest} The request object.
     */
    request(method, url, options, callback) {
        let uri, query, postdata;
        let errored = false;

        if (typeof options === 'function') {
            callback = options;
            options = {};
        }

        // if retryable we are going to store new properties
        // in the options so create a new copy to not affect
        // the original
        if (options.retry) {
            options = Object.assign({
                retries: 0,
                maxRetries: 5
            }, options);
        }

        // store callback
        options.callback = callback;

        // setup defaults
        if (options.async == null) {
            options.async = true;
        }
        if (options.headers == null) {
            options.headers = {};
        }

        if (options.postdata != null) {
            if (options.postdata instanceof Document) {
                // It's an XML document, so we can send it directly.
                // XMLHttpRequest will set the content type correctly.
                postdata = options.postdata;
            } else if (options.postdata instanceof FormData) {
                postdata = options.postdata;
            } else if (options.postdata instanceof Object) {
                // Now to work out how to encode the post data based on the headers
                let contentType = options.headers['Content-Type'];

                // If there is no type then default to form-encoded
                if (contentType === undefined) {
                    options.headers['Content-Type'] = Http.ContentType.FORM_URLENCODED;
                    contentType = options.headers['Content-Type'];
                }
                switch (contentType) {
                    case Http.ContentType.FORM_URLENCODED: {
                        // Normal URL encoded form data
                        postdata = '';
                        let bFirstItem = true;

                        // Loop round each entry in the map and encode them into the post data
                        for (const key in options.postdata) {
                            if (options.postdata.hasOwnProperty(key)) {
                                if (bFirstItem) {
                                    bFirstItem = false;
                                } else {
                                    postdata += '&';
                                }

                                const encodedKey = encodeURIComponent(key);
                                const encodedValue = encodeURIComponent(options.postdata[key]);
                                postdata += `${encodedKey}=${encodedValue}`;
                            }
                        }
                        break;
                    }
                    default:
                    case Http.ContentType.JSON:
                        if (contentType == null) {
                            options.headers['Content-Type'] = Http.ContentType.JSON;
                        }
                        postdata = JSON.stringify(options.postdata);
                        break;
                }
            } else {
                postdata = options.postdata;
            }
        }

        if (options.cache === false) {
            // Add timestamp to url to prevent browser caching file
            const timestamp = now();

            uri = new URI(url);
            if (!uri.query) {
                uri.query = 'ts=' + timestamp;
            } else {
                uri.query = uri.query + '&ts=' + timestamp;
            }
            url = uri.toString();
        }

        if (options.query) {
            uri = new URI(url);
            query = extend(uri.getQuery(), options.query);
            uri.setQuery(query);
            url = uri.toString();
        }

        const xhr = new XMLHttpRequest();
        xhr.open(method, url, options.async);
        xhr.withCredentials = options.withCredentials !== undefined ? options.withCredentials : false;
        xhr.responseType = options.responseType || this._guessResponseType(url);

        // Set the http headers
        for (const header in options.headers) {
            if (options.headers.hasOwnProperty(header)) {
                xhr.setRequestHeader(header, options.headers[header]);
            }
        }

        xhr.onreadystatechange = () => {
            this._onReadyStateChange(method, url, options, xhr);
        };

        xhr.onerror = () => {
            this._onError(method, url, options, xhr);
            errored = true;
        };

        try {
            xhr.send(postdata);
        } catch (e) {
            // DWE: Don't callback on exceptions as behavior is inconsistent, e.g. cross-domain request errors don't throw an exception.
            // Error callback should be called by xhr.onerror() callback instead.
            if (!errored) {
                options.error(xhr.status, xhr, e);
            }
        }

        // Return the request object as it can be handy for blocking calls
        return xhr;
    }

    _guessResponseType(url) {
        const uri = new URI(url);
        const ext = path.getExtension(uri.path).toLowerCase();

        if (Http.binaryExtensions.indexOf(ext) >= 0) {
            return Http.ResponseType.ARRAY_BUFFER;
        } else if (ext === '.json') {
            return Http.ResponseType.JSON;
        } else if (ext === '.xml') {
            return Http.ResponseType.DOCUMENT;
        }

        return Http.ResponseType.TEXT;
    }

    _isBinaryContentType(contentType) {
        const binTypes = [
            Http.ContentType.BASIS,
            Http.ContentType.BIN,
            Http.ContentType.DDS,
            Http.ContentType.GLB,
            Http.ContentType.MP3,
            Http.ContentType.MP4,
            Http.ContentType.OGG,
            Http.ContentType.OPUS,
            Http.ContentType.WAV
        ];
        if (binTypes.indexOf(contentType) >= 0) {
            return true;
        }

        return false;
    }

    _isBinaryResponseType(responseType) {
        return responseType === Http.ResponseType.ARRAY_BUFFER ||
               responseType === Http.ResponseType.BLOB ||
               responseType === Http.ResponseType.JSON;
    }

    _onReadyStateChange(method, url, options, xhr) {
        if (xhr.readyState === 4) {
            switch (xhr.status) {
                case 0: {
                    // If status code 0, it is assumed that the browser has cancelled the request

                    // Add support for running Chrome browsers in 'allow-file-access-from-file'
                    // This is to allow for specialized programs and libraries such as CefSharp
                    // which embed Chromium in the native app.
                    if (xhr.responseURL && xhr.responseURL.startsWith('file:///')) {
                        // Assume that any file loaded from disk is fine
                        this._onSuccess(method, url, options, xhr);
                    } else {
                        this._onError(method, url, options, xhr);
                    }
                    break;
                }
                case 200:
                case 201:
                case 206:
                case 304: {
                    this._onSuccess(method, url, options, xhr);
                    break;
                }
                default: {
                    this._onError(method, url, options, xhr);
                    break;
                }
            }
        }
    }

    _onSuccess(method, url, options, xhr) {
        let response;
        let contentType;
        const header = xhr.getResponseHeader('Content-Type');
        if (header) {
            // Split up header into content type and parameter
            const parts = header.split(';');
            contentType = parts[0].trim();
        }
        try {
            // Check the content type to see if we want to parse it
            if (this._isBinaryContentType(contentType) || this._isBinaryResponseType(xhr.responseType)) {
                // It's a binary response
                response = xhr.response;
            } else if (contentType === Http.ContentType.JSON || url.split('?')[0].endsWith('.json')) {
                // It's a JSON response
                response = JSON.parse(xhr.responseText);
            } else if (xhr.responseType === Http.ResponseType.DOCUMENT || contentType === Http.ContentType.XML) {
                // It's an XML response
                response = xhr.responseXML;
            } else {
                // It's raw data
                response = xhr.responseText;
            }

            options.callback(null, response);
        } catch (err) {
            options.callback(err);
        }
    }

    _onError(method, url, options, xhr) {
        if (options.retrying) {
            return;
        }

        // retry if necessary
        if (options.retry && options.retries < options.maxRetries) {
            options.retries++;
            options.retrying = true; // used to stop retrying when both onError and xhr.onerror are called
            const retryDelay = math.clamp(Math.pow(2, options.retries) * Http.retryDelay, 0, options.maxRetryDelay || 5000);
            console.log(`${method}: ${url} - Error ${xhr.status}. Retrying in ${retryDelay} ms`);

            setTimeout(() => {
                options.retrying = false;
                this.request(method, url, options, options.callback);
            }, retryDelay);
        } else {
            // no more retries or not retry so just fail
            options.callback(xhr.status === 0 ? 'Network error' : xhr.status, null);
        }
    }
}

const http = new Http();

export { http, Http };
