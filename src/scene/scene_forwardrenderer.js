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

    var viewMat = pc.math.mat4.create();
    var viewProjMat = pc.math.mat4.create();

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

    //////////////////////////////////////
    // Shadow mapping support functions //
    //////////////////////////////////////
    function createShadowMap(device, width, height) {
        var shadowMap = new pc.gfx.Texture(device, {
            format: pc.gfx.PIXELFORMAT_R8_G8_B8_A8,
            width: width,
            height: height
        });
        shadowMap.minFilter = pc.gfx.FILTER_NEAREST;
        shadowMap.magFilter = pc.gfx.FILTER_NEAREST;
        shadowMap.addressU = pc.gfx.ADDRESS_CLAMP_TO_EDGE;
        shadowMap.addressV = pc.gfx.ADDRESS_CLAMP_TO_EDGE;
        return new pc.gfx.RenderTarget(device, shadowMap, true);
    };

    function createShadowCamera(device) {
        // We don't need to clear the color buffer if we're rendering a depth map
        var flags = pc.gfx.CLEARFLAG_DEPTH;
        if (!device.extDepthTexture) flags |= pc.gfx.CLEARFLAG_COLOR;

        var shadowCam = new pc.scene.CameraNode();
        shadowCam.setClearOptions({
            color: [1.0, 1.0, 1.0, 1.0],
            depth: 1.0,
            flags: flags
        });

        return shadowCam;
    };

    function getShadowCamera(device, light) {
        var shadowCam = light._shadowCamera;
        var shadowBuffer;

        if (shadowCam === null) {
            shadowCam = createShadowCamera(device);
            shadowBuffer = createShadowMap(device, light._shadowWidth, light._shadowHeight);
            shadowCam.setRenderTarget(shadowBuffer);
            light._shadowCamera = shadowCam;
        } else {
            shadowBuffer = shadowCam.getRenderTarget();
            if ((shadowBuffer.width !== light._shadowWidth) || (shadowBuffer.height !== light._shadowHeight)) {
                shadowBuffer = createShadowMap(device, this._shadowWidth, this._shadowHeight);
                shadowCam.setRenderTarget(shadowBuffer);
            }
        }

        return shadowCam;
    }

    /**
     * @name pc.scene.ForwardRenderer
     * @class The forward renderer render scene objects.
     * @constructor Creates a new forward renderer object.
     * @param {pc.gfx.Device} graphicsDevice The graphics device used by the renderer.
     */
    function ForwardRenderer(graphicsDevice) {
        this.device = graphicsDevice;

        // Shaders
        var library = this.device.getProgramLibrary();
        this._depthProgStatic = library.getProgram('depthrgba', {
            skin: false,
            opacityMap: false
        });
        this._depthProgSkin = library.getProgram('depthrgba', {
            skin: true,
            opacityMap: false
        });
        this._depthProgStaticOp = library.getProgram('depthrgba', {
            skin: false,
            opacityMap: true
        });
        this._depthProgSkinOp = library.getProgram('depthrgba', {
            skin: true,
            opacityMap: true
        });

        this._depthShaderStatic = library.getProgram('depth', {
            skin: false
        });
        this._depthShaderSkin = library.getProgram('depth', {
            skin: true
        });

        // Uniforms
        var scope = this.device.scope;
        this.projId = scope.resolve('matrix_projection');
        this.viewId = scope.resolve('matrix_view');
        this.viewInvId = scope.resolve('matrix_viewInverse');
        this.viewProjId = scope.resolve('matrix_viewProjection');
        this.viewPosId = scope.resolve('view_position');
        this.nearClipId = scope.resolve('camera_near');
        this.farClipId = scope.resolve('camera_far');

        this.modelMatrixId = scope.resolve('matrix_model');
        this.poseMatrixId = scope.resolve('matrix_pose[0]');

        // Shadows
        this._shadowAabb = new pc.shape.Aabb();
        this._sceneAabb = new pc.shape.Aabb();
        this._shadowState = {
            blend: false
        };
    }

    pc.extend(ForwardRenderer.prototype, {
        setCamera: function (camera) {
            // Projection Matrix
            var projMat = camera.getProjectionMatrix();
            this.projId.setValue(projMat);

            // ViewInverse Matrix
            var wtm = camera.getWorldTransform();
            this.viewInvId.setValue(wtm);

            // View Matrix
            pc.math.mat4.invert(wtm, viewMat);
            this.viewId.setValue(viewMat);

            // ViewProjection Matrix
            pc.math.mat4.multiply(projMat, viewMat, viewProjMat);
            this.viewProjId.setValue(viewProjMat);

            // View Position (world space)
            this.viewPosId.setValue(camera.getPosition());

            // Near and far clip values
            this.nearClipId.setValue(camera.getNearClip());
            this.farClipId.setValue(camera.getFarClip());

            camera._frustum.update(projMat, viewMat);

            var device = this.device;
            var target = camera.getRenderTarget();
            device.setRenderTarget(target);
            device.updateBegin();

            var rect = camera.getRect();
            var pixelWidth = target ? target.width : device.width;
            var pixelHeight = target ? target.height : device.height;
            var x = Math.floor(rect.x * pixelWidth);
            var y = Math.floor(rect.y * pixelHeight);
            var w = Math.floor(rect.width * pixelWidth);
            var h = Math.floor(rect.height * pixelHeight);
            device.setViewport(x, y, w, h);
            device.setScissor(x, y, w, h);

            device.clear(camera.getClearOptions());
        },

        dispatchGlobalLights: function (scene) {
            var dirs = scene._globalLights;
            var numDirs = dirs.length;

            var scope = this.device.scope;

            scope.resolve("light_globalAmbient").setValue(scene._globalAmbient);

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
                    var shadowMap = this.device.extDepthTexture ? 
                            directional._shadowCamera._renderTarget._depthTexture :
                            directional._shadowCamera._renderTarget.colorBuffer;
                    scope.resolve(light + "_shadowMap").setValue(shadowMap);
                    scope.resolve(light + "_shadowMatrix").setValue(directional._shadowMatrix);
                    scope.resolve(light + "_shadowParams").setValue([directional._shadowWidth, directional._shadowHeight, directional._shadowBias]);
                }
            }
        },

        dispatchLocalLights: function (scene) {
            var i, wtm;
            var point, spot;
            var localLights = scene._localLights;

            var pnts = localLights[pc.scene.LightType.POINT-1];
            var spts = localLights[pc.scene.LightType.SPOT-1];

            var numDirs = scene._globalLights.length;
            var numPnts = pnts.length;
            var numSpts = spts.length;

            var scope = this.device.scope;

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
                    var shadowMap = this.device.extDepthTexture ? 
                            spot._shadowCamera._renderTarget._depthTexture :
                            spot._shadowCamera._renderTarget.colorBuffer;
                    scope.resolve(light + "_shadowMap").setValue(shadowMap);
                    scope.resolve(light + "_shadowMatrix").setValue(spot._shadowMatrix);
                    scope.resolve(light + "_shadowParams").setValue([spot._shadowWidth, spot._shadowHeight, spot._shadowBias]);
                }
            }
        },

        /**
         * @function
         * @name pc.scene.ForwardRenderer#render
         * @description Renders the scene using the specified camera.
         * @param {pc.scene.Scene} scene The scene to render.
         * @param {pc.scene.CameraNode} camera The camera with which to render the scene.
         * @author Will Eastcott
         */
        render: function (scene, camera) {
            pc.scene.Scene.current = scene;

            // Fish out all the uniforms we need to render the scene
            var device = this.device;
            var scope = device.scope;

            var lights = scene._lights;
            var models = scene._models;
            var drawCalls = scene.drawCalls;
            var shadowCasters = scene.shadowCasters;

            var i, j, numInstances;
            var drawCall, meshInstance, mesh, material, prevMaterial = null, style;

            // Update all skin matrix palettes
            for (i = 0, numDrawCalls = scene.drawCalls.length; i < numDrawCalls; i++) {
                drawCall = scene.drawCalls[i];
                if (drawCall.skinInstance) {
                    drawCall.skinInstance.updateMatrixPalette();
                }
            }

            scene._globalLights.length = 0;
            scene._localLights[0].length = 0;
            scene._localLights[1].length = 0;

            for (i = 0; i < lights.length; i++) {
                var light = lights[i];
                if (light.getEnabled()) {
                    if (light.getType() === pc.scene.LightType.DIRECTIONAL) {
                        if (light.getCastShadows()) {
                            scene._globalLights.push(light);
                        } else {
                            scene._globalLights.unshift(light);
                        }
                    } else {
                        scene._localLights[light.getType() === pc.scene.LightType.POINT ? 0 : 1].push(light);
                    }
                }
            }

            // Sort meshes into the correct render order
            drawCalls.sort(sortDrawCalls);

            if (camera._depthTarget) {
                var oldTarget = camera.getRenderTarget();
                camera.setRenderTarget(camera._depthTarget);

                this.setCamera(camera);

                device.updateLocalState(this._shadowState);

                for (i = 0, numDrawCalls = drawCalls.length; i < numDrawCalls; i++) {
                    drawCall = drawCalls[i];
                    if (!drawCall.command) {
                        meshInstance = drawCall;
                        if (meshInstance.layer !== pc.scene.LAYER_SKYBOX) {
                            mesh = meshInstance.mesh;

                            this.modelMatrixId.setValue(meshInstance.node.worldTransform);
                            if (meshInstance.skinInstance) {
                                this.poseMatrixId.setValue(meshInstance.skinInstance.matrixPaletteF32);
                                device.setShader(this._depthShaderSkin);
                            } else {
                                device.setShader(this._depthShaderStatic);
                            }

                            style = meshInstance.renderStyle;

                            device.setVertexBuffer(mesh.vertexBuffer, 0);
                            device.setIndexBuffer(mesh.indexBuffer[style]);
                            device.draw(mesh.primitive[style]);
                        }
                    }

                    device.clearLocalState();

                    camera.setRenderTarget(oldTarget);
                }
            }

            // Render all shadowmaps
            for (i = 0; i < lights.length; i++) {
                var light = lights[i];
                var type = light.getType();

                // Point light shadow casting currently unsupported
                if (type === pc.scene.LightType.POINT) {
                    continue;
                }

                if (light.getCastShadows() && light.getEnabled()) {
                    var shadowCam = getShadowCamera(device, light);

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

                    this.setCamera(shadowCam);

                    if (device.extDepthTexture) {
                        device.gl.colorMask(false, false, false, false);
                    }

                    device.updateLocalState(this._shadowState);

                    for (j = 0, numInstances = shadowCasters.length; j < numInstances; j++) {
                        meshInstance = shadowCasters[j];
                        mesh = meshInstance.mesh;
                        material = meshInstance.material;

                        this.modelMatrixId.setValue(meshInstance.node.worldTransform);
                        if (material.opacityMap) {
                            scope.resolve('texture_opacityMap').setValue(material.opacityMap);
                        }
                        if (meshInstance.skinInstance) {
                            this.poseMatrixId.setValue(meshInstance.skinInstance.matrixPaletteF32);
                            device.setShader(material.opacityMap ? this._depthProgSkinOp : this._depthProgSkin);
                        } else {
                            device.setShader(material.opacityMap ? this._depthProgStaticOp : this._depthProgStatic);
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
                }
            }

            this.setCamera(camera);

            this.dispatchGlobalLights(scene);
            this.dispatchLocalLights(scene);

            for (i = 0, numDrawCalls = drawCalls.length; i < numDrawCalls; i++) {
                drawCall = drawCalls[i];
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
                        device.setShader(material.getProgram(device, mesh));
                        material.setParameters(device);
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
        }

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
    });

    return {
        ForwardRenderer: ForwardRenderer
    }; 
}());