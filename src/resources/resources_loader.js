pc.resources = {};
pc.extend(pc.resources, function () {
    if (typeof(window.RSVP) === 'undefined') {
        throw Error('Missing RSVP library');
    }

    var ResourceLoader = function () {
        this._maxConcurrentRequests = 4;
        this._types = {};
        this._handlers = {};
        this._requests = {};
        this._cache = {};
    };

    ResourceLoader.prototype = {

        registerHandler: function (RequestType, handler) {
            var request = new RequestType();
            if (request.type === "") {
                throw Error("ResourceRequests must have a type");
            }
            this._types[request.type] = RequestType;
            this._handlers[request.type] = handler;
            handler.setLoader(this);
        },

        request: function (requests, options) {
            options = options || {};
            
            var self = this;
            var parent = options.parent;

            var promise = new RSVP.Promise(function (resolve, reject) {
                var i, n;
                var p;

                // Convert single request to list
                if (requests.length === undefined) {
                    requests = [requests];
                }

                var requested = [];
                for (i = 0, n = requests.length; i < n; i++) {  
                    var request = self._requests[requests[i].canonical] || requests[i];
                    self.makeCanonical(request);

                    if (!request.promise) {
                        self._request(request, options);
                    }

                    requested.push(request);

                    // if (self._requests[request.canonical]) {
                    //     // merge with existing request
                    //     promises.push(self._requests[request.canonical].promise);
                    // } else {
                    //     // new request
                    //     promises.push(self._request(request, options));
                    // }

                    // If there is a parent request, add all child requests on parent
                    if (parent) {
                        parent.children.push(request);
                    }
                }


                var promises = [];
                requested.forEach(function (r) {
                    promises.push(r.promise);
                });

                var check = function (resources, requests, promises) {
                    var i, n;
                    var childPromises = [];
                    var childRequests = [];
                    requests.forEach(function (r) {
                        r.children.forEach(function (c) {
                            childRequests.push(c);
                            childPromises.push(c.promise);
                        })
                    });

                    if (childPromises.length) {
                        RSVP.all(childPromises).then(function(childResources) {
                            check(resources, childRequests, childPromises);
                        });
                    } else {
                        resolve(resources)
                    }
                }

                RSVP.all(promises).then(function (resources) {
                    check(resources, requested, promises);
                });
                
            });

            return promise;
        },

        _request: function (request, options) {
            var self = this;

            request.promise = new RSVP.Promise(function (resolve, reject) {
                var handler = self._handlers[request.type];
                var resource = self.getFromCache(request.canonical);

                if (resource) {
                    // In cache resolve 
                    delete self._requests[request.canonical];
                    resolve(resource);
                } else {
                    // Not in cache, load the resource
                    var promise = handler.load(request, options);
                    promise.then(function (resource) {
                        delete self._requests[request.canonical];
                        resolve(self._open(resource, request, options));
                    }, function (error) {
                        reject(error);
                    })
                }
            });

            self._requests[request.canonical] = request;

            return request.promise;
        },

        _open: function (resource, request, options) {
            var handler = this._handlers[request.type];
            resource = handler.open(resource, request, options);
            resource = handler.clone(resource, request);
            this.addToCache(request.canonical, resource);
            return resource;
        },

        makeCanonical: function (request) {
            // TODO: do this properly
            request.canonical = request.identifier;
        },

        addToCache: function (identifier, resource) {
            // TODO: use hash instead of identifier
            this._cache[identifier] = resource;
        },

        getFromCache: function (identifier) {
            // TODO: use hash instead of identifier
            if (this._cache[identifier]) {
                return this._cache[identifier];
            }

            return null;
        }
    };


    /**
     * @name pc.resources.ResourceRequest
     * @class A request for a single resource, located by a unique identifier.
     * @constructor Create a new request for a resoiurce
     * @param {String} identifier Used by the request handler to locate and access the resource. Usually this will be the URL or GUID of the resource.
     */
    var ResourceRequest = function ResourceRequest(identifier) {
        this.identifier = identifier; // The identifier for this resource
        this.canonical = identifier;  // The canonical identifier using the file hash (if available) to match identical resources
        this.alternatives = [];       // Alternative identifiers to the canonical
        this.promise = null;          // The promise that will be honored when this request completes
        this.children = [];           // Any child requests which were made while this request was being processed
    };

    /**
     * @name pc.resources.ResourceHandler
     * @class Abstract base class for ResourceHandler. The resource handler performs the request to fetch the resource from a remote location,
     * and then it converts the response into the runtime resource object type. A resource handler must implement three methods:
     * 
     * load() which fetches the resource data from a remote location (a file, a remote server, etc)
     * open() which takes the response from load() and creates a new instance of a Resource
     * postopen() which takes the opened resource and performs optional additional resource loading
     */
    var ResourceHandler = function () {
    }; 
    
    ResourceHandler.prototype = {
        setLoader: function (loader) {
            this._loader = loader;
        },

        // getFromCache: function (identifier) {
        //     var hash = this._loader.getHash(identifier);
        //     var resource = null;

        //     if (hash) {
        //         resource = this._loader.getFromCache(hash);
        //         if (resource) {
        //             console.log('Found in cache: ' + identifier);
        //         }
        //     }

        //     return resource;
        // },

        // addToCache: function (identifier, resource) {
        //     var hash = this._loader.getHash(identifier);
        //     if (hash) {
        //         logDEBUG('Added to cache: ' + identifier);
        //         this._loader.addToCache(hash, resource);
        //     } else {
        //         logWARNING(pc.string.format("Could not add resource {0} to cache, no hash stored", identifier));
        //     }
            
        // },

        /**
         * @function
         * @name pc.resources.ResourceHandler#load
         * @description Fetch the resource from a remote location and then call the success callback with the response 
         * If an error occurs the request is stopped and the error callback is called with details of the error. 
         * If supported the progress callback is called during the download to report percentage complete progress.
         * @param {string} identifier A unique identifier for the resource, possibly the URL or GUID of the resource
         * @param {Object} [options]
         * @param {Number} [options.priority] The priority of the request for this resource
         * @returns {Promise} A promise of the resource data
          */
        load: function (identifier, options) {
            throw Error("Not implemented");
        },

        /**
        * @function
        * @name pc.resources.ResourceHandler#open
        * @description Take the data downloaded from the request and turn it into a resource object for use at runtime. 
        * For example, and ImageResourceHandler.open() will return an Image object and an EntityResourceHandler.open() will return an Entity.
        * @param data The data used to instanciate the resource
        * @param [options]
        * @param {Number} [options.priority] The priority of the request for this resource
        */
        open: function (data, options) {
            throw Error("Not implemented");
        },

        clone: function (resource) {
            return resource;
        }
    };

    return {
        ResourceLoader: ResourceLoader,
        ResourceHandler: ResourceHandler,
        ResourceRequest: ResourceRequest
    };
}());