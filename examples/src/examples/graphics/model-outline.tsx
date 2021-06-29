import React from 'react';
import * as pc from 'playcanvas/build/playcanvas.js';
import { AssetLoader } from '../../app/helpers/loader';
import Example from '../../app/example';

class ModelOutlineExample extends Example {
    static CATEGORY = 'Graphics';
    static NAME = 'Model Outline';

    load() {
        return <>
            <AssetLoader name='outline' type='script' url='static/scripts/posteffects/posteffect-outline.js' />
        </>;
    }

    // @ts-ignore: override class function
    example(canvas: HTMLCanvasElement): void {
        const app = new pc.Application(canvas, {});
        app.start();

        // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
        app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
        app.setCanvasResolution(pc.RESOLUTION_AUTO);

        app.scene.ambientLight = new pc.Color(0.2, 0.2, 0.2);

        // helper function to createa a primitive with shape type, position, scale, color and layer
        function createPrimitive(primitiveType: string, position: number | pc.Vec3, scale: number | pc.Vec3, color: pc.Color, layer: number[]) {
            // create material of specified color
            const material = new pc.StandardMaterial();
            material.diffuse = color;
            material.update();

            // create primitive
            const primitive = new pc.Entity();
            primitive.addComponent('render', {
                type: primitiveType,
                layers: layer,
                material: material
            });

            // set position and scale and add it to scene
            primitive.setLocalPosition(position);
            primitive.setLocalScale(scale);
            app.root.addChild(primitive);

            return primitive;
        }

        // create texture and render target for rendering into, including depth buffer
        let texture = new pc.Texture(app.graphicsDevice, {
            width: app.graphicsDevice.width,
            height: app.graphicsDevice.height,
            format: pc.PIXELFORMAT_R8_G8_B8_A8,
            mipmaps: true,
            minFilter: pc.FILTER_LINEAR,
            magFilter: pc.FILTER_LINEAR
        });
        let renderTarget = new pc.RenderTarget({
            colorBuffer: texture,
            depth: true
        });

        // create a layer for rendering to texture, and add it to the beginning of layers to render into it first
        const outlineLayer = new pc.Layer({ name: "OutlineLayer" });
        app.scene.layers.insert(outlineLayer, 0);

        // set up layer to render to the render targer
        // @ts-ignore engine-tsd
        outlineLayer.renderTarget = renderTarget;

        // get world layer
        const worldLayer = app.scene.layers.getLayerByName("World");

        // create ground plane and 3 primitives, visible in both layers
        createPrimitive("plane", new pc.Vec3(0, 0, 0), new pc.Vec3(20, 20, 20), new pc.Color(0.3, 0.5, 0.3), [worldLayer.id]);
        createPrimitive("sphere", new pc.Vec3(-2, 1, 0), new pc.Vec3(2, 2, 2), new pc.Color(1, 0, 0), [worldLayer.id]);
        createPrimitive("box", new pc.Vec3(2, 1, 0), new pc.Vec3(2, 2, 2), new pc.Color(1, 1, 0), [worldLayer.id, outlineLayer.id]);
        createPrimitive("cone", new pc.Vec3(0, 1, -2), new pc.Vec3(2, 2, 2), new pc.Color(0, 1, 1), [worldLayer.id]);

        // Create main camera, which renders entities in world layer
        const camera = new pc.Entity();
        camera.addComponent("camera", {
            clearColor: new pc.Color(0.2, 0.2, 0.4),
            layers: [worldLayer.id]
        });
        camera.translate(0, 20, 25);
        camera.lookAt(pc.Vec3.ZERO);

        // Create outline camera, which renders entities in outline layer
        const outlineCamera = new pc.Entity();
        outlineCamera.addComponent("camera", {
            clearColor: new pc.Color(0.0, 0.0, 0.0, 0.0),
            layers: [outlineLayer.id]
        });
        app.root.addChild(outlineCamera);

        // @ts-ignore engine-tsd
        const outline = new OutlineEffect(app.graphicsDevice, 3);
        outline.color = new pc.Color(0, 0.5, 1, 1);
        outline.texture = texture;
        camera.camera.postEffects.addEffect(outline);

        app.root.addChild(camera);

        // Create an Entity with a omni light component and add it to both layers
        const light = new pc.Entity();
        light.addComponent("light", {
            type: "omni",
            color: new pc.Color(1, 1, 1),
            range: 200,
            castShadows: true,
            layers: [worldLayer.id]
        });
        light.translate(0, 2, 5);
        app.root.addChild(light);

        // handle canvas resize
        window.addEventListener("resize", function () {
            app.resizeCanvas(canvas.width, canvas.height);

            camera.camera.postEffects.removeEffect(outline);

            app.scene.layers.remove(outlineLayer);

            texture.destroy();
            texture = new pc.Texture(app.graphicsDevice, {
                width: app.graphicsDevice.width,
                height: app.graphicsDevice.height,
                format: pc.PIXELFORMAT_R8_G8_B8_A8,
                mipmaps: true,
                minFilter: pc.FILTER_LINEAR,
                magFilter: pc.FILTER_LINEAR
            });
            renderTarget.destroy();
            renderTarget = new pc.RenderTarget({
                colorBuffer: texture,
                depth: true
            });
            // @ts-ignore engine-tsd
            outlineLayer.renderTarget = renderTarget;

            app.scene.layers.insert(outlineLayer, 0);

            outline.texture = texture;
            camera.camera.postEffects.addEffect(outline);
        });

        // update things each frame
        let time = 0;
        // let switchTime = 0;
        app.on("update", function (dt) {
            // rotate cameras around the objects
            time += dt;
            camera.setLocalPosition(12 * Math.sin(time), 5, 12 * Math.cos(time));
            camera.lookAt(pc.Vec3.ZERO);
            outlineCamera.setLocalPosition(12 * Math.sin(time), 5, 12 * Math.cos(time));
            outlineCamera.lookAt(pc.Vec3.ZERO);
        });
    }
}

export default ModelOutlineExample;
