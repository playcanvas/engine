import {
    SAMPLETYPE_DEPTH, SAMPLETYPE_FLOAT, SAMPLETYPE_INT, SAMPLETYPE_UINT, SAMPLETYPE_UNFILTERABLE_FLOAT,
    SHADERLANGUAGE_WGSL, SHADERSTAGE_COMPUTE, SHADERSTAGE_FRAGMENT, SHADERSTAGE_VERTEX,
    bindGroupNames, pixelFormatInfo, uniformTypeToName
} from '../../platform/graphics/constants.js';

import { describeValue } from './describe.js';
import { makeSection, push, reflectRows } from './model.js';

/** @import { BindGroupFormat } from '../../platform/graphics/bind-group-format.js' */
/** @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js' */
/** @import { Shader } from '../../platform/graphics/shader.js' */
/** @import { UniformBufferFormat } from '../../platform/graphics/uniform-buffer-format.js' */
/** @import { Described } from './describe.js' */
/** @import { ListRow } from './list-view.js' */
/** @import { PropertySection } from './model.js' */

// shader properties the model shows explicitly, plus plumbing and the source strings themselves
const SKIP_SHADER = [
    'id', 'name', 'label', 'ready', 'failed', 'definition', 'device', 'impl', 'attributes',
    'vUnmodified', 'fUnmodified', 'cUnmodified', 'meshUniformBufferFormat', 'meshBindGroupFormat'
];

const SAMPLE_TYPE_NAMES = new Map([
    [SAMPLETYPE_FLOAT, 'float'], [SAMPLETYPE_UNFILTERABLE_FLOAT, 'unfilterable-float'], [SAMPLETYPE_DEPTH, 'depth'],
    [SAMPLETYPE_INT, 'int'], [SAMPLETYPE_UINT, 'uint']
]);

/**
 * @param {Shader} shader - A shader.
 * @returns {string} The language of its source.
 */
function languageName(shader) {
    return shader.definition.shaderLanguage === SHADERLANGUAGE_WGSL ? 'WGSL' : 'GLSL';
}

/**
 * @param {Shader} shader - A shader.
 * @returns {string} The compilation state: 'failed', 'ready' or 'compiling'.
 */
function stateName(shader) {
    return shader.failed ? 'failed' : shader.ready ? 'ready' : 'compiling';
}

/**
 * @param {string} source - Shader source code.
 * @returns {string} Its length in lines.
 */
function sourceLines(source) {
    const lines = source.split('\n').length;
    return `${lines} line${lines === 1 ? '' : 's'}`;
}

/**
 * @param {string} label - The version label.
 * @param {string|null|undefined} source - The source, if kept.
 * @returns {Described} A code row, or a note that the version is not available.
 */
function sourceRow(label, source) {
    if (typeof source !== 'string' || source === '') return { label, text: 'not kept', cls: 'null' };
    return { label, text: sourceLines(source), cls: 'num', code: source };
}

/**
 * The versions of one shader stage: the source as given, after the preprocessor resolved includes
 * and defines, and the text finally handed to the graphics API when the device rewrote it again,
 * for example to add uniform buffers or translate GLSL to WGSL.
 *
 * @param {Shader} shader - The shader.
 * @param {'v'|'f'|'c'} stage - The stage prefix.
 * @returns {Described} A row summarizing the stage, with one expandable item per version.
 */
function sourceVersions(shader, stage) {
    const definition = shader.definition;
    const impl = /** @type {any} */ (shader.impl);
    const preprocessed = definition[`${stage}shader`];
    const original = shader[`${stage}Unmodified`];
    const compiled = stage === 'c' ? impl?._computeCode :
        stage === 'v' ? (impl?._vertexCode ?? impl?._vsource) : (impl?._fragmentCode ?? impl?._fsource);

    const items = [];
    // the unmodified source is only kept in debug builds
    items.push(sourceRow('original', original));
    items.push(sourceRow('preprocessed', preprocessed));
    if (typeof compiled === 'string' && compiled !== preprocessed) items.push(sourceRow('compiled', compiled));

    const kept = items.filter(item => item.code).length;
    return { text: `${kept} version${kept === 1 ? '' : 's'}`, cls: kept ? 'obj' : 'null', items };
}

/**
 * @param {number} visibility - SHADERSTAGE_* flags.
 * @returns {string} The stages, comma separated.
 */
function stagesText(visibility) {
    const stages = [];
    if (visibility & SHADERSTAGE_VERTEX) stages.push('vertex');
    if (visibility & SHADERSTAGE_FRAGMENT) stages.push('fragment');
    if (visibility & SHADERSTAGE_COMPUTE) stages.push('compute');
    return stages.join(', ') || 'none';
}

/**
 * @param {string[]} rows - Rows of cells joined by tabs.
 * @returns {string} The rows with each column padded to its widest cell.
 */
function table(rows) {
    const cells = rows.map(row => row.split('\t'));
    const widths = [];
    for (const row of cells) {
        row.forEach((cell, i) => {
            widths[i] = Math.max(widths[i] ?? 0, cell.length);
        });
    }
    return cells.map(row => row.map((cell, i) => (i === row.length - 1 ? cell : cell.padEnd(widths[i]))).join('  ').trimEnd()).join('\n');
}

/**
 * Lays out a uniform buffer format as text: the std140 offsets, sizes and types of its uniforms.
 *
 * @param {UniformBufferFormat} format - The format.
 * @returns {string} The layout.
 */
function formatUniformBuffer(format) {
    const rows = ['offset\tsize\ttype\tname'];
    for (const uniform of format.uniforms) {
        const type = `${uniformTypeToName[uniform.type] ?? uniform.type}${uniform.count ? `[${uniform.count}]` : ''}`;
        rows.push(`${uniform.offset * 4}\t${uniform.byteSize}\t${type}\t${uniform.name}`);
    }
    return `uniform buffer, ${format.byteSize} bytes, ${format.uniforms.length} uniform${format.uniforms.length === 1 ? '' : 's'}\n${table(rows)}`;
}

/**
 * Lays out a bind group format as text: its uniform buffers, textures and storage resources with
 * their slots and the stages that can see them.
 *
 * @param {BindGroupFormat} format - The format.
 * @returns {string} The layout.
 */
function formatBindGroup(format) {
    const rows = ['slot\tkind\tname\tdetails\tstages'];
    for (const ub of format.uniformBufferFormats) {
        rows.push(`${ub.slot}\tuniform buffer\t${ub.name}\t\t${stagesText(ub.visibility)}`);
    }
    for (const texture of format.textureFormats) {
        const details = `${texture.textureDimension} ${SAMPLE_TYPE_NAMES.get(texture.sampleType) ?? texture.sampleType}` +
            `${texture.multisampled ? ' multisampled' : ''}${texture.hasSampler ? ` + sampler ${texture.samplerName ?? ''}`.trimEnd() : ''}`;
        rows.push(`${texture.slot}\ttexture\t${texture.name}\t${details}\t${stagesText(texture.visibility)}`);
    }
    for (const buffer of format.storageBufferFormats) {
        rows.push(`${buffer.slot}\tstorage buffer\t${buffer.name}\t${buffer.readOnly ? 'read-only' : 'read-write'}\t${stagesText(buffer.visibility)}`);
    }
    for (const texture of format.storageTextureFormats) {
        const access = texture.write && texture.read ? 'read-write' : texture.write ? 'write-only' : 'read-only';
        rows.push(`${texture.slot}\tstorage texture\t${texture.name}\t${texture.textureDimension} ${pixelFormatInfo.get(texture.format)?.name ?? texture.format} ${access}\t${stagesText(texture.visibility)}`);
    }
    const count = rows.length - 1;
    return `bind group, ${count} binding${count === 1 ? '' : 's'}\n${table(rows)}`;
}

/**
 * @param {string} label - What the layout describes.
 * @param {UniformBufferFormat|BindGroupFormat|null|undefined} format - The format.
 * @param {(format: any) => string} render - The text layout of the format.
 * @returns {Described} A code row, or a note that there is no format.
 */
function formatRow(label, format, render) {
    if (!format) return { label, text: 'none', cls: 'null' };
    let text;
    if (label.includes('uniform')) {
        text = `${format.byteSize} bytes`;
    } else {
        const count = format.uniformBufferFormats.length + format.textureFormats.length + format.storageBufferFormats.length + format.storageTextureFormats.length;
        text = `${count} binding${count === 1 ? '' : 's'}`;
    }
    return { label, text, cls: 'num', code: render(format) };
}

/**
 * The bind groups a shader is processed against: the view and material groups from its processing
 * options, and the mesh groups the device generated from its uniforms.
 *
 * @param {Shader} shader - The shader.
 * @returns {PropertySection} The section, one row per group.
 */
function bindGroupSection(shader) {
    const section = makeSection('groups', 'Bind groups');
    const options = shader.definition.processingOptions;
    const impl = /** @type {any} */ (shader.impl);

    if (!options && !shader.meshUniformBufferFormat && !shader.meshBindGroupFormat && !impl?.computeBindGroupFormat) {
        push(section, 'layout', { text: 'not processed against bind groups', cls: 'null' });
        return section;
    }

    bindGroupNames.forEach((name, index) => {
        const uniformFormat = index === 3 ? shader.meshUniformBufferFormat : options?.uniformFormats?.[index];
        const bindGroupFormat = index === 2 ? shader.meshBindGroupFormat : options?.bindGroupFormats?.[index];
        if (!uniformFormat && !bindGroupFormat) return;
        const items = [];
        if (uniformFormat) items.push(formatRow('uniform buffer', uniformFormat, formatUniformBuffer));
        if (bindGroupFormat) items.push(formatRow('bindings', bindGroupFormat, formatBindGroup));
        push(section, `group ${index} · ${name}`, { text: items.map(item => item.text).join(', '), cls: 'obj', items });
    });

    if (impl?.computeBindGroupFormat) {
        const items = [formatRow('bindings', impl.computeBindGroupFormat, formatBindGroup)];
        if (impl.computeReflectedUniformBufferFormat) items.push(formatRow('uniform buffer', impl.computeReflectedUniformBufferFormat, formatUniformBuffer));
        push(section, 'compute', { text: items.map(item => item.text).join(', '), cls: 'obj', items });
    }

    return section;
}

/**
 * Every shader alive on the device, in creation order. A shader whose definition had no source
 * never reached the device and is not listed; one that failed to compile is.
 *
 * @param {GraphicsDevice} device - The device.
 * @returns {Shader[]} The shaders.
 */
function collectShaders(device) {
    return [...device.shaders ?? []];
}

/**
 * One row per shader on the device, tagged with its language, compute shaders and failures.
 *
 * @param {GraphicsDevice} device - The device.
 * @returns {ListRow[]} The rows.
 */
function shaderRows(device) {
    return collectShaders(device).map((shader) => {
        const name = shader.name;
        const compute = !!shader.definition.cshader;
        const cells = [{ text: name, cls: 'pci-cell-name' }];
        cells.push({ text: languageName(shader), cls: 'pci-cell-tag pci-cell-tag-info' });
        if (compute) cells.push({ text: 'compute', cls: 'pci-cell-tag pci-cell-tag-info' });
        if (shader.failed) cells.push({ text: 'failed', cls: 'pci-cell-tag' });
        cells.push({ text: `#${shader.id}`, cls: 'pci-cell-info pci-cell-right' });
        return { key: `shader${shader.id}`, item: shader, name, dim: !shader.ready, title: `${shader.label}\n${stateName(shader)}`, cells };
    });
}

/**
 * Everything the property view shows for a shader: identity and state, every kept version of its
 * sources, the bind group layouts it was processed against, its vertex attributes, and every
 * other public property.
 *
 * @param {Shader} shader - The shader.
 * @returns {PropertySection[]} The sections.
 */
function buildShaderModel(shader) {
    const sections = [];
    const definition = shader.definition;

    const general = makeSection('shader', 'Shader');
    push(general, 'name', describeValue(shader.name));
    push(general, 'id', describeValue(shader.id));
    push(general, 'language', { text: languageName(shader), cls: 'obj' });
    push(general, 'state', { text: stateName(shader), cls: shader.failed ? 'err' : shader.ready ? 'bool' : 'null' });
    if (definition.useTransformFeedback) push(general, 'transform feedback', describeValue(definition.feedbackVaryings ?? true));
    sections.push(general);

    // each version of each stage expands into a code block
    const sources = makeSection('sources', 'Sources');
    if (definition.cshader) {
        push(sources, 'compute', sourceVersions(shader, 'c'));
    } else {
        push(sources, 'vertex', sourceVersions(shader, 'v'));
        push(sources, 'fragment', sourceVersions(shader, 'f'));
    }
    sections.push(sources);

    sections.push(bindGroupSection(shader));

    const attributes = makeSection('attributes', 'Vertex attributes');
    push(attributes, 'declared', describeValue(definition.attributes ?? null));
    push(attributes, 'used', describeValue(shader.attributes));
    sections.push(attributes);

    const rest = makeSection('props', 'Properties');
    reflectRows(rest, shader, [], SKIP_SHADER);
    if (rest.rows.length) sections.push(rest);

    return sections;
}

export { buildShaderModel, collectShaders, formatBindGroup, formatUniformBuffer, shaderRows, stateName };
