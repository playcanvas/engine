pc.extend(pc, function () {

    var _backbufferRt = [null, null]; // 2 RTs may be needed for ping-ponging
    var _constInput = null;

    var _createBackbufferRt = function(id, device, format) {
        var tex = new pc.Texture(device, {
                    format: format,
                    width: device.width,
                    height: device.height,
        });
        tex.minFilter = pc.FILTER_NEAREST;
        tex.magFilter = pc.FILTER_NEAREST;
        tex.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
        tex.addressV = pc.ADDRESS_CLAMP_TO_EDGE;
        
        _backbufferRt[id]._colorBuffer = tex;
    };

    var _destroyBackbufferRt = function(id) {
        _backbufferRt[id].colorBuffer.destroy();
        _backbufferRt[id].destroy();
    };

    /**
     * @name pc.PostEffect2
     */
    function PostEffect2(script, options) {
        var app = script.app;
        this.app = app;
        this.srcRenderTarget = options.srcRenderTarget;
        this.destRenderTarget = options.destRenderTarget;
        this.cameras = options.cameras ? options.cameras : [];
        this.hdr = options.hdr;

        var self = this;
        var device = app.graphicsDevice;

        this.layer = new pc.Layer({ // grab that and put to layer composition
            opaqueSortMode: pc.SORTMODE_NONE,
            transparentSortMode: pc.SORTMODE_NONE,
            simple: true,
            name: options.name,

            onPostRender: function() {
                // call posteffect render function
                _constInput.setValue(self.srcRenderTarget ? self.srcRenderTarget : _backbufferRt[this._backbufferRtId]._colorBuffer);
                script.renderTarget = this.renderTarget;
                script.render(device);
                
                if (self.srcRenderTarget) return; // don't do anything else if this effect was not reading backbuffer RT
                // remap RT back to actual backbuffer in all layers prior to this effect
                var layers = app.scene.activeLayerComposition.layerList;
                for(var i=0; i<layers.length; i++) {
                    if (layers[i] === self.layer) break;
                    if (layers[i].renderTarget === _backbufferRt[0] || layers[i].renderTarget === _backbufferRt[1]) {
                        layers[i].renderTarget = null;
                    }
                }
            }
        });
        for(var i=0; i<this.cameras.length; i++) {
            this.layer.addCamera(this.cameras[i]);
        }
        this.layer.isPostEffect = true;

        if (!_constInput) {
            // system initialization
            _constInput = device.scope.resolve("uColorBuffer"); // default input texture uniform name
            var _backbufferMsaa = device.supportsMsaa ? 4 : 1; // if context is created with antialias: true, backbuffer RT will use 4 MSAA samples
            for(var i=0; i<2; i++) { // create backbuffer RT objects, but don't allocate any memory for them just yet
                _backbufferRt[i] = new pc.RenderTarget({
                    depth: true,
                    stencil: device.supportsStencil,
                    samples: _backbufferMsaa
                });
            }
            app.on("prerender", function() { // before every app.render, if any effect reads from backbuffer, we must replace real backbuffer with our backbuffer RTs prior to effect

                /*
                getting from
                    world -> backbuffer
                    backbuffer -> post1 -> backbuffer
                    backbuffer -> post2 -> backbuffer
                to
                    world -> rt0
                    rt0 -> post1 -> rt1
                    rt1 -> post2 -> backbuffer
                */

                var layers = app.scene.activeLayerComposition.layerList;
                var i, j;
                var offset = 0;
                var rtId = 0;
                var backbufferRtUsed = false;
                var backbufferRt2Used = false;
                var backbufferRtFormat = pc.PIXELFORMAT_R8_G8_B8_A8;
                for(i=0; i<layers.length; i++) {
                    if (layers[i].isPostEffect && !layers[i].srcRenderTarget) { // layer i is posteffect reading from backbuffer
                        for(j=i-1; j>=offset; j--) {
                            if (!layers[j].renderTarget) { // layer j is prior to layer i and is rendering to backbuffer
                                layers[j].renderTarget = _backbufferRt[rtId]; // replace backbuffer with backbuffer RT
                            }
                        }
                        layers[i]._backbufferRtId = rtId; // set input hint for post effect
                        offset = i;
                        backbufferRtUsed = true; // 1st backbuffer RT used
                        if (rtId === 1) backbufferRt2Used = true; // 2nd backbuffer RT used
                        if (layers[i].hdr) backbufferRtFormat = pc.PIXELFORMAT_111110F; // backbuffer RT must be HDR
                        rtId = 1 - rtId; // pingpong RT
                    }
                }

                // create/resize backbuffer render target if needed

                if (backbufferRtUsed) {
                    if (!_backbufferRt[0].colorBuffer) {
                        _createBackbufferRt(0, device, backbufferRtFormat);
                    } else if (_backbufferRt[0].width !== device.width || _backbufferRt[0].height !== device.height || _backbufferRt[0]._format !== backbufferRtFormat) {
                        _destroyBackbufferRt(0);
                        _createBackbufferRt(0, device, backbufferRtFormat);
                    }
                }

                if (backbufferRt2Used) {
                    if (!_backbufferRt[1].colorBuffer) {
                        _createBackbufferRt(1, device, backbufferRtFormat);
                    } else if (_backbufferRt[1].width !== device.width || _backbufferRt[1].height !== device.height || _backbufferRt[1]._format !== backbufferRtFormat) {
                        _destroyBackbufferRt(1);
                        _createBackbufferRt(1, device, backbufferRtFormat);
                    }
                }

            }, this);
        }
    }

    return {
        PostEffect2: PostEffect2
    };
}());
