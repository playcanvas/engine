pc.extend(pc, function () {

    function sortDrawCalls(drawCallA, drawCallB) {
        if (drawCallA.distSqr && drawCallB.distSqr) {
            return drawCallB.distSqr - drawCallA.distSqr;
        } else {
            return drawCallB.key - drawCallA.key;
        }
    }

    // Global shadowmap resources
    var scale = new pc.Mat4().setScale(0.5, 0.5, 0.5);
    var shift = new pc.Mat4().setTranslate(0.5, 0.5, 0.5);
    var scaleShift = new pc.Mat4().mul2(shift, scale);

    // Lights look down the negative Y and camera's down the positive Z so rotate by -90
    var camToLight = new pc.Mat4().setFromAxisAngle(pc.Vec3.RIGHT, -90);
    var shadowCamWtm = new pc.Mat4();
    var shadowCamView = new pc.Mat4();
    var shadowCamViewProj = new pc.Mat4();

    var viewInvMat = new pc.Mat4();
    var viewMat = new pc.Mat4();
    var viewMat3 = new pc.Mat3();
    var viewProjMat = new pc.Mat4();
    var tempSphere = {};

    var c2sc = new pc.Mat4();

    // The 8 points of the camera frustum transformed to light space
    var frustumPoints = [];
    for (i = 0; i < 8; i++) {
        frustumPoints.push(new pc.Vec3());
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

    function _getFrustumCentroid(scene, camera, farClip, centroid) {
        centroid.set(0, 0, -(farClip + camera._nearClip) * 0.5);
        camera._node.getWorldTransform().transformPoint(centroid, centroid);
    }

    function _getFrustumPoints(scene, camera, farClip, points) {
        var cam = camera;
        var nearClip   = cam.getNearClip();
        var fov        = cam.getFov() * Math.PI / 180.0;
        var aspect     = cam.getAspectRatio();
        var projection = cam.getProjection();

        var x, y;
        if (projection === pc.PROJECTION_PERSPECTIVE) {
            y = Math.tan(fov / 2.0) * nearClip;
        } else {
            y = camera._orthoHeight;
        }
        x = y * aspect;

        points[0].x = x;
        points[0].y = -y;
        points[0].z = -nearClip;
        points[1].x = x;
        points[1].y = y;
        points[1].z = -nearClip;
        points[2].x = -x;
        points[2].y = y;
        points[2].z = -nearClip;
        points[3].x = -x;
        points[3].y = -y;
        points[3].z = -nearClip;

        if (projection === pc.PROJECTION_PERSPECTIVE) {
            y = Math.tan(fov / 2.0) * farClip;
            x = y * aspect;
        }
        points[4].x = x;
        points[4].y = -y;
        points[4].z = -farClip;
        points[5].x = x;
        points[5].y = y;
        points[5].z = -farClip;
        points[6].x = -x;
        points[6].y = y;
        points[6].z = -farClip;
        points[7].x = -x;
        points[7].y = -y;
        points[7].z = -farClip;

        return points;
    }

    //////////////////////////////////////
    // Shadow mapping support functions //
    //////////////////////////////////////
    function createShadowMap(device, width, height) {
        var shadowMap = new pc.Texture(device, {
            format: pc.PIXELFORMAT_R8_G8_B8_A8,
            width: width,
            height: height,
            autoMipmap: false
        });
        shadowMap.minFilter = pc.FILTER_NEAREST;
        shadowMap.magFilter = pc.FILTER_NEAREST;
        shadowMap.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
        shadowMap.addressV = pc.ADDRESS_CLAMP_TO_EDGE;
        return new pc.RenderTarget(device, shadowMap, true);
    };

    function createShadowCubeMap(device, size) {
        var cubemap = new pc.Texture(device, {
            format: pc.PIXELFORMAT_R8_G8_B8_A8,
            width: size,
            height: size,
            cubemap: true,
            autoMipmap: false
        });
        cubemap.minFilter = pc.FILTER_NEAREST;
        cubemap.magFilter = pc.FILTER_NEAREST;
        cubemap.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
        cubemap.addressV = pc.ADDRESS_CLAMP_TO_EDGE;
        var targets = [];
        for (var i = 0; i < 6; i++) {
            var target = new pc.RenderTarget(device, cubemap, {
                face: i,
                depth: true
            });
            targets.push(target);
        }
        return targets;
    };

    function createShadowCamera(device) {
        // We don't need to clear the color buffer if we're rendering a depth map
        var flags = pc.CLEARFLAG_DEPTH;
        if (!device.extDepthTexture) flags |= pc.CLEARFLAG_COLOR;

        var shadowCam = new pc.Camera();
        shadowCam.setClearOptions({
            color: [1.0, 1.0, 1.0, 1.0],
            depth: 1.0,
            flags: flags
        });
        shadowCam._node = new pc.GraphNode();

        return shadowCam;
    };

    function createShadowBuffer(device, light) {
        var shadowBuffer;
        if (light.getType() === pc.LIGHTTYPE_POINT) {
            shadowBuffer = createShadowCubeMap(device, light._shadowResolution);
            light._shadowCamera.setRenderTarget(shadowBuffer[0]);
            light._shadowCubeMap = shadowBuffer;
        } else {
            shadowBuffer = createShadowMap(device, light._shadowResolution, light._shadowResolution);
            light._shadowCamera.setRenderTarget(shadowBuffer);
        }
    };

    function getShadowCamera(device, light) {
        var shadowCam = light._shadowCamera;
        var shadowBuffer;

        if (shadowCam === null) {
            shadowCam = light._shadowCamera = createShadowCamera(device);
            createShadowBuffer(device, light);
        } else {
            shadowBuffer = shadowCam.getRenderTarget();
            if ((shadowBuffer.width !== light._shadowResolution) || (shadowBuffer.height !== light._shadowResolution)) {
                createShadowBuffer(device, light);
            }
        }

        return shadowCam;
    }

    /**
     * @private
     * @name pc.ForwardRenderer
     * @class The forward renderer render scene objects.
     * @constructor Creates a new forward renderer object.
     * @param {pc.GraphicsDevice} graphicsDevice The graphics device used by the renderer.
     */
    function ForwardRenderer(graphicsDevice) {
        this.device = graphicsDevice;

        // Shaders
        var library = this.device.getProgramLibrary();

        this._depthShaderStatic = library.getProgram('depth', {
            skin: false
        });
        this._depthShaderSkin = library.getProgram('depth', {
            skin: true
        });

        this._depthProgStatic = [];
        this._depthProgSkin = [];
        this._depthProgStaticOp = [];
        this._depthProgSkinOp = [];

        this._depthProgStaticPoint = [];
        this._depthProgSkinPoint = [];
        this._depthProgStaticOpPoint = [];
        this._depthProgSkinOpPoint = [];

        var chan = ['r', 'g', 'b', 'a'];

        //for(var i=0; i<pc.SHADOW_DEPTHMASK + 1; i++) { // disable depthMask for now (it's not exposed anyway)
        for(var i=0; i<pc.SHADOW_DEPTH + 1; i++) {

            this._depthProgStatic[i] = library.getProgram('depthrgba', {
                skin: false,
                opacityMap: false,
                shadowType: i
            });
            this._depthProgSkin[i] = library.getProgram('depthrgba', {
                skin: true,
                opacityMap: false,
                shadowType: i
            });
            this._depthProgStaticPoint[i] = library.getProgram('depthrgba', {
                skin: false,
                opacityMap: false,
                point: true
            });
            this._depthProgSkinPoint[i] = library.getProgram('depthrgba', {
                skin: true,
                opacityMap: false,
                point: true
            });

            this._depthProgStaticOp[i] = {};
            this._depthProgSkinOp[i] = {};
            this._depthProgStaticOpPoint[i] = {};
            this._depthProgSkinOpPoint[i] = {};

            for(var c=0; c<4; c++) {
                this._depthProgStaticOp[i][chan[c]] = library.getProgram('depthrgba', {
                    skin: false,
                    opacityMap: true,
                    shadowType: i,
                    opacityChannel: chan[c]
                });
                this._depthProgSkinOp[i][chan[c]] = library.getProgram('depthrgba', {
                    skin: true,
                    opacityMap: true,
                    shadowType: i,
                    opacityChannel: chan[c]
                });
                this._depthProgStaticOpPoint[i][chan[c]] = library.getProgram('depthrgba', {
                    skin: false,
                    opacityMap: true,
                    point: true,
                    opacityChannel: chan[c]
                });
                this._depthProgSkinOpPoint[i][chan[c]] = library.getProgram('depthrgba', {
                    skin: true,
                    opacityMap: true,
                    point: true,
                    opacityChannel: chan[c]
                });
            }
        }


        // Uniforms
        var scope = this.device.scope;
        this.projId = scope.resolve('matrix_projection');
        this.viewId = scope.resolve('matrix_view');
        this.viewId3 = scope.resolve('matrix_view3');
        this.viewInvId = scope.resolve('matrix_viewInverse');
        this.viewProjId = scope.resolve('matrix_viewProjection');
        this.viewPosId = scope.resolve('view_position');
        this.nearClipId = scope.resolve('camera_near');
        this.farClipId = scope.resolve('camera_far');
        this.lightRadiusId = scope.resolve('light_radius');

        this.fogColorId = scope.resolve('fog_color');
        this.fogStartId = scope.resolve('fog_start');
        this.fogEndId = scope.resolve('fog_end');
        this.fogDensityId = scope.resolve('fog_density');

        this.modelMatrixId = scope.resolve('matrix_model');
        this.normalMatrixId = scope.resolve('matrix_normal');
        this.poseMatrixId = scope.resolve('matrix_pose[0]');
        this.boneTextureId = scope.resolve('texture_poseMap');
        this.boneTextureSizeId = scope.resolve('texture_poseMapSize');

        this.alphaTestId = scope.resolve('alpha_ref');

        // Shadows
        this._shadowAabb = new pc.shape.Aabb();
        this._sceneAabb = new pc.shape.Aabb();
        this._shadowState = {
            blend: false
        };
        this.centroid = new pc.Vec3();

        this.fogColor = new Float32Array(3);
        this.ambientColor = new Float32Array(3);
    }

    pc.extend(ForwardRenderer.prototype, {
        setCamera: function (camera, cullBorder) {
            // Projection Matrix
            var projMat = camera.getProjectionMatrix();
            this.projId.setValue(projMat.data);

            // ViewInverse Matrix
            var pos = camera._node.getPosition();
            var rot = camera._node.getRotation();
            viewInvMat.setTRS(pos, rot, pc.Vec3.ONE);
            this.viewInvId.setValue(viewInvMat.data);

            // View Matrix
            viewMat.copy(viewInvMat).invert();
            this.viewId.setValue(viewMat.data);

            viewMat3.data[0] = viewMat.data[0];
            viewMat3.data[1] = viewMat.data[1];
            viewMat3.data[2] = viewMat.data[2];

            viewMat3.data[3] = viewMat.data[4];
            viewMat3.data[4] = viewMat.data[5];
            viewMat3.data[5] = viewMat.data[6];

            viewMat3.data[6] = viewMat.data[8];
            viewMat3.data[7] = viewMat.data[9];
            viewMat3.data[8] = viewMat.data[10];

            this.viewId3.setValue(viewMat3.data);

            // ViewProjection Matrix
            viewProjMat.mul2(projMat, viewMat);
            this.viewProjId.setValue(viewProjMat.data);

            // View Position (world space)
            this.viewPosId.setValue(camera._node.getPosition().data);

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

            if (cullBorder) device.setScissor(1, 1, pixelWidth-2, pixelHeight-2);
        },

        dispatchGlobalLights: function (scene) {
            var i;
            this.mainLight = -1;
            this._activeShadowLights = [];

            var scope = this.device.scope;

            this.ambientColor[0] = scene.ambientLight.r;
            this.ambientColor[1] = scene.ambientLight.g;
            this.ambientColor[2] = scene.ambientLight.b;
            if (scene.gammaCorrection) {
                for(i=0; i<3; i++) {
                    this.ambientColor[i] = Math.pow(this.ambientColor[i], 2.2);
                }
            }
            scope.resolve("light_globalAmbient").setValue(this.ambientColor);
            scope.resolve("exposure").setValue(scene.exposure);
            if (scene._skyboxModel) scope.resolve("skyboxIntensity").setValue(scene.skyboxIntensity);
        },

        dispatchDirectLights: function (scene, mask) {
            var dirs = scene._globalLights;
            var numDirs = dirs.length;
            var i;
            var directional, wtm, light;
            var cnt = 0;

            var scope = this.device.scope;

            for (i = 0; i < numDirs; i++) {
                if (!(dirs[i].mask & mask)) continue;

                directional = dirs[i];
                wtm = directional._node.getWorldTransform();
                light = "light" + cnt;

                scope.resolve(light + "_color").setValue(scene.gammaCorrection? directional._linearFinalColor.data : directional._finalColor.data);

                // Directionals shine down the negative Y axis
                wtm.getY(directional._direction).scale(-1);
                scope.resolve(light + "_direction").setValue(directional._direction.normalize().data);

                if (directional.getCastShadows()) {
                    var shadowMap = this.device.extDepthTexture ?
                            directional._shadowCamera._renderTarget._depthTexture :
                            directional._shadowCamera._renderTarget.colorBuffer;
                    scope.resolve(light + "_shadowMap").setValue(shadowMap);
                    scope.resolve(light + "_shadowMatrix").setValue(directional._shadowMatrix.data);
                    scope.resolve(light + "_shadowParams").setValue([directional._shadowResolution, directional._normalOffsetBias, directional._shadowBias]);
                    this._activeShadowLights.push(directional);
                    if (this.mainLight < 0) {
                        scope.resolve(light + "_shadowMatrixVS").setValue(directional._shadowMatrix.data);
                        scope.resolve(light + "_shadowParamsVS").setValue([directional._shadowResolution, directional._normalOffsetBias, directional._shadowBias]);
                        scope.resolve(light + "_directionVS").setValue(directional._direction.normalize().data);
                        this.mainLight = i;
                    }
                }
                cnt++;
            }
            return cnt;
        },

        dispatchLocalLights: function (scene, mask, usedDirLights) {
            var i, wtm;
            var point, spot;
            var light;
            var localLights = scene._localLights;
            var cnt = 0;

            var pnts = localLights[pc.LIGHTTYPE_POINT-1];
            var spts = localLights[pc.LIGHTTYPE_SPOT-1];

            var numDirs = usedDirLights;
            var numPnts = pnts.length;
            var numSpts = spts.length;

            var scope = this.device.scope;

            for (i = 0; i < numPnts; i++) {
                if (!(pnts[i].mask & mask)) continue;

                point = pnts[i];
                wtm = point._node.getWorldTransform();
                light = "light" + (numDirs + cnt);

                scope.resolve(light + "_radius").setValue(point._attenuationEnd);
                scope.resolve(light + "_color").setValue(scene.gammaCorrection? point._linearFinalColor.data : point._finalColor.data);
                wtm.getTranslation(point._position);
                scope.resolve(light + "_position").setValue(point._position.data);

                if (point.getCastShadows()) {
                    var shadowMap = this.device.extDepthTexture ?
                            point._shadowCamera._renderTarget._depthTexture :
                            point._shadowCamera._renderTarget.colorBuffer;
                    scope.resolve(light + "_shadowMap").setValue(shadowMap);
                    scope.resolve(light + "_shadowMatrix").setValue(point._shadowMatrix.data);
                    scope.resolve(light + "_shadowParams").setValue([point._shadowResolution, point._normalOffsetBias, point._shadowBias, 1.0 / point.getAttenuationEnd()]);
                    this._activeShadowLights.push(point);
                }
                cnt++;
            }

            for (i = 0; i < numSpts; i++) {
                if (!(spts[i].mask & mask)) continue;

                spot = spts[i];
                wtm = spot._node.getWorldTransform();
                light = "light" + (numDirs + cnt);

                scope.resolve(light + "_innerConeAngle").setValue(spot._innerConeAngleCos);
                scope.resolve(light + "_outerConeAngle").setValue(spot._outerConeAngleCos);
                scope.resolve(light + "_radius").setValue(spot._attenuationEnd);
                scope.resolve(light + "_color").setValue(scene.gammaCorrection? spot._linearFinalColor.data : spot._finalColor.data);
                wtm.getTranslation(spot._position);
                scope.resolve(light + "_position").setValue(spot._position.data);
                // Spots shine down the negative Y axis
                wtm.getY(spot._direction).scale(-1);
                scope.resolve(light + "_spotDirection").setValue(spot._direction.data);

                if (spot.getCastShadows()) {
                    var shadowMap = this.device.extDepthTexture ?
                            spot._shadowCamera._renderTarget._depthTexture :
                            spot._shadowCamera._renderTarget.colorBuffer;
                    scope.resolve(light + "_shadowMap").setValue(shadowMap);
                    scope.resolve(light + "_shadowMatrix").setValue(spot._shadowMatrix.data);
                    scope.resolve(light + "_shadowParams").setValue([spot._shadowResolution, spot._normalOffsetBias, spot._shadowBias]);
                    this._activeShadowLights.push(spot);
                    if (this.mainLight < 0) {
                        scope.resolve(light + "_shadowMatrixVS").setValue(spot._shadowMatrix.data);
                        scope.resolve(light + "_shadowParamsVS").setValue([spot._shadowResolution, spot._normalOffsetBias, spot._shadowBias]);
                        scope.resolve(light + "_positionVS").setValue(spot._position.data);
                        this.mainLight = i;
                    }
                }
                cnt++;
            }
        },

        /**
         * @private
         * @function
         * @name pc.ForwardRenderer#render
         * @description Renders the scene using the specified camera.
         * @param {pc.Scene} scene The scene to render.
         * @param {pc.Camera} camera The camera with which to render the scene.
         */
        render: function (scene, camera) {
            var device = this.device;
            var scope = device.scope;

            scene.depthDrawCalls = 0;
            scene.shadowDrawCalls = 0;
            scene.forwardDrawCalls = 0;

            scene._activeCamera = camera;

            if (scene.updateShaders) {
                scene._updateShaders(device);
                scene.updateShaders = false;
            }

            var i, j, numInstances;
            var lights = scene._lights;
            var models = scene._models;

            var drawCalls = scene.drawCalls;
            var drawCallsCount = drawCalls.length;
            var shadowCasters = scene.shadowCasters;

            var drawCall, meshInstance, prevMeshInstance = null, mesh, material, prevMaterial = null, style;

            // Sort lights by type
            scene._globalLights.length = 0;
            scene._localLights[0].length = 0;
            scene._localLights[1].length = 0;

            for (i = 0; i < lights.length; i++) {
                var light = lights[i];
                if (light.getEnabled()) {
                    if (light.getType() === pc.LIGHTTYPE_DIRECTIONAL) {
                        scene._globalLights.push(light);
                    } else {
                        scene._localLights[light.getType() === pc.LIGHTTYPE_POINT ? 0 : 1].push(light);
                    }
                }
            }

            this.culled = [];
            var meshPos;
            var visible;
            var btype;

            // Calculate the distance of transparent meshes from the camera
            // and cull too
            var camPos = camera._node.getPosition();
            for (i = 0; i < drawCallsCount; i++) {
                drawCall = drawCalls[i];
                visible = true;
                meshPos = null;
                if (!drawCall.command) {
                    if (drawCall._hidden) continue; // use _hidden property to quickly hide/show meshInstances
                    meshInstance = drawCall;

                    // Only alpha sort and cull mesh instances in the main world
                    if (meshInstance.layer === pc.LAYER_WORLD) {

                        if (camera.frustumCulling && drawCall.cull) {
                            meshPos = meshInstance.aabb.center;
                            if (!meshInstance._aabb._radius) meshInstance._aabb._radius = meshInstance._aabb.halfExtents.length();
                            tempSphere.center = meshPos;
                            tempSphere.radius = meshInstance._aabb._radius;
                            if (!camera._frustum.containsSphere(tempSphere)) {
                                visible = false;
                            }
                        }

                        if (visible) {
                            btype = meshInstance.material.blendType;
                            if (btype === pc.BLEND_NORMAL
                                || btype === pc.BLEND_PREMULTIPLIED) {
                                // alpha sort
                                if (!meshPos) meshPos = meshInstance.aabb.center;
                                var tempx = meshPos.x - camPos.x;
                                var tempy = meshPos.y - camPos.y;
                                var tempz = meshPos.z - camPos.z;
                                meshInstance.distSqr = tempx * tempx + tempy * tempy + tempz * tempz;
                            } else if (meshInstance.distSqr !== undefined) {
                                delete meshInstance.distSqr;
                            }
                        }
                    }
                }
                if (visible) this.culled.push(drawCall);
            }
            for(i=0; i<scene.immediateDrawCalls.length; i++) {
                this.culled.push(scene.immediateDrawCalls[i]);
            }
            drawCalls = this.culled;
            drawCallsCount = this.culled.length;

            // Update all skin matrix palettes
            for (i = 0; i < drawCallsCount; i++) {
                drawCall = drawCalls[i];
                if (drawCall.skinInstance) {
                    drawCall.skinInstance.updateMatrixPalette();
                }
            }

            // Sort meshes into the correct render order
            drawCalls.sort(sortDrawCalls);

            // Render a depth target if the camera has one assigned
            if (camera._depthTarget) {
                var oldTarget = camera.getRenderTarget();
                camera.setRenderTarget(camera._depthTarget);

                this.setCamera(camera);

                var oldBlending = device.getBlending();
                device.setBlending(false);

                for (i = 0; i < drawCallsCount; i++) {
                    drawCall = drawCalls[i];
                    if (!drawCall.command && drawCall.drawToDepth) {
                        meshInstance = drawCall;
                        mesh = meshInstance.mesh;

                        this.modelMatrixId.setValue(meshInstance.node.worldTransform.data);
                        if (meshInstance.skinInstance) {
                            if (device.supportsBoneTextures) {
                                this.boneTextureId.setValue(meshInstance.skinInstance.boneTexture);
                                var w = meshInstance.skinInstance.boneTexture.width;
                                var h = meshInstance.skinInstance.boneTexture.height;
                                this.boneTextureSizeId.setValue([w, h])
                            } else {
                                this.poseMatrixId.setValue(meshInstance.skinInstance.matrixPalette);
                            }
                            device.setShader(this._depthShaderSkin);
                        } else {
                            device.setShader(this._depthShaderStatic);
                        }

                        style = meshInstance.renderStyle;

                        device.setVertexBuffer(mesh.vertexBuffer, 0);
                        device.setIndexBuffer(mesh.indexBuffer[style]);
                        device.draw(mesh.primitive[style]);
                        scene.depthDrawCalls++;
                    }

                    camera.setRenderTarget(oldTarget);
                }
                device.setBlending(oldBlending);
            }

            // Render all shadowmaps
            for (i = 0; i < lights.length; i++) {
                var light = lights[i];
                var type = light.getType();

                if (light.getCastShadows() && light.getEnabled() && light.shadowUpdateMode!==pc.SHADOWUPDATE_NONE) {
                    if (light.shadowUpdateMode===pc.SHADOWUPDATE_THISFRAME) light.shadowUpdateMode = pc.SHADOWUPDATE_NONE;
                    var shadowCam = getShadowCamera(device, light);
                    var passes = 1;
                    var pass;

                    if (type === pc.LIGHTTYPE_DIRECTIONAL) {
                        var shadowDistance = light.getShadowDistance();

                        // 1. Starting at the centroid of the view frustum, back up in the opposite
                        // direction of the light by a certain amount. This will be our temporary
                        // working position.
                        _getFrustumCentroid(scene, camera, shadowDistance, this.centroid);
                        shadowCam._node.setPosition(this.centroid);
                        shadowCam._node.setRotation(light._node.getRotation());
                        // Camera's look down negative Z, and directional lights point down negative Y
                        shadowCam._node.rotateLocal(-90, 0, 0);

                        // 2. Transform the 8 corners of the camera frustum into the shadow camera's
                        // view space
                        _getFrustumPoints(scene, camera, shadowDistance, frustumPoints);
                        shadowCamWtm.copy(shadowCam._node.getWorldTransform());
                        var worldToShadowCam = shadowCamWtm.invert();
                        var camToWorld = camera._node.worldTransform;
                        c2sc.mul2(worldToShadowCam, camToWorld);
                        for (j = 0; j < 8; j++) {
                            c2sc.transformPoint(frustumPoints[j], frustumPoints[j]);
                        }

                        // 3. Come up with a bounding box (in light-space) by calculating the min
                        // and max X, Y, and Z values from your 8 light-space frustum coordinates.
                        var minx, miny, minz, maxx, maxy, maxz;
                        minx = miny = minz = 1000000;
                        maxx = maxy = maxz = -1000000;
                        for (j = 0; j < 8; j++) {
                            var p = frustumPoints[j];
                            if (p.x < minx) minx = p.x;
                            if (p.x > maxx) maxx = p.x;
                            if (p.y < miny) miny = p.y;
                            if (p.y > maxy) maxy = p.y;
                            if (p.z < minz) minz = p.z;
                            if (p.z > maxz) maxz = p.z;
                        }

                        // 4. Use your min and max values to create an off-center orthographic projection.
                        shadowCam._node.translateLocal(-(maxx + minx) * 0.5, (maxy + miny) * 0.5, maxz + (maxz - minz) * 0.25);
                        shadowCamWtm.copy(shadowCam._node.getWorldTransform());

                        shadowCam.setProjection(pc.PROJECTION_ORTHOGRAPHIC);
                        shadowCam.setNearClip(0);
                        shadowCam.setFarClip((maxz - minz) * 1.5);
                        shadowCam.setAspectRatio((maxx - minx) / (maxy - miny));
                        shadowCam.setOrthoHeight((maxy - miny) * 0.5);
                    } else if (type === pc.LIGHTTYPE_SPOT) {
                        shadowCam.setProjection(pc.PROJECTION_PERSPECTIVE);
                        shadowCam.setNearClip(light.getAttenuationEnd() / 1000);
                        shadowCam.setFarClip(light.getAttenuationEnd());
                        shadowCam.setAspectRatio(1);
                        shadowCam.setFov(light.getOuterConeAngle() * 2);

                        var spos = light._node.getPosition();
                        var srot = light._node.getRotation();
                        shadowCamWtm.setTRS(spos, srot, pc.Vec3.ONE);
                        shadowCamWtm.mul2(shadowCamWtm, camToLight);
                    } else if (type === pc.LIGHTTYPE_POINT) {
                        shadowCam.setProjection(pc.PROJECTION_PERSPECTIVE);
                        shadowCam.setNearClip(light.getAttenuationEnd() / 1000);
                        shadowCam.setFarClip(light.getAttenuationEnd());
                        shadowCam.setAspectRatio(1);
                        shadowCam.setFov(90);

                        passes = 6;
                        this.viewPosId.setValue(shadowCam._node.getPosition().data);
                        this.lightRadiusId.setValue(light.getAttenuationEnd());
                    }

                    if (type != pc.LIGHTTYPE_POINT) {
                        shadowCamView.copy(shadowCamWtm).invert();
                        shadowCamViewProj.mul2(shadowCam.getProjectionMatrix(), shadowCamView);
                        light._shadowMatrix.mul2(scaleShift, shadowCamViewProj);

                        // Point the camera along direction of light
                        shadowCam._node.worldTransform.copy(shadowCamWtm);
                    }

                    var opChan = 'r';
                    for(pass=0; pass<passes; pass++){

                        if (type === pc.LIGHTTYPE_POINT) {
                            if (pass===0) {
                                shadowCam._node.setEulerAngles(0, 90, 180);
                            } else if (pass===1) {
                                shadowCam._node.setEulerAngles(0, -90, 180);
                            } else if (pass===2) {
                                shadowCam._node.setEulerAngles(90, 0, 0);
                            } else if (pass===3) {
                                shadowCam._node.setEulerAngles(-90, 0, 0);
                            } else if (pass===4) {
                                shadowCam._node.setEulerAngles(0, 180, 180);
                            } else if (pass===5) {
                                shadowCam._node.setEulerAngles(0, 0, 180);
                            }
                            shadowCam._node.setPosition(light._node.getPosition());
                            shadowCam.setRenderTarget(light._shadowCubeMap[pass]);
                        }

                        this.setCamera(shadowCam, type !== pc.LIGHTTYPE_POINT);

                        device.setBlending(false);
                        device.setColorWrite(true, true, true, true);
                        device.setDepthWrite(true);
                        device.setDepthTest(true);

                        if (device.extDepthTexture) {
                            device.setColorWrite(false, false, false, false);
                        }

                        for (j = 0, numInstances = shadowCasters.length; j < numInstances; j++) {
                            meshInstance = shadowCasters[j];
                            mesh = meshInstance.mesh;
                            material = meshInstance.material;

                            device.setCullMode(material.cull);

                            this.modelMatrixId.setValue(meshInstance.node.worldTransform.data);
                            if (material.opacityMap) {
                                scope.resolve('texture_opacityMap').setValue(material.opacityMap);
                                if (material.opacityMapChannel) opChan = material.opacityMapChannel;
                            }
                            if (meshInstance.skinInstance) {
                                if (device.supportsBoneTextures) {
                                    this.boneTextureId.setValue(meshInstance.skinInstance.boneTexture);
                                    var w = meshInstance.skinInstance.boneTexture.width;
                                    var h = meshInstance.skinInstance.boneTexture.height;
                                    this.boneTextureSizeId.setValue([w, h])
                                } else {
                                    this.poseMatrixId.setValue(meshInstance.skinInstance.matrixPalette);
                                }
                                if (type === pc.LIGHTTYPE_POINT) {
                                    device.setShader(material.opacityMap ? this._depthProgSkinOpPoint[light._shadowType][opChan] : this._depthProgSkinPoint[light._shadowType]);
                                } else {
                                    device.setShader(material.opacityMap ? this._depthProgSkinOp[light._shadowType][opChan] : this._depthProgSkin[light._shadowType]);
                                }
                            } else {
                                if (type === pc.LIGHTTYPE_POINT) {
                                    device.setShader(material.opacityMap ? this._depthProgStaticOpPoint[light._shadowType][opChan] : this._depthProgStaticPoint[light._shadowType]);
                                } else {
                                    device.setShader(material.opacityMap ? this._depthProgStaticOp[light._shadowType][opChan] : this._depthProgStatic[light._shadowType]);
                                }
                            }

                            style = meshInstance.renderStyle;

                            device.setVertexBuffer(mesh.vertexBuffer, 0);
                            device.setIndexBuffer(mesh.indexBuffer[style]);

                            device.draw(mesh.primitive[style]);
                            scene.shadowDrawCalls++;
                        }
                    } // end pass
                }
            }

            // Set up the camera
            this.setCamera(camera);

            // Set up ambient/exposure
            this.dispatchGlobalLights(scene);

            // Set up the fog
            if (scene.fog !== pc.FOG_NONE) {
                this.fogColor[0] = scene.fogColor.r;
                this.fogColor[1] = scene.fogColor.g;
                this.fogColor[2] = scene.fogColor.b;
                if (scene.gammaCorrection) {
                    for(i=0; i<3; i++) {
                        this.fogColor[i] = Math.pow(this.fogColor[i], 2.2);
                    }
                }
                this.fogColorId.setValue(this.fogColor);
                if (scene.fog === pc.FOG_LINEAR) {
                    this.fogStartId.setValue(scene.fogStart);
                    this.fogEndId.setValue(scene.fogEnd);
                } else {
                    this.fogDensityId.setValue(scene.fogDensity);
                }
            }

            var k;
            if (!pc._instanceVertexFormat) {
                var formatDesc = [
                    { semantic: pc.SEMANTIC_TEXCOORD2, components: 4, type: pc.ELEMENTTYPE_FLOAT32 },
                    { semantic: pc.SEMANTIC_TEXCOORD3, components: 4, type: pc.ELEMENTTYPE_FLOAT32 },
                    { semantic: pc.SEMANTIC_TEXCOORD4, components: 4, type: pc.ELEMENTTYPE_FLOAT32 },
                    { semantic: pc.SEMANTIC_TEXCOORD5, components: 4, type: pc.ELEMENTTYPE_FLOAT32 },
                ];
                pc._instanceVertexFormat = new pc.VertexFormat(device, formatDesc);
            }
            if (device.enableAutoInstancing) {
                if (!pc._autoInstanceBuffer) {
                    pc._autoInstanceBuffer = new pc.VertexBuffer(device, pc._instanceVertexFormat, device.autoInstancingMaxObjects, pc.BUFFER_DYNAMIC);
                    pc._autoInstanceBufferData = new Float32Array(pc._autoInstanceBuffer.lock());
                }
            }
            var next;
            var autoInstances;
            var j;
            var objDefs, prevObjDefs, lightMask, prevLightMask, parameters;

            // Render the scene
            for (i = 0; i < drawCallsCount; i++) {
                drawCall = drawCalls[i];
                if (drawCall.command) {
                    // We have a command
                    drawCall.command();
                } else {
                    // We have a mesh instance
                    meshInstance = drawCall;
                    mesh = meshInstance.mesh;
                    material = meshInstance.material;
                    objDefs = meshInstance._shaderDefs;
                    lightMask = meshInstance.mask;

                    if (device.enableAutoInstancing && i!==drawCallsCount-1 && device.extInstancing) {
                        next = i + 1;
                        autoInstances = 0;
                        if (drawCalls[next].mesh===mesh && drawCalls[next].material===material) {
                            for(j=0; j<16; j++) {
                                pc._autoInstanceBufferData[j] = drawCall.node.worldTransform.data[j];
                            }
                            autoInstances = 1;
                            while(next!==drawCallsCount && drawCalls[next].mesh===mesh && drawCalls[next].material===material) {
                                for(j=0; j<16; j++) {
                                    pc._autoInstanceBufferData[autoInstances * 16 + j] = drawCalls[next].node.worldTransform.data[j];
                                }
                                autoInstances++;
                                next++;
                            }
                            meshInstance.instancingData = {};
                            meshInstance.instancingData.count = autoInstances;
                            meshInstance.instancingData._buffer = pc._autoInstanceBuffer;
                            meshInstance.instancingData._buffer.unlock();
                            i = next - 1;
                        }
                    }

                    if (meshInstance.instancingData && device.extInstancing) {
                        objDefs |= pc.SHADERDEF_INSTANCING;
                        if (!meshInstance.instancingData._buffer) {
                            meshInstance.instancingData._buffer = new pc.VertexBuffer(device, pc._instanceVertexFormat,
                                drawCall.instancingData.count, drawCall.instancingData.usage, meshInstance.instancingData.buffer);
                        }
                    } else {
                        objDefs &= ~pc.SHADERDEF_INSTANCING;
                        var modelMatrix = meshInstance.node.worldTransform;
                        var normalMatrix = meshInstance.normalMatrix;

                        modelMatrix.invertTo3x3(normalMatrix);
                        normalMatrix.transpose();

                        this.modelMatrixId.setValue(modelMatrix.data);
                        this.normalMatrixId.setValue(normalMatrix.data);
                    }

                    if (meshInstance.skinInstance) {
                        if (device.supportsBoneTextures) {
                            this.boneTextureId.setValue(meshInstance.skinInstance.boneTexture);
                            var w = meshInstance.skinInstance.boneTexture.width;
                            var h = meshInstance.skinInstance.boneTexture.height;
                            this.boneTextureSizeId.setValue([w, h])
                        } else {
                            this.poseMatrixId.setValue(meshInstance.skinInstance.matrixPalette);
                        }
                    }

                    if (material && material === prevMaterial && objDefs !== prevObjDefs) {
                        prevMaterial = null; // force change shader if the object uses a different variant of the same material
                    }

                    if (material !== prevMaterial) {
                        if (!meshInstance._shader || meshInstance._shaderDefs !== objDefs) {
                            meshInstance._shader = material.variants[objDefs];
                            if (!meshInstance._shader) {
                                material.updateShader(device, scene, objDefs);
                                meshInstance._shader = material.variants[objDefs] = material.shader;
                            }
                            meshInstance._shaderDefs = objDefs;
                        }
                        device.setShader(meshInstance._shader);

                        // Uniforms I: material
                        parameters = material.parameters;
                        for (var paramName in parameters) {
                            var parameter = parameters[paramName];
                            if (!parameter.scopeId) {
                                parameter.scopeId = device.scope.resolve(paramName);
                            }
                            parameter.scopeId.setValue(parameter.data);
                        }

                        if (!prevMaterial || lightMask !== prevLightMask) {
                            this._activeShadowLights = [];
                            usedDirLights = this.dispatchDirectLights(scene, lightMask);
                            this.dispatchLocalLights(scene, lightMask, usedDirLights);
                        }

                        if (material.shadowSampleType!==undefined) {
                            for(k=0; k<this._activeShadowLights.length; k++) {
                                if (this._activeShadowLights[k]._shadowType===pc.SHADOW_DEPTHMASK) {
                                    if (material.shadowSampleType===pc.SHADOWSAMPLE_MASK) {
                                        this._activeShadowLights[k]._shadowCamera._renderTarget.colorBuffer.minFilter = pc.FILTER_LINEAR;
                                        this._activeShadowLights[k]._shadowCamera._renderTarget.colorBuffer.magFilter = pc.FILTER_LINEAR;
                                    } else {
                                        this._activeShadowLights[k]._shadowCamera._renderTarget.colorBuffer.minFilter = pc.FILTER_NEAREST;
                                        this._activeShadowLights[k]._shadowCamera._renderTarget.colorBuffer.magFilter = pc.FILTER_NEAREST;
                                    }
                                }
                            }
                        }

                        this.alphaTestId.setValue(material.alphaTest);

                        device.setBlending(material.blend);
                        device.setBlendFunction(material.blendSrc, material.blendDst);
                        device.setBlendEquation(material.blendEquation);
                        device.setColorWrite(material.redWrite, material.greenWrite, material.blueWrite, material.alphaWrite);
                        device.setCullMode(material.cull);
                        device.setDepthWrite(material.depthWrite);
                        device.setDepthTest(material.depthTest);
                    }

                    // Uniforms II: meshInstance overrides
                    parameters = meshInstance.parameters;
                    for (var paramName in parameters) {
                        var parameter = parameters[paramName];
                        if (!parameter.scopeId) {
                            parameter.scopeId = device.scope.resolve(paramName);
                        }
                        parameter.scopeId.setValue(parameter.data);
                    }

                    device.setVertexBuffer(mesh.vertexBuffer, 0);
                    style = meshInstance.renderStyle;
                    device.setIndexBuffer(mesh.indexBuffer[style]);


                    if (meshInstance.instancingData) {
                        device.setVertexBuffer(meshInstance.instancingData._buffer, 1);
                        device.draw(mesh.primitive[style], drawCall.instancingData.count);
                        if (meshInstance.instancingData._buffer===pc._autoInstanceBuffer) {
                            meshInstance.instancingData = null;
                        }
                    } else {
                        device.draw(mesh.primitive[style]);
                    }
                    scene.forwardDrawCalls++;

                    prevMaterial = material;
                    prevMeshInstance = meshInstance;
                    prevObjDefs = objDefs;
                    prevLightMask = lightMask;
                }
            }

            if (scene.immediateDrawCalls.length > 0) {
                scene.immediateDrawCalls = [];
            }
        }
    });

    return {
        ForwardRenderer: ForwardRenderer
    };
}());
