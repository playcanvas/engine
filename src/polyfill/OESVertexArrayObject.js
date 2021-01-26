// https://github.com/KhronosGroup/WebGL/blob/master/sdk/demos/google/resources/OESVertexArrayObject.js

(function() {
"use strict";

var glErrorShadow = { };

function error(msg) {
    if (window.console && window.console.error) {
        window.console.error(msg);
    }
}

function log(msg) {
    if (window.console && window.console.log) {
        window.console.log(msg);
    }
}

function synthesizeGLError(err, opt_msg) {
    glErrorShadow[err] = true;
    if (opt_msg !== undefined) {
        error(opt_msg)
    }
}

function wrapGLError(gl) {
    var f = gl.getError;
    gl.getError = function() {
        var err;
        do {
            err = f.apply(gl);
            if (err != gl.NO_ERROR) {
                glErrorShadow[err] = true;
            }
        } while (err != gl.NO_ERROR);
        for (var err in glErrorShadow) {
            if (glErrorShadow[err]) {
                delete glErrorShadow[err];
                return parseInt(err);
            }
        }
        return gl.NO_ERROR;
    };
}

var WebGLVertexArrayObjectOES = function WebGLVertexArrayObjectOES(ext) {
    var gl = ext.gl;
    
    this.ext = ext;
    this.isAlive = true;
    this.hasBeenBound = false;
    
    this.elementArrayBuffer = null;
    this.attribs = new Array(ext.maxVertexAttribs);
    for (var n = 0; n < this.attribs.length; n++) {
        var attrib = new WebGLVertexArrayObjectOES.VertexAttrib(gl);
        this.attribs[n] = attrib;
    }
    
    this.maxAttrib = 0;
};

WebGLVertexArrayObjectOES.VertexAttrib = function VertexAttrib(gl) {
    this.enabled = false;
    this.buffer = null;
    this.size = 4;
    this.type = gl.FLOAT;
    this.normalized = false;
    this.stride = 16;
    this.offset = 0;
    
    this.cached = "";
    this.recache();
};
WebGLVertexArrayObjectOES.VertexAttrib.prototype.recache = function recache() {
    this.cached = [this.size, this.type, this.normalized, this.stride, this.offset].join(":");
};

var OESVertexArrayObject = function OESVertexArrayObject(gl) {
    var self = this;
    this.gl = gl;

    wrapGLError(gl);
    
    var original = this.original = {
        getParameter: gl.getParameter,
        enableVertexAttribArray: gl.enableVertexAttribArray,
        disableVertexAttribArray: gl.disableVertexAttribArray,
        bindBuffer: gl.bindBuffer,
        getVertexAttrib: gl.getVertexAttrib,
        vertexAttribPointer: gl.vertexAttribPointer
    };
    
    gl.getParameter = function getParameter(pname) {
        if (pname == self.VERTEX_ARRAY_BINDING_OES) {
            if (self.currentVertexArrayObject == self.defaultVertexArrayObject) {
                return null;
            } else {
                return self.currentVertexArrayObject;
            }
        }
        return original.getParameter.apply(this, arguments);
    };
    
    gl.enableVertexAttribArray = function enableVertexAttribArray(index) {
        var vao = self.currentVertexArrayObject;
        vao.maxAttrib = Math.max(vao.maxAttrib, index);
        var attrib = vao.attribs[index];
        attrib.enabled = true;
        return original.enableVertexAttribArray.apply(this, arguments);
    };
    gl.disableVertexAttribArray = function disableVertexAttribArray(index) {
        var vao = self.currentVertexArrayObject;
        vao.maxAttrib = Math.max(vao.maxAttrib, index);
        var attrib = vao.attribs[index];
        attrib.enabled = false;
        return original.disableVertexAttribArray.apply(this, arguments);
    };
    
    gl.bindBuffer = function bindBuffer(target, buffer) {
        switch (target) {
            case gl.ARRAY_BUFFER:
                self.currentArrayBuffer = buffer;
                break;
            case gl.ELEMENT_ARRAY_BUFFER:
                self.currentVertexArrayObject.elementArrayBuffer = buffer;
                break;
        }
        return original.bindBuffer.apply(this, arguments);
    };
    
    gl.getVertexAttrib = function getVertexAttrib(index, pname) {
        var vao = self.currentVertexArrayObject;
        var attrib = vao.attribs[index];
        switch (pname) {
            case gl.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING:
                return attrib.buffer;
            case gl.VERTEX_ATTRIB_ARRAY_ENABLED:
                return attrib.enabled;
            case gl.VERTEX_ATTRIB_ARRAY_SIZE:
                return attrib.size;
            case gl.VERTEX_ATTRIB_ARRAY_STRIDE:
                return attrib.stride;
            case gl.VERTEX_ATTRIB_ARRAY_TYPE:
                return attrib.type;
            case gl.VERTEX_ATTRIB_ARRAY_NORMALIZED:
                return attrib.normalized;
            default:
                return original.getVertexAttrib.apply(this, arguments);
        }
    };
    
    gl.vertexAttribPointer = function vertexAttribPointer(indx, size, type, normalized, stride, offset) {
        var vao = self.currentVertexArrayObject;
        vao.maxAttrib = Math.max(vao.maxAttrib, indx);
        var attrib = vao.attribs[indx];
        attrib.buffer = self.currentArrayBuffer;
        attrib.size = size;
        attrib.type = type;
        attrib.normalized = normalized;
        attrib.stride = stride;
        attrib.offset = offset;
        attrib.recache();
        return original.vertexAttribPointer.apply(this, arguments);
    };
    
    if (gl.instrumentExtension) {
        gl.instrumentExtension(this, "OES_vertex_array_object");
    }

    gl.canvas.addEventListener('webglcontextrestored', function() {
        log("OESVertexArrayObject emulation library context restored");
        self.reset_();
    }, true);

    this.reset_();
};

OESVertexArrayObject.prototype.VERTEX_ARRAY_BINDING_OES = 0x85B5;

OESVertexArrayObject.prototype.reset_ = function reset_() {
    var contextWasLost = this.vertexArrayObjects !== undefined;
    if (contextWasLost) {
        for (var ii = 0; ii < this.vertexArrayObjects.length; ++ii) {
            this.vertexArrayObjects.isAlive = false;
        }
    }
    var gl = this.gl;
    this.maxVertexAttribs = gl.getParameter(gl.MAX_VERTEX_ATTRIBS);

    this.defaultVertexArrayObject = new WebGLVertexArrayObjectOES(this);
    this.currentVertexArrayObject = null;
    this.currentArrayBuffer = null;
    this.vertexArrayObjects = [this.defaultVertexArrayObject];
    
    this.bindVertexArrayOES(null);
};

OESVertexArrayObject.prototype.createVertexArrayOES = function createVertexArrayOES() {
    var arrayObject = new WebGLVertexArrayObjectOES(this);
    this.vertexArrayObjects.push(arrayObject);
    return arrayObject;
};

OESVertexArrayObject.prototype.deleteVertexArrayOES = function deleteVertexArrayOES(arrayObject) {
    arrayObject.isAlive = false;
    this.vertexArrayObjects.splice(this.vertexArrayObjects.indexOf(arrayObject), 1);
    if (this.currentVertexArrayObject == arrayObject) {
        this.bindVertexArrayOES(null);
    }
};

OESVertexArrayObject.prototype.isVertexArrayOES = function isVertexArrayOES(arrayObject) {
    if (arrayObject && arrayObject instanceof WebGLVertexArrayObjectOES) {
        if (arrayObject.hasBeenBound && arrayObject.ext == this) {
            return true;
        }
    }
    return false;
};

OESVertexArrayObject.prototype.bindVertexArrayOES = function bindVertexArrayOES(arrayObject) {
    var gl = this.gl;
    if (arrayObject && !arrayObject.isAlive) {
        synthesizeGLError(gl.INVALID_OPERATION, "bindVertexArrayOES: attempt to bind deleted arrayObject");
        return;
    }
    var original = this.original;

    var oldVAO = this.currentVertexArrayObject;
    this.currentVertexArrayObject = arrayObject || this.defaultVertexArrayObject;
    this.currentVertexArrayObject.hasBeenBound = true;
    var newVAO = this.currentVertexArrayObject;
    
    if (oldVAO == newVAO) {
        return;
    }
    
    if (!oldVAO || newVAO.elementArrayBuffer != oldVAO.elementArrayBuffer) {
        original.bindBuffer.call(gl, gl.ELEMENT_ARRAY_BUFFER, newVAO.elementArrayBuffer);
    }
    
    var currentBinding = this.currentArrayBuffer;
    var maxAttrib = Math.max(oldVAO ? oldVAO.maxAttrib : 0, newVAO.maxAttrib);
    for (var n = 0; n <= maxAttrib; n++) {
        var attrib = newVAO.attribs[n];
        var oldAttrib = oldVAO ? oldVAO.attribs[n] : null;
        
        if (!oldVAO || attrib.enabled != oldAttrib.enabled) {
            if (attrib.enabled) {
                original.enableVertexAttribArray.call(gl, n);
            } else {
                original.disableVertexAttribArray.call(gl, n);
            }
        }
        
        if (attrib.enabled) {
            var bufferChanged = false;
            if (!oldVAO || attrib.buffer != oldAttrib.buffer) {
                if (currentBinding != attrib.buffer) {
                    original.bindBuffer.call(gl, gl.ARRAY_BUFFER, attrib.buffer);
                    currentBinding = attrib.buffer;
                }
                bufferChanged = true;
            }
            
            if (bufferChanged || attrib.cached != oldAttrib.cached) {
                original.vertexAttribPointer.call(gl, n, attrib.size, attrib.type, attrib.normalized, attrib.stride, attrib.offset);
            }
        }
    }
    
    if (this.currentArrayBuffer != currentBinding) {
        original.bindBuffer.call(gl, gl.ARRAY_BUFFER, this.currentArrayBuffer);
    }
};

// You MUST call this BEFORE adding event listeners for 'webglcontextrestored'
if(typeof window !== 'undefined'){
    window.setupVertexArrayObject = function(gl) {
        // Ignore if already installed (or the browser provides the extension)
        // FIXME: when all stable browsers support getSupportedExtensions
        // and getExtension, remove the workarounds below.
        if (gl.getSupportedExtensions) {
            var exts = gl.getSupportedExtensions();
            if (exts.indexOf("OES_vertex_array_object") != -1) {
                return;
            }
        } else if (gl.getExtension) {
            var vao = gl.getExtension("OES_vertex_array_object");
            if (vao) {
                return;
            }
        }

        if (gl.getSupportedExtensions) {
            var original_getSupportedExtensions = gl.getSupportedExtensions;
            gl.getSupportedExtensions = function getSupportedExtensions() {
                var list = original_getSupportedExtensions.call(this) || [];
                list.push("OES_vertex_array_object");
                return list;
            };
        }
        
        var original_getExtension = gl.getExtension;
        gl.getExtension = function getExtension(name) {
            if (name == "OES_vertex_array_object") {
                if (!gl.__OESVertexArrayObject) {
                    gl.__OESVertexArrayObject = new OESVertexArrayObject(gl);
                }
                return gl.__OESVertexArrayObject;
            }
            if (original_getExtension) {
                return original_getExtension.call(this, name);
            } else {
                return null;
            }
        };
    }
}

}());
