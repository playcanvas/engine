import React from 'react';
import * as pc from '../../../../';

import { BindingTwoWay, LabelGroup, Panel, SliderInput, SelectInput, BooleanInput } from '@playcanvas/pcui/react';
import { Observer } from '@playcanvas/observer';
class MeshDisplacementExample {
    static CATEGORY = 'Graphics';
    static NAME = 'Mesh Displacement';
    static WEBGPU_ENABLED = false;

    controls(data: Observer) {
        return <>
            <Panel headerText='Displacement Effect'>
                <LabelGroup text='Enabled'>
                    <BooleanInput id='displacment-effect' binding={new BindingTwoWay()} link={{ observer: data, path: 'script.useDisplacement.enabled' }} />
                </LabelGroup>
                <LabelGroup text='Height Map Factor'>
                    <SliderInput binding={new BindingTwoWay()} link={{ observer: data, path: 'script.useDisplacement.heightMapFactor' }} min={-2.0} max={2.0}/>
                </LabelGroup>
                <LabelGroup text='Displacement Offset'>
                    <SliderInput binding={new BindingTwoWay()} link={{ observer: data, path: 'script.useDisplacement.displacementOffset' }} min={-2.0} max={2.0}/>
                </LabelGroup>
            </Panel>
            <Panel headerText='Point light'>
                <LabelGroup text='Enabled'>
                    <BooleanInput id='point-light' binding={new BindingTwoWay()} link={{ observer: data, path: 'script.point.enabled' }} />
                </LabelGroup>
                <LabelGroup text='Intensity'>
                    <SliderInput binding={new BindingTwoWay()} link={{ observer: data, path: 'script.point.intensity' }} min={0.0} max={32.0}/>
                </LabelGroup>
                <LabelGroup text='Softness'>
                    <SliderInput binding={new BindingTwoWay()} link={{ observer: data, path: 'script.point.size' }} min={0.01} max={32.0}/>
                </LabelGroup>
                <LabelGroup text='Shadows'>
                    <SelectInput binding={new BindingTwoWay()} link={{ observer: data, path: 'script.point.shadowType' }} options={[{ v: pc.SHADOW_PCSS, t: 'PCSS' }, { v: pc.SHADOW_PCF5, t: 'PCF' }]} />
                </LabelGroup>
            </Panel>
        </>;
    }

    example(canvas: HTMLCanvasElement, deviceType: string, data: any): void {

        pc.WasmModule.setConfig('DracoDecoderModule', {
            glueUrl: '/static/lib/draco/draco.wasm.js',
            wasmUrl: '/static/lib/draco/draco.wasm.wasm',
            fallbackUrl: '/static/lib/draco/draco.js'
        });

        pc.WasmModule.getInstance('DracoDecoderModule', demo);


        function demo() {

            const assets = {
                orbitCamera: new pc.Asset('script', 'script', { url: '/static/scripts/camera/orbit-camera.js' }),
                helipad: new pc.Asset('helipad-env-atlas', 'texture', { url: '/static/assets/cubemaps/helipad-env-atlas.png' }, { type: pc.TEXTURETYPE_RGBP, mipmaps: false }),
                asset: new pc.Asset('asset', 'container', { url: '/static/assets/models/robot-arm.glb' }),
                normal: new pc.Asset("normal", "texture", { url: "/static/assets/textures/seaside-rocks01-normal.jpg" }),
                diffuse: new pc.Asset("diffuse", "texture", { url: "/static/assets/textures/seaside-rocks01-color.jpg" }),
                other: new pc.Asset("other", "texture", { url: "/static/assets/textures/seaside-rocks01-gloss.jpg" }),
                height: new pc.Asset("other", "texture", { url: "/static/assets/textures/seaside-rocks01-gloss.jpg" })
            };

            const gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js'
            };

            pc.createGraphicsDevice(canvas, gfxOptions).then((device: pc.GraphicsDevice) => {

                const createOptions = new pc.AppOptions();
                createOptions.graphicsDevice = device;
                createOptions.keyboard = new pc.Keyboard(document.body);
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
                    pc.ScriptComponentSystem,
                    // @ts-ignore
                    pc.AnimComponentSystem
                ];
                createOptions.resourceHandlers = [
                    // @ts-ignore
                    pc.TextureHandler,
                    // @ts-ignore
                    pc.ContainerHandler,
                    // @ts-ignore
                    pc.ScriptHandler,
                    // @ts-ignore
                    pc.JsonHandler,
                    // @ts-ignore
                    pc.AnimClipHandler,
                    // @ts-ignore
                    pc.AnimStateGraphHandler
                ];

                const app = new pc.AppBase(canvas);
                app.init(createOptions);

                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc.RESOLUTION_AUTO);

                const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
                assetListLoader.load(() => {

                    app.start();

                    app.scene.toneMapping = pc.TONEMAP_ACES;
                    app.scene.skyboxMip = 1;
                    app.scene.ambientLight.set(0, 0, 0);
                    app.scene.ambientLuminance = 0;
                    app.scene.setSkybox(assets.helipad.resources);

                    // enable area lights which are disabled by default for clustered lighting
                    app.scene.clusteredLightingEnabled = false;
                    app.scene.skyboxIntensity = 0.1;

                    const planeMaterial = new pc.StandardMaterial();
                    planeMaterial.gloss = 0.0;
                    planeMaterial.metalness = 0.7;
                    planeMaterial.useMetalness = true;
                    planeMaterial.update();

                    const plane = new pc.Entity();
                    plane.addComponent('render', {
                        type: 'plane',
                        material: planeMaterial
                    });
                    plane.setLocalScale(new pc.Vec3(100, 0, 100));
                    plane.setLocalPosition(0, 0, 0);
                    app.root.addChild(plane);

                    data.set('script', {
                        point: {
                            enabled: true,
                            intensity: 4.0,
                            size: 32,
                            shadowType: pc.SHADOW_PCSS
                        },
                        useDisplacement: {
                            enabled: true,
                            heightMapFactor: -0.25,
                            displacementOffset: 0.2
                        }
                    });


                    const createSphere = function (x: number, y: number, z: number, material: pc.Material, hiDef: boolean) {
                        const sphere = new pc.Entity();
                        sphere.addComponent("render", {
                            material: material,
                            type: "sphere"
                        });
                        if (hiDef) {
                            const sphereHidef = pc.createSphere(device, {
                                radius: 0.5,
                                latitudeBands: 512,
                                longitudeBands: 512,
                                calculateTangents: true
                            });
                            sphere.render.meshInstances[0].mesh = sphereHidef;
                        }

                        sphere.setLocalPosition(x, y, z);
                        sphere.setLocalScale(3.0, 3.0, 3.0);
                        app.root.addChild(sphere);
                    };

                    const material = new pc.StandardMaterial();
                    material.diffuseMap = assets.diffuse.resource;
                    material.metalnessMap = assets.other.resource;
                    material.metalnessMapChannel = "r";
                    material.glossMap = assets.other.resource;
                    material.glossMapChannel = "g";
                    material.normalMap = assets.normal.resource;
                    material.diffuse = new pc.Color(0.6, 0.6, 0.9);
                    material.diffuseTint = true;
                    material.metalness = 0.6;
                    material.gloss = 0.8;
                    material.bumpiness = 0.7;
                    material.useMetalness = true;
                    material.heightMap = assets.height.resource;
                    material.heightMapFactor = data.get('script.useDisplacement.heightMapFactor');
                    material.useDisplacement = data.get('script.useDisplacement.enabled');
                    material.displacementOffset = data.get('script.useDisplacement.displacementOffset');
                    const tiling = new pc.Vec2(2, 2);
                    material.heightMapTiling = tiling;
                    material.diffuseMapTiling = tiling;
                    material.metalnessMapTiling = tiling;
                    material.glossMapTiling = tiling;
                    material.normalMapTiling = tiling;
                    material.update();

                    const sphere = createSphere(0, 2.5, 0, material, true);

                    app.scene.envAtlas = assets.helipad.resource;

                    const lightOmni = new pc.Entity("Omni");
                    lightOmni.addComponent("light", {
                        type: "omni",
                        color: new pc.Color(1, 1, 1),
                        range: 25,
                        penumbraSize: data.get('script.point.size'),
                        shadowType: data.get('script.point.shadowType'),
                        intensity: data.get('script.point.intensity'),
                        castShadows: true,
                        shadowBias: 0.01,
                        normalOffsetBias: 0.01,
                        shadowResolution: 2048
                    });
                    lightOmni.setLocalPosition(-4, 7, 0);

                    const omniMaterial = new pc.StandardMaterial();
                    omniMaterial.emissive = lightOmni.light.color;
                    omniMaterial.emissiveIntensity = lightOmni.light.intensity;
                    omniMaterial.useLighting = false;
                    omniMaterial.cull = pc.CULLFACE_NONE;
                    omniMaterial.update();

                    const omniShape = new pc.Entity();
                    omniShape.addComponent("render", {
                        type: "sphere",
                        material: omniMaterial,
                        castShadows: false
                    });
                    omniShape.setLocalScale(0.2, 0.2, 0.2);
                    lightOmni.addChild(omniShape);
                    app.root.addChild(lightOmni);

                    // Create an Entity with a camera component
                    const camera = new pc.Entity();
                    camera.addComponent("camera", {
                        clearColor: new pc.Color(0.4, 0.45, 0.5)
                    });
                    camera.setLocalPosition(0, 5, 11);

                    camera.camera.requestSceneColorMap(true);
                    camera.addComponent("script");
                    camera.script.create("orbitCamera", {
                        attributes: {
                            inertiaFactor: 0.2,
                            focusEntity: sphere,
                            distanceMax: 500,
                            frameOnStart: false
                        }
                    });
                    camera.script.create("orbitCameraInputMouse");
                    camera.script.create("orbitCameraInputTouch");
                    app.root.addChild(camera);

                    data.on('*:set', (path: string, value: any) => {
                        switch (path) {
                            case 'script.point.enabled':
                                lightOmni.enabled = value;
                                break;
                            case 'script.point.intensity':
                                lightOmni.light.intensity = value;
                                break;
                            case 'script.point.size':
                                lightOmni.light.penumbraSize = value;
                                break;
                            case 'script.point.shadowType':
                                lightOmni.light.shadowType = parseInt(value);
                                break;
                        }
                    });

                    let resizeControlPanel = true;
                    app.on("update", function (dt) {
                        // update material options
                        material.heightMapFactor = data.get('script.useDisplacement.heightMapFactor');
                        material.useDisplacement = data.get('script.useDisplacement.enabled');
                        material.displacementOffset = data.get('script.useDisplacement.displacementOffset');

                        material.update();

                        // resize control panel to fit the content better
                        if (resizeControlPanel) {
                            const panel = window.top.document.getElementById('controlPanel');
                            if (panel) {
                                panel.style.width = '360px';
                                resizeControlPanel = false;
                            }
                        }
                    });
                });
            });
        }
    }
}

export default MeshDisplacementExample;
