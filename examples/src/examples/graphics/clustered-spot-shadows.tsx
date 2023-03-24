import React from 'react';
import * as pc from '../../../../';

import { BindingTwoWay, BooleanInput, Button, Label, LabelGroup, Panel, SelectInput, SliderInput } from '@playcanvas/pcui/react';
import { Observer } from '@playcanvas/observer';

class ClusteredSpotShadowsExample {
    static CATEGORY = 'Graphics';
    static NAME = 'Clustered Spot Shadows';
    static ENGINE = 'DEBUG';
    static WEBGPU_ENABLED = true;

    controls(data: Observer) {
        return <>
            <Panel headerText='Atlas'>
                <LabelGroup text='Resolution'>
                    <SliderInput binding={new BindingTwoWay()} link={{ observer: data, path: 'settings.shadowAtlasResolution' }} min={256} max={4096} precision={0}/>
                </LabelGroup>
                {<LabelGroup text='Split'>
                    <SelectInput binding={new BindingTwoWay()} link={{ observer: data, path: 'settings.atlasSplit' }} type="number" options={[
                        { v: 0, t: 'Automatic' },
                        { v: 1, t: '7 Shadows' },
                        { v: 2, t: '12 Shadows' },
                        { v: 3, t: '16 Shadows' }
                    ]} />
                </LabelGroup>}
                {<LabelGroup text='Filter'>
                    <SelectInput binding={new BindingTwoWay()} link={{ observer: data, path: 'settings.shadowType' }} type="number" options={[
                        { v: pc.SHADOW_PCF1, t: 'PCF1' },
                        { v: pc.SHADOW_PCF3, t: 'PCF3' },
                        { v: pc.SHADOW_PCF5, t: 'PCF5' }
                    ]} />
                </LabelGroup>}
            </Panel>
            <Panel headerText='Lights'>
                <LabelGroup text='Shadows On'>
                    <BooleanInput type='toggle' binding={new BindingTwoWay()} link={{ observer: data, path: 'settings.shadowsEnabled' }} value={data.get('settings.shadowsEnabled')}/>
                </LabelGroup>
                <LabelGroup text='Cookies On'>
                    <BooleanInput type='toggle' binding={new BindingTwoWay()} link={{ observer: data, path: 'settings.cookiesEnabled' }} value={data.get('settings.cookiesEnabled')}/>
                </LabelGroup>
                <LabelGroup text='Static'>
                    <BooleanInput type='toggle' binding={new BindingTwoWay()} link={{ observer: data, path: 'settings.static' }} value={data.get('settings.static')}/>
                </LabelGroup>
                <LabelGroup text='Shadow Intensity'>
                    <SliderInput binding={new BindingTwoWay()} link={{ observer: data, path: 'settings.shadowIntensity' }} min={0} max={1} value={data.get('settings.shadowIntensity')}/>
                </LabelGroup>
                <Button text='Add Light' onClick={() => data.emit('add')}/>
                <Button text='Remove Light' onClick={() => data.emit('remove')}/>
                <LabelGroup text='Light Count'>
                    <Label binding={new BindingTwoWay()} link={{ observer: data, path: 'settings.numLights' }} value={data.get('settings.numLights')}/>
                </LabelGroup>
            </Panel>
            <Panel headerText='Debug'>
                <LabelGroup text='Cells'>
                    <BooleanInput type='toggle' binding={new BindingTwoWay()} link={{ observer: data, path: 'settings.debug' }} value={data.get('settings.debug')}/>
                </LabelGroup>
                <LabelGroup text='Atlas'>
                    <BooleanInput type='toggle' binding={new BindingTwoWay()} link={{ observer: data, path: 'settings.debugAtlas' }} value={data.get('settings.debugAtlas')}/>
                </LabelGroup>
            </Panel>
        </>;
    }

    example(canvas: HTMLCanvasElement, deviceType: string, data: any): void {

        const assets = {
            'script': new pc.Asset('script', 'script', { url: '/static/scripts/camera/orbit-camera.js' }),
            "channels": new pc.Asset("channels", "texture", { url: "/static/assets/textures/channels.png" }),
            "heart": new pc.Asset("heart", "texture", { url: "/static/assets/textures/heart.png" }),
            'normal': new pc.Asset('normal', 'texture', { url: '/static/assets/textures/normal-map.png' }),
            helipad: new pc.Asset('helipad-env-atlas', 'texture', { url: '/static/assets/cubemaps/helipad-env-atlas.png' }, { type: pc.TEXTURETYPE_RGBP })
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
                    shadowAtlasResolution: 1024,     // shadow map resolution storing all shadows
                    shadowType: pc.SHADOW_PCF3,      // shadow filter type
                    shadowsEnabled: true,
                    cookiesEnabled: true,
                    shadowIntensity: 1,
                    numLights: 0,
                    debug: false,
                    debugAtlas: false,
                    splitOptions: 0,
                    static: false
                });

                // setup skydome as ambient light
                app.scene.skyboxMip = 3;
                app.scene.skyboxIntensity = 0.1;
                app.scene.envAtlas = assets.helipad.resource;

                // enabled clustered lighting. This is a temporary API and will change in the future
                app.scene.clusteredLightingEnabled = true;

                // adjust default clustered lighting parameters to handle many lights
                const lighting = app.scene.lighting;

                // 1) subdivide space with lights into this many cells
                lighting.cells = new pc.Vec3(12, 4, 12);

                // 2) and allow this many lights per cell
                const maxLights = 24;
                lighting.maxLightsPerCell = maxLights;

                // enable clustered shadows (it's enabled by default as well)
                lighting.shadowsEnabled = data.get('settings.shadowsEnabled');

                // enable clustered cookies
                lighting.cookiesEnabled = data.get('settings.cookiesEnabled');

                // resolution of the shadow and cookie atlas
                lighting.shadowAtlasResolution = data.get('settings.shadowAtlasResolution');
                lighting.cookieAtlasResolution = 1500;

                const splitOptions = [
                    null,               // automatic - split atlas each frame to give all required lights an equal size
                    [2, 1, 1, 2, 1],    // 7 shadows: split atlas to 2x2 (first number), and split created quarters to 1x1, 1x1, 2x2, 1x1
                    [3, 2],             // 12 shadows: split atlas to 3x3 (first number), and split one of the created parts to 2x2
                    [4]                 // 16 shadows: split atlas to 4x4
                ];

                // lights are static (not moving and so do not need to update shadows) or dynamic
                let lightsStatic = false;

                // debug rendering is enabled
                let debugAtlas = false;

                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc.RESOLUTION_AUTO);

                window.addEventListener("resize", function () {
                    app.resizeCanvas(canvas.width, canvas.height);
                });

                // ground material
                const groundMaterial = new pc.StandardMaterial();
                groundMaterial.gloss = 0.55;
                groundMaterial.metalness = 0.4;
                groundMaterial.useMetalness = true;
                groundMaterial.normalMap = assets.normal.resource;
                groundMaterial.normalMapTiling.set(10, 10);
                groundMaterial.bumpiness = 0.5;
                groundMaterial.update();

                // cube material
                const cubeMaterial = new pc.StandardMaterial();
                cubeMaterial.gloss = 0.55;
                cubeMaterial.metalness = 0.4;
                cubeMaterial.useMetalness = true;
                cubeMaterial.normalMap = assets.normal.resource;
                cubeMaterial.normalMapTiling.set(0.25, 0.25);
                cubeMaterial.bumpiness = 0.5;
                cubeMaterial.update();

                // helper function to create a 3d primitive including its material
                function createPrimitive(primitiveType: string, position: pc.Vec3, scale: pc.Vec3, mat: pc.Material) {

                    // create the primitive using the material
                    const primitive = new pc.Entity();
                    primitive.addComponent('render', {
                        type: primitiveType,
                        castShadows: true,
                        material: mat
                    });

                    // set position and scale and add it to scene
                    primitive.setLocalPosition(position);
                    primitive.setLocalScale(scale);
                    app.root.addChild(primitive);

                    return primitive;
                }

                // create some visible geometry
                const ground = createPrimitive("box", new pc.Vec3(0, 0, 0), new pc.Vec3(500, 1, 500), groundMaterial);

                const numTowers = 8;
                for (let i = 0; i < numTowers; i++) {
                    let scale = 12;
                    const fraction = i / numTowers * Math.PI * 2;
                    const radius = 200;
                    const numCubes = 12;
                    for (let y = 0; y <= 10; y++) {
                        const elevationRadius = radius * (1 - (y / numCubes));
                        const pos = new pc.Vec3(elevationRadius * Math.sin(fraction), y * 6, elevationRadius * Math.cos(fraction));
                        const prim = createPrimitive("box", pos, new pc.Vec3(scale, scale, scale), cubeMaterial);
                        prim.setLocalEulerAngles(Math.random() * 360, Math.random() * 360, Math.random() * 360);
                    }
                    scale -= 1.5;
                }

                const spotLightList: Array<pc.Entity> = [];
                const cookieChannels = ["r", "g", "b", "a", "rgb"];

                // helper function to create a light
                function createLight(index: number) {
                    const intensity = 1.5;
                    const color = new pc.Color(intensity * Math.random(), intensity * Math.random(), intensity * Math.random(), 1);
                    const lightSpot = new pc.Entity(`Spot-${index}`);
                    const heartTexture = Math.random() < 0.5;
                    const cookieTexture = heartTexture ? assets.heart : assets.channels;
                    const cookieChannel = heartTexture ? "a" : cookieChannels[Math.floor(Math.random() * cookieChannels.length)];

                    lightSpot.addComponent("light", {
                        type: "spot",
                        color: color,
                        intensity: 3,
                        innerConeAngle: 30,
                        outerConeAngle: 35,
                        range: 150,
                        castShadows: true,
                        shadowBias: 0.4,
                        normalOffsetBias: 0.1,
                        shadowResolution: 512,      // only used when clustering is off

                        // when lights are static, only render shadows one time (or as needed when they use different atlas slot)
                        shadowUpdateMode: lightsStatic ? pc.SHADOWUPDATE_THISFRAME : pc.SHADOWUPDATE_REALTIME,

                        // cookie texture
                        cookie: cookieTexture.resource,
                        cookieChannel: cookieChannel,
                        cookieIntensity: 0.5
                    });

                    // attach a render component with a small cone to each light
                    const material = new pc.StandardMaterial();
                    material.emissive = color;
                    material.update();

                    lightSpot.addComponent('render', {
                        type: "cone",
                        material: material,
                        castShadows: false
                    });
                    lightSpot.setLocalScale(5, 5, 5);
                    app.root.addChild(lightSpot);
                    spotLightList.push(lightSpot);
                }

                // create many spot lights
                const count = 10;
                for (let i = 0; i < count; i++) {
                    createLight(i);
                }
                updateLightCount();

                // Create an entity with a camera component
                const camera = new pc.Entity();
                camera.addComponent("camera", {
                    clearColor: new pc.Color(0.2, 0.2, 0.2),
                    farClip: 2000,
                    nearClip: 1
                });
                app.root.addChild(camera);
                camera.setLocalPosition(300 * Math.sin(0), 150, 300 * Math.cos(0));

                // add orbit camera script with mouse and touch support
                camera.addComponent("script");
                camera.script.create("orbitCamera", {
                    attributes: {
                        inertiaFactor: 0.2,
                        focusEntity: ground,
                        distanceMax: 1200,
                        frameOnStart: false
                    }
                });
                camera.script.create("orbitCameraInputMouse");
                camera.script.create("orbitCameraInputTouch");

                // handle HUD changes - update properties on the scene
                data.on('*:set', (path: string, value: any) => {
                    const pathArray = path.split('.');
                    if (pathArray[1] === 'static') {

                        lightsStatic = value;
                        updateLightCount();

                    } else if (pathArray[1] === 'atlasSplit') {

                        // assign atlas split option
                        lighting.atlasSplit = splitOptions[value];

                    } else if (pathArray[1] === 'debug') {

                        // debug rendering of lighting clusters on world layer
                        lighting.debugLayer = value ? app.scene.layers.getLayerByName("World").id : undefined;

                    } else if (pathArray[1] === 'debugAtlas') {

                        // show debug atlas
                        debugAtlas = value;
                    } else if (pathArray[1] === 'shadowIntensity') {
                        for (let i = 0; i < spotLightList.length; i++) {
                            spotLightList[i].light.shadowIntensity = value;
                        }
                    } else {
                        // @ts-ignore
                        lighting[pathArray[1]] = value;
                    }
                });

                function updateLightCount() {

                    // update the number on HUD
                    data.set('settings.numLights', spotLightList.length);

                    // shadow update mode (need to force render shadow when we add / remove light, as they all move)
                    spotLightList.forEach((spot) => {
                        spot.light.shadowUpdateMode = lightsStatic ? pc.SHADOWUPDATE_THISFRAME : pc.SHADOWUPDATE_REALTIME;
                    });
                }

                // add light button handler
                data.on('add', function () {
                    if (spotLightList.length < maxLights) {
                        createLight(spotLightList.length);
                        updateLightCount();
                    }
                });

                // remove light button handler
                data.on('remove', function () {
                    if (spotLightList.length) {
                        const light = spotLightList.pop();
                        app.root.removeChild(light);
                        light.destroy();
                        updateLightCount();
                    }
                });

                // Set an update function on the app's update event
                let time = 0;
                app.on("update", function (dt: number) {

                    // don't move lights around when they're static
                    if (!lightsStatic) {
                        time += dt * 0.15;
                    }

                    // rotate spot lights around
                    const lightPos = new pc.Vec3();
                    spotLightList.forEach(function (spotlight, i) {
                        const angle = (i / spotLightList.length) * Math.PI * 2;
                        const x = 130 * Math.sin(angle + time);
                        const z = 130 * Math.cos(angle + time);
                        lightPos.set(x, 100, z);
                        spotlight.setLocalPosition(lightPos);

                        lightPos.y = 0;
                        spotlight.lookAt(lightPos, pc.Vec3.RIGHT);

                        spotlight.rotateLocal(90, 0, 0);
                    });

                    // display shadow texture (debug feature, only works when depth is stored as color, which is webgl1)
                    // app.drawTexture(-0.7, 0.7, 0.4, 0.4, app.renderer.lightTextureAtlas.shadowAtlas.texture);

                    // display cookie texture (debug feature)
                    if (debugAtlas) {
                        // @ts-ignore engine-tsd
                        app.drawTexture(-0.7, 0.2, 0.4, 0.4, app.renderer.lightTextureAtlas.cookieAtlas);
                    }
                });
            });
        });
    }
}

export default ClusteredSpotShadowsExample;
