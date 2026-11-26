import { createGraphicsDevice } from './device.mjs';
import { AppBase } from '../src/framework/app-base.js';
import { AppOptions } from '../src/framework/app-options.js';
import { AnimComponentSystem } from '../src/framework/components/anim/system.js';
import { AnimationComponentSystem } from '../src/framework/components/animation/system.js';
import { AudioListenerComponentSystem } from '../src/framework/components/audio-listener/system.js';
import { ButtonComponentSystem } from '../src/framework/components/button/system.js';
import { CameraComponentSystem } from '../src/framework/components/camera/system.js';
import { CollisionComponentSystem } from '../src/framework/components/collision/system.js';
import { ElementComponentSystem } from '../src/framework/components/element/system.js';
import { GSplatComponentSystem } from '../src/framework/components/gsplat/system.js';
import { JointComponentSystem } from '../src/framework/components/joint/system.js';
import { LayoutChildComponentSystem } from '../src/framework/components/layout-child/system.js';
import { LayoutGroupComponentSystem } from '../src/framework/components/layout-group/system.js';
import { LightComponentSystem } from '../src/framework/components/light/system.js';
import { ModelComponentSystem } from '../src/framework/components/model/system.js';
import { ParticleSystemComponentSystem } from '../src/framework/components/particle-system/system.js';
import { RenderComponentSystem } from '../src/framework/components/render/system.js';
import { RigidBodyComponentSystem } from '../src/framework/components/rigid-body/system.js';
import { ScreenComponentSystem } from '../src/framework/components/screen/system.js';
import { ScriptComponentSystem } from '../src/framework/components/script/system.js';
import { ScrollViewComponentSystem } from '../src/framework/components/scroll-view/system.js';
import { ScrollbarComponentSystem } from '../src/framework/components/scrollbar/system.js';
import { SoundComponentSystem } from '../src/framework/components/sound/system.js';
import { SpriteComponentSystem } from '../src/framework/components/sprite/system.js';
import { ZoneComponentSystem } from '../src/framework/components/zone/system.js';
import { AnimClipHandler } from '../src/framework/handlers/anim-clip.js';
import { AnimStateGraphHandler } from '../src/framework/handlers/anim-state-graph.js';
import { AnimationHandler } from '../src/framework/handlers/animation.js';
import { AudioHandler } from '../src/framework/handlers/audio.js';
import { BinaryHandler } from '../src/framework/handlers/binary.js';
import { ContainerHandler } from '../src/framework/handlers/container.js';
import { CssHandler } from '../src/framework/handlers/css.js';
import { CubemapHandler } from '../src/framework/handlers/cubemap.js';
import { FolderHandler } from '../src/framework/handlers/folder.js';
import { FontHandler } from '../src/framework/handlers/font.js';
import { GSplatHandler } from '../src/framework/handlers/gsplat.js';
import { HierarchyHandler } from '../src/framework/handlers/hierarchy.js';
import { HtmlHandler } from '../src/framework/handlers/html.js';
import { JsonHandler } from '../src/framework/handlers/json.js';
import { MaterialHandler } from '../src/framework/handlers/material.js';
import { ModelHandler } from '../src/framework/handlers/model.js';
import { RenderHandler } from '../src/framework/handlers/render.js';
import { SceneHandler } from '../src/framework/handlers/scene.js';
import { ScriptHandler } from '../src/framework/handlers/script.js';
import { ShaderHandler } from '../src/framework/handlers/shader.js';
import { SpriteHandler } from '../src/framework/handlers/sprite.js';
import { TemplateHandler } from '../src/framework/handlers/template.js';
import { TextHandler } from '../src/framework/handlers/text.js';
import { TextureAtlasHandler } from '../src/framework/handlers/texture-atlas.js';
import { TextureHandler } from '../src/framework/handlers/texture.js';
import { Lightmapper } from '../src/framework/lightmapper/lightmapper.js';
import { XrManager } from '../src/framework/xr/xr-manager.js';
import { SoundManager } from '../src/platform/sound/manager.js';
import { BatchManager } from '../src/scene/batching/batch-manager.js';

/**
 * @import { GraphicsDevice } from '../src/platform/graphics/graphics-device.js'
 */

// every component system and resource handler the engine implements, so a test can add any
// component or load any asset type without registering it first
const componentSystems = [
    RigidBodyComponentSystem,
    CollisionComponentSystem,
    JointComponentSystem,
    AnimationComponentSystem,
    AnimComponentSystem,
    ModelComponentSystem,
    RenderComponentSystem,
    CameraComponentSystem,
    LightComponentSystem,
    ScriptComponentSystem,
    SoundComponentSystem,
    AudioListenerComponentSystem,
    ParticleSystemComponentSystem,
    ScreenComponentSystem,
    ElementComponentSystem,
    ButtonComponentSystem,
    ScrollViewComponentSystem,
    ScrollbarComponentSystem,
    SpriteComponentSystem,
    LayoutGroupComponentSystem,
    LayoutChildComponentSystem,
    ZoneComponentSystem,
    GSplatComponentSystem
];

const resourceHandlers = [
    RenderHandler,
    AnimationHandler,
    AnimClipHandler,
    AnimStateGraphHandler,
    ModelHandler,
    MaterialHandler,
    TextureHandler,
    TextHandler,
    JsonHandler,
    AudioHandler,
    ScriptHandler,
    SceneHandler,
    CubemapHandler,
    HtmlHandler,
    CssHandler,
    ShaderHandler,
    HierarchyHandler,
    FolderHandler,
    FontHandler,
    BinaryHandler,
    TextureAtlasHandler,
    SpriteHandler,
    TemplateHandler,
    ContainerHandler,
    GSplatHandler
];

/**
 * Create a new application with every component system and resource handler registered, on the
 * graphics device the tests run on: the null device, or a WebGPU device under
 * `npm run test:webgpu`.
 *
 * @param {object} [options] - Options for the application.
 * @param {HTMLCanvasElement} [options.canvas] - The canvas. Defaults to a new canvas element.
 * @param {GraphicsDevice} [options.graphicsDevice] - The graphics device. Defaults to the test
 * device, created on the canvas.
 * @param {Partial<AppOptions>} [options.appOptions] - Further {@link AppOptions} fields, such as
 * input devices or the physics world.
 * @returns {AppBase} The new application instance.
 */
function createApp({ canvas = document.createElement('canvas'), graphicsDevice, appOptions = {} } = {}) {
    const options = new AppOptions();
    options.graphicsDevice = graphicsDevice ?? createGraphicsDevice(canvas);
    options.componentSystems = componentSystems;
    options.resourceHandlers = resourceHandlers;
    options.soundManager = new SoundManager();
    options.lightmapper = Lightmapper;
    options.batchManager = BatchManager;
    options.xr = XrManager;
    Object.assign(options, appOptions);

    const app = new AppBase(canvas);
    app.init(options);
    return app;
}

export { createApp };
