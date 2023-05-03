import React from 'react';
import * as pc from '../../../../';
import { BindingTwoWay, LabelGroup, Panel, SelectInput } from '@playcanvas/pcui/react';
import { Observer } from '@playcanvas/observer';

class MultiViewExample {
    static CATEGORY = 'Graphics';
    static NAME = 'Multi View';
    static WEBGPU_ENABLED = true;

    controls(data: Observer) {
        return <>
            <Panel headerText='Debug Shader Rendering'>
                {<LabelGroup text='Mode'>
                    <SelectInput binding={new BindingTwoWay()} link={{ observer: data, path: 'settings.shaderPassName' }} type="string" options={[
                        { v: pc.SHADERPASS_FORWARD, t: 'Normal' },
                        { v: pc.SHADERPASS_ALBEDO, t: 'Albedo' },
                        { v: pc.SHADERPASS_OPACITY, t: 'Opacity' },
                        { v: pc.SHADERPASS_WORLDNORMAL, t: 'World Normal' },
                        { v: pc.SHADERPASS_SPECULARITY, t: 'Specularity' },
                        { v: pc.SHADERPASS_GLOSS, t: 'Gloss' },
                        { v: pc.SHADERPASS_METALNESS, t: 'Metalness' },
                        { v: pc.SHADERPASS_AO, t: 'AO' },
                        { v: pc.SHADERPASS_EMISSION, t: 'Emission' },
                        { v: pc.SHADERPASS_LIGHTING, t: 'Lighting' },
                        { v: pc.SHADERPASS_UV0, t: 'UV0' }
                    ]} />
                </LabelGroup>}
            </Panel>
        </>;
    }

    example(canvas: HTMLCanvasElement, deviceType: string, data: any): void {

        // set up and load draco module, as the glb we load is draco compressed
        pc.WasmModule.setConfig('DracoDecoderModule', {
            glueUrl: '/static/lib/draco/draco.wasm.js',
            wasmUrl: '/static/lib/draco/draco.wasm.wasm',
            fallbackUrl: '/static/lib/draco/draco.js'
        });

        pc.WasmModule.getInstance('DracoDecoderModule', demo);

        function demo() {
            const assets = {
                'script': new pc.Asset('script', 'script', { url: '/static/scripts/camera/orbit-camera.js' }),
                'helipad': new pc.Asset('helipad-env-atlas', 'texture', { url: '/static/assets/cubemaps/helipad-env-atlas.png' }, { type: pc.TEXTURETYPE_RGBP, mipmaps: false }),
                'board': new pc.Asset('statue', 'container', { url: '/static/assets/models/chess-board.glb' })
            };

            const gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js'
            };

            pc.createGraphicsDevice(canvas, gfxOptions).then((device: pc.GraphicsDevice) => {

                const createOptions = new pc.AppOptions();
                createOptions.graphicsDevice = device;
                createOptions.mouse = new pc.Mouse(document.body);
                createOptions.touch = new pc.TouchDevice(document.body);

                createOptions.componentSystems = [
                    // @ts-ignore
                    pc.RenderComponentSystem,
                    // @ts-ignore
                    pc.CameraComponentSystem,
                    // @ts-ignore
                    pc.LightComponentSystem,
                    // @ts-ignore
                    pc.ScriptComponentSystem
                ];
                createOptions.resourceHandlers = [
                    // @ts-ignore
                    pc.TextureHandler,
                    // @ts-ignore
                    pc.ContainerHandler,
                    // @ts-ignore
                    pc.ScriptHandler
                ];

                const app = new pc.AppBase(canvas);
                app.init(createOptions);

                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc.RESOLUTION_AUTO);

                const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
                assetListLoader.load(() => {

                    app.start();

                    data.set('settings', {
                        shaderPassName: pc.SHADERPASS_FORWARD
                    });

                    // get the instance of the chess board and set up with render component
                    const boardEntity = assets.board.resource.instantiateRenderEntity({
                        castShadows: true,
                        receiveShadows: true
                    });
                    app.root.addChild(boardEntity);

                    // Create left camera
                    const cameraLeft = new pc.Entity('LeftCamera');
                    cameraLeft.addComponent("camera", {
                        farClip: 500,
                        rect: new pc.Vec4(0, 0, 0.5, 0.5)
                    });
                    app.root.addChild(cameraLeft);

                    // Create right orthographic camera
                    const cameraRight = new pc.Entity('RightCamera');
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
                    const cameraTop = new pc.Entity('TopCamera');
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
                    app.scene.envAtlas = assets.helipad.resource;
                    app.scene.toneMapping = pc.TONEMAP_ACES;
                    app.scene.skyboxMip = 1;

                    // handle HUD changes - update the debug mode on the top camera
                    data.on('*:set', (path: string, value: any) => {
                        cameraTop.camera.setShaderPass(value);
                    });

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
            });
        }
    }
}

export default MultiViewExample;
