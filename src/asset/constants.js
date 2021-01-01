export var ABSOLUTE_URL = new RegExp(
    '^' + // beginning of the url
    '\\s*' +  // ignore leading spaces (some browsers trim the url automatically, but we can't assume that)
    '(?:' +  // beginning of a non-captured regex group
        // `{protocol}://`
        '(?:' +  // beginning of protocol scheme (non-captured regex group)
            '[a-z]+[a-z0-9\\-\\+\\.]*' + // protocol scheme must (RFC 3986) consist of "a letter and followed by any combination of letters, digits, plus ("+"), period ("."), or hyphen ("-")."
            ':' + // protocol scheme must end with colon character
        ')?' + // end of optional scheme group, the group is optional since the string may be a protocol-relative absolute URL
        '//' + // an absolute url must always begin with two forward slash characters (ignoring any leading spaces and protocol scheme)

        '|' + // or another option(s):

        // Data URL (RFC 2397), simplified
        'data:' +

        // Blob data
        '|blob:' +
    ')',
    'i' // non case-sensitive flag
);

/**
 * @constant
 * @type {string}
 * @name pc.ASSET_ANIMATION
 * @description Asset type name for animation.
 */
export var ASSET_ANIMATION = 'animation';
/**
 * @constant
 * @type {string}
 * @name pc.ASSET_AUDIO
 * @description Asset type name for audio.
 */
export var ASSET_AUDIO = 'audio';
/**
 * @constant
 * @type {string}
 * @name pc.ASSET_IMAGE
 * @description Asset type name for image.
 */
export var ASSET_IMAGE = 'image';
/**
 * @constant
 * @type {string}
 * @name pc.ASSET_JSON
 * @description Asset type name for json.
 */
export var ASSET_JSON = 'json';
/**
 * @constant
 * @type {string}
 * @name pc.ASSET_MODEL
 * @description Asset type name for model.
 */
export var ASSET_MODEL = 'model';
/**
 * @constant
 * @type {string}
 * @name pc.ASSET_MATERIAL
 * @description Asset type name for material.
 */
export var ASSET_MATERIAL = 'material';
/**
 * @constant
 * @type {string}
 * @name pc.ASSET_TEXT
 * @description Asset type name for text.
 */
export var ASSET_TEXT = 'text';
/**
 * @constant
 * @type {string}
 * @name pc.ASSET_TEXTURE
 * @description Asset type name for texture.
 */
export var ASSET_TEXTURE = 'texture';
/**
 * @constant
 * @type {string}
 * @name pc.ASSET_CUBEMAP
 * @description Asset type name for cubemap.
 */
export var ASSET_CUBEMAP = 'cubemap';
/**
 * @constant
 * @type {string}
 * @name pc.ASSET_SHADER
 * @description Asset type name for shader.
 */
export var ASSET_SHADER = 'shader';
/**
 * @constant
 * @type {string}
 * @name pc.ASSET_CSS
 * @description Asset type name for CSS.
 */
export var ASSET_CSS = 'css';
/**
 * @constant
 * @type {string}
 * @name pc.ASSET_HTML
 * @description Asset type name for HTML.
 */
export var ASSET_HTML = 'html';
/**
 * @constant
 * @type {string}
 * @name pc.ASSET_SCRIPT
 * @description Asset type name for script.
 */
export var ASSET_SCRIPT = 'script';
/**
 * @constant
 * @type {string}
 * @name pc.ASSET_CONTAINER
 * @description Asset type name for a container.
 */
export var ASSET_CONTAINER = 'container';
