import { platform } from '../core/platform.mjs';

import { WebglGraphicsDevice } from '../platform/graphics/webgl/webgl-graphics-device.mjs';

import { SoundManager } from '../platform/sound/manager.mjs';

import { Lightmapper } from './lightmapper/lightmapper.mjs';
import { BatchManager } from '../scene/batching/batch-manager.mjs';

import { AppBase } from './app-base.mjs';
import { AppOptions } from './app-options.mjs';
import { script } from './script.mjs';
import { AnimationComponentSystem } from './components/animation/system.mjs';
import { AnimComponentSystem } from './components/anim/system.mjs';
import { AudioListenerComponentSystem } from './components/audio-listener/system.mjs';
import { AudioSourceComponentSystem } from './components/audio-source/system.mjs';
import { ButtonComponentSystem } from './components/button/system.mjs';
import { CollisionComponentSystem } from './components/collision/system.mjs';
import { ElementComponentSystem } from './components/element/system.mjs';
import { JointComponentSystem } from './components/joint/system.mjs';
import { LayoutChildComponentSystem } from './components/layout-child/system.mjs';
import { LayoutGroupComponentSystem } from './components/layout-group/system.mjs';
import { ModelComponentSystem } from './components/model/system.mjs';
import { ParticleSystemComponentSystem } from './components/particle-system/system.mjs';
import { RenderComponentSystem } from './components/render/system.mjs';
import { RigidBodyComponentSystem } from './components/rigid-body/system.mjs';
import { ScreenComponentSystem } from './components/screen/system.mjs';
import { ScriptLegacyComponentSystem } from './components/script-legacy/system.mjs';
import { ScrollViewComponentSystem } from './components/scroll-view/system.mjs';
import { ScrollbarComponentSystem } from './components/scrollbar/system.mjs';
import { SoundComponentSystem } from './components/sound/system.mjs';
import { SpriteComponentSystem } from './components/sprite/system.mjs';
import { ZoneComponentSystem } from './components/zone/system.mjs';
import { CameraComponentSystem } from './components/camera/system.mjs';
import { LightComponentSystem } from './components/light/system.mjs';
import { ScriptComponentSystem } from './components/script/system.mjs';

import { RenderHandler } from './handlers/render.mjs';
import { AnimationHandler } from './handlers/animation.mjs';
import { AnimClipHandler } from './handlers/anim-clip.mjs';
import { AnimStateGraphHandler } from './handlers/anim-state-graph.mjs';
import { AudioHandler } from './handlers/audio.mjs';
import { BinaryHandler } from './handlers/binary.mjs';
import { ContainerHandler } from './handlers/container.mjs';
import { CssHandler } from './handlers/css.mjs';
import { CubemapHandler } from './handlers/cubemap.mjs';
import { FolderHandler } from './handlers/folder.mjs';
import { FontHandler } from './handlers/font.mjs';
import { HierarchyHandler } from './handlers/hierarchy.mjs';
import { HtmlHandler } from './handlers/html.mjs';
import { JsonHandler } from './handlers/json.mjs';
import { MaterialHandler } from './handlers/material.mjs';
import { ModelHandler } from './handlers/model.mjs';
import { SceneHandler } from './handlers/scene.mjs';
import { ScriptHandler } from './handlers/script.mjs';
import { ShaderHandler } from './handlers/shader.mjs';
import { SpriteHandler } from './handlers/sprite.mjs';
import { TemplateHandler } from './handlers/template.mjs';
import { TextHandler } from './handlers/text.mjs';
import { TextureAtlasHandler } from './handlers/texture-atlas.mjs';
import { TextureHandler } from './handlers/texture.mjs';

import { XrManager } from './xr/xr-manager.mjs';

/**
 * An Application represents and manages your PlayCanvas application. If you are developing using
 * the PlayCanvas Editor, the Application is created for you. You can access your Application
 * instance in your scripts. Below is a skeleton script which shows how you can access the
 * application 'app' property inside the initialize and update functions:
 *
 * ```javascript
 * // Editor example: accessing the pc.Application from a script
 * var MyScript = pc.createScript('myScript');
 *
 * MyScript.prototype.initialize = function() {
 *     // Every script instance has a property 'this.app' accessible in the initialize...
 *     const app = this.app;
 * };
 *
 * MyScript.prototype.update = function(dt) {
 *     // ...and update functions.
 *     const app = this.app;
 * };
 * ```
 *
 * If you are using the Engine without the Editor, you have to create the application instance
 * manually.
 *
 * @augments AppBase
 */
class Application extends AppBase {
    /**
     * Create a new Application instance.
     *
     * @param {HTMLCanvasElement} canvas - The canvas element.
     * @param {object} [options] - The options object to configure the Application.
     * @param {import('./input/element-input.mjs').ElementInput} [options.elementInput] - Input
     * handler for {@link ElementComponent}s.
     * @param {import('../platform/input/keyboard.mjs').Keyboard} [options.keyboard] - Keyboard
     * handler for input.
     * @param {import('../platform/input/mouse.mjs').Mouse} [options.mouse] - Mouse handler for
     * input.
     * @param {import('../platform/input/touch-device.mjs').TouchDevice} [options.touch] - TouchDevice
     * handler for input.
     * @param {import('../platform/input/game-pads.mjs').GamePads} [options.gamepads] - Gamepad
     * handler for input.
     * @param {string} [options.scriptPrefix] - Prefix to apply to script urls before loading.
     * @param {string} [options.assetPrefix] - Prefix to apply to asset urls before loading.
     * @param {object} [options.graphicsDeviceOptions] - Options object that is passed into the
     * {@link GraphicsDevice} constructor.
     * @param {string[]} [options.scriptsOrder] - Scripts in order of loading first.
     * @example
     * // Engine-only example: create the application manually
     * const app = new pc.Application(canvas, options);
     *
     * // Start the application's main loop
     * app.start();
     */
    constructor(canvas, options = {}) {
        super(canvas);

        const appOptions = new AppOptions();

        appOptions.graphicsDevice = this.createDevice(canvas, options);
        this.addComponentSystems(appOptions);
        this.addResourceHandles(appOptions);

        appOptions.elementInput = options.elementInput;
        appOptions.keyboard = options.keyboard;
        appOptions.mouse = options.mouse;
        appOptions.touch = options.touch;
        appOptions.gamepads = options.gamepads;

        appOptions.scriptPrefix = options.scriptPrefix;
        appOptions.assetPrefix = options.assetPrefix;
        appOptions.scriptsOrder = options.scriptsOrder;

        appOptions.soundManager = new SoundManager();
        appOptions.lightmapper = Lightmapper;
        appOptions.batchManager = BatchManager;
        appOptions.xr = XrManager;

        this.init(appOptions);
    }

    createDevice(canvas, options) {

        if (!options.graphicsDeviceOptions) {
            options.graphicsDeviceOptions = { };
        }
        if (platform.browser && !!navigator.xr) {
            options.graphicsDeviceOptions.xrCompatible = true;
        }
        options.graphicsDeviceOptions.alpha = options.graphicsDeviceOptions.alpha || false;

        return new WebglGraphicsDevice(canvas, options.graphicsDeviceOptions);
    }

    addComponentSystems(appOptions) {
        appOptions.componentSystems = [
            RigidBodyComponentSystem,
            CollisionComponentSystem,
            JointComponentSystem,
            AnimationComponentSystem,
            AnimComponentSystem,
            ModelComponentSystem,
            RenderComponentSystem,
            CameraComponentSystem,
            LightComponentSystem,
            script.legacy ? ScriptLegacyComponentSystem : ScriptComponentSystem,
            AudioSourceComponentSystem,
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
            ZoneComponentSystem
        ];
    }

    addResourceHandles(appOptions) {
        appOptions.resourceHandlers = [
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
            ContainerHandler
        ];
    }
}

export { Application };
