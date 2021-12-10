import React from 'react';
import * as pc from 'playcanvas/build/playcanvas.js';
import { AssetLoader } from '../../app/helpers/loader';
import Example from '../../app/example';
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

class ClusteredShadowsOmniExample extends Example {
    static CATEGORY = 'Graphics';
    static NAME = 'Box Reflection';

    load() {
        return <>
            <AssetLoader name='script' type='script' url='static/scripts/camera/orbit-camera.js' />
            <AssetLoader name='script' type='script' url='static/scripts/utils/cubemap-renderer.js' />
            <AssetLoader name='normal' type='texture' url='static/assets/textures/normal-map.png' />
            <AssetLoader name="xmas_negx" type="texture" url="static/assets/cubemaps/xmas_faces/xmas_negx.png" />
            <AssetLoader name="xmas_negy" type="texture" url="static/assets/cubemaps/xmas_faces/xmas_negy.png" />
            <AssetLoader name="xmas_negz" type="texture" url="static/assets/cubemaps/xmas_faces/xmas_negz.png" />
            <AssetLoader name="xmas_posx" type="texture" url="static/assets/cubemaps/xmas_faces/xmas_posx.png" />
            <AssetLoader name="xmas_posy" type="texture" url="static/assets/cubemaps/xmas_faces/xmas_posy.png" />
            <AssetLoader name="xmas_posz" type="texture" url="static/assets/cubemaps/xmas_faces/xmas_posz.png" />
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
                    <SliderInput binding={new BindingTwoWay()} link={{ observer: data, path: 'settings.shadowAtlasResolution' }} min={512} max={4096} precision={0}/>
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
            shadowAtlasResolution: 1300,     // shadow map resolution storing all shadows
            shadowType: pc.SHADOW_PCF3,      // shadow filter type
            shadowsEnabled: true,
            cookiesEnabled: true
        });

        // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
        app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
        app.setCanvasResolution(pc.RESOLUTION_AUTO);

        const roomMaterial = new pc.StandardMaterial();
        roomMaterial.diffuse = new pc.Color(0.7, 0.7, 0.7);

        // normal map
        roomMaterial.normalMap = assets.normal.resource;
        roomMaterial.normalMapTiling.set(5, 5);
        roomMaterial.bumpiness = 0.7;
        roomMaterial.shininess = 40;
        roomMaterial.metalness = 0.3;
        roomMaterial.useMetalness = true;
        roomMaterial.update();

        // helper function to create a 3d primitive including its material
        function createPrimitive(primitiveType: string, position: pc.Vec3, scale: pc.Vec3, material: pc.Material = null) {

            // create a material
            if (!material) {
                material = new pc.StandardMaterial();
                material.diffuse = new pc.Color(0.7, 0.7, 0.7);

                // normal map
                material.normalMap = assets.normal.resource;
                material.normalMapTiling.set(5, 5);
                material.bumpiness = 0.7;

                // emissive
                material.emissive = new pc.Color(Math.random() * 3, Math.random() * 3, Math.random() * 3);
                material.update();
            }

            // create the primitive using the material
            const primitive = new pc.Entity();
            primitive.addComponent('render', {
                type: primitiveType,
                material: material
            });

            // set position and scale and add it to scene
            primitive.setLocalPosition(position);
            primitive.setLocalScale(scale);
            app.root.addChild(primitive);

            return primitive;
        }

        // create the ground plane from the boxes
        createPrimitive("box", new pc.Vec3(0, 0, 0), new pc.Vec3(800, 2, 800), roomMaterial);
        createPrimitive("box", new pc.Vec3(0, 400, 0), new pc.Vec3(800, 2, 800), roomMaterial);

        // walls
        createPrimitive("box", new pc.Vec3(400, 200, 0), new pc.Vec3(2, 400, 800), roomMaterial);
        createPrimitive("box", new pc.Vec3(-400, 200, 0), new pc.Vec3(2, 400, 800), roomMaterial);
        createPrimitive("box", new pc.Vec3(0, 200, 400), new pc.Vec3(800, 400, 0), roomMaterial);
        createPrimitive("box", new pc.Vec3(0, 200, -400), new pc.Vec3(800, 400, 0), roomMaterial);

        const numTowers = 7;
        for (let i = 0; i < numTowers; i++) {
            let scale = 25;
            const fraction = i / numTowers * Math.PI * 2;
            const radius = (i % 2) ? 340 : 210;
            for (let y = 0; y <= 7; y++) {
                const prim = createPrimitive("box", new pc.Vec3(radius * Math.sin(fraction), 2 + y * 25, radius * Math.cos(fraction)), new pc.Vec3(scale, scale, scale));
                prim.setLocalEulerAngles(Math.random() * 360, Math.random() * 360, Math.random() * 360);
            }
            scale -= 1.5;
        }

        // create an Entity with a camera component
        const camera = new pc.Entity();
        camera.addComponent("camera", {
            fov: 80,
            clearColor: new pc.Color(0.9, 0.9, 0.9),
            farClip: 1500
        });

        // and position it in the world
        camera.setLocalPosition(300, 120, 25);

        // add orbit camera script with a mouse and a touch support
        camera.addComponent("script");
        camera.script.create("orbitCamera", {
            attributes: {
                inertiaFactor: 0.2,
                focusEntity: app.root,
                distanceMax: 400
            }
        });
        camera.script.create("orbitCameraInputMouse");
        camera.script.create("orbitCameraInputTouch");
        app.root.addChild(camera);



        // create a probe object with cubemapRenderer script component which takes care of rendering dynamic cubemap
        const probe = new pc.Entity();
        probe.addComponent('script');

        // add camera component to the probe - this defines camera properties for cubemap rendering
        probe.addComponent('camera', {

            // optimization - no need to clear as all pixels get overwritten
            clearColorBuffer: false,

            // priority - render before world camera
            priority: -1,

            // disable as this is not a camera that renders cube map but only a container for properties for cube map rendering
            enabled: false
        });

        probe.script.create('cubemapRenderer', {
            attributes: {
                resolution: 256,
                mipmaps: true,
                depth: true
            }
        });

        app.root.addChild(probe);


        // handle HUD changes - update properties on the scene
        data.on('*:set', (path: string, value: any) => {
            const pathArray = path.split('.');
            // @ts-ignore
            lighting[pathArray[1]] = value;
        });

        // Set an update function on the app's update event
        let time = 0;
        app.on("update", function (dt: number) {
            time += dt * 0.3;

            const srcCube = probe.script.cubemapRenderer.cubeMap;

            const lightingSource = pc.EnvLighting.generateLightingSource(srcCube);
            const atlas = pc.EnvLighting.generateAtlas(lightingSource);

            // roomMaterial.envAtlas = atlas;
            // roomMaterial.update();

            app.scene.envAtlas = atlas;

            // @ts-ignore engine-tsd
            app.drawTexture(-0.6, 0.7, 0.8, 0.4, atlas);

        });
    }
}

export default ClusteredShadowsOmniExample;
