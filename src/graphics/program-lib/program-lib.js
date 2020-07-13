import { begin, dummyFragmentCode, end, fogCode, gammaCode, precisionCode, skinCode, tonemapCode, versionCode } from './shader-code.js';

import { basic } from './basic.js';
import { particle } from './particle.js';
import { skybox } from './skybox.js';
import { standard } from './standard.js';

var programlib = {
    begin: begin,
    dummyFragmentCode: dummyFragmentCode,
    end: end,
    fogCode: fogCode,
    gammaCode: gammaCode,
    precisionCode: precisionCode,
    skinCode: skinCode,
    tonemapCode: tonemapCode,
    versionCode: versionCode,

    basic: basic,
    particle: particle,
    skybox: skybox,
    standard: standard
};

export { programlib };
