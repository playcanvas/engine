
/**
 * @name pc.scene
 * @namespace Scene Graph API
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
    var camToLight = pc.math.mat4.makeRotate(-90, [1, 0, 0]);
    var shadowCamWtm = pc.math.mat4.create();
    var shadowCamView = pc.math.mat4.create();
    var shadowCamViewProj = pc.math.mat4.create();

    // The 8 points of the camera frustum transformed to light space
    var frustumPoints = [];
    for (i = 0; i < 8; i++) {
        frustumPoints.push(pc.math.vec3.create());
    }

    function _setShadowMapMaterial(scene, material) {
        var models = scene._models;
        for (var i = 0; i < models.length; i++) {
            var model = models[i];
            var geometries = model.getGeometries();
            for (var j = 0; j < geometries.length; j++) {
                var geometry = geometries[j];
                var subMeshes = geometry.getSubMeshes();
                for (var k = 0; k < subMeshes.length; k++) {
                    var subMesh = subMeshes[k];

                    if (typeof(subMesh._cachedMaterial) === 'undefined') {
                        subMesh._cachedMaterial = subMesh.material;
                        subMesh.material = material;
                    }
                }
            }
        }
    }

    function _restoreMaterials(scene) {
        var models = scene._models;
        for (var i = 0; i < models.length; i++) {
            var model = models[i];
            var geometries = model.getGeometries();
            for (var j = 0; j < geometries.length; j++) {
                var geometry = geometries[j];
                var subMeshes = geometry.getSubMeshes();
                for (var k = 0; k < subMeshes.length; k++) {
                    var subMesh = subMeshes[k];

                    if (typeof(subMesh._cachedMaterial) !== 'undefined') {
                        subMesh.material = subMesh._cachedMaterial;
                        delete subMesh._cachedMaterial;                        
                    }
                }
            }
        }
    }

    function _calculateShadowMeshAabb(scene) {
        var meshes = scene._shadowMeshes;
        if (meshes.length > 0) {
            scene._shadowAabb.copy(meshes[0].getAabb());
            for (var i = 1; i < meshes.length; i++) {
                scene._shadowAabb.add(meshes[i].getAabb());
            }
        }
    }

    function _calculateSceneAabb(scene) {
        var meshes = scene._opaqueMeshes;
        if (meshes.length > 0) {
            scene._sceneAabb.copy(meshes[0].getAabb());
            for (var i = 1; i < meshes.length; i++) {
                scene._sceneAabb.add(meshes[i].getAabb());
            }
        }
    }

    function _getFrustumPoints(camera, points) {
        var cam = camera;
        var nearClip   = cam.getNearClip();
        var farClip    = cam.getFarClip();
        var fov        = cam.getFov() * Math.PI / 180.0;
        var aspect     = cam.getAspectRatio();
        var projection = cam.getProjection();

        var x, y;
        if (projection === pc.scene.Projection.PERSPECTIVE) {
            y = Math.tan(fov / 2.0) * nearClip;
        } else {
            y = this._orthoHeight;
        }
        x = y * aspect;

        points[0][0] = x;
        points[0][1] = -y;
        points[0][2] = -nearClip;
        points[1][0] = x;
        points[1][1] = y;
        points[1][2] = -nearClip;
        points[2][0] = -x;
        points[2][1] = y;
        points[2][2] = -nearClip;
        points[3][0] = -x;
        points[3][1] = -y;
        points[3][2] = -nearClip;

        if (projection === pc.scene.Projection.PERSPECTIVE) {
            y = Math.tan(fov / 2.0) * farClip;
            x = y * aspect;
        }
        points[4][0] = x;
        points[4][1] = -y;
        points[4][2] = -farClip;
        points[5][0] = x;
        points[5][1] = y;
        points[5][2] = -farClip;
        points[6][0] = -x;
        points[6][1] = y;
        points[6][2] = -farClip;
        points[7][0] = -x;
        points[7][1] = -y;
        points[7][2] = -farClip;

        return points;
    }

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
        this._globalAmbient = pc.math.vec3.create(0, 0, 0);
        this._globalLights = []; // All currently enabled directionals
        this._localLights = [[], []]; // All currently enabled points and spots

        // Shadows
        this._shadowMaterial = new pc.scene.Material();
        this._shadowMaterial.setProgramName('depth');
        this._shadowState = {
            blend: false
        };
        this._shadowAabb = new pc.shape.Aabb();
        this._sceneAabb = new pc.shape.Aabb();

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
	    var i, j, k, len, model, numModels, mesh, numMeshes;

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
                mesh.syncAabb();
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
            var posA = meshA.getAabb().center;
            var posB = meshB.getAabb().center;
            var cmx = camMat[12];
            var cmy = camMat[13];
            var cmz = camMat[14];
            var tempx = posA[0] - cmx;
            var tempy = posA[1] - cmy;
            var tempz = posA[2] - cmz;
            var distSqrA = tempx * tempx + tempy * tempy + tempz * tempz;
            tempx = posB[0] - cmx;
            tempy = posB[1] - cmy;
            tempz = posB[2] - cmz;
            var distSqrB = tempx * tempx + tempy * tempy + tempz * tempz;

            return distSqrA < distSqrB;
	    }
	    alphaMeshes.sort(sortBackToFront);
	    opaqueMeshes.sort(sortBackToFront);

        // Enqueue rendering of all shadowmaps
        var self = this;        
        if (castShadows) {
            this.enqueue("first", function () {
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

                _setShadowMapMaterial(self, self._shadowMaterial);
                var calcBbox = false;

                _getFrustumPoints(camera, frustumPoints);
                
                for (i = 0; i < self._lights.length; i++) {
                    var light = self._lights[i];
                    var type = light.getType();

                    if (type === pc.scene.LightType.POINT) {
                        continue;
                    }

                    if (light.getCastShadows() && light.getEnabled()) {
                        var shadowCam = light._shadowCamera;

                        if (type === pc.scene.LightType.DIRECTIONAL) {
                            if (!calcBbox) {
                                _calculateSceneAabb(self);
                                calcBbox = true;
                            }

                            var worldToLight = pc.math.mat4.invert(light.getWorldTransform());
                            var camToWorld = camera.getWorldTransform();
                            var c2l = pc.math.mat4.multiply(worldToLight, camToWorld);
                            for (k = 0; k < 8; k++) {
                                pc.math.mat4.multiplyVec3(frustumPoints[k], 1.0, c2l, frustumPoints[k]);
                            }

                            var minx = 1000000;
                            var maxx = -1000000;
                            var miny = 1000000;
                            var maxy = -1000000;
                            for (k = 0; k < 8; k++) {
                                var p = frustumPoints[k];
                                if (p[0] < minx) minx = p[0];
                                if (p[0] > maxx) maxx = p[0];
                                if (p[1] < miny) miny = p[1];
                                if (p[1] > maxy) maxy = p[1];
                            }

                            pc.math.mat4.copy(light.getWorldTransform(), shadowCamWtm);
                            shadowCamWtm[12] = self._sceneAabb.center[0];
                            shadowCamWtm[13] = self._sceneAabb.center[1];
                            shadowCamWtm[14] = self._sceneAabb.center[2];
                            pc.math.mat4.multiply(shadowCamWtm, camToLight, shadowCamWtm);

                            var extent = pc.math.vec3.length(self._sceneAabb.halfExtents);
                            shadowCam.setProjection(pc.scene.Projection.ORTHOGRAPHIC);
                            shadowCam.setNearClip(-extent);
                            shadowCam.setFarClip(extent);
                            shadowCam.setAspectRatio(1);
                            shadowCam.setOrthoHeight(extent);
                        } else if (type === pc.scene.LightType.SPOT) {
                            shadowCam.setProjection(pc.scene.Projection.PERSPECTIVE);
                            shadowCam.setNearClip(light.getAttenuationEnd() / 1000);
                            shadowCam.setFarClip(light.getAttenuationEnd());
                            shadowCam.setAspectRatio(1);
                            shadowCam.setFov(light.getOuterConeAngle() * 2);

                            var lightWtm = light.getWorldTransform();
                            pc.math.mat4.multiply(lightWtm, camToLight, shadowCamWtm);
                        }

                        pc.math.mat4.invert(shadowCamWtm, shadowCamView);
                        pc.math.mat4.multiply(shadowCam.getProjectionMatrix(), shadowCamView, shadowCamViewProj);
                        pc.math.mat4.multiply(scaleShift, shadowCamViewProj, light._shadowMatrix);

                        // Point the camera along direction of light
                        pc.math.mat4.copy(shadowCamWtm, shadowCam.getWorldTransform());

                        shadowCam.frameBegin();
                        if (device.extDepthTexture) {
                            device.gl.colorMask(false, false, false, false);
                        }
                        for (k = 0; k < shadowMeshes.length; k++) {
                            shadowMeshes[k].dispatch();
                        }
                        if (device.extDepthTexture) {
                            device.gl.colorMask(true, true, true, true);
                        }
                        shadowCam.frameEnd();
                    }
                }
                _restoreMaterials(self);

                // Restore previous blend state
                device.updateGlobalState({blend: oldBlend});

                camera.frameBegin(false);
            });
        }

        // Enqueue opaque meshes
        this.enqueue("opaque", function() {
            // Lights get dispatched after the shadowmap generation is done.
            // By this point, the shadow matrices for the lights  have been
            // calculated.
            if (opaqueMeshes.length > 0) {
                // Render front to back
                for (i = opaqueMeshes.length - 1; i >= 0; i--) {
                    opaqueMeshes[i].dispatch();
                }
            }
        });

        // Enqueue alpha meshes
        this.enqueue("transparent", function() {
            // Render back to front
            for (i = 0, numMeshes = alphaMeshes.length; i < numMeshes; i++) {
                alphaMeshes[i].dispatch();
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
     * @param {pc.math.vec3} ambient The global ambient color represented by a 3 dimensional array (RGB components ranging 0..1).
     * @author Will Eastcott
     */
    /**
     * @function
     * @name pc.scene.Scene#setGlobalAmbient^2
     * @description Sets the current global ambient color. This color is uploaded to a
     * vector uniform called 'light_globalAmbient'. The PlayCanvas 'phong' shader uses this
     * value by multiplying it by the material color of a mesh's material and adding it to
     * the total light contribution.
     * @param {Number} red The red component of the global ambient color (should be in range 0..1).
     * @param {Number} green The green component of the global ambient color (should be in range 0..1).
     * @param {Number} blue The blue component of the global ambient color (should be in range 0..1).
     * @author Will Eastcott
     */
    Scene.prototype.setGlobalAmbient = function () {
        if (arguments.length === 3) {
            pc.math.vec3.set(this._globalAmbient, arguments[0], arguments[1], arguments[2]);
        } else {
            pc.math.vec3.copy(arguments[0], this._globalAmbient);
        }
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
                var shadowMap = device.extDepthTexture ? 
                        directional._shadowCamera._renderTarget._frameBuffer._depthTexture :
                        directional._shadowCamera._renderTarget._frameBuffer.getTexture();
                scope.resolve(light + "_shadowMap").setValue(shadowMap);
                scope.resolve(light + "_shadowMatrix").setValue(directional._shadowMatrix);
                scope.resolve(light + "_shadowParams").setValue([directional._shadowWidth, directional._shadowHeight, directional._shadowBias]);
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
                var shadowMap = device.extDepthTexture ? 
                        spot._shadowCamera._renderTarget._frameBuffer._depthTexture :
                        spot._shadowCamera._renderTarget._frameBuffer.getTexture();
                scope.resolve(light + "_shadowMap").setValue(shadowMap);
                scope.resolve(light + "_shadowMatrix").setValue(spot._shadowMatrix);
                scope.resolve(light + "_shadowParams").setValue([spot._shadowWidth, spot._shadowHeight, spot._shadowBias]);
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

        this.dispatchGlobalLights();
        this.dispatchLocalLights();

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
