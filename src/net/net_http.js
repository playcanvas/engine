/**
 * @name pc.net.http
 * @namespace Sending and receiving data via HTTP.
 */
pc.extend(pc.net, function () {
    var Http = function Http() {
    };

    /**
     * @private
     * @enum {String}
     * @name pc.net.http.ContentType
     * @description An enum of the most common content types
     */
     Http.ContentType = {
        FORM_URLENCODED : "application/x-www-form-urlencoded",
        GIF : "image/gif",
        JPEG : "image/jpeg",
        DDS : "image/dds",
        JSON : "application/json",
        PNG : "image/png",
        TEXT : "text/plain",
        XML : "application/xml",
        WAV : "audio/x-wav",
        OGG : "audio/ogg",
        MP3 : "audio/mpeg",
        BIN : "application/octet-stream"
    };

    Http.ResponseType = {
        TEXT: 'text',
        ARRAY_BUFFER: 'arraybuffer',
        BLOB: 'blob',
        DOCUMENT: 'document'
    };

    Http.binaryExtensions = [
        '.model',
        '.wav',
        '.ogg',
        '.mp3',
        '.dds'
    ];

    Http.prototype = {

        ContentType: Http.ContentType,
        ResponseType: Http.ResponseType,
        binaryExtensions: Http.binaryExtensions,

        /**
         * @function
         * @name pc.net.http.get
         * @description Perform an HTTP GET request to the given url.
         * @param {String} url
         * @param {Function} success Callback passed response text.
         * @param {Object} [options] Additional options
         * @param {Object} [options.params] Parameter to be encoded and added to the url as a query string
         * @param {Object} [options.error] Callback used on error called with arguments (status, xhr, exception)
         * @param {Object} [options.headers] HTTP headers to add to the request
         * @param {Object} [options.cache] If false, then add a timestamp to the request to prevent caching
         * @param {XmlHttpRequest} [xhr] An XmlHttpRequest object. If one isn't provided a new one will be created.
         */
        get: function (url, success, options, xhr) {
            options = options || {};
            options.success = success;
            /*if (options.params) {
                u = pc.URI(url);
                q = u.getQuery();
                q = pc.extend(q, options.params);
                u.setQuery(q);
                url = u.toString();
            }*/
            return this.request("GET", url, options, xhr);
        },

        /**
         * @function
         * @name pc.net.http.post
         * @description Perform an HTTP POST request to the given url
         * @param {String} url
         * @param {Function} success - callback passed response text.
         * @param {Object | FormData | Document} data Data to send to the server.
         * @param {Object} [options] Additional options
         * @param {Object} [options.error] Callback used on error called with arguments (status, xhr, exception)
         * @param {Object} [options.headers] HTTP headers to add to the request
         * @param {Object} [options.cache] If false, then add a timestamp to the request to prevent caching
         * @param {XmlHttpRequest} [xhr] An XmlHttpRequest object. If one isn't provided a new one will be created.
         */
        post: function (url, success, data, options, xhr) {
            options = options || {};
            options.success = success;
            options.postdata = data;
            return this.request("POST", url, options, xhr);
        },

        /**
         * @function
         * @name pc.net.http.put
         * @description Perform an HTTP PUT request to the given url
         * @param {String} url
         * @param {Function} success callback passed response text
         * @param {Object | FormData | Document} data Data to send to the server.
         * @param {Object} [options] Additional options
         * @param {Object} [options.error] Callback used on error called with arguments (status, xhr, exception)
         * @param {Object} [options.headers] HTTP headers to add to the request
         * @param {Object} [options.cache] If false, then add a timestamp to the request to prevent caching
         * @param {XmlHttpRequest} [xhr] An XmlHttpRequest object. If one isn't provided a new one will be created.
         */
        put: function (url, success, data, options, xhr) {
            options = options || {};
            options.success = success;
            options.postdata = data;
            return this.request("PUT", url, options, xhr);
        },

        /**
         * @function
         * @name pc.net.http.del
         * @description Perform an HTTP DELETE request to the given url
         * @param {Object} url
         * @param {Object} success
         * @param {Object} options
         * @param {XmlHttpRequest} xhr
         */
        del: function (url, success, options, xhr) {
            options = options || {};
            options.success = success;
            return this.request("DELETE", url, options, xhr);
        },

        /**
         * Make an XmlHttpRequest to the given url
         * @param {String} method
         * @param {String} url
         * @param {Object} [options] Additional options
         * @param {Object} [options.success] Callback used on success called with arguments (response, status, xhr)
         * @param {Object} [options.error] Callback used on error called with arguments (status, xhr, exception)
         * @param {Object} [options.headers] HTTP headers to add to the request
         * @param {Document | Object} [options.postdata] Data to send in the body of the request.
         * Some content types are handled automatically, If postdata is an XML Document it is handled, if the Content-Type header is set to 'application/json' then
         * the postdata is JSON stringified, otherwise by default the data is sent as form-urlencoded
         * @param {Object} [options.cache] If false, then add a timestamp to the request to prevent caching
         * @param {XmlHttpRequest} [xhr] An XmlHttpRequest object. If one isn't provided a new one will be created.
         */
        request: function (method, url, options, xhr) {
            var uri, query, timestamp, postdata;
            var errored = false;

            options = options || {};

            // fill in dummy implementations of success, error to simplify callbacks later
            if (options.success == null) {
                options.success = function (){};
            }
            if (options.error == null) {
                options.error = function (){};
            }
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
                }
                else if (options.postdata instanceof FormData) {
                    postdata = options.postdata;
                }
                else if (options.postdata instanceof Object) {
                    // Now to work out how to encode the post data based on the headers
                    var contentType = options.headers["Content-Type"];
                    // If there is no type then default to form-encoded
                    if(!pc.isDefined(contentType)) {
                        options.headers["Content-Type"] = Http.ContentType.FORM_URLENCODED;
                        contentType = options.headers["Content-Type"];
                    }
                    switch(contentType) {
                        case Http.ContentType.FORM_URLENCODED:
                            // Normal URL encoded form data
                            postdata = "";
                            var bFirstItem = true;

                            // Loop round each entry in the map and encode them into the post data
                            for (var key in options.postdata) {
                                if (options.postdata.hasOwnProperty(key)) {
                                    if (bFirstItem) {
                                        bFirstItem = false;
                                    }
                                    else {
                                        postdata += "&";
                                    }
                                    postdata += escape(key) + "=" + escape(options.postdata[key]);
                                }
                            }
                            break;
                        case Http.ContentType.JSON:
                        default:
                            if (contentType == null) {
                                options.headers["Content-Type"] = Http.ContentType.JSON;
                            }
                            postdata = JSON.stringify(options.postdata);
                            break;
                    }
                }
                else {
                    postdata = options.postdata;
                }
            }

            if (!xhr) {
                xhr = new XMLHttpRequest();
            }

            if (options.cache === false) {
                // Add timestamp to url to prevent browser caching file
                timestamp = pc.time.now();

                uri = new pc.URI(url);
                if (!uri.query) {
                    uri.query = "ts=" + timestamp;
                }
                else {
                    uri.query = uri.query + "&ts=" + timestamp;
                }
                url = uri.toString();
            }

            if (options.query) {
                uri = new pc.URI(url);
                query = pc.extend(uri.getQuery(), options.query);
                uri.setQuery(query);
                url = uri.toString();
            }

            xhr.open(method, url, options.async);
            xhr.withCredentials = options.withCredentials !== undefined ? options.withCredentials : true;
            xhr.responseType = options.responseType || this.guessResponseType(url);

            // Set the http headers
            for (var header in options.headers) {
                if (options.headers.hasOwnProperty(header)) {
                    xhr.setRequestHeader(header, options.headers[header]);
                }
            }

            xhr.onreadystatechange = function () {
                this.onReadyStateChange(method, url, options, xhr);
            }.bind(this);

            xhr.onerror = function () {
                this.onError(method, url, options, xhr);
                errored = true;
            }.bind(this);

            try {
                xhr.send(postdata);
            }
            catch (e) {
                // DWE: Don't callback on exceptions as behaviour is inconsistent, e.g. cross-domain request errors don't throw an exception.
                // Error callback should be called by xhr.onerror() callback instead.
                if (!errored) {
                    options.error(xhr.status, xhr, e);
                }
            }

            // Return the request object as it can be handy for blocking calls
            return xhr;
        },

        guessResponseType: function (url) {
            var uri = new pc.URI(url);
            var ext = pc.path.getExtension(uri.path);

            if(Http.binaryExtensions.indexOf(ext) >= 0) {
                return Http.ResponseType.ARRAY_BUFFER;
            }

            return Http.ResponseType.TEXT;
        },

        isBinaryContentType: function (contentType) {
            var binTypes = [Http.ContentType.WAV, Http.ContentType.OGG, Http.ContentType.MP3, Http.ContentType.BIN, Http.ContentType.DDS];
            if (binTypes.indexOf(contentType) >= 0) {
                return true;
            }

            return false;
        },

        onReadyStateChange: function (method, url, options, xhr) {
            if (xhr.readyState === 4) {
                switch (xhr.status) {
                    case 0: {
                        // If this is a local resource then continue (IOS) otherwise the request
                        // didn't complete, possibly an exception or attempt to do cross-domain request
                        if (url[0] != '/') {
                            this.onSuccess(method, url, options, xhr);
                        }

                        break;
                    }
                    case 200:
                    case 201:
                    case 206:
                    case 304: {
                        this.onSuccess(method, url, options, xhr);
                        break;
                    }
                    default: {
                        //options.error(xhr.status, xhr, null);
                        this.onError(method, url, options, xhr);
                        break;
                    }
                }
            }
        },

        onSuccess: function (method, url, options, xhr) {
            var response;
            var header;
            var contentType;
            var parameter;
            var parts;
            header = xhr.getResponseHeader("Content-Type");
            if (header) {
                // Split up header into content type and parameter
                parts = header.split(";");
                contentType = parts[0].trim();
                if(parts[1]) {
                    parameter = parts[1].trim();
                }
            }
            // Check the content type to see if we want to parse it
            if (contentType === this.ContentType.JSON || url.split('?')[0].endsWith(".json")) {
                // It's a JSON response
                response = JSON.parse(xhr.responseText);
            } else if (this.isBinaryContentType(contentType)) {
                response = xhr.response;
            } else {
                if (xhr.responseType === Http.ResponseType.ARRAY_BUFFER) {
                    logWARNING(pc.string.format('responseType: {0} being served with Content-Type: {1}', Http.ResponseType.ARRAY_BUFFER, contentType));
                    response = xhr.response;
                } else {
                    if (xhr.responseType === Http.ResponseType.DOCUMENT || contentType === this.ContentType.XML) {
                        // It's an XML response
                        response = xhr.responseXML;
                    } else {
                        // It's raw data
                        response = xhr.responseText;
                    }
                }
            }
            options.success(response, xhr.status, xhr);
        },

        onError: function (method, url, options, xhr) {
            options.error(xhr.status, xhr, null);
        }
    };

    Http.prototype.delete_ = Http.prototype.del;

    return {
        Http: Http,
        http: new Http()
    };
}());
