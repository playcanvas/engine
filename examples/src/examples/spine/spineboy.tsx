import React from 'react';
import * as pc from 'playcanvas/build/playcanvas.js';
import Example from '../../app/example';
import { AssetLoader } from '../../app/helpers/loader';

class SpineboyExample extends Example {
    static CATEGORY = 'Spine';
    static NAME = 'Spineboy';

    load() {
        return <>
            <AssetLoader name='skeleton' type='json' url='static/assets/spine/spineboy-pro.json' />
            <AssetLoader name='atlas' type='text' url='static/assets/spine/spineboy-pro.atlas' />
            <AssetLoader name='texture' type='texture' url='static/assets/spine/spineboy-pro.png' />
            <AssetLoader name='spinescript' type='script' url='static/scripts/spine/playcanvas-spine.3.8.js' />
        </>;
    }

    // @ts-ignore: override class function
    example(canvas: HTMLCanvasElement, assets: any): void {

        const app = new pc.Application(canvas, {});

        // create camera entity
        const camera = new pc.Entity('camera');
        camera.addComponent('camera', {
            clearColor: new pc.Color(0.5, 0.6, 0.9)
        });
        app.root.addChild(camera);
        camera.translateLocal(0, 7, 20);

        const spineEntity = new pc.Entity();
        spineEntity.addComponent("spine", {
            atlasAsset: assets.atlas.id,
            skeletonAsset: assets.skeleton.id,
            textureAssets: [assets.texture.id]
        });
        app.root.addChild(spineEntity);

        // @ts-ignore
        spineEntity.spine.state.setAnimation(0, "portal", true);

        app.start();
    }
}

export default SpineboyExample;
