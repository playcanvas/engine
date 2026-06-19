import { extend } from '../../core/core.js';
import { now } from '../../core/time.js';
import { path } from '../../core/path.js';
import { URI } from '../../core/uri.js';

import { math } from '../../core/math/math.js';

/**
 * @import { EventHandler } from '../../core/event-handler.js';
 */

/**
 * @callback HttpResponseCallback
 * Callback used by {@link Http#get}, {@link Http#post}, {@link Http#put}, {@link Http#del}, and
 * {@link Http#request}.
 * @param {number|string|Error|null} err - The error code, message, or exception in the case where
 * the request fails.
 * @param {any} [response] - The response data if no errors were encountered. Format depends on
 * response type: text, Object, ArrayBuffer, XML.
 * @returns {void}
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
     * The configured concurrency limit. See {@link Http#maxConcurrentRequests}.
     *
     * @type {number}
     * @private
     */
    _maxConcurrentRequests = 128;

    /**
     * The number of slot-accounted requests currently in flight. Only throttled async requests are
     * counted - when throttling is disabled (a limit of 0 or Infinity) requests are sent without
     * accounting and this stays at 0.
     *
     * @type {number}
     * @private
     */
    _activeRequests = 0;

    /**
     * Requests waiting for an in-flight slot to free up. Each entry holds the request's `xhr` and
     * the deferred `send` thunk. Consumed from `_sendQueueHead` (rather than `Array#shift`) so
     * draining a large queue stays O(n) overall rather than O(n^2).
     *
     * @type {{ xhr: XMLHttpRequest, send: Function }[]}
     * @private
     */
    _sendQueue = [];

    /**
     * Index of the next entry to dispatch from `_sendQueue`. The array is compacted once drained.
     *
     * @type {number}
     * @private
     */
    _sendQueueHead = 0;

    /**
     * The maximum number of requests allowed to be in flight at the same time. Additional requests
     * are queued and dispatched as earlier ones complete. This guards against browsers rejecting
     * requests with `net::ERR_INSUFFICIENT_RESOURCES` when too many are issued at once. Set to `0`
     * (or `Infinity`) to disable throttling. Defaults to 128.
     *
     * This is a process-global limit on the shared {@link http} instance, matching the browser's
     * per-process resource limit, and applies to all XHR-based requests (most asset loads). Prefer
     * setting it via {@link ResourceLoader#maxConcurrentRequests}.
     *
     * @type {number}
     * @ignore
     */
    set maxConcurrentRequests(value) {
        this._maxConcurrentRequests = value;
        // raising the limit may allow queued requests to be sent
        this._pump();
    }

    /**
     * @type {number}
     * @ignore
     */
    get maxConcurrentRequests() {
        return this._maxConcurrentRequests;
    }

    /**
     * Perform an HTTP GET request to the given url with additional options such as headers,
     * retries, credentials, etc.
     *
     * @param {string} url - The URL to make the request to.
     * @param {object} options - Additional options.
     * @param {Object<string, string>} [options.headers] - HTTP headers to add to the request.
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
     * @param {EventHandler} [options.progress] - Object to use for firing progress events.
     * @param {HttpResponseCallback} callback - The callback used when the response has returned. Passed (err, data)
     * where data is the response (format depends on response type: text, Object, ArrayBuffer, XML) and
     * err is the error code.
     * @example
     * pc.http.get("http://example.com/", {
     *     "retry": true,
     *     "maxRetries": 5
     * }, (err, response) => {
     *     console.log(response);
     * });
     * @returns {XMLHttpRequest} The request object.
     */
    get(url, options, callback) {
        if (typeof options === 'function') {
            callback = options;
            options = {};
        }

        const result = this.request('GET', url, options, callback);

        const { progress } = options;
        if (progress) {
            const handler = (event) => {
                if (event.lengthComputable) {
                    progress.fire('progress', event.loaded, event.total);
                }
            };
            const endHandler = (event) => {
                handler(event);
                result.removeEventListener('loadstart', handler);
                result.removeEventListener('progress', handler);
                result.removeEventListener('loadend', endHandler);
            };
            result.addEventListener('loadstart', handler);
            result.addEventListener('progress', handler);
            result.addEventListener('loadend', endHandler);
        }

        return result;
    }

    /**
     * Perform an HTTP POST request to the given url with additional options such as headers,
     * retries, credentials, etc.
     *
     * @param {string} url - The URL to make the request to.
     * @param {object} data - Data to send in the body of the request.
     * Some content types are handled automatically. If postdata is an XML Document, it is handled.
     * If the Content-Type header is set to 'application/json' then the postdata is JSON
     * stringified. Otherwise, by default, the data is sent as form-urlencoded.
     * @param {object} options - Additional options.
     * @param {Object<string, string>} [options.headers] - HTTP headers to add to the request.
     * @param {boolean} [options.async] - Make the request asynchronously. Defaults to true.
     * @param {boolean} [options.cache] - If false, then add a timestamp to the request to prevent caching.
     * @param {boolean} [options.withCredentials] - Send cookies with this request. Defaults to false.
     * @param {string} [options.responseType] - Override the response type.
     * @param {boolean} [options.retry] - If true then if the request fails it will be retried with an exponential backoff.
     * @param {number} [options.maxRetries] - If options.retry is true this specifies the maximum
     * number of retries. Defaults to 5.
     * @param {number} [options.maxRetryDelay] - If options.retry is true this specifies the
     * maximum amount of time to wait between retries in milliseconds. Defaults to 5000.
     * @param {HttpResponseCallback} callback - The callback used when the response has returned.
     * Passed (err, data) where data is the response (format depends on response type: text,
     * Object, ArrayBuffer, XML) and err is the error code.
     * @example
     * pc.http.post("http://example.com/", {
     *     "name": "Alex"
     * }, {
     *     "retry": true,
     *     "maxRetries": 5
     * }, (err, response) => {
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
     * Perform an HTTP PUT request to the given url with additional options such as headers,
     * retries, credentials, etc.
     *
     * @param {string} url - The URL to make the request to.
     * @param {Document|object} data - Data to send in the body of the request. Some content types
     * are handled automatically. If postdata is an XML Document, it is handled. If the
     * Content-Type header is set to 'application/json' then the postdata is JSON stringified.
     * Otherwise, by default, the data is sent as form-urlencoded.
     * @param {object} options - Additional options.
     * @param {Object<string, string>} [options.headers] - HTTP headers to add to the request.
     * @param {boolean} [options.async] - Make the request asynchronously. Defaults to true.
     * @param {boolean} [options.cache] - If false, then add a timestamp to the request to prevent caching.
     * @param {boolean} [options.withCredentials] - Send cookies with this request. Defaults to false.
     * @param {string} [options.responseType] - Override the response type.
     * @param {boolean} [options.retry] - If true then if the request fails it will be retried with
     * an exponential backoff.
     * @param {number} [options.maxRetries] - If options.retry is true this specifies the maximum
     * number of retries. Defaults to 5.
     * @param {number} [options.maxRetryDelay] - If options.retry is true this specifies the
     * maximum amount of time to wait between retries in milliseconds. Defaults to 5000.
     * @param {HttpResponseCallback} callback - The callback used when the response has returned.
     * Passed (err, data) where data is the response (format depends on response type: text,
     * Object, ArrayBuffer, XML) and err is the error code.
     * @example
     * pc.http.put("http://example.com/", {
     *     "name": "Alex"
     * }, {
     *     "retry": true,
     *     "maxRetries": 5
     * }, (err, response) => {
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
     * Perform an HTTP DELETE request to the given url with additional options such as headers,
     * retries, credentials, etc.
     *
     * @param {string} url - The URL to make the request to.
     * @param {object} options - Additional options.
     * @param {Object<string, string>} [options.headers] - HTTP headers to add to the request.
     * @param {boolean} [options.async] - Make the request asynchronously. Defaults to true.
     * @param {boolean} [options.cache] - If false, then add a timestamp to the request to prevent caching.
     * @param {boolean} [options.withCredentials] - Send cookies with this request. Defaults to false.
     * @param {string} [options.responseType] - Override the response type.
     * @param {Document|object} [options.postdata] - Data to send in the body of the request.
     * Some content types are handled automatically. If postdata is an XML Document, it is handled.
     * If the Content-Type header is set to 'application/json' then the postdata is JSON
     * stringified. Otherwise, by default, the data is sent as form-urlencoded.
     * @param {boolean} [options.retry] - If true then if the request fails it will be retried with
     * an exponential backoff.
     * @param {number} [options.maxRetries] - If options.retry is true this specifies the maximum
     * number of retries. Defaults to 5.
     * @param {number} [options.maxRetryDelay] - If options.retry is true this specifies the
     * maximum amount of time to wait between retries in milliseconds. Defaults to 5000.
     * @param {HttpResponseCallback} callback - The callback used when the response has returned.
     * Passed (err, data) where data is the response (format depends on response type: text,
     * Object, ArrayBuffer, XML) and err is the error code.
     * @example
     * pc.http.del("http://example.com/", {
     *     "retry": true,
     *     "maxRetries": 5
     * }, (err, response) => {
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
     * Make a general purpose HTTP request with additional options such as headers, retries,
     * credentials, etc.
     *
     * @param {string} method - The HTTP method "GET", "POST", "PUT", "DELETE".
     * @param {string} url - The url to make the request to.
     * @param {object} options - Additional options.
     * @param {Object<string, string>} [options.headers] - HTTP headers to add to the request.
     * @param {boolean} [options.async] - Make the request asynchronously. Defaults to true.
     * @param {boolean} [options.cache] - If false, then add a timestamp to the request to prevent caching.
     * @param {boolean} [options.withCredentials] - Send cookies with this request. Defaults to false.
     * @param {boolean} [options.retry] - If true then if the request fails it will be retried with
     * an exponential backoff.
     * @param {number} [options.maxRetries] - If options.retry is true this specifies the maximum
     * number of retries. Defaults to 5.
     * @param {number} [options.maxRetryDelay] - If options.retry is true this specifies the
     * maximum amount of time to wait between retries in milliseconds. Defaults to 5000.
     * @param {string} [options.responseType] - Override the response type.
     * @param {Document|object} [options.postdata] - Data to send in the body of the request.
     * Some content types are handled automatically. If postdata is an XML Document, it is handled.
     * If the Content-Type header is set to 'application/json' then the postdata is JSON
     * stringified. Otherwise, by default, the data is sent as form-urlencoded.
     * @param {HttpResponseCallback} callback - The callback used when the response has returned.
     * Passed (err, data) where data is the response (format depends on response type: text,
     * Object, ArrayBuffer, XML) and err is the error code.
     * @example
     * pc.http.request("get", "http://example.com/", {
     *     "retry": true,
     *     "maxRetries": 5
     * }, (err, response) => {
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
                uri.query = `ts=${timestamp}`;
            } else {
                uri.query = `${uri.query}&ts=${timestamp}`;
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

        const send = () => {
            try {
                xhr.send(postdata);
            } catch (e) {
                // a failed send fires no completion event, so free the slot we acquired for it
                this._releaseSlot(xhr);
                // DWE: Don't callback on exceptions as behavior is inconsistent, e.g. cross-domain request errors don't throw an exception.
                // Error callback should be called by xhr.onerror() callback instead.
                if (!errored && typeof options.error === 'function') {
                    options.error(xhr.status, xhr, e);
                }
            }
        };

        // throttle the number of concurrent in-flight requests by deferring the actual send
        this._acquire(xhr, options, send);

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
        this._releaseSlot(xhr);

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
        // the request is no longer in flight; free its slot (a retry below re-acquires one)
        this._releaseSlot(xhr);

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

    /**
     * Send a request immediately if a concurrency slot is free, otherwise queue it. Synchronous
     * requests and the unthrottled case (a limit of 0 or Infinity) always send immediately and are
     * not slot-accounted. Slot state is tracked on the `xhr` (not `options`, which callers may
     * reuse across requests).
     *
     * @param {XMLHttpRequest} xhr - The request object (gains a private `_slotHeld` flag).
     * @param {object} options - The request options.
     * @param {Function} send - Thunk that performs the actual `xhr.send()`.
     * @private
     */
    _acquire(xhr, options, send) {
        const limit = this._maxConcurrentRequests;
        const throttled = limit > 0 && Number.isFinite(limit) && options.async !== false;

        if (!throttled || this._activeRequests < limit) {
            if (throttled) {
                this._activeRequests++;
                xhr._slotHeld = true;
            }
            send();
        } else {
            this._sendQueue.push({ xhr, send });
        }
    }

    /**
     * Release the concurrency slot held by a completed request (if any) and dispatch any queued
     * requests that now fit under the limit. Idempotent per request via the `xhr._slotHeld` flag, so
     * it is safe to call from multiple completion paths (success, error, failed send).
     *
     * @param {XMLHttpRequest} xhr - The request object.
     * @private
     */
    _releaseSlot(xhr) {
        if (xhr._slotHeld) {
            xhr._slotHeld = false;
            this._activeRequests--;
            this._pump();
        }
    }

    /**
     * Dispatch queued requests while there is spare concurrency.
     *
     * @private
     */
    _pump() {
        const limit = this._maxConcurrentRequests;
        const throttled = limit > 0 && Number.isFinite(limit);

        if (!throttled) {
            // unthrottled (0 or Infinity): send everything immediately, with no slot accounting
            while (this._sendQueueHead < this._sendQueue.length) {
                this._sendQueue[this._sendQueueHead++].send();
            }
        } else {
            // throttled: keep the number of in-flight requests under the limit
            while (this._sendQueueHead < this._sendQueue.length && this._activeRequests < limit) {
                const { xhr, send } = this._sendQueue[this._sendQueueHead++];
                this._activeRequests++;
                xhr._slotHeld = true;
                send();
            }
        }

        // drop already-dispatched entries so the backing array (and the closures it retains) does
        // not grow without bound during large preloads
        if (this._sendQueueHead === this._sendQueue.length) {
            this._sendQueue.length = 0;
            this._sendQueueHead = 0;
        } else if (this._sendQueueHead > 256) {
            this._sendQueue = this._sendQueue.slice(this._sendQueueHead);
            this._sendQueueHead = 0;
        }
    }
}

const http = new Http();

export { http, Http };
