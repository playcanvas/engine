import React from 'react';
import * as pc from 'playcanvas/build/playcanvas.js';
import Example from '../../app/example';
import { AssetLoader } from '../../app/helpers/loader';

class RenderCubemapExample extends Example {
    static CATEGORY = 'Graphics';
    static NAME = 'Render Cubemap';

    load() {
        return <>
            <AssetLoader name='helipad.dds' type='cubemap' url='static/assets/cubemaps/helipad.dds' data={{ type: pc.TEXTURETYPE_RGBM }}/>
            <AssetLoader name='script' type='script' url='static/scripts/utils/cubemap-renderer.js' />
        </>;
    }

    // @ts-ignore: override class function
    example(canvas: HTMLCanvasElement, assets: { 'helipad.dds': pc.Asset, script: pc.Asset }): void {

        // Create the app
        const app = new pc.Application(canvas, {});

        // start the update loop
        app.start();

        // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
        app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
        app.setCanvasResolution(pc.RESOLUTION_AUTO);

        // set up some general scene rendering properties
        app.scene.gammaCorrection = pc.GAMMA_SRGB;
        app.scene.toneMapping = pc.TONEMAP_ACES;

        // setup skydome
        app.scene.skyboxMip = 0;        // use top mipmap level of cubemap (full resolution)
        app.scene.skyboxIntensity = 2;  // make it brighter

        app.scene.setSkybox(assets['helipad.dds'].resources);

        // helper function to create high polygon version of a sphere and sets up an entity to allow it to be added to the scene
        const createHighQualitySphere = function (material: pc.Material, layer: number[]) {
            // create hight resolution sphere
            // @ts-ignore engine-tsd
            const mesh = pc.createSphere(app.graphicsDevice, { latitudeBands: 200, longitudeBands: 200 });

            // Create the mesh instance
            const node = new pc.GraphNode();
            this.meshInstance = new pc.MeshInstance(mesh, material, node);

            // Create a model and add the mesh instance to it
            const model = new pc.Model();
            model.graph = node;
            model.meshInstances = [this.meshInstance];

            // Create Entity and add it to the scene
            const entity = new pc.Entity("ShinyBall");
            app.root.addChild(entity);

            // Add a model compoonent
            entity.addComponent('model', {
                type: 'asset',
                layers: layer
            });
            entity.model.model = model;

            return entity;
        };

        // helper function to create a primitive with shape type, position, scale, color and layer
        function createPrimitive(primitiveType: string, position: number | pc.Vec3, scale: number | pc.Vec3, color: pc.Color, layer: number[]) {
            // create material of specified color
            const material = new pc.StandardMaterial();
            material.diffuse = color;
            material.shininess = 60;
            material.metalness = 0.7;
            material.useMetalness = true;
            material.update();

            // create primitive
            const primitive = new pc.Entity();
            primitive.addComponent('model', {
                type: primitiveType,
                layers: layer
            });
            primitive.model.material = material;

            // set position and scale and add it to scene
            primitive.setLocalPosition(position);
            primitive.setLocalScale(scale);
            app.root.addChild(primitive);

            return primitive;
        }

        // create a layer for object that do not render into texture
        const excludedLayer = new pc.Layer({ name: "Excluded" });
        app.scene.layers.push(excludedLayer);

        // create material for the shiny ball
        const shinyMat = new pc.StandardMaterial();

        // create shiny ball mesh - this is on excluded layer as it does not render to cubemap
        const shinyBall = createHighQualitySphere(shinyMat, [excludedLayer.id]);
        shinyBall.setLocalPosition(0, 0, 0);
        shinyBall.setLocalScale(10, 10, 10);

        // get world and skybox layers
        const worldLayer = app.scene.layers.getLayerByName("World");
        const skyboxLayer = app.scene.layers.getLayerByName("Skybox");
        const immediateLayer = app.scene.layers.getLayerByName("Immediate");

        // add camera component to shiny ball - this defines camera properties for cubemap rendering
        shinyBall.addComponent('camera', {

            // optimization - no need to clear as all pixels get overwritten
            clearColorBuffer: false,

            // cubemap camera will render objects on world layer and also skybox
            layers: [worldLayer.id, skyboxLayer.id],

            // priority - render before world camera
            priority: -1,

            // disable as this is not a camera that renders cube map but only a container for properties for cube map rendering
            enabled: false
        });

        // add cubemapRenderer script component which takes care of rendering dynamic cubemap
        shinyBall.addComponent('script');
        shinyBall.script.create('cubemapRenderer', {
            attributes: {
                resolution: 256,
                mipmaps: true,
                depth: true
            }
        });

        // finish set up of shiny material - make reflection a bit darker
        shinyMat.diffuse = new pc.Color(0.6, 0.6, 0.6);

        // use cubemap which is generated by cubemapRenderer instead of global skybox cubemap
        shinyMat.useSkybox = false;
        // @ts-ignore engine-tsd
        shinyMat.cubeMap = shinyBall.script.cubemapRenderer.cubeMap;

        // make it shiny without diffuse component
        shinyMat.metalness = 1;
        shinyMat.useMetalness = true;
        shinyMat.update();

        // create few random primitives in the world layer
        const entities: pc.Entity[] = [];
        const shapes = ["box", "cone", "cylinder", "sphere", "capsule"];
        for (let i = 0; i < 6; i++) {
            const shapeName = shapes[Math.floor(Math.random() * shapes.length)];
            const color = new pc.Color(Math.random(), Math.random(), Math.random());
            entities.push(createPrimitive(shapeName, pc.Vec3.ZERO, new pc.Vec3(3, 3, 3), color, [worldLayer.id]));
        }

        // create green plane as a base to cast shadows on
        createPrimitive("plane", new pc.Vec3(0, -8, 0), new pc.Vec3(20, 20, 20), new pc.Color(0.3, 0.5, 0.3), [worldLayer.id]);

        // Create main camera, which renders entities in world, excluded and skybox layers
        const camera = new pc.Entity("MainCamera");
        camera.addComponent("camera", {
            fov: 60,
            layers: [worldLayer.id, excludedLayer.id, skyboxLayer.id, immediateLayer.id]
        });
        app.root.addChild(camera);

        // Create an Entity with a directional light component
        const light = new pc.Entity();
        light.addComponent("light", {
            type: "directional",
            color: pc.Color.YELLOW,
            range: 40,
            castShadows: true,
            layers: [worldLayer.id],
            shadowBias: 0.2,
            shadowResolution: 1024,
            normalOffsetBias: 0.05,
            shadowDistance: 40
        });
        app.root.addChild(light);

        // helper function to create a texture that can be used to project cubemap to
        function createReprojectionTexture(projection: string, size: number) {
            return new pc.Texture(this.app.graphicsDevice, {
                width: size,
                height: size,
                format: pc.PIXELFORMAT_R8_G8_B8,
                mipmaps: false,
                minFilter: pc.FILTER_LINEAR,
                magFilter: pc.FILTER_LINEAR,
                addressU: pc.ADDRESS_CLAMP_TO_EDGE,
                addressV: pc.ADDRESS_CLAMP_TO_EDGE,
                projection: projection
            });
        }

        // create 2 uqirect and 2 octahedral textures
        const textureEqui = createReprojectionTexture(pc.TEXTUREPROJECTION_EQUIRECT, 256);
        const textureEqui2 = createReprojectionTexture(pc.TEXTUREPROJECTION_EQUIRECT, 256);
        const textureOcta = createReprojectionTexture(pc.TEXTUREPROJECTION_OCTAHEDRAL, 64);
        const textureOcta2 = createReprojectionTexture(pc.TEXTUREPROJECTION_OCTAHEDRAL, 32);

        // update things each frame
        let time = 0;
        const device = app.graphicsDevice;
        app.on("update", function (dt) {
            time += dt;

            // rotate primitives around their center and also orbit them around the shiny sphere
            for (let e = 0; e < entities.length; e++) {
                const scale = (e + 1) / entities.length;
                const offset = time + e * 200;
                // @ts-ignore engine-tsd
                entities[e].setLocalPosition(7 * Math.sin(offset), 2 * (e - 3), 7 * Math.cos(offset));
                entities[e].rotate(1 * scale, 2 * scale, 3 * scale);
            }

            // slowly orbit camera around
            camera.setLocalPosition(20 * Math.cos(time * 0.2), 2, 20 * Math.sin(time * 0.2));
            camera.lookAt(pc.Vec3.ZERO);

            // project textures, and display them on the screen
            // @ts-ignore engine-tsd
            const srcCube = shinyBall.script.cubemapRenderer.cubeMap;

            // cube -> equi1
            pc.reprojectTexture(srcCube, textureEqui, {
                numSamples: 1
            });
            // @ts-ignore engine-tsd
            app.renderTexture(-0.6, 0.7, 0.6, 0.3, textureEqui);

            // cube -> octa1
            pc.reprojectTexture(srcCube, textureOcta, {
                numSamples: 1
            });
            // @ts-ignore engine-tsd
            app.renderTexture(0.7, 0.7, 0.4, 0.4, textureOcta);

            // equi1 -> octa2
            pc.reprojectTexture(textureEqui, textureOcta2, {
                specularPower: 32,
                numSamples: 1024
            });
            // @ts-ignore engine-tsd
            app.renderTexture(-0.7, -0.7, 0.4, 0.4, textureOcta2);

            // octa1 -> equi2
            pc.reprojectTexture(textureOcta, textureEqui2, {
                specularPower: 16,
                numSamples: 512
            });
            // @ts-ignore engine-tsd
            app.renderTexture(0.6, -0.7, 0.6, 0.3, textureEqui2);
        });
    }
}

export default RenderCubemapExample;
