import { AppOptions } from '../../../../src/framework/app-options.js';
import { CameraComponentSystem } from '../../../../src/framework/components/camera/system.js';
import { EsmScriptComponentSystem } from '../../../../src/framework/components/esmscript/system.js';
import { LightComponentSystem } from '../../../../src/framework/components/light/system.js';
import { RenderComponentSystem } from '../../../../src/framework/components/render/system.js';
import { ScriptComponentSystem } from '../../../../src/framework/components/script/system.js';
import { ContainerHandler } from '../../../../src/framework/handlers/container.js';
import { TextureHandler } from '../../../../src/framework/handlers/texture.js';
// import { DEVICETYPE_WEBGL1 } from '../../../../src/platform/graphics/constants.js';

// const gfxOptions = {
//     deviceTypes: [DEVICETYPE_WEBGL1],
//     // glslangUrl: '/editor/scene/js/launch/webgpu/glslang.js',
//     // twgslUrl: '/editor/scene/js/launch/webgpu/twgsl.js',
//     // powerPreference: powerPreference,
//     // antialias: config.project.settings.antiAlias !== false,
//     // alpha: config.project.settings.transparentCanvas !== false,
//     // preserveDrawingBuffer: !!config.project.settings.preserveDrawingBuffer
// };

const createOptions = new AppOptions();

createOptions.componentSystems = [
    ScriptComponentSystem,
    EsmScriptComponentSystem,
    RenderComponentSystem,
    CameraComponentSystem,
    LightComponentSystem

];
createOptions.resourceHandlers = [
    // @ts-ignore
    TextureHandler,
    // @ts-ignore
    ContainerHandler
];

export default createOptions;
