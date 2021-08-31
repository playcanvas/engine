import React from 'react';
import * as pc from 'playcanvas/build/playcanvas.js';
import Example from '../../app/example';
import { AssetLoader } from '../../app/helpers/loader';

class LightsExample extends Example {
    static CATEGORY = 'Graphics';
    static NAME = 'Material Anisotropic';

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

        // Create an entity with a camera component
        const camera = new pc.Entity();
        camera.addComponent("camera");
        camera.translate(0, 6, 6);
        camera.rotate(-48, 0, 0);
        app.root.addChild(camera);

        // Create an entity with a directional light component
        const light = new pc.Entity();
        light.addComponent("light", {
            type: "directional"
        });
        app.root.addChild(light);
        const e = light.getLocalEulerAngles();
        light.setLocalEulerAngles(e.x + 90, e.y - 75, e.z);

        app.scene.setSkybox(assets['helipad.dds'].resources);

        const NUM_SPHERES_X = 11;
        const NUM_SPHERES_Z = 6;

        const createSphere = function (x: number, y: number, z: number) {
            const material = new pc.StandardMaterial();
            material.metalness = 1.0;
            material.shininess = (z) / (NUM_SPHERES_Z - 1) * 100;
            material.useMetalness = true;
            material.anisotropy = ((2 * x / (NUM_SPHERES_X - 1)) - 1.0) * -1.0;
            material.enableGGXSpecular = true;
            material.update();

            const sphere = new pc.Entity();

            sphere.addComponent("render", {
                material: material,
                type: "sphere"
            });
            sphere.setLocalPosition(x - (NUM_SPHERES_X - 1) * 0.5, y, z - (NUM_SPHERES_Z - 1) * 0.5);
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

        createText(assets.font, 'Anisotropy', 0, 0, ((NUM_SPHERES_Z + 1) * 0.5), -90, 0);
        createText(assets.font, 'Roughness', -(NUM_SPHERES_X + 1) * 0.5, 0, 0, -90, 90);
    }
}

export default LightsExample;
