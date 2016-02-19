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

    function collectModels(node, nodes, nodesMeshInstances, allNodes) {
        if (!node.enabled) return;

        var i;
        if (node.model && node.model.model) {
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
        var children = node.getChildren();
        for(i=0; i<children.length; i++) {
            collectModels(children[i], nodes, nodesMeshInstances, allNodes);
        }
    }

    var Lightmapper = function (device, root, scene, renderer, assets) {
        this.device = device;
        this.root = root;
        this.scene = scene;
        this.renderer = renderer;
        this.assets = assets;

        this._stats = {
            renderPasses: 0,
            lightmapCount: 0,
            lightmapMem: 0,
            renderTime: 0
        };
    };

    Lightmapper.prototype = {

        calculateLightmapSize: function(node, nodesMeshInstances) {
            var sizeMult = this.scene.lightmapSizeMultiplier || 1;
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

            scale.copy(node.getLocalScale());
            parent = node.getParent();
            while(parent) {
                scale.mul(parent.getLocalScale());
                parent = parent.getParent();
            }

            var totalArea = area.x * scale.y * scale.z +
                            area.y * scale.x * scale.z +
                            area.z * scale.x * scale.y;
            totalArea /= area.uv;
            totalArea = Math.sqrt(totalArea);

            //if (nodesMeshInstances) {
              //  totalArea *= nodesMeshInstances.length / node.model.model.meshInstances.length; // very approximate
            //}

            return Math.min(pc.math.nextPowerOfTwo(totalArea * sizeMult), this.scene.lightmapMaxResolution || maxSize);
        },

        bake: function(nodes) {

            var startTime = pc.now();
            this.device.fire('lightmapper:start', {
                timestamp: startTime,
                target: this
            });

            var i, j;
            var id;
            var device = this.device;
            var scene = this.scene;
            var stats = this._stats;

            stats.renderPasses = 0;

            var allNodes = [];
            var nodesMeshInstances = [];
            if (!nodes) {
                // ///// Full bake /////

                // delete old lightmaps, if present
                for(i=0; i<sceneLightmaps.length; i++) {
                    sceneLightmaps[i].destroy();
                }
                sceneLightmaps = [];
                sceneLightmapsNode = [];

                // collect
                nodes = [];
                collectModels(this.root, nodes, nodesMeshInstances, allNodes);
            } else {
                // ///// Selected bake /////

                // delete old lightmaps, if present
                for(i=0; i<sceneLightmaps.length; i++) {
                    for(i=j; j<nodes.length; j++) {
                        if (sceneLightmapsNode[i]===nodes[j]) sceneLightmaps[i].destroy();
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

            stats.lightmapCount = nodes.length;

            // Calculate lightmap sizes and allocate textures
            var texSize = [];
            var lmaps = [];
            var texPool = {};
            var size;
            var tex;
            var instances;
            for(i=0; i<nodes.length; i++) {
                size = this.calculateLightmapSize(nodes[i], nodesMeshInstances[i]);
                texSize.push(size);

                tex = new pc.Texture(device, {width:size,
                                              height:size,
                                              format:pc.PIXELFORMAT_R8_G8_B8_A8,
                                              autoMipmap:false,
                                              rgbm:true});
                tex.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
                tex.addressV = pc.ADDRESS_CLAMP_TO_EDGE;
                tex._minFilter = pc.FILTER_LINEAR;
                tex._magFilter = pc.FILTER_LINEAR;
                lmaps.push(tex);

                stats.lightmapMem += size * size * 4 * 4;

                if (!texPool[size]) {
                    var tex2 = new pc.Texture(device, {width:size,
                                              height:size,
                                              format:pc.PIXELFORMAT_R8_G8_B8_A8,
                                              autoMipmap:false,
                                              rgbm:true});
                    tex2.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
                    tex2.addressV = pc.ADDRESS_CLAMP_TO_EDGE;
                    tex2._minFilter = pc.FILTER_LINEAR;
                    tex2._magFilter = pc.FILTER_LINEAR;
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
                    mask = sceneLights[i].mask;
                    if ((mask & maskLightmap) !==0) {
                        origMask.push(mask);
                        origShadowMode.push(sceneLights[i].shadowUpdateMode);
                        sceneLights[i].setMask(0xFFFFFFFF);
                        sceneLights[i].shadowUpdateMode =
                            sceneLights[i].getType()===pc.LIGHTTYPE_DIRECTIONAL? pc.SHADOWUPDATE_REALTIME : pc.SHADOWUPDATE_THISFRAME;
                        lights.push(sceneLights[i]);
                    }
                }
                origEnabled.push(sceneLights[i]._enabled);
                sceneLights[i].setEnabled(false);
            }

            // Init shaders
            var chunks = pc.shaderChunks;
            var xformUv1 = chunks.transformUv1VS;
            var bakeLmEnd = chunks.bakeLmEndPS;
            var dilate = chunks.dilatePS;

            var dilateShader = chunks.createShaderFromCode(device, chunks.fullscreenQuadVS, dilate, "lmDilate");
            var constantTexSource = device.scope.resolve("source");
            var constantPixelOffset = device.scope.resolve("pixelOffset");
            var i, j;

            var lms = {};
            var lm, m, mat;
            var drawCalls = scene.drawCalls;

            // update scene matrices
            for(i=0; i<drawCalls.length; i++) {
                if (drawCalls[i].node) drawCalls[i].node.getWorldTransform();
            }

            // Store scene values
            var origFog = scene.fog;
            var origDrawCalls = scene.drawCalls;

            scene.fog = pc.FOG_NONE;

            // Create pseudo-camera
            if (!lmCamera) {
                lmCamera = new pc.Camera();
                lmCamera._node = new pc.GraphNode();
                lmCamera.setClearOptions({color:[0.0, 0.0, 0.0, 0.0], depth:1, flags:pc.CLEARFLAG_COLOR});
            }

            var node;
            var lm, rcv, mat;

            // Disable existing scene lightmaps
            for(node=0; node<allNodes.length; node++) {
                rcv = allNodes[node].model.model.meshInstances;
                for(i=0; i<rcv.length; i++) {
                    rcv[i]._shaderDefs &= ~pc.SHADERDEF_LM;
                    //rcv[i].mask |= pc.MASK_DYNAMIC;
                    //rcv[i].mask &= ~pc.MASK_LIGHTMAP;
                }
            }

            // Change shadow casting
            var origCastShadows = [];
            for(node=0; node<allNodes.length; node++) {
                origCastShadows[node] = allNodes[node].model.castShadows;
                allNodes[node].model.castShadows = allNodes[node].model.data.castShadowsLightmap;
            }

            var origXform = [];
            var origEnd = [];
            var origAlpha = [];
            var origAlphaOpaque = [];
            var origAlphaPremul = [];
            var origCull = [];
            var origForceUv1 = [];
            var origAmbient = [];
            var origAmbientTint = [];

            // Prepare models
            var nodeBounds = [];
            var nodeTarg = [];
            var targ, targTmp;

            scene.updateShadersFunc(device); // needed to initialize skybox once, so it wont pop up during lightmap rendering

            for(node=0; node<nodes.length; node++) {
                rcv = nodesMeshInstances[node];
                // Store original material values to be changed
                for(i=0; i<rcv.length; i++) {
                    mat = rcv[i].material;
                    origXform.push(mat.chunks.transformVS);
                    origEnd.push(mat.chunks.endPS);
                    origAlpha.push(mat.chunks.outputAlphaPS);
                    origAlphaOpaque.push(mat.chunks.outputAlphaOpaquePS);
                    origAlphaPremul.push(mat.chunks.outputAlphaPremulPS);
                    origCull.push(mat.cull);
                    origForceUv1.push(mat.forceUv1);
                    origAmbient.push(mat.ambient);
                    origAmbientTint.push(mat.ambientTint);
                }
            }

            for(node=0; node<nodes.length; node++) {
                rcv = nodesMeshInstances[node];
                lm = lmaps[node];

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
                    m._shaderDefs &= ~pc.SHADERDEF_LM; // disable LM define, if set, to get bare ambient on first pass
                    m.mask = maskLightmap; // only affected by LM lights
                    m.deleteParameter("texture_lightMap");

                    // patch material
                    mat = m.material;
                    mat.chunks.transformVS = xformUv1; // draw UV1
                    mat.chunks.endPS = bakeLmEnd; // encode to RGBM

                    // don't bake ambient
                    mat.ambient = new pc.Color(0,0,0);
                    mat.ambientTint = true;

                    // avoid writing unrelated things to alpha
                    mat.chunks.outputAlphaPS = "\n";
                    mat.chunks.outputAlphaOpaquePS = "\n";
                    mat.chunks.outputAlphaPremulPS = "\n";
                    mat.cull = pc.CULLFACE_NONE;
                    mat.forceUv1 = true; // provide data to xformUv1
                    mat.update();
                }

                targ = new pc.RenderTarget(device, lm, {
                    depth: false
                });
                nodeTarg.push(targ);
            }

            // Disable all bakeable lights
            for(j=0; j<lights.length; j++) {
                lights[j].setEnabled(false);
            }

            // Accumulate lights into RGBM textures
            for(i=0; i<lights.length; i++) {
                lights[i].setEnabled(true); // enable next light
                lights[i]._cacheShadowMap = true;
                if (lights[i].getType()!==pc.LIGHTTYPE_DIRECTIONAL) {
                    lights[i]._node.getWorldTransform();
                    lights[i].getBoundingSphere(tempSphere);
                    lightBounds.center = tempSphere.center;
                    lightBounds.halfExtents.x = tempSphere.radius;
                    lightBounds.halfExtents.y = tempSphere.radius;
                    lightBounds.halfExtents.z = tempSphere.radius;
                }

                for(node=0; node<nodes.length; node++) {

                    rcv = nodesMeshInstances[node];
                    lm = lmaps[node];
                    bounds = nodeBounds[node];
                    targ = nodeTarg[node];
                    targTmp = texPool[lm.width];
                    texTmp = targTmp.colorBuffer;
                    scene.drawCalls = [];
                    for(j=0; j<rcv.length; j++) {
                        scene.drawCalls.push(rcv[j]);
                    }
                    scene.updateShaders = true;

                    // Tweak camera to fully see the model, so directional light frustum will also see it
                    if (lights[i].getType()===pc.LIGHTTYPE_DIRECTIONAL) {
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

                    // ping-ponging output
                    lmCamera.setRenderTarget(targTmp);

                    //console.log("Baking light "+lights[i]._node.name + " on model " + nodes[node].name);
                    this.renderer.render(scene, lmCamera);
                    stats.renderPasses++;

                    lmaps[node] = texTmp;
                    nodeTarg[node] = targTmp;
                    texPool[lm.width] = targ;

                    for(j=0; j<rcv.length; j++) {
                        m = rcv[j];
                        m.setParameter("texture_lightMap", texTmp); // ping-ponging input
                        m._shaderDefs |= pc.SHADERDEF_LM; // force using LM even if material doesn't have it
                    }
                }

                lights[i].setEnabled(false); // disable that light
                lights[i]._cacheShadowMap = false;
            }


            var id = 0;
            for(node=0; node<nodes.length; node++) {

                rcv = nodesMeshInstances[node];
                lm = lmaps[node];
                targ = nodeTarg[node];
                targTmp = texPool[lm.width];
                texTmp = targTmp.colorBuffer;

                // Dilate
                var numDilates2x = 4; // 8 dilates
                var pixelOffset = new pc.Vec2(1/lm.width, 1/lm.height);
                constantPixelOffset.setValue(pixelOffset.data);
                for(i=0; i<numDilates2x; i++) {
                    constantTexSource.setValue(lm);
                    pc.drawQuadWithShader(device, targTmp, dilateShader);

                    constantTexSource.setValue(texTmp);
                    pc.drawQuadWithShader(device, targ, dilateShader);
                }


                for(i=0; i<rcv.length; i++) {
                    m = rcv[i];
                    m.mask = maskBaked;

                    // roll material back
                    mat = m.material;
                    mat.chunks.transformVS = origXform[id];
                    mat.chunks.endPS = origEnd[id];
                    mat.chunks.outputAlphaPS = origAlpha[id];
                    mat.chunks.outputAlphaOpaquePS = origAlphaOpaque[id];
                    mat.chunks.outputAlphaPremulPS = origAlphaPremul[id];
                    mat.cull = origCull[id];
                    mat.forceUv1 = origForceUv1[id];
                    mat.ambient = origAmbient[id];
                    mat.ambientTint = origAmbientTint[id];
                    mat.update();

                    // Set lightmap
                    rcv[i].setParameter("texture_lightMap", lm);

                    id++;
                }

                sceneLightmaps.push(lm);
                sceneLightmapsNode.push(nodes[node]);

                // Clean up
                targ.destroy();
            }

            for(var key in texPool) {
                if (texPool.hasOwnProperty(key)) {
                    texPool[key].colorBuffer.destroy();
                    texPool[key].destroy();
                }
            }

            // Revert shadow casting
            for(node=0; node<allNodes.length; node++) {
                allNodes[node].model.castShadows = origCastShadows[node];
            }

            // Enable all lights back
            for(i=0; i<lights.length; i++) {
                lights[i].setMask(origMask[i]);
                lights[i].shadowUpdateMode = origShadowMode[i];
            }

            for(i=0; i<sceneLights.length; i++) {
                sceneLights[i].setEnabled(origEnabled[i]);
            }

            // Roll back scene stuff
            scene.drawCalls = origDrawCalls;
            scene.fog = origFog;

            scene._updateLightStats(); // update statistics

            this.device.fire('lightmapper:end', {
                timestamp: pc.now(),
                target: this
            });

            stats.renderTime = pc.now() - startTime;
        }
    };

    return {
        Lightmapper: Lightmapper,
        MASK_DYNAMIC: maskDynamic,
        MASK_BAKED: maskBaked,
        MASK_LIGHTMAP: maskLightmap
    };
}());
