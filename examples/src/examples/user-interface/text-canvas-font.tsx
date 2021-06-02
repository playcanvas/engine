import React from 'react';
import * as pc from 'playcanvas/build/playcanvas.js';
import Example from '../../app/example';
import { AssetLoader } from '../../app/helpers/loader';

class TextCanvasFontExample extends Example {
    static CATEGORY = 'User Interface';
    static NAME = 'Text Canvas Font';

    load() {
        return <>
            <AssetLoader name='font' type='font' url='static/assets/fonts/arial.json' />
        </>;
    }

    // @ts-ignore: override class function
    example(canvas: HTMLCanvasElement, assets: { font: pc.Asset }): void {

        const app = new pc.Application(canvas, {
            mouse: new pc.Mouse(document.body),
            touch: new pc.TouchDevice(document.body),
            elementInput: new pc.ElementInput(canvas)
        });

        // use device pixel ratio
        app.graphicsDevice.maxPixelRatio = window.devicePixelRatio;

        // Create a canvas font asset
        const size = 64;
        const elSize = 32;
        // @ts-ignore engine-tsd
        const cf = new pc.CanvasFont(app, {
            color: new pc.Color(1, 1, 1), // white
            fontName: "Arial",
            fontSize: size,
            width: 256,
            height: 256
        });

        // create camera
        const c = new pc.Entity();
        c.addComponent('camera', {
            clearColor: new pc.Color(44 / 255, 62 / 255, 80 / 255),
            farClip: 10000
        });
        c.translate(500, 500, 500);
        c.lookAt(0, 0, 0);
        app.root.addChild(c);

        const scr = new pc.Entity();
        scr.addComponent("screen", {
            screenSpace: true,
            referenceResolution: [1280, 720],
            scaleMode: pc.SCALEMODE_BLEND,
            scaleBlend: 1
        });

        const backing = new pc.Entity();
        backing.addComponent('element', {
            type: "image",
            anchor: [0.5, 1, 0.5, 1],
            pivot: [0.5, 1],
            width: 768,
            height: 500,
            color: [0.1, 0.1, 0.1]
        });
        scr.addChild(backing);
        backing.translateLocal(0, -100, 0);

        // some sample text
        const firstline = "Flags: 🇺🇸🇩🇪🇮🇪🇮🇹🏴‍☠️🇨🇦";
        const secondline = "Complex emoji: 👨🏿3️⃣👁️‍🗨️";
        const thirdline = "Just strings";

        cf.createTextures(firstline);

        const canvasElementEntity1 = new pc.Entity();
        canvasElementEntity1.addComponent("element", {
            type: "text",
            fontAsset: assets.font,
            fontSize: elSize,
            text: firstline,
            wrapLines: true,
            autoWidth: true,
            autoHeight: true,
            margin: [0, 0, 0, 0],
            anchor: [0, 1, 1, 1],
            pivot: [0, 1],
            alignment: [1, 0]
        });

        cf.updateTextures(secondline);
        const canvasElementEntity2 = new pc.Entity();
        canvasElementEntity2.addComponent("element", {
            type: "text",
            fontAsset: assets.font,
            fontSize: elSize,
            text: secondline,
            wrapLines: true,
            autoWidth: true,
            autoHeight: true,
            margin: [0, 0, 0, 0],
            anchor: [0, 1, 1, 1],
            pivot: [0, 1],
            alignment: [1, 0]
        });

        const msdfElementEntity = new pc.Entity();
        msdfElementEntity.addComponent("element", {
            type: "text",
            fontAsset: assets.font,
            fontSize: elSize,
            text: thirdline,
            wrapLines: true,
            autoWidth: true,
            autoHeight: true,
            margin: [0, 0, 0, 0],
            anchor: [0, 1, 1, 1],
            pivot: [0, 1],
            alignment: [1, 0]
        });

        app.root.addChild(scr);
        backing.addChild(canvasElementEntity1);
        canvasElementEntity1.translateLocal(0, 0, 0);
        backing.addChild(canvasElementEntity2);
        canvasElementEntity2.translateLocal(0, -elSize, 0);
        backing.addChild(msdfElementEntity);
        msdfElementEntity.translateLocal(0, -elSize * 3, 0);

        function renderAtlases() {
            const wrapper = document.createElement('div');
            for (let i = 0; i < cf.textures.length; i++) {
                const canvas = cf.textures[i].getSource();
                canvas.style.marginLeft = '20px';
                canvas.style.border = '1px solid blue';
                wrapper.appendChild(canvas);
            }
            wrapper.style.position = 'absolute';
            wrapper.style.top = '0px';
            document.body.appendChild(wrapper);
        }
        // purely for debugging: do not do this in a real application
        const showCanvasAtlasForDebug = false;
        renderAtlases();

        // start the application
        app.start();
    }
}

export default TextCanvasFontExample;
