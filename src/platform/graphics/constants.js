/**
 * Ignores the integer part of texture coordinates, using only the fractional part.
 *
 * @type {number}
 * @category Graphics
 */
export const ADDRESS_REPEAT = 0;

/**
 * Clamps texture coordinate to the range 0 to 1.
 *
 * @type {number}
 * @category Graphics
 */
export const ADDRESS_CLAMP_TO_EDGE = 1;

/**
 * Texture coordinate to be set to the fractional part if the integer part is even. If the integer
 * part is odd, then the texture coordinate is set to 1 minus the fractional part.
 *
 * @type {number}
 * @category Graphics
 */
export const ADDRESS_MIRRORED_REPEAT = 2;

/**
 * Multiply all fragment components by zero.
 *
 * @type {number}
 * @category Graphics
 */
export const BLENDMODE_ZERO = 0;

/**
 * Multiply all fragment components by one.
 *
 * @type {number}
 * @category Graphics
 */
export const BLENDMODE_ONE = 1;

/**
 * Multiply all fragment components by the components of the source fragment.
 *
 * @type {number}
 * @category Graphics
 */
export const BLENDMODE_SRC_COLOR = 2;

/**
 * Multiply all fragment components by one minus the components of the source fragment.
 *
 * @type {number}
 * @category Graphics
 */
export const BLENDMODE_ONE_MINUS_SRC_COLOR = 3;

/**
 * Multiply all fragment components by the components of the destination fragment.
 *
 * @type {number}
 * @category Graphics
 */
export const BLENDMODE_DST_COLOR = 4;

/**
 * Multiply all fragment components by one minus the components of the destination fragment.
 *
 * @type {number}
 * @category Graphics
 */
export const BLENDMODE_ONE_MINUS_DST_COLOR = 5;

/**
 * Multiply all fragment components by the alpha value of the source fragment.
 *
 * @type {number}
 * @category Graphics
 */
export const BLENDMODE_SRC_ALPHA = 6;

/**
 * Multiply all fragment components by the alpha value of the source fragment.
 *
 * @type {number}
 * @category Graphics
 */
export const BLENDMODE_SRC_ALPHA_SATURATE = 7;

/**
 * Multiply all fragment components by one minus the alpha value of the source fragment.
 *
 * @type {number}
 * @category Graphics
 */
export const BLENDMODE_ONE_MINUS_SRC_ALPHA = 8;

/**
 * Multiply all fragment components by the alpha value of the destination fragment.
 *
 * @type {number}
 * @category Graphics
 */
export const BLENDMODE_DST_ALPHA = 9;

/**
 * Multiply all fragment components by one minus the alpha value of the destination fragment.
 *
 * @type {number}
 * @category Graphics
 */
export const BLENDMODE_ONE_MINUS_DST_ALPHA = 10;

/**
 * Multiplies all fragment components by a constant.
 *
 * @type {number}
 * @category Graphics
 */
export const BLENDMODE_CONSTANT = 11;

/**
 * Multiplies all fragment components by 1 minus a constant.
 *
 * @type {number}
 * @category Graphics
 */
export const BLENDMODE_ONE_MINUS_CONSTANT = 12;

/**
 * Add the results of the source and destination fragment multiplies.
 *
 * @type {number}
 * @category Graphics
 */
export const BLENDEQUATION_ADD = 0;

/**
 * Subtract the results of the source and destination fragment multiplies.
 *
 * @type {number}
 * @category Graphics
 */
export const BLENDEQUATION_SUBTRACT = 1;

/**
 * Reverse and subtract the results of the source and destination fragment multiplies.
 *
 * @type {number}
 * @category Graphics
 */
export const BLENDEQUATION_REVERSE_SUBTRACT = 2;

/**
 * Use the smallest value.
 *
 * @type {number}
 * @category Graphics
 */
export const BLENDEQUATION_MIN = 3;

/**
 * Use the largest value.
 *
 * @type {number}
 * @category Graphics
 */
export const BLENDEQUATION_MAX = 4;

/**
 * A flag utilized during the construction of a {@link StorageBuffer} to make it available for read
 * access by CPU.
 *
 * @type {number}
 * @category Graphics
 */
export const BUFFERUSAGE_READ = 0x0001;

/**
 * A flag utilized during the construction of a {@link StorageBuffer} to make it available for write
 * access by CPU.
 *
 * @type {number}
 * @category Graphics
 */
export const BUFFERUSAGE_WRITE = 0x0002;

/**
 * A flag utilized during the construction of a {@link StorageBuffer} to ensure its compatibility
 * when used as a source of a copy operation.
 *
 * @type {number}
 * @category Graphics
 */
export const BUFFERUSAGE_COPY_SRC = 0x0004;

/**
 * A flag utilized during the construction of a {@link StorageBuffer} to ensure its compatibility
 * when used as a destination of a copy operation, or as a target of a write operation.
 *
 * @type {number}
 * @category Graphics
 */
export const BUFFERUSAGE_COPY_DST = 0x0008;

/**
 * A flag utilized during the construction of a {@link StorageBuffer} to ensure its compatibility
 * when used as an index buffer.
 *
 * @type {number}
 * @category Graphics
 */
export const BUFFERUSAGE_INDEX = 0x0010;

/**
 * A flag utilized during the construction of a {@link StorageBuffer} to ensure its compatibility
 * when used as a vertex buffer.
 *
 * @type {number}
 * @category Graphics
 */
export const BUFFERUSAGE_VERTEX = 0x0020;

/**
 * A flag utilized during the construction of a {@link StorageBuffer} to ensure its compatibility
 * when used as an uniform buffer.
 *
 * @type {number}
 * @category Graphics
 */
export const BUFFERUSAGE_UNIFORM = 0x0040;

/**
 * An internal flag utilized during the construction of a {@link StorageBuffer} to ensure its
 * compatibility when used as a storage buffer.
 * This flag is hidden as it's automatically used by the StorageBuffer constructor.
 *
 * @type {number}
 * @category Graphics
 * @ignore
 */
export const BUFFERUSAGE_STORAGE = 0x0080;

/**
 * A flag utilized during the construction of a {@link StorageBuffer} to allow it to store indirect
 * command arguments.
 * TODO: This flag is hidden till the feature is implemented.
 *
 * @type {number}
 * @category Graphics
 * @ignore
 */
export const BUFFERUSAGE_INDIRECT = 0x0100;

/**
 * The data store contents will be modified once and used many times.
 *
 * @type {number}
 * @category Graphics
 */
export const BUFFER_STATIC = 0;

/**
 * The data store contents will be modified repeatedly and used many times.
 *
 * @type {number}
 * @category Graphics
 */
export const BUFFER_DYNAMIC = 1;

/**
 * The data store contents will be modified once and used at most a few times.
 *
 * @type {number}
 * @category Graphics
 */
export const BUFFER_STREAM = 2;

/**
 * The data store contents will be modified repeatedly on the GPU and used many times. Optimal for
 * transform feedback usage.
 *
 * @type {number}
 * @category Graphics
 */
export const BUFFER_GPUDYNAMIC = 3;

/**
 * Clear the color buffer.
 *
 * @type {number}
 * @category Graphics
 */
export const CLEARFLAG_COLOR = 1;

/**
 * Clear the depth buffer.
 *
 * @type {number}
 * @category Graphics
 */
export const CLEARFLAG_DEPTH = 2;

/**
 * Clear the stencil buffer.
 *
 * @type {number}
 * @category Graphics
 */
export const CLEARFLAG_STENCIL = 4;

/**
 * The positive X face of a cubemap.
 *
 * @type {number}
 * @category Graphics
 */
export const CUBEFACE_POSX = 0;

/**
 * The negative X face of a cubemap.
 *
 * @type {number}
 * @category Graphics
 */
export const CUBEFACE_NEGX = 1;

/**
 * The positive Y face of a cubemap.
 *
 * @type {number}
 * @category Graphics
 */
export const CUBEFACE_POSY = 2;

/**
 * The negative Y face of a cubemap.
 *
 * @type {number}
 * @category Graphics
 */
export const CUBEFACE_NEGY = 3;

/**
 * The positive Z face of a cubemap.
 *
 * @type {number}
 * @category Graphics
 */
export const CUBEFACE_POSZ = 4;

/**
 * The negative Z face of a cubemap.
 *
 * @type {number}
 * @category Graphics
 */
export const CUBEFACE_NEGZ = 5;

/**
 * No triangles are culled.
 *
 * @type {number}
 * @category Graphics
 */
export const CULLFACE_NONE = 0;

/**
 * Triangles facing away from the view direction are culled.
 *
 * @type {number}
 * @category Graphics
 */
export const CULLFACE_BACK = 1;

/**
 * Triangles facing the view direction are culled.
 *
 * @type {number}
 * @category Graphics
 */
export const CULLFACE_FRONT = 2;

/**
 * Triangles are culled regardless of their orientation with respect to the view direction. Note
 * that point or line primitives are unaffected by this render state.
 *
 * @type {number}
 * @ignore
 * @category Graphics
 */
export const CULLFACE_FRONTANDBACK = 3;

/**
 * Point sample filtering.
 *
 * @type {number}
 * @category Graphics
 */
export const FILTER_NEAREST = 0;

/**
 * Bilinear filtering.
 *
 * @type {number}
 * @category Graphics
 */
export const FILTER_LINEAR = 1;

/**
 * Use the nearest neighbor in the nearest mipmap level.
 *
 * @type {number}
 * @category Graphics
 */
export const FILTER_NEAREST_MIPMAP_NEAREST = 2;

/**
 * Linearly interpolate in the nearest mipmap level.
 *
 * @type {number}
 * @category Graphics
 */
export const FILTER_NEAREST_MIPMAP_LINEAR = 3;

/**
 * Use the nearest neighbor after linearly interpolating between mipmap levels.
 *
 * @type {number}
 * @category Graphics
 */
export const FILTER_LINEAR_MIPMAP_NEAREST = 4;

/**
 * Linearly interpolate both the mipmap levels and between texels.
 *
 * @type {number}
 * @category Graphics
 */
export const FILTER_LINEAR_MIPMAP_LINEAR = 5;

/**
 * Never pass.
 *
 * @type {number}
 * @category Graphics
 */
export const FUNC_NEVER = 0;

/**
 * Pass if (ref & mask) < (stencil & mask).
 *
 * @type {number}
 * @category Graphics
 */
export const FUNC_LESS = 1;

/**
 * Pass if (ref & mask) == (stencil & mask).
 *
 * @type {number}
 * @category Graphics
 */
export const FUNC_EQUAL = 2;

/**
 * Pass if (ref & mask) <= (stencil & mask).
 *
 * @type {number}
 * @category Graphics
 */
export const FUNC_LESSEQUAL = 3;

/**
 * Pass if (ref & mask) > (stencil & mask).
 *
 * @type {number}
 * @category Graphics
 */
export const FUNC_GREATER = 4;

/**
 * Pass if (ref & mask) != (stencil & mask).
 *
 * @type {number}
 * @category Graphics
 */
export const FUNC_NOTEQUAL = 5;

/**
 * Pass if (ref & mask) >= (stencil & mask).
 *
 * @type {number}
 * @category Graphics
 */
export const FUNC_GREATEREQUAL = 6;

/**
 * Always pass.
 *
 * @type {number}
 * @category Graphics
 */
export const FUNC_ALWAYS = 7;

/**
 * 8-bit unsigned vertex indices (0 to 255).
 *
 * @type {number}
 * @category Graphics
 */
export const INDEXFORMAT_UINT8 = 0;

/**
 * 16-bit unsigned vertex indices (0 to 65,535).
 *
 * @type {number}
 * @category Graphics
 */
export const INDEXFORMAT_UINT16 = 1;

/**
 * 32-bit unsigned vertex indices (0 to 4,294,967,295).
 *
 * @type {number}
 * @category Graphics
 */
export const INDEXFORMAT_UINT32 = 2;

export const PIXELFORMAT_A8 = 0;
export const PIXELFORMAT_L8 = 1;
export const PIXELFORMAT_LA8 = 2;

/**
 * 16-bit RGB (5-bits for red channel, 6 for green and 5 for blue).
 *
 * @type {number}
 * @category Graphics
 */
export const PIXELFORMAT_RGB565 = 3;

/**
 * 16-bit RGBA (5-bits for red channel, 5 for green, 5 for blue with 1-bit alpha).
 *
 * @type {number}
 * @category Graphics
 */
export const PIXELFORMAT_RGBA5551 = 4;

/**
 * 16-bit RGBA (4-bits for red channel, 4 for green, 4 for blue with 4-bit alpha).
 *
 * @type {number}
 * @category Graphics
 */
export const PIXELFORMAT_RGBA4 = 5;

/**
 * 24-bit RGB (8-bits for red channel, 8 for green and 8 for blue).
 *
 * @type {number}
 * @category Graphics
 */
export const PIXELFORMAT_RGB8 = 6;

/**
 * 32-bit RGBA (8-bits for red channel, 8 for green, 8 for blue with 8-bit alpha).
 *
 * @type {number}
 * @category Graphics
 */
export const PIXELFORMAT_RGBA8 = 7;

/**
 * Block compressed format storing 16 input pixels in 64 bits of output, consisting of two 16-bit
 * RGB 5:6:5 color values and a 4x4 two bit lookup table.
 *
 * @type {number}
 * @category Graphics
 */
export const PIXELFORMAT_DXT1 = 8;

/**
 * Block compressed format storing 16 input pixels (corresponding to a 4x4 pixel block) into 128
 * bits of output, consisting of 64 bits of alpha channel data (4 bits for each pixel) followed by
 * 64 bits of color data; encoded the same way as DXT1.
 *
 * @type {number}
 * @category Graphics
 */
export const PIXELFORMAT_DXT3 = 9;

/**
 * Block compressed format storing 16 input pixels into 128 bits of output, consisting of 64 bits
 * of alpha channel data (two 8 bit alpha values and a 4x4 3 bit lookup table) followed by 64 bits
 * of color data (encoded the same way as DXT1).
 *
 * @type {number}
 * @category Graphics
 */
export const PIXELFORMAT_DXT5 = 10;

/**
 * 16-bit floating point RGB (16-bit float for each red, green and blue channels).
 *
 * @type {number}
 * @category Graphics
 */
export const PIXELFORMAT_RGB16F = 11;

/**
 * 16-bit floating point RGBA (16-bit float for each red, green, blue and alpha channels).
 *
 * @type {number}
 * @category Graphics
 */
export const PIXELFORMAT_RGBA16F = 12;

/**
 * 32-bit floating point RGB (32-bit float for each red, green and blue channels).
 *
 * @type {number}
 * @category Graphics
 */
export const PIXELFORMAT_RGB32F = 13;

/**
 * 32-bit floating point RGBA (32-bit float for each red, green, blue and alpha channels).
 *
 * @type {number}
 * @category Graphics
 */
export const PIXELFORMAT_RGBA32F = 14;

/**
 * 32-bit floating point single channel format.
 *
 * @type {number}
 * @category Graphics
 */
export const PIXELFORMAT_R32F = 15;

/**
 * A readable depth buffer format.
 *
 * @type {number}
 * @category Graphics
 */
export const PIXELFORMAT_DEPTH = 16;

/**
 * A readable depth/stencil buffer format.
 *
 * @type {number}
 * @category Graphics
 */
export const PIXELFORMAT_DEPTHSTENCIL = 17;

/**
 * A floating-point color-only format with 11 bits for red and green channels and 10 bits for the
 * blue channel.
 *
 * @type {number}
 * @category Graphics
 */
export const PIXELFORMAT_111110F = 18;

/**
 * Color-only sRGB format.
 *
 * @type {number}
 * @category Graphics
 */
export const PIXELFORMAT_SRGB8 = 19;

/**
 * Color sRGB format with additional alpha channel.
 *
 * @type {number}
 * @category Graphics
 */
export const PIXELFORMAT_SRGBA8 = 20;

/**
 * ETC1 compressed format.
 *
 * @type {number}
 * @category Graphics
 */
export const PIXELFORMAT_ETC1 = 21;

/**
 * ETC2 (RGB) compressed format.
 *
 * @type {number}
 * @category Graphics
 */
export const PIXELFORMAT_ETC2_RGB = 22;

/**
 * ETC2 (RGBA) compressed format.
 *
 * @type {number}
 * @category Graphics
 */
export const PIXELFORMAT_ETC2_RGBA = 23;

/**
 * PVRTC (2BPP RGB) compressed format.
 *
 * @type {number}
 * @category Graphics
 */
export const PIXELFORMAT_PVRTC_2BPP_RGB_1 = 24;

/**
 * PVRTC (2BPP RGBA) compressed format.
 *
 * @type {number}
 * @category Graphics
 */
export const PIXELFORMAT_PVRTC_2BPP_RGBA_1 = 25;

/**
 * PVRTC (4BPP RGB) compressed format.
 *
 * @type {number}
 * @category Graphics
 */
export const PIXELFORMAT_PVRTC_4BPP_RGB_1 = 26;

/**
 * PVRTC (4BPP RGBA) compressed format.
 *
 * @type {number}
 * @category Graphics
 */
export const PIXELFORMAT_PVRTC_4BPP_RGBA_1 = 27;

/**
 * ATC compressed format with alpha channel in blocks of 4x4.
 *
 * @type {number}
 * @category Graphics
 */
export const PIXELFORMAT_ASTC_4x4 = 28;

/**
 * ATC compressed format with no alpha channel.
 *
 * @type {number}
 * @category Graphics
 */
export const PIXELFORMAT_ATC_RGB = 29;

/**
 * ATC compressed format with alpha channel.
 *
 * @type {number}
 * @category Graphics
 */
export const PIXELFORMAT_ATC_RGBA = 30;

/**
 * 32-bit BGRA (8-bits for blue channel, 8 for green, 8 for red with 8-bit alpha).
 *
 * @type {number}
 * @ignore
 * @category Graphics
 */
export const PIXELFORMAT_BGRA8 = 31;

/**
 * 8-bit signed integer single-channel (R) format.
 *
 * @type {number}
 * @category Graphics
 */
export const PIXELFORMAT_R8I = 32;

/**
 * 8-bit unsigned integer single-channel (R) format.
 *
 * @type {number}
 * @category Graphics
 */
export const PIXELFORMAT_R8U = 33;

/**
 * 16-bit signed integer single-channel (R) format.
 *
 * @type {number}
 * @category Graphics
 */
export const PIXELFORMAT_R16I = 34;

/**
 * 16-bit unsigned integer single-channel (R) format.
 *
 * @type {number}
 * @category Graphics
 */
export const PIXELFORMAT_R16U = 35;

/**
 * 32-bit signed integer single-channel (R) format.
 *
 * @type {number}
 * @category Graphics
 */
export const PIXELFORMAT_R32I = 36;

/**
 * 32-bit unsigned integer single-channel (R) format.
 *
 * @type {number}
 * @category Graphics
 */
export const PIXELFORMAT_R32U = 37;

/**
 * 8-bit per-channel signed integer (RG) format.
 *
 * @type {number}
 * @category Graphics
 */
export const PIXELFORMAT_RG8I = 38;

/**
 * 8-bit per-channel unsigned integer (RG) format.
 *
 * @type {number}
 * @category Graphics
 */
export const PIXELFORMAT_RG8U = 39;

/**
 * 16-bit per-channel signed integer (RG) format.
 *
 * @type {number}
 * @category Graphics
 */
export const PIXELFORMAT_RG16I = 40;

/**
 * 16-bit per-channel unsigned integer (RG) format.
 *
 * @type {number}
 * @category Graphics
 */
export const PIXELFORMAT_RG16U = 41;

/**
 * 32-bit per-channel signed integer (RG) format.
 *
 * @type {number}
 * @category Graphics
 */
export const PIXELFORMAT_RG32I = 42;

/**
 * 32-bit per-channel unsigned integer (RG) format.
 *
 * @type {number}
 * @category Graphics
 */
export const PIXELFORMAT_RG32U = 43;

/**
 * 8-bit per-channel signed integer (RGBA) format.
 *
 * @type {number}
 * @category Graphics
 */
export const PIXELFORMAT_RGBA8I = 44;

/**
 * 8-bit per-channel unsigned integer (RGBA) format.
 *
 * @type {number}
 * @category Graphics
 */
export const PIXELFORMAT_RGBA8U = 45;

/**
 * 16-bit per-channel signed integer (RGBA) format.
 *
 * @type {number}
 * @category Graphics
 */
export const PIXELFORMAT_RGBA16I = 46;

/**
 * 16-bit per-channel unsigned integer (RGBA) format.
 *
 * @type {number}
 * @category Graphics
 */
export const PIXELFORMAT_RGBA16U = 47;

/**
 * 32-bit per-channel signed integer (RGBA) format.
 *
 * @type {number}
 * @category Graphics
 */
export const PIXELFORMAT_RGBA32I = 48;

/**
 * 32-bit per-channel unsigned integer (RGBA) format.
 *
 * @type {number}
 * @category Graphics
 */
export const PIXELFORMAT_RGBA32U = 49;

/**
 * 16-bit floating point R (16-bit float for red channel).
 *
 * @type {number}
 * @category Graphics
 */
export const PIXELFORMAT_R16F = 50;

/**
 * 16-bit floating point RG (16-bit float for each red and green channels).
 *
 * @type {number}
 * @category Graphics
 */
export const PIXELFORMAT_RG16F = 51;

/**
 * 8-bit per-channel unsigned integer (R) format.
 *
 * @type {number}
 * @category Graphics
 */
export const PIXELFORMAT_R8 = 52;

/**
 * 8-bit per-channel unsigned integer (RG) format.
 *
 * @type {number}
 * @category Graphics
 */
export const PIXELFORMAT_RG8 = 53;

/**
 * Format equivalent to {@link PIXELFORMAT_DXT1} but sampled in linear color space.
 *
 * @type {number}
 * @category Graphics
 */
export const PIXELFORMAT_DXT1_SRGB = 54;

/**
 * Format equivalent to {@link PIXELFORMAT_DXT3} but sampled in linear color space.
 *
 * @type {number}
 * @category Graphics
 */
export const PIXELFORMAT_DXT3_SRGB = 55;

/**
 * Format equivalent to {@link PIXELFORMAT_DXT5} but sampled in linear color space.
 *
 * @type {number}
 * @category Graphics
 */
export const PIXELFORMAT_DXT5_SRGB = 56;

/**
 * Format equivalent to {@link PIXELFORMAT_PVRTC_2BPP_RGB_1} but sampled in linear color space.
 *
 * @type {number}
 * @category Graphics
 */
export const PIXELFORMAT_PVRTC_2BPP_SRGB_1 = 57;

/**
 * Format equivalent to {@link PIXELFORMAT_PVRTC_2BPP_RGBA_1} but sampled in linear color space.
 *
 * @type {number}
 * @category Graphics
 */
export const PIXELFORMAT_PVRTC_2BPP_SRGBA_1 = 58;

/**
 * Format equivalent to {@link PIXELFORMAT_PVRTC_4BPP_RGB_1} but sampled in linear color space.
 *
 * @type {number}
 * @category Graphics
 */
export const PIXELFORMAT_PVRTC_4BPP_SRGB_1 = 59;

/**
 * Format equivalent to {@link PIXELFORMAT_PVRTC_4BPP_RGBA_1} but sampled in linear color space.
 *
 * @type {number}
 * @category Graphics
 */
export const PIXELFORMAT_PVRTC_4BPP_SRGBA_1 = 60;

/**
 * Format equivalent to {@link PIXELFORMAT_ETC2_RGB} but sampled in linear color space.
 *
 * @type {number}
 * @category Graphics
 */
export const PIXELFORMAT_ETC2_SRGB = 61;

/**
 * Format equivalent to {@link PIXELFORMAT_ETC2_RGBA} but sampled in linear color space.
 *
 * @type {number}
 * @category Graphics
 */
export const PIXELFORMAT_ETC2_SRGBA = 62;

/**
 * Format equivalent to {@link PIXELFORMAT_ASTC_4x4} but sampled in linear color space.
 *
 * @type {number}
 * @category Graphics
 */
export const PIXELFORMAT_ASTC_4x4_SRGB = 63;

/**
 * Information about pixel formats.
 *
 * ldr: whether the format is low dynamic range (LDR), which typically means it's not HDR, and uses
 * sRGB color space to store the color values
 * srgbFormat: the corresponding sRGB format (which automatically converts the sRGB value to linear)
 *
 * @type {Map<number, { name: string, size?: number, blockSize?: number, ldr?: boolean, srgb?: boolean, srgbFormat?: number, isInt?: boolean }>}
 * @ignore
 */
export const pixelFormatInfo = new Map([

    // float formats
    [PIXELFORMAT_A8,            { name: 'A8', size: 1, ldr: true }],
    [PIXELFORMAT_R8,            { name: 'R8', size: 1, ldr: true }],
    [PIXELFORMAT_L8,            { name: 'L8', size: 1, ldr: true }],
    [PIXELFORMAT_LA8,           { name: 'LA8', size: 2, ldr: true }],
    [PIXELFORMAT_RG8,           { name: 'RG8', size: 2, ldr: true }],
    [PIXELFORMAT_RGB565,        { name: 'RGB565', size: 2, ldr: true }],
    [PIXELFORMAT_RGBA5551,      { name: 'RGBA5551', size: 2, ldr: true }],
    [PIXELFORMAT_RGBA4,         { name: 'RGBA4', size: 2, ldr: true }],
    [PIXELFORMAT_RGB8,          { name: 'RGB8', size: 4, ldr: true }],
    [PIXELFORMAT_RGBA8,         { name: 'RGBA8', size: 4, ldr: true, srgbFormat: PIXELFORMAT_SRGBA8 }],
    [PIXELFORMAT_R16F,          { name: 'R16F', size: 2 }],
    [PIXELFORMAT_RG16F,         { name: 'RG16F', size: 4 }],
    [PIXELFORMAT_RGB16F,        { name: 'RGB16F', size: 8 }],
    [PIXELFORMAT_RGBA16F,       { name: 'RGBA16F', size: 8 }],
    [PIXELFORMAT_RGB32F,        { name: 'RGB32F', size: 16 }],
    [PIXELFORMAT_RGBA32F,       { name: 'RGBA32F', size: 16 }],
    [PIXELFORMAT_R32F,          { name: 'R32F', size: 4 }],
    [PIXELFORMAT_DEPTH,         { name: 'DEPTH', size: 4 }],
    [PIXELFORMAT_DEPTHSTENCIL,  { name: 'DEPTHSTENCIL', size: 4 }],
    [PIXELFORMAT_111110F,       { name: '111110F', size: 4 }],
    [PIXELFORMAT_SRGB8,         { name: 'SRGB8', size: 4, ldr: true, srgb: true }],
    [PIXELFORMAT_SRGBA8,        { name: 'SRGBA8', size: 4, ldr: true, srgb: true }],
    [PIXELFORMAT_BGRA8,         { name: 'BGRA8', size: 4, ldr: true }],

    // compressed formats
    [PIXELFORMAT_DXT1,              { name: 'DXT1', blockSize: 8, ldr: true, srgbFormat: PIXELFORMAT_DXT1_SRGB }],
    [PIXELFORMAT_DXT3,              { name: 'DXT3', blockSize: 16, ldr: true, srgbFormat: PIXELFORMAT_DXT3_SRGB }],
    [PIXELFORMAT_DXT5,              { name: 'DXT5', blockSize: 16, ldr: true, srgbFormat: PIXELFORMAT_DXT5_SRGB }],
    [PIXELFORMAT_ETC1,              { name: 'ETC1', blockSize: 8, ldr: true }],
    [PIXELFORMAT_ETC2_RGB,          { name: 'ETC2_RGB', blockSize: 8, ldr: true, srgbFormat: PIXELFORMAT_ETC2_SRGB }],
    [PIXELFORMAT_ETC2_RGBA,         { name: 'ETC2_RGBA', blockSize: 16, ldr: true, srgbFormat: PIXELFORMAT_ETC2_SRGBA }],
    [PIXELFORMAT_PVRTC_2BPP_RGB_1,  { name: 'PVRTC_2BPP_RGB_1', ldr: true, blockSize: 8, srgbFormat: PIXELFORMAT_PVRTC_2BPP_SRGB_1 }],
    [PIXELFORMAT_PVRTC_2BPP_RGBA_1, { name: 'PVRTC_2BPP_RGBA_1', ldr: true, blockSize: 8, srgbFormat: PIXELFORMAT_PVRTC_2BPP_SRGBA_1 }],
    [PIXELFORMAT_PVRTC_4BPP_RGB_1,  { name: 'PVRTC_4BPP_RGB_1', ldr: true, blockSize: 8, srgbFormat: PIXELFORMAT_PVRTC_4BPP_SRGB_1 }],
    [PIXELFORMAT_PVRTC_4BPP_RGBA_1, { name: 'PVRTC_4BPP_RGBA_1', ldr: true, blockSize: 8, srgbFormat: PIXELFORMAT_PVRTC_4BPP_SRGBA_1 }],
    [PIXELFORMAT_ASTC_4x4,          { name: 'ASTC_4x4', blockSize: 16, ldr: true, srgbFormat: PIXELFORMAT_ASTC_4x4_SRGB }],
    [PIXELFORMAT_ATC_RGB,           { name: 'ATC_RGB', blockSize: 8, ldr: true }],
    [PIXELFORMAT_ATC_RGBA,          { name: 'ATC_RGBA', blockSize: 16, ldr: true }],

    // compressed sRGB formats
    [PIXELFORMAT_DXT1_SRGB,          { name: 'DXT1_SRGB', blockSize: 8, ldr: true, srgb: true }],
    [PIXELFORMAT_DXT3_SRGB,          { name: 'DXT3_SRGB', blockSize: 16, ldr: true, srgb: true }],
    [PIXELFORMAT_DXT5_SRGB,          { name: 'DXT5_SRGB', blockSize: 16, ldr: true, srgb: true }],
    [PIXELFORMAT_PVRTC_2BPP_SRGB_1,  { name: 'PVRTC_2BPP_SRGB_1', blockSize: 8, ldr: true, srgb: true }],
    [PIXELFORMAT_PVRTC_2BPP_SRGBA_1, { name: 'PVRTC_2BPP_SRGBA_1', blockSize: 8, ldr: true, srgb: true }],
    [PIXELFORMAT_PVRTC_4BPP_SRGB_1,  { name: 'PVRTC_4BPP_SRGB_1', blockSize: 8, ldr: true, srgb: true }],
    [PIXELFORMAT_PVRTC_4BPP_SRGBA_1, { name: 'PVRTC_4BPP_SRGBA_1', blockSize: 8, ldr: true, srgb: true }],
    [PIXELFORMAT_ETC2_SRGB,          { name: 'ETC2_SRGB', blockSize: 8, ldr: true, srgb: true }],
    [PIXELFORMAT_ETC2_SRGBA,         { name: 'ETC2_SRGBA', blockSize: 16, ldr: true, srgb: true }],
    [PIXELFORMAT_ASTC_4x4_SRGB,      { name: 'ASTC_4x4_SRGB', blockSize: 16, ldr: true, srgb: true }],

    // integer formats
    [PIXELFORMAT_R8I,      { name: 'R8I', size: 1, isInt: true }],
    [PIXELFORMAT_R8U,      { name: 'R8U', size: 1, isInt: true }],
    [PIXELFORMAT_R16I,     { name: 'R16I', size: 2, isInt: true }],
    [PIXELFORMAT_R16U,     { name: 'R16U', size: 2, isInt: true }],
    [PIXELFORMAT_R32I,     { name: 'R32I', size: 4, isInt: true }],
    [PIXELFORMAT_R32U,     { name: 'R32U', size: 4, isInt: true }],
    [PIXELFORMAT_RG8I,     { name: 'RG8I', size: 2, isInt: true }],
    [PIXELFORMAT_RG8U,     { name: 'RG8U', size: 2, isInt: true }],
    [PIXELFORMAT_RG16I,    { name: 'RG16I', size: 4, isInt: true }],
    [PIXELFORMAT_RG16U,    { name: 'RG16U', size: 4, isInt: true }],
    [PIXELFORMAT_RG32I,    { name: 'RG32I', size: 8, isInt: true }],
    [PIXELFORMAT_RG32U,    { name: 'RG32U', size: 8, isInt: true }],
    [PIXELFORMAT_RGBA8I,   { name: 'RGBA8I', size: 4, isInt: true }],
    [PIXELFORMAT_RGBA8U,   { name: 'RGBA8U', size: 4, isInt: true }],
    [PIXELFORMAT_RGBA16I,  { name: 'RGBA16I', size: 8, isInt: true }],
    [PIXELFORMAT_RGBA16U,  { name: 'RGBA16U', size: 8, isInt: true }],
    [PIXELFORMAT_RGBA32I,  { name: 'RGBA32I', size: 16, isInt: true }],
    [PIXELFORMAT_RGBA32U,  { name: 'RGBA32U', size: 16, isInt: true }]
]);

// update this function when exposing additional compressed pixel formats
export const isCompressedPixelFormat = (format) => {
    return pixelFormatInfo.get(format)?.blockSize !== undefined;
};

export const isIntegerPixelFormat = (format) => {
    return pixelFormatInfo.get(format)?.isInt === true;
};

/**
 * Returns the srgb equivalent format for the supplied linear format. If it does not exist, the input
 * format is returned. For example for {@link PIXELFORMAT_RGBA8} the return value is
 * {@link PIXELFORMAT_SRGBA8}.
 *
 * @param {number} format - The texture format.
 * @returns {number} The format allowing linear sampling of the texture.
 * @ignore
 */
export const pixelFormatLinearToGamma = (format) => {
    return pixelFormatInfo.get(format)?.srgbFormat || format;
};

/**
 * For a pixel format that stores color information, this function returns true if the texture
 * sample is in sRGB space and needs to be decoded to linear space.
 *
 * @param {number} format - The texture format.
 * @returns {boolean} Whether sampling the texture with this format returns a sRGB value.
 * @ignore
 */
export const requiresManualGamma = (format) => {
    const info = pixelFormatInfo.get(format);
    return !!(info?.ldr && !info?.srgb);
};

// get the pixel format array type
export const getPixelFormatArrayType = (format) => {
    switch (format) {
        case PIXELFORMAT_R32F:
        case PIXELFORMAT_RGB32F:
        case PIXELFORMAT_RGBA32F:
            return Float32Array;
        case PIXELFORMAT_R32I:
        case PIXELFORMAT_RG32I:
        case PIXELFORMAT_RGBA32I:
            return Int32Array;
        case PIXELFORMAT_R32U:
        case PIXELFORMAT_RG32U:
        case PIXELFORMAT_RGBA32U:
            return Uint32Array;
        case PIXELFORMAT_R16I:
        case PIXELFORMAT_RG16I:
        case PIXELFORMAT_RGBA16I:
            return Int16Array;
        case PIXELFORMAT_RG8:
        case PIXELFORMAT_R16U:
        case PIXELFORMAT_RG16U:
        case PIXELFORMAT_RGBA16U:
        case PIXELFORMAT_RGB565:
        case PIXELFORMAT_RGBA5551:
        case PIXELFORMAT_RGBA4:
        case PIXELFORMAT_R16F:
        case PIXELFORMAT_RG16F:
        case PIXELFORMAT_RGB16F:
        case PIXELFORMAT_RGBA16F:
            return Uint16Array;
        case PIXELFORMAT_R8I:
        case PIXELFORMAT_RG8I:
        case PIXELFORMAT_RGBA8I:
            return Int8Array;
        default:
            return Uint8Array;
    }
};

/**
 * List of distinct points.
 *
 * @type {number}
 * @category Graphics
 */
export const PRIMITIVE_POINTS = 0;

/**
 * Discrete list of line segments.
 *
 * @type {number}
 * @category Graphics
 */
export const PRIMITIVE_LINES = 1;

/**
 * List of points that are linked sequentially by line segments, with a closing line segment
 * between the last and first points.
 *
 * @type {number}
 * @category Graphics
 */
export const PRIMITIVE_LINELOOP = 2;

/**
 * List of points that are linked sequentially by line segments.
 *
 * @type {number}
 * @category Graphics
 */
export const PRIMITIVE_LINESTRIP = 3;

/**
 * Discrete list of triangles.
 *
 * @type {number}
 * @category Graphics
 */
export const PRIMITIVE_TRIANGLES = 4;

/**
 * Connected strip of triangles where a specified vertex forms a triangle using the previous two.
 *
 * @type {number}
 * @category Graphics
 */
export const PRIMITIVE_TRISTRIP = 5;

/**
 * Connected fan of triangles where the first vertex forms triangles with the following pairs of vertices.
 *
 * @type {number}
 * @category Graphics
 */
export const PRIMITIVE_TRIFAN = 6;

/**
 * Vertex attribute to be treated as a position.
 *
 * @type {string}
 * @category Graphics
 */
export const SEMANTIC_POSITION = "POSITION";

/**
 * Vertex attribute to be treated as a normal.
 *
 * @type {string}
 * @category Graphics
 */
export const SEMANTIC_NORMAL = "NORMAL";

/**
 * Vertex attribute to be treated as a tangent.
 *
 * @type {string}
 * @category Graphics
 */
export const SEMANTIC_TANGENT = "TANGENT";

/**
 * Vertex attribute to be treated as skin blend weights.
 *
 * @type {string}
 * @category Graphics
 */
export const SEMANTIC_BLENDWEIGHT = "BLENDWEIGHT";

/**
 * Vertex attribute to be treated as skin blend indices.
 *
 * @type {string}
 * @category Graphics
 */
export const SEMANTIC_BLENDINDICES = "BLENDINDICES";

/**
 * Vertex attribute to be treated as a color.
 *
 * @type {string}
 * @category Graphics
 */
export const SEMANTIC_COLOR = "COLOR";

// private semantic used for programmatic construction of individual texcoord semantics
export const SEMANTIC_TEXCOORD = "TEXCOORD";

/**
 * Vertex attribute to be treated as a texture coordinate (set 0).
 *
 * @type {string}
 * @category Graphics
 */
export const SEMANTIC_TEXCOORD0 = "TEXCOORD0";

/**
 * Vertex attribute to be treated as a texture coordinate (set 1).
 *
 * @type {string}
 * @category Graphics
 */
export const SEMANTIC_TEXCOORD1 = "TEXCOORD1";

/**
 * Vertex attribute to be treated as a texture coordinate (set 2).
 *
 * @type {string}
 * @category Graphics
 */
export const SEMANTIC_TEXCOORD2 = "TEXCOORD2";

/**
 * Vertex attribute to be treated as a texture coordinate (set 3).
 *
 * @type {string}
 * @category Graphics
 */
export const SEMANTIC_TEXCOORD3 = "TEXCOORD3";

/**
 * Vertex attribute to be treated as a texture coordinate (set 4).
 *
 * @type {string}
 * @category Graphics
 */
export const SEMANTIC_TEXCOORD4 = "TEXCOORD4";

/**
 * Vertex attribute to be treated as a texture coordinate (set 5).
 *
 * @type {string}
 * @category Graphics
 */
export const SEMANTIC_TEXCOORD5 = "TEXCOORD5";

/**
 * Vertex attribute to be treated as a texture coordinate (set 6).
 *
 * @type {string}
 * @category Graphics
 */
export const SEMANTIC_TEXCOORD6 = "TEXCOORD6";

/**
 * Vertex attribute to be treated as a texture coordinate (set 7).
 *
 * @type {string}
 * @category Graphics
 */
export const SEMANTIC_TEXCOORD7 = "TEXCOORD7";

// private semantic used for programmatic construction of individual attr semantics
export const SEMANTIC_ATTR = "ATTR";

/**
 * Vertex attribute with a user defined semantic.
 *
 * @type {string}
 * @category Graphics
 */
export const SEMANTIC_ATTR0 = "ATTR0";

/**
 * Vertex attribute with a user defined semantic.
 *
 * @type {string}
 * @category Graphics
 */
export const SEMANTIC_ATTR1 = "ATTR1";

/**
 * Vertex attribute with a user defined semantic.
 *
 * @type {string}
 * @category Graphics
 */
export const SEMANTIC_ATTR2 = "ATTR2";

/**
 * Vertex attribute with a user defined semantic.
 *
 * @type {string}
 * @category Graphics
 */
export const SEMANTIC_ATTR3 = "ATTR3";

/**
 * Vertex attribute with a user defined semantic.
 *
 * @type {string}
 * @category Graphics
 */
export const SEMANTIC_ATTR4 = "ATTR4";

/**
 * Vertex attribute with a user defined semantic.
 *
 * @type {string}
 * @category Graphics
 */
export const SEMANTIC_ATTR5 = "ATTR5";

/**
 * Vertex attribute with a user defined semantic.
 *
 * @type {string}
 * @category Graphics
 */
export const SEMANTIC_ATTR6 = "ATTR6";

/**
 * Vertex attribute with a user defined semantic.
 *
 * @type {string}
 * @category Graphics
 */
export const SEMANTIC_ATTR7 = "ATTR7";

/**
 * Vertex attribute with a user defined semantic.
 *
 * @type {string}
 * @category Graphics
 */
export const SEMANTIC_ATTR8 = "ATTR8";

/**
 * Vertex attribute with a user defined semantic.
 *
 * @type {string}
 * @category Graphics
 */
export const SEMANTIC_ATTR9 = "ATTR9";

/**
 * Vertex attribute with a user defined semantic.
 *
 * @type {string}
 * @category Graphics
 */
export const SEMANTIC_ATTR10 = "ATTR10";

/**
 * Vertex attribute with a user defined semantic.
 *
 * @type {string}
 * @category Graphics
 */
export const SEMANTIC_ATTR11 = "ATTR11";

/**
 * Vertex attribute with a user defined semantic.
 *
 * @type {string}
 * @category Graphics
 */
export const SEMANTIC_ATTR12 = "ATTR12";

/**
 * Vertex attribute with a user defined semantic.
 *
 * @type {string}
 * @category Graphics
 */
export const SEMANTIC_ATTR13 = "ATTR13";

/**
 * Vertex attribute with a user defined semantic.
 *
 * @type {string}
 * @category Graphics
 */
export const SEMANTIC_ATTR14 = "ATTR14";

/**
 * Vertex attribute with a user defined semantic.
 *
 * @type {string}
 * @category Graphics
 */
export const SEMANTIC_ATTR15 = "ATTR15";

export const SHADERTAG_MATERIAL = 1;

/**
 * Don't change the stencil buffer value.
 *
 * @type {number}
 * @category Graphics
 */
export const STENCILOP_KEEP = 0;

/**
 * Set value to zero.
 *
 * @type {number}
 * @category Graphics
 */
export const STENCILOP_ZERO = 1;

/**
 * Replace value with the reference value (see {@link StencilParameters}).
 *
 * @type {number}
 * @category Graphics
 */
export const STENCILOP_REPLACE = 2;

/**
 * Increment the value.
 *
 * @type {number}
 * @category Graphics
 */
export const STENCILOP_INCREMENT = 3;

/**
 * Increment the value but wrap it to zero when it's larger than a maximum representable value.
 *
 * @type {number}
 * @category Graphics
 */
export const STENCILOP_INCREMENTWRAP = 4;

/**
 * Decrement the value.
 *
 * @type {number}
 * @category Graphics
 */
export const STENCILOP_DECREMENT = 5;

/**
 * Decrement the value but wrap it to a maximum representable value if the current value is 0.
 *
 * @type {number}
 * @category Graphics
 */
export const STENCILOP_DECREMENTWRAP = 6;

/**
 * Invert the value bitwise.
 *
 * @type {number}
 * @category Graphics
 */
export const STENCILOP_INVERT = 7;

/**
 * The texture is not in a locked state.
 *
 * @type {number}
 */
export const TEXTURELOCK_NONE = 0;

/**
 * Read only. Any changes to the locked mip level's pixels will not update the texture.
 *
 * @type {number}
 * @category Graphics
 */
export const TEXTURELOCK_READ = 1;

/**
 * Write only. The contents of the specified mip level will be entirely replaced.
 *
 * @type {number}
 * @category Graphics
 */
export const TEXTURELOCK_WRITE = 2;

/**
 * Texture is a default type.
 *
 * @type {string}
 * @category Graphics
 */
export const TEXTURETYPE_DEFAULT = 'default';

/**
 * Texture stores high dynamic range data in RGBM format.
 *
 * @type {string}
 * @category Graphics
 */
export const TEXTURETYPE_RGBM = 'rgbm';

/**
 * Texture stores high dynamic range data in RGBE format.
 *
 * @type {string}
 * @category Graphics
 */
export const TEXTURETYPE_RGBE = 'rgbe';

/**
 * Texture stores high dynamic range data in RGBP encoding.
 *
 * @type {string}
 * @category Graphics
 */
export const TEXTURETYPE_RGBP = 'rgbp';

/**
 * Texture stores normalmap data swizzled in GGGR format. This is used for tangent space normal
 * maps. The R component is stored in alpha and G is stored in RGB. This packing can result in
 * higher quality when the texture data is compressed.
 *
 * @type {string}
 * @category Graphics
 */
export const TEXTURETYPE_SWIZZLEGGGR = 'swizzleGGGR';

export const TEXHINT_NONE = 0;
export const TEXHINT_SHADOWMAP = 1;
export const TEXHINT_ASSET = 2;
export const TEXHINT_LIGHTMAP = 3;

/**
 * Texture data is stored in a 1-dimensional texture.
 *
 * @type {string}
 * @category Graphics
 */
export const TEXTUREDIMENSION_1D = '1d';

/**
 * Texture data is stored in a 2-dimensional texture.
 *
 * @type {string}
 * @category Graphics
 */
export const TEXTUREDIMENSION_2D = '2d';

/**
 * Texture data is stored in an array of 2-dimensional textures.
 *
 * @type {string}
 * @category Graphics
 */
export const TEXTUREDIMENSION_2D_ARRAY = '2d-array';

/**
 * Texture data is stored in a cube texture.
 *
 * @type {string}
 * @category Graphics
 */
export const TEXTUREDIMENSION_CUBE = 'cube';

/**
 * Texture data is stored in an array of cube textures.
 *
 * @type {string}
 * @category Graphics
 */
export const TEXTUREDIMENSION_CUBE_ARRAY = 'cube-array';

/**
 * Texture data is stored in a 3-dimensional texture.
 *
 * @type {string}
 * @category Graphics
 */
export const TEXTUREDIMENSION_3D = '3d';

/**
 * A sampler type of a texture that contains floating-point data. Typically stored for color
 * textures, where data can be filtered.
 *
 * @type {number}
 * @category Graphics
 */
export const SAMPLETYPE_FLOAT = 0;

/**
 * A sampler type of a texture that contains floating-point data, but cannot be filtered. Typically
 * used for textures storing data that cannot be interpolated.
 *
 * @type {number}
 * @category Graphics
 */
export const SAMPLETYPE_UNFILTERABLE_FLOAT = 1;

/**
 * A sampler type of a texture that contains depth data. Typically used for depth textures.
 *
 * @type {number}
 * @category Graphics
 */
export const SAMPLETYPE_DEPTH = 2;

/**
 * A sampler type of a texture that contains signed integer data.
 *
 * @type {number}
 * @category Graphics
 */
export const SAMPLETYPE_INT = 3;

/**
 * A sampler type of a texture that contains unsigned integer data.
 *
 * @type {number}
 * @category Graphics
 */
export const SAMPLETYPE_UINT = 4;

/**
 * Texture data is not stored a specific projection format.
 *
 * @type {string}
 * @category Graphics
 */
export const TEXTUREPROJECTION_NONE = "none";

/**
 * Texture data is stored in cubemap projection format.
 *
 * @type {string}
 * @category Graphics
 */
export const TEXTUREPROJECTION_CUBE = "cube";

/**
 * Texture data is stored in equirectangular projection format.
 *
 * @type {string}
 * @category Graphics
 */
export const TEXTUREPROJECTION_EQUIRECT = "equirect";

/**
 * Texture data is stored in octahedral projection format.
 *
 * @type {string}
 * @category Graphics
 */
export const TEXTUREPROJECTION_OCTAHEDRAL = "octahedral";

/**
 * Shader source code uses GLSL language.
 *
 * @type {string}
 * @category Graphics
 */
export const SHADERLANGUAGE_GLSL = 'glsl';

/**
 * Shader source code uses WGSL language.
 *
 * @type {string}
 * @category Graphics
 */
export const SHADERLANGUAGE_WGSL = 'wgsl';

/**
 * Signed byte vertex element type.
 *
 * @type {number}
 * @category Graphics
 */
export const TYPE_INT8 = 0;

/**
 * Unsigned byte vertex element type.
 *
 * @type {number}
 * @category Graphics
 */
export const TYPE_UINT8 = 1;

/**
 * Signed short vertex element type.
 *
 * @type {number}
 * @category Graphics
 */
export const TYPE_INT16 = 2;

/**
 * Unsigned short vertex element type.
 *
 * @type {number}
 * @category Graphics
 */
export const TYPE_UINT16 = 3;

/**
 * Signed integer vertex element type.
 *
 * @type {number}
 * @category Graphics
 */
export const TYPE_INT32 = 4;

/**
 * Unsigned integer vertex element type.
 *
 * @type {number}
 * @category Graphics
 */
export const TYPE_UINT32 = 5;

/**
 * Floating point vertex element type.
 *
 * @type {number}
 * @category Graphics
 */
export const TYPE_FLOAT32 = 6;

/**
 * 16-bit floating point vertex element type.
 *
 * @type {number}
 * @category Graphics
 */
export const TYPE_FLOAT16 = 7;

// ---------- Uniform types ------------
// Note: Only types which can be used in uniform buffers are exported here, others are internal.
// The arrays are exposed as a base type with number of elements, and textures are not part of the
// uniform buffers.

/**
 * Boolean uniform type.
 *
 * @type {number}
 * @category Graphics
 */
export const UNIFORMTYPE_BOOL = 0;

/**
 * Integer uniform type.
 *
 * @type {number}
 * @category Graphics
 */
export const UNIFORMTYPE_INT = 1;

/**
 * Float uniform type.
 *
 * @type {number}
 * @category Graphics
 */
export const UNIFORMTYPE_FLOAT = 2;

/**
 * 2 x Float uniform type.
 *
 * @type {number}
 * @category Graphics
 */
export const UNIFORMTYPE_VEC2 = 3;

/**
 * 3 x Float uniform type.
 *
 * @type {number}
 * @category Graphics
 */
export const UNIFORMTYPE_VEC3 = 4;

/**
 * 4 x Float uniform type.
 *
 * @type {number}
 * @category Graphics
 */
export const UNIFORMTYPE_VEC4 = 5;

/**
 * 2 x Integer uniform type.
 *
 * @type {number}
 * @category Graphics
 */
export const UNIFORMTYPE_IVEC2 = 6;

/**
 * 3 x Integer uniform type.
 *
 * @type {number}
 * @category Graphics
 */
export const UNIFORMTYPE_IVEC3 = 7;

/**
 * 4 x Integer uniform type.
 *
 * @type {number}
 * @category Graphics
 */
export const UNIFORMTYPE_IVEC4 = 8;

/**
 * 2 x Boolean uniform type.
 *
 * @type {number}
 * @category Graphics
 */
export const UNIFORMTYPE_BVEC2 = 9;

/**
 * 3 x Boolean uniform type.
 *
 * @type {number}
 * @category Graphics
 */
export const UNIFORMTYPE_BVEC3 = 10;

/**
 * 4 x Boolean uniform type.
 *
 * @type {number}
 * @category Graphics
 */
export const UNIFORMTYPE_BVEC4 = 11;

/**
 * 2 x 2 x Float uniform type.
 *
 * @type {number}
 * @category Graphics
 */
export const UNIFORMTYPE_MAT2 = 12;

/**
 * 3 x 3 x Float uniform type.
 *
 * @type {number}
 * @category Graphics
 */
export const UNIFORMTYPE_MAT3 = 13;

/**
 * 4 x 4 x Float uniform type.
 *
 * @type {number}
 * @category Graphics
 */
export const UNIFORMTYPE_MAT4 = 14;

export const UNIFORMTYPE_TEXTURE2D = 15;
export const UNIFORMTYPE_TEXTURECUBE = 16;
export const UNIFORMTYPE_FLOATARRAY = 17;
export const UNIFORMTYPE_TEXTURE2D_SHADOW = 18;
export const UNIFORMTYPE_TEXTURECUBE_SHADOW = 19;
export const UNIFORMTYPE_TEXTURE3D = 20;
export const UNIFORMTYPE_VEC2ARRAY = 21;
export const UNIFORMTYPE_VEC3ARRAY = 22;
export const UNIFORMTYPE_VEC4ARRAY = 23;
export const UNIFORMTYPE_MAT4ARRAY = 24;
export const UNIFORMTYPE_TEXTURE2D_ARRAY = 25;

// Unsigned uniform types

/**
 * Unsigned integer uniform type.
 *
 * @type {number}
 * @category Graphics
 */
export const UNIFORMTYPE_UINT = 26;

/**
 * 2 x Unsigned integer uniform type.
 *
 * @type {number}
 * @category Graphics
 */
export const UNIFORMTYPE_UVEC2 = 27;

/**
 * 3 x Unsigned integer uniform type.
 *
 * @type {number}
 * @category Graphics
 */
export const UNIFORMTYPE_UVEC3 = 28;

/**
 * 4 x Unsigned integer uniform type.
 *
 * @type {number}
 * @category Graphics
 */
export const UNIFORMTYPE_UVEC4 = 29;

// Integer uniform array types
export const UNIFORMTYPE_INTARRAY = 30;
export const UNIFORMTYPE_UINTARRAY = 31;
export const UNIFORMTYPE_BOOLARRAY = 32;
export const UNIFORMTYPE_IVEC2ARRAY = 33;
export const UNIFORMTYPE_UVEC2ARRAY = 34;
export const UNIFORMTYPE_BVEC2ARRAY = 35;
export const UNIFORMTYPE_IVEC3ARRAY = 36;
export const UNIFORMTYPE_UVEC3ARRAY = 37;
export const UNIFORMTYPE_BVEC3ARRAY = 38;
export const UNIFORMTYPE_IVEC4ARRAY = 39;
export const UNIFORMTYPE_UVEC4ARRAY = 40;
export const UNIFORMTYPE_BVEC4ARRAY = 41;

// Integer texture types
export const UNIFORMTYPE_ITEXTURE2D = 42;
export const UNIFORMTYPE_UTEXTURE2D = 43;
export const UNIFORMTYPE_ITEXTURECUBE = 44;
export const UNIFORMTYPE_UTEXTURECUBE = 45;
export const UNIFORMTYPE_ITEXTURE3D = 46;
export const UNIFORMTYPE_UTEXTURE3D = 47;
export const UNIFORMTYPE_ITEXTURE2D_ARRAY = 48;
export const UNIFORMTYPE_UTEXTURE2D_ARRAY = 49;

// ----------

export const uniformTypeToName = [
    // Uniforms
    'bool',
    'int',
    'float',
    'vec2',
    'vec3',
    'vec4',
    'ivec2',
    'ivec3',
    'ivec4',
    'bvec2',
    'bvec3',
    'bvec4',
    'mat2',
    'mat3',
    'mat4',
    'sampler2D',
    'samplerCube',
    '', // not directly handled: UNIFORMTYPE_FLOATARRAY
    'sampler2DShadow',
    'samplerCubeShadow',
    'sampler3D',
    '', // not directly handled: UNIFORMTYPE_VEC2ARRAY
    '', // not directly handled: UNIFORMTYPE_VEC3ARRAY
    '', // not directly handled: UNIFORMTYPE_VEC4ARRAY
    '', // not directly handled: UNIFORMTYPE_MAT4ARRAY
    'sampler2DArray',
    'uint',
    'uvec2',
    'uvec3',
    'uvec4',
    '', // not directly handled: UNIFORMTYPE_INTARRAY
    '', // not directly handled: UNIFORMTYPE_UINTARRAY
    '', // not directly handled: UNIFORMTYPE_BOOLARRAY
    '', // not directly handled: UNIFORMTYPE_IVEC2ARRAY
    '', // not directly handled: UNIFORMTYPE_UVEC2ARRAY
    '', // not directly handled: UNIFORMTYPE_BVEC2ARRAY
    '', // not directly handled: UNIFORMTYPE_IVEC3ARRAY
    '', // not directly handled: UNIFORMTYPE_UVEC3ARRAY
    '', // not directly handled: UNIFORMTYPE_BVEC3ARRAY
    '', // not directly handled: UNIFORMTYPE_IVEC4ARRAY
    '', // not directly handled: UNIFORMTYPE_UVEC4ARRAY
    '', // not directly handled: UNIFORMTYPE_BVEC4ARRAY
    'isampler2D',
    'usampler2D',
    'isamplerCube',
    'usamplerCube',
    'isampler3D',
    'usampler3D',
    'isampler2DArray',
    'usampler2DArray'
];

// Map to convert uniform type to storage type, used in uniform-buffer.js
export const uniformTypeToStorage = new Uint8Array([
    TYPE_INT32,     // UNIFORMTYPE_BOOL
    TYPE_INT32,     // UNIFORMTYPE_INT
    TYPE_FLOAT32,   // UNIFORMTYPE_FLOAT
    TYPE_FLOAT32,   // UNIFORMTYPE_VEC2
    TYPE_FLOAT32,   // UNIFORMTYPE_VEC3
    TYPE_FLOAT32,   // UNIFORMTYPE_VEC4
    TYPE_INT32,     // UNIFORMTYPE_IVEC2
    TYPE_INT32,     // UNIFORMTYPE_IVEC3
    TYPE_INT32,     // UNIFORMTYPE_IVEC4
    TYPE_INT32,     // UNIFORMTYPE_BVEC2
    TYPE_INT32,     // UNIFORMTYPE_BVEC3
    TYPE_INT32,     // UNIFORMTYPE_BVEC4
    TYPE_FLOAT32,   // UNIFORMTYPE_MAT2
    TYPE_FLOAT32,   // UNIFORMTYPE_MAT3
    TYPE_FLOAT32,   // UNIFORMTYPE_MAT4
    TYPE_INT32,     // UNIFORMTYPE_TEXTURE2D
    TYPE_INT32,     // UNIFORMTYPE_TEXTURECUBE
    TYPE_FLOAT32,   // UNIFORMTYPE_FLOATARRAY
    TYPE_INT32,     // UNIFORMTYPE_TEXTURE2D_SHADOW
    TYPE_INT32,     // UNIFORMTYPE_TEXTURECUBE_SHADOW
    TYPE_INT32,     // UNIFORMTYPE_TEXTURE3D
    TYPE_FLOAT32,   // UNIFORMTYPE_VEC2ARRAY
    TYPE_FLOAT32,   // UNIFORMTYPE_VEC3ARRAY
    TYPE_FLOAT32,   // UNIFORMTYPE_VEC4ARRAY
    TYPE_FLOAT32,   // UNIFORMTYPE_MAT4ARRAY
    TYPE_INT32,     // UNIFORMTYPE_TEXTURE2D_ARRAY
    TYPE_UINT32,    // UNIFORMTYPE_UINT
    TYPE_UINT32,    // UNIFORMTYPE_UVEC2
    TYPE_UINT32,    // UNIFORMTYPE_UVEC3
    TYPE_UINT32,    // UNIFORMTYPE_UVEC4
    TYPE_INT32,     // UNIFORMTYPE_INTARRAY
    TYPE_UINT32,    // UNIFORMTYPE_UINTARRAY
    TYPE_INT32,     // UNIFORMTYPE_BOOLARRAY
    TYPE_INT32,     // UNIFORMTYPE_IVEC2ARRAY
    TYPE_UINT32,    // UNIFORMTYPE_UVEC2ARRAY
    TYPE_INT32,     // UNIFORMTYPE_BVEC2ARRAY
    TYPE_INT32,     // UNIFORMTYPE_IVEC3ARRAY
    TYPE_UINT32,    // UNIFORMTYPE_UVEC3ARRAY
    TYPE_INT32,     // UNIFORMTYPE_BVEC3ARRAY
    TYPE_INT32,     // UNIFORMTYPE_IVEC4ARRAY
    TYPE_UINT32,    // UNIFORMTYPE_UVEC4ARRAY
    TYPE_INT32,     // UNIFORMTYPE_BVEC4ARRAY
    TYPE_INT32,     // UNIFORMTYPE_ITEXTURE2D
    TYPE_UINT32,    // UNIFORMTYPE_UTEXTURE2D
    TYPE_INT32,     // UNIFORMTYPE_ITEXTURECUBE
    TYPE_UINT32,    // UNIFORMTYPE_UTEXTURECUBE
    TYPE_INT32,     // UNIFORMTYPE_ITEXTURE3D
    TYPE_UINT32,    // UNIFORMTYPE_UTEXTURE3D
    TYPE_INT32,     // UNIFORMTYPE_ITEXTURE2D_ARRAY
    TYPE_UINT32     // UNIFORMTYPE_UTEXTURE2D_ARRAY
]);

/**
 * A WebGL 2 device type.
 *
 * @type {string}
 * @category Graphics
 */
export const DEVICETYPE_WEBGL2 = 'webgl2';

/**
 * A WebGPU device type.
 *
 * @type {string}
 * @category Graphics
 */
export const DEVICETYPE_WEBGPU = 'webgpu';

/**
 * A Null device type.
 *
 * @type {string}
 * @category Graphics
 */
export const DEVICETYPE_NULL = 'null';

/**
 * The resource is visible to the vertex shader.
 *
 * @type {number}
 * @category Graphics
 */
export const SHADERSTAGE_VERTEX = 1;

/**
 * The resource is visible to the fragment shader.
 *
 * @type {number}
 * @category Graphics
 */
export const SHADERSTAGE_FRAGMENT = 2;

/**
 * The resource is visible to the compute shader.
 *
 * @type {number}
 * @category Graphics
 */
export const SHADERSTAGE_COMPUTE = 4;

// indices of commonly used bind groups, sorted from the least commonly changing to avoid internal rebinding
export const BINDGROUP_VIEW = 0;        // view bind group, textures, samplers and uniforms
export const BINDGROUP_MESH = 1;        // mesh bind group - textures and samplers
export const BINDGROUP_MESH_UB = 2;     // mesh bind group - a single uniform buffer

// names of bind groups
export const bindGroupNames = ['view', 'mesh', 'mesh_ub'];

// name of the default uniform buffer slot in a bind group
export const UNIFORM_BUFFER_DEFAULT_SLOT_NAME = 'default';

// map of engine TYPE_*** enums to their corresponding typed array constructors and byte sizes
export const typedArrayTypes = [Int8Array, Uint8Array, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, Uint16Array];
export const typedArrayTypesByteSize = [1, 1, 2, 2, 4, 4, 4, 2];
export const vertexTypesNames = ['INT8', 'UINT8', 'INT16', 'UINT16', 'INT32', 'UINT32', 'FLOAT32', 'FLOAT16'];

// map of typed array to engine TYPE_***
export const typedArrayToType = {
    "Int8Array": TYPE_INT8,
    "Uint8Array": TYPE_UINT8,
    "Int16Array": TYPE_INT16,
    "Uint16Array": TYPE_UINT16,
    "Int32Array": TYPE_INT32,
    "Uint32Array": TYPE_UINT32,
    "Float32Array": TYPE_FLOAT32
};

// map of engine INDEXFORMAT_*** to their corresponding typed array constructors and byte sizes
export const typedArrayIndexFormats = [Uint8Array, Uint16Array, Uint32Array];
export const typedArrayIndexFormatsByteSize = [1, 2, 4];

/**
 * Map of engine semantics into location on device in range 0..15 (note - semantics mapping to the
 * same location cannot be used at the same time) organized in a way that ATTR0-ATTR7 do not
 * overlap with common important semantics.
 *
 * @type {object}
 * @ignore
 * @category Graphics
 */
export const semanticToLocation = {};

semanticToLocation[SEMANTIC_POSITION] = 0;
semanticToLocation[SEMANTIC_NORMAL] = 1;
semanticToLocation[SEMANTIC_BLENDWEIGHT] = 2;
semanticToLocation[SEMANTIC_BLENDINDICES] = 3;
semanticToLocation[SEMANTIC_COLOR] = 4;
semanticToLocation[SEMANTIC_TEXCOORD0] = 5;
semanticToLocation[SEMANTIC_TEXCOORD1] = 6;
semanticToLocation[SEMANTIC_TEXCOORD2] = 7;
semanticToLocation[SEMANTIC_TEXCOORD3] = 8;
semanticToLocation[SEMANTIC_TEXCOORD4] = 9;
semanticToLocation[SEMANTIC_TEXCOORD5] = 10;
semanticToLocation[SEMANTIC_TEXCOORD6] = 11;
semanticToLocation[SEMANTIC_TEXCOORD7] = 12;
semanticToLocation[SEMANTIC_TANGENT] = 13;

semanticToLocation[SEMANTIC_ATTR0] = 0;
semanticToLocation[SEMANTIC_ATTR1] = 1;
semanticToLocation[SEMANTIC_ATTR2] = 2;
semanticToLocation[SEMANTIC_ATTR3] = 3;
semanticToLocation[SEMANTIC_ATTR4] = 4;
semanticToLocation[SEMANTIC_ATTR5] = 5;
semanticToLocation[SEMANTIC_ATTR6] = 6;
semanticToLocation[SEMANTIC_ATTR7] = 7;
semanticToLocation[SEMANTIC_ATTR8] = 8;
semanticToLocation[SEMANTIC_ATTR9] = 9;
semanticToLocation[SEMANTIC_ATTR10] = 10;
semanticToLocation[SEMANTIC_ATTR11] = 11;
semanticToLocation[SEMANTIC_ATTR12] = 12;
semanticToLocation[SEMANTIC_ATTR13] = 13;
semanticToLocation[SEMANTIC_ATTR14] = 14;
semanticToLocation[SEMANTIC_ATTR15] = 15;

/**
 * Chunk API versions
 *
 * @type {string}
 * @category Graphics
 */
export const CHUNKAPI_1_51 = '1.51';
export const CHUNKAPI_1_55 = '1.55';
export const CHUNKAPI_1_56 = '1.56';
export const CHUNKAPI_1_57 = '1.57';
export const CHUNKAPI_1_58 = '1.58';
export const CHUNKAPI_1_60 = '1.60';
export const CHUNKAPI_1_62 = '1.62';
export const CHUNKAPI_1_65 = '1.65';
export const CHUNKAPI_1_70 = '1.70';
