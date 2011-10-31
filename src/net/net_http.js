/**
 * @name pc.net.http
 * @namespace Sending and receiving data via HTTP.
 */
pc.net.http = function () {
    return {
        /**
         * @enum {String}
         * @name pc.net.http.ContentType
         * @description An enum of the most common content types 
         */
        ContentType: {
            FORM_URLENCODED : "application/x-www-form-urlencoded",
            GIF : "image/gif",
            JPEG : "image/jpeg",
            JSON : "application/json",
            PNG : "image/png",
            TEXT : "text/plain",
            XML : "application/xml"
        },
        
        /**
         * Perform an HTTP GET request to the given url.
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
            return pc.net.http.request("GET", url, options, xhr);
        },

        /**
         * Perform an HTTP POST request to the given url
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
            return pc.net.http.request("POST", url, options, xhr);
        },

        /**
         * Perform an HTTP PUT request to the given url
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
            return pc.net.http.request("PUT", url, options, xhr);
        },
        
        /**
         * Perform an HTTP DELETE request to the given url
         * @param {Object} url
         * @param {Object} success
         * @param {Object} options
         * @param {XmlHttpRequest} xhr
         */
        delete_: function (url, success, options, xhr) {
            options = options || {};
            options.success = success;
            return pc.net.http.request("DELETE", url, options, xhr);
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
                        options.headers["Content-Type"] = pc.net.http.ContentType.FORM_URLENCODED;
                        contentType = options.headers["Content-Type"];
                    }
                    switch(contentType) {
                        case pc.net.http.ContentType.FORM_URLENCODED:
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
                        case pc.net.http.ContentType.JSON:
                        default:
                            if (contentType == null) {
                                options.headers["Content-Type"] = pc.net.http.ContentType.JSON;
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
                
            if( options.cache === false ) {
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
            
            xhr.open(method, url, options.async);
            xhr.withCredentials = true;
        
            // Set the http headers
            for (var header in options.headers) {
                if (options.headers.hasOwnProperty(header)) {
                    xhr.setRequestHeader(header, options.headers[header]);
                }
            }
        
            xhr.onreadystatechange = function () {
                var response;
                var header;
                var contentType;
                var parameter;
                var parts; 
                if (xhr.readyState === 4) {
                    switch (xhr.status)
                    {
                    case 0:
                        // Request didn't complete, possibly an exception or attempt to do cross-domain request
                        // options.error(xhr.status, xhr, null);
                        break;
                        
                    case 200:
                    case 201:
                    case 206:
                    case 304: {
                        header = xhr.getResponseHeader("Content-Type");
                        if (header) { 
                            // Split up header into content type and parameter
                            var parts = header.split(";");
                            contentType = parts[0].trim();
                            if(parts[1]) {
                                parameter = parts[1].trim();
                            }
                        }
                        // Check the content type to see if we want to parse it
                        if (contentType == pc.net.http.ContentType.JSON || pc.string.endsWith(url, ".json")) {
                            // It's a JSON response
                            response = JSON.parse(xhr.responseText);
                        }
                        else 
                            if (xhr.responseXML != null) {
                                // It's an XML response
                                response = xhr.responseXML;
                            }
                            else {
                                // It's raw data
                                response = xhr.responseText;
                            }
                        options.success(response, xhr.status, xhr);
                        break;
                    }
                    default:
                        options.error(xhr.status, xhr, null);
                        break;
                    }
                }
            };
            
            xhr.onerror = function () {
                options.error(xhr.status, xhr, null);
                errored = true;  
            };
            
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
        }
    };
}();



