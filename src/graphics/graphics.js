(function () {
    // Graphics engine enums
    var enums = {
        /**
         * @static
         * @readonly
         * @type Number
         * @name pc.ADDRESS_REPEAT
         * @description Ignores the integer part of texture coordinates, using only the fractional part.
         */
        ADDRESS_REPEAT: 0,
        /**
         * @static
         * @readonly
         * @type Number
         * @name pc.ADDRESS_CLAMP_TO_EDGE
         * @description Clamps texture coordinate to the range 0 to 1.
         */
        ADDRESS_CLAMP_TO_EDGE: 1,
        /**
         * @static
         * @readonly
         * @type Number
         * @name pc.ADDRESS_MIRRORED_REPEAT
         * @description Texture coordinate to be set to the fractional part if the integer part is even; if the integer part is odd,
         * then the texture coordinate is set to 1 minus the fractional part.
         */
        ADDRESS_MIRRORED_REPEAT: 2,

        /**
         * @enum pc.BLENDMODE
         * @name pc.BLENDMODE_ZERO
         * @description Multiply all fragment components by zero.
         */
        BLENDMODE_ZERO: 0,
        /**
         * @enum pc.BLENDMODE
         * @name pc.BLENDMODE_ONE
         * @description Multiply all fragment components by one.
         */
        BLENDMODE_ONE: 1,
        /**
         * @enum pc.BLENDMODE
         * @name pc.BLENDMODE_SRC_COLOR
         * @description Multiply all fragment components by the components of the source fragment.
         */
        BLENDMODE_SRC_COLOR: 2,
        /**
         * @enum pc.BLENDMODE
         * @name pc.BLENDMODE_ONE_MINUS_SRC_COLOR
         * @description Multiply all fragment components by one minus the components of the source fragment.
         */
        BLENDMODE_ONE_MINUS_SRC_COLOR: 3,
        /**
         * @enum pc.BLENDMODE
         * @name pc.BLENDMODE_DST_COLOR
         * @description Multiply all fragment components by the components of the destination fragment.
         */
        BLENDMODE_DST_COLOR: 4,
        /**
         * @enum pc.BLENDMODE
         * @name pc.BLENDMODE_ONE_MINUS_DST_COLOR
         * @description Multiply all fragment components by one minus the components of the destination fragment.
         */
        BLENDMODE_ONE_MINUS_DST_COLOR: 5,
        /**
         * @enum pc.BLENDMODE
         * @name pc.BLENDMODE_SRC_ALPHA
         * @description Multiply all fragment components by the alpha value of the source fragment.
         */
        BLENDMODE_SRC_ALPHA: 6,
        /**
         * @enum pc.BLENDMODE
         * @name pc.BLENDMODE_SRC_ALPHA_SATURATE
         * @description Multiply all fragment components by the alpha value of the source fragment.
         */
        BLENDMODE_SRC_ALPHA_SATURATE: 7,
        /**
         * @enum pc.BLENDMODE
         * @name pc.BLENDMODE_ONE_MINUS_SRC_ALPHA
         * @description Multiply all fragment components by one minus the alpha value of the source fragment.
         */
        BLENDMODE_ONE_MINUS_SRC_ALPHA: 8,
        /**
         * @enum pc.BLENDMODE
         * @name pc.BLENDMODE_DST_ALPHA
         * @description Multiply all fragment components by the alpha value of the destination fragment.
         */
        BLENDMODE_DST_ALPHA: 9,
        /**
         * @enum pc.BLENDMODE
         * @name pc.BLENDMODE_ONE_MINUS_DST_ALPHA
         * @description Multiply all fragment components by one minus the alpha value of the destination fragment.
         */
        BLENDMODE_ONE_MINUS_DST_ALPHA: 10,

        /**
         * @enum pc.BLENDEQUATION
         * @name pc.BLENDEQUATION_ADD
         * @description Add the results of the source and destination fragment multiplies.
         */
        BLENDEQUATION_ADD: 0,
        /**
         * @enum pc.BLENDEQUATION
         * @name pc.BLENDEQUATION_SUBTRACT
         * @description Subtract the results of the source and destination fragment multiplies.
         */
        BLENDEQUATION_SUBTRACT: 1,
        /**
         * @enum pc.BLENDEQUATION
         * @name pc.BLENDEQUATION_REVERSE_SUBTRACT
         * @description Reverse and subtract the results of the source and destination fragment multiplies.
         */
        BLENDEQUATION_REVERSE_SUBTRACT: 2,

        /**
         * @enum pc.BLENDEQUATION
         * @name pc.BLENDEQUATION_MIN
         * @description Use the smallest value. Check app.graphicsDevice.extBlendMinmax for support.
         */
        BLENDEQUATION_MIN: 3,
        /**
         * @enum pc.BLENDEQUATION
         * @name pc.BLENDEQUATION_MAX
         * @description Use the largest value. Check app.graphicsDevice.extBlendMinmax for support.
         */
        BLENDEQUATION_MAX: 4,

        /**
         * @enum pc.BUFFER
         * @name pc.BUFFER_STATIC
         * @description The data store contents will be modified once and used many times.
         */
        BUFFER_STATIC: 0,
        /**
         * @enum pc.BUFFER
         * @name pc.BUFFER_DYNAMIC
         * @description The data store contents will be modified repeatedly and used many times.
         */
        BUFFER_DYNAMIC: 1,
        /**
         * @enum pc.BUFFER
         * @name pc.BUFFER_STREAM
         * @description The data store contents will be modified once and used at most a few times.
         */
        BUFFER_STREAM: 2,
        /**
         * @enum pc.BUFFER
         * @name pc.BUFFER_GPUDYNAMIC
         * @description The data store contents will be modified repeatedly on the GPU and used many times. Optimal for transform feedback usage (WebGL2 only).
         */
        BUFFER_GPUDYNAMIC: 3,

        /**
         * @enum pc.CLEARFLAG
         * @name pc.CLEARFLAG_COLOR
         * @description Clear the color buffer.
         */
        CLEARFLAG_COLOR: 1,
        /**
         * @enum pc.CLEARFLAG
         * @name pc.CLEARFLAG_DEPTH
         * @description Clear the depth buffer.
         */
        CLEARFLAG_DEPTH: 2,
        /**
         * @enum pc.CLEARFLAG
         * @name pc.CLEARFLAG_STENCIL
         * @description Clear the stencil buffer.
         */
        CLEARFLAG_STENCIL: 4,

        /**
         * @enum pc.CUBEFACE
         * @name pc.CUBEFACE_POSX
         * @description The positive X face of a cubemap.
         */
        CUBEFACE_POSX: 0,
        /**
         * @enum pc.CUBEFACE
         * @name pc.CUBEFACE_NEGX
         * @description The negative X face of a cubemap.
         */
        CUBEFACE_NEGX: 1,
        /**
         * @enum pc.CUBEFACE
         * @name pc.CUBEFACE_POSY
         * @description The positive Y face of a cubemap.
         */
        CUBEFACE_POSY: 2,
        /**
         * @enum pc.CUBEFACE
         * @name pc.CUBEFACE_NEGY
         * @description The negative Y face of a cubemap.
         */
        CUBEFACE_NEGY: 3,
        /**
         * @enum pc.CUBEFACE
         * @name pc.CUBEFACE_POSZ
         * @description The positive Z face of a cubemap.
         */
        CUBEFACE_POSZ: 4,
        /**
         * @enum pc.CUBEFACE
         * @name pc.CUBEFACE_NEGZ
         * @description The negative Z face of a cubemap.
         */
        CUBEFACE_NEGZ: 5,

        /**
         * @enum pc.CULLFACE
         * @name pc.CULLFACE_NONE
         * @description No triangles are culled.
         */
        CULLFACE_NONE: 0,
        /**
         * @enum pc.CULLFACE
         * @name pc.CULLFACE_BACK
         * @description Triangles facing away from the view direction are culled.
         */
        CULLFACE_BACK: 1,
        /**
         * @enum pc.CULLFACE
         * @name pc.CULLFACE_FRONT
         * @description Triangles facing the view direction are culled.
         */
        CULLFACE_FRONT: 2,
        /**
         * @enum pc.CULLFACE
         * @name pc.CULLFACE_FRONTANDBACK
         * @description Triangles are culled regardless of their orientation with respect to the view
         * direction. Note that point or line primitives are unaffected by this render state.
         */
        CULLFACE_FRONTANDBACK: 3,

        /**
         * @enum pc.TYPE
         * @name pc.TYPE_INT8
         * @description Signed byte vertex element type.
         */
        TYPE_INT8: 0,
        /**
         * @enum pc.TYPE
         * @name pc.TYPE_UINT8
         * @description Unsigned byte vertex element type.
         */
        TYPE_UINT8: 1,
        /**
         * @enum pc.TYPE
         * @name pc.TYPE_INT16
         * @description Signed short vertex element type.
         */
        TYPE_INT16: 2,
        /**
         * @enum pc.TYPE
         * @name pc.TYPE_UINT16
         * @description Unsigned short vertex element type.
         */
        TYPE_UINT16: 3,
        /**
         * @enum pc.TYPE
         * @name pc.TYPE_INT32
         * @description Signed integer vertex element type.
         */
        TYPE_INT32: 4,
        /**
         * @enum pc.TYPE
         * @name pc.TYPE_UINT32
         * @description Unsigned integer vertex element type.
         */
        TYPE_UINT32: 5,
        /**
         * @enum pc.TYPE
         * @name pc.TYPE_FLOAT32
         * @description Floating point vertex element type.
         */
        TYPE_FLOAT32: 6,

        /**
         * @enum pc.FILTER
         * @name pc.FILTER_NEAREST
         * @description Point sample filtering.
         */
        FILTER_NEAREST: 0,
        /**
         * @enum pc.FILTER
         * @name pc.FILTER_LINEAR
         * @description Bilinear filtering.
         */
        FILTER_LINEAR: 1,
        /**
         * @enum pc.FILTER
         * @name pc.FILTER_NEAREST_MIPMAP_NEAREST
         * @description Use the nearest neighbor in the nearest mipmap level.
         */
        FILTER_NEAREST_MIPMAP_NEAREST: 2,
        /**
         * @enum pc.FILTER
         * @name pc.FILTER_NEAREST_MIPMAP_LINEAR
         * @description Linearly interpolate in the nearest mipmap level.
         */
        FILTER_NEAREST_MIPMAP_LINEAR: 3,
        /**
         * @enum pc.FILTER
         * @name pc.FILTER_LINEAR_MIPMAP_NEAREST
         * @description Use the nearest neighbor after linearly interpolating between mipmap levels.
         */
        FILTER_LINEAR_MIPMAP_NEAREST: 4,
        /**
         * @enum pc.FILTER
         * @name pc.FILTER_LINEAR_MIPMAP_LINEAR
         * @description Linearly interpolate both the mipmap levels and between texels.
         */
        FILTER_LINEAR_MIPMAP_LINEAR: 5,

        FUNC_NEVER: 0,
        FUNC_LESS: 1,
        FUNC_EQUAL: 2,
        FUNC_LESSEQUAL: 3,
        FUNC_GREATER: 4,
        FUNC_NOTEQUAL: 5,
        FUNC_GREATEREQUAL: 6,
        FUNC_ALWAYS: 7,

        /**
         * @enum pc.INDEXFORMAT
         * @name pc.INDEXFORMAT_UINT8
         * @description 8-bit unsigned vertex indices.
         */
        INDEXFORMAT_UINT8: 0,
        /**
         * @enum pc.INDEXFORMAT
         * @name pc.INDEXFORMAT_UINT16
         * @description 16-bit unsigned vertex indices.
         */
        INDEXFORMAT_UINT16: 1,
        /**
         * @enum pc.INDEXFORMAT
         * @name pc.INDEXFORMAT_UINT32
         * @description 32-bit unsigned vertex indices.
         */
        INDEXFORMAT_UINT32: 2,

        /**
         * @enum pc.PIXELFORMAT
         * @name pc.PIXELFORMAT_A8
         * @description 8-bit alpha.
         */
        PIXELFORMAT_A8: 0,
        /**
         * @enum pc.PIXELFORMAT
         * @name pc.PIXELFORMAT_L8
         * @description 8-bit luminance.
         */
        PIXELFORMAT_L8: 1,
        /**
         * @enum pc.PIXELFORMAT
         * @name pc.PIXELFORMAT_L8_A8
         * @description 8-bit luminance with 8-bit alpha.
         */
        PIXELFORMAT_L8_A8: 2,
        /**
         * @enum pc.PIXELFORMAT
         * @name pc.PIXELFORMAT_R5_G6_B5
         * @description 16-bit RGB (5-bits for red channel, 6 for green and 5 for blue).
         */
        PIXELFORMAT_R5_G6_B5: 3,
        /**
         * @enum pc.PIXELFORMAT
         * @name pc.PIXELFORMAT_R5_G5_B5_A1
         * @description 16-bit RGBA (5-bits for red channel, 5 for green, 5 for blue with 1-bit alpha).
         */
        PIXELFORMAT_R5_G5_B5_A1: 4,
        /**
         * @enum pc.PIXELFORMAT
         * @name pc.PIXELFORMAT_R4_G4_B4_A4
         * @description 16-bit RGBA (4-bits for red channel, 4 for green, 4 for blue with 4-bit alpha).
         */
        PIXELFORMAT_R4_G4_B4_A4: 5,
        /**
         * @enum pc.PIXELFORMAT
         * @name pc.PIXELFORMAT_R8_G8_B8
         * @description 24-bit RGB (8-bits for red channel, 8 for green and 8 for blue).
         */
        PIXELFORMAT_R8_G8_B8: 6,
        /**
         * @enum pc.PIXELFORMAT
         * @name pc.PIXELFORMAT_R8_G8_B8_A8
         * @description 32-bit RGBA (8-bits for red channel, 8 for green, 8 for blue with 8-bit alpha).
         */
        PIXELFORMAT_R8_G8_B8_A8: 7,
        /**
         * @enum pc.PIXELFORMAT
         * @name pc.PIXELFORMAT_DXT1
         * @description Block compressed format, storing 16 input pixels in 64 bits of output, consisting of two 16-bit RGB 5:6:5 color values and a 4x4 two bit lookup table.
         */
        PIXELFORMAT_DXT1: 8,
        /**
         * @enum pc.PIXELFORMAT
         * @name pc.PIXELFORMAT_DXT3
         * @description Block compressed format, storing 16 input pixels (corresponding to a 4x4 pixel block) into 128 bits of output, consisting of 64 bits of alpha channel data (4 bits for each pixel) followed by 64 bits of color data, encoded the same way as DXT1.
         */
        PIXELFORMAT_DXT3: 9,
        /**
         * @enum pc.PIXELFORMAT
         * @name pc.PIXELFORMAT_DXT5
         * @description Block compressed format, storing 16 input pixels into 128 bits of output, consisting of 64 bits of alpha channel data (two 8 bit alpha values and a 4x4 3 bit lookup table) followed by 64 bits of color data (encoded the same way as DXT1).
         */
        PIXELFORMAT_DXT5: 10,
        /**
         * @enum pc.PIXELFORMAT
         * @name pc.PIXELFORMAT_RGB16F
         * @description 16-bit floating point RGB (16-bit float for each red, green and blue channels).
         */
        PIXELFORMAT_RGB16F: 11,
        /**
         * @enum pc.PIXELFORMAT
         * @name pc.PIXELFORMAT_RGBA16F
         * @description 16-bit floating point RGBA (16-bit float for each red, green, blue and alpha channels).
         */
        PIXELFORMAT_RGBA16F: 12,
        /**
         * @enum pc.PIXELFORMAT
         * @name pc.PIXELFORMAT_RGB32F
         * @description 32-bit floating point RGB (32-bit float for each red, green and blue channels).
         */
        PIXELFORMAT_RGB32F: 13,
        /**
         * @enum pc.PIXELFORMAT
         * @name pc.PIXELFORMAT_RGBA32F
         * @description 32-bit floating point RGBA (32-bit float for each red, green, blue and alpha channels).
         */
        PIXELFORMAT_RGBA32F: 14,

        /**
         * @enum pc.PIXELFORMAT
         * @name pc.PIXELFORMAT_R32F
         * @description 32-bit floating point single channel format (WebGL2 only).
         */
        PIXELFORMAT_R32F: 15,

        /**
         * @enum pc.PIXELFORMAT
         * @name pc.PIXELFORMAT_DEPTH
         * @description A readable depth buffer format
         */
        PIXELFORMAT_DEPTH: 16,

        /**
         * @enum pc.PIXELFORMAT
         * @name pc.PIXELFORMAT_DEPTHSTENCIL
         * @description A readable depth/stencil buffer format (WebGL2 only).
         */
        PIXELFORMAT_DEPTHSTENCIL: 17,

        /**
         * @enum pc.PIXELFORMAT
         * @name pc.PIXELFORMAT_111110F
         * @description A floating-point color-only format with 11 bits for red and green channels, and 10 bits for the blue channel (WebGL2 only).
         */
        PIXELFORMAT_111110F: 18,

        /**
         * @enum pc.PIXELFORMAT
         * @name pc.PIXELFORMAT_SRGB
         * @description Color-only sRGB format (WebGL2 only).
         */
        PIXELFORMAT_SRGB: 19,

        /**
         * @enum pc.PIXELFORMAT
         * @name pc.PIXELFORMAT_SRGBA
         * @description Color sRGB format with additional alpha channel (WebGL2 only).
         */
        PIXELFORMAT_SRGBA: 20,

        PIXELFORMAT_ETC1: 21,
        PIXELFORMAT_ETC2_RGB: 22,
        PIXELFORMAT_ETC2_RGBA: 23,
        PIXELFORMAT_PVRTC_2BPP_RGB_1: 24,
        PIXELFORMAT_PVRTC_2BPP_RGBA_1: 25,
        PIXELFORMAT_PVRTC_4BPP_RGB_1: 26,
        PIXELFORMAT_PVRTC_4BPP_RGBA_1: 27,
        // only add compressed formats next

        /**
         * @enum pc.PRIMITIVE
         * @name pc.PRIMITIVE_POINTS
         * @description List of distinct points.
         */
        PRIMITIVE_POINTS: 0,
        /**
         * @enum pc.PRIMITIVE
         * @name pc.PRIMITIVE_LINES
         * @description Discrete list of line segments.
         */
        PRIMITIVE_LINES: 1,
        /**
         * @enum pc.PRIMITIVE
         * @name pc.PRIMITIVE_LINELOOP
         * @description List of points that are linked sequentially by line segments, with a closing line segment between the last and first points.
         */
        PRIMITIVE_LINELOOP: 2,
        /**
         * @enum pc.PRIMITIVE
         * @name pc.PRIMITIVE_LINESTRIP
         * @description List of points that are linked sequentially by line segments.
         */
        PRIMITIVE_LINESTRIP: 3,
        /**
         * @enum pc.PRIMITIVE
         * @name pc.PRIMITIVE_TRIANGLES
         * @description Discrete list of triangles.
         */
        PRIMITIVE_TRIANGLES: 4,
        /**
         * @enum pc.PRIMITIVE
         * @name pc.PRIMITIVE_TRISTRIP
         * @description Connected strip of triangles where a specified vertex forms a triangle using the previous two.
         */
        PRIMITIVE_TRISTRIP: 5,
        /**
         * @enum pc.PRIMITIVE
         * @name pc.PRIMITIVE_TRIFAN
         * @description Connected fan of triangles where the first vertex forms triangles with the following pairs of vertices.
         */
        PRIMITIVE_TRIFAN: 6,

        /**
         * @enum pc.SEMANTIC
         * @name pc.SEMANTIC_POSITION
         * @description Vertex attribute to be treated as a position.
         */
        SEMANTIC_POSITION: "POSITION",
        /**
         * @enum pc.SEMANTIC
         * @name pc.SEMANTIC_NORMAL
         * @description Vertex attribute to be treated as a normal.
         */
        SEMANTIC_NORMAL: "NORMAL",
        /**
         * @enum pc.SEMANTIC
         * @name pc.SEMANTIC_TANGENT
         * @description Vertex attribute to be treated as a tangent.
         */
        SEMANTIC_TANGENT: "TANGENT",
        /**
         * @enum pc.SEMANTIC
         * @name pc.SEMANTIC_BLENDWEIGHT
         * @description Vertex attribute to be treated as skin blend weights.
         */
        SEMANTIC_BLENDWEIGHT: "BLENDWEIGHT",
        /**
         * @enum pc.SEMANTIC
         * @name pc.SEMANTIC_BLENDINDICES
         * @description Vertex attribute to be treated as skin blend indices.
         */
        SEMANTIC_BLENDINDICES: "BLENDINDICES",
        /**
         * @enum pc.SEMANTIC
         * @name pc.SEMANTIC_COLOR
         * @description Vertex attribute to be treated as a color.
         */
        SEMANTIC_COLOR: "COLOR",
        /**
         * @enum pc.SEMANTIC
         * @name pc.SEMANTIC_TEXCOORD0
         * @description Vertex attribute to be treated as a texture coordinate (set 0).
         */
        SEMANTIC_TEXCOORD0: "TEXCOORD0",
        /**
         * @enum pc.SEMANTIC
         * @name pc.SEMANTIC_TEXCOORD1
         * @description Vertex attribute to be treated as a texture coordinate (set 1).
         */
        SEMANTIC_TEXCOORD1: "TEXCOORD1",
        /**
         * @enum pc.SEMANTIC
         * @name pc.SEMANTIC_TEXCOORD2
         * @description Vertex attribute to be treated as a texture coordinate (set 2).
         */
        SEMANTIC_TEXCOORD2: "TEXCOORD2",
        /**
         * @enum pc.SEMANTIC
         * @name pc.SEMANTIC_TEXCOORD3
         * @description Vertex attribute to be treated as a texture coordinate (set 3).
         */
        SEMANTIC_TEXCOORD3: "TEXCOORD3",
        /**
         * @enum pc.SEMANTIC
         * @name pc.SEMANTIC_TEXCOORD4
         * @description Vertex attribute to be treated as a texture coordinate (set 4).
         */
        SEMANTIC_TEXCOORD4: "TEXCOORD4",
        /**
         * @enum pc.SEMANTIC
         * @name pc.SEMANTIC_TEXCOORD5
         * @description Vertex attribute to be treated as a texture coordinate (set 5).
         */
        SEMANTIC_TEXCOORD5: "TEXCOORD5",
        /**
         * @enum pc.SEMANTIC
         * @name pc.SEMANTIC_TEXCOORD6
         * @description Vertex attribute to be treated as a texture coordinate (set 6).
         */
        SEMANTIC_TEXCOORD6: "TEXCOORD6",
        /**
         * @enum pc.SEMANTIC
         * @name pc.SEMANTIC_TEXCOORD7
         * @description Vertex attribute to be treated as a texture coordinate (set 7).
         */
        SEMANTIC_TEXCOORD7: "TEXCOORD7",
        /**
         * @enum pc.SEMANTIC
         * @name pc.SEMANTIC_ATTR0
         * @description Vertex attribute with a user defined semantic.
         */
        SEMANTIC_ATTR0: "ATTR0",
        /**
         * @enum pc.SEMANTIC
         * @name pc.SEMANTIC_ATTR1
         * @description Vertex attribute with a user defined semantic.
         */
        SEMANTIC_ATTR1: "ATTR1",
        /**
         * @enum pc.SEMANTIC
         * @name pc.SEMANTIC_ATTR2
         * @description Vertex attribute with a user defined semantic.
         */
        SEMANTIC_ATTR2: "ATTR2",
        /**
         * @enum pc.SEMANTIC
         * @name pc.SEMANTIC_ATTR3
         * @description Vertex attribute with a user defined semantic.
         */
        SEMANTIC_ATTR3: "ATTR3",
        /**
         * @enum pc.SEMANTIC
         * @name pc.SEMANTIC_ATTR4
         * @description Vertex attribute with a user defined semantic.
         */
        SEMANTIC_ATTR4: "ATTR4",
        /**
         * @enum pc.SEMANTIC
         * @name pc.SEMANTIC_ATTR5
         * @description Vertex attribute with a user defined semantic.
         */
        SEMANTIC_ATTR5: "ATTR5",
        /**
         * @enum pc.SEMANTIC
         * @name pc.SEMANTIC_ATTR6
         * @description Vertex attribute with a user defined semantic.
         */
        SEMANTIC_ATTR6: "ATTR6",
        /**
         * @enum pc.SEMANTIC
         * @name pc.SEMANTIC_ATTR7
         * @description Vertex attribute with a user defined semantic.
         */
        SEMANTIC_ATTR7: "ATTR7",
        /**
         * @enum pc.SEMANTIC
         * @name pc.SEMANTIC_ATTR8
         * @description Vertex attribute with a user defined semantic.
         */
        SEMANTIC_ATTR8: "ATTR8",
        /**
         * @enum pc.SEMANTIC
         * @name pc.SEMANTIC_ATTR9
         * @description Vertex attribute with a user defined semantic.
         */
        SEMANTIC_ATTR9: "ATTR9",
        /**
         * @enum pc.SEMANTIC
         * @name pc.SEMANTIC_ATTR10
         * @description Vertex attribute with a user defined semantic.
         */
        SEMANTIC_ATTR10: "ATTR10",
        /**
         * @enum pc.SEMANTIC
         * @name pc.SEMANTIC_ATTR11
         * @description Vertex attribute with a user defined semantic.
         */
        SEMANTIC_ATTR11: "ATTR11",
        /**
         * @enum pc.SEMANTIC
         * @name pc.SEMANTIC_ATTR12
         * @description Vertex attribute with a user defined semantic.
         */
        SEMANTIC_ATTR12: "ATTR12",
        /**
         * @enum pc.SEMANTIC
         * @name pc.SEMANTIC_ATTR13
         * @description Vertex attribute with a user defined semantic.
         */
        SEMANTIC_ATTR13: "ATTR13",
        /**
         * @enum pc.SEMANTIC
         * @name pc.SEMANTIC_ATTR14
         * @description Vertex attribute with a user defined semantic.
         */
        SEMANTIC_ATTR14: "ATTR14",
        /**
         * @enum pc.SEMANTIC
         * @name pc.SEMANTIC_ATTR15
         * @description Vertex attribute with a user defined semantic.
         */
        SEMANTIC_ATTR15: "ATTR15",

        SHADERTAG_MATERIAL: 1,

        STENCILOP_KEEP: 0,
        STENCILOP_ZERO: 1,
        STENCILOP_REPLACE: 2,
        STENCILOP_INCREMENT: 3,
        STENCILOP_INCREMENTWRAP: 4,
        STENCILOP_DECREMENT: 5,
        STENCILOP_DECREMENTWRAP: 6,
        STENCILOP_INVERT: 7,

        /**
         * @enum pc.TEXTURELOCK
         * @name pc.TEXTURELOCK_READ
         * @description Read only. Any changes to the locked mip level's pixels will not update the texture.
         */
        TEXTURELOCK_READ: 1,
        /**
         * @enum pc.TEXTURELOCK
         * @name pc.TEXTURELOCK_WRITE
         * @description Write only. The contents of the specified mip level will be entirely replaced.
         */
        TEXTURELOCK_WRITE: 2,

        TEXHINT_NONE: 0,
        TEXHINT_SHADOWMAP: 1,
        TEXHINT_ASSET: 2,
        TEXHINT_LIGHTMAP: 3,

        UNIFORMTYPE_BOOL: 0,
        UNIFORMTYPE_INT: 1,
        UNIFORMTYPE_FLOAT: 2,
        UNIFORMTYPE_VEC2: 3,
        UNIFORMTYPE_VEC3: 4,
        UNIFORMTYPE_VEC4: 5,
        UNIFORMTYPE_IVEC2: 6,
        UNIFORMTYPE_IVEC3: 7,
        UNIFORMTYPE_IVEC4: 8,
        UNIFORMTYPE_BVEC2: 9,
        UNIFORMTYPE_BVEC3: 10,
        UNIFORMTYPE_BVEC4: 11,
        UNIFORMTYPE_MAT2: 12,
        UNIFORMTYPE_MAT3: 13,
        UNIFORMTYPE_MAT4: 14,
        UNIFORMTYPE_TEXTURE2D: 15,
        UNIFORMTYPE_TEXTURECUBE: 16,
        UNIFORMTYPE_FLOATARRAY: 17,
        UNIFORMTYPE_TEXTURE2D_SHADOW: 18,
        UNIFORMTYPE_TEXTURECUBE_SHADOW: 19,
        UNIFORMTYPE_TEXTURE3D: 20
    };

    Object.assign(pc, enums);

    // For backwards compatibility
    pc.gfx = {};
    Object.assign(pc.gfx, enums);
}());
