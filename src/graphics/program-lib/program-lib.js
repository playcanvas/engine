import { begin, dummyFragmentCode, end, fogCode, gammaCode, precisionCode, skinCode, tonemapCode, versionCode } from './programs/common.js';
import { basic } from './programs/basic.js';
import { particle } from './programs/particle.js';
import { skybox } from './programs/skybox.js';
import { standard } from './programs/standard.js';

const programlib = {
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
