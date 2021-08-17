import React from 'react';
import * as pc from 'playcanvas/build/playcanvas.js';
import { AssetLoader } from '../../app/helpers/loader';
import Example from '../../app/example';

class VideoTextureExample extends Example {
    static CATEGORY = 'Graphics';
    static NAME = 'Video Texture';

    load() {
        return <>
            <AssetLoader name='tv' type='container' url='static/assets/models/tv.glb' />
        </>;
    }

    // @ts-ignore: override class function
    example(canvas: HTMLCanvasElement, assets: { tv: pc.Asset }): void {

        // Create the application and start the update loop
        const app = new pc.Application(canvas, {});
        app.start();

        // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
        app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
        app.setCanvasResolution(pc.RESOLUTION_AUTO);

        app.scene.ambientLight = new pc.Color(0.2, 0.2, 0.2);

        // Create an Entity with a camera component
        const camera = new pc.Entity();
        camera.addComponent("camera", {
            clearColor: new pc.Color(0.4, 0.45, 0.5)
        });
        camera.translate(0, 0, 15);

        // Create an Entity with a omni light
        const light = new pc.Entity();
        light.addComponent("light", {
            type: "omni",
            color: new pc.Color(1, 1, 1),
            range: 30
        });
        light.translate(5, 5, 10);

        app.root.addChild(camera);
        app.root.addChild(light);

        // Create a texture to hold the video frame data
        const videoTexture = new pc.Texture(app.graphicsDevice, {
            format: pc.PIXELFORMAT_R5_G6_B5,
            mipmaps: false,
            minFilter: pc.FILTER_LINEAR,
            magFilter: pc.FILTER_LINEAR,
            addressU: pc.ADDRESS_CLAMP_TO_EDGE,
            addressV: pc.ADDRESS_CLAMP_TO_EDGE
        });

        // Create our HTML element with the video
        const video: HTMLVideoElement = document.createElement('video');
        video.id = 'vid';
        video.loop = true;

        // Muted so that we can autoplay
        video.muted = true;
        video.autoplay = true;

        // Inline needed for iOS otherwise it plays at fullscreen
        video.playsInline = true;

        video.crossOrigin = "anonymous";

        // Make sure that the video is in view on the page otherwise it doesn't
        // load on some browsers, especially mobile
        video.setAttribute('style', 'display: block; width: 1px; height: 1px; position: absolute; opacity: 0; z-index: -1000; top: 0px; pointer-events: none');

        video.src = 'static/assets/video/SampleVideo_1280x720_1mb.mp4';
        document.body.append(video);

        video.addEventListener('canplaythrough', function () {
            videoTexture.setSource(video);
        });

        // create an entity to render the tv mesh
        const entity = assets.tv.resource.instantiateRenderEntity();
        app.root.addChild(entity);

        // Create a material that will use our video texture
        const material = new pc.StandardMaterial();
        material.useLighting = false;
        material.emissiveMap = videoTexture;
        material.update();

        // set the material on the screen mesh
        entity.render.meshInstances[1].material = material;

        video.load();

        const mouse = new pc.Mouse(document.body);
        mouse.on('mousedown', function (event) {
            if (entity && event.buttons[pc.MOUSEBUTTON_LEFT]) {
                video.muted = !video.muted;
            }
        });

        let upload = false;
        let time = 0;
        app.on('update', function (dt) {
            time += dt;

            // rotate the tv object
            entity.setLocalEulerAngles(100 + Math.sin(time) * 50, 0, -90);

            // Upload the video data to the texture every other frame
            upload = !upload;
            if (upload) {
                videoTexture.upload();
            }
        });
    }
}

export default VideoTextureExample;
