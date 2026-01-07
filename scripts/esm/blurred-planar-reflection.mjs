// Blurred Planar Reflection v1.0

import {
    Script,
    Entity,
    Color,
    Vec3,
    Mat4,
    Plane,
    Texture,
    RenderTarget,
    ShaderMaterial,
    ShaderChunks,
    BLEND_NORMAL,
    PIXELFORMAT_RGBA8,
    ADDRESS_CLAMP_TO_EDGE,
    FILTER_LINEAR,
    FILTER_LINEAR_MIPMAP_LINEAR,
    SEMANTIC_POSITION,
    SHADERLANGUAGE_GLSL,
    SHADERLANGUAGE_WGSL,
    LAYERID_DEPTH
} from 'playcanvas';

/**
 * Sets up shader chunks for the planar reflection depth pass.
 * Uses empty user customization chunks, so no tracking needed.
 * @param {import('playcanvas').GraphicsDevice} device - The graphics device.
 * @private
 */
function setupDepthPassShaderChunks(device) {
    // GLSL chunks
    const glslChunks = ShaderChunks.get(device, SHADERLANGUAGE_GLSL);

    glslChunks.set('litUserDeclarationPS', /* glsl */`
        #ifdef PLANAR_REFLECTION_DEPTH_PASS
        uniform float planarReflectionPlaneDistance;
        uniform float planarReflectionHeightRange;
        #endif
    `);

    glslChunks.set('litUserMainEndPS', /* glsl */`
        #ifdef PLANAR_REFLECTION_DEPTH_PASS
        float distFromPlane = abs(vPositionW.y + planarReflectionPlaneDistance) / planarReflectionHeightRange;
        gl_FragColor = vec4(distFromPlane, distFromPlane, distFromPlane, 1.0);
        #endif
    `);

    // WGSL chunks
    const wgslChunks = ShaderChunks.get(device, SHADERLANGUAGE_WGSL);

    wgslChunks.set('litUserDeclarationPS', /* wgsl */`
        #ifdef PLANAR_REFLECTION_DEPTH_PASS
        uniform planarReflectionPlaneDistance: f32;
        uniform planarReflectionHeightRange: f32;
        #endif
    `);

    wgslChunks.set('litUserMainEndPS', /* wgsl */`
        #ifdef PLANAR_REFLECTION_DEPTH_PASS
        let distFromPlane: f32 = abs(vPositionW.y + uniform.planarReflectionPlaneDistance) / uniform.planarReflectionHeightRange;
        output.color = vec4f(distFromPlane, distFromPlane, distFromPlane, 1.0);
        #endif
    `);
}

// ----------------------
// GLSL Shaders
// ----------------------

const vertexShaderGLSL = /* glsl */`
    attribute vec4 aPosition;

    uniform mat4 matrix_model;
    uniform mat4 matrix_viewProjection;

    varying vec3 vWorldPos;

    void main(void) {
        vec4 worldPos = matrix_model * aPosition;
        vWorldPos = worldPos.xyz;
        gl_Position = matrix_viewProjection * worldPos;
    }
`;

const fragmentShaderGLSL = /* glsl */`
    #include "gammaPS"

    uniform vec4 uScreenSize;
    uniform sampler2D planarReflectionMap;
    uniform sampler2D planarReflectionDepthMap;
    uniform vec4 planarReflectionParams; // x: intensity, y: blurAmount, z: fadePower, w: fresnelPower
    uniform vec3 planarReflectionFadeColor;
    uniform vec3 view_position;

    varying vec3 vWorldPos;

    // Poisson disk samples for blur (32 samples for smooth blur)
    const int NUM_TAPS = 32;
    const vec2 poissonTaps[NUM_TAPS] = vec2[NUM_TAPS](
        vec2(-0.220147, 0.976896),
        vec2(-0.735514, 0.693436),
        vec2(-0.200476, 0.310353),
        vec2( 0.180822, 0.454146),
        vec2( 0.292754, 0.937414),
        vec2( 0.564255, 0.207879),
        vec2( 0.178031, 0.024583),
        vec2( 0.613912,-0.205936),
        vec2(-0.385540,-0.070092),
        vec2( 0.962838, 0.378319),
        vec2(-0.886362, 0.032122),
        vec2(-0.466531,-0.741458),
        vec2( 0.006773,-0.574796),
        vec2(-0.739828,-0.410584),
        vec2( 0.590785,-0.697557),
        vec2(-0.081436,-0.963262),
        vec2( 1.000000,-0.100160),
        vec2( 0.622430, 0.680868),
        vec2(-0.545396, 0.538133),
        vec2( 0.330651,-0.468300),
        vec2(-0.168019,-0.623054),
        vec2( 0.427100, 0.698100),
        vec2(-0.827445,-0.304350),
        vec2( 0.765140, 0.556640),
        vec2(-0.403340, 0.198600),
        vec2( 0.114050,-0.891450),
        vec2(-0.956940, 0.258450),
        vec2( 0.310545,-0.142367),
        vec2(-0.143134, 0.619453),
        vec2( 0.870890,-0.227634),
        vec2(-0.627623, 0.019867),
        vec2( 0.487623, 0.012367)
    );

    void main(void) {
        // UV coordinates in planar reflection map
        vec2 screenUV = gl_FragCoord.xy * uScreenSize.zw;
        screenUV.y = 1.0 - screenUV.y;

        // Sample depth to get distance from plane (0..1 range based on heightRange)
        float distanceFromPlane = texture2DLod(planarReflectionDepthMap, screenUV, 0.0).x;

        // Calculate blur parameters based on distance
        float blurAmount = planarReflectionParams.y;
        vec2 reflTextureSize = vec2(textureSize(planarReflectionMap, 0));
        float area = distanceFromPlane * 80.0 * blurAmount / reflTextureSize.x;  // Spatial blur spread
        float mipLevel = min(distanceFromPlane * 2.0 * blurAmount, 4.0);  // Capped mip level to prevent washout

        // Multi-tap Poisson sampling for blur
        vec3 reflection = vec3(0.0);
        for (int i = 0; i < NUM_TAPS; i++) {
            vec2 offset = poissonTaps[i] * area;
            reflection += texture2DLod(planarReflectionMap, screenUV + offset, mipLevel).rgb;
        }
        reflection /= float(NUM_TAPS);

        // Apply intensity - fade to white (fadeColor) when reduced
        float intensity = planarReflectionParams.x;
        reflection = mix(planarReflectionFadeColor, reflection, intensity);

        // Distance-based fade with smooth exponential falloff
        // fadeStrength: higher = quicker fade, lower = gradual fade
        // No hard cutoff - smoothly approaches white
        float fadeStrength = planarReflectionParams.z;
        float distanceFade = 1.0 - exp(-distanceFromPlane * fadeStrength * 3.0);

        // Fresnel effect based on viewing angle
        // Looking straight down = fade to white, grazing angle = full reflection
        vec3 viewDir = normalize(view_position - vWorldPos);
        vec3 planeNormal = vec3(0.0, 1.0, 0.0); // Assuming horizontal plane
        float NdotV = abs(dot(planeNormal, viewDir));
        float fresnelPower = planarReflectionParams.w;
        // fresnelFade: 0 at grazing angle, 1 when looking straight down
        float fresnelFade = pow(NdotV, fresnelPower);

        // Combine both fades - either distance OR viewing angle can fade to white
        float totalFade = max(distanceFade, fresnelFade);

        // Mix reflection with fade color
        reflection = mix(reflection, planarReflectionFadeColor, totalFade);

        gl_FragColor.rgb = gammaCorrectOutput(reflection);
        gl_FragColor.a = 1.0;
    }
`;

// ----------------------
// WGSL Shaders
// ----------------------

const vertexShaderWGSL = /* wgsl */`
    attribute aPosition: vec4f;

    uniform matrix_model: mat4x4f;
    uniform matrix_viewProjection: mat4x4f;

    varying vWorldPos: vec3f;

    @vertex
    fn vertexMain(input: VertexInput) -> VertexOutput {
        var output: VertexOutput;
        let worldPos: vec4f = uniform.matrix_model * aPosition;
        output.vWorldPos = worldPos.xyz;
        output.position = uniform.matrix_viewProjection * worldPos;
        return output;
    }
`;

const fragmentShaderWGSL = /* wgsl */`
    #include "gammaPS"

    uniform uScreenSize: vec4f;
    var planarReflectionMap: texture_2d<f32>;
    var planarReflectionMapSampler: sampler;
    var planarReflectionDepthMap: texture_2d<f32>;
    var planarReflectionDepthMapSampler: sampler;
    uniform planarReflectionParams: vec4f;
    uniform planarReflectionFadeColor: vec3f;
    uniform view_position: vec3f;

    varying vWorldPos: vec3f;

    // Poisson disk samples for blur (32 samples for smooth blur)
    const poissonTaps: array<vec2f, 32> = array<vec2f, 32>(
        vec2f(-0.220147, 0.976896),
        vec2f(-0.735514, 0.693436),
        vec2f(-0.200476, 0.310353),
        vec2f( 0.180822, 0.454146),
        vec2f( 0.292754, 0.937414),
        vec2f( 0.564255, 0.207879),
        vec2f( 0.178031, 0.024583),
        vec2f( 0.613912,-0.205936),
        vec2f(-0.385540,-0.070092),
        vec2f( 0.962838, 0.378319),
        vec2f(-0.886362, 0.032122),
        vec2f(-0.466531,-0.741458),
        vec2f( 0.006773,-0.574796),
        vec2f(-0.739828,-0.410584),
        vec2f( 0.590785,-0.697557),
        vec2f(-0.081436,-0.963262),
        vec2f( 1.000000,-0.100160),
        vec2f( 0.622430, 0.680868),
        vec2f(-0.545396, 0.538133),
        vec2f( 0.330651,-0.468300),
        vec2f(-0.168019,-0.623054),
        vec2f( 0.427100, 0.698100),
        vec2f(-0.827445,-0.304350),
        vec2f( 0.765140, 0.556640),
        vec2f(-0.403340, 0.198600),
        vec2f( 0.114050,-0.891450),
        vec2f(-0.956940, 0.258450),
        vec2f( 0.310545,-0.142367),
        vec2f(-0.143134, 0.619453),
        vec2f( 0.870890,-0.227634),
        vec2f(-0.627623, 0.019867),
        vec2f( 0.487623, 0.012367)
    );

    @fragment
    fn fragmentMain(input: FragmentInput) -> FragmentOutput {
        var output: FragmentOutput;

        // UV coordinates in planar reflection map
        var screenUV: vec2f = pcPosition.xy * uniform.uScreenSize.zw;
        screenUV.y = 1.0 - screenUV.y;

        // Sample depth to get distance from plane (0..1 range based on heightRange)
        let distanceFromPlane: f32 = textureSampleLevel(planarReflectionDepthMap, planarReflectionDepthMapSampler, screenUV, 0.0).x;

        // Calculate blur parameters based on distance
        let blurAmount: f32 = uniform.planarReflectionParams.y;
        let reflTextureSize: vec2f = vec2f(textureDimensions(planarReflectionMap, 0));
        let area: f32 = distanceFromPlane * 80.0 * blurAmount / reflTextureSize.x;  // Spatial blur spread
        let mipLevel: f32 = min(distanceFromPlane * 2.0 * blurAmount, 4.0);  // Capped mip level to prevent washout

        // Multi-tap Poisson sampling for blur
        var reflection: vec3f = vec3f(0.0);
        for (var i: i32 = 0; i < 32; i = i + 1) {
            let offset: vec2f = poissonTaps[i] * area;
            reflection = reflection + textureSampleLevel(planarReflectionMap, planarReflectionMapSampler, screenUV + offset, mipLevel).rgb;
        }
        reflection = reflection / 32.0;

        // Apply intensity - fade to white (fadeColor) when reduced
        let intensity: f32 = uniform.planarReflectionParams.x;
        reflection = mix(uniform.planarReflectionFadeColor, reflection, intensity);

        // Distance-based fade with smooth exponential falloff
        // fadeStrength: higher = quicker fade, lower = gradual fade
        // No hard cutoff - smoothly approaches white
        let fadeStrength: f32 = uniform.planarReflectionParams.z;
        let distanceFade: f32 = 1.0 - exp(-distanceFromPlane * fadeStrength * 3.0);

        // Fresnel effect based on viewing angle
        // Looking straight down = fade to white, grazing angle = full reflection
        let viewDir: vec3f = normalize(uniform.view_position - vWorldPos);
        let planeNormal: vec3f = vec3f(0.0, 1.0, 0.0); // Assuming horizontal plane
        let NdotV: f32 = abs(dot(planeNormal, viewDir));
        let fresnelPower: f32 = uniform.planarReflectionParams.w;
        // fresnelFade: 0 at grazing angle, 1 when looking straight down
        let fresnelFade: f32 = pow(NdotV, fresnelPower);

        // Combine both fades - either distance OR viewing angle can fade to white
        let totalFade: f32 = max(distanceFade, fresnelFade);

        // Mix reflection with fade color
        let result: vec3f = mix(reflection, uniform.planarReflectionFadeColor, totalFade);

        output.color = vec4f(gammaCorrectOutput(result), 1.0);
        return output;
    }
`;

// Reusable objects to avoid allocations
const _reflectionMatrix = new Mat4();
const _tempVec3 = new Vec3();
const _tempVec3b = new Vec3();

/**
 * BlurredPlanarReflection script provides planar reflections with distance-based blur.
 * Attach this script to an entity that has a render component with a plane mesh.
 * The entity's position defines the reflection plane, and its up vector (Y-axis) defines the plane normal.
 *
 * @example
 * const reflector = new pc.Entity('GroundReflection');
 * reflector.addComponent('render', {
 *     type: 'plane',
 *     castShadows: false
 * });
 * reflector.setLocalScale(10, 1, 10);
 * reflector.setPosition(0, 0, 0);
 *
 * reflector.addComponent('script').create(BlurredPlanarReflection, {
 *     properties: {
 *         mainCamera: cameraEntity,
 *         resolution: 0.5,
 *         blurAmount: 1.0,
 *         intensity: 0.8
 *     }
 * });
 * app.root.addChild(reflector);
 */
class BlurredPlanarReflection extends Script {
    static scriptName = 'blurredPlanarReflection';

    /**
     * The main camera entity to mirror for reflections.
     *
     * @attribute
     * @type {Entity}
     */
    mainCamera = null;

    /**
     * Resolution scale for reflection textures (0.25 to 1.0).
     *
     * @attribute
     * @range [0.1, 1]
     * @precision 2
     * @step 0.05
     */
    resolution = 1.0;

    /**
     * Controls the blur radius multiplier.
     *
     * @attribute
     * @range [0, 2]
     * @precision 2
     * @step 0.1
     */
    blurAmount = 1.0;

    /**
     * Reflection intensity/fade amount.
     *
     * @attribute
     * @range [0, 1]
     * @precision 2
     * @step 0.05
     */
    intensity = 0.8;

    /**
     * Controls the fade strength for distance-based fading.
     * - Higher values = sharper/quicker fade to white
     * - Lower values = more gradual fade
     * - fadeStrength = 1: linear fade
     *
     * @attribute
     * @range [0.1, 5]
     * @precision 2
     * @step 0.1
     */
    fadeStrength = 1.0;

    /**
     * Controls how reflection fades based on viewing angle.
     * Higher values = more fade when looking straight down, stronger reflection at grazing angles.
     *
     * @attribute
     * @range [0.1, 1]
     * @precision 2
     * @step 0.1
     */
    angleFade = 0.5;

    /**
     * Height range for distance-based blur calculation.
     *
     * @attribute
     * @range [1, 100]
     * @precision 1
     * @step 1
     */
    heightRange = 10.0;

    /**
     * Background color to fade reflections into.
     *
     * @attribute
     */
    fadeColor = new Color(0.5, 0.5, 0.5, 1);

    /**
     * Enable scene color map on reflection cameras. Required for materials with
     * refraction/transmission effects (e.g. glass lenses).
     *
     * @attribute
     * @type {boolean}
     */
    _sceneColorMap = false;

    /**
     * @type {boolean}
     */
    set sceneColorMap(value) {
        this._sceneColorMap = value;
        // Apply to existing cameras if they exist
        if (this._reflectionCameraEntity?.camera) {
            this._reflectionCameraEntity.camera.requestSceneColorMap(value);
        }
    }

    get sceneColorMap() {
        return this._sceneColorMap;
    }

    // Private members
    /** @private */
    _reflectionCameraEntity = null;

    /** @private */
    _reflectionDepthCameraEntity = null;

    /** @private */
    _reflectionMaterial = null;

    /** @private */
    _plane = new Plane();

    /** @private */
    _originalMaterials = [];

    initialize() {
        const app = this.app;
        const device = app.graphicsDevice;

        // Set up global shader chunks for depth pass (only done once per device)
        setupDepthPassShaderChunks(device);

        // Create reflection color camera
        this._reflectionCameraEntity = new Entity('ReflectionCamera');
        this._reflectionCameraEntity.addComponent('camera', {
            fov: 60,
            priority: -2 // Render before main camera and depth camera
        });
        app.root.addChild(this._reflectionCameraEntity);

        // Create reflection depth camera
        this._reflectionDepthCameraEntity = new Entity('ReflectionDepthCamera');
        this._reflectionDepthCameraEntity.addComponent('camera', {
            fov: 60,
            priority: -1 // Render after color but before main camera
        });

        // Set up custom shader pass for depth camera
        this._reflectionDepthCameraEntity.camera.setShaderPass('planar_reflection_depth');
        app.root.addChild(this._reflectionDepthCameraEntity);

        // Create the reflection material
        this._createReflectionMaterial();

        // Apply material to entity's render component
        this._applyMaterialToEntity();

        // Set up render targets
        this._updateRenderTargets();

        // Handle cleanup
        this.on('destroy', () => {
            this._cleanup();
        });

        this.on('disable', () => {
            if (this._reflectionCameraEntity) {
                this._reflectionCameraEntity.enabled = false;
            }
            if (this._reflectionDepthCameraEntity) {
                this._reflectionDepthCameraEntity.enabled = false;
            }
        });

        this.on('enable', () => {
            if (this._reflectionCameraEntity) {
                this._reflectionCameraEntity.enabled = true;
            }
            if (this._reflectionDepthCameraEntity) {
                this._reflectionDepthCameraEntity.enabled = true;
            }
        });
    }

    /**
     * @private
     */
    _createReflectionMaterial() {
        const material = new ShaderMaterial({
            uniqueName: 'BlurredPlanarReflectionMaterial',
            vertexGLSL: vertexShaderGLSL,
            fragmentGLSL: fragmentShaderGLSL,
            vertexWGSL: vertexShaderWGSL,
            fragmentWGSL: fragmentShaderWGSL,
            attributes: {
                aPosition: SEMANTIC_POSITION
            }
        });

        material.blendType = BLEND_NORMAL;
        material.depthWrite = false;

        this._reflectionMaterial = material;
    }

    /**
     * @private
     */
    _applyMaterialToEntity() {
        const render = this.entity.render;
        if (!render) {
            console.warn('BlurredPlanarReflection: Entity must have a render component');
            return;
        }

        // Store original materials and apply reflection material
        const meshInstances = render.meshInstances;
        this._originalMaterials = [];

        for (let i = 0; i < meshInstances.length; i++) {
            this._originalMaterials.push(meshInstances[i].material);
            meshInstances[i].material = this._reflectionMaterial;
        }
    }

    /**
     * @private
     */
    _destroyRenderTarget(camera) {
        if (camera?.renderTarget) {
            camera.renderTarget.destroyTextureBuffers();
            camera.renderTarget.destroy();
            camera.renderTarget = null;
        }
    }

    /**
     * @private
     */
    _createRenderTarget(name, width, height, mipmaps) {
        const device = this.app.graphicsDevice;

        const texture = new Texture(device, {
            name: name,
            width: width,
            height: height,
            format: PIXELFORMAT_RGBA8,
            mipmaps: mipmaps,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE,
            minFilter: mipmaps ? FILTER_LINEAR_MIPMAP_LINEAR : FILTER_LINEAR,
            magFilter: FILTER_LINEAR
        });

        const renderTarget = new RenderTarget({
            colorBuffer: texture,
            depth: true
        });

        return renderTarget;
    }

    /**
     * @private
     */
    _updateRenderTargets() {
        const device = this.app.graphicsDevice;

        // Get main camera resolution or device resolution
        let width, height;
        if (this.mainCamera?.camera?.renderTarget) {
            width = this.mainCamera.camera.renderTarget.width;
            height = this.mainCamera.camera.renderTarget.height;
        } else {
            width = device.width;
            height = device.height;
        }

        // Apply resolution scale
        width = Math.floor(width * this.resolution);
        height = Math.floor(height * this.resolution);

        // Limit to max texture size
        width = Math.min(width, device.maxTextureSize);
        height = Math.min(height, device.maxTextureSize);

        // Check if we need to recreate render targets
        const colorCamera = this._reflectionCameraEntity?.camera;
        const depthCamera = this._reflectionDepthCameraEntity?.camera;

        if (!colorCamera || !depthCamera) return;

        const needsUpdate = !colorCamera.renderTarget ||
            colorCamera.renderTarget.width !== width ||
            colorCamera.renderTarget.height !== height;

        if (needsUpdate) {
            // Destroy old render targets
            this._destroyRenderTarget(colorCamera);
            this._destroyRenderTarget(depthCamera);

            // Create new render targets
            colorCamera.renderTarget = this._createRenderTarget('planarReflectionMap', width, height, true);
            depthCamera.renderTarget = this._createRenderTarget('planarReflectionDepthMap', width, height, false);
        }
    }

    /**
     * @private
     */
    _updateReflectionCamera(cameraEntity, reflectedPos, reflectedTarget) {
        cameraEntity.setPosition(reflectedPos);
        cameraEntity.lookAt(reflectedTarget);

        // Copy properties from main camera
        const mainCamera = this.mainCamera?.camera;
        const reflectionCamera = cameraEntity.camera;

        if (mainCamera && reflectionCamera) {
            reflectionCamera.fov = mainCamera.fov;
            reflectionCamera.horizontalFov = mainCamera.horizontalFov;
            reflectionCamera.orthoHeight = mainCamera.orthoHeight;
            reflectionCamera.nearClip = mainCamera.nearClip;
            reflectionCamera.farClip = mainCamera.farClip * 2;
            reflectionCamera.aperture = mainCamera.aperture;
            reflectionCamera.sensitivity = mainCamera.sensitivity;
            reflectionCamera.shutter = mainCamera.shutter;

            // Copy layers from main camera, but EXCLUDE the layer containing the ground plane
            // and the skybox layer (we clear to the fade color instead)
            const excludeLayers = this.entity.render?.layers || [];
            const skyboxLayer = this.app.scene.layers.getLayerByName('Skybox');
            const filteredLayers = mainCamera.layers.filter(layerId => {
                if (excludeLayers.includes(layerId)) return false;
                if (skyboxLayer && layerId === skyboxLayer.id) return false;
                return true;
            });

            // Ensure depth layer is included for scene color map to work
            const depthLayer = this.app.scene.layers.getLayerById(LAYERID_DEPTH);
            if (depthLayer && !filteredLayers.includes(depthLayer.id)) {
                filteredLayers.push(depthLayer.id);
            }

            reflectionCamera.layers = filteredLayers;

            // Set clear color to fade color
            reflectionCamera.clearColor = this.fadeColor;
        }
    }

    postUpdate(dt) {
        if (!this.mainCamera) return;

        const device = this.app.graphicsDevice;

        // Update render targets if needed
        this._updateRenderTargets();

        // Get plane from entity transform
        const planePoint = this.entity.getPosition();
        const planeNormal = this.entity.up;
        this._plane.setFromPointNormal(planePoint, planeNormal);

        // Update plane distance uniform for depth pass
        device.scope.resolve('planarReflectionPlaneDistance').setValue(this._plane.distance);
        device.scope.resolve('planarReflectionHeightRange').setValue(this.heightRange);

        // Calculate reflection matrix
        _reflectionMatrix.setReflection(this._plane.normal, this._plane.distance);

        // Get main camera position and calculate reflected position
        const mainCameraPos = this.mainCamera.getPosition();
        _reflectionMatrix.transformPoint(mainCameraPos, _tempVec3);

        // Get main camera target and calculate reflected target
        _tempVec3b.copy(mainCameraPos).add(this.mainCamera.forward);
        _reflectionMatrix.transformPoint(_tempVec3b, _tempVec3b);

        // Update reflection cameras
        this._updateReflectionCamera(this._reflectionCameraEntity, _tempVec3, _tempVec3b);
        this._updateReflectionCamera(this._reflectionDepthCameraEntity, _tempVec3, _tempVec3b);

        // Update material parameters
        const colorCamera = this._reflectionCameraEntity?.camera;
        const depthCamera = this._reflectionDepthCameraEntity?.camera;

        if (colorCamera?.renderTarget && depthCamera?.renderTarget) {
            this._reflectionMaterial.setParameter('planarReflectionMap', colorCamera.renderTarget.colorBuffer);
            this._reflectionMaterial.setParameter('planarReflectionDepthMap', depthCamera.renderTarget.colorBuffer);
        }

        this._reflectionMaterial.setParameter('planarReflectionParams', [
            this.intensity,
            this.blurAmount,
            this.fadeStrength,
            this.angleFade
        ]);
        this._reflectionMaterial.setParameter('planarReflectionFadeColor', [
            this.fadeColor.r,
            this.fadeColor.g,
            this.fadeColor.b
        ]);
    }

    /**
     * @private
     */
    _cleanup() {
        // Restore original materials
        const render = this.entity?.render;
        if (render) {
            const meshInstances = render.meshInstances;
            for (let i = 0; i < meshInstances.length && i < this._originalMaterials.length; i++) {
                meshInstances[i].material = this._originalMaterials[i];
            }
        }
        this._originalMaterials = [];

        // Destroy render targets
        this._destroyRenderTarget(this._reflectionCameraEntity?.camera);
        this._destroyRenderTarget(this._reflectionDepthCameraEntity?.camera);

        // Destroy camera entities
        if (this._reflectionCameraEntity) {
            this._reflectionCameraEntity.destroy();
            this._reflectionCameraEntity = null;
        }
        if (this._reflectionDepthCameraEntity) {
            this._reflectionDepthCameraEntity.destroy();
            this._reflectionDepthCameraEntity = null;
        }

        // Destroy material
        if (this._reflectionMaterial) {
            this._reflectionMaterial.destroy();
            this._reflectionMaterial = null;
        }
    }
}

export { BlurredPlanarReflection };
