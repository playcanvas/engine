import React from 'react';
import * as pc from 'playcanvas/build/playcanvas.js';
import Example from '../../app/example';
import { AssetLoader } from '../../app/helpers/loader';

class MaterialTranslucentSpecularExample extends Example {
    static CATEGORY = 'Graphics';
    static NAME = 'Material Translucent Specular';

    load() {
        return <>
            <AssetLoader name='helipad.dds' type='cubemap' url='static/assets/cubemaps/helipad.dds' data={{ type: pc.TEXTURETYPE_RGBM }}/>
            <AssetLoader name='font' type='font' url='static/assets/fonts/arial.json' />
        </>;
    }

    // @ts-ignore: override class function
    example(canvas: HTMLCanvasElement, assets: { 'helipad.dds': pc.Asset, font: pc.Asset }): void {

        // Create the application and start the update loop
        const app = new pc.Application(canvas, {});
        app.start();

        // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
        app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
        app.setCanvasResolution(pc.RESOLUTION_AUTO);

        app.scene.gammaCorrection = pc.GAMMA_SRGB;
        app.scene.toneMapping = pc.TONEMAP_ACES;
        // Set the skybox to the 128x128 cubemap mipmap level
        app.scene.skyboxMip = 1;
        app.scene.skyboxIntensity = 1;

        // Create an entity with a camera component
        const camera = new pc.Entity();
        camera.addComponent("camera");
        camera.translate(0, 0, 8);
        camera.rotate(0, 0, 0);
        app.root.addChild(camera);

         // Create an entities with a directional light components
        for (let i = 0; i < 3; i++) {
            const light = new pc.Entity();
            light.addComponent("light", {
                type: "directional"
            });
            app.root.addChild(light);
            light.rotateLocal(60 + 10 * i, 30 + 90 * i, 0);
        }

        app.scene.setSkybox(assets['helipad.dds'].resources);

        const NUM_SPHERES_X = 10;
        const NUM_SPHERES_Z = 5;

        const createSphere = function (x: number, y: number, z: number) {
            const material = new pc.StandardMaterial();
            material.diffuse = new pc.Color(0.7, 0.7, 0.7);
            material.metalness = 0.0;
            material.shininess = ((z) / (NUM_SPHERES_Z - 1) * 50) + 50;
            material.useMetalness = true;
            material.blendType = pc.BLEND_NORMAL;
            material.opacity = (x >= 5) ? ((x - 5) / 5 + 0.2) * ((x - 5) / 5 + 0.2) : (x / 5 + 0.2) * (x / 5 + 0.2);
            material.opacityFadesSpecular = !(x >= 5);
            material.alphaWrite = false;

            material.update();

            const sphere = new pc.Entity();

            sphere.addComponent("render", {
                material: material,
                type: "sphere"
            });
            sphere.setLocalPosition(x - (NUM_SPHERES_X - 1) * 0.5, z - (NUM_SPHERES_Z - 1) * 0.5, 0);
            sphere.setLocalScale(0.7, 0.7, 0.7);
            app.root.addChild(sphere);
        };

        const createText = function (fontAsset: pc.Asset, message: string, x: number, y: number, z: number, rotx: number, roty: number) {
            // Create a text element-based entity
            const text = new pc.Entity();
            text.addComponent("element", {
                anchor: [0.5, 0.5, 0.5, 0.5],
                fontAsset: fontAsset,
                fontSize: 0.5,
                pivot: [0.5, 0.5],
                text: message,
                type: pc.ELEMENTTYPE_TEXT
            });
            text.setLocalPosition(x, y, z);
            text.setLocalEulerAngles(rotx, roty, 0);
            app.root.addChild(text);
        };

        for (let i = 0; i < NUM_SPHERES_Z; i++) {
            for (let j = 0; j < NUM_SPHERES_X; j++) {
                createSphere(j, 0, i);
            }
        }

        createText(assets.font, 'Spec Fade On', -NUM_SPHERES_X * 0.25, ((NUM_SPHERES_Z + 1) * -0.5), 0, -0, 0);
        createText(assets.font, 'Spec Fade Off', NUM_SPHERES_X * 0.25, ((NUM_SPHERES_Z + 1) * -0.5), 0, -0, 0);
    }
}

export default MaterialTranslucentSpecularExample;
