/**
 * @namespace Low-level Graphics API
 * @name pc.gfx
 */
pc.gfx = {
    /**
     * @enum pc.gfx.ADDRESS
     * @name pc.gfx.ADDRESS_REPEAT
     * @description Ignores the integer part of texture coordinates, using only the fractional part.
     */
    ADDRESS_REPEAT: 0,
    /**
     * @enum pc.gfx.ADDRESS
     * @name pc.gfx.ADDRESS_CLAMP_TO_EDGE
     * @description Clamps texture coordinate to the range 0 to 1.
     */
    ADDRESS_CLAMP_TO_EDGE: 1,
    /**
     * @enum pc.gfx.ADDRESS
     * @name pc.gfx.ADDRESS_MIRRORED_REPEAT
     * @description Texture coordinate to be set to the fractional part if the integer part is even; if the integer part is odd,
     * then the texture coordinate is set to 1 minus the fractional part.
     */
    ADDRESS_MIRRORED_REPEAT: 2,

    /**
     * @enum pc.gfx.BLENDMODE
     * @name pc.gfx.BLENDMODE_ZERO
     * @description Multiply all fragment components by zero.
     */
    BLENDMODE_ZERO: 0,
    /**
     * @enum pc.gfx.BLENDMODE
     * @name pc.gfx.BLENDMODE_ONE
     * @description Multiply all fragment components by one.
     */
    BLENDMODE_ONE: 1,
    /**
     * @enum pc.gfx.BLENDMODE
     * @name pc.gfx.BLENDMODE_SRC_COLOR
     * @description Multiply all fragment components by the components of the source fragment.
     */
    BLENDMODE_SRC_COLOR: 2,
    /**
     * @enum pc.gfx.BLENDMODE
     * @name pc.gfx.BLENDMODE_ONE_MINUS_SRC_COLOR
     * @description Multiply all fragment components by one minus the components of the source fragment.
     */
    BLENDMODE_ONE_MINUS_SRC_COLOR: 3,
    /**
     * @enum pc.gfx.BLENDMODE
     * @name pc.gfx.BLENDMODE_DST_COLOR
     * @description Multiply all fragment components by the components of the destination fragment.
     */
    BLENDMODE_DST_COLOR: 4,
    /**
     * @enum pc.gfx.BLENDMODE
     * @name pc.gfx.BLENDMODE_ONE_MINUS_DST_COLOR
     * @description Multiply all fragment components by one minus the components of the destination fragment.
     */
    BLENDMODE_ONE_MINUS_DST_COLOR: 5,
    /**
     * @enum pc.gfx.BLENDMODE
     * @name pc.gfx.BLENDMODE_SRC_ALPHA
     * @description Multiply all fragment components by the alpha value of the source fragment.
     */
    BLENDMODE_SRC_ALPHA: 6,
    /**
     * @enum pc.gfx.BLENDMODE
     * @name pc.gfx.BLENDMODE_SRC_ALPHA_SATURATE
     * @description Multiply all fragment components by the alpha value of the source fragment.
     */
    BLENDMODE_SRC_ALPHA_SATURATE: 7,
    /**
     * @enum pc.gfx.BLENDMODE
     * @name pc.gfx.BLENDMODE_ONE_MINUS_SRC_ALPHA
     * @description Multiply all fragment components by one minus the alpha value of the source fragment.
     */
    BLENDMODE_ONE_MINUS_SRC_ALPHA: 8,
    /**
     * @enum pc.gfx.BLENDMODE
     * @name pc.gfx.BLENDMODE_DST_ALPHA
     * @description Multiply all fragment components by the alpha value of the destination fragment.
     */
    BLENDMODE_DST_ALPHA: 9,
    /**
     * @enum pc.gfx.BLENDMODE
     * @name pc.gfx.BLENDMODE_ONE_MINUS_DST_ALPHA
     * @description Multiply all fragment components by one minus the alpha value of the destination fragment.
     */
    BLENDMODE_ONE_MINUS_DST_ALPHA: 10,

    /**
     * @enum pc.gfx.BUFFER
     * @name pc.gfx.BUFFER_STATIC
     * @description The data store contents will be modified once and used many times.
     */
    BUFFER_STATIC: 0,
    /**
     * @enum pc.gfx.BUFFER
     * @name pc.gfx.BUFFER_DYNAMIC
     * @description The data store contents will be modified repeatedly and used many times.
     */
    BUFFER_DYNAMIC: 1,
    /**
     * @enum pc.gfx.BUFFER
     * @name pc.gfx.BUFFER_STREAM
     * @description The data store contents will be modified once and used at most a few times.
     */
    BUFFER_STREAM: 2,

    /**
     * @enum pc.gfx.CLEARFLAG
     * @name pc.gfx.CLEARFLAG_COLOR
     * @description Clear the color buffer.
     */
    CLEARFLAG_COLOR: 1,
    /**
     * @enum pc.gfx.CLEARFLAG
     * @name pc.gfx.CLEARFLAG_DEPTH
     * @description Clear the depth buffer.
     */
    CLEARFLAG_DEPTH: 2,
    /**
     * @enum pc.gfx.CLEARFLAG
     * @name pc.gfx.CLEARFLAG_STENCIL
     * @description Clear the stencil buffer.
     */
    CLEARFLAG_STENCIL: 4,

    /**
     * @enum pc.gfx.CULLFACE
     * @name pc.gfx.CULLFACE_NONE
     * @description No triangles are culled.
     */
    CULLFACE_NONE: 0,
    /**
     * @enum pc.gfx.CULLFACE
     * @name pc.gfx.CULLFACE_BACK
     * @description Triangles facing away from the view direction are culled.
     */
    CULLFACE_BACK: 1,
    /**
     * @enum pc.gfx.CULLFACE
     * @name pc.gfx.CULLFACE_FRONT
     * @description Triangles facing the view direction are culled.
     */
    CULLFACE_FRONT: 2,
    /**
     * @enum pc.gfx.CULLFACE
     * @name pc.gfx.CULLFACE_FRONTANDBACK
     * @description Triangles are culled regardless of their orientation with respect to the view
     * direction. Note that point or line primitives are unaffected by this render state.
     */
    CULLFACE_FRONTANDBACK: 3,

    /**
     * @enum pc.gfx.ELEMENTTYPE
     * @name pc.gfx.ELEMENTTYPE_INT8
     * @description Signed byte vertex element type.
     */
    ELEMENTTYPE_INT8: 0,
    /**
     * @enum pc.gfx.ELEMENTTYPE
     * @name pc.gfx.ELEMENTTYPE_UINT8
     * @description Unsigned byte vertex element type.
     */
    ELEMENTTYPE_UINT8: 1,
    /**
     * @enum pc.gfx.ELEMENTTYPE
     * @name pc.gfx.ELEMENTTYPE_INT16
     * @description Signed short vertex element type.
     */
    ELEMENTTYPE_INT16: 2,
    /**
     * @enum pc.gfx.ELEMENTTYPE
     * @name pc.gfx.ELEMENTTYPE_UINT16
     * @description Unsigned short vertex element type.
     */
    ELEMENTTYPE_UINT16: 3,
    /**
     * @enum pc.gfx.ELEMENTTYPE
     * @name pc.gfx.ELEMENTTYPE_INT32
     * @description Signed integer vertex element type.
     */
    ELEMENTTYPE_INT32: 4,
    /**
     * @enum pc.gfx.ELEMENTTYPE
     * @name pc.gfx.ELEMENTTYPE_UINT32
     * @description Unsigned integer vertex element type.
     */
    ELEMENTTYPE_UINT32: 5,
    /**
     * @enum pc.gfx.ELEMENTTYPE
     * @name pc.gfx.ELEMENTTYPE_FLOAT32
     * @description Floating point vertex element type.
     */
    ELEMENTTYPE_FLOAT32: 6,

    /**
     * @enum pc.gfx.FILTER
     * @name pc.gfx.FILTER_NEAREST
     * @description Point sample filtering.
     */
    FILTER_NEAREST: 0,
    /**
     * @enum pc.gfx.FILTER
     * @name pc.gfx.FILTER_LINEAR
     * @description Bilinear filtering.
     */
    FILTER_LINEAR: 1,
    /**
     * @enum pc.gfx.FILTER
     * @name pc.gfx.FILTER_NEAREST_MIPMAP_NEAREST
     * @description Use the nearest neighbor in the nearest mipmap level.
     */
    FILTER_NEAREST_MIPMAP_NEAREST: 2,
    /**
     * @enum pc.gfx.FILTER
     * @name pc.gfx.FILTER_NEAREST_MIPMAP_LINEAR
     * @description Linearly interpolate in the nearest mipmap level.
     */
    FILTER_NEAREST_MIPMAP_LINEAR: 3,
    /**
     * @enum pc.gfx.FILTER
     * @name pc.gfx.FILTER_LINEAR_MIPMAP_NEAREST
     * @description Use the nearest neighbor after linearly interpolating between mipmap levels.
     */
    FILTER_LINEAR_MIPMAP_NEAREST: 4,
    /**
     * @enum pc.gfx.FILTER
     * @name pc.gfx.FILTER_LINEAR_MIPMAP_LINEAR
     * @description Linearly interpolate both the mipmap levels and between texels.
     */
    FILTER_LINEAR_MIPMAP_LINEAR: 5,

    /**
     * @enum pc.gfx.FRONTFACE
     * @name pc.gfx.FRONTFACE_CW
     * @description Front facing polygons have a clockwise vertex winding.
     */
    FRONTFACE_CW: 0,
    /**
     * @enum pc.gfx.FRONTFACE
     * @name pc.gfx.FRONTFACE_CCW
     * @description Front facing polygons have an counter-clockwise vertex winding.
     */
    FRONTFACE_CCW: 1,

    /**
     * @enum pc.gfx.INDEXFORMAT
     * @name pc.gfx.INDEXFORMAT_UINT8
     * @description 8-bit unsigned vertex indices.
     */
    INDEXFORMAT_UINT8: 0,
    /**
     * @enum pc.gfx.INDEXFORMAT
     * @name pc.gfx.INDEXFORMAT_UINT16
     * @description 16-bit unsigned vertex indices.
     */
    INDEXFORMAT_UINT16: 1,
    /**
     * @enum pc.gfx.INDEXFORMAT
     * @name pc.gfx.INDEXFORMAT_UINT32
     * @description 32-bit unsigned vertex indices.
     */
    INDEXFORMAT_UINT32: 2,

    /**
     * @enum pc.gfx.PIXELFORMAT
     * @name pc.gfx.PIXELFORMAT_A8
     * @description 8-bit alpha.
     */
    PIXELFORMAT_A8: 0,
    /**
     * @enum pc.gfx.PIXELFORMAT
     * @name pc.gfx.PIXELFORMAT_L8
     * @description 8-bit luminance.
     */
    PIXELFORMAT_L8: 1,
    /**
     * @enum pc.gfx.PIXELFORMAT
     * @name pc.gfx.PIXELFORMAT_L8_A8
     * @description 8-bit luminance with 8-bit alpha.
     */
    PIXELFORMAT_L8_A8: 2,
    /**
     * @enum pc.gfx.PIXELFORMAT
     * @name pc.gfx.PIXELFORMAT_R5_G6_B5
     * @description 16-bit RGB (5-bits for red channel, 6 for green and 5 for blue).
     */
    PIXELFORMAT_R5_G6_B5: 3,
    /**
     * @enum pc.gfx.PIXELFORMAT
     * @name pc.gfx.PIXELFORMAT_R5_G5_B5_A1
     * @description 16-bit RGBA (5-bits for red channel, 5 for green, 5 for blue with 1-bit alpha).
     */
    PIXELFORMAT_R5_G5_B5_A1: 4,
    /**
     * @enum pc.gfx.PIXELFORMAT
     * @name pc.gfx.PIXELFORMAT_R4_G4_B4_A4
     * @description 16-bit RGBA (4-bits for red channel, 4 for green, 4 for blue with 4-bit alpha).
     */
    PIXELFORMAT_R4_G4_B4_A4: 5,
    /**
     * @enum pc.gfx.PIXELFORMAT
     * @name pc.gfx.PIXELFORMAT_R8_G8_B8
     * @description 24-bit RGB (8-bits for red channel, 8 for green and 8 for blue).
     */
    PIXELFORMAT_R8_G8_B8: 6,
    /**
     * @enum pc.gfx.PIXELFORMAT
     * @name pc.gfx.PIXELFORMAT_R8_G8_B8_A8
     * @description 32-bit RGBA (8-bits for red channel, 8 for green, 8 for blue with 8-bit alpha).
     */
    PIXELFORMAT_R8_G8_B8_A8: 7,
    /**
     * @enum pc.gfx.PIXELFORMAT
     * @name pc.gfx.PIXELFORMAT_DXT1
     * @description Block compressed format, storing 16 input pixels in 64 bits of output, consisting of two 16-bit RGB 5:6:5 color values and a 4x4 two bit lookup table.
     */
    PIXELFORMAT_DXT1: 8,
    /**
     * @enum pc.gfx.PIXELFORMAT
     * @name pc.gfx.PIXELFORMAT_DXT3
     * @description Block compressed format, storing 16 input pixels (corresponding to a 4x4 pixel block) into 128 bits of output, consisting of 64 bits of alpha channel data (4 bits for each pixel) followed by 64 bits of color data, encoded the same way as DXT1.
     */
    PIXELFORMAT_DXT3: 9,
    /**
     * @enum pc.gfx.PIXELFORMAT
     * @name pc.gfx.PIXELFORMAT_DXT5
     * @description Block compressed format, storing 16 input pixels into 128 bits of output, consisting of 64 bits of alpha channel data (two 8 bit alpha values and a 4x4 3 bit lookup table) followed by 64 bits of color data (encoded the same way as DXT1).
     */
    PIXELFORMAT_DXT5: 10,

    /**
     * @enum pc.gfx.PRIMITIVE
     * @name pc.gfx.PRIMITIVE_POINTS
     * @description List of distinct points.
     */
    PRIMITIVE_POINTS: 0,
    /**
     * @enum pc.gfx.PRIMITIVE
     * @name pc.gfx.PRIMITIVE_LINES
     * @description Discrete list of line segments.
     */
    PRIMITIVE_LINES: 1,
    /**
     * @enum pc.gfx.PRIMITIVE
     * @name pc.gfx.PRIMITIVE_LINESTRIP
     * @description List of points that are linked sequentially by line segments.
     */
    PRIMITIVE_LINESTRIP: 2,
    /**
     * @enum pc.gfx.PRIMITIVE
     * @name pc.gfx.PRIMITIVE_TRIANGLES
     * @description Discrete list of triangles.
     */
    PRIMITIVE_TRIANGLES: 3,
    /**
     * @enum pc.gfx.PRIMITIVE
     * @name pc.gfx.PRIMITIVE_TRISTRIP
     * @description Connected strip of triangles where a specified vertex forms a triangle using the previous two.
     */
    PRIMITIVE_TRISTRIP: 4,

    /**
     * @enum pc.gfx.SEMANTIC
     * @name pc.gfx.SEMANTIC_POSITION
     * @description Vertex attribute to be treated as a position.
     */
    SEMANTIC_POSITION: "POSITION",
    /**
     * @enum pc.gfx.SEMANTIC
     * @name pc.gfx.SEMANTIC_NORMAL
     * @description Vertex attribute to be treated as a normal.
     */
    SEMANTIC_NORMAL: "NORMAL",
    /**
     * @enum pc.gfx.SEMANTIC
     * @name pc.gfx.SEMANTIC_TANGENT
     * @description Vertex attribute to be treated as a tangent.
     */
    SEMANTIC_TANGENT: "TANGENT",
    /**
     * @enum pc.gfx.SEMANTIC
     * @name pc.gfx.SEMANTIC_BLENDWEIGHT
     * @description Vertex attribute to be treated as skin blend weights.
     */
    SEMANTIC_BLENDWEIGHT: "BLENDWEIGHT",
    /**
     * @enum pc.gfx.SEMANTIC
     * @name pc.gfx.SEMANTIC_BLENDINDICES
     * @description Vertex attribute to be treated as skin blend indices.
     */
    SEMANTIC_BLENDINDICES: "BLENDINDICES",
    /**
     * @enum pc.gfx.SEMANTIC
     * @name pc.gfx.SEMANTIC_COLOR
     * @description Vertex attribute to be treated as a color.
     */
    SEMANTIC_COLOR: "COLOR",
    /**
     * @enum pc.gfx.SEMANTIC
     * @name pc.gfx.SEMANTIC_TEXCOORD0
     * @description Vertex attribute to be treated as a texture coordinate (set 0).
     */
    SEMANTIC_TEXCOORD0: "TEXCOORD0",
    /**
     * @enum pc.gfx.SEMANTIC
     * @name pc.gfx.SEMANTIC_TEXCOORD1
     * @description Vertex attribute to be treated as a texture coordinate (set 1).
     */
    SEMANTIC_TEXCOORD1: "TEXCOORD1",
    /**
     * @enum pc.gfx.SEMANTIC
     * @name pc.gfx.SEMANTIC_TEXCOORD2
     * @description Vertex attribute to be treated as a texture coordinate (set 2).
     */
    SEMANTIC_TEXCOORD2: "TEXCOORD2",
    /**
     * @enum pc.gfx.SEMANTIC
     * @name pc.gfx.SEMANTIC_TEXCOORD3
     * @description Vertex attribute to be treated as a texture coordinate (set 3).
     */
    SEMANTIC_TEXCOORD3: "TEXCOORD3",
    /**
     * @enum pc.gfx.SEMANTIC
     * @name pc.gfx.SEMANTIC_TEXCOORD4
     * @description Vertex attribute to be treated as a texture coordinate (set 4).
     */
    SEMANTIC_TEXCOORD4: "TEXCOORD4",
    /**
     * @enum pc.gfx.SEMANTIC
     * @name pc.gfx.SEMANTIC_TEXCOORD5
     * @description Vertex attribute to be treated as a texture coordinate (set 5).
     */
    SEMANTIC_TEXCOORD5: "TEXCOORD5",
    /**
     * @enum pc.gfx.SEMANTIC
     * @name pc.gfx.SEMANTIC_TEXCOORD6
     * @description Vertex attribute to be treated as a texture coordinate (set 6).
     */
    SEMANTIC_TEXCOORD6: "TEXCOORD6",
    /**
     * @enum pc.gfx.SEMANTIC
     * @name pc.gfx.SEMANTIC_TEXCOORD7
     * @description Vertex attribute to be treated as a texture coordinate (set 7).
     */
    SEMANTIC_TEXCOORD7: "TEXCOORD7",
    /**
     * @enum pc.gfx.SEMANTIC
     * @name pc.gfx.SEMANTIC_ATTR0
     * @description Vertex attribute with a user defined semantic.
     */
    SEMANTIC_ATTR0: "ATTR0",
    /**
     * @enum pc.gfx.SEMANTIC
     * @name pc.gfx.SEMANTIC_ATTR1
     * @description Vertex attribute with a user defined semantic.
     */
    SEMANTIC_ATTR1: "ATTR1",
    /**
     * @enum pc.gfx.SEMANTIC
     * @name pc.gfx.SEMANTIC_ATTR2
     * @description Vertex attribute with a user defined semantic.
     */
    SEMANTIC_ATTR2: "ATTR2",
    /**
     * @enum pc.gfx.SEMANTIC
     * @name pc.gfx.SEMANTIC_ATTR3
     * @description Vertex attribute with a user defined semantic.
     */
    SEMANTIC_ATTR3: "ATTR3",
    /**
     * @enum pc.gfx.SEMANTIC
     * @name pc.gfx.SEMANTIC_ATTR4
     * @description Vertex attribute with a user defined semantic.
     */
    SEMANTIC_ATTR4: "ATTR4",
    /**
     * @enum pc.gfx.SEMANTIC
     * @name pc.gfx.SEMANTIC_ATTR5
     * @description Vertex attribute with a user defined semantic.
     */
    SEMANTIC_ATTR5: "ATTR5",
    /**
     * @enum pc.gfx.SEMANTIC
     * @name pc.gfx.SEMANTIC_ATTR6
     * @description Vertex attribute with a user defined semantic.
     */
    SEMANTIC_ATTR6: "ATTR6",
    /**
     * @enum pc.gfx.SEMANTIC
     * @name pc.gfx.SEMANTIC_ATTR7
     * @description Vertex attribute with a user defined semantic.
     */
    SEMANTIC_ATTR7: "ATTR7",
    /**
     * @enum pc.gfx.SEMANTIC
     * @name pc.gfx.SEMANTIC_ATTR8
     * @description Vertex attribute with a user defined semantic.
     */
    SEMANTIC_ATTR8: "ATTR8",
    /**
     * @enum pc.gfx.SEMANTIC
     * @name pc.gfx.SEMANTIC_ATTR9
     * @description Vertex attribute with a user defined semantic.
     */
    SEMANTIC_ATTR9: "ATTR9",
    /**
     * @enum pc.gfx.SEMANTIC
     * @name pc.gfx.SEMANTIC_ATTR10
     * @description Vertex attribute with a user defined semantic.
     */
    SEMANTIC_ATTR10: "ATTR10",
    /**
     * @enum pc.gfx.SEMANTIC
     * @name pc.gfx.SEMANTIC_ATTR11
     * @description Vertex attribute with a user defined semantic.
     */
    SEMANTIC_ATTR11: "ATTR11",
    /**
     * @enum pc.gfx.SEMANTIC
     * @name pc.gfx.SEMANTIC_ATTR12
     * @description Vertex attribute with a user defined semantic.
     */
    SEMANTIC_ATTR12: "ATTR12",
    /**
     * @enum pc.gfx.SEMANTIC
     * @name pc.gfx.SEMANTIC_ATTR13
     * @description Vertex attribute with a user defined semantic.
     */
    SEMANTIC_ATTR13: "ATTR13",
    /**
     * @enum pc.gfx.SEMANTIC
     * @name pc.gfx.SEMANTIC_ATTR14
     * @description Vertex attribute with a user defined semantic.
     */
    SEMANTIC_ATTR14: "ATTR14",
    /**
     * @enum pc.gfx.SEMANTIC
     * @name pc.gfx.SEMANTIC_ATTR15
     * @description Vertex attribute with a user defined semantic.
     */
    SEMANTIC_ATTR15: "ATTR15",

    /**
     * @enum pc.gfx.TEXTURELOCK
     * @name pc.gfx.TEXTURELOCK_READ
     * @description Read only. Any changes to the locked mip level's pixels will not update the texture.
     */
    TEXTURELOCK_READ: 1,
    /**
     * @enum pc.gfx.TEXTURELOCK
     * @name pc.gfx.TEXTURELOCK_WRITE
     * @description Write only. The contents of the specified mip level will be entirely replaced.
     */
    TEXTURELOCK_WRITE: 2
};
