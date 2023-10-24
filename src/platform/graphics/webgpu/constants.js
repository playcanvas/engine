import {
    PIXELFORMAT_A8, PIXELFORMAT_L8, PIXELFORMAT_LA8, PIXELFORMAT_RGB565, PIXELFORMAT_RGBA5551, PIXELFORMAT_RGBA4,
    PIXELFORMAT_RGB8, PIXELFORMAT_RGBA8, PIXELFORMAT_DXT1, PIXELFORMAT_DXT3, PIXELFORMAT_DXT5,
    PIXELFORMAT_RGB16F, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGB32F, PIXELFORMAT_RGBA32F, PIXELFORMAT_R32F, PIXELFORMAT_DEPTH,
    PIXELFORMAT_DEPTHSTENCIL, PIXELFORMAT_111110F, PIXELFORMAT_SRGB, PIXELFORMAT_SRGBA, PIXELFORMAT_ETC1,
    PIXELFORMAT_ETC2_RGB, PIXELFORMAT_ETC2_RGBA, PIXELFORMAT_PVRTC_2BPP_RGB_1, PIXELFORMAT_PVRTC_2BPP_RGBA_1,
    PIXELFORMAT_PVRTC_4BPP_RGB_1, PIXELFORMAT_PVRTC_4BPP_RGBA_1, PIXELFORMAT_ASTC_4x4, PIXELFORMAT_ATC_RGB,
    PIXELFORMAT_ATC_RGBA, PIXELFORMAT_BGRA8
} from '../constants.js';

// map of PIXELFORMAT_*** to GPUTextureFormat
export const gpuTextureFormats = [];
gpuTextureFormats[PIXELFORMAT_A8] = '';
gpuTextureFormats[PIXELFORMAT_L8] = 'r8unorm';
gpuTextureFormats[PIXELFORMAT_LA8] = 'rg8unorm';
gpuTextureFormats[PIXELFORMAT_RGB565] = '';
gpuTextureFormats[PIXELFORMAT_RGBA5551] = '';
gpuTextureFormats[PIXELFORMAT_RGBA4] = '';
gpuTextureFormats[PIXELFORMAT_RGB8] = 'rgba8unorm';
gpuTextureFormats[PIXELFORMAT_RGBA8] = 'rgba8unorm';
gpuTextureFormats[PIXELFORMAT_DXT1] = 'bc1-rgba-unorm';
gpuTextureFormats[PIXELFORMAT_DXT3] = 'bc2-rgba-unorm';
gpuTextureFormats[PIXELFORMAT_DXT5] = 'bc3-rgba-unorm';
gpuTextureFormats[PIXELFORMAT_RGB16F] = '';
gpuTextureFormats[PIXELFORMAT_RGBA16F] = 'rgba16float';
gpuTextureFormats[PIXELFORMAT_RGB32F] = '';
gpuTextureFormats[PIXELFORMAT_RGBA32F] = 'rgba32float';
gpuTextureFormats[PIXELFORMAT_R32F] = 'r32float';
gpuTextureFormats[PIXELFORMAT_DEPTH] = 'depth32float';
gpuTextureFormats[PIXELFORMAT_DEPTHSTENCIL] = 'depth24plus-stencil8';
gpuTextureFormats[PIXELFORMAT_111110F] = 'rg11b10ufloat';
gpuTextureFormats[PIXELFORMAT_SRGB] = '';
gpuTextureFormats[PIXELFORMAT_SRGBA] = '';
gpuTextureFormats[PIXELFORMAT_ETC1] = '';
gpuTextureFormats[PIXELFORMAT_ETC2_RGB] = 'etc2-rgb8unorm';
gpuTextureFormats[PIXELFORMAT_ETC2_RGBA] = 'etc2-rgba8unorm';
gpuTextureFormats[PIXELFORMAT_PVRTC_2BPP_RGB_1] = '';
gpuTextureFormats[PIXELFORMAT_PVRTC_2BPP_RGBA_1] = '';
gpuTextureFormats[PIXELFORMAT_PVRTC_4BPP_RGB_1] = '';
gpuTextureFormats[PIXELFORMAT_PVRTC_4BPP_RGBA_1] = '';
gpuTextureFormats[PIXELFORMAT_ASTC_4x4] = 'astc-4x4-unorm';
gpuTextureFormats[PIXELFORMAT_ATC_RGB] = '';
gpuTextureFormats[PIXELFORMAT_ATC_RGBA] = '';
gpuTextureFormats[PIXELFORMAT_BGRA8] = 'bgra8unorm';
