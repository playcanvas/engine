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

        // Create an Entity with a omni light component and a sphere model component.
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
            mipmaps: false
        });
        videoTexture.minFilter = pc.FILTER_LINEAR;
        videoTexture.magFilter = pc.FILTER_LINEAR;
        videoTexture.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
        videoTexture.addressV = pc.ADDRESS_CLAMP_TO_EDGE;

        // Grab our HTML element with the video
        const video: HTMLVideoElement = document.createElement('video');
        video.setAttribute('autoplay', 'true');
        video.setAttribute('loop', 'true');
        video.setAttribute('muted', 'true');
        video.setAttribute('playsinline', 'true');
        video.setAttribute('crossorigin', 'anonymous');
        video.setAttribute('style', 'display:none');
        video.setAttribute('id', 'vid');
        const videoSource: HTMLSourceElement = document.createElement('source');
        videoSource.setAttribute('src', 'static/assets/video/SampleVideo_1280x720_1mb.mp4');
        videoSource.setAttribute('type', 'video/mp4');
        video.append(videoSource);
        document.body.append('video');
        video.addEventListener('canplay', function () {
            videoTexture.setSource(video);
        });

        // Create a material that will use our video texture
        const material = new pc.StandardMaterial();
        material.useLighting = false;
        material.emissiveMap = videoTexture;

        let upload = false;
        let ready = false;
        const entity = new pc.Entity();
        entity.setLocalEulerAngles(0, -75, 0);
        app.root.addChild(entity);

        const modelComponent = entity.addComponent("model", {
            type: "asset",
            asset: assets.tv.resource.model
        });
        // @ts-ignore engine-tsd
        const model = modelComponent.model;
        model.meshInstances[1].material = material;
        video.load();
        // video.play();
        ready = true;

        const mouse = new pc.Mouse(document.body);
        let x = 0;
        const y = 0;

        mouse.on('mousemove', function (event) {
            if (entity && event.buttons[pc.MOUSEBUTTON_LEFT]) {
                x += event.dx;
                entity.setLocalEulerAngles(0, 0.2 * x - 75, 0);
            }
        });

        mouse.on('mousedown', function (event) {
            if (entity && event.buttons[pc.MOUSEBUTTON_LEFT]) {
                video.muted = !video.muted;
            }
        });

        app.on('update', function (dt) {
            if (!ready) return;

            // Upload the video data to the texture every other frame
            upload = !upload;
            if (upload) {
                videoTexture.upload();
            }
        });
    }
}

export default VideoTextureExample;
