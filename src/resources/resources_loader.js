pc.extend(pc.resources, function () {
    /**
    * @name pc.resources.ResourceLoader
    * @constructor Create a new instance of a ResourceLoader
    * @class Used to make requests for remote resources.
    * The ResourceLoader is used to request a resource using an identifier (often the url of a remote file). 
    * Registered {@link pc.resources.ResourceHandler} perform the specific loading and opening functionality and will return
    * a new instance of a resource. The ResourceLoader contains a built in cache, that uses file hashes to ensure that 
    * resources are not fetched multiple times. Hashes must be registered against an identifier prior to making requests.
    * @example
    * var loader = new pc.resources.Loader();
    * loader.registerHandler(pc.resources.ImageRequest, new pc.resources.ImageResourceHandler());
    * var promise = loader.request(new pc.resources.ImageRequest("http://example.com/image.png"));
    * promise.then(function (resources) {
    *   var img = resources[0];
    * });
    */
    var ResourceLoader = function () {
        if (typeof(window.RSVP) === 'undefined') {
            logERROR('Missing RSVP library');
        }

        this._types = {}; // Registered resource types
        this._handlers = {}; // Registered resource handlers indexed by type
        this._requests = {}; // Currently active requests
        this._cache = {}; // Loaded resources indexed by hash
        this._hashes = {}; // Lookup from identifier to hash
        this._canonicals = {}; // Lookup from hash to canonical identifier

        // Counters for progress
        this._requested = 0;
        this._loaded = 0;

        this._sequence = 0; // counter for tracking requests uniquely

        pc.extend(this, pc.events);
    };

    ResourceLoader.prototype = {
        /**
        * @function
        * @name pc.resources.ResourceLoader#createFileRequest
        * @description Return a new {@link pc.resources.ResourceRequest} from the types that have been registered.
        * @param {Object} file A file entry like that from a {@link pc.fw.Asset}
        * @returns {pc.resources.ResourceRequest} A new ResourceRequest instance
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
        * @param {pc.resources.ResourceRequest|pc.resources.ResourceRequest[]} requests A single or list of {@link pc.resources.ResourceRequest}s which will be requested in this batch.
        * @returns {RSVP.Promise} A Promise object which is used to retrieve the resources once they have completed
        * @example
        * var requests = [
        *   new pc.resources.ImageRequest("http://example.com/image_one.png"),
        *   new pc.resources.ImageRequest("http://example.com/image_two.png")
        * ];
        * var promise = loader.request(requests);
        * promise.then(function(resources) {
        *   var img1 = resources[0];
        *   var img2 = resources[2];
        * });
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
                var promises = [];
                for (i = 0, n = requests.length; i < n; i++) {
                    // Use an existing request if there is one already in progress
                    var request = self._requests[requests[i].canonical] || requests[i];
                    
                    self._makeCanonical(request);

                    promises.push(self._request(request, options));
                    requested.push(request);

                    // If there is a parent request, add all child requests on parent
                    if (parent) {
                        parent.children.push(request);
                    }
                }

                // var promises = [];
                // requested.forEach(function (r) {
                //     promises.push(r.promise);
                // });

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
        * @private
        * @function
        * @name pc.resources.ResourceLoader#open
        * @description Perform just the open() part of the resource loading process. Useful if you already have the data from somewhere.
        * @param {pc.resources.ResourceRequest} RequestType The type of request to open
        * @param {Object} data The data to use for the new resource
        * @param {Object} options Optional arguments
        */
        open: function (RequestType, data, options) {
           var request = new RequestType();
           return this._handlers[request.type].open(data, request, options);
        },

        /**
        * @function
        * @name pc.resources.ResourceLoader#registerHash
        * @description Register a connection between a file hash and an identifier. If the same file is located via several identifiers, the hash ensures that only a single request is made.
        * @param {String} hash The file hash
        * @param {String} identifier The resource identifier
        */
        registerHash: function (hash, identifier) {
            if (!this._hashes[identifier]) {
                this._hashes[identifier] = hash;
            }

            if (!this._canonicals[hash]) {
                // First hash registered to a url gets to be canonical
                this._canonicals[hash] = identifier;
            }
        },

        /**
        * @function
        * @name pc.resources.ResourceLoader#getHash
        * @description Return the hash registered against the identifier
        * @param {String} identifier The identifier of a resource
        * @returns {String|undefined} The hash if the identifier is registered or undefined
        */
        getHash: function(identifier) {
            return this._hashes[identifier];
        },

        /**
        * @function
        * @name pc.resources.ResourceLoader#addToCache
        * @description Add a resource into the cache so that future requests will not make new requests.
        * @param {String} identifier The identifier for the resource
        * @param {Object} resource The resource to be cached
        */
        addToCache: function (identifier, resource) {
            var hash = this.getHash(identifier);
            if (hash) {
                this._cache[hash] = resource;    
            } else {
                logWARNING(pc.string.format("Could not add {0} to cache, no hash registered", identifier));
            }
        },

        /**
        * @function
        * @name pc.resources.ResourceLoader#getFromCache
        * @description Try and get a resource from the cache.
        * @param {String} identifier The identifier of the resource
        * @returns {Object|null} The resource if it exists in the cache, otherwise returns null
        */
        getFromCache: function (identifier) {
            var hash = this.getHash(identifier);
            if (hash) {
                return this._cache[hash];    
            } else {
                return null;
            }
        },

        /**
        * @function
        * @name pc.resources.ResourceLoader#resetProgress
        * @description Call this to reset the progress counter to 0
        */
        resetProgress: function () {
            this._requested = 0;
            this._loaded = 0;
        },

        // Make a request for a single resource and open it
        _request: function (request, _options) {
            var self = this;
            var promise = null;
            var options = {}; // Make a copy of the options per request
            for (key in _options) {
                options[key] = _options[key];
            }

            if (request.id === null) {
                request.id = this._sequence++;    
            }
            this.fire("request", request);

            if (request.promise) {
                // If the request has already been made, then wait for the result to come in
                promise = new RSVP.Promise(function (resolve, reject) {
                    request.promise.then(function (resource) {
                        var resource = self._postOpen(resource, request);
                        resolve(resource);
                    });
                });
            } else {

                // Check cache, load and open the requested data
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
            }

            self._requests[request.canonical] = request;
            this._requested++;

            return promise || request.promise;
        },

        // Convert loaded data into the resource using the handler's open() and clone() methods
        _open: function (data, request, options) {
            return this._handlers[request.type].open(data, request, options);
        },

        // After loading and opening clean up and fire events
        // Note, this method is called in three places, 
        // - with a newly opened resource
        // - with a resource retrieved from the cache
        // - with a resource that was requested twice concurrently, this is called again for the second request.
        _postOpen: function (resource, request) {
            this.addToCache(request.canonical, resource);
    
            resource = this._handlers[request.type].clone(resource, request);
            
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
        this.id = null;               // Sequence ID, given to the request when it is made
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
     * clone() which takes the opened resource and _may_ return a new copy of it, if necessary. Otherwise returns the original.
     */
    var ResourceHandler = function () {
    }; 
    
    ResourceHandler.prototype = {
        setLoader: function (loader) {
            this._loader = loader;
        },

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

        /**
        * @function
        * @name pc.resources.ResourceHandler#clone
        * @description If necessary return a clone of the resource. This is called after open(), if it is not possible to share a single instance
        * of a resource from the cache, then clone should return a new copy, otherwise the default is to return the original.
        * @param {Object} resource The resource that has just been requested
        * @returns {Object} Either the resource that was passed in, or a new clone of that resource
        */
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