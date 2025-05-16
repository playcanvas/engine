import particlePS from '../chunks-wgsl/particle/frag/particle.js';
import particleVS from '../chunks-wgsl/particle/vert/particle.js';
import particleAnimFrameClampVS from '../chunks-wgsl/particle/vert/particleAnimFrameClamp.js';
import particleAnimFrameLoopVS from '../chunks-wgsl/particle/vert/particleAnimFrameLoop.js';
import particleAnimTexVS from '../chunks-wgsl/particle/vert/particleAnimTex.js';
import particleInputFloatPS from '../chunks-wgsl/particle/frag/particleInputFloat.js';
import particleInputRgba8PS from '../chunks-wgsl/particle/frag/particleInputRgba8.js';
import particleOutputFloatPS from '../chunks-wgsl/particle/frag/particleOutputFloat.js';
import particleOutputRgba8PS from '../chunks-wgsl/particle/frag/particleOutputRgba8.js';
import particleUpdaterAABBPS from '../chunks-wgsl/particle/frag/particleUpdaterAABB.js';
import particleUpdaterEndPS from '../chunks-wgsl/particle/frag/particleUpdaterEnd.js';
import particleUpdaterInitPS from '../chunks-wgsl/particle/frag/particleUpdaterInit.js';
import particleUpdaterNoRespawnPS from '../chunks-wgsl/particle/frag/particleUpdaterNoRespawn.js';
import particleUpdaterOnStopPS from '../chunks-wgsl/particle/frag/particleUpdaterOnStop.js';
import particleUpdaterRespawnPS from '../chunks-wgsl/particle/frag/particleUpdaterRespawn.js';
import particleUpdaterSpherePS from '../chunks-wgsl/particle/frag/particleUpdaterSphere.js';
import particleUpdaterStartPS from '../chunks-wgsl/particle/frag/particleUpdaterStart.js';
import particle_billboardVS from '../chunks-wgsl/particle/vert/particle_billboard.js';
import particle_blendAddPS from '../chunks-wgsl/particle/frag/particle_blendAdd.js';
import particle_blendMultiplyPS from '../chunks-wgsl/particle/frag/particle_blendMultiply.js';
import particle_blendNormalPS from '../chunks-wgsl/particle/frag/particle_blendNormal.js';
import particle_cpuVS from '../chunks-wgsl/particle/vert/particle_cpu.js';
import particle_cpu_endVS from '../chunks-wgsl/particle/vert/particle_cpu_end.js';
import particle_customFaceVS from '../chunks-wgsl/particle/vert/particle_customFace.js';
import particle_endPS from '../chunks-wgsl/particle/frag/particle_end.js';
import particle_endVS from '../chunks-wgsl/particle/vert/particle_end.js';
import particle_halflambertPS from '../chunks-wgsl/particle/frag/particle_halflambert.js';
import particle_initVS from '../chunks-wgsl/particle/vert/particle_init.js';
import particle_lambertPS from '../chunks-wgsl/particle/frag/particle_lambert.js';
import particle_lightingPS from '../chunks-wgsl/particle/frag/particle_lighting.js';
import particle_localShiftVS from '../chunks-wgsl/particle/vert/particle_localShift.js';
import particle_meshVS from '../chunks-wgsl/particle/vert/particle_mesh.js';
import particle_normalVS from '../chunks-wgsl/particle/vert/particle_normal.js';
import particle_normalMapPS from '../chunks-wgsl/particle/frag/particle_normalMap.js';
import particle_pointAlongVS from '../chunks-wgsl/particle/vert/particle_pointAlong.js';
import particle_simulationPS from '../chunks-wgsl/particle/frag/particle-simulation.js';
import particle_shaderPS from '../chunks-wgsl/particle/frag/particle-shader.js';
import particle_shaderVS from '../chunks-wgsl/particle/vert/particle-shader.js';
import particle_softPS from '../chunks-wgsl/particle/frag/particle_soft.js';
import particle_softVS from '../chunks-wgsl/particle/vert/particle_soft.js';
import particle_stretchVS from '../chunks-wgsl/particle/vert/particle_stretch.js';
import particle_TBNVS from '../chunks-wgsl/particle/vert/particle_TBN.js';
import particle_wrapVS from '../chunks-wgsl/particle/vert/particle_wrap.js';

export const particleChunksWGSL = {
    particlePS,
    particleVS,
    particleAnimFrameClampVS,
    particleAnimFrameLoopVS,
    particleAnimTexVS,
    particleInputFloatPS,
    particleInputRgba8PS,
    particleOutputFloatPS,
    particleOutputRgba8PS,
    particleUpdaterAABBPS,
    particleUpdaterEndPS,
    particleUpdaterInitPS,
    particleUpdaterNoRespawnPS,
    particleUpdaterOnStopPS,
    particleUpdaterRespawnPS,
    particleUpdaterSpherePS,
    particleUpdaterStartPS,
    particle_billboardVS,
    particle_blendAddPS,
    particle_blendMultiplyPS,
    particle_blendNormalPS,
    particle_cpuVS,
    particle_cpu_endVS,
    particle_customFaceVS,
    particle_endPS,
    particle_endVS,
    particle_halflambertPS,
    particle_initVS,
    particle_lambertPS,
    particle_lightingPS,
    particle_localShiftVS,
    particle_meshVS,
    particle_normalVS,
    particle_normalMapPS,
    particle_pointAlongVS,
    particle_simulationPS,
    particle_shaderPS,
    particle_shaderVS,
    particle_softPS,
    particle_softVS,
    particle_stretchVS,
    particle_TBNVS,
    particle_wrapVS
};
