pc.extend(pc.Application.prototype, function () {

    var maxSize = 2048;
    var maskDynamic = 1;
    var maskBaked = 2;
    var maskLightmap = 4;

    var sceneLightmaps = [];

    function collectModels(node, nodes) {
        if (node.model) {
            if (node.model.data.lightmapped) {
                nodes.push(node);
            }
        }
        var children = node.getChildren();
        for(var i=0; i<children.length; i++) {
            collectModels(children[i], nodes);
        }
    }

    function bake(multiplier) {
        var i;
        var app = this;
        var device = app.graphicsDevice;

        // Delete old lightmaps, if present
        for(i=0; i<sceneLightmaps.length; i++) {
            sceneLightmaps[i].destroy();
        }
        sceneLightmaps = [];

        // Collect bakeable models
        var nodes = [];
        collectModels(app.root, nodes);

        // Calculate lightmap sizes and allocate textures
        var texSize = [];
        var lmaps = [];
        var area, size;
        var sizeMult = multiplier||1;
        var scale = new pc.Vec3();
        var parent;
        var tex;
        for(i=0; i<nodes.length; i++) {
            area = app.assets.get(nodes[i].model.asset).data.area;

            scale.copy(nodes[i].getLocalScale());
            parent = nodes[i].getParent();
            while(parent) {
                scale.mul(parent.getLocalScale());
                parent = parent.getParent();
            }

            size = Math.min(pc.math.nextPowerOfTwo(area * scale.x * scale.y * scale.z * sizeMult), maxSize);
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
        }

        // Collect bakeable lights
        var lights = [];
        var sceneLights = app.scene._lights;
        var mask;
        for(i=0; i<sceneLights.length; i++) {
            mask = sceneLights[i].mask;
            if ((mask & maskLightmap) !==0) {
                lights.push(sceneLights[i]);
            }
        }

        // Init shaders
        var chunks = pc.shaderChunks;
        var xformUv1 = chunks.transformUv1VS;
        var bakeLmEnd = chunks.bakeLmEndPS;
        var dilate = chunks.dilatePS;

        var dilateShader = chunks.createShaderFromCode(device, chunks.fullscreenQuadVS, dilate, "lmDilate");
        var constantTexSource = device.scope.resolve("source");
        var constantPixelOffset = device.scope.resolve("pixelOffset");
        var i;

        var lms = {};
        var lm, m, mat;
        var drawCalls = app.scene.drawCalls;

        // update scene matrices
        for(i=0; i<drawCalls.length; i++) {
            if (drawCalls[i].node) drawCalls[i].node.getWorldTransform();
        }

        // Store scene values
        var origFog = app.scene.fog;
        var origDrawCalls = app.scene.drawCalls;

        app.scene.fog = pc.FOG_NONE;

        // Create pseudo-camera
        var camera = app._lmCamera;
        if (!camera) {
            camera = new pc.Camera();
            camera._node = new pc.GraphNode();
            camera.setClearOptions({color:null, depth:1, flags:0});
            app._lmCamera = camera;
        }

        var origXform = [];
        var origEnd = [];
        var origAlpha = [];
        var origAlphaOpaque = [];
        var origAlphaPremul = [];
        var origCull = [];
        var origForceUv1 = [];

        // Render lightmaps
        var lm, rcv, mat;
        for(node=0; node<nodes.length; node++) {
            lm = lmaps[node];
            rcv = nodes[node].model.model.meshInstances;

            app.scene.drawCalls = [];

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
            }

            for(i=0; i<rcv.length; i++) {
                // patch meshInstance
                m = rcv[i];
                m._shaderDefs &= ~pc.SHADERDEF_LM; // disable LM define, if set, to get bare ambient on first pass
                m.mask = maskLightmap; // only affected by LM lights

                // patch material
                mat = m.material;
                mat.chunks.transformVS = xformUv1; // draw UV1
                mat.chunks.endPS = bakeLmEnd; // encode to RGBM

                // avoid writing unrelated things to alpha
                mat.chunks.outputAlphaPS = "\n";
                mat.chunks.outputAlphaOpaquePS = "\n";
                mat.chunks.outputAlphaPremulPS = "\n";
                mat.cull = pc.CULLFACE_NONE;
                mat.forceUv1 = true; // provide data to xformUv1
                mat.update();

                app.scene.drawCalls.push(m);
            }

            var targ = new pc.RenderTarget(device, lm, {
                depth: false
            });

            // Create 2nd LM for ping-pong
            var texTmp = new pc.Texture(device, {width:lm.width,
                                              height:lm.height,
                                              format:lm.format,
                                              autoMipmap:false,
                                              rgbm:true});
            texTmp.addressU = lm.addressU;
            texTmp.addressV = lm.addressV;
            texTmp._minFilter = pc.FILTER_LINEAR;
            texTmp._magFilter = pc.FILTER_LINEAR;
            var targTmp = new pc.RenderTarget(device, texTmp, {
                depth: false
            });

            // Disable all bakeable lights
            for(j=0; j<lights.length; j++) {
                lights[j].setEnabled(false);
            }

            // Accumulate lights into RGBM texture
            var curTarg;
            for(i=0; i<lights.length; i++) {
                lights[i].setEnabled(true); // enable next light

                // ping-ponging output
                curTarg = i%2===0? targ : targTmp;
                camera.setRenderTarget(curTarg);

                console.log("Baking light "+lights[i]._node.name + " on model " + nodes[node].name);
                app.renderer.render(app.scene, camera);

                for(j=0; j<rcv.length; j++) {
                    m = rcv[j];
                    m.setParameter("texture_lightMap", i%2===0? lm : texTmp); // ping-ponging input
                    m._shaderDefs |= pc.SHADERDEF_LM; // force using LM even if material doesn't have it
                }

                lights[i].setEnabled(false); // disable that light
            }

            if (curTarg!==targ) {
                var tmp = targTmp;
                targTmp = targ;
                targ = tmp;

                tmp = texTmp;
                texTmp = lm;
                lm = tmp;
            }

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
                mat.chunks.transformVS = origXform[i];
                mat.chunks.endPS = origEnd[i];
                mat.chunks.outputAlphaPS = origAlpha[i];
                mat.chunks.outputAlphaOpaquePS = origAlphaOpaque[i];
                mat.chunks.outputAlphaPremulPS = origAlphaPremul[i];
                mat.cull = origCull[i];
                mat.forceUv1 = origForceUv1[i];
                mat.update();

                // Set lightmap
                rcv[i].setParameter("texture_lightMap", lm);
            }

            sceneLightmaps.push(lm);

            // Clean up
            targ.destroy();
            targTmp.destroy();
            texTmp.destroy();
        }

        // Roll back scene stuff
        app.scene.drawCalls = origDrawCalls;
        app.scene.fog = origFog;
    }

    return {
        bake: bake
    };
}());
