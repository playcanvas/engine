import { Debug } from '../../../core/debug.js';
import {
    BINDGROUP_MESH, semanticToLocation,
    SHADERSTAGE_VERTEX, SHADERSTAGE_FRAGMENT,
    SAMPLETYPE_FLOAT,
    TEXTUREDIMENSION_2D, TEXTUREDIMENSION_2D_ARRAY, TEXTUREDIMENSION_CUBE, TEXTUREDIMENSION_3D,
    TEXTUREDIMENSION_1D, TEXTUREDIMENSION_CUBE_ARRAY,
    SAMPLETYPE_INT, SAMPLETYPE_UINT, SAMPLETYPE_DEPTH, SAMPLETYPE_UNFILTERABLE_FLOAT,
    BINDGROUP_MESH_UB,
    uniformTypeToNameWGSL,
    uniformTypeToNameMapWGSL,
    bindGroupNames,
    UNIFORMTYPE_FLOAT,
    UNUSED_UNIFORM_NAME,
    TYPE_FLOAT32, TYPE_FLOAT16, TYPE_INT8, TYPE_INT16, TYPE_INT32
} from '../constants.js';
import { UniformFormat, UniformBufferFormat } from '../uniform-buffer-format.js';
import { BindGroupFormat, BindStorageBufferFormat, BindTextureFormat } from '../bind-group-format.js';

/**
 * @import { GraphicsDevice } from '../graphics-device.js'
 * @import { ShaderProcessorOptions } from '../shader-processor-options.js'
 * @import { Shader } from '../shader.js'
 */

// matches lines where the keyword is the first non-whitespace content, followed by a whitespace
const KEYWORD = /^[ \t]*(attribute|varying|uniform)[\t ]+/gm;

// match 'attribute' and anything else till ';'
// eslint-disable-next-line
const KEYWORD_LINE = /^[ \t]*(attribute|varying|uniform)[ \t]*([^;]+)(;+)/gm;

// match global variables
//   branch A matches: var<storage,...>
//   branch B matches: texture, storage buffer, storage texture or external texture
// eslint-disable-next-line
const KEYWORD_RESOURCE = /^[ \t]*var\s*(?:(<storage,[^>]*>)\s*([\w\d_]+)\s*:\s*(.*?)\s*;|(<(?!storage,)[^>]*>)?\s*([\w\d_]+)\s*:\s*(texture_.*|storage_texture_.*|storage\w.*|external_texture|sampler(?:_comparison)?)\s*;)\s*$/gm;

// match varying name from string like: '@interpolate(perspective, centroid) smoothColor : vec3f;'
// eslint-disable-next-line
const VARYING = /(?:@interpolate\([^)]*\)\s*)?([\w]+)\s*:\s*([\w<>]+)/;

// marker for a place in the source code to be replaced by code
const MARKER = '@@@';

// matches vertex of fragment entry function, extracts the input name. Ends at the start of the function body '{'.
const ENTRY_FUNCTION = /(@vertex|@fragment)\s*fn\s+\w+\s*\(\s*(\w+)\s*:[\s\S]*?\{/;

const textureBaseInfo = {
    'texture_1d': { viewDimension: TEXTUREDIMENSION_1D, baseSampleType: SAMPLETYPE_FLOAT },
    'texture_2d': { viewDimension: TEXTUREDIMENSION_2D, baseSampleType: SAMPLETYPE_FLOAT },
    'texture_2d_array': { viewDimension: TEXTUREDIMENSION_2D_ARRAY, baseSampleType: SAMPLETYPE_FLOAT },
    'texture_3d': { viewDimension: TEXTUREDIMENSION_3D, baseSampleType: SAMPLETYPE_FLOAT },
    'texture_cube': { viewDimension: TEXTUREDIMENSION_CUBE, baseSampleType: SAMPLETYPE_FLOAT },
    'texture_cube_array': { viewDimension: TEXTUREDIMENSION_CUBE_ARRAY, baseSampleType: SAMPLETYPE_FLOAT },
    'texture_multisampled_2d': { viewDimension: TEXTUREDIMENSION_2D, baseSampleType: SAMPLETYPE_FLOAT },
    'texture_depth_2d': { viewDimension: TEXTUREDIMENSION_2D, baseSampleType: SAMPLETYPE_DEPTH },
    'texture_depth_2d_array': { viewDimension: TEXTUREDIMENSION_2D_ARRAY, baseSampleType: SAMPLETYPE_DEPTH },
    'texture_depth_cube': { viewDimension: TEXTUREDIMENSION_CUBE, baseSampleType: SAMPLETYPE_DEPTH },
    'texture_depth_cube_array': { viewDimension: TEXTUREDIMENSION_CUBE_ARRAY, baseSampleType: SAMPLETYPE_DEPTH },
    'texture_external': { viewDimension: TEXTUREDIMENSION_2D, baseSampleType: SAMPLETYPE_UNFILTERABLE_FLOAT }
};

// get the view dimension and sample type for a given texture type
// example: texture_2d_array<u32> -> 2d_array & uint
const getTextureInfo = (baseType, componentType) => {
    const baseInfo = textureBaseInfo[baseType];
    Debug.assert(baseInfo);

    let finalSampleType = baseInfo.baseSampleType;
    if (baseInfo.baseSampleType === SAMPLETYPE_FLOAT && baseType !== 'texture_multisampled_2d') {
        switch (componentType) {
            case 'u32': finalSampleType = SAMPLETYPE_UINT; break;
            case 'i32': finalSampleType = SAMPLETYPE_INT; break;
            case 'f32': finalSampleType = SAMPLETYPE_FLOAT; break;

            // custom 'uff' type for unfilterable float, allowing us to create correct bind, which is automatically generated based on the shader
            case 'uff': finalSampleType = SAMPLETYPE_UNFILTERABLE_FLOAT; break;
        }
    }

    return {
        viewDimension: baseInfo.viewDimension,
        sampleType: finalSampleType
    };
};

// reverse to getTextureInfo, convert view dimension and sample type to texture declaration
// example: 2d_array & float -> texture_2d_array<f32>
const getTextureDeclarationType = (viewDimension, sampleType) => {

    // types without template specifiers
    if (sampleType === SAMPLETYPE_DEPTH) {
        switch (viewDimension) {
            case TEXTUREDIMENSION_2D:         return 'texture_depth_2d';
            case TEXTUREDIMENSION_2D_ARRAY:   return 'texture_depth_2d_array';
            case TEXTUREDIMENSION_CUBE:       return 'texture_depth_cube';
            case TEXTUREDIMENSION_CUBE_ARRAY: return 'texture_depth_cube_array';
            default: Debug.assert(false);
        }
    }

    // the base texture type string based on dimension
    let baseTypeString;
    switch (viewDimension) {
        case TEXTUREDIMENSION_1D:         baseTypeString = 'texture_1d'; break;
        case TEXTUREDIMENSION_2D:         baseTypeString = 'texture_2d'; break;
        case TEXTUREDIMENSION_2D_ARRAY:   baseTypeString = 'texture_2d_array'; break;
        case TEXTUREDIMENSION_3D:         baseTypeString = 'texture_3d'; break;
        case TEXTUREDIMENSION_CUBE:       baseTypeString = 'texture_cube'; break;
        case TEXTUREDIMENSION_CUBE_ARRAY: baseTypeString = 'texture_cube_array'; break;
        default: Debug.assert(false);
    }

    // component format string ('f32', 'u32', 'i32')
    let coreFormatString;
    switch (sampleType) {
        case SAMPLETYPE_FLOAT:
        case SAMPLETYPE_UNFILTERABLE_FLOAT: coreFormatString = 'f32'; break;
        case SAMPLETYPE_UINT: coreFormatString = 'u32'; break;
        case SAMPLETYPE_INT: coreFormatString = 'i32'; break;
        default: Debug.assert(false);
    }

    // final type
    return `${baseTypeString}<${coreFormatString}>`;
};

const wrappedArrayTypes = {
    'f32': 'WrappedF32',
    'i32': 'WrappedI32',
    'u32': 'WrappedU32',
    'vec2f': 'WrappedVec2F',
    'vec2i': 'WrappedVec2I',
    'vec2u': 'WrappedVec2U'
};

const splitToWords = (line) => {
    // remove any double spaces
    line = line.replace(/\s+/g, ' ').trim();

    // Split by spaces or ':' symbol
    return line.split(/[\s:]+/);
};

// matches: array<f32, 4>;
// eslint-disable-next-line
const UNIFORM_ARRAY_REGEX = /array<([^,]+),\s*([^>]+)>/;

class UniformLine {
    /**
     * A name of the ub buffer which this uniform is assigned to.
     *
     * @type {string|null}
     */
    ubName = null;

    arraySize = 0;

    constructor(line, shader) {
        // Save the raw line
        this.line = line;

        // Use splitToWords to split the line into parts
        const parts = splitToWords(line);

        if (parts.length < 2) {
            Debug.error(`Invalid uniform line format: ${line}`, shader);
            shader.failed = true;
            return;
        }

        // Extract the name and type
        this.name = parts[0];
        this.type = parts.slice(1).join(' ');

        // array of uniforms (e.g. array<f32, 5>)
        if (this.type.includes('array<')) {

            const match = UNIFORM_ARRAY_REGEX.exec(this.type);
            Debug.assert(match, `Array type on line [${line}] is not supported.`);

            // array type
            this.type = match[1].trim();

            this.arraySize = Number(match[2]);
            if (isNaN(this.arraySize)) {
                shader.failed = true;
                Debug.error(`Only numerically specified uniform array sizes are supported, this uniform is not supported: '${line}'`, shader);
            }
        }
    }
}

// regex constants for resource lines, for example:
//     var diffuseTexture : texture_2d<f32>;
//     var diffuseTextures : texture_2d_array<f32>;
//     var shadowMap : texture_depth_2d;
//     var diffuseSampler : sampler;
//     var<storage, read> particles: array<Particle>;
//     var<storage, read_write> storageBuffer : Buffer;
//     var storageTexture : texture_storage_2d<rgba8unorm, write>;
//     var videoTexture : texture_external;

const TEXTURE_REGEX = /^\s*var\s+(\w+)\s*:\s*(texture_\w+)(?:<(\w+)>)?;\s*$/;
// eslint-disable-next-line
const STORAGE_TEXTURE_REGEX = /^\s*var\s+([\w\d_]+)\s*:\s*(texture_storage_2d|texture_storage_2d_array)<([\w\d_]+),\s*(\w+)>\s*;\s*$/;
// eslint-disable-next-line
const STORAGE_BUFFER_REGEX = /^\s*var\s*<storage,\s*(read|write)?>\s*([\w\d_]+)\s*:\s*(.*)\s*;\s*$/;
// eslint-disable-next-line
const EXTERNAL_TEXTURE_REGEX = /^\s*var\s+([\w\d_]+)\s*:\s*texture_external;\s*$/;
// eslint-disable-next-line
const SAMPLER_REGEX = /^\s*var\s+([\w\d_]+)\s*:\s*(sampler|sampler_comparison)\s*;\s*$/;

// ResourceLine class to parse the resource declarations
class ResourceLine {
    constructor(line, shader) {
        // save the raw line
        this.originalLine = line;
        this.line = line;

        // defaults
        this.isTexture = false;
        this.isSampler = false;
        this.isStorageTexture = false;
        this.isStorageBuffer = false;
        this.isExternalTexture = false;
        this.type = '';
        this.matchedElements = [];

        // handle texture type
        const textureMatch = this.line.match(TEXTURE_REGEX);
        if (textureMatch) {
            this.name = textureMatch[1];
            this.type = textureMatch[2]; // texture type (e.g., texture_2d or texture_cube_array)
            this.textureFormat = textureMatch[3]; // texture format (e.g., f32)
            this.isTexture = true;
            this.matchedElements.push(...textureMatch);

            // get dimension and sample type
            const info = getTextureInfo(this.type, this.textureFormat);
            Debug.assert(info);
            this.textureDimension = info.viewDimension;
            this.sampleType = info.sampleType;
        }

        // storage texture (e.g., texture_storage_2d<rgba8unorm, write>)
        const storageTextureMatch = this.line.match(STORAGE_TEXTURE_REGEX);
        if (storageTextureMatch) {
            this.isStorageTexture = true;
            this.name = storageTextureMatch[1];
            this.textureType = storageTextureMatch[2]; // texture_storage_2d or texture_storage_2d_array
            this.format = storageTextureMatch[3]; // format (e.g., rgba8unorm)
            this.access = storageTextureMatch[4]; // access mode (e.g., write)
            this.matchedElements.push(...storageTextureMatch);
        }

        // storage buffer (e.g., <storage, read> particles: array<Particle>;)
        const storageBufferMatch = this.line.match(STORAGE_BUFFER_REGEX);
        if (storageBufferMatch) {
            this.isStorageBuffer = true;
            this.accessMode = storageBufferMatch[1] || 'none'; // Default to 'none' if no access mode
            this.name = storageBufferMatch[2];
            this.type = storageBufferMatch[3]; // Everything after ':' (e.g., array<Particle>)
            this.matchedElements.push(...storageBufferMatch);
        }

        // external texture (e.g., texture_external)
        const externalTextureMatch = this.line.match(EXTERNAL_TEXTURE_REGEX);
        if (externalTextureMatch) {
            this.name = externalTextureMatch[1];
            this.isExternalTexture = true;
            this.matchedElements.push(...storageBufferMatch);
        }

        // sampler
        const samplerMatch = this.line.match(SAMPLER_REGEX);
        if (samplerMatch) {
            this.name = samplerMatch[1];
            this.samplerType = samplerMatch[2]; // sampler type (e.g., sampler or sampler_comparison)
            this.isSampler = true;
            this.matchedElements.push(...samplerMatch);
        }

        if (this.matchedElements.length === 0) {
            Debug.error(`Invalid / unsupported resource line format: ${line}`, shader);
            shader.failed = true;
        }
    }

    equals(other) {
        if (this.name !== other.name) return false;
        if (this.type !== other.type) return false;
        if (this.isTexture !== other.isTexture) return false;
        if (this.isSampler !== other.isSampler) return false;
        if (this.isStorageTexture !== other.isStorageTexture) return false;
        if (this.isStorageBuffer !== other.isStorageBuffer) return false;
        if (this.isExternalTexture !== other.isExternalTexture) return false;
        if (this.textureFormat !== other.textureFormat) return false;
        if (this.textureDimension !== other.textureDimension) return false;
        if (this.sampleType !== other.sampleType) return false;
        if (this.textureType !== other.textureType) return false;
        if (this.format !== other.format) return false;
        if (this.access !== other.access) return false;
        if (this.accessMode !== other.accessMode) return false;
        if (this.samplerType !== other.samplerType) return false;
        return true;
    }
}

/**
 * Pure static class implementing processing of WGSL shaders. It allocates fixed locations for
 * attributes, and handles conversion of uniforms to uniform buffers.
 */
class WebgpuShaderProcessorWGSL {
    /**
     * Process the shader.
     *
     * @param {GraphicsDevice} device - The graphics device.
     * @param {object} shaderDefinition - The shader definition.
     * @param {Shader} shader - The shader.
     * @returns {object} - The processed shader data.
     */
    static run(device, shaderDefinition, shader) {

        /** @type {Map<string, number>} */
        const varyingMap = new Map();

        // extract lines of interests from both shaders
        const vertexExtracted = WebgpuShaderProcessorWGSL.extract(shaderDefinition.vshader);
        const fragmentExtracted = WebgpuShaderProcessorWGSL.extract(shaderDefinition.fshader);

        // VS - convert a list of attributes to a shader block with fixed locations
        const attributesMap = new Map();
        const attributesBlock = WebgpuShaderProcessorWGSL.processAttributes(vertexExtracted.attributes, shaderDefinition.attributes, attributesMap, shaderDefinition.processingOptions, shader);

        // VS - convert a list of varyings to a shader block
        const vertexVaryingsBlock = WebgpuShaderProcessorWGSL.processVaryings(vertexExtracted.varyings, varyingMap, true, device);

        // FS - convert a list of varyings to a shader block
        const fragmentVaryingsBlock = WebgpuShaderProcessorWGSL.processVaryings(fragmentExtracted.varyings, varyingMap, false, device);

        // uniforms - merge vertex and fragment uniforms, and create shared uniform buffers
        // Note that as both vertex and fragment can declare the same uniform, we need to remove duplicates
        const concatUniforms = vertexExtracted.uniforms.concat(fragmentExtracted.uniforms);
        const uniforms = Array.from(new Set(concatUniforms));

        // parse uniform lines
        const parsedUniforms = uniforms.map(line => new UniformLine(line, shader));

        // validation - as uniforms go to a shared uniform buffer, vertex and fragment versions need to match
        Debug.call(() => {
            const map = new Map();
            parsedUniforms.forEach((uni) => {
                const existing = map.get(uni.name);
                Debug.assert(!existing, `Vertex and fragment shaders cannot use the same uniform name with different types: '${existing}' and '${uni.line}'`, shader);
                map.set(uni.name, uni.line);
            });
        });
        const uniformsData = WebgpuShaderProcessorWGSL.processUniforms(device, parsedUniforms, shaderDefinition.processingOptions, shader);

        // rename references to uniforms to match the uniform buffer
        vertexExtracted.src = WebgpuShaderProcessorWGSL.renameUniformAccess(vertexExtracted.src, parsedUniforms);
        fragmentExtracted.src = WebgpuShaderProcessorWGSL.renameUniformAccess(fragmentExtracted.src, parsedUniforms);

        // parse resource lines
        const parsedResources = WebgpuShaderProcessorWGSL.mergeResources(vertexExtracted.resources, fragmentExtracted.resources, shader);
        const resourcesData = WebgpuShaderProcessorWGSL.processResources(device, parsedResources, shaderDefinition.processingOptions, shader);

        // generate fragment output struct
        const fOutput = WebgpuShaderProcessorWGSL.generateFragmentOutputStruct(fragmentExtracted.src, device.maxColorAttachments);

        // inject the call to the function which copies the shader input globals
        vertexExtracted.src = WebgpuShaderProcessorWGSL.copyInputs(vertexExtracted.src, shader);
        fragmentExtracted.src = WebgpuShaderProcessorWGSL.copyInputs(fragmentExtracted.src, shader);

        // VS - insert the blocks to the source
        const vBlock = `${attributesBlock}\n${vertexVaryingsBlock}\n${uniformsData.code}\n${resourcesData.code}\n`;
        const vshader = vertexExtracted.src.replace(MARKER, vBlock);

        // FS - insert the blocks to the source
        const fBlock = `${fragmentVaryingsBlock}\n${fOutput}\n${uniformsData.code}\n${resourcesData.code}\n`;
        const fshader = fragmentExtracted.src.replace(MARKER, fBlock);

        return {
            vshader: vshader,
            fshader: fshader,
            attributes: attributesMap,
            meshUniformBufferFormat: uniformsData.meshUniformBufferFormat,
            meshBindGroupFormat: resourcesData.meshBindGroupFormat
        };
    }

    // Extract required information from the shader source code.
    static extract(src) {
        // collected data
        const attributes = [];
        const varyings = [];
        const uniforms = [];
        const resources = [];

        // replacement marker - mark a first replacement place
        let replacement = `${MARKER}\n`;

        let match;

        // Extract uniforms, attributes, and varyings
        while ((match = KEYWORD.exec(src)) !== null) {
            const keyword = match[1];

            KEYWORD_LINE.lastIndex = match.index;
            const lineMatch = KEYWORD_LINE.exec(src);

            if (keyword === 'attribute') {
                attributes.push(lineMatch[2]);
            } else if (keyword === 'varying') {
                varyings.push(lineMatch[2]);
            } else if (keyword === 'uniform') {
                uniforms.push(lineMatch[2]);
            }

            // Remove the matched line from source
            src = WebgpuShaderProcessorWGSL.cutOut(src, match.index, KEYWORD_LINE.lastIndex, replacement);
            KEYWORD.lastIndex = match.index + replacement.length;
            replacement = ''; // Only place a single replacement marker
        }

        // Extract resource declarations
        while ((match = KEYWORD_RESOURCE.exec(src)) !== null) {
            resources.push(match[0]); // Store the full line

            // Remove the matched line from source
            src = WebgpuShaderProcessorWGSL.cutOut(src, match.index, KEYWORD_RESOURCE.lastIndex, replacement);
            KEYWORD_RESOURCE.lastIndex = match.index + replacement.length;
            replacement = '';
        }

        return {
            src,
            attributes,
            varyings,
            uniforms,
            resources
        };
    }

    /**
     * Process the lines with uniforms. The function receives the lines containing all numerical
     * uniforms. The function also receives the format of uniform buffers for view and material
     * level. All uniforms that match any of those are ignored, as those would be supplied by view /
     * material level buffers. All leftover uniforms create uniform buffer and bind group for the
     * mesh itself, containing uniforms that change on the level of the mesh.
     *
     * @param {GraphicsDevice} device - The graphics device.
     * @param {Array<UniformLine>} uniforms - Lines containing uniforms.
     * @param {ShaderProcessorOptions} processingOptions - Uniform formats.
     * @param {Shader} shader - The shader definition.
     * @returns {object} - The uniform data. Returns a shader code block containing uniforms, to be
     * inserted into the shader, as well as generated uniform format structures for the mesh level.
     */
    static processUniforms(device, uniforms, processingOptions, shader) {

        // build mesh uniform buffer format
        const meshUniforms = [];
        uniforms.forEach((uniform) => {
            // uniforms not already in supplied uniform buffers go to the mesh buffer
            if (!processingOptions.hasUniform(uniform.name)) {

                uniform.ubName = 'ub_mesh_ub';

                // Find the uniform type index in uniformTypeToNameWGSL
                const uniformType = uniformTypeToNameMapWGSL.get(uniform.type);
                Debug.assert(uniformType !== undefined, `Uniform type ${uniform.type} is not recognised on line [${uniform.line}]`);

                const uniformFormat = new UniformFormat(uniform.name, uniformType, uniform.arraySize);
                meshUniforms.push(uniformFormat);
            } else {

                // TODO: when we add material ub, this name will need to be updated
                uniform.ubName = 'ub_view';

                // Validate types here if needed
                Debug.assert(true, `Uniform ${uniform.name} already processed, skipping additional validation.`);
            }
        });

        // if we don't have any uniform, add a dummy uniform to avoid empty uniform buffer - WebGPU rendering does not
        // support rendering will NULL bind group as binding a null buffer changes placement of other bindings
        if (meshUniforms.length === 0) {
            meshUniforms.push(new UniformFormat(UNUSED_UNIFORM_NAME, UNIFORMTYPE_FLOAT));
        }

        const meshUniformBufferFormat = new UniformBufferFormat(device, meshUniforms);

        // generate code for uniform buffers, starts on the slot 0
        let code = '';
        processingOptions.uniformFormats.forEach((format, bindGroupIndex) => {
            if (format) {
                code += WebgpuShaderProcessorWGSL.getUniformShaderDeclaration(format, bindGroupIndex, 0);
            }
        });

        // and also for generated mesh uniform format, which is at the slot 0 of the bind group
        if (meshUniformBufferFormat) {
            code += WebgpuShaderProcessorWGSL.getUniformShaderDeclaration(meshUniformBufferFormat, BINDGROUP_MESH_UB, 0);
        }

        return {
            code,
            meshUniformBufferFormat
        };
    }

    /**
     * Source code references uniforms as `uniform.name`, but swap those to reference the actual uniform buffer
     * the uniform was assigned to, for example `ub_view.name`.
     *
     * @param {string} source - The source code.
     * @param {Array<UniformLine>} uniforms - Lines containing uniforms.
     * @returns {string} - The source code with updated uniform references.
     */
    static renameUniformAccess(source, uniforms) {
        uniforms.forEach((uniform) => {
            const srcName = `uniform.${uniform.name}`;
            const dstName = `${uniform.ubName}.${uniform.name}`;
            // Use a regular expression to match `uniform.name` as a whole word.
            const regex = new RegExp(`\\b${srcName}\\b`, 'g');
            source = source.replace(regex, dstName);
        });
        return source;
    }

    static mergeResources(vertex, fragment, shader) {

        const resources = vertex.map(line => new ResourceLine(line, shader));
        const fragmentResources = fragment.map(line => new ResourceLine(line, shader));

        // merge fragment list to resources, removing exact duplicates
        fragmentResources.forEach((fragmentResource) => {
            const existing = resources.find(resource => resource.name === fragmentResource.name);
            if (existing) {
                // if the resource is already in the list, check if it matches
                if (!existing.equals(fragmentResource)) {
                    Debug.error(`Resource '${fragmentResource.name}' is declared with different types in vertex and fragment shaders.`, {
                        vertexLine: existing.line,
                        fragmentLine: fragmentResource.line,
                        shader,
                        vertexResource: existing,
                        fragmentResource
                    });
                    shader.failed = true;
                }
            } else {
                resources.push(fragmentResource);
            }
        });

        return resources;
    }

    static processResources(device, resources, processingOptions, shader) {

        // build mesh bind group format - this contains the textures, but not the uniform buffer as that is a separate binding
        const textureFormats = [];
        for (let i = 0; i < resources.length; i++) {

            const resource = resources[i];

            if (resource.isTexture) {

                // followed by optional sampler uniform
                const sampler = resources[i + 1];
                const hasSampler = sampler?.isSampler;

                // TODO: handle external, and storage types
                const sampleType = resource.sampleType;
                const dimension = resource.textureDimension;

                // TODO: we could optimize visibility to only stages that use any of the data
                textureFormats.push(new BindTextureFormat(resource.name, SHADERSTAGE_VERTEX | SHADERSTAGE_FRAGMENT, dimension, sampleType, hasSampler, hasSampler ? sampler.name : null));

                // following sampler was already handled
                if (hasSampler) i++;
            }

            if (resource.isStorageBuffer) {

                const readOnly = resource.accessMode !== 'read_write';
                const bufferFormat = new BindStorageBufferFormat(resource.name, SHADERSTAGE_VERTEX | SHADERSTAGE_FRAGMENT, readOnly);
                bufferFormat.format = resource.type;
                textureFormats.push(bufferFormat);
            }

            Debug.assert(!resource.isSampler, `Sampler uniform needs to follow a texture uniform, but does not on line [${resource.originalLine}]`);
            Debug.assert(!resource.isStorageTexture, 'TODO: add support for storage textures here');
            Debug.assert(!resource.externalTexture, 'TODO: add support for external textures here');
        }

        const meshBindGroupFormat = new BindGroupFormat(device, textureFormats);

        // generate code for textures
        let code = '';
        processingOptions.bindGroupFormats.forEach((format, bindGroupIndex) => {
            if (format) {
                code += WebgpuShaderProcessorWGSL.getTextureShaderDeclaration(format, bindGroupIndex);
            }
        });

        // and also for generated mesh format
        code += WebgpuShaderProcessorWGSL.getTextureShaderDeclaration(meshBindGroupFormat, BINDGROUP_MESH);

        return {
            code,
            meshBindGroupFormat
        };
    }

    /**
     * Generates a shader code for a uniform buffer, something like:
     * ```
     *     struct ub_view { matrix_viewProjection : mat4x4f }
     *     @group(0) @binding(0) var<uniform> ubView : ub_view;
     * ```
     *
     * @param {UniformBufferFormat} ubFormat - Format of the uniform buffer.
     * @param {number} bindGroup - The bind group index.
     * @param {number} bindIndex - The bind index.
     * @returns {string} - The shader code for the uniform buffer.
     * @private
     */
    static getUniformShaderDeclaration(ubFormat, bindGroup, bindIndex) {

        const name = bindGroupNames[bindGroup];
        const structName = `struct_ub_${name}`;
        let code = `struct ${structName} {\n`;

        ubFormat.uniforms.forEach((uniform) => {
            let typeString = uniformTypeToNameWGSL[uniform.type][0];
            Debug.assert(typeString !== undefined, `Uniform type ${uniform.type} is not handled.`);

            // array uniforms
            if (uniform.count > 0) {

                // if the type is one of the ones that are not by default 16byte aligned, which is
                // a requirement for uniform buffers, we need to wrap them in a struct
                // for example: array<f32, 5> becomes  array<WrappedF32, 5>
                if (wrappedArrayTypes.hasOwnProperty(typeString)) {
                    typeString = wrappedArrayTypes[typeString];
                }

                code += `    ${uniform.shortName}: array<${typeString}, ${uniform.count}>,\n`;

            } else { // not arrays

                code += `    ${uniform.shortName}: ${typeString},\n`;
            }
        });

        code += '};\n';

        code += `@group(${bindGroup}) @binding(${bindIndex}) var<uniform> ub_${name} : ${structName};\n\n`;

        return code;
    }

    /**
     * Generates a shader code for a bind group, something like:
     * ```
     *    @group(0) @binding(0) var diffuseTexture: texture_2d<f32>;
     *    @group(0) @binding(1) var diffuseTexture_sampler: sampler;  // optional
     * ```
     * @param {BindGroupFormat} format - The format of the bind group.
     * @param {number} bindGroup - The bind group index.
     * @returns {string} - The shader code for the bind group.
     */
    static getTextureShaderDeclaration(format, bindGroup) {
        let code = '';

        format.textureFormats.forEach((format) => {

            const textureTypeName = getTextureDeclarationType(format.textureDimension, format.sampleType);
            code += `@group(${bindGroup}) @binding(${format.slot}) var ${format.name}: ${textureTypeName};\n`;

            if (format.hasSampler) {
                // A slot should have been left empty for the sampler at format.slot+1
                const samplerName = format.sampleType === SAMPLETYPE_DEPTH ? 'sampler_comparison' : 'sampler';
                code += `@group(${bindGroup}) @binding(${format.slot + 1}) var ${format.samplerName}: ${samplerName};\n`;
            }
        });

        format.storageBufferFormats.forEach((format) => {

            const access = format.readOnly ? 'read' : 'read_write';
            code += `@group(${bindGroup}) @binding(${format.slot}) var<storage, ${access}> ${format.name} : ${format.format};\n`;

        });

        Debug.assert(format.storageTextureFormats.length === 0, 'Implement support for storage textures here');
        // TODO: also add external texture support here

        return code;
    }

    static processVaryings(varyingLines, varyingMap, isVertex, device) {
        let block = '';
        let blockPrivates = '';
        let blockCopy = '';
        varyingLines.forEach((line, index) => {
            const match = line.match(VARYING);
            Debug.assert(match, `Varying line is not valid: ${line}`);

            if (match) {
                const name = match[1];
                const type = match[2];

                if (isVertex) {
                    // store it in the map
                    varyingMap.set(name, index);
                } else {
                    Debug.assert(varyingMap.has(name), `Fragment shader requires varying [${name}] but vertex shader does not generate it.`);
                    index = varyingMap.get(name);
                }

                // generates: `@location(0) @interpolate(perspective, centroid) smoothColor : vec3f`
                block += `    @location(${index}) ${line},\n`;

                // fragment shader inputs (varyings)
                if (!isVertex) {

                    // private global variable for fragment varying
                    blockPrivates += `    var<private> ${name}: ${type};\n`;

                    // copy input variable to the private variable
                    blockCopy += `    ${name} = input.${name};\n`;
                }
            }
        });

        // add built-in varyings
        if (isVertex) {
            block += '    @builtin(position) position : vec4f,\n';          // output position
        } else {
            block += '    @builtin(position) position : vec4f,\n';          // interpolated fragment position
            block += '    @builtin(front_facing) frontFacing : bool,\n';    // front-facing
            block += '    @builtin(sample_index) sampleIndex : u32,\n';     // sample index for MSAA
            if (device.supportsPrimitiveIndex) {
                block += '    @builtin(primitive_index) primitiveIndex : u32,\n';  // primitive index
            }
        }

        // primitive index support
        const primitiveIndexGlobals = device.supportsPrimitiveIndex ? `
            var<private> pcPrimitiveIndex: u32;
        ` : '';
        const primitiveIndexCopy = device.supportsPrimitiveIndex ? `
                pcPrimitiveIndex = input.primitiveIndex;
        ` : '';

        // global variables for build-in input into fragment shader
        const fragmentGlobals = isVertex ? '' : `
            var<private> pcPosition: vec4f;
            var<private> pcFrontFacing: bool;
            var<private> pcSampleIndex: u32;
            ${primitiveIndexGlobals}
            ${blockPrivates}
            
            // function to copy inputs (varyings) to private global variables
            fn _pcCopyInputs(input: FragmentInput) {
                ${blockCopy}
                pcPosition = input.position;
                pcFrontFacing = input.frontFacing;
                pcSampleIndex = input.sampleIndex;
                ${primitiveIndexCopy}
            }
        `;

        const structName = isVertex ? 'VertexOutput' : 'FragmentInput';
        return `
            struct ${structName} {
                ${block}
            };
            ${fragmentGlobals}
        `;
    }

    static generateFragmentOutputStruct(src, numRenderTargets) {
        let structCode = 'struct FragmentOutput {\n';

        for (let i = 0; i < numRenderTargets; i++) {
            structCode += `    @location(${i}) color${i > 0 ? i : ''} : pcOutType${i},\n`;
        }

        // find if the src contains `.fragDepth =`, ignoring whitespace before = sign
        const needsFragDepth = src.search(/\.fragDepth\s*=/) !== -1;
        if (needsFragDepth) {
            structCode += '    @builtin(frag_depth) fragDepth : f32\n';
        }

        return `${structCode}};\n`;
    }

    // convert a float attribute type to matching signed or unsigned int type
    // for example: vec4f -> vec4u, f32 -> u32
    static floatAttributeToInt(type, signed) {

        // convert any long-form type to short-form
        const longToShortMap = {
            'f32': 'f32',
            'vec2<f32>': 'vec2f',
            'vec3<f32>': 'vec3f',
            'vec4<f32>': 'vec4f'
        };
        const shortType = longToShortMap[type] || type;

        // map from float short type to int short type
        const floatToIntShort = {
            'f32': signed ? 'i32' : 'u32',
            'vec2f': signed ? 'vec2i' : 'vec2u',
            'vec3f': signed ? 'vec3i' : 'vec3u',
            'vec4f': signed ? 'vec4i' : 'vec4u'
        };

        return floatToIntShort[shortType] || null;
    }

    static processAttributes(attributeLines, shaderDefinitionAttributes = {}, attributesMap, processingOptions, shader) {
        let blockAttributes = '';
        let blockPrivates = '';
        let blockCopy = '';
        const usedLocations = {};
        attributeLines.forEach((line) => {
            const words = splitToWords(line);
            const name = words[0];
            let type = words[1];
            const originalType = type;

            if (shaderDefinitionAttributes.hasOwnProperty(name)) {
                const semantic = shaderDefinitionAttributes[name];
                const location = semanticToLocation[semantic];
                Debug.assert(location !== undefined, `Semantic ${semantic} used by the attribute ${name} is not known - make sure it's one of the supported semantics.`);

                Debug.assert(!usedLocations.hasOwnProperty(location),
                    `WARNING: Two vertex attributes are mapped to the same location in a shader: ${usedLocations[location]} and ${semantic}`);
                usedLocations[location] = semantic;

                // build a map of used attributes
                attributesMap.set(location, name);

                // if vertex format for this attribute is not of a float type, but shader specifies float type, convert the shader type
                // to match the vertex format type, for example: vec4f -> vec4u
                // Note that we skip normalized elements, as shader receives them as floats already.
                const element = processingOptions.getVertexElement(semantic);
                if (element) {
                    const dataType = element.dataType;
                    if (dataType !== TYPE_FLOAT32 && dataType !== TYPE_FLOAT16 && !element.normalize && !element.asInt) {

                        // new attribute type, based on the vertex format element type
                        const isSignedType = dataType === TYPE_INT8 || dataType === TYPE_INT16 || dataType === TYPE_INT32;
                        type = WebgpuShaderProcessorWGSL.floatAttributeToInt(type, isSignedType);
                        Debug.assert(type !== null, `Attribute ${name} has a type that cannot be converted to int: ${dataType}`);
                    }
                }

                // generates: @location(0) position : vec4f
                blockAttributes += `    @location(${location}) ${name}: ${type},\n`;

                // private global variable - this uses the original type
                blockPrivates += `    var<private> ${line};\n`;

                // copy input variable to the private variable - convert type if needed
                blockCopy += `    ${name} = ${originalType}(input.${name});\n`;
            } else {
                Debug.error(`Attribute ${name} is specified in the shader source, but is not defined in the shader definition, and so will be removed from the shader, as it cannot be used without a known semantic.`, { shaderDefinitionAttributes, shader });
            }
        });

        return `
            struct VertexInput {
                ${blockAttributes}
                @builtin(vertex_index) vertexIndex : u32,       // built-in vertex index
                @builtin(instance_index) instanceIndex : u32    // built-in instance index
            };

            ${blockPrivates}
            var<private> pcVertexIndex: u32;
            var<private> pcInstanceIndex: u32;

            fn _pcCopyInputs(input: VertexInput) {
                ${blockCopy}
                pcVertexIndex = input.vertexIndex;
                pcInstanceIndex = input.instanceIndex;
            }
        `;
    }

    /**
     * Injects a call to _pcCopyInputs with the function's input parameter right after the opening
     * brace of a WGSL function marked with `@vertex` or `@fragment`.
     *
     * @param {string} src - The source string containing the WGSL code.
     * @param {Shader} shader - The shader.
     * @returns {string} - The modified source string.
     */
    static copyInputs(src, shader) {
        // find @vertex or @fragment followed by the function signature and capture the input parameter name
        const match = src.match(ENTRY_FUNCTION);

        // check if match exists AND the parameter name (Group 2) was captured
        if (!match || !match[2]) {
            Debug.warn('No entry function found or input parameter name not captured.', { shader, src });
            return src;
        }

        const inputName = match[2];
        const braceIndex = match.index + match[0].length - 1; // Calculate the index of the '{'

        // inject the line right after the opening brace
        const beginning = src.slice(0, braceIndex + 1);
        const end = src.slice(braceIndex + 1);

        const lineToInject = `\n    _pcCopyInputs(${inputName});`;
        return beginning + lineToInject + end;
    }

    static cutOut(src, start, end, replacement) {
        return src.substring(0, start) + replacement + src.substring(end);
    }
}

export { WebgpuShaderProcessorWGSL };
