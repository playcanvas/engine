/**
 * Ignores the integer part of texture coordinates, using only the fractional part.
 *
 * @type {number}
 */
export const ADDRESS_REPEAT = 0;

/**
 * Clamps texture coordinate to the range 0 to 1.
 *
 * @type {number}
 */
export const ADDRESS_CLAMP_TO_EDGE = 1;

/**
 * Texture coordinate to be set to the fractional part if the integer part is even. If the integer
 * part is odd, then the texture coordinate is set to 1 minus the fractional part.
 *
 * @type {number}
 */
export const ADDRESS_MIRRORED_REPEAT = 2;

/**
 * Multiply all fragment components by zero.
 *
 * @type {number}
 */
export const BLENDMODE_ZERO = 0;

/**
 * Multiply all fragment components by one.
 *
 * @type {number}
 */
export const BLENDMODE_ONE = 1;

/**
 * Multiply all fragment components by the components of the source fragment.
 *
 * @type {number}
 */
export const BLENDMODE_SRC_COLOR = 2;

/**
 * Multiply all fragment components by one minus the components of the source fragment.
 *
 * @type {number}
 */
export const BLENDMODE_ONE_MINUS_SRC_COLOR = 3;

/**
 * Multiply all fragment components by the components of the destination fragment.
 *
 * @type {number}
 */
export const BLENDMODE_DST_COLOR = 4;

/**
 * Multiply all fragment components by one minus the components of the destination fragment.
 *
 * @type {number}
 */
export const BLENDMODE_ONE_MINUS_DST_COLOR = 5;

/**
 * Multiply all fragment components by the alpha value of the source fragment.
 *
 * @type {number}
 */
export const BLENDMODE_SRC_ALPHA = 6;

/**
 * Multiply all fragment components by the alpha value of the source fragment.
 *
 * @type {number}
 */
export const BLENDMODE_SRC_ALPHA_SATURATE = 7;

/**
 * Multiply all fragment components by one minus the alpha value of the source fragment.
 *
 * @type {number}
 */
export const BLENDMODE_ONE_MINUS_SRC_ALPHA = 8;

/**
 * Multiply all fragment components by the alpha value of the destination fragment.
 *
 * @type {number}
 */
export const BLENDMODE_DST_ALPHA = 9;

/**
 * Multiply all fragment components by one minus the alpha value of the destination fragment.
 *
 * @type {number}
 */
export const BLENDMODE_ONE_MINUS_DST_ALPHA = 10;

/**
 * Multiplies all fragment components by a constant.
 *
 * @type {number}
 */
export const BLENDMODE_CONSTANT = 11;

/**
 * Multiplies all fragment components by 1 minus a constant.
 *
 * @type {number}
 */
export const BLENDMODE_ONE_MINUS_CONSTANT = 12;

/**
 * Add the results of the source and destination fragment multiplies.
 *
 * @type {number}
 */
export const BLENDEQUATION_ADD = 0;

/**
 * Subtract the results of the source and destination fragment multiplies.
 *
 * @type {number}
 */
export const BLENDEQUATION_SUBTRACT = 1;

/**
 * Reverse and subtract the results of the source and destination fragment multiplies.
 *
 * @type {number}
 */
export const BLENDEQUATION_REVERSE_SUBTRACT = 2;

/**
 * Use the smallest value. Check app.graphicsDevice.extBlendMinmax for support.
 *
 * @type {number}
 */
export const BLENDEQUATION_MIN = 3;

/**
 * Use the largest value. Check app.graphicsDevice.extBlendMinmax for support.
 *
 * @type {number}
 */
export const BLENDEQUATION_MAX = 4;

/**
 * The data store contents will be modified once and used many times.
 *
 * @type {number}
 */
export const BUFFER_STATIC = 0;

/**
 * The data store contents will be modified repeatedly and used many times.
 *
 * @type {number}
 */
export const BUFFER_DYNAMIC = 1;

/**
 * The data store contents will be modified once and used at most a few times.
 *
 * @type {number}
 */
export const BUFFER_STREAM = 2;

/**
 * The data store contents will be modified repeatedly on the GPU and used many times. Optimal for
 * transform feedback usage (WebGL2 only).
 *
 * @type {number}
 */
export const BUFFER_GPUDYNAMIC = 3;

/**
 * Clear the color buffer.
 *
 * @type {number}
 */
export const CLEARFLAG_COLOR = 1;

/**
 * Clear the depth buffer.
 *
 * @type {number}
 */
export const CLEARFLAG_DEPTH = 2;

/**
 * Clear the stencil buffer.
 *
 * @type {number}
 */
export const CLEARFLAG_STENCIL = 4;

/**
 * The positive X face of a cubemap.
 *
 * @type {number}
 */
export const CUBEFACE_POSX = 0;

/**
 * The negative X face of a cubemap.
 *
 * @type {number}
 */
export const CUBEFACE_NEGX = 1;

/**
 * The positive Y face of a cubemap.
 *
 * @type {number}
 */
export const CUBEFACE_POSY = 2;

/**
 * The negative Y face of a cubemap.
 *
 * @type {number}
 */
export const CUBEFACE_NEGY = 3;

/**
 * The positive Z face of a cubemap.
 *
 * @type {number}
 */
export const CUBEFACE_POSZ = 4;

/**
 * The negative Z face of a cubemap.
 *
 * @type {number}
 */
export const CUBEFACE_NEGZ = 5;

/**
 * No triangles are culled.
 *
 * @type {number}
 */
export const CULLFACE_NONE = 0;

/**
 * Triangles facing away from the view direction are culled.
 *
 * @type {number}
 */
export const CULLFACE_BACK = 1;

/**
 * Triangles facing the view direction are culled.
 *
 * @type {number}
 */
export const CULLFACE_FRONT = 2;

/**
 * Triangles are culled regardless of their orientation with respect to the view direction. Note
 * that point or line primitives are unaffected by this render state.
 *
 * @type {number}
 */
export const CULLFACE_FRONTANDBACK = 3;

/**
 * Point sample filtering.
 *
 * @type {number}
 */
export const FILTER_NEAREST = 0;

/**
 * Bilinear filtering.
 *
 * @type {number}
 */
export const FILTER_LINEAR = 1;

/**
 * Use the nearest neighbor in the nearest mipmap level.
 *
 * @type {number}
 */
export const FILTER_NEAREST_MIPMAP_NEAREST = 2;

/**
 * Linearly interpolate in the nearest mipmap level.
 *
 * @type {number}
 */
export const FILTER_NEAREST_MIPMAP_LINEAR = 3;

/**
 * Use the nearest neighbor after linearly interpolating between mipmap levels.
 *
 * @type {number}
 */
export const FILTER_LINEAR_MIPMAP_NEAREST = 4;

/**
 * Linearly interpolate both the mipmap levels and between texels.
 *
 * @type {number}
 */
export const FILTER_LINEAR_MIPMAP_LINEAR = 5;

/**
 * Never pass.
 *
 * @type {number}
 */
export const FUNC_NEVER = 0;

/**
 * Pass if (ref & mask) < (stencil & mask).
 *
 * @type {number}
 */
export const FUNC_LESS = 1;

/**
 * Pass if (ref & mask) == (stencil & mask).
 *
 * @type {number}
 */
export const FUNC_EQUAL = 2;

/**
 * Pass if (ref & mask) <= (stencil & mask).
 *
 * @type {number}
 */
export const FUNC_LESSEQUAL = 3;

/**
 * Pass if (ref & mask) > (stencil & mask).
 *
 * @type {number}
 */
export const FUNC_GREATER = 4;

/**
 * Pass if (ref & mask) != (stencil & mask).
 *
 * @type {number}
 */
export const FUNC_NOTEQUAL = 5;

/**
 * Pass if (ref & mask) >= (stencil & mask).
 *
 * @type {number}
 */
export const FUNC_GREATEREQUAL = 6;

/**
 * Always pass.
 *
 * @type {number}
 */
export const FUNC_ALWAYS = 7;

/**
 * 8-bit unsigned vertex indices (0 to 255).
 *
 * @type {number}
 */
export const INDEXFORMAT_UINT8 = 0;

/**
 * 16-bit unsigned vertex indices (0 to 65,535).
 *
 * @type {number}
 */
export const INDEXFORMAT_UINT16 = 1;

/**
 * 32-bit unsigned vertex indices (0 to 4,294,967,295).
 *
 * @type {number}
 */
export const INDEXFORMAT_UINT32 = 2;

/**
 * 8-bit alpha.
 *
 * @type {number}
 */
export const PIXELFORMAT_A8 = 0;

/**
 * 8-bit luminance.
 *
 * @type {number}
 */
export const PIXELFORMAT_L8 = 1;

/**
 * 8-bit luminance with 8-bit alpha.
 *
 * @type {number}
 */
export const PIXELFORMAT_LA8 = 2;

/**
 * 16-bit RGB (5-bits for red channel, 6 for green and 5 for blue).
 *
 * @type {number}
 */
export const PIXELFORMAT_RGB565 = 3;

/**
 * 16-bit RGBA (5-bits for red channel, 5 for green, 5 for blue with 1-bit alpha).
 *
 * @type {number}
 */
export const PIXELFORMAT_RGBA5551 = 4;

/**
 * 16-bit RGBA (4-bits for red channel, 4 for green, 4 for blue with 4-bit alpha).
 *
 * @type {number}
 */
export const PIXELFORMAT_RGBA4 = 5;

/**
 * 24-bit RGB (8-bits for red channel, 8 for green and 8 for blue).
 *
 * @type {number}
 */
export const PIXELFORMAT_RGB8 = 6;

/**
 * 32-bit RGBA (8-bits for red channel, 8 for green, 8 for blue with 8-bit alpha).
 *
 * @type {number}
 */
export const PIXELFORMAT_RGBA8 = 7;

/**
 * Block compressed format storing 16 input pixels in 64 bits of output, consisting of two 16-bit
 * RGB 5:6:5 color values and a 4x4 two bit lookup table.
 *
 * @type {number}
 */
export const PIXELFORMAT_DXT1 = 8;

/**
 * Block compressed format storing 16 input pixels (corresponding to a 4x4 pixel block) into 128
 * bits of output, consisting of 64 bits of alpha channel data (4 bits for each pixel) followed by
 * 64 bits of color data; encoded the same way as DXT1.
 *
 * @type {number}
 */
export const PIXELFORMAT_DXT3 = 9;

/**
 * Block compressed format storing 16 input pixels into 128 bits of output, consisting of 64 bits
 * of alpha channel data (two 8 bit alpha values and a 4x4 3 bit lookup table) followed by 64 bits
 * of color data (encoded the same way as DXT1).
 *
 * @type {number}
 */
export const PIXELFORMAT_DXT5 = 10;

/**
 * 16-bit floating point RGB (16-bit float for each red, green and blue channels).
 *
 * @type {number}
 */
export const PIXELFORMAT_RGB16F = 11;

/**
 * 16-bit floating point RGBA (16-bit float for each red, green, blue and alpha channels).
 *
 * @type {number}
 */
export const PIXELFORMAT_RGBA16F = 12;

/**
 * 32-bit floating point RGB (32-bit float for each red, green and blue channels).
 *
 * @type {number}
 */
export const PIXELFORMAT_RGB32F = 13;

/**
 * 32-bit floating point RGBA (32-bit float for each red, green, blue and alpha channels).
 *
 * @type {number}
 */
export const PIXELFORMAT_RGBA32F = 14;

/**
 * 32-bit floating point single channel format (WebGL2 only).
 *
 * @type {number}
 */
export const PIXELFORMAT_R32F = 15;

/**
 * A readable depth buffer format.
 *
 * @type {number}
 */
export const PIXELFORMAT_DEPTH = 16;

/**
 * A readable depth/stencil buffer format (WebGL2 only).
 *
 * @type {number}
 */
export const PIXELFORMAT_DEPTHSTENCIL = 17;

/**
 * A floating-point color-only format with 11 bits for red and green channels and 10 bits for the
 * blue channel (WebGL2 only).
 *
 * @type {number}
 */
export const PIXELFORMAT_111110F = 18;

/**
 * Color-only sRGB format (WebGL2 only).
 *
 * @type {number}
 */
export const PIXELFORMAT_SRGB = 19;

/**
 * Color sRGB format with additional alpha channel (WebGL2 only).
 *
 * @type {number}
 */
export const PIXELFORMAT_SRGBA = 20;

/**
 * ETC1 compressed format.
 *
 * @type {number}
 */
export const PIXELFORMAT_ETC1 = 21;

/**
 * ETC2 (RGB) compressed format.
 *
 * @type {number}
 */
export const PIXELFORMAT_ETC2_RGB = 22;

/**
 * ETC2 (RGBA) compressed format.
 *
 * @type {number}
 */
export const PIXELFORMAT_ETC2_RGBA = 23;

/**
 * PVRTC (2BPP RGB) compressed format.
 *
 * @type {number}
 */
export const PIXELFORMAT_PVRTC_2BPP_RGB_1 = 24;

/**
 * PVRTC (2BPP RGBA) compressed format.
 *
 * @type {number}
 */
export const PIXELFORMAT_PVRTC_2BPP_RGBA_1 = 25;

/**
 * PVRTC (4BPP RGB) compressed format.
 *
 * @type {number}
 */
export const PIXELFORMAT_PVRTC_4BPP_RGB_1 = 26;

/**
 * PVRTC (4BPP RGBA) compressed format.
 *
 * @type {number}
 */
export const PIXELFORMAT_PVRTC_4BPP_RGBA_1 = 27;

/**
 * ATC compressed format with alpha channel in blocks of 4x4.
 *
 * @type {number}
 */
export const PIXELFORMAT_ASTC_4x4 = 28;

/**
 * ATC compressed format with no alpha channel.
 *
 * @type {number}
 */
export const PIXELFORMAT_ATC_RGB = 29;

/**
 * ATC compressed format with alpha channel.
 *
 * @type {number}
 */
export const PIXELFORMAT_ATC_RGBA = 30;

/**
 * 32-bit BGRA (8-bits for blue channel, 8 for green, 8 for red with 8-bit alpha).
 *
 * @type {number}
 * @ignore
 */
export const PIXELFORMAT_BGRA8 = 31;

// update this function when exposing additional compressed pixel formats
export function isCompressedPixelFormat(format) {
    return (format >= PIXELFORMAT_DXT1 && format <= PIXELFORMAT_DXT5) ||
           (format >= PIXELFORMAT_ETC1 && format <= PIXELFORMAT_ATC_RGBA);
}

/**
 * List of distinct points.
 *
 * @type {number}
 */
export const PRIMITIVE_POINTS = 0;

/**
 * Discrete list of line segments.
 *
 * @type {number}
 */
export const PRIMITIVE_LINES = 1;

/**
 * List of points that are linked sequentially by line segments, with a closing line segment
 * between the last and first points.
 *
 * @type {number}
 */
export const PRIMITIVE_LINELOOP = 2;

/**
 * List of points that are linked sequentially by line segments.
 *
 * @type {number}
 */
export const PRIMITIVE_LINESTRIP = 3;

/**
 * Discrete list of triangles.
 *
 * @type {number}
 */
export const PRIMITIVE_TRIANGLES = 4;

/**
 * Connected strip of triangles where a specified vertex forms a triangle using the previous two.
 *
 * @type {number}
 */
export const PRIMITIVE_TRISTRIP = 5;

/**
 * Connected fan of triangles where the first vertex forms triangles with the following pairs of vertices.
 *
 * @type {number}
 */
export const PRIMITIVE_TRIFAN = 6;

/**
 * Vertex attribute to be treated as a position.
 *
 * @type {string}
 */
export const SEMANTIC_POSITION = "POSITION";

/**
 * Vertex attribute to be treated as a normal.
 *
 * @type {string}
 */
export const SEMANTIC_NORMAL = "NORMAL";

/**
 * Vertex attribute to be treated as a tangent.
 *
 * @type {string}
 */
export const SEMANTIC_TANGENT = "TANGENT";

/**
 * Vertex attribute to be treated as skin blend weights.
 *
 * @type {string}
 */
export const SEMANTIC_BLENDWEIGHT = "BLENDWEIGHT";

/**
 * Vertex attribute to be treated as skin blend indices.
 *
 * @type {string}
 */
export const SEMANTIC_BLENDINDICES = "BLENDINDICES";

/**
 * Vertex attribute to be treated as a color.
 *
 * @type {string}
 */
export const SEMANTIC_COLOR = "COLOR";

// private semantic used for programmatic construction of individual texcoord semantics
export const SEMANTIC_TEXCOORD = "TEXCOORD";

/**
 * Vertex attribute to be treated as a texture coordinate (set 0).
 *
 * @type {string}
 */
export const SEMANTIC_TEXCOORD0 = "TEXCOORD0";

/**
 * Vertex attribute to be treated as a texture coordinate (set 1).
 *
 * @type {string}
 */
export const SEMANTIC_TEXCOORD1 = "TEXCOORD1";

/**
 * Vertex attribute to be treated as a texture coordinate (set 2).
 *
 * @type {string}
 */
export const SEMANTIC_TEXCOORD2 = "TEXCOORD2";

/**
 * Vertex attribute to be treated as a texture coordinate (set 3).
 *
 * @type {string}
 */
export const SEMANTIC_TEXCOORD3 = "TEXCOORD3";

/**
 * Vertex attribute to be treated as a texture coordinate (set 4).
 *
 * @type {string}
 */
export const SEMANTIC_TEXCOORD4 = "TEXCOORD4";

/**
 * Vertex attribute to be treated as a texture coordinate (set 5).
 *
 * @type {string}
 */
export const SEMANTIC_TEXCOORD5 = "TEXCOORD5";

/**
 * Vertex attribute to be treated as a texture coordinate (set 6).
 *
 * @type {string}
 */
export const SEMANTIC_TEXCOORD6 = "TEXCOORD6";

/**
 * Vertex attribute to be treated as a texture coordinate (set 7).
 *
 * @type {string}
 */
export const SEMANTIC_TEXCOORD7 = "TEXCOORD7";

// private semantic used for programmatic construction of individual attr semantics
export const SEMANTIC_ATTR = "ATTR";

/**
 * Vertex attribute with a user defined semantic.
 *
 * @type {string}
 */
export const SEMANTIC_ATTR0 = "ATTR0";

/**
 * Vertex attribute with a user defined semantic.
 *
 * @type {string}
 */
export const SEMANTIC_ATTR1 = "ATTR1";

/**
 * Vertex attribute with a user defined semantic.
 *
 * @type {string}
 */
export const SEMANTIC_ATTR2 = "ATTR2";

/**
 * Vertex attribute with a user defined semantic.
 *
 * @type {string}
 */
export const SEMANTIC_ATTR3 = "ATTR3";

/**
 * Vertex attribute with a user defined semantic.
 *
 * @type {string}
 */
export const SEMANTIC_ATTR4 = "ATTR4";

/**
 * Vertex attribute with a user defined semantic.
 *
 * @type {string}
 */
export const SEMANTIC_ATTR5 = "ATTR5";

/**
 * Vertex attribute with a user defined semantic.
 *
 * @type {string}
 */
export const SEMANTIC_ATTR6 = "ATTR6";

/**
 * Vertex attribute with a user defined semantic.
 *
 * @type {string}
 */
export const SEMANTIC_ATTR7 = "ATTR7";

/**
 * Vertex attribute with a user defined semantic.
 *
 * @type {string}
 */
export const SEMANTIC_ATTR8 = "ATTR8";

/**
 * Vertex attribute with a user defined semantic.
 *
 * @type {string}
 */
export const SEMANTIC_ATTR9 = "ATTR9";

/**
 * Vertex attribute with a user defined semantic.
 *
 * @type {string}
 */
export const SEMANTIC_ATTR10 = "ATTR10";

/**
 * Vertex attribute with a user defined semantic.
 *
 * @type {string}
 */
export const SEMANTIC_ATTR11 = "ATTR11";

/**
 * Vertex attribute with a user defined semantic.
 *
 * @type {string}
 */
export const SEMANTIC_ATTR12 = "ATTR12";

/**
 * Vertex attribute with a user defined semantic.
 *
 * @type {string}
 */
export const SEMANTIC_ATTR13 = "ATTR13";

/**
 * Vertex attribute with a user defined semantic.
 *
 * @type {string}
 */
export const SEMANTIC_ATTR14 = "ATTR14";

/**
 * Vertex attribute with a user defined semantic.
 *
 * @type {string}
 */
export const SEMANTIC_ATTR15 = "ATTR15";

export const SHADERTAG_MATERIAL = 1;

/**
 * Don't change the stencil buffer value.
 *
 * @type {number}
 */
export const STENCILOP_KEEP = 0;

/**
 * Set value to zero.
 *
 * @type {number}
 */
export const STENCILOP_ZERO = 1;

/**
 * Replace value with the reference value (see {@link GraphicsDevice#setStencilFunc}).
 *
 * @type {number}
 */
export const STENCILOP_REPLACE = 2;

/**
 * Increment the value.
 *
 * @type {number}
 */
export const STENCILOP_INCREMENT = 3;

/**
 * Increment the value but wrap it to zero when it's larger than a maximum representable value.
 *
 * @type {number}
 */
export const STENCILOP_INCREMENTWRAP = 4;

/**
 * Decrement the value.
 *
 * @type {number}
 */
export const STENCILOP_DECREMENT = 5;

/**
 * Decrement the value but wrap it to a maximum representable value if the current value is 0.
 *
 * @type {number}
 */
export const STENCILOP_DECREMENTWRAP = 6;

/**
 * Invert the value bitwise.
 *
 * @type {number}
 */
export const STENCILOP_INVERT = 7;

/**
 * Read only. Any changes to the locked mip level's pixels will not update the texture.
 *
 * @type {number}
 */
export const TEXTURELOCK_READ = 1;

/**
 * Write only. The contents of the specified mip level will be entirely replaced.
 *
 * @type {number}
 */
export const TEXTURELOCK_WRITE = 2;

/**
 * Texture is a default type.
 *
 * @type {string}
 */
export const TEXTURETYPE_DEFAULT = 'default';

/**
 * Texture stores high dynamic range data in RGBM format.
 *
 * @type {string}
 */
export const TEXTURETYPE_RGBM = 'rgbm';

/**
 * Texture stores high dynamic range data in RGBE format.
 *
 * @type {string}
 */
export const TEXTURETYPE_RGBE = 'rgbe';

/**
 * Texture stores high dynamic range data in RGBP encoding.
 *
 * @type {string}
 */
export const TEXTURETYPE_RGBP = 'rgbp';

/**
 * Texture stores normalmap data swizzled in GGGR format. This is used for tangent space normal
 * maps. The R component is stored in alpha and G is stored in RGB. This packing can result in
 * higher quality when the texture data is compressed.
 *
 * @type {string}
 */
export const TEXTURETYPE_SWIZZLEGGGR = 'swizzleGGGR';

export const TEXHINT_NONE = 0;
export const TEXHINT_SHADOWMAP = 1;
export const TEXHINT_ASSET = 2;
export const TEXHINT_LIGHTMAP = 3;

export const TEXTUREDIMENSION_1D = '1d';
export const TEXTUREDIMENSION_2D = '2d';
export const TEXTUREDIMENSION_2D_ARRAY = '2d-array';
export const TEXTUREDIMENSION_CUBE = 'cube';
export const TEXTUREDIMENSION_CUBE_ARRAY = 'cube-array';
export const TEXTUREDIMENSION_3D = '3d';

export const SAMPLETYPE_FLOAT = 0;
export const SAMPLETYPE_UNFILTERABLE_FLOAT = 1;
export const SAMPLETYPE_DEPTH = 2;

/**
 * Texture data is not stored a specific projection format.
 *
 * @type {string}
 */
export const TEXTUREPROJECTION_NONE = "none";

/**
 * Texture data is stored in cubemap projection format.
 *
 * @type {string}
 */
export const TEXTUREPROJECTION_CUBE = "cube";

/**
 * Texture data is stored in equirectangular projection format.
 *
 * @type {string}
 */
export const TEXTUREPROJECTION_EQUIRECT = "equirect";

/**
 * Texture data is stored in octahedral projection format.
 *
 * @type {string}
 */
export const TEXTUREPROJECTION_OCTAHEDRAL = "octahedral";

/**
 * Shader source code uses GLSL language.
 *
 * @type {string}
 */
export const SHADERLANGUAGE_GLSL = 'glsl';

/**
 * Shader source code uses WGSL language.
 *
 * @type {string}
 */
export const SHADERLANGUAGE_WGSL = 'wgsl';

/**
 * Signed byte vertex element type.
 *
 * @type {number}
 */
export const TYPE_INT8 = 0;

/**
 * Unsigned byte vertex element type.
 *
 * @type {number}
 */
export const TYPE_UINT8 = 1;

/**
 * Signed short vertex element type.
 *
 * @type {number}
 */
export const TYPE_INT16 = 2;

/**
 * Unsigned short vertex element type.
 *
 * @type {number}
 */
export const TYPE_UINT16 = 3;

/**
 * Signed integer vertex element type.
 *
 * @type {number}
 */
export const TYPE_INT32 = 4;

/**
 * Unsigned integer vertex element type.
 *
 * @type {number}
 */
export const TYPE_UINT32 = 5;

/**
 * Floating point vertex element type.
 *
 * @type {number}
 */
export const TYPE_FLOAT32 = 6;

export const UNIFORMTYPE_BOOL = 0;
export const UNIFORMTYPE_INT = 1;
export const UNIFORMTYPE_FLOAT = 2;
export const UNIFORMTYPE_VEC2 = 3;
export const UNIFORMTYPE_VEC3 = 4;
export const UNIFORMTYPE_VEC4 = 5;
export const UNIFORMTYPE_IVEC2 = 6;
export const UNIFORMTYPE_IVEC3 = 7;
export const UNIFORMTYPE_IVEC4 = 8;
export const UNIFORMTYPE_BVEC2 = 9;
export const UNIFORMTYPE_BVEC3 = 10;
export const UNIFORMTYPE_BVEC4 = 11;
export const UNIFORMTYPE_MAT2 = 12;
export const UNIFORMTYPE_MAT3 = 13;
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

export const uniformTypeToName = [
    'bool',
    'int',
    'float',
    'vec2',
    'vec3',
    'vec4',
    'ivec2',
    'ivec3',
    'ivec4',
    'bec2',
    'bec3',
    'bec4',
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
    '' // not directly handled: UNIFORMTYPE_VEC4ARRAY
];

/**
 * A WebGL 1 device type.
 *
 * @type {string}
 */
export const DEVICETYPE_WEBGL1 = 'webgl1';

/**
 * A WebGL 2 device type.
 *
 * @type {string}
 */
export const DEVICETYPE_WEBGL2 = 'webgl2';

/**
 * A WebGPU device type.
 *
 * @type {string}
 */
export const DEVICETYPE_WEBGPU = 'webgpu';

// (bit-flags) shader stages for resource visibility on the GPU
export const SHADERSTAGE_VERTEX = 1;
export const SHADERSTAGE_FRAGMENT = 2;
export const SHADERSTAGE_COMPUTE = 4;

// indices of commonly used bind groups
// sorted in a way that any trailing bind groups can be unused in any render pass
export const BINDGROUP_MESH = 0;
export const BINDGROUP_VIEW = 1;

// name of the default uniform buffer slot in a bind group
export const UNIFORM_BUFFER_DEFAULT_SLOT_NAME = 'default';

// names of bind groups
export const bindGroupNames = ['view', 'mesh'];

// map of engine TYPE_*** enums to their corresponding typed array constructors and byte sizes
export const typedArrayTypes = [Int8Array, Uint8Array, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array];
export const typedArrayTypesByteSize = [1, 1, 2, 2, 4, 4, 4];
export const vertexTypesNames = ['INT8', 'UINT8', 'INT16', 'UINT16', 'INT32', 'UINT32', 'FLOAT32'];

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

// map of engine PIXELFORMAT_*** enums to the pixel byte size
export const pixelFormatByteSizes = [];
pixelFormatByteSizes[PIXELFORMAT_A8] = 1;
pixelFormatByteSizes[PIXELFORMAT_L8] = 1;
pixelFormatByteSizes[PIXELFORMAT_LA8] = 2;
pixelFormatByteSizes[PIXELFORMAT_RGB565] = 2;
pixelFormatByteSizes[PIXELFORMAT_RGBA5551] = 2;
pixelFormatByteSizes[PIXELFORMAT_RGBA4] = 2;
pixelFormatByteSizes[PIXELFORMAT_RGB8] = 4;
pixelFormatByteSizes[PIXELFORMAT_RGBA8] = 4;
pixelFormatByteSizes[PIXELFORMAT_RGB16F] = 8;
pixelFormatByteSizes[PIXELFORMAT_RGBA16F] = 8;
pixelFormatByteSizes[PIXELFORMAT_RGB32F] = 16;
pixelFormatByteSizes[PIXELFORMAT_RGBA32F] = 16;
pixelFormatByteSizes[PIXELFORMAT_R32F] = 4;
pixelFormatByteSizes[PIXELFORMAT_DEPTH] = 4; // can be smaller using WebGL1 extension?
pixelFormatByteSizes[PIXELFORMAT_DEPTHSTENCIL] = 4;
pixelFormatByteSizes[PIXELFORMAT_111110F] = 4;
pixelFormatByteSizes[PIXELFORMAT_SRGB] = 4;
pixelFormatByteSizes[PIXELFORMAT_SRGBA] = 4;

/**
 * Map of engine semantics into location on device in range 0..15 (note - semantics mapping to the
 * same location cannot be used at the same time) organized in a way that ATTR0-ATTR7 do not
 * overlap with common important semantics.
 *
 * @type {object}
 * @ignore
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
 */
export const CHUNKAPI_1_51 = '1.51';
export const CHUNKAPI_1_55 = '1.55';
export const CHUNKAPI_1_56 = '1.56';
export const CHUNKAPI_1_57 = '1.57';
export const CHUNKAPI_1_58 = '1.58';
export const CHUNKAPI_1_60 = '1.60';
