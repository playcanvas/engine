import { Debug } from '../../../core/debug.js';
import { TRACEID_SHADER_COMPILE } from '../../../core/constants.js';
import { now } from '../../../core/time.js';

import { WebglShaderInput } from './webgl-shader-input.js';
import { SHADERTAG_MATERIAL, semanticToLocation } from '../constants.js';
import { DeviceCache } from '../device-cache.js';

let _totalCompileTime = 0;

const _vertexShaderBuiltins = [
    'gl_VertexID',
    'gl_InstanceID',
    'gl_DrawID',
    'gl_BaseVertex',
    'gl_BaseInstance'
];

// class used to hold compiled WebGL vertex or fragment shaders in the device cache
class CompiledShaderCache {
    // maps shader source to a compiled WebGL shader
    map = new Map();

    // destroy all created shaders when the device is destroyed
    destroy(device) {
        this.map.forEach((shader) => {
            device.gl.deleteShader(shader);
        });
    }

    // just empty the cache when the context is lost
    loseContext(device) {
        this.map.clear();
    }
}

// class used to hold a list of recently created shaders forming a batch, to allow their more optimized compilation
class ShaderBatchCache {
    shaders = [];

    loseContext(device) {
        this.shaders = [];
    }
}

const _vertexShaderCache = new DeviceCache();
const _fragmentShaderCache = new DeviceCache();
const _shaderBatchCache = new DeviceCache();

/**
 * A WebGL implementation of the Shader.
 *
 * @ignore
 */
class WebglShader {
    compileDuration = 0;

    constructor(shader) {
        this.init();

        // kick off vertex and fragment shader compilation, but not linking here, as that would
        // make it blocking.
        this.compile(shader.device, shader);

        // add the shader to recently created list
        WebglShader.getBatchShaders(shader.device).push(shader);

        // add it to a device list of all shaders
        shader.device.shaders.push(shader);
    }

    /**
     * Free the WebGL resources associated with a shader.
     *
     * @param {import('../shader.js').Shader} shader - The shader to free.
     */
    destroy(shader) {
        if (this.glProgram) {
            shader.device.gl.deleteProgram(this.glProgram);
            this.glProgram = null;
        }
    }

    init() {
        this.uniforms = [];
        this.samplers = [];
        this.attributes = [];

        this.glProgram = null;
        this.glVertexShader = null;
        this.glFragmentShader = null;
    }

    static getBatchShaders(device) {
        const batchCache = _shaderBatchCache.get(device, () => {
            return new ShaderBatchCache();
        });
        return batchCache.shaders;
    }

    static endShaderBatch(device) {

        // Trigger link step for all recently created shaders. This allows linking to be done in parallel, before
        // the blocking wait on the linking result is triggered in finalize function
        const shaders = WebglShader.getBatchShaders(device);
        shaders.forEach(shader => shader.impl.link(device, shader));
        shaders.length = 0;
    }

    /**
     * Dispose the shader when the context has been lost.
     */
    loseContext() {
        this.init();
    }

    /**
     * Restore shader after the context has been obtained.
     *
     * @param {import('./webgl-graphics-device.js').WebglGraphicsDevice} device - The graphics device.
     * @param {import('../shader.js').Shader} shader - The shader to restore.
     */
    restoreContext(device, shader) {
        this.compile(device, shader);
    }

    /**
     * Compile shader programs.
     *
     * @param {import('./webgl-graphics-device.js').WebglGraphicsDevice} device - The graphics device.
     * @param {import('../shader.js').Shader} shader - The shader to compile.
     */
    compile(device, shader) {

        const definition = shader.definition;
        this.glVertexShader = this._compileShaderSource(device, definition.vshader, true);
        this.glFragmentShader = this._compileShaderSource(device, definition.fshader, false);
    }

    /**
     * Link shader programs. This is called at a later stage, to allow many shaders to compile in parallel.
     *
     * @param {import('./webgl-graphics-device.js').WebglGraphicsDevice} device - The graphics device.
     * @param {import('../shader.js').Shader} shader - The shader to compile.
     */
    link(device, shader) {

        // if the shader was already linked
        if (this.glProgram)
            return;

        // if the device is lost, silently ignore
        const gl = device.gl;
        if (gl.isContextLost()) {
            return;
        }

        let startTime = 0;
        Debug.call(() => {
            this.compileDuration = 0;
            startTime = now();
        });

        const glProgram = gl.createProgram();
        this.glProgram = glProgram;

        gl.attachShader(glProgram, this.glVertexShader);
        gl.attachShader(glProgram, this.glFragmentShader);

        const definition = shader.definition;
        const attrs = definition.attributes;
        if (device.isWebGL2 && definition.useTransformFeedback) {
            // Collect all "out_" attributes and use them for output
            const outNames = [];
            for (const attr in attrs) {
                if (attrs.hasOwnProperty(attr)) {
                    outNames.push("out_" + attr);
                }
            }
            gl.transformFeedbackVaryings(glProgram, outNames, gl.INTERLEAVED_ATTRIBS);
        }

        // map all vertex input attributes to fixed locations
        const locations = {};
        for (const attr in attrs) {
            if (attrs.hasOwnProperty(attr)) {
                const semantic = attrs[attr];
                const loc = semanticToLocation[semantic];
                Debug.assert(!locations.hasOwnProperty(loc), `WARNING: Two attributes are mapped to the same location in a shader: ${locations[loc]} and ${attr}`);

                locations[loc] = attr;
                gl.bindAttribLocation(glProgram, loc, attr);
            }
        }

        gl.linkProgram(glProgram);

        Debug.call(() => {
            this.compileDuration = now() - startTime;
        });

        // #if _PROFILER
        device._shaderStats.linked++;
        if (definition.tag === SHADERTAG_MATERIAL) {
            device._shaderStats.materialShaders++;
        }
        // #endif
    }

    /**
     * Compiles an individual shader.
     *
     * @param {import('./webgl-graphics-device.js').WebglGraphicsDevice} device - The graphics device.
     * @param {string} src - The shader source code.
     * @param {boolean} isVertexShader - True if the shader is a vertex shader, false if it is a
     * fragment shader.
     * @returns {WebGLShader} The compiled shader.
     * @private
     */
    _compileShaderSource(device, src, isVertexShader) {
        const gl = device.gl;

        // device cache for current device, containing cache of compiled shaders
        const shaderDeviceCache = isVertexShader ? _vertexShaderCache : _fragmentShaderCache;
        const shaderCache = shaderDeviceCache.get(device, () => {
            return new CompiledShaderCache();
        });

        // try to get compiled shader from the cache
        let glShader = shaderCache.map.get(src);

        if (!glShader) {
            // #if _PROFILER
            const startTime = now();
            device.fire('shader:compile:start', {
                timestamp: startTime,
                target: device
            });
            // #endif

            glShader = gl.createShader(isVertexShader ? gl.VERTEX_SHADER : gl.FRAGMENT_SHADER);

            // if the device is lost, silently ignore
            if (!glShader && gl.isContextLost()) {
                return glShader;
            }

            gl.shaderSource(glShader, src);
            gl.compileShader(glShader);

            shaderCache.map.set(src, glShader);

            // #if _PROFILER
            const endTime = now();
            device.fire('shader:compile:end', {
                timestamp: endTime,
                target: device
            });
            device._shaderStats.compileTime += endTime - startTime;

            if (isVertexShader) {
                device._shaderStats.vsCompiled++;
            } else {
                device._shaderStats.fsCompiled++;
            }
            // #endif
        }

        return glShader;
    }

    /**
     * Link the shader, and extract its attributes and uniform information.
     *
     * @param {import('./webgl-graphics-device.js').WebglGraphicsDevice} device - The graphics device.
     * @param {import('../shader.js').Shader} shader - The shader to query.
     * @returns {boolean} True if the shader was successfully queried and false otherwise.
     */
    finalize(device, shader) {

        // if the device is lost, silently ignore
        const gl = device.gl;
        if (gl.isContextLost()) {
            return true;
        }

        // if the program wasn't linked yet (shader was not created in batch)
        if (!this.glProgram)
            this.link(device, shader);

        const glProgram = this.glProgram;
        const definition = shader.definition;

        // #if _PROFILER
        const startTime = now();
        device.fire('shader:link:start', {
            timestamp: startTime,
            target: device
        });
        // #endif

        // this is the main thead blocking part of the shader compilation, time it
        let linkStartTime = 0;
        Debug.call(() => {
            linkStartTime = now();
        });

        const linkStatus = gl.getProgramParameter(glProgram, gl.LINK_STATUS);
        if (!linkStatus) {

            // Check for compilation errors
            if (!this._isCompiled(device, shader, this.glVertexShader, definition.vshader, "vertex"))
                return false;

            if (!this._isCompiled(device, shader, this.glFragmentShader, definition.fshader, "fragment"))
                return false;

            const message = "Failed to link shader program. Error: " + gl.getProgramInfoLog(glProgram);

            // #if _DEBUG

            // log translated shaders
            definition.translatedFrag = gl.getExtension('WEBGL_debug_shaders')?.getTranslatedShaderSource(this.glFragmentShader);
            definition.translatedVert = gl.getExtension('WEBGL_debug_shaders')?.getTranslatedShaderSource(this.glVertexShader);

            console.error(message, definition);
            // #else
            console.error(message);
            // #endif

            return false;
        }

        // Query the program for each vertex buffer input (GLSL 'attribute')
        let i = 0;
        const numAttributes = gl.getProgramParameter(glProgram, gl.ACTIVE_ATTRIBUTES);
        while (i < numAttributes) {
            const info = gl.getActiveAttrib(glProgram, i++);
            const location = gl.getAttribLocation(glProgram, info.name);

            // a built-in attributes for which we do not need to provide any data
            if (_vertexShaderBuiltins.indexOf(info.name) !== -1)
                continue;

            // Check attributes are correctly linked up
            if (definition.attributes[info.name] === undefined) {
                console.error(`Vertex shader attribute "${info.name}" is not mapped to a semantic in shader definition, shader [${shader.label}]`, shader);
                shader.failed = true;
            } else {
                const shaderInput = new WebglShaderInput(device, definition.attributes[info.name], device.pcUniformType[info.type], location);
                this.attributes.push(shaderInput);
            }
        }

        // Query the program for each shader state (GLSL 'uniform')
        i = 0;
        const numUniforms = gl.getProgramParameter(glProgram, gl.ACTIVE_UNIFORMS);
        while (i < numUniforms) {
            const info = gl.getActiveUniform(glProgram, i++);
            const location = gl.getUniformLocation(glProgram, info.name);

            const shaderInput = new WebglShaderInput(device, info.name, device.pcUniformType[info.type], location);

            if (
                info.type === gl.SAMPLER_2D ||
                info.type === gl.SAMPLER_CUBE ||
                (
                    device.isWebGL2 && (
                        info.type === gl.UNSIGNED_INT_SAMPLER_2D ||
                        info.type === gl.INT_SAMPLER_2D ||
                        info.type === gl.SAMPLER_2D_SHADOW ||
                        info.type === gl.SAMPLER_CUBE_SHADOW ||
                        info.type === gl.SAMPLER_3D ||
                        info.type === gl.INT_SAMPLER_3D ||
                        info.type === gl.UNSIGNED_INT_SAMPLER_3D ||
                        info.type === gl.SAMPLER_2D_ARRAY ||
                        info.type === gl.INT_SAMPLER_2D_ARRAY ||
                        info.type === gl.UNSIGNED_INT_SAMPLER_2D_ARRAY
                    )
                )
            ) {
                this.samplers.push(shaderInput);
            } else {
                this.uniforms.push(shaderInput);
            }
        }

        shader.ready = true;

        // #if _PROFILER
        const endTime = now();
        device.fire('shader:link:end', {
            timestamp: endTime,
            target: device
        });
        device._shaderStats.compileTime += endTime - startTime;
        // #endif

        Debug.call(() => {
            const duration = now() - linkStartTime;
            this.compileDuration += duration;
            _totalCompileTime += this.compileDuration;
            Debug.trace(TRACEID_SHADER_COMPILE, `[id: ${shader.id}] ${shader.name}: ${this.compileDuration.toFixed(1)}ms, TOTAL: ${_totalCompileTime.toFixed(1)}ms`);
        });

        return true;
    }

    /**
     * Check the compilation status of a shader.
     *
     * @param {import('./webgl-graphics-device.js').WebglGraphicsDevice} device - The graphics device.
     * @param {import('../shader.js').Shader} shader - The shader to query.
     * @param {WebGLShader} glShader - The WebGL shader.
     * @param {string} source - The shader source code.
     * @param {string} shaderType - The shader type. Can be 'vertex' or 'fragment'.
     * @returns {boolean} True if the shader compiled successfully, false otherwise.
     * @private
     */
    _isCompiled(device, shader, glShader, source, shaderType) {
        const gl = device.gl;

        if (!gl.getShaderParameter(glShader, gl.COMPILE_STATUS)) {
            const infoLog = gl.getShaderInfoLog(glShader);
            const [code, error] = this._processError(source, infoLog);
            const message = `Failed to compile ${shaderType} shader:\n\n${infoLog}\n${code}`;
            // #if _DEBUG
            error.shader = shader;
            console.error(message, error);
            // #else
            console.error(message);
            // #endif
            return false;
        }
        return true;
    }

    /**
     * Truncate the WebGL shader compilation log to just include the error line plus the 5 lines
     * before and after it.
     *
     * @param {string} src - The shader source code.
     * @param {string} infoLog - The info log returned from WebGL on a failed shader compilation.
     * @returns {Array} An array where the first element is the 10 lines of code around the first
     * detected error, and the second element an object storing the error message, line number and
     * complete shader source.
     * @private
     */
    _processError(src, infoLog) {
        const error = { };
        let code = '';

        if (src) {
            const lines = src.split('\n');
            let from = 0;
            let to = lines.length;

            // if error is in the code, only show nearby lines instead of whole shader code
            if (infoLog && infoLog.startsWith('ERROR:')) {
                const match = infoLog.match(/^ERROR:\s([0-9]+):([0-9]+):\s*(.+)/);
                if (match) {
                    error.message = match[3];
                    error.line = parseInt(match[2], 10);

                    from = Math.max(0, error.line - 6);
                    to = Math.min(lines.length, error.line + 5);
                }
            }

            // Chrome reports shader errors on lines indexed from 1
            for (let i = from; i < to; i++) {
                code += (i + 1) + ":\t" + lines[i] + '\n';
            }

            error.source = src;
        }

        return [code, error];
    }
}

export { WebglShader };
