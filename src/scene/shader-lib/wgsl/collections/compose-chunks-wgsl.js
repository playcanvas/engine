import composePS from '../chunks/render-pass/frag/compose/compose.js';
import composeBloomPS from '../chunks/render-pass/frag/compose/compose-bloom.js';
import composeDofPS from '../chunks/render-pass/frag/compose/compose-dof.js';
import composeSsaoPS from '../chunks/render-pass/frag/compose/compose-ssao.js';
import composeGradingPS from '../chunks/render-pass/frag/compose/compose-grading.js';
import composeVignettePS from '../chunks/render-pass/frag/compose/compose-vignette.js';
import composeFringingPS from '../chunks/render-pass/frag/compose/compose-fringing.js';
import composeCasPS from '../chunks/render-pass/frag/compose/compose-cas.js';

export const composeChunksWGSL = {
    composePS,
    composeBloomPS,
    composeDofPS,
    composeSsaoPS,
    composeGradingPS,
    composeVignettePS,
    composeFringingPS,
    composeCasPS
};
