import React from 'react';
import * as pc from 'playcanvas/build/playcanvas.js';
import Example from '../../app/example';

class PainterExample extends Example {
    static CATEGORY = 'Graphics';
    static NAME = 'Painter';

    // @ts-ignore: override class function
    example(canvas: HTMLCanvasElement): void {

        // Create the app and start the update loop
        const app = new pc.Application(canvas, {});
        app.start();

        // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
        app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
        app.setCanvasResolution(pc.RESOLUTION_AUTO);

        // helper function to create a primitive with shape type, position, scale, color and layer
        function createPrimitive(primitiveType: string, position: number | pc.Vec3, scale: number | pc.Vec3, layer: number[], material: pc.StandardMaterial) {

            // create primitive
            const primitive = new pc.Entity();
            primitive.addComponent('render', {
                type: primitiveType,
                layers: layer,
                material: material,
                castShadows: false,
                receiveShadows: false
            });

            // set position and scale and add it to scene
            primitive.setLocalPosition(position);
            primitive.setLocalScale(scale);
            app.root.addChild(primitive);

            return primitive;
        }

        // create texture and render target for rendering into
        const texture = new pc.Texture(app.graphicsDevice, {
            width: 1024,
            height: 1024,
            format: pc.PIXELFORMAT_R8_G8_B8,
            mipmaps: false,
            minFilter: pc.FILTER_LINEAR,
            magFilter: pc.FILTER_LINEAR
        });
        const renderTarget = new pc.RenderTarget({
            colorBuffer: texture,
            depth: false
        });

        // create a layer for rendering to texture, and add it to the beginning of layers to render into it first
        const paintLayer = new pc.Layer({ name: "paintLayer" });
        app.scene.layers.insert(paintLayer, 0);

        // create a material we use for the paint brush - it uses emissive color to control its color, which is assigned later
        const brushMaterial = new pc.StandardMaterial();
        brushMaterial.emissiveTint = true;
        brushMaterial.useLighting = false;
        brushMaterial.update();

        // we render multiple brush imprints each frame to make smooth lines, and set up pool to reuse them each frame
        const brushes: any[] = [];
        function getBrush() {
            let brush: pc.Entity;
            if (brushes.length === 0) {
                // create new brush - use sphere primitive, but could use plane with a texture as well
                // Note: plane would need to be rotated by -90 degrees along x-axis to face camera and be visible
                brush = createPrimitive("sphere", new pc.Vec3(2, 1, 0), new pc.Vec3(1, 1, 1), [paintLayer.id], brushMaterial);
            } else {
                // reuse already allocated brush
                brush = brushes.pop();
                brush.enabled = true;
            }
            return brush;
        }

        // Create orthographic camera, which renders brushes in paintLayer, and renders before the main camera
        const paintCamera = new pc.Entity();
        paintCamera.addComponent("camera", {
            clearColorBuffer: false,
            projection: pc.PROJECTION_ORTHOGRAPHIC,
            layers: [paintLayer.id],
            renderTarget: renderTarget,
            priority: -1
        });

        // make it look at the center of the render target, some distance away
        paintCamera.setLocalPosition(0, 0, -10);
        paintCamera.lookAt(pc.Vec3.ZERO);
        app.root.addChild(paintCamera);

        // Create main camera, which renders entities in world layer - this is where we show the render target on the box
        const camera = new pc.Entity();
        camera.addComponent("camera", {
            clearColor: new pc.Color(0.2, 0.2, 0.2)
        });
        camera.translate(0, 0, 30);
        camera.lookAt(pc.Vec3.ZERO);
        app.root.addChild(camera);

        // material used to add render target into the world
        const material = new pc.StandardMaterial();
        material.emissiveMap = texture;
        material.useLighting = false;
        material.update();

        // create a box which we use to display rendered texture in the world layer
        const worldLayer = app.scene.layers.getLayerByName("World");
        const box = createPrimitive("box", new pc.Vec3(0, 0, 0), new pc.Vec3(15, 15, 15), [worldLayer.id], material);

        let progress = 1;
        let scale: number;
        let startPos: pc.Vec3, endPos: pc.Vec3;
        const pos = new pc.Vec3();
        const usedBrushes: any[] = [];

        // update things each frame
        app.on("update", function (dt) {

            // if the last brush stroke is finished, generate new random one
            if (progress >= 1) {
                progress = 0;

                // generate start and end position for the stroke
                startPos = new pc.Vec3(Math.random() * 20 - 10, Math.random() * 20 - 10, 0);
                endPos = new pc.Vec3(Math.random() * 20 - 10, Math.random() * 20 - 10, 0);

                // random width (scale)
                scale = 0.1 + Math.random();

                // assign random color to the brush
                brushMaterial.emissive = new pc.Color(Math.random(), Math.random(), Math.random());
                brushMaterial.update();
            }

            // disable brushes from the previous frame and return them to the free pool
            while (usedBrushes.length > 0) {
                const brush = usedBrushes.pop();
                brush.enabled = false;
                brushes.push(brush);
            }

            // step along the brish line multiple times each frame to make the line smooth
            const stepCount = 30;
            const stepProgress = 0.005;

            // in each step
            for (let i = 0; i < stepCount; i++) {

                // move position little bit
                pos.lerp(startPos, endPos, progress);

                // setup brush to be rendered this frame
                const activeBrush = getBrush();
                activeBrush.setLocalPosition(pos);
                activeBrush.setLocalScale(scale, scale, scale);
                usedBrushes.push(activeBrush);

                // progress for the next step
                progress += stepProgress;
            }

            // rotate the box in the world
            box.rotate(5 * dt, 10 * dt, 15 * dt);
        });
    }
}

export default PainterExample;
