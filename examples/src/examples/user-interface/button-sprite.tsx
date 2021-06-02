import React from 'react';
import * as pc from 'playcanvas/build/playcanvas.js';
import Example from '../../app/example';
import { AssetLoader } from '../../app/helpers/loader';

class ButtonSpriteExample extends Example {
    static CATEGORY = 'User Interface';
    static NAME = 'Button Sprite';

    load() {
        return <>
            <AssetLoader name='font' type='font' url='static/assets/fonts/arial.json' />
            <AssetLoader name='red_button_atlas' type='texture' url='static/assets/button/red_button_atlas.png' />
        </>;
    }

    // @ts-ignore: override class function
    example(canvas: HTMLCanvasElement, assets: { font: pc.Asset, red_button_atlas }): void {

        // Create the application and start the update loop
        const app = new pc.Application(canvas, {
            mouse: new pc.Mouse(document.body),
            touch: new pc.TouchDevice(document.body),
            elementInput: new pc.ElementInput(canvas)
        });

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

        // Create a simple button
        const button = new pc.Entity();
        button.addComponent("button", {
            active: true,
            imageEntity: button,
            transitionMode: pc.BUTTON_TRANSITION_MODE_SPRITE_CHANGE
        });
        button.addComponent("element", {
            anchor: [0.5, 0.5, 0.5, 0.5],
            height: 64,
            pivot: [0.5, 0.5],
            type: pc.ELEMENTTYPE_IMAGE,
            width: 175,
            useInput: true
        });
        screen.addChild(button);

        // Create a label for the button
        const label = new pc.Entity();
        label.addComponent("element", {
            anchor: [0.5, 0.5, 0.5, 0.5],
            color: new pc.Color(1, 1, 1),
            fontSize: 32,
            height: 64,
            opacity: 0.5,
            pivot: [0.5, 0.5],
            text: "CLICK ME",
            type: pc.ELEMENTTYPE_TEXT,
            width: 128,
            wrapLines: true
        });
        button.addChild(label);

        // Change the background color every time the button is clicked
        button.button.on('click', function () {
            const r = Math.random();
            camera.camera.clearColor = new pc.Color(r, r, r);
        });

        // Move the button's label with the animation of the sprite
        button.button.on('pressedstart', function () {
            label.translateLocal(0, -4, 0);
        });
        button.button.on('pressedend', function () {
            label.translateLocal(0, 4, 0);
        });

        // Apply the font to the text element
        label.element.fontAsset = assets.font.id;
        const texture = assets.red_button_atlas.resource;
        texture.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
        texture.addressV = pc.ADDRESS_CLAMP_TO_EDGE;
        texture.minFilter = pc.FILTER_NEAREST;
        texture.magFilter = pc.FILTER_NEAREST;

        const atlas = new pc.TextureAtlas();
        atlas.frames = {
            "0": {
                rect: new pc.Vec4(0, 147, 190, 49),
                pivot: new pc.Vec2(0.5, 0.5),
                border: new pc.Vec4(7, 11, 7, 7)
            },
            "1": {
                rect: new pc.Vec4(0, 98, 190, 49),
                pivot: new pc.Vec2(0.5, 0.5),
                border: new pc.Vec4(7, 11, 7, 7)
            },
            "2": {
                rect: new pc.Vec4(0, 49, 190, 49),
                pivot: new pc.Vec2(0.5, 0.5),
                border: new pc.Vec4(7, 11, 7, 7)
            },
            "3": {
                rect: new pc.Vec4(0, 0, 190, 49),
                pivot: new pc.Vec2(0.5, 0.5),
                border: new pc.Vec4(7, 11, 7, 7)
            }
        };
        atlas.texture = texture;

        const createSpriteAsset = function (frame: string) {
            const sprite = new pc.Sprite(app.graphicsDevice, {
                atlas: atlas,
                frameKeys: [frame],
                pixelsPerUnit: 1,
                renderMode: pc.SPRITE_RENDERMODE_SIMPLE
            });

            const spriteAsset = new pc.Asset('sprite', 'sprite', { url: '' });
            spriteAsset.resource = sprite;
            spriteAsset.loaded = true;
            app.assets.add(spriteAsset);
            return spriteAsset;
        };

        button.element.spriteAsset = createSpriteAsset('0').id;
        button.button.hoverSpriteAsset = createSpriteAsset('1');
        button.button.pressedSpriteAsset = createSpriteAsset('2');
        button.button.inactiveSpriteAsset = createSpriteAsset('3');
    }
}

export default ButtonSpriteExample;
