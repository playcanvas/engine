
/**
 * @name pc.scene
 * @namespace Namespace for scene graph management and rendering
 */
pc.scene = {};

pc.scene.Space = {
    LOCAL: 0,
    WORLD: 1
};

pc.extend(pc.scene, function () {

    // Global shadowmap resources
    var scale = pc.math.mat4.makeScale(0.5, 0.5, 0.5);
    var shift = pc.math.mat4.makeTranslate(0.5, 0.5, 0.5);
    var scaleShift = pc.math.mat4.multiply(shift, scale);

    // Lights look down the negative Y and camera's down the positive Z so rotate by -90
    var camToLight = pc.math.mat4.makeRotate(-Math.PI / 2.0, [1, 0, 0]);
    var shadowCamWtm = pc.math.mat4.create();
    var shadowCamView = pc.math.mat4.create();
    var shadowCamViewProj = pc.math.mat4.create();

    var _tempVec = pc.math.vec3.create(0, 0, 0);
    var _tempMat = pc.math.mat4.create();

    /**
     * @name pc.scene.Scene
     * @class A scene.
     */
    var Scene = function Scene() {
        // Models
        this._models = [];
        this._alphaMeshes = [];
        this._opaqueMeshes = [];
        this._shadowMeshes = [];

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
        this._shadowAabb = new pc.shape.Aabb();

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
        var castShadows = false;
        var lights = this._lights;
        for (i = 0, len = lights.length; i < len; i++) {
            var light = lights[i];
            if (light.getCastShadows()) {
                castShadows = true;
            }
            if (light.getEnabled()) {
                if (light.getType() === pc.scene.LightType.DIRECTIONAL) {
                    if (light.getCastShadows()) {
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
        var camMat = camera.getWorldTransform();
	
	    // Sort alpha meshes back to front
	    var sortBackToFront = function (meshA, meshB) {
	        var wtmA = meshA._wtm;
	        var wtmB = meshB._wtm;
	        _tempVec[0] = wtmA[12] - camMat[12];
	        _tempVec[1] = wtmA[13] - camMat[13];
	        _tempVec[2] = wtmA[14] - camMat[14];
	        var distSqrA = _tempVec[0] * _tempVec[0] + _tempVec[1] * _tempVec[1] + _tempVec[2] * _tempVec[2];
	        _tempVec[0] = wtmB[12] - camMat[12];
	        _tempVec[1] = wtmB[13] - camMat[13];
	        _tempVec[2] = wtmB[14] - camMat[14];
	        var distSqrB = _tempVec[0] * _tempVec[0] + _tempVec[1] * _tempVec[1] + _tempVec[2] * _tempVec[2];
	    
	        return distSqrA < distSqrB;
	    }
	    alphaMeshes.sort(sortBackToFront);
	    opaqueMeshes.sort(sortBackToFront);

        this.dispatchGlobalLights();
        this.dispatchLocalLights();

        // Enqueue rendering of all shadowmaps
        var self = this;        
        if (castShadows) {
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

                var calculateShadowMeshBBox = function () {
                    var meshes = self._shadowMeshes;
                    if (meshes.length > 0) {
                        self._shadowAabb.copy(meshes[0].getAabb());
                        for (var i = 1; i < meshes.length; i++) {
                            self._shadowAabb.add(meshes[i].getAabb());
                        }
                    }
                }

                camera.frameEnd();

                // Store an array of shadow casters
                var shadowMeshes = self._shadowMeshes;
                shadowMeshes.length = 0;

                if (alphaMeshes.length > 0) {
                    for (j = alphaMeshes.length - 1; j >= 0; j--) {
                        if (alphaMeshes[j].getCastShadows()) {
                            shadowMeshes.push(alphaMeshes[j]);
                        }
                    }
                }
                if (opaqueMeshes.length > 0) {
                    for (j = opaqueMeshes.length - 1; j >= 0; j--) {
                        if (opaqueMeshes[j].getCastShadows()) {
                            shadowMeshes.push(opaqueMeshes[j]);
                        }
                    }
                }

                // Disable blending
                var device = pc.gfx.Device.getCurrent();
                var oldBlend = device.getGlobalState().blend;
                device.updateGlobalState(self._shadowState);

                setShadowMapMaterial();
                var calcBbox = false;

                for (i = 0; i < self._lights.length; i++) {
                    var light = self._lights[i];
                    if (light.getCastShadows()) {
                        var shadowCam = light._shadowCamera;

                        var type = light.getType();
                        if (type === pc.scene.LightType.DIRECTIONAL) {
                            if (!calcBbox) {
                                calculateShadowMeshBBox();
                                calcBbox = true;
                            }

                            pc.math.mat4.copy(light.getWorldTransform(), shadowCamWtm);
                            shadowCamWtm[12] = self._shadowAabb.center[0];
                            shadowCamWtm[13] = self._shadowAabb.center[1];
                            shadowCamWtm[14] = self._shadowAabb.center[2];
                            pc.math.mat4.multiply(shadowCamWtm, camToLight, shadowCamWtm);

                            var extent = pc.math.vec3.length(self._shadowAabb.halfExtents);
                            shadowCam.setProjection(pc.scene.Projection.ORTHOGRAPHIC);
                            shadowCam.setNearClip(-extent);
                            shadowCam.setFarClip(extent);
                            shadowCam.setViewWindow(pc.math.vec2.create(extent, extent));
                        } else if (type === pc.scene.LightType.SPOT) {
                            shadowCam.setProjection(pc.scene.Projection.PERSPECTIVE);
                            shadowCam.setFov(light.getOuterConeAngle() * 2);
                            shadowCam.setNearClip(light.getAttenuationEnd() / 1000);
                            shadowCam.setFarClip(light.getAttenuationEnd());

                            var lightWtm = light.getWorldTransform();
                            pc.math.mat4.multiply(lightWtm, camToLight, shadowCamWtm);
                        }

                        pc.math.mat4.invert(shadowCamWtm, shadowCamView);
                        pc.math.mat4.multiply(shadowCam.getProjectionMatrix(), shadowCamView, shadowCamViewProj);
                        pc.math.mat4.multiply(scaleShift, shadowCamViewProj, light._shadowMatrix);

                        // Point the camera along direction of light
                        pc.math.mat4.copy(shadowCamWtm, shadowCam._wtm);

                        shadowCam.frameBegin();
                        for (i = 0; i < shadowMeshes.length; i++) {
                            shadowMeshes[i].dispatch();
                        }
                        shadowCam.frameEnd();
                    }
                }
                restoreMaterials();

                // Restore previous blend state
                device.updateGlobalState({blend: oldBlend});

                camera.frameBegin(false);
            });
        }

        // Enqueue alpha meshes
        if (alphaMeshes.length > 0) {
            this.enqueue("transparent", function() {
                // Render back to front
                for (i = 0, numMeshes = alphaMeshes.length; i < numMeshes; i++) {
                    alphaMeshes[i].dispatch();
                }
            });
        }

        // Enqueue opaque meshes
        if (opaqueMeshes.length > 0) {
            this.enqueue("opaque", function() {
                // Render front to back
                for (i = opaqueMeshes.length - 1; i >= 0; i--) {
                    opaqueMeshes[i].dispatch();
                }
            });
        }
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

            if (directional.getCastShadows()) {
                var shadowMap = directional._shadowCamera._renderTarget._frameBuffer.getTexture();
                scope.resolve(light + "_shadowMatrix").setValue(directional._shadowMatrix);
                scope.resolve(light + "_shadowMap").setValue(shadowMap);
                scope.resolve(light + "_shadowParams").setValue([shadowMap.getWidth(), shadowMap.getHeight(), 0.0001]);
            }
        }
    };

    Scene.prototype.dispatchLocalLights = function () {
        var i, wtm;
        var point, spot;
        var localLights = this._localLights;

        var pnts = localLights[pc.scene.LightType.POINT-1];
        var spts = localLights[pc.scene.LightType.SPOT-1];

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

            if (spot.getCastShadows()) {
                var shadowMap = spot._shadowCamera._renderTarget._frameBuffer.getTexture();
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
