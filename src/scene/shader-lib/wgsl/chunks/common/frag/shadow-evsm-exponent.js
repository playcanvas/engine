// The exponents of the depth warp used by the VSM shadows, shared by the shaders rendering the
// shadow map and the shaders sampling it, which need to match.
export default /* wgsl */`

#ifndef _SHADOW_EVSM_EXPONENT_INCLUDED_
#define _SHADOW_EVSM_EXPONENT_INCLUDED_

// the largest exponent keeping the stored square of the warped depth, exp(2 * exponent), within
// the range of a half float
const VSM_EXPONENT_16F: f32 = 5.54;

const VSM_EXPONENT_32F: f32 = 15.0;

#endif
`;
