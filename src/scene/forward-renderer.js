pc.extend(pc, function () {

    /*
    --- Rendering sequence ---
    shadow:
        cull
        updateSkin
        sort by depth key
        sort by mesh
        prepare instancing
        render

    screen common:
        cull
        updateSkin

    depth map:
        filter by drawToDepth and blend
        sort by depth key
        sort by mesh
        prepare instancing
        render

    forward:
        sort by key
        sort by mesh
        prepare instancing
        render
    */


    // Global shadowmap resources
    var scaleShift = new pc.Mat4().mul2(
        new pc.Mat4().setTranslate(0.5, 0.5, 0.5),
        new pc.Mat4().setScale(0.5, 0.5, 0.5)
    );

    var opChanId = {r:1, g:2, b:3, a:4};
    var numShadowModes = 4;

    var directionalShadowEpsilon = 0.01;
    var pixelOffset = new pc.Vec2();
    var blurScissorRect = {x:1, y:1, z:0, w:0};

    var shadowCamView = new pc.Mat4();
    var shadowCamViewProj = new pc.Mat4();
    var c2sc = new pc.Mat4();

    var viewInvMat = new pc.Mat4();
    var viewMat = new pc.Mat4();
    var viewMat3 = new pc.Mat3();
    var viewProjMat = new pc.Mat4();

    var viewInvL = new pc.Mat4();
    var viewInvR = new pc.Mat4();
    var viewL = new pc.Mat4();
    var viewR = new pc.Mat4();
    var viewPosL = new pc.Vec3();
    var viewPosR = new pc.Vec3();
    var projL, projR;
    var viewMat3L = new pc.Mat4();
    var viewMat3R = new pc.Mat4();
    var viewProjMatL = new pc.Mat4();
    var viewProjMatR = new pc.Mat4();

    var frustumDiagonal = new pc.Vec3();
    var tempSphere = {center:null, radius:0};
    var meshPos;
    var visibleSceneAabb = new pc.BoundingBox();
    var lightBounds = new pc.BoundingBox();
    var culled = [];
    var filtered = [];
    var boneTextureSize = [0, 0];
    var boneTexture, instancingData, modelMatrix, normalMatrix;

    var shadowMapCache = [{}, {}, {}, {}];
    var shadowMapCubeCache = {};
    var maxBlurSize = 25;

    var keyA, keyB;

    // The 8 points of the camera frustum transformed to light space
    var frustumPoints = [];
    for (var i = 0; i < 8; i++) {
        frustumPoints.push(new pc.Vec3());
    }

    function _getFrustumPoints(camera, farClip, points) {
        var nearClip   = camera.getNearClip();
        var fov        = camera.getFov() * Math.PI / 180.0;
        var aspect     = camera.getAspectRatio();
        var projection = camera.getProjection();

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

    function StaticArray(size) {
        var data = new Array(size);
        var obj = function(idx) { return data[idx]; }
        obj.size = 0;
        obj.push = function(v) {
            data[this.size] = v;
            ++this.size;
        }
        obj.data = data;
        return obj;
    }
    var intersectCache = {
        temp          : [new pc.Vec3(), new pc.Vec3(), new pc.Vec3()],
        vertices      : new Array(3),
        negative      : new StaticArray(3),
        positive      : new StaticArray(3),
        intersections : new StaticArray(3),
        zCollection   : new StaticArray(36)
    };
    function _groupVertices(coord, face, smallerIsNegative) {
        var intersections = intersectCache.intersections;
        var small, large;
        if (smallerIsNegative) {
            small = intersectCache.negative;
            large = intersectCache.positive;
        } else {
            small = intersectCache.positive;
            large = intersectCache.negative;
        }

        intersections.size = 0;
        small.size = 0;
        large.size = 0;

        // Grouping vertices according to the position related the the face
        var intersectCount = 0;
        var v;
        for (var j = 0; j < 3; ++j) {
            v = intersectCache.vertices[j];

            if (v[coord] < face) {
                small.push(v);
            } else if (v[coord] === face) {
                intersections.push(intersectCache.temp[intersections.size].copy(v));
            } else {
                large.push(v);
            }
        }
    }
    function _triXFace(zs, x, y, faceTest, yMin, yMax) {

        var negative = intersectCache.negative;
        var positive = intersectCache.positive;
        var intersections = intersectCache.intersections;

        // Find intersections
        if (negative.size === 3) {
            // Everything is on the negative side of the left face.
            // The triangle won't intersect with the frustum. So ignore it
            return false;
        }

        if (negative.size && positive.size) {
            intersections.push(intersectCache.temp[intersections.size].lerp(
                negative(0), positive(0), (faceTest - negative(0)[x]) / (positive(0)[x] - negative(0)[x])
            ));
            if (negative.size === 2) {
                // 2 on the left, 1 on the right
                intersections.push(intersectCache.temp[intersections.size].lerp(
                    negative(1), positive(0), (faceTest - negative(1)[x]) / (positive(0)[x] - negative(1)[x])
                ));
            } else if (positive.size === 2) {
                // 1 on the left, 2 on the right
                intersections.push(intersectCache.temp[intersections.size].lerp(
                    negative(0), positive(1), (faceTest - negative(0)[x]) / (positive(1)[x] - negative(0)[x])
                ));
            }
        }

        // Get the z of the intersections
        if (intersections.size === 0) {
          return true;
        }
        if (intersections.size === 1) {
            // If there's only one vertex intersect the face
            // Test if it's within the range of top/bottom faces.
            if (yMin <= intersections(0)[y] && intersections(0)[y] <= yMax) {
                zs.push(intersections(0).z);
            }
            return true;
        }
        // There's multiple intersections ( should only be two intersections. )
        if (intersections(1)[y] === intersections(0)[y]) {
            if (yMin <= intersections(0)[y] && intersections(0)[y] <= yMax) {
                zs.push(intersections(0).z);
                zs.push(intersections(1).z);
            }
        } else {
            var delta = (intersections(1).z - intersections(0).z) / (intersections(1)[y] - intersections(0)[y]);
            if (intersections(0)[y] > yMax) {
                zs.push(intersections(0).z + delta * (yMax - intersections(0)[y]));
            } else if (intersections(0)[y] < yMin) {
                zs.push(intersections(0).z + delta * (yMin - intersections(0)[y]));
            } else {
                zs.push(intersections(0).z);
            }
            if (intersections(1)[y] > yMax) {
                zs.push(intersections(1).z + delta * (yMax - intersections(1)[y]));
            } else if (intersections(1)[y] < yMin) {
                zs.push(intersections(1).z + delta * (yMin - intersections(1)[y]));
            } else {
                zs.push(intersections(1).z);
            }
        }
        return true;
    };

    var _sceneAABB_LS = [
        new pc.Vec3(), new pc.Vec3(), new pc.Vec3(), new pc.Vec3(),
        new pc.Vec3(), new pc.Vec3(), new pc.Vec3(), new pc.Vec3()
    ];
    var iAABBTriIndexes = [
        0,1,2,  1,2,3,
        4,5,6,  5,6,7,
        0,2,4,  2,4,6,
        1,3,5,  3,5,7,
        0,1,4,  1,4,5,
        2,3,6,  3,6,7
    ];
    function _getZFromAABB(w2sc, aabbMin, aabbMax, lcamMinX, lcamMaxX, lcamMinY, lcamMaxY) {
        _sceneAABB_LS[0].x = _sceneAABB_LS[1].x = _sceneAABB_LS[2].x = _sceneAABB_LS[3].x = aabbMin.x;
        _sceneAABB_LS[1].y = _sceneAABB_LS[3].y = _sceneAABB_LS[7].y = _sceneAABB_LS[5].y = aabbMin.y;
        _sceneAABB_LS[2].z = _sceneAABB_LS[3].z = _sceneAABB_LS[6].z = _sceneAABB_LS[7].z = aabbMin.z;
        _sceneAABB_LS[4].x = _sceneAABB_LS[5].x = _sceneAABB_LS[6].x = _sceneAABB_LS[7].x = aabbMax.x;
        _sceneAABB_LS[0].y = _sceneAABB_LS[2].y = _sceneAABB_LS[4].y = _sceneAABB_LS[6].y = aabbMax.y;
        _sceneAABB_LS[0].z = _sceneAABB_LS[1].z = _sceneAABB_LS[4].z = _sceneAABB_LS[5].z = aabbMax.z;

        for ( var i = 0; i < 8; ++i ) {
            w2sc.transformPoint( _sceneAABB_LS[i], _sceneAABB_LS[i] );
        }

        var minz = 9999999999;
        var maxz = -9999999999;

        var vertices = intersectCache.vertices;
        var positive = intersectCache.positive;
        var zs       = intersectCache.zCollection;
        zs.size = 0;

        for (var AABBTriIter = 0; AABBTriIter < 12; ++AABBTriIter) {
          vertices[0] = _sceneAABB_LS[iAABBTriIndexes[AABBTriIter * 3 + 0]];
          vertices[1] = _sceneAABB_LS[iAABBTriIndexes[AABBTriIter * 3 + 1]];
          vertices[2] = _sceneAABB_LS[iAABBTriIndexes[AABBTriIter * 3 + 2]];

          var verticesWithinBound = 0;

          _groupVertices("x", lcamMinX, true);
          if (!_triXFace(zs, "x", "y", lcamMinX, lcamMinY, lcamMaxY)) continue;
          verticesWithinBound += positive.size;

          _groupVertices("x", lcamMaxX, false);
          if (!_triXFace(zs, "x", "y", lcamMaxX, lcamMinY, lcamMaxY)) continue;
          verticesWithinBound += positive.size;

          _groupVertices("y", lcamMinY, true);
          if (!_triXFace(zs, "y", "x", lcamMinY, lcamMinX, lcamMaxX)) continue;
          verticesWithinBound += positive.size;

          _groupVertices("y", lcamMaxY, false);
          _triXFace(zs, "y", "x", lcamMaxY, lcamMinX, lcamMaxX);
          if ( verticesWithinBound + positive.size == 12 ) {
            // The triangle does not go outside of the frustum bound.
            zs.push( vertices[0].z );
            zs.push( vertices[1].z );
            zs.push( vertices[2].z );
          }
        }

        var z;
        for (var j = 0, len = zs.size; j < len; j++) {
            z = zs(j);
            if (z < minz) minz = z;
            if (z > maxz) maxz = z;
        }
        return { min: minz, max: maxz };
    }

    function _getZFromAABBSimple(w2sc, aabbMin, aabbMax, lcamMinX, lcamMaxX, lcamMinY, lcamMaxY) {
        _sceneAABB_LS[0].x = _sceneAABB_LS[1].x = _sceneAABB_LS[2].x = _sceneAABB_LS[3].x = aabbMin.x;
        _sceneAABB_LS[1].y = _sceneAABB_LS[3].y = _sceneAABB_LS[7].y = _sceneAABB_LS[5].y = aabbMin.y;
        _sceneAABB_LS[2].z = _sceneAABB_LS[3].z = _sceneAABB_LS[6].z = _sceneAABB_LS[7].z = aabbMin.z;
        _sceneAABB_LS[4].x = _sceneAABB_LS[5].x = _sceneAABB_LS[6].x = _sceneAABB_LS[7].x = aabbMax.x;
        _sceneAABB_LS[0].y = _sceneAABB_LS[2].y = _sceneAABB_LS[4].y = _sceneAABB_LS[6].y = aabbMax.y;
        _sceneAABB_LS[0].z = _sceneAABB_LS[1].z = _sceneAABB_LS[4].z = _sceneAABB_LS[5].z = aabbMax.z;

        var minz = 9999999999;
        var maxz = -9999999999;
        var z;

        for ( var i = 0; i < 8; ++i ) {
            w2sc.transformPoint( _sceneAABB_LS[i], _sceneAABB_LS[i] );
            z = _sceneAABB_LS[i].z;
            if (z < minz) minz = z;
            if (z > maxz) maxz = z;
        }

        return { min: minz, max: maxz };
    }

    //////////////////////////////////////
    // Shadow mapping support functions //
    //////////////////////////////////////
    function getShadowFormat(shadowType) {
        if (shadowType===pc.SHADOW_VSM32) {
            return pc.PIXELFORMAT_RGBA32F;
        } else if (shadowType===pc.SHADOW_VSM16) {
            return pc.PIXELFORMAT_RGBA16F;
        }
        return pc.PIXELFORMAT_R8_G8_B8_A8;
    }

    function getShadowFiltering(device, shadowType) {
        if (shadowType===pc.SHADOW_DEPTH) {
            return pc.FILTER_NEAREST;
        } else if (shadowType===pc.SHADOW_VSM32) {
            return device.extTextureFloatLinear? pc.FILTER_LINEAR : pc.FILTER_NEAREST;
        } else if (shadowType===pc.SHADOW_VSM16) {
            return device.extTextureHalfFloatLinear? pc.FILTER_LINEAR : pc.FILTER_NEAREST;
        }
        return pc.FILTER_LINEAR;
    }

    function createShadowMap(device, width, height, shadowType) {
        var format = getShadowFormat(shadowType);
        var shadowMap = new pc.Texture(device, {
            // #ifdef PROFILER
            profilerHint: pc.TEXHINT_SHADOWMAP,
            // #endif
            format: format,
            width: width,
            height: height,
            autoMipmap: false
        });
        var filter = getShadowFiltering(device, shadowType);
        shadowMap.minFilter = filter;
        shadowMap.magFilter = filter;
        shadowMap.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
        shadowMap.addressV = pc.ADDRESS_CLAMP_TO_EDGE;
        return new pc.RenderTarget(device, shadowMap, true);
    }

    function createShadowCubeMap(device, size) {
        var cubemap = new pc.Texture(device, {
            // #ifdef PROFILER
            profilerHint: pc.TEXHINT_SHADOWMAP,
            // #endif
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
    }

    function gauss(x, sigma) {
        return Math.exp(-(x * x) / (2.0 * sigma * sigma));
    }

    function gaussWeights(kernelSize) {
        if (kernelSize > maxBlurSize) kernelSize = maxBlurSize;
        var sigma = (kernelSize - 1) / (2*3);
        var i, values, sum, halfWidth;

        halfWidth = (kernelSize - 1) * 0.5;
        values = new Array(kernelSize);
        sum = 0.0;
        for (i = 0; i < kernelSize; ++i) {
            values[i] = gauss(i - halfWidth, sigma);
            sum += values[i];
        }

        for (i = 0; i < kernelSize; ++i) {
            values[i] /= sum;
        }
        return values;
    }

    function createShadowCamera(device, shadowType) {
        // We don't need to clear the color buffer if we're rendering a depth map
        var flags = pc.CLEARFLAG_DEPTH;
        if (!device.extDepthTexture) flags |= pc.CLEARFLAG_COLOR;

        var shadowCam = new pc.Camera();
        shadowCam.setClearOptions({
            color: (shadowType > pc.SHADOW_DEPTH?[0,0,0,0] : [1.0, 1.0, 1.0, 1.0]),
            depth: 1.0,
            flags: flags
        });
        shadowCam._node = new pc.GraphNode();
        return shadowCam;
    }

    function getShadowMapFromCache(device, res, mode, layer) {
        if (!layer) layer = 0;
        var id = layer * 10000 + res;
        var shadowBuffer = shadowMapCache[mode][id];
        if (!shadowBuffer) {
            shadowBuffer = createShadowMap(device, res, res, mode? mode : pc.SHADOW_DEPTH);
            shadowMapCache[mode][id] = shadowBuffer;
        }
        return shadowBuffer;
    }

    function createShadowBuffer(device, light) {
        var shadowBuffer;
        if (light._type === pc.LIGHTTYPE_POINT) {
            if (light._shadowType > pc.SHADOW_DEPTH) light._shadowType = pc.SHADOW_DEPTH; // no VSM point lights yet
            if (light._cacheShadowMap) {
                shadowBuffer = shadowMapCubeCache[light._shadowResolution];
                if (!shadowBuffer) {
                    shadowBuffer = createShadowCubeMap(device, light._shadowResolution);
                    shadowMapCubeCache[light._shadowResolution] = shadowBuffer;
                }
            } else {
                shadowBuffer = createShadowCubeMap(device, light._shadowResolution);
            }
            light._shadowCamera.setRenderTarget(shadowBuffer[0]);
            light._shadowCubeMap = shadowBuffer;

        } else {

            if (light._cacheShadowMap) {
                shadowBuffer = getShadowMapFromCache(device, light._shadowResolution, light._shadowType);
            } else {
                shadowBuffer = createShadowMap(device, light._shadowResolution, light._shadowResolution, light._shadowType);
            }

            light._shadowCamera.setRenderTarget(shadowBuffer);
        }
    }

    function getDepthKey(meshInstance) {
        var material = meshInstance.material;
        var x = meshInstance.skinInstance? 10 : 0;
        var y = 0;
        if (material.opacityMap) {
            var opChan = material.opacityMapChannel;
            if (opChan) {
                y = opChanId[opChan];
            }
        }
        return x + y;
    }

    /**
     * @private
     * @name pc.ForwardRenderer
     * @class The forward renderer render scene objects.
     * @description Creates a new forward renderer object.
     * @param {pc.GraphicsDevice} graphicsDevice The graphics device used by the renderer.
     */
    function ForwardRenderer(graphicsDevice) {
        this.device = graphicsDevice;
        var device = this.device;

        this._depthDrawCalls = 0;
        this._shadowDrawCalls = 0;
        this._forwardDrawCalls = 0;
        this._skinDrawCalls = 0;
        this._instancedDrawCalls = 0;
        this._immediateRendered = 0;
        this._removedByInstancing = 0;
        this._camerasRendered = 0;
        this._materialSwitches = 0;
        this._shadowMapUpdates = 0;
        this._shadowMapTime = 0;
        this._depthMapTime = 0;
        this._forwardTime = 0;
        this._cullTime = 0;
        this._sortTime = 0;
        this._skinTime = 0;
        this._instancingTime = 0;

        // Shaders
        var library = device.getProgramLibrary();
        this.library = library;

        this.frontToBack = false;

        // Screen depth (no opacity)
        this._depthShaderStatic = library.getProgram('depth', {
            skin: false
        });
        this._depthShaderSkin = library.getProgram('depth', {
            skin: true
        });
        this._depthShaderStaticOp = {};
        this._depthShaderSkinOp = {};

        var chan = ['r', 'g', 'b', 'a'];
        for(var c=0; c<4; c++) {
            // Screen depth (opacity)
            this._depthShaderStaticOp[chan[c]] = library.getProgram('depth', {
                skin: false,
                opacityMap: true,
                opacityChannel: chan[c]
            });
            this._depthShaderSkinOp[chan[c]] = library.getProgram('depth', {
                skin: true,
                opacityMap: true,
                opacityChannel: chan[c]
            });

            this._depthShaderStaticOp[chan[c]] = library.getProgram('depth', {
                skin: false,
                opacityMap: true,
                opacityChannel: chan[c]
            });
            this._depthShaderSkinOp[chan[c]] = library.getProgram('depth', {
                skin: true,
                opacityMap: true,
                opacityChannel: chan[c]
            });
        }


        // Uniforms
        var scope = device.scope;
        this.projId = scope.resolve('matrix_projection');
        this.viewId = scope.resolve('matrix_view');
        this.viewId3 = scope.resolve('matrix_view3');
        this.viewInvId = scope.resolve('matrix_viewInverse');
        this.viewProjId = scope.resolve('matrix_viewProjection');
        this.viewPosId = scope.resolve('view_position');
        this.nearClipId = scope.resolve('camera_near');
        this.farClipId = scope.resolve('camera_far');
        this.shadowMapLightRadiusId = scope.resolve('light_radius');

        this.fogColorId = scope.resolve('fog_color');
        this.fogStartId = scope.resolve('fog_start');
        this.fogEndId = scope.resolve('fog_end');
        this.fogDensityId = scope.resolve('fog_density');

        this.modelMatrixId = scope.resolve('matrix_model');
        this.normalMatrixId = scope.resolve('matrix_normal');
        this.poseMatrixId = scope.resolve('matrix_pose[0]');
        this.boneTextureId = scope.resolve('texture_poseMap');
        this.boneTextureSizeId = scope.resolve('texture_poseMapSize');
        this.skinPosOffsetId = scope.resolve('skinPosOffset');

        this.alphaTestId = scope.resolve('alpha_ref');
        this.opacityMapId = scope.resolve('texture_opacityMap');

        this.ambientId = scope.resolve("light_globalAmbient");
        this.exposureId = scope.resolve("exposure");
        this.skyboxIntensityId = scope.resolve("skyboxIntensity");
        this.lightColorId = [];
        this.lightDirId = [];
        this.lightShadowMapId = [];
        this.lightShadowMatrixId = [];
        this.lightShadowParamsId = [];
        this.lightShadowMatrixVsId = [];
        this.lightShadowParamsVsId = [];
        this.lightDirVsId = [];
        this.lightRadiusId = [];
        this.lightPosId = [];
        this.lightInAngleId = [];
        this.lightOutAngleId = [];
        this.lightPosVsId = [];
        this.lightCookieId = [];
        this.lightCookieIntId = [];
        this.lightCookieMatrixId = [];
        this.lightCookieOffsetId = [];

        this.depthMapId = scope.resolve('uDepthMap');
        this.screenSizeId = scope.resolve('uScreenSize');
        this._screenSize = new pc.Vec4();

        this.sourceId = scope.resolve("source");
        this.pixelOffsetId = scope.resolve("pixelOffset");
        this.weightId = scope.resolve("weight[0]");
        var chunks = pc.shaderChunks;
        this.blurVsmShaderCode = [chunks.blurVSMPS, "#define GAUSS\n" + chunks.blurVSMPS];
        var packed = "#define PACKED\n";
        this.blurPackedVsmShaderCode = [packed + this.blurVsmShaderCode[0], packed + this.blurVsmShaderCode[1]];
        this.blurVsmShader = [{}, {}];
        this.blurPackedVsmShader = [{}, {}];
        this.blurVsmWeights = {};

        this.fogColor = new Float32Array(3);
        this.ambientColor = new Float32Array(3);
    }

    function mat3FromMat4(m3, m4) {
        m3.data[0] = m4.data[0];
        m3.data[1] = m4.data[1];
        m3.data[2] = m4.data[2];

        m3.data[3] = m4.data[4];
        m3.data[4] = m4.data[5];
        m3.data[5] = m4.data[6];

        m3.data[6] = m4.data[8];
        m3.data[7] = m4.data[9];
        m3.data[8] = m4.data[10];
    }

    pc.extend(ForwardRenderer.prototype, {

        sortCompare: function(drawCallA, drawCallB) {
            if (drawCallA.layer === drawCallB.layer) {
                if (drawCallA.drawOrder && drawCallB.drawOrder) {
                    return drawCallA.drawOrder - drawCallB.drawOrder;
                } else if (drawCallA.zdist && drawCallB.zdist) {
                    return drawCallB.zdist - drawCallA.zdist; // back to front
                } else if (drawCallA.zdist2 && drawCallB.zdist2) {
                    return drawCallA.zdist2 - drawCallB.zdist2; // front to back
                }
            }

            return drawCallB._key[pc.SORTKEY_FORWARD] - drawCallA._key[pc.SORTKEY_FORWARD];
        },

        sortCompareMesh: function(drawCallA, drawCallB) {
            if (drawCallA.layer === drawCallB.layer) {
                if (drawCallA.drawOrder && drawCallB.drawOrder) {
                    return drawCallA.drawOrder - drawCallB.drawOrder;
                } else if (drawCallA.zdist && drawCallB.zdist) {
                    return drawCallB.zdist - drawCallA.zdist; // back to front
                }
            }

            keyA = drawCallA._key[pc.SORTKEY_FORWARD];
            keyB = drawCallB._key[pc.SORTKEY_FORWARD];

            if (keyA===keyB && drawCallA.mesh && drawCallB.mesh) {
                return drawCallB.mesh.id - drawCallA.mesh.id;
            }

            return keyB - keyA;
        },

        depthSortCompare: function(drawCallA, drawCallB) {
            keyA = drawCallA._key[pc.SORTKEY_DEPTH];
            keyB = drawCallB._key[pc.SORTKEY_DEPTH];

            if (keyA===keyB && drawCallA.mesh && drawCallB.mesh) {
                return drawCallB.mesh.id - drawCallA.mesh.id;
            }

            return keyB - keyA;
        },

        lightCompare: function(lightA, lightB) {
            return lightA.key - lightB.key;
        },

        _isVisible: function(camera, meshInstance) {
            if (!meshInstance.visible) return false;

            meshPos = meshInstance.aabb.center;
            if (meshInstance._aabb._radiusVer !== meshInstance._aabbVer) {
                meshInstance._aabb._radius = meshInstance._aabb.halfExtents.length();
                meshInstance._aabb._radiusVer = meshInstance._aabbVer;
            }

            tempSphere.radius = meshInstance._aabb._radius;
            tempSphere.center = meshPos;

            return camera._frustum.containsSphere(tempSphere);
        },

        getShadowCamera: function(device, light) {
            var shadowCam = light._shadowCamera;
            var shadowBuffer;

            if (shadowCam === null) {
                shadowCam = light._shadowCamera = createShadowCamera(device, light._shadowType);
                createShadowBuffer(device, light);
            } else {
                shadowBuffer = shadowCam.getRenderTarget();
                if ((shadowBuffer.width !== light._shadowResolution) || (shadowBuffer.height !== light._shadowResolution)) {
                    createShadowBuffer(device, light);
                }
            }

            return shadowCam;
        },

        updateCameraFrustum: function(camera) {
            var projMat;

            if (camera.vrDisplay && camera.vrDisplay.presenting) {
                projMat = camera.vrDisplay.combinedProj;
                var parent = camera._node.getParent();
                if (parent) {
                    viewMat.copy(parent.getWorldTransform()).mul(camera.vrDisplay.combinedViewInv).invert();
                } else {
                    viewMat.copy(camera.vrDisplay.combinedView);
                }
                viewInvMat.copy(viewMat).invert();
                this.viewInvId.setValue(viewInvMat.data);
                camera._frustum.update(projMat, viewMat);
                return;
            }

            projMat = camera.getProjectionMatrix();
            var pos = camera._node.getPosition();
            var rot = camera._node.getRotation();
            viewInvMat.setTRS(pos, rot, pc.Vec3.ONE);
            this.viewInvId.setValue(viewInvMat.data);
            viewMat.copy(viewInvMat).invert();
            camera._frustum.update(projMat, viewMat);
        },

        setCamera: function (camera, cullBorder) {
            var vrDisplay = camera.vrDisplay;
            if (!vrDisplay || !vrDisplay.presenting) {
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

                // View 3x3
                mat3FromMat4(viewMat3, viewMat);
                this.viewId3.setValue(viewMat3.data);

                // ViewProjection Matrix
                viewProjMat.mul2(projMat, viewMat);
                this.viewProjId.setValue(viewProjMat.data);

                // View Position (world space)
                this.viewPosId.setValue(camera._node.getPosition().data);

                camera._frustum.update(projMat, viewMat);
            } else {
                // Projection LR
                projL = vrDisplay.leftProj;
                projR = vrDisplay.rightProj;

                var parent = camera._node.getParent();
                if (parent) {
                    var transform = parent.getWorldTransform();

                    // ViewInverse LR (parent)
                    viewInvL.mul2(transform, vrDisplay.leftViewInv);
                    viewInvR.mul2(transform, vrDisplay.rightViewInv);

                    // View LR (parent)
                    viewL.copy(viewInvL).invert();
                    viewR.copy(viewInvR).invert();

                    // Combined view (parent)
                    viewMat.copy(parent.getWorldTransform()).mul(vrDisplay.combinedViewInv).invert();
                } else {
                    // ViewInverse LR
                    viewInvL.copy(vrDisplay.leftViewInv);
                    viewInvR.copy(vrDisplay.rightViewInv);

                    // View LR
                    viewL.copy(vrDisplay.leftView);
                    viewR.copy(vrDisplay.rightView);

                    // Combined view
                    viewMat.copy(vrDisplay.combinedView);
                }

                // View 3x3 LR
                mat3FromMat4(viewMat3L, viewL);
                mat3FromMat4(viewMat3R, viewR);

                // ViewProjection LR
                viewProjMatL.mul2(vrDisplay.leftProj, viewL);
                viewProjMatR.mul2(vrDisplay.rightProj, viewR);

                // View Position LR
                viewPosL.data[0] = viewInvL.data[12];
                viewPosL.data[1] = viewInvL.data[13];
                viewPosL.data[2] = viewInvL.data[14];

                viewPosR.data[0] = viewInvR.data[12];
                viewPosR.data[1] = viewInvR.data[13];
                viewPosR.data[2] = viewInvR.data[14];

                camera._frustum.update(vrDisplay.combinedProj, viewMat);
            }

            // Near and far clip values
            this.nearClipId.setValue(camera.getNearClip());
            this.farClipId.setValue(camera.getFarClip());

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

            var scope = this.device.scope;

            this.ambientColor[0] = scene.ambientLight.data[0];
            this.ambientColor[1] = scene.ambientLight.data[1];
            this.ambientColor[2] = scene.ambientLight.data[2];
            if (scene.gammaCorrection) {
                for(i=0; i<3; i++) {
                    this.ambientColor[i] = Math.pow(this.ambientColor[i], 2.2);
                }
            }
            this.ambientId.setValue(this.ambientColor);
            this.exposureId.setValue(scene.exposure);
            if (scene._skyboxModel) this.skyboxIntensityId.setValue(scene.skyboxIntensity);
        },

        _resolveLight: function (scope, i) {
            var light = "light" + i;
            this.lightColorId[i] = scope.resolve(light + "_color");
            this.lightDirId[i] = scope.resolve(light + "_direction");
            this.lightShadowMapId[i] = scope.resolve(light + "_shadowMap");
            this.lightShadowMatrixId[i] = scope.resolve(light + "_shadowMatrix");
            this.lightShadowParamsId[i] = scope.resolve(light + "_shadowParams");
            this.lightShadowMatrixVsId[i] = scope.resolve(light + "_shadowMatrixVS");
            this.lightShadowParamsVsId[i] = scope.resolve(light + "_shadowParamsVS");
            this.lightDirVsId[i] = scope.resolve(light + "_directionVS");
            this.lightRadiusId[i] = scope.resolve(light + "_radius");
            this.lightPosId[i] = scope.resolve(light + "_position");
            this.lightInAngleId[i] = scope.resolve(light + "_innerConeAngle");
            this.lightOutAngleId[i] = scope.resolve(light + "_outerConeAngle");
            this.lightPosVsId[i] = scope.resolve(light + "_positionVS");
            this.lightCookieId[i] = scope.resolve(light + "_cookie");
            this.lightCookieIntId[i] = scope.resolve(light + "_cookieIntensity");
            this.lightCookieMatrixId[i] = scope.resolve(light + "_cookieMatrix");
            this.lightCookieOffsetId[i] = scope.resolve(light + "_cookieOffset");
        },

        dispatchDirectLights: function (scene, mask) {
            var dirs = scene._globalLights;
            var numDirs = dirs.length;
            var i;
            var directional, wtm;
            var cnt = 0;

            var scope = this.device.scope;

            for (i = 0; i < numDirs; i++) {
                if (!(dirs[i]._mask & mask)) continue;

                directional = dirs[i];
                wtm = directional._node.getWorldTransform();

                if (!this.lightColorId[cnt]) {
                    this._resolveLight(scope, cnt);
                }

                this.lightColorId[cnt].setValue(scene.gammaCorrection? directional._linearFinalColor.data : directional._finalColor.data);

                // Directionals shine down the negative Y axis
                wtm.getY(directional._direction).scale(-1);
                this.lightDirId[cnt].setValue(directional._direction.normalize().data);

                if (directional.castShadows) {
                    var shadowMap = this.device.extDepthTexture ?
                            directional._shadowCamera._renderTarget._depthTexture :
                            directional._shadowCamera._renderTarget.colorBuffer;

                    // make bias dependent on far plane because it's not constant for direct light
                    var bias;
                    if (directional._shadowType > pc.SHADOW_DEPTH) {
                        bias = -0.00001*20;
                    } else {
                        bias = (directional.shadowBias / directional._shadowCamera.getFarClip()) * 100;
                        if (this.device.extStandardDerivatives) bias *= -100;
                    }
                    var normalBias = directional._shadowType > pc.SHADOW_DEPTH?
                        directional.vsmBias / (directional._shadowCamera.getFarClip() / 7.0)
                         : directional._normalOffsetBias;

                    this.lightShadowMapId[cnt].setValue(shadowMap);
                    this.lightShadowMatrixId[cnt].setValue(directional._shadowMatrix.data);
                    var params = directional._rendererParams;
                    if (params.length!==3) params.length = 3;
                    params[0] = directional._shadowResolution;
                    params[1] = normalBias;
                    params[2] = bias;
                    this.lightShadowParamsId[cnt].setValue(params);
                    if (this.mainLight < 0) {
                        this.lightShadowMatrixVsId[cnt].setValue(directional._shadowMatrix.data);
                        this.lightShadowParamsVsId[cnt].setValue(params);
                        this.lightDirVsId[cnt].setValue(directional._direction.normalize().data);
                        this.mainLight = i;
                    }
                }
                cnt++;
            }
            return cnt;
        },

        dispatchPointLight: function (scene, scope, point, cnt) {
            var wtm = point._node.getWorldTransform();

            if (!this.lightColorId[cnt]) {
                this._resolveLight(scope, cnt);
            }

            this.lightRadiusId[cnt].setValue(point.attenuationEnd);
            this.lightColorId[cnt].setValue(scene.gammaCorrection? point._linearFinalColor.data : point._finalColor.data);
            wtm.getTranslation(point._position);
            this.lightPosId[cnt].setValue(point._position.data);

            if (point.castShadows) {
                var shadowMap = this.device.extDepthTexture ?
                            point._shadowCamera._renderTarget._depthTexture :
                            point._shadowCamera._renderTarget.colorBuffer;
                this.lightShadowMapId[cnt].setValue(shadowMap);
                var params = point._rendererParams;
                if (params.length!==4) params.length = 4;
                params[0] = point._shadowResolution;
                params[1] = point._normalOffsetBias;
                params[2] = point.shadowBias;
                params[3] = 1.0 / point.attenuationEnd;
                this.lightShadowParamsId[cnt].setValue(params);
            }
            if (point._cookie) {
                this.lightCookieId[cnt].setValue(point._cookie);
                this.lightShadowMatrixId[cnt].setValue(wtm.data);
                this.lightCookieIntId[cnt].setValue(point.cookieIntensity);
            }
        },

        dispatchSpotLight: function (scene, scope, spot, cnt) {
            var wtm = spot._node.getWorldTransform();

            if (!this.lightColorId[cnt]) {
                this._resolveLight(scope, cnt);
            }

            this.lightInAngleId[cnt].setValue(spot._innerConeAngleCos);
            this.lightOutAngleId[cnt].setValue(spot._outerConeAngleCos);
            this.lightRadiusId[cnt].setValue(spot.attenuationEnd);
            this.lightColorId[cnt].setValue(scene.gammaCorrection? spot._linearFinalColor.data : spot._finalColor.data);
            wtm.getTranslation(spot._position);
            this.lightPosId[cnt].setValue(spot._position.data);
            // Spots shine down the negative Y axis
            wtm.getY(spot._direction).scale(-1);
            this.lightDirId[cnt].setValue(spot._direction.normalize().data);

            if (spot.castShadows) {
                var bias;
                if (spot._shadowType > pc.SHADOW_DEPTH) {
                    bias = -0.00001*20;
                } else {
                    bias = spot.shadowBias * 20; // approx remap from old bias values
                    if (this.device.extStandardDerivatives) bias *= -100;
                }
                var normalBias = spot._shadowType > pc.SHADOW_DEPTH?
                    spot.vsmBias / (spot.attenuationEnd / 7.0)
                    : spot._normalOffsetBias;

                var shadowMap = this.device.extDepthTexture ?
                            spot._shadowCamera._renderTarget._depthTexture :
                            spot._shadowCamera._renderTarget.colorBuffer;
                this.lightShadowMapId[cnt].setValue(shadowMap);
                this.lightShadowMatrixId[cnt].setValue(spot._shadowMatrix.data);
                var params = spot._rendererParams;
                if (params.length!==4) params.length = 4;
                params[0] = spot._shadowResolution;
                params[1] = normalBias;
                params[2] = bias;
                params[3] = 1.0 / spot.attenuationEnd;
                this.lightShadowParamsId[cnt].setValue(params);
                if (this.mainLight < 0) {
                    this.lightShadowMatrixVsId[cnt].setValue(spot._shadowMatrix.data);
                    this.lightShadowParamsVsId[cnt].setValue(params);
                    this.lightPosVsId[cnt].setValue(spot._position.data);
                    this.mainLight = i;
                }
            }
            if (spot._cookie) {
                this.lightCookieId[cnt].setValue(spot._cookie);
                if (!spot.castShadows) {
                    var shadowCam = this.getShadowCamera(this.device, spot);
                    var shadowCamNode = shadowCam._node;

                    shadowCamNode.setPosition(spot._node.getPosition());
                    shadowCamNode.setRotation(spot._node.getRotation());
                    shadowCamNode.rotateLocal(-90, 0, 0);

                    shadowCam.setProjection(pc.PROJECTION_PERSPECTIVE);
                    shadowCam.setAspectRatio(1);
                    shadowCam.setFov(spot._outerConeAngle * 2);

                    shadowCamView.setTRS(shadowCamNode.getPosition(), shadowCamNode.getRotation(), pc.Vec3.ONE).invert();
                    shadowCamViewProj.mul2(shadowCam.getProjectionMatrix(), shadowCamView);
                    spot._shadowMatrix.mul2(scaleShift, shadowCamViewProj);
                }
                this.lightShadowMatrixId[cnt].setValue(spot._shadowMatrix.data);
                this.lightCookieIntId[cnt].setValue(spot.cookieIntensity);
                if (spot._cookieTransform) {
                    this.lightCookieMatrixId[cnt].setValue(spot._cookieTransform.data);
                    this.lightCookieOffsetId[cnt].setValue(spot._cookieOffset.data);
                }
            }
        },

        dispatchLocalLights: function (scene, mask, usedDirLights, staticLightList) {
            var i;
            var point, spot;
            var localLights = scene._localLights;

            var pnts = localLights[pc.LIGHTTYPE_POINT-1];
            var spts = localLights[pc.LIGHTTYPE_SPOT-1];

            var numDirs = usedDirLights;
            var numPnts = pnts.length;
            var numSpts = spts.length;
            var cnt = numDirs;

            var scope = this.device.scope;

            for (i = 0; i < numPnts; i++) {
                point = pnts[i];
                if (!(point._mask & mask)) continue;
                if (point.isStatic) continue;
                this.dispatchPointLight(scene, scope, point, cnt);
                cnt++;
            }

            var staticId = 0;
            if (staticLightList) {
                point = staticLightList[staticId];
                while(point && point._type===pc.LIGHTTYPE_POINT) {
                    if (!(point._mask & mask)) {
                        staticId++;
                        point = staticLightList[staticId];
                        continue;
                    }
                    this.dispatchPointLight(scene, scope, point, cnt);
                    cnt++;
                    staticId++;
                    point = staticLightList[staticId];
                }
            }

            for (i = 0; i < numSpts; i++) {
                spot = spts[i];
                if (!(spot._mask & mask)) continue;
                if (spot.isStatic) continue;
                this.dispatchSpotLight(scene, scope, spot, cnt);
                cnt++;
            }

            if (staticLightList) {
                spot = staticLightList[staticId];
                while(spot) { // && spot._type===pc.LIGHTTYPE_SPOT) {
                    if (!(spot._mask & mask)) {
                        staticId++;
                        spot = staticLightList[staticId];
                        continue;
                    }
                    this.dispatchSpotLight(scene, scope, spot, cnt);
                    cnt++;
                    staticId++;
                    spot = staticLightList[staticId];
                }
            }
        },

        cull: function(camera, drawCalls) {
            // #ifdef PROFILER
            var cullTime = pc.now();
            // #endif

            culled.length = 0;
            var i, drawCall, visible;
            var drawCallsCount = drawCalls.length;

            var cullingMask = camera.cullingMask || 0xFFFFFFFF; // if missing assume camera's default value

            if (!camera.frustumCulling) {
                for (i = 0; i < drawCallsCount; i++) {
                    // need to copy array anyway because sorting will happen and it'll break original draw call order assumption
                    drawCall = drawCalls[i];
                    if (!drawCall.visible && !drawCall.command) continue;

                    // if the object's mask AND the camera's cullingMask is zero then the game object will be invisible from the camera
                    if (drawCall.mask && (drawCall.mask & cullingMask) === 0) continue;

                    culled.push(drawCall);
                }
                return culled;
            }

            for (i = 0; i < drawCallsCount; i++) {
                drawCall = drawCalls[i];
                if (!drawCall.command) {
                    if (!drawCall.visible) continue; // use visible property to quickly hide/show meshInstances
                    visible = true;

                    // if the object's mask AND the camera's cullingMask is zero then the game object will be invisible from the camera
                    if (drawCall.mask && (drawCall.mask & cullingMask) === 0) continue;

                    // Don't cull fx/hud/gizmo
                    if (drawCall.layer > pc.LAYER_FX) {
                        if (drawCall.cull) {
                            visible = this._isVisible(camera, drawCall);
                        }
                    }

                    if (visible) culled.push(drawCall);
                } else {
                    culled.push(drawCall);
                }
            }

            // #ifdef PROFILER
            this._cullTime += pc.now() - cullTime;
            // #endif

            return culled;
        },

        calculateSortDistances: function(drawCalls, camPos, camFwd, frontToBack) {
            // #ifdef PROFILER
            var sortTime = pc.now();
            // #endif

            var i, drawCall, btype, meshPos;
            var tempx, tempy, tempz;
            var drawCallsCount = drawCalls.length;

            for (i = 0; i < drawCallsCount; i++) {
                drawCall = drawCalls[i];
                if (drawCall.command) continue;
                if (drawCall.layer <= pc.scene.LAYER_FX) continue; // Only alpha sort mesh instances in the main world
                btype = drawCall.material.blendType;
                if (btype !== pc.BLEND_NONE) {
                    meshPos = drawCall.aabb.center.data;
                    tempx = meshPos[0] - camPos[0];
                    tempy = meshPos[1] - camPos[1];
                    tempz = meshPos[2] - camPos[2];
                    drawCall.zdist = tempx*camFwd[0] + tempy*camFwd[1] + tempz*camFwd[2];
                } else if (drawCall.zdist !== undefined) {
                    delete drawCall.zdist;
                }

                if (frontToBack && btype === pc.BLEND_NONE) {
                    meshPos = drawCall.aabb.center.data;
                    tempx = meshPos[0] - camPos[0];
                    tempy = meshPos[1] - camPos[1];
                    tempz = meshPos[2] - camPos[2];
                    drawCall.zdist2 = tempx*camFwd[0] + tempy*camFwd[1] + tempz*camFwd[2];
                }
            }

            // #ifdef PROFILER
            this._sortTime += pc.now() - sortTime;
            // #endif
        },

        updateCpuSkinMatrices: function(drawCalls) {
            var drawCallsCount = drawCalls.length;
            if (drawCallsCount===0) return;

            // #ifdef PROFILER
            var skinTime = pc.now();
            // #endif

            var i, skin;
            for (i = 0; i < drawCallsCount; i++) {
                skin = drawCalls[i].skinInstance;
                if (skin) {
                    skin.updateMatrices();
                    skin._dirty = true;
                }
            }

            // #ifdef PROFILER
            this._skinTime += pc.now() - skinTime;
            // #endif
        },

        updateGpuSkinMatrices: function(drawCalls) {
            // #ifdef PROFILER
            var skinTime = pc.now();
            // #endif

            var i, skin;
            var drawCallsCount = drawCalls.length;
            for (i = 0; i < drawCallsCount; i++) {
                skin = drawCalls[i].skinInstance;
                if (skin) {
                    if (skin._dirty) {
                        skin.updateMatrixPalette();
                        skin._dirty = false;
                    }
                }
            }

            // #ifdef PROFILER
            this._skinTime += pc.now() - skinTime;
            // #endif
        },

        sortDrawCalls: function(drawCalls, sortFunc, keyType) {
            var drawCallsCount = drawCalls.length;
            if (drawCallsCount===0) return;

            // #ifdef PROFILER
            var sortTime = pc.now();
            // #endif

            // Sort meshes into the correct render order
            drawCalls.sort(sortFunc);

            // #ifdef PROFILER
            this._sortTime += pc.now() - sortTime;
            // #endif
        },

        prepareInstancing: function(device, drawCalls, keyType, shaderType) {
            if (!device.extInstancing) return;

            // #ifdef PROFILER
            var instancingTime = pc.now();
            // #endif

            var drawCallsCount = drawCalls.length;
            var i, j, meshInstance, mesh, next, autoInstances, key, data;
            var offset = 0;

            // Generate matrix buffer for all repeated meshes
            if (device.enableAutoInstancing) {
                for(i=0; i<drawCallsCount-1; i++) {
                    meshInstance = drawCalls[i];
                    mesh = meshInstance.mesh;
                    key = meshInstance._key[keyType];

                    next = i + 1;
                    autoInstances = 0;
                    if (drawCalls[next].mesh===mesh && drawCalls[next]._key[keyType]===key) {
                        for(j=0; j<16; j++) {
                            pc._autoInstanceBufferData[offset + j] = meshInstance.node.worldTransform.data[j];
                        }
                        autoInstances = 1;
                        while(next!==drawCallsCount && drawCalls[next].mesh===mesh && drawCalls[next]._key[keyType]===key) {
                            for(j=0; j<16; j++) {
                                pc._autoInstanceBufferData[offset + autoInstances * 16 + j] = drawCalls[next].node.worldTransform.data[j];
                            }
                            autoInstances++;
                            next++;
                        }
                        data = meshInstance.instancingData;
                        if (!data) {
                            meshInstance.instancingData = data = {};
                        }
                        data.count = autoInstances;
                        data.offset = offset * 4;
                        data._buffer = pc._autoInstanceBuffer;
                        i = next - 1;
                    }
                    offset += autoInstances * 16;
                }
                if (offset > 0) pc._autoInstanceBuffer.unlock();
            }

            // Prepare non-automatic instancing buffers/mark shader to use instancing
            for(i=0; i<drawCallsCount; i++) {
                meshInstance = drawCalls[i];
                if (meshInstance.instancingData) {
                    if (!(meshInstance._shaderDefs & pc.SHADERDEF_INSTANCING)) { // TODO: FIX, THIS IS DANGEROUS
                        meshInstance._shaderDefs |= pc.SHADERDEF_INSTANCING;
                        meshInstance._shader[shaderType] = null;
                    }
                    if (!meshInstance.instancingData._buffer) {
                        meshInstance.instancingData._buffer = new pc.VertexBuffer(device, pc._instanceVertexFormat,
                            meshInstance.instancingData.count, meshInstance.instancingData.usage, meshInstance.instancingData.buffer);
                    }
                } else {
                    if (meshInstance._shaderDefs & pc.SHADERDEF_INSTANCING) {
                        meshInstance._shaderDefs &= ~pc.SHADERDEF_INSTANCING;
                        meshInstance._shader[shaderType] = null;
                    }
                }
            }

            // #ifdef PROFILER
            this._instancingTime += pc.now() - instancingTime;
            // #endif
        },

        setBaseConstants: function(device, material) {
            // Cull mode
            device.setCullMode(material.cull);
            // Alpha test
            if (material.opacityMap) {
                this.opacityMapId.setValue(material.opacityMap);
                this.alphaTestId.setValue(material.alphaTest);
            }
        },

        setSkinning: function(device, meshInstance, material) {
            if (meshInstance.skinInstance) {
                this._skinDrawCalls++;
                this.skinPosOffsetId.setValue(meshInstance.skinInstance.rootNode.getPosition().data);
                if (device.supportsBoneTextures) {
                    boneTexture = meshInstance.skinInstance.boneTexture;
                    this.boneTextureId.setValue(boneTexture);
                    boneTextureSize[0] = boneTexture.width;
                    boneTextureSize[1] = boneTexture.height;
                    this.boneTextureSizeId.setValue(boneTextureSize);
                } else {
                    this.poseMatrixId.setValue(meshInstance.skinInstance.matrixPalette);
                }
            }
        },

        drawInstance: function(device, meshInstance, mesh, style, normal) {
            instancingData = meshInstance.instancingData;
            if (instancingData) {
                this._instancedDrawCalls++;
                this._removedByInstancing += instancingData.count;
                device.setVertexBuffer(instancingData._buffer, 1, instancingData.offset);
                device.draw(mesh.primitive[style], instancingData.count);
                if (instancingData._buffer===pc._autoInstanceBuffer) {
                    meshInstance.instancingData = null;
                    return instancingData.count - 1;
                }
            } else {
                modelMatrix = meshInstance.node.worldTransform;
                this.modelMatrixId.setValue(modelMatrix.data);

                if (normal) {
                    normalMatrix = meshInstance.normalMatrix;
                    modelMatrix.invertTo3x3(normalMatrix); // TODO: cache
                    normalMatrix.transpose();
                    this.normalMatrixId.setValue(normalMatrix.data);
                }

                device.draw(mesh.primitive[style]);
                return 0;
            }
        },

        // used for stereo
        drawInstance2: function(device, meshInstance, mesh, style) {
            instancingData = meshInstance.instancingData;
            if (instancingData) {
                this._instancedDrawCalls++;
                this._removedByInstancing += instancingData.count;
                device.setVertexBuffer(instancingData._buffer, 1, instancingData.offset);
                device.draw(mesh.primitive[style], instancingData.count);
                if (instancingData._buffer===pc._autoInstanceBuffer) {
                    meshInstance.instancingData = null;
                    return instancingData.count - 1;
                }
            } else {
                // matrices are already set
                device.draw(mesh.primitive[style]);
                return 0;
            }
        },

        findShadowShader: function(meshInstance, type, shadowType) {
            if (shadowType >= numShadowModes) shadowType -= numShadowModes;
            var material = meshInstance.material;
            return this.library.getProgram('depthrgba', {
                                skin: !!meshInstance.skinInstance,
                                opacityMap: !!material.opacityMap,
                                opacityChannel: material.opacityMap? (material.opacityMapChannel || 'r') : null,
                                point: type !== pc.LIGHTTYPE_DIRECTIONAL,
                                shadowType: shadowType,
                                instancing: meshInstance.instancingData
                            });
        },

        renderShadows: function(device, camera, drawCalls, lights) {
            // #ifdef PROFILER
            var shadowMapStartTime = pc.now();
            // #endif

            var i, j, light, shadowShader, type, shadowCam, shadowCamNode, lightNode, passes, pass, frustumSize, shadowType, smode;
            var unitPerTexel, delta, p;
            var minx, miny, minz, maxx, maxy, maxz, centerx, centery;
            var opChan;
            var visible, cullTime, numInstances;
            var meshInstance, mesh, material;
            var style;
            var emptyAabb;
            var drawCallAabb;

            for (i = 0; i < lights.length; i++) {
                light = lights[i];
                type = light._type;

                if (light.castShadows && light._enabled && light.shadowUpdateMode!==pc.SHADOWUPDATE_NONE) {

                    shadowCam = this.getShadowCamera(device, light);
                    shadowCamNode = shadowCam._node;
                    lightNode = light._node;
                    passes = 1;

                    shadowCamNode.setPosition(lightNode.getPosition());
                    shadowCamNode.setRotation(lightNode.getRotation());
                    shadowCamNode.rotateLocal(-90, 0, 0); // Camera's look down negative Z, and directional lights point down negative Y

                    if (type === pc.LIGHTTYPE_DIRECTIONAL) {

                        // Positioning directional light frustum I
                        // Construct light's orthographic frustum around camera frustum
                        // Use very large near/far planes this time

                        // 1. Get the frustum of the camera
                        _getFrustumPoints(camera, light.shadowDistance || camera.getFarClip(), frustumPoints);

                        // 2. Figure out the maximum diagonal of the frustum in light's projected space.
                        frustumSize = frustumDiagonal.sub2( frustumPoints[0], frustumPoints[6] ).length();
                        frustumSize = Math.max( frustumSize, frustumDiagonal.sub2( frustumPoints[4], frustumPoints[6] ).length() );

                        // 3. Transform the 8 corners of the camera frustum into the shadow camera's view space
                        shadowCamView.copy( shadowCamNode.getWorldTransform() ).invert();
                        c2sc.copy( shadowCamView ).mul( camera._node.worldTransform );
                        for (j = 0; j < 8; j++) {
                            c2sc.transformPoint(frustumPoints[j], frustumPoints[j]);
                        }

                        // 4. Come up with a bounding box (in light-space) by calculating the min
                        // and max X, Y, and Z values from your 8 light-space frustum coordinates.
                        minx = miny = minz = 1000000;
                        maxx = maxy = maxz = -1000000;
                        for (j = 0; j < 8; j++) {
                            p = frustumPoints[j];
                            if (p.x < minx) minx = p.x;
                            if (p.x > maxx) maxx = p.x;
                            if (p.y < miny) miny = p.y;
                            if (p.y > maxy) maxy = p.y;
                            if (p.z < minz) minz = p.z;
                            if (p.z > maxz) maxz = p.z;
                        }

                        // 5. Enlarge the light's frustum so that the frustum will be the same size
                        // no matter how the view frustum moves.
                        // And also snap the frustum to align with shadow texel. ( Avoid shadow shimmering )
                        unitPerTexel = frustumSize / light._shadowResolution;
                        delta = (frustumSize - (maxx - minx)) * 0.5;
                        minx = Math.floor( (minx - delta) / unitPerTexel ) * unitPerTexel;
                        delta = (frustumSize - (maxy - miny)) * 0.5;
                        miny = Math.floor( (miny - delta) / unitPerTexel ) * unitPerTexel;
                        maxx = minx + frustumSize;
                        maxy = miny + frustumSize;

                        // 6. Use your min and max values to create an off-center orthographic projection.
                        centerx = (maxx + minx) * 0.5;
                        centery = (maxy + miny) * 0.5;
                        shadowCamNode.translateLocal(centerx, centery, 100000);

                        shadowCam.setProjection( pc.PROJECTION_ORTHOGRAPHIC );
                        shadowCam.setNearClip( 0 );
                        shadowCam.setFarClip(200000);
                        shadowCam.setAspectRatio( 1 ); // The light's frustum is a cuboid.
                        shadowCam.setOrthoHeight( frustumSize * 0.5 );

                    } else if (type === pc.LIGHTTYPE_SPOT) {

                        // don't update invisible light
                        if (camera.frustumCulling) {
                            light.getBoundingSphere(tempSphere);
                            if (!camera._frustum.containsSphere(tempSphere)) continue;
                        }

                        shadowCam.setProjection(pc.PROJECTION_PERSPECTIVE);
                        shadowCam.setNearClip(light.attenuationEnd / 1000);
                        shadowCam.setFarClip(light.attenuationEnd);
                        shadowCam.setAspectRatio(1);
                        shadowCam.setFov(light._outerConeAngle * 2);

                        this.viewPosId.setValue(shadowCamNode.getPosition().data);
                        this.shadowMapLightRadiusId.setValue(light.attenuationEnd);

                    } else if (type === pc.LIGHTTYPE_POINT) {

                        // don't update invisible light
                        if (camera.frustumCulling) {
                            light.getBoundingSphere(tempSphere);
                            if (!camera._frustum.containsSphere(tempSphere)) continue;
                        }

                        shadowCam.setProjection(pc.PROJECTION_PERSPECTIVE);
                        shadowCam.setNearClip(light.attenuationEnd / 1000);
                        shadowCam.setFarClip(light.attenuationEnd);
                        shadowCam.setAspectRatio(1);
                        shadowCam.setFov(90);

                        passes = 6;
                        this.viewPosId.setValue(shadowCamNode.getPosition().data);
                        this.shadowMapLightRadiusId.setValue(light.attenuationEnd);
                    }

                    if (light.shadowUpdateMode===pc.SHADOWUPDATE_THISFRAME) light.shadowUpdateMode = pc.SHADOWUPDATE_NONE;

                    this._shadowMapUpdates += passes;

                    for(pass=0; pass<passes; pass++){

                        if (type === pc.LIGHTTYPE_POINT) {
                            if (pass===0) {
                                shadowCamNode.setEulerAngles(0, 90, 180);
                            } else if (pass===1) {
                                shadowCamNode.setEulerAngles(0, -90, 180);
                            } else if (pass===2) {
                                shadowCamNode.setEulerAngles(90, 0, 0);
                            } else if (pass===3) {
                                shadowCamNode.setEulerAngles(-90, 0, 0);
                            } else if (pass===4) {
                                shadowCamNode.setEulerAngles(0, 180, 180);
                            } else if (pass===5) {
                                shadowCamNode.setEulerAngles(0, 0, 180);
                            }
                            shadowCamNode.setPosition(lightNode.getPosition());
                            shadowCam.setRenderTarget(light._shadowCubeMap[pass]);
                        }

                        this.setCamera(shadowCam, type !== pc.LIGHTTYPE_POINT);


                        // Cull shadow casters
                        culled.length = 0;
                        // #ifdef PROFILER
                        cullTime = pc.now();
                        // #endif
                        for (j = 0, numInstances = drawCalls.length; j < numInstances; j++) {
                            meshInstance = drawCalls[j];
                            visible = true;
                            if (meshInstance.cull) {
                                visible = this._isVisible(shadowCam, meshInstance);
                            }
                            if (visible) culled.push(meshInstance);
                        }
                        // #ifdef PROFILER
                        this._cullTime += pc.now() - cullTime;
                        // #endif

                        // Update skinned shadow casters
                        this.updateGpuSkinMatrices(culled);

                        // Sort shadow casters
                        shadowType = light._shadowType;
                        smode = shadowType + (type!==pc.LIGHTTYPE_DIRECTIONAL? numShadowModes : 0);
                        this.sortDrawCalls(culled, this.depthSortCompare, pc.SORTKEY_DEPTH);
                        this.prepareInstancing(device, culled, pc.SORTKEY_DEPTH, pc.SHADER_SHADOW + smode);


                        if (type === pc.LIGHTTYPE_DIRECTIONAL) {

                            // Positioning directional light frustum II
                            // Fit clipping planes tightly around visible shadow casters

                            // 1. Find AABB of visible shadow casters
                            emptyAabb = true;
                            for(j=0; j<culled.length; j++) {
                                meshInstance = culled[j];
                                drawCallAabb = meshInstance.aabb;
                                if (emptyAabb) {
                                    visibleSceneAabb.copy(drawCallAabb);
                                    emptyAabb = false;
                                } else {
                                    visibleSceneAabb.add(drawCallAabb);
                                }
                            }

                            // 2. Calculate minz/maxz based on this AABB
                            var z = _getZFromAABBSimple( shadowCamView, visibleSceneAabb.getMin(), visibleSceneAabb.getMax(), minx, maxx, miny, maxy );

                            // Always use the scene's aabb's Z value
                            // Otherwise object between the light and the frustum won't cast shadow.
                            maxz = z.max;
                            if (z.min > minz) minz = z.min;

                            // 3. Fix projection
                            shadowCamNode.setPosition(lightNode.getPosition());
                            shadowCamNode.translateLocal(centerx, centery, maxz + directionalShadowEpsilon);
                            shadowCam.setFarClip( maxz - minz );

                            this.setCamera(shadowCam, true);
                        }

                        if (type !== pc.LIGHTTYPE_POINT) {

                            shadowCamView.setTRS(shadowCamNode.getPosition(), shadowCamNode.getRotation(), pc.Vec3.ONE).invert();
                            shadowCamViewProj.mul2(shadowCam.getProjectionMatrix(), shadowCamView);
                            light._shadowMatrix.mul2(scaleShift, shadowCamViewProj);
                        }

                        // Render
                        // set standard shadowmap states
                        device.setBlending(false);
                        device.setColorWrite(true, true, true, true);
                        device.setDepthWrite(true);
                        device.setDepthTest(true);
                        if (device.extDepthTexture) {
                            device.setColorWrite(false, false, false, false);
                        }
                        for (j = 0, numInstances = culled.length; j < numInstances; j++) {
                            meshInstance = culled[j];
                            mesh = meshInstance.mesh;
                            material = meshInstance.material;

                            // set basic material states/parameters
                            this.setBaseConstants(device, material);
                            this.setSkinning(device, meshInstance, material)
                            // set shader
                            shadowShader = meshInstance._shader[pc.SHADER_SHADOW + smode];
                            if (!shadowShader) {
                                shadowShader = this.findShadowShader(meshInstance, type, shadowType);
                                meshInstance._shader[pc.SHADER_SHADOW + smode] = shadowShader;
                                meshInstance._key[pc.SORTKEY_DEPTH] = getDepthKey(meshInstance);
                            }
                            device.setShader(shadowShader);
                            // set buffers
                            style = meshInstance.renderStyle;
                            device.setVertexBuffer(mesh.vertexBuffer, 0);
                            device.setIndexBuffer(mesh.indexBuffer[style]);
                            // draw
                            j += this.drawInstance(device, meshInstance, mesh, style);
                            this._shadowDrawCalls++;
                        }
                    } // end pass

                    if (light._shadowType > pc.SHADOW_DEPTH) {
                        var filterSize = light._vsmBlurSize;
                        if (filterSize > 1) {
                            var origShadowMap = shadowCam.getRenderTarget();
                            var tempRt = getShadowMapFromCache(device, light._shadowResolution, light._shadowType, 1);

                            var blurMode = light.vsmBlurMode;
                            var blurShader = (light._shadowType===pc.SHADOW_VSM8? this.blurPackedVsmShader : this.blurVsmShader)[blurMode][filterSize];
                            if (!blurShader) {
                                this.blurVsmWeights[filterSize] = gaussWeights(filterSize);
                                var chunks = pc.shaderChunks;
                                (light._shadowType===pc.SHADOW_VSM8? this.blurPackedVsmShader : this.blurVsmShader)[blurMode][filterSize] = blurShader =
                                    chunks.createShaderFromCode(this.device, chunks.fullscreenQuadVS,
                                    "#define SAMPLES " + filterSize + "\n" +
                                    (light._shadowType===pc.SHADOW_VSM8? this.blurPackedVsmShaderCode : this.blurVsmShaderCode)
                                    [blurMode], "blurVsm" + blurMode + "" + filterSize + "" + (light._shadowType===pc.SHADOW_VSM8));
                            }

                            blurScissorRect.z = light._shadowResolution - 2;
                            blurScissorRect.w = blurScissorRect.z;

                            // Blur horizontal
                            this.sourceId.setValue(origShadowMap.colorBuffer);
                            pixelOffset.x = 1.0 / light._shadowResolution;
                            pixelOffset.y = 0.0;
                            this.pixelOffsetId.setValue(pixelOffset.data);
                            if (blurMode===pc.BLUR_GAUSSIAN) this.weightId.setValue(this.blurVsmWeights[filterSize]);
                            pc.drawQuadWithShader(device, tempRt, blurShader, null, blurScissorRect);

                            // Blur vertical
                            this.sourceId.setValue(tempRt.colorBuffer);
                            pixelOffset.y = pixelOffset.x;
                            pixelOffset.x = 0.0;
                            this.pixelOffsetId.setValue(pixelOffset.data);
                            pc.drawQuadWithShader(device, origShadowMap, blurShader, null, blurScissorRect);
                        }
                    }
                }
            }
            // #ifdef PROFILER
            this._shadowMapTime = pc.now() - shadowMapStartTime;
            // #endif
        },

        findDepthShader: function(meshInstance) {
            var material = meshInstance.material;
            return this.library.getProgram('depth', {
                                skin: !!meshInstance.skinInstance,
                                opacityMap: !!material.opacityMap,
                                opacityChannel: material.opacityMap? (material.opacityMapChannel || 'r') : null,
                                instancing: meshInstance.instancingData
                            });
        },

        filterDepthMapDrawCalls: function(drawCalls) {
            // #ifdef PROFILER
            var sortTime = pc.now();
            // #endif

            filtered.length = 0;
            var meshInstance;
            for(var i=0; i<drawCalls.length; i++) {
                meshInstance = drawCalls[i];
                if (!meshInstance.command && meshInstance.drawToDepth && meshInstance.material.blendType===pc.BLEND_NONE) {
                    filtered.push(meshInstance);
                }
            }

            // #ifdef PROFILER
            this._sortTime += pc.now() - sortTime;
            // #endif

            return filtered;
        },

        renderDepth: function(device, camera, drawCalls) {
            // #ifdef PROFILER
            var startTime = pc.now();
            // #endif

            if (camera._renderDepthRequests) {
                var i;
                var shadowType;
                var rect = camera._rect;
                var width = Math.floor(rect.width * device.width);
                var height = Math.floor(rect.height * device.height);
                var meshInstance, mesh, material, style, depthShader;

                var vrDisplay = camera.vrDisplay;
                var halfWidth = device.width*0.5;

                drawCalls = this.filterDepthMapDrawCalls(drawCalls);
                var drawCallsCount = drawCalls.length;
                this.sortDrawCalls(drawCalls, this.depthSortCompare, pc.SORTKEY_DEPTH);
                this.prepareInstancing(device, drawCalls, pc.SORTKEY_DEPTH, pc.SHADER_DEPTH);

                // Recreate depth map, if size has changed
                if (camera._depthTarget && (camera._depthTarget.width!==width || camera._depthTarget.height!==height)) {
                    camera._depthTarget.destroy();
                    camera._depthTarget = null;
                }
                // Create depth map if needed
                if (!camera._depthTarget) {
                    var colorBuffer = new pc.Texture(device, {
                        format: pc.PIXELFORMAT_R8_G8_B8_A8,
                        width: width,
                        height: height
                    });
                    colorBuffer.minFilter = pc.FILTER_NEAREST;
                    colorBuffer.magFilter = pc.FILTER_NEAREST;
                    colorBuffer.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
                    colorBuffer.addressV = pc.ADDRESS_CLAMP_TO_EDGE;
                    camera._depthTarget = new pc.RenderTarget(device, colorBuffer, {
                        depth: true,
                        stencil: device.supportsStencil
                    });
                }

                // Set depth RT
                var oldTarget = camera.getRenderTarget();
                camera.setRenderTarget(camera._depthTarget);
                this.setCamera(camera);

                // Render
                // set standard depth states
                device.setBlending(false);
                device.setColorWrite(true, true, true, true);
                device.setDepthWrite(true);
                device.setDepthTest(true);
                for (i = 0; i < drawCallsCount; i++) {
                    meshInstance = drawCalls[i];
                    mesh = meshInstance.mesh;
                    material = meshInstance.material;

                    // set basic material states/parameters
                    this.setBaseConstants(device, material);
                    this.setSkinning(device, meshInstance, material)
                    // set shader
                    depthShader = meshInstance._shader[pc.SHADER_DEPTH];
                    if (!depthShader) {
                        depthShader = this.findDepthShader(meshInstance);
                        meshInstance._shader[pc.SHADER_DEPTH] = depthShader;
                        meshInstance._key[pc.SORTKEY_DEPTH] = getDepthKey(meshInstance);
                    }
                    device.setShader(depthShader);
                    // set buffers
                    style = meshInstance.renderStyle;
                    device.setVertexBuffer(mesh.vertexBuffer, 0);
                    device.setIndexBuffer(mesh.indexBuffer[style]);

                    // draw
                    if (vrDisplay && vrDisplay.presenting) {
                        // Left
                        device.setViewport(0, 0, halfWidth, device.height);
                        this.viewProjId.setValue(viewProjMatL.data);
                        this.viewPosId.setValue(viewPosL.data);
                        i += this.drawInstance(device, meshInstance, mesh, style, true);
                        this._forwardDrawCalls++;

                        // Right
                        device.setViewport(halfWidth, 0, halfWidth, device.height);
                        this.viewProjId.setValue(viewProjMatR.data);
                        this.viewPosId.setValue(viewPosR.data);
                        i += this.drawInstance2(device, meshInstance, mesh, style);
                        this._forwardDrawCalls++;
                    } else {
                        i += this.drawInstance(device, meshInstance, mesh, style);
                        this._depthDrawCalls++;
                    }
                }

                // Set old rt
                camera.setRenderTarget(oldTarget);
            } else {
                if (camera._depthTarget) {
                    camera._depthTarget.destroy();
                    camera._depthTarget = null;
                }
            }

            // #ifdef PROFILER
            this._depthMapTime = pc.now() - startTime;
            // #endif
        },

        renderForward: function(device, camera, drawCalls, scene) {
            var drawCallsCount = drawCalls.length;
            var vrDisplay = camera.vrDisplay;

            // #ifdef PROFILER
            var forwardStartTime = pc.now();
            // #endif

            this.sortDrawCalls(drawCalls, this.frontToBack? this.sortCompare : this.sortCompareMesh, pc.SORTKEY_FORWARD);
            this.prepareInstancing(device, drawCalls, pc.SORTKEY_FORWARD, pc.SHADER_FORWARD);

            var i, drawCall, mesh, material, objDefs, lightMask, style, usedDirLights;
            var prevMeshInstance = null, prevMaterial = null, prevObjDefs, prevLightMask, prevStatic;
            var paramName, parameter, parameters;
            var stencilFront, stencilBack;

            // Set up the camera
            this.setCamera(camera);

            // Set up ambient/exposure
            this.dispatchGlobalLights(scene);

            // Set up the fog
            if (scene.fog !== pc.FOG_NONE) {
                this.fogColor[0] = scene.fogColor.data[0];
                this.fogColor[1] = scene.fogColor.data[1];
                this.fogColor[2] = scene.fogColor.data[2];
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

            // Set up screen size
            this._screenSize.x = device.width;
            this._screenSize.y = device.height;
            this._screenSize.z = 1.0 / device.width;
            this._screenSize.w = 1.0 / device.height;
            this.screenSizeId.setValue(this._screenSize.data);
            var halfWidth = device.width*0.5;

            // Set up depth map
            if (camera._depthTarget) this.depthMapId.setValue(camera._depthTarget.colorBuffer);

            // Render the scene
            for (i = 0; i < drawCallsCount; i++) {
                drawCall = drawCalls[i];
                if (drawCall.command) {
                    // We have a command
                    drawCall.command();
                } else {
                    // We have a mesh instance
                    mesh = drawCall.mesh;
                    material = drawCall.material;
                    objDefs = drawCall._shaderDefs;
                    lightMask = drawCall.mask;

                    this.setSkinning(device, drawCall, material);

                    if (material && material === prevMaterial && objDefs !== prevObjDefs) {
                        prevMaterial = null; // force change shader if the object uses a different variant of the same material
                    }

                    if (drawCall.isStatic || prevStatic) {
                        prevMaterial = null;
                    }

                    if (material !== prevMaterial) {
                        this._materialSwitches++;
                        if (!drawCall._shader[pc.SHADER_FORWARD] || drawCall._shaderDefs !== objDefs) {
                            if (!drawCall.isStatic) {
                                drawCall._shader[pc.SHADER_FORWARD] = material.variants[objDefs];
                                if (!drawCall._shader[pc.SHADER_FORWARD]) {
                                    material.updateShader(device, scene, objDefs);
                                    drawCall._shader[pc.SHADER_FORWARD] = material.variants[objDefs] = material.shader;
                                }
                            } else {
                                material.updateShader(device, scene, objDefs, drawCall._staticLightList);
                                drawCall._shader[pc.SHADER_FORWARD] = material.shader;
                            }
                            drawCall._shaderDefs = objDefs;
                        }
                        device.setShader(drawCall._shader[pc.SHADER_FORWARD]);

                        // Uniforms I: material
                        parameters = material.parameters;
                        for (paramName in parameters) {
                            parameter = parameters[paramName];
                            if (!parameter.scopeId) {
                                parameter.scopeId = device.scope.resolve(paramName);
                            }
                            parameter.scopeId.setValue(parameter.data);
                        }

                        if (!prevMaterial || lightMask !== prevLightMask) {
                            usedDirLights = this.dispatchDirectLights(scene, lightMask);
                            this.dispatchLocalLights(scene, lightMask, usedDirLights, drawCall._staticLightList);
                        }

                        this.alphaTestId.setValue(material.alphaTest);

                        device.setBlending(material.blend);
                        device.setBlendFunction(material.blendSrc, material.blendDst);
                        device.setBlendEquation(material.blendEquation);
                        device.setColorWrite(material.redWrite, material.greenWrite, material.blueWrite, material.alphaWrite);
                        device.setCullMode(material.cull);
                        device.setDepthWrite(material.depthWrite);
                        device.setDepthTest(material.depthTest);
                        stencilFront = material.stencilFront;
                        stencilBack = material.stencilBack;
                        if (stencilFront || stencilBack) {
                            device.setStencilTest(true);
                            if (stencilFront===stencilBack) {
                                // identical front/back stencil
                                device.setStencilFunc(stencilFront.func, stencilFront.ref, stencilFront.mask);
                                device.setStencilOperation(stencilFront.fail, stencilFront.zfail, stencilFront.zpass);
                            } else {
                                // separate
                                if (stencilFront) {
                                    // set front
                                    device.setStencilFuncFront(stencilFront.func, stencilFront.ref, stencilFront.mask);
                                    device.setStencilOperationFront(stencilFront.fail, stencilFront.zfail, stencilFront.zpass);
                                } else {
                                    // default front
                                    device.setStencilFuncFront(pc.FUNC_ALWAYS, 0, 0xFF);
                                    device.setStencilOperationFront(pc.STENCILOP_KEEP, pc.STENCILOP_KEEP, pc.STENCILOP_KEEP);
                                }
                                if (stencilBack) {
                                    // set back
                                    device.setStencilFuncBack(stencilBack.func, stencilBack.ref, stencilBack.mask);
                                    device.setStencilOperationBack(stencilBack.fail, stencilBack.zfail, stencilBack.zpass);
                                } else {
                                    // default back
                                    device.setStencilFuncBack(pc.FUNC_ALWAYS, 0, 0xFF);
                                    device.setStencilOperationBack(pc.STENCILOP_KEEP, pc.STENCILOP_KEEP, pc.STENCILOP_KEEP);
                                }
                            }
                        } else {
                            device.setStencilTest(false);
                        }
                    }

                    // Uniforms II: meshInstance overrides
                    parameters = drawCall.parameters;
                    for (paramName in parameters) {
                        parameter = parameters[paramName];
                        if (!parameter.scopeId) {
                            parameter.scopeId = device.scope.resolve(paramName);
                        }
                        parameter.scopeId.setValue(parameter.data);
                    }

                    device.setVertexBuffer(mesh.vertexBuffer, 0);
                    style = drawCall.renderStyle;
                    device.setIndexBuffer(mesh.indexBuffer[style]);

                    if (vrDisplay && vrDisplay.presenting) {
                        // Left
                        device.setViewport(0, 0, halfWidth, device.height);
                        this.projId.setValue(projL.data);
                        this.viewInvId.setValue(viewInvL.data);
                        this.viewId.setValue(viewL.data);
                        this.viewId3.setValue(viewMat3L.data);
                        this.viewProjId.setValue(viewProjMatL.data);
                        this.viewPosId.setValue(viewPosL.data);
                        i += this.drawInstance(device, drawCall, mesh, style, true);
                        this._forwardDrawCalls++;

                        // Right
                        device.setViewport(halfWidth, 0, halfWidth, device.height);
                        this.projId.setValue(projR.data);
                        this.viewInvId.setValue(viewInvR.data);
                        this.viewId.setValue(viewR.data);
                        this.viewId3.setValue(viewMat3R.data);
                        this.viewProjId.setValue(viewProjMatR.data);
                        this.viewPosId.setValue(viewPosR.data);
                        i += this.drawInstance2(device, drawCall, mesh, style);
                        this._forwardDrawCalls++;
                    } else {
                        i += this.drawInstance(device, drawCall, mesh, style, true);
                        this._forwardDrawCalls++;
                    }

                    // Unset meshInstance overrides back to material values if next draw call will use the same material
                    if (i<drawCallsCount-1 && drawCalls[i+1].material===material) {
                        for (paramName in parameters) {
                            parameter = material.parameters[paramName];
                            if (parameter) parameter.scopeId.setValue(parameter.data);
                        }
                    }

                    prevMaterial = material;
                    prevMeshInstance = drawCall;
                    prevObjDefs = objDefs;
                    prevLightMask = lightMask;
                    prevStatic = drawCall.isStatic;
                }
            }
            device.setStencilTest(false); // don't leak stencil state

            // #ifdef PROFILER
            this._forwardTime = pc.now() - forwardStartTime;
            // #endif
        },

        sortLights: function(scene) {
            var light;
            var lights = scene._lights;
            scene._globalLights.length = 0;
            scene._localLights[0].length = 0;
            scene._localLights[1].length = 0;
            for (i = 0; i < lights.length; i++) {
                light = lights[i];
                if (light._enabled) {
                    if (light._type === pc.LIGHTTYPE_DIRECTIONAL) {
                        scene._globalLights.push(light);
                    } else {
                        scene._localLights[light._type === pc.LIGHTTYPE_POINT ? 0 : 1].push(light);
                    }
                }
            }
            return lights;
        },

        setupInstancing: function(device) {
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
        },

        prepareStaticMeshes: function (device, scene) {
            // #ifdef PROFILER
            var prepareTime = pc.now();
            var searchTime = 0;
            var subSearchTime = 0;
            var cullTime = 0;
            var subCullTime = 0;
            var readMeshTime = 0;
            var subReadMeshTime = 0;
            var triAabbTime = 0;
            var subTriAabbTime = 0;
            var writeMeshTime = 0;
            var subWriteMeshTime = 0;
            var combineTime = 0;
            var subCombineTime = 0;
            // #endif

            var i, j, k, v, s, index;

            var drawCalls = scene.drawCalls;
            var lights = scene._lights;
            var drawCallsCount = drawCalls.length;
            var drawCall, light;
            var newDrawCalls = [];

            if (!scene._needsStaticPrepare) {
                // reset static drawcalls
                var prevStaticSource;
                for(i=0; i<drawCallsCount; i++) {
                    drawCall = drawCalls[i];
                    if (drawCall._staticSource) {
                        if (drawCall._staticSource!==prevStaticSource) {
                            newDrawCalls.push(drawCall._staticSource);
                            prevStaticSource = drawCall._staticSource;
                        }
                    } else {
                        newDrawCalls.push(drawCall);
                    }
                }
                drawCalls = newDrawCalls;
                drawCallsCount = drawCalls.length;
                newDrawCalls = [];
            }

            var mesh;
            var indices, verts, numTris, elems, vertSize, offsetP, baseIndex;
            var _x, _y, _z;
            var minx, miny, minz, maxx, maxy, maxz;
            var minv, maxv;
            var minVec = new pc.Vec3();
            var maxVec = new pc.Vec3();
            var triAabb = new pc.BoundingBox();
            var localLightBounds = new pc.BoundingBox();
            var invMatrix = new pc.Mat4();
            var triLightComb = [];
            var triLightCombUsed;
            var indexBuffer, vertexBuffer;
            var combIndices, combIbName, combIb;
            var lightTypePass;
            var lightAabb = [];
            var aabb;
            var triBounds = [];
            var staticLights = [];
            var bit;
            for(i=0; i<drawCallsCount; i++) {
                drawCall = drawCalls[i];
                if (!drawCall.isStatic) {
                    newDrawCalls.push(drawCall);
                } else {

                    // #ifdef PROFILER
                    subCullTime = pc.now();
                    // #endif
                    aabb = drawCall.aabb;
                    staticLights.length = 0;
                    for(lightTypePass = pc.LIGHTTYPE_POINT; lightTypePass<=pc.LIGHTTYPE_SPOT; lightTypePass++) {
                        for (j = 0; j < lights.length; j++) {
                            light = lights[j];
                            if (light._type!==lightTypePass) continue;
                            if (light._enabled) {
                                if (light._mask & drawCall.mask) {
                                    if (light.isStatic) {
                                        if (!lightAabb[j]) {
                                            lightAabb[j] = new pc.BoundingBox();
                                            //light.getBoundingBox(lightAabb[j]); // box from sphere seems to give better granularity
                                            light._node.getWorldTransform();
                                            light.getBoundingSphere(tempSphere);
                                            lightAabb[j].center.copy(tempSphere.center);
                                            lightAabb[j].halfExtents.x = tempSphere.radius;
                                            lightAabb[j].halfExtents.y = tempSphere.radius;
                                            lightAabb[j].halfExtents.z = tempSphere.radius;
                                        }
                                        if (!lightAabb[j].intersects(aabb)) continue;
                                        staticLights.push(j);
                                    }
                                }
                            }
                        }
                    }
                    // #ifdef PROFILER
                    cullTime += pc.now() - subCullTime;
                    // #endif

                    if (staticLights.length===0) {
                        newDrawCalls.push(drawCall);
                        continue;
                    }

                    // #ifdef PROFILER
                    subReadMeshTime = pc.now();
                    // #endif
                    mesh = drawCall.mesh;
                    vertexBuffer = mesh.vertexBuffer;
                    indexBuffer = mesh.indexBuffer[drawCall.renderStyle];
                    indices = new Uint16Array(indexBuffer.lock());
                    numTris = mesh.primitive[drawCall.renderStyle].count / 3;
                    baseIndex = mesh.primitive[drawCall.renderStyle].base;
                    elems = vertexBuffer.format.elements;
                    vertSize = vertexBuffer.format.size / 4; // / 4 because float
                    verts = new Float32Array(vertexBuffer.storage);

                    for(k=0; k<elems.length; k++) {
                        if (elems[k].name===pc.SEMANTIC_POSITION) {
                            offsetP = elems[k].offset / 4; // / 4 because float
                        }
                    }
                    // #ifdef PROFILER
                    readMeshTime += pc.now() - subReadMeshTime;
                    // #endif

                    // #ifdef PROFILER
                    subTriAabbTime = pc.now();
                    // #endif

                    triLightComb.length = numTris;
                    for(k=0; k<numTris; k++) {
                        //triLightComb[k] = ""; // uncomment to remove 32 lights limit
                        triLightComb[k] = 0; // comment to remove 32 lights limit
                    }
                    triLightCombUsed = false;

                    triBounds.length = numTris * 6;
                    for(k=0; k<numTris; k++) {
                        minx = Number.MAX_VALUE;
                        miny = Number.MAX_VALUE;
                        minz = Number.MAX_VALUE;
                        maxx = -Number.MAX_VALUE;
                        maxy = -Number.MAX_VALUE;
                        maxz = -Number.MAX_VALUE;
                        for(v=0; v<3; v++) {
                            index = indices[k*3 + v + baseIndex];
                            index = index * vertSize + offsetP;
                            _x = verts[index];
                            _y = verts[index + 1];
                            _z = verts[index + 2];
                            if (_x < minx) minx = _x;
                            if (_y < miny) miny = _y;
                            if (_z < minz) minz = _z;
                            if (_x > maxx) maxx = _x;
                            if (_y > maxy) maxy = _y;
                            if (_z > maxz) maxz = _z;
                        }
                        index = k * 6;
                        triBounds[index] = minx;
                        triBounds[index+1] = miny;
                        triBounds[index+2] = minz;
                        triBounds[index+3] = maxx;
                        triBounds[index+4] = maxy;
                        triBounds[index+5] = maxz;
                    }
                    // #ifdef PROFILER
                    triAabbTime += pc.now() - subTriAabbTime;
                    // #endif

                    // #ifdef PROFILER
                    subSearchTime = pc.now();
                    // #endif
                    for(s=0; s<staticLights.length; s++) {
                        j = staticLights[s];
                        light = lights[j];

                        invMatrix.copy(drawCall.node.worldTransform).invert();
                        localLightBounds.setFromTransformedAabb(lightAabb[j], invMatrix);
                        minv = localLightBounds.getMin().data;
                        maxv = localLightBounds.getMax().data;
                        bit = 1 << s;

                        for(k=0; k<numTris; k++) {
                            index = k * 6;
                            if ((triBounds[index] <= maxv[0]) && (triBounds[index+3] >= minv[0]) &&
                                (triBounds[index+1] <= maxv[1]) && (triBounds[index+4] >= minv[1]) &&
                                (triBounds[index+2] <= maxv[2]) && (triBounds[index+5] >= minv[2])) {

                                //triLightComb[k] += j + "_";  // uncomment to remove 32 lights limit
                                triLightComb[k] |= bit; // comment to remove 32 lights limit
                                triLightCombUsed = true;
                            }
                        }
                    }
                    // #ifdef PROFILER
                    searchTime += pc.now() - subSearchTime;
                    // #endif

                    if (triLightCombUsed) {//.used) {

                        // #ifdef PROFILER
                        subCombineTime = pc.now();
                        // #endif

                        combIndices = {};
                        for(k=0; k<numTris; k++) {
                            j = k*3 + baseIndex; // can go beyond 0xFFFF if base was non-zero?
                            combIbName = triLightComb[k];
                            if (!combIndices[combIbName]) combIndices[combIbName] = [];
                            combIb = combIndices[combIbName];
                            combIb.push(indices[j]);
                            combIb.push(indices[j+1]);
                            combIb.push(indices[j+2]);
                        }

                        // #ifdef PROFILER
                        combineTime += pc.now() - subCombineTime;
                        // #endif

                        // #ifdef PROFILER
                        subWriteMeshTime = pc.now();
                        // #endif

                        for(combIbName in combIndices) {
                            combIb = combIndices[combIbName];
                            var ib = new pc.IndexBuffer(device, indexBuffer.format, combIb.length, indexBuffer.usage);
                            var ib2 = new Uint16Array(ib.lock());
                            ib2.set(combIb);
                            ib.unlock();

                            minx = Number.MAX_VALUE;
                            miny = Number.MAX_VALUE;
                            minz = Number.MAX_VALUE;
                            maxx = -Number.MAX_VALUE;
                            maxy = -Number.MAX_VALUE;
                            maxz = -Number.MAX_VALUE;
                            for(k=0; k<combIb.length; k++) {
                                index = combIb[k];
                                _x = verts[index * vertSize + offsetP];
                                _y = verts[index * vertSize + offsetP + 1];
                                _z = verts[index * vertSize + offsetP + 2];
                                if (_x < minx) minx = _x;
                                if (_y < miny) miny = _y;
                                if (_z < minz) minz = _z;
                                if (_x > maxx) maxx = _x;
                                if (_y > maxy) maxy = _y;
                                if (_z > maxz) maxz = _z;
                            }
                            minVec.set(minx, miny, minz);
                            maxVec.set(maxx, maxy, maxz);
                            var chunkAabb = new pc.BoundingBox();
                            chunkAabb.setMinMax(minVec, maxVec);

                            var mesh2 = new pc.Mesh();
                            mesh2.vertexBuffer = vertexBuffer;
                            mesh2.indexBuffer[0] = ib;
                            mesh2.primitive[0].type = pc.PRIMITIVE_TRIANGLES;
                            mesh2.primitive[0].base = 0;
                            mesh2.primitive[0].count = combIb.length;
                            mesh2.primitive[0].indexed = true;
                            mesh2.aabb = chunkAabb;

                            var instance = new pc.MeshInstance(drawCall.node, mesh2, drawCall.material);
                            instance.isStatic = drawCall.isStatic;
                            instance.visible = drawCall.visible;
                            instance.layer = drawCall.layer;
                            instance.castShadow = drawCall.castShadow;
                            instance._receiveShadow = drawCall._receiveShadow;
                            instance.drawToDepth = drawCall.drawToDepth;
                            instance.cull = drawCall.cull;
                            instance.pick = drawCall.pick;
                            instance.mask = drawCall.mask;
                            instance.parameters = drawCall.parameters;
                            instance._shaderDefs = drawCall._shaderDefs;
                            instance._staticSource = drawCall;

                            instance._staticLightList = [];

                            // uncomment to remove 32 lights limit
                            /*var lnames = combIbName.split("_");
                            lnames.length = lnames.length - 1;
                            for(k=0; k<lnames.length; k++) {
                                instance._staticLightList[k] = lights[ parseInt(lnames[k]) ];
                            }*/

                            // comment to remove 32 lights limit
                            for(k=0; k<staticLights.length; k++) {
                                bit = 1 << k;
                                if (combIbName & bit) {
                                    instance._staticLightList.push(lights[ staticLights[k] ]);
                                }
                            }

                            instance._staticLightList.sort(this.lightCompare);

                            newDrawCalls.push(instance);
                        }

                        // #ifdef PROFILER
                        writeMeshTime += pc.now() - subWriteMeshTime;
                        // #endif
                    } else {
                        newDrawCalls.push(drawCall);
                    }
                }
            }
            scene.drawCalls = newDrawCalls;
            // #ifdef PROFILER
            scene._stats.lastStaticPrepareFullTime = pc.now() - prepareTime;
            scene._stats.lastStaticPrepareSearchTime = searchTime;
            scene._stats.lastStaticPrepareWriteTime = writeMeshTime;
            scene._stats.lastStaticPrepareTriAabbTime = triAabbTime;
            scene._stats.lastStaticPrepareCombineTime = combineTime;
            // #endif
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

            // Store active camera
            scene._activeCamera = camera;

            // Update shaders if needed
            if (scene.updateShaders) {
                scene.updateShadersFunc(device);
                scene.updateShaders = false;
            }

            if (scene._needsStaticPrepare) {
                this.prepareStaticMeshes(device, scene);
                scene._needsStaticPrepare = false;
            }

            // Disable gamma/tonemap, if rendering to HDR target
            var target = camera.getRenderTarget();
            var isHdr = false;
            var oldGamma = scene._gammaCorrection;
            var oldTonemap = scene._toneMapping;
            var oldExposure = scene.exposure;
            if (target) {
                var format = target.colorBuffer.format;
                if (format===pc.PIXELFORMAT_RGB16F || format===pc.PIXELFORMAT_RGB32F) {
                    isHdr = true;
                    scene._gammaCorrection = pc.GAMMA_NONE;
                    scene._toneMapping = pc.TONEMAP_LINEAR;
                    scene.exposure = 1;
                }
            }

            var i;

            // Scene data
            var drawCalls = scene.drawCalls;
            var shadowCasters = scene.shadowCasters;

            // Sort lights by type
            // TODO: preprocess instead of per-frame // or maybe just remove it
            var lights = this.sortLights(scene);

            // Camera data
            var camPos = camera._node.getPosition().data;
            var camFwd = camera._node.forward.data;

            // Set up instancing if needed
            this.setupInstancing(device);

            // Update camera
            this.updateCameraFrustum(camera);

            // Update all skin matrices to properly cull skinned objects (but don't update rendering data yet)
            this.updateCpuSkinMatrices(drawCalls);


            // --- Render all shadowmaps ---
            this.renderShadows(device, camera, shadowCasters, lights);


            // Prepare visible scene draw calls
            drawCalls = this.cull(camera, drawCalls);
            this.calculateSortDistances(drawCalls, camPos, camFwd, this.frontToBack);
            this.updateGpuSkinMatrices(drawCalls);

            // Add immediate draw calls on top
            for(i=0; i<scene.immediateDrawCalls.length; i++) {
                drawCalls.push(scene.immediateDrawCalls[i]);
            }
            this._immediateRendered += scene.immediateDrawCalls.length;

            // --- Render a depth target if the camera has one assigned ---
            this.renderDepth(device, camera, drawCalls);


            // --- Render frame ---
            this.renderForward(device, camera, drawCalls, scene);


            // Revert temp frame stuff
            device.setColorWrite(true, true, true, true);

            if (scene.immediateDrawCalls.length > 0) {
                scene.immediateDrawCalls = [];
            }

            if (isHdr) {
                scene._gammaCorrection = oldGamma;
                scene._toneMapping = oldTonemap;
                scene.exposure = oldExposure;
            }

            this._camerasRendered++;
        }
    });

    return {
        ForwardRenderer: ForwardRenderer,
        gaussWeights: gaussWeights
    };
}());
