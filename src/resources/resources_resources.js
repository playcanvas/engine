/**
 * @name pc.resources
 * @namespace Resource loading API
 * @description Functions for loading resources, particularly loading javascript files and attaching them to the page.
 */
pc.resources = function () {

    /**
     * @name pc.resources.ResourceLoader
     * @class The ResourceLoader is used to request resources from remote locations.
     * It understands specific resources types which are added by registering a ResourceHandler with a ResourceRequest. A request is made by passing a list of ResourceRequest objects to 
     * the request() method. Callbacks are provided to tell you if there were errors, notify you of progress and tell you that the batch of requests is complete.
     * @example
     *   var loader = pc.resources.ResourceLoader();
     *   
     *   // Add a handler for request Image resources
     *   loader.registerHandler(pc.resources.ImageRequest, new pc.resources.ImageResourceHandler());
     *   
     *   var requests = [
     *       new pc.resources.ImageRequest("http://example.com/image1.png")
     *       new pc.resources.ImageRequest("http://example.com/image2.png")
     *   ];
     * 
     *   loader.request(requests, function (resources) {
     *       // Both resources are ready to use now
     *       var image1 = resources["http://example.com/image1.png"]; // This is an Image() object
     *       var image2 = resources["http://example.com/image2.png"];
     *   }, function (errors) {
     *       errors.forEach(function (error) {
     *          log.error(error);
     *       }, this), function (progress) {
     *   });
     */
    var ResourceLoader = function (options) {
        options = options || {};
        options.maxConcurrentRequests = options.maxConcurrentRequests || 32;
         
        this._loading = [];
        this._pending = [];
        this._batches = [];
        this._handlers = {}; // Store registered handlers
        this._types = {}; // Store registered types
        this._requests = {};
        this._hashes = {}; // Lookup from file url to file hash
        this._canonicals = {}; // Lookup from hash to canonical file url
        this._cache = {}; // Loaded resources stored by file hash
        this._sequence = 1; // internal counter for sorting based on request order
        
        this._batchId = 1; // internal counter for creating batch handles.
        this._maxConcurrentRequests = options.maxConcurrentRequests;

        // Add events
        pc.extend(this, pc.events);
    };

    /**
     * @function
     * @name pc.resources.ResourceLoader#registerHandler
     * @description Register a handler for a new type of resource. To register a handler you need to provided an instance of a ResourceHandler, 
     * and the ResourceRequest type to be associated with the handler.
     * @param {pc.resources.ResourceRequest} RequestType The type of request to associate with this handler
     * @param {pc.resources.ResourceHandler} handler A ResourceHandler instance.
     */
    ResourceLoader.prototype.registerHandler = function (RequestType, handler) {
        var request = new RequestType();
        if (request.type === "") {
            throw Error("ResourceRequests must have a type");
        }
        this._types[request.type] = RequestType;
        this._handlers[request.type] = handler;
        handler.setLoader(this);
    };
    
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
    ResourceLoader.prototype.createFileRequest = function (url, type) {
        return new this._types[type](url);
    },

    ResourceLoader.prototype.registerHash = function (hash, identifier) {
        if (!this._hashes[identifier]) {
            this._hashes[identifier] = hash;
        }

        if (!this._canonicals[hash]) {
            // First hash registered to a url gets to be canonical
            this._canonicals[hash] = identifier;
        }
    };

    ResourceLoader.prototype.getHash = function(identifier) {
        return this._hashes[identifier];
    };

    ResourceLoader.prototype.addToCache = function (identifier, resource) {
        var hash = this.getHash(identifier);
        if (hash) {
            this._cache[hash] = resource;    
        } else {
            logWARNING(pc.string.format("Could not add {0} to cache, no hash registered", identifier));
        }
        
    };

    ResourceLoader.prototype.getFromCache = function(identifier) {
        var hash = this.getHash(identifier);
        if (hash) {
            return this._cache[hash];    
        } else {
            return null;
        }
    };

    /**
    * @function
    * @name pc.resources.ResourceLoader#getCanonicalIdentifier
    * @description Returns the canonical identifier for a given identifier. If two files are registered with the same hash but different urls
    * one of them will be assigned the canonical, all requests will be made to the canonical identifier so that multiple requests are cached correctly.
    * @returns {String} The canonical identifier use which is used to as the key for resources in the cache
    */
    ResourceLoader.prototype.getCanonicalIdentifier = function(identifier) {
        var hash = this.getHash(identifier);
        if (this._canonicals[hash]) {
            return this._canonicals[hash];
        } else {
            return identifier;
        }
    };

    /**
     * @function
     * @name pc.resources.ResourceLoader#request
     * @description Request a batch of resources from a remote location. A call to request will download a batch of resources and inform you via callbacks when all resources are ready to use.
     * @param {ResourceRequest|Array} requests A ResourceRequest or array of ResourceRequests to fetch
     * @param {Number} [priority] Priority of download, lower is higher priority, default = 1
     * @param {Function} [success] Callback called after all requests have been successfully download and processed, it is passed a object containing all the resources keyed by their identitier.
     * @param {Function} [error] Callback called if there are errors while requesting resources. It is passed an object containing error messages keyed by their identifier, and an object containing all the resources which succeeded, keyed by their identifier
     * @param {Function} [progress] Callback called periodically during the request process to indicate the progress of the entire request. It is passed a percentage complete value 0-1.
     * @param {Object} [options]
     * @param {Number} [options.batch] Handle for parent batch of this request. If the request is made with a parent, then the parent request will not complete until the child one has.
     * @returns {Number} A request handle which can be used to cancel the request.
     * @example
     * 
     * var loader = ResourceLoader();
     * // ... register handlers here
     * 
     * var requests = [
     *      new ImageRequest("http://example.com/image1.png"),
     *   new ModelRequest("http://example.com/model.json"),
     *   new EntityRequest("00000000-0000-0000-0000-000000000000")
     * ]
     * loader.request(requests, 1, function (resources) {
     *         // resources are available here
     *        var image = resources['http://example.com/image1.png'];
      *      var model = resources['http://example.com/model.json'];
      *      var entity = resources['00000000-0000-0000-0000-000000000000'];
     *     ), function (errors) {
     *     }, function (progress) {
     *     });
     */
    ResourceLoader.prototype.request = function (requests, priority, success, error, progress, options) {
        var batch = null;
        var self = this;
        
        // Re-jig arguments if priority has been left out.
        if(typeof(priority) == "function") {
            options = progress;
            progress = error;
            error = success;
            success = priority;
            priority = 1;
        }
        options = options || {};
        
        // Convert single request into a list
        if (!requests.length) {
            requests = [requests];
        }
                
        // Create a batch for this request
        batch = new RequestBatch(this._batchId++, requests, priority, success, error, function (pcnt) {
            var value = this.getProgress();
            self.fire('batchprogress', self, batch);
            if (progress) {
                progress(value);
            }
        });

        // If a batch handle is passed in as an option, we use it as a 'parent' to the new batch. 
        // The parent batch won't be complete until all it's children are complete.
        if (options.batch) {
            var parent = this.getRequestBatch(options.batch);
            if (!parent) {
                throw new Error(pc.string.format("Cannot find batch with handle '{0}'", options.batch));
            }
            
            parent.children.push(batch);
            batch.parent = parent;
            
            // overwrite priority to match parent priority
            batch.priority = parent.priority;    
        }

        // Append each request with the batch it belongs to and the priority for easy access, 
        // then push the requests into the pending list
        requests.forEach(function (request, index, arr) {
            request.canonical = this.getCanonicalIdentifier(request.identifier);
            if (this._requests[request.canonical]) {
                // This resource has already been requested, append the existing request with this batch so it gets the callbacks
                var existingRequest = this._requests[request.canonical];
                existingRequest.batches.push(batch);
                existingRequest.alternatives.push(request.identifier);
                // Update the priority to the highest of the two
                existingRequest.priority = Math.min(existingRequest.priority, priority);
            } else {
                // Add a new request
                request.batches = [];
                request.batches.push(batch);
                request.priority = batch.priority;
                request.sequence = this._sequence++;
                this._requests[request.canonical] = request;
                this._pending.push(request.canonical);                
            }
        }, this);
        
        // sort the pending queue into priority order 
        this._sort();
        
        this.fire('newbatch', this, batch);

        // Store the batch
        this._batches.push(batch);
        
        this._update();
        
        return batch.handle;
    };
    
    
    ResourceLoader.prototype.open = function (RequestType, data, success, error, progress, options) {
       var request = new RequestType();
       return this._handlers[request.type].open(data, success, error, progress, options);
    };
    
    /**
     * @name pc.resources.ResourceLoader#cancel
     * @description Cancel a request. This will remove any pending requests in the batch, the success callback will not be called.
     * @param handle The request handle returned from the original request.
     */
    ResourceLoader.prototype.cancel = function (handle) {
        var index = 0;
        var length = this._batches.length;
        var batch;
        for (index = 0; index < length; ++index) {
            batch = this._batches[index];
            if (batch.handle == handle) {
                batch.requests.forEach(function (request, index, arr) {
                    // remove all requests from pending list
                    var reqIndex = this._pending.indexOf(request.identifier);
                    if (reqIndex >= 0) {
                        this._pending.splice(reqIndex, 1);    
                    }
                }, this);
            }    
        }
    };

    ResourceLoader.prototype.getProgress = function () {
        var i, len = this._batches.length;
        var current = 0;
        var total = len;

        for (i = 0; i < len; i++) {
            var batch = this._batches[i];

            current = current + batch.getProgress();
        }

        return current / total;
    };

    ResourceLoader.prototype.getRequestBatch = function (handle) {
        var i;
        var length = this._batches.length;
        for(i = 0; i < length; ++i) {
            if(this._batches[i].handle == handle) {
                return this._batches[i];
            }
        } 
        return null;
    };
        
    ResourceLoader.prototype._sort = function () {
        this._pending.sort(function (a,b) {
            var s = this._requests[a].priority - this._requests[b].priority;
            // If the priorities are the same, then sort on sequence order
            if (s === 0) {
                return this._requests[a].sequence - this._requests[b].sequence;
            } else {
                return s;    
            }
        }.bind(this));
    };
    
    ResourceLoader.prototype._update = function () {
        while ((this._pending.length > 0) && (this._loading.length < this._maxConcurrentRequests)) {
            (function () {
                // remove first request identifier from pending list with shift(), fetch the request and then add it to loading list
                var request = this._requests[this._pending.shift()];
                this._loading.push(request.canonical);
                
                var options = {
                    priority: request.priority,
                    batch: request.batches[0].handle // pass in original batch for any sub-requests to use
                };
                var handler = this._handlers[request.type];
                
                // fire loadrequest event
                this.fire('loading', this, request);

                var resource = this.getFromCache(request.canonical);
                if (resource) {
                    // Found resource in cache
                    logDEBUG(pc.string.format('Found {0} in cache', request.canonical));
                    
                    this._completeRequest(request);

                    var i, len = request.batches.length;
                    for (i = 0; i < len; i++) {
                        this._afterOpened(request, resource, handler, request.batches[i], options);    
                    }
                    
                } else {
                    logDEBUG(pc.string.format('Cache miss: {0}', request.canonical));
                    // load using handler
                    handler.load(request.canonical, function (response, options) {
                        this._completeRequest(request);

                        // Handle success operations for each batch that this request is part of
                        // Call open() and then postOpen() to create a new resource for each batch that requires a resource. 
                        var i, len = request.batches.length;
                        for (i = 0; i < len; i++) {
                            var resource = handler.open(response, options);
                            this._afterOpened(request, resource, handler, request.batches[i], options);
                        }
                        
                        // Make any new requests
                        this._update();
                    }.bind(this), function (errors) {
                        this._completeRequest(request);
                        // Handle error operations for each batch that this request is part of
                        request.batches.forEach(function (batch, index, arr) {
                            this.fire('error', this, request, batch, errors);

                            var complete = batch.addResourceError(request, errors);
                            if(complete) {
                                this._completeBatch(batch);
                            }
                        }, this);
                        
                    }.bind(this), function (progress) {
                        // This is for progress on a sub-resource level. e.g. the percentage complete a file download is
                        // None of the resource handlers support this yet.
                        request.batches.forEach(function (batch, index, arr) {
                            this.fire('requestprogress', this, request, batch, progress);
                            /*if (batch.progress) {
                                batch.progress(progress);    
                            }*/
                        }, this);
                    }.bind(this), options);
                }
            }.call(this));
        }                
    };

    ResourceLoader.prototype._afterOpened = function (request, resource, handler, batch, options) {
        handler.postOpen(resource, function (resource) {
            this.addToCache(request.canonical, resource);

            // Clone resource if handler requires it
            resource = handler.clone(resource);

            // Add new resources (using original identifier) to all batches that requested it, and check to see if the batch is now complete
            var complete = batch.addResource(request, resource);
            if (complete) {
                this._completeBatch(batch);
            }
            this.fire('loaded', this, request, batch, resource);
        }.bind(this), function (errors) {
            if (batch.error) {
                batch.error(errors);    
            }
            if (batch.parent) {
                batch.parent.error(errors);
            }
        }, function (progress) {
            // This is for progress on the postOpen() call
            if (batch.progress) {
                batch.progress(progress);
            }
        }, options);
    };

    
    /**
     * @name pc.resources.ResourceLoader#_completeRequest
     * @description Called when a request is completed regardless of whether it succeeded or failed.
     * @private
     * @function
     * @param {pc.resources.ResourceRequest} request The request that has just completed
     */
    ResourceLoader.prototype._completeRequest = function (request) {
        // Request is now complete, remove it from map
        delete this._requests[request.canonical];
    
        // Remove request from _loading list
        this._loading.splice(this._loading.indexOf(request.canonical), 1);
    }; 
    
    /**
     * @name pc.resources.ResourceLoader#_completeBatch
     * @description Called when a batch is completed
     * @private
     * @function
     * @param {pc.resources.RequestBatch} batch The batch that has just completed
     */
    ResourceLoader.prototype._completeBatch = function (batch) {
        // Remove completed batch
        this._batches.splice(this._batches.indexOf(batch), 1);

        this.fire('batchcomplete', this, batch);
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

        getFromCache: function (identifier) {
            var hash = this._loader.getHash(identifier);
            var resource = null;

            if (hash) {
                resource = this._loader.getFromCache(hash);
                if (resource) {
                    console.log('Found in cache: ' + identifier);
                }
            }

            return resource;
        },

        addToCache: function (identifier, resource) {
            var hash = this._loader.getHash(identifier);
            if (hash) {
                logDEBUG('Added to cache: ' + identifier);
                this._loader.addToCache(hash, resource);
            } else {
                logWARNING(pc.string.format("Could not add resource {0} to cache, no hash stored", identifier));
            }
            
        },

        /**
         * @function
         * @name pc.resources.ResourceHandler#load
         * @description Fetch the resource from a remote location and then call the success callback with the response 
         * If an error occurs the request is stopped and the error callback is called with details of the error. 
         * If supported the progress callback is called during the download to report percentage complete progress.
         * @param {string} identifier A unique identifier for the resource, possibly the URL or GUID of the resource
         * @param {Function} success Callback passed the successfully fetched resource and an options object to pass the open method
         * @param {Function} [error] Callback passed an array of error messages if the request fails
         * @param {Function} [progress] If supported, the progress callback is called periodically with a percentage complete value.
         * @param {Object} [options]
         * @param {Number} [options.priority] The priority of the request for this resource
          */
        load: function (identifier, success, error, progress, options) {
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
         * @name pc.resources.ResourceHandler#postOpen
         * @description Called after the open() method with the resultant resource. Used to start requests for other child resources (e.g. in EntityResourceHandler) but allows open() to remain 
         * synchronous. Default behaviour is to call success callback straight away with the resource passed in.
         * @param resource {Object} The resource returned from open()
         * @param success {Function} Success callback passed the resource
         * @param error {Function} Error callback passed a list of error messages
         * @param progress {Function} Progress callback passed percentage complete number
         * @param [options] {Object} Options specific for the resource handler, passed on from load() and open() methods
         * 
         */
        postOpen: function (resource, success, error, progress, options) {
            success(resource);
        },


        clone: function (resource) {
            return resource;
        }
    };


    
    
     
    
    /**
     * @private
     * @name RequestBatch
     * @description A collection of requests that is processed together. A batch of requests provides a callback when it is completed, and a progress callback after each resource is loaded
     * @param handle The handle for this batch, an increasing int, don't reuse handles.
     * @param requests List of requests that make up this batch
     * @param priority The priority to load this batch at. Lower priority is loaded first
     * @param success The callback fired when all requests and all child batches are complete
     * @param error The callback fired if there is an error
     * @param progress The callback fired after each individual request is completed. 
     */
    var RequestBatch = function (handle, requests, priority, success, error, progress) {
        this.handle = handle;
        this.requests = requests;
        this.count = 0;
        this.resources = {}; // successfully requested resources
        this.errors = {}; // errors strings for any failed requests
        this.parent = null;
        this.children = [];
        this.priority = priority;
        this.success = success;
        this.error = error;
        this.progress = progress;
        this.completed = false; // Set to true once all resources have completed
        this.errored = false; // Set to true if any resources encountered errors
    };
    
    /**
     * @private
     * @name RequestBatch#addResource
     * @description Add a resource to the completed resource list.
     * @param {pc.resources.ResourceRequest} request The request that tried to download this resource 
     * @param {Object} resource The actual resource object, this must be one of the resources requested.
     */
    RequestBatch.prototype.addResource = function (request, resource) {
        this.resources[request.identifier] = resource;
        // Add all alternatives identifiers as well.
        var i, len = request.alternatives.length;
        for (i = 0; i < len; i++) {
            this.resources[request.alternatives[i]] = resource;
        }
        this.count += 1;
        return this._update();
    };
    
    /**
     * @private
     * @name RequestBatch#addResourceError
     * @description Add a resource to the error list.
     * @param {pc.resources.ResourceRequest} request The request that tried to download this resource 
     * @param {Array} errors Array of error strings
     */
    RequestBatch.prototype.addResourceError = function (request, errors) {
        this.errored = true;
        this.errors[request.identifier] = errors;
        // Add all alternatives identifiers as well.
        var i, len = request.alternatives.length;
        for (i = 0; i < len; i++) {
            this.errors[request.alternatives[i]] = errors;
        }
        this.count += 1; // TODO: This shouldn't always count up, in some cases the error has occured after addResource() is called and the count is already incremented
        return this._update();
    };
    
    /**
     * @private
     * @name RequestBatch#getProgress
     * @description Get a percentage value of how complete the batch is. Includes all child batches
     */
    RequestBatch.prototype.getProgress = function () {
        return this._getCount() / this._getTotal();
    };
    
    /**
     * @private
     * @name RequestBatch#isComplete
     * @description Returns true if this batch and all it's children are complete
     */
    RequestBatch.prototype.isComplete = function () {
        var i;
        var length = this.children.length;
        for (i=0;i<length;++i) {
            if(!this.children[i].isComplete()) {
                return false;
            }
        }
        
        return (this.count == this.requests.length);
    };
    
    RequestBatch.prototype._updateProgress = function () {
        if (this.progress) {
            this.progress( this.getProgress() );
        }
    };
    
    RequestBatch.prototype._update = function () {
        this._updateProgress();
            
        if (this.isComplete()) {
            this.completed = true;
            if (!this.errored) {
                if (this.success) {
                    this.success(this.resources);
                }                
            } else {
                if (this.error) {
                    this.error(this.errors, this.resources);
                }
                
                if (this.parent) {
                    this.parent.error(this.errors, this.resources);
                }
            }

            if (this.parent && !this.parent.completed) {
                this.parent._update();
            }
            
            return true;
        }
        
        return false;
    };
    
    RequestBatch.prototype._getCount = function () {
        var count = this.count;
        var i;
        var length = this.children.length;
        for (i=0;i<length;++i) {
            count += this.children[i]._getCount();
        }
        
        return count;
    };
    
    RequestBatch.prototype._getTotal = function () {
        var total = this.requests.length;
        var i;
        var length = this.children.length;
        for (i = 0; i < length; i++) {
            total += this.children[i]._getTotal();
        }

        return total;
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
    };

    return {
        ResourceLoader: ResourceLoader,
        ResourceHandler: ResourceHandler,
        ResourceRequest: ResourceRequest
    };
} ();