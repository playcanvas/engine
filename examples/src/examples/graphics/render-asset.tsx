import React from 'react';
import * as pc from 'playcanvas/build/playcanvas.js';
import Example from '../../app/example';
import { AssetLoader } from '../../app/helpers/loader';

class RenderAssetExample extends Example {
    static CATEGORY = 'Graphics';
    static NAME = 'Render Asset';

    load() {
        return <>
            <AssetLoader name='helipad.dds' type='cubemap' url='static/assets/cubemaps/helipad.dds' data={{ type: pc.TEXTURETYPE_RGBM }}/>
            <AssetLoader name='statue' type='container' url='static/assets/models/statue.glb' />
            <AssetLoader name='cube' type='container' url='static/assets/models/playcanvas-cube.glb' />
        </>;
    }

    // @ts-ignore: override class function
    example(canvas: HTMLCanvasElement, assets: { 'helipad.dds': pc.Asset, statue: pc.Asset, cube: pc.Asset }): void {

        // Create the app and start the update loop
        const app = new pc.Application(canvas, {});

        // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
        app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
        app.setCanvasResolution(pc.RESOLUTION_AUTO);

        const cubeEntities: pc.Entity[] = [];

        app.start();

        // get the instance of the cube it set up with render component and add it to scene
        cubeEntities[0] = assets.cube.resource.instantiateRenderEntity();
        cubeEntities[0].setLocalPosition(7, 12, 0);
        cubeEntities[0].setLocalScale(3, 3, 3);
        app.root.addChild(cubeEntities[0]);

        // clone another copy of it and add it to scene
        cubeEntities[1] = cubeEntities[0].clone();
        cubeEntities[1].setLocalPosition(-7, 12, 0);
        cubeEntities[1].setLocalScale(3, 3, 3);
        app.root.addChild(cubeEntities[1]);

        // get the instance of the statue and set up with render component
        const statueEntity = assets.statue.resource.instantiateRenderEntity();
        app.root.addChild(statueEntity);

        // Create an Entity with a camera component
        const camera = new pc.Entity();
        camera.addComponent("camera", {
            clearColor: new pc.Color(0.2, 0.1, 0.1),
            farClip: 100
        });
        camera.translate(-20, 15, 20);
        camera.lookAt(0, 7, 0);
        app.root.addChild(camera);

        // set skybox - this DDS file was 'prefiltered' in the PlayCanvas Editor and then downloaded.
        app.scene.setSkybox(assets["helipad.dds"].resources);
        app.scene.gammaCorrection = pc.GAMMA_SRGB;
        app.scene.toneMapping = pc.TONEMAP_ACES;
        app.scene.skyboxMip = 1;

        // spin the meshes
        app.on("update", function (dt) {

            if (cubeEntities[0]) {
                cubeEntities[0].rotate(3 * dt, 10 * dt, 6 * dt);
            }

            if (cubeEntities[1]) {
                cubeEntities[1].rotate(-7 * dt, 5 * dt, -2 * dt);
            }

            if (statueEntity) {
                statueEntity.rotate(0, -12 * dt, 0);
            }

        });
    }
}

export default RenderAssetExample;
