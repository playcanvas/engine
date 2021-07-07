import React from 'react';
import * as pc from 'playcanvas/build/playcanvas.js';
import Example from '../../app/example';
import { AssetLoader } from '../../app/helpers/loader';

class MaterialPhysicalExample extends Example {
    static CATEGORY = 'Graphics';
    static NAME = 'Material Physical';

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
        camera.translate(0, 0, 9);
        app.root.addChild(camera);

        app.scene.setSkybox(assets['helipad.dds'].resources);

        const NUM_SPHERES = 5;

        const createSphere = function (x: number, y: number, z: number) {
            const material = new pc.StandardMaterial();
            material.metalness = y / (NUM_SPHERES - 1);
            material.shininess = x / (NUM_SPHERES - 1) * 100;
            material.useMetalness = true;
            material.update();

            const sphere = new pc.Entity();
            sphere.addComponent("render", {
                material: material,
                type: "sphere"
            });
            sphere.setLocalPosition(x - (NUM_SPHERES - 1) * 0.5, y - (NUM_SPHERES - 1) * 0.5, z);
            sphere.setLocalScale(0.9, 0.9, 0.9);
            app.root.addChild(sphere);
        };

        const createText = function (fontAsset: pc.Asset, message: string, x: number, y: number, z: number, rot: number) {
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
            text.setLocalEulerAngles(0, 0, rot);
            app.root.addChild(text);
        };

        for (let i = 0; i < NUM_SPHERES; i++) {
            for (let j = 0; j < NUM_SPHERES; j++) {
                createSphere(j, i, 0);
            }
        }

        createText(assets.font, 'Glossiness', 0, -(NUM_SPHERES + 1) * 0.5, 0, 0);
        createText(assets.font, 'Metalness', -(NUM_SPHERES + 1) * 0.5, 0, 0, 90);

        // rotate the skybox using mouse input
        const mouse = new pc.Mouse(document.body);

        let x = 0;
        let y = 0;
        const rot = new pc.Quat();

        mouse.on('mousemove', function (event) {
            if (event.buttons[pc.MOUSEBUTTON_LEFT]) {
                x += event.dx;
                y += event.dy;

                rot.setFromEulerAngles(0.2 * y, 0.2 * x, 0);
                app.scene.skyboxRotation = rot;
            }
        });
    }
}

export default MaterialPhysicalExample;
