import * as pc from '../../../../';

class MultiViewExample {
    static CATEGORY = 'Graphics';
    static NAME = 'Multi View';

    example(canvas: HTMLCanvasElement): void {

        // Create the app and start the update loop
        const app = new pc.Application(canvas, {
            mouse: new pc.Mouse(document.body),
            touch: new pc.TouchDevice(document.body)
        });

        const assets = {
            'script': new pc.Asset('script', 'script', { url: '/static/scripts/camera/orbit-camera.js' }),
            'helipad.dds': new pc.Asset('helipad.dds', 'cubemap', { url: '/static/assets/cubemaps/helipad.dds' }, { type: pc.TEXTURETYPE_RGBM }),
            'board': new pc.Asset('statue', 'container', { url: '/static/assets/models/chess-board.glb' })
        };

        const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
        assetListLoader.load(() => {

            // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
            app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
            app.setCanvasResolution(pc.RESOLUTION_AUTO);

            app.start();

            // get the instance of the chess board and set up with render component
            const boardEntity = assets.board.resource.instantiateRenderEntity({
                castShadows: true,
                receiveShadows: true
            });
            app.root.addChild(boardEntity);

            // Create left camera
            const cameraLeft = new pc.Entity();
            cameraLeft.addComponent("camera", {
                farClip: 500,
                rect: new pc.Vec4(0, 0, 0.5, 0.5)
            });
            app.root.addChild(cameraLeft);

            // Create right orthographic camera
            const cameraRight = new pc.Entity();
            cameraRight.addComponent("camera", {
                farClip: 500,
                rect: new pc.Vec4(0.5, 0, 0.5, 0.5),
                projection: pc.PROJECTION_ORTHOGRAPHIC,
                orthoHeight: 150
            });
            cameraRight.translate(0, 150, 0);
            cameraRight.lookAt(pc.Vec3.ZERO, pc.Vec3.RIGHT);
            app.root.addChild(cameraRight);

            // Create top camera
            const cameraTop = new pc.Entity();
            cameraTop.addComponent("camera", {
                farClip: 500,
                rect: new pc.Vec4(0, 0.5, 1, 0.5)
            });
            cameraTop.translate(-100, 75, 100);
            cameraTop.lookAt(0, 7, 0);
            app.root.addChild(cameraTop);

            // add orbit camera script with a mouse and a touch support
            cameraTop.addComponent("script");
            cameraTop.script.create("orbitCamera", {
                attributes: {
                    inertiaFactor: 0.2,
                    focusEntity: app.root,
                    distanceMax: 300,
                    frameOnStart: false
                }
            });
            cameraTop.script.create("orbitCameraInputMouse");
            cameraTop.script.create("orbitCameraInputTouch");

            // Create a single directional light which casts shadows
            const dirLight = new pc.Entity();
            dirLight.addComponent("light", {
                type: "directional",
                color: pc.Color.WHITE,
                intensity: 2,
                range: 500,
                shadowDistance: 500,
                castShadows: true,
                shadowBias: 0.2,
                normalOffsetBias: 0.05
            });
            app.root.addChild(dirLight);
            dirLight.setLocalEulerAngles(45, 0, 30);

            // set skybox - this DDS file was 'prefiltered' in the PlayCanvas Editor and then downloaded.
            app.scene.setSkybox(assets["helipad.dds"].resources);
            app.scene.toneMapping = pc.TONEMAP_ACES;
            app.scene.skyboxMip = 1;

            // update function called once per frame
            let time = 0;
            app.on("update", function (dt) {
                time += dt;

                // orbit camera left around
                cameraLeft.setLocalPosition(100 * Math.sin(time * 0.2), 35, 100 * Math.cos(time * 0.2));
                cameraLeft.lookAt(pc.Vec3.ZERO);

                // zoom in and out the orthographic camera
                cameraRight.camera.orthoHeight = 90 + Math.sin(time * 0.3) * 60;
            });
        });
    }
}

export default MultiViewExample;
