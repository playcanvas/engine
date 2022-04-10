import * as pc from '../../../../';

class SpineboyExample {
    static CATEGORY = 'Misc';
    static NAME = 'Spineboy';


    // @ts-ignore: override class function
    example(canvas: HTMLCanvasElement): void {

        const app = new pc.Application(canvas, {});

        const assets = {
            'skeleton': new pc.Asset('skeleton', 'json', { url: '/static/assets/spine/spineboy-pro.json' }),
            'atlas': new pc.Asset('atlas', 'text', { url: '/static/assets/spine/spineboy-pro.atlas' }),
            'texture': new pc.Asset('spineboy-pro.png', 'texture', { url: '/static/assets/spine/spineboy-pro.png' }),
            'spinescript': new pc.Asset('spinescript', 'script', { url: '/static/scripts/spine/playcanvas-spine.3.8.js' })
        };

        const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
        assetListLoader.load(() => {
            app.start();

            // create camera entity
            const camera = new pc.Entity('camera');
            camera.addComponent('camera', {
                clearColor: new pc.Color(0.5, 0.6, 0.9)
            });
            app.root.addChild(camera);
            camera.translateLocal(0, 7, 20);

            const createSpineInstance = (position: pc.Vec3, scale: pc.Vec3, timeScale: number) => {

                const spineEntity = new pc.Entity();
                spineEntity.addComponent("spine", {
                    atlasAsset: assets.atlas.id,
                    skeletonAsset: assets.skeleton.id,
                    textureAssets: [assets.texture.id]
                });
                spineEntity.setLocalPosition(position);
                spineEntity.setLocalScale(scale);
                app.root.addChild(spineEntity);

                // play spine animation
                // @ts-ignore
                spineEntity.spine.state.setAnimation(0, "portal", true);

                // @ts-ignore
                spineEntity.spine.state.timeScale = timeScale;
            };

            // create spine entity 1
            createSpineInstance(new pc.Vec3(2, 2, 0), new pc.Vec3(1, 1, 1), 1);

            // create spine entity 2
            createSpineInstance(new pc.Vec3(2, 10, 0), new pc.Vec3(-0.5, 0.5, 0.5), 0.5);
        });
    }
}

export default SpineboyExample;
