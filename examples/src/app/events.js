/**
 * @typedef {object} Loading
 * @property {object} detail - The detail object.
 * @property {boolean} detail.showDeviceSelector - Show device selector.
 *
 * @typedef {Event & Loading} LoadingEvent
 */

/**
 * @typedef {object} Load
 * @property {Record<string, string>} files - The example files.
 * @property {string} description - The example description..
 *
 * @typedef {Event & Load} LoadEvent
 */

/**
 * @typedef {object} UpdateFiles
 * @property {object} detail - The detail object.
 * @property {Record<string, string>} detail.files - The example files
 *
 * @typedef {Event & UpdateFiles} UpdateFilesEvent
 */

/**
 * @typedef {object} HandleFiles
 * @property {Record<string, string>} detail - The example files object.
 *
 * @typedef {Event & HandleFiles} HandleFilesEvent
 */

/**
 * @typedef {object} UpdateActiveDevice
 * @property {string} detail - The detail object.
 *
 * @typedef {Event & UpdateActiveDevice} UpdateActiveDeviceEvent
 */
