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

    var rgbaDepthClearOptions = {
        color: [ 254.0 / 255, 254.0 / 255, 254.0 / 255, 254.0 / 255 ],
        depth: 1.0,
        flags: pc.CLEARFLAG_COLOR | pc.CLEARFLAG_DEPTH
    };

    var opChanId = {r:1, g:2, b:3, a:4};

    var pointLightRotations = [
        new pc.Quat().setFromEulerAngles(0, 90, 180),
        new pc.Quat().setFromEulerAngles(0, -90, 180),
        new pc.Quat().setFromEulerAngles(90, 0, 0),
        new pc.Quat().setFromEulerAngles(-90, 0, 0),
        new pc.Quat().setFromEulerAngles(0, 180, 180),
        new pc.Quat().setFromEulerAngles(0, 0, 180)
    ];

    var numShadowModes = 5;
    var shadowMapCache = [{}, {}, {}, {}, {}]; // must be a size of numShadowModes

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
    var projMat;

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

    var shadowMapCubeCache = {};
    var maxBlurSize = 25;

    var keyA, keyB;

    // The 8 points of the camera frustum transformed to light space
    var frustumPoints = [];
    for (var i = 0; i < 8; i++) {
        frustumPoints.push(new pc.Vec3());
    }

    function _getFrustumPoints(camera, farClip, points) {
        var nearClip = camera._nearClip;
        var fov = camera._fov * Math.PI / 180.0;
        var aspect = camera._aspect;
        var projection = camera._projection;

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
        var obj = function(idx) { return data[idx]; };
        obj.size = 0;
        obj.push = function(v) {
            data[this.size] = v;
            ++this.size;
        };
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

        // Grouping vertices according to the position related to the face
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
    }

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
    function getShadowFormat(device, shadowType) {
        if (shadowType === pc.SHADOW_VSM32) {
            return pc.PIXELFORMAT_RGBA32F;
        } else if (shadowType === pc.SHADOW_VSM16) {
            return pc.PIXELFORMAT_RGBA16F;
        } else if (shadowType === pc.SHADOW_PCF5) {
            return pc.PIXELFORMAT_DEPTH;
        } else if (shadowType === pc.SHADOW_PCF3 && device.webgl2) {
            return pc.PIXELFORMAT_DEPTH;
        }
        return pc.PIXELFORMAT_R8_G8_B8_A8;
    }

    function getShadowFiltering(device, shadowType) {
        if (shadowType === pc.SHADOW_PCF3 && !device.webgl2) {
            return pc.FILTER_NEAREST;
        } else if (shadowType === pc.SHADOW_VSM32) {
            return device.extTextureFloatLinear ? pc.FILTER_LINEAR : pc.FILTER_NEAREST;
        } else if (shadowType === pc.SHADOW_VSM16) {
            return device.extTextureHalfFloatLinear ? pc.FILTER_LINEAR : pc.FILTER_NEAREST;
        }
        return pc.FILTER_LINEAR;
    }

    function createShadowMap(device, width, height, shadowType) {
        var format = getShadowFormat(device, shadowType);
        var filter = getShadowFiltering(device, shadowType);

        var shadowMap = new pc.Texture(device, {
            // #ifdef PROFILER
            profilerHint: pc.TEXHINT_SHADOWMAP,
            // #endif
            format: format,
            width: width,
            height: height,
            mipmaps: false,
            minFilter: filter,
            magFilter: filter,
            addressU: pc.ADDRESS_CLAMP_TO_EDGE,
            addressV: pc.ADDRESS_CLAMP_TO_EDGE
        });

        if (shadowType === pc.SHADOW_PCF5 || (shadowType === pc.SHADOW_PCF3 && device.webgl2)) {
            shadowMap.compareOnRead = true;
            shadowMap.compareFunc = pc.FUNC_LESS;
            // depthbuffer only
            return new pc.RenderTarget({
                depthBuffer: shadowMap
            });
        }

        // encoded rgba depth
        return new pc.RenderTarget({
            colorBuffer: shadowMap,
            depth: true
        });
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
            mipmaps: false,
            minFilter: pc.FILTER_NEAREST,
            magFilter: pc.FILTER_NEAREST,
            addressU: pc.ADDRESS_CLAMP_TO_EDGE,
            addressV: pc.ADDRESS_CLAMP_TO_EDGE
        });

        var targets = [ ];
        var target;
        for (var i = 0; i < 6; i++) {
            target = new pc.RenderTarget({
                colorBuffer: cubemap,
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

    function createShadowCamera(device, shadowType, type) {
        // We don't need to clear the color buffer if we're rendering a depth map
        var flags = pc.CLEARFLAG_DEPTH;
        var hwPcf = shadowType === pc.SHADOW_PCF5 || (shadowType === pc.SHADOW_PCF3 && device.webgl2);
        if (type === pc.LIGHTTYPE_POINT) hwPcf = false;
        if (!hwPcf) flags |= pc.CLEARFLAG_COLOR;
        var shadowCam = new pc.Camera();

        if (shadowType >= pc.SHADOW_VSM8 && shadowType <= pc.SHADOW_VSM32) {
            shadowCam.clearColor[0] = 0;
            shadowCam.clearColor[1] = 0;
            shadowCam.clearColor[2] = 0;
            shadowCam.clearColor[3] = 0;
        } else {
            shadowCam.clearColor[0] = 1;
            shadowCam.clearColor[1] = 1;
            shadowCam.clearColor[2] = 1;
            shadowCam.clearColor[3] = 1;
        }

        shadowCam.clearDepth = 1;
        shadowCam.clearFlags = flags;
        shadowCam.clearStencil = null;

        shadowCam._node = new pc.GraphNode();

        return shadowCam;
    }

    function getShadowMapFromCache(device, res, mode, layer) {
        if (!layer) layer = 0;
        var id = layer * 10000 + res;
        var shadowBuffer = shadowMapCache[mode][id];
        if (!shadowBuffer) {
            shadowBuffer = createShadowMap(device, res, res, mode? mode : pc.SHADOW_PCF3);
            shadowMapCache[mode][id] = shadowBuffer;
        }
        return shadowBuffer;
    }

    function createShadowBuffer(device, light) {
        var shadowBuffer;
        if (light._type === pc.LIGHTTYPE_POINT) {
            if (light._shadowType > pc.SHADOW_PCF3) light._shadowType = pc.SHADOW_PCF3; // no VSM or HW PCF point lights yet
            if (light._cacheShadowMap) {
                shadowBuffer = shadowMapCubeCache[light._shadowResolution];
                if (!shadowBuffer) {
                    shadowBuffer = createShadowCubeMap(device, light._shadowResolution);
                    shadowMapCubeCache[light._shadowResolution] = shadowBuffer;
                }
            } else {
                shadowBuffer = createShadowCubeMap(device, light._shadowResolution);
            }
            light._shadowCamera.renderTarget = shadowBuffer[0];
            light._shadowCubeMap = shadowBuffer;

        } else {

            if (light._cacheShadowMap) {
                shadowBuffer = getShadowMapFromCache(device, light._shadowResolution, light._shadowType);
            } else {
                shadowBuffer = createShadowMap(device, light._shadowResolution, light._shadowResolution, light._shadowType);
            }

            light._shadowCamera.renderTarget = shadowBuffer;
        }
        light._isCachedShadowMap = light._cacheShadowMap;
    }

    function getDepthKey(meshInstance) {
        var material = meshInstance.material;
        var x = meshInstance.skinInstance ? 10 : 0;
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
        this._morphTime = 0;
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

        this.polygonOffsetId = scope.resolve("polygonOffset");
        this.polygonOffset = new Float32Array(2);

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

            if (keyA === keyB && drawCallA.mesh && drawCallB.mesh) {
                return drawCallB.mesh.id - drawCallA.mesh.id;
            }

            return keyB - keyA;
        },

        depthSortCompare: function(drawCallA, drawCallB) {
            keyA = drawCallA._key[pc.SORTKEY_DEPTH];
            keyB = drawCallB._key[pc.SORTKEY_DEPTH];

            if (keyA === keyB && drawCallA.mesh && drawCallB.mesh) {
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

            return camera.frustum.containsSphere(tempSphere);
        },

        getShadowCamera: function(device, light) {
            var shadowCam = light._shadowCamera;
            var shadowBuffer;

            if (shadowCam === null) {
                shadowCam = light._shadowCamera = createShadowCamera(device, light._shadowType, light._type);
                createShadowBuffer(device, light);
            } else {
                shadowBuffer = shadowCam.renderTarget;
                if ((shadowBuffer.width !== light._shadowResolution) || (shadowBuffer.height !== light._shadowResolution)) {
                    createShadowBuffer(device, light);
                }
            }

            return shadowCam;
        },

        updateCameraFrustum: function(camera) {
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
                camera.frustum.update(projMat, viewMat);
                return;
            }

            projMat = camera.getProjectionMatrix();
            if (camera.overrideCalculateProjection) camera.calculateProjection(projMat, pc.VIEW_CENTER);

            if (camera.overrideCalculateTransform) {
                camera.calculateTransform(viewInvMat, pc.VIEW_CENTER);
            } else {
                var pos = camera._node.getPosition();
                var rot = camera._node.getRotation();
                viewInvMat.setTRS(pos, rot, pc.Vec3.ONE);
                this.viewInvId.setValue(viewInvMat.data);
            }
            viewMat.copy(viewInvMat).invert();

            camera.frustum.update(projMat, viewMat);
        },

        // make sure colorWrite is set to true to all channels, if you want to fully clear the target
        setCamera: function (camera, clear, cullBorder) {
            var vrDisplay = camera.vrDisplay;
            if (!vrDisplay || !vrDisplay.presenting) {
                // Projection Matrix
                projMat = camera.getProjectionMatrix();
                if (camera.overrideCalculateProjection) camera.calculateProjection(projMat, pc.VIEW_CENTER);
                this.projId.setValue(projMat.data);

                // ViewInverse Matrix
                if (camera.overrideCalculateTransform) {
                    camera.calculateTransform(viewInvMat, pc.VIEW_CENTER);
                } else {
                    var pos = camera._node.getPosition();
                    var rot = camera._node.getRotation();
                    viewInvMat.setTRS(pos, rot, pc.Vec3.ONE);
                }
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

                camera.frustum.update(projMat, viewMat);
            } else {
                // Projection LR
                projL = vrDisplay.leftProj;
                projR = vrDisplay.rightProj;
                projMat = vrDisplay.combinedProj;
                if (camera.overrideCalculateProjection) {
                    camera.calculateProjection(projL, pc.VIEW_LEFT);
                    camera.calculateProjection(projR, pc.VIEW_RIGHT);
                    camera.calculateProjection(projMat, pc.VIEW_CENTER);
                }

                if (camera.overrideCalculateTransform) {
                    camera.calculateTransform(viewInvL, pc.VIEW_LEFT);
                    camera.calculateTransform(viewInvR, pc.VIEW_RIGHT);
                    camera.calculateTransform(viewInvMat, pc.VIEW_CENTER);
                    viewL.copy(viewInvL).invert();
                    viewR.copy(viewInvR).invert();
                    viewMat.copy(viewInvMat).invert();
                } else {
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
                }

                // View 3x3 LR
                mat3FromMat4(viewMat3L, viewL);
                mat3FromMat4(viewMat3R, viewR);

                // ViewProjection LR
                viewProjMatL.mul2(projL, viewL);
                viewProjMatR.mul2(projR, viewR);

                // View Position LR
                viewPosL.data[0] = viewInvL.data[12];
                viewPosL.data[1] = viewInvL.data[13];
                viewPosL.data[2] = viewInvL.data[14];

                viewPosR.data[0] = viewInvR.data[12];
                viewPosR.data[1] = viewInvR.data[13];
                viewPosR.data[2] = viewInvR.data[14];

                camera.frustum.update(projMat, viewMat);
            }

            // Near and far clip values
            this.nearClipId.setValue(camera._nearClip);
            this.farClipId.setValue(camera._farClip);

            var device = this.device;
            var target = camera.renderTarget;
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
            if (clear) device.clear(camera._clearOptions); // clear full RT

            rect = camera._scissorRect;
            x = Math.floor(rect.x * pixelWidth);
            y = Math.floor(rect.y * pixelHeight);
            w = Math.floor(rect.width * pixelWidth);
            h = Math.floor(rect.height * pixelHeight);
            device.setScissor(x, y, w, h);

            if (cullBorder) device.setScissor(1, 1, pixelWidth-2, pixelHeight-2); // optionally clip borders when rendering
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

        dispatchDirectLights: function (dirs, scene, mask) {
            var numDirs = dirs.length;
            var i;
            var directional, wtm;
            var cnt = 0;
            this.mainLight = -1;

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
                    var shadowMap = directional._isPcf && this.device.webgl2 ?
                            directional._shadowCamera.renderTarget.depthBuffer :
                            directional._shadowCamera.renderTarget.colorBuffer;

                    // make bias dependent on far plane because it's not constant for direct light
                    var bias;
                    if (directional._isVsm) {
                        bias = -0.00001*20;
                    } else {
                        bias = (directional.shadowBias / directional._shadowCamera._farClip) * 100;
                        if (!this.device.webgl2 && this.device.extStandardDerivatives) bias *= -100;
                    }
                    var normalBias = directional._isVsm ?
                        directional.vsmBias / (directional._shadowCamera._farClip / 7.0)
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
                var shadowMap = point._shadowCamera.renderTarget.colorBuffer;
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
                if (spot._isVsm) {
                    bias = -0.00001*20;
                } else {
                    bias = spot.shadowBias * 20; // approx remap from old bias values
                    if (!this.device.webgl2 && this.device.extStandardDerivatives) bias *= -100;
                }
                var normalBias = spot._isVsm ?
                    spot.vsmBias / (spot.attenuationEnd / 7.0)
                    : spot._normalOffsetBias;

                var shadowMap = spot._isPcf && this.device.webgl2 ?
                            spot._shadowCamera.renderTarget.depthBuffer :
                            spot._shadowCamera.renderTarget.colorBuffer;
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

                    shadowCam.projection = pc.PROJECTION_PERSPECTIVE;
                    shadowCam.aspectRatio = 1;
                    shadowCam.fov = spot._outerConeAngle * 2;

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

        dispatchLocalLights: function (sortedLights, scene, mask, usedDirLights, staticLightList) {
            var i;
            var point, spot;

            var pnts = sortedLights[pc.LIGHTTYPE_POINT];
            var spts = sortedLights[pc.LIGHTTYPE_SPOT];

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
                while(point && point._type === pc.LIGHTTYPE_POINT) {
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
                while(spot && spot._type === pc.LIGHTTYPE_SPOT) {
                    this.dispatchSpotLight(scene, scope, spot, cnt);
                    cnt++;
                    staticId++;
                    spot = staticLightList[staticId];
                }
            }
        },

        cull: function(camera, drawCalls, culledList) {
            // #ifdef PROFILER
            var cullTime = pc.now();
            // #endif

            var culledLength = 0;
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

                    culledList[culledLength] = drawCall;
                    culledLength++;
                    drawCall._visibleThisFrame = true;
                }
                return culledLength;
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

                    if (visible) {
                        culledList[culledLength] = drawCall;
                        culledLength++;
                        drawCall._visibleThisFrame = true;
                    }
                } else {
                    culledList[culledLength] = drawCall;
                    culledLength++;
                    drawCall._visibleThisFrame = true;
                }
            }

            // #ifdef PROFILER
            this._cullTime += pc.now() - cullTime;
            // #endif

            return culledLength;
        },

        cullLights: function(camera, lights) {
            var i, light, type;
            for (i = 0; i < lights.length; i++) {
                light = lights[i];
                type = light._type;
                if (light.castShadows && light._enabled && light.shadowUpdateMode!==pc.SHADOWUPDATE_NONE) {
                    if (type !== pc.LIGHTTYPE_DIRECTIONAL) {
                        light.getBoundingSphere(tempSphere);
                        if (!camera.frustum.containsSphere(tempSphere)) continue;
                        light._visibleThisFrame = true;
                    }
                }
            }
        },

        updateCpuSkinMatrices: function(drawCalls) {
            var drawCallsCount = drawCalls.length;
            if (drawCallsCount === 0) return;

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
                if (!drawCalls[i]._visibleThisFrame) continue;
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

        updateMorphedBounds: function(drawCalls) {
            // #ifdef PROFILER
            var morphTime = pc.now();
            // #endif

            var i, morph;
            var drawCallsCount = drawCalls.length;
            for (i = 0; i < drawCallsCount; i++) {
                morph = drawCalls[i].morphInstance;
                if (morph && morph._dirty) {
                    morph.updateBounds(drawCalls[i].mesh);
                }
            }
            // #ifdef PROFILER
            this._morphTime += pc.now() - morphTime;
            // #endif
        },

        updateMorphing: function(drawCalls) {
            // #ifdef PROFILER
            var morphTime = pc.now();
            // #endif

            var i, morph;
            var drawCallsCount = drawCalls.length;
            for (i = 0; i < drawCallsCount; i++) {
                if (!drawCalls[i]._visibleThisFrame) continue;
                morph = drawCalls[i].morphInstance;
                if (morph && morph._dirty) {
                    morph.update(drawCalls[i].mesh);
                    morph._dirty = false;
                }
            }
            // #ifdef PROFILER
            this._morphTime += pc.now() - morphTime;
            // #endif
        },

        sortDrawCalls: function(drawCalls, sortFunc, keyType) {
            var drawCallsCount = drawCalls.length;
            if (drawCallsCount === 0) return;

            // #ifdef PROFILER
            var sortTime = pc.now();
            // #endif

            // Sort meshes into the correct render order
            drawCalls.sort(sortFunc);

            // #ifdef PROFILER
            this._sortTime += pc.now() - sortTime;
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
                if (instancingData._buffer === pc._autoInstanceBuffer) {
                    meshInstance.instancingData = null;
                    return instancingData.count - 1;
                }
            } else {
                modelMatrix = meshInstance.node.worldTransform;
                this.modelMatrixId.setValue(modelMatrix.data);

                if (normal) {
                    normalMatrix = meshInstance.node.normalMatrix;
                    if (meshInstance.node._dirtyNormal) {
                        modelMatrix.invertTo3x3(normalMatrix);
                        normalMatrix.transpose();
                        meshInstance.node._dirtyNormal = false;
                    }
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
                if (instancingData._buffer === pc._autoInstanceBuffer) {
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
                                shadowType: shadowType,
                                instancing: meshInstance.instancingData,
                                type: type
                            });
        },

        renderShadows: function(lights, cameraPass) {
            var device = this.device;
            // #ifdef PROFILER
            var shadowMapStartTime = pc.now();
            // #endif
            var i, j, light, shadowShader, type, shadowCam, shadowCamNode, lightNode, pass, passes, frustumSize, shadowType, smode;
            var unitPerTexel, delta, p;
            var minx, miny, minz, maxx, maxy, maxz, centerx, centery;
            var opChan;
            var visible, cullTime, numInstances;
            var meshInstance, mesh, material;
            var style;
            var emptyAabb;
            var drawCallAabb;
            var settings;
            var culledList, culledListLength;

            for (i = 0; i < lights.length; i++) {
                light = lights[i];
                type = light._type;

                if (light.castShadows && light._enabled && light.shadowUpdateMode!==pc.SHADOWUPDATE_NONE && light._visibleThisFrame) {

                    shadowCam = this.getShadowCamera(device, light);
                    shadowCamNode = shadowCam._node;
                    lightNode = light._node;
                    pass = 0;
                    passes = 1;

                    if (type === pc.LIGHTTYPE_DIRECTIONAL) {
                        settings = light._culledCameraSettings[pass];
                        shadowCamNode.setPosition(settings.x, settings.y, settings.z);
                        shadowCam.orthoHeight = settings.orthoHeight;
                        shadowCam.farClip = settings.farClip;
                        pass = light._culledPasses;
                        if (cameraPass !== undefined && pass !== cameraPass) continue; // filter by camera

                    } else if (type === pc.LIGHTTYPE_SPOT) {
                        this.viewPosId.setValue(shadowCamNode.getPosition().data);
                        this.shadowMapLightRadiusId.setValue(light.attenuationEnd);

                    } else if (type === pc.LIGHTTYPE_POINT) {
                        this.viewPosId.setValue(shadowCamNode.getPosition().data);
                        this.shadowMapLightRadiusId.setValue(light.attenuationEnd);
                        passes = 6;

                    }

                    if (type !== pc.LIGHTTYPE_POINT) {
                        shadowCamView.setTRS(shadowCamNode.getPosition(), shadowCamNode.getRotation(), pc.Vec3.ONE).invert();
                        shadowCamViewProj.mul2(shadowCam.getProjectionMatrix(), shadowCamView);
                        light._shadowMatrix.mul2(scaleShift, shadowCamViewProj);
                    }

                    if (device.webgl2) {
                        if (type === pc.LIGHTTYPE_POINT) {
                            device.setDepthBias(false);
                        } else {
                            device.setDepthBias(true);
                            device.setDepthBiasValues(light.shadowBias * -1000.0, light.shadowBias * -1000.0);
                        }
                    } else if (device.extStandardDerivatives) {
                        if (type === pc.LIGHTTYPE_POINT) {
                            this.polygonOffset[0] = 0;
                            this.polygonOffset[1] = 0;
                            this.polygonOffsetId.setValue(this.polygonOffset);
                        } else {
                            this.polygonOffset[0] = light.shadowBias * -1000.0;
                            this.polygonOffset[1] = light.shadowBias * -1000.0;
                            this.polygonOffsetId.setValue(this.polygonOffset);
                        }
                    }

                    if (light.shadowUpdateMode === pc.SHADOWUPDATE_THISFRAME) light.shadowUpdateMode = pc.SHADOWUPDATE_NONE;

                    this._shadowMapUpdates += passes;

                    // Set standard shadowmap states
                    device.setBlending(false);
                    device.setDepthWrite(true);
                    device.setDepthTest(true);
                    if (light._isPcf && device.webgl2 && type !== pc.LIGHTTYPE_POINT) {
                        device.setColorWrite(false, false, false, false);
                    } else {
                        device.setColorWrite(true, true, true, true);
                    }

                    if (pass) {
                        passes = pass + 1; // predefined single pass
                    } else {
                        pass = 0; // point light passes
                    }

                    while(pass < passes) {
                        if (type === pc.LIGHTTYPE_POINT) {
                            shadowCamNode.setRotation(pointLightRotations[pass]);
                            shadowCam.renderTarget = light._shadowCubeMap[pass];
                        }

                        this.setCamera(shadowCam, true, type !== pc.LIGHTTYPE_POINT);

                        culledList = light._culledList[pass];
                        culledListLength = light._culledLength[pass];

                        // Sort shadow casters
                        shadowType = light._shadowType;
                        smode = shadowType + type * numShadowModes;
                        pc.partialSort(culledList, 0, culledListLength, this.depthSortCompare);

                        // Render
                        for (j = 0, numInstances = culledListLength; j < numInstances; j++) {
                            meshInstance = culledList[j];
                            mesh = meshInstance.mesh;
                            material = meshInstance.material;

                            // set basic material states/parameters
                            this.setBaseConstants(device, material);
                            this.setSkinning(device, meshInstance, material);
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
                            device.setVertexBuffer((meshInstance.morphInstance && meshInstance.morphInstance._vertexBuffer) ?
                                meshInstance.morphInstance._vertexBuffer : mesh.vertexBuffer, 0);
                            device.setIndexBuffer(mesh.indexBuffer[style]);
                            // draw
                            j += this.drawInstance(device, meshInstance, mesh, style);
                            this._shadowDrawCalls++;
                        }
                        pass++;
                        if (type === pc.LIGHTTYPE_DIRECTIONAL) light._culledPasses++;
                    } // end pass

                    if (light._isVsm) {
                        var filterSize = light._vsmBlurSize;
                        if (filterSize > 1) {
                            var origShadowMap = shadowCam.renderTarget;
                            var tempRt = getShadowMapFromCache(device, light._shadowResolution, light._shadowType, 1);

                            var blurMode = light.vsmBlurMode;
                            var blurShader = (light._shadowType === pc.SHADOW_VSM8? this.blurPackedVsmShader : this.blurVsmShader)[blurMode][filterSize];
                            if (!blurShader) {
                                this.blurVsmWeights[filterSize] = gaussWeights(filterSize);
                                var chunks = pc.shaderChunks;
                                (light._shadowType === pc.SHADOW_VSM8? this.blurPackedVsmShader : this.blurVsmShader)[blurMode][filterSize] = blurShader =
                                    chunks.createShaderFromCode(this.device, chunks.fullscreenQuadVS,
                                    "#define SAMPLES " + filterSize + "\n" +
                                    (light._shadowType === pc.SHADOW_VSM8? this.blurPackedVsmShaderCode : this.blurVsmShaderCode)
                                    [blurMode], "blurVsm" + blurMode + "" + filterSize + "" + (light._shadowType === pc.SHADOW_VSM8));
                            }

                            blurScissorRect.z = light._shadowResolution - 2;
                            blurScissorRect.w = blurScissorRect.z;

                            // Blur horizontal
                            this.sourceId.setValue(origShadowMap.colorBuffer);
                            pixelOffset.x = 1.0 / light._shadowResolution;
                            pixelOffset.y = 0.0;
                            this.pixelOffsetId.setValue(pixelOffset.data);
                            if (blurMode === pc.BLUR_GAUSSIAN) this.weightId.setValue(this.blurVsmWeights[filterSize]);
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

            if (device.webgl2) {
                device.setDepthBias(false);
            } else if (device.extStandardDerivatives) {
                this.polygonOffset[0] = 0;
                this.polygonOffset[1] = 0;
                this.polygonOffsetId.setValue(this.polygonOffset);
            }

            // #ifdef PROFILER
            this._shadowMapTime += pc.now() - shadowMapStartTime;
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
                if (!meshInstance.command && meshInstance.drawToDepth && meshInstance.material.blendType === pc.BLEND_NONE) {
                    filtered.push(meshInstance);
                }
            }

            // #ifdef PROFILER
            this._sortTime += pc.now() - sortTime;
            // #endif

            return filtered;
        },

        renderDepth: function(device, camera, drawCalls) { // TODO: fix depth
            // #ifdef PROFILER
            var startTime = pc.now();
            // #endif

            if (camera._renderDepthRequests) {
                var i;
                var shadowType;
                var rect = camera._rect;

                var target = camera.renderTarget;
                var width = target? target.width : device.width;
                var height = target? target.height : device.height;
                width = Math.floor(rect.width * width);
                height = Math.floor(rect.height * height);

                var meshInstance, mesh, material, style, depthShader;

                var vrDisplay = camera.vrDisplay;
                var halfWidth = device.width*0.5;

                drawCalls = this.filterDepthMapDrawCalls(drawCalls);
                var drawCallsCount = drawCalls.length;
                this.sortDrawCalls(drawCalls, this.depthSortCompare, pc.SORTKEY_DEPTH);

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

                // Set standard depth states
                device.setBlending(false);
                device.setColorWrite(true, true, true, true);
                device.setDepthWrite(true);
                device.setDepthTest(true);

                // Set depth RT
                var oldTarget = camera.renderTarget;
                var oldClear = camera._clearOptions;
                camera.renderTarget = camera._depthTarget;
                camera._clearOptions = rgbaDepthClearOptions;
                this.setCamera(camera);

                // Render
                for (i = 0; i < drawCallsCount; i++) {
                    meshInstance = drawCalls[i];
                    mesh = meshInstance.mesh;
                    material = meshInstance.material;

                    // set basic material states/parameters

                    // Cull mode
                    if (camera._cullFaces) {
                        if (camera._flipFaces) {
                            device.setCullMode(material.cull > 0 ?
                                (material.cull === pc.CULLFACE_FRONT ? pc.CULLFACE_BACK : pc.CULLFACE_FRONT )
                             : 0);
                        } else {
                            device.setCullMode(material.cull);
                        }
                    } else {
                        device.setCullMode(pc.CULLFACE_NONE);
                    }
                    // Alpha test
                    if (material.opacityMap) {
                        this.opacityMapId.setValue(material.opacityMap);
                        this.alphaTestId.setValue(material.alphaTest);
                    }

                    this.setSkinning(device, meshInstance, material);
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
                    device.setVertexBuffer((meshInstance.morphInstance && meshInstance.morphInstance._vertexBuffer) ?
                        meshInstance.morphInstance._vertexBuffer : mesh.vertexBuffer, 0);
                    device.setIndexBuffer(mesh.indexBuffer[style]);

                    // draw
                    if (vrDisplay && vrDisplay.presenting) {
                        // Left
                        device.setViewport(0, 0, halfWidth, device.height);
                        this.viewProjId.setValue(viewProjMatL.data);
                        this.viewPosId.setValue(viewPosL.data);
                        i += this.drawInstance(device, meshInstance, mesh, style, true);
                        this._depthDrawCalls++;

                        // Right
                        device.setViewport(halfWidth, 0, halfWidth, device.height);
                        this.viewProjId.setValue(viewProjMatR.data);
                        this.viewPosId.setValue(viewPosR.data);
                        i += this.drawInstance2(device, meshInstance, mesh, style);
                        this._depthDrawCalls++;
                    } else {
                        i += this.drawInstance(device, meshInstance, mesh, style);
                        this._depthDrawCalls++;
                    }
                }

                // Set old rt
                camera.renderTarget = oldTarget;
                camera._clearOptions = oldClear;
            } else {
                if (camera._depthTarget) {
                    camera._depthTarget.destroy();
                    camera._depthTarget = null;
                }
            }

            // #ifdef PROFILER
            this._depthMapTime += pc.now() - startTime;
            // #endif
        },

        updateShader: function(meshInstance, objDefs, staticLightList, pass, sortedLights) {
            if (pass === pc.SHADER_DEPTH) {
                meshInstance._shader[pc.SHADER_DEPTH] = this.findDepthShader(meshInstance);
                meshInstance._key[pc.SORTKEY_DEPTH] = getDepthKey(meshInstance);
                return;
            }
            meshInstance.material.updateShader(this.device, this.scene, objDefs, null, pass, sortedLights);
            meshInstance._shader[pass] = meshInstance.material.shader;
        },

        renderForward: function(camera, drawCalls, drawCallsCount, sortedLights, pass, visibilityArray) {
            var device = this.device;
            var scene = this.scene;
            var vrDisplay = camera.vrDisplay;

            var visibilityArrayLen;
            if (visibilityArray) visibilityArrayLen = visibilityArray.length;

            // #ifdef PROFILER
            var forwardStartTime = pc.now();
            // #endif

            var i, drawCall, mesh, material, objDefs, variantKey, lightMask, style, usedDirLights;
            var prevMeshInstance = null, prevMaterial = null, prevObjDefs, prevLightMask, prevStatic;
            var paramName, parameter, parameters;
            var stencilFront, stencilBack;

            var halfWidth = device.width*0.5;

            // Set up depth map
            /*if (camera._depthTarget) this.depthMapId.setValue(camera._depthTarget.colorBuffer);*/

            // Render the scene
            for (i = 0; i < drawCallsCount; i++) {

                if (visibilityArray && i < visibilityArrayLen && !visibilityArray[i]) continue; // apply visibility override

                drawCall = drawCalls[i];
                if (drawCall.command) {
                    // We have a command
                    drawCall.command();
                } else {

                    // #ifdef PROFILER
                    // If pc.skipRenderCamera is set to current camera,
                    // then it will stop rendering draw calls after pc.skipRenderAfter
                    // number of draw calls rendered, usefull for profiling order of rendering
                    if (camera === pc.skipRenderCamera && i >= pc.skipRenderAfter) continue; // TODO: fix with layers
                    // #endif

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
                        if (!drawCall._shader[pass] || drawCall._shaderDefs !== objDefs) {
                            if (!drawCall.isStatic) {
                                variantKey = pass + "_" + objDefs;
                                drawCall._shader[pass] = material.variants[variantKey];
                                if (!drawCall._shader[pass]) {
                                    this.updateShader(drawCall, objDefs, null, pass, sortedLights);
                                    material.variants[variantKey] = drawCall._shader[pass];
                                }
                            } else {
                                this.updateShader(drawCall, objDefs, drawCall._staticLightList, pass, sortedLights);
                            }
                            drawCall._shaderDefs = objDefs;
                        }

                        // #ifdef DEBUG
                        if (!device.setShader(drawCall._shader[pass])) {
                            console.error('Error in material "' + material.name + '" with flags ' + objDefs);
                            drawCall.material = pc.Scene.defaultMaterial;
                        }
                        // #else
                        device.setShader(drawCall._shader[pass]);
                        // #endif

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
                            usedDirLights = this.dispatchDirectLights(sortedLights[pc.LIGHTTYPE_DIRECTIONAL], scene, lightMask);
                            this.dispatchLocalLights(sortedLights, scene, lightMask, usedDirLights, drawCall._staticLightList);
                        }

                        this.alphaTestId.setValue(material.alphaTest);

                        device.setBlending(material.blend);
                        if (material.blend) {
                            if (material.separateAlphaBlend) {
                                device.setBlendFunctionSeparate(material.blendSrc, material.blendDst, material.blendSrcAlpha, material.blendDstAlpha);
                                device.setBlendEquationSeparate(material.blendEquation, material.blendAlphaEquation);
                            } else {
                                device.setBlendFunction(material.blendSrc, material.blendDst);
                                device.setBlendEquation(material.blendEquation);
                            }
                        }
                        device.setColorWrite(material.redWrite, material.greenWrite, material.blueWrite, material.alphaWrite);
                        if (camera._cullFaces) {
                            if (camera._flipFaces) {
                                device.setCullMode(material.cull > 0 ?
                                    (material.cull === pc.CULLFACE_FRONT ? pc.CULLFACE_BACK : pc.CULLFACE_FRONT )
                                 : 0);
                            } else {
                                device.setCullMode(material.cull);
                            }
                        } else {
                            device.setCullMode(pc.CULLFACE_NONE);
                        }
                        device.setDepthWrite(material.depthWrite);
                        device.setDepthTest(material.depthTest);
                        device.setAlphaToCoverage(material.alphaToCoverage);

                        stencilFront = material.stencilFront;
                        stencilBack = material.stencilBack;
                        if (stencilFront || stencilBack) {
                            device.setStencilTest(true);
                            if (stencilFront === stencilBack) {
                                // identical front/back stencil
                                device.setStencilFunc(stencilFront.func, stencilFront.ref, stencilFront.readMask);
                                device.setStencilOperation(stencilFront.fail, stencilFront.zfail, stencilFront.zpass, stencilFront.writeMask);
                            } else {
                                // separate
                                if (stencilFront) {
                                    // set front
                                    device.setStencilFuncFront(stencilFront.func, stencilFront.ref, stencilFront.readMask);
                                    device.setStencilOperationFront(stencilFront.fail, stencilFront.zfail, stencilFront.zpass, stencilFront.writeMask);
                                } else {
                                    // default front
                                    device.setStencilFuncFront(pc.FUNC_ALWAYS, 0, 0xFF);
                                    device.setStencilOperationFront(pc.STENCILOP_KEEP, pc.STENCILOP_KEEP, pc.STENCILOP_KEEPP, 0xFF);
                                }
                                if (stencilBack) {
                                    // set back
                                    device.setStencilFuncBack(stencilBack.func, stencilBack.ref, stencilBack.readMask);
                                    device.setStencilOperationBack(stencilBack.fail, stencilBack.zfail, stencilBack.zpass, stencilBack.writeMask);
                                } else {
                                    // default back
                                    device.setStencilFuncBack(pc.FUNC_ALWAYS, 0, 0xFF);
                                    device.setStencilOperationBack(pc.STENCILOP_KEEP, pc.STENCILOP_KEEP, pc.STENCILOP_KEEP, 0xFF);
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

                    device.setVertexBuffer((drawCall.morphInstance && drawCall.morphInstance._vertexBuffer) ?
                        drawCall.morphInstance._vertexBuffer : mesh.vertexBuffer, 0);
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
                    if (i<drawCallsCount-1 && drawCalls[i+1].material === material) {
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
            device.updateEnd();

            // #ifdef PROFILER
            this._forwardTime += pc.now() - forwardStartTime;
            // #endif
        },

        setupInstancing: function(device) {
            if (!pc._instanceVertexFormat) {
                var formatDesc = [
                    { semantic: pc.SEMANTIC_TEXCOORD2, components: 4, type: pc.TYPE_FLOAT32 },
                    { semantic: pc.SEMANTIC_TEXCOORD3, components: 4, type: pc.TYPE_FLOAT32 },
                    { semantic: pc.SEMANTIC_TEXCOORD4, components: 4, type: pc.TYPE_FLOAT32 },
                    { semantic: pc.SEMANTIC_TEXCOORD5, components: 4, type: pc.TYPE_FLOAT32 },
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
            var lht;
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

                    if (staticLights.length === 0) {
                        newDrawCalls.push(drawCall);
                        continue;
                    }

                    // #ifdef PROFILER
                    subReadMeshTime = pc.now();
                    // #endif
                    mesh = drawCall.mesh;
                    vertexBuffer = mesh.vertexBuffer;
                    indexBuffer = mesh.indexBuffer[drawCall.renderStyle];
                    indices = indexBuffer.bytesPerIndex === 2? new Uint16Array(indexBuffer.lock()) : new Uint32Array(indexBuffer.lock());
                    numTris = mesh.primitive[drawCall.renderStyle].count / 3;
                    baseIndex = mesh.primitive[drawCall.renderStyle].base;
                    elems = vertexBuffer.format.elements;
                    vertSize = vertexBuffer.format.size / 4; // / 4 because float
                    verts = new Float32Array(vertexBuffer.storage);

                    for(k=0; k<elems.length; k++) {
                        if (elems[k].name === pc.SEMANTIC_POSITION) {
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
                            var ib2 = ib.bytesPerIndex === 2? new Uint16Array(ib.lock()) : new Uint32Array(ib.lock());
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

                            if (drawCall._staticLightList) {
                                instance._staticLightList = drawCall._staticLightList; // add forced assigned lights
                            } else {
                                instance._staticLightList = [];
                            }

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
                                    lht = lights[ staticLights[k] ];
                                    if (instance._staticLightList.indexOf(lht) < 0) {
                                        instance._staticLightList.push(lht);
                                    }
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

        updateShaders: function (drawCalls) {
            var i;
            // Collect materials
            var materials = [];
            //var drawCalls = this.drawCalls;
            for (i = 0; i < drawCalls.length; i++) {
                var drawCall = drawCalls[i];
                if (drawCall.material !== undefined) {
                    if (materials.indexOf(drawCall.material) === -1) {
                        materials.push(drawCall.material);
                    }
                }
            }
            // Clear material shaders
            for (i = 0; i < materials.length; i++) {
                var mat = materials[i];
                if (mat.updateShader !== pc.Material.prototype.updateShader) {
                    mat.clearVariants();
                    mat.shader = null;
                }
            }
        },

        beginFrame: function (comp) {
            var device = this.device;
            var scene = this.scene;
            var meshInstances = comp._meshInstances;
            var lights = comp._lights;

            scene.drawCalls = meshInstances; // used to pass to prepareStaticMeshes currently

            // Update shaders if needed
            // all mesh instances (TODO: ideally can update less if only lighting changed)
            if (scene.updateShaders) {
                //scene.updateShadersFunc(device, meshInstances);
                scene.updateSkybox(device);
                this.updateShaders(meshInstances);
                scene.updateShaders = false;
            }

            if (scene._needsStaticPrepare) {
                this.prepareStaticMeshes(device, scene); // TODO: fix
                scene._needsStaticPrepare = false;
            }

            // Update all skin matrices to properly cull skinned objects (but don't update rendering data yet)
            this.updateCpuSkinMatrices(meshInstances);
            this.updateMorphedBounds(meshInstances);

            var i;
            var len = meshInstances.length;
            for(i=0; i<len; i++) {
                meshInstances[i]._visibleThisFrame = false;
            }

            len = lights.length;
            var j;
            for(i=0; i<len; i++) {
                lights[i]._visibleThisFrame = false;
                lights[i]._culledLength[0] = 0;
                if (lights[i]._type === pc.LIGHTTYPE_POINT) {
                    lights[i]._culledLength[1] = 0;
                    lights[i]._culledLength[2] = 0;
                    lights[i]._culledLength[3] = 0;
                    lights[i]._culledLength[4] = 0;
                    lights[i]._culledLength[5] = 0;
                    lights[i]._culledPasses = 6;
                } else if (lights[i]._type === pc.LIGHTTYPE_DIRECTIONAL) {
                    lights[i]._visibleThisFrame = true;
                    for(j=0; j<lights[i]._culledLength.length; j++) {
                        lights[i]._culledLength[j] = 0;
                    }
                    lights[i]._culledPasses = 0;
                } else {
                    lights[i]._culledPasses = 1;
                }
            }

            len = comp.layerList.length;
            var layer;
            for(i=0; i<len; i++) {
                layer = comp.layerList[i];
                for(j=0; j<layer.cameras.length; j++) {
                    if (!layer.objects.culledOpaque[j]) layer.objects.culledOpaque[j] = new pc.CulledObjectList();
                    if (!layer.objects.culledTransparent[j]) layer.objects.culledTransparent[j] = new pc.CulledObjectList();
                    layer.objects.culledOpaque[j].done = false;
                    layer.objects.culledTransparent[j].done = false;
                }
            }
        },

        beginRenderingShadowmap: function (light) {
            light._visibleThisFrame = true;
            light._culledLength[0] = 0;
            light._culledPasses = 0;
            if (light._type === pc.LIGHTTYPE_POINT) {
                light._culledLength[1] = 0;
                light._culledLength[2] = 0;
                light._culledLength[3] = 0;
                light._culledLength[4] = 0;
                light._culledLength[5] = 0;
                light._culledPasses = 6;
            } else if (light._type === pc.LIGHTTYPE_DIRECTIONAL) {
                for(var j=0; j<light._culledLength.length; j++) {
                    light._culledLength[j] = 0;
                }
            }
        },

        cullLocalShadowmap: function (light, drawCalls) {
            var i, type, shadowCam, shadowCamNode, passes, pass, j, numInstances, meshInstance, culledList, clen, visible;
            var lightNode;
            type = light._type;
            if (type === pc.LIGHTTYPE_DIRECTIONAL) return;

            shadowCam = this.getShadowCamera(this.device, light);

            shadowCam.projection = pc.PROJECTION_PERSPECTIVE;
            shadowCam.nearClip = light.attenuationEnd / 1000;
            shadowCam.farClip = light.attenuationEnd;
            shadowCam.aspectRatio = 1;
            if (type === pc.LIGHTTYPE_SPOT) {
                shadowCam.fov = light._outerConeAngle * 2;
                passes = 1;
            } else {
                shadowCam.fov = 90;
                passes = 6;
            }
            shadowCamNode = shadowCam._node;
            lightNode = light._node;
            shadowCamNode.setPosition(lightNode.getPosition());
            if (type === pc.LIGHTTYPE_SPOT) {
                shadowCamNode.setRotation(lightNode.getRotation());
                shadowCamNode.rotateLocal(-90, 0, 0); // Camera's look down negative Z, and directional lights point down negative Y // TODO: remove eulers
            }

            for(pass=0; pass<passes; pass++) {

                if (type === pc.LIGHTTYPE_POINT) {
                    shadowCamNode.setRotation(pointLightRotations[pass]);
                    shadowCam.renderTarget = light._shadowCubeMap[pass];
                }

                this.updateCameraFrustum(shadowCam);

                culledList = light._culledList[pass];
                if (!culledList) {
                    culledList = light._culledList[pass] = [];
                    light._culledLength[pass] = 0;
                }
                clen = light._culledLength[pass];
                for (j = 0, numInstances = drawCalls.length; j < numInstances; j++) {
                    meshInstance = drawCalls[j];
                    visible = true;
                    if (meshInstance.cull) {
                        visible = this._isVisible(shadowCam, meshInstance);
                    }
                    if (visible) {
                        light._culledList[pass][clen] = meshInstance;
                        clen++;
                        meshInstance._visibleThisFrame = true;
                    }
                }
                light._culledLength[pass] = clen;
            }
        },


        cullDirectionalShadowmap: function(light, drawCalls, camera, pass) {
            var i, j, shadowShader, type, shadowCam, shadowCamNode, lightNode, passes, frustumSize, shadowType, smode, clen, culledList;
            var unitPerTexel, delta, p;
            var minx, miny, minz, maxx, maxy, maxz, centerx, centery;
            var opChan;
            var visible, cullTime, numInstances;
            var meshInstance, mesh, material;
            var style;
            var emptyAabb;
            var drawCallAabb;
            var device = this.device;

            shadowCam = this.getShadowCamera(device, light);
            shadowCamNode = shadowCam._node;
            lightNode = light._node;

            shadowCamNode.setPosition(lightNode.getPosition());
            shadowCamNode.setRotation(lightNode.getRotation());
            shadowCamNode.rotateLocal(-90, 0, 0); // Camera's look down negative Z, and directional lights point down negative Y

            // Positioning directional light frustum I
            // Construct light's orthographic frustum around camera frustum
            // Use very large near/far planes this time

            // 1. Get the frustum of the camera
            _getFrustumPoints(camera, light.shadowDistance || camera._farClip, frustumPoints);

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

            shadowCam.projection = pc.PROJECTION_ORTHOGRAPHIC;
            shadowCam.nearClip = 0;
            shadowCam.farClip = 200000;
            shadowCam.aspectRatio = 1; // The light's frustum is a cuboid.
            shadowCam.orthoHeight = frustumSize * 0.5;

            this.updateCameraFrustum(shadowCam);

            // Cull shadow casters and find their AABB
            emptyAabb = true;
            culledList = light._culledList[pass];
            if (!culledList) {
                culledList = light._culledList[pass] = [];
                light._culledLength[pass] = 0;
            }
            clen = light._culledLength[pass];

            if (clen === undefined) clen = 0;
            for (j = 0, numInstances = drawCalls.length; j < numInstances; j++) {
                meshInstance = drawCalls[j];
                visible = true;
                if (meshInstance.cull) {
                    visible = this._isVisible(shadowCam, meshInstance);
                }
                if (visible) {
                    culledList[clen] = meshInstance;
                    clen++;
                    meshInstance._visibleThisFrame = true;

                    drawCallAabb = meshInstance.aabb;
                    if (emptyAabb) {
                        visibleSceneAabb.copy(drawCallAabb);
                        emptyAabb = false;
                    } else {
                        visibleSceneAabb.add(drawCallAabb);
                    }
                }
            }
            light._culledLength[pass] = clen;

            // Positioning directional light frustum II
            // Fit clipping planes tightly around visible shadow casters

            // 1. Calculate minz/maxz based on casters' AABB
            var z = _getZFromAABBSimple( shadowCamView, visibleSceneAabb.getMin(), visibleSceneAabb.getMax(), minx, maxx, miny, maxy );

            // Always use the scene's aabb's Z value
            // Otherwise object between the light and the frustum won't cast shadow.
            maxz = z.max;
            if (z.min > minz) minz = z.min;

            // 2. Fix projection
            shadowCamNode.setPosition(lightNode.getPosition());
            shadowCamNode.translateLocal(centerx, centery, maxz + directionalShadowEpsilon);
            shadowCam.farClip = maxz - minz;

            // Save projection variables to use in rendering later
            var settings = light._culledCameraSettings[pass];
            if (!settings) {
                settings = light._culledCameraSettings[pass] = {};
            }
            var lpos = shadowCamNode.getPosition().data;
            settings.x = lpos[0];
            settings.y = lpos[1];
            settings.z = lpos[2];
            settings.orthoHeight = shadowCam.orthoHeight;
            settings.farClip = shadowCam.farClip;
        },


        gpuUpdate: function (drawCalls) {
            // skip everything with _visibleThisFrame === false
            this.updateGpuSkinMatrices(drawCalls);
            this.updateMorphing(drawCalls);
        },

        clearView: function (camera, stencilFill) {
            camera = camera.camera;
            var device = this.device;
            var target = camera.renderTarget;
            device.setRenderTarget(target);
            device.updateBegin();

            device.setColorWrite(true, true, true, true);
            device.setDepthWrite(true);

            var rect = camera.getRect();
            var pixelWidth = target ? target.width : device.width;
            var pixelHeight = target ? target.height : device.height;
            var x = Math.floor(rect.x * pixelWidth);
            var y = Math.floor(rect.y * pixelHeight);
            var w = Math.floor(rect.width * pixelWidth);
            var h = Math.floor(rect.height * pixelHeight);
            device.setViewport(x, y, w, h);
            device.setScissor(x, y, w, h);

            device.clear(camera._clearOptions); // clear full RT
        },


        beginDirectionalLightRender: function (lights) {
            var len = lights.length;
            for(var i=0; i<len; i++) {
                lights[i]._culledPasses = 0;
            }
        },

        setSceneConstants: function () {
            var device = this.device;
            var scene = this.scene;

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

            // Set up screen size // should be RT size?
            this._screenSize.x = device.width;
            this._screenSize.y = device.height;
            this._screenSize.z = 1.0 / device.width;
            this._screenSize.w = 1.0 / device.height;
            this.screenSizeId.setValue(this._screenSize.data);
            //var halfWidth = device.width*0.5;
        },

        // don't cull depth/world twice
        // old way: Cull. Filter by meshInstance bool. Render depth. Render forward. <-- DEPTH DOESN'T ALWAYS EQUAL WORLD but most of the time, NOT APPLIABLE TO OTHER PASSES
        // new way: Cull depth. Render. Cull world. Render.                          <-- DOUBLE CULL, DOUBLE ADD/REMOVE, DOUBLE DATA (incl. per model)
        // possible solutions:
        // 1. Mark which meshInstance was culled with which camera, skip processed. LARGE DATA to maintain
        // 2. "List of objects" and "Pass" must be different classes. Layer (list) and RenderPass. Each layer is culled by each camera once.
        //      DEPTH CAN HAVE SLIGHTLY DIFFERENT DRAWCALLS, but still makes sense (depth + normal, etc)
        // 3. Layer can use a reference to another layer's object lists instead of (or in addition to) its own list. CAN'T FILTER OUT OBJECTS
        //      can have indirection/skip array for such layer - NOT STRAIGHTFORWARD TO REPLACE normal arrays with it
        //          can set .visible before each layer render to layer array values - only if there are multiple arrays referencing same objects.
        //          .visible check have to be in render, not cull then MORE FRUSTUM CHECKS
        //          .visible = meshInstance.visible && layer.visibility[i]
        //          layer.setSharedObjectVisibility(meshInstance, visible)
        //       additional objects?
        //          don't support; use .visible
        //      Culling:
        //          - Layer 1: cull all visible objects (list -> culledList). Set bits to culledFlagArray
        //          - Layer 2: go through visible objects, check culledFlagArray, cull if visible && !culledFlagArray
        //          Implying culledLists are unique, object lists are not
        // OR
        //          - Layer 1: cull all visible objects (list -> culledList)
        //          - Layer 2: set new visibility. Render existing culledList, filter WILL SKIP INVIVISIBLE FROM 1ST LAYER
        // OR
        //          - Layer 1: m[i].visible = origVisible; m[i].visibleCulling = (visible1 || visible2); cull all visibleCulling objects (list -> culledList)
        //          - Layer 1: render if visible
        //          - Layer 2: m[1].visible = overrideVisible; render if visible
        // OR
        //          - Layer 1: [Shared] Cull with meshInstance.visible; Set layer visibility; Render; Unset layer visibility
        //          - Layer 2: [Different layer with its own objects, but reuses some objects] Cull, render
        //          - Layer 3: [Shared] Already culled. Set layer visibility; Render; Unset layer visibility
        // OR <-- do this
        //          - Layer 1: [Shared] Cull with meshInstance.visible; Render, filtering by layer visibility array
        //          - Layer 2: [Different layer with its own objects, but reuses some objects] Cull, render
        //          - Layer 3: [Shared] Already culled. Render, filtering by layer visibility array
        //          Object in world but not in depth: layerDepth.setMeshInstanceVisible(m, false)
        //          Object in depth but not in world: layerWorld.setMeshInstanceVisible(m, false)
        //          .visible is used for culling; layer-modified .visible is used for rendering


        // Depth map management
        // 

        renderComposition: function (comp) {
            var device = this.device;
            var camera;
            var renderedRt = comp._renderedRt;
            var renderedByCam = comp._renderedByCam;
            var renderedLayer = comp._renderedLayer;
            var i, layer, transparent, cameras, j, rt, k, processedThisCamera, processedThisCameraAndLayer, processedThisCameraAndRt, culledLength;

            // Update static layer data, if something's changed
            var updated = comp._update();
            if (updated & 2) {
                this.scene.updateShaders = true;
            }

            // Single per-frame calculations
            this.beginFrame(comp);
            this.setSceneConstants();

            // Camera culling (once for each camera + layer)
            // Also applies meshInstance.visible and camera.cullingMask
            var renderedLength = 0;
            var objects, drawCalls, culled;
            for(i=0; i<comp.layerList.length; i++) {
                layer = comp.layerList[i];
                if (!layer.enabled || !comp.subLayerEnabled[i]) continue;
                transparent = comp.subLayerList[i];
                objects = layer.objects;

                cameras = layer.cameras;
                for (j=0; j<cameras.length; j++) {
                    camera = cameras[j];
                    camera.frameBegin();
                    this.scene.drawCalls = drawCalls = transparent ? layer.transparentMeshInstances : layer.opaqueMeshInstances;

                    processedThisCamera = false;
                    processedThisCameraAndLayer = false;
                    for(k=0; k<renderedLength; k++) {
                        if (renderedByCam[k] === camera) {
                            processedThisCamera = true;
                            if (renderedLayer[k] === layer) {
                                processedThisCameraAndLayer = true;
                                break;
                            }
                        }
                    }
                    if (!processedThisCamera) {
                        this.updateCameraFrustum(camera.camera); // update camera frustum once
                    }
                    if (!processedThisCameraAndLayer) {
                        // cull each layer's lights once with each camera
                        // lights aren't collected anywhere, but marked as visible
                        this.cullLights(camera.camera, layer._lights);
                    }
                    if (!processedThisCamera || !processedThisCameraAndLayer) {
                        renderedByCam[renderedLength] = camera;
                        renderedLayer[renderedLength] = layer;
                        renderedLength++;
                    }

                    // cull mesh instances
                    // collected into layer arrays
                    // shared objects are only culled once
                    culled = transparent ? objects.culledTransparent[j] : objects.culledOpaque[j];
                    if (!culled.done) {
                        culled.length = this.cull(camera.camera, drawCalls, culled.list);
                        culled.done = true;

                    }

                    camera.frameEnd();
                }
            }

            // Shadowmap culling for directional and visible local lights
            // collected into light._culledList
            // objects are also globally marked as visible
            // Also sets up local shadow camera matrices
            var light, casters;

            // Local lights
            // culled once for the whole frame
            for(i=0; i<comp._lights.length; i++) {
                light = comp._lights[i];
                if (!light._visibleThisFrame) continue;
                if (light._type === pc.LIGHTTYPE_DIRECTIONAL) continue;
                if (!light.castShadows || !light._enabled || light.shadowUpdateMode === pc.SHADOWUPDATE_NONE) continue;
                casters = comp._lightShadowCasters[i];
                this.cullLocalShadowmap(light, casters);
            }

            // Directional lights
            // culled once for each camera
            renderedLength = 0;
            var globalLightCounter = -1;
            for(i=0; i<comp._lights.length; i++) {
                light = comp._lights[i];
                if (light._type !== pc.LIGHTTYPE_DIRECTIONAL) continue;
                globalLightCounter++;
                if (!light.castShadows || !light._enabled || light.shadowUpdateMode === pc.SHADOWUPDATE_NONE) continue;
                casters = comp._lightShadowCasters[i];
                cameras = comp._globalLightCameras[globalLightCounter];
                for(j=0; j<cameras.length; j++) {
                    this.cullDirectionalShadowmap(light, casters, cameras[j].camera, light._culledPasses);
                    light._culledPasses++;
                }
            }

            // Can call script callbacks here and tell which objects are visible

            // GPU update for all visible objects
            this.gpuUpdate(comp._meshInstances);

            // Shadow render for all local visible culled lights
            this.renderShadows(comp._sortedLights[pc.LIGHTTYPE_SPOT]);
            this.renderShadows(comp._sortedLights[pc.LIGHTTYPE_POINT]);

            // Zero dirlight pass counter
            this.beginDirectionalLightRender(comp._sortedLights[pc.LIGHTTYPE_DIRECTIONAL]);

            // Rendering
            renderedLength = 0;
            var visibilityArray, cameraPass;
            for(i=0; i<comp.renderListSubLayerId.length; i++) {
                layer = comp.layerList[ comp.renderListSubLayerId[i] ];
                if (!layer.enabled || !comp.subLayerEnabled[ comp.renderListSubLayerId[i] ]) continue;
                objects = layer.objects;
                transparent = comp.subLayerList[ comp.renderListSubLayerId[i] ];
                cameraPass = comp.renderListSubLayerCameraId[i];
                camera = layer.cameras[cameraPass];
                camera.frameBegin();

                // Each camera must only clear each render target once
                rt = camera.renderTarget;
                processedThisCameraAndRt = false;
                for(k=0; k<renderedLength; k++) {
                    if (renderedRt[k] === rt && renderedByCam[k] === camera) {
                        processedThisCameraAndRt = true;
                        break;
                    }
                }
                if (!processedThisCameraAndRt) {
                    // clear once per camera + RT
                    this.clearView(camera); // TODO: make sure all in-layer cameras render to layer.renderTarget
                 
                    // render directional shadows. 1 light once per each camera
                    this.renderShadows(layer._sortedLights[pc.LIGHTTYPE_DIRECTIONAL]);

                    renderedRt[renderedLength] = rt;
                    renderedByCam[renderedLength] = camera;
                    renderedLength++;
                } else {
                    // layer is cleared, first layer's lights are rendered; possibly need to render other layer's lights
                    // light._culledPasses must be equal to cameraPass
                    this.renderShadows(layer._sortedLights[pc.LIGHTTYPE_DIRECTIONAL], cameraPass);
                }

                layer._sortCulled(transparent, camera.node, cameraPass);
                culled = transparent ? objects.culledTransparent[cameraPass] : objects.culledOpaque[cameraPass];

                this.scene._activeCamera = camera.camera;
                this.setCamera(camera.camera);

                visibilityArray = transparent ? layer._transparentVisible : layer._opaqueVisible; // TODO: this is not for culled array!!
                if (visibilityArray.length === 0) visibilityArray = null;                

                this.renderForward(camera.camera, 
                    culled.list,
                    culled.length,
                    layer._sortedLights,
                    layer.shaderPass,
                    visibilityArray);

                // Revert temp frame stuff
                device.setColorWrite(true, true, true, true);
                device.setStencilTest(false); // don't leak stencil state
                device.setAlphaToCoverage(false); // don't leak a2c state

                if (this.scene.immediateDrawCalls.length > 0) {
                    this.scene.immediateDrawCalls = [];
                }

                camera.frameEnd();
                this._camerasRendered++;
            }
        }
    });

    return {
        ForwardRenderer: ForwardRenderer,
        gaussWeights: gaussWeights
    };
}());
