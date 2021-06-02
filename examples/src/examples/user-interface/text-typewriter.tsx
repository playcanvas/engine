import React from 'react';
import * as pc from 'playcanvas/build/playcanvas.js';
import Example from '../../app/example';
import { AssetLoader } from '../../app/helpers/loader';

class TextTypewriterExample extends Example {
    static CATEGORY = 'User Interface';
    static NAME = 'Text Typewriter';

    load() {
        return <>
            <AssetLoader name='font' type='font' url='static/assets/fonts/courier.json' />
        </>;
    }

    // @ts-ignore: override class function
    example(canvas: HTMLCanvasElement, assets: { font: pc.Asset }): void {

        // Create the application and start the update loop
        const app = new pc.Application(canvas, {});
        app.start();

        // Create a camera
        const camera = new pc.Entity();
        camera.addComponent("camera", {
            clearColor: new pc.Color(0, 0, 0)
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

        // Create a text element that wraps text over several lines
        const loremIpsum = "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.";
        const text = new pc.Entity();
        text.addComponent("element", {
            anchor: [0.5, 0.5, 0.5, 0.5],
            autoWidth: false,
            fontSize: 32,
            pivot: [0.5, 0.5],
            text: loremIpsum,
            type: pc.ELEMENTTYPE_TEXT,
            width: 512,
            wrapLines: true
        });
        screen.addChild(text);

        // Apply the font to the text element
        text.element.fontAsset = assets.font.id;

        // Start with no text printed
        text.element.rangeStart = 0;
        text.element.rangeEnd = 0;

        // Render a new character every 100ms
        setInterval(function () {
            text.element.rangeEnd += 1;
            if (text.element.rangeEnd >= loremIpsum.length) {
                text.element.rangeEnd = 0;
            }
        }, 100);
    }
}

export default TextTypewriterExample;
