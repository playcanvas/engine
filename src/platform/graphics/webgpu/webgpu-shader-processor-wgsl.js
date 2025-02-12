import { Debug } from '../../../core/debug.js';
import {
    BINDGROUP_MESH, semanticToLocation,
    SHADERSTAGE_VERTEX, SHADERSTAGE_FRAGMENT,
    SAMPLETYPE_FLOAT,
    TEXTUREDIMENSION_2D, TEXTUREDIMENSION_2D_ARRAY, TEXTUREDIMENSION_CUBE, TEXTUREDIMENSION_3D,
    SAMPLETYPE_INT, SAMPLETYPE_UINT,
    BINDGROUP_MESH_UB,
    uniformTypeToNameWGSL,
    uniformTypeToNameMapWGSL,
    bindGroupNames,
    TEXTUREDIMENSION_1D,
    TEXTUREDIMENSION_CUBE_ARRAY,
    UNIFORMTYPE_FLOAT,
    UNUSED_UNIFORM_NAME
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

// match global variables of type texture, storage buffer, storage texture or external texture
// eslint-disable-next-line
const KEYWORD_RESOURCE = /^[ \t]*var\s*(<[^>]+>)?\s*[\w\d_]+\s*:\s*(texture_.*|storage_texture_.*|storage.*|external_texture|array<.*>|sampler|sampler_comparison).*;\s*$/gm;

// match varying name from string like: '@interpolate(perspective, centroid) smoothColor : vec3f;'
// eslint-disable-next-line
const VARYING = /(?:@interpolate\([^)]*\)\s*)?([\w]+)\s*:/;

// marker for a place in the source code to be replaced by code
const MARKER = '@@@';

const getTextureDimension = (textureType, isArray) => {
    if (isArray) {
        if (textureType === '2d') return TEXTUREDIMENSION_2D_ARRAY;
        else if (textureType === 'cube')  return TEXTUREDIMENSION_CUBE_ARRAY;
    } else {
        switch (textureType) {
            case '1d': return TEXTUREDIMENSION_1D;
            case '2d': return TEXTUREDIMENSION_2D;
            case '3d': return TEXTUREDIMENSION_3D;
            case 'cube': return TEXTUREDIMENSION_CUBE;
        }
    }
};

const getTextureTypeCode = (dimension, sampleType) => {
    const sampleFormat = sampleType === SAMPLETYPE_FLOAT ? 'f32' : (sampleType === SAMPLETYPE_INT ? 'i32' : 'u32');
    switch (dimension) {
        case TEXTUREDIMENSION_1D: return `texture_1d<${sampleFormat}>`;
        case TEXTUREDIMENSION_2D: return `texture_2d<${sampleFormat}>`;
        case TEXTUREDIMENSION_3D: return `texture_3d<${sampleFormat}>`;
        case TEXTUREDIMENSION_CUBE: return `texture_cube<${sampleFormat}>`;
        case TEXTUREDIMENSION_2D_ARRAY: return `texture_2d_array<${sampleFormat}>`;
        case TEXTUREDIMENSION_CUBE_ARRAY: return `texture_cube_array<${sampleFormat}>`;
    }
};

const textureFormat2SampleType = {
    'f32': SAMPLETYPE_FLOAT,
    'i32': SAMPLETYPE_INT,
    'u32': SAMPLETYPE_UINT
};

const splitToWords = (line) => {
    // remove any double spaces
    line = line.replace(/\s+/g, ' ').trim();

    // Split by spaces or ':' symbol
    return line.split(/[\s:]+/);
};

class UniformLine {
    /**
     * A name of the ub buffer which this uniform is assigned to.
     *
     * @type {string|null}
     */
    ubName = null;

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
    }
}

// regex constants for resource lines, for example:
//     var diffuseTexture : texture_2d<f32>;
//     var textureArray: array<texture_2d<f32>, 5>;
//     var diffuseSampler : sampler;
//     var<storage, read> particles: array<Particle>;
//     var<storage, read_write> storageBuffer : Buffer;
//     var storageTexture : texture_storage_2d<rgba8unorm, write>;
//     var videoTexture : texture_external;
// eslint-disable-next-line
const ARRAY_REGEX = /^\s*var\s+([\w\d_]+)\s*:\s*array<([\w\d_<>]+),\s*(\d+)>;\s*$/;
// eslint-disable-next-line
const TEXTURE_REGEX = /^\s*var\s+([\w\d_]+)\s*:\s*texture_(\w+)<([a-zA-Z0-9_,<>]*)>;\s*$/;
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
        this.arraySize = 0;
        this.type = '';
        this.matchedElements = [];

        // handle array format like 'array<texture_2d<f32>, 5>'
        const arrayMatch = line.match(ARRAY_REGEX);
        if (arrayMatch) {
            this.name = arrayMatch[1]; // Extract the variable name
            this.arraySize = parseInt(arrayMatch[3], 10); // Extract the array size
            this.line = `var ${this.name} : ${arrayMatch[2]};`; // Simplify line (remove array part)
            this.matchedElements.push(...arrayMatch);

            if (isNaN(this.arraySize)) {
                Debug.error(`Invalid array size in resource line: ${line}`, shader);
                shader.failed = true;
            }
        }

        // handle texture type / simplified line from the array above
        const textureMatch = this.line.match(TEXTURE_REGEX);
        if (textureMatch) {
            this.name = textureMatch[1];
            this.type = textureMatch[2]; // texture type (e.g., texture_2d)
            this.textureFormat = textureMatch[3]; // texture format (e.g., f32)
            this.isTexture = true;
            this.matchedElements.push(...textureMatch);

            this.textureDimension = getTextureDimension(this.type, this.arraySize > 0);
            Debug.assert(this.textureDimension);

            this.sampleType = textureFormat2SampleType[this.textureFormat];
            Debug.assert(this.sampleType !== undefined);
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
        const attributesBlock = WebgpuShaderProcessorWGSL.processAttributes(vertexExtracted.attributes, shaderDefinition.attributes, shaderDefinition.processingOptions);

        // VS - convert a list of varyings to a shader block
        const vertexVaryingsBlock = WebgpuShaderProcessorWGSL.processVaryings(vertexExtracted.varyings, varyingMap, true);

        // FS - convert a list of varyings to a shader block
        const fragmentVaryingsBlock = WebgpuShaderProcessorWGSL.processVaryings(fragmentExtracted.varyings, varyingMap, false);

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
        const concatResources = vertexExtracted.resources.concat(fragmentExtracted.resources);
        const resources = Array.from(new Set(concatResources));
        const parsedResources = resources.map(line => new ResourceLine(line, shader));
        const resourcesData = WebgpuShaderProcessorWGSL.processResources(device, parsedResources, shaderDefinition.processingOptions, shader);

        // generate fragment output struct
        const fOutput = WebgpuShaderProcessorWGSL.generateFragmentOutputStruct(fragmentExtracted.src, device.maxColorAttachments);

        // VS - insert the blocks to the source
        const vBlock = `${attributesBlock}\n${vertexVaryingsBlock}\n${uniformsData.code}\n${resourcesData.code}\n`;
        const vshader = vertexExtracted.src.replace(MARKER, vBlock);

        // FS - insert the blocks to the source
        const fBlock = `${fragmentVaryingsBlock}\n${fOutput}\n${uniformsData.code}\n${resourcesData.code}\n`;
        const fshader = fragmentExtracted.src.replace(MARKER, fBlock);

        return {
            vshader: vshader,
            fshader: fshader,
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
     * Process the lines with uniforms. The function receives the lines containing all uniforms,
     * both numerical as well as textures/samplers. The function also receives the format of uniform
     * buffers (numerical) and bind groups (textures) for view and material level. All uniforms that
     * match any of those are ignored, as those would be supplied by view / material level buffers.
     * All leftover uniforms create uniform buffer and bind group for the mesh itself, containing
     * uniforms that change on the level of the mesh.
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

    static processResources(device, resources, processingOptions, shader) {

        // build mesh bind group format - this contains the textures, but not the uniform buffer as that is a separate binding
        const textureFormats = [];
        for (let i = 0; i < resources.length; i++) {

            const resource = resources[i];

            if (resource.isTexture) {

                // followed by optional sampler uniform
                const sampler = resources[i + 1];
                const hasSampler = sampler?.isSampler;

                // TODO: handle depth texture, external, and storage types
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
                code += WebgpuShaderProcessorWGSL.getTextureShaderDeclaration(format, bindGroupIndex, 1);
            }
        });

        // and also for generated mesh format
        code += WebgpuShaderProcessorWGSL.getTextureShaderDeclaration(meshBindGroupFormat, BINDGROUP_MESH, 0);

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
            const typeString = uniformTypeToNameWGSL[uniform.type][0];
            Debug.assert(typeString !== undefined, `Uniform type ${uniform.type} is not handled.`);
            code += `    ${uniform.name}: ${typeString}${uniform.count ? `[${uniform.count}]` : ''},\n`;
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
     * @param {number} startBindIndex - The starting bind index.
     * @returns {string} - The shader code for the bind group.
     */
    static getTextureShaderDeclaration(format, bindGroup, startBindIndex) {
        let code = '';
        let bindIndex = startBindIndex;

        format.textureFormats.forEach((format) => {

            // convert TEXTUREDIMENSION_2D to 'texture_2d<f32>' and similar
            const typeCode = getTextureTypeCode(format.textureDimension, format.sampleType);

            code += `@group(${bindGroup}) @binding(${bindIndex}) var ${format.name}: ${typeCode};\n`;
            bindIndex++;

            if (format.hasSampler) {
                code += `@group(${bindGroup}) @binding(${bindIndex}) var ${format.samplerName}: sampler;\n`;
                bindIndex++;
            }
        });

        format.storageBufferFormats.forEach((format) => {

            const access = format.readOnly ? 'read' : 'read_write';
            code += `@group(${bindGroup}) @binding(${bindIndex}) var<storage, ${access}> ${format.name} : ${format.format};\n`;
            bindIndex++;

        });

        Debug.assert(format.storageTextureFormats.length === 0, 'Implement support for storage textures here');
        // TODO: also add external texture support here

        return code;
    }

    static processVaryings(varyingLines, varyingMap, isVertex) {
        let block = '';
        varyingLines.forEach((line, index) => {
            const match = line.match(VARYING);
            Debug.assert(match, `Varying line is not valid: ${line}`);

            if (match) {
                const name = match[1];

                if (isVertex) {
                    // store it in the map
                    varyingMap.set(name, index);
                } else {
                    Debug.assert(varyingMap.has(name), `Fragment shader requires varying [${name}] but vertex shader does not generate it.`);
                    index = varyingMap.get(name);
                }

                // generates: `@location(0) @interpolate(perspective, centroid) smoothColor : vec3f`
                block += `    @location(${index}) ${line},\n`;
            }
        });

        // add built-in varyings
        if (isVertex) {
            block += '    @builtin(position) position : vec4f,\n';      // output position
        } else {
            block += '    @builtin(position) position : vec4f,\n';      // interpolated fragment position
            block += '    @builtin(front_facing) frontFacing : bool,\n';    // front-facing
            block += '    @builtin(sample_index) sampleIndex : u32\n';      // sample index for MSAA
        }

        const structName = isVertex ? 'VertexOutput' : 'FragmentInput';
        return `struct ${structName} {\n${block}};\n`;
    }

    static generateFragmentOutputStruct(src, numRenderTargets) {
        let structCode = 'struct FragmentOutput {\n';

        for (let i = 0; i < numRenderTargets; i++) {
            structCode += `    @location(${i}) color${i > 0 ? i : ''} : vec4f,\n`;
        }

        // find if the src contains `.fragDepth =`, ignoring whitespace before = sign
        const needsFragDepth = src.search(/\.fragDepth\s*=/) !== -1;
        if (needsFragDepth) {
            structCode += '    @builtin(frag_depth) fragDepth : f32\n';
        }

        return `${structCode}};\n`;
    }

    static processAttributes(attributeLines, shaderDefinitionAttributes, processingOptions) {
        let block = '';
        const usedLocations = {};
        attributeLines.forEach((line) => {
            const words = splitToWords(line);
            const name = words[0];

            if (shaderDefinitionAttributes.hasOwnProperty(name)) {
                const semantic = shaderDefinitionAttributes[name];
                const location = semanticToLocation[semantic];
                Debug.assert(location !== undefined, `Semantic ${semantic} used by the attribute ${name} is not known - make sure it's one of the supported semantics.`);

                Debug.assert(!usedLocations.hasOwnProperty(location),
                    `WARNING: Two vertex attributes are mapped to the same location in a shader: ${usedLocations[location]} and ${semantic}`);
                usedLocations[location] = semantic;

                // generates: @location(0) position : vec4f
                block += `    @location(${location}) ${line},\n`;
            } else {
                Debug.error(`Attribute ${name} is not defined in the shader definition.`, shaderDefinitionAttributes);
            }
        });

        // add built-in attributes
        block += '    @builtin(vertex_index) vertexIndex : u32,\n';     // vertex index
        block += '    @builtin(instance_index) instanceIndex : u32\n';  // instance index

        return `struct VertexInput {\n${block}};\n`;
    }

    static cutOut(src, start, end, replacement) {
        return src.substring(0, start) + replacement + src.substring(end);
    }
}

export { WebgpuShaderProcessorWGSL };
