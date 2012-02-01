
/**
 * @name pc.scene
 * @namespace Namespace for scene graph management and rendering
 */
pc.scene = {};

pc.extend(pc.scene, function () {

    /**
     * @name pc.scene.Scene
     * @class A scene.
     */
    var Scene = function Scene() {
        // List of models
        this._models = [];
        this._tempVec = pc.math.vec3.create(0, 0, 0);

        this._alphaMeshes = [];
        this._opaqueMeshes = [];

        // Initialize dispatch queues
        this._queues = {};
        this._priorities = [];
        this.addQueue({ name: "first", priority: 1.0 });
        this.addQueue({ name: "opaque", priority: 2.0 });
        this.addQueue({ name: "transparent", priority: 3.0 });
        this.addQueue({ name: "last", priority: 4.0 });
        this.addQueue({ name: "post", priority: 5.0 });
        this.addQueue({ name: "overlay", priority: 6.0 });
    };

    Scene.prototype.addQueue = function (queue) {
        var sortQueuesOnPriority = function (queueA, queueB) {
            var priorityA = queueA.priority;
            var priorityB = queueB.priority;
            return priorityA > priorityB;
        }

        this._queues[queue.name] = { renderFuncs: [], priority: queue.priority };
        this._priorities.push(queue);
        this._priorities.sort(sortQueuesOnPriority);
    };

    Scene.prototype.getQueuePriority = function (queueName) {
        return this._queues[queueName].priority;
    };

    Scene.prototype.getModels = function () {
        return this._models;
    };

    Scene.prototype.addModel = function (model) {
        this._models.push(model);
    };

    Scene.prototype.removeModel = function (model) {
        var index = this._models.indexOf(model);
        if (index !== -1) {
            this._models.splice(index, 1);
        }
    };
    
    Scene.prototype.containsModel = function (model) {
        return this._models.indexOf(model) >= 0;
    };
    
	
    /**
     * @function
     * @name pc.scene.Scene#update
     * @description Queues the meshes in a scene for rendering. This function does not actually
     * cause the meshes in the scene to be rendered. Instead, it inserts all opaque meshes into
     * a front-to-back render queue and all transparent meshes into a back-to-front render queue.
     * To actually render the contents of the render queues, call pc.scene.Scene#flush.
     * @param {pc.scene.CameraNode} camera The camera rendering the scene.
     * @author Will Eastcott
     */
	Scene.prototype.update = function (dt) {
	    for (var i = 0, len = this._models.length; i < len; i++) {
	        this._models[i].getGraph().syncHierarchy();
	    }
	};

    /**
     * @function
     * @name pc.scene.Scene#dispatch
     * @description Queues the meshes in a scene for rendering. This function does not actually
     * cause the meshes in the scene to be rendered. Instead, it inserts all opaque meshes into
     * a front-to-back render queue and all transparent meshes into a back-to-front render queue.
     * To actually render the contents of the render queues, call pc.scene.Scene#flush.
     * @param {pc.scene.CameraNode} camera The camera rendering the scene.
     * @author Will Eastcott
     */
	Scene.prototype.dispatch = function (camera) {
	    var i, j, model, numModels, mesh, numMeshes;
        
        var alphaMeshes = this._alphaMeshes;
        var opaqueMeshes = this._opaqueMeshes;
        
        alphaMeshes.length = 0;
        opaqueMeshes.length = 0;
		
//	    var frustum = camera.getFrustum();
	    for (i = 0, numModels = this._models.length; i < numModels; i++) {
	        model = this._models[i];
	        meshes = model.getMeshes();
	        for (j = 0, numMeshes = meshes.length; j < numMeshes; j++) {
	            var visible = true;
	            mesh = meshes[j];
                /*
	            var volume = mesh.getVolume();
	            if (volume) {
	                if (volume instanceof pc.shape.Sphere) {
	                    visible = (frustum.containsSphere(volume) !== 0);
	                }
	            }
	            if (true) {
                */
	                if (!mesh.getGeometry().hasAlpha()) {
	                    opaqueMeshes.push(mesh);
	                } else {
	                    alphaMeshes.push(mesh);
                /*
	                }
                */
	            }
	        }
	    }
	
	    var self = this;
	
	    // Sort alpha meshes back to front
	    var sortBackToFront = function (meshA, meshB) {
	    /*
	        // Naive, unoptimized version
	        var wtmA = meshA.getWorldTransform();
	        var posA = pc.math.mat4.getTranslation(wtmA);
	
	        var wtmB = meshB.getWorldTransform();
	        var posB = pc.math.mat4.getTranslation(wtmB);
	
	        var camMat = camera.getWorldTransform();
	        var camPos = pc.math.mat4.getTranslation(camMat);
	
	        pc.math.vec3.subtract(posA, camPos, tempVec);
	        var distSqrA = pc.math.vec3.dot(tempVec, tempVec);
	        pc.math.vec3.subtract(posB, camPos, tempVec);
	        var distSqrB = pc.math.vec3.dot(tempVec, tempVec);
	    */
	        // More optimized version.  No longer seems to figure in profiles.
	        var wtmA = meshA.getWorldTransform();
	        var wtmB = meshB.getWorldTransform();
	        var camMat = camera.getWorldTransform();
	
	        self._tempVec[0] = wtmA[12]-camMat[12];
	        self._tempVec[1] = wtmA[13]-camMat[13];
	        self._tempVec[2] = wtmA[14]-camMat[14];
	        var distSqrA = pc.math.vec3.dot(self._tempVec, self._tempVec);
	        self._tempVec[0] = wtmB[12]-camMat[12];
	        self._tempVec[1] = wtmB[13]-camMat[13];
	        self._tempVec[2] = wtmB[14]-camMat[14];
	        var distSqrB = pc.math.vec3.dot(self._tempVec, self._tempVec);
	    
	        return distSqrA < distSqrB;
	    }
	    alphaMeshes.sort(sortBackToFront);
	    opaqueMeshes.sort(sortBackToFront);
	
	    // Enqueue alpha meshes
	    for (i = 0, numMeshes = alphaMeshes.length; i < numMeshes; i++) {
	        this.enqueue("transparent", (function(m) {
	                return function () {
	                    m.dispatch();
	                }
	            })(alphaMeshes[i]));
	    }
	
	    // Enqueue opaque meshes
	    for (i = opaqueMeshes.length - 1; i >= 0; i--) {
	        this.enqueue("opaque", (function(m) {
	                return function () {
	                    m.dispatch();
	                }
	            })(opaqueMeshes[i]));
	    }
	};
	
	Scene.prototype.enqueue = function (queueName, renderFunc) {
	    this._queues[queueName].renderFuncs.push(renderFunc);
	};
	
    /**
     * @function
     * @name pc.scene.Scene#flush
     * @description Calls all functions inserted into the scene's render queues. The queues are
     * iterated in priority order (a queue with a smaller value for priority being processed before 
     * a queue with a larger value).
     * @author Will Eastcott
     */
	Scene.prototype.flush = function () {
	    // Dispatch all enabled lights
	    // This will be optimized to only enable point lights for meshes that 
	    // fall within their influence
	    pc.scene.LightNode.dispatch();
	
	    for (var i = 0; i < this._priorities.length; i++) {
	        var queueName = this._priorities[i].name;
	        var queue = this._queues[queueName];
	        var funcs = queue.renderFuncs;
	        for (var j = 0; j < funcs.length; j++) {
	            var func = funcs[j];
	            func();
	        }
	        queue.renderFuncs.length = 0;
	    }
	};	
	
	return {
		Scene: Scene,
		/**
		 * Constants for render order.
		 * @enum {number}
		 */
		RenderOrder: {
		    /** Queue items in any order. */
		    ANY: 0,
		    /** Queue items in back to front Z order. This correctly composits transparent geometry. */
		    BACK_TO_FRONT: 1,
		    /** Queue items in front to back Z order. This reduces pixel fill since fewer Z-buffer tests should pass. */
		    FRONT_TO_BACK: 2
		}
	};
	
}());
