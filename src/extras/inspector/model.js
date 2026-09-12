import { pixelFormatInfo } from '../../platform/graphics/constants.js';

import { collectProperties, describeValue } from './describe.js';

/** @import { FramePass } from '../../platform/graphics/frame-pass.js' */
/** @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js' */
/** @import { RenderTarget } from '../../platform/graphics/render-target.js' */
/** @import { Described } from './describe.js' */

/**
 * @typedef {object} PropertyRow
 * @property {string} key - A key unique within the section, stable across refreshes.
 * @property {string} label - The label.
 * @property {Described} value - The value.
 * @property {boolean} [indent] - Whether the row is an expanded entry of the row above.
 */

/**
 * @typedef {object} PropertySection
 * @property {string} key - A key unique within the view, stable across refreshes.
 * @property {string} title - The title.
 * @property {PropertyRow[]} rows - The rows.
 */

/**
 * @param {string} key - The section key.
 * @param {string} title - The section title.
 * @returns {PropertySection} An empty section.
 */
function makeSection(key, title) {
    return { key, title, rows: [] };
}

/**
 * Reads a property, turning a throwing getter into an error value rather than a broken panel.
 *
 * @param {object} obj - The object.
 * @param {string} name - The property name.
 * @returns {Described} The described value.
 */
function read(obj, name) {
    try {
        return describeValue(obj[name]);
    } catch (e) {
        return { text: `<${e?.message ?? e}>`, cls: 'err' };
    }
}

/**
 * Appends a row, followed by one indented row per expanded collection entry.
 *
 * @param {PropertySection} section - The section.
 * @param {string} label - The label.
 * @param {Described} value - The value.
 */
function push(section, label, value) {
    section.rows.push({ key: label, label, value });
    if (value.items) {
        value.items.forEach((item, i) => {
            section.rows.push({ key: `${label}[${i}]`, label: item.label ?? '', value: item, indent: true });
        });
    }
}

/**
 * Appends one row per public property of an object, see {@link collectProperties}.
 *
 * @param {PropertySection} section - The section.
 * @param {object} obj - The object to reflect on.
 * @param {object[]} stopPrototypes - Prototypes at which to stop walking the chain.
 * @param {string[]} [skip] - Property names to leave out.
 */
function reflectRows(section, obj, stopPrototypes, skip) {
    for (const prop of collectProperties(obj, stopPrototypes, skip)) {
        push(section, prop, read(obj, prop));
    }
}

/**
 * @param {number|undefined} format - A PIXELFORMAT_* constant.
 * @returns {string} Its name, or the number when unknown.
 */
function formatName(format) {
    if (format === undefined || format === null) return '-';
    return pixelFormatInfo.get(format)?.name ?? String(format);
}

/**
 * Passes are named after their class unless given a name, so the class-family prefix carries no
 * information in a list of passes.
 *
 * @param {FramePass} pass - The pass.
 * @returns {string} The name without a leading 'RenderPass' or 'FramePass'.
 */
function passDisplayName(pass) {
    const name = pass.name;
    for (const prefix of ['RenderPass', 'FramePass']) {
        if (name.startsWith(prefix) && name.length > prefix.length) {
            return name.slice(prefix.length);
        }
    }
    return name;
}

/**
 * @param {RenderTarget} rt - A render target.
 * @param {GraphicsDevice} device - The device, to recognize the backbuffer.
 * @returns {string} The attachments in the trace's notation, e.g. `[C×2][D][S]`.
 */
function attachmentsText(rt, device) {
    const numColor = rt === device.backBuffer ? 1 : (rt.colorBufferCount ?? 0);
    return `${numColor > 0 ? `[C${numColor > 1 ? `×${numColor}` : ''}]` : ''}${rt.depth ? '[D]' : ''}${rt.stencil ? '[S]' : ''}`;
}

/**
 * @param {RenderTarget|null} rt - A render target, or null for an unknown backbuffer.
 * @param {GraphicsDevice} device - The device, to recognize the backbuffer.
 * @returns {string} A one-line summary: name, size, attachments, samples and mip level.
 */
function renderTargetSummary(rt, device) {
    if (!rt) return 'Backbuffer';
    const name = rt === device.backBuffer ? 'Backbuffer' : (rt.name || '(unnamed)');
    return `${name} ${rt.width}×${rt.height} ${attachmentsText(rt, device)}` +
        `${rt.samples > 1 ? ` ×${rt.samples}` : ''}${rt.mipLevel > 0 ? ` mip ${rt.mipLevel}` : ''}`;
}

export { attachmentsText, formatName, makeSection, passDisplayName, push, read, reflectRows, renderTargetSummary };
