/**
 * @typedef {CustomEvent} LoadingEvent
 * @property {object} detail - The detail object.
 * @property {boolean} detail.showDeviceSelector - Show device selector.
 */

/**
 * @typedef {CustomEvent} LoadEvent
 * @property {Record<string, string>} files - The example files.
 * @property {string} description - The example description.
 */

/**
 * @typedef {CustomEvent} UpdateFilesEvent
 * @property {object} detail - The detail object.
 * @property {Record<string, string>} detail.files - The example files.
 */

/**
 * @typedef {CustomEvent} HandleFilesEvent
 * @property {Record<string, string>} detail - The example files object.
 */

/**
 * @typedef {CustomEvent} UpdateActiveDeviceEvent
 * @property {object} detail - The detail object.
 * @property {string} detail.deviceType - The device type.
 */
