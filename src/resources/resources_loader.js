pc.resources = {};
pc.extend(pc.resources, function () {
    if (typeof(window.RSVP) === 'undefined') {
        throw Error('Missing RSVP library');
    }

    var ResourceLoader = function () {
        this._types = {}; // Registered resource types
        this._handlers = {}; // Registered resource handlers indexed by type
        this._requests = {}; // Currently active requests
        this._cache = {}; // Loaded resources indexed by hash
        this._hashes = {}; // Lookup from identifier to hash
        this._canonicals = {}; // Lookup from hash to canonical identifier

        // Counters for progress
        this._requested = 0;
        this._loaded = 0;

        pc.extend(this, pc.events);
    };

    ResourceLoader.prototype = {
        /**
        * @function
        * @name pc.resources.ResourceLoader#createFileRequest
        * @description Return a new {@link pc.resources.ResourceRequest} from the types that have been registered.
        * @param {Object} file A file entry like that from a {@link pc.fw.Asset}
        * @example
        * var request = loader.createRequest({
        *    url: 'assets/12/12341234-1234-1234-123412341234/image.jpg',
        *    type: 'image'
        * });
        * request; // pc.resources.ImageRequest
        */
        createFileRequest: function (url, type) {
            return new this._types[type](url);
        },

        /**
         * @function
         * @name pc.resources.ResourceLoader#registerHandler
         * @description Register a handler for a new type of resource. To register a handler you need to provided an instance of a ResourceHandler, 
         * and the ResourceRequest type to be associated with the handler.
         * @param {pc.resources.ResourceRequest} RequestType The type of request to associate with this handler
         * @param {pc.resources.ResourceHandler} handler A ResourceHandler instance.
         */
        registerHandler: function (RequestType, handler) {
            var request = new RequestType();
            if (request.type === "") {
                throw Error("ResourceRequests must have a type");
            }
            this._types[request.type] = RequestType;
            this._handlers[request.type] = handler;
            handler.setLoader(this);
        },

        /**
        * @function
        * @name pc.resources.ResourceLoader#request
        * @description Make a request for one or more resources from a remote location. A call to request() will try to retrieve all the resources requested,
        * using the ResourceHandlers for the specific type of request. Resources are cached once they have been requested, and subsequent requests will return the
        * the cached value.
        * The request() call returns a Promise object which is used to access the resources once they have all been loaded.
        */
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
                    // Use an existing request if there is one already in progress
                    var request = self._requests[requests[i].canonical] || requests[i];
                    
                    self._makeCanonical(request);

                    if (!request.promise) {
                        self._request(request, options);
                    }

                    requested.push(request);

                    // If there is a parent request, add all child requests on parent
                    if (parent) {
                        parent.children.push(request);
                    }
                }

                var promises = [];
                requested.forEach(function (r) {
                    promises.push(r.promise);
                });

                // Check that all child promises of the requests have been completed
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
                        }, function (error) {
                            reject(error);
                        });
                    } else {
                        self.fire("complete", resources)
                        resolve(resources)
                    }
                }

                RSVP.all(promises).then(function (resources) {
                    check(resources, requested, promises);
                }, function (error) {
                    reject(error);
                });
                
            });

            return promise;
        },

        /**
        * @name pc.resources.ResourceLoader#open
        * @description Open 
        */
        open: function (RequestType, data, options) {
           var request = new RequestType();
           return this._handlers[request.type].open(data, request, options);
        },

        registerHash: function (hash, identifier) {
            if (!this._hashes[identifier]) {
                this._hashes[identifier] = hash;
            }

            if (!this._canonicals[hash]) {
                // First hash registered to a url gets to be canonical
                this._canonicals[hash] = identifier;
            }
        },

        getHash: function(identifier) {
            return this._hashes[identifier];
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
        },

        /**
        * @name pc.resources.ResourceLoader#resetProgress
        * @description Call this to reset the progress counter to 0
        */
        resetProgress: function () {
            this._requested = 0;
            this._loaded = 0;
        },

        // Make a request for a single resource and open it
        _request: function (request, options) {
            var self = this;

            request.promise = new RSVP.Promise(function (resolve, reject) {
                var handler = self._handlers[request.type];
                if (!handler) {
                    var msg = "Missing handler for type: " + request.type;
                    self.fire("error", request, msg);
                    reject(msg);
                    return;
                }
                var resource = self.getFromCache(request.canonical);

                if (resource) {
                    // In cache, just resolve
                    resource = self._postOpen(resource, request);
                    resolve(resource);
                } else {
                    // Not in cache, load the resource
                    var promise = handler.load(request, options);
                    promise.then(function (data) {
                        var resource = self._open(data, request, options);
                        resource = self._postOpen(resource, request);
                        resolve(resource);
                    }, function (error) {
                        self.fire("error", request, error);
                        reject(error);
                    });
                }
            });

            self._requests[request.canonical] = request;
            this._requested++;

            return request.promise;
        },

        // Convert loaded data into the resource using the handler's open() and clone() methods
        _open: function (data, request, options) {
            return this._handlers[request.type].open(data, request, options);
        },

        _postOpen: function (resource, request) {
            resource = this._handlers[request.type].clone(resource, request);
            this.addToCache(request.canonical, resource);

            delete this._requests[request.canonical];
            this._loaded++
            this.fire("progress", this._loaded / this._requested);
            this.fire("load", request, resource);

            return resource;
        },

        /**
        * @name pc.resources.ResourceLoader#_makeCanonical
        * @description Set the canonical property on the request object. The canonical identifier is the identifier used
        * to make all requests. Resources with the same hash but different URLs will have the same canonical so that requests are not
        * duplicated
        * 
        */
        _makeCanonical: function (request) {
            // TODO: do this properly
            request.canonical = request.identifier;
        }
    };


    /**
     * @name pc.resources.ResourceRequest
     * @class A request for a single resource, located by a unique identifier.
     * @constructor Create a new request for a resoiurce
     * @param {String} identifier Used by the request handler to locate and access the resource. Usually this will be the URL or GUID of the resource.
     */
    var ResourceRequest = function ResourceRequest(identifier, result) {
        this.identifier = identifier; // The identifier for this resource
        this.canonical = identifier;  // The canonical identifier using the file hash (if available) to match identical resources
        this.alternatives = [];       // Alternative identifiers to the canonical
        this.promise = null;          // The promise that will be honored when this request completes
        this.children = [];           // Any child requests which were made while this request was being processed
        if (result !== undefined) {
            this.result = result;     // The result object can be supplied and used by a handler, instead of creating a new resource
        }
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
        load: function (request, options) {
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