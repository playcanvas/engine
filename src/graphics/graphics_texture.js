/**
 * Constants for texture lock mode.
 * @enum {number}
 */
pc.gfx.TextureLock = {
    /** Write only. The contents of the specified mip level will be entirely replaced. */
    READ: 1,
    /** Write only. The contents of the specified mip level will be entirely replaced. */
    WRITE: 2
};

/**
 * Constants for texture format.
 * @enum {number}
 */
pc.gfx.TextureFormat = {
    /** 24-bit RGB format. */
    RGB: 0,
    /** 32-bit RGBA format. */
    RGBA: 1,
    /** 8-bit luminance (greyscale) format. */
    LUMINANCE: 2
};

/**
 * Constants for texture addressing mode.
 * @enum {number}
 */
pc.gfx.TextureAddress = {
    /** Ignores the integer part of texture coordinates, using only the fractional part. */
    REPEAT: 0,
    /** 32-bit RGBA format. */
    CLAMP_TO_EDGE: 1,
    /** 8-bit luminance (greyscale) format. */
    MIRRORED_REPEAT: 2
};

/**
 * Constants for texture filtering mode.
 * @enum {number}
 */
pc.gfx.TextureFilter = {
    /** Point sample filtering. */
    NEAREST: 0,
    /** Bilinear filtering. */
    LINEAR: 1,
    /** Use the nearest neighbor in the nearest mipmap level. */
    NEAREST_MIPMAP_NEAREST: 2,
    /** Linearly interpolate in the nearest mipmap level. */
    NEAREST_MIPMAP_LINEAR: 3,
    /** Use the nearest neighbor after linearly interpolating between mipmap levels. */
    LINEAR_MIPMAP_NEAREST: 4,
    /** Linearly interpolate both the mipmap levels and between texels. */
    LINEAR_MIPMAP_LINEAR: 5
};

pc.extend(pc.gfx, function () {
    // Private variables
    var _formatSize = [];
    _formatSize[pc.gfx.TextureFormat.RGB] = 3;
    _formatSize[pc.gfx.TextureFormat.RGBA] = 4;
    _formatSize[pc.gfx.TextureFormat.LUMINANCE] = 1;

    /**
     * @name pc.gfx.Texture
     * @class A texture is a container for texel data that can be manipulated in a fragment shader.
     * Typically, the texel data represents an image that is mapped over geometry.
     * @param {boolean} isCube Optional parameter. True if the texture is a cubemap and false otherwise. Defaults to false.
     * @author Will Eastcott
     */
    var Texture = function () {
        var gl = pc.gfx.Device.getCurrent().gl;

        this._textureId = gl.createTexture();
        // These values are the defaults as specified by the WebGL spec
        this._addressu  = pc.gfx.TextureAddress.REPEAT;
        this._addressv  = pc.gfx.TextureAddress.REPEAT;
        this._minFilter = pc.gfx.TextureFilter.NEAREST_MIPMAP_LINEAR;
        this._magFilter = pc.gfx.TextureFilter.LINEAR;
    };

    /**
     * @function
     * @name pc.gfx.Texture#bind
     * @description Activates the specified texture on the current texture unit.
     * @author Will Eastcott
     */
    Texture.prototype.bind = function () {
        var gl = pc.gfx.Device.getCurrent().gl;
        gl.bindTexture(this._target, this._textureId);
    };

    /**
     * @function
     * @name pc.gfx.Texture#allocate
     * @description Allocates a texel array buffer for the specified texture. If the texture
     * already has a source set on it (see pc.gfx.Texture#setSource), then the source is deleted
     * first.
     * @author Will Eastcott
     */
    Texture.prototype.allocate = function () {
        if (this._source !== undefined) {
            delete this._source;
        }

        this._levels = [];

        var numBytes = this._width * this._height * _formatSize[this._format];
        this._levels[0] = new ArrayBuffer(numBytes);
    };

    /**
     * @function
     * @name pc.gfx.Texture#isPowerOfTwo
     * @description Indicates whether the specified texture has dimensions that are both power of two.
     * @returns {boolean} True if power of two in both dimensions and false otherwise.
     * @author Will Eastcott
     */
    Texture.prototype.isPowerOfTwo = function () {
        var w = this._width;
        var h = this._height;
        return (!(w === 0) && !(w & (w - 1))) && (!(h === 0) && !(h & (h - 1)));
    };

    /**
     * @function
     * @name pc.gfx.Texture#lock
     * @description 
     * @param {Object} options Optional options object. Valid properties are as follows:
     * @param {Number} options.level The mip level to lock with 0 being the top level. Defaults to 0.
     * @param {Number} options.face If the texture is a cubemap, this is the index of the face to lock.
     * @author Will Eastcott
     */
    Texture.prototype.lock = function (options) {
        // Initialize options to some sensible defaults
        options = options || { level: 0, face: 0, mode: pc.gfx.TextureLock.WRITE };
        if (options.level === undefined) { options.level = 0; };
        if (options.face === undefined) { options.face = 0; };
        if (options.mode === undefined) { options.mode = pc.gfx.TextureLock.WRITE; };

        logASSERT(this._levels !== undefined, "pc.gfx.Texture: lock: Texture has not been allocated");
        logASSERT((options.level >= 0) || (options.level < this._levels.length), "pc.gfx.Texture: lock: Supplied mip level out of range");

        this._lockedLevel = options.level;

        if (this._levels[options.level] === undefined) {
            var numBytes = this._width * this._height * _formatSize[this._format];
            this._levels[options.level] = new ArrayBuffer(numBytes);
        }

        return this._levels[options.level];
    };

    /**
     * @function
     * @name pc.gfx.Texture#unlock
     * @description 
     * @author Will Eastcott
     */
    Texture.prototype.unlock = function () {
        logASSERT(this._lockedLevel !== undefined, "Attempting to unlock a texture that is not locked");

        // Upload the new pixel data
        this.upload();
        delete this._lockedLevel;
    };

    /**
     * @function
     * @name pc.gfx.Texture#recover
     * @description Restores the texture in the event of the underlying WebGL context being lost and then
     * restored.
     * @author Will Eastcott
     */
    Texture.prototype.recover = function () {
        var gl = pc.gfx.Device.getCurrent().gl;
        this._textureId = gl.createTexture();
        this.setAddressMode(this._addressu, this._addressv);
        this.setFilterMode(this._minFilter, this._magFilter);
        this.upload();
    };

    /**
     * @function
     * @name pc.gfx.Texture#setAddressMode
     * @description Sets the addressing mode for the specified texture.
     * @param {pc.gfx.TextureAddress} addressu The address mode for the U-direction.
     * @param {pc.gfx.TextureAddress} addressv The address mode for the V-direction.
     * @author Will Eastcott
     */
    Texture.prototype.setAddressMode = function (addressu, addressv) {
        if (!this.isPowerOfTwo()) {
            if (addressu !== pc.gfx.TextureAddress.CLAMP_TO_EDGE) {
                logWARNING("Invalid address mode in U set on non power of two texture. Forcing clamp to edge addressing.");
                addressu = pc.gfx.TextureAddress.CLAMP_TO_EDGE;
            }
            if (addressv !== pc.gfx.TextureAddress.CLAMP_TO_EDGE) {
                logWARNING("Invalid address mode in V set on non power of two texture. Forcing clamp to edge addressing.");
                addressv = pc.gfx.TextureAddress.CLAMP_TO_EDGE;
            }
        }
        this.bind();
        var gl = pc.gfx.Device.getCurrent().gl;
        var _addressLookup = [gl.REPEAT, gl.CLAMP_TO_EDGE, gl.MIRRORED_REPEAT];
        gl.texParameteri(this._target, gl.TEXTURE_WRAP_S, _addressLookup[addressu]);
        gl.texParameteri(this._target, gl.TEXTURE_WRAP_T, _addressLookup[addressv]);
        this._addressu = addressu;
        this._addressv = addressv;
    };

    /**
     * @function
     * @name pc.gfx.Texture#setFilterMode
     * @description Sets the filter mode for the specified texture.
     * @param {pc.gfx.TextureFilter} minFilter The minification filter mode.
     * @param {pc.gfx.TextureFilter} magFilter The magnification filter mode.
     * @author Will Eastcott
     */
    Texture.prototype.setFilterMode = function (minFilter, magFilter) {
        if (!this.isPowerOfTwo()) {
            if (!((minFilter === pc.gfx.TextureFilter.NEAREST) || (minFilter === pc.gfx.TextureFilter.LINEAR)))  {
                logWARNING("Invalid filter mode set on non power of two texture. Forcing linear addressing.");
                minFilter = pc.gfx.TextureFilter.LINEAR;
            }
        }
        this.bind();
        var gl = pc.gfx.Device.getCurrent().gl;
        var _filterLookup = [gl.NEAREST, gl.NEAREST, gl.LINEAR, gl.NEAREST_MIPMAP_NEAREST, gl.NEAREST_MIPMAP_LINEAR, gl.LINEAR_MIPMAP_NEAREST, gl.LINEAR_MIPMAP_LINEAR];
        gl.texParameteri(this._target, gl.TEXTURE_MIN_FILTER, _filterLookup[minFilter]);
        gl.texParameteri(this._target, gl.TEXTURE_MAG_FILTER, _filterLookup[magFilter]);
        this._minFilter = minFilter;
        this._magFilter = magFilter;
    };

    /**
     * @function
     * @name pc.gfx.Texture#getFormat
     * @description Returns the format of the specified texture.
     * @returns {pc.gfx.TextureFormat} The format of the specified texture.
     * @author Will Eastcott
     */
    Texture.prototype.getFormat = function () {
        return this._format;
    };

    /**
     * @function
     * @name pc.gfx.Texture#getHeight
     * @description Returns the height of the specified texture.
     * @returns {number} The height of the specified texture.
     * @author Will Eastcott
     */
    Texture.prototype.getHeight = function () {
        return this._height;
    };

    /**
     * @function
     * @name pc.gfx.Texture#getWidth
     * @description Returns the width of the specified texture.
     * @returns {number} The width of the specified texture.
     * @author Will Eastcott
     */
    Texture.prototype.getWidth = function () {
        return this._width;
    };
	
    return {
        Texture: Texture
    };
}());

pc.extend(pc.gfx, function () {
    /**
     * @name pc.gfx.Texture2D
     * @class A 2D texture is a container for texel data that can be manipulated in a fragment shader.
     * Typically, the texel data represents an image that is mapped over geometry.
     * @author Will Eastcott
     */
    var Texture2D = function (width, height, format) {
        var gl = pc.gfx.Device.getCurrent().gl;
        this._target = gl.TEXTURE_2D;

        // Set the new texture to be 1x1 and white
        this._width = width || 1;
        this._height = height || 1;
        this._format = format || pc.gfx.TextureFormat.RGB;
        this.upload();
    };

    // A Texture2D is a specialization of a Texture.  So inherit...
    Texture2D = Texture2D.extendsFrom(pc.gfx.Texture);

	/**
	 * @function
	 * @name pc.gfx.Texture2D#load
	 * @description Load an Image resource to use as the source of the texture.
	 * @param {String} url The URL of the image resources to use
	 * @param {pc.resources.ResourceLoader} loader The ResourceLoader to fetch the resource with
	 * @param {Number} [batch] A existing RequestBatch handle to append this request to.
	 */
	Texture2D.prototype.load = function (url, loader, batch) {
		var options = {
			batch: batch
		};
		
		loader.request(new pc.resources.ImageRequest(url), function (resources) {
			this.setSource(resources[url]);
		}.bind(this))
	};

    /**
     * @function
     * @name pc.gfx.Texture2D#setSource
     * @description
     * @param {Object} source An HTMLCanvasElement, HTMLImageElement or HTMLVideoElement object.
     * for the specified texture.
     * @author Will Eastcott
     */
    Texture2D.prototype.setSource = function (source) {
        // Check a valid source has been passed in
        logASSERT((source instanceof HTMLCanvasElement) || (source instanceof HTMLImageElement) || (source instanceof HTMLVideoElement), 
            "pc.gfx.TextureCube: setSource: supplied source is not an instance of HTMLCanvasElement, HTMLImageElement or HTMLVideoElement.");

        // If there are mip levels allocated, blow them away
        if (this._levels !== undefined) {
            delete this._levels;
        }

        this._width  = source.width;
        this._height = source.height;
        if (source instanceof HTMLImageElement) {
            function _endsWith(str, suffix) {
                return str.indexOf(suffix, str.length - suffix.length) !== -1;
            }
            var srcLower = source.src.toLowerCase();
            this._format = (_endsWith(srcLower, '.jpg') || _endsWith(srcLower, '.gif')) ? pc.gfx.TextureFormat.RGB : pc.gfx.TextureFormat.RGBA;
        }
        this._source = source;

        this.upload();
    };
    
    /**
     * @function
     * @name pc.gfx.Texture2D#upload
     * @description Forces a reupload of the textures pixel data to graphics memory. Ordinarily, this function
     * is called by internally by pc.gfx.Texture#setSource and pc.gfx.Texture#unlock. However, it still needs to
     * be called explicitly in the case where an HTMLVideoElement is set as the source of the texture.  Normally, 
     * this is done once every frame before video textured geometry is rendered.
     * @author Will Eastcott
     */
    Texture2D.prototype.upload = function () {
        var gl = pc.gfx.Device.getCurrent().gl;
        var _formatLookup = [gl.RGB, gl.RGBA, gl.LUMINANCE];
        var glFormat = _formatLookup[this._format];

        this.bind();

        if (this._source !== undefined) {
            // Upload the image, canvas or video
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
            gl.texImage2D(gl.TEXTURE_2D, 0, glFormat, glFormat, gl.UNSIGNED_BYTE, this._source);
        } else if (this._levels !== undefined) {
            // Upload the byte array
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
            gl.texImage2D(gl.TEXTURE_2D, 0, glFormat, this._width, this._height, 0, glFormat, gl.UNSIGNED_BYTE, new Uint8Array(this._levels[0]));
        } else {
            // Upload the byte array
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
            gl.texImage2D(gl.TEXTURE_2D, 0, glFormat, this._width, this._height, 0, glFormat, gl.UNSIGNED_BYTE, null);
        }

        if (this.isPowerOfTwo()) {
            gl.generateMipmap(gl.TEXTURE_2D);
        }
    };

    return {
        Texture2D: Texture2D
    }; 
}());

pc.extend(pc.gfx, function () {
    /**
     * @name pc.gfx.TextureCube
     * @class A cube texture is a container for texel data that can be manipulated in a fragment shader.
     * Typically, the texel data represents an image that is mapped over geometry.
     * @author Will Eastcott
     */
    var TextureCube = function (width, height, format) {
        var gl = pc.gfx.Device.getCurrent().gl;
        this._target = gl.TEXTURE_CUBE_MAP;
        this._width = width || 1;
        this._height = height || 1;
        this._format = format || pc.gfx.TextureFormat.RGB;
        this.upload();
    };

    // A TextureCube is a specialization of a Texture.  So inherit...
    TextureCube = TextureCube.extendsFrom(pc.gfx.Texture);
    
	/**
	 * @function
	 * @name pc.gfx.TextureCube#load
	 * @description Load 6 Image resources to use as the sources of the texture.
	 * @param {Array} urls A list of 6 URLs for the image resources to load
	 * @param {pc.resources.ResourceLoader} loader The ResourceLoader to fetch the resources with
	 * @param {Number} [batch] A existing RequestBatch handle to append this request to.
	 */
    TextureCube.prototype.load = function (urls, loader, requestBatch) {
    	var options = {
    		batch: requestBatch
    	};
    	
    	var requests = urls.map(function (url) {
    		return new pc.resources.ImageRequest(url);
    	});
    	
    	loader.request(requests, function (resources) {
    		var images = urls.map(function (url) {
    			return resources[url];
    		});
    		this.setSource(images);
    	}.bind(this), function (errors) {
    		logERROR(errors);
		}, function (progress) {
		},options);
    }
    /**
     * @function
     * @name pc.gfx.TextureCube#setSource
     * @description
     * @param {Array} source Array of 6 HTMLCanvasElement, HTMLImageElement or HTMLVideoElement objects.
     * for the specified texture.
     * @author Will Eastcott
     */
    TextureCube.prototype.setSource = function (source) {
        // Check a valid source has been passed in
        logASSERT(Object.prototype.toString.apply(source) === '[object Array]', "pc.gfx.TextureCube: setSource: supplied source is not an array");
        logASSERT(source.length === 6, "pc.gfx.TextureCube: setSource: supplied source does not have 6 entries.");
        var validTypes = 0;
        var validDimensions = true;
        var width = source[0].width;
        var height = source[0].height;
        for (var i = 0; i < 6; i++) {
            if ((source[i] instanceof HTMLCanvasElement) || 
                (source[i] instanceof HTMLImageElement) || 
                (source[i] instanceof HTMLVideoElement)) {
                validTypes++;
            }
            if (source[i].width !== width) validDimensions = false;
            if (source[i].height !== height) validDimensions = false;
        }
        logASSERT(validTypes === 6, "pc.gfx.TextureCube: setSource: Not all supplied source elements are of required type (canvas, image or video).");
        logASSERT(validDimensions,  "pc.gfx.TextureCube: setSource: Not all supplied source elements share the same dimensions.");

        // If there are mip levels allocated, blow them away
        if (this._levels !== undefined) {
            delete this._levels;
        }

        this._width  = source[0].width;
        this._height = source[0].height;
        this._format = pc.gfx.TextureFormat.RGBA;
        this._source = source;

        this.upload();
    };
    
    /**
     * @function
     * @name pc.gfx.TextureCube#upload
     * @description Forces a reupload of the textures pixel data to graphics memory. Ordinarily, this function
     * is called by internally by pc.gfx.Texture#setSource and pc.gfx.Texture#unlock. However, it still needs to
     * be called explicitly in the case where an HTMLVideoElement is set as the source of the texture.  Normally, 
     * this is done once every frame before video textured geometry is rendered.
     * @author Will Eastcott
     */
    TextureCube.prototype.upload = function () {
        var gl = pc.gfx.Device.getCurrent().gl;
        var _formatLookup = [gl.RGB, gl.RGBA, gl.LUMINANCE];
        var glFormat = _formatLookup[this._format];

        this.bind();

        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        if (this._source !== undefined) {
            // Upload the image, canvas or video
            for (var face = 0; face < 6; face++) {
                gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + face, 0, glFormat, glFormat, gl.UNSIGNED_BYTE, this._source[face]);
            }
        } else if (this._levels !== undefined) {
            // Upload the byte array
            for (var face = 0; face < 6; face++) {
                gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + face, 0, glFormat, this._width, this._height, 0, glFormat, gl.UNSIGNED_BYTE, new Uint8Array(this._levels[face][0]));
            }
        } else {
            // Initialize cube faces to null
            for (var face = 0; face < 6; face++) {
                gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + face, 0, glFormat, this._width, this._height, 0, glFormat, gl.UNSIGNED_BYTE, null);
            }
        }
        
        if (this.isPowerOfTwo()) {
            gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
        }
    };

    return {
        TextureCube: TextureCube
    }; 
}());