
/**
 * @name pc.scene
 * @namespace Namespace for scene graph management and rendering
 */
pc.scene = {};

pc.extend(pc.scene, function () {

    var _tempVec = pc.math.vec3.create(0, 0, 0);

    /**
     * @name pc.scene.Scene
     * @class A scene.
     */
    var Scene = function Scene() {
        this._models = [];
        this._lights = [];
        this._activeLights = [[], [], []];

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

        // Add all model lights to the scene
        var lights = model.getLights();
        for (var i = 0, len = lights.length; i < len; i++) {
            this.addLight(lights[i]);
        }
    };

    Scene.prototype.removeModel = function (model) {
        var index = this._models.indexOf(model);
        if (index !== -1) {
            this._models.splice(index, 1);

            // Remove all model lights from the scene
            var lights = model.getLights();
            for (var i = 0, len = lights.length; i < len; i++) {
                this.removeLight(lights[i]);
            }
        }
    };

    Scene.prototype.containsModel = function (model) {
        return this._models.indexOf(model) >= 0;
    };

    Scene.prototype.addLight = function (light) {
        this._lights.push(light);
    };

    Scene.prototype.removeLight = function (light) {
        var index = this._lights.indexOf(light);
        if (index !== -1) {
            this._lights.splice(index, 1);
        }
    };

    /**
     * @function
     * @name pc.scene.Scene#update
     * @description Synchronizes the graph node hierarchy of every model in the scene.
     * @author Will Eastcott
     */
	Scene.prototype.update = function () {
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
	
	        _tempVec[0] = wtmA[12]-camMat[12];
	        _tempVec[1] = wtmA[13]-camMat[13];
	        _tempVec[2] = wtmA[14]-camMat[14];
	        var distSqrA = pc.math.vec3.dot(_tempVec, _tempVec);
	        _tempVec[0] = wtmB[12]-camMat[12];
	        _tempVec[1] = wtmB[13]-camMat[13];
	        _tempVec[2] = wtmB[14]-camMat[14];
	        var distSqrB = pc.math.vec3.dot(_tempVec, _tempVec);
	    
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

    Scene.prototype.getEnabledLights = function (type) {
        if (type === undefined) {
            return this._activeLights[pc.scene.LightType.DIRECTIONAL].length + 
                   this._activeLights[pc.scene.LightType.POINT].length + 
                   this._activeLights[pc.scene.LightType.SPOT].length;
        } else {
            return this._activeLights[type].length;
        }
    }

    Scene.prototype.dispatchLights = function () {
        var i, wtm;
        var directional, point, spot;
    
        var dirs = this._activeLights[pc.scene.LightType.DIRECTIONAL];
        var pnts = this._activeLights[pc.scene.LightType.POINT];
        var spts = this._activeLights[pc.scene.LightType.SPOT];

        var numDirs = dirs.length;
        var numPnts = pnts.length;
        var numSpts = spts.length;

        var device = pc.gfx.Device.getCurrent();
        var scope = device.scope;

        for (i = 0; i < numDirs; i++) {
            directional = dirs[i];
            wtm = directional.getWorldTransform();
            light = "light" + i;

            scope.resolve(light + "_color").setValue(directional._finalColor);
            // Directionals shine down the negative Y axis
            directional._direction[0] = -wtm[4];
            directional._direction[1] = -wtm[5];
            directional._direction[2] = -wtm[6];
            scope.resolve(light + "_direction").setValue(directional._direction);
        }

        for (i = 0; i < numPnts; i++) {
            point = pnts[i];
            wtm = point.getWorldTransform();
            light = "light" + (numDirs + i);

            scope.resolve(light + "_radius").setValue(point._attenuationEnd);
            scope.resolve(light + "_color").setValue(point._finalColor);
            point._position[0] = wtm[12];
            point._position[1] = wtm[13];
            point._position[2] = wtm[14];
            scope.resolve(light + "_position").setValue(point._position);
        }

        for (i = 0; i < numSpts; i++) {
            spot = spts[i];
            wtm = spot.getWorldTransform();
            light = "light" + (numDirs + numPnts + i);

            scope.resolve(light + "_innerConeAngle").setValue(spot._innerConeAngleCos);
            scope.resolve(light + "_outerConeAngle").setValue(spot._outerConeAngleCos);
            scope.resolve(light + "_radius").setValue(spot._attenuationEnd);
            scope.resolve(light + "_color").setValue(spot._finalColor);
            spot._position[0] = wtm[12];
            spot._position[1] = wtm[13];
            spot._position[2] = wtm[14];
            scope.resolve(light + "_position").setValue(spot._position);
            // Spots shine down the negative Y axis
            spot._direction[0] = -wtm[4];
            spot._direction[1] = -wtm[5];
            spot._direction[2] = -wtm[6];
            scope.resolve(light + "_spotDirection").setValue(spot._direction);
        }
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
        pc.scene.Scene.current = this;

	    // Dispatch all enabled lights
	    // This will be optimized to only enable point lights for meshes that 
	    // fall within their influence
        var i, len;
        var lights = this._lights;
        for (i = 0, len = lights.length; i < len; i++) {
            var light = lights[i];
            if (light.getEnabled(light)) {
                this._activeLights[light.getType()].push(light);
            }
        }
	    this.dispatchLights();

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

        this._activeLights[0].length = 0;
        this._activeLights[1].length = 0;
        this._activeLights[2].length = 0;

        pc.scene.Scene.current = null;
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
