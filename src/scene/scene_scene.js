/**
 * @name pc.scene
 * @namespace High level Graphics API
 */
pc.scene = {
    BLEND_SUBTRACTIVE: 0,
    BLEND_ADDITIVE: 1,
    BLEND_NORMAL: 2,
    BLEND_NONE: 3,

    RENDERSTYLE_SOLID: 0,
    RENDERSTYLE_WIREFRAME: 1,
    RENDERSTYLE_POINTS: 2,

    LAYER_HUD: 0,
    LAYER_GIZMO: 1,
    LAYER_FX: 2,
    LAYER_WORLD: 3
};

pc.extend(pc.scene, function () {

    function sortDrawCalls(drawCallA, drawCallB) {
        return drawCallB.key - drawCallA.key;
    }

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

    function _calculateSceneAabb(scene) {
        var meshInstances = scene.meshInstances;
        if (meshInstances.length > 0) {
            scene._sceneAabb.copy(meshInstances[0].aabb);
            for (var i = 1; i < meshInstances.length; i++) {
                scene._sceneAabb.add(meshInstances[i].aabb);
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
        this.drawCalls = [];     // All mesh instances and commands
        this.meshInstances = []; // All mesh instances
        this.shadowCasters = []; // All mesh instances that cast shadows

        var device = pc.gfx.Device.getCurrent();
        this.modelMatrixId = device.scope.resolve('matrix_model');
        this.poseMatrixId = device.scope.resolve('matrix_pose[0]');

        // Models
        this._models = [];

        // Lights
        this._lights = [];
        this._globalAmbient = pc.math.vec3.create(0, 0, 0);
        this._globalLights = []; // All currently enabled directionals
        this._localLights = [[], []]; // All currently enabled points and spots

        // Shadows
        var library = device.getProgramLibrary();
        this._depthProgStatic = library.getProgram('depth', {
            skin: false,
            opacityMap: false
        });
        this._depthProgSkin = library.getProgram('depth', {
            skin: true,
            opacityMap: false
        });
        this._depthProgStaticOp = library.getProgram('depth', {
            skin: false,
            opacityMap: true
        });
        this._depthProgSkinOp = library.getProgram('depth', {
            skin: true,
            opacityMap: true
        });
        this._shadowState = {
            blend: false
        };
        this._shadowAabb = new pc.shape.Aabb();
        this._sceneAabb = new pc.shape.Aabb();
    };

    Scene.prototype.getModels = function () {
        return this._models;
    };

    Scene.prototype.addModel = function (model) {
        var i;

        // Check the model is not already in the scene
        var index = this._models.indexOf(model);
        if (index === -1) {
            this._models.push(model);

            // Insert the model's mesh instances into lists ready for rendering
            var meshInstance;
            var numMeshInstances = model.meshInstances.length;
            for (i = 0; i < numMeshInstances; i++) {
                meshInstance = model.meshInstances[i];
                if (this.drawCalls.indexOf(meshInstance) === -1) {
                    this.drawCalls.push(meshInstance);
                }
                if (this.meshInstances.indexOf(meshInstance) === -1) {
                    this.meshInstances.push(meshInstance);
                }
                if (meshInstance.castShadow) {
                    if (this.shadowCasters.indexOf(meshInstance) === -1) {
                        this.shadowCasters.push(meshInstance);
                    }
                }
            }

            // Add all model lights to the scene
            var lights = model.getLights();
            for (i = 0, len = lights.length; i < len; i++) {
                this.addLight(lights[i]);
            }
        }
    };

    Scene.prototype.removeModel = function (model) {
        var i;

        // Verify the model is in the scene
        var index = this._models.indexOf(model);
        if (index !== -1) {
            this._models.splice(index, 1);

            // Remove the model's mesh instances from render queues
            var meshInstance;
            var numMeshInstances = model.meshInstances.length;
            for (i = 0; i < numMeshInstances; i++) {
                meshInstance = model.meshInstances[i];
                index = this.drawCalls.indexOf(meshInstance);
                if (index !== -1) {
                    this.drawCalls.splice(index, 1);
                }
                index = this.meshInstances.indexOf(meshInstance);
                if (index !== -1) {
                    this.meshInstances.splice(index, 1);
                }
                if (meshInstance.castShadow) {
                    index = this.shadowCasters.indexOf(meshInstance);
                    if (index !== -1) {
                        this.shadowCasters.splice(index, 1);
                    }
                }
            }

            // Remove all model lights from the scene
            var lights = model.getLights();
            for (i = 0, len = lights.length; i < len; i++) {
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

    Scene.prototype.render = function (camera) {

        pc.scene.Scene.current = this;

        this._globalLights.length = 0;
        this._localLights[0].length = 0;
        this._localLights[1].length = 0;
        var castShadows = false;
        var lights = this._lights;
        var light;
        for (i = 0, len = lights.length; i < len; i++) {
            light = lights[i];
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

        var i, j, numInstances;
        var device = pc.gfx.Device.getCurrent();
        var drawCall, meshInstance, mesh, material, prevMaterial = null, style;

        // Update all skin matrix palettes
        for (i = this._models.length - 1; i >= 0; i--) {
            var skinInstances = this._models[i].skinInstances;
            for (j = skinInstances.length - 1; j >= 0; j--) {
                skinInstances[j].updateMatrixPalette();
            }
        }

        var calcBbox = false;

        // Render all shadowmaps
        for (i = 0; i < lights.length; i++) {
            light = lights[i];
            var type = light.getType();

            if (type === pc.scene.LightType.POINT) {
                continue;
            }

            if (light.getCastShadows() && light.getEnabled()) {
                var shadowCam = light._shadowCamera;

                if (type === pc.scene.LightType.DIRECTIONAL) {
                    // 1. Starting at the centroid of the view frustum, back up in the opposite
                    // direction of the light by a certain amount. This will be our temporary 
                    // working position.
                    var centroid = camera.getFrustumCentroid();
                    shadowCam.setPosition(centroid);
                    var lightDir = pc.math.mat4.getY(light.worldTransform);
                    shadowCam.translate(lightDir[0], lightDir[1], lightDir[2]);

                    // 2. Come up with a LookAt matrix using the light direction, and the 
                    // temporary working position. This will be the view matrix that is used
                    // when generating the shadow map.
                    shadowCam.lookAt(centroid);
                    pc.math.mat4.copy(shadowCam.getWorldTransform(), shadowCamWtm);

                    // 3. Transform the 8 corners of the frustum by the LookAt Matrix
                    _getFrustumPoints(camera, frustumPoints);
                    var worldToShadowCam = pc.math.mat4.invert(shadowCamWtm);
                    var camToWorld = camera.worldTransform;
                    var c2sc = pc.math.mat4.multiply(worldToShadowCam, camToWorld);
                    for (j = 0; j < 8; j++) {
                        pc.math.mat4.multiplyVec3(frustumPoints[j], 1.0, c2sc, frustumPoints[j]);
                    }

                    // 4. Come up with a bounding box (in light-space) by calculating the min
                    // and max X, Y, and Z values from your 8 light-space frustum coordinates.
                    var minx = 1000000;
                    var maxx = -1000000;
                    var miny = 1000000;
                    var maxy = -1000000;
                    var minz = 1000000;
                    var maxz = -1000000;
                    for (j = 0; j < 8; j++) {
                        var p = frustumPoints[j];
                        if (p[0] < minx) minx = p[0];
                        if (p[0] > maxx) maxx = p[0];
                        if (p[1] < miny) miny = p[1];
                        if (p[1] > maxy) maxy = p[1];
                        if (p[2] < minz) minz = p[2];
                        if (p[2] > maxz) maxz = p[2];
                    }
/*
                    var worldUnitsPerTexelX = (maxx - minx) / light._shadowWidth;
                    var worldUnitsPerTexelY = (maxy - miny) / light._shadowHeight;

                    minx /= worldUnitsPerTexelX;
                    minx = Math.floor(minx);
                    minx *= worldUnitsPerTexelX;
                    maxx /= worldUnitsPerTexelX;
                    maxx = Math.floor(maxx);
                    maxx *= worldUnitsPerTexelX;

                    miny /= worldUnitsPerTexelY;
                    miny = Math.floor(miny);
                    miny *= worldUnitsPerTexelY;
                    maxy /= worldUnitsPerTexelY;
                    maxy = Math.floor(maxy);
                    maxy *= worldUnitsPerTexelY;
*/
                    // 5. Use your min and max values to create an off-center orthographic projection.
                    shadowCam.translateLocal(-(maxx + minx) * 0.5, (maxy + miny) * 0.5, maxz + (maxz - minz) * 0.25);
                    pc.math.mat4.copy(shadowCam.getWorldTransform(), shadowCamWtm);

                    shadowCam.setProjection(pc.scene.Projection.ORTHOGRAPHIC);
                    shadowCam.setNearClip(0);
                    shadowCam.setFarClip((maxz - minz) * 1.5);
                    shadowCam.setAspectRatio((maxx - minx) / (maxy - miny));
                    shadowCam.setOrthoHeight((maxy - miny) * 0.5);
                } else if (type === pc.scene.LightType.SPOT) {
                    shadowCam.setProjection(pc.scene.Projection.PERSPECTIVE);
                    shadowCam.setNearClip(light.getAttenuationEnd() / 1000);
                    shadowCam.setFarClip(light.getAttenuationEnd());
                    shadowCam.setAspectRatio(1);
                    shadowCam.setFov(light.getOuterConeAngle() * 2);

                    var lightWtm = light.worldTransform;
                    pc.math.mat4.multiply(lightWtm, camToLight, shadowCamWtm);
                }

                pc.math.mat4.invert(shadowCamWtm, shadowCamView);
                pc.math.mat4.multiply(shadowCam.getProjectionMatrix(), shadowCamView, shadowCamViewProj);
                pc.math.mat4.multiply(scaleShift, shadowCamViewProj, light._shadowMatrix);

                // Point the camera along direction of light
                pc.math.mat4.copy(shadowCamWtm, shadowCam.worldTransform);

                shadowCam.frameBegin();

                if (device.extDepthTexture) {
                    device.gl.colorMask(false, false, false, false);
                }

                device.updateLocalState(this._shadowState);

                for (j = 0, numInstances = this.shadowCasters.length; j < numInstances; j++) {
                    meshInstance = this.shadowCasters[j];
                    mesh = meshInstance.mesh;
                    material = meshInstance.material;

                    this.modelMatrixId.setValue(meshInstance.node.worldTransform);
                    if (material.opacityMap) {
                        device.scope.resolve('texture_opacityMap').setValue(material.opacityMap);
                    }
                    if (meshInstance.skinInstance) {
                        this.poseMatrixId.setValue(meshInstance.skinInstance.matrixPaletteF32);
                        device.setProgram(material.opacityMap ? this._depthProgSkinOp : this._depthProgSkin);
                    } else {
                        device.setProgram(material.opacityMap ? this._depthProgStaticOp : this._depthProgStatic);
                    }

                    style = meshInstance.renderStyle;

                    device.setVertexBuffer(mesh.vertexBuffer, 0);
                    device.setIndexBuffer(mesh.indexBuffer[style]);
                    device.draw(mesh.primitive[style]);
                }

                device.clearLocalState();

                if (device.extDepthTexture) {
                    device.gl.colorMask(true, true, true, true);
                }

                shadowCam.frameEnd();
            }
        }

        // Sort meshes into the correct render order
        this.drawCalls.sort(sortDrawCalls);

        camera.frameBegin();

        this.dispatchGlobalLights();
        this.dispatchLocalLights();

        for (i = 0, numDrawCalls = this.drawCalls.length; i < numDrawCalls; i++) {
            drawCall = this.drawCalls[i];
            if (drawCall.command) {
                // We have a command
                drawCall.command();
            } else {
                // We have a mesh instance
                meshInstance = drawCall;
                mesh = meshInstance.mesh;
                material = meshInstance.material;

                this.modelMatrixId.setValue(meshInstance.node.worldTransform);
                if (meshInstance.skinInstance) {
                    this.poseMatrixId.setValue(meshInstance.skinInstance.matrixPaletteF32);
                }

                if (material !== prevMaterial) {
                    device.setProgram(material.getProgram(mesh));
                    material.setParameters();
                    device.clearLocalState();
                    device.updateLocalState(material.getState());
                }

                style = meshInstance.renderStyle;

                device.setVertexBuffer(mesh.vertexBuffer, 0);
                device.setIndexBuffer(mesh.indexBuffer[style]);
                device.draw(mesh.primitive[style]);

                prevMaterial = material;
            }
        }

        device.clearLocalState();

        camera.frameEnd();
    };


/*
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
*/

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

    return {
        Scene: Scene
    };
}());
