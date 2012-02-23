
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
        // Models
        this._models = [];
        this._alphaMeshes = [];
        this._opaqueMeshes = [];

        // Lights
        this._lights = [];
        this._globalAmbient = [0.0, 0.0, 0.0];
        this._globalLights = []; // All currently enabled directionals
        this._localLights = [[], []]; // All currently enabled points and spots

        // Shadows
        this._shadowMaterial = new pc.scene.Material();
        this._shadowMaterial.setProgramName('shadowmap');
        this._shadowState = {
                blend: false
        };

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
	    var i, j, len, model, numModels, mesh, numMeshes;

        var alphaMeshes = this._alphaMeshes;
        var opaqueMeshes = this._opaqueMeshes;

        alphaMeshes.length = 0;
        opaqueMeshes.length = 0;

        this._globalLights.length = 0;
        this._localLights[0].length = 0;
        this._localLights[1].length = 0;
        var lights = this._lights;
        for (i = 0, len = lights.length; i < len; i++) {
            var light = lights[i];
            if (light.getEnabled()) {
                if (light.getType() === pc.scene.LightType.DIRECTIONAL) {
                    if (light.castShadows()) {
                        this._globalLights.push(light);
                    } else {
                        this._globalLights.unshift(light);
                    }
                } else {
                    this._localLights[light.getType() === pc.scene.LightType.POINT ? 0 : 1].push(light);
                }
            }
        }

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
                    mesh._localLights = this._localLights;
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

        // Enqueue rendering of all shadowmaps
        var self = this;
        this.enqueue("first", function () {
            var setShadowMapMaterial = function() {
                var models = self._models;
                for (var i = 0; i < models.length; i++) {
                    var model = models[i];
                    var geometries = model.getGeometries();
                    for (var j = 0; j < geometries.length; j++) {
                        var geometry = geometries[j];
                        var subMeshes = geometry.getSubMeshes();
                        for (var k = 0; k < subMeshes.length; k++) {
                            var subMesh = subMeshes[k];
                            subMesh._cachedMaterial = subMesh.material;
                            subMesh.material = self._shadowMaterial;
                        }
                    }
                }
            };

            var restoreMaterials = function() {
                var models = self._models;
                for (var i = 0; i < models.length; i++) {
                    var model = models[i];
                    var geometries = model.getGeometries();
                    for (var j = 0; j < geometries.length; j++) {
                        var geometry = geometries[j];
                        var subMeshes = geometry.getSubMeshes();
                        for (var k = 0; k < subMeshes.length; k++) {
                            var subMesh = subMeshes[k];
                            subMesh.material = subMesh._cachedMaterial;
                            delete subMesh._cachedMaterial;
                        }
                    }
                }
            };

            camera.frameEnd();

            // Disable blending
            var device = pc.gfx.Device.getCurrent();
            var oldBlend = device.getGlobalState().blend;
            device.updateGlobalState(self._shadowState);

            setShadowMapMaterial();
            for (i = 0; i < self._lights.length; i++) {
                var light = self._lights[i];
                if (light.castShadows()) {
                    var near = 0.1;
                    var far = 50;
                    var extent = 10;
                    
                    // Lights look down the negative Y and camera's down the positive Z so rotate by -90
                    var shadowCamLtm = pc.math.mat4.makeRotate(-Math.PI / 2.0, [1, 0, 0]);
                    var lightWtm = light.getWorldTransform();
                    var shadowCamWtm = pc.math.mat4.multiply(lightWtm, shadowCamLtm);
                    var shadowCamView = pc.math.mat4.invert(shadowCamWtm);
                    var shadowCamProj;
                    if (light.getType() === pc.scene.LightType.DIRECTIONAL) {
                        shadowCamProj = pc.math.mat4.makeOrtho(-extent, extent, -extent, extent, near, far);
                    } else {
                        shadowCamProj = pc.math.mat4.makePerspective(light._outerConeAngle * 2, 1, near, far);
                    }
                    var shadowViewProj = pc.math.mat4.multiply(shadowCamProj, shadowCamView);
                    var scale = pc.math.mat4.makeScale(0.5, 0.5, 0.5);
                    var shift = pc.math.mat4.makeTranslate(0.5, 0.5, 0.5);
                    var scaleShift = pc.math.mat4.multiply(shift, scale);
                    pc.math.mat4.multiply(scaleShift, shadowViewProj, light._shadowMatrix);

                    light._shadowCamera.setLocalTransform(shadowCamWtm);
                    light._shadowCamera.syncHierarchy();
                    light._shadowCamera.frameBegin();

                    // Render both alpha and opaque meshes front to back
                    if (alphaMeshes.length > 0) {
                        for (j = alphaMeshes.length - 1; j >= 0; j--) {
                            if (alphaMeshes[i].castShadows()) {
                                alphaMeshes[i].dispatch();
                            }
                        }
                    }
                    if (opaqueMeshes.length > 0) {
                        for (j = opaqueMeshes.length - 1; j >= 0; j--) {
                            if (opaqueMeshes[i].castShadows()) {
                                opaqueMeshes[j].dispatch();
                            }
                        }
                    }

                    light._shadowCamera.frameEnd();
                }
            }
            restoreMaterials();

            // Restore previous blend state
            device.updateGlobalState({blend: oldBlend});

            camera.frameBegin(false);

            self.dispatchGlobalLights();
        });

        // Enqueue alpha meshes
        this.enqueue("transparent", function() {
            // Render back to front
            for (i = 0, numMeshes = alphaMeshes.length; i < numMeshes; i++) {
                self.dispatchLocalLights(alphaMeshes[i]);
                alphaMeshes[i].dispatch();
            }
        });

        // Enqueue opaque meshes
        this.enqueue("opaque", function() {
            // Render front to back
            if (opaqueMeshes.length > 0) {
                for (i = opaqueMeshes.length - 1; i >= 0; i--) {
                    self.dispatchLocalLights(opaqueMeshes[i]);
                    opaqueMeshes[i].dispatch();
                }
            }
        });
    };
	
	Scene.prototype.enqueue = function (queueName, renderFunc) {
	    this._queues[queueName].renderFuncs.push(renderFunc);
	};

    /**
     * @function
     * @name pc.scene.Scene#getGlobalAmbient
     * @description Queries the current global ambient color. This color is uploaded to a
     * vector uniform called 'light_globalAmbient'. The PlayCanvas 'phong' shader uses this
     * value by multiplying it by the material color of a mesh's material and adding it to
     * the total light contribution.
     * @returns {Array} The global ambient color represented by a 3 dimensional array (RGB components ranging 0..1).
     * @author Will Eastcott
     */
    Scene.prototype.getGlobalAmbient = function () {
        return this._globalAmbient;
    };

    /**
     * @function
     * @name pc.scene.Scene#setGlobalAmbient
     * @description Sets the current global ambient color. This color is uploaded to a
     * vector uniform called 'light_globalAmbient'. The PlayCanvas 'phong' shader uses this
     * value by multiplying it by the material color of a mesh's material and adding it to
     * the total light contribution.
     * @returns {Array} The global ambient color represented by a 3 dimensional array (RGB components ranging 0..1).
     * @author Will Eastcott
     */
    Scene.prototype.setGlobalAmbient = function (color) {
        this._globalAmbient = color;
    };

    Scene.prototype.dispatchGlobalLights = function () {
        var dirs = this._globalLights;
        var numDirs = dirs.length;

        var device = pc.gfx.Device.getCurrent();
        var scope = device.scope;

        scope.resolve("light_globalAmbient").setValue(this._globalAmbient);

        for (var i = 0; i < numDirs; i++) {
            var directional = dirs[i];
            var wtm = directional.getWorldTransform();
            light = "light" + i;

            scope.resolve(light + "_color").setValue(directional._finalColor);
            // Directionals shine down the negative Y axis
            directional._direction[0] = -wtm[4];
            directional._direction[1] = -wtm[5];
            directional._direction[2] = -wtm[6];
            scope.resolve(light + "_direction").setValue(directional._direction);

            if (directional.castShadows()) {
                var shadowMap = directional._shadowBuffer.getTexture();
                scope.resolve(light + "_shadowMatrix").setValue(directional._shadowMatrix);
                scope.resolve(light + "_shadowMap").setValue(shadowMap);
                scope.resolve(light + "_shadowParams").setValue([shadowMap.getWidth(), shadowMap.getHeight(), 0.0001]);
            }
        }
    };

    Scene.prototype.dispatchLocalLights = function (mesh) {
        var i, wtm;
        var point, spot;
    
        var pnts = mesh._localLights[pc.scene.LightType.POINT-1];
        var spts = mesh._localLights[pc.scene.LightType.SPOT-1];

        var numDirs = this._globalLights.length;
        var numPnts = pnts.length;
        var numSpts = spts.length;

        var device = pc.gfx.Device.getCurrent();
        var scope = device.scope;

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

            if (spot.castShadows()) {
                var shadowMap = spot._shadowBuffer.getTexture();
                scope.resolve(light + "_shadowMatrix").setValue(spot._shadowMatrix);
                scope.resolve(light + "_shadowMap").setValue(shadowMap);
                scope.resolve(light + "_shadowParams").setValue([shadowMap.getWidth(), shadowMap.getHeight(), 0.0001]);
            }
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
