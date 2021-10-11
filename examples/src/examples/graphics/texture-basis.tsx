import React from 'react';
import * as pc from 'playcanvas/build/playcanvas.js';
import { AssetLoader } from '../../app/helpers/loader';
import Example from '../../app/example';

class TextureBasisExample extends Example {
    static CATEGORY = 'Graphics';
    static NAME = 'Texture Basis';

    // Color textures have been converted with the following arguments:
    //   basisu seaside-rocks01-gloss.jpg -q 255 -mipmap
    // The normalmap has been converted with the following arguments:
    //   basisu seaside-rocks01-normal.jpg -normal_map -swizzle gggr -renorm -q 255 -mipmap
    load() {
        return <>
            <AssetLoader name='color' type='texture' url='static/assets/textures/seaside-rocks01-color.basis' />
            <AssetLoader name='gloss' type='texture' url='static/assets/textures/seaside-rocks01-gloss.basis' />
            <AssetLoader name='normal' type='texture' url='static/assets/textures/seaside-rocks01-normal.basis' data={{ type: pc.TEXTURETYPE_SWIZZLEGGGR }} />
            <AssetLoader name='helipad' type='cubemap' url='static/assets/cubemaps/helipad.dds' data={{ type: pc.TEXTURETYPE_RGBM }}/>
        </>;
    }

    // @ts-ignore: override class function
    example(canvas: HTMLCanvasElement, assets: { color: pc.Asset, gloss: pc.Asset, normal: pc.Asset, helipad: pc.Asset }): void {

        // Create the application and start the update loop
        const app = new pc.Application(canvas, {});

        // @ts-ignore engine-tsd
        pc.basisInitialize({
            glueUrl: 'static/lib/basis/basis.wasm.js',
            wasmUrl: 'static/lib/basis/basis.wasm.wasm',
            fallbackUrl: 'static/lib/basis/basis.js'
        });

        app.start();

        // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
        app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
        app.setCanvasResolution(pc.RESOLUTION_AUTO);

        // Set skybox
        app.scene.gammaCorrection = pc.GAMMA_SRGB;
        app.scene.toneMapping = pc.TONEMAP_ACES;
        app.scene.skyboxMip = 1;
        app.scene.skyboxIntensity = 0.7;
        app.scene.setSkybox(assets.helipad.resources);

        // Create directional light
        const light = new pc.Entity();
        light.addComponent('light', {
            type: 'directional'
        });
        light.setLocalEulerAngles(45, 0, 45);

        // Construct material
        const material = new pc.StandardMaterial();
        material.useMetalness = true;
        material.diffuse = new pc.Color(0.3, 0.3, 0.3);
        material.shininess = 80;
        material.metalness = 0.7;
        material.diffuseMap = assets.color.resource;
        material.normalMap = assets.normal.resource;
        material.glossMap = assets.gloss.resource;
        material.diffuseMapTiling.set(7, 7);
        material.normalMapTiling.set(7, 7);
        material.glossMapTiling.set(7, 7);
        material.update();

        // Create a torus shape
        const torus = pc.createTorus(app.graphicsDevice, {
            tubeRadius: 0.2,
            ringRadius: 0.3,
            segments: 50,
            sides: 40
        });
        const shape = new pc.Entity();
        shape.addComponent('render', {
            material: material,
            meshInstances: [new pc.MeshInstance(torus, material)]
        });
        shape.setPosition(0, 0, 0);
        shape.setLocalScale(2, 2, 2);

        // Create an Entity with a camera component
        const camera = new pc.Entity();
        camera.addComponent("camera", {
            clearColor: new pc.Color(0.4, 0.45, 0.5)
        });

        // Adjust the camera position
        camera.translate(0, 0, 4);

        // Add the new Entities to the hierarchy
        app.root.addChild(light);
        app.root.addChild(shape);
        app.root.addChild(camera);

        // Set an update function on the app's update event
        let angle = 0;
        app.on("update", function (dt) {
            angle = (angle + dt * 10) % 360;

            // Rotate the boxes
            shape.setEulerAngles(angle, angle * 2, angle * 4);
        });
    }
}

export default TextureBasisExample;
