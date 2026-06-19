// @config
//
// Dynamic cookie textures with clustered lighting. Four spot lights project cookies onto the chess
// board - two procedural (regenerated every few frames) and two video (updated every frame) - and
// the shared cookie atlas (bottom-left) is re-rendered as their content changes.
//
// @credit
// title: Chess Board
// author: Idmental
// source: https://sketchfab.com/3d-models/chess-board-901eeeca884f4622ac37b7e8f7cb82c3
// license: CC BY 4.0 (http://creativecommons.org/licenses/by/4.0/)

import * as pc from 'playcanvas';

import { deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

// set up and load draco module, as the chess board glb is draco compressed
pc.WasmModule.setConfig('DracoDecoderModule', {
    glueUrl: './assets/wasm/draco/draco.wasm.js',
    wasmUrl: './assets/wasm/draco/draco.wasm.wasm',
    fallbackUrl: './assets/wasm/draco/draco.js'
});

await new Promise((resolve) => {
    pc.WasmModule.getInstance('DracoDecoderModule', () => resolve());
});

const assets = {
    script: new pc.Asset('script', 'script', { url: './scripts/camera/orbit-camera.js' }),
    board: new pc.Asset('board', 'container', { url: './assets/models/chess-board.glb' })
};

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new pc.Mouse(document.body);
createOptions.touch = new pc.TouchDevice(document.body);

createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.LightComponentSystem,
    pc.ScriptComponentSystem
];
createOptions.resourceHandlers = [pc.TextureHandler, pc.ContainerHandler, pc.ScriptHandler];

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

    // enable clustered lighting - this is what routes the cookie textures through the shared cookie
    // atlas (and the code path that this example exercises). It's a temporary API and will change.
    app.scene.clusteredLightingEnabled = true;

    // cookies are disabled by default for clustered lighting, enable them
    const lighting = app.scene.lighting;
    lighting.cookiesEnabled = true;
    lighting.shadowsEnabled = false;

    // resolution of the cookie atlas storing both cookies
    lighting.cookieAtlasResolution = 2048;

    // instantiate the chess board model - the board and its pieces are what the cookies project onto
    const board = assets.board.resource.instantiateRenderEntity({
        castShadows: false,
        receiveShadows: false
    });
    board.setLocalScale(0.25, 0.25, 0.25);
    app.root.addChild(board);

    // ----- cookie 1: a procedurally generated texture, regenerated every few frames -----

    const cookieSize = 256;
    const proceduralCookie = new pc.Texture(app.graphicsDevice, {
        name: 'proceduralCookie',
        width: cookieSize,
        height: cookieSize,
        format: pc.PIXELFORMAT_RGBA8,
        mipmaps: false,
        minFilter: pc.FILTER_LINEAR,
        magFilter: pc.FILTER_LINEAR,
        addressU: pc.ADDRESS_CLAMP_TO_EDGE,
        addressV: pc.ADDRESS_CLAMP_TO_EDGE
    });

    // fill the procedural cookie with an animated radial pattern - 'phase' shifts each regeneration
    // so the content varies but stays recognizable. unlock() uploads it, bumping its uploadVersion.
    const updateProceduralCookie = (phase) => {
        const pixels = proceduralCookie.lock();
        const half = cookieSize * 0.5;
        for (let y = 0; y < cookieSize; y++) {
            for (let x = 0; x < cookieSize; x++) {
                const dx = (x - half) / half;
                const dy = (y - half) / half;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const angle = Math.atan2(dy, dx);

                // moving concentric rings combined with rotating spokes
                const rings = Math.sin(dist * 18.0 - phase * 3.0);
                const spokes = Math.sin(angle * 6.0 + phase * 2.0);
                let v = 0.5 + 0.5 * rings * spokes;

                // circular vignette so the cookie fades to black at the edges
                v *= Math.max(0, 1.0 - dist);

                const c = Math.floor(pc.math.clamp(v, 0, 1) * 255);
                const i = (y * cookieSize + x) * 4;
                pixels[i] = c;
                pixels[i + 1] = c;
                pixels[i + 2] = c;
                pixels[i + 3] = 255;
            }
        }
        proceduralCookie.unlock();
    };
    updateProceduralCookie(0);

    // ----- cookie 2: a video texture, uploaded every frame -----

    const videoCookie = new pc.Texture(app.graphicsDevice, {
        name: 'videoCookie',
        format: pc.PIXELFORMAT_RGBA8,
        mipmaps: false,
        minFilter: pc.FILTER_LINEAR,
        magFilter: pc.FILTER_LINEAR,
        addressU: pc.ADDRESS_CLAMP_TO_EDGE,
        addressV: pc.ADDRESS_CLAMP_TO_EDGE
    });

    /** @type {HTMLVideoElement} */
    const video = document.createElement('video');
    video.id = 'vid';
    video.loop = true;
    video.muted = true;
    video.autoplay = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';

    // keep the video element in view (but invisible) so it loads/plays on all browsers
    video.setAttribute(
        'style',
        'display: block; width: 1px; height: 1px; position: absolute; opacity: 0; z-index: -1000; top: 0px; pointer-events: none'
    );
    video.src = './assets/video/SampleVideo_1280x720_1mb.mp4';
    document.body.append(video);
    const onCanPlay = () => videoCookie.setSource(video);
    video.addEventListener('canplaythrough', onCanPlay);
    video.load();

    // clean up the video when the app is destroyed, so a late 'canplaythrough' does not call
    // setSource on an already torn-down graphics device
    app.on('destroy', () => {
        video.removeEventListener('canplaythrough', onCanPlay);
        video.pause();
        video.remove();
    });

    // ----- four spot lights, one per quadrant of the board -----
    // each light sits just above its quadrant and points straight down, so the four cookies project
    // onto different areas of the board. Two use the procedural cookie, two use the video cookie.
    const quadrantOffset = 11;
    const lightHeight = 20;
    const quadrants = [
        { x: 1, z: 1, cookie: proceduralCookie, color: new pc.Color(1.0, 0.6, 0.3) },
        { x: -1, z: -1, cookie: proceduralCookie, color: new pc.Color(1.0, 0.6, 0.3) },
        { x: 1, z: -1, cookie: videoCookie, color: pc.Color.WHITE },
        { x: -1, z: 1, cookie: videoCookie, color: pc.Color.WHITE }
    ];
    quadrants.forEach((q, i) => {
        const spot = new pc.Entity(`Spot-${i}`);
        spot.addComponent('light', {
            type: 'spot',
            color: q.color,
            intensity: 8,
            innerConeAngle: 15,
            outerConeAngle: 45,
            range: 60,
            castShadows: false,
            cookie: q.cookie,
            cookieChannel: 'rgb',
            cookieIntensity: 1
        });

        // position above the quadrant center and aim straight down (RIGHT as up to avoid a
        // degenerate look-at), then rotate so the spot cone points along -Y
        const x = q.x * quadrantOffset;
        const z = q.z * quadrantOffset;
        spot.setLocalPosition(x, lightHeight, z);
        spot.lookAt(new pc.Vec3(x, 0, z), pc.Vec3.RIGHT);
        spot.rotateLocal(90, 0, 0);
        app.root.addChild(spot);
    });

    // Create an entity with a camera component
    const camera = new pc.Entity('Camera');
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.05, 0.05, 0.05),
        farClip: 500,
        nearClip: 0.1,
        toneMapping: pc.TONEMAP_ACES
    });
    camera.setLocalPosition(0, 50, 70);

    // add orbit camera script with mouse and touch support
    camera.addComponent('script');
    camera.script.create('orbitCamera', {
        attributes: {
            inertiaFactor: 0.2,
            focusEntity: board,
            distanceMax: 200,
            frameOnStart: false
        }
    });
    camera.script.create('orbitCameraInputMouse');
    camera.script.create('orbitCameraInputTouch');
    app.root.addChild(camera);

    let frame = 0;
    let phase = 0;
    app.on('update', () => {
        frame++;

        // regenerate the procedural cookie every 10 frames, with a small variation each time
        if (frame % 10 === 0) {
            phase += 0.35;
            updateProceduralCookie(phase);
        }

        // upload the latest video frame to its cookie texture every frame
        videoCookie.upload();

        // debug: draw the cookie atlas in the corner so the dynamic updates are visible directly
        // @ts-ignore engine-tsd
        app.drawTexture(-0.7, -0.7, 0.4, 0.4, app.renderer.lightTextureAtlas.cookieAtlas);
    });
});
