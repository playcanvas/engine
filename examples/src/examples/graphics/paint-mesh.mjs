import * as pc from 'playcanvas';

/**
 * @typedef {{ 'shader.vert': string, 'shader.frag': string }} Files
 * @typedef {import('../../options.mjs').ExampleOptions<Files>} Options
 * @param {Options} options - The example options.
 * @returns {Promise<pc.AppBase>} The example application.
 */
async function example({ canvas, files, deviceType, assetPath, glslangPath, twgslPath }) {

    // load the textures
    const assets = {
        'helipad': new pc.Asset('helipad.dds', 'cubemap', { url: assetPath + 'cubemaps/helipad.dds' }, { type: pc.TEXTURETYPE_RGBM }),
        'color': new pc.Asset('color', 'texture', { url: assetPath + 'textures/seaside-rocks01-color.jpg' }),
        'decal': new pc.Asset('color', 'texture', { url: assetPath + 'textures/heart.png' })
    };

    const gfxOptions = {
        deviceTypes: [deviceType],
        glslangUrl: glslangPath + 'glslang.js',
        twgslUrl: twgslPath + 'twgsl.js'
    };

    const device = await pc.createGraphicsDevice(canvas, gfxOptions);
    const createOptions = new pc.AppOptions();
    createOptions.graphicsDevice = device;

    createOptions.componentSystems = [
        pc.RenderComponentSystem,
        pc.CameraComponentSystem,
        pc.LightComponentSystem
    ];
    createOptions.resourceHandlers = [
        // @ts-ignore
        pc.TextureHandler,
        // @ts-ignore
        pc.CubemapHandler
    ];

    const app = new pc.AppBase(canvas);
    app.init(createOptions);

    // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
    app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
    app.setCanvasResolution(pc.RESOLUTION_AUTO);

    // Ensure canvas is resized when window changes size
    const resize = () => app.resizeCanvas();
    window.addEventListener('resize', resize);
    app.on('destroy', () => {
        window.removeEventListener('resize', resize);
    });

    const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
    assetListLoader.load(() => {

        app.start();

        app.scene.setSkybox(assets.helipad.resources);
        app.scene.toneMapping = pc.TONEMAP_ACES;
        app.scene.skyboxIntensity = 1;
        app.scene.skyboxMip = 2;

        /**
         * helper function to create high polygon version of a sphere and sets up an entity to allow it to be added to the scene
         * @param {pc.Material} material - The material.
         * @param {number[]} layer - The render component's layers.
         * @returns {pc.Entity} The returned entity.
         */
        const createHighQualitySphere = function (material, layer) {

            // Create Entity and add it to the scene
            const entity = new pc.Entity("HighResSphere");
            app.root.addChild(entity);

            // create hight resolution sphere
            const mesh = pc.createSphere(app.graphicsDevice, { latitudeBands: 200, longitudeBands: 200 });

            // Add a render component with the mesh
            entity.addComponent('render', {
                type: 'asset',
                layers: layer,
                meshInstances: [new pc.MeshInstance(mesh, material)]
            });

            return entity;
        };

        // We render decals to a texture, so create a render target for it. Note that the texture needs
        // to be of renderable format here, and so it cannot be compressed.
        const texture = assets.color.resource;
        const renderTarget = new pc.RenderTarget({
            colorBuffer: texture,
            depth: false
        });

        // create a layer for rendering to decals
        const decalLayer = new pc.Layer({ name: "decalLayer" });
        app.scene.layers.insert(decalLayer, 0);

        // Create a camera, which renders decals using a decalLayer, and renders before the main camera
        // Note that this camera does not need its position set, as it's only used to trigger
        // the rendering, but the camera matrix is not used for the rendering (our custom shader
        // does not need it).
        const decalCamera = new pc.Entity('DecalCamera');
        decalCamera.addComponent("camera", {
            clearColorBuffer: false,
            layers: [decalLayer.id],
            renderTarget: renderTarget,
            priority: -1
        });
        app.root.addChild(decalCamera);

        // Create main camera, which renders entities in world layer - this is where we show mesh with decals
        const camera = new pc.Entity('MainCamera');
        camera.addComponent("camera", {
            clearColor: new pc.Color(0.1, 0.1, 0.1, 1)
        });
        camera.translate(20, 10, 40);
        camera.lookAt(new pc.Vec3(0, -7, 0));
        app.root.addChild(camera);

        // material used on the sphere
        const material = new pc.StandardMaterial();
        material.diffuseMap = texture;
        material.gloss = 0.6;
        material.metalness = 0.4;
        material.useMetalness = true;
        material.update();

        // sphere with the texture
        const worldLayer = app.scene.layers.getLayerByName("World");
        const meshEntity = createHighQualitySphere(material, [worldLayer.id]);
        meshEntity.setLocalScale(15, 15, 15);

        // Create the shader from the vertex and fragment shaders
        const shader = pc.createShaderFromCode(app.graphicsDevice, files['shader.vert'], files['shader.frag'], 'myShader', {
            aPosition: pc.SEMANTIC_POSITION,
            aUv0: pc.SEMANTIC_TEXCOORD0
        });

        // Create a decal material with the new shader
        const decalMaterial = new pc.Material();
        decalMaterial.cull = pc.CULLFACE_NONE;
        decalMaterial.shader = shader;
        decalMaterial.blendType = pc.BLEND_NORMAL;
        decalMaterial.setParameter('uDecalMap', assets.decal.resource);

        // To render into uv space of the mesh, we need to render the mesh using our custom shader into
        // the texture. In order to do this, we creates a new entity, containing the same mesh instances,
        // but using our custom shader. We make it a child of the original entity, to use its transform.
        const meshInstances = meshEntity.render.meshInstances.map((srcMeshInstance) => {
            return new pc.MeshInstance(srcMeshInstance.mesh, decalMaterial);
        });
        const cloneEntity = new pc.Entity('cloneEntity');
        cloneEntity.addComponent('render', {
            meshInstances: meshInstances,
            layers: [decalLayer.id],
            castShadows: false,
            receiveShadows: false
        });
        meshEntity.addChild(cloneEntity);

        // Create an entity with a directional light component
        const light = new pc.Entity();
        light.addComponent("light", {
            type: "directional",
            intensity: 3
        });
        app.root.addChild(light);
        light.setLocalEulerAngles(45, 90, 0);

        // update things each frame
        let time = 0;
        let decalTime = 0;
        const decalFrequency = 0.5;
        app.on("update", function (dt) {
            time += dt * 0.7;

            // a decal projection box is an orthographic projection from some position. We calculate position
            // here to be in an orbit around the sphere. Draw a line showing the projection point and direction.
            const decalProjectionPos = new pc.Vec3(8 * Math.cos(time), 8 * Math.cos(time * 0.3), 8 * Math.sin(time));
            app.drawLine(decalProjectionPos, pc.Vec3.ZERO, pc.Color.WHITE);

            // render recal every half a second
            decalTime += dt;
            if (decalTime > decalFrequency) {
                decalTime -= decalFrequency;

                // enable decal camera, which renders the decal
                decalCamera.enabled = true;

                // construct a view matrix, looking from the decal position to the center of the sphere
                const viewMatrix = new pc.Mat4().setLookAt(decalProjectionPos, pc.Vec3.ZERO, pc.Vec3.UP);
                viewMatrix.invert();

                // ortographics projection matrix - this defines the size of the decal, but also its depth range (0..5)
                const projMatrix = new pc.Mat4().setOrtho(-1, 1, -1, 1, 0, 5);

                // final matrix is a combination of view and projection matrix. Make it available to the shader.
                const viewProj = new pc.Mat4();
                viewProj.mul2(projMatrix, viewMatrix);
                decalMaterial.setParameter('matrix_decal_viewProj', viewProj.data);
            } else {
                // otherwise the decal camera is disabled
                decalCamera.enabled = false;
            }

            // draw the texture we render decals to for demonstration purposes
            // @ts-ignore engine-tsd
            app.drawTexture(0, -0.6, 1.4, 0.6, texture);

        });
    });
    return app;
}

export class PaintMeshExample {
    static CATEGORY = 'Graphics';
    static WEBGPU_ENABLED = true;
    static FILES = {
        'shader.vert': /* glsl */`
            // Attributes per vertex: position and uv
            attribute vec4 aPosition;
            attribute vec2 aUv0;
        
            // model matrix of the mesh
            uniform mat4 matrix_model;

            // decal view-projection matrix (orthographic)
            uniform mat4 matrix_decal_viewProj;

            // decal projected position to fragment program
            varying vec4 decalPos;

            void main(void)
            {
                // handle upside-down uv coordinates on WebGPU
                vec2 uv = getImageEffectUV(aUv0);

                // We render in texture space, so a position of this fragment is its uv-coordinates.
                // Change the range of uv coordinates from 0..1 to projection space -1 to 1.
                gl_Position = vec4(uv.x * 2.0 - 1.0, uv.y * 2.0 - 1.0, 0, 1.0);

                // transform the vertex position to world space and then to decal space, and pass it
                // to the fragment shader to sample the decal texture
                vec4 worldPos = matrix_model * aPosition;
                decalPos = matrix_decal_viewProj * worldPos;
            }`,

        'shader.frag': /* glsl */`
            precision lowp float;
            varying vec4 decalPos;
            uniform sampler2D uDecalMap;

            void main(void)
            {
                // decal space position from -1..1 range, to texture space range 0..1
                vec4 p = decalPos * 0.5 + 0.5;
 
                // if the position is outside out 0..1 projection box, ignore the pixel
                if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0 || p.z < 0.0 || p.z > 1.0)
                    discard;

                gl_FragColor = texture2D(uDecalMap, p.xy);
            }`
    };
    static example = example;
}
