pc.extend(pc, function () {

    var maxSize = 2048;
    var maskDynamic = 1;
    var maskBaked = 2;
    var maskLightmap = 4;

    var sceneLightmaps = [];
    var sceneLightmapsNode = [];
    var lmCamera;
    var tempVec = new pc.Vec3();
    var bounds = new pc.BoundingBox();
    var lightBounds = new pc.BoundingBox();
    var tempSphere = {};

    var PASS_COLOR = 0;
    var PASS_DIR = 1;

    var passTexName = ["texture_lightMap", "texture_dirLightMap"];
    var passMaterial = [];


    function collectModels(node, nodes, nodesMeshInstances, allNodes) {
        if (!node.enabled) return;

        var i;
        if (node.model && node.model.model && node.model.enabled) {
            if (allNodes) allNodes.push(node);
            if (node.model.data.lightmapped) {
                if (nodes) {
                    var hasUv1 = true;
                    var meshInstances = node.model.model.meshInstances;
                    for(i=0; i<meshInstances.length; i++) {
                        if (!meshInstances[i].mesh.vertexBuffer.format.hasUv1) {
                            hasUv1 = false;
                            break;
                        }
                    }
                    if (hasUv1) {

                        var j;
                        var isInstance;
                        var notInstancedMeshInstances = [];
                        for(i=0; i<meshInstances.length; i++) {
                            isInstance = false;
                            for(j=0; j<meshInstances.length; j++) {
                                if (i!==j) {
                                    if (meshInstances[i].mesh===meshInstances[j].mesh) {
                                        isInstance = true;
                                    }
                                }
                            }
                            // collect each instance (object with shared VB) as separate "node"
                            if (isInstance) {
                                nodes.push(node);
                                nodesMeshInstances.push([meshInstances[i]]);
                            } else {
                                notInstancedMeshInstances.push(meshInstances[i]);
                            }
                        }

                        // collect all non-shared objects as one "node"
                        if (notInstancedMeshInstances.length > 0) {
                            nodes.push(node);
                            nodesMeshInstances.push(notInstancedMeshInstances);
                        }
                    }
                }
            }
        }
        for(i = 0; i < node._children.length; i++) {
            collectModels(node._children[i], nodes, nodesMeshInstances, allNodes);
        }
    }

    /**
     * @name pc.Lightmapper
     * @class The lightmapper is used to bake scene lights into textures.
     */
    var Lightmapper = function (device, root, scene, renderer, assets) {
        this.device = device;
        this.root = root;
        this.scene = scene;
        this.renderer = renderer;
        this.assets = assets;

        this._stats = {
            renderPasses: 0,
            lightmapCount: 0,
            totalRenderTime: 0,
            forwardTime: 0,
            fboTime: 0,
            shadowMapTime: 0,
            compileTime: 0,
            shadersLinked: 0
        };
    };

    Lightmapper.prototype = {

        calculateLightmapSize: function(node) {
            var sizeMult = this.scene.lightmapSizeMultiplier || 16;
            var scale = tempVec;
            var parent;
            var area = {x:1, y:1, z:1, uv:1};

            if (node.model.asset) {
                var data = this.assets.get(node.model.asset).data;
                if (data.area) {
                    area.x = data.area.x;
                    area.y = data.area.y;
                    area.z = data.area.z;
                    area.uv = data.area.uv;
                }
            } else if (node.model._area) {
                var data = node.model;
                if (data._area) {
                    area.x = data._area.x;
                    area.y = data._area.y;
                    area.z = data._area.z;
                    area.uv = data._area.uv;
                }
            }
            var areaMult = node.model.lightmapSizeMultiplier || 1;
            area.x *= areaMult;
            area.y *= areaMult;
            area.z *= areaMult;

            scale.copy(node.localScale);
            parent = node._parent;
            while(parent) {
                scale.mul(parent.localScale);
                parent = parent._parent;
            }

            var totalArea = area.x * scale.y * scale.z +
                            area.y * scale.x * scale.z +
                            area.z * scale.x * scale.y;
            totalArea /= area.uv;
            totalArea = Math.sqrt(totalArea);

            return Math.min(pc.math.nextPowerOfTwo(totalArea * sizeMult), this.scene.lightmapMaxResolution || maxSize);
        },

        /**
         * @function
         * @name pc.Lightmapper#bake
         * @description Generates and applies the lightmaps.
         * @param {pc.Entity} nodes An array of models to render lightmaps for. If not supplied, full scene will be baked.
         * @param {Number} mode Baking mode. Possible values:
         * <ul>
         *     <li>pc.BAKE_COLOR: single color lightmap
         *     <li>pc.BAKE_COLORDIR: single color lightmap + dominant light direction (used for bump/specular)
         * </ul>
         * Only lights with bakeDir=true will be used for generating the dominant light direction.
         */
        bake: function(nodes, mode) {

            // #ifdef PROFILER
            var startTime = pc.now();
            this.device.fire('lightmapper:start', {
                timestamp: startTime,
                target: this
            });
            // #endif

            var i, j;
            var device = this.device;
            var scene = this.scene;
            var stats = this._stats;

            var passCount = 1;
            if (mode===undefined) mode = pc.BAKE_COLORDIR;
            if (mode===pc.BAKE_COLORDIR) passCount = 2;
            var pass;

            // #ifdef PROFILER
            stats.renderPasses = stats.shadowMapTime = stats.forwardTime = 0;
            var startShaders = device._shaderStats.linked;
            var startFboTime = device._renderTargetCreationTime;
            var startCompileTime = device._shaderStats.compileTime;
            // #endif

            var allNodes = [];
            var nodesMeshInstances = [];
            if (!nodes) {
                // ///// Full bake /////

                // delete old lightmaps, if present
                for(i=0; i<sceneLightmaps.length; i++) {
                    for(j=0; j<sceneLightmaps[i].length; j++) {
                        sceneLightmaps[i][j].destroy();
                    }
                }
                sceneLightmaps = [];
                sceneLightmapsNode = [];

                // collect
                nodes = [];
                collectModels(this.root, nodes, nodesMeshInstances, allNodes);
            } else {
                // ///// Selected bake /////

                // delete old lightmaps, if present
                var k;
                for(i=0; i<sceneLightmaps.length; i++) {
                    for(i=j; j<nodes.length; j++) {
                        if (sceneLightmapsNode[i]===nodes[j]) {
                            for(k=0; k<sceneLightmaps[i].length; k++) {
                                sceneLightmaps[i][k].destroy();
                            }
                        }
                    }
                }
                sceneLightmaps = [];
                sceneLightmapsNode = [];

                // collect
                var _nodes = [];
                for(i=0; i<nodes.length; i++) {
                    collectModels(nodes[i], _nodes, nodesMeshInstances);
                }
                nodes = _nodes;

                collectModels(this.root, null, null, allNodes);
            }

            if (nodes.length===0) {
                device.fire('lightmapper:end', {
                    timestamp: pc.now(),
                    target: this
                });

                return;
            }

            // #ifdef PROFILER
            stats.lightmapCount = nodes.length;
            // #endif

            // Disable static preprocessing (lightmapper needs original model draw calls)
            var revertStatic = false;
            if (scene._needsStaticPrepare) {
                scene._needsStaticPrepare = false;
                revertStatic = true;
            }

            // Calculate lightmap sizes and allocate textures
            var texSize = [];
            var lmaps = [[], []];
            var texPool = {};
            var size;
            var tex;
            var instances;
            var blackTex = new pc.Texture(this._device, {
                width: 4,
                height: 4,
                format: pc.PIXELFORMAT_R8_G8_B8_A8
            });
            for(i=0; i<nodes.length; i++) {
                size = this.calculateLightmapSize(nodes[i]);
                texSize.push(size);
                for(pass=0; pass<passCount; pass++) {
                    tex = new pc.Texture(device, {
                                                  // #ifdef PROFILER
                                                  profilerHint: pc.TEXHINT_LIGHTMAP,
                                                  // #endif
                                                  width:size,
                                                  height:size,
                                                  format:pc.PIXELFORMAT_R8_G8_B8_A8,
                                                  autoMipmap:false,
                                                  rgbm:(pass===PASS_COLOR)});
                    tex.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
                    tex.addressV = pc.ADDRESS_CLAMP_TO_EDGE;
                    tex._minFilter = pc.FILTER_NEAREST;
                    tex._magFilter = pc.FILTER_NEAREST
                    lmaps[pass].push(tex);
                }

                if (!texPool[size]) {
                    var tex2 = new pc.Texture(device, {
                                              // #ifdef PROFILER
                                              profilerHint: pc.TEXHINT_LIGHTMAP,
                                              // #endif
                                              width:size,
                                              height:size,
                                              format:pc.PIXELFORMAT_R8_G8_B8_A8,
                                              autoMipmap:false,
                                              rgbm:true});
                    tex2.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
                    tex2.addressV = pc.ADDRESS_CLAMP_TO_EDGE;
                    tex2._minFilter = pc.FILTER_NEAREST;
                    tex2._magFilter = pc.FILTER_NEAREST;
                    var targ2 = new pc.RenderTarget(device, tex2, {
                        depth: false
                    });
                    texPool[size] = targ2;
                }
            }

            // Collect bakeable lights
            var lights = [];
            var origMask = [];
            var origShadowMode = [];
            var origEnabled = [];
            var sceneLights = scene._lights;
            var mask;
            for(i=0; i<sceneLights.length; i++) {
                if (sceneLights[i]._enabled) {
                    mask = sceneLights[i]._mask;
                    if ((mask & maskLightmap) !==0) {
                        origMask.push(mask);
                        origShadowMode.push(sceneLights[i].shadowUpdateMode);
                        sceneLights[i]._mask = 0xFFFFFFFF;
                        sceneLights[i].shadowUpdateMode =
                            sceneLights[i]._type===pc.LIGHTTYPE_DIRECTIONAL? pc.SHADOWUPDATE_REALTIME : pc.SHADOWUPDATE_THISFRAME;
                        lights.push(sceneLights[i]);
                        sceneLights[i].isStatic = false; // if baked, can't be used as static
                    }
                }
                origEnabled.push(sceneLights[i]._enabled);
                sceneLights[i].enabled = false;
            }

            // Init shaders
            var chunks = pc.shaderChunks;
            var xformUv1 = chunks.transformUv1VS;
            var bakeLmEnd = chunks.bakeLmEndPS;
            var dilate = chunks.dilatePS;

            var dilateShader = chunks.createShaderFromCode(device, chunks.fullscreenQuadVS, dilate, "lmDilate");
            var constantTexSource = device.scope.resolve("source");
            var constantPixelOffset = device.scope.resolve("pixelOffset");
            var constantBakeDir = device.scope.resolve("bakeDir");

            var pixelOffset = new pc.Vec2();

            var lms = {};
            var drawCalls = scene.drawCalls;

            // update scene matrices
            for(i=0; i<drawCalls.length; i++) {
                if (drawCalls[i].node) drawCalls[i].node.getWorldTransform();
            }

            // Store scene values
            var origFog = scene.fog;
            var origAmbientR = scene.ambientLight.data[0];
            var origAmbientG = scene.ambientLight.data[1];
            var origAmbientB = scene.ambientLight.data[2];
            var origDrawCalls = scene.drawCalls;

            scene.fog = pc.FOG_NONE;
            scene.ambientLight.data[0] = 0;
            scene.ambientLight.data[1] = 0;
            scene.ambientLight.data[2] = 0;

            // Create pseudo-camera
            if (!lmCamera) {
                lmCamera = new pc.Camera();
                lmCamera._node = new pc.GraphNode();
                lmCamera.setClearOptions({color:[0.0, 0.0, 0.0, 0.0], depth:1, flags:pc.CLEARFLAG_COLOR});
                lmCamera.frustumCulling = false;
            }

            var node;
            var lm, rcv, mat, m;

            // Disable existing scene lightmaps
            for(node=0; node<allNodes.length; node++) {
                rcv = allNodes[node].model.model.meshInstances;
                for(i=0; i<rcv.length; i++) {
                    rcv[i]._shaderDefs &= ~(pc.SHADERDEF_LM | pc.SHADERDEF_DIRLM);
                    //rcv[i].mask |= pc.MASK_DYNAMIC;
                    //rcv[i].mask &= ~pc.MASK_LIGHTMAP;
                }
            }

            // Change shadow casting
            var origCastShadows = [];
            var origCasters2 = scene.shadowCasters.slice();
            for(node=0; node<allNodes.length; node++) {
                origCastShadows[node] = allNodes[node].model.castShadows;
                allNodes[node].model.castShadows = allNodes[node].model.data.castShadowsLightmap;
            }
            var origCasters = scene.shadowCasters;
            var casters = [];
            var instanceClone, prop;
            for(i=0; i<origCasters.length; i++) {
                m = origCasters[i];
                instanceClone = new pc.MeshInstance(m.node, m.mesh, m.material);
                for (prop in m) {
                    if (m.hasOwnProperty(prop)) {
                        instanceClone[prop] = m[prop];
                    }
                }
                casters.push(instanceClone);
            }
            scene.shadowCasters = casters;

            var origMat = [];

            // Prepare models
            var nodeBounds = [];
            var nodeTarg = [[],[]];
            var targ, targTmp, texTmp;
            var light, shadowCam;
            var nodeLightCount = [];
            nodeLightCount.length = nodes.length;

            scene.updateShadersFunc(device); // needed to initialize skybox once, so it wont pop up during lightmap rendering

            for(node=0; node<nodes.length; node++) {
                rcv = nodesMeshInstances[node];
                // Store original material values to be changed
                for(i=0; i<rcv.length; i++) {
                    mat = rcv[i].material;
                    origMat.push(mat);
                }
            }

            var lmMaterial;
            for(pass=0; pass<passCount; pass++) {
                if (!passMaterial[pass]) {
                    lmMaterial = new pc.StandardMaterial();
                    lmMaterial.chunks.transformVS = xformUv1; // draw UV1

                    if (pass===PASS_COLOR) {
                        lmMaterial.chunks.endPS = bakeLmEnd; // encode to RGBM
                        // don't bake ambient
                        lmMaterial.ambient = new pc.Color(0,0,0);
                        lmMaterial.ambientTint = true;
                    } else {
                        lmMaterial.chunks.basePS = chunks.basePS + "\nuniform sampler2D texture_dirLightMap;\nuniform float bakeDir;\n";
                        lmMaterial.chunks.endPS = chunks.bakeDirLmEndPS;
                    }

                    // avoid writing unrelated things to alpha
                    lmMaterial.chunks.outputAlphaPS = "\n";
                    lmMaterial.chunks.outputAlphaOpaquePS = "\n";
                    lmMaterial.chunks.outputAlphaPremulPS = "\n";
                    lmMaterial.cull = pc.CULLFACE_NONE;
                    lmMaterial.forceUv1 = true; // provide data to xformUv1
                    lmMaterial.update();
                    lmMaterial.updateShader(device, scene);

                    passMaterial[pass] = lmMaterial;
                }
            }


            for(node=0; node<nodes.length; node++) {
                rcv = nodesMeshInstances[node];
                nodeLightCount[node] = 0;

                // Calculate model AABB
                if (rcv.length > 0) {
                    bounds.copy(rcv[0].aabb);
                    for(i=0; i<rcv.length; i++) {
                        rcv[i].node.getWorldTransform();
                        bounds.add(rcv[i].aabb);
                    }
                }
                var nbounds = new pc.BoundingBox();
                nbounds.copy(bounds);
                nodeBounds.push(nbounds);

                for(i=0; i<rcv.length; i++) {
                    // patch meshInstance
                    m = rcv[i];
                    m._shaderDefs &= ~(pc.SHADERDEF_LM | pc.SHADERDEF_DIRLM); // disable LM define, if set, to get bare ambient on first pass
                    m.mask = maskLightmap; // only affected by LM lights
                    m.deleteParameter("texture_lightMap");
                    m.deleteParameter("texture_dirLightMap");

                    // patch material
                    //m.material = lmMaterial;
                     m.setParameter("texture_dirLightMap", blackTex);
                }

                for(pass=0; pass<passCount; pass++) {
                    lm = lmaps[pass][node];
                    targ = new pc.RenderTarget(device, lm, {
                        depth: false
                    });
                    nodeTarg[pass].push(targ);
                }
            }

            // Disable all bakeable lights
            for(j=0; j<lights.length; j++)
                lights[j].enabled = false;

            // Accumulate lights into RGBM textures
            var shadersUpdatedOn1stPass = false;
            for(i=0; i<lights.length; i++) {
                lights[i].enabled = true; // enable next light
                lights[i]._cacheShadowMap = true;
                if (lights[i]._type!==pc.LIGHTTYPE_DIRECTIONAL) {
                    lights[i]._node.getWorldTransform();
                    lights[i].getBoundingSphere(tempSphere);
                    lightBounds.center = tempSphere.center;
                    lightBounds.halfExtents.x = tempSphere.radius;
                    lightBounds.halfExtents.y = tempSphere.radius;
                    lightBounds.halfExtents.z = tempSphere.radius;
                }
                if (lights[i]._type===pc.LIGHTTYPE_SPOT) {
                    light = lights[i];
                    shadowCam = this.renderer.getShadowCamera(device, light);

                    shadowCam._node.setPosition(light._node.getPosition());
                    shadowCam._node.setRotation(light._node.getRotation());
                    shadowCam._node.rotateLocal(-90, 0, 0);

                    shadowCam.setProjection(pc.PROJECTION_PERSPECTIVE);
                    shadowCam.setNearClip(light.attenuationEnd / 1000);
                    shadowCam.setFarClip(light.attenuationEnd);
                    shadowCam.setAspectRatio(1);
                    shadowCam.setFov(light._outerConeAngle * 2);

                    this.renderer.updateCameraFrustum(shadowCam);
                }

                for(node=0; node<nodes.length; node++) {

                    rcv = nodesMeshInstances[node];
                    bounds = nodeBounds[node];
                    scene.drawCalls = [];
                    for(j=0; j<rcv.length; j++) {
                        scene.drawCalls.push(rcv[j]);
                    }
                    scene.updateShaders = true;

                    // Tweak camera to fully see the model, so directional light frustum will also see it
                    if (lights[i]._type===pc.LIGHTTYPE_DIRECTIONAL) {
                        tempVec.copy(bounds.center);
                        tempVec.y += bounds.halfExtents.y;

                        lmCamera._node.setPosition(tempVec);
                        lmCamera._node.setEulerAngles(-90, 0, 0);

                        var frustumSize = Math.max(bounds.halfExtents.x, bounds.halfExtents.z);

                        lmCamera.setProjection( pc.PROJECTION_ORTHOGRAPHIC );
                        lmCamera.setNearClip( 0 );
                        lmCamera.setFarClip( bounds.halfExtents.y * 2 );
                        lmCamera.setAspectRatio( 1 );
                        lmCamera.setOrthoHeight( frustumSize );
                    } else {
                        if (!lightBounds.intersects(bounds)) {
                            continue;
                        }
                    }

                    if (lights[i]._type===pc.LIGHTTYPE_SPOT) {
                        var nodeVisible = false;
                        for(j=0; j<rcv.length; j++) {
                            if (this.renderer._isVisible(shadowCam, rcv[j])) {
                                nodeVisible = true;
                                break;
                            }
                        }
                        if (!nodeVisible) {
                            continue;
                        }
                    }

                    for(pass=0; pass<passCount; pass++) {
                        lm = lmaps[pass][node];
                        targ = nodeTarg[pass][node];
                        targTmp = texPool[lm.width];
                        texTmp = targTmp.colorBuffer;

                        if (pass===0) {
                            shadersUpdatedOn1stPass = scene.updateShaders;
                        } else if (shadersUpdatedOn1stPass) {
                            scene.updateShaders = true;
                        }

                        for(j=0; j<rcv.length; j++) {
                            rcv[j].material = passMaterial[pass];
                        }

                        // ping-ponging output
                        lmCamera.setRenderTarget(targTmp);

                        if (pass===PASS_DIR) {
                            constantBakeDir.setValue(lights[i].bakeDir? 1 : 0);
                        }

                        //console.log("Baking light "+lights[i]._node.name + " on model " + nodes[node].name);

                        this.renderer.render(scene, lmCamera);
                        stats.shadowMapTime += this.renderer._shadowMapTime;
                        stats.forwardTime += this.renderer._forwardTime;
                        stats.renderPasses++;

                        lmaps[pass][node] = texTmp;
                        nodeTarg[pass][node] = targTmp;
                        texPool[lm.width] = targ;

                        for(j=0; j<rcv.length; j++) {
                            m = rcv[j];
                            m.setParameter(passTexName[pass], texTmp); // ping-ponging input
                            m._shaderDefs |= pc.SHADERDEF_LM; // force using LM even if material doesn't have it
                        }
                    }

                    nodeLightCount[node]++;
                }

                lights[i].enabled = false; // disable that light
                lights[i]._cacheShadowMap = false;
            }


            var id = 0;
            var sceneLmaps;
            for(node=0; node<nodes.length; node++) {
                rcv = nodesMeshInstances[node];
                sceneLmaps = [];

                for(pass=0; pass<passCount; pass++) {
                    lm = lmaps[pass][node];
                    targ = nodeTarg[pass][node];
                    targTmp = texPool[lm.width];
                    texTmp = targTmp.colorBuffer;

                    // Dilate
                    var numDilates2x = 4; // 8 dilates
                    pixelOffset.set(1/lm.width, 1/lm.height);
                    constantPixelOffset.setValue(pixelOffset.data);
                    for(i=0; i<numDilates2x; i++) {
                        constantTexSource.setValue(lm);
                        pc.drawQuadWithShader(device, targTmp, dilateShader);

                        constantTexSource.setValue(texTmp);
                        pc.drawQuadWithShader(device, targ, dilateShader);
                    }


                    for(i=0; i<rcv.length; i++) {
                        m = rcv[i];

                        if (pass===0) {
                            m.mask = maskBaked;
                            // roll material back
                            rcv[i].material = origMat[id];
                            id++;
                        }

                        // Set lightmap
                        rcv[i].setParameter(passTexName[pass], lm);
                        if (pass===PASS_DIR) rcv[i]._shaderDefs |= pc.SHADERDEF_DIRLM;
                    }
                    sceneLmaps[pass] = lm;

                    // Clean up
                    if (pass===passCount-1) targ.destroy();
                }

                sceneLightmaps.push(sceneLmaps);
                sceneLightmapsNode.push(nodes[node]);
            }

            for(var key in texPool) {
                if (texPool.hasOwnProperty(key)) {
                    texPool[key].colorBuffer.destroy();
                    texPool[key].destroy();
                }
            }

            // Set up linear filtering
            for(i=0; i<sceneLightmaps.length; i++) {
                for(j=0; j<sceneLightmaps[i].length; j++) {
                    tex = sceneLightmaps[i][j];
                    tex.minFilter = pc.FILTER_LINEAR;
                    tex.magFilter = pc.FILTER_LINEAR
                }
            }

            // Revert shadow casting
            for(node=0; node<allNodes.length; node++) {
                allNodes[node].model.castShadows = origCastShadows[node];
            }
            scene.shadowCasters = origCasters2;

            // Enable all lights back
            for(i=0; i<lights.length; i++) {
                lights[i]._mask = origMask[i];
                lights[i].shadowUpdateMode = origShadowMode[i];
            }

            for(i=0; i<sceneLights.length; i++) {
                sceneLights[i].enabled = origEnabled[i];
            }

            // Roll back scene stuff
            scene.drawCalls = origDrawCalls;
            scene.fog = origFog;
            scene.ambientLight.data[0] = origAmbientR;
            scene.ambientLight.data[1] = origAmbientG;
            scene.ambientLight.data[2] = origAmbientB;

            // Revert static preprocessing
            if (revertStatic) {
                scene._needsStaticPrepare = true;
            }

            // #ifdef PROFILER
            scene._updateLightStats(); // update statistics

            this.device.fire('lightmapper:end', {
                timestamp: pc.now(),
                target: this
            });

            stats.totalRenderTime = pc.now() - startTime;
            stats.shadersLinked = device._shaderStats.linked - startShaders;
            stats.compileTime = device._shaderStats.compileTime - startCompileTime;
            stats.fboTime = device._renderTargetCreationTime - startFboTime;
            // #endif
        }
    };

    return {
        Lightmapper: Lightmapper,
        MASK_DYNAMIC: maskDynamic,
        MASK_BAKED: maskBaked,
        MASK_LIGHTMAP: maskLightmap
    };
}());
