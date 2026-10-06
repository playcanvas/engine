import composePS from '../chunks/render-pass/frag/compose/compose.js';
import composeBloomPS from '../chunks/render-pass/frag/compose/compose-bloom.js';
import composeDofPS from '../chunks/render-pass/frag/compose/compose-dof.js';
import composeSsaoPS from '../chunks/render-pass/frag/compose/compose-ssao.js';

export const composeChunksGLSL = {
    composePS,
    composeBloomPS,
    composeDofPS,
    composeSsaoPS,

    // empty chunks for user customizations
    composeDeclarationsPS: '',
    composeMainStartPS: '',
    composeMainEndPS: '',

    // the declarations of the registered CameraFrameEffects, assembled by RenderPassCompose and
    // supplied as a fragment include on every shader it builds
    composeEffectDeclarationsPS: '',

    // the calls of the effects registered to each compose slot. Each chunk is included once per
    // effect, driven by the slot's COMPOSE_<SLOT>_COUNT define, and each call names the entry
    // function held by the injected {COMPOSE_<SLOT>_FN<i>} define - see RenderPassCompose
    composeSlotSceneCallPS: '        scene = {COMPOSE_SCENE_FN{i}}(scene, uv);\n',
    composeSlotHdrCallPS: '        result = {COMPOSE_HDR_FN{i}}(result, uv);\n',
    composeSlotLdrCallPS: '        result = {COMPOSE_LDR_FN{i}}(result, uv);\n',
    composeSlotOutputCallPS: '        result = {COMPOSE_OUTPUT_FN{i}}(result, uv);\n',

    // the debug view of the registered effect providing the active one
    composeEffectDebugPS: `
        #ifdef COMPOSE_EFFECT_DEBUG
            result = {COMPOSE_DEBUG_FN}();
        #endif
    `
};
