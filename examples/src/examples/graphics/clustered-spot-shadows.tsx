import React from 'react';
// @ts-ignore: library file import
import * as pc from 'playcanvas/build/playcanvas.js';
import Example from '../../app/example';
import { AssetLoader } from '../../app/helpers/loader';
// @ts-ignore: library file import
import Panel from '@playcanvas/pcui/Panel/component';
// @ts-ignore: library file import
import SliderInput from '@playcanvas/pcui/SliderInput/component';
// @ts-ignore: library file import
import LabelGroup from '@playcanvas/pcui/LabelGroup/component';
// @ts-ignore: library file import
import BindingTwoWay from '@playcanvas/pcui/BindingTwoWay';
// @ts-ignore: library file import
import SelectInput from '@playcanvas/pcui/SelectInput/component';
// @ts-ignore: library file import
import { Observer } from '@playcanvas/observer';
// @ts-ignore: library file import
import BooleanInput from '@playcanvas/pcui/BooleanInput/component';

class ClusteredSpotShadowsExample extends Example {
    static CATEGORY = 'Graphics';
    static NAME = 'Clustered Spot Shadows';

    load() {
        return <>
            <AssetLoader name="channels" type="texture" url="static/assets/textures/channels.png" />
            <AssetLoader name='normal' type='texture' url='static/assets/textures/normal-map.png' />
            <AssetLoader name='cubemap' type='cubemap' url='static/assets/cubemaps/helipad.dds' data={{ type: pc.TEXTURETYPE_RGBM }}/>
        </>;
    }

    controls(data: Observer) {
        return <>
            <Panel headerText='Settings'>
                {<LabelGroup text='Filter'>
                    <SelectInput binding={new BindingTwoWay()} link={{ observer: data, path: 'settings.shadowType' }} type="number" options={[
                        { v: pc.SHADOW_PCF1, t: 'PCF1' },
                        { v: pc.SHADOW_PCF3, t: 'PCF3' },
                        { v: pc.SHADOW_PCF5, t: 'PCF5' }
                    ]} />
                </LabelGroup>}
                <LabelGroup text='Shadow Res'>
                    <SliderInput binding={new BindingTwoWay()} link={{ observer: data, path: 'settings.shadowAtlasResolution' }} min={256} max={4096} precision={0}/>
                </LabelGroup>
                <LabelGroup text='Shadows On'>
                    <BooleanInput type='toggle' binding={new BindingTwoWay()} link={{ observer: data, path: 'settings.shadowsEnabled' }} value={data.get('settings.shadowsEnabled')}/>
                </LabelGroup>
                <LabelGroup text='Cookies On'>
                    <BooleanInput type='toggle' binding={new BindingTwoWay()} link={{ observer: data, path: 'settings.cookiesEnabled' }} value={data.get('settings.cookiesEnabled')}/>
                </LabelGroup>
            </Panel>
        </>;
    }

    example(canvas: HTMLCanvasElement, assets: any, data: any): void {

        // Create the application and start the update loop
        const app = new pc.Application(canvas, {});
        app.start();

        data.set('settings', {
            shadowAtlasResolution: 1024,     // shadow map resolution storing all shadows
            shadowType: pc.SHADOW_PCF3,      // shadow filter type
            shadowsEnabled: true,
            cookiesEnabled: true
        });

        // setup skydome as ambient light
        app.scene.skyboxMip = 3;
        app.scene.skyboxIntensity = 0.4;
        app.scene.setSkybox(assets.cubemap.resources);

        // enabled clustered lighting. This is a temporary API and will change in the future
        // @ts-ignore engine-tsd
        app.scene.clusteredLightingEnabled = true;

        // adjust default clusterered lighting parameters to handle many lights:
        // 1) subdivide space with lights into this many cells:
        // @ts-ignore engine-tsd
        app.scene.lightCells = new pc.Vec3(20, 2, 20);

        // 2) and allow this many lights per cell:
        // @ts-ignore engine-tsd
        app.scene.maxLights = 16;

        // enable clustered shadows (it's enabled by default as well)
        // @ts-ignore engine-tsd
        app.scene.shadowsEnabled = true;

        // enable clustered cookies
        // @ts-ignore engine-tsd
        app.scene.cookiesEnabled = true;

        // resolution of the shadow and cookie atlas
        app.scene.shadowAtlasResolution = data.get('settings.shadowAtlasResolution');
        app.scene.cookieAtlasResolution = 1500;

        // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
        app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
        app.setCanvasResolution(pc.RESOLUTION_AUTO);

        window.addEventListener("resize", function () {
            app.resizeCanvas(canvas.width, canvas.height);
        });

        // ground material
        const groundMaterial = new pc.StandardMaterial();
        groundMaterial.shininess = 25;
        groundMaterial.metalness = 0.4;
        groundMaterial.useMetalness = true;

        // normal map
        groundMaterial.normalMap = assets.normal.resource;
        groundMaterial.normalMapTiling.set(10, 10);
        groundMaterial.bumpiness = 0.5;

        groundMaterial.update();

        // helper function to create a 3d primitive including its material
        function createPrimitive(primitiveType: string, position: pc.Vec3, scale: pc.Vec3) {

            // create the primitive using the material
            const primitive = new pc.Entity();
            primitive.addComponent('render', {
                type: primitiveType,
                castShadows: true,
                material: groundMaterial
            });

            // set position and scale and add it to scene
            primitive.setLocalPosition(position);
            primitive.setLocalScale(scale);
            app.root.addChild(primitive);

            return primitive;
        }

        createPrimitive("box", new pc.Vec3(0, 0, 0), new pc.Vec3(500, 0, 500));

        const numTowers = 8;
        for (let i = 0; i < numTowers; i++) {
            let scale = 12;
            const fraction = i / numTowers * Math.PI * 2;
            const radius = 200;
            const numCubes = 12;
            for (let y = 0; y <= 10; y++) {
                const elevationRadius = radius * (1 - (y / numCubes));
                const pos = new pc.Vec3(elevationRadius * Math.sin(fraction), y * 6, elevationRadius * Math.cos(fraction));
                const prim = createPrimitive("box", pos, new pc.Vec3(scale, scale, scale));
                prim.setLocalEulerAngles(Math.random() * 360, Math.random() * 360, Math.random() * 360);
            }
            scale -= 1.5;
        }

        const cookieChannels = ["r", "g", "b", "a", "rgb"];

        // create many spot lights
        const count = 10;
        const spotLightList: Array<pc.Entity> = [];
        for (let i = 0; i < count; i++) {
            const intensity = 1.5;
            const color = new pc.Color(intensity * Math.random(), intensity * Math.random(), intensity * Math.random(), 1);
            const lightSpot = new pc.Entity("Spot" + i);
            const cookieChannel = cookieChannels[Math.floor(Math.random() * cookieChannels.length)];

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

                // cookie texture
                cookie: assets.channels.resource,
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

        // Create an entity with a camera component
        const camera = new pc.Entity();
        camera.addComponent("camera", {
            clearColor: new pc.Color(0.2, 0.2, 0.2),
            farClip: 1000,
            nearClip: 0.1
        });
        app.root.addChild(camera);

        // handle HUD changes - update properties on the scene
        data.on('*:set', (path: string, value: any) => {
            const pathArray = path.split('.');
            // @ts-ignore
            app.scene[pathArray[1]] = value;
        });

        // Set an update function on the app's update event
        let time = 0;
        app.on("update", function (dt: number) {
            time += dt * 0.15;

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

            // orbit the camera
            camera.setLocalPosition(300 * Math.sin(time * 0.4), 150, 300 * Math.cos(time * 0.4));
            camera.lookAt(new pc.Vec3(0, 0, 0));

            // display shadow texture (debug feature, only works when depth is stored as color, which is webgl1)
            // app.drawTexture(-0.7, 0.7, 0.4, 0.4, app.renderer.lightTextureAtlas.shadowMap.texture);

            // display cookie texture (debug feature)
            // app.drawTexture(-0.7, 0.2, 0.4, 0.4, app.renderer.lightTextureAtlas.cookieAtlas);
        });
    }
}

export default ClusteredSpotShadowsExample;
