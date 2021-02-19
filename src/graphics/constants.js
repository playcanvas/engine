/**
 * @constant
 * @name ADDRESS_REPEAT
 * @type {number}
 * @description Ignores the integer part of texture coordinates, using only the fractional part.
 */
export const ADDRESS_REPEAT = 0;
/**
 * @constant
 * @name ADDRESS_CLAMP_TO_EDGE
 * @type {number}
 * @description Clamps texture coordinate to the range 0 to 1.
 */
export const ADDRESS_CLAMP_TO_EDGE = 1;
/**
 * @constant
 * @name ADDRESS_MIRRORED_REPEAT
 * @type {number}
 * @description Texture coordinate to be set to the fractional part if the integer part is even. If the integer part is odd,
 * then the texture coordinate is set to 1 minus the fractional part.
 */
export const ADDRESS_MIRRORED_REPEAT = 2;

/**
 * @constant
 * @name BLENDMODE_ZERO
 * @type {number}
 * @description Multiply all fragment components by zero.
 */
export const BLENDMODE_ZERO = 0;
/**
 * @constant
 * @name BLENDMODE_ONE
 * @type {number}
 * @description Multiply all fragment components by one.
 */
export const BLENDMODE_ONE = 1;
/**
 * @constant
 * @name BLENDMODE_SRC_COLOR
 * @type {number}
 * @description Multiply all fragment components by the components of the source fragment.
 */
export const BLENDMODE_SRC_COLOR = 2;
/**
 * @constant
 * @name BLENDMODE_ONE_MINUS_SRC_COLOR
 * @type {number}
 * @description Multiply all fragment components by one minus the components of the source fragment.
 */
export const BLENDMODE_ONE_MINUS_SRC_COLOR = 3;
/**
 * @constant
 * @name BLENDMODE_DST_COLOR
 * @type {number}
 * @description Multiply all fragment components by the components of the destination fragment.
 */
export const BLENDMODE_DST_COLOR = 4;
/**
 * @constant
 * @name BLENDMODE_ONE_MINUS_DST_COLOR
 * @type {number}
 * @description Multiply all fragment components by one minus the components of the destination fragment.
 */
export const BLENDMODE_ONE_MINUS_DST_COLOR = 5;
/**
 * @constant
 * @name BLENDMODE_SRC_ALPHA
 * @type {number}
 * @description Multiply all fragment components by the alpha value of the source fragment.
 */
export const BLENDMODE_SRC_ALPHA = 6;
/**
 * @constant
 * @name BLENDMODE_SRC_ALPHA_SATURATE
 * @type {number}
 * @description Multiply all fragment components by the alpha value of the source fragment.
 */
export const BLENDMODE_SRC_ALPHA_SATURATE = 7;
/**
 * @constant
 * @name BLENDMODE_ONE_MINUS_SRC_ALPHA
 * @type {number}
 * @description Multiply all fragment components by one minus the alpha value of the source fragment.
 */
export const BLENDMODE_ONE_MINUS_SRC_ALPHA = 8;
/**
 * @constant
 * @name BLENDMODE_DST_ALPHA
 * @type {number}
 * @description Multiply all fragment components by the alpha value of the destination fragment.
 */
export const BLENDMODE_DST_ALPHA = 9;
/**
 * @constant
 * @name BLENDMODE_ONE_MINUS_DST_ALPHA
 * @type {number}
 * @description Multiply all fragment components by one minus the alpha value of the destination fragment.
 */
export const BLENDMODE_ONE_MINUS_DST_ALPHA = 10;

/**
 * @constant
 * @name BLENDEQUATION_ADD
 * @type {number}
 * @description Add the results of the source and destination fragment multiplies.
 */
export const BLENDEQUATION_ADD = 0;
/**
 * @constant
 * @name BLENDEQUATION_SUBTRACT
 * @type {number}
 * @description Subtract the results of the source and destination fragment multiplies.
 */
export const BLENDEQUATION_SUBTRACT = 1;
/**
 * @constant
 * @name BLENDEQUATION_REVERSE_SUBTRACT
 * @type {number}
 * @description Reverse and subtract the results of the source and destination fragment multiplies.
 */
export const BLENDEQUATION_REVERSE_SUBTRACT = 2;

/**
 * @constant
 * @name BLENDEQUATION_MIN
 * @type {number}
 * @description Use the smallest value. Check app.graphicsDevice.extBlendMinmax for support.
 */
export const BLENDEQUATION_MIN = 3;
/**
 * @constant
 * @name BLENDEQUATION_MAX
 * @type {number}
 * @description Use the largest value. Check app.graphicsDevice.extBlendMinmax for support.
 */
export const BLENDEQUATION_MAX = 4;

/**
 * @constant
 * @name BUFFER_STATIC
 * @type {number}
 * @description The data store contents will be modified once and used many times.
 */
export const BUFFER_STATIC = 0;
/**
 * @constant
 * @name BUFFER_DYNAMIC
 * @type {number}
 * @description The data store contents will be modified repeatedly and used many times.
 */
export const BUFFER_DYNAMIC = 1;
/**
 * @constant
 * @name BUFFER_STREAM
 * @type {number}
 * @description The data store contents will be modified once and used at most a few times.
 */
export const BUFFER_STREAM = 2;
/**
 * @constant
 * @name BUFFER_GPUDYNAMIC
 * @type {number}
 * @description The data store contents will be modified repeatedly on the GPU and used many times. Optimal for transform feedback usage (WebGL2 only).
 */
export const BUFFER_GPUDYNAMIC = 3;

/**
 * @constant
 * @name CLEARFLAG_COLOR
 * @type {number}
 * @description Clear the color buffer.
 */
export const CLEARFLAG_COLOR = 1;
/**
 * @constant
 * @name CLEARFLAG_DEPTH
 * @type {number}
 * @description Clear the depth buffer.
 */
export const CLEARFLAG_DEPTH = 2;
/**
 * @constant
 * @name CLEARFLAG_STENCIL
 * @type {number}
 * @description Clear the stencil buffer.
 */
export const CLEARFLAG_STENCIL = 4;

/**
 * @constant
 * @name CUBEFACE_POSX
 * @type {number}
 * @description The positive X face of a cubemap.
 */
export const CUBEFACE_POSX = 0;
/**
 * @constant
 * @name CUBEFACE_NEGX
 * @type {number}
 * @description The negative X face of a cubemap.
 */
export const CUBEFACE_NEGX = 1;
/**
 * @constant
 * @name CUBEFACE_POSY
 * @type {number}
 * @description The positive Y face of a cubemap.
 */
export const CUBEFACE_POSY = 2;
/**
 * @constant
 * @name CUBEFACE_NEGY
 * @type {number}
 * @description The negative Y face of a cubemap.
 */
export const CUBEFACE_NEGY = 3;
/**
 * @constant
 * @name CUBEFACE_POSZ
 * @type {number}
 * @description The positive Z face of a cubemap.
 */
export const CUBEFACE_POSZ = 4;
/**
 * @constant
 * @name CUBEFACE_NEGZ
 * @type {number}
 * @description The negative Z face of a cubemap.
 */
export const CUBEFACE_NEGZ = 5;

/**
 * @constant
 * @name CULLFACE_NONE
 * @type {number}
 * @description No triangles are culled.
 */
export const CULLFACE_NONE = 0;
/**
 * @constant
 * @name CULLFACE_BACK
 * @type {number}
 * @description Triangles facing away from the view direction are culled.
 */
export const CULLFACE_BACK = 1;
/**
 * @constant
 * @name CULLFACE_FRONT
 * @type {number}
 * @description Triangles facing the view direction are culled.
 */
export const CULLFACE_FRONT = 2;
/**
 * @constant
 * @name CULLFACE_FRONTANDBACK
 * @type {number}
 * @description Triangles are culled regardless of their orientation with respect to the view
 * direction. Note that point or line primitives are unaffected by this render state.
 */
export const CULLFACE_FRONTANDBACK = 3;

/**
 * @constant
 * @name FILTER_NEAREST
 * @type {number}
 * @description Point sample filtering.
 */
export const FILTER_NEAREST = 0;
/**
 * @constant
 * @name FILTER_LINEAR
 * @type {number}
 * @description Bilinear filtering.
 */
export const FILTER_LINEAR = 1;
/**
 * @constant
 * @name FILTER_NEAREST_MIPMAP_NEAREST
 * @type {number}
 * @description Use the nearest neighbor in the nearest mipmap level.
 */
export const FILTER_NEAREST_MIPMAP_NEAREST = 2;
/**
 * @constant
 * @name FILTER_NEAREST_MIPMAP_LINEAR
 * @type {number}
 * @description Linearly interpolate in the nearest mipmap level.
 */
export const FILTER_NEAREST_MIPMAP_LINEAR = 3;
/**
 * @constant
 * @name FILTER_LINEAR_MIPMAP_NEAREST
 * @type {number}
 * @description Use the nearest neighbor after linearly interpolating between mipmap levels.
 */
export const FILTER_LINEAR_MIPMAP_NEAREST = 4;
/**
 * @constant
 * @name FILTER_LINEAR_MIPMAP_LINEAR
 * @type {number}
 * @description Linearly interpolate both the mipmap levels and between texels.
 */
export const FILTER_LINEAR_MIPMAP_LINEAR = 5;

/**
 * @constant
 * @name FUNC_NEVER
 * @type {number}
 * @description Never pass.
 */
export const FUNC_NEVER = 0;
/**
 * @constant
 * @name FUNC_LESS
 * @type {number}
 * @description Pass if (ref & mask) < (stencil & mask).
 */
export const FUNC_LESS = 1;
/**
 * @constant
 * @name FUNC_EQUAL
 * @type {number}
 * @description Pass if (ref & mask) == (stencil & mask).
 */
export const FUNC_EQUAL = 2;
/**
 * @constant
 * @name FUNC_LESSEQUAL
 * @type {number}
 * @description Pass if (ref & mask) <= (stencil & mask).
 */
export const FUNC_LESSEQUAL = 3;
/**
 * @constant
 * @name FUNC_GREATER
 * @type {number}
 * @description Pass if (ref & mask) > (stencil & mask).
 */
export const FUNC_GREATER = 4;
/**
 * @constant
 * @name FUNC_NOTEQUAL
 * @type {number}
 * @description Pass if (ref & mask) != (stencil & mask).
 */
export const FUNC_NOTEQUAL = 5;
/**
 * @constant
 * @name FUNC_GREATEREQUAL
 * @type {number}
 * @description Pass if (ref & mask) >= (stencil & mask).
 */
export const FUNC_GREATEREQUAL = 6;
/**
 * @constant
 * @name FUNC_ALWAYS
 * @type {number}
 * @description Always pass.
 */
export const FUNC_ALWAYS = 7;

/**
 * @constant
 * @name INDEXFORMAT_UINT8
 * @type {number}
 * @description 8-bit unsigned vertex indices (0 to 255).
 */
export const INDEXFORMAT_UINT8 = 0;
/**
 * @constant
 * @name INDEXFORMAT_UINT16
 * @type {number}
 * @description 16-bit unsigned vertex indices (0 to 65,535).
 */
export const INDEXFORMAT_UINT16 = 1;
/**
 * @constant
 * @name INDEXFORMAT_UINT32
 * @type {number}
 * @description 32-bit unsigned vertex indices (0 to 4,294,967,295).
 */
export const INDEXFORMAT_UINT32 = 2;

/**
 * @constant
 * @name PIXELFORMAT_A8
 * @type {number}
 * @description 8-bit alpha.
 */
export const PIXELFORMAT_A8 = 0;
/**
 * @constant
 * @name PIXELFORMAT_L8
 * @type {number}
 * @description 8-bit luminance.
 */
export const PIXELFORMAT_L8 = 1;
/**
 * @constant
 * @name PIXELFORMAT_L8_A8
 * @type {number}
 * @description 8-bit luminance with 8-bit alpha.
 */
export const PIXELFORMAT_L8_A8 = 2;
/**
 * @constant
 * @name PIXELFORMAT_R5_G6_B5
 * @type {number}
 * @description 16-bit RGB (5-bits for red channel, 6 for green and 5 for blue).
 */
export const PIXELFORMAT_R5_G6_B5 = 3;
/**
 * @constant
 * @name PIXELFORMAT_R5_G5_B5_A1
 * @type {number}
 * @description 16-bit RGBA (5-bits for red channel, 5 for green, 5 for blue with 1-bit alpha).
 */
export const PIXELFORMAT_R5_G5_B5_A1 = 4;
/**
 * @constant
 * @name PIXELFORMAT_R4_G4_B4_A4
 * @type {number}
 * @description 16-bit RGBA (4-bits for red channel, 4 for green, 4 for blue with 4-bit alpha).
 */
export const PIXELFORMAT_R4_G4_B4_A4 = 5;
/**
 * @constant
 * @name PIXELFORMAT_R8_G8_B8
 * @type {number}
 * @description 24-bit RGB (8-bits for red channel, 8 for green and 8 for blue).
 */
export const PIXELFORMAT_R8_G8_B8 = 6;
/**
 * @constant
 * @name PIXELFORMAT_R8_G8_B8_A8
 * @type {number}
 * @description 32-bit RGBA (8-bits for red channel, 8 for green, 8 for blue with 8-bit alpha).
 */
export const PIXELFORMAT_R8_G8_B8_A8 = 7;
/**
 * @constant
 * @name PIXELFORMAT_DXT1
 * @type {number}
 * @description Block compressed format storing 16 input pixels in 64 bits of output, consisting of two 16-bit RGB 5:6:5 color values and a 4x4 two bit lookup table.
 */
export const PIXELFORMAT_DXT1 = 8;
/**
 * @constant
 * @name PIXELFORMAT_DXT3
 * @type {number}
 * @description Block compressed format storing 16 input pixels (corresponding to a 4x4 pixel block) into 128 bits of output, consisting of 64 bits of alpha channel data (4 bits for each pixel) followed by 64 bits of color data; encoded the same way as DXT1.
 */
export const PIXELFORMAT_DXT3 = 9;
/**
 * @constant
 * @name PIXELFORMAT_DXT5
 * @type {number}
 * @description Block compressed format storing 16 input pixels into 128 bits of output, consisting of 64 bits of alpha channel data (two 8 bit alpha values and a 4x4 3 bit lookup table) followed by 64 bits of color data (encoded the same way as DXT1).
 */
export const PIXELFORMAT_DXT5 = 10;
/**
 * @constant
 * @name PIXELFORMAT_RGB16F
 * @type {number}
 * @description 16-bit floating point RGB (16-bit float for each red, green and blue channels).
 */
export const PIXELFORMAT_RGB16F = 11;
/**
 * @constant
 * @name PIXELFORMAT_RGBA16F
 * @type {number}
 * @description 16-bit floating point RGBA (16-bit float for each red, green, blue and alpha channels).
 */
export const PIXELFORMAT_RGBA16F = 12;
/**
 * @constant
 * @name PIXELFORMAT_RGB32F
 * @type {number}
 * @description 32-bit floating point RGB (32-bit float for each red, green and blue channels).
 */
export const PIXELFORMAT_RGB32F = 13;
/**
 * @constant
 * @name PIXELFORMAT_RGBA32F
 * @type {number}
 * @description 32-bit floating point RGBA (32-bit float for each red, green, blue and alpha channels).
 */
export const PIXELFORMAT_RGBA32F = 14;

/**
 * @constant
 * @name PIXELFORMAT_R32F
 * @type {number}
 * @description 32-bit floating point single channel format (WebGL2 only).
 */
export const PIXELFORMAT_R32F = 15;

/**
 * @constant
 * @name PIXELFORMAT_DEPTH
 * @type {number}
 * @description A readable depth buffer format.
 */
export const PIXELFORMAT_DEPTH = 16;

/**
 * @constant
 * @name PIXELFORMAT_DEPTHSTENCIL
 * @type {number}
 * @description A readable depth/stencil buffer format (WebGL2 only).
 */
export const PIXELFORMAT_DEPTHSTENCIL = 17;

/**
 * @constant
 * @name PIXELFORMAT_111110F
 * @type {number}
 * @description A floating-point color-only format with 11 bits for red and green channels and 10 bits for the blue channel (WebGL2 only).
 */
export const PIXELFORMAT_111110F = 18;

/**
 * @constant
 * @name PIXELFORMAT_SRGB
 * @type {number}
 * @description Color-only sRGB format (WebGL2 only).
 */
export const PIXELFORMAT_SRGB = 19;

/**
 * @constant
 * @name PIXELFORMAT_SRGBA
 * @type {number}
 * @description Color sRGB format with additional alpha channel (WebGL2 only).
 */
export const PIXELFORMAT_SRGBA = 20;

/**
 * @constant
 * @name PIXELFORMAT_ETC1
 * @type {number}
 * @description ETC1 compressed format.
 */
export const PIXELFORMAT_ETC1 = 21;

/**
 * @constant
 * @name PIXELFORMAT_ETC2_RGB
 * @type {number}
 * @description ETC2 (RGB) compressed format.
 */
export const PIXELFORMAT_ETC2_RGB = 22;

/**
 * @constant
 * @name PIXELFORMAT_ETC2_RGBA
 * @type {number}
 * @description ETC2 (RGBA) compressed format.
 */
export const PIXELFORMAT_ETC2_RGBA = 23;

/**
 * @constant
 * @name PIXELFORMAT_PVRTC_2BPP_RGB_1
 * @type {number}
 * @description PVRTC (2BPP RGB) compressed format.
 */
export const PIXELFORMAT_PVRTC_2BPP_RGB_1 = 24;

/**
 * @constant
 * @name PIXELFORMAT_PVRTC_2BPP_RGBA_1
 * @type {number}
 * @description PVRTC (2BPP RGBA) compressed format.
 */
export const PIXELFORMAT_PVRTC_2BPP_RGBA_1 = 25;

/**
 * @constant
 * @name PIXELFORMAT_PVRTC_4BPP_RGB_1
 * @type {number}
 * @description PVRTC (4BPP RGB) compressed format.
 */
export const PIXELFORMAT_PVRTC_4BPP_RGB_1 = 26;

/**
 * @constant
 * @name PIXELFORMAT_PVRTC_4BPP_RGBA_1
 * @type {number}
 * @description PVRTC (4BPP RGBA) compressed format.
 */
export const PIXELFORMAT_PVRTC_4BPP_RGBA_1 = 27;

/**
 * @constant
 * @name PIXELFORMAT_ASTC_4x4
 * @type {number}
 * @description ATC compressed format with alpha channel in blocks of 4x4.
 */
export const PIXELFORMAT_ASTC_4x4 = 28;

/**
 * @constant
 * @name PIXELFORMAT_ATC_RGB
 * @type {number}
 * @description ATC compressed format with no alpha channel.
 */
export const PIXELFORMAT_ATC_RGB = 29;

/**
 * @constant
 * @name PIXELFORMAT_ATC_RGBA
 * @type {number}
 * @description ATC compressed format with alpha channel.
 */
export const PIXELFORMAT_ATC_RGBA = 30;

// only add compressed formats next

/**
 * @constant
 * @name PRIMITIVE_POINTS
 * @type {number}
 * @description List of distinct points.
 */
export const PRIMITIVE_POINTS = 0;
/**
 * @constant
 * @name PRIMITIVE_LINES
 * @type {number}
 * @description Discrete list of line segments.
 */
export const PRIMITIVE_LINES = 1;
/**
 * @constant
 * @name PRIMITIVE_LINELOOP
 * @type {number}
 * @description List of points that are linked sequentially by line segments, with a closing line segment between the last and first points.
 */
export const PRIMITIVE_LINELOOP = 2;
/**
 * @constant
 * @name PRIMITIVE_LINESTRIP
 * @type {number}
 * @description List of points that are linked sequentially by line segments.
 */
export const PRIMITIVE_LINESTRIP = 3;
/**
 * @constant
 * @name PRIMITIVE_TRIANGLES
 * @type {number}
 * @description Discrete list of triangles.
 */
export const PRIMITIVE_TRIANGLES = 4;
/**
 * @constant
 * @name PRIMITIVE_TRISTRIP
 * @type {number}
 * @description Connected strip of triangles where a specified vertex forms a triangle using the previous two.
 */
export const PRIMITIVE_TRISTRIP = 5;
/**
 * @constant
 * @name PRIMITIVE_TRIFAN
 * @type {number}
 * @description Connected fan of triangles where the first vertex forms triangles with the following pairs of vertices.
 */
export const PRIMITIVE_TRIFAN = 6;

/**
 * @constant
 * @name SEMANTIC_POSITION
 * @type {string}
 * @description Vertex attribute to be treated as a position.
 */
export const SEMANTIC_POSITION = "POSITION";
/**
 * @constant
 * @name SEMANTIC_NORMAL
 * @type {string}
 * @description Vertex attribute to be treated as a normal.
 */
export const SEMANTIC_NORMAL = "NORMAL";
/**
 * @constant
 * @name SEMANTIC_TANGENT
 * @type {string}
 * @description Vertex attribute to be treated as a tangent.
 */
export const SEMANTIC_TANGENT = "TANGENT";
/**
 * @constant
 * @name SEMANTIC_BLENDWEIGHT
 * @type {string}
 * @description Vertex attribute to be treated as skin blend weights.
 */
export const SEMANTIC_BLENDWEIGHT = "BLENDWEIGHT";
/**
 * @constant
 * @name SEMANTIC_BLENDINDICES
 * @type {string}
 * @description Vertex attribute to be treated as skin blend indices.
 */
export const SEMANTIC_BLENDINDICES = "BLENDINDICES";
/**
 * @constant
 * @name SEMANTIC_COLOR
 * @type {string}
 * @description Vertex attribute to be treated as a color.
 */
export const SEMANTIC_COLOR = "COLOR";

// private semantic used for programatic construction of individual texcoord semantics
export const SEMANTIC_TEXCOORD = "TEXCOORD";

/**
 * @constant
 * @name SEMANTIC_TEXCOORD0
 * @type {string}
 * @description Vertex attribute to be treated as a texture coordinate (set 0).
 */
export const SEMANTIC_TEXCOORD0 = "TEXCOORD0";
/**
 * @constant
 * @name SEMANTIC_TEXCOORD1
 * @type {string}
 * @description Vertex attribute to be treated as a texture coordinate (set 1).
 */
export const SEMANTIC_TEXCOORD1 = "TEXCOORD1";
/**
 * @constant
 * @name SEMANTIC_TEXCOORD2
 * @type {string}
 * @description Vertex attribute to be treated as a texture coordinate (set 2).
 */
export const SEMANTIC_TEXCOORD2 = "TEXCOORD2";
/**
 * @constant
 * @name SEMANTIC_TEXCOORD3
 * @type {string}
 * @description Vertex attribute to be treated as a texture coordinate (set 3).
 */
export const SEMANTIC_TEXCOORD3 = "TEXCOORD3";
/**
 * @constant
 * @name SEMANTIC_TEXCOORD4
 * @type {string}
 * @description Vertex attribute to be treated as a texture coordinate (set 4).
 */
export const SEMANTIC_TEXCOORD4 = "TEXCOORD4";
/**
 * @constant
 * @name SEMANTIC_TEXCOORD5
 * @type {string}
 * @description Vertex attribute to be treated as a texture coordinate (set 5).
 */
export const SEMANTIC_TEXCOORD5 = "TEXCOORD5";
/**
 * @constant
 * @name SEMANTIC_TEXCOORD6
 * @type {string}
 * @description Vertex attribute to be treated as a texture coordinate (set 6).
 */
export const SEMANTIC_TEXCOORD6 = "TEXCOORD6";
/**
 * @constant
 * @name SEMANTIC_TEXCOORD7
 * @type {string}
 * @description Vertex attribute to be treated as a texture coordinate (set 7).
 */
export const SEMANTIC_TEXCOORD7 = "TEXCOORD7";

// private semantic used for programatic construction of individual attr semantics
export const SEMANTIC_ATTR = "ATTR";

/**
 * @constant
 * @name SEMANTIC_ATTR0
 * @type {string}
 * @description Vertex attribute with a user defined semantic.
 */
export const SEMANTIC_ATTR0 = "ATTR0";
/**
 * @constant
 * @name SEMANTIC_ATTR1
 * @type {string}
 * @description Vertex attribute with a user defined semantic.
 */
export const SEMANTIC_ATTR1 = "ATTR1";
/**
 * @constant
 * @name SEMANTIC_ATTR2
 * @type {string}
 * @description Vertex attribute with a user defined semantic.
 */
export const SEMANTIC_ATTR2 = "ATTR2";
/**
 * @constant
 * @name SEMANTIC_ATTR3
 * @type {string}
 * @description Vertex attribute with a user defined semantic.
 */
export const SEMANTIC_ATTR3 = "ATTR3";
/**
 * @constant
 * @name SEMANTIC_ATTR4
 * @type {string}
 * @description Vertex attribute with a user defined semantic.
 */
export const SEMANTIC_ATTR4 = "ATTR4";
/**
 * @constant
 * @name SEMANTIC_ATTR5
 * @type {string}
 * @description Vertex attribute with a user defined semantic.
 */
export const SEMANTIC_ATTR5 = "ATTR5";
/**
 * @constant
 * @name SEMANTIC_ATTR6
 * @type {string}
 * @description Vertex attribute with a user defined semantic.
 */
export const SEMANTIC_ATTR6 = "ATTR6";
/**
 * @constant
 * @name SEMANTIC_ATTR7
 * @type {string}
 * @description Vertex attribute with a user defined semantic.
 */
export const SEMANTIC_ATTR7 = "ATTR7";
/**
 * @constant
 * @name SEMANTIC_ATTR8
 * @type {string}
 * @description Vertex attribute with a user defined semantic.
 */
export const SEMANTIC_ATTR8 = "ATTR8";
/**
 * @constant
 * @name SEMANTIC_ATTR9
 * @type {string}
 * @description Vertex attribute with a user defined semantic.
 */
export const SEMANTIC_ATTR9 = "ATTR9";
/**
 * @constant
 * @name SEMANTIC_ATTR10
 * @type {string}
 * @description Vertex attribute with a user defined semantic.
 */
export const SEMANTIC_ATTR10 = "ATTR10";
/**
 * @constant
 * @name SEMANTIC_ATTR11
 * @type {string}
 * @description Vertex attribute with a user defined semantic.
 */
export const SEMANTIC_ATTR11 = "ATTR11";
/**
 * @constant
 * @name SEMANTIC_ATTR12
 * @type {string}
 * @description Vertex attribute with a user defined semantic.
 */
export const SEMANTIC_ATTR12 = "ATTR12";
/**
 * @constant
 * @name SEMANTIC_ATTR13
 * @type {string}
 * @description Vertex attribute with a user defined semantic.
 */
export const SEMANTIC_ATTR13 = "ATTR13";
/**
 * @constant
 * @name SEMANTIC_ATTR14
 * @type {string}
 * @description Vertex attribute with a user defined semantic.
 */
export const SEMANTIC_ATTR14 = "ATTR14";
/**
 * @constant
 * @name SEMANTIC_ATTR15
 * @type {string}
 * @description Vertex attribute with a user defined semantic.
 */
export const SEMANTIC_ATTR15 = "ATTR15";

export const SHADERTAG_MATERIAL = 1;

/**
 * @constant
 * @name STENCILOP_KEEP
 * @type {number}
 * @description Don't change the stencil buffer value.
 */
export const STENCILOP_KEEP = 0;
/**
 * @constant
 * @name STENCILOP_ZERO
 * @type {number}
 * @description Set value to zero.
 */
export const STENCILOP_ZERO = 1;
/**
 * @constant
 * @name STENCILOP_REPLACE
 * @type {number}
 * @description Replace value with the reference value (see {@link GraphicsDevice#setStencilFunc}).
 */
export const STENCILOP_REPLACE = 2;
/**
 * @constant
 * @name STENCILOP_INCREMENT
 * @type {number}
 * @description Increment the value.
 */
export const STENCILOP_INCREMENT = 3;
/**
 * @constant
 * @name STENCILOP_INCREMENTWRAP
 * @type {number}
 * @description Increment the value but wrap it to zero when it's larger than a maximum representable value.
 */
export const STENCILOP_INCREMENTWRAP = 4;
/**
 * @constant
 * @name STENCILOP_DECREMENT
 * @type {number}
 * @description Decrement the value.
 */
export const STENCILOP_DECREMENT = 5;
/**
 * @constant
 * @name STENCILOP_DECREMENTWRAP
 * @type {number}
 * @description Decrement the value but wrap it to a maximum representable value if the current value is 0.
 */
export const STENCILOP_DECREMENTWRAP = 6;
/**
 * @constant
 * @name STENCILOP_INVERT
 * @type {number}
 * @description Invert the value bitwise.
 */
export const STENCILOP_INVERT = 7;

/**
 * @constant
 * @name TEXTURELOCK_READ
 * @type {number}
 * @description Read only. Any changes to the locked mip level's pixels will not update the texture.
 */
export const TEXTURELOCK_READ = 1;
/**
 * @constant
 * @name TEXTURELOCK_WRITE
 * @type {number}
 * @description Write only. The contents of the specified mip level will be entirely replaced.
 */
export const TEXTURELOCK_WRITE = 2;

/**
 * @constant
 * @name TEXTURETYPE_DEFAULT
 * @type {string}
 * @description Texture is a default type.
 */
export const TEXTURETYPE_DEFAULT = 'default';

/**
 * @constant
 * @name TEXTURETYPE_RGBM
 * @type {string}
 * @description Texture stores high dynamic range data in RGBM format
 */
export const TEXTURETYPE_RGBM = 'rgbm';

/**
 * @constant
 * @name TEXTURETYPE_RGBE
 * @type {string}
 * @description Texture stores high dynamic range data in RGBE format
 */
export const TEXTURETYPE_RGBE = 'rgbe';

/**
 * @constant
 * @name TEXTURETYPE_SWIZZLEGGGR
 * @type {string}
 * @description Texture stores normalmap data swizzled in GGGR format. This is used for tangent space normal
 * maps. The R component is stored in alpha and G is stored in RGB. This packing can result in higher quality
 * when the texture data is compressed.
 */
export const TEXTURETYPE_SWIZZLEGGGR = 'swizzleGGGR';

export const TEXHINT_NONE = 0;
export const TEXHINT_SHADOWMAP = 1;
export const TEXHINT_ASSET = 2;
export const TEXHINT_LIGHTMAP = 3;

/**
 * @constant
 * @name TEXTUREPROJECTION_CUBE
 * @type {number}
 * @description Texture data is stored in cubemap projection format.
 */
export const TEXTUREPROJECTION_CUBE = "cube";

/**
 * @constant
 * @name TEXTUREPROJECTION_EQUIRECT
 * @type {number}
 * @description Texture data is stored in equirectangular projection format.
 */
export const TEXTUREPROJECTION_EQUIRECT = "equirect";

/**
 * @constant
 * @name TEXTUREPROJECTION_OCTAHEDRAL
 * @type {number}
 * @description Texture data is stored in octahedral projection format.
 */
export const TEXTUREPROJECTION_OCTAHEDRAL = "octahedral";

/**
 * @constant
 * @name TYPE_INT8
 * @type {number}
 * @description Signed byte vertex element type.
 */
export const TYPE_INT8 = 0;
/**
 * @constant
 * @name TYPE_UINT8
 * @type {number}
 * @description Unsigned byte vertex element type.
 */
export const TYPE_UINT8 = 1;
/**
 * @constant
 * @name TYPE_INT16
 * @type {number}
 * @description Signed short vertex element type.
 */
export const TYPE_INT16 = 2;
/**
 * @constant
 * @name TYPE_UINT16
 * @type {number}
 * @description Unsigned short vertex element type.
 */
export const TYPE_UINT16 = 3;
/**
 * @constant
 * @name TYPE_INT32
 * @type {number}
 * @description Signed integer vertex element type.
 */
export const TYPE_INT32 = 4;
/**
 * @constant
 * @name TYPE_UINT32
 * @type {number}
 * @description Unsigned integer vertex element type.
 */
export const TYPE_UINT32 = 5;
/**
 * @constant
 * @name TYPE_FLOAT32
 * @type {number}
 * @description Floating point vertex element type.
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

// map of engine TYPE_*** enums to their corresponding typed array constructors and byte sizes
export const typedArrayTypes = [Int8Array, Uint8Array, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array];
export const typedArrayTypesByteSize = [1, 1, 2, 2, 4, 4, 4];

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

// map of engine semantics into location on device in range 0..15 (note - semantics mapping to
// the same location cannot be used at the same time)
// organized in a way that ATTR0-ATTR7 do not overlap with common important semantics
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
