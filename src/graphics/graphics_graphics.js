/**
 * @namespace Low-level Graphics API
 * @name pc.gfx
 */
pc.gfx = {
    /** Clear the color buffer. */
    CLEARFLAG_COLOR: 1,
    /** Clear the depth buffer. */
    CLEARFLAG_DEPTH: 2,
    /** Clear the stencil buffer. */
    CLEARFLAG_STENCIL: 4,

	/**
	 * Constants for texture lock mode.
	 * @enum {number}
	 */
    /** Write only. The contents of the specified mip level will be entirely replaced. */
    TEXTURELOCK_READ: 1,
    /** Write only. The contents of the specified mip level will be entirely replaced. */
    TEXTURELOCK_WRITE: 2,

	/**
	 * Constants for texture format.
	 * @enum {number}
	 */
    PIXELFORMAT_A8: 0,
    PIXELFORMAT_L8: 1,
    PIXELFORMAT_L8_A8: 2,
    PIXELFORMAT_R5_G6_B5: 3,
    PIXELFORMAT_R5_G5_B5_A1: 4,
    PIXELFORMAT_R4_G4_B4_A4: 5,
    PIXELFORMAT_R8_G8_B8: 6,
    PIXELFORMAT_R8_G8_B8_A8: 7,
    PIXELFORMAT_DXT1: 8,
    PIXELFORMAT_DXT3: 9,
    PIXELFORMAT_DXT5: 10,

	/**
	 * Constants for texture addressing mode.
	 * @enum {number}
	 */
    /** 
     * Ignores the integer part of texture coordinates, using only the fractional part. 
     */
    ADDRESS_REPEAT: 0,
    /** 
     * Clamps texture coordinate to the range 0 to 1. 
     */
    ADDRESS_CLAMP_TO_EDGE: 1,
    /**  
     * Texture coordinate to be set to the fractional part if the integer part is even; if the integer part is odd,
     * then the texture coordinate is set to 1 minus the fractional part. 
     */
    ADDRESS_MIRRORED_REPEAT: 2,

	/**
	 * Constants for texture filtering mode.
	 * @enum {number}
	 */
    /** Point sample filtering. */
    FILTER_NEAREST: 0,
    /** Bilinear filtering. */
    FILTER_LINEAR: 1,
    /** Use the nearest neighbor in the nearest mipmap level. */
    FILTER_NEAREST_MIPMAP_NEAREST: 2,
    /** Linearly interpolate in the nearest mipmap level. */
    FILTER_NEAREST_MIPMAP_LINEAR: 3,
    /** Use the nearest neighbor after linearly interpolating between mipmap levels. */
    FILTER_LINEAR_MIPMAP_NEAREST: 4,
    /** Linearly interpolate both the mipmap levels and between texels. */
    FILTER_LINEAR_MIPMAP_LINEAR: 5
};
