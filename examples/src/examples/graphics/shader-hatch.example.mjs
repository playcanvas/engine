import { data } from 'examples/observer';
import { deviceType, rootPath, fileImport } from 'examples/utils';
import * as pc from 'playcanvas';

// import the createHatchMaterial function from the hatch-material.mjs file
const { createHatchMaterial } = await fileImport(`${rootPath}/static/assets/scripts/misc/hatch-material.mjs`);

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

// set up and load draco module, as the glb we load is draco compressed
pc.WasmModule.setConfig('DracoDecoderModule', {
    glueUrl: `${rootPath}/static/lib/draco/draco.wasm.js`,
    wasmUrl: `${rootPath}/static/lib/draco/draco.wasm.wasm`,
    fallbackUrl: `${rootPath}/static/lib/draco/draco.js`
});

const assets = {
    script: new pc.Asset('script', 'script', { url: `${rootPath}/static/scripts/camera/orbit-camera.js` }),
    board: new pc.Asset('board', 'container', { url: `${rootPath}/static/assets/models/chess-board.glb` }),

    bitmoji: new pc.Asset('model', 'container', { url: `${rootPath}/static/assets/models/bitmoji.glb` }),
    danceAnim: new pc.Asset('walkAnim', 'container', { url: `${rootPath}/static/assets/animations/bitmoji/win-dance.glb` }),
    morph: new pc.Asset('glb', 'container', { url: `${rootPath}/static/assets/models/morph-stress-test.glb` }),

    // hatch textures, sorted from light to dark
    hatch0: new pc.Asset('hatch0', 'texture', { url: `${rootPath}/static/assets/textures/hatch-0.jpg` }, { srgb: true }),
    hatch1: new pc.Asset('hatch1', 'texture', { url: `${rootPath}/static/assets/textures/hatch-1.jpg` }, { srgb: true }),
    hatch2: new pc.Asset('hatch2', 'texture', { url: `${rootPath}/static/assets/textures/hatch-2.jpg` }, { srgb: true }),
    hatch3: new pc.Asset('hatch3', 'texture', { url: `${rootPath}/static/assets/textures/hatch-3.jpg` }, { srgb: true }),
    hatch4: new pc.Asset('hatch4', 'texture', { url: `${rootPath}/static/assets/textures/hatch-4.jpg` }, { srgb: true }),
    hatch5: new pc.Asset('hatch5', 'texture', { url: `${rootPath}/static/assets/textures/hatch-5.jpg` }, { srgb: true })
};

const gfxOptions = {
    deviceTypes: [deviceType],
    glslangUrl: `${rootPath}/static/lib/glslang/glslang.js`,
    twgslUrl: `${rootPath}/static/lib/twgsl/twgsl.js`
};

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = await pc.createGraphicsDevice(canvas, gfxOptions);
createOptions.mouse = new pc.Mouse(document.body);
createOptions.touch = new pc.TouchDevice(document.body);
createOptions.keyboard = new pc.Keyboard(document.body);

createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.LightComponentSystem,
    pc.ScriptComponentSystem,
    pc.AnimComponentSystem
];

createOptions.resourceHandlers = [
    pc.TextureHandler,
    pc.ContainerHandler,
    pc.ScriptHandler,
    pc.AnimClipHandler,
    pc.AnimStateGraphHandler
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

    // a helper function to apply a material to all mesh instances of an entity
    const applyMaterial = (entity, material) => {
        entity.findComponents('render').forEach((render) => {
            render.meshInstances.forEach((meshInstance) => {
                meshInstance.material = material;
            });
        });
    };

    // Create a new material with a hatch shader. Internally a texture array is created from the hatch textures,
    // as well as a custom shader that is used to render the hatch pattern.
    const material = createHatchMaterial(app.graphicsDevice, [
        assets.hatch0.resource,
        assets.hatch1.resource,
        assets.hatch2.resource,
        assets.hatch3.resource,
        assets.hatch4.resource,
        assets.hatch5.resource
    ]);
    material.setParameter('uDensity', 10);

    // store al materials to allow for easy modification
    const materials = [material];

    // create an instance of the chess-board
    const entity = assets.board.resource.instantiateRenderEntity();
    app.root.addChild(entity);

    // assign the hatch material to all mesh instances of the entity
    applyMaterial(entity, material);

    // create an instance of the morph target model with a clone of the hatch material, and play
    // a morphing animation on it
    const morphMaterial = material.clone();
    morphMaterial.setParameter('uColor', [1, 0.21, 0.4]);
    materials.push(morphMaterial);
    const morphEntity = assets.morph.resource.instantiateRenderEntity();
    app.root.addChild(morphEntity);
    morphEntity.setLocalScale(50, 50, 50);
    morphEntity.setLocalPosition(0, 5, -120);
    morphEntity.addComponent('anim', { activate: true });
    const morphAnimation = assets.morph.resource.animations[1].resource;
    morphEntity.anim.assignAnimation('Default', morphAnimation, undefined, 0.62);
    applyMaterial(morphEntity, morphMaterial);

    // create an inverted skydome, using clone of the hatching material with culling turned off
    // to see it from the inside
    const skyMaterial = material.clone();
    materials.push(skyMaterial);
    skyMaterial.setParameter('uColor', [0.53, 0.81, 0.92]);
    skyMaterial.cull = pc.CULLFACE_NONE;
    skyMaterial.update();

    const skyMesh = pc.Mesh.fromGeometry(app.graphicsDevice, new pc.DomeGeometry({
        latitudeBands: 50,
        longitudeBands: 50
    }));

    const sky = new pc.Entity('Sky');
    sky.addComponent('render', {
        meshInstances: [new pc.MeshInstance(skyMesh, skyMaterial)]
    });
    sky.setLocalScale(1000, 1000, 1000);
    app.root.addChild(sky);

    // animated / morphed bitmoji model
    const bitmojiEntity = assets.bitmoji.resource.instantiateRenderEntity({
        castShadows: false
    });
    bitmojiEntity.setLocalScale(60, 60, 60);
    bitmojiEntity.setLocalPosition(0, 4, -8);
    app.root.addChild(bitmojiEntity);
    const bitmojiMaterial = material.clone();
    materials.push(bitmojiMaterial);
    bitmojiMaterial.setParameter('uColor', [1.0, 0.65, 0.0]);
    applyMaterial(bitmojiEntity, bitmojiMaterial);

    // play the animation
    bitmojiEntity.addComponent('anim', { activate: true });
    const walkTrack = assets.danceAnim.resource.animations[0].resource;
    bitmojiEntity.anim.assignAnimation('Walk', walkTrack, undefined, 0.62);

    // Create an Entity with a camera component
    const camera = new pc.Entity();
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.4, 0.45, 0.5)
    });
    camera.setLocalPosition(30, 30, 30);

    // add orbit camera script to the camera
    camera.addComponent('script');
    camera.script.create('orbitCamera', {
        attributes: {
            inertiaFactor: 0.2,
            focusEntity: entity,
            distanceMax: 250
        }
    });
    camera.script.create('orbitCameraInputMouse');
    camera.script.create('orbitCameraInputTouch');
    app.root.addChild(camera);

    // update things each frame
    let time = 0;
    app.on('update', (dt) => {
        time += dt;

        // generate a light direction that rotates around the scene, and set it on the materials
        const lightDir = new pc.Vec3(Math.sin(time), -0.5, Math.cos(time)).normalize();
        const lightDirArray = [-lightDir.x, -lightDir.y, -lightDir.z];

        materials.forEach((mat) => {
            mat.setParameter('uLightDir', lightDirArray);
            mat.update();
        });
    });

    // handle UI changes
    data.on('*:set', (path, value) => {
        const propertyName = path.split('.')[1];
        if (propertyName === 'color') {
            material.setParameter('uColor', [0.7, value + 0.5, value]);
            material.update();
        }
        if (propertyName === 'tonemapping') {
            // set up selected tone-mapping
            camera.camera.toneMapping = value;
        }
        if (propertyName === 'fog') {
            // turn on/off fog and set up its properties
            app.scene.fog.type = value ? pc.FOG_LINEAR : pc.FOG_NONE;
            app.scene.fog.color = new pc.Color(0.8, 0.8, 0.8);
            app.scene.fog.start = 100;
            app.scene.fog.end = 300;
        }
        if (propertyName === 'metalness') {
            materials.forEach((mat) => {
                mat.setParameter('uMetalness', value);
                mat.update();
            });
        }
        if (propertyName === 'toon') {
            materials.forEach((mat) => {
                // set a define that will be used inside the shader to switch between toon and hatch shading
                mat.setDefine('TOON', value);
                mat.update();
            });
        }
    });

    // initial values
    data.set('data', {
        color: 1,
        metalness: 0.5,
        tonemapping: 0,
        fog: false,
        toon: false
    });
});

export { app };
