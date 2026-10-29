import type {
    CameraFrameEffect, CameraFrameEffectContext, CameraFrameEffectPasses, CameraFrameEffectResources,
    CameraFrameEffectScene, GraphicsDevice, RenderPassShaderQuad, RenderTarget, Texture
} from '../../build/playcanvas.js';

declare const CameraFrameEffectBase: typeof CameraFrameEffect;
declare const device: GraphicsDevice;
declare const createBlurPass: (source: Texture) => RenderPassShaderQuad;

// an effect owning passes, written against the published typedefs
class BlurEffect extends CameraFrameEffectBase {
    highQuality = false;

    pass: RenderPassShaderQuad | null = null;

    createPasses(resources: CameraFrameEffectResources, passes: CameraFrameEffectPasses) {
        // the effect receives the resources it requires, and adds its passes to the stages
        const source: Texture | undefined = resources.sceneColorHalf;
        if (source) {
            this.pass = createBlurPass(source);
            passes.postResolve.push(this.pass);
        }

        const defines: Map<string, string> | undefined = resources.depth?.defines;
        const target: RenderTarget | undefined = resources.sceneTarget;

        // @ts-expect-error The stages hold frame passes.
        passes.preScene.push(source);
    }

    destroyPasses() {
        this.pass?.destroy();
        this.pass = null;
    }

    buildKey() {
        return `${this.highQuality}`;
    }

    resolveScene(scene: CameraFrameEffectScene) {
        // an effect resolving the scene to half the resolution
        scene.width = Math.ceil(scene.width / 2);
        scene.height = Math.ceil(scene.height / 2);

        // @ts-expect-error The scene color is a texture.
        scene.texture = 1;
    }

    frameUpdate(frame: CameraFrameEffectContext) {
        const dt: number = frame.dt;
    }
}

const effect = new BlurEffect(device, 'blur', { requires: ['sceneColorHalf'] });
const key: string = effect.buildKey();
