import React from 'react';
import * as pc from 'playcanvas/build/playcanvas.js';
import Example from '../../app/example';
import { AssetLoader } from '../../app/helpers/loader';

class RenderToTextureExample extends Example {
    static CATEGORY = 'Graphics';
    static NAME = 'Render to Texture';

    load() {
        return <>
            <AssetLoader name='helipad.dds' type='cubemap' url='static/assets/cubemaps/helipad.dds' data={{ type: pc.TEXTURETYPE_RGBM }}/>
        </>;
    }

    // @ts-ignore: override class function
    example(canvas: HTMLCanvasElement, assets: { 'helipad.dds': pc.Asset }): void {

        // Overview:
        // There are 3 layers used:
        // - worldLayer - it contains objects that render into main camera and also into texture
        // - excludedLayer - it contains objects that are excluded from rendering into texture and so render only into main camera
        // - skyboxLayer - it contains skybox and renders into both main and texture camera
        // There are two cameras:
        // - textureCamera - this camera renders into texture, objects from World and also Skybox layers
        // - camera - this camera renders into main framebuffer, objects from World, Excluded and also Skybox layers

        // Create the app and start the update loop
        const app = new pc.Application(canvas, {});
        app.start();

        // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
        app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
        app.setCanvasResolution(pc.RESOLUTION_AUTO);

        // helper function to create a primitive with shape type, position, scale, color and layer
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
        const texture = new pc.Texture(app.graphicsDevice, {
            width: 512,
            height: 256,
            format: pc.PIXELFORMAT_R8_G8_B8,
            mipmaps: true,
            minFilter: pc.FILTER_LINEAR,
            magFilter: pc.FILTER_LINEAR,
            addressU: pc.ADDRESS_CLAMP_TO_EDGE,
            addressV: pc.ADDRESS_CLAMP_TO_EDGE
        });
        const renderTarget = new pc.RenderTarget({
            colorBuffer: texture,
            depth: true
        });

        // create a layer for object that do not render into texture
        const excludedLayer = new pc.Layer({ name: "Excluded" });
        app.scene.layers.push(excludedLayer);

        // get world and skybox layers
        const worldLayer = app.scene.layers.getLayerByName("World");
        const skyboxLayer = app.scene.layers.getLayerByName("Skybox");

        // create ground plane and 3 primitives, visible in world layer
        createPrimitive("plane", new pc.Vec3(0, 0, 0), new pc.Vec3(20, 20, 20), new pc.Color(0.2, 0.4, 0.2), [worldLayer.id]);
        createPrimitive("sphere", new pc.Vec3(-2, 1, 0), new pc.Vec3(2, 2, 2), pc.Color.RED, [worldLayer.id]);
        createPrimitive("box", new pc.Vec3(2, 1, 0), new pc.Vec3(2, 2, 2), pc.Color.YELLOW, [worldLayer.id]);
        createPrimitive("cone", new pc.Vec3(0, 1, -2), new pc.Vec3(2, 2, 2), pc.Color.CYAN, [worldLayer.id]);

        // Create main camera, which renders entities in world, excluded and skybox layers
        const camera = new pc.Entity("Camera");
        camera.addComponent("camera", {
            fov: 100,
            layers: [worldLayer.id, excludedLayer.id, skyboxLayer.id]
        });
        camera.translate(0, 9, 15);
        camera.lookAt(1, 4, 0);
        app.root.addChild(camera);

        // Create texture camera, which renders entities in world and skybox layers into the texture
        const textureCamera = new pc.Entity("TextureCamera");
        textureCamera.addComponent("camera", {
            layers: [worldLayer.id, skyboxLayer.id],

            // set the priority of textureCamera to lower number than the priority of the main camera (which is at default 0)
            // to make it rendered first each frame
            priority: -1,

            // this camera renders into texture target
            renderTarget: renderTarget
        });

        // add sphere at the position of this camera to see it in the world
        textureCamera.addComponent("render", {
            type: "sphere"
        });
        app.root.addChild(textureCamera);

        // Create an Entity with a omni light component and add it to world layer (and so used by both cameras)
        const light = new pc.Entity();
        light.addComponent("light", {
            type: "omni",
            color: pc.Color.WHITE,
            range: 200,
            castShadows: true,
            layers: [worldLayer.id]
        });
        light.translate(0, 2, 5);
        app.root.addChild(light);

        // create a plane called tv which we use to display rendered texture
        // this is only added to excluded Layer, so it does not render into texture
        const tv = createPrimitive("plane", new pc.Vec3(6, 8, -5), new pc.Vec3(20, 10, 10), pc.Color.BLACK, [excludedLayer.id]);
        tv.setLocalEulerAngles(90, 0, 180);
        tv.render.castShadows = false;
        tv.render.receiveShadows = false;
        // @ts-ignore engine-tsd
        tv.render.material.emissiveMap = texture;     // assign the rendered texture as an emissive texture
        tv.render.material.update();

        // setup skydome, use top mipmap level of cubemap (full resolution)
        app.scene.skyboxMip = 0;
        app.scene.setSkybox(assets['helipad.dds'].resources);

        app.scene.gammaCorrection = pc.GAMMA_SRGB;
        app.scene.toneMapping = pc.TONEMAP_ACES;

        // update things each frame
        let time = 0;
        let switchTime = 0;
        app.on("update", function (dt) {
            // rotate texture camera around the objects
            time += dt;
            textureCamera.setLocalPosition(12 * Math.sin(time), 3, 12 * Math.cos(time));
            textureCamera.lookAt(pc.Vec3.ZERO);

            // every 5 seconds switch texture camera between perspective and orthographic projection
            switchTime += dt;
            if (switchTime > 5) {
                switchTime = 0;
                if (textureCamera.camera.projection === pc.PROJECTION_ORTHOGRAPHIC) {
                    textureCamera.camera.projection = pc.PROJECTION_PERSPECTIVE;
                } else {
                    textureCamera.camera.projection = pc.PROJECTION_ORTHOGRAPHIC;
                    textureCamera.camera.orthoHeight = 5;
                }
            }
        });
    }
}

export default RenderToTextureExample;
