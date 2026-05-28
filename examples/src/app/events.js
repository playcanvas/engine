/**
 * @import { Observer } from '@playcanvas/observer'
 * @import { DEVICETYPE_NULL, DEVICETYPE_WEBGL2, DEVICETYPE_WEBGPU, DEVICETYPE_WEBGPU_BARE } from './constants.mjs'
 */

/**
 * @typedef {object} LoadingEventDetail
 * @property {boolean} showDeviceSelector - Show device selector
 *
 * @typedef {CustomEvent<LoadingEventDetail>} LoadingEvent.
 */

/**
 * @typedef {object} Credit
 * @property {string} title - The credit title.
 * @property {string} author - The credit author.
 * @property {string} [source] - The credit source (optional).
 * @property {string} [license] - The credit license (optional).
 *
 * @typedef {object} StateEventDetail
 * @property {Observer} observer - The PCUI observer.
 * @property {Record<string, string>} files - The example files.
 * @property {string} description - The example description.
 * @property {Credit[]} credits - The example credits.
 *
 * @typedef {CustomEvent<StateEventDetail>} StateEvent
 */

/**
 * @typedef {object} DeviceEventDetail
 * @property {DEVICETYPE_WEBGPU | DEVICETYPE_WEBGPU_BARE | DEVICETYPE_WEBGL2 | DEVICETYPE_NULL} deviceType - The device type.
 *
 * @typedef {CustomEvent<DeviceEventDetail>} DeviceEvent
 */

/**
 * @typedef {object} ErrorEventDetail
 * @property {string} name - The error name.
 * @property {string} message - The error message.
 * @property {{ file: string, line: number, column: number }[]} locations - The error locations.
 *
 * @typedef {CustomEvent<ErrorEventDetail>} ErrorEvent
 */

export {};
