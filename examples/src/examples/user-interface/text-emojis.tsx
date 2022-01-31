import React from 'react';
import * as pc from '../../../../';

import { AssetLoader } from '../../app/helpers/loader';

class TextEmojisExample {
    static CATEGORY = 'User Interface';
    static NAME = 'Text Emojis';

    load() {
        return <>
            <AssetLoader name='font' type='font' url='static/assets/fonts/arial.json' />
        </>;
    }

    example(canvas: HTMLCanvasElement, assets: { font: pc.Asset }): void {

        // Create the application with input and start the update loop
        const app = new pc.Application(canvas, {
            mouse: new pc.Mouse(document.body),
            touch: new pc.TouchDevice(document.body),
            elementInput: new pc.ElementInput(canvas)
        });
        app.start();

        // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
        app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
        app.setCanvasResolution(pc.RESOLUTION_AUTO);

        window.addEventListener("resize", function () {
            app.resizeCanvas(canvas.width, canvas.height);
        });

        // Create a camera
        const camera = new pc.Entity();
        camera.addComponent("camera", {
            clearColor: new pc.Color(30 / 255, 30 / 255, 30 / 255)
        });
        app.root.addChild(camera);

        // Create a 2D screen
        const screen = new pc.Entity();
        screen.addComponent("screen", {
            referenceResolution: new pc.Vec2(1280, 720),
            scaleBlend: 0.5,
            scaleMode: pc.SCALEMODE_BLEND,
            screenSpace: true
        });
        app.root.addChild(screen);

        // some sample text
        const firstLineText = "PlayCanvas supports Emojis via CanvasFont!";
        const flagsText = "Flags: 🇺🇸🇩🇪🇮🇪🇮🇹🏴‍☠️🇨🇦";
        const complexText = "Complex emoji: 👨🏿3️⃣👁️‍🗨️";

        // Create a canvas font asset
        const size = 64;
        const elSize = 32;

        // @ts-ignore engine-tsd
        const canvasFont = new pc.CanvasFont(app, {
            color: new pc.Color(1, 1, 1), // white
            fontName: "Arial",
            fontSize: size,
            width: 256,
            height: 256
        });

        // The first texture update needs to be `createTextures()`. Follow-up calls need to be `updateTextures()`.
        canvasFont.createTextures(firstLineText);
        canvasFont.updateTextures(flagsText);
        canvasFont.updateTextures(complexText);

        // Create the text entities
        function createText(y: number, text: string) {
            const canvasElementEntity = new pc.Entity();
            canvasElementEntity.setLocalPosition(0, y, 0);
            canvasElementEntity.addComponent("element", {
                pivot: new pc.Vec2(0.5, 0.5),
                anchor: new pc.Vec4(0.5, 0.5, 0.5, 0.5),
                fontSize: elSize,
                text: text,
                type: pc.ELEMENTTYPE_TEXT
            });
            canvasElementEntity.element.font = canvasFont;
            screen.addChild(canvasElementEntity);
        }
        createText(225, firstLineText);
        createText(150, flagsText);
        createText(100, complexText);


        // Canvas Fonts Debug - you shouldn't do this in your actual project
        const debugText = new pc.Entity();
        debugText.setLocalPosition(0, -50, 0);
        debugText.addComponent("element", {
            pivot: new pc.Vec2(0.5, 0.5),
            anchor: new pc.Vec4(0.5, 0.5, 0.5, 0.5),
            fontAsset: assets.font.id,
            fontSize: elSize,
            text: "The following are the CanvasFont's Texture Atlases,\ncontaining all the rendered characters:",
            type: pc.ELEMENTTYPE_TEXT
        });
        screen.addChild(debugText);

        // Create Layout Group Entity
        const group = new pc.Entity();
        group.setLocalPosition(0, -150, 0);
        group.addComponent("element", {
            // a Layout Group needs a 'group' element component
            type: pc.ELEMENTTYPE_GROUP,
            anchor: [0.5, 0.5, 0.5, 0.5],
            pivot: [0.5, 0.5],
            // the element's width and height dictate the group's bounds
            width: 300,
            height: 100
        });
        group.addComponent("layoutgroup", {
            orientation: pc.ORIENTATION_HORIZONTAL,
            // fit_both for width and height, making all child elements take the entire space
            widthFitting: pc.FITTING_BOTH,
            heightFitting: pc.FITTING_BOTH,
            // wrap children
            wrap: true
        });
        screen.addChild(group);

        // create 1 child per texture
        for (let i = 0; i < canvasFont.textures.length; i++) {
            const texture = canvasFont.textures[i];

            // create a random-colored panel
            const child = new pc.Entity();
            child.addComponent("element", {
                anchor: [0.5, 0.5, 0.5, 0.5],
                pivot: [0.5, 0.5],
                texture: texture,
                type: pc.ELEMENTTYPE_IMAGE
            });
            child.addComponent("layoutchild", {
                excludeFromLayout: false
            });
            group.addChild(child);
        }
    }
}

export default TextEmojisExample;
