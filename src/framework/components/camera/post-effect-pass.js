Object.assign(pc, function () {

    var _backbufferRt = [null, null]; // 2 RTs may be needed for ping-ponging
    var _constInput = null;
    var _constScreenSize;
    var _constScreenSizeValue = new pc.Vec4();
    var _constScreenSizeValueUniform = new Float32Array(4);
    var _postEffectChain = [];
    var _backbufferRtUsed = false;
    var _backbufferRt2Used = false;
    var _backbufferRtWrittenByPost = false;

    var _regexUniforms = /uniform[ \t\n\r]+\S+[ \t\n\r]+\S+[ \t\n\r]*\;/g;
    var _regexUniformStart = /\S+[ \t\n\r]*\;/;
    var _regexUniformEnd = /[ \t\n\r]*\;/;
    var _regexVariables = /(float|int|bool|vec2|vec3|vec4|struct)([ \t\n\r]+[^\;]+[ \t\n\r]*\,*)+\;/g;
    var _regexVariableSurroundings = /(float|int|bool|vec2|vec3|vec4|struct|\,|\;|\{|\})/g;
    var _regexIrrelevantVariables = /(uniform|varying|in|out)[ \t\n\r]+(float|int|bool|vec2|vec3|vec4|struct)([ \t\n\r]+[^\;]+[ \t\n\r]*\,*)+\;/g;
    var _regexIrrelevantVariableSurroundings = /(float|int|bool|vec2|vec3|vec4|struct|uniform|varying|in|out|\,|\;|\{|\})/g;
    var _regexVersion = /#version/g;
    var _regexFragColor = /out highp vec4 pc_fragColor;/g;
    var _regexFragColor2 = /#define gl_FragColor/g;
    var _regexFragColor3 = /gl_FragColor/g;
    var _regexColorBuffer = /uniform[ \t\n\r]+sampler2D[ \t\n\r]+uColorBuffer;/g;
    var _regexUv = /(varying|in)[ \t\n\r]+vec2[ \t\n\r]+vUv0;/g;
    var _regexColorBufferSample = /(texture2D|texture)[ \t\n\r]*\([ \t\n\r]*uColorBuffer/g;
    var _regexMain = /void[ \t\n\r]+main/g;

    var _createBackbufferRt = function (id, device, format) {
        var tex = new pc.Texture(device, {
            format: format,
            width: device.width,
            height: device.height
        });
        tex.name = 'posteffect-pass';
        tex.minFilter = pc.FILTER_NEAREST;
        tex.magFilter = pc.FILTER_NEAREST;
        tex.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
        tex.addressV = pc.ADDRESS_CLAMP_TO_EDGE;

        _backbufferRt[id]._colorBuffer = tex;
    };

    var _destroyBackbufferRt = function (id) {
        _backbufferRt[id].colorBuffer.destroy();
        _backbufferRt[id].destroy();
    };

    var _collectUniforms = function (code) {
        var strs = code.match(_regexUniforms) || []; // look ma I know regexp
        var start, end, uname;
        var uniforms = [];
        for (var i = 0; i < strs.length; i++) {
            start = strs[i].search(_regexUniformStart);
            end = strs[i].search(_regexUniformEnd);
            uname = strs[i].substr(start, end - start);
            if (uname !== "uColorBuffer") { // this one is OK to be shared
                uniforms.push(uname);
            }
        }
        return uniforms;
    };

    var _uniformsCollide = function (layers, chain, count, shader) {
        var uniforms = _collectUniforms(shader.definition.fshader);
        if (uniforms.length === 0) return false;

        var i, j, k, uniforms2;
        var uname;
        for (i = 0; i < count; i++) {
            for (j = 0; j < uniforms.length; j++) {
                uname = uniforms[j];
                uniforms2 = _collectUniforms(layers[chain[i]].shader.definition.fshader);
                for (k = 0; k < uniforms2.length; k++) {
                    if (uniforms2[k] === uname) {
                        return true;
                    }
                }
            }
        }

        return false;
    };

    // collect global vars and return collisions with what's already in the list
    var _collectGlobalTempVars = function (code, list) {
        // Get code without any scoped stuff
        var len = code.length;
        var chr;
        var scopeStart = 0;
        var scopeEnd = 0;
        var scopeDepth = 0;
        var codeStart = 0;
        var codeWithoutScopes = "";
        var i, j;
        for (i = 0; i < len; i++) {
            chr = code.charAt(i);
            if (chr === "{") {
                if (scopeDepth === 0) {
                    scopeStart = i;
                }
                scopeDepth++;
            } else if (chr === "}") {
                if (scopeDepth === 1) {
                    scopeEnd = i;
                    codeWithoutScopes += code.substr(codeStart, (scopeStart - codeStart) + 1);
                    codeStart = scopeEnd;
                }
                scopeDepth--;
            }
        }
        codeWithoutScopes += code.substr(codeStart, (code.length - codeStart) + 1);

        // Find all global variable declarations and detect collisions
        // ... won't work with re#defined types
        var collisions = null;
        var decls = codeWithoutScopes.match(_regexVariables) || [];
        var vars, varName;
        for (i = 0; i < decls.length; i++) {
            vars = decls[i].split(",");
            for (j = 0; j < vars.length; j++) {
                varName = vars[j].replace(_regexVariableSurroundings, "").trim();
                if (list.indexOf(varName) >= 0) {
                    if (!collisions) collisions = [];
                    collisions.push(varName);
                } else {
                    list.push(varName);
                }
            }
        }

        // Find all varying/uniform declarations (ideally should be possible to filter them out with first search...)
        // and remove from list
        var irrelevantDecls = codeWithoutScopes.match(_regexIrrelevantVariables) || [];
        var index;
        for (i = 0; i < irrelevantDecls.length; i++) {
            vars = irrelevantDecls[i].split(",");
            for (j = 0; j < vars.length; j++) {
                varName = vars[j].replace(_regexIrrelevantVariableSurroundings, "").trim();
                index = list.indexOf(varName);
                if (index >= 0) {
                    list.splice(index, 1);
                }
            }
        }

        return collisions;
    };

    /**
     * @private
     * @constructor
     * @name pc.PostEffectPass
     * @param {pc.Application} app The application.
     * @param {Object} options Optional options object.
     */
    function PostEffectPass(app, options) {
        this.app = app;
        this.srcRenderTarget = options.srcRenderTarget;
        this.hdr = options.hdr;
        this.blending = options.blending;
        this.shader = options.shader;
        this.setup = options.setup;

        var self = this;
        var device = app.graphicsDevice;

        this.layer = new pc.Layer({ // grab that and put to layer composition
            opaqueSortMode: pc.SORTMODE_NONE,
            transparentSortMode: pc.SORTMODE_NONE,
            passThrough: true,
            name: options.name,

            onPostRender: function () {
                if (self.srcRenderTarget) {
                    _constScreenSizeValue.x = self.srcRenderTarget.width;
                    _constScreenSizeValue.y = self.srcRenderTarget.height;
                    _constScreenSizeValue.z = 1.0 / self.srcRenderTarget.width;
                    _constScreenSizeValue.w = 1.0 / self.srcRenderTarget.height;
                } else {
                    _constScreenSizeValue.x = device.width;
                    _constScreenSizeValue.y = device.height;
                    _constScreenSizeValue.z = 1.0 / device.width;
                    _constScreenSizeValue.w = 1.0 / device.height;
                }
                _constScreenSizeValueUniform[0] = _constScreenSizeValue.x;
                _constScreenSizeValueUniform[1] = _constScreenSizeValue.y;
                _constScreenSizeValueUniform[2] = _constScreenSizeValue.z;
                _constScreenSizeValueUniform[3] = _constScreenSizeValue.w;
                _constScreenSize.setValue(_constScreenSizeValueUniform);

                if (this._postEffectCombined && this._postEffectCombined < 0) {
                    if (self.setup) self.setup(device, self, _constScreenSizeValue, null, this.renderTarget);
                    return;
                }

                var src;
                if (this._postEffectCombinedSrc) {
                    src = this._postEffectCombinedSrc;
                } else {
                    src = self.srcRenderTarget ? self.srcRenderTarget : _backbufferRt[this._backbufferRtId];
                }
                if (src._samples > 1) src.resolve(true, false);
                var tex = src._colorBuffer;
                tex.magFilter = (this._postEffectCombinedShader ? this._postEffectCombinedBilinear : this.postEffectBilinear) ? pc.FILTER_LINEAR : pc.FILTER_NEAREST;

                _constInput.setValue(tex);
                if (self.setup) self.setup(device, self, _constScreenSizeValue, src, this.renderTarget);

                var shader = this._postEffectCombinedShader ? this._postEffectCombinedShader : this.shader;
                if (shader) pc.drawQuadWithShader(device, this.renderTarget, shader, null, null, self.blending);

                if (self.srcRenderTarget) return; // don't do anything else if this effect was not reading backbuffer RT
                // remap RT back to actual backbuffer in all layers prior to this effect
                var layers = app.scene.layers.layerList;
                for (var i = 0; i < layers.length; i++) {
                    if (layers[i] === self.layer) break;
                    if (layers[i].renderTarget === _backbufferRt[0] || layers[i].renderTarget === _backbufferRt[1]) {
                        layers[i].renderTarget = null;
                    }
                }
            }
        });

        this.layer._generateCameraHash(); // post effect doesn't contain actual cameras, but we need to generate cam data
        this.layer.isPostEffect = true;
        this.layer.unmodifiedUvs = options.unmodifiedUvs;
        this.layer.postEffectBilinear = options.bilinear;
        this.layer.postEffect = this;
        this.layer.shader = options.shader;
        this.layer.renderTarget = options.destRenderTarget;

        if (!_constInput) {
            // system initialization
            _constInput = device.scope.resolve("uColorBuffer"); // default input texture uniform name
            _constScreenSize = device.scope.resolve("uScreenSize");
            var _backbufferMsaa = device.supportsMsaa ? 4 : 1; // if context is created with antialias: true, backbuffer RT will use 4 MSAA samples
            for (var i = 0; i < 2; i++) { // create backbuffer RT objects, but don't allocate any memory for them just yet
                _backbufferRt[i] = new pc.RenderTarget({
                    depth: true,
                    stencil: device.supportsStencil,
                    samples: _backbufferMsaa,
                    autoResolve: false
                });
                _backbufferRt[i].name = "backbuffer" + i;
            }
            app.on("prerender", function () { // before every app.render, if any effect reads from backbuffer, we must replace real backbuffer with our backbuffer RTs prior to effect

                var layers = app.scene.layers.layerList;
                var i, j;
                var offset = 0;
                var rtId = 0;
                _backbufferRtUsed = false;
                _backbufferRt2Used = false;
                _backbufferRtWrittenByPost = false;
                var backbufferRtFormat = pc.PIXELFORMAT_R8_G8_B8_A8;

                if (app.scene.layers._dirty) {
                    // only called if layer order changed
                    // detect chains of posteffects and combine if possible
                    // won't work with uniform collisions

                    // #ifdef DEBUG
                    console.log("Trying to combine shaders...");
                    // #endif
                    var iterator = 0;
                    var breakChain = false;
                    var collisions, k;
                    for (i = 0; i < layers.length; i++) {
                        breakChain = false;

                        if (layers[i].isPostEffect && (iterator === 0 || (layers[i].unmodifiedUvs && layers[i].shader && !_uniformsCollide(layers, _postEffectChain, iterator, layers[i].shader)))) {
                            _postEffectChain[iterator] = i; // add effect to chain
                            iterator++;
                            if (i === layers.length - 1) breakChain = true; // this is the last layer
                        } else {
                            if (iterator > 0) {
                                breakChain = true; // next layer is not effect
                            }
                        }

                        if (breakChain) {
                            if (iterator > 1) {
                                // Combine multiple shaders

                                var cachedName = "post_";
                                var layer;
                                for (j = 0; j < iterator; j++) {
                                    layer = layers[_postEffectChain[j]];
                                    cachedName += layer.name ? layer.name : layer.id;
                                    if (j < iterator - 1) cachedName += "_";
                                }
                                var shader = device.programLib._cache[cachedName];
                                if (!shader) {
                                    var subCode;
                                    var code = "vec4 shaderOutput;\n"; // this is will be used instead of gl_FragColor; reading from real gl_FragColor is buggy on some platforms
                                    var mainCode = "void main() {\n";
                                    var globalTempVars = [];

                                    for (j = 0; j < iterator; j++) {
                                        subCode = layers[_postEffectChain[j]].shader.definition.fshader + "\n";
                                        // For every shader's code:
                                        // - Replace #version, because createShaderFromCode will append a new one anyway;
                                        // - Replace pc_fragColor and #define gl_FragColor for the same reason;
                                        // - Replace any usage of gl_FragColor to shaderOutput;
                                        subCode = subCode.replace(_regexVersion, "//").replace(_regexFragColor, "//").replace(_regexFragColor2, "//").replace(_regexFragColor3, "shaderOutput");
                                        if (j > 0) {
                                            // For every shader's code > 0:
                                            // - Remove definition of uColorBuffer (should be defined in code 0 already);
                                            // - Remove definition of vUv0 (same reason);
                                            // - Replace reading from uColorBuffer with reading from shaderOutput.
                                            subCode = subCode.replace(_regexColorBuffer, "//").replace(_regexUv, "//").replace(_regexColorBufferSample, "shaderOutput;\/\/");
                                        }
                                        // Replace main() with mainX()
                                        subCode = subCode.replace(_regexMain, "void main" + j);

                                        // Check for global variable collisions
                                        collisions = _collectGlobalTempVars(subCode, globalTempVars);
                                        if (collisions) {
                                            for (k = 0; k < collisions.length; k++) {
                                                subCode = subCode.replace(new RegExp("\\b" + collisions[k] + "\\b", 'g'), collisions[k] + "NNNN" + j);
                                            }
                                        }

                                        code += subCode;
                                        mainCode += "main" + j + "();\n";
                                    }
                                    mainCode += "gl_FragColor = shaderOutput;\n}\n";
                                    shader = pc.shaderChunks.createShaderFromCode(device,
                                                                                  pc.shaderChunks.fullscreenQuadVS,
                                                                                  code + mainCode,
                                                                                  cachedName);
                                    // #ifdef DEBUG
                                    console.log("Combined " + cachedName);
                                    // #endif
                                }
                                for (j = 0; j < iterator; j++) {
                                    layers[_postEffectChain[j]]._postEffectCombined = (j === iterator - 1) ? 1 : -1;
                                }
                                layers[_postEffectChain[iterator - 1]]._postEffectCombinedShader = shader;
                                layers[_postEffectChain[iterator - 1]]._postEffectCombinedBilinear = layers[_postEffectChain[0]].postEffectBilinear;
                                layers[_postEffectChain[iterator - 1]]._postEffectCombinedSrc = layers[_postEffectChain[0]].postEffect.srcRenderTarget;
                            }
                            _postEffectChain[0] = i; // add effect to new chain
                            iterator = 1;
                        }
                    }
                }

                // getting from
                //     world -> backbuffer
                //     backbuffer -> post1 -> backbuffer
                //     backbuffer -> post2 -> backbuffer
                // to
                //     world -> rt0
                //     rt0 -> post1 -> rt1
                //     rt1 -> post2 -> backbuffer
                //
                // other case:
                //     world -> backbuffer
                //     backbuffer -> post -> someRt
                //     otherObjects -> backbuffer
                // ->
                //     world -> rt0
                //     rt0 -> post -> someRt
                //     otherObjects -> rt0
                //
                // if no posteffects writing backbuffer, rt0 -> backbuffer
                for (i = 0; i < layers.length; i++) {
                    if (layers[i].isPostEffect && ((!layers[i].postEffect.srcRenderTarget && !layers[i]._postEffectCombined) ||
                                                   (!layers[i].postEffect._postEffectCombinedSrc && layers[i]._postEffectCombined >= 0))) { // layer i is posteffect reading from backbuffer
                        for (j = i - 1; j >= offset; j--) {
                            if (!layers[j].renderTarget) { // layer j is prior to layer i and is rendering to backbuffer
                                layers[j].renderTarget = _backbufferRt[rtId]; // replace backbuffer with backbuffer RT
                            }
                        }
                        layers[i]._backbufferRtId = rtId; // set input hint for post effect
                        offset = i;
                        _backbufferRtUsed = true; // 1st backbuffer RT used
                        if (rtId === 1) _backbufferRt2Used = true; // 2nd backbuffer RT used
                        if (layers[i].postEffect.hdr) {
                            // backbuffer RT must be HDR
                            if (device.webgl2 && device.textureFloatRenderable) {
                                backbufferRtFormat = pc.PIXELFORMAT_111110F;
                            } else if (device.extTextureHalfFloatLinear && device.textureHalfFloatRenderable) {
                                backbufferRtFormat = pc.PIXELFORMAT_RGBA16F;
                            } else {
                                backbufferRtFormat = pc.PIXELFORMAT_R8_G8_B8_A8;
                            }
                        }
                        if (layers[i].postEffect.shader && !layers[i].renderTarget) rtId = 1 - rtId; // pingpong RT if posteffect both reads/writes backbuffer

                    } else if (!layers[i].isPostEffect && !layers[i].renderTarget && _backbufferRtUsed) { // layer is not post effect, rendering to backbuffer, and backbuffer was replaced before
                        layers[i].renderTarget = _backbufferRt[rtId]; // replace backbuffer with backbuffer RT
                    }

                    if (layers[i].isPostEffect && !layers[i].renderTarget) {
                        _backbufferRtWrittenByPost = true;
                    }
                }

                // create/resize backbuffer render target if needed

                if (_backbufferRtUsed) {
                    if (!_backbufferRt[0].colorBuffer) {
                        _createBackbufferRt(0, device, backbufferRtFormat);
                    } else if (_backbufferRt[0].width !== device.width || _backbufferRt[0].height !== device.height || _backbufferRt[0]._colorBuffer._format !== backbufferRtFormat) {
                        _destroyBackbufferRt(0);
                        _createBackbufferRt(0, device, backbufferRtFormat);
                    }
                }

                if (_backbufferRt2Used) {
                    if (!_backbufferRt[1].colorBuffer) {
                        _createBackbufferRt(1, device, backbufferRtFormat);
                    } else if (_backbufferRt[1].width !== device.width || _backbufferRt[1].height !== device.height || _backbufferRt[1]._colorBuffer._format !== backbufferRtFormat) {
                        _destroyBackbufferRt(1);
                        _createBackbufferRt(1, device, backbufferRtFormat);
                    }
                }

            }, this);

            app.on("postrender", function () { // after every app.render test if there were no effect writing to actual backbuffer, and if so, copy it from replaced backbuffer
                var device = app.graphicsDevice;
                if (_backbufferRtUsed && !_backbufferRtWrittenByPost) {
                    var layers = app.scene.layers.layerList;
                    var rt;
                    for (var i = layers.length - 1; i >= 0; i--) {
                        rt = layers[i].renderTarget;
                        if (rt === _backbufferRt[0] || rt === _backbufferRt[1]) {
                            break;
                        }
                    }
                    if (rt) {
                        if (rt._samples > 1) {
                            rt.resolve(true, false);
                        }
                        device.copyRenderTarget(rt, null, true, false);
                    }
                }
            }, this);
        }
    }

    PostEffectPass.prototype.addToComposition = function (order) {
        this.app.scene.layers.insertTransparent(this.layer, order);
    };

    return {
        PostEffectPass: PostEffectPass
    };
}());
