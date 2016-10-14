(function () {

window.WebVRConfig = {
    DEFER_INITIALIZATION: true
};

var mat4_invert;
var localStorage = window.localStorage;
var cancelAnimationFrame = window.cancelAnimationFrame;
// var WebVRConfig = window.WebVRConfig;
var require = window.require;

(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
'use strict';
/* eslint-disable no-unused-vars */
var hasOwnProperty = Object.prototype.hasOwnProperty;
var propIsEnumerable = Object.prototype.propertyIsEnumerable;

function toObject(val) {
    if (val === null || val === undefined) {
        throw new TypeError('Object.assign cannot be called with null or undefined');
    }

    return Object(val);
}

function shouldUseNative() {
    try {
        if (!Object.assign) {
            return false;
        }

        // Detect buggy property enumeration order in older V8 versions.

        // https://bugs.chromium.org/p/v8/issues/detail?id=4118
        var test1 = new String('abc');  // eslint-disable-line
        test1[5] = 'de';
        if (Object.getOwnPropertyNames(test1)[0] === '5') {
            return false;
        }

        // https://bugs.chromium.org/p/v8/issues/detail?id=3056
        var test2 = {};
        for (var i = 0; i < 10; i++) {
            test2['_' + String.fromCharCode(i)] = i;
        }
        var order2 = Object.getOwnPropertyNames(test2).map(function (n) {
            return test2[n];
        });
        if (order2.join('') !== '0123456789') {
            return false;
        }

        // https://bugs.chromium.org/p/v8/issues/detail?id=3056
        var test3 = {};
        'abcdefghijklmnopqrst'.split('').forEach(function (letter) {
            test3[letter] = letter;
        });
        if (Object.keys(Object.assign({}, test3)).join('') !==
                'abcdefghijklmnopqrst') {
            return false;
        }

        return true;
    } catch (e) {
        // We don't expect any of the above to throw, but better to be safe.
        return false;
    }
}

module.exports = shouldUseNative() ? Object.assign : function (target, source) {
    var from;
    var to = toObject(target);
    var symbols;

    for (var s = 1; s < arguments.length; s++) {
        from = Object(arguments[s]);

        for (var key in from) {
            if (hasOwnProperty.call(from, key)) {
                to[key] = from[key];
            }
        }

        if (Object.getOwnPropertySymbols) {
            symbols = Object.getOwnPropertySymbols(from);
            for (var i = 0; i < symbols.length; i++) {
                if (propIsEnumerable.call(from, symbols[i])) {
                    to[symbols[i]] = from[symbols[i]];
                }
            }
        }
    }

    return to;
};

},{}],2:[function(_dereq_,module,exports){
/*
 * Copyright 2015 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var Util = _dereq_('./util.js');
var WakeLock = _dereq_('./wakelock.js');

// Start at a higher number to reduce chance of conflict.
var nextDisplayId = 1000;
var hasShowDeprecationWarning = false;

var defaultLeftBounds = [0, 0, 0.5, 1];
var defaultRightBounds = [0.5, 0, 0.5, 1];

/**
 * The base class for all VR frame data.
 */

function VRFrameData() {
  this.leftProjectionMatrix = new Float32Array(16);
  this.leftViewMatrix = new Float32Array(16);
  this.rightProjectionMatrix = new Float32Array(16);
  this.rightViewMatrix = new Float32Array(16);
  this.pose = null;
};

/**
 * The base class for all VR displays.
 */
function VRDisplay() {
  this.isPolyfilled = true;
  this.displayId = nextDisplayId++;
  this.displayName = 'webvr-polyfill displayName';

  this.depthNear = 0.01;
  this.depthFar = 10000.0;

  this.isConnected = true;
  this.isPresenting = false;
  this.capabilities = {
    hasPosition: false,
    hasOrientation: false,
    hasExternalDisplay: false,
    canPresent: false,
    maxLayers: 1
  };
  this.stageParameters = null;

  // "Private" members.
  this.waitingForPresent_ = false;
  this.layer_ = null;

  this.fullscreenElement_ = null;
  this.fullscreenWrapper_ = null;
  this.fullscreenElementCachedStyle_ = null;

  this.fullscreenEventTarget_ = null;
  this.fullscreenChangeHandler_ = null;
  this.fullscreenErrorHandler_ = null;

  this.wakelock_ = new WakeLock();
}

VRDisplay.prototype.getFrameData = function(frameData) {
  // TODO: Technically this should retain it's value for the duration of a frame
  // but I doubt that's practical to do in javascript.
  return Util.frameDataFromPose(frameData, this.getPose(), this);
};

VRDisplay.prototype.getPose = function() {
  // TODO: Technically this should retain it's value for the duration of a frame
  // but I doubt that's practical to do in javascript.
  return this.getImmediatePose();
};

VRDisplay.prototype.requestAnimationFrame = function(callback) {
  return window.requestAnimationFrame(callback);
};

VRDisplay.prototype.cancelAnimationFrame = function(id) {
  return window.cancelAnimationFrame(id);
};

VRDisplay.prototype.wrapForFullscreen = function(element) {
  // Don't wrap in iOS.
  if (Util.isIOS()) {
    return element;
  }
  if (!this.fullscreenWrapper_) {
    this.fullscreenWrapper_ = document.createElement('div');
    var cssProperties = [
      'height: ' + Math.min(screen.height, screen.width) + 'px !important',
      'top: 0 !important',
      'left: 0 !important',
      'right: 0 !important',
      'border: 0',
      'margin: 0',
      'padding: 0',
      'z-index: 999999 !important',
      'position: fixed',
    ];
    this.fullscreenWrapper_.setAttribute('style', cssProperties.join('; ') + ';');
    this.fullscreenWrapper_.classList.add('webvr-polyfill-fullscreen-wrapper');
  }

  if (this.fullscreenElement_ == element) {
    return this.fullscreenWrapper_;
  }

  // Remove any previously applied wrappers
  this.removeFullscreenWrapper();

  this.fullscreenElement_ = element;
  var parent = this.fullscreenElement_.parentElement;
  parent.insertBefore(this.fullscreenWrapper_, this.fullscreenElement_);
  parent.removeChild(this.fullscreenElement_);
  this.fullscreenWrapper_.insertBefore(this.fullscreenElement_, this.fullscreenWrapper_.firstChild);
  this.fullscreenElementCachedStyle_ = this.fullscreenElement_.getAttribute('style');

  var self = this;
  function applyFullscreenElementStyle() {
    if (!self.fullscreenElement_) {
      return;
    }

    var cssProperties = [
      'position: absolute',
      'top: 0',
      'left: 0',
      'width: ' + Math.max(screen.width, screen.height) + 'px',
      'height: ' + Math.min(screen.height, screen.width) + 'px',
      'border: 0',
      'margin: 0',
      'padding: 0',
    ];
    self.fullscreenElement_.setAttribute('style', cssProperties.join('; ') + ';');
  }

  applyFullscreenElementStyle();

  return this.fullscreenWrapper_;
};

VRDisplay.prototype.removeFullscreenWrapper = function() {
  if (!this.fullscreenElement_) {
    return;
  }

  var element = this.fullscreenElement_;
  if (this.fullscreenElementCachedStyle_) {
    element.setAttribute('style', this.fullscreenElementCachedStyle_);
  } else {
    element.removeAttribute('style');
  }
  this.fullscreenElement_ = null;
  this.fullscreenElementCachedStyle_ = null;

  var parent = this.fullscreenWrapper_.parentElement;
  this.fullscreenWrapper_.removeChild(element);
  parent.insertBefore(element, this.fullscreenWrapper_);
  parent.removeChild(this.fullscreenWrapper_);

  return element;
};

VRDisplay.prototype.requestPresent = function(layers) {
  var wasPresenting = this.isPresenting;
  var self = this;

  if (!(layers instanceof Array)) {
    if (!hasShowDeprecationWarning) {
      console.warn("Using a deprecated form of requestPresent. Should pass in an array of VRLayers.");
      hasShowDeprecationWarning = true;
    }
    layers = [layers];
  }

  return new Promise(function(resolve, reject) {
    if (!self.capabilities.canPresent) {
      reject(new Error('VRDisplay is not capable of presenting.'));
      return;
    }

    if (layers.length == 0 || layers.length > self.capabilities.maxLayers) {
      reject(new Error('Invalid number of layers.'));
      return;
    }

    var incomingLayer = layers[0];
    if (!incomingLayer.source) {
      /*
      todo: figure out the correct behavior if the source is not provided.
      see https://github.com/w3c/webvr/issues/58
      */
      resolve();
      return;
    }

    var leftBounds = incomingLayer.leftBounds || defaultLeftBounds;
    var rightBounds = incomingLayer.rightBounds || defaultRightBounds;
    if (wasPresenting) {
      // Already presenting, just changing configuration
      var changed = false;
      var layer = self.layer_;
      if (layer.source !== incomingLayer.source) {
        layer.source = incomingLayer.source;
        changed = true;
      }

      for (var i = 0; i < 4; i++) {
        if (layer.leftBounds[i] !== leftBounds[i]) {
          layer.leftBounds[i] = leftBounds[i];
          changed = true;
        }
        if (layer.rightBounds[i] !== rightBounds[i]) {
          layer.rightBounds[i] = rightBounds[i];
          changed = true;
        }
      }

      if (changed) {
        self.fireVRDisplayPresentChange_();
      }
      resolve();
      return;
    }

    // Was not already presenting.
    self.layer_ = {
      predistorted: incomingLayer.predistorted,
      source: incomingLayer.source,
      leftBounds: leftBounds.slice(0),
      rightBounds: rightBounds.slice(0)
    };

    self.waitingForPresent_ = false;
    if (self.layer_ && self.layer_.source) {
      var fullscreenElement = self.wrapForFullscreen(self.layer_.source);

      function onFullscreenChange() {
        var actualFullscreenElement = Util.getFullscreenElement();

        self.isPresenting = (fullscreenElement === actualFullscreenElement);
        if (self.isPresenting) {
          if (screen.orientation && screen.orientation.lock) {
            screen.orientation.lock('landscape-primary').catch(function(error){
                    console.error('screen.orientation.lock() failed due to', error.message)
            });
          }
          self.waitingForPresent_ = false;
          self.beginPresent_();
          resolve();
        } else {
          if (screen.orientation && screen.orientation.unlock) {
            screen.orientation.unlock();
          }
          self.removeFullscreenWrapper();
          self.wakelock_.release();
          self.endPresent_();
          self.removeFullscreenListeners_();
        }
        self.fireVRDisplayPresentChange_();
      }
      function onFullscreenError() {
        if (!self.waitingForPresent_) {
          return;
        }

        self.removeFullscreenWrapper();
        self.removeFullscreenListeners_();

        self.wakelock_.release();
        self.waitingForPresent_ = false;
        self.isPresenting = false;

        reject(new Error('Unable to present.'));
      }

      self.addFullscreenListeners_(fullscreenElement,
          onFullscreenChange, onFullscreenError);

      if (Util.requestFullscreen(fullscreenElement)) {
        self.wakelock_.request();
        self.waitingForPresent_ = true;
      } else if (Util.isIOS()) {
        // *sigh* Just fake it.
        self.wakelock_.request();
        self.isPresenting = true;
        self.beginPresent_();
        self.fireVRDisplayPresentChange_();
        resolve();
      }
    }

    if (!self.waitingForPresent_ && !Util.isIOS()) {
      Util.exitFullscreen();
      reject(new Error('Unable to present.'));
    }
  });
};

VRDisplay.prototype.exitPresent = function() {
  var wasPresenting = this.isPresenting;
  var self = this;
  this.isPresenting = false;
  this.layer_ = null;
  this.wakelock_.release();

  return new Promise(function(resolve, reject) {
    if (wasPresenting) {
      if (!Util.exitFullscreen() && Util.isIOS()) {
        self.endPresent_();
        self.fireVRDisplayPresentChange_();
      }

      resolve();
    } else {
      reject(new Error('Was not presenting to VRDisplay.'));
    }
  });
};

VRDisplay.prototype.getLayers = function() {
  if (this.layer_) {
    return [this.layer_];
  }
  return [];
};

VRDisplay.prototype.fireVRDisplayPresentChange_ = function() {
  var event = new CustomEvent('vrdisplaypresentchange', {detail: {vrdisplay: this}});
  window.dispatchEvent(event);
};

VRDisplay.prototype.addFullscreenListeners_ = function(element, changeHandler, errorHandler) {
  this.removeFullscreenListeners_();

  this.fullscreenEventTarget_ = element;
  this.fullscreenChangeHandler_ = changeHandler;
  this.fullscreenErrorHandler_ = errorHandler;

  if (changeHandler) {
    if (document.fullscreenEnabled) {
      element.addEventListener('fullscreenchange', changeHandler, false);
    } else if (document.webkitFullscreenEnabled) {
      element.addEventListener('webkitfullscreenchange', changeHandler, false);
    } else if (document.mozFullScreenEnabled) {
      document.addEventListener('mozfullscreenchange', changeHandler, false);
    } else if (document.msFullscreenEnabled) {
      element.addEventListener('msfullscreenchange', changeHandler, false);
    }
  }

  if (errorHandler) {
    if (document.fullscreenEnabled) {
      element.addEventListener('fullscreenerror', errorHandler, false);
    } else if (document.webkitFullscreenEnabled) {
      element.addEventListener('webkitfullscreenerror', errorHandler, false);
    } else if (document.mozFullScreenEnabled) {
      document.addEventListener('mozfullscreenerror', errorHandler, false);
    } else if (document.msFullscreenEnabled) {
      element.addEventListener('msfullscreenerror', errorHandler, false);
    }
  }
};

VRDisplay.prototype.removeFullscreenListeners_ = function() {
  if (!this.fullscreenEventTarget_)
    return;

  var element = this.fullscreenEventTarget_;

  if (this.fullscreenChangeHandler_) {
    var changeHandler = this.fullscreenChangeHandler_;
    element.removeEventListener('fullscreenchange', changeHandler, false);
    element.removeEventListener('webkitfullscreenchange', changeHandler, false);
    document.removeEventListener('mozfullscreenchange', changeHandler, false);
    element.removeEventListener('msfullscreenchange', changeHandler, false);
  }

  if (this.fullscreenErrorHandler_) {
    var errorHandler = this.fullscreenErrorHandler_;
    element.removeEventListener('fullscreenerror', errorHandler, false);
    element.removeEventListener('webkitfullscreenerror', errorHandler, false);
    document.removeEventListener('mozfullscreenerror', errorHandler, false);
    element.removeEventListener('msfullscreenerror', errorHandler, false);
  }

  this.fullscreenEventTarget_ = null;
  this.fullscreenChangeHandler_ = null;
  this.fullscreenErrorHandler_ = null;
};

VRDisplay.prototype.beginPresent_ = function() {
  // Override to add custom behavior when presentation begins.
};

VRDisplay.prototype.endPresent_ = function() {
  // Override to add custom behavior when presentation ends.
};

VRDisplay.prototype.submitFrame = function(pose) {
  // Override to add custom behavior for frame submission.
};

VRDisplay.prototype.getEyeParameters = function(whichEye) {
  // Override to return accurate eye parameters if canPresent is true.
  return null;
};

/*
 * Deprecated classes
 */

/**
 * The base class for all VR devices. (Deprecated)
 */
function VRDevice() {
  this.isPolyfilled = true;
  this.hardwareUnitId = 'webvr-polyfill hardwareUnitId';
  this.deviceId = 'webvr-polyfill deviceId';
  this.deviceName = 'webvr-polyfill deviceName';
}

/**
 * The base class for all VR HMD devices. (Deprecated)
 */
function HMDVRDevice() {
}
HMDVRDevice.prototype = new VRDevice();

/**
 * The base class for all VR position sensor devices. (Deprecated)
 */
function PositionSensorVRDevice() {
}
PositionSensorVRDevice.prototype = new VRDevice();

module.exports.VRFrameData = VRFrameData;
module.exports.VRDisplay = VRDisplay;
module.exports.VRDevice = VRDevice;
module.exports.HMDVRDevice = HMDVRDevice;
module.exports.PositionSensorVRDevice = PositionSensorVRDevice;

},{"./util.js":22,"./wakelock.js":24}],3:[function(_dereq_,module,exports){
/*
 * Copyright 2016 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var CardboardUI = _dereq_('./cardboard-ui.js');
var Util = _dereq_('./util.js');
var WGLUPreserveGLState = _dereq_('./deps/wglu-preserve-state.js');

var distortionVS = [
  'attribute vec2 position;',
  'attribute vec3 texCoord;',

  'varying vec2 vTexCoord;',

  'uniform vec4 viewportOffsetScale[2];',

  'void main() {',
  '  vec4 viewport = viewportOffsetScale[int(texCoord.z)];',
  '  vTexCoord = (texCoord.xy * viewport.zw) + viewport.xy;',
  '  gl_Position = vec4( position, 1.0, 1.0 );',
  '}',
].join('\n');

var distortionFS = [
  'precision mediump float;',
  'uniform sampler2D diffuse;',

  'varying vec2 vTexCoord;',

  'void main() {',
  '  gl_FragColor = texture2D(diffuse, vTexCoord);',
  '}',
].join('\n');

/**
 * A mesh-based distorter.
 */
function CardboardDistorter(gl) {
  this.gl = gl;
  this.ctxAttribs = gl.getContextAttributes();

  this.meshWidth = 20;
  this.meshHeight = 20;

  this.bufferScale = WebVRConfig.BUFFER_SCALE;

  this.bufferWidth = gl.drawingBufferWidth;
  this.bufferHeight = gl.drawingBufferHeight;

  // Patching support
  this.realBindFramebuffer = gl.bindFramebuffer;
  this.realEnable = gl.enable;
  this.realDisable = gl.disable;
  this.realColorMask = gl.colorMask;
  this.realClearColor = gl.clearColor;
  this.realViewport = gl.viewport;

  if (!Util.isIOS()) {
    this.realCanvasWidth = Object.getOwnPropertyDescriptor(gl.canvas.__proto__, 'width');
    this.realCanvasHeight = Object.getOwnPropertyDescriptor(gl.canvas.__proto__, 'height');
  }

  this.isPatched = false;

  // State tracking
  this.lastBoundFramebuffer = null;
  this.cullFace = false;
  this.depthTest = false;
  this.blend = false;
  this.scissorTest = false;
  this.stencilTest = false;
  this.viewport = [0, 0, 0, 0];
  this.colorMask = [true, true, true, true];
  this.clearColor = [0, 0, 0, 0];

  this.attribs = {
    position: 0,
    texCoord: 1
  };
  this.program = Util.linkProgram(gl, distortionVS, distortionFS, this.attribs);
  this.uniforms = Util.getProgramUniforms(gl, this.program);

  this.viewportOffsetScale = new Float32Array(8);
  this.setTextureBounds();

  this.vertexBuffer = gl.createBuffer();
  this.indexBuffer = gl.createBuffer();
  this.indexCount = 0;

  this.renderTarget = gl.createTexture();
  this.framebuffer = gl.createFramebuffer();

  this.depthStencilBuffer = null;
  this.depthBuffer = null;
  this.stencilBuffer = null;

  if (this.ctxAttribs.depth && this.ctxAttribs.stencil) {
    this.depthStencilBuffer = gl.createRenderbuffer();
  } else if (this.ctxAttribs.depth) {
    this.depthBuffer = gl.createRenderbuffer();
  } else if (this.ctxAttribs.stencil) {
    this.stencilBuffer = gl.createRenderbuffer();
  }

  this.patch();

  this.onResize();

  if (!WebVRConfig.CARDBOARD_UI_DISABLED) {
    this.cardboardUI = new CardboardUI(gl);
  }
};

/**
 * Tears down all the resources created by the distorter and removes any
 * patches.
 */
CardboardDistorter.prototype.destroy = function() {
  var gl = this.gl;

  this.unpatch();

  gl.deleteProgram(this.program);
  gl.deleteBuffer(this.vertexBuffer);
  gl.deleteBuffer(this.indexBuffer);
  gl.deleteTexture(this.renderTarget);
  gl.deleteFramebuffer(this.framebuffer);
  if (this.depthStencilBuffer) {
    gl.deleteRenderbuffer(this.depthStencilBuffer);
  }
  if (this.depthBuffer) {
    gl.deleteRenderbuffer(this.depthBuffer);
  }
  if (this.stencilBuffer) {
    gl.deleteRenderbuffer(this.stencilBuffer);
  }

  if (this.cardboardUI) {
    this.cardboardUI.destroy();
  }
};


/**
 * Resizes the backbuffer to match the canvas width and height.
 */
CardboardDistorter.prototype.onResize = function() {
  var gl = this.gl;
  var self = this;

  var glState = [
    gl.RENDERBUFFER_BINDING,
    gl.TEXTURE_BINDING_2D, gl.TEXTURE0
  ];

  WGLUPreserveGLState(gl, glState, function(gl) {
    // Bind real backbuffer and clear it once. We don't need to clear it again
    // after that because we're overwriting the same area every frame.
    self.realBindFramebuffer.call(gl, gl.FRAMEBUFFER, null);

    // Put things in a good state
    if (self.scissorTest) { self.realDisable.call(gl, gl.SCISSOR_TEST); }
    self.realColorMask.call(gl, true, true, true, true);
    self.realViewport.call(gl, 0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    self.realClearColor.call(gl, 0, 0, 0, 1);

    gl.clear(gl.COLOR_BUFFER_BIT);

    // Now bind and resize the fake backbuffer
    self.realBindFramebuffer.call(gl, gl.FRAMEBUFFER, self.framebuffer);

    gl.bindTexture(gl.TEXTURE_2D, self.renderTarget);
    gl.texImage2D(gl.TEXTURE_2D, 0, self.ctxAttribs.alpha ? gl.RGBA : gl.RGB,
        self.bufferWidth, self.bufferHeight, 0,
        self.ctxAttribs.alpha ? gl.RGBA : gl.RGB, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, self.renderTarget, 0);

    if (self.ctxAttribs.depth && self.ctxAttribs.stencil) {
      gl.bindRenderbuffer(gl.RENDERBUFFER, self.depthStencilBuffer);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_STENCIL,
          self.bufferWidth, self.bufferHeight);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT,
          gl.RENDERBUFFER, self.depthStencilBuffer);
    } else if (self.ctxAttribs.depth) {
      gl.bindRenderbuffer(gl.RENDERBUFFER, self.depthBuffer);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16,
          self.bufferWidth, self.bufferHeight);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT,
          gl.RENDERBUFFER, self.depthBuffer);
    } else if (self.ctxAttribs.stencil) {
      gl.bindRenderbuffer(gl.RENDERBUFFER, self.stencilBuffer);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.STENCIL_INDEX8,
          self.bufferWidth, self.bufferHeight);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.STENCIL_ATTACHMENT,
          gl.RENDERBUFFER, self.stencilBuffer);
    }

    if (!gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE) {
      console.error('Framebuffer incomplete!');
    }

    self.realBindFramebuffer.call(gl, gl.FRAMEBUFFER, self.lastBoundFramebuffer);

    if (self.scissorTest) { self.realEnable.call(gl, gl.SCISSOR_TEST); }

    self.realColorMask.apply(gl, self.colorMask);
    self.realViewport.apply(gl, self.viewport);
    self.realClearColor.apply(gl, self.clearColor);
  });

  if (this.cardboardUI) {
    this.cardboardUI.onResize();
  }
};

CardboardDistorter.prototype.patch = function() {
  if (this.isPatched) {
    return;
  }

  var self = this;
  var canvas = this.gl.canvas;
  var gl = this.gl;

  if (!Util.isIOS()) {
    canvas.width = Util.getScreenWidth() * this.bufferScale;
    canvas.height = Util.getScreenHeight() * this.bufferScale;

    Object.defineProperty(canvas, 'width', {
      configurable: true,
      enumerable: true,
      get: function() {
        return self.bufferWidth;
      },
      set: function(value) {
        self.bufferWidth = value;
        self.onResize();
      }
    });

    Object.defineProperty(canvas, 'height', {
      configurable: true,
      enumerable: true,
      get: function() {
        return self.bufferHeight;
      },
      set: function(value) {
        self.bufferHeight = value;
        self.onResize();
      }
    });
  }

  this.lastBoundFramebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING);

  if (this.lastBoundFramebuffer == null) {
    this.lastBoundFramebuffer = this.framebuffer;
    this.gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
  }

  this.gl.bindFramebuffer = function(target, framebuffer) {
    self.lastBoundFramebuffer = framebuffer ? framebuffer : self.framebuffer;
    // Silently make calls to bind the default framebuffer bind ours instead.
    self.realBindFramebuffer.call(gl, target, self.lastBoundFramebuffer);
  };

  this.cullFace = gl.getParameter(gl.CULL_FACE);
  this.depthTest = gl.getParameter(gl.DEPTH_TEST);
  this.blend = gl.getParameter(gl.BLEND);
  this.scissorTest = gl.getParameter(gl.SCISSOR_TEST);
  this.stencilTest = gl.getParameter(gl.STENCIL_TEST);

  gl.enable = function(pname) {
    switch (pname) {
      case gl.CULL_FACE: self.cullFace = true; break;
      case gl.DEPTH_TEST: self.depthTest = true; break;
      case gl.BLEND: self.blend = true; break;
      case gl.SCISSOR_TEST: self.scissorTest = true; break;
      case gl.STENCIL_TEST: self.stencilTest = true; break;
    }
    self.realEnable.call(gl, pname);
  };

  gl.disable = function(pname) {
    switch (pname) {
      case gl.CULL_FACE: self.cullFace = false; break;
      case gl.DEPTH_TEST: self.depthTest = false; break;
      case gl.BLEND: self.blend = false; break;
      case gl.SCISSOR_TEST: self.scissorTest = false; break;
      case gl.STENCIL_TEST: self.stencilTest = false; break;
    }
    self.realDisable.call(gl, pname);
  };

  this.colorMask = gl.getParameter(gl.COLOR_WRITEMASK);
  gl.colorMask = function(r, g, b, a) {
    self.colorMask[0] = r;
    self.colorMask[1] = g;
    self.colorMask[2] = b;
    self.colorMask[3] = a;
    self.realColorMask.call(gl, r, g, b, a);
  };

  this.clearColor = gl.getParameter(gl.COLOR_CLEAR_VALUE);
  gl.clearColor = function(r, g, b, a) {
    self.clearColor[0] = r;
    self.clearColor[1] = g;
    self.clearColor[2] = b;
    self.clearColor[3] = a;
    self.realClearColor.call(gl, r, g, b, a);
  };

  this.viewport = gl.getParameter(gl.VIEWPORT);
  gl.viewport = function(x, y, w, h) {
    self.viewport[0] = x;
    self.viewport[1] = y;
    self.viewport[2] = w;
    self.viewport[3] = h;
    self.realViewport.call(gl, x, y, w, h);
  };

  this.isPatched = true;
  Util.safariCssSizeWorkaround(canvas);
};

CardboardDistorter.prototype.unpatch = function() {
  if (!this.isPatched) {
    return;
  }

  var gl = this.gl;
  var canvas = this.gl.canvas;

  if (!Util.isIOS()) {
    Object.defineProperty(canvas, 'width', this.realCanvasWidth);
    Object.defineProperty(canvas, 'height', this.realCanvasHeight);
  }
  canvas.width = this.bufferWidth;
  canvas.height = this.bufferHeight;

  gl.bindFramebuffer = this.realBindFramebuffer;
  gl.enable = this.realEnable;
  gl.disable = this.realDisable;
  gl.colorMask = this.realColorMask;
  gl.clearColor = this.realClearColor;
  gl.viewport = this.realViewport;

  // Check to see if our fake backbuffer is bound and bind the real backbuffer
  // if that's the case.
  if (this.lastBoundFramebuffer == this.framebuffer) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  this.isPatched = false;

  setTimeout(function() {
    Util.safariCssSizeWorkaround(canvas);
  }, 1);
};

CardboardDistorter.prototype.setTextureBounds = function(leftBounds, rightBounds) {
  if (!leftBounds) {
    leftBounds = [0, 0, 0.5, 1];
  }

  if (!rightBounds) {
    rightBounds = [0.5, 0, 0.5, 1];
  }

  // Left eye
  this.viewportOffsetScale[0] = leftBounds[0]; // X
  this.viewportOffsetScale[1] = leftBounds[1]; // Y
  this.viewportOffsetScale[2] = leftBounds[2]; // Width
  this.viewportOffsetScale[3] = leftBounds[3]; // Height

  // Right eye
  this.viewportOffsetScale[4] = rightBounds[0]; // X
  this.viewportOffsetScale[5] = rightBounds[1]; // Y
  this.viewportOffsetScale[6] = rightBounds[2]; // Width
  this.viewportOffsetScale[7] = rightBounds[3]; // Height
};

/**
 * Performs distortion pass on the injected backbuffer, rendering it to the real
 * backbuffer.
 */
CardboardDistorter.prototype.submitFrame = function() {
  var gl = this.gl;
  var self = this;

  var glState = [];

  if (!WebVRConfig.DIRTY_SUBMIT_FRAME_BINDINGS) {
    glState.push(
      gl.CURRENT_PROGRAM,
      gl.ARRAY_BUFFER_BINDING,
      gl.ELEMENT_ARRAY_BUFFER_BINDING,
      gl.TEXTURE_BINDING_2D, gl.TEXTURE0
    );
  }

  WGLUPreserveGLState(gl, glState, function(gl) {
    // Bind the real default framebuffer
    self.realBindFramebuffer.call(gl, gl.FRAMEBUFFER, null);

    // Make sure the GL state is in a good place
    if (self.cullFace) { self.realDisable.call(gl, gl.CULL_FACE); }
    if (self.depthTest) { self.realDisable.call(gl, gl.DEPTH_TEST); }
    if (self.blend) { self.realDisable.call(gl, gl.BLEND); }
    if (self.scissorTest) { self.realDisable.call(gl, gl.SCISSOR_TEST); }
    if (self.stencilTest) { self.realDisable.call(gl, gl.STENCIL_TEST); }
    self.realColorMask.call(gl, true, true, true, true);
    self.realViewport.call(gl, 0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);

    // If the backbuffer has an alpha channel clear every frame so the page
    // doesn't show through.
    if (self.ctxAttribs.alpha || Util.isIOS()) {
      self.realClearColor.call(gl, 0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }

    // Bind distortion program and mesh
    gl.useProgram(self.program);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, self.indexBuffer);

    gl.bindBuffer(gl.ARRAY_BUFFER, self.vertexBuffer);
    gl.enableVertexAttribArray(self.attribs.position);
    gl.enableVertexAttribArray(self.attribs.texCoord);
    gl.vertexAttribPointer(self.attribs.position, 2, gl.FLOAT, false, 20, 0);
    gl.vertexAttribPointer(self.attribs.texCoord, 3, gl.FLOAT, false, 20, 8);

    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(self.uniforms.diffuse, 0);
    gl.bindTexture(gl.TEXTURE_2D, self.renderTarget);

    gl.uniform4fv(self.uniforms.viewportOffsetScale, self.viewportOffsetScale);

    // Draws both eyes
    gl.drawElements(gl.TRIANGLES, self.indexCount, gl.UNSIGNED_SHORT, 0);

    if (self.cardboardUI) {
      self.cardboardUI.renderNoState();
    }

    // Bind the fake default framebuffer again
    self.realBindFramebuffer.call(self.gl, gl.FRAMEBUFFER, self.framebuffer);

    // If preserveDrawingBuffer == false clear the framebuffer
    if (!self.ctxAttribs.preserveDrawingBuffer) {
      self.realClearColor.call(gl, 0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }

    if (!WebVRConfig.DIRTY_SUBMIT_FRAME_BINDINGS) {
      self.realBindFramebuffer.call(gl, gl.FRAMEBUFFER, self.lastBoundFramebuffer);
    }

    // Restore state
    if (self.cullFace) { self.realEnable.call(gl, gl.CULL_FACE); }
    if (self.depthTest) { self.realEnable.call(gl, gl.DEPTH_TEST); }
    if (self.blend) { self.realEnable.call(gl, gl.BLEND); }
    if (self.scissorTest) { self.realEnable.call(gl, gl.SCISSOR_TEST); }
    if (self.stencilTest) { self.realEnable.call(gl, gl.STENCIL_TEST); }

    self.realColorMask.apply(gl, self.colorMask);
    self.realViewport.apply(gl, self.viewport);
    if (self.ctxAttribs.alpha || !self.ctxAttribs.preserveDrawingBuffer) {
      self.realClearColor.apply(gl, self.clearColor);
    }
  });

  // Workaround for the fact that Safari doesn't allow us to patch the canvas
  // width and height correctly. After each submit frame check to see what the
  // real backbuffer size has been set to and resize the fake backbuffer size
  // to match.
  if (Util.isIOS()) {
    var canvas = gl.canvas;
    if (canvas.width != self.bufferWidth || canvas.height != self.bufferHeight) {
      self.bufferWidth = canvas.width;
      self.bufferHeight = canvas.height;
      self.onResize();
    }
  }
};

/**
 * Call when the deviceInfo has changed. At this point we need
 * to re-calculate the distortion mesh.
 */
CardboardDistorter.prototype.updateDeviceInfo = function(deviceInfo) {
  var gl = this.gl;
  var self = this;

  var glState = [gl.ARRAY_BUFFER_BINDING, gl.ELEMENT_ARRAY_BUFFER_BINDING];
  WGLUPreserveGLState(gl, glState, function(gl) {
    var vertices = self.computeMeshVertices_(self.meshWidth, self.meshHeight, deviceInfo);
    gl.bindBuffer(gl.ARRAY_BUFFER, self.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    // Indices don't change based on device parameters, so only compute once.
    if (!self.indexCount) {
      var indices = self.computeMeshIndices_(self.meshWidth, self.meshHeight);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, self.indexBuffer);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
      self.indexCount = indices.length;
    }
  });
};

/**
 * Build the distortion mesh vertices.
 * Based on code from the Unity cardboard plugin.
 */
CardboardDistorter.prototype.computeMeshVertices_ = function(width, height, deviceInfo) {
  var vertices = new Float32Array(2 * width * height * 5);

  var lensFrustum = deviceInfo.getLeftEyeVisibleTanAngles();
  var noLensFrustum = deviceInfo.getLeftEyeNoLensTanAngles();
  var viewport = deviceInfo.getLeftEyeVisibleScreenRect(noLensFrustum);
  var vidx = 0;
  var iidx = 0;
  for (var e = 0; e < 2; e++) {
    for (var j = 0; j < height; j++) {
      for (var i = 0; i < width; i++, vidx++) {
        var u = i / (width - 1);
        var v = j / (height - 1);

        // Grid points regularly spaced in StreoScreen, and barrel distorted in
        // the mesh.
        var s = u;
        var t = v;
        var x = Util.lerp(lensFrustum[0], lensFrustum[2], u);
        var y = Util.lerp(lensFrustum[3], lensFrustum[1], v);
        var d = Math.sqrt(x * x + y * y);
        var r = deviceInfo.distortion.distortInverse(d);
        var p = x * r / d;
        var q = y * r / d;
        u = (p - noLensFrustum[0]) / (noLensFrustum[2] - noLensFrustum[0]);
        v = (q - noLensFrustum[3]) / (noLensFrustum[1] - noLensFrustum[3]);

        // Convert u,v to mesh screen coordinates.
        var aspect = deviceInfo.device.widthMeters / deviceInfo.device.heightMeters;

        // FIXME: The original Unity plugin multiplied U by the aspect ratio
        // and didn't multiply either value by 2, but that seems to get it
        // really close to correct looking for me. I hate this kind of "Don't
        // know why it works" code though, and wold love a more logical
        // explanation of what needs to happen here.
        u = (viewport.x + u * viewport.width - 0.5) * 2.0; //* aspect;
        v = (viewport.y + v * viewport.height - 0.5) * 2.0;

        vertices[(vidx * 5) + 0] = u; // position.x
        vertices[(vidx * 5) + 1] = v; // position.y
        vertices[(vidx * 5) + 2] = s; // texCoord.x
        vertices[(vidx * 5) + 3] = t; // texCoord.y
        vertices[(vidx * 5) + 4] = e; // texCoord.z (viewport index)
      }
    }
    var w = lensFrustum[2] - lensFrustum[0];
    lensFrustum[0] = -(w + lensFrustum[0]);
    lensFrustum[2] = w - lensFrustum[2];
    w = noLensFrustum[2] - noLensFrustum[0];
    noLensFrustum[0] = -(w + noLensFrustum[0]);
    noLensFrustum[2] = w - noLensFrustum[2];
    viewport.x = 1 - (viewport.x + viewport.width);
  }
  return vertices;
}

/**
 * Build the distortion mesh indices.
 * Based on code from the Unity cardboard plugin.
 */
CardboardDistorter.prototype.computeMeshIndices_ = function(width, height) {
  var indices = new Uint16Array(2 * (width - 1) * (height - 1) * 6);
  var halfwidth = width / 2;
  var halfheight = height / 2;
  var vidx = 0;
  var iidx = 0;
  for (var e = 0; e < 2; e++) {
    for (var j = 0; j < height; j++) {
      for (var i = 0; i < width; i++, vidx++) {
        if (i == 0 || j == 0)
          continue;
        // Build a quad.  Lower right and upper left quadrants have quads with
        // the triangle diagonal flipped to get the vignette to interpolate
        // correctly.
        if ((i <= halfwidth) == (j <= halfheight)) {
          // Quad diagonal lower left to upper right.
          indices[iidx++] = vidx;
          indices[iidx++] = vidx - width - 1;
          indices[iidx++] = vidx - width;
          indices[iidx++] = vidx - width - 1;
          indices[iidx++] = vidx;
          indices[iidx++] = vidx - 1;
        } else {
          // Quad diagonal upper left to lower right.
          indices[iidx++] = vidx - 1;
          indices[iidx++] = vidx - width;
          indices[iidx++] = vidx;
          indices[iidx++] = vidx - width;
          indices[iidx++] = vidx - 1;
          indices[iidx++] = vidx - width - 1;
        }
      }
    }
  }
  return indices;
};

CardboardDistorter.prototype.getOwnPropertyDescriptor_ = function(proto, attrName) {
  var descriptor = Object.getOwnPropertyDescriptor(proto, attrName);
  // In some cases (ahem... Safari), the descriptor returns undefined get and
  // set fields. In this case, we need to create a synthetic property
  // descriptor. This works around some of the issues in
  // https://github.com/borismus/webvr-polyfill/issues/46
  if (descriptor.get === undefined || descriptor.set === undefined) {
    descriptor.configurable = true;
    descriptor.enumerable = true;
    descriptor.get = function() {
      return this.getAttribute(attrName);
    };
    descriptor.set = function(val) {
      this.setAttribute(attrName, val);
    };
  }
  return descriptor;
};

module.exports = CardboardDistorter;

},{"./cardboard-ui.js":4,"./deps/wglu-preserve-state.js":6,"./util.js":22}],4:[function(_dereq_,module,exports){
/*
 * Copyright 2016 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var Util = _dereq_('./util.js');
var WGLUPreserveGLState = _dereq_('./deps/wglu-preserve-state.js');

var uiVS = [
  'attribute vec2 position;',

  'uniform mat4 projectionMat;',

  'void main() {',
  '  gl_Position = projectionMat * vec4( position, -1.0, 1.0 );',
  '}',
].join('\n');

var uiFS = [
  'precision mediump float;',

  'uniform vec4 color;',

  'void main() {',
  '  gl_FragColor = color;',
  '}',
].join('\n');

var DEG2RAD = Math.PI/180.0;

// The gear has 6 identical sections, each spanning 60 degrees.
var kAnglePerGearSection = 60;

// Half-angle of the span of the outer rim.
var kOuterRimEndAngle = 12;

// Angle between the middle of the outer rim and the start of the inner rim.
var kInnerRimBeginAngle = 20;

// Distance from center to outer rim, normalized so that the entire model
// fits in a [-1, 1] x [-1, 1] square.
var kOuterRadius = 1;

// Distance from center to depressed rim, in model units.
var kMiddleRadius = 0.75;

// Radius of the inner hollow circle, in model units.
var kInnerRadius = 0.3125;

// Center line thickness in DP.
var kCenterLineThicknessDp = 4;

// Button width in DP.
var kButtonWidthDp = 28;

// Factor to scale the touch area that responds to the touch.
var kTouchSlopFactor = 1.5;

var Angles = [
  0, kOuterRimEndAngle, kInnerRimBeginAngle,
  kAnglePerGearSection - kInnerRimBeginAngle,
  kAnglePerGearSection - kOuterRimEndAngle
];

/**
 * Renders the alignment line and "options" gear. It is assumed that the canvas
 * this is rendered into covers the entire screen (or close to it.)
 */
function CardboardUI(gl) {
  this.gl = gl;

  this.attribs = {
    position: 0
  };
  this.program = Util.linkProgram(gl, uiVS, uiFS, this.attribs);
  this.uniforms = Util.getProgramUniforms(gl, this.program);

  this.vertexBuffer = gl.createBuffer();
  this.gearOffset = 0;
  this.gearVertexCount = 0;
  this.arrowOffset = 0;
  this.arrowVertexCount = 0;

  this.projMat = new Float32Array(16);

  this.listener = null;

  this.onResize();
};

/**
 * Tears down all the resources created by the UI renderer.
 */
CardboardUI.prototype.destroy = function() {
  var gl = this.gl;

  if (this.listener) {
    gl.canvas.removeEventListener('click', this.listener, false);
  }

  gl.deleteProgram(this.program);
  gl.deleteBuffer(this.vertexBuffer);
};

/**
 * Adds a listener to clicks on the gear and back icons
 */
CardboardUI.prototype.listen = function(optionsCallback, backCallback) {
  var canvas = this.gl.canvas;
  this.listener = function(event) {
    var midline = canvas.clientWidth / 2;
    var buttonSize = kButtonWidthDp * kTouchSlopFactor;
    // Check to see if the user clicked on (or around) the gear icon
    if (event.clientX > midline - buttonSize &&
        event.clientX < midline + buttonSize &&
        event.clientY > canvas.clientHeight - buttonSize) {
      optionsCallback(event);
    }
    // Check to see if the user clicked on (or around) the back icon
    else if (event.clientX < buttonSize && event.clientY < buttonSize) {
      backCallback(event);
    }
  };
  canvas.addEventListener('click', this.listener, false);
};

/**
 * Builds the UI mesh.
 */
CardboardUI.prototype.onResize = function() {
  var gl = this.gl;
  var self = this;

  var glState = [
    gl.ARRAY_BUFFER_BINDING
  ];

  WGLUPreserveGLState(gl, glState, function(gl) {
    var vertices = [];

    var midline = gl.drawingBufferWidth / 2;

    // Assumes your canvas width and height is scaled proportionately.
    // TODO(smus): The following causes buttons to become huge on iOS, but seems
    // like the right thing to do. For now, added a hack. But really, investigate why.
    var dps = (gl.drawingBufferWidth / (screen.width * window.devicePixelRatio));
    if (!Util.isIOS()) {
      dps *= window.devicePixelRatio;
    }

    var lineWidth = kCenterLineThicknessDp * dps / 2;
    var buttonSize = kButtonWidthDp * kTouchSlopFactor * dps;
    var buttonScale = kButtonWidthDp * dps / 2;
    var buttonBorder = ((kButtonWidthDp * kTouchSlopFactor) - kButtonWidthDp) * dps;

    // Build centerline
    vertices.push(midline - lineWidth, buttonSize);
    vertices.push(midline - lineWidth, gl.drawingBufferHeight);
    vertices.push(midline + lineWidth, buttonSize);
    vertices.push(midline + lineWidth, gl.drawingBufferHeight);

    // Build gear
    self.gearOffset = (vertices.length / 2);

    function addGearSegment(theta, r) {
      var angle = (90 - theta) * DEG2RAD;
      var x = Math.cos(angle);
      var y = Math.sin(angle);
      vertices.push(kInnerRadius * x * buttonScale + midline, kInnerRadius * y * buttonScale + buttonScale);
      vertices.push(r * x * buttonScale + midline, r * y * buttonScale + buttonScale);
    }

    for (var i = 0; i <= 6; i++) {
      var segmentTheta = i * kAnglePerGearSection;

      addGearSegment(segmentTheta, kOuterRadius);
      addGearSegment(segmentTheta + kOuterRimEndAngle, kOuterRadius);
      addGearSegment(segmentTheta + kInnerRimBeginAngle, kMiddleRadius);
      addGearSegment(segmentTheta + (kAnglePerGearSection - kInnerRimBeginAngle), kMiddleRadius);
      addGearSegment(segmentTheta + (kAnglePerGearSection - kOuterRimEndAngle), kOuterRadius);
    }

    self.gearVertexCount = (vertices.length / 2) - self.gearOffset;

    // Build back arrow
    self.arrowOffset = (vertices.length / 2);

    function addArrowVertex(x, y) {
      vertices.push(buttonBorder + x, gl.drawingBufferHeight - buttonBorder - y);
    }

    var angledLineWidth = lineWidth / Math.sin(45 * DEG2RAD);

    addArrowVertex(0, buttonScale);
    addArrowVertex(buttonScale, 0);
    addArrowVertex(buttonScale + angledLineWidth, angledLineWidth);
    addArrowVertex(angledLineWidth, buttonScale + angledLineWidth);

    addArrowVertex(angledLineWidth, buttonScale - angledLineWidth);
    addArrowVertex(0, buttonScale);
    addArrowVertex(buttonScale, buttonScale * 2);
    addArrowVertex(buttonScale + angledLineWidth, (buttonScale * 2) - angledLineWidth);

    addArrowVertex(angledLineWidth, buttonScale - angledLineWidth);
    addArrowVertex(0, buttonScale);

    addArrowVertex(angledLineWidth, buttonScale - lineWidth);
    addArrowVertex(kButtonWidthDp * dps, buttonScale - lineWidth);
    addArrowVertex(angledLineWidth, buttonScale + lineWidth);
    addArrowVertex(kButtonWidthDp * dps, buttonScale + lineWidth);

    self.arrowVertexCount = (vertices.length / 2) - self.arrowOffset;

    // Buffer data
    gl.bindBuffer(gl.ARRAY_BUFFER, self.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
  });
};

/**
 * Performs distortion pass on the injected backbuffer, rendering it to the real
 * backbuffer.
 */
CardboardUI.prototype.render = function() {
  var gl = this.gl;
  var self = this;

  var glState = [
    gl.CULL_FACE,
    gl.DEPTH_TEST,
    gl.BLEND,
    gl.SCISSOR_TEST,
    gl.STENCIL_TEST,
    gl.COLOR_WRITEMASK,
    gl.VIEWPORT,

    gl.CURRENT_PROGRAM,
    gl.ARRAY_BUFFER_BINDING
  ];

  WGLUPreserveGLState(gl, glState, function(gl) {
    // Make sure the GL state is in a good place
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.disable(gl.SCISSOR_TEST);
    gl.disable(gl.STENCIL_TEST);
    gl.colorMask(true, true, true, true);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);

    self.renderNoState();
  });
};

CardboardUI.prototype.renderNoState = function() {
  var gl = this.gl;

  // Bind distortion program and mesh
  gl.useProgram(this.program);

  gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
  gl.enableVertexAttribArray(this.attribs.position);
  gl.vertexAttribPointer(this.attribs.position, 2, gl.FLOAT, false, 8, 0);

  gl.uniform4f(this.uniforms.color, 1.0, 1.0, 1.0, 1.0);

  Util.orthoMatrix(this.projMat, 0, gl.drawingBufferWidth, 0, gl.drawingBufferHeight, 0.1, 1024.0);
  gl.uniformMatrix4fv(this.uniforms.projectionMat, false, this.projMat);

  // Draws UI element
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  gl.drawArrays(gl.TRIANGLE_STRIP, this.gearOffset, this.gearVertexCount);
  gl.drawArrays(gl.TRIANGLE_STRIP, this.arrowOffset, this.arrowVertexCount);
};

module.exports = CardboardUI;

},{"./deps/wglu-preserve-state.js":6,"./util.js":22}],5:[function(_dereq_,module,exports){
/*
 * Copyright 2016 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var CardboardDistorter = _dereq_('./cardboard-distorter.js');
var CardboardUI = _dereq_('./cardboard-ui.js');
var DeviceInfo = _dereq_('./device-info.js');
var Dpdb = _dereq_('./dpdb/dpdb.js');
var FusionPoseSensor = _dereq_('./sensor-fusion/fusion-pose-sensor.js');
var RotateInstructions = _dereq_('./rotate-instructions.js');
var ViewerSelector = _dereq_('./viewer-selector.js');
var VRDisplay = _dereq_('./base.js').VRDisplay;
var Util = _dereq_('./util.js');

var Eye = {
  LEFT: 'left',
  RIGHT: 'right'
};

/**
 * VRDisplay based on mobile device parameters and DeviceMotion APIs.
 */
function CardboardVRDisplay() {
  this.displayName = 'Cardboard VRDisplay (webvr-polyfill)';

  this.capabilities.hasOrientation = true;
  this.capabilities.canPresent = true;

  // "Private" members.
  this.bufferScale_ = WebVRConfig.BUFFER_SCALE;
  this.poseSensor_ = new FusionPoseSensor();
  this.distorter_ = null;
  this.cardboardUI_ = null;

  this.dpdb_ = new Dpdb(true, this.onDeviceParamsUpdated_.bind(this));
  this.deviceInfo_ = new DeviceInfo(this.dpdb_.getDeviceParams());

  this.viewerSelector_ = new ViewerSelector();
  this.viewerSelector_.on('change', this.onViewerChanged_.bind(this));

  // Set the correct initial viewer.
  this.deviceInfo_.setViewer(this.viewerSelector_.getCurrentViewer());

  if (!WebVRConfig.ROTATE_INSTRUCTIONS_DISABLED) {
    this.rotateInstructions_ = new RotateInstructions();
  }

  if (Util.isIOS()) {
    // Listen for resize events to workaround this awful Safari bug.
    window.addEventListener('resize', this.onResize_.bind(this));
  }
}
CardboardVRDisplay.prototype = new VRDisplay();

CardboardVRDisplay.prototype.getImmediatePose = function() {
  return {
    position: this.poseSensor_.getPosition(),
    orientation: this.poseSensor_.getOrientation(),
    linearVelocity: null,
    linearAcceleration: null,
    angularVelocity: null,
    angularAcceleration: null
  };
};

CardboardVRDisplay.prototype.resetPose = function() {
  this.poseSensor_.resetPose();
};

CardboardVRDisplay.prototype.getEyeParameters = function(whichEye) {
  var offset = [this.deviceInfo_.viewer.interLensDistance * 0.5, 0.0, 0.0];
  var fieldOfView;

  // TODO: FoV can be a little expensive to compute. Cache when device params change.
  if (whichEye == Eye.LEFT) {
    offset[0] *= -1.0;
    fieldOfView = this.deviceInfo_.getFieldOfViewLeftEye();
  } else if (whichEye == Eye.RIGHT) {
    fieldOfView = this.deviceInfo_.getFieldOfViewRightEye();
  } else {
    console.error('Invalid eye provided: %s', whichEye);
    return null;
  }

  return {
    fieldOfView: fieldOfView,
    offset: offset,
    // TODO: Should be able to provide better values than these.
    renderWidth: this.deviceInfo_.device.width * 0.5 * this.bufferScale_,
    renderHeight: this.deviceInfo_.device.height * this.bufferScale_,
  };
};

CardboardVRDisplay.prototype.onDeviceParamsUpdated_ = function(newParams) {
  console.log('DPDB reported that device params were updated.');
  this.deviceInfo_.updateDeviceParams(newParams);

  if (this.distorter_) {
    this.distorter_.updateDeviceInfo(this.deviceInfo_);
  }
};

CardboardVRDisplay.prototype.updateBounds_ = function () {
  if (this.layer_ && this.distorter_ && (this.layer_.leftBounds || this.layer_.rightBounds)) {
    this.distorter_.setTextureBounds(this.layer_.leftBounds, this.layer_.rightBounds);
  }
};

CardboardVRDisplay.prototype.beginPresent_ = function() {
  var gl = this.layer_.source.getContext('webgl');
  if (!gl)
    gl = this.layer_.source.getContext('experimental-webgl');
  if (!gl)
    gl = this.layer_.source.getContext('webgl2');

  if (!gl)
    return; // Can't do distortion without a WebGL context.

  // Provides a way to opt out of distortion
  if (this.layer_.predistorted) {
    if (!WebVRConfig.CARDBOARD_UI_DISABLED) {
      gl.canvas.width = Util.getScreenWidth() * this.bufferScale_;
      gl.canvas.height = Util.getScreenHeight() * this.bufferScale_;
      this.cardboardUI_ = new CardboardUI(gl);
    }
  } else {
    // Create a new distorter for the target context
    this.distorter_ = new CardboardDistorter(gl);
    this.distorter_.updateDeviceInfo(this.deviceInfo_);
    this.cardboardUI_ = this.distorter_.cardboardUI;
  }

  if (this.cardboardUI_) {
    this.cardboardUI_.listen(function(e) {
      // Options clicked.
      this.viewerSelector_.show(this.layer_.source.parentElement);
      e.stopPropagation();
      e.preventDefault();
    }.bind(this), function(e) {
      // Back clicked.
      this.exitPresent();
      e.stopPropagation();
      e.preventDefault();
    }.bind(this));
  }

  if (this.rotateInstructions_) {
    if (Util.isLandscapeMode() && Util.isMobile()) {
      // In landscape mode, temporarily show the "put into Cardboard"
      // interstitial. Otherwise, do the default thing.
      this.rotateInstructions_.showTemporarily(3000, this.layer_.source.parentElement);
    } else {
      this.rotateInstructions_.update();
    }
  }

  // Listen for orientation change events in order to show interstitial.
  this.orientationHandler = this.onOrientationChange_.bind(this);
  window.addEventListener('orientationchange', this.orientationHandler);

  // Listen for present display change events in order to update distorter dimensions
  this.vrdisplaypresentchangeHandler = this.updateBounds_.bind(this);
  window.addEventListener('vrdisplaypresentchange', this.vrdisplaypresentchangeHandler);

  // Fire this event initially, to give geometry-distortion clients the chance
  // to do something custom.
  this.fireVRDisplayDeviceParamsChange_();
};

CardboardVRDisplay.prototype.endPresent_ = function() {
  if (this.distorter_) {
    this.distorter_.destroy();
    this.distorter_ = null;
  }
  if (this.cardboardUI_) {
    this.cardboardUI_.destroy();
    this.cardboardUI_ = null;
  }

  if (this.rotateInstructions_) {
    this.rotateInstructions_.hide();
  }
  this.viewerSelector_.hide();

  window.removeEventListener('orientationchange', this.orientationHandler);
  window.removeEventListener('vrdisplaypresentchange', this.vrdisplaypresentchangeHandler);
};

CardboardVRDisplay.prototype.submitFrame = function(pose) {
  if (this.distorter_) {
    this.distorter_.submitFrame();
  } else if (this.cardboardUI_ && this.layer_) {
    // Hack for predistorted: true.
    var canvas = this.layer_.source.getContext('webgl').canvas;
    if (canvas.width != this.lastWidth || canvas.height != this.lastHeight) {
      this.cardboardUI_.onResize();
    }
    this.lastWidth = canvas.width;
    this.lastHeight = canvas.height;

    // Render the Cardboard UI.
    this.cardboardUI_.render();
  }
};

CardboardVRDisplay.prototype.onOrientationChange_ = function(e) {
  console.log('onOrientationChange_');

  // Hide the viewer selector.
  this.viewerSelector_.hide();

  // Update the rotate instructions.
  if (this.rotateInstructions_) {
    this.rotateInstructions_.update();
  }

  this.onResize_();
};

CardboardVRDisplay.prototype.onResize_ = function(e) {
  if (this.layer_) {
    var gl = this.layer_.source.getContext('webgl');
    // Size the CSS canvas.
    // Added padding on right and bottom because iPhone 5 will not
    // hide the URL bar unless content is bigger than the screen.
    // This will not be visible as long as the container element (e.g. body)
    // is set to 'overflow: hidden'.
    var cssProperties = [
      'position: absolute',
      'top: 0',
      'left: 0',
      'width: ' + Math.max(screen.width, screen.height) + 'px',
      'height: ' + Math.min(screen.height, screen.width) + 'px',
      'border: 0',
      'margin: 0',
      'padding: 0 10px 10px 0',
    ];
    gl.canvas.setAttribute('style', cssProperties.join('; ') + ';');

    Util.safariCssSizeWorkaround(gl.canvas);
  }
};

CardboardVRDisplay.prototype.onViewerChanged_ = function(viewer) {
  this.deviceInfo_.setViewer(viewer);

  if (this.distorter_) {
    // Update the distortion appropriately.
    this.distorter_.updateDeviceInfo(this.deviceInfo_);
  }

  // Fire a new event containing viewer and device parameters for clients that
  // want to implement their own geometry-based distortion.
  this.fireVRDisplayDeviceParamsChange_();
};

CardboardVRDisplay.prototype.fireVRDisplayDeviceParamsChange_ = function() {
  var event = new CustomEvent('vrdisplaydeviceparamschange', {
    detail: {
      vrdisplay: this,
      deviceInfo: this.deviceInfo_,
    }
  });
  window.dispatchEvent(event);
};

module.exports = CardboardVRDisplay;

},{"./base.js":2,"./cardboard-distorter.js":3,"./cardboard-ui.js":4,"./device-info.js":7,"./dpdb/dpdb.js":11,"./rotate-instructions.js":16,"./sensor-fusion/fusion-pose-sensor.js":18,"./util.js":22,"./viewer-selector.js":23}],6:[function(_dereq_,module,exports){
/*
Copyright (c) 2016, Brandon Jones.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

/*
Caches specified GL state, runs a callback, and restores the cached state when
done.

Example usage:

var savedState = [
  gl.ARRAY_BUFFER_BINDING,

  // TEXTURE_BINDING_2D or _CUBE_MAP must always be followed by the texure unit.
  gl.TEXTURE_BINDING_2D, gl.TEXTURE0,

  gl.CLEAR_COLOR,
];
// After this call the array buffer, texture unit 0, active texture, and clear
// color will be restored. The viewport will remain changed, however, because
// gl.VIEWPORT was not included in the savedState list.
WGLUPreserveGLState(gl, savedState, function(gl) {
  gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, ....);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, ...);

  gl.clearColor(1, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
});

Note that this is not intended to be fast. Managing state in your own code to
avoid redundant state setting and querying will always be faster. This function
is most useful for cases where you may not have full control over the WebGL
calls being made, such as tooling or effect injectors.
*/

function WGLUPreserveGLState(gl, bindings, callback) {
  if (!bindings) {
    callback(gl);
    return;
  }

  var boundValues = [];

  var activeTexture = null;
  for (var i = 0; i < bindings.length; ++i) {
    var binding = bindings[i];
    switch (binding) {
      case gl.TEXTURE_BINDING_2D:
      case gl.TEXTURE_BINDING_CUBE_MAP:
        var textureUnit = bindings[++i];
        if (textureUnit < gl.TEXTURE0 || textureUnit > gl.TEXTURE31) {
          console.error("TEXTURE_BINDING_2D or TEXTURE_BINDING_CUBE_MAP must be followed by a valid texture unit");
          boundValues.push(null, null);
          break;
        }
        if (!activeTexture) {
          activeTexture = gl.getParameter(gl.ACTIVE_TEXTURE);
        }
        gl.activeTexture(textureUnit);
        boundValues.push(gl.getParameter(binding), null);
        break;
      case gl.ACTIVE_TEXTURE:
        activeTexture = gl.getParameter(gl.ACTIVE_TEXTURE);
        boundValues.push(null);
        break;
      default:
        boundValues.push(gl.getParameter(binding));
        break;
    }
  }

  callback(gl);

  for (var i = 0; i < bindings.length; ++i) {
    var binding = bindings[i];
    var boundValue = boundValues[i];
    switch (binding) {
      case gl.ACTIVE_TEXTURE:
        break; // Ignore this binding, since we special-case it to happen last.
      case gl.ARRAY_BUFFER_BINDING:
        gl.bindBuffer(gl.ARRAY_BUFFER, boundValue);
        break;
      case gl.COLOR_CLEAR_VALUE:
        gl.clearColor(boundValue[0], boundValue[1], boundValue[2], boundValue[3]);
        break;
      case gl.COLOR_WRITEMASK:
        gl.colorMask(boundValue[0], boundValue[1], boundValue[2], boundValue[3]);
        break;
      case gl.CURRENT_PROGRAM:
        gl.useProgram(boundValue);
        break;
      case gl.ELEMENT_ARRAY_BUFFER_BINDING:
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, boundValue);
        break;
      case gl.FRAMEBUFFER_BINDING:
        gl.bindFramebuffer(gl.FRAMEBUFFER, boundValue);
        break;
      case gl.RENDERBUFFER_BINDING:
        gl.bindRenderbuffer(gl.RENDERBUFFER, boundValue);
        break;
      case gl.TEXTURE_BINDING_2D:
        var textureUnit = bindings[++i];
        if (textureUnit < gl.TEXTURE0 || textureUnit > gl.TEXTURE31)
          break;
        gl.activeTexture(textureUnit);
        gl.bindTexture(gl.TEXTURE_2D, boundValue);
        break;
      case gl.TEXTURE_BINDING_CUBE_MAP:
        var textureUnit = bindings[++i];
        if (textureUnit < gl.TEXTURE0 || textureUnit > gl.TEXTURE31)
          break;
        gl.activeTexture(textureUnit);
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, boundValue);
        break;
      case gl.VIEWPORT:
        gl.viewport(boundValue[0], boundValue[1], boundValue[2], boundValue[3]);
        break;
      case gl.BLEND:
      case gl.CULL_FACE:
      case gl.DEPTH_TEST:
      case gl.SCISSOR_TEST:
      case gl.STENCIL_TEST:
        if (boundValue) {
          gl.enable(binding);
        } else {
          gl.disable(binding);
        }
        break;
      default:
        console.log("No GL restore behavior for 0x" + binding.toString(16));
        break;
    }

    if (activeTexture) {
      gl.activeTexture(activeTexture);
    }
  }
}

module.exports = WGLUPreserveGLState;
},{}],7:[function(_dereq_,module,exports){
/*
 * Copyright 2015 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var Distortion = _dereq_('./distortion/distortion.js');
var MathUtil = _dereq_('./math-util.js');
var Util = _dereq_('./util.js');

function Device(params) {
  this.width = params.width || Util.getScreenWidth();
  this.height = params.height || Util.getScreenHeight();
  this.widthMeters = params.widthMeters;
  this.heightMeters = params.heightMeters;
  this.bevelMeters = params.bevelMeters;
}


// Fallback Android device (based on Nexus 5 measurements) for use when
// we can't recognize an Android device.
var DEFAULT_ANDROID = new Device({
  widthMeters: 0.110,
  heightMeters: 0.062,
  bevelMeters: 0.004
});

// Fallback iOS device (based on iPhone6) for use when
// we can't recognize an Android device.
var DEFAULT_IOS = new Device({
  widthMeters: 0.1038,
  heightMeters: 0.0584,
  bevelMeters: 0.004
});


var Viewers = {
  CardboardV1: new CardboardViewer({
    id: 'CardboardV1',
    label: 'Cardboard I/O 2014',
    fov: 40,
    interLensDistance: 0.060,
    baselineLensDistance: 0.035,
    screenLensDistance: 0.042,
    distortionCoefficients: [0.441, 0.156],
    inverseCoefficients: [-0.4410035, 0.42756155, -0.4804439, 0.5460139,
      -0.58821183, 0.5733938, -0.48303202, 0.33299083, -0.17573841,
      0.0651772, -0.01488963, 0.001559834]
  }),
  CardboardV2: new CardboardViewer({
    id: 'CardboardV2',
    label: 'Cardboard I/O 2015',
    fov: 60,
    interLensDistance: 0.064,
    baselineLensDistance: 0.035,
    screenLensDistance: 0.039,
    distortionCoefficients: [0.34, 0.55],
    inverseCoefficients: [-0.33836704, -0.18162185, 0.862655, -1.2462051,
      1.0560602, -0.58208317, 0.21609078, -0.05444823, 0.009177956,
      -9.904169E-4, 6.183535E-5, -1.6981803E-6]
  })
};


var DEFAULT_LEFT_CENTER = {x: 0.5, y: 0.5};
var DEFAULT_RIGHT_CENTER = {x: 0.5, y: 0.5};

/**
 * Manages information about the device and the viewer.
 *
 * deviceParams indicates the parameters of the device to use (generally
 * obtained from dpdb.getDeviceParams()). Can be null to mean no device
 * params were found.
 */
function DeviceInfo(deviceParams) {
  this.viewer = Viewers.CardboardV2;
  this.updateDeviceParams(deviceParams);
  this.distortion = new Distortion(this.viewer.distortionCoefficients);
}

DeviceInfo.prototype.updateDeviceParams = function(deviceParams) {
  this.device = this.determineDevice_(deviceParams) || this.device;
};

DeviceInfo.prototype.getDevice = function() {
  return this.device;
};

DeviceInfo.prototype.setViewer = function(viewer) {
  this.viewer = viewer;
  this.distortion = new Distortion(this.viewer.distortionCoefficients);
};

DeviceInfo.prototype.determineDevice_ = function(deviceParams) {
  if (!deviceParams) {
    // No parameters, so use a default.
    if (Util.isIOS()) {
      console.warn('Using fallback iOS device measurements.');
      return DEFAULT_IOS;
    } else {
      console.warn('Using fallback Android device measurements.');
      return DEFAULT_ANDROID;
    }
  }

  // Compute device screen dimensions based on deviceParams.
  var METERS_PER_INCH = 0.0254;
  var metersPerPixelX = METERS_PER_INCH / deviceParams.xdpi;
  var metersPerPixelY = METERS_PER_INCH / deviceParams.ydpi;
  var width = Util.getScreenWidth();
  var height = Util.getScreenHeight();
  return new Device({
    widthMeters: metersPerPixelX * width,
    heightMeters: metersPerPixelY * height,
    bevelMeters: deviceParams.bevelMm * 0.001,
  });
};

/**
 * Calculates field of view for the left eye.
 */
DeviceInfo.prototype.getDistortedFieldOfViewLeftEye = function() {
  var viewer = this.viewer;
  var device = this.device;
  var distortion = this.distortion;

  // Device.height and device.width for device in portrait mode, so transpose.
  var eyeToScreenDistance = viewer.screenLensDistance;

  var outerDist = (device.widthMeters - viewer.interLensDistance) / 2;
  var innerDist = viewer.interLensDistance / 2;
  var bottomDist = viewer.baselineLensDistance - device.bevelMeters;
  var topDist = device.heightMeters - bottomDist;

  var outerAngle = MathUtil.radToDeg * Math.atan(
      distortion.distort(outerDist / eyeToScreenDistance));
  var innerAngle = MathUtil.radToDeg * Math.atan(
      distortion.distort(innerDist / eyeToScreenDistance));
  var bottomAngle = MathUtil.radToDeg * Math.atan(
      distortion.distort(bottomDist / eyeToScreenDistance));
  var topAngle = MathUtil.radToDeg * Math.atan(
      distortion.distort(topDist / eyeToScreenDistance));

  return {
    leftDegrees: Math.min(outerAngle, viewer.fov),
    rightDegrees: Math.min(innerAngle, viewer.fov),
    downDegrees: Math.min(bottomAngle, viewer.fov),
    upDegrees: Math.min(topAngle, viewer.fov)
  };
};

/**
 * Calculates the tan-angles from the maximum FOV for the left eye for the
 * current device and screen parameters.
 */
DeviceInfo.prototype.getLeftEyeVisibleTanAngles = function() {
  var viewer = this.viewer;
  var device = this.device;
  var distortion = this.distortion;

  // Tan-angles from the max FOV.
  var fovLeft = Math.tan(-MathUtil.degToRad * viewer.fov);
  var fovTop = Math.tan(MathUtil.degToRad * viewer.fov);
  var fovRight = Math.tan(MathUtil.degToRad * viewer.fov);
  var fovBottom = Math.tan(-MathUtil.degToRad * viewer.fov);
  // Viewport size.
  var halfWidth = device.widthMeters / 4;
  var halfHeight = device.heightMeters / 2;
  // Viewport center, measured from left lens position.
  var verticalLensOffset = (viewer.baselineLensDistance - device.bevelMeters - halfHeight);
  var centerX = viewer.interLensDistance / 2 - halfWidth;
  var centerY = -verticalLensOffset;
  var centerZ = viewer.screenLensDistance;
  // Tan-angles of the viewport edges, as seen through the lens.
  var screenLeft = distortion.distort((centerX - halfWidth) / centerZ);
  var screenTop = distortion.distort((centerY + halfHeight) / centerZ);
  var screenRight = distortion.distort((centerX + halfWidth) / centerZ);
  var screenBottom = distortion.distort((centerY - halfHeight) / centerZ);
  // Compare the two sets of tan-angles and take the value closer to zero on each side.
  var result = new Float32Array(4);
  result[0] = Math.max(fovLeft, screenLeft);
  result[1] = Math.min(fovTop, screenTop);
  result[2] = Math.min(fovRight, screenRight);
  result[3] = Math.max(fovBottom, screenBottom);
  return result;
};

/**
 * Calculates the tan-angles from the maximum FOV for the left eye for the
 * current device and screen parameters, assuming no lenses.
 */
DeviceInfo.prototype.getLeftEyeNoLensTanAngles = function() {
  var viewer = this.viewer;
  var device = this.device;
  var distortion = this.distortion;

  var result = new Float32Array(4);
  // Tan-angles from the max FOV.
  var fovLeft = distortion.distortInverse(Math.tan(-MathUtil.degToRad * viewer.fov));
  var fovTop = distortion.distortInverse(Math.tan(MathUtil.degToRad * viewer.fov));
  var fovRight = distortion.distortInverse(Math.tan(MathUtil.degToRad * viewer.fov));
  var fovBottom = distortion.distortInverse(Math.tan(-MathUtil.degToRad * viewer.fov));
  // Viewport size.
  var halfWidth = device.widthMeters / 4;
  var halfHeight = device.heightMeters / 2;
  // Viewport center, measured from left lens position.
  var verticalLensOffset = (viewer.baselineLensDistance - device.bevelMeters - halfHeight);
  var centerX = viewer.interLensDistance / 2 - halfWidth;
  var centerY = -verticalLensOffset;
  var centerZ = viewer.screenLensDistance;
  // Tan-angles of the viewport edges, as seen through the lens.
  var screenLeft = (centerX - halfWidth) / centerZ;
  var screenTop = (centerY + halfHeight) / centerZ;
  var screenRight = (centerX + halfWidth) / centerZ;
  var screenBottom = (centerY - halfHeight) / centerZ;
  // Compare the two sets of tan-angles and take the value closer to zero on each side.
  result[0] = Math.max(fovLeft, screenLeft);
  result[1] = Math.min(fovTop, screenTop);
  result[2] = Math.min(fovRight, screenRight);
  result[3] = Math.max(fovBottom, screenBottom);
  return result;
};

/**
 * Calculates the screen rectangle visible from the left eye for the
 * current device and screen parameters.
 */
DeviceInfo.prototype.getLeftEyeVisibleScreenRect = function(undistortedFrustum) {
  var viewer = this.viewer;
  var device = this.device;

  var dist = viewer.screenLensDistance;
  var eyeX = (device.widthMeters - viewer.interLensDistance) / 2;
  var eyeY = viewer.baselineLensDistance - device.bevelMeters;
  var left = (undistortedFrustum[0] * dist + eyeX) / device.widthMeters;
  var top = (undistortedFrustum[1] * dist + eyeY) / device.heightMeters;
  var right = (undistortedFrustum[2] * dist + eyeX) / device.widthMeters;
  var bottom = (undistortedFrustum[3] * dist + eyeY) / device.heightMeters;
  return {
    x: left,
    y: bottom,
    width: right - left,
    height: top - bottom
  };
};

DeviceInfo.prototype.getFieldOfViewLeftEye = function(opt_isUndistorted) {
  return opt_isUndistorted ? this.getUndistortedFieldOfViewLeftEye() :
      this.getDistortedFieldOfViewLeftEye();
};

DeviceInfo.prototype.getFieldOfViewRightEye = function(opt_isUndistorted) {
  var fov = this.getFieldOfViewLeftEye(opt_isUndistorted);
  return {
    leftDegrees: fov.rightDegrees,
    rightDegrees: fov.leftDegrees,
    upDegrees: fov.upDegrees,
    downDegrees: fov.downDegrees
  };
};

/**
 * Calculates undistorted field of view for the left eye.
 */
DeviceInfo.prototype.getUndistortedFieldOfViewLeftEye = function() {
  var p = this.getUndistortedParams_();

  return {
    leftDegrees: MathUtil.radToDeg * Math.atan(p.outerDist),
    rightDegrees: MathUtil.radToDeg * Math.atan(p.innerDist),
    downDegrees: MathUtil.radToDeg * Math.atan(p.bottomDist),
    upDegrees: MathUtil.radToDeg * Math.atan(p.topDist)
  };
};

DeviceInfo.prototype.getUndistortedViewportLeftEye = function() {
  var p = this.getUndistortedParams_();
  var viewer = this.viewer;
  var device = this.device;

  // Distances stored in local variables are in tan-angle units unless otherwise
  // noted.
  var eyeToScreenDistance = viewer.screenLensDistance;
  var screenWidth = device.widthMeters / eyeToScreenDistance;
  var screenHeight = device.heightMeters / eyeToScreenDistance;
  var xPxPerTanAngle = device.width / screenWidth;
  var yPxPerTanAngle = device.height / screenHeight;

  var x = Math.round((p.eyePosX - p.outerDist) * xPxPerTanAngle);
  var y = Math.round((p.eyePosY - p.bottomDist) * yPxPerTanAngle);
  return {
    x: x,
    y: y,
    width: Math.round((p.eyePosX + p.innerDist) * xPxPerTanAngle) - x,
    height: Math.round((p.eyePosY + p.topDist) * yPxPerTanAngle) - y
  };
};

DeviceInfo.prototype.getUndistortedParams_ = function() {
  var viewer = this.viewer;
  var device = this.device;
  var distortion = this.distortion;

  // Most of these variables in tan-angle units.
  var eyeToScreenDistance = viewer.screenLensDistance;
  var halfLensDistance = viewer.interLensDistance / 2 / eyeToScreenDistance;
  var screenWidth = device.widthMeters / eyeToScreenDistance;
  var screenHeight = device.heightMeters / eyeToScreenDistance;

  var eyePosX = screenWidth / 2 - halfLensDistance;
  var eyePosY = (viewer.baselineLensDistance - device.bevelMeters) / eyeToScreenDistance;

  var maxFov = viewer.fov;
  var viewerMax = distortion.distortInverse(Math.tan(MathUtil.degToRad * maxFov));
  var outerDist = Math.min(eyePosX, viewerMax);
  var innerDist = Math.min(halfLensDistance, viewerMax);
  var bottomDist = Math.min(eyePosY, viewerMax);
  var topDist = Math.min(screenHeight - eyePosY, viewerMax);

  return {
    outerDist: outerDist,
    innerDist: innerDist,
    topDist: topDist,
    bottomDist: bottomDist,
    eyePosX: eyePosX,
    eyePosY: eyePosY
  };
};


function CardboardViewer(params) {
  // A machine readable ID.
  this.id = params.id;
  // A human readable label.
  this.label = params.label;

  // Field of view in degrees (per side).
  this.fov = params.fov;

  // Distance between lens centers in meters.
  this.interLensDistance = params.interLensDistance;
  // Distance between viewer baseline and lens center in meters.
  this.baselineLensDistance = params.baselineLensDistance;
  // Screen-to-lens distance in meters.
  this.screenLensDistance = params.screenLensDistance;

  // Distortion coefficients.
  this.distortionCoefficients = params.distortionCoefficients;
  // Inverse distortion coefficients.
  // TODO: Calculate these from distortionCoefficients in the future.
  this.inverseCoefficients = params.inverseCoefficients;
}

// Export viewer information.
DeviceInfo.Viewers = Viewers;
module.exports = DeviceInfo;

},{"./distortion/distortion.js":9,"./math-util.js":14,"./util.js":22}],8:[function(_dereq_,module,exports){
/*
 * Copyright 2016 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
var VRDisplay = _dereq_('./base.js').VRDisplay;
var HMDVRDevice = _dereq_('./base.js').HMDVRDevice;
var PositionSensorVRDevice = _dereq_('./base.js').PositionSensorVRDevice;

/**
 * Wraps a VRDisplay and exposes it as a HMDVRDevice
 */
function VRDisplayHMDDevice(display) {
  this.display = display;

  this.hardwareUnitId = display.displayId;
  this.deviceId = 'webvr-polyfill:HMD:' + display.displayId;
  this.deviceName = display.displayName + ' (HMD)';
}
VRDisplayHMDDevice.prototype = new HMDVRDevice();

VRDisplayHMDDevice.prototype.getEyeParameters = function(whichEye) {
  var eyeParameters = this.display.getEyeParameters(whichEye);

  return {
    currentFieldOfView: eyeParameters.fieldOfView,
    maximumFieldOfView: eyeParameters.fieldOfView,
    minimumFieldOfView: eyeParameters.fieldOfView,
    recommendedFieldOfView: eyeParameters.fieldOfView,
    eyeTranslation: { x: eyeParameters.offset[0], y: eyeParameters.offset[1], z: eyeParameters.offset[2] },
    renderRect: {
      x: (whichEye == 'right') ? eyeParameters.renderWidth : 0,
      y: 0,
      width: eyeParameters.renderWidth,
      height: eyeParameters.renderHeight
    }
  };
};

VRDisplayHMDDevice.prototype.setFieldOfView =
    function(opt_fovLeft, opt_fovRight, opt_zNear, opt_zFar) {
  // Not supported. getEyeParameters reports that the min, max, and recommended
  // FoV is all the same, so no adjustment can be made.
};

// TODO: Need to hook requestFullscreen to see if a wrapped VRDisplay was passed
// in as an option. If so we should prevent the default fullscreen behavior and
// call VRDisplay.requestPresent instead.

/**
 * Wraps a VRDisplay and exposes it as a PositionSensorVRDevice
 */
function VRDisplayPositionSensorDevice(display) {
  this.display = display;

  this.hardwareUnitId = display.displayId;
  this.deviceId = 'webvr-polyfill:PositionSensor: ' + display.displayId;
  this.deviceName = display.displayName + ' (PositionSensor)';
}
VRDisplayPositionSensorDevice.prototype = new PositionSensorVRDevice();

VRDisplayPositionSensorDevice.prototype.getState = function() {
  var pose = this.display.getPose();
  return {
    position: pose.position ? { x: pose.position[0], y: pose.position[1], z: pose.position[2] } : null,
    orientation: pose.orientation ? { x: pose.orientation[0], y: pose.orientation[1], z: pose.orientation[2], w: pose.orientation[3] } : null,
    linearVelocity: null,
    linearAcceleration: null,
    angularVelocity: null,
    angularAcceleration: null
  };
};

VRDisplayPositionSensorDevice.prototype.resetState = function() {
  return this.positionDevice.resetPose();
};


module.exports.VRDisplayHMDDevice = VRDisplayHMDDevice;
module.exports.VRDisplayPositionSensorDevice = VRDisplayPositionSensorDevice;


},{"./base.js":2}],9:[function(_dereq_,module,exports){
/**
 * TODO(smus): Implement coefficient inversion.
 */
function Distortion(coefficients) {
  this.coefficients = coefficients;
}

/**
 * Calculates the inverse distortion for a radius.
 * </p><p>
 * Allows to compute the original undistorted radius from a distorted one.
 * See also getApproximateInverseDistortion() for a faster but potentially
 * less accurate method.
 *
 * @param {Number} radius Distorted radius from the lens center in tan-angle units.
 * @return {Number} The undistorted radius in tan-angle units.
 */
Distortion.prototype.distortInverse = function(radius) {
  // Secant method.
  var r0 = 0;
  var r1 = 1;
  var dr0 = radius - this.distort(r0);
  while (Math.abs(r1 - r0) > 0.0001 /** 0.1mm */) {
    var dr1 = radius - this.distort(r1);
    var r2 = r1 - dr1 * ((r1 - r0) / (dr1 - dr0));
    r0 = r1;
    r1 = r2;
    dr0 = dr1;
  }
  return r1;
};

/**
 * Distorts a radius by its distortion factor from the center of the lenses.
 *
 * @param {Number} radius Radius from the lens center in tan-angle units.
 * @return {Number} The distorted radius in tan-angle units.
 */
Distortion.prototype.distort = function(radius) {
  var r2 = radius * radius;
  var ret = 0;
  for (var i = 0; i < this.coefficients.length; i++) {
    ret = r2 * (ret + this.coefficients[i]);
  }
  return (ret + 1) * radius;
};

// Functions below roughly ported from
// https://github.com/googlesamples/cardboard-unity/blob/master/Cardboard/Scripts/CardboardProfile.cs#L412

// Solves a small linear equation via destructive gaussian
// elimination and back substitution.  This isn't generic numeric
// code, it's just a quick hack to work with the generally
// well-behaved symmetric matrices for least-squares fitting.
// Not intended for reuse.
//
// @param a Input positive definite symmetrical matrix. Destroyed
//     during calculation.
// @param y Input right-hand-side values. Destroyed during calculation.
// @return Resulting x value vector.
//
Distortion.prototype.solveLinear_ = function(a, y) {
  var n = a.length;

  // Gaussian elimination (no row exchange) to triangular matrix.
  // The input matrix is a A^T A product which should be a positive
  // definite symmetrical matrix, and if I remember my linear
  // algebra right this implies that the pivots will be nonzero and
  // calculations sufficiently accurate without needing row
  // exchange.
  for (var j = 0; j < n - 1; ++j) {
    for (var k = j + 1; k < n; ++k) {
      var p = a[j][k] / a[j][j];
      for (var i = j + 1; i < n; ++i) {
        a[i][k] -= p * a[i][j];
      }
      y[k] -= p * y[j];
    }
  }
  // From this point on, only the matrix elements a[j][i] with i>=j are
  // valid. The elimination doesn't fill in eliminated 0 values.

  var x = new Array(n);

  // Back substitution.
  for (var j = n - 1; j >= 0; --j) {
    var v = y[j];
    for (var i = j + 1; i < n; ++i) {
      v -= a[i][j] * x[i];
    }
    x[j] = v / a[j][j];
  }

  return x;
};

// Solves a least-squares matrix equation.  Given the equation A * x = y, calculate the
// least-square fit x = inverse(A * transpose(A)) * transpose(A) * y.  The way this works
// is that, while A is typically not a square matrix (and hence not invertible), A * transpose(A)
// is always square.  That is:
//   A * x = y
//   transpose(A) * (A * x) = transpose(A) * y   <- multiply both sides by transpose(A)
//   (transpose(A) * A) * x = transpose(A) * y   <- associativity
//   x = inverse(transpose(A) * A) * transpose(A) * y  <- solve for x
// Matrix A's row count (first index) must match y's value count.  A's column count (second index)
// determines the length of the result vector x.
Distortion.prototype.solveLeastSquares_ = function(matA, vecY) {
  var i, j, k, sum;
  var numSamples = matA.length;
  var numCoefficients = matA[0].length;
  if (numSamples != vecY.Length) {
    throw new Error("Matrix / vector dimension mismatch");
  }

  // Calculate transpose(A) * A
  var matATA = new Array(numCoefficients);
  for (k = 0; k < numCoefficients; ++k) {
    matATA[k] = new Array(numCoefficients);
    for (j = 0; j < numCoefficients; ++j) {
      sum = 0;
      for (i = 0; i < numSamples; ++i) {
        sum += matA[j][i] * matA[k][i];
      }
      matATA[k][j] = sum;
    }
  }

  // Calculate transpose(A) * y
  var vecATY = new Array(numCoefficients);
  for (j = 0; j < numCoefficients; ++j) {
    sum = 0;
    for (i = 0; i < numSamples; ++i) {
      sum += matA[j][i] * vecY[i];
    }
    vecATY[j] = sum;
  }

  // Now solve (A * transpose(A)) * x = transpose(A) * y.
  return this.solveLinear_(matATA, vecATY);
};

/// Calculates an approximate inverse to the given radial distortion parameters.
Distortion.prototype.approximateInverse = function(maxRadius, numSamples) {
  maxRadius = maxRadius || 1;
  numSamples = numSamples || 100;
  var numCoefficients = 6;
  var i, j;

  // R + K1*R^3 + K2*R^5 = r, with R = rp = distort(r)
  // Repeating for numSamples:
  //   [ R0^3, R0^5 ] * [ K1 ] = [ r0 - R0 ]
  //   [ R1^3, R1^5 ]   [ K2 ]   [ r1 - R1 ]
  //   [ R2^3, R2^5 ]            [ r2 - R2 ]
  //   [ etc... ]                [ etc... ]
  // That is:
  //   matA * [K1, K2] = y
  // Solve:
  //   [K1, K2] = inverse(transpose(matA) * matA) * transpose(matA) * y
  var matA = new Array(numCoefficients);
  for (j = 0; j < numCoefficients; ++j) {
    matA[j] = new Array(numSamples);
  }
  var vecY = new Array(numSamples);

  for (i = 0; i < numSamples; ++i) {
    var r = maxRadius * (i + 1) / numSamples;
    var rp = this.distort(r);
    var v = rp;
    for (j = 0; j < numCoefficients; ++j) {
      v *= rp * rp;
      matA[j][i] = v;
    }
    vecY[i] = r - rp;
  }

  var inverseCoefficients = this.solveLeastSquares_(matA, vecY);

  return new Distortion(inverseCoefficients);
};

module.exports = Distortion;

},{}],10:[function(_dereq_,module,exports){
/*
 * Copyright 2015 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * DPDB cache.
 */
var DPDB_CACHE = {
  "format": 1,
  "last_updated": "2016-01-20T00:18:35Z",
  "devices": [

  {
    "type": "android",
    "rules": [
      { "mdmh": "asus/*/Nexus 7/*" },
      { "ua": "Nexus 7" }
    ],
    "dpi": [ 320.8, 323.0 ],
    "bw": 3,
    "ac": 500
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "asus/*/ASUS_Z00AD/*" },
      { "ua": "ASUS_Z00AD" }
    ],
    "dpi": [ 403.0, 404.6 ],
    "bw": 3,
    "ac": 1000
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "HTC/*/HTC6435LVW/*" },
      { "ua": "HTC6435LVW" }
    ],
    "dpi": [ 449.7, 443.3 ],
    "bw": 3,
    "ac": 1000
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "HTC/*/HTC One XL/*" },
      { "ua": "HTC One XL" }
    ],
    "dpi": [ 315.3, 314.6 ],
    "bw": 3,
    "ac": 1000
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "htc/*/Nexus 9/*" },
      { "ua": "Nexus 9" }
    ],
    "dpi": 289.0,
    "bw": 3,
    "ac": 500
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "HTC/*/HTC One M9/*" },
      { "ua": "HTC One M9" }
    ],
    "dpi": [ 442.5, 443.3 ],
    "bw": 3,
    "ac": 500
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "HTC/*/HTC One_M8/*" },
      { "ua": "HTC One_M8" }
    ],
    "dpi": [ 449.7, 447.4 ],
    "bw": 3,
    "ac": 500
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "HTC/*/HTC One/*" },
      { "ua": "HTC One" }
    ],
    "dpi": 472.8,
    "bw": 3,
    "ac": 1000
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "Huawei/*/Nexus 6P/*" },
      { "ua": "Nexus 6P" }
    ],
    "dpi": [ 515.1, 518.0 ],
    "bw": 3,
    "ac": 1000
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "LGE/*/Nexus 5X/*" },
      { "ua": "Nexus 5X" }
    ],
    "dpi": [ 422.0, 419.9 ],
    "bw": 3,
    "ac": 1000
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "LGE/*/LGMS345/*" },
      { "ua": "LGMS345" }
    ],
    "dpi": [ 221.7, 219.1 ],
    "bw": 3,
    "ac": 500
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "LGE/*/LG-D800/*" },
      { "ua": "LG-D800" }
    ],
    "dpi": [ 422.0, 424.1 ],
    "bw": 3,
    "ac": 500
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "LGE/*/LG-D850/*" },
      { "ua": "LG-D850" }
    ],
    "dpi": [ 537.9, 541.9 ],
    "bw": 3,
    "ac": 500
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "LGE/*/VS985 4G/*" },
      { "ua": "VS985 4G" }
    ],
    "dpi": [ 537.9, 535.6 ],
    "bw": 3,
    "ac": 1000
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "LGE/*/Nexus 5/*" },
      { "ua": "Nexus 5 " }
    ],
    "dpi": [ 442.4, 444.8 ],
    "bw": 3,
    "ac": 1000
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "LGE/*/Nexus 4/*" },
      { "ua": "Nexus 4" }
    ],
    "dpi": [ 319.8, 318.4 ],
    "bw": 3,
    "ac": 1000
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "LGE/*/LG-P769/*" },
      { "ua": "LG-P769" }
    ],
    "dpi": [ 240.6, 247.5 ],
    "bw": 3,
    "ac": 1000
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "LGE/*/LGMS323/*" },
      { "ua": "LGMS323" }
    ],
    "dpi": [ 206.6, 204.6 ],
    "bw": 3,
    "ac": 1000
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "LGE/*/LGLS996/*" },
      { "ua": "LGLS996" }
    ],
    "dpi": [ 403.4, 401.5 ],
    "bw": 3,
    "ac": 1000
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "Micromax/*/4560MMX/*" },
      { "ua": "4560MMX" }
    ],
    "dpi": [ 240.0, 219.4 ],
    "bw": 3,
    "ac": 1000
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "Micromax/*/A250/*" },
      { "ua": "Micromax A250" }
    ],
    "dpi": [ 480.0, 446.4 ],
    "bw": 3,
    "ac": 1000
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "Micromax/*/Micromax AQ4501/*" },
      { "ua": "Micromax AQ4501" }
    ],
    "dpi": 240.0,
    "bw": 3,
    "ac": 500
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "motorola/*/DROID RAZR/*" },
      { "ua": "DROID RAZR" }
    ],
    "dpi": [ 368.1, 256.7 ],
    "bw": 3,
    "ac": 1000
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "motorola/*/XT830C/*" },
      { "ua": "XT830C" }
    ],
    "dpi": [ 254.0, 255.9 ],
    "bw": 3,
    "ac": 1000
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "motorola/*/XT1021/*" },
      { "ua": "XT1021" }
    ],
    "dpi": [ 254.0, 256.7 ],
    "bw": 3,
    "ac": 500
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "motorola/*/XT1023/*" },
      { "ua": "XT1023" }
    ],
    "dpi": [ 254.0, 256.7 ],
    "bw": 3,
    "ac": 500
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "motorola/*/XT1028/*" },
      { "ua": "XT1028" }
    ],
    "dpi": [ 326.6, 327.6 ],
    "bw": 3,
    "ac": 1000
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "motorola/*/XT1034/*" },
      { "ua": "XT1034" }
    ],
    "dpi": [ 326.6, 328.4 ],
    "bw": 3,
    "ac": 500
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "motorola/*/XT1053/*" },
      { "ua": "XT1053" }
    ],
    "dpi": [ 315.3, 316.1 ],
    "bw": 3,
    "ac": 1000
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "motorola/*/XT1562/*" },
      { "ua": "XT1562" }
    ],
    "dpi": [ 403.4, 402.7 ],
    "bw": 3,
    "ac": 1000
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "motorola/*/Nexus 6/*" },
      { "ua": "Nexus 6 " }
    ],
    "dpi": [ 494.3, 489.7 ],
    "bw": 3,
    "ac": 1000
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "motorola/*/XT1063/*" },
      { "ua": "XT1063" }
    ],
    "dpi": [ 295.0, 296.6 ],
    "bw": 3,
    "ac": 1000
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "motorola/*/XT1064/*" },
      { "ua": "XT1064" }
    ],
    "dpi": [ 295.0, 295.6 ],
    "bw": 3,
    "ac": 500
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "motorola/*/XT1092/*" },
      { "ua": "XT1092" }
    ],
    "dpi": [ 422.0, 424.1 ],
    "bw": 3,
    "ac": 500
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "motorola/*/XT1095/*" },
      { "ua": "XT1095" }
    ],
    "dpi": [ 422.0, 423.4 ],
    "bw": 3,
    "ac": 1000
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "OnePlus/*/A0001/*" },
      { "ua": "A0001" }
    ],
    "dpi": [ 403.4, 401.0 ],
    "bw": 3,
    "ac": 1000
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "OnePlus/*/ONE E1005/*" },
      { "ua": "ONE E1005" }
    ],
    "dpi": [ 442.4, 441.4 ],
    "bw": 3,
    "ac": 1000
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "OnePlus/*/ONE A2005/*" },
      { "ua": "ONE A2005" }
    ],
    "dpi": [ 391.9, 405.4 ],
    "bw": 3,
    "ac": 1000
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "OPPO/*/X909/*" },
      { "ua": "X909" }
    ],
    "dpi": [ 442.4, 444.1 ],
    "bw": 3,
    "ac": 1000
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "samsung/*/GT-I9082/*" },
      { "ua": "GT-I9082" }
    ],
    "dpi": [ 184.7, 185.4 ],
    "bw": 3,
    "ac": 1000
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "samsung/*/SM-G360P/*" },
      { "ua": "SM-G360P" }
    ],
    "dpi": [ 196.7, 205.4 ],
    "bw": 3,
    "ac": 1000
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "samsung/*/Nexus S/*" },
      { "ua": "Nexus S" }
    ],
    "dpi": [ 234.5, 229.8 ],
    "bw": 3,
    "ac": 1000
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "samsung/*/GT-I9300/*" },
      { "ua": "GT-I9300" }
    ],
    "dpi": [ 304.8, 303.9 ],
    "bw": 5,
    "ac": 500
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "samsung/*/SM-T230NU/*" },
      { "ua": "SM-T230NU" }
    ],
    "dpi": 216.0,
    "bw": 3,
    "ac": 500
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "samsung/*/SGH-T399/*" },
      { "ua": "SGH-T399" }
    ],
    "dpi": [ 217.7, 231.4 ],
    "bw": 3,
    "ac": 1000
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "samsung/*/SM-N9005/*" },
      { "ua": "SM-N9005" }
    ],
    "dpi": [ 386.4, 387.0 ],
    "bw": 3,
    "ac": 500
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "samsung/*/SAMSUNG-SM-N900A/*" },
      { "ua": "SAMSUNG-SM-N900A" }
    ],
    "dpi": [ 386.4, 387.7 ],
    "bw": 3,
    "ac": 1000
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "samsung/*/GT-I9500/*" },
      { "ua": "GT-I9500" }
    ],
    "dpi": [ 442.5, 443.3 ],
    "bw": 3,
    "ac": 500
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "samsung/*/GT-I9505/*" },
      { "ua": "GT-I9505" }
    ],
    "dpi": 439.4,
    "bw": 4,
    "ac": 1000
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "samsung/*/SM-G900F/*" },
      { "ua": "SM-G900F" }
    ],
    "dpi": [ 415.6, 431.6 ],
    "bw": 5,
    "ac": 1000
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "samsung/*/SM-G900M/*" },
      { "ua": "SM-G900M" }
    ],
    "dpi": [ 415.6, 431.6 ],
    "bw": 5,
    "ac": 1000
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "samsung/*/SM-G800F/*" },
      { "ua": "SM-G800F" }
    ],
    "dpi": 326.8,
    "bw": 3,
    "ac": 1000
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "samsung/*/SM-G906S/*" },
      { "ua": "SM-G906S" }
    ],
    "dpi": [ 562.7, 572.4 ],
    "bw": 3,
    "ac": 1000
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "samsung/*/GT-I9300/*" },
      { "ua": "GT-I9300" }
    ],
    "dpi": [ 306.7, 304.8 ],
    "bw": 5,
    "ac": 1000
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "samsung/*/SM-T535/*" },
      { "ua": "SM-T535" }
    ],
    "dpi": [ 142.6, 136.4 ],
    "bw": 3,
    "ac": 500
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "samsung/*/SM-N920C/*" },
      { "ua": "SM-N920C" }
    ],
    "dpi": [ 515.1, 518.4 ],
    "bw": 3,
    "ac": 1000
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "samsung/*/GT-I9300I/*" },
      { "ua": "GT-I9300I" }
    ],
    "dpi": [ 304.8, 305.8 ],
    "bw": 3,
    "ac": 1000
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "samsung/*/GT-I9195/*" },
      { "ua": "GT-I9195" }
    ],
    "dpi": [ 249.4, 256.7 ],
    "bw": 3,
    "ac": 500
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "samsung/*/SPH-L520/*" },
      { "ua": "SPH-L520" }
    ],
    "dpi": [ 249.4, 255.9 ],
    "bw": 3,
    "ac": 1000
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "samsung/*/SAMSUNG-SGH-I717/*" },
      { "ua": "SAMSUNG-SGH-I717" }
    ],
    "dpi": 285.8,
    "bw": 3,
    "ac": 1000
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "samsung/*/SPH-D710/*" },
      { "ua": "SPH-D710" }
    ],
    "dpi": [ 217.7, 204.2 ],
    "bw": 3,
    "ac": 1000
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "samsung/*/GT-N7100/*" },
      { "ua": "GT-N7100" }
    ],
    "dpi": 265.1,
    "bw": 3,
    "ac": 1000
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "samsung/*/SCH-I605/*" },
      { "ua": "SCH-I605" }
    ],
    "dpi": 265.1,
    "bw": 3,
    "ac": 1000
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "samsung/*/Galaxy Nexus/*" },
      { "ua": "Galaxy Nexus" }
    ],
    "dpi": [ 315.3, 314.2 ],
    "bw": 3,
    "ac": 1000
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "samsung/*/SM-N910H/*" },
      { "ua": "SM-N910H" }
    ],
    "dpi": [ 515.1, 518.0 ],
    "bw": 3,
    "ac": 1000
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "samsung/*/SM-N910C/*" },
      { "ua": "SM-N910C" }
    ],
    "dpi": [ 515.2, 520.2 ],
    "bw": 3,
    "ac": 500
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "samsung/*/SM-G130M/*" },
      { "ua": "SM-G130M" }
    ],
    "dpi": [ 165.9, 164.8 ],
    "bw": 3,
    "ac": 500
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "samsung/*/SM-G928I/*" },
      { "ua": "SM-G928I" }
    ],
    "dpi": [ 515.1, 518.4 ],
    "bw": 3,
    "ac": 1000
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "samsung/*/SM-G920F/*" },
      { "ua": "SM-G920F" }
    ],
    "dpi": 580.6,
    "bw": 3,
    "ac": 500
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "samsung/*/SM-G920P/*" },
      { "ua": "SM-G920P" }
    ],
    "dpi": [ 522.5, 577.0 ],
    "bw": 3,
    "ac": 1000
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "samsung/*/SM-G925F/*" },
      { "ua": "SM-G925F" }
    ],
    "dpi": 580.6,
    "bw": 3,
    "ac": 500
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "samsung/*/SM-G925V/*" },
      { "ua": "SM-G925V" }
    ],
    "dpi": [ 522.5, 576.6 ],
    "bw": 3,
    "ac": 1000
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "Sony/*/C6903/*" },
      { "ua": "C6903" }
    ],
    "dpi": [ 442.5, 443.3 ],
    "bw": 3,
    "ac": 500
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "Sony/*/D6653/*" },
      { "ua": "D6653" }
    ],
    "dpi": [ 428.6, 427.6 ],
    "bw": 3,
    "ac": 1000
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "Sony/*/E6653/*" },
      { "ua": "E6653" }
    ],
    "dpi": [ 428.6, 425.7 ],
    "bw": 3,
    "ac": 1000
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "Sony/*/E6853/*" },
      { "ua": "E6853" }
    ],
    "dpi": [ 403.4, 401.9 ],
    "bw": 3,
    "ac": 1000
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "Sony/*/SGP321/*" },
      { "ua": "SGP321" }
    ],
    "dpi": [ 224.7, 224.1 ],
    "bw": 3,
    "ac": 500
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "TCT/*/ALCATEL ONE TOUCH Fierce/*" },
      { "ua": "ALCATEL ONE TOUCH Fierce" }
    ],
    "dpi": [ 240.0, 247.5 ],
    "bw": 3,
    "ac": 1000
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "THL/*/thl 5000/*" },
      { "ua": "thl 5000" }
    ],
    "dpi": [ 480.0, 443.3 ],
    "bw": 3,
    "ac": 1000
  },

  {
    "type": "android",
    "rules": [
      { "mdmh": "ZTE/*/ZTE Blade L2/*" },
      { "ua": "ZTE Blade L2" }
    ],
    "dpi": 240.0,
    "bw": 3,
    "ac": 500
  },

  {
    "type": "ios",
    "rules": [ { "res": [ 640, 960 ] } ],
    "dpi": [ 325.1, 328.4 ],
    "bw": 4,
    "ac": 1000
  },

  {
    "type": "ios",
    "rules": [ { "res": [ 640, 960 ] } ],
    "dpi": [ 325.1, 328.4 ],
    "bw": 4,
    "ac": 1000
  },

  {
    "type": "ios",
    "rules": [ { "res": [ 640, 1136 ] } ],
    "dpi": [ 317.1, 320.2 ],
    "bw": 3,
    "ac": 1000
  },

  {
    "type": "ios",
    "rules": [ { "res": [ 640, 1136 ] } ],
    "dpi": [ 317.1, 320.2 ],
    "bw": 3,
    "ac": 1000
  },

  {
    "type": "ios",
    "rules": [ { "res": [ 750, 1334 ] } ],
    "dpi": 326.4,
    "bw": 4,
    "ac": 1000
  },

  {
    "type": "ios",
    "rules": [ { "res": [ 750, 1334 ] } ],
    "dpi": 326.4,
    "bw": 4,
    "ac": 1000
  },

  {
    "type": "ios",
    "rules": [ { "res": [ 1242, 2208 ] } ],
    "dpi": [ 453.6, 458.4 ],
    "bw": 4,
    "ac": 1000
  },

  {
    "type": "ios",
    "rules": [ { "res": [ 1242, 2208 ] } ],
    "dpi": [ 453.6, 458.4 ],
    "bw": 4,
    "ac": 1000
  }
]};

module.exports = DPDB_CACHE;

},{}],11:[function(_dereq_,module,exports){
/*
 * Copyright 2015 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Offline cache of the DPDB, to be used until we load the online one (and
// as a fallback in case we can't load the online one).
var DPDB_CACHE = _dereq_('./dpdb-cache.js');
var Util = _dereq_('../util.js');

// Online DPDB URL.
var ONLINE_DPDB_URL = 'https://storage.googleapis.com/cardboard-dpdb/dpdb.json';

/**
 * Calculates device parameters based on the DPDB (Device Parameter Database).
 * Initially, uses the cached DPDB values.
 *
 * If fetchOnline == true, then this object tries to fetch the online version
 * of the DPDB and updates the device info if a better match is found.
 * Calls the onDeviceParamsUpdated callback when there is an update to the
 * device information.
 */
function Dpdb(fetchOnline, onDeviceParamsUpdated) {
  // Start with the offline DPDB cache while we are loading the real one.
  this.dpdb = DPDB_CACHE;

  // Calculate device params based on the offline version of the DPDB.
  this.recalculateDeviceParams_();

  // XHR to fetch online DPDB file, if requested.
  if (fetchOnline) {
    // Set the callback.
    this.onDeviceParamsUpdated = onDeviceParamsUpdated;

    console.log('Fetching DPDB...');
    var xhr = new XMLHttpRequest();
    var obj = this;
    xhr.open('GET', ONLINE_DPDB_URL, true);
    xhr.addEventListener('load', function() {
      obj.loading = false;
      if (xhr.status >= 200 && xhr.status <= 299) {
        // Success.
        console.log('Successfully loaded online DPDB.');
        obj.dpdb = JSON.parse(xhr.response);
        obj.recalculateDeviceParams_();
      } else {
        // Error loading the DPDB.
        console.error('Error loading online DPDB!');
      }
    });
    xhr.send();
  }
}

// Returns the current device parameters.
Dpdb.prototype.getDeviceParams = function() {
  return this.deviceParams;
};

// Recalculates this device's parameters based on the DPDB.
Dpdb.prototype.recalculateDeviceParams_ = function() {
  console.log('Recalculating device params.');
  var newDeviceParams = this.calcDeviceParams_();
  console.log('New device parameters:');
  console.log(newDeviceParams);
  if (newDeviceParams) {
    this.deviceParams = newDeviceParams;
    // Invoke callback, if it is set.
    if (this.onDeviceParamsUpdated) {
      this.onDeviceParamsUpdated(this.deviceParams);
    }
  } else {
    console.error('Failed to recalculate device parameters.');
  }
};

// Returns a DeviceParams object that represents the best guess as to this
// device's parameters. Can return null if the device does not match any
// known devices.
Dpdb.prototype.calcDeviceParams_ = function() {
  var db = this.dpdb; // shorthand
  if (!db) {
    console.error('DPDB not available.');
    return null;
  }
  if (db.format != 1) {
    console.error('DPDB has unexpected format version.');
    return null;
  }
  if (!db.devices || !db.devices.length) {
    console.error('DPDB does not have a devices section.');
    return null;
  }

  // Get the actual user agent and screen dimensions in pixels.
  var userAgent = navigator.userAgent || navigator.vendor || window.opera;
  var width = Util.getScreenWidth();
  var height = Util.getScreenHeight();
  console.log('User agent: ' + userAgent);
  console.log('Pixel width: ' + width);
  console.log('Pixel height: ' + height);

  if (!db.devices) {
    console.error('DPDB has no devices section.');
    return null;
  }

  for (var i = 0; i < db.devices.length; i++) {
    var device = db.devices[i];
    if (!device.rules) {
      console.warn('Device[' + i + '] has no rules section.');
      continue;
    }

    if (device.type != 'ios' && device.type != 'android') {
      console.warn('Device[' + i + '] has invalid type.');
      continue;
    }

    // See if this device is of the appropriate type.
    if (Util.isIOS() != (device.type == 'ios')) continue;

    // See if this device matches any of the rules:
    var matched = false;
    for (var j = 0; j < device.rules.length; j++) {
      var rule = device.rules[j];
      if (this.matchRule_(rule, userAgent, width, height)) {
        console.log('Rule matched:');
        console.log(rule);
        matched = true;
        break;
      }
    }
    if (!matched) continue;

    // device.dpi might be an array of [ xdpi, ydpi] or just a scalar.
    var xdpi = device.dpi[0] || device.dpi;
    var ydpi = device.dpi[1] || device.dpi;

    return new DeviceParams({ xdpi: xdpi, ydpi: ydpi, bevelMm: device.bw });
  }

  console.warn('No DPDB device match.');
  return null;
};

Dpdb.prototype.matchRule_ = function(rule, ua, screenWidth, screenHeight) {
  // We can only match 'ua' and 'res' rules, not other types like 'mdmh'
  // (which are meant for native platforms).
  if (!rule.ua && !rule.res) return false;

  // If our user agent string doesn't contain the indicated user agent string,
  // the match fails.
  if (rule.ua && ua.indexOf(rule.ua) < 0) return false;

  // If the rule specifies screen dimensions that don't correspond to ours,
  // the match fails.
  if (rule.res) {
    if (!rule.res[0] || !rule.res[1]) return false;
    var resX = rule.res[0];
    var resY = rule.res[1];
    // Compare min and max so as to make the order not matter, i.e., it should
    // be true that 640x480 == 480x640.
    if (Math.min(screenWidth, screenHeight) != Math.min(resX, resY) ||
        (Math.max(screenWidth, screenHeight) != Math.max(resX, resY))) {
      return false;
    }
  }

  return true;
}

function DeviceParams(params) {
  this.xdpi = params.xdpi;
  this.ydpi = params.ydpi;
  this.bevelMm = params.bevelMm;
}

module.exports = Dpdb;
},{"../util.js":22,"./dpdb-cache.js":10}],12:[function(_dereq_,module,exports){
/*
 * Copyright 2015 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

function Emitter() {
  this.callbacks = {};
}

Emitter.prototype.emit = function(eventName) {
  var callbacks = this.callbacks[eventName];
  if (!callbacks) {
    //console.log('No valid callback specified.');
    return;
  }
  var args = [].slice.call(arguments);
  // Eliminate the first param (the callback).
  args.shift();
  for (var i = 0; i < callbacks.length; i++) {
    callbacks[i].apply(this, args);
  }
};

Emitter.prototype.on = function(eventName, callback) {
  if (eventName in this.callbacks) {
    this.callbacks[eventName].push(callback);
  } else {
    this.callbacks[eventName] = [callback];
  }
};

module.exports = Emitter;

},{}],13:[function(_dereq_,module,exports){
/*
 * Copyright 2015 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
var Util = _dereq_('./util.js');
var WebVRPolyfill = _dereq_('./webvr-polyfill.js').WebVRPolyfill;

// Initialize a WebVRConfig just in case.
window.WebVRConfig = Util.extend({
  // Forces availability of VR mode, even for non-mobile devices.
  FORCE_ENABLE_VR: false,

  // Complementary filter coefficient. 0 for accelerometer, 1 for gyro.
  K_FILTER: 0.98,

  // How far into the future to predict during fast motion (in seconds).
  PREDICTION_TIME_S: 0.040,

  // Flag to enable touch panner. In case you have your own touch controls.
  TOUCH_PANNER_DISABLED: true,

  // Flag to disabled the UI in VR Mode.
  CARDBOARD_UI_DISABLED: false, // Default: false

  // Flag to disable the instructions to rotate your device.
  ROTATE_INSTRUCTIONS_DISABLED: false, // Default: false.

  // Enable yaw panning only, disabling roll and pitch. This can be useful
  // for panoramas with nothing interesting above or below.
  YAW_ONLY: false,

  // To disable keyboard and mouse controls, if you want to use your own
  // implementation.
  MOUSE_KEYBOARD_CONTROLS_DISABLED: false,

  // Prevent the polyfill from initializing immediately. Requires the app
  // to call InitializeWebVRPolyfill() before it can be used.
  DEFER_INITIALIZATION: false,

  // Enable the deprecated version of the API (navigator.getVRDevices).
  ENABLE_DEPRECATED_API: false,

  // Scales the recommended buffer size reported by WebVR, which can improve
  // performance.
  // UPDATE(2016-05-03): Setting this to 0.5 by default since 1.0 does not
  // perform well on many mobile devices.
  BUFFER_SCALE: 0.5,

  // Allow VRDisplay.submitFrame to change gl bindings, which is more
  // efficient if the application code will re-bind its resources on the
  // next frame anyway. This has been seen to cause rendering glitches with
  // THREE.js.
  // Dirty bindings include: gl.FRAMEBUFFER_BINDING, gl.CURRENT_PROGRAM,
  // gl.ARRAY_BUFFER_BINDING, gl.ELEMENT_ARRAY_BUFFER_BINDING,
  // and gl.TEXTURE_BINDING_2D for texture unit 0.
  DIRTY_SUBMIT_FRAME_BINDINGS: false
}, window.WebVRConfig);

if (!window.WebVRConfig.DEFER_INITIALIZATION) {
  new WebVRPolyfill();
} else {
  window.InitializeWebVRPolyfill = function() {
    new WebVRPolyfill();
  }
}

},{"./util.js":22,"./webvr-polyfill.js":25}],14:[function(_dereq_,module,exports){
/*
 * Copyright 2016 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var MathUtil = window.MathUtil || {};

MathUtil.degToRad = Math.PI / 180;
MathUtil.radToDeg = 180 / Math.PI;

// Some minimal math functionality borrowed from THREE.Math and stripped down
// for the purposes of this library.


MathUtil.Vector2 = function ( x, y ) {
  this.x = x || 0;
  this.y = y || 0;
};

MathUtil.Vector2.prototype = {
  constructor: MathUtil.Vector2,

  set: function ( x, y ) {
    this.x = x;
    this.y = y;

    return this;
  },

  copy: function ( v ) {
    this.x = v.x;
    this.y = v.y;

    return this;
  },

  subVectors: function ( a, b ) {
    this.x = a.x - b.x;
    this.y = a.y - b.y;

    return this;
  },
};

MathUtil.Vector3 = function ( x, y, z ) {
  this.x = x || 0;
  this.y = y || 0;
  this.z = z || 0;
};

MathUtil.Vector3.prototype = {
  constructor: MathUtil.Vector3,

  set: function ( x, y, z ) {
    this.x = x;
    this.y = y;
    this.z = z;

    return this;
  },

  copy: function ( v ) {
    this.x = v.x;
    this.y = v.y;
    this.z = v.z;

    return this;
  },

  length: function () {
    return Math.sqrt( this.x * this.x + this.y * this.y + this.z * this.z );
  },

  normalize: function () {
    var scalar = this.length();

    if ( scalar !== 0 ) {
      var invScalar = 1 / scalar;

      this.multiplyScalar(invScalar);
    } else {
      this.x = 0;
      this.y = 0;
      this.z = 0;
    }

    return this;
  },

  multiplyScalar: function ( scalar ) {
    this.x *= scalar;
    this.y *= scalar;
    this.z *= scalar;
  },

  applyQuaternion: function ( q ) {
    var x = this.x;
    var y = this.y;
    var z = this.z;

    var qx = q.x;
    var qy = q.y;
    var qz = q.z;
    var qw = q.w;

    // calculate quat * vector
    var ix =  qw * x + qy * z - qz * y;
    var iy =  qw * y + qz * x - qx * z;
    var iz =  qw * z + qx * y - qy * x;
    var iw = - qx * x - qy * y - qz * z;

    // calculate result * inverse quat
    this.x = ix * qw + iw * - qx + iy * - qz - iz * - qy;
    this.y = iy * qw + iw * - qy + iz * - qx - ix * - qz;
    this.z = iz * qw + iw * - qz + ix * - qy - iy * - qx;

    return this;
  },

  dot: function ( v ) {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  },

  crossVectors: function ( a, b ) {
    var ax = a.x, ay = a.y, az = a.z;
    var bx = b.x, by = b.y, bz = b.z;

    this.x = ay * bz - az * by;
    this.y = az * bx - ax * bz;
    this.z = ax * by - ay * bx;

    return this;
  },
};

MathUtil.Quaternion = function ( x, y, z, w ) {
  this.x = x || 0;
  this.y = y || 0;
  this.z = z || 0;
  this.w = ( w !== undefined ) ? w : 1;
};

MathUtil.Quaternion.prototype = {
  constructor: MathUtil.Quaternion,

  set: function ( x, y, z, w ) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;

    return this;
  },

  copy: function ( quaternion ) {
    this.x = quaternion.x;
    this.y = quaternion.y;
    this.z = quaternion.z;
    this.w = quaternion.w;

    return this;
  },

  setFromEulerXYZ: function( x, y, z ) {
    var c1 = Math.cos( x / 2 );
    var c2 = Math.cos( y / 2 );
    var c3 = Math.cos( z / 2 );
    var s1 = Math.sin( x / 2 );
    var s2 = Math.sin( y / 2 );
    var s3 = Math.sin( z / 2 );

    this.x = s1 * c2 * c3 + c1 * s2 * s3;
    this.y = c1 * s2 * c3 - s1 * c2 * s3;
    this.z = c1 * c2 * s3 + s1 * s2 * c3;
    this.w = c1 * c2 * c3 - s1 * s2 * s3;

    return this;
  },

  setFromEulerYXZ: function( x, y, z ) {
    var c1 = Math.cos( x / 2 );
    var c2 = Math.cos( y / 2 );
    var c3 = Math.cos( z / 2 );
    var s1 = Math.sin( x / 2 );
    var s2 = Math.sin( y / 2 );
    var s3 = Math.sin( z / 2 );

    this.x = s1 * c2 * c3 + c1 * s2 * s3;
    this.y = c1 * s2 * c3 - s1 * c2 * s3;
    this.z = c1 * c2 * s3 - s1 * s2 * c3;
    this.w = c1 * c2 * c3 + s1 * s2 * s3;

    return this;
  },

  setFromAxisAngle: function ( axis, angle ) {
    // http://www.euclideanspace.com/maths/geometry/rotations/conversions/angleToQuaternion/index.htm
    // assumes axis is normalized

    var halfAngle = angle / 2, s = Math.sin( halfAngle );

    this.x = axis.x * s;
    this.y = axis.y * s;
    this.z = axis.z * s;
    this.w = Math.cos( halfAngle );

    return this;
  },

  multiply: function ( q ) {
    return this.multiplyQuaternions( this, q );
  },

  multiplyQuaternions: function ( a, b ) {
    // from http://www.euclideanspace.com/maths/algebra/realNormedAlgebra/quaternions/code/index.htm

    var qax = a.x, qay = a.y, qaz = a.z, qaw = a.w;
    var qbx = b.x, qby = b.y, qbz = b.z, qbw = b.w;

    this.x = qax * qbw + qaw * qbx + qay * qbz - qaz * qby;
    this.y = qay * qbw + qaw * qby + qaz * qbx - qax * qbz;
    this.z = qaz * qbw + qaw * qbz + qax * qby - qay * qbx;
    this.w = qaw * qbw - qax * qbx - qay * qby - qaz * qbz;

    return this;
  },

  inverse: function () {
    this.x *= -1;
    this.y *= -1;
    this.z *= -1;

    this.normalize();

    return this;
  },

  normalize: function () {
    var l = Math.sqrt( this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w );

    if ( l === 0 ) {
      this.x = 0;
      this.y = 0;
      this.z = 0;
      this.w = 1;
    } else {
      l = 1 / l;

      this.x = this.x * l;
      this.y = this.y * l;
      this.z = this.z * l;
      this.w = this.w * l;
    }

    return this;
  },

  slerp: function ( qb, t ) {
    if ( t === 0 ) return this;
    if ( t === 1 ) return this.copy( qb );

    var x = this.x, y = this.y, z = this.z, w = this.w;

    // http://www.euclideanspace.com/maths/algebra/realNormedAlgebra/quaternions/slerp/

    var cosHalfTheta = w * qb.w + x * qb.x + y * qb.y + z * qb.z;

    if ( cosHalfTheta < 0 ) {
      this.w = - qb.w;
      this.x = - qb.x;
      this.y = - qb.y;
      this.z = - qb.z;

      cosHalfTheta = - cosHalfTheta;
    } else {
      this.copy( qb );
    }

    if ( cosHalfTheta >= 1.0 ) {
      this.w = w;
      this.x = x;
      this.y = y;
      this.z = z;

      return this;
    }

    var halfTheta = Math.acos( cosHalfTheta );
    var sinHalfTheta = Math.sqrt( 1.0 - cosHalfTheta * cosHalfTheta );

    if ( Math.abs( sinHalfTheta ) < 0.001 ) {
      this.w = 0.5 * ( w + this.w );
      this.x = 0.5 * ( x + this.x );
      this.y = 0.5 * ( y + this.y );
      this.z = 0.5 * ( z + this.z );

      return this;
    }

    var ratioA = Math.sin( ( 1 - t ) * halfTheta ) / sinHalfTheta,
    ratioB = Math.sin( t * halfTheta ) / sinHalfTheta;

    this.w = ( w * ratioA + this.w * ratioB );
    this.x = ( x * ratioA + this.x * ratioB );
    this.y = ( y * ratioA + this.y * ratioB );
    this.z = ( z * ratioA + this.z * ratioB );

    return this;
  },

  setFromUnitVectors: function () {
    // http://lolengine.net/blog/2014/02/24/quaternion-from-two-vectors-final
    // assumes direction vectors vFrom and vTo are normalized

    var v1, r;
    var EPS = 0.000001;

    return function ( vFrom, vTo ) {
      if ( v1 === undefined ) v1 = new MathUtil.Vector3();

      r = vFrom.dot( vTo ) + 1;

      if ( r < EPS ) {
        r = 0;

        if ( Math.abs( vFrom.x ) > Math.abs( vFrom.z ) ) {
          v1.set( - vFrom.y, vFrom.x, 0 );
        } else {
          v1.set( 0, - vFrom.z, vFrom.y );
        }
      } else {
        v1.crossVectors( vFrom, vTo );
      }

      this.x = v1.x;
      this.y = v1.y;
      this.z = v1.z;
      this.w = r;

      this.normalize();

      return this;
    }
  }(),
};

module.exports = MathUtil;

},{}],15:[function(_dereq_,module,exports){
/*
 * Copyright 2016 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var VRDisplay = _dereq_('./base.js').VRDisplay;
var MathUtil = _dereq_('./math-util.js');
var Util = _dereq_('./util.js');

// How much to rotate per key stroke.
var KEY_SPEED = 0.15;
var KEY_ANIMATION_DURATION = 80;

// How much to rotate for mouse events.
var MOUSE_SPEED_X = 0.5;
var MOUSE_SPEED_Y = 0.3;

/**
 * VRDisplay based on mouse and keyboard input. Designed for desktops/laptops
 * where orientation events aren't supported. Cannot present.
 */
function MouseKeyboardVRDisplay() {
  this.displayName = 'Mouse and Keyboard VRDisplay (webvr-polyfill)';

  this.capabilities.hasOrientation = true;

  // Attach to mouse and keyboard events.
  window.addEventListener('keydown', this.onKeyDown_.bind(this));
  window.addEventListener('mousemove', this.onMouseMove_.bind(this));
  window.addEventListener('mousedown', this.onMouseDown_.bind(this));
  window.addEventListener('mouseup', this.onMouseUp_.bind(this));

  // "Private" members.
  this.phi_ = 0;
  this.theta_ = 0;

  // Variables for keyboard-based rotation animation.
  this.targetAngle_ = null;
  this.angleAnimation_ = null;

  // State variables for calculations.
  this.orientation_ = new MathUtil.Quaternion();

  // Variables for mouse-based rotation.
  this.rotateStart_ = new MathUtil.Vector2();
  this.rotateEnd_ = new MathUtil.Vector2();
  this.rotateDelta_ = new MathUtil.Vector2();
  this.isDragging_ = false;

  this.orientationOut_ = new Float32Array(4);
}
MouseKeyboardVRDisplay.prototype = new VRDisplay();

MouseKeyboardVRDisplay.prototype.getImmediatePose = function() {
  this.orientation_.setFromEulerYXZ(this.phi_, this.theta_, 0);

  this.orientationOut_[0] = this.orientation_.x;
  this.orientationOut_[1] = this.orientation_.y;
  this.orientationOut_[2] = this.orientation_.z;
  this.orientationOut_[3] = this.orientation_.w;

  return {
    position: null,
    orientation: this.orientationOut_,
    linearVelocity: null,
    linearAcceleration: null,
    angularVelocity: null,
    angularAcceleration: null
  };
};

MouseKeyboardVRDisplay.prototype.onKeyDown_ = function(e) {
  // Track WASD and arrow keys.
  if (e.keyCode == 38) { // Up key.
    this.animatePhi_(this.phi_ + KEY_SPEED);
  } else if (e.keyCode == 39) { // Right key.
    this.animateTheta_(this.theta_ - KEY_SPEED);
  } else if (e.keyCode == 40) { // Down key.
    this.animatePhi_(this.phi_ - KEY_SPEED);
  } else if (e.keyCode == 37) { // Left key.
    this.animateTheta_(this.theta_ + KEY_SPEED);
  }
};

MouseKeyboardVRDisplay.prototype.animateTheta_ = function(targetAngle) {
  this.animateKeyTransitions_('theta_', targetAngle);
};

MouseKeyboardVRDisplay.prototype.animatePhi_ = function(targetAngle) {
  // Prevent looking too far up or down.
  targetAngle = Util.clamp(targetAngle, -Math.PI/2, Math.PI/2);
  this.animateKeyTransitions_('phi_', targetAngle);
};

/**
 * Start an animation to transition an angle from one value to another.
 */
MouseKeyboardVRDisplay.prototype.animateKeyTransitions_ = function(angleName, targetAngle) {
  // If an animation is currently running, cancel it.
  if (this.angleAnimation_) {
    cancelAnimationFrame(this.angleAnimation_);
  }
  var startAngle = this[angleName];
  var startTime = new Date();
  // Set up an interval timer to perform the animation.
  this.angleAnimation_ = requestAnimationFrame(function animate() {
    // Once we're finished the animation, we're done.
    var elapsed = new Date() - startTime;
    if (elapsed >= KEY_ANIMATION_DURATION) {
      this[angleName] = targetAngle;
      cancelAnimationFrame(this.angleAnimation_);
      return;
    }
    // loop with requestAnimationFrame
    this.angleAnimation_ = requestAnimationFrame(animate.bind(this))
    // Linearly interpolate the angle some amount.
    var percent = elapsed / KEY_ANIMATION_DURATION;
    this[angleName] = startAngle + (targetAngle - startAngle) * percent;
  }.bind(this));
};

MouseKeyboardVRDisplay.prototype.onMouseDown_ = function(e) {
  this.rotateStart_.set(e.clientX, e.clientY);
  this.isDragging_ = true;
};

// Very similar to https://gist.github.com/mrflix/8351020
MouseKeyboardVRDisplay.prototype.onMouseMove_ = function(e) {
  if (!this.isDragging_ && !this.isPointerLocked_()) {
    return;
  }
  // Support pointer lock API.
  if (this.isPointerLocked_()) {
    var movementX = e.movementX || e.mozMovementX || 0;
    var movementY = e.movementY || e.mozMovementY || 0;
    this.rotateEnd_.set(this.rotateStart_.x - movementX, this.rotateStart_.y - movementY);
  } else {
    this.rotateEnd_.set(e.clientX, e.clientY);
  }
  // Calculate how much we moved in mouse space.
  this.rotateDelta_.subVectors(this.rotateEnd_, this.rotateStart_);
  this.rotateStart_.copy(this.rotateEnd_);

  // Keep track of the cumulative euler angles.
  this.phi_ += 2 * Math.PI * this.rotateDelta_.y / screen.height * MOUSE_SPEED_Y;
  this.theta_ += 2 * Math.PI * this.rotateDelta_.x / screen.width * MOUSE_SPEED_X;

  // Prevent looking too far up or down.
  this.phi_ = Util.clamp(this.phi_, -Math.PI/2, Math.PI/2);
};

MouseKeyboardVRDisplay.prototype.onMouseUp_ = function(e) {
  this.isDragging_ = false;
};

MouseKeyboardVRDisplay.prototype.isPointerLocked_ = function() {
  var el = document.pointerLockElement || document.mozPointerLockElement ||
      document.webkitPointerLockElement;
  return el !== undefined;
};

MouseKeyboardVRDisplay.prototype.resetPose = function() {
  this.phi_ = 0;
  this.theta_ = 0;
};

module.exports = MouseKeyboardVRDisplay;

},{"./base.js":2,"./math-util.js":14,"./util.js":22}],16:[function(_dereq_,module,exports){
/*
 * Copyright 2015 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var Util = _dereq_('./util.js');

function RotateInstructions() {
  this.loadIcon_();

  var s;
  var overlay = document.createElement('div');
  s = overlay.style;
  s.position = 'fixed';
  s.top = 0;
  s.right = 0;
  s.bottom = 0;
  s.left = 0;
  s.backgroundColor = 'gray';
  s.fontFamily = 'sans-serif';
  // Force this to be above the fullscreen canvas, which is at zIndex: 999999.
  s.zIndex = 1000000;

  var img = document.createElement('img');
  img.src = this.icon;
  s = img.style;
  s.marginLeft = '25%';
  s.marginTop = '25%';
  s.width = '50%';
  overlay.appendChild(img);

  var text = document.createElement('div');
  s = text.style;
  s.textAlign = 'center';
  s.fontSize = '16px';
  s.lineHeight = '24px';
  s.margin = '24px 25%';
  s.width = '50%';
  text.innerHTML = 'Place your phone into your Cardboard viewer.';
  overlay.appendChild(text);

  var snackbar = document.createElement('div');
  s = snackbar.style;
  s.backgroundColor = '#CFD8DC';
  s.position = 'fixed';
  s.bottom = 0;
  s.width = '100%';
  s.height = '48px';
  s.padding = '14px 24px';
  s.boxSizing = 'border-box';
  s.color = '#656A6B';
  overlay.appendChild(snackbar);

  var snackbarText = document.createElement('div');
  snackbarText.style.float = 'left';
  snackbarText.innerHTML = 'No Cardboard viewer?';

  var snackbarButton = document.createElement('a');
  snackbarButton.href = 'https://www.google.com/get/cardboard/get-cardboard/';
  snackbarButton.innerHTML = 'get one';
  snackbarButton.target = '_blank';
  s = snackbarButton.style;
  s.float = 'right';
  s.fontWeight = 600;
  s.textTransform = 'uppercase';
  s.borderLeft = '1px solid gray';
  s.paddingLeft = '24px';
  s.textDecoration = 'none';
  s.color = '#656A6B';

  snackbar.appendChild(snackbarText);
  snackbar.appendChild(snackbarButton);

  this.overlay = overlay;
  this.text = text;

  this.hide();
}

RotateInstructions.prototype.show = function(parent) {
  if (!parent && !this.overlay.parentElement) {
    document.body.appendChild(this.overlay);
  } else if (parent) {
    if (this.overlay.parentElement && this.overlay.parentElement != parent)
      this.overlay.parentElement.removeChild(this.overlay);

    parent.appendChild(this.overlay);
  }

  this.overlay.style.display = 'block';

  var img = this.overlay.querySelector('img');
  var s = img.style;

  if (Util.isLandscapeMode()) {
    s.width = '20%';
    s.marginLeft = '40%';
    s.marginTop = '3%';
  } else {
    s.width = '50%';
    s.marginLeft = '25%';
    s.marginTop = '25%';
  }
};

RotateInstructions.prototype.hide = function() {
  this.overlay.style.display = 'none';
};

RotateInstructions.prototype.showTemporarily = function(ms, parent) {
  this.show(parent);
  this.timer = setTimeout(this.hide.bind(this), ms);
};

RotateInstructions.prototype.disableShowTemporarily = function() {
  clearTimeout(this.timer);
};

RotateInstructions.prototype.update = function() {
  this.disableShowTemporarily();
  // In portrait VR mode, tell the user to rotate to landscape. Otherwise, hide
  // the instructions.
  if (!Util.isLandscapeMode() && Util.isMobile()) {
    this.show();
  } else {
    this.hide();
  }
};

RotateInstructions.prototype.loadIcon_ = function() {
  // Encoded asset_src/rotate-instructions.svg
  this.icon = Util.base64('image/svg+xml', 'PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+Cjxzdmcgd2lkdGg9IjE5OHB4IiBoZWlnaHQ9IjI0MHB4IiB2aWV3Qm94PSIwIDAgMTk4IDI0MCIgdmVyc2lvbj0iMS4xIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB4bWxuczpza2V0Y2g9Imh0dHA6Ly93d3cuYm9oZW1pYW5jb2RpbmcuY29tL3NrZXRjaC9ucyI+CiAgICA8IS0tIEdlbmVyYXRvcjogU2tldGNoIDMuMy4zICgxMjA4MSkgLSBodHRwOi8vd3d3LmJvaGVtaWFuY29kaW5nLmNvbS9za2V0Y2ggLS0+CiAgICA8dGl0bGU+dHJhbnNpdGlvbjwvdGl0bGU+CiAgICA8ZGVzYz5DcmVhdGVkIHdpdGggU2tldGNoLjwvZGVzYz4KICAgIDxkZWZzPjwvZGVmcz4KICAgIDxnIGlkPSJQYWdlLTEiIHN0cm9rZT0ibm9uZSIgc3Ryb2tlLXdpZHRoPSIxIiBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIHNrZXRjaDp0eXBlPSJNU1BhZ2UiPgogICAgICAgIDxnIGlkPSJ0cmFuc2l0aW9uIiBza2V0Y2g6dHlwZT0iTVNBcnRib2FyZEdyb3VwIj4KICAgICAgICAgICAgPGcgaWQ9IkltcG9ydGVkLUxheWVycy1Db3B5LTQtKy1JbXBvcnRlZC1MYXllcnMtQ29weS0rLUltcG9ydGVkLUxheWVycy1Db3B5LTItQ29weSIgc2tldGNoOnR5cGU9Ik1TTGF5ZXJHcm91cCI+CiAgICAgICAgICAgICAgICA8ZyBpZD0iSW1wb3J0ZWQtTGF5ZXJzLUNvcHktNCIgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMC4wMDAwMDAsIDEwNy4wMDAwMDApIiBza2V0Y2g6dHlwZT0iTVNTaGFwZUdyb3VwIj4KICAgICAgICAgICAgICAgICAgICA8cGF0aCBkPSJNMTQ5LjYyNSwyLjUyNyBDMTQ5LjYyNSwyLjUyNyAxNTUuODA1LDYuMDk2IDE1Ni4zNjIsNi40MTggTDE1Ni4zNjIsNy4zMDQgQzE1Ni4zNjIsNy40ODEgMTU2LjM3NSw3LjY2NCAxNTYuNCw3Ljg1MyBDMTU2LjQxLDcuOTM0IDE1Ni40Miw4LjAxNSAxNTYuNDI3LDguMDk1IEMxNTYuNTY3LDkuNTEgMTU3LjQwMSwxMS4wOTMgMTU4LjUzMiwxMi4wOTQgTDE2NC4yNTIsMTcuMTU2IEwxNjQuMzMzLDE3LjA2NiBDMTY0LjMzMywxNy4wNjYgMTY4LjcxNSwxNC41MzYgMTY5LjU2OCwxNC4wNDIgQzE3MS4wMjUsMTQuODgzIDE5NS41MzgsMjkuMDM1IDE5NS41MzgsMjkuMDM1IEwxOTUuNTM4LDgzLjAzNiBDMTk1LjUzOCw4My44MDcgMTk1LjE1Miw4NC4yNTMgMTk0LjU5LDg0LjI1MyBDMTk0LjM1Nyw4NC4yNTMgMTk0LjA5NSw4NC4xNzcgMTkzLjgxOCw4NC4wMTcgTDE2OS44NTEsNzAuMTc5IEwxNjkuODM3LDcwLjIwMyBMMTQyLjUxNSw4NS45NzggTDE0MS42NjUsODQuNjU1IEMxMzYuOTM0LDgzLjEyNiAxMzEuOTE3LDgxLjkxNSAxMjYuNzE0LDgxLjA0NSBDMTI2LjcwOSw4MS4wNiAxMjYuNzA3LDgxLjA2OSAxMjYuNzA3LDgxLjA2OSBMMTIxLjY0LDk4LjAzIEwxMTMuNzQ5LDEwMi41ODYgTDExMy43MTIsMTAyLjUyMyBMMTEzLjcxMiwxMzAuMTEzIEMxMTMuNzEyLDEzMC44ODUgMTEzLjMyNiwxMzEuMzMgMTEyLjc2NCwxMzEuMzMgQzExMi41MzIsMTMxLjMzIDExMi4yNjksMTMxLjI1NCAxMTEuOTkyLDEzMS4wOTQgTDY5LjUxOSwxMDYuNTcyIEM2OC41NjksMTA2LjAyMyA2Ny43OTksMTA0LjY5NSA2Ny43OTksMTAzLjYwNSBMNjcuNzk5LDEwMi41NyBMNjcuNzc4LDEwMi42MTcgQzY3LjI3LDEwMi4zOTMgNjYuNjQ4LDEwMi4yNDkgNjUuOTYyLDEwMi4yMTggQzY1Ljg3NSwxMDIuMjE0IDY1Ljc4OCwxMDIuMjEyIDY1LjcwMSwxMDIuMjEyIEM2NS42MDYsMTAyLjIxMiA2NS41MTEsMTAyLjIxNSA2NS40MTYsMTAyLjIxOSBDNjUuMTk1LDEwMi4yMjkgNjQuOTc0LDEwMi4yMzUgNjQuNzU0LDEwMi4yMzUgQzY0LjMzMSwxMDIuMjM1IDYzLjkxMSwxMDIuMjE2IDYzLjQ5OCwxMDIuMTc4IEM2MS44NDMsMTAyLjAyNSA2MC4yOTgsMTAxLjU3OCA1OS4wOTQsMTAwLjg4MiBMMTIuNTE4LDczLjk5MiBMMTIuNTIzLDc0LjAwNCBMMi4yNDUsNTUuMjU0IEMxLjI0NCw1My40MjcgMi4wMDQsNTEuMDM4IDMuOTQzLDQ5LjkxOCBMNTkuOTU0LDE3LjU3MyBDNjAuNjI2LDE3LjE4NSA2MS4zNSwxNy4wMDEgNjIuMDUzLDE3LjAwMSBDNjMuMzc5LDE3LjAwMSA2NC42MjUsMTcuNjYgNjUuMjgsMTguODU0IEw2NS4yODUsMTguODUxIEw2NS41MTIsMTkuMjY0IEw2NS41MDYsMTkuMjY4IEM2NS45MDksMjAuMDAzIDY2LjQwNSwyMC42OCA2Ni45ODMsMjEuMjg2IEw2Ny4yNiwyMS41NTYgQzY5LjE3NCwyMy40MDYgNzEuNzI4LDI0LjM1NyA3NC4zNzMsMjQuMzU3IEM3Ni4zMjIsMjQuMzU3IDc4LjMyMSwyMy44NCA4MC4xNDgsMjIuNzg1IEM4MC4xNjEsMjIuNzg1IDg3LjQ2NywxOC41NjYgODcuNDY3LDE4LjU2NiBDODguMTM5LDE4LjE3OCA4OC44NjMsMTcuOTk0IDg5LjU2NiwxNy45OTQgQzkwLjg5MiwxNy45OTQgOTIuMTM4LDE4LjY1MiA5Mi43OTIsMTkuODQ3IEw5Ni4wNDIsMjUuNzc1IEw5Ni4wNjQsMjUuNzU3IEwxMDIuODQ5LDI5LjY3NCBMMTAyLjc0NCwyOS40OTIgTDE0OS42MjUsMi41MjcgTTE0OS42MjUsMC44OTIgQzE0OS4zNDMsMC44OTIgMTQ5LjA2MiwwLjk2NSAxNDguODEsMS4xMSBMMTAyLjY0MSwyNy42NjYgTDk3LjIzMSwyNC41NDIgTDk0LjIyNiwxOS4wNjEgQzkzLjMxMywxNy4zOTQgOTEuNTI3LDE2LjM1OSA4OS41NjYsMTYuMzU4IEM4OC41NTUsMTYuMzU4IDg3LjU0NiwxNi42MzIgODYuNjQ5LDE3LjE1IEM4My44NzgsMTguNzUgNzkuNjg3LDIxLjE2OSA3OS4zNzQsMjEuMzQ1IEM3OS4zNTksMjEuMzUzIDc5LjM0NSwyMS4zNjEgNzkuMzMsMjEuMzY5IEM3Ny43OTgsMjIuMjU0IDc2LjA4NCwyMi43MjIgNzQuMzczLDIyLjcyMiBDNzIuMDgxLDIyLjcyMiA2OS45NTksMjEuODkgNjguMzk3LDIwLjM4IEw2OC4xNDUsMjAuMTM1IEM2Ny43MDYsMTkuNjcyIDY3LjMyMywxOS4xNTYgNjcuMDA2LDE4LjYwMSBDNjYuOTg4LDE4LjU1OSA2Ni45NjgsMTguNTE5IDY2Ljk0NiwxOC40NzkgTDY2LjcxOSwxOC4wNjUgQzY2LjY5LDE4LjAxMiA2Ni42NTgsMTcuOTYgNjYuNjI0LDE3LjkxMSBDNjUuNjg2LDE2LjMzNyA2My45NTEsMTUuMzY2IDYyLjA1MywxNS4zNjYgQzYxLjA0MiwxNS4zNjYgNjAuMDMzLDE1LjY0IDU5LjEzNiwxNi4xNTggTDMuMTI1LDQ4LjUwMiBDMC40MjYsNTAuMDYxIC0wLjYxMyw1My40NDIgMC44MTEsNTYuMDQgTDExLjA4OSw3NC43OSBDMTEuMjY2LDc1LjExMyAxMS41MzcsNzUuMzUzIDExLjg1LDc1LjQ5NCBMNTguMjc2LDEwMi4yOTggQzU5LjY3OSwxMDMuMTA4IDYxLjQzMywxMDMuNjMgNjMuMzQ4LDEwMy44MDYgQzYzLjgxMiwxMDMuODQ4IDY0LjI4NSwxMDMuODcgNjQuNzU0LDEwMy44NyBDNjUsMTAzLjg3IDY1LjI0OSwxMDMuODY0IDY1LjQ5NCwxMDMuODUyIEM2NS41NjMsMTAzLjg0OSA2NS42MzIsMTAzLjg0NyA2NS43MDEsMTAzLjg0NyBDNjUuNzY0LDEwMy44NDcgNjUuODI4LDEwMy44NDkgNjUuODksMTAzLjg1MiBDNjUuOTg2LDEwMy44NTYgNjYuMDgsMTAzLjg2MyA2Ni4xNzMsMTAzLjg3NCBDNjYuMjgyLDEwNS40NjcgNjcuMzMyLDEwNy4xOTcgNjguNzAyLDEwNy45ODggTDExMS4xNzQsMTMyLjUxIEMxMTEuNjk4LDEzMi44MTIgMTEyLjIzMiwxMzIuOTY1IDExMi43NjQsMTMyLjk2NSBDMTE0LjI2MSwxMzIuOTY1IDExNS4zNDcsMTMxLjc2NSAxMTUuMzQ3LDEzMC4xMTMgTDExNS4zNDcsMTAzLjU1MSBMMTIyLjQ1OCw5OS40NDYgQzEyMi44MTksOTkuMjM3IDEyMy4wODcsOTguODk4IDEyMy4yMDcsOTguNDk4IEwxMjcuODY1LDgyLjkwNSBDMTMyLjI3OSw4My43MDIgMTM2LjU1Nyw4NC43NTMgMTQwLjYwNyw4Ni4wMzMgTDE0MS4xNCw4Ni44NjIgQzE0MS40NTEsODcuMzQ2IDE0MS45NzcsODcuNjEzIDE0Mi41MTYsODcuNjEzIEMxNDIuNzk0LDg3LjYxMyAxNDMuMDc2LDg3LjU0MiAxNDMuMzMzLDg3LjM5MyBMMTY5Ljg2NSw3Mi4wNzYgTDE5Myw4NS40MzMgQzE5My41MjMsODUuNzM1IDE5NC4wNTgsODUuODg4IDE5NC41OSw4NS44ODggQzE5Ni4wODcsODUuODg4IDE5Ny4xNzMsODQuNjg5IDE5Ny4xNzMsODMuMDM2IEwxOTcuMTczLDI5LjAzNSBDMTk3LjE3MywyOC40NTEgMTk2Ljg2MSwyNy45MTEgMTk2LjM1NSwyNy42MTkgQzE5Ni4zNTUsMjcuNjE5IDE3MS44NDMsMTMuNDY3IDE3MC4zODUsMTIuNjI2IEMxNzAuMTMyLDEyLjQ4IDE2OS44NSwxMi40MDcgMTY5LjU2OCwxMi40MDcgQzE2OS4yODUsMTIuNDA3IDE2OS4wMDIsMTIuNDgxIDE2OC43NDksMTIuNjI3IEMxNjguMTQzLDEyLjk3OCAxNjUuNzU2LDE0LjM1NyAxNjQuNDI0LDE1LjEyNSBMMTU5LjYxNSwxMC44NyBDMTU4Ljc5NiwxMC4xNDUgMTU4LjE1NCw4LjkzNyAxNTguMDU0LDcuOTM0IEMxNTguMDQ1LDcuODM3IDE1OC4wMzQsNy43MzkgMTU4LjAyMSw3LjY0IEMxNTguMDA1LDcuNTIzIDE1Ny45OTgsNy40MSAxNTcuOTk4LDcuMzA0IEwxNTcuOTk4LDYuNDE4IEMxNTcuOTk4LDUuODM0IDE1Ny42ODYsNS4yOTUgMTU3LjE4MSw1LjAwMiBDMTU2LjYyNCw0LjY4IDE1MC40NDIsMS4xMTEgMTUwLjQ0MiwxLjExMSBDMTUwLjE4OSwwLjk2NSAxNDkuOTA3LDAuODkyIDE0OS42MjUsMC44OTIiIGlkPSJGaWxsLTEiIGZpbGw9IiM0NTVBNjQiPjwvcGF0aD4KICAgICAgICAgICAgICAgICAgICA8cGF0aCBkPSJNOTYuMDI3LDI1LjYzNiBMMTQyLjYwMyw1Mi41MjcgQzE0My44MDcsNTMuMjIyIDE0NC41ODIsNTQuMTE0IDE0NC44NDUsNTUuMDY4IEwxNDQuODM1LDU1LjA3NSBMNjMuNDYxLDEwMi4wNTcgTDYzLjQ2LDEwMi4wNTcgQzYxLjgwNiwxMDEuOTA1IDYwLjI2MSwxMDEuNDU3IDU5LjA1NywxMDAuNzYyIEwxMi40ODEsNzMuODcxIEw5Ni4wMjcsMjUuNjM2IiBpZD0iRmlsbC0yIiBmaWxsPSIjRkFGQUZBIj48L3BhdGg+CiAgICAgICAgICAgICAgICAgICAgPHBhdGggZD0iTTYzLjQ2MSwxMDIuMTc0IEM2My40NTMsMTAyLjE3NCA2My40NDYsMTAyLjE3NCA2My40MzksMTAyLjE3MiBDNjEuNzQ2LDEwMi4wMTYgNjAuMjExLDEwMS41NjMgNTguOTk4LDEwMC44NjMgTDEyLjQyMiw3My45NzMgQzEyLjM4Niw3My45NTIgMTIuMzY0LDczLjkxNCAxMi4zNjQsNzMuODcxIEMxMi4zNjQsNzMuODMgMTIuMzg2LDczLjc5MSAxMi40MjIsNzMuNzcgTDk1Ljk2OCwyNS41MzUgQzk2LjAwNCwyNS41MTQgOTYuMDQ5LDI1LjUxNCA5Ni4wODUsMjUuNTM1IEwxNDIuNjYxLDUyLjQyNiBDMTQzLjg4OCw1My4xMzQgMTQ0LjY4Miw1NC4wMzggMTQ0Ljk1Nyw1NS4wMzcgQzE0NC45Nyw1NS4wODMgMTQ0Ljk1Myw1NS4xMzMgMTQ0LjkxNSw1NS4xNjEgQzE0NC45MTEsNTUuMTY1IDE0NC44OTgsNTUuMTc0IDE0NC44OTQsNTUuMTc3IEw2My41MTksMTAyLjE1OCBDNjMuNTAxLDEwMi4xNjkgNjMuNDgxLDEwMi4xNzQgNjMuNDYxLDEwMi4xNzQgTDYzLjQ2MSwxMDIuMTc0IFogTTEyLjcxNCw3My44NzEgTDU5LjExNSwxMDAuNjYxIEM2MC4yOTMsMTAxLjM0MSA2MS43ODYsMTAxLjc4MiA2My40MzUsMTAxLjkzNyBMMTQ0LjcwNyw1NS4wMTUgQzE0NC40MjgsNTQuMTA4IDE0My42ODIsNTMuMjg1IDE0Mi41NDQsNTIuNjI4IEw5Ni4wMjcsMjUuNzcxIEwxMi43MTQsNzMuODcxIEwxMi43MTQsNzMuODcxIFoiIGlkPSJGaWxsLTMiIGZpbGw9IiM2MDdEOEIiPjwvcGF0aD4KICAgICAgICAgICAgICAgICAgICA8cGF0aCBkPSJNMTQ4LjMyNyw1OC40NzEgQzE0OC4xNDUsNTguNDggMTQ3Ljk2Miw1OC40OCAxNDcuNzgxLDU4LjQ3MiBDMTQ1Ljg4Nyw1OC4zODkgMTQ0LjQ3OSw1Ny40MzQgMTQ0LjYzNiw1Ni4zNCBDMTQ0LjY4OSw1NS45NjcgMTQ0LjY2NCw1NS41OTcgMTQ0LjU2NCw1NS4yMzUgTDYzLjQ2MSwxMDIuMDU3IEM2NC4wODksMTAyLjExNSA2NC43MzMsMTAyLjEzIDY1LjM3OSwxMDIuMDk5IEM2NS41NjEsMTAyLjA5IDY1Ljc0MywxMDIuMDkgNjUuOTI1LDEwMi4wOTggQzY3LjgxOSwxMDIuMTgxIDY5LjIyNywxMDMuMTM2IDY5LjA3LDEwNC4yMyBMMTQ4LjMyNyw1OC40NzEiIGlkPSJGaWxsLTQiIGZpbGw9IiNGRkZGRkYiPjwvcGF0aD4KICAgICAgICAgICAgICAgICAgICA8cGF0aCBkPSJNNjkuMDcsMTA0LjM0NyBDNjkuMDQ4LDEwNC4zNDcgNjkuMDI1LDEwNC4zNCA2OS4wMDUsMTA0LjMyNyBDNjguOTY4LDEwNC4zMDEgNjguOTQ4LDEwNC4yNTcgNjguOTU1LDEwNC4yMTMgQzY5LDEwMy44OTYgNjguODk4LDEwMy41NzYgNjguNjU4LDEwMy4yODggQzY4LjE1MywxMDIuNjc4IDY3LjEwMywxMDIuMjY2IDY1LjkyLDEwMi4yMTQgQzY1Ljc0MiwxMDIuMjA2IDY1LjU2MywxMDIuMjA3IDY1LjM4NSwxMDIuMjE1IEM2NC43NDIsMTAyLjI0NiA2NC4wODcsMTAyLjIzMiA2My40NSwxMDIuMTc0IEM2My4zOTksMTAyLjE2OSA2My4zNTgsMTAyLjEzMiA2My4zNDcsMTAyLjA4MiBDNjMuMzM2LDEwMi4wMzMgNjMuMzU4LDEwMS45ODEgNjMuNDAyLDEwMS45NTYgTDE0NC41MDYsNTUuMTM0IEMxNDQuNTM3LDU1LjExNiAxNDQuNTc1LDU1LjExMyAxNDQuNjA5LDU1LjEyNyBDMTQ0LjY0Miw1NS4xNDEgMTQ0LjY2OCw1NS4xNyAxNDQuNjc3LDU1LjIwNCBDMTQ0Ljc4MSw1NS41ODUgMTQ0LjgwNiw1NS45NzIgMTQ0Ljc1MSw1Ni4zNTcgQzE0NC43MDYsNTYuNjczIDE0NC44MDgsNTYuOTk0IDE0NS4wNDcsNTcuMjgyIEMxNDUuNTUzLDU3Ljg5MiAxNDYuNjAyLDU4LjMwMyAxNDcuNzg2LDU4LjM1NSBDMTQ3Ljk2NCw1OC4zNjMgMTQ4LjE0Myw1OC4zNjMgMTQ4LjMyMSw1OC4zNTQgQzE0OC4zNzcsNTguMzUyIDE0OC40MjQsNTguMzg3IDE0OC40MzksNTguNDM4IEMxNDguNDU0LDU4LjQ5IDE0OC40MzIsNTguNTQ1IDE0OC4zODUsNTguNTcyIEw2OS4xMjksMTA0LjMzMSBDNjkuMTExLDEwNC4zNDIgNjkuMDksMTA0LjM0NyA2OS4wNywxMDQuMzQ3IEw2OS4wNywxMDQuMzQ3IFogTTY1LjY2NSwxMDEuOTc1IEM2NS43NTQsMTAxLjk3NSA2NS44NDIsMTAxLjk3NyA2NS45MywxMDEuOTgxIEM2Ny4xOTYsMTAyLjAzNyA2OC4yODMsMTAyLjQ2OSA2OC44MzgsMTAzLjEzOSBDNjkuMDY1LDEwMy40MTMgNjkuMTg4LDEwMy43MTQgNjkuMTk4LDEwNC4wMjEgTDE0Ny44ODMsNTguNTkyIEMxNDcuODQ3LDU4LjU5MiAxNDcuODExLDU4LjU5MSAxNDcuNzc2LDU4LjU4OSBDMTQ2LjUwOSw1OC41MzMgMTQ1LjQyMiw1OC4xIDE0NC44NjcsNTcuNDMxIEMxNDQuNTg1LDU3LjA5MSAxNDQuNDY1LDU2LjcwNyAxNDQuNTIsNTYuMzI0IEMxNDQuNTYzLDU2LjAyMSAxNDQuNTUyLDU1LjcxNiAxNDQuNDg4LDU1LjQxNCBMNjMuODQ2LDEwMS45NyBDNjQuMzUzLDEwMi4wMDIgNjQuODY3LDEwMi4wMDYgNjUuMzc0LDEwMS45ODIgQzY1LjQ3MSwxMDEuOTc3IDY1LjU2OCwxMDEuOTc1IDY1LjY2NSwxMDEuOTc1IEw2NS42NjUsMTAxLjk3NSBaIiBpZD0iRmlsbC01IiBmaWxsPSIjNjA3RDhCIj48L3BhdGg+CiAgICAgICAgICAgICAgICAgICAgPHBhdGggZD0iTTIuMjA4LDU1LjEzNCBDMS4yMDcsNTMuMzA3IDEuOTY3LDUwLjkxNyAzLjkwNiw0OS43OTcgTDU5LjkxNywxNy40NTMgQzYxLjg1NiwxNi4zMzMgNjQuMjQxLDE2LjkwNyA2NS4yNDMsMTguNzM0IEw2NS40NzUsMTkuMTQ0IEM2NS44NzIsMTkuODgyIDY2LjM2OCwyMC41NiA2Ni45NDUsMjEuMTY1IEw2Ny4yMjMsMjEuNDM1IEM3MC41NDgsMjQuNjQ5IDc1LjgwNiwyNS4xNTEgODAuMTExLDIyLjY2NSBMODcuNDMsMTguNDQ1IEM4OS4zNywxNy4zMjYgOTEuNzU0LDE3Ljg5OSA5Mi43NTUsMTkuNzI3IEw5Ni4wMDUsMjUuNjU1IEwxMi40ODYsNzMuODg0IEwyLjIwOCw1NS4xMzQgWiIgaWQ9IkZpbGwtNiIgZmlsbD0iI0ZBRkFGQSI+PC9wYXRoPgogICAgICAgICAgICAgICAgICAgIDxwYXRoIGQ9Ik0xMi40ODYsNzQuMDAxIEMxMi40NzYsNzQuMDAxIDEyLjQ2NSw3My45OTkgMTIuNDU1LDczLjk5NiBDMTIuNDI0LDczLjk4OCAxMi4zOTksNzMuOTY3IDEyLjM4NCw3My45NCBMMi4xMDYsNTUuMTkgQzEuMDc1LDUzLjMxIDEuODU3LDUwLjg0NSAzLjg0OCw0OS42OTYgTDU5Ljg1OCwxNy4zNTIgQzYwLjUyNSwxNi45NjcgNjEuMjcxLDE2Ljc2NCA2Mi4wMTYsMTYuNzY0IEM2My40MzEsMTYuNzY0IDY0LjY2NiwxNy40NjYgNjUuMzI3LDE4LjY0NiBDNjUuMzM3LDE4LjY1NCA2NS4zNDUsMTguNjYzIDY1LjM1MSwxOC42NzQgTDY1LjU3OCwxOS4wODggQzY1LjU4NCwxOS4xIDY1LjU4OSwxOS4xMTIgNjUuNTkxLDE5LjEyNiBDNjUuOTg1LDE5LjgzOCA2Ni40NjksMjAuNDk3IDY3LjAzLDIxLjA4NSBMNjcuMzA1LDIxLjM1MSBDNjkuMTUxLDIzLjEzNyA3MS42NDksMjQuMTIgNzQuMzM2LDI0LjEyIEM3Ni4zMTMsMjQuMTIgNzguMjksMjMuNTgyIDgwLjA1MywyMi41NjMgQzgwLjA2NCwyMi41NTcgODAuMDc2LDIyLjU1MyA4MC4wODgsMjIuNTUgTDg3LjM3MiwxOC4zNDQgQzg4LjAzOCwxNy45NTkgODguNzg0LDE3Ljc1NiA4OS41MjksMTcuNzU2IEM5MC45NTYsMTcuNzU2IDkyLjIwMSwxOC40NzIgOTIuODU4LDE5LjY3IEw5Ni4xMDcsMjUuNTk5IEM5Ni4xMzgsMjUuNjU0IDk2LjExOCwyNS43MjQgOTYuMDYzLDI1Ljc1NiBMMTIuNTQ1LDczLjk4NSBDMTIuNTI2LDczLjk5NiAxMi41MDYsNzQuMDAxIDEyLjQ4Niw3NC4wMDEgTDEyLjQ4Niw3NC4wMDEgWiBNNjIuMDE2LDE2Ljk5NyBDNjEuMzEyLDE2Ljk5NyA2MC42MDYsMTcuMTkgNTkuOTc1LDE3LjU1NCBMMy45NjUsNDkuODk5IEMyLjA4Myw1MC45ODUgMS4zNDEsNTMuMzA4IDIuMzEsNTUuMDc4IEwxMi41MzEsNzMuNzIzIEw5NS44NDgsMjUuNjExIEw5Mi42NTMsMTkuNzgyIEM5Mi4wMzgsMTguNjYgOTAuODcsMTcuOTkgODkuNTI5LDE3Ljk5IEM4OC44MjUsMTcuOTkgODguMTE5LDE4LjE4MiA4Ny40ODksMTguNTQ3IEw4MC4xNzIsMjIuNzcyIEM4MC4xNjEsMjIuNzc4IDgwLjE0OSwyMi43ODIgODAuMTM3LDIyLjc4NSBDNzguMzQ2LDIzLjgxMSA3Ni4zNDEsMjQuMzU0IDc0LjMzNiwyNC4zNTQgQzcxLjU4OCwyNC4zNTQgNjkuMDMzLDIzLjM0NyA2Ny4xNDIsMjEuNTE5IEw2Ni44NjQsMjEuMjQ5IEM2Ni4yNzcsMjAuNjM0IDY1Ljc3NCwxOS45NDcgNjUuMzY3LDE5LjIwMyBDNjUuMzYsMTkuMTkyIDY1LjM1NiwxOS4xNzkgNjUuMzU0LDE5LjE2NiBMNjUuMTYzLDE4LjgxOSBDNjUuMTU0LDE4LjgxMSA2NS4xNDYsMTguODAxIDY1LjE0LDE4Ljc5IEM2NC41MjUsMTcuNjY3IDYzLjM1NywxNi45OTcgNjIuMDE2LDE2Ljk5NyBMNjIuMDE2LDE2Ljk5NyBaIiBpZD0iRmlsbC03IiBmaWxsPSIjNjA3RDhCIj48L3BhdGg+CiAgICAgICAgICAgICAgICAgICAgPHBhdGggZD0iTTQyLjQzNCw0OC44MDggTDQyLjQzNCw0OC44MDggQzM5LjkyNCw0OC44MDcgMzcuNzM3LDQ3LjU1IDM2LjU4Miw0NS40NDMgQzM0Ljc3MSw0Mi4xMzkgMzYuMTQ0LDM3LjgwOSAzOS42NDEsMzUuNzg5IEw1MS45MzIsMjguNjkxIEM1My4xMDMsMjguMDE1IDU0LjQxMywyNy42NTggNTUuNzIxLDI3LjY1OCBDNTguMjMxLDI3LjY1OCA2MC40MTgsMjguOTE2IDYxLjU3MywzMS4wMjMgQzYzLjM4NCwzNC4zMjcgNjIuMDEyLDM4LjY1NyA1OC41MTQsNDAuNjc3IEw0Ni4yMjMsNDcuNzc1IEM0NS4wNTMsNDguNDUgNDMuNzQyLDQ4LjgwOCA0Mi40MzQsNDguODA4IEw0Mi40MzQsNDguODA4IFogTTU1LjcyMSwyOC4xMjUgQzU0LjQ5NSwyOC4xMjUgNTMuMjY1LDI4LjQ2MSA1Mi4xNjYsMjkuMDk2IEwzOS44NzUsMzYuMTk0IEMzNi41OTYsMzguMDg3IDM1LjMwMiw0Mi4xMzYgMzYuOTkyLDQ1LjIxOCBDMzguMDYzLDQ3LjE3MyA0MC4wOTgsNDguMzQgNDIuNDM0LDQ4LjM0IEM0My42NjEsNDguMzQgNDQuODksNDguMDA1IDQ1Ljk5LDQ3LjM3IEw1OC4yODEsNDAuMjcyIEM2MS41NiwzOC4zNzkgNjIuODUzLDM0LjMzIDYxLjE2NCwzMS4yNDggQzYwLjA5MiwyOS4yOTMgNTguMDU4LDI4LjEyNSA1NS43MjEsMjguMTI1IEw1NS43MjEsMjguMTI1IFoiIGlkPSJGaWxsLTgiIGZpbGw9IiM2MDdEOEIiPjwvcGF0aD4KICAgICAgICAgICAgICAgICAgICA8cGF0aCBkPSJNMTQ5LjU4OCwyLjQwNyBDMTQ5LjU4OCwyLjQwNyAxNTUuNzY4LDUuOTc1IDE1Ni4zMjUsNi4yOTcgTDE1Ni4zMjUsNy4xODQgQzE1Ni4zMjUsNy4zNiAxNTYuMzM4LDcuNTQ0IDE1Ni4zNjIsNy43MzMgQzE1Ni4zNzMsNy44MTQgMTU2LjM4Miw3Ljg5NCAxNTYuMzksNy45NzUgQzE1Ni41Myw5LjM5IDE1Ny4zNjMsMTAuOTczIDE1OC40OTUsMTEuOTc0IEwxNjUuODkxLDE4LjUxOSBDMTY2LjA2OCwxOC42NzUgMTY2LjI0OSwxOC44MTQgMTY2LjQzMiwxOC45MzQgQzE2OC4wMTEsMTkuOTc0IDE2OS4zODIsMTkuNCAxNjkuNDk0LDE3LjY1MiBDMTY5LjU0MywxNi44NjggMTY5LjU1MSwxNi4wNTcgMTY5LjUxNywxNS4yMjMgTDE2OS41MTQsMTUuMDYzIEwxNjkuNTE0LDEzLjkxMiBDMTcwLjc4LDE0LjY0MiAxOTUuNTAxLDI4LjkxNSAxOTUuNTAxLDI4LjkxNSBMMTk1LjUwMSw4Mi45MTUgQzE5NS41MDEsODQuMDA1IDE5NC43MzEsODQuNDQ1IDE5My43ODEsODMuODk3IEwxNTEuMzA4LDU5LjM3NCBDMTUwLjM1OCw1OC44MjYgMTQ5LjU4OCw1Ny40OTcgMTQ5LjU4OCw1Ni40MDggTDE0OS41ODgsMjIuMzc1IiBpZD0iRmlsbC05IiBmaWxsPSIjRkFGQUZBIj48L3BhdGg+CiAgICAgICAgICAgICAgICAgICAgPHBhdGggZD0iTTE5NC41NTMsODQuMjUgQzE5NC4yOTYsODQuMjUgMTk0LjAxMyw4NC4xNjUgMTkzLjcyMiw4My45OTcgTDE1MS4yNSw1OS40NzYgQzE1MC4yNjksNTguOTA5IDE0OS40NzEsNTcuNTMzIDE0OS40NzEsNTYuNDA4IEwxNDkuNDcxLDIyLjM3NSBMMTQ5LjcwNSwyMi4zNzUgTDE0OS43MDUsNTYuNDA4IEMxNDkuNzA1LDU3LjQ1OSAxNTAuNDUsNTguNzQ0IDE1MS4zNjYsNTkuMjc0IEwxOTMuODM5LDgzLjc5NSBDMTk0LjI2Myw4NC4wNCAxOTQuNjU1LDg0LjA4MyAxOTQuOTQyLDgzLjkxNyBDMTk1LjIyNyw4My43NTMgMTk1LjM4NCw4My4zOTcgMTk1LjM4NCw4Mi45MTUgTDE5NS4zODQsMjguOTgyIEMxOTQuMTAyLDI4LjI0MiAxNzIuMTA0LDE1LjU0MiAxNjkuNjMxLDE0LjExNCBMMTY5LjYzNCwxNS4yMiBDMTY5LjY2OCwxNi4wNTIgMTY5LjY2LDE2Ljg3NCAxNjkuNjEsMTcuNjU5IEMxNjkuNTU2LDE4LjUwMyAxNjkuMjE0LDE5LjEyMyAxNjguNjQ3LDE5LjQwNSBDMTY4LjAyOCwxOS43MTQgMTY3LjE5NywxOS41NzggMTY2LjM2NywxOS4wMzIgQzE2Ni4xODEsMTguOTA5IDE2NS45OTUsMTguNzY2IDE2NS44MTQsMTguNjA2IEwxNTguNDE3LDEyLjA2MiBDMTU3LjI1OSwxMS4wMzYgMTU2LjQxOCw5LjQzNyAxNTYuMjc0LDcuOTg2IEMxNTYuMjY2LDcuOTA3IDE1Ni4yNTcsNy44MjcgMTU2LjI0Nyw3Ljc0OCBDMTU2LjIyMSw3LjU1NSAxNTYuMjA5LDcuMzY1IDE1Ni4yMDksNy4xODQgTDE1Ni4yMDksNi4zNjQgQzE1NS4zNzUsNS44ODMgMTQ5LjUyOSwyLjUwOCAxNDkuNTI5LDIuNTA4IEwxNDkuNjQ2LDIuMzA2IEMxNDkuNjQ2LDIuMzA2IDE1NS44MjcsNS44NzQgMTU2LjM4NCw2LjE5NiBMMTU2LjQ0Miw2LjIzIEwxNTYuNDQyLDcuMTg0IEMxNTYuNDQyLDcuMzU1IDE1Ni40NTQsNy41MzUgMTU2LjQ3OCw3LjcxNyBDMTU2LjQ4OSw3LjggMTU2LjQ5OSw3Ljg4MiAxNTYuNTA3LDcuOTYzIEMxNTYuNjQ1LDkuMzU4IDE1Ny40NTUsMTAuODk4IDE1OC41NzIsMTEuODg2IEwxNjUuOTY5LDE4LjQzMSBDMTY2LjE0MiwxOC41ODQgMTY2LjMxOSwxOC43MiAxNjYuNDk2LDE4LjgzNyBDMTY3LjI1NCwxOS4zMzYgMTY4LDE5LjQ2NyAxNjguNTQzLDE5LjE5NiBDMTY5LjAzMywxOC45NTMgMTY5LjMyOSwxOC40MDEgMTY5LjM3NywxNy42NDUgQzE2OS40MjcsMTYuODY3IDE2OS40MzQsMTYuMDU0IDE2OS40MDEsMTUuMjI4IEwxNjkuMzk3LDE1LjA2NSBMMTY5LjM5NywxMy43MSBMMTY5LjU3MiwxMy44MSBDMTcwLjgzOSwxNC41NDEgMTk1LjU1OSwyOC44MTQgMTk1LjU1OSwyOC44MTQgTDE5NS42MTgsMjguODQ3IEwxOTUuNjE4LDgyLjkxNSBDMTk1LjYxOCw4My40ODQgMTk1LjQyLDgzLjkxMSAxOTUuMDU5LDg0LjExOSBDMTk0LjkwOCw4NC4yMDYgMTk0LjczNyw4NC4yNSAxOTQuNTUzLDg0LjI1IiBpZD0iRmlsbC0xMCIgZmlsbD0iIzYwN0Q4QiI+PC9wYXRoPgogICAgICAgICAgICAgICAgICAgIDxwYXRoIGQ9Ik0xNDUuNjg1LDU2LjE2MSBMMTY5LjgsNzAuMDgzIEwxNDMuODIyLDg1LjA4MSBMMTQyLjM2LDg0Ljc3NCBDMTM1LjgyNiw4Mi42MDQgMTI4LjczMiw4MS4wNDYgMTIxLjM0MSw4MC4xNTggQzExNi45NzYsNzkuNjM0IDExMi42NzgsODEuMjU0IDExMS43NDMsODMuNzc4IEMxMTEuNTA2LDg0LjQxNCAxMTEuNTAzLDg1LjA3MSAxMTEuNzMyLDg1LjcwNiBDMTEzLjI3LDg5Ljk3MyAxMTUuOTY4LDk0LjA2OSAxMTkuNzI3LDk3Ljg0MSBMMTIwLjI1OSw5OC42ODYgQzEyMC4yNiw5OC42ODUgOTQuMjgyLDExMy42ODMgOTQuMjgyLDExMy42ODMgTDcwLjE2Nyw5OS43NjEgTDE0NS42ODUsNTYuMTYxIiBpZD0iRmlsbC0xMSIgZmlsbD0iI0ZGRkZGRiI+PC9wYXRoPgogICAgICAgICAgICAgICAgICAgIDxwYXRoIGQ9Ik05NC4yODIsMTEzLjgxOCBMOTQuMjIzLDExMy43ODUgTDY5LjkzMyw5OS43NjEgTDcwLjEwOCw5OS42NiBMMTQ1LjY4NSw1Ni4wMjYgTDE0NS43NDMsNTYuMDU5IEwxNzAuMDMzLDcwLjA4MyBMMTQzLjg0Miw4NS4yMDUgTDE0My43OTcsODUuMTk1IEMxNDMuNzcyLDg1LjE5IDE0Mi4zMzYsODQuODg4IDE0Mi4zMzYsODQuODg4IEMxMzUuNzg3LDgyLjcxNCAxMjguNzIzLDgxLjE2MyAxMjEuMzI3LDgwLjI3NCBDMTIwLjc4OCw4MC4yMDkgMTIwLjIzNiw4MC4xNzcgMTE5LjY4OSw4MC4xNzcgQzExNS45MzEsODAuMTc3IDExMi42MzUsODEuNzA4IDExMS44NTIsODMuODE5IEMxMTEuNjI0LDg0LjQzMiAxMTEuNjIxLDg1LjA1MyAxMTEuODQyLDg1LjY2NyBDMTEzLjM3Nyw4OS45MjUgMTE2LjA1OCw5My45OTMgMTE5LjgxLDk3Ljc1OCBMMTE5LjgyNiw5Ny43NzkgTDEyMC4zNTIsOTguNjE0IEMxMjAuMzU0LDk4LjYxNyAxMjAuMzU2LDk4LjYyIDEyMC4zNTgsOTguNjI0IEwxMjAuNDIyLDk4LjcyNiBMMTIwLjMxNyw5OC43ODcgQzEyMC4yNjQsOTguODE4IDk0LjU5OSwxMTMuNjM1IDk0LjM0LDExMy43ODUgTDk0LjI4MiwxMTMuODE4IEw5NC4yODIsMTEzLjgxOCBaIE03MC40MDEsOTkuNzYxIEw5NC4yODIsMTEzLjU0OSBMMTE5LjA4NCw5OS4yMjkgQzExOS42Myw5OC45MTQgMTE5LjkzLDk4Ljc0IDEyMC4xMDEsOTguNjU0IEwxMTkuNjM1LDk3LjkxNCBDMTE1Ljg2NCw5NC4xMjcgMTEzLjE2OCw5MC4wMzMgMTExLjYyMiw4NS43NDYgQzExMS4zODIsODUuMDc5IDExMS4zODYsODQuNDA0IDExMS42MzMsODMuNzM4IEMxMTIuNDQ4LDgxLjUzOSAxMTUuODM2LDc5Ljk0MyAxMTkuNjg5LDc5Ljk0MyBDMTIwLjI0Niw3OS45NDMgMTIwLjgwNiw3OS45NzYgMTIxLjM1NSw4MC4wNDIgQzEyOC43NjcsODAuOTMzIDEzNS44NDYsODIuNDg3IDE0Mi4zOTYsODQuNjYzIEMxNDMuMjMyLDg0LjgzOCAxNDMuNjExLDg0LjkxNyAxNDMuNzg2LDg0Ljk2NyBMMTY5LjU2Niw3MC4wODMgTDE0NS42ODUsNTYuMjk1IEw3MC40MDEsOTkuNzYxIEw3MC40MDEsOTkuNzYxIFoiIGlkPSJGaWxsLTEyIiBmaWxsPSIjNjA3RDhCIj48L3BhdGg+CiAgICAgICAgICAgICAgICAgICAgPHBhdGggZD0iTTE2Ny4yMywxOC45NzkgTDE2Ny4yMyw2OS44NSBMMTM5LjkwOSw4NS42MjMgTDEzMy40NDgsNzEuNDU2IEMxMzIuNTM4LDY5LjQ2IDEzMC4wMiw2OS43MTggMTI3LjgyNCw3Mi4wMyBDMTI2Ljc2OSw3My4xNCAxMjUuOTMxLDc0LjU4NSAxMjUuNDk0LDc2LjA0OCBMMTE5LjAzNCw5Ny42NzYgTDkxLjcxMiwxMTMuNDUgTDkxLjcxMiw2Mi41NzkgTDE2Ny4yMywxOC45NzkiIGlkPSJGaWxsLTEzIiBmaWxsPSIjRkZGRkZGIj48L3BhdGg+CiAgICAgICAgICAgICAgICAgICAgPHBhdGggZD0iTTkxLjcxMiwxMTMuNTY3IEM5MS42OTIsMTEzLjU2NyA5MS42NzIsMTEzLjU2MSA5MS42NTMsMTEzLjU1MSBDOTEuNjE4LDExMy41MyA5MS41OTUsMTEzLjQ5MiA5MS41OTUsMTEzLjQ1IEw5MS41OTUsNjIuNTc5IEM5MS41OTUsNjIuNTM3IDkxLjYxOCw2Mi40OTkgOTEuNjUzLDYyLjQ3OCBMMTY3LjE3MiwxOC44NzggQzE2Ny4yMDgsMTguODU3IDE2Ny4yNTIsMTguODU3IDE2Ny4yODgsMTguODc4IEMxNjcuMzI0LDE4Ljg5OSAxNjcuMzQ3LDE4LjkzNyAxNjcuMzQ3LDE4Ljk3OSBMMTY3LjM0Nyw2OS44NSBDMTY3LjM0Nyw2OS44OTEgMTY3LjMyNCw2OS45MyAxNjcuMjg4LDY5Ljk1IEwxMzkuOTY3LDg1LjcyNSBDMTM5LjkzOSw4NS43NDEgMTM5LjkwNSw4NS43NDUgMTM5Ljg3Myw4NS43MzUgQzEzOS44NDIsODUuNzI1IDEzOS44MTYsODUuNzAyIDEzOS44MDIsODUuNjcyIEwxMzMuMzQyLDcxLjUwNCBDMTMyLjk2Nyw3MC42ODIgMTMyLjI4LDcwLjIyOSAxMzEuNDA4LDcwLjIyOSBDMTMwLjMxOSw3MC4yMjkgMTI5LjA0NCw3MC45MTUgMTI3LjkwOCw3Mi4xMSBDMTI2Ljg3NCw3My4yIDEyNi4wMzQsNzQuNjQ3IDEyNS42MDYsNzYuMDgyIEwxMTkuMTQ2LDk3LjcwOSBDMTE5LjEzNyw5Ny43MzggMTE5LjExOCw5Ny43NjIgMTE5LjA5Miw5Ny43NzcgTDkxLjc3LDExMy41NTEgQzkxLjc1MiwxMTMuNTYxIDkxLjczMiwxMTMuNTY3IDkxLjcxMiwxMTMuNTY3IEw5MS43MTIsMTEzLjU2NyBaIE05MS44MjksNjIuNjQ3IEw5MS44MjksMTEzLjI0OCBMMTE4LjkzNSw5Ny41OTggTDEyNS4zODIsNzYuMDE1IEMxMjUuODI3LDc0LjUyNSAxMjYuNjY0LDczLjA4MSAxMjcuNzM5LDcxLjk1IEMxMjguOTE5LDcwLjcwOCAxMzAuMjU2LDY5Ljk5NiAxMzEuNDA4LDY5Ljk5NiBDMTMyLjM3Nyw2OS45OTYgMTMzLjEzOSw3MC40OTcgMTMzLjU1NCw3MS40MDcgTDEzOS45NjEsODUuNDU4IEwxNjcuMTEzLDY5Ljc4MiBMMTY3LjExMywxOS4xODEgTDkxLjgyOSw2Mi42NDcgTDkxLjgyOSw2Mi42NDcgWiIgaWQ9IkZpbGwtMTQiIGZpbGw9IiM2MDdEOEIiPjwvcGF0aD4KICAgICAgICAgICAgICAgICAgICA8cGF0aCBkPSJNMTY4LjU0MywxOS4yMTMgTDE2OC41NDMsNzAuMDgzIEwxNDEuMjIxLDg1Ljg1NyBMMTM0Ljc2MSw3MS42ODkgQzEzMy44NTEsNjkuNjk0IDEzMS4zMzMsNjkuOTUxIDEyOS4xMzcsNzIuMjYzIEMxMjguMDgyLDczLjM3NCAxMjcuMjQ0LDc0LjgxOSAxMjYuODA3LDc2LjI4MiBMMTIwLjM0Niw5Ny45MDkgTDkzLjAyNSwxMTMuNjgzIEw5My4wMjUsNjIuODEzIEwxNjguNTQzLDE5LjIxMyIgaWQ9IkZpbGwtMTUiIGZpbGw9IiNGRkZGRkYiPjwvcGF0aD4KICAgICAgICAgICAgICAgICAgICA8cGF0aCBkPSJNOTMuMDI1LDExMy44IEM5My4wMDUsMTEzLjggOTIuOTg0LDExMy43OTUgOTIuOTY2LDExMy43ODUgQzkyLjkzMSwxMTMuNzY0IDkyLjkwOCwxMTMuNzI1IDkyLjkwOCwxMTMuNjg0IEw5Mi45MDgsNjIuODEzIEM5Mi45MDgsNjIuNzcxIDkyLjkzMSw2Mi43MzMgOTIuOTY2LDYyLjcxMiBMMTY4LjQ4NCwxOS4xMTIgQzE2OC41MiwxOS4wOSAxNjguNTY1LDE5LjA5IDE2OC42MDEsMTkuMTEyIEMxNjguNjM3LDE5LjEzMiAxNjguNjYsMTkuMTcxIDE2OC42NiwxOS4yMTIgTDE2OC42Niw3MC4wODMgQzE2OC42Niw3MC4xMjUgMTY4LjYzNyw3MC4xNjQgMTY4LjYwMSw3MC4xODQgTDE0MS4yOCw4NS45NTggQzE0MS4yNTEsODUuOTc1IDE0MS4yMTcsODUuOTc5IDE0MS4xODYsODUuOTY4IEMxNDEuMTU0LDg1Ljk1OCAxNDEuMTI5LDg1LjkzNiAxNDEuMTE1LDg1LjkwNiBMMTM0LjY1NSw3MS43MzggQzEzNC4yOCw3MC45MTUgMTMzLjU5Myw3MC40NjMgMTMyLjcyLDcwLjQ2MyBDMTMxLjYzMiw3MC40NjMgMTMwLjM1Nyw3MS4xNDggMTI5LjIyMSw3Mi4zNDQgQzEyOC4xODYsNzMuNDMzIDEyNy4zNDcsNzQuODgxIDEyNi45MTksNzYuMzE1IEwxMjAuNDU4LDk3Ljk0MyBDMTIwLjQ1LDk3Ljk3MiAxMjAuNDMxLDk3Ljk5NiAxMjAuNDA1LDk4LjAxIEw5My4wODMsMTEzLjc4NSBDOTMuMDY1LDExMy43OTUgOTMuMDQ1LDExMy44IDkzLjAyNSwxMTMuOCBMOTMuMDI1LDExMy44IFogTTkzLjE0Miw2Mi44ODEgTDkzLjE0MiwxMTMuNDgxIEwxMjAuMjQ4LDk3LjgzMiBMMTI2LjY5NSw3Ni4yNDggQzEyNy4xNCw3NC43NTggMTI3Ljk3Nyw3My4zMTUgMTI5LjA1Miw3Mi4xODMgQzEzMC4yMzEsNzAuOTQyIDEzMS41NjgsNzAuMjI5IDEzMi43Miw3MC4yMjkgQzEzMy42ODksNzAuMjI5IDEzNC40NTIsNzAuNzMxIDEzNC44NjcsNzEuNjQxIEwxNDEuMjc0LDg1LjY5MiBMMTY4LjQyNiw3MC4wMTYgTDE2OC40MjYsMTkuNDE1IEw5My4xNDIsNjIuODgxIEw5My4xNDIsNjIuODgxIFoiIGlkPSJGaWxsLTE2IiBmaWxsPSIjNjA3RDhCIj48L3BhdGg+CiAgICAgICAgICAgICAgICAgICAgPHBhdGggZD0iTTE2OS44LDcwLjA4MyBMMTQyLjQ3OCw4NS44NTcgTDEzNi4wMTgsNzEuNjg5IEMxMzUuMTA4LDY5LjY5NCAxMzIuNTksNjkuOTUxIDEzMC4zOTMsNzIuMjYzIEMxMjkuMzM5LDczLjM3NCAxMjguNSw3NC44MTkgMTI4LjA2NCw3Ni4yODIgTDEyMS42MDMsOTcuOTA5IEw5NC4yODIsMTEzLjY4MyBMOTQuMjgyLDYyLjgxMyBMMTY5LjgsMTkuMjEzIEwxNjkuOCw3MC4wODMgWiIgaWQ9IkZpbGwtMTciIGZpbGw9IiNGQUZBRkEiPjwvcGF0aD4KICAgICAgICAgICAgICAgICAgICA8cGF0aCBkPSJNOTQuMjgyLDExMy45MTcgQzk0LjI0MSwxMTMuOTE3IDk0LjIwMSwxMTMuOTA3IDk0LjE2NSwxMTMuODg2IEM5NC4wOTMsMTEzLjg0NSA5NC4wNDgsMTEzLjc2NyA5NC4wNDgsMTEzLjY4NCBMOTQuMDQ4LDYyLjgxMyBDOTQuMDQ4LDYyLjczIDk0LjA5Myw2Mi42NTIgOTQuMTY1LDYyLjYxMSBMMTY5LjY4MywxOS4wMSBDMTY5Ljc1NSwxOC45NjkgMTY5Ljg0NCwxOC45NjkgMTY5LjkxNywxOS4wMSBDMTY5Ljk4OSwxOS4wNTIgMTcwLjAzMywxOS4xMjkgMTcwLjAzMywxOS4yMTIgTDE3MC4wMzMsNzAuMDgzIEMxNzAuMDMzLDcwLjE2NiAxNjkuOTg5LDcwLjI0NCAxNjkuOTE3LDcwLjI4NSBMMTQyLjU5NSw4Ni4wNiBDMTQyLjUzOCw4Ni4wOTIgMTQyLjQ2OSw4Ni4xIDE0Mi40MDcsODYuMDggQzE0Mi4zNDQsODYuMDYgMTQyLjI5Myw4Ni4wMTQgMTQyLjI2Niw4NS45NTQgTDEzNS44MDUsNzEuNzg2IEMxMzUuNDQ1LDcwLjk5NyAxMzQuODEzLDcwLjU4IDEzMy45NzcsNzAuNTggQzEzMi45MjEsNzAuNTggMTMxLjY3Niw3MS4yNTIgMTMwLjU2Miw3Mi40MjQgQzEyOS41NCw3My41MDEgMTI4LjcxMSw3NC45MzEgMTI4LjI4Nyw3Ni4zNDggTDEyMS44MjcsOTcuOTc2IEMxMjEuODEsOTguMDM0IDEyMS43NzEsOTguMDgyIDEyMS43Miw5OC4xMTIgTDk0LjM5OCwxMTMuODg2IEM5NC4zNjIsMTEzLjkwNyA5NC4zMjIsMTEzLjkxNyA5NC4yODIsMTEzLjkxNyBMOTQuMjgyLDExMy45MTcgWiBNOTQuNTE1LDYyLjk0OCBMOTQuNTE1LDExMy4yNzkgTDEyMS40MDYsOTcuNzU0IEwxMjcuODQsNzYuMjE1IEMxMjguMjksNzQuNzA4IDEyOS4xMzcsNzMuMjQ3IDEzMC4yMjQsNzIuMTAzIEMxMzEuNDI1LDcwLjgzOCAxMzIuNzkzLDcwLjExMiAxMzMuOTc3LDcwLjExMiBDMTM0Ljk5NSw3MC4xMTIgMTM1Ljc5NSw3MC42MzggMTM2LjIzLDcxLjU5MiBMMTQyLjU4NCw4NS41MjYgTDE2OS41NjYsNjkuOTQ4IEwxNjkuNTY2LDE5LjYxNyBMOTQuNTE1LDYyLjk0OCBMOTQuNTE1LDYyLjk0OCBaIiBpZD0iRmlsbC0xOCIgZmlsbD0iIzYwN0Q4QiI+PC9wYXRoPgogICAgICAgICAgICAgICAgICAgIDxwYXRoIGQ9Ik0xMDkuODk0LDkyLjk0MyBMMTA5Ljg5NCw5Mi45NDMgQzEwOC4xMiw5Mi45NDMgMTA2LjY1Myw5Mi4yMTggMTA1LjY1LDkwLjgyMyBDMTA1LjU4Myw5MC43MzEgMTA1LjU5Myw5MC42MSAxMDUuNjczLDkwLjUyOSBDMTA1Ljc1Myw5MC40NDggMTA1Ljg4LDkwLjQ0IDEwNS45NzQsOTAuNTA2IEMxMDYuNzU0LDkxLjA1MyAxMDcuNjc5LDkxLjMzMyAxMDguNzI0LDkxLjMzMyBDMTEwLjA0Nyw5MS4zMzMgMTExLjQ3OCw5MC44OTQgMTEyLjk4LDkwLjAyNyBDMTE4LjI5MSw4Ni45NiAxMjIuNjExLDc5LjUwOSAxMjIuNjExLDczLjQxNiBDMTIyLjYxMSw3MS40ODkgMTIyLjE2OSw2OS44NTYgMTIxLjMzMyw2OC42OTIgQzEyMS4yNjYsNjguNiAxMjEuMjc2LDY4LjQ3MyAxMjEuMzU2LDY4LjM5MiBDMTIxLjQzNiw2OC4zMTEgMTIxLjU2Myw2OC4yOTkgMTIxLjY1Niw2OC4zNjUgQzEyMy4zMjcsNjkuNTM3IDEyNC4yNDcsNzEuNzQ2IDEyNC4yNDcsNzQuNTg0IEMxMjQuMjQ3LDgwLjgyNiAxMTkuODIxLDg4LjQ0NyAxMTQuMzgyLDkxLjU4NyBDMTEyLjgwOCw5Mi40OTUgMTExLjI5OCw5Mi45NDMgMTA5Ljg5NCw5Mi45NDMgTDEwOS44OTQsOTIuOTQzIFogTTEwNi45MjUsOTEuNDAxIEMxMDcuNzM4LDkyLjA1MiAxMDguNzQ1LDkyLjI3OCAxMDkuODkzLDkyLjI3OCBMMTA5Ljg5NCw5Mi4yNzggQzExMS4yMTUsOTIuMjc4IDExMi42NDcsOTEuOTUxIDExNC4xNDgsOTEuMDg0IEMxMTkuNDU5LDg4LjAxNyAxMjMuNzgsODAuNjIxIDEyMy43OCw3NC41MjggQzEyMy43OCw3Mi41NDkgMTIzLjMxNyw3MC45MjkgMTIyLjQ1NCw2OS43NjcgQzEyMi44NjUsNzAuODAyIDEyMy4wNzksNzIuMDQyIDEyMy4wNzksNzMuNDAyIEMxMjMuMDc5LDc5LjY0NSAxMTguNjUzLDg3LjI4NSAxMTMuMjE0LDkwLjQyNSBDMTExLjY0LDkxLjMzNCAxMTAuMTMsOTEuNzQyIDEwOC43MjQsOTEuNzQyIEMxMDguMDgzLDkxLjc0MiAxMDcuNDgxLDkxLjU5MyAxMDYuOTI1LDkxLjQwMSBMMTA2LjkyNSw5MS40MDEgWiIgaWQ9IkZpbGwtMTkiIGZpbGw9IiM2MDdEOEIiPjwvcGF0aD4KICAgICAgICAgICAgICAgICAgICA8cGF0aCBkPSJNMTEzLjA5Nyw5MC4yMyBDMTE4LjQ4MSw4Ny4xMjIgMTIyLjg0NSw3OS41OTQgMTIyLjg0NSw3My40MTYgQzEyMi44NDUsNzEuMzY1IDEyMi4zNjIsNjkuNzI0IDEyMS41MjIsNjguNTU2IEMxMTkuNzM4LDY3LjMwNCAxMTcuMTQ4LDY3LjM2MiAxMTQuMjY1LDY5LjAyNiBDMTA4Ljg4MSw3Mi4xMzQgMTA0LjUxNyw3OS42NjIgMTA0LjUxNyw4NS44NCBDMTA0LjUxNyw4Ny44OTEgMTA1LDg5LjUzMiAxMDUuODQsOTAuNyBDMTA3LjYyNCw5MS45NTIgMTEwLjIxNCw5MS44OTQgMTEzLjA5Nyw5MC4yMyIgaWQ9IkZpbGwtMjAiIGZpbGw9IiNGQUZBRkEiPjwvcGF0aD4KICAgICAgICAgICAgICAgICAgICA8cGF0aCBkPSJNMTA4LjcyNCw5MS42MTQgTDEwOC43MjQsOTEuNjE0IEMxMDcuNTgyLDkxLjYxNCAxMDYuNTY2LDkxLjQwMSAxMDUuNzA1LDkwLjc5NyBDMTA1LjY4NCw5MC43ODMgMTA1LjY2NSw5MC44MTEgMTA1LjY1LDkwLjc5IEMxMDQuNzU2LDg5LjU0NiAxMDQuMjgzLDg3Ljg0MiAxMDQuMjgzLDg1LjgxNyBDMTA0LjI4Myw3OS41NzUgMTA4LjcwOSw3MS45NTMgMTE0LjE0OCw2OC44MTIgQzExNS43MjIsNjcuOTA0IDExNy4yMzIsNjcuNDQ5IDExOC42MzgsNjcuNDQ5IEMxMTkuNzgsNjcuNDQ5IDEyMC43OTYsNjcuNzU4IDEyMS42NTYsNjguMzYyIEMxMjEuNjc4LDY4LjM3NyAxMjEuNjk3LDY4LjM5NyAxMjEuNzEyLDY4LjQxOCBDMTIyLjYwNiw2OS42NjIgMTIzLjA3OSw3MS4zOSAxMjMuMDc5LDczLjQxNSBDMTIzLjA3OSw3OS42NTggMTE4LjY1Myw4Ny4xOTggMTEzLjIxNCw5MC4zMzggQzExMS42NCw5MS4yNDcgMTEwLjEzLDkxLjYxNCAxMDguNzI0LDkxLjYxNCBMMTA4LjcyNCw5MS42MTQgWiBNMTA2LjAwNiw5MC41MDUgQzEwNi43OCw5MS4wMzcgMTA3LjY5NCw5MS4yODEgMTA4LjcyNCw5MS4yODEgQzExMC4wNDcsOTEuMjgxIDExMS40NzgsOTAuODY4IDExMi45OCw5MC4wMDEgQzExOC4yOTEsODYuOTM1IDEyMi42MTEsNzkuNDk2IDEyMi42MTEsNzMuNDAzIEMxMjIuNjExLDcxLjQ5NCAxMjIuMTc3LDY5Ljg4IDEyMS4zNTYsNjguNzE4IEMxMjAuNTgyLDY4LjE4NSAxMTkuNjY4LDY3LjkxOSAxMTguNjM4LDY3LjkxOSBDMTE3LjMxNSw2Ny45MTkgMTE1Ljg4Myw2OC4zNiAxMTQuMzgyLDY5LjIyNyBDMTA5LjA3MSw3Mi4yOTMgMTA0Ljc1MSw3OS43MzMgMTA0Ljc1MSw4NS44MjYgQzEwNC43NTEsODcuNzM1IDEwNS4xODUsODkuMzQzIDEwNi4wMDYsOTAuNTA1IEwxMDYuMDA2LDkwLjUwNSBaIiBpZD0iRmlsbC0yMSIgZmlsbD0iIzYwN0Q4QiI+PC9wYXRoPgogICAgICAgICAgICAgICAgICAgIDxwYXRoIGQ9Ik0xNDkuMzE4LDcuMjYyIEwxMzkuMzM0LDE2LjE0IEwxNTUuMjI3LDI3LjE3MSBMMTYwLjgxNiwyMS4wNTkgTDE0OS4zMTgsNy4yNjIiIGlkPSJGaWxsLTIyIiBmaWxsPSIjRkFGQUZBIj48L3BhdGg+CiAgICAgICAgICAgICAgICAgICAgPHBhdGggZD0iTTE2OS42NzYsMTMuODQgTDE1OS45MjgsMTkuNDY3IEMxNTYuMjg2LDIxLjU3IDE1MC40LDIxLjU4IDE0Ni43ODEsMTkuNDkxIEMxNDMuMTYxLDE3LjQwMiAxNDMuMTgsMTQuMDAzIDE0Ni44MjIsMTEuOSBMMTU2LjMxNyw2LjI5MiBMMTQ5LjU4OCwyLjQwNyBMNjcuNzUyLDQ5LjQ3OCBMMTEzLjY3NSw3NS45OTIgTDExNi43NTYsNzQuMjEzIEMxMTcuMzg3LDczLjg0OCAxMTcuNjI1LDczLjMxNSAxMTcuMzc0LDcyLjgyMyBDMTE1LjAxNyw2OC4xOTEgMTE0Ljc4MSw2My4yNzcgMTE2LjY5MSw1OC41NjEgQzEyMi4zMjksNDQuNjQxIDE0MS4yLDMzLjc0NiAxNjUuMzA5LDMwLjQ5MSBDMTczLjQ3OCwyOS4zODggMTgxLjk4OSwyOS41MjQgMTkwLjAxMywzMC44ODUgQzE5MC44NjUsMzEuMDMgMTkxLjc4OSwzMC44OTMgMTkyLjQyLDMwLjUyOCBMMTk1LjUwMSwyOC43NSBMMTY5LjY3NiwxMy44NCIgaWQ9IkZpbGwtMjMiIGZpbGw9IiNGQUZBRkEiPjwvcGF0aD4KICAgICAgICAgICAgICAgICAgICA8cGF0aCBkPSJNMTEzLjY3NSw3Ni40NTkgQzExMy41OTQsNzYuNDU5IDExMy41MTQsNzYuNDM4IDExMy40NDIsNzYuMzk3IEw2Ny41MTgsNDkuODgyIEM2Ny4zNzQsNDkuNzk5IDY3LjI4NCw0OS42NDUgNjcuMjg1LDQ5LjQ3OCBDNjcuMjg1LDQ5LjMxMSA2Ny4zNzQsNDkuMTU3IDY3LjUxOSw0OS4wNzMgTDE0OS4zNTUsMi4wMDIgQzE0OS40OTksMS45MTkgMTQ5LjY3NywxLjkxOSAxNDkuODIxLDIuMDAyIEwxNTYuNTUsNS44ODcgQzE1Ni43NzQsNi4wMTcgMTU2Ljg1LDYuMzAyIDE1Ni43MjIsNi41MjYgQzE1Ni41OTIsNi43NDkgMTU2LjMwNyw2LjgyNiAxNTYuMDgzLDYuNjk2IEwxNDkuNTg3LDIuOTQ2IEw2OC42ODcsNDkuNDc5IEwxMTMuNjc1LDc1LjQ1MiBMMTE2LjUyMyw3My44MDggQzExNi43MTUsNzMuNjk3IDExNy4xNDMsNzMuMzk5IDExNi45NTgsNzMuMDM1IEMxMTQuNTQyLDY4LjI4NyAxMTQuMyw2My4yMjEgMTE2LjI1OCw1OC4zODUgQzExOS4wNjQsNTEuNDU4IDEyNS4xNDMsNDUuMTQzIDEzMy44NCw0MC4xMjIgQzE0Mi40OTcsMzUuMTI0IDE1My4zNTgsMzEuNjMzIDE2NS4yNDcsMzAuMDI4IEMxNzMuNDQ1LDI4LjkyMSAxODIuMDM3LDI5LjA1OCAxOTAuMDkxLDMwLjQyNSBDMTkwLjgzLDMwLjU1IDE5MS42NTIsMzAuNDMyIDE5Mi4xODYsMzAuMTI0IEwxOTQuNTY3LDI4Ljc1IEwxNjkuNDQyLDE0LjI0NCBDMTY5LjIxOSwxNC4xMTUgMTY5LjE0MiwxMy44MjkgMTY5LjI3MSwxMy42MDYgQzE2OS40LDEzLjM4MiAxNjkuNjg1LDEzLjMwNiAxNjkuOTA5LDEzLjQzNSBMMTk1LjczNCwyOC4zNDUgQzE5NS44NzksMjguNDI4IDE5NS45NjgsMjguNTgzIDE5NS45NjgsMjguNzUgQzE5NS45NjgsMjguOTE2IDE5NS44NzksMjkuMDcxIDE5NS43MzQsMjkuMTU0IEwxOTIuNjUzLDMwLjkzMyBDMTkxLjkzMiwzMS4zNSAxOTAuODksMzEuNTA4IDE4OS45MzUsMzEuMzQ2IEMxODEuOTcyLDI5Ljk5NSAxNzMuNDc4LDI5Ljg2IDE2NS4zNzIsMzAuOTU0IEMxNTMuNjAyLDMyLjU0MyAxNDIuODYsMzUuOTkzIDEzNC4zMDcsNDAuOTMxIEMxMjUuNzkzLDQ1Ljg0NyAxMTkuODUxLDUyLjAwNCAxMTcuMTI0LDU4LjczNiBDMTE1LjI3LDYzLjMxNCAxMTUuNTAxLDY4LjExMiAxMTcuNzksNzIuNjExIEMxMTguMTYsNzMuMzM2IDExNy44NDUsNzQuMTI0IDExNi45OSw3NC42MTcgTDExMy45MDksNzYuMzk3IEMxMTMuODM2LDc2LjQzOCAxMTMuNzU2LDc2LjQ1OSAxMTMuNjc1LDc2LjQ1OSIgaWQ9IkZpbGwtMjQiIGZpbGw9IiM0NTVBNjQiPjwvcGF0aD4KICAgICAgICAgICAgICAgICAgICA8cGF0aCBkPSJNMTUzLjMxNiwyMS4yNzkgQzE1MC45MDMsMjEuMjc5IDE0OC40OTUsMjAuNzUxIDE0Ni42NjQsMTkuNjkzIEMxNDQuODQ2LDE4LjY0NCAxNDMuODQ0LDE3LjIzMiAxNDMuODQ0LDE1LjcxOCBDMTQzLjg0NCwxNC4xOTEgMTQ0Ljg2LDEyLjc2MyAxNDYuNzA1LDExLjY5OCBMMTU2LjE5OCw2LjA5MSBDMTU2LjMwOSw2LjAyNSAxNTYuNDUyLDYuMDYyIDE1Ni41MTgsNi4xNzMgQzE1Ni41ODMsNi4yODQgMTU2LjU0Nyw2LjQyNyAxNTYuNDM2LDYuNDkzIEwxNDYuOTQsMTIuMTAyIEMxNDUuMjQ0LDEzLjA4MSAxNDQuMzEyLDE0LjM2NSAxNDQuMzEyLDE1LjcxOCBDMTQ0LjMxMiwxNy4wNTggMTQ1LjIzLDE4LjMyNiAxNDYuODk3LDE5LjI4OSBDMTUwLjQ0NiwyMS4zMzggMTU2LjI0LDIxLjMyNyAxNTkuODExLDE5LjI2NSBMMTY5LjU1OSwxMy42MzcgQzE2OS42NywxMy41NzMgMTY5LjgxMywxMy42MTEgMTY5Ljg3OCwxMy43MjMgQzE2OS45NDMsMTMuODM0IDE2OS45MDQsMTMuOTc3IDE2OS43OTMsMTQuMDQyIEwxNjAuMDQ1LDE5LjY3IEMxNTguMTg3LDIwLjc0MiAxNTUuNzQ5LDIxLjI3OSAxNTMuMzE2LDIxLjI3OSIgaWQ9IkZpbGwtMjUiIGZpbGw9IiM2MDdEOEIiPjwvcGF0aD4KICAgICAgICAgICAgICAgICAgICA8cGF0aCBkPSJNMTEzLjY3NSw3NS45OTIgTDY3Ljc2Miw0OS40ODQiIGlkPSJGaWxsLTI2IiBmaWxsPSIjNDU1QTY0Ij48L3BhdGg+CiAgICAgICAgICAgICAgICAgICAgPHBhdGggZD0iTTExMy42NzUsNzYuMzQyIEMxMTMuNjE1LDc2LjM0MiAxMTMuNTU1LDc2LjMyNyAxMTMuNSw3Ni4yOTUgTDY3LjU4Nyw0OS43ODcgQzY3LjQxOSw0OS42OSA2Ny4zNjIsNDkuNDc2IDY3LjQ1OSw0OS4zMDkgQzY3LjU1Niw0OS4xNDEgNjcuNzcsNDkuMDgzIDY3LjkzNyw0OS4xOCBMMTEzLjg1LDc1LjY4OCBDMTE0LjAxOCw3NS43ODUgMTE0LjA3NSw3NiAxMTMuOTc4LDc2LjE2NyBDMTEzLjkxNCw3Ni4yNzkgMTEzLjc5Niw3Ni4zNDIgMTEzLjY3NSw3Ni4zNDIiIGlkPSJGaWxsLTI3IiBmaWxsPSIjNDU1QTY0Ij48L3BhdGg+CiAgICAgICAgICAgICAgICAgICAgPHBhdGggZD0iTTY3Ljc2Miw0OS40ODQgTDY3Ljc2MiwxMDMuNDg1IEM2Ny43NjIsMTA0LjU3NSA2OC41MzIsMTA1LjkwMyA2OS40ODIsMTA2LjQ1MiBMMTExLjk1NSwxMzAuOTczIEMxMTIuOTA1LDEzMS41MjIgMTEzLjY3NSwxMzEuMDgzIDExMy42NzUsMTI5Ljk5MyBMMTEzLjY3NSw3NS45OTIiIGlkPSJGaWxsLTI4IiBmaWxsPSIjRkFGQUZBIj48L3BhdGg+CiAgICAgICAgICAgICAgICAgICAgPHBhdGggZD0iTTExMi43MjcsMTMxLjU2MSBDMTEyLjQzLDEzMS41NjEgMTEyLjEwNywxMzEuNDY2IDExMS43OCwxMzEuMjc2IEw2OS4zMDcsMTA2Ljc1NSBDNjguMjQ0LDEwNi4xNDIgNjcuNDEyLDEwNC43MDUgNjcuNDEyLDEwMy40ODUgTDY3LjQxMiw0OS40ODQgQzY3LjQxMiw0OS4yOSA2Ny41NjksNDkuMTM0IDY3Ljc2Miw0OS4xMzQgQzY3Ljk1Niw0OS4xMzQgNjguMTEzLDQ5LjI5IDY4LjExMyw0OS40ODQgTDY4LjExMywxMDMuNDg1IEM2OC4xMTMsMTA0LjQ0NSA2OC44MiwxMDUuNjY1IDY5LjY1NywxMDYuMTQ4IEwxMTIuMTMsMTMwLjY3IEMxMTIuNDc0LDEzMC44NjggMTEyLjc5MSwxMzAuOTEzIDExMywxMzAuNzkyIEMxMTMuMjA2LDEzMC42NzMgMTEzLjMyNSwxMzAuMzgxIDExMy4zMjUsMTI5Ljk5MyBMMTEzLjMyNSw3NS45OTIgQzExMy4zMjUsNzUuNzk4IDExMy40ODIsNzUuNjQxIDExMy42NzUsNzUuNjQxIEMxMTMuODY5LDc1LjY0MSAxMTQuMDI1LDc1Ljc5OCAxMTQuMDI1LDc1Ljk5MiBMMTE0LjAyNSwxMjkuOTkzIEMxMTQuMDI1LDEzMC42NDggMTEzLjc4NiwxMzEuMTQ3IDExMy4zNSwxMzEuMzk5IEMxMTMuMTYyLDEzMS41MDcgMTEyLjk1MiwxMzEuNTYxIDExMi43MjcsMTMxLjU2MSIgaWQ9IkZpbGwtMjkiIGZpbGw9IiM0NTVBNjQiPjwvcGF0aD4KICAgICAgICAgICAgICAgICAgICA8cGF0aCBkPSJNMTEyLjg2LDQwLjUxMiBDMTEyLjg2LDQwLjUxMiAxMTIuODYsNDAuNTEyIDExMi44NTksNDAuNTEyIEMxMTAuNTQxLDQwLjUxMiAxMDguMzYsMzkuOTkgMTA2LjcxNywzOS4wNDEgQzEwNS4wMTIsMzguMDU3IDEwNC4wNzQsMzYuNzI2IDEwNC4wNzQsMzUuMjkyIEMxMDQuMDc0LDMzLjg0NyAxMDUuMDI2LDMyLjUwMSAxMDYuNzU0LDMxLjUwNCBMMTE4Ljc5NSwyNC41NTEgQzEyMC40NjMsMjMuNTg5IDEyMi42NjksMjMuMDU4IDEyNS4wMDcsMjMuMDU4IEMxMjcuMzI1LDIzLjA1OCAxMjkuNTA2LDIzLjU4MSAxMzEuMTUsMjQuNTMgQzEzMi44NTQsMjUuNTE0IDEzMy43OTMsMjYuODQ1IDEzMy43OTMsMjguMjc4IEMxMzMuNzkzLDI5LjcyNCAxMzIuODQxLDMxLjA2OSAxMzEuMTEzLDMyLjA2NyBMMTE5LjA3MSwzOS4wMTkgQzExNy40MDMsMzkuOTgyIDExNS4xOTcsNDAuNTEyIDExMi44Niw0MC41MTIgTDExMi44Niw0MC41MTIgWiBNMTI1LjAwNywyMy43NTkgQzEyMi43OSwyMy43NTkgMTIwLjcwOSwyNC4yNTYgMTE5LjE0NiwyNS4xNTggTDEwNy4xMDQsMzIuMTEgQzEwNS42MDIsMzIuOTc4IDEwNC43NzQsMzQuMTA4IDEwNC43NzQsMzUuMjkyIEMxMDQuNzc0LDM2LjQ2NSAxMDUuNTg5LDM3LjU4MSAxMDcuMDY3LDM4LjQzNCBDMTA4LjYwNSwzOS4zMjMgMTEwLjY2MywzOS44MTIgMTEyLjg1OSwzOS44MTIgTDExMi44NiwzOS44MTIgQzExNS4wNzYsMzkuODEyIDExNy4xNTgsMzkuMzE1IDExOC43MjEsMzguNDEzIEwxMzAuNzYyLDMxLjQ2IEMxMzIuMjY0LDMwLjU5MyAxMzMuMDkyLDI5LjQ2MyAxMzMuMDkyLDI4LjI3OCBDMTMzLjA5MiwyNy4xMDYgMTMyLjI3OCwyNS45OSAxMzAuOCwyNS4xMzYgQzEyOS4yNjEsMjQuMjQ4IDEyNy4yMDQsMjMuNzU5IDEyNS4wMDcsMjMuNzU5IEwxMjUuMDA3LDIzLjc1OSBaIiBpZD0iRmlsbC0zMCIgZmlsbD0iIzYwN0Q4QiI+PC9wYXRoPgogICAgICAgICAgICAgICAgICAgIDxwYXRoIGQ9Ik0xNjUuNjMsMTYuMjE5IEwxNTkuODk2LDE5LjUzIEMxNTYuNzI5LDIxLjM1OCAxNTEuNjEsMjEuMzY3IDE0OC40NjMsMTkuNTUgQzE0NS4zMTYsMTcuNzMzIDE0NS4zMzIsMTQuNzc4IDE0OC40OTksMTIuOTQ5IEwxNTQuMjMzLDkuNjM5IEwxNjUuNjMsMTYuMjE5IiBpZD0iRmlsbC0zMSIgZmlsbD0iI0ZBRkFGQSI+PC9wYXRoPgogICAgICAgICAgICAgICAgICAgIDxwYXRoIGQ9Ik0xNTQuMjMzLDEwLjQ0OCBMMTY0LjIyOCwxNi4yMTkgTDE1OS41NDYsMTguOTIzIEMxNTguMTEyLDE5Ljc1IDE1Ni4xOTQsMjAuMjA2IDE1NC4xNDcsMjAuMjA2IEMxNTIuMTE4LDIwLjIwNiAxNTAuMjI0LDE5Ljc1NyAxNDguODE0LDE4Ljk0MyBDMTQ3LjUyNCwxOC4xOTkgMTQ2LjgxNCwxNy4yNDkgMTQ2LjgxNCwxNi4yNjkgQzE0Ni44MTQsMTUuMjc4IDE0Ny41MzcsMTQuMzE0IDE0OC44NSwxMy41NTYgTDE1NC4yMzMsMTAuNDQ4IE0xNTQuMjMzLDkuNjM5IEwxNDguNDk5LDEyLjk0OSBDMTQ1LjMzMiwxNC43NzggMTQ1LjMxNiwxNy43MzMgMTQ4LjQ2MywxOS41NSBDMTUwLjAzMSwyMC40NTUgMTUyLjA4NiwyMC45MDcgMTU0LjE0NywyMC45MDcgQzE1Ni4yMjQsMjAuOTA3IDE1OC4zMDYsMjAuNDQ3IDE1OS44OTYsMTkuNTMgTDE2NS42MywxNi4yMTkgTDE1NC4yMzMsOS42MzkiIGlkPSJGaWxsLTMyIiBmaWxsPSIjNjA3RDhCIj48L3BhdGg+CiAgICAgICAgICAgICAgICAgICAgPHBhdGggZD0iTTE0NS40NDUsNzIuNjY3IEwxNDUuNDQ1LDcyLjY2NyBDMTQzLjY3Miw3Mi42NjcgMTQyLjIwNCw3MS44MTcgMTQxLjIwMiw3MC40MjIgQzE0MS4xMzUsNzAuMzMgMTQxLjE0NSw3MC4xNDcgMTQxLjIyNSw3MC4wNjYgQzE0MS4zMDUsNjkuOTg1IDE0MS40MzIsNjkuOTQ2IDE0MS41MjUsNzAuMDExIEMxNDIuMzA2LDcwLjU1OSAxNDMuMjMxLDcwLjgyMyAxNDQuMjc2LDcwLjgyMiBDMTQ1LjU5OCw3MC44MjIgMTQ3LjAzLDcwLjM3NiAxNDguNTMyLDY5LjUwOSBDMTUzLjg0Miw2Ni40NDMgMTU4LjE2Myw1OC45ODcgMTU4LjE2Myw1Mi44OTQgQzE1OC4xNjMsNTAuOTY3IDE1Ny43MjEsNDkuMzMyIDE1Ni44ODQsNDguMTY4IEMxNTYuODE4LDQ4LjA3NiAxNTYuODI4LDQ3Ljk0OCAxNTYuOTA4LDQ3Ljg2NyBDMTU2Ljk4OCw0Ny43ODYgMTU3LjExNCw0Ny43NzQgMTU3LjIwOCw0Ny44NCBDMTU4Ljg3OCw0OS4wMTIgMTU5Ljc5OCw1MS4yMiAxNTkuNzk4LDU0LjA1OSBDMTU5Ljc5OCw2MC4zMDEgMTU1LjM3Myw2OC4wNDYgMTQ5LjkzMyw3MS4xODYgQzE0OC4zNiw3Mi4wOTQgMTQ2Ljg1LDcyLjY2NyAxNDUuNDQ1LDcyLjY2NyBMMTQ1LjQ0NSw3Mi42NjcgWiBNMTQyLjQ3Niw3MSBDMTQzLjI5LDcxLjY1MSAxNDQuMjk2LDcyLjAwMiAxNDUuNDQ1LDcyLjAwMiBDMTQ2Ljc2Nyw3Mi4wMDIgMTQ4LjE5OCw3MS41NSAxNDkuNyw3MC42ODIgQzE1NS4wMSw2Ny42MTcgMTU5LjMzMSw2MC4xNTkgMTU5LjMzMSw1NC4wNjUgQzE1OS4zMzEsNTIuMDg1IDE1OC44NjgsNTAuNDM1IDE1OC4wMDYsNDkuMjcyIEMxNTguNDE3LDUwLjMwNyAxNTguNjMsNTEuNTMyIDE1OC42Myw1Mi44OTIgQzE1OC42Myw1OS4xMzQgMTU0LjIwNSw2Ni43NjcgMTQ4Ljc2NSw2OS45MDcgQzE0Ny4xOTIsNzAuODE2IDE0NS42ODEsNzEuMjgzIDE0NC4yNzYsNzEuMjgzIEMxNDMuNjM0LDcxLjI4MyAxNDMuMDMzLDcxLjE5MiAxNDIuNDc2LDcxIEwxNDIuNDc2LDcxIFoiIGlkPSJGaWxsLTMzIiBmaWxsPSIjNjA3RDhCIj48L3BhdGg+CiAgICAgICAgICAgICAgICAgICAgPHBhdGggZD0iTTE0OC42NDgsNjkuNzA0IEMxNTQuMDMyLDY2LjU5NiAxNTguMzk2LDU5LjA2OCAxNTguMzk2LDUyLjg5MSBDMTU4LjM5Niw1MC44MzkgMTU3LjkxMyw0OS4xOTggMTU3LjA3NCw0OC4wMyBDMTU1LjI4OSw0Ni43NzggMTUyLjY5OSw0Ni44MzYgMTQ5LjgxNiw0OC41MDEgQzE0NC40MzMsNTEuNjA5IDE0MC4wNjgsNTkuMTM3IDE0MC4wNjgsNjUuMzE0IEMxNDAuMDY4LDY3LjM2NSAxNDAuNTUyLDY5LjAwNiAxNDEuMzkxLDcwLjE3NCBDMTQzLjE3Niw3MS40MjcgMTQ1Ljc2NSw3MS4zNjkgMTQ4LjY0OCw2OS43MDQiIGlkPSJGaWxsLTM0IiBmaWxsPSIjRkFGQUZBIj48L3BhdGg+CiAgICAgICAgICAgICAgICAgICAgPHBhdGggZD0iTTE0NC4yNzYsNzEuMjc2IEwxNDQuMjc2LDcxLjI3NiBDMTQzLjEzMyw3MS4yNzYgMTQyLjExOCw3MC45NjkgMTQxLjI1Nyw3MC4zNjUgQzE0MS4yMzYsNzAuMzUxIDE0MS4yMTcsNzAuMzMyIDE0MS4yMDIsNzAuMzExIEMxNDAuMzA3LDY5LjA2NyAxMzkuODM1LDY3LjMzOSAxMzkuODM1LDY1LjMxNCBDMTM5LjgzNSw1OS4wNzMgMTQ0LjI2LDUxLjQzOSAxNDkuNyw0OC4yOTggQzE1MS4yNzMsNDcuMzkgMTUyLjc4NCw0Ni45MjkgMTU0LjE4OSw0Ni45MjkgQzE1NS4zMzIsNDYuOTI5IDE1Ni4zNDcsNDcuMjM2IDE1Ny4yMDgsNDcuODM5IEMxNTcuMjI5LDQ3Ljg1NCAxNTcuMjQ4LDQ3Ljg3MyAxNTcuMjYzLDQ3Ljg5NCBDMTU4LjE1Nyw0OS4xMzggMTU4LjYzLDUwLjg2NSAxNTguNjMsNTIuODkxIEMxNTguNjMsNTkuMTMyIDE1NC4yMDUsNjYuNzY2IDE0OC43NjUsNjkuOTA3IEMxNDcuMTkyLDcwLjgxNSAxNDUuNjgxLDcxLjI3NiAxNDQuMjc2LDcxLjI3NiBMMTQ0LjI3Niw3MS4yNzYgWiBNMTQxLjU1OCw3MC4xMDQgQzE0Mi4zMzEsNzAuNjM3IDE0My4yNDUsNzEuMDA1IDE0NC4yNzYsNzEuMDA1IEMxNDUuNTk4LDcxLjAwNSAxNDcuMDMsNzAuNDY3IDE0OC41MzIsNjkuNiBDMTUzLjg0Miw2Ni41MzQgMTU4LjE2Myw1OS4wMzMgMTU4LjE2Myw1Mi45MzkgQzE1OC4xNjMsNTEuMDMxIDE1Ny43MjksNDkuMzg1IDE1Ni45MDcsNDguMjIzIEMxNTYuMTMzLDQ3LjY5MSAxNTUuMjE5LDQ3LjQwOSAxNTQuMTg5LDQ3LjQwOSBDMTUyLjg2Nyw0Ny40MDkgMTUxLjQzNSw0Ny44NDIgMTQ5LjkzMyw0OC43MDkgQzE0NC42MjMsNTEuNzc1IDE0MC4zMDIsNTkuMjczIDE0MC4zMDIsNjUuMzY2IEMxNDAuMzAyLDY3LjI3NiAxNDAuNzM2LDY4Ljk0MiAxNDEuNTU4LDcwLjEwNCBMMTQxLjU1OCw3MC4xMDQgWiIgaWQ9IkZpbGwtMzUiIGZpbGw9IiM2MDdEOEIiPjwvcGF0aD4KICAgICAgICAgICAgICAgICAgICA8cGF0aCBkPSJNMTUwLjcyLDY1LjM2MSBMMTUwLjM1Nyw2NS4wNjYgQzE1MS4xNDcsNjQuMDkyIDE1MS44NjksNjMuMDQgMTUyLjUwNSw2MS45MzggQzE1My4zMTMsNjAuNTM5IDE1My45NzgsNTkuMDY3IDE1NC40ODIsNTcuNTYzIEwxNTQuOTI1LDU3LjcxMiBDMTU0LjQxMiw1OS4yNDUgMTUzLjczMyw2MC43NDUgMTUyLjkxLDYyLjE3MiBDMTUyLjI2Miw2My4yOTUgMTUxLjUyNSw2NC4zNjggMTUwLjcyLDY1LjM2MSIgaWQ9IkZpbGwtMzYiIGZpbGw9IiM2MDdEOEIiPjwvcGF0aD4KICAgICAgICAgICAgICAgICAgICA8cGF0aCBkPSJNMTE1LjkxNyw4NC41MTQgTDExNS41NTQsODQuMjIgQzExNi4zNDQsODMuMjQ1IDExNy4wNjYsODIuMTk0IDExNy43MDIsODEuMDkyIEMxMTguNTEsNzkuNjkyIDExOS4xNzUsNzguMjIgMTE5LjY3OCw3Ni43MTcgTDEyMC4xMjEsNzYuODY1IEMxMTkuNjA4LDc4LjM5OCAxMTguOTMsNzkuODk5IDExOC4xMDYsODEuMzI2IEMxMTcuNDU4LDgyLjQ0OCAxMTYuNzIyLDgzLjUyMSAxMTUuOTE3LDg0LjUxNCIgaWQ9IkZpbGwtMzciIGZpbGw9IiM2MDdEOEIiPjwvcGF0aD4KICAgICAgICAgICAgICAgICAgICA8cGF0aCBkPSJNMTE0LDEzMC40NzYgTDExNCwxMzAuMDA4IEwxMTQsNzYuMDUyIEwxMTQsNzUuNTg0IEwxMTQsNzYuMDUyIEwxMTQsMTMwLjAwOCBMMTE0LDEzMC40NzYiIGlkPSJGaWxsLTM4IiBmaWxsPSIjNjA3RDhCIj48L3BhdGg+CiAgICAgICAgICAgICAgICA8L2c+CiAgICAgICAgICAgICAgICA8ZyBpZD0iSW1wb3J0ZWQtTGF5ZXJzLUNvcHkiIHRyYW5zZm9ybT0idHJhbnNsYXRlKDYyLjAwMDAwMCwgMC4wMDAwMDApIiBza2V0Y2g6dHlwZT0iTVNTaGFwZUdyb3VwIj4KICAgICAgICAgICAgICAgICAgICA8cGF0aCBkPSJNMTkuODIyLDM3LjQ3NCBDMTkuODM5LDM3LjMzOSAxOS43NDcsMzcuMTk0IDE5LjU1NSwzNy4wODIgQzE5LjIyOCwzNi44OTQgMTguNzI5LDM2Ljg3MiAxOC40NDYsMzcuMDM3IEwxMi40MzQsNDAuNTA4IEMxMi4zMDMsNDAuNTg0IDEyLjI0LDQwLjY4NiAxMi4yNDMsNDAuNzkzIEMxMi4yNDUsNDAuOTI1IDEyLjI0NSw0MS4yNTQgMTIuMjQ1LDQxLjM3MSBMMTIuMjQ1LDQxLjQxNCBMMTIuMjM4LDQxLjU0MiBDOC4xNDgsNDMuODg3IDUuNjQ3LDQ1LjMyMSA1LjY0Nyw0NS4zMjEgQzUuNjQ2LDQ1LjMyMSAzLjU3LDQ2LjM2NyAyLjg2LDUwLjUxMyBDMi44Niw1MC41MTMgMS45NDgsNTcuNDc0IDEuOTYyLDcwLjI1OCBDMS45NzcsODIuODI4IDIuNTY4LDg3LjMyOCAzLjEyOSw5MS42MDkgQzMuMzQ5LDkzLjI5MyA2LjEzLDkzLjczNCA2LjEzLDkzLjczNCBDNi40NjEsOTMuNzc0IDYuODI4LDkzLjcwNyA3LjIxLDkzLjQ4NiBMODIuNDgzLDQ5LjkzNSBDODQuMjkxLDQ4Ljg2NiA4NS4xNSw0Ni4yMTYgODUuNTM5LDQzLjY1MSBDODYuNzUyLDM1LjY2MSA4Ny4yMTQsMTAuNjczIDg1LjI2NCwzLjc3MyBDODUuMDY4LDMuMDggODQuNzU0LDIuNjkgODQuMzk2LDIuNDkxIEw4Mi4zMSwxLjcwMSBDODEuNTgzLDEuNzI5IDgwLjg5NCwyLjE2OCA4MC43NzYsMi4yMzYgQzgwLjYzNiwyLjMxNyA0MS44MDcsMjQuNTg1IDIwLjAzMiwzNy4wNzIgTDE5LjgyMiwzNy40NzQiIGlkPSJGaWxsLTEiIGZpbGw9IiNGRkZGRkYiPjwvcGF0aD4KICAgICAgICAgICAgICAgICAgICA8cGF0aCBkPSJNODIuMzExLDEuNzAxIEw4NC4zOTYsMi40OTEgQzg0Ljc1NCwyLjY5IDg1LjA2OCwzLjA4IDg1LjI2NCwzLjc3MyBDODcuMjEzLDEwLjY3MyA4Ni43NTEsMzUuNjYgODUuNTM5LDQzLjY1MSBDODUuMTQ5LDQ2LjIxNiA4NC4yOSw0OC44NjYgODIuNDgzLDQ5LjkzNSBMNy4yMSw5My40ODYgQzYuODk3LDkzLjY2NyA2LjU5NSw5My43NDQgNi4zMTQsOTMuNzQ0IEw2LjEzMSw5My43MzMgQzYuMTMxLDkzLjczNCAzLjM0OSw5My4yOTMgMy4xMjgsOTEuNjA5IEMyLjU2OCw4Ny4zMjcgMS45NzcsODIuODI4IDEuOTYzLDcwLjI1OCBDMS45NDgsNTcuNDc0IDIuODYsNTAuNTEzIDIuODYsNTAuNTEzIEMzLjU3LDQ2LjM2NyA1LjY0Nyw0NS4zMjEgNS42NDcsNDUuMzIxIEM1LjY0Nyw0NS4zMjEgOC4xNDgsNDMuODg3IDEyLjIzOCw0MS41NDIgTDEyLjI0NSw0MS40MTQgTDEyLjI0NSw0MS4zNzEgQzEyLjI0NSw0MS4yNTQgMTIuMjQ1LDQwLjkyNSAxMi4yNDMsNDAuNzkzIEMxMi4yNCw0MC42ODYgMTIuMzAyLDQwLjU4MyAxMi40MzQsNDAuNTA4IEwxOC40NDYsMzcuMDM2IEMxOC41NzQsMzYuOTYyIDE4Ljc0NiwzNi45MjYgMTguOTI3LDM2LjkyNiBDMTkuMTQ1LDM2LjkyNiAxOS4zNzYsMzYuOTc5IDE5LjU1NCwzNy4wODIgQzE5Ljc0NywzNy4xOTQgMTkuODM5LDM3LjM0IDE5LjgyMiwzNy40NzQgTDIwLjAzMywzNy4wNzIgQzQxLjgwNiwyNC41ODUgODAuNjM2LDIuMzE4IDgwLjc3NywyLjIzNiBDODAuODk0LDIuMTY4IDgxLjU4MywxLjcyOSA4Mi4zMTEsMS43MDEgTTgyLjMxMSwwLjcwNCBMODIuMjcyLDAuNzA1IEM4MS42NTQsMC43MjggODAuOTg5LDAuOTQ5IDgwLjI5OCwxLjM2MSBMODAuMjc3LDEuMzczIEM4MC4xMjksMS40NTggNTkuNzY4LDEzLjEzNSAxOS43NTgsMzYuMDc5IEMxOS41LDM1Ljk4MSAxOS4yMTQsMzUuOTI5IDE4LjkyNywzNS45MjkgQzE4LjU2MiwzNS45MjkgMTguMjIzLDM2LjAxMyAxNy45NDcsMzYuMTczIEwxMS45MzUsMzkuNjQ0IEMxMS40OTMsMzkuODk5IDExLjIzNiw0MC4zMzQgMTEuMjQ2LDQwLjgxIEwxMS4yNDcsNDAuOTYgTDUuMTY3LDQ0LjQ0NyBDNC43OTQsNDQuNjQ2IDIuNjI1LDQ1Ljk3OCAxLjg3Nyw1MC4zNDUgTDEuODcxLDUwLjM4NCBDMS44NjIsNTAuNDU0IDAuOTUxLDU3LjU1NyAwLjk2NSw3MC4yNTkgQzAuOTc5LDgyLjg3OSAxLjU2OCw4Ny4zNzUgMi4xMzcsOTEuNzI0IEwyLjEzOSw5MS43MzkgQzIuNDQ3LDk0LjA5NCA1LjYxNCw5NC42NjIgNS45NzUsOTQuNzE5IEw2LjAwOSw5NC43MjMgQzYuMTEsOTQuNzM2IDYuMjEzLDk0Ljc0MiA2LjMxNCw5NC43NDIgQzYuNzksOTQuNzQyIDcuMjYsOTQuNjEgNy43MSw5NC4zNSBMODIuOTgzLDUwLjc5OCBDODQuNzk0LDQ5LjcyNyA4NS45ODIsNDcuMzc1IDg2LjUyNSw0My44MDEgQzg3LjcxMSwzNS45ODcgODguMjU5LDEwLjcwNSA4Ni4yMjQsMy41MDIgQzg1Ljk3MSwyLjYwOSA4NS41MiwxLjk3NSA4NC44ODEsMS42MiBMODQuNzQ5LDEuNTU4IEw4Mi42NjQsMC43NjkgQzgyLjU1MSwwLjcyNSA4Mi40MzEsMC43MDQgODIuMzExLDAuNzA0IiBpZD0iRmlsbC0yIiBmaWxsPSIjNDU1QTY0Ij48L3BhdGg+CiAgICAgICAgICAgICAgICAgICAgPHBhdGggZD0iTTY2LjI2NywxMS41NjUgTDY3Ljc2MiwxMS45OTkgTDExLjQyMyw0NC4zMjUiIGlkPSJGaWxsLTMiIGZpbGw9IiNGRkZGRkYiPjwvcGF0aD4KICAgICAgICAgICAgICAgICAgICA8cGF0aCBkPSJNMTIuMjAyLDkwLjU0NSBDMTIuMDI5LDkwLjU0NSAxMS44NjIsOTAuNDU1IDExLjc2OSw5MC4yOTUgQzExLjYzMiw5MC4wNTcgMTEuNzEzLDg5Ljc1MiAxMS45NTIsODkuNjE0IEwzMC4zODksNzguOTY5IEMzMC42MjgsNzguODMxIDMwLjkzMyw3OC45MTMgMzEuMDcxLDc5LjE1MiBDMzEuMjA4LDc5LjM5IDMxLjEyNyw3OS42OTYgMzAuODg4LDc5LjgzMyBMMTIuNDUxLDkwLjQ3OCBMMTIuMjAyLDkwLjU0NSIgaWQ9IkZpbGwtNCIgZmlsbD0iIzYwN0Q4QiI+PC9wYXRoPgogICAgICAgICAgICAgICAgICAgIDxwYXRoIGQ9Ik0xMy43NjQsNDIuNjU0IEwxMy42NTYsNDIuNTkyIEwxMy43MDIsNDIuNDIxIEwxOC44MzcsMzkuNDU3IEwxOS4wMDcsMzkuNTAyIEwxOC45NjIsMzkuNjczIEwxMy44MjcsNDIuNjM3IEwxMy43NjQsNDIuNjU0IiBpZD0iRmlsbC01IiBmaWxsPSIjNjA3RDhCIj48L3BhdGg+CiAgICAgICAgICAgICAgICAgICAgPHBhdGggZD0iTTguNTIsOTAuMzc1IEw4LjUyLDQ2LjQyMSBMOC41ODMsNDYuMzg1IEw3NS44NCw3LjU1NCBMNzUuODQsNTEuNTA4IEw3NS43NzgsNTEuNTQ0IEw4LjUyLDkwLjM3NSBMOC41Miw5MC4zNzUgWiBNOC43Nyw0Ni41NjQgTDguNzcsODkuOTQ0IEw3NS41OTEsNTEuMzY1IEw3NS41OTEsNy45ODUgTDguNzcsNDYuNTY0IEw4Ljc3LDQ2LjU2NCBaIiBpZD0iRmlsbC02IiBmaWxsPSIjNjA3RDhCIj48L3BhdGg+CiAgICAgICAgICAgICAgICAgICAgPHBhdGggZD0iTTI0Ljk4Niw4My4xODIgQzI0Ljc1Niw4My4zMzEgMjQuMzc0LDgzLjU2NiAyNC4xMzcsODMuNzA1IEwxMi42MzIsOTAuNDA2IEMxMi4zOTUsOTAuNTQ1IDEyLjQyNiw5MC42NTggMTIuNyw5MC42NTggTDEzLjI2NSw5MC42NTggQzEzLjU0LDkwLjY1OCAxMy45NTgsOTAuNTQ1IDE0LjE5NSw5MC40MDYgTDI1LjcsODMuNzA1IEMyNS45MzcsODMuNTY2IDI2LjEyOCw4My40NTIgMjYuMTI1LDgzLjQ0OSBDMjYuMTIyLDgzLjQ0NyAyNi4xMTksODMuMjIgMjYuMTE5LDgyLjk0NiBDMjYuMTE5LDgyLjY3MiAyNS45MzEsODIuNTY5IDI1LjcwMSw4Mi43MTkgTDI0Ljk4Niw4My4xODIiIGlkPSJGaWxsLTciIGZpbGw9IiM2MDdEOEIiPjwvcGF0aD4KICAgICAgICAgICAgICAgICAgICA8cGF0aCBkPSJNMTMuMjY2LDkwLjc4MiBMMTIuNyw5MC43ODIgQzEyLjUsOTAuNzgyIDEyLjM4NCw5MC43MjYgMTIuMzU0LDkwLjYxNiBDMTIuMzI0LDkwLjUwNiAxMi4zOTcsOTAuMzk5IDEyLjU2OSw5MC4yOTkgTDI0LjA3NCw4My41OTcgQzI0LjMxLDgzLjQ1OSAyNC42ODksODMuMjI2IDI0LjkxOCw4My4wNzggTDI1LjYzMyw4Mi42MTQgQzI1LjcyMyw4Mi41NTUgMjUuODEzLDgyLjUyNSAyNS44OTksODIuNTI1IEMyNi4wNzEsODIuNTI1IDI2LjI0NCw4Mi42NTUgMjYuMjQ0LDgyLjk0NiBDMjYuMjQ0LDgzLjE2IDI2LjI0NSw4My4zMDkgMjYuMjQ3LDgzLjM4MyBMMjYuMjUzLDgzLjM4NyBMMjYuMjQ5LDgzLjQ1NiBDMjYuMjQ2LDgzLjUzMSAyNi4yNDYsODMuNTMxIDI1Ljc2Myw4My44MTIgTDE0LjI1OCw5MC41MTQgQzE0LDkwLjY2NSAxMy41NjQsOTAuNzgyIDEzLjI2Niw5MC43ODIgTDEzLjI2Niw5MC43ODIgWiBNMTIuNjY2LDkwLjUzMiBMMTIuNyw5MC41MzMgTDEzLjI2Niw5MC41MzMgQzEzLjUxOCw5MC41MzMgMTMuOTE1LDkwLjQyNSAxNC4xMzIsOTAuMjk5IEwyNS42MzcsODMuNTk3IEMyNS44MDUsODMuNDk5IDI1LjkzMSw4My40MjQgMjUuOTk4LDgzLjM4MyBDMjUuOTk0LDgzLjI5OSAyNS45OTQsODMuMTY1IDI1Ljk5NCw4Mi45NDYgTDI1Ljg5OSw4Mi43NzUgTDI1Ljc2OCw4Mi44MjQgTDI1LjA1NCw4My4yODcgQzI0LjgyMiw4My40MzcgMjQuNDM4LDgzLjY3MyAyNC4yLDgzLjgxMiBMMTIuNjk1LDkwLjUxNCBMMTIuNjY2LDkwLjUzMiBMMTIuNjY2LDkwLjUzMiBaIiBpZD0iRmlsbC04IiBmaWxsPSIjNjA3RDhCIj48L3BhdGg+CiAgICAgICAgICAgICAgICAgICAgPHBhdGggZD0iTTEzLjI2Niw4OS44NzEgTDEyLjcsODkuODcxIEMxMi41LDg5Ljg3MSAxMi4zODQsODkuODE1IDEyLjM1NCw4OS43MDUgQzEyLjMyNCw4OS41OTUgMTIuMzk3LDg5LjQ4OCAxMi41NjksODkuMzg4IEwyNC4wNzQsODIuNjg2IEMyNC4zMzIsODIuNTM1IDI0Ljc2OCw4Mi40MTggMjUuMDY3LDgyLjQxOCBMMjUuNjMyLDgyLjQxOCBDMjUuODMyLDgyLjQxOCAyNS45NDgsODIuNDc0IDI1Ljk3OCw4Mi41ODQgQzI2LjAwOCw4Mi42OTQgMjUuOTM1LDgyLjgwMSAyNS43NjMsODIuOTAxIEwxNC4yNTgsODkuNjAzIEMxNCw4OS43NTQgMTMuNTY0LDg5Ljg3MSAxMy4yNjYsODkuODcxIEwxMy4yNjYsODkuODcxIFogTTEyLjY2Niw4OS42MjEgTDEyLjcsODkuNjIyIEwxMy4yNjYsODkuNjIyIEMxMy41MTgsODkuNjIyIDEzLjkxNSw4OS41MTUgMTQuMTMyLDg5LjM4OCBMMjUuNjM3LDgyLjY4NiBMMjUuNjY3LDgyLjY2OCBMMjUuNjMyLDgyLjY2NyBMMjUuMDY3LDgyLjY2NyBDMjQuODE1LDgyLjY2NyAyNC40MTgsODIuNzc1IDI0LjIsODIuOTAxIEwxMi42OTUsODkuNjAzIEwxMi42NjYsODkuNjIxIEwxMi42NjYsODkuNjIxIFoiIGlkPSJGaWxsLTkiIGZpbGw9IiM2MDdEOEIiPjwvcGF0aD4KICAgICAgICAgICAgICAgICAgICA8cGF0aCBkPSJNMTIuMzcsOTAuODAxIEwxMi4zNyw4OS41NTQgTDEyLjM3LDkwLjgwMSIgaWQ9IkZpbGwtMTAiIGZpbGw9IiM2MDdEOEIiPjwvcGF0aD4KICAgICAgICAgICAgICAgICAgICA8cGF0aCBkPSJNNi4xMyw5My45MDEgQzUuMzc5LDkzLjgwOCA0LjgxNiw5My4xNjQgNC42OTEsOTIuNTI1IEMzLjg2LDg4LjI4NyAzLjU0LDgzLjc0MyAzLjUyNiw3MS4xNzMgQzMuNTExLDU4LjM4OSA0LjQyMyw1MS40MjggNC40MjMsNTEuNDI4IEM1LjEzNCw0Ny4yODIgNy4yMSw0Ni4yMzYgNy4yMSw0Ni4yMzYgQzcuMjEsNDYuMjM2IDgxLjY2NywzLjI1IDgyLjA2OSwzLjAxNyBDODIuMjkyLDIuODg4IDg0LjU1NiwxLjQzMyA4NS4yNjQsMy45NCBDODcuMjE0LDEwLjg0IDg2Ljc1MiwzNS44MjcgODUuNTM5LDQzLjgxOCBDODUuMTUsNDYuMzgzIDg0LjI5MSw0OS4wMzMgODIuNDgzLDUwLjEwMSBMNy4yMSw5My42NTMgQzYuODI4LDkzLjg3NCA2LjQ2MSw5My45NDEgNi4xMyw5My45MDEgQzYuMTMsOTMuOTAxIDMuMzQ5LDkzLjQ2IDMuMTI5LDkxLjc3NiBDMi41NjgsODcuNDk1IDEuOTc3LDgyLjk5NSAxLjk2Miw3MC40MjUgQzEuOTQ4LDU3LjY0MSAyLjg2LDUwLjY4IDIuODYsNTAuNjggQzMuNTcsNDYuNTM0IDUuNjQ3LDQ1LjQ4OSA1LjY0Nyw0NS40ODkgQzUuNjQ2LDQ1LjQ4OSA4LjA2NSw0NC4wOTIgMTIuMjQ1LDQxLjY3OSBMMTMuMTE2LDQxLjU2IEwxOS43MTUsMzcuNzMgTDE5Ljc2MSwzNy4yNjkgTDYuMTMsOTMuOTAxIiBpZD0iRmlsbC0xMSIgZmlsbD0iI0ZBRkFGQSI+PC9wYXRoPgogICAgICAgICAgICAgICAgICAgIDxwYXRoIGQ9Ik02LjMxNyw5NC4xNjEgTDYuMTAyLDk0LjE0OCBMNi4xMDEsOTQuMTQ4IEw1Ljg1Nyw5NC4xMDEgQzUuMTM4LDkzLjk0NSAzLjA4NSw5My4zNjUgMi44ODEsOTEuODA5IEMyLjMxMyw4Ny40NjkgMS43MjcsODIuOTk2IDEuNzEzLDcwLjQyNSBDMS42OTksNTcuNzcxIDIuNjA0LDUwLjcxOCAyLjYxMyw1MC42NDggQzMuMzM4LDQ2LjQxNyA1LjQ0NSw0NS4zMSA1LjUzNSw0NS4yNjYgTDEyLjE2Myw0MS40MzkgTDEzLjAzMyw0MS4zMiBMMTkuNDc5LDM3LjU3OCBMMTkuNTEzLDM3LjI0NCBDMTkuNTI2LDM3LjEwNyAxOS42NDcsMzcuMDA4IDE5Ljc4NiwzNy4wMjEgQzE5LjkyMiwzNy4wMzQgMjAuMDIzLDM3LjE1NiAyMC4wMDksMzcuMjkzIEwxOS45NSwzNy44ODIgTDEzLjE5OCw0MS44MDEgTDEyLjMyOCw0MS45MTkgTDUuNzcyLDQ1LjcwNCBDNS43NDEsNDUuNzIgMy43ODIsNDYuNzcyIDMuMTA2LDUwLjcyMiBDMy4wOTksNTAuNzgyIDIuMTk4LDU3LjgwOCAyLjIxMiw3MC40MjQgQzIuMjI2LDgyLjk2MyAyLjgwOSw4Ny40MiAzLjM3Myw5MS43MjkgQzMuNDY0LDkyLjQyIDQuMDYyLDkyLjg4MyA0LjY4Miw5My4xODEgQzQuNTY2LDkyLjk4NCA0LjQ4Niw5Mi43NzYgNC40NDYsOTIuNTcyIEMzLjY2NSw4OC41ODggMy4yOTEsODQuMzcgMy4yNzYsNzEuMTczIEMzLjI2Miw1OC41MiA0LjE2Nyw1MS40NjYgNC4xNzYsNTEuMzk2IEM0LjkwMSw0Ny4xNjUgNy4wMDgsNDYuMDU5IDcuMDk4LDQ2LjAxNCBDNy4wOTQsNDYuMDE1IDgxLjU0MiwzLjAzNCA4MS45NDQsMi44MDIgTDgxLjk3MiwyLjc4NSBDODIuODc2LDIuMjQ3IDgzLjY5MiwyLjA5NyA4NC4zMzIsMi4zNTIgQzg0Ljg4NywyLjU3MyA4NS4yODEsMy4wODUgODUuNTA0LDMuODcyIEM4Ny41MTgsMTEgODYuOTY0LDM2LjA5MSA4NS43ODUsNDMuODU1IEM4NS4yNzgsNDcuMTk2IDg0LjIxLDQ5LjM3IDgyLjYxLDUwLjMxNyBMNy4zMzUsOTMuODY5IEM2Ljk5OSw5NC4wNjMgNi42NTgsOTQuMTYxIDYuMzE3LDk0LjE2MSBMNi4zMTcsOTQuMTYxIFogTTYuMTcsOTMuNjU0IEM2LjQ2Myw5My42OSA2Ljc3NCw5My42MTcgNy4wODUsOTMuNDM3IEw4Mi4zNTgsNDkuODg2IEM4NC4xODEsNDguODA4IDg0Ljk2LDQ1Ljk3MSA4NS4yOTIsNDMuNzggQzg2LjQ2NiwzNi4wNDkgODcuMDIzLDExLjA4NSA4NS4wMjQsNC4wMDggQzg0Ljg0NiwzLjM3NyA4NC41NTEsMi45NzYgODQuMTQ4LDIuODE2IEM4My42NjQsMi42MjMgODIuOTgyLDIuNzY0IDgyLjIyNywzLjIxMyBMODIuMTkzLDMuMjM0IEM4MS43OTEsMy40NjYgNy4zMzUsNDYuNDUyIDcuMzM1LDQ2LjQ1MiBDNy4zMDQsNDYuNDY5IDUuMzQ2LDQ3LjUyMSA0LjY2OSw1MS40NzEgQzQuNjYyLDUxLjUzIDMuNzYxLDU4LjU1NiAzLjc3NSw3MS4xNzMgQzMuNzksODQuMzI4IDQuMTYxLDg4LjUyNCA0LjkzNiw5Mi40NzYgQzUuMDI2LDkyLjkzNyA1LjQxMiw5My40NTkgNS45NzMsOTMuNjE1IEM2LjA4Nyw5My42NCA2LjE1OCw5My42NTIgNi4xNjksOTMuNjU0IEw2LjE3LDkzLjY1NCBMNi4xNyw5My42NTQgWiIgaWQ9IkZpbGwtMTIiIGZpbGw9IiM0NTVBNjQiPjwvcGF0aD4KICAgICAgICAgICAgICAgICAgICA8cGF0aCBkPSJNNy4zMTcsNjguOTgyIEM3LjgwNiw2OC43MDEgOC4yMDIsNjguOTI2IDguMjAyLDY5LjQ4NyBDOC4yMDIsNzAuMDQ3IDcuODA2LDcwLjczIDcuMzE3LDcxLjAxMiBDNi44MjksNzEuMjk0IDYuNDMzLDcxLjA2OSA2LjQzMyw3MC41MDggQzYuNDMzLDY5Ljk0OCA2LjgyOSw2OS4yNjUgNy4zMTcsNjguOTgyIiBpZD0iRmlsbC0xMyIgZmlsbD0iI0ZGRkZGRiI+PC9wYXRoPgogICAgICAgICAgICAgICAgICAgIDxwYXRoIGQ9Ik02LjkyLDcxLjEzMyBDNi42MzEsNzEuMTMzIDYuNDMzLDcwLjkwNSA2LjQzMyw3MC41MDggQzYuNDMzLDY5Ljk0OCA2LjgyOSw2OS4yNjUgNy4zMTcsNjguOTgyIEM3LjQ2LDY4LjkgNy41OTUsNjguODYxIDcuNzE0LDY4Ljg2MSBDOC4wMDMsNjguODYxIDguMjAyLDY5LjA5IDguMjAyLDY5LjQ4NyBDOC4yMDIsNzAuMDQ3IDcuODA2LDcwLjczIDcuMzE3LDcxLjAxMiBDNy4xNzQsNzEuMDk0IDcuMDM5LDcxLjEzMyA2LjkyLDcxLjEzMyBNNy43MTQsNjguNjc0IEM3LjU1Nyw2OC42NzQgNy4zOTIsNjguNzIzIDcuMjI0LDY4LjgyMSBDNi42NzYsNjkuMTM4IDYuMjQ2LDY5Ljg3OSA2LjI0Niw3MC41MDggQzYuMjQ2LDcwLjk5NCA2LjUxNyw3MS4zMiA2LjkyLDcxLjMyIEM3LjA3OCw3MS4zMiA3LjI0Myw3MS4yNzEgNy40MTEsNzEuMTc0IEM3Ljk1OSw3MC44NTcgOC4zODksNzAuMTE3IDguMzg5LDY5LjQ4NyBDOC4zODksNjkuMDAxIDguMTE3LDY4LjY3NCA3LjcxNCw2OC42NzQiIGlkPSJGaWxsLTE0IiBmaWxsPSIjODA5N0EyIj48L3BhdGg+CiAgICAgICAgICAgICAgICAgICAgPHBhdGggZD0iTTYuOTIsNzAuOTQ3IEM2LjY0OSw3MC45NDcgNi42MjEsNzAuNjQgNi42MjEsNzAuNTA4IEM2LjYyMSw3MC4wMTcgNi45ODIsNjkuMzkyIDcuNDExLDY5LjE0NSBDNy41MjEsNjkuMDgyIDcuNjI1LDY5LjA0OSA3LjcxNCw2OS4wNDkgQzcuOTg2LDY5LjA0OSA4LjAxNSw2OS4zNTUgOC4wMTUsNjkuNDg3IEM4LjAxNSw2OS45NzggNy42NTIsNzAuNjAzIDcuMjI0LDcwLjg1MSBDNy4xMTUsNzAuOTE0IDcuMDEsNzAuOTQ3IDYuOTIsNzAuOTQ3IE03LjcxNCw2OC44NjEgQzcuNTk1LDY4Ljg2MSA3LjQ2LDY4LjkgNy4zMTcsNjguOTgyIEM2LjgyOSw2OS4yNjUgNi40MzMsNjkuOTQ4IDYuNDMzLDcwLjUwOCBDNi40MzMsNzAuOTA1IDYuNjMxLDcxLjEzMyA2LjkyLDcxLjEzMyBDNy4wMzksNzEuMTMzIDcuMTc0LDcxLjA5NCA3LjMxNyw3MS4wMTIgQzcuODA2LDcwLjczIDguMjAyLDcwLjA0NyA4LjIwMiw2OS40ODcgQzguMjAyLDY5LjA5IDguMDAzLDY4Ljg2MSA3LjcxNCw2OC44NjEiIGlkPSJGaWxsLTE1IiBmaWxsPSIjODA5N0EyIj48L3BhdGg+CiAgICAgICAgICAgICAgICAgICAgPHBhdGggZD0iTTcuNDQ0LDg1LjM1IEM3LjcwOCw4NS4xOTggNy45MjEsODUuMzE5IDcuOTIxLDg1LjYyMiBDNy45MjEsODUuOTI1IDcuNzA4LDg2LjI5MiA3LjQ0NCw4Ni40NDQgQzcuMTgxLDg2LjU5NyA2Ljk2Nyw4Ni40NzUgNi45NjcsODYuMTczIEM2Ljk2Nyw4NS44NzEgNy4xODEsODUuNTAyIDcuNDQ0LDg1LjM1IiBpZD0iRmlsbC0xNiIgZmlsbD0iI0ZGRkZGRiI+PC9wYXRoPgogICAgICAgICAgICAgICAgICAgIDxwYXRoIGQ9Ik03LjIzLDg2LjUxIEM3LjA3NCw4Ni41MSA2Ljk2Nyw4Ni4zODcgNi45NjcsODYuMTczIEM2Ljk2Nyw4NS44NzEgNy4xODEsODUuNTAyIDcuNDQ0LDg1LjM1IEM3LjUyMSw4NS4zMDUgNy41OTQsODUuMjg0IDcuNjU4LDg1LjI4NCBDNy44MTQsODUuMjg0IDcuOTIxLDg1LjQwOCA3LjkyMSw4NS42MjIgQzcuOTIxLDg1LjkyNSA3LjcwOCw4Ni4yOTIgNy40NDQsODYuNDQ0IEM3LjM2Nyw4Ni40ODkgNy4yOTQsODYuNTEgNy4yMyw4Ni41MSBNNy42NTgsODUuMDk4IEM3LjU1OCw4NS4wOTggNy40NTUsODUuMTI3IDcuMzUxLDg1LjE4OCBDNy4wMzEsODUuMzczIDYuNzgxLDg1LjgwNiA2Ljc4MSw4Ni4xNzMgQzYuNzgxLDg2LjQ4MiA2Ljk2Niw4Ni42OTcgNy4yMyw4Ni42OTcgQzcuMzMsODYuNjk3IDcuNDMzLDg2LjY2NiA3LjUzOCw4Ni42MDcgQzcuODU4LDg2LjQyMiA4LjEwOCw4NS45ODkgOC4xMDgsODUuNjIyIEM4LjEwOCw4NS4zMTMgNy45MjMsODUuMDk4IDcuNjU4LDg1LjA5OCIgaWQ9IkZpbGwtMTciIGZpbGw9IiM4MDk3QTIiPjwvcGF0aD4KICAgICAgICAgICAgICAgICAgICA8cGF0aCBkPSJNNy4yMyw4Ni4zMjIgTDcuMTU0LDg2LjE3MyBDNy4xNTQsODUuOTM4IDcuMzMzLDg1LjYyOSA3LjUzOCw4NS41MTIgTDcuNjU4LDg1LjQ3MSBMNy43MzQsODUuNjIyIEM3LjczNCw4NS44NTYgNy41NTUsODYuMTY0IDcuMzUxLDg2LjI4MiBMNy4yMyw4Ni4zMjIgTTcuNjU4LDg1LjI4NCBDNy41OTQsODUuMjg0IDcuNTIxLDg1LjMwNSA3LjQ0NCw4NS4zNSBDNy4xODEsODUuNTAyIDYuOTY3LDg1Ljg3MSA2Ljk2Nyw4Ni4xNzMgQzYuOTY3LDg2LjM4NyA3LjA3NCw4Ni41MSA3LjIzLDg2LjUxIEM3LjI5NCw4Ni41MSA3LjM2Nyw4Ni40ODkgNy40NDQsODYuNDQ0IEM3LjcwOCw4Ni4yOTIgNy45MjEsODUuOTI1IDcuOTIxLDg1LjYyMiBDNy45MjEsODUuNDA4IDcuODE0LDg1LjI4NCA3LjY1OCw4NS4yODQiIGlkPSJGaWxsLTE4IiBmaWxsPSIjODA5N0EyIj48L3BhdGg+CiAgICAgICAgICAgICAgICAgICAgPHBhdGggZD0iTTc3LjI3OCw3Ljc2OSBMNzcuMjc4LDUxLjQzNiBMMTAuMjA4LDkwLjE2IEwxMC4yMDgsNDYuNDkzIEw3Ny4yNzgsNy43NjkiIGlkPSJGaWxsLTE5IiBmaWxsPSIjNDU1QTY0Ij48L3BhdGg+CiAgICAgICAgICAgICAgICAgICAgPHBhdGggZD0iTTEwLjA4Myw5MC4zNzUgTDEwLjA4Myw0Ni40MjEgTDEwLjE0Niw0Ni4zODUgTDc3LjQwMyw3LjU1NCBMNzcuNDAzLDUxLjUwOCBMNzcuMzQxLDUxLjU0NCBMMTAuMDgzLDkwLjM3NSBMMTAuMDgzLDkwLjM3NSBaIE0xMC4zMzMsNDYuNTY0IEwxMC4zMzMsODkuOTQ0IEw3Ny4xNTQsNTEuMzY1IEw3Ny4xNTQsNy45ODUgTDEwLjMzMyw0Ni41NjQgTDEwLjMzMyw0Ni41NjQgWiIgaWQ9IkZpbGwtMjAiIGZpbGw9IiM2MDdEOEIiPjwvcGF0aD4KICAgICAgICAgICAgICAgIDwvZz4KICAgICAgICAgICAgICAgIDxwYXRoIGQ9Ik0xMjUuNzM3LDg4LjY0NyBMMTE4LjA5OCw5MS45ODEgTDExOC4wOTgsODQgTDEwNi42MzksODguNzEzIEwxMDYuNjM5LDk2Ljk4MiBMOTksMTAwLjMxNSBMMTEyLjM2OSwxMDMuOTYxIEwxMjUuNzM3LDg4LjY0NyIgaWQ9IkltcG9ydGVkLUxheWVycy1Db3B5LTIiIGZpbGw9IiM0NTVBNjQiIHNrZXRjaDp0eXBlPSJNU1NoYXBlR3JvdXAiPjwvcGF0aD4KICAgICAgICAgICAgPC9nPgogICAgICAgIDwvZz4KICAgIDwvZz4KPC9zdmc+');
};

module.exports = RotateInstructions;

},{"./util.js":22}],17:[function(_dereq_,module,exports){
/*
 * Copyright 2015 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var SensorSample = _dereq_('./sensor-sample.js');
var MathUtil = _dereq_('../math-util.js');
var Util = _dereq_('../util.js');

var DEBUG = false;

/**
 * An implementation of a simple complementary filter, which fuses gyroscope and
 * accelerometer data from the 'devicemotion' event.
 *
 * Accelerometer data is very noisy, but stable over the long term.
 * Gyroscope data is smooth, but tends to drift over the long term.
 *
 * This fusion is relatively simple:
 * 1. Get orientation estimates from accelerometer by applying a low-pass filter
 *    on that data.
 * 2. Get orientation estimates from gyroscope by integrating over time.
 * 3. Combine the two estimates, weighing (1) in the long term, but (2) for the
 *    short term.
 */
function ComplementaryFilter(kFilter) {
  this.kFilter = kFilter;

  // Raw sensor measurements.
  this.currentAccelMeasurement = new SensorSample();
  this.currentGyroMeasurement = new SensorSample();
  this.previousGyroMeasurement = new SensorSample();

  // Set default look direction to be in the correct direction.
  if (Util.isIOS()) {
    this.filterQ = new MathUtil.Quaternion(-1, 0, 0, 1);
  } else {
    this.filterQ = new MathUtil.Quaternion(1, 0, 0, 1);
  }
  this.previousFilterQ = new MathUtil.Quaternion();
  this.previousFilterQ.copy(this.filterQ);

  // Orientation based on the accelerometer.
  this.accelQ = new MathUtil.Quaternion();
  // Whether or not the orientation has been initialized.
  this.isOrientationInitialized = false;
  // Running estimate of gravity based on the current orientation.
  this.estimatedGravity = new MathUtil.Vector3();
  // Measured gravity based on accelerometer.
  this.measuredGravity = new MathUtil.Vector3();

  // Debug only quaternion of gyro-based orientation.
  this.gyroIntegralQ = new MathUtil.Quaternion();
}

ComplementaryFilter.prototype.addAccelMeasurement = function(vector, timestampS) {
  this.currentAccelMeasurement.set(vector, timestampS);
};

ComplementaryFilter.prototype.addGyroMeasurement = function(vector, timestampS) {
  this.currentGyroMeasurement.set(vector, timestampS);

  var deltaT = timestampS - this.previousGyroMeasurement.timestampS;
  if (Util.isTimestampDeltaValid(deltaT)) {
    this.run_();
  }

  this.previousGyroMeasurement.copy(this.currentGyroMeasurement);
};

ComplementaryFilter.prototype.run_ = function() {

  if (!this.isOrientationInitialized) {
    this.accelQ = this.accelToQuaternion_(this.currentAccelMeasurement.sample);
    this.previousFilterQ.copy(this.accelQ);
    this.isOrientationInitialized = true;
    return;
  }

  var deltaT = this.currentGyroMeasurement.timestampS -
      this.previousGyroMeasurement.timestampS;

  // Convert gyro rotation vector to a quaternion delta.
  var gyroDeltaQ = this.gyroToQuaternionDelta_(this.currentGyroMeasurement.sample, deltaT);
  this.gyroIntegralQ.multiply(gyroDeltaQ);

  // filter_1 = K * (filter_0 + gyro * dT) + (1 - K) * accel.
  this.filterQ.copy(this.previousFilterQ);
  this.filterQ.multiply(gyroDeltaQ);

  // Calculate the delta between the current estimated gravity and the real
  // gravity vector from accelerometer.
  var invFilterQ = new MathUtil.Quaternion();
  invFilterQ.copy(this.filterQ);
  invFilterQ.inverse();

  this.estimatedGravity.set(0, 0, -1);
  this.estimatedGravity.applyQuaternion(invFilterQ);
  this.estimatedGravity.normalize();

  this.measuredGravity.copy(this.currentAccelMeasurement.sample);
  this.measuredGravity.normalize();

  // Compare estimated gravity with measured gravity, get the delta quaternion
  // between the two.
  var deltaQ = new MathUtil.Quaternion();
  deltaQ.setFromUnitVectors(this.estimatedGravity, this.measuredGravity);
  deltaQ.inverse();

  if (DEBUG) {
    console.log('Delta: %d deg, G_est: (%s, %s, %s), G_meas: (%s, %s, %s)',
                MathUtil.radToDeg * Util.getQuaternionAngle(deltaQ),
                (this.estimatedGravity.x).toFixed(1),
                (this.estimatedGravity.y).toFixed(1),
                (this.estimatedGravity.z).toFixed(1),
                (this.measuredGravity.x).toFixed(1),
                (this.measuredGravity.y).toFixed(1),
                (this.measuredGravity.z).toFixed(1));
  }

  // Calculate the SLERP target: current orientation plus the measured-estimated
  // quaternion delta.
  var targetQ = new MathUtil.Quaternion();
  targetQ.copy(this.filterQ);
  targetQ.multiply(deltaQ);

  // SLERP factor: 0 is pure gyro, 1 is pure accel.
  this.filterQ.slerp(targetQ, 1 - this.kFilter);

  this.previousFilterQ.copy(this.filterQ);
};

ComplementaryFilter.prototype.getOrientation = function() {
  return this.filterQ;
};

ComplementaryFilter.prototype.accelToQuaternion_ = function(accel) {
  var normAccel = new MathUtil.Vector3();
  normAccel.copy(accel);
  normAccel.normalize();
  var quat = new MathUtil.Quaternion();
  quat.setFromUnitVectors(new MathUtil.Vector3(0, 0, -1), normAccel);
  quat.inverse();
  return quat;
};

ComplementaryFilter.prototype.gyroToQuaternionDelta_ = function(gyro, dt) {
  // Extract axis and angle from the gyroscope data.
  var quat = new MathUtil.Quaternion();
  var axis = new MathUtil.Vector3();
  axis.copy(gyro);
  axis.normalize();
  quat.setFromAxisAngle(axis, gyro.length() * dt);
  return quat;
};


module.exports = ComplementaryFilter;

},{"../math-util.js":14,"../util.js":22,"./sensor-sample.js":20}],18:[function(_dereq_,module,exports){
/*
 * Copyright 2015 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
var ComplementaryFilter = _dereq_('./complementary-filter.js');
var PosePredictor = _dereq_('./pose-predictor.js');
var TouchPanner = _dereq_('../touch-panner.js');
var MathUtil = _dereq_('../math-util.js');
var Util = _dereq_('../util.js');

/**
 * The pose sensor, implemented using DeviceMotion APIs.
 */
function FusionPoseSensor() {
  this.deviceId = 'webvr-polyfill:fused';
  this.deviceName = 'VR Position Device (webvr-polyfill:fused)';

  this.accelerometer = new MathUtil.Vector3();
  this.gyroscope = new MathUtil.Vector3();

  window.addEventListener('devicemotion', this.onDeviceMotionChange_.bind(this));
  window.addEventListener('orientationchange', this.onScreenOrientationChange_.bind(this));

  this.filter = new ComplementaryFilter(WebVRConfig.K_FILTER);
  this.posePredictor = new PosePredictor(WebVRConfig.PREDICTION_TIME_S);
  this.touchPanner = new TouchPanner();

  this.filterToWorldQ = new MathUtil.Quaternion();

  // Set the filter to world transform, depending on OS.
  if (Util.isIOS()) {
    this.filterToWorldQ.setFromAxisAngle(new MathUtil.Vector3(1, 0, 0), Math.PI / 2);
  } else {
    this.filterToWorldQ.setFromAxisAngle(new MathUtil.Vector3(1, 0, 0), -Math.PI / 2);
  }

  this.inverseWorldToScreenQ = new MathUtil.Quaternion();
  this.worldToScreenQ = new MathUtil.Quaternion();
  this.originalPoseAdjustQ = new MathUtil.Quaternion();
  this.originalPoseAdjustQ.setFromAxisAngle(new MathUtil.Vector3(0, 0, 1),
                                           -window.orientation * Math.PI / 180);

  this.setScreenTransform_();
  // Adjust this filter for being in landscape mode.
  if (Util.isLandscapeMode()) {
    this.filterToWorldQ.multiply(this.inverseWorldToScreenQ);
  }

  // Keep track of a reset transform for resetSensor.
  this.resetQ = new MathUtil.Quaternion();

  this.isFirefoxAndroid = Util.isFirefoxAndroid();
  this.isIOS = Util.isIOS();

  this.orientationOut_ = new Float32Array(4);
}

FusionPoseSensor.prototype.getPosition = function() {
  // This PoseSensor doesn't support position
  return null;
};

FusionPoseSensor.prototype.getOrientation = function() {
  // Convert from filter space to the the same system used by the
  // deviceorientation event.
  var orientation = this.filter.getOrientation();

  // Predict orientation.
  this.predictedQ = this.posePredictor.getPrediction(orientation, this.gyroscope, this.previousTimestampS);

  // Convert to THREE coordinate system: -Z forward, Y up, X right.
  var out = new MathUtil.Quaternion();
  out.copy(this.filterToWorldQ);
  out.multiply(this.resetQ);
  if (!WebVRConfig.TOUCH_PANNER_DISABLED) {
    out.multiply(this.touchPanner.getOrientation());
  }
  out.multiply(this.predictedQ);
  out.multiply(this.worldToScreenQ);

  // Handle the yaw-only case.
  if (WebVRConfig.YAW_ONLY) {
    // Make a quaternion that only turns around the Y-axis.
    out.x = 0;
    out.z = 0;
    out.normalize();
  }

  this.orientationOut_[0] = out.x;
  this.orientationOut_[1] = out.y;
  this.orientationOut_[2] = out.z;
  this.orientationOut_[3] = out.w;
  return this.orientationOut_;
};

FusionPoseSensor.prototype.resetPose = function() {
  // Reduce to inverted yaw-only.
  this.resetQ.copy(this.filter.getOrientation());
  this.resetQ.x = 0;
  this.resetQ.y = 0;
  this.resetQ.z *= -1;
  this.resetQ.normalize();

  // Take into account extra transformations in landscape mode.
  if (Util.isLandscapeMode()) {
    this.resetQ.multiply(this.inverseWorldToScreenQ);
  }

  // Take into account original pose.
  this.resetQ.multiply(this.originalPoseAdjustQ);

  if (!WebVRConfig.TOUCH_PANNER_DISABLED) {
    this.touchPanner.resetSensor();
  }
};

FusionPoseSensor.prototype.onDeviceMotionChange_ = function(deviceMotion) {
  var accGravity = deviceMotion.accelerationIncludingGravity;
  var rotRate = deviceMotion.rotationRate;
  var timestampS = deviceMotion.timeStamp / 1000;

  // Firefox Android timeStamp returns one thousandth of a millisecond.
  if (this.isFirefoxAndroid) {
    timestampS /= 1000;
  }

  var deltaS = timestampS - this.previousTimestampS;
  if (deltaS <= Util.MIN_TIMESTEP || deltaS > Util.MAX_TIMESTEP) {
    console.warn('Invalid timestamps detected. Time step between successive ' +
                 'gyroscope sensor samples is very small or not monotonic');
    this.previousTimestampS = timestampS;
    return;
  }
  this.accelerometer.set(-accGravity.x, -accGravity.y, -accGravity.z);
  this.gyroscope.set(rotRate.alpha, rotRate.beta, rotRate.gamma);

  // With iOS and Firefox Android, rotationRate is reported in degrees,
  // so we first convert to radians.
  if (this.isIOS || this.isFirefoxAndroid) {
    this.gyroscope.multiplyScalar(Math.PI / 180);
  }

  this.filter.addAccelMeasurement(this.accelerometer, timestampS);
  this.filter.addGyroMeasurement(this.gyroscope, timestampS);

  this.previousTimestampS = timestampS;
};

FusionPoseSensor.prototype.onScreenOrientationChange_ =
    function(screenOrientation) {
  this.setScreenTransform_();
};

FusionPoseSensor.prototype.setScreenTransform_ = function() {
  this.worldToScreenQ.set(0, 0, 0, 1);
  switch (window.orientation) {
    case 0:
      break;
    case 90:
      this.worldToScreenQ.setFromAxisAngle(new MathUtil.Vector3(0, 0, 1), -Math.PI / 2);
      break;
    case -90:
      this.worldToScreenQ.setFromAxisAngle(new MathUtil.Vector3(0, 0, 1), Math.PI / 2);
      break;
    case 180:
      // TODO.
      break;
  }
  this.inverseWorldToScreenQ.copy(this.worldToScreenQ);
  this.inverseWorldToScreenQ.inverse();
};

module.exports = FusionPoseSensor;

},{"../math-util.js":14,"../touch-panner.js":21,"../util.js":22,"./complementary-filter.js":17,"./pose-predictor.js":19}],19:[function(_dereq_,module,exports){
/*
 * Copyright 2015 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
var MathUtil = _dereq_('../math-util.js');
var DEBUG = false;

/**
 * Given an orientation and the gyroscope data, predicts the future orientation
 * of the head. This makes rendering appear faster.
 *
 * Also see: http://msl.cs.uiuc.edu/~lavalle/papers/LavYerKatAnt14.pdf
 *
 * @param {Number} predictionTimeS time from head movement to the appearance of
 * the corresponding image.
 */
function PosePredictor(predictionTimeS) {
  this.predictionTimeS = predictionTimeS;

  // The quaternion corresponding to the previous state.
  this.previousQ = new MathUtil.Quaternion();
  // Previous time a prediction occurred.
  this.previousTimestampS = null;

  // The delta quaternion that adjusts the current pose.
  this.deltaQ = new MathUtil.Quaternion();
  // The output quaternion.
  this.outQ = new MathUtil.Quaternion();
}

PosePredictor.prototype.getPrediction = function(currentQ, gyro, timestampS) {
  if (!this.previousTimestampS) {
    this.previousQ.copy(currentQ);
    this.previousTimestampS = timestampS;
    return currentQ;
  }

  // Calculate axis and angle based on gyroscope rotation rate data.
  var axis = new MathUtil.Vector3();
  axis.copy(gyro);
  axis.normalize();

  var angularSpeed = gyro.length();

  // If we're rotating slowly, don't do prediction.
  if (angularSpeed < MathUtil.degToRad * 20) {
    if (DEBUG) {
      console.log('Moving slowly, at %s deg/s: no prediction',
                  (MathUtil.radToDeg * angularSpeed).toFixed(1));
    }
    this.outQ.copy(currentQ);
    this.previousQ.copy(currentQ);
    return this.outQ;
  }

  // Get the predicted angle based on the time delta and latency.
  var deltaT = timestampS - this.previousTimestampS;
  var predictAngle = angularSpeed * this.predictionTimeS;

  this.deltaQ.setFromAxisAngle(axis, predictAngle);
  this.outQ.copy(this.previousQ);
  this.outQ.multiply(this.deltaQ);

  this.previousQ.copy(currentQ);
  this.previousTimestampS = timestampS;

  return this.outQ;
};


module.exports = PosePredictor;

},{"../math-util.js":14}],20:[function(_dereq_,module,exports){
function SensorSample(sample, timestampS) {
  this.set(sample, timestampS);
};

SensorSample.prototype.set = function(sample, timestampS) {
  this.sample = sample;
  this.timestampS = timestampS;
};

SensorSample.prototype.copy = function(sensorSample) {
  this.set(sensorSample.sample, sensorSample.timestampS);
};

module.exports = SensorSample;

},{}],21:[function(_dereq_,module,exports){
/*
 * Copyright 2015 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
var MathUtil = _dereq_('./math-util.js');
var Util = _dereq_('./util.js');

var ROTATE_SPEED = 0.5;
/**
 * Provides a quaternion responsible for pre-panning the scene before further
 * transformations due to device sensors.
 */
function TouchPanner() {
  window.addEventListener('touchstart', this.onTouchStart_.bind(this));
  window.addEventListener('touchmove', this.onTouchMove_.bind(this));
  window.addEventListener('touchend', this.onTouchEnd_.bind(this));

  this.isTouching = false;
  this.rotateStart = new MathUtil.Vector2();
  this.rotateEnd = new MathUtil.Vector2();
  this.rotateDelta = new MathUtil.Vector2();

  this.theta = 0;
  this.orientation = new MathUtil.Quaternion();
}

TouchPanner.prototype.getOrientation = function() {
  this.orientation.setFromEulerXYZ(0, 0, this.theta);
  return this.orientation;
};

TouchPanner.prototype.resetSensor = function() {
  this.theta = 0;
};

TouchPanner.prototype.onTouchStart_ = function(e) {
  // Only respond if there is exactly one touch.
  if (e.touches.length != 1) {
    return;
  }
  this.rotateStart.set(e.touches[0].pageX, e.touches[0].pageY);
  this.isTouching = true;
};

TouchPanner.prototype.onTouchMove_ = function(e) {
  if (!this.isTouching) {
    return;
  }
  this.rotateEnd.set(e.touches[0].pageX, e.touches[0].pageY);
  this.rotateDelta.subVectors(this.rotateEnd, this.rotateStart);
  this.rotateStart.copy(this.rotateEnd);

  // On iOS, direction is inverted.
  if (Util.isIOS()) {
    this.rotateDelta.x *= -1;
  }

  var element = document.body;
  this.theta += 2 * Math.PI * this.rotateDelta.x / element.clientWidth * ROTATE_SPEED;
};

TouchPanner.prototype.onTouchEnd_ = function(e) {
  this.isTouching = false;
};

module.exports = TouchPanner;

},{"./math-util.js":14,"./util.js":22}],22:[function(_dereq_,module,exports){
/*
 * Copyright 2015 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var objectAssign = _dereq_('object-assign');

var Util = window.Util || {};

Util.MIN_TIMESTEP = 0.001;
Util.MAX_TIMESTEP = 1;

Util.base64 = function(mimeType, base64) {
  return 'data:' + mimeType + ';base64,' + base64;
};

Util.clamp = function(value, min, max) {
  return Math.min(Math.max(min, value), max);
};

Util.lerp = function(a, b, t) {
  return a + ((b - a) * t);
};

Util.isIOS = (function() {
  var isIOS = /iPad|iPhone|iPod/.test(navigator.platform);
  return function() {
    return isIOS;
  };
})();

Util.isSafari = (function() {
  var isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  return function() {
    return isSafari;
  };
})();

Util.isFirefoxAndroid = (function() {
  var isFirefoxAndroid = navigator.userAgent.indexOf('Firefox') !== -1 &&
      navigator.userAgent.indexOf('Android') !== -1;
  return function() {
    return isFirefoxAndroid;
  };
})();

Util.isLandscapeMode = function() {
  return (window.orientation == 90 || window.orientation == -90);
};

// Helper method to validate the time steps of sensor timestamps.
Util.isTimestampDeltaValid = function(timestampDeltaS) {
  if (isNaN(timestampDeltaS)) {
    return false;
  }
  if (timestampDeltaS <= Util.MIN_TIMESTEP) {
    return false;
  }
  if (timestampDeltaS > Util.MAX_TIMESTEP) {
    return false;
  }
  return true;
};

Util.getScreenWidth = function() {
  return Math.max(window.screen.width, window.screen.height) *
      window.devicePixelRatio;
};

Util.getScreenHeight = function() {
  return Math.min(window.screen.width, window.screen.height) *
      window.devicePixelRatio;
};

Util.requestFullscreen = function(element) {
  if (element.requestFullscreen) {
    element.requestFullscreen();
  } else if (element.webkitRequestFullscreen) {
    element.webkitRequestFullscreen();
  } else if (element.mozRequestFullScreen) {
    element.mozRequestFullScreen();
  } else if (element.msRequestFullscreen) {
    element.msRequestFullscreen();
  } else {
    return false;
  }

  return true;
};

Util.exitFullscreen = function() {
  if (document.exitFullscreen) {
    document.exitFullscreen();
  } else if (document.webkitExitFullscreen) {
    document.webkitExitFullscreen();
  } else if (document.mozCancelFullScreen) {
    document.mozCancelFullScreen();
  } else if (document.msExitFullscreen) {
    document.msExitFullscreen();
  } else {
    return false;
  }

  return true;
};

Util.getFullscreenElement = function() {
  return document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement;
};

Util.linkProgram = function(gl, vertexSource, fragmentSource, attribLocationMap) {
  // No error checking for brevity.
  var vertexShader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vertexShader, vertexSource);
  gl.compileShader(vertexShader);

  var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fragmentShader, fragmentSource);
  gl.compileShader(fragmentShader);

  var program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);

  for (var attribName in attribLocationMap)
    gl.bindAttribLocation(program, attribLocationMap[attribName], attribName);

  gl.linkProgram(program);

  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  return program;
};

Util.getProgramUniforms = function(gl, program) {
  var uniforms = {};
  var uniformCount = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
  var uniformName = '';
  for (var i = 0; i < uniformCount; i++) {
    var uniformInfo = gl.getActiveUniform(program, i);
    uniformName = uniformInfo.name.replace('[0]', '');
    uniforms[uniformName] = gl.getUniformLocation(program, uniformName);
  }
  return uniforms;
};

Util.orthoMatrix = function (out, left, right, bottom, top, near, far) {
  var lr = 1 / (left - right),
      bt = 1 / (bottom - top),
      nf = 1 / (near - far);
  out[0] = -2 * lr;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;
  out[4] = 0;
  out[5] = -2 * bt;
  out[6] = 0;
  out[7] = 0;
  out[8] = 0;
  out[9] = 0;
  out[10] = 2 * nf;
  out[11] = 0;
  out[12] = (left + right) * lr;
  out[13] = (top + bottom) * bt;
  out[14] = (far + near) * nf;
  out[15] = 1;
  return out;
};

Util.isMobile = function() {
  var check = false;
  (function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4)))check = true})(navigator.userAgent||navigator.vendor||window.opera);
  return check;
};

Util.extend = objectAssign;

Util.safariCssSizeWorkaround = function(canvas) {
  // TODO(smus): Remove this workaround when Safari for iOS is fixed.
  // iOS only workaround (for https://bugs.webkit.org/show_bug.cgi?id=152556).
  //
  // "To the last I grapple with thee;
  //  from hell's heart I stab at thee;
  //  for hate's sake I spit my last breath at thee."
  // -- Moby Dick, by Herman Melville
  if (Util.isIOS()) {
    var width = canvas.style.width;
    var height = canvas.style.height;
    canvas.style.width = (parseInt(width) + 1) + 'px';
    canvas.style.height = (parseInt(height)) + 'px';
    console.log('Resetting width to...', width);
    setTimeout(function() {
      console.log('Done. Width is now', width);
      canvas.style.width = width;
      canvas.style.height = height;
    }, 100);
  }

  // Debug only.
  window.Util = Util;
  window.canvas = canvas;
};

Util.frameDataFromPose = (function() {
  var piOver180 = Math.PI / 180.0;
  var rad45 = Math.PI * 0.25;

  // Borrowed from glMatrix.
  function mat4_perspectiveFromFieldOfView(out, fov, near, far) {
    var upTan = Math.tan(fov ? (fov.upDegrees * piOver180) : rad45),
    downTan = Math.tan(fov ? (fov.downDegrees * piOver180) : rad45),
    leftTan = Math.tan(fov ? (fov.leftDegrees * piOver180) : rad45),
    rightTan = Math.tan(fov ? (fov.rightDegrees * piOver180) : rad45),
    xScale = 2.0 / (leftTan + rightTan),
    yScale = 2.0 / (upTan + downTan);

    out[0] = xScale;
    out[1] = 0.0;
    out[2] = 0.0;
    out[3] = 0.0;
    out[4] = 0.0;
    out[5] = yScale;
    out[6] = 0.0;
    out[7] = 0.0;
    out[8] = -((leftTan - rightTan) * xScale * 0.5);
    out[9] = ((upTan - downTan) * yScale * 0.5);
    out[10] = far / (near - far);
    out[11] = -1.0;
    out[12] = 0.0;
    out[13] = 0.0;
    out[14] = (far * near) / (near - far);
    out[15] = 0.0;
    return out;
  }

  function mat4_fromRotationTranslation(out, q, v) {
    // Quaternion math
    var x = q[0], y = q[1], z = q[2], w = q[3],
        x2 = x + x,
        y2 = y + y,
        z2 = z + z,

        xx = x * x2,
        xy = x * y2,
        xz = x * z2,
        yy = y * y2,
        yz = y * z2,
        zz = z * z2,
        wx = w * x2,
        wy = w * y2,
        wz = w * z2;

    out[0] = 1 - (yy + zz);
    out[1] = xy + wz;
    out[2] = xz - wy;
    out[3] = 0;
    out[4] = xy - wz;
    out[5] = 1 - (xx + zz);
    out[6] = yz + wx;
    out[7] = 0;
    out[8] = xz + wy;
    out[9] = yz - wx;
    out[10] = 1 - (xx + yy);
    out[11] = 0;
    out[12] = v[0];
    out[13] = v[1];
    out[14] = v[2];
    out[15] = 1;

    return out;
  };

  function mat4_translate(out, a, v) {
    var x = v[0], y = v[1], z = v[2],
        a00, a01, a02, a03,
        a10, a11, a12, a13,
        a20, a21, a22, a23;

    if (a === out) {
      out[12] = a[0] * x + a[4] * y + a[8] * z + a[12];
      out[13] = a[1] * x + a[5] * y + a[9] * z + a[13];
      out[14] = a[2] * x + a[6] * y + a[10] * z + a[14];
      out[15] = a[3] * x + a[7] * y + a[11] * z + a[15];
    } else {
      a00 = a[0]; a01 = a[1]; a02 = a[2]; a03 = a[3];
      a10 = a[4]; a11 = a[5]; a12 = a[6]; a13 = a[7];
      a20 = a[8]; a21 = a[9]; a22 = a[10]; a23 = a[11];

      out[0] = a00; out[1] = a01; out[2] = a02; out[3] = a03;
      out[4] = a10; out[5] = a11; out[6] = a12; out[7] = a13;
      out[8] = a20; out[9] = a21; out[10] = a22; out[11] = a23;

      out[12] = a00 * x + a10 * y + a20 * z + a[12];
      out[13] = a01 * x + a11 * y + a21 * z + a[13];
      out[14] = a02 * x + a12 * y + a22 * z + a[14];
      out[15] = a03 * x + a13 * y + a23 * z + a[15];
    }

    return out;
  };

  mat4_invert = function(out, a) {
    var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3],
        a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
        a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11],
        a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15],

        b00 = a00 * a11 - a01 * a10,
        b01 = a00 * a12 - a02 * a10,
        b02 = a00 * a13 - a03 * a10,
        b03 = a01 * a12 - a02 * a11,
        b04 = a01 * a13 - a03 * a11,
        b05 = a02 * a13 - a03 * a12,
        b06 = a20 * a31 - a21 * a30,
        b07 = a20 * a32 - a22 * a30,
        b08 = a20 * a33 - a23 * a30,
        b09 = a21 * a32 - a22 * a31,
        b10 = a21 * a33 - a23 * a31,
        b11 = a22 * a33 - a23 * a32,

        // Calculate the determinant
        det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;

    if (!det) {
      return null;
    }
    det = 1.0 / det;

    out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
    out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
    out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
    out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
    out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
    out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
    out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
    out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
    out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
    out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
    out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
    out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
    out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
    out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;

    return out;
  };

  var defaultOrientation = new Float32Array([0, 0, 0, 1]);
  var defaultPosition = new Float32Array([0, 0, 0]);

  function updateEyeMatrices(projection, view, pose, parameters, vrDisplay) {
    mat4_perspectiveFromFieldOfView(projection, parameters ? parameters.fieldOfView : null, vrDisplay.depthNear, vrDisplay.depthFar);

    var orientation = pose.orientation || defaultOrientation;
    var position = pose.position || defaultPosition;

    mat4_fromRotationTranslation(view, orientation, position);
    if (parameters)
      mat4_translate(view, view, parameters.offset);
    mat4_invert(view, view);
  }

  return function(frameData, pose, vrDisplay) {
    if (!frameData || !pose)
      return false;

    frameData.pose = pose;
    frameData.timestamp = pose.timestamp;

    updateEyeMatrices(
        frameData.leftProjectionMatrix, frameData.leftViewMatrix,
        pose, vrDisplay.getEyeParameters("left"), vrDisplay);
    updateEyeMatrices(
        frameData.rightProjectionMatrix, frameData.rightViewMatrix,
        pose, vrDisplay.getEyeParameters("right"), vrDisplay);

    return true;
  };
})();

module.exports = Util;

},{"object-assign":1}],23:[function(_dereq_,module,exports){
/*
 * Copyright 2015 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var Emitter = _dereq_('./emitter.js');
var Util = _dereq_('./util.js');
var DeviceInfo = _dereq_('./device-info.js');

var DEFAULT_VIEWER = 'CardboardV1';
var VIEWER_KEY = 'WEBVR_CARDBOARD_VIEWER';
var CLASS_NAME = 'webvr-polyfill-viewer-selector';

/**
 * Creates a viewer selector with the options specified. Supports being shown
 * and hidden. Generates events when viewer parameters change. Also supports
 * saving the currently selected index in localStorage.
 */
function ViewerSelector() {
  // Try to load the selected key from local storage. If none exists, use the
  // default key.
  try {
    this.selectedKey = localStorage.getItem(VIEWER_KEY) || DEFAULT_VIEWER;
  } catch (error) {
    console.error('Failed to load viewer profile: %s', error);
  }
  this.dialog = this.createDialog_(DeviceInfo.Viewers);
  this.root = null;
}
ViewerSelector.prototype = new Emitter();

ViewerSelector.prototype.show = function(root) {
  this.root = root;

  root.appendChild(this.dialog);
  //console.log('ViewerSelector.show');

  // Ensure the currently selected item is checked.
  var selected = this.dialog.querySelector('#' + this.selectedKey);
  selected.checked = true;

  // Show the UI.
  this.dialog.style.display = 'block';
};

ViewerSelector.prototype.hide = function() {
  if (this.root && this.root.contains(this.dialog)) {
    this.root.removeChild(this.dialog);
  }
  //console.log('ViewerSelector.hide');
  this.dialog.style.display = 'none';
};

ViewerSelector.prototype.getCurrentViewer = function() {
  return DeviceInfo.Viewers[this.selectedKey];
};

ViewerSelector.prototype.getSelectedKey_ = function() {
  var input = this.dialog.querySelector('input[name=field]:checked');
  if (input) {
    return input.id;
  }
  return null;
};

ViewerSelector.prototype.onSave_ = function() {
  this.selectedKey = this.getSelectedKey_();
  if (!this.selectedKey || !DeviceInfo.Viewers[this.selectedKey]) {
    console.error('ViewerSelector.onSave_: this should never happen!');
    return;
  }

  this.emit('change', DeviceInfo.Viewers[this.selectedKey]);

  // Attempt to save the viewer profile, but fails in private mode.
  try {
    localStorage.setItem(VIEWER_KEY, this.selectedKey);
  } catch(error) {
    console.error('Failed to save viewer profile: %s', error);
  }
  this.hide();
};

/**
 * Creates the dialog.
 */
ViewerSelector.prototype.createDialog_ = function(options) {
  var container = document.createElement('div');
  container.classList.add(CLASS_NAME);
  container.style.display = 'none';
  // Create an overlay that dims the background, and which goes away when you
  // tap it.
  var overlay = document.createElement('div');
  var s = overlay.style;
  s.position = 'fixed';
  s.left = 0;
  s.top = 0;
  s.width = '100%';
  s.height = '100%';
  s.background = 'rgba(0, 0, 0, 0.3)';
  overlay.addEventListener('click', this.hide.bind(this));

  var width = 280;
  var dialog = document.createElement('div');
  s = dialog.style;
  s.boxSizing = 'border-box';
  s.position = 'fixed';
  s.top = '24px';
  s.left = '50%';
  s.marginLeft = (-width/2) + 'px';
  s.width = width + 'px';
  s.padding = '24px';
  s.overflow = 'hidden';
  s.background = '#fafafa';
  s.fontFamily = "'Roboto', sans-serif";
  s.boxShadow = '0px 5px 20px #666';

  dialog.appendChild(this.createH1_('Select your viewer'));
  for (var id in options) {
    dialog.appendChild(this.createChoice_(id, options[id].label));
  }
  dialog.appendChild(this.createButton_('Save', this.onSave_.bind(this)));

  container.appendChild(overlay);
  container.appendChild(dialog);

  return container;
};

ViewerSelector.prototype.createH1_ = function(name) {
  var h1 = document.createElement('h1');
  var s = h1.style;
  s.color = 'black';
  s.fontSize = '20px';
  s.fontWeight = 'bold';
  s.marginTop = 0;
  s.marginBottom = '24px';
  h1.innerHTML = name;
  return h1;
};

ViewerSelector.prototype.createChoice_ = function(id, name) {
  /*
  <div class="choice">
  <input id="v1" type="radio" name="field" value="v1">
  <label for="v1">Cardboard V1</label>
  </div>
  */
  var div = document.createElement('div');
  div.style.marginTop = '8px';
  div.style.color = 'black';

  var input = document.createElement('input');
  input.style.fontSize = '30px';
  input.setAttribute('id', id);
  input.setAttribute('type', 'radio');
  input.setAttribute('value', id);
  input.setAttribute('name', 'field');

  var label = document.createElement('label');
  label.style.marginLeft = '4px';
  label.setAttribute('for', id);
  label.innerHTML = name;

  div.appendChild(input);
  div.appendChild(label);

  return div;
};

ViewerSelector.prototype.createButton_ = function(label, onclick) {
  var button = document.createElement('button');
  button.innerHTML = label;
  var s = button.style;
  s.float = 'right';
  s.textTransform = 'uppercase';
  s.color = '#1094f7';
  s.fontSize = '14px';
  s.letterSpacing = 0;
  s.border = 0;
  s.background = 'none';
  s.marginTop = '16px';

  button.addEventListener('click', onclick);

  return button;
};

module.exports = ViewerSelector;

},{"./device-info.js":7,"./emitter.js":12,"./util.js":22}],24:[function(_dereq_,module,exports){
/*
 * Copyright 2015 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var Util = _dereq_('./util.js');

/**
 * Android and iOS compatible wakelock implementation.
 *
 * Refactored thanks to dkovalev@.
 */
function AndroidWakeLock() {
  var video = document.createElement('video');

  video.addEventListener('ended', function() {
    video.play();
  });

  this.request = function() {
    if (video.paused) {
      // Base64 version of videos_src/no-sleep-120s.mp4.
      video.src = Util.base64('video/mp4', 'AAAAGGZ0eXBpc29tAAAAAG1wNDFhdmMxAAAIA21vb3YAAABsbXZoZAAAAADSa9v60mvb+gABX5AAlw/gAAEAAAEAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAAdkdHJhawAAAFx0a2hkAAAAAdJr2/rSa9v6AAAAAQAAAAAAlw/gAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAQAAAAAAQAAAAHAAAAAAAJGVkdHMAAAAcZWxzdAAAAAAAAAABAJcP4AAAAAAAAQAAAAAG3G1kaWEAAAAgbWRoZAAAAADSa9v60mvb+gAPQkAGjneAFccAAAAAAC1oZGxyAAAAAAAAAAB2aWRlAAAAAAAAAAAAAAAAVmlkZW9IYW5kbGVyAAAABodtaW5mAAAAFHZtaGQAAAABAAAAAAAAAAAAAAAkZGluZgAAABxkcmVmAAAAAAAAAAEAAAAMdXJsIAAAAAEAAAZHc3RibAAAAJdzdHNkAAAAAAAAAAEAAACHYXZjMQAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAMABwASAAAAEgAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABj//wAAADFhdmNDAWQAC//hABlnZAALrNlfllw4QAAAAwBAAAADAKPFCmWAAQAFaOvssiwAAAAYc3R0cwAAAAAAAAABAAAAbgAPQkAAAAAUc3RzcwAAAAAAAAABAAAAAQAAA4BjdHRzAAAAAAAAAG4AAAABAD0JAAAAAAEAehIAAAAAAQA9CQAAAAABAAAAAAAAAAEAD0JAAAAAAQBMS0AAAAABAB6EgAAAAAEAAAAAAAAAAQAPQkAAAAABAExLQAAAAAEAHoSAAAAAAQAAAAAAAAABAA9CQAAAAAEATEtAAAAAAQAehIAAAAABAAAAAAAAAAEAD0JAAAAAAQBMS0AAAAABAB6EgAAAAAEAAAAAAAAAAQAPQkAAAAABAExLQAAAAAEAHoSAAAAAAQAAAAAAAAABAA9CQAAAAAEATEtAAAAAAQAehIAAAAABAAAAAAAAAAEAD0JAAAAAAQBMS0AAAAABAB6EgAAAAAEAAAAAAAAAAQAPQkAAAAABAExLQAAAAAEAHoSAAAAAAQAAAAAAAAABAA9CQAAAAAEATEtAAAAAAQAehIAAAAABAAAAAAAAAAEAD0JAAAAAAQBMS0AAAAABAB6EgAAAAAEAAAAAAAAAAQAPQkAAAAABAExLQAAAAAEAHoSAAAAAAQAAAAAAAAABAA9CQAAAAAEATEtAAAAAAQAehIAAAAABAAAAAAAAAAEAD0JAAAAAAQBMS0AAAAABAB6EgAAAAAEAAAAAAAAAAQAPQkAAAAABAExLQAAAAAEAHoSAAAAAAQAAAAAAAAABAA9CQAAAAAEATEtAAAAAAQAehIAAAAABAAAAAAAAAAEAD0JAAAAAAQBMS0AAAAABAB6EgAAAAAEAAAAAAAAAAQAPQkAAAAABAExLQAAAAAEAHoSAAAAAAQAAAAAAAAABAA9CQAAAAAEATEtAAAAAAQAehIAAAAABAAAAAAAAAAEAD0JAAAAAAQBMS0AAAAABAB6EgAAAAAEAAAAAAAAAAQAPQkAAAAABAExLQAAAAAEAHoSAAAAAAQAAAAAAAAABAA9CQAAAAAEATEtAAAAAAQAehIAAAAABAAAAAAAAAAEAD0JAAAAAAQBMS0AAAAABAB6EgAAAAAEAAAAAAAAAAQAPQkAAAAABAExLQAAAAAEAHoSAAAAAAQAAAAAAAAABAA9CQAAAAAEATEtAAAAAAQAehIAAAAABAAAAAAAAAAEAD0JAAAAAAQBMS0AAAAABAB6EgAAAAAEAAAAAAAAAAQAPQkAAAAABAExLQAAAAAEAHoSAAAAAAQAAAAAAAAABAA9CQAAAAAEALcbAAAAAHHN0c2MAAAAAAAAAAQAAAAEAAABuAAAAAQAAAcxzdHN6AAAAAAAAAAAAAABuAAADCQAAABgAAAAOAAAADgAAAAwAAAASAAAADgAAAAwAAAAMAAAAEgAAAA4AAAAMAAAADAAAABIAAAAOAAAADAAAAAwAAAASAAAADgAAAAwAAAAMAAAAEgAAAA4AAAAMAAAADAAAABIAAAAOAAAADAAAAAwAAAASAAAADgAAAAwAAAAMAAAAEgAAAA4AAAAMAAAADAAAABIAAAAOAAAADAAAAAwAAAASAAAADgAAAAwAAAAMAAAAEgAAAA4AAAAMAAAADAAAABIAAAAOAAAADAAAAAwAAAASAAAADgAAAAwAAAAMAAAAEgAAAA4AAAAMAAAADAAAABIAAAAOAAAADAAAAAwAAAASAAAADgAAAAwAAAAMAAAAEgAAAA4AAAAMAAAADAAAABIAAAAOAAAADAAAAAwAAAASAAAADgAAAAwAAAAMAAAAEgAAAA4AAAAMAAAADAAAABIAAAAOAAAADAAAAAwAAAASAAAADgAAAAwAAAAMAAAAEgAAAA4AAAAMAAAADAAAABIAAAAOAAAADAAAAAwAAAASAAAADgAAAAwAAAAMAAAAEgAAAA4AAAAMAAAADAAAABMAAAAUc3RjbwAAAAAAAAABAAAIKwAAACt1ZHRhAAAAI6llbmMAFwAAdmxjIDIuMi4xIHN0cmVhbSBvdXRwdXQAAAAId2lkZQAACRRtZGF0AAACrgX//6vcRem95tlIt5Ys2CDZI+7veDI2NCAtIGNvcmUgMTQyIC0gSC4yNjQvTVBFRy00IEFWQyBjb2RlYyAtIENvcHlsZWZ0IDIwMDMtMjAxNCAtIGh0dHA6Ly93d3cudmlkZW9sYW4ub3JnL3gyNjQuaHRtbCAtIG9wdGlvbnM6IGNhYmFjPTEgcmVmPTMgZGVibG9jaz0xOjA6MCBhbmFseXNlPTB4MzoweDEzIG1lPWhleCBzdWJtZT03IHBzeT0xIHBzeV9yZD0xLjAwOjAuMDAgbWl4ZWRfcmVmPTEgbWVfcmFuZ2U9MTYgY2hyb21hX21lPTEgdHJlbGxpcz0xIDh4OGRjdD0xIGNxbT0wIGRlYWR6b25lPTIxLDExIGZhc3RfcHNraXA9MSBjaHJvbWFfcXBfb2Zmc2V0PS0yIHRocmVhZHM9MTIgbG9va2FoZWFkX3RocmVhZHM9MSBzbGljZWRfdGhyZWFkcz0wIG5yPTAgZGVjaW1hdGU9MSBpbnRlcmxhY2VkPTAgYmx1cmF5X2NvbXBhdD0wIGNvbnN0cmFpbmVkX2ludHJhPTAgYmZyYW1lcz0zIGJfcHlyYW1pZD0yIGJfYWRhcHQ9MSBiX2JpYXM9MCBkaXJlY3Q9MSB3ZWlnaHRiPTEgb3Blbl9nb3A9MCB3ZWlnaHRwPTIga2V5aW50PTI1MCBrZXlpbnRfbWluPTEgc2NlbmVjdXQ9NDAgaW50cmFfcmVmcmVzaD0wIHJjX2xvb2thaGVhZD00MCByYz1hYnIgbWJ0cmVlPTEgYml0cmF0ZT0xMDAgcmF0ZXRvbD0xLjAgcWNvbXA9MC42MCBxcG1pbj0xMCBxcG1heD01MSBxcHN0ZXA9NCBpcF9yYXRpbz0xLjQwIGFxPTE6MS4wMACAAAAAU2WIhAAQ/8ltlOe+cTZuGkKg+aRtuivcDZ0pBsfsEi9p/i1yU9DxS2lq4dXTinViF1URBKXgnzKBd/Uh1bkhHtMrwrRcOJslD01UB+fyaL6ef+DBAAAAFEGaJGxBD5B+v+a+4QqF3MgBXz9MAAAACkGeQniH/+94r6EAAAAKAZ5hdEN/8QytwAAAAAgBnmNqQ3/EgQAAAA5BmmhJqEFomUwIIf/+4QAAAApBnoZFESw//76BAAAACAGepXRDf8SBAAAACAGep2pDf8SAAAAADkGarEmoQWyZTAgh//7gAAAACkGeykUVLD//voEAAAAIAZ7pdEN/xIAAAAAIAZ7rakN/xIAAAAAOQZrwSahBbJlMCCH//uEAAAAKQZ8ORRUsP/++gQAAAAgBny10Q3/EgQAAAAgBny9qQ3/EgAAAAA5BmzRJqEFsmUwIIf/+4AAAAApBn1JFFSw//76BAAAACAGfcXRDf8SAAAAACAGfc2pDf8SAAAAADkGbeEmoQWyZTAgh//7hAAAACkGflkUVLD//voAAAAAIAZ+1dEN/xIEAAAAIAZ+3akN/xIEAAAAOQZu8SahBbJlMCCH//uAAAAAKQZ/aRRUsP/++gQAAAAgBn/l0Q3/EgAAAAAgBn/tqQ3/EgQAAAA5Bm+BJqEFsmUwIIf/+4QAAAApBnh5FFSw//76AAAAACAGePXRDf8SAAAAACAGeP2pDf8SBAAAADkGaJEmoQWyZTAgh//7gAAAACkGeQkUVLD//voEAAAAIAZ5hdEN/xIAAAAAIAZ5jakN/xIEAAAAOQZpoSahBbJlMCCH//uEAAAAKQZ6GRRUsP/++gQAAAAgBnqV0Q3/EgQAAAAgBnqdqQ3/EgAAAAA5BmqxJqEFsmUwIIf/+4AAAAApBnspFFSw//76BAAAACAGe6XRDf8SAAAAACAGe62pDf8SAAAAADkGa8EmoQWyZTAgh//7hAAAACkGfDkUVLD//voEAAAAIAZ8tdEN/xIEAAAAIAZ8vakN/xIAAAAAOQZs0SahBbJlMCCH//uAAAAAKQZ9SRRUsP/++gQAAAAgBn3F0Q3/EgAAAAAgBn3NqQ3/EgAAAAA5Bm3hJqEFsmUwIIf/+4QAAAApBn5ZFFSw//76AAAAACAGftXRDf8SBAAAACAGft2pDf8SBAAAADkGbvEmoQWyZTAgh//7gAAAACkGf2kUVLD//voEAAAAIAZ/5dEN/xIAAAAAIAZ/7akN/xIEAAAAOQZvgSahBbJlMCCH//uEAAAAKQZ4eRRUsP/++gAAAAAgBnj10Q3/EgAAAAAgBnj9qQ3/EgQAAAA5BmiRJqEFsmUwIIf/+4AAAAApBnkJFFSw//76BAAAACAGeYXRDf8SAAAAACAGeY2pDf8SBAAAADkGaaEmoQWyZTAgh//7hAAAACkGehkUVLD//voEAAAAIAZ6ldEN/xIEAAAAIAZ6nakN/xIAAAAAOQZqsSahBbJlMCCH//uAAAAAKQZ7KRRUsP/++gQAAAAgBnul0Q3/EgAAAAAgBnutqQ3/EgAAAAA5BmvBJqEFsmUwIIf/+4QAAAApBnw5FFSw//76BAAAACAGfLXRDf8SBAAAACAGfL2pDf8SAAAAADkGbNEmoQWyZTAgh//7gAAAACkGfUkUVLD//voEAAAAIAZ9xdEN/xIAAAAAIAZ9zakN/xIAAAAAOQZt4SahBbJlMCCH//uEAAAAKQZ+WRRUsP/++gAAAAAgBn7V0Q3/EgQAAAAgBn7dqQ3/EgQAAAA5Bm7xJqEFsmUwIIf/+4AAAAApBn9pFFSw//76BAAAACAGf+XRDf8SAAAAACAGf+2pDf8SBAAAADkGb4EmoQWyZTAgh//7hAAAACkGeHkUVLD//voAAAAAIAZ49dEN/xIAAAAAIAZ4/akN/xIEAAAAOQZokSahBbJlMCCH//uAAAAAKQZ5CRRUsP/++gQAAAAgBnmF0Q3/EgAAAAAgBnmNqQ3/EgQAAAA5BmmhJqEFsmUwIIf/+4QAAAApBnoZFFSw//76BAAAACAGepXRDf8SBAAAACAGep2pDf8SAAAAADkGarEmoQWyZTAgh//7gAAAACkGeykUVLD//voEAAAAIAZ7pdEN/xIAAAAAIAZ7rakN/xIAAAAAPQZruSahBbJlMFEw3//7B');
      video.play();
    }
  };

  this.release = function() {
    video.pause();
    video.src = '';
  };
}

function iOSWakeLock() {
  var timer = null;

  this.request = function() {
    if (!timer) {
      timer = setInterval(function() {
        window.location = window.location;
        setTimeout(window.stop, 0);
      }, 30000);
    }
  }

  this.release = function() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }
}


function getWakeLock() {
  var userAgent = navigator.userAgent || navigator.vendor || window.opera;
  if (userAgent.match(/iPhone/i) || userAgent.match(/iPod/i)) {
    return iOSWakeLock;
  } else {
    return AndroidWakeLock;
  }
}

module.exports = getWakeLock();
},{"./util.js":22}],25:[function(_dereq_,module,exports){
/*
 * Copyright 2015 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var Util = _dereq_('./util.js');
var CardboardVRDisplay = _dereq_('./cardboard-vr-display.js');
var MouseKeyboardVRDisplay = _dereq_('./mouse-keyboard-vr-display.js');
// Uncomment to add positional tracking via webcam.
//var WebcamPositionSensorVRDevice = require('./webcam-position-sensor-vr-device.js');
var VRDisplay = _dereq_('./base.js').VRDisplay;
var VRFrameData = _dereq_('./base.js').VRFrameData;
var HMDVRDevice = _dereq_('./base.js').HMDVRDevice;
var PositionSensorVRDevice = _dereq_('./base.js').PositionSensorVRDevice;
var VRDisplayHMDDevice = _dereq_('./display-wrappers.js').VRDisplayHMDDevice;
var VRDisplayPositionSensorDevice = _dereq_('./display-wrappers.js').VRDisplayPositionSensorDevice;

function WebVRPolyfill() {
  this.displays = [];
  this.devices = []; // For deprecated objects
  this.devicesPopulated = false;
  this.nativeWebVRAvailable = this.isWebVRAvailable();
  this.nativeLegacyWebVRAvailable = this.isDeprecatedWebVRAvailable();

  if (!this.nativeLegacyWebVRAvailable) {
    if (!this.nativeWebVRAvailable) {
      this.enablePolyfill();
    }
    if (WebVRConfig.ENABLE_DEPRECATED_API) {
      this.enableDeprecatedPolyfill();
    }
  }

  // Put a shim in place to update the API to 1.1 if needed.
  InstallWebVRSpecShim();
}

WebVRPolyfill.prototype.isWebVRAvailable = function() {
  return ('getVRDisplays' in navigator);
};

WebVRPolyfill.prototype.isDeprecatedWebVRAvailable = function() {
  return ('getVRDevices' in navigator) || ('mozGetVRDevices' in navigator);
};

WebVRPolyfill.prototype.populateDevices = function() {
  if (this.devicesPopulated) {
    return;
  }

  // Initialize our virtual VR devices.
  var vrDisplay = null;

  // Add a Cardboard VRDisplay on compatible mobile devices
  if (this.isCardboardCompatible()) {
    vrDisplay = new CardboardVRDisplay();
    this.displays.push(vrDisplay);

    // For backwards compatibility
    if (WebVRConfig.ENABLE_DEPRECATED_API) {
      this.devices.push(new VRDisplayHMDDevice(vrDisplay));
      this.devices.push(new VRDisplayPositionSensorDevice(vrDisplay));
    }
  }

  // Add a Mouse and Keyboard driven VRDisplay for desktops/laptops
  if (!this.isMobile() && !WebVRConfig.MOUSE_KEYBOARD_CONTROLS_DISABLED) {
    vrDisplay = new MouseKeyboardVRDisplay();
    this.displays.push(vrDisplay);

    // For backwards compatibility
    if (WebVRConfig.ENABLE_DEPRECATED_API) {
      this.devices.push(new VRDisplayHMDDevice(vrDisplay));
      this.devices.push(new VRDisplayPositionSensorDevice(vrDisplay));
    }
  }

  // Uncomment to add positional tracking via webcam.
  //if (!this.isMobile() && WebVRConfig.ENABLE_DEPRECATED_API) {
  //  positionDevice = new WebcamPositionSensorVRDevice();
  //  this.devices.push(positionDevice);
  //}

  this.devicesPopulated = true;
};

WebVRPolyfill.prototype.enablePolyfill = function() {
  // Provide navigator.getVRDisplays.
  navigator.getVRDisplays = this.getVRDisplays.bind(this);

  // Provide the VRDisplay object.
  window.VRDisplay = VRDisplay;

  // Provide navigator.vrEnabled.
  var self = this;
  Object.defineProperty(navigator, 'vrEnabled', {
    get: function () {
      return self.isCardboardCompatible() &&
        (document.fullscreenEnabled ||
          document.mozFullScreenEnabled ||
          document.webkitFullscreenEnabled ||
          false);
    }
  });

  // Provide the VRFrameData object.
  window.VRFrameData = VRFrameData;
};

WebVRPolyfill.prototype.enableDeprecatedPolyfill = function() {
  // Provide navigator.getVRDevices.
  navigator.getVRDevices = this.getVRDevices.bind(this);

  // Provide the CardboardHMDVRDevice and PositionSensorVRDevice objects.
  window.HMDVRDevice = HMDVRDevice;
  window.PositionSensorVRDevice = PositionSensorVRDevice;
};

WebVRPolyfill.prototype.getVRDisplays = function() {
  this.populateDevices();
  var displays = this.displays;
  return new Promise(function(resolve, reject) {
    try {
      resolve(displays);
    } catch (e) {
      reject(e);
    }
  });
};

WebVRPolyfill.prototype.getVRDevices = function() {
  console.warn('getVRDevices is deprecated. Please update your code to use getVRDisplays instead.');
  var self = this;
  return new Promise(function(resolve, reject) {
    try {
      if (!self.devicesPopulated) {
        if (self.nativeWebVRAvailable) {
          return navigator.getVRDisplays(function(displays) {
            for (var i = 0; i < displays.length; ++i) {
              self.devices.push(new VRDisplayHMDDevice(displays[i]));
              self.devices.push(new VRDisplayPositionSensorDevice(displays[i]));
            }
            self.devicesPopulated = true;
            resolve(self.devices);
          }, reject);
        }

        if (self.nativeLegacyWebVRAvailable) {
          return (navigator.getVRDDevices || navigator.mozGetVRDevices)(function(devices) {
            for (var i = 0; i < devices.length; ++i) {
              if (devices[i] instanceof HMDVRDevice) {
                self.devices.push(devices[i]);
              }
              if (devices[i] instanceof PositionSensorVRDevice) {
                self.devices.push(devices[i]);
              }
            }
            self.devicesPopulated = true;
            resolve(self.devices);
          }, reject);
        }
      }

      self.populateDevices();
      resolve(self.devices);
    } catch (e) {
      reject(e);
    }
  });
};

/**
 * Determine if a device is mobile.
 */
WebVRPolyfill.prototype.isMobile = function() {
  return /Android/i.test(navigator.userAgent) ||
      /iPhone|iPad|iPod/i.test(navigator.userAgent);
};

WebVRPolyfill.prototype.isCardboardCompatible = function() {
  // For now, support all iOS and Android devices.
  // Also enable the WebVRConfig.FORCE_VR flag for debugging.
  return this.isMobile() || WebVRConfig.FORCE_ENABLE_VR;
};

// Installs a shim that updates a WebVR 1.0 spec implementation to WebVR 1.1
function InstallWebVRSpecShim() {
  if ('VRDisplay' in window && !('VRFrameData' in window)) {
    // Provide the VRFrameData object.
    window.VRFrameData = VRFrameData;

    // A lot of Chrome builds don't have depthNear and depthFar, even
    // though they're in the WebVR 1.0 spec. Patch them in if they're not present.
    if(!('depthNear' in window.VRDisplay.prototype)) {
      window.VRDisplay.prototype.depthNear = 0.01;
    }

    if(!('depthFar' in window.VRDisplay.prototype)) {
      window.VRDisplay.prototype.depthFar = 10000.0;
    }

    window.VRDisplay.prototype.getFrameData = function(frameData) {
      return Util.frameDataFromPose(frameData, this.getPose(), this);
    }
  }
};

module.exports.WebVRPolyfill = WebVRPolyfill;

},{"./base.js":2,"./cardboard-vr-display.js":5,"./display-wrappers.js":8,"./mouse-keyboard-vr-display.js":15,"./util.js":22}]},{},[13])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL2hvbWVicmV3L2xpYi9ub2RlX21vZHVsZXMvd2F0Y2hpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsIm5vZGVfbW9kdWxlcy9vYmplY3QtYXNzaWduL2luZGV4LmpzIiwic3JjL2Jhc2UuanMiLCJzcmMvY2FyZGJvYXJkLWRpc3RvcnRlci5qcyIsInNyYy9jYXJkYm9hcmQtdWkuanMiLCJzcmMvY2FyZGJvYXJkLXZyLWRpc3BsYXkuanMiLCJzcmMvZGVwcy93Z2x1LXByZXNlcnZlLXN0YXRlLmpzIiwic3JjL2RldmljZS1pbmZvLmpzIiwic3JjL2Rpc3BsYXktd3JhcHBlcnMuanMiLCJzcmMvZGlzdG9ydGlvbi9kaXN0b3J0aW9uLmpzIiwic3JjL2RwZGIvZHBkYi1jYWNoZS5qcyIsInNyYy9kcGRiL2RwZGIuanMiLCJzcmMvZW1pdHRlci5qcyIsInNyYy9tYWluLmpzIiwic3JjL21hdGgtdXRpbC5qcyIsInNyYy9tb3VzZS1rZXlib2FyZC12ci1kaXNwbGF5LmpzIiwic3JjL3JvdGF0ZS1pbnN0cnVjdGlvbnMuanMiLCJzcmMvc2Vuc29yLWZ1c2lvbi9jb21wbGVtZW50YXJ5LWZpbHRlci5qcyIsInNyYy9zZW5zb3ItZnVzaW9uL2Z1c2lvbi1wb3NlLXNlbnNvci5qcyIsInNyYy9zZW5zb3ItZnVzaW9uL3Bvc2UtcHJlZGljdG9yLmpzIiwic3JjL3NlbnNvci1mdXNpb24vc2Vuc29yLXNhbXBsZS5qcyIsInNyYy90b3VjaC1wYW5uZXIuanMiLCJzcmMvdXRpbC5qcyIsInNyYy92aWV3ZXItc2VsZWN0b3IuanMiLCJzcmMvd2FrZWxvY2suanMiLCJzcmMvd2VidnItcG9seWZpbGwuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdGNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdG9CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdFJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbktBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3V0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckxBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3o4QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0VBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JXQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2TEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNkQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1WUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2TUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIid1c2Ugc3RyaWN0Jztcbi8qIGVzbGludC1kaXNhYmxlIG5vLXVudXNlZC12YXJzICovXG52YXIgaGFzT3duUHJvcGVydHkgPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5O1xudmFyIHByb3BJc0VudW1lcmFibGUgPSBPYmplY3QucHJvdG90eXBlLnByb3BlcnR5SXNFbnVtZXJhYmxlO1xuXG5mdW5jdGlvbiB0b09iamVjdCh2YWwpIHtcblx0aWYgKHZhbCA9PT0gbnVsbCB8fCB2YWwgPT09IHVuZGVmaW5lZCkge1xuXHRcdHRocm93IG5ldyBUeXBlRXJyb3IoJ09iamVjdC5hc3NpZ24gY2Fubm90IGJlIGNhbGxlZCB3aXRoIG51bGwgb3IgdW5kZWZpbmVkJyk7XG5cdH1cblxuXHRyZXR1cm4gT2JqZWN0KHZhbCk7XG59XG5cbmZ1bmN0aW9uIHNob3VsZFVzZU5hdGl2ZSgpIHtcblx0dHJ5IHtcblx0XHRpZiAoIU9iamVjdC5hc3NpZ24pIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHQvLyBEZXRlY3QgYnVnZ3kgcHJvcGVydHkgZW51bWVyYXRpb24gb3JkZXIgaW4gb2xkZXIgVjggdmVyc2lvbnMuXG5cblx0XHQvLyBodHRwczovL2J1Z3MuY2hyb21pdW0ub3JnL3AvdjgvaXNzdWVzL2RldGFpbD9pZD00MTE4XG5cdFx0dmFyIHRlc3QxID0gbmV3IFN0cmluZygnYWJjJyk7ICAvLyBlc2xpbnQtZGlzYWJsZS1saW5lXG5cdFx0dGVzdDFbNV0gPSAnZGUnO1xuXHRcdGlmIChPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyh0ZXN0MSlbMF0gPT09ICc1Jykge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdC8vIGh0dHBzOi8vYnVncy5jaHJvbWl1bS5vcmcvcC92OC9pc3N1ZXMvZGV0YWlsP2lkPTMwNTZcblx0XHR2YXIgdGVzdDIgPSB7fTtcblx0XHRmb3IgKHZhciBpID0gMDsgaSA8IDEwOyBpKyspIHtcblx0XHRcdHRlc3QyWydfJyArIFN0cmluZy5mcm9tQ2hhckNvZGUoaSldID0gaTtcblx0XHR9XG5cdFx0dmFyIG9yZGVyMiA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKHRlc3QyKS5tYXAoZnVuY3Rpb24gKG4pIHtcblx0XHRcdHJldHVybiB0ZXN0MltuXTtcblx0XHR9KTtcblx0XHRpZiAob3JkZXIyLmpvaW4oJycpICE9PSAnMDEyMzQ1Njc4OScpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHQvLyBodHRwczovL2J1Z3MuY2hyb21pdW0ub3JnL3AvdjgvaXNzdWVzL2RldGFpbD9pZD0zMDU2XG5cdFx0dmFyIHRlc3QzID0ge307XG5cdFx0J2FiY2RlZmdoaWprbG1ub3BxcnN0Jy5zcGxpdCgnJykuZm9yRWFjaChmdW5jdGlvbiAobGV0dGVyKSB7XG5cdFx0XHR0ZXN0M1tsZXR0ZXJdID0gbGV0dGVyO1xuXHRcdH0pO1xuXHRcdGlmIChPYmplY3Qua2V5cyhPYmplY3QuYXNzaWduKHt9LCB0ZXN0MykpLmpvaW4oJycpICE9PVxuXHRcdFx0XHQnYWJjZGVmZ2hpamtsbW5vcHFyc3QnKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRydWU7XG5cdH0gY2F0Y2ggKGUpIHtcblx0XHQvLyBXZSBkb24ndCBleHBlY3QgYW55IG9mIHRoZSBhYm92ZSB0byB0aHJvdywgYnV0IGJldHRlciB0byBiZSBzYWZlLlxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHNob3VsZFVzZU5hdGl2ZSgpID8gT2JqZWN0LmFzc2lnbiA6IGZ1bmN0aW9uICh0YXJnZXQsIHNvdXJjZSkge1xuXHR2YXIgZnJvbTtcblx0dmFyIHRvID0gdG9PYmplY3QodGFyZ2V0KTtcblx0dmFyIHN5bWJvbHM7XG5cblx0Zm9yICh2YXIgcyA9IDE7IHMgPCBhcmd1bWVudHMubGVuZ3RoOyBzKyspIHtcblx0XHRmcm9tID0gT2JqZWN0KGFyZ3VtZW50c1tzXSk7XG5cblx0XHRmb3IgKHZhciBrZXkgaW4gZnJvbSkge1xuXHRcdFx0aWYgKGhhc093blByb3BlcnR5LmNhbGwoZnJvbSwga2V5KSkge1xuXHRcdFx0XHR0b1trZXldID0gZnJvbVtrZXldO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChPYmplY3QuZ2V0T3duUHJvcGVydHlTeW1ib2xzKSB7XG5cdFx0XHRzeW1ib2xzID0gT2JqZWN0LmdldE93blByb3BlcnR5U3ltYm9scyhmcm9tKTtcblx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgc3ltYm9scy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRpZiAocHJvcElzRW51bWVyYWJsZS5jYWxsKGZyb20sIHN5bWJvbHNbaV0pKSB7XG5cdFx0XHRcdFx0dG9bc3ltYm9sc1tpXV0gPSBmcm9tW3N5bWJvbHNbaV1dO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIHRvO1xufTtcbiIsIi8qXG4gKiBDb3B5cmlnaHQgMjAxNSBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICogTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcbiAqIHlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cbiAqIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuICpcbiAqICAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcbiAqXG4gKiBVbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG4gKiBkaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG4gKiBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cbiAqIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbiAqIGxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuICovXG5cbnZhciBVdGlsID0gcmVxdWlyZSgnLi91dGlsLmpzJyk7XG52YXIgV2FrZUxvY2sgPSByZXF1aXJlKCcuL3dha2Vsb2NrLmpzJyk7XG5cbi8vIFN0YXJ0IGF0IGEgaGlnaGVyIG51bWJlciB0byByZWR1Y2UgY2hhbmNlIG9mIGNvbmZsaWN0LlxudmFyIG5leHREaXNwbGF5SWQgPSAxMDAwO1xudmFyIGhhc1Nob3dEZXByZWNhdGlvbldhcm5pbmcgPSBmYWxzZTtcblxudmFyIGRlZmF1bHRMZWZ0Qm91bmRzID0gWzAsIDAsIDAuNSwgMV07XG52YXIgZGVmYXVsdFJpZ2h0Qm91bmRzID0gWzAuNSwgMCwgMC41LCAxXTtcblxuLyoqXG4gKiBUaGUgYmFzZSBjbGFzcyBmb3IgYWxsIFZSIGZyYW1lIGRhdGEuXG4gKi9cblxuZnVuY3Rpb24gVlJGcmFtZURhdGEoKSB7XG4gIHRoaXMubGVmdFByb2plY3Rpb25NYXRyaXggPSBuZXcgRmxvYXQzMkFycmF5KDE2KTtcbiAgdGhpcy5sZWZ0Vmlld01hdHJpeCA9IG5ldyBGbG9hdDMyQXJyYXkoMTYpO1xuICB0aGlzLnJpZ2h0UHJvamVjdGlvbk1hdHJpeCA9IG5ldyBGbG9hdDMyQXJyYXkoMTYpO1xuICB0aGlzLnJpZ2h0Vmlld01hdHJpeCA9IG5ldyBGbG9hdDMyQXJyYXkoMTYpO1xuICB0aGlzLnBvc2UgPSBudWxsO1xufTtcblxuLyoqXG4gKiBUaGUgYmFzZSBjbGFzcyBmb3IgYWxsIFZSIGRpc3BsYXlzLlxuICovXG5mdW5jdGlvbiBWUkRpc3BsYXkoKSB7XG4gIHRoaXMuaXNQb2x5ZmlsbGVkID0gdHJ1ZTtcbiAgdGhpcy5kaXNwbGF5SWQgPSBuZXh0RGlzcGxheUlkKys7XG4gIHRoaXMuZGlzcGxheU5hbWUgPSAnd2VidnItcG9seWZpbGwgZGlzcGxheU5hbWUnO1xuXG4gIHRoaXMuZGVwdGhOZWFyID0gMC4wMTtcbiAgdGhpcy5kZXB0aEZhciA9IDEwMDAwLjA7XG5cbiAgdGhpcy5pc0Nvbm5lY3RlZCA9IHRydWU7XG4gIHRoaXMuaXNQcmVzZW50aW5nID0gZmFsc2U7XG4gIHRoaXMuY2FwYWJpbGl0aWVzID0ge1xuICAgIGhhc1Bvc2l0aW9uOiBmYWxzZSxcbiAgICBoYXNPcmllbnRhdGlvbjogZmFsc2UsXG4gICAgaGFzRXh0ZXJuYWxEaXNwbGF5OiBmYWxzZSxcbiAgICBjYW5QcmVzZW50OiBmYWxzZSxcbiAgICBtYXhMYXllcnM6IDFcbiAgfTtcbiAgdGhpcy5zdGFnZVBhcmFtZXRlcnMgPSBudWxsO1xuXG4gIC8vIFwiUHJpdmF0ZVwiIG1lbWJlcnMuXG4gIHRoaXMud2FpdGluZ0ZvclByZXNlbnRfID0gZmFsc2U7XG4gIHRoaXMubGF5ZXJfID0gbnVsbDtcblxuICB0aGlzLmZ1bGxzY3JlZW5FbGVtZW50XyA9IG51bGw7XG4gIHRoaXMuZnVsbHNjcmVlbldyYXBwZXJfID0gbnVsbDtcbiAgdGhpcy5mdWxsc2NyZWVuRWxlbWVudENhY2hlZFN0eWxlXyA9IG51bGw7XG5cbiAgdGhpcy5mdWxsc2NyZWVuRXZlbnRUYXJnZXRfID0gbnVsbDtcbiAgdGhpcy5mdWxsc2NyZWVuQ2hhbmdlSGFuZGxlcl8gPSBudWxsO1xuICB0aGlzLmZ1bGxzY3JlZW5FcnJvckhhbmRsZXJfID0gbnVsbDtcblxuICB0aGlzLndha2Vsb2NrXyA9IG5ldyBXYWtlTG9jaygpO1xufVxuXG5WUkRpc3BsYXkucHJvdG90eXBlLmdldEZyYW1lRGF0YSA9IGZ1bmN0aW9uKGZyYW1lRGF0YSkge1xuICAvLyBUT0RPOiBUZWNobmljYWxseSB0aGlzIHNob3VsZCByZXRhaW4gaXQncyB2YWx1ZSBmb3IgdGhlIGR1cmF0aW9uIG9mIGEgZnJhbWVcbiAgLy8gYnV0IEkgZG91YnQgdGhhdCdzIHByYWN0aWNhbCB0byBkbyBpbiBqYXZhc2NyaXB0LlxuICByZXR1cm4gVXRpbC5mcmFtZURhdGFGcm9tUG9zZShmcmFtZURhdGEsIHRoaXMuZ2V0UG9zZSgpLCB0aGlzKTtcbn07XG5cblZSRGlzcGxheS5wcm90b3R5cGUuZ2V0UG9zZSA9IGZ1bmN0aW9uKCkge1xuICAvLyBUT0RPOiBUZWNobmljYWxseSB0aGlzIHNob3VsZCByZXRhaW4gaXQncyB2YWx1ZSBmb3IgdGhlIGR1cmF0aW9uIG9mIGEgZnJhbWVcbiAgLy8gYnV0IEkgZG91YnQgdGhhdCdzIHByYWN0aWNhbCB0byBkbyBpbiBqYXZhc2NyaXB0LlxuICByZXR1cm4gdGhpcy5nZXRJbW1lZGlhdGVQb3NlKCk7XG59O1xuXG5WUkRpc3BsYXkucHJvdG90eXBlLnJlcXVlc3RBbmltYXRpb25GcmFtZSA9IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gIHJldHVybiB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKGNhbGxiYWNrKTtcbn07XG5cblZSRGlzcGxheS5wcm90b3R5cGUuY2FuY2VsQW5pbWF0aW9uRnJhbWUgPSBmdW5jdGlvbihpZCkge1xuICByZXR1cm4gd2luZG93LmNhbmNlbEFuaW1hdGlvbkZyYW1lKGlkKTtcbn07XG5cblZSRGlzcGxheS5wcm90b3R5cGUud3JhcEZvckZ1bGxzY3JlZW4gPSBmdW5jdGlvbihlbGVtZW50KSB7XG4gIC8vIERvbid0IHdyYXAgaW4gaU9TLlxuICBpZiAoVXRpbC5pc0lPUygpKSB7XG4gICAgcmV0dXJuIGVsZW1lbnQ7XG4gIH1cbiAgaWYgKCF0aGlzLmZ1bGxzY3JlZW5XcmFwcGVyXykge1xuICAgIHRoaXMuZnVsbHNjcmVlbldyYXBwZXJfID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgdmFyIGNzc1Byb3BlcnRpZXMgPSBbXG4gICAgICAnaGVpZ2h0OiAnICsgTWF0aC5taW4oc2NyZWVuLmhlaWdodCwgc2NyZWVuLndpZHRoKSArICdweCAhaW1wb3J0YW50JyxcbiAgICAgICd0b3A6IDAgIWltcG9ydGFudCcsXG4gICAgICAnbGVmdDogMCAhaW1wb3J0YW50JyxcbiAgICAgICdyaWdodDogMCAhaW1wb3J0YW50JyxcbiAgICAgICdib3JkZXI6IDAnLFxuICAgICAgJ21hcmdpbjogMCcsXG4gICAgICAncGFkZGluZzogMCcsXG4gICAgICAnei1pbmRleDogOTk5OTk5ICFpbXBvcnRhbnQnLFxuICAgICAgJ3Bvc2l0aW9uOiBmaXhlZCcsXG4gICAgXTtcbiAgICB0aGlzLmZ1bGxzY3JlZW5XcmFwcGVyXy5zZXRBdHRyaWJ1dGUoJ3N0eWxlJywgY3NzUHJvcGVydGllcy5qb2luKCc7ICcpICsgJzsnKTtcbiAgICB0aGlzLmZ1bGxzY3JlZW5XcmFwcGVyXy5jbGFzc0xpc3QuYWRkKCd3ZWJ2ci1wb2x5ZmlsbC1mdWxsc2NyZWVuLXdyYXBwZXInKTtcbiAgfVxuXG4gIGlmICh0aGlzLmZ1bGxzY3JlZW5FbGVtZW50XyA9PSBlbGVtZW50KSB7XG4gICAgcmV0dXJuIHRoaXMuZnVsbHNjcmVlbldyYXBwZXJfO1xuICB9XG5cbiAgLy8gUmVtb3ZlIGFueSBwcmV2aW91c2x5IGFwcGxpZWQgd3JhcHBlcnNcbiAgdGhpcy5yZW1vdmVGdWxsc2NyZWVuV3JhcHBlcigpO1xuXG4gIHRoaXMuZnVsbHNjcmVlbkVsZW1lbnRfID0gZWxlbWVudDtcbiAgdmFyIHBhcmVudCA9IHRoaXMuZnVsbHNjcmVlbkVsZW1lbnRfLnBhcmVudEVsZW1lbnQ7XG4gIHBhcmVudC5pbnNlcnRCZWZvcmUodGhpcy5mdWxsc2NyZWVuV3JhcHBlcl8sIHRoaXMuZnVsbHNjcmVlbkVsZW1lbnRfKTtcbiAgcGFyZW50LnJlbW92ZUNoaWxkKHRoaXMuZnVsbHNjcmVlbkVsZW1lbnRfKTtcbiAgdGhpcy5mdWxsc2NyZWVuV3JhcHBlcl8uaW5zZXJ0QmVmb3JlKHRoaXMuZnVsbHNjcmVlbkVsZW1lbnRfLCB0aGlzLmZ1bGxzY3JlZW5XcmFwcGVyXy5maXJzdENoaWxkKTtcbiAgdGhpcy5mdWxsc2NyZWVuRWxlbWVudENhY2hlZFN0eWxlXyA9IHRoaXMuZnVsbHNjcmVlbkVsZW1lbnRfLmdldEF0dHJpYnV0ZSgnc3R5bGUnKTtcblxuICB2YXIgc2VsZiA9IHRoaXM7XG4gIGZ1bmN0aW9uIGFwcGx5RnVsbHNjcmVlbkVsZW1lbnRTdHlsZSgpIHtcbiAgICBpZiAoIXNlbGYuZnVsbHNjcmVlbkVsZW1lbnRfKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdmFyIGNzc1Byb3BlcnRpZXMgPSBbXG4gICAgICAncG9zaXRpb246IGFic29sdXRlJyxcbiAgICAgICd0b3A6IDAnLFxuICAgICAgJ2xlZnQ6IDAnLFxuICAgICAgJ3dpZHRoOiAnICsgTWF0aC5tYXgoc2NyZWVuLndpZHRoLCBzY3JlZW4uaGVpZ2h0KSArICdweCcsXG4gICAgICAnaGVpZ2h0OiAnICsgTWF0aC5taW4oc2NyZWVuLmhlaWdodCwgc2NyZWVuLndpZHRoKSArICdweCcsXG4gICAgICAnYm9yZGVyOiAwJyxcbiAgICAgICdtYXJnaW46IDAnLFxuICAgICAgJ3BhZGRpbmc6IDAnLFxuICAgIF07XG4gICAgc2VsZi5mdWxsc2NyZWVuRWxlbWVudF8uc2V0QXR0cmlidXRlKCdzdHlsZScsIGNzc1Byb3BlcnRpZXMuam9pbignOyAnKSArICc7Jyk7XG4gIH1cblxuICBhcHBseUZ1bGxzY3JlZW5FbGVtZW50U3R5bGUoKTtcblxuICByZXR1cm4gdGhpcy5mdWxsc2NyZWVuV3JhcHBlcl87XG59O1xuXG5WUkRpc3BsYXkucHJvdG90eXBlLnJlbW92ZUZ1bGxzY3JlZW5XcmFwcGVyID0gZnVuY3Rpb24oKSB7XG4gIGlmICghdGhpcy5mdWxsc2NyZWVuRWxlbWVudF8pIHtcbiAgICByZXR1cm47XG4gIH1cblxuICB2YXIgZWxlbWVudCA9IHRoaXMuZnVsbHNjcmVlbkVsZW1lbnRfO1xuICBpZiAodGhpcy5mdWxsc2NyZWVuRWxlbWVudENhY2hlZFN0eWxlXykge1xuICAgIGVsZW1lbnQuc2V0QXR0cmlidXRlKCdzdHlsZScsIHRoaXMuZnVsbHNjcmVlbkVsZW1lbnRDYWNoZWRTdHlsZV8pO1xuICB9IGVsc2Uge1xuICAgIGVsZW1lbnQucmVtb3ZlQXR0cmlidXRlKCdzdHlsZScpO1xuICB9XG4gIHRoaXMuZnVsbHNjcmVlbkVsZW1lbnRfID0gbnVsbDtcbiAgdGhpcy5mdWxsc2NyZWVuRWxlbWVudENhY2hlZFN0eWxlXyA9IG51bGw7XG5cbiAgdmFyIHBhcmVudCA9IHRoaXMuZnVsbHNjcmVlbldyYXBwZXJfLnBhcmVudEVsZW1lbnQ7XG4gIHRoaXMuZnVsbHNjcmVlbldyYXBwZXJfLnJlbW92ZUNoaWxkKGVsZW1lbnQpO1xuICBwYXJlbnQuaW5zZXJ0QmVmb3JlKGVsZW1lbnQsIHRoaXMuZnVsbHNjcmVlbldyYXBwZXJfKTtcbiAgcGFyZW50LnJlbW92ZUNoaWxkKHRoaXMuZnVsbHNjcmVlbldyYXBwZXJfKTtcblxuICByZXR1cm4gZWxlbWVudDtcbn07XG5cblZSRGlzcGxheS5wcm90b3R5cGUucmVxdWVzdFByZXNlbnQgPSBmdW5jdGlvbihsYXllcnMpIHtcbiAgdmFyIHdhc1ByZXNlbnRpbmcgPSB0aGlzLmlzUHJlc2VudGluZztcbiAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gIGlmICghKGxheWVycyBpbnN0YW5jZW9mIEFycmF5KSkge1xuICAgIGlmICghaGFzU2hvd0RlcHJlY2F0aW9uV2FybmluZykge1xuICAgICAgY29uc29sZS53YXJuKFwiVXNpbmcgYSBkZXByZWNhdGVkIGZvcm0gb2YgcmVxdWVzdFByZXNlbnQuIFNob3VsZCBwYXNzIGluIGFuIGFycmF5IG9mIFZSTGF5ZXJzLlwiKTtcbiAgICAgIGhhc1Nob3dEZXByZWNhdGlvbldhcm5pbmcgPSB0cnVlO1xuICAgIH1cbiAgICBsYXllcnMgPSBbbGF5ZXJzXTtcbiAgfVxuXG4gIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICBpZiAoIXNlbGYuY2FwYWJpbGl0aWVzLmNhblByZXNlbnQpIHtcbiAgICAgIHJlamVjdChuZXcgRXJyb3IoJ1ZSRGlzcGxheSBpcyBub3QgY2FwYWJsZSBvZiBwcmVzZW50aW5nLicpKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAobGF5ZXJzLmxlbmd0aCA9PSAwIHx8IGxheWVycy5sZW5ndGggPiBzZWxmLmNhcGFiaWxpdGllcy5tYXhMYXllcnMpIHtcbiAgICAgIHJlamVjdChuZXcgRXJyb3IoJ0ludmFsaWQgbnVtYmVyIG9mIGxheWVycy4nKSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdmFyIGluY29taW5nTGF5ZXIgPSBsYXllcnNbMF07XG4gICAgaWYgKCFpbmNvbWluZ0xheWVyLnNvdXJjZSkge1xuICAgICAgLypcbiAgICAgIHRvZG86IGZpZ3VyZSBvdXQgdGhlIGNvcnJlY3QgYmVoYXZpb3IgaWYgdGhlIHNvdXJjZSBpcyBub3QgcHJvdmlkZWQuXG4gICAgICBzZWUgaHR0cHM6Ly9naXRodWIuY29tL3czYy93ZWJ2ci9pc3N1ZXMvNThcbiAgICAgICovXG4gICAgICByZXNvbHZlKCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdmFyIGxlZnRCb3VuZHMgPSBpbmNvbWluZ0xheWVyLmxlZnRCb3VuZHMgfHwgZGVmYXVsdExlZnRCb3VuZHM7XG4gICAgdmFyIHJpZ2h0Qm91bmRzID0gaW5jb21pbmdMYXllci5yaWdodEJvdW5kcyB8fCBkZWZhdWx0UmlnaHRCb3VuZHM7XG4gICAgaWYgKHdhc1ByZXNlbnRpbmcpIHtcbiAgICAgIC8vIEFscmVhZHkgcHJlc2VudGluZywganVzdCBjaGFuZ2luZyBjb25maWd1cmF0aW9uXG4gICAgICB2YXIgY2hhbmdlZCA9IGZhbHNlO1xuICAgICAgdmFyIGxheWVyID0gc2VsZi5sYXllcl87XG4gICAgICBpZiAobGF5ZXIuc291cmNlICE9PSBpbmNvbWluZ0xheWVyLnNvdXJjZSkge1xuICAgICAgICBsYXllci5zb3VyY2UgPSBpbmNvbWluZ0xheWVyLnNvdXJjZTtcbiAgICAgICAgY2hhbmdlZCA9IHRydWU7XG4gICAgICB9XG5cbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgNDsgaSsrKSB7XG4gICAgICAgIGlmIChsYXllci5sZWZ0Qm91bmRzW2ldICE9PSBsZWZ0Qm91bmRzW2ldKSB7XG4gICAgICAgICAgbGF5ZXIubGVmdEJvdW5kc1tpXSA9IGxlZnRCb3VuZHNbaV07XG4gICAgICAgICAgY2hhbmdlZCA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGxheWVyLnJpZ2h0Qm91bmRzW2ldICE9PSByaWdodEJvdW5kc1tpXSkge1xuICAgICAgICAgIGxheWVyLnJpZ2h0Qm91bmRzW2ldID0gcmlnaHRCb3VuZHNbaV07XG4gICAgICAgICAgY2hhbmdlZCA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKGNoYW5nZWQpIHtcbiAgICAgICAgc2VsZi5maXJlVlJEaXNwbGF5UHJlc2VudENoYW5nZV8oKTtcbiAgICAgIH1cbiAgICAgIHJlc29sdmUoKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBXYXMgbm90IGFscmVhZHkgcHJlc2VudGluZy5cbiAgICBzZWxmLmxheWVyXyA9IHtcbiAgICAgIHByZWRpc3RvcnRlZDogaW5jb21pbmdMYXllci5wcmVkaXN0b3J0ZWQsXG4gICAgICBzb3VyY2U6IGluY29taW5nTGF5ZXIuc291cmNlLFxuICAgICAgbGVmdEJvdW5kczogbGVmdEJvdW5kcy5zbGljZSgwKSxcbiAgICAgIHJpZ2h0Qm91bmRzOiByaWdodEJvdW5kcy5zbGljZSgwKVxuICAgIH07XG5cbiAgICBzZWxmLndhaXRpbmdGb3JQcmVzZW50XyA9IGZhbHNlO1xuICAgIGlmIChzZWxmLmxheWVyXyAmJiBzZWxmLmxheWVyXy5zb3VyY2UpIHtcbiAgICAgIHZhciBmdWxsc2NyZWVuRWxlbWVudCA9IHNlbGYud3JhcEZvckZ1bGxzY3JlZW4oc2VsZi5sYXllcl8uc291cmNlKTtcblxuICAgICAgZnVuY3Rpb24gb25GdWxsc2NyZWVuQ2hhbmdlKCkge1xuICAgICAgICB2YXIgYWN0dWFsRnVsbHNjcmVlbkVsZW1lbnQgPSBVdGlsLmdldEZ1bGxzY3JlZW5FbGVtZW50KCk7XG5cbiAgICAgICAgc2VsZi5pc1ByZXNlbnRpbmcgPSAoZnVsbHNjcmVlbkVsZW1lbnQgPT09IGFjdHVhbEZ1bGxzY3JlZW5FbGVtZW50KTtcbiAgICAgICAgaWYgKHNlbGYuaXNQcmVzZW50aW5nKSB7XG4gICAgICAgICAgaWYgKHNjcmVlbi5vcmllbnRhdGlvbiAmJiBzY3JlZW4ub3JpZW50YXRpb24ubG9jaykge1xuICAgICAgICAgICAgc2NyZWVuLm9yaWVudGF0aW9uLmxvY2soJ2xhbmRzY2FwZS1wcmltYXJ5JykuY2F0Y2goZnVuY3Rpb24oZXJyb3Ipe1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdzY3JlZW4ub3JpZW50YXRpb24ubG9jaygpIGZhaWxlZCBkdWUgdG8nLCBlcnJvci5tZXNzYWdlKVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHNlbGYud2FpdGluZ0ZvclByZXNlbnRfID0gZmFsc2U7XG4gICAgICAgICAgc2VsZi5iZWdpblByZXNlbnRfKCk7XG4gICAgICAgICAgcmVzb2x2ZSgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGlmIChzY3JlZW4ub3JpZW50YXRpb24gJiYgc2NyZWVuLm9yaWVudGF0aW9uLnVubG9jaykge1xuICAgICAgICAgICAgc2NyZWVuLm9yaWVudGF0aW9uLnVubG9jaygpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBzZWxmLnJlbW92ZUZ1bGxzY3JlZW5XcmFwcGVyKCk7XG4gICAgICAgICAgc2VsZi53YWtlbG9ja18ucmVsZWFzZSgpO1xuICAgICAgICAgIHNlbGYuZW5kUHJlc2VudF8oKTtcbiAgICAgICAgICBzZWxmLnJlbW92ZUZ1bGxzY3JlZW5MaXN0ZW5lcnNfKCk7XG4gICAgICAgIH1cbiAgICAgICAgc2VsZi5maXJlVlJEaXNwbGF5UHJlc2VudENoYW5nZV8oKTtcbiAgICAgIH1cbiAgICAgIGZ1bmN0aW9uIG9uRnVsbHNjcmVlbkVycm9yKCkge1xuICAgICAgICBpZiAoIXNlbGYud2FpdGluZ0ZvclByZXNlbnRfKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgc2VsZi5yZW1vdmVGdWxsc2NyZWVuV3JhcHBlcigpO1xuICAgICAgICBzZWxmLnJlbW92ZUZ1bGxzY3JlZW5MaXN0ZW5lcnNfKCk7XG5cbiAgICAgICAgc2VsZi53YWtlbG9ja18ucmVsZWFzZSgpO1xuICAgICAgICBzZWxmLndhaXRpbmdGb3JQcmVzZW50XyA9IGZhbHNlO1xuICAgICAgICBzZWxmLmlzUHJlc2VudGluZyA9IGZhbHNlO1xuXG4gICAgICAgIHJlamVjdChuZXcgRXJyb3IoJ1VuYWJsZSB0byBwcmVzZW50LicpKTtcbiAgICAgIH1cblxuICAgICAgc2VsZi5hZGRGdWxsc2NyZWVuTGlzdGVuZXJzXyhmdWxsc2NyZWVuRWxlbWVudCxcbiAgICAgICAgICBvbkZ1bGxzY3JlZW5DaGFuZ2UsIG9uRnVsbHNjcmVlbkVycm9yKTtcblxuICAgICAgaWYgKFV0aWwucmVxdWVzdEZ1bGxzY3JlZW4oZnVsbHNjcmVlbkVsZW1lbnQpKSB7XG4gICAgICAgIHNlbGYud2FrZWxvY2tfLnJlcXVlc3QoKTtcbiAgICAgICAgc2VsZi53YWl0aW5nRm9yUHJlc2VudF8gPSB0cnVlO1xuICAgICAgfSBlbHNlIGlmIChVdGlsLmlzSU9TKCkpIHtcbiAgICAgICAgLy8gKnNpZ2gqIEp1c3QgZmFrZSBpdC5cbiAgICAgICAgc2VsZi53YWtlbG9ja18ucmVxdWVzdCgpO1xuICAgICAgICBzZWxmLmlzUHJlc2VudGluZyA9IHRydWU7XG4gICAgICAgIHNlbGYuYmVnaW5QcmVzZW50XygpO1xuICAgICAgICBzZWxmLmZpcmVWUkRpc3BsYXlQcmVzZW50Q2hhbmdlXygpO1xuICAgICAgICByZXNvbHZlKCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKCFzZWxmLndhaXRpbmdGb3JQcmVzZW50XyAmJiAhVXRpbC5pc0lPUygpKSB7XG4gICAgICBVdGlsLmV4aXRGdWxsc2NyZWVuKCk7XG4gICAgICByZWplY3QobmV3IEVycm9yKCdVbmFibGUgdG8gcHJlc2VudC4nKSk7XG4gICAgfVxuICB9KTtcbn07XG5cblZSRGlzcGxheS5wcm90b3R5cGUuZXhpdFByZXNlbnQgPSBmdW5jdGlvbigpIHtcbiAgdmFyIHdhc1ByZXNlbnRpbmcgPSB0aGlzLmlzUHJlc2VudGluZztcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICB0aGlzLmlzUHJlc2VudGluZyA9IGZhbHNlO1xuICB0aGlzLmxheWVyXyA9IG51bGw7XG4gIHRoaXMud2FrZWxvY2tfLnJlbGVhc2UoKTtcblxuICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgaWYgKHdhc1ByZXNlbnRpbmcpIHtcbiAgICAgIGlmICghVXRpbC5leGl0RnVsbHNjcmVlbigpICYmIFV0aWwuaXNJT1MoKSkge1xuICAgICAgICBzZWxmLmVuZFByZXNlbnRfKCk7XG4gICAgICAgIHNlbGYuZmlyZVZSRGlzcGxheVByZXNlbnRDaGFuZ2VfKCk7XG4gICAgICB9XG5cbiAgICAgIHJlc29sdmUoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVqZWN0KG5ldyBFcnJvcignV2FzIG5vdCBwcmVzZW50aW5nIHRvIFZSRGlzcGxheS4nKSk7XG4gICAgfVxuICB9KTtcbn07XG5cblZSRGlzcGxheS5wcm90b3R5cGUuZ2V0TGF5ZXJzID0gZnVuY3Rpb24oKSB7XG4gIGlmICh0aGlzLmxheWVyXykge1xuICAgIHJldHVybiBbdGhpcy5sYXllcl9dO1xuICB9XG4gIHJldHVybiBbXTtcbn07XG5cblZSRGlzcGxheS5wcm90b3R5cGUuZmlyZVZSRGlzcGxheVByZXNlbnRDaGFuZ2VfID0gZnVuY3Rpb24oKSB7XG4gIHZhciBldmVudCA9IG5ldyBDdXN0b21FdmVudCgndnJkaXNwbGF5cHJlc2VudGNoYW5nZScsIHtkZXRhaWw6IHt2cmRpc3BsYXk6IHRoaXN9fSk7XG4gIHdpbmRvdy5kaXNwYXRjaEV2ZW50KGV2ZW50KTtcbn07XG5cblZSRGlzcGxheS5wcm90b3R5cGUuYWRkRnVsbHNjcmVlbkxpc3RlbmVyc18gPSBmdW5jdGlvbihlbGVtZW50LCBjaGFuZ2VIYW5kbGVyLCBlcnJvckhhbmRsZXIpIHtcbiAgdGhpcy5yZW1vdmVGdWxsc2NyZWVuTGlzdGVuZXJzXygpO1xuXG4gIHRoaXMuZnVsbHNjcmVlbkV2ZW50VGFyZ2V0XyA9IGVsZW1lbnQ7XG4gIHRoaXMuZnVsbHNjcmVlbkNoYW5nZUhhbmRsZXJfID0gY2hhbmdlSGFuZGxlcjtcbiAgdGhpcy5mdWxsc2NyZWVuRXJyb3JIYW5kbGVyXyA9IGVycm9ySGFuZGxlcjtcblxuICBpZiAoY2hhbmdlSGFuZGxlcikge1xuICAgIGlmIChkb2N1bWVudC5mdWxsc2NyZWVuRW5hYmxlZCkge1xuICAgICAgZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdmdWxsc2NyZWVuY2hhbmdlJywgY2hhbmdlSGFuZGxlciwgZmFsc2UpO1xuICAgIH0gZWxzZSBpZiAoZG9jdW1lbnQud2Via2l0RnVsbHNjcmVlbkVuYWJsZWQpIHtcbiAgICAgIGVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignd2Via2l0ZnVsbHNjcmVlbmNoYW5nZScsIGNoYW5nZUhhbmRsZXIsIGZhbHNlKTtcbiAgICB9IGVsc2UgaWYgKGRvY3VtZW50Lm1vekZ1bGxTY3JlZW5FbmFibGVkKSB7XG4gICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdtb3pmdWxsc2NyZWVuY2hhbmdlJywgY2hhbmdlSGFuZGxlciwgZmFsc2UpO1xuICAgIH0gZWxzZSBpZiAoZG9jdW1lbnQubXNGdWxsc2NyZWVuRW5hYmxlZCkge1xuICAgICAgZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdtc2Z1bGxzY3JlZW5jaGFuZ2UnLCBjaGFuZ2VIYW5kbGVyLCBmYWxzZSk7XG4gICAgfVxuICB9XG5cbiAgaWYgKGVycm9ySGFuZGxlcikge1xuICAgIGlmIChkb2N1bWVudC5mdWxsc2NyZWVuRW5hYmxlZCkge1xuICAgICAgZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdmdWxsc2NyZWVuZXJyb3InLCBlcnJvckhhbmRsZXIsIGZhbHNlKTtcbiAgICB9IGVsc2UgaWYgKGRvY3VtZW50LndlYmtpdEZ1bGxzY3JlZW5FbmFibGVkKSB7XG4gICAgICBlbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ3dlYmtpdGZ1bGxzY3JlZW5lcnJvcicsIGVycm9ySGFuZGxlciwgZmFsc2UpO1xuICAgIH0gZWxzZSBpZiAoZG9jdW1lbnQubW96RnVsbFNjcmVlbkVuYWJsZWQpIHtcbiAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ21vemZ1bGxzY3JlZW5lcnJvcicsIGVycm9ySGFuZGxlciwgZmFsc2UpO1xuICAgIH0gZWxzZSBpZiAoZG9jdW1lbnQubXNGdWxsc2NyZWVuRW5hYmxlZCkge1xuICAgICAgZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdtc2Z1bGxzY3JlZW5lcnJvcicsIGVycm9ySGFuZGxlciwgZmFsc2UpO1xuICAgIH1cbiAgfVxufTtcblxuVlJEaXNwbGF5LnByb3RvdHlwZS5yZW1vdmVGdWxsc2NyZWVuTGlzdGVuZXJzXyA9IGZ1bmN0aW9uKCkge1xuICBpZiAoIXRoaXMuZnVsbHNjcmVlbkV2ZW50VGFyZ2V0XylcbiAgICByZXR1cm47XG5cbiAgdmFyIGVsZW1lbnQgPSB0aGlzLmZ1bGxzY3JlZW5FdmVudFRhcmdldF87XG5cbiAgaWYgKHRoaXMuZnVsbHNjcmVlbkNoYW5nZUhhbmRsZXJfKSB7XG4gICAgdmFyIGNoYW5nZUhhbmRsZXIgPSB0aGlzLmZ1bGxzY3JlZW5DaGFuZ2VIYW5kbGVyXztcbiAgICBlbGVtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2Z1bGxzY3JlZW5jaGFuZ2UnLCBjaGFuZ2VIYW5kbGVyLCBmYWxzZSk7XG4gICAgZWxlbWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCd3ZWJraXRmdWxsc2NyZWVuY2hhbmdlJywgY2hhbmdlSGFuZGxlciwgZmFsc2UpO1xuICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vemZ1bGxzY3JlZW5jaGFuZ2UnLCBjaGFuZ2VIYW5kbGVyLCBmYWxzZSk7XG4gICAgZWxlbWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdtc2Z1bGxzY3JlZW5jaGFuZ2UnLCBjaGFuZ2VIYW5kbGVyLCBmYWxzZSk7XG4gIH1cblxuICBpZiAodGhpcy5mdWxsc2NyZWVuRXJyb3JIYW5kbGVyXykge1xuICAgIHZhciBlcnJvckhhbmRsZXIgPSB0aGlzLmZ1bGxzY3JlZW5FcnJvckhhbmRsZXJfO1xuICAgIGVsZW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignZnVsbHNjcmVlbmVycm9yJywgZXJyb3JIYW5kbGVyLCBmYWxzZSk7XG4gICAgZWxlbWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCd3ZWJraXRmdWxsc2NyZWVuZXJyb3InLCBlcnJvckhhbmRsZXIsIGZhbHNlKTtcbiAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3pmdWxsc2NyZWVuZXJyb3InLCBlcnJvckhhbmRsZXIsIGZhbHNlKTtcbiAgICBlbGVtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21zZnVsbHNjcmVlbmVycm9yJywgZXJyb3JIYW5kbGVyLCBmYWxzZSk7XG4gIH1cblxuICB0aGlzLmZ1bGxzY3JlZW5FdmVudFRhcmdldF8gPSBudWxsO1xuICB0aGlzLmZ1bGxzY3JlZW5DaGFuZ2VIYW5kbGVyXyA9IG51bGw7XG4gIHRoaXMuZnVsbHNjcmVlbkVycm9ySGFuZGxlcl8gPSBudWxsO1xufTtcblxuVlJEaXNwbGF5LnByb3RvdHlwZS5iZWdpblByZXNlbnRfID0gZnVuY3Rpb24oKSB7XG4gIC8vIE92ZXJyaWRlIHRvIGFkZCBjdXN0b20gYmVoYXZpb3Igd2hlbiBwcmVzZW50YXRpb24gYmVnaW5zLlxufTtcblxuVlJEaXNwbGF5LnByb3RvdHlwZS5lbmRQcmVzZW50XyA9IGZ1bmN0aW9uKCkge1xuICAvLyBPdmVycmlkZSB0byBhZGQgY3VzdG9tIGJlaGF2aW9yIHdoZW4gcHJlc2VudGF0aW9uIGVuZHMuXG59O1xuXG5WUkRpc3BsYXkucHJvdG90eXBlLnN1Ym1pdEZyYW1lID0gZnVuY3Rpb24ocG9zZSkge1xuICAvLyBPdmVycmlkZSB0byBhZGQgY3VzdG9tIGJlaGF2aW9yIGZvciBmcmFtZSBzdWJtaXNzaW9uLlxufTtcblxuVlJEaXNwbGF5LnByb3RvdHlwZS5nZXRFeWVQYXJhbWV0ZXJzID0gZnVuY3Rpb24od2hpY2hFeWUpIHtcbiAgLy8gT3ZlcnJpZGUgdG8gcmV0dXJuIGFjY3VyYXRlIGV5ZSBwYXJhbWV0ZXJzIGlmIGNhblByZXNlbnQgaXMgdHJ1ZS5cbiAgcmV0dXJuIG51bGw7XG59O1xuXG4vKlxuICogRGVwcmVjYXRlZCBjbGFzc2VzXG4gKi9cblxuLyoqXG4gKiBUaGUgYmFzZSBjbGFzcyBmb3IgYWxsIFZSIGRldmljZXMuIChEZXByZWNhdGVkKVxuICovXG5mdW5jdGlvbiBWUkRldmljZSgpIHtcbiAgdGhpcy5pc1BvbHlmaWxsZWQgPSB0cnVlO1xuICB0aGlzLmhhcmR3YXJlVW5pdElkID0gJ3dlYnZyLXBvbHlmaWxsIGhhcmR3YXJlVW5pdElkJztcbiAgdGhpcy5kZXZpY2VJZCA9ICd3ZWJ2ci1wb2x5ZmlsbCBkZXZpY2VJZCc7XG4gIHRoaXMuZGV2aWNlTmFtZSA9ICd3ZWJ2ci1wb2x5ZmlsbCBkZXZpY2VOYW1lJztcbn1cblxuLyoqXG4gKiBUaGUgYmFzZSBjbGFzcyBmb3IgYWxsIFZSIEhNRCBkZXZpY2VzLiAoRGVwcmVjYXRlZClcbiAqL1xuZnVuY3Rpb24gSE1EVlJEZXZpY2UoKSB7XG59XG5ITURWUkRldmljZS5wcm90b3R5cGUgPSBuZXcgVlJEZXZpY2UoKTtcblxuLyoqXG4gKiBUaGUgYmFzZSBjbGFzcyBmb3IgYWxsIFZSIHBvc2l0aW9uIHNlbnNvciBkZXZpY2VzLiAoRGVwcmVjYXRlZClcbiAqL1xuZnVuY3Rpb24gUG9zaXRpb25TZW5zb3JWUkRldmljZSgpIHtcbn1cblBvc2l0aW9uU2Vuc29yVlJEZXZpY2UucHJvdG90eXBlID0gbmV3IFZSRGV2aWNlKCk7XG5cbm1vZHVsZS5leHBvcnRzLlZSRnJhbWVEYXRhID0gVlJGcmFtZURhdGE7XG5tb2R1bGUuZXhwb3J0cy5WUkRpc3BsYXkgPSBWUkRpc3BsYXk7XG5tb2R1bGUuZXhwb3J0cy5WUkRldmljZSA9IFZSRGV2aWNlO1xubW9kdWxlLmV4cG9ydHMuSE1EVlJEZXZpY2UgPSBITURWUkRldmljZTtcbm1vZHVsZS5leHBvcnRzLlBvc2l0aW9uU2Vuc29yVlJEZXZpY2UgPSBQb3NpdGlvblNlbnNvclZSRGV2aWNlO1xuIiwiLypcbiAqIENvcHlyaWdodCAyMDE2IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xuICogeW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuICogWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG4gKlxuICogICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuICpcbiAqIFVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbiAqIGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbiAqIFdJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuICogU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxuICogbGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG4gKi9cblxudmFyIENhcmRib2FyZFVJID0gcmVxdWlyZSgnLi9jYXJkYm9hcmQtdWkuanMnKTtcbnZhciBVdGlsID0gcmVxdWlyZSgnLi91dGlsLmpzJyk7XG52YXIgV0dMVVByZXNlcnZlR0xTdGF0ZSA9IHJlcXVpcmUoJy4vZGVwcy93Z2x1LXByZXNlcnZlLXN0YXRlLmpzJyk7XG5cbnZhciBkaXN0b3J0aW9uVlMgPSBbXG4gICdhdHRyaWJ1dGUgdmVjMiBwb3NpdGlvbjsnLFxuICAnYXR0cmlidXRlIHZlYzMgdGV4Q29vcmQ7JyxcblxuICAndmFyeWluZyB2ZWMyIHZUZXhDb29yZDsnLFxuXG4gICd1bmlmb3JtIHZlYzQgdmlld3BvcnRPZmZzZXRTY2FsZVsyXTsnLFxuXG4gICd2b2lkIG1haW4oKSB7JyxcbiAgJyAgdmVjNCB2aWV3cG9ydCA9IHZpZXdwb3J0T2Zmc2V0U2NhbGVbaW50KHRleENvb3JkLnopXTsnLFxuICAnICB2VGV4Q29vcmQgPSAodGV4Q29vcmQueHkgKiB2aWV3cG9ydC56dykgKyB2aWV3cG9ydC54eTsnLFxuICAnICBnbF9Qb3NpdGlvbiA9IHZlYzQoIHBvc2l0aW9uLCAxLjAsIDEuMCApOycsXG4gICd9Jyxcbl0uam9pbignXFxuJyk7XG5cbnZhciBkaXN0b3J0aW9uRlMgPSBbXG4gICdwcmVjaXNpb24gbWVkaXVtcCBmbG9hdDsnLFxuICAndW5pZm9ybSBzYW1wbGVyMkQgZGlmZnVzZTsnLFxuXG4gICd2YXJ5aW5nIHZlYzIgdlRleENvb3JkOycsXG5cbiAgJ3ZvaWQgbWFpbigpIHsnLFxuICAnICBnbF9GcmFnQ29sb3IgPSB0ZXh0dXJlMkQoZGlmZnVzZSwgdlRleENvb3JkKTsnLFxuICAnfScsXG5dLmpvaW4oJ1xcbicpO1xuXG4vKipcbiAqIEEgbWVzaC1iYXNlZCBkaXN0b3J0ZXIuXG4gKi9cbmZ1bmN0aW9uIENhcmRib2FyZERpc3RvcnRlcihnbCkge1xuICB0aGlzLmdsID0gZ2w7XG4gIHRoaXMuY3R4QXR0cmlicyA9IGdsLmdldENvbnRleHRBdHRyaWJ1dGVzKCk7XG5cbiAgdGhpcy5tZXNoV2lkdGggPSAyMDtcbiAgdGhpcy5tZXNoSGVpZ2h0ID0gMjA7XG5cbiAgdGhpcy5idWZmZXJTY2FsZSA9IFdlYlZSQ29uZmlnLkJVRkZFUl9TQ0FMRTtcblxuICB0aGlzLmJ1ZmZlcldpZHRoID0gZ2wuZHJhd2luZ0J1ZmZlcldpZHRoO1xuICB0aGlzLmJ1ZmZlckhlaWdodCA9IGdsLmRyYXdpbmdCdWZmZXJIZWlnaHQ7XG5cbiAgLy8gUGF0Y2hpbmcgc3VwcG9ydFxuICB0aGlzLnJlYWxCaW5kRnJhbWVidWZmZXIgPSBnbC5iaW5kRnJhbWVidWZmZXI7XG4gIHRoaXMucmVhbEVuYWJsZSA9IGdsLmVuYWJsZTtcbiAgdGhpcy5yZWFsRGlzYWJsZSA9IGdsLmRpc2FibGU7XG4gIHRoaXMucmVhbENvbG9yTWFzayA9IGdsLmNvbG9yTWFzaztcbiAgdGhpcy5yZWFsQ2xlYXJDb2xvciA9IGdsLmNsZWFyQ29sb3I7XG4gIHRoaXMucmVhbFZpZXdwb3J0ID0gZ2wudmlld3BvcnQ7XG5cbiAgaWYgKCFVdGlsLmlzSU9TKCkpIHtcbiAgICB0aGlzLnJlYWxDYW52YXNXaWR0aCA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IoZ2wuY2FudmFzLl9fcHJvdG9fXywgJ3dpZHRoJyk7XG4gICAgdGhpcy5yZWFsQ2FudmFzSGVpZ2h0ID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihnbC5jYW52YXMuX19wcm90b19fLCAnaGVpZ2h0Jyk7XG4gIH1cblxuICB0aGlzLmlzUGF0Y2hlZCA9IGZhbHNlO1xuXG4gIC8vIFN0YXRlIHRyYWNraW5nXG4gIHRoaXMubGFzdEJvdW5kRnJhbWVidWZmZXIgPSBudWxsO1xuICB0aGlzLmN1bGxGYWNlID0gZmFsc2U7XG4gIHRoaXMuZGVwdGhUZXN0ID0gZmFsc2U7XG4gIHRoaXMuYmxlbmQgPSBmYWxzZTtcbiAgdGhpcy5zY2lzc29yVGVzdCA9IGZhbHNlO1xuICB0aGlzLnN0ZW5jaWxUZXN0ID0gZmFsc2U7XG4gIHRoaXMudmlld3BvcnQgPSBbMCwgMCwgMCwgMF07XG4gIHRoaXMuY29sb3JNYXNrID0gW3RydWUsIHRydWUsIHRydWUsIHRydWVdO1xuICB0aGlzLmNsZWFyQ29sb3IgPSBbMCwgMCwgMCwgMF07XG5cbiAgdGhpcy5hdHRyaWJzID0ge1xuICAgIHBvc2l0aW9uOiAwLFxuICAgIHRleENvb3JkOiAxXG4gIH07XG4gIHRoaXMucHJvZ3JhbSA9IFV0aWwubGlua1Byb2dyYW0oZ2wsIGRpc3RvcnRpb25WUywgZGlzdG9ydGlvbkZTLCB0aGlzLmF0dHJpYnMpO1xuICB0aGlzLnVuaWZvcm1zID0gVXRpbC5nZXRQcm9ncmFtVW5pZm9ybXMoZ2wsIHRoaXMucHJvZ3JhbSk7XG5cbiAgdGhpcy52aWV3cG9ydE9mZnNldFNjYWxlID0gbmV3IEZsb2F0MzJBcnJheSg4KTtcbiAgdGhpcy5zZXRUZXh0dXJlQm91bmRzKCk7XG5cbiAgdGhpcy52ZXJ0ZXhCdWZmZXIgPSBnbC5jcmVhdGVCdWZmZXIoKTtcbiAgdGhpcy5pbmRleEJ1ZmZlciA9IGdsLmNyZWF0ZUJ1ZmZlcigpO1xuICB0aGlzLmluZGV4Q291bnQgPSAwO1xuXG4gIHRoaXMucmVuZGVyVGFyZ2V0ID0gZ2wuY3JlYXRlVGV4dHVyZSgpO1xuICB0aGlzLmZyYW1lYnVmZmVyID0gZ2wuY3JlYXRlRnJhbWVidWZmZXIoKTtcblxuICB0aGlzLmRlcHRoU3RlbmNpbEJ1ZmZlciA9IG51bGw7XG4gIHRoaXMuZGVwdGhCdWZmZXIgPSBudWxsO1xuICB0aGlzLnN0ZW5jaWxCdWZmZXIgPSBudWxsO1xuXG4gIGlmICh0aGlzLmN0eEF0dHJpYnMuZGVwdGggJiYgdGhpcy5jdHhBdHRyaWJzLnN0ZW5jaWwpIHtcbiAgICB0aGlzLmRlcHRoU3RlbmNpbEJ1ZmZlciA9IGdsLmNyZWF0ZVJlbmRlcmJ1ZmZlcigpO1xuICB9IGVsc2UgaWYgKHRoaXMuY3R4QXR0cmlicy5kZXB0aCkge1xuICAgIHRoaXMuZGVwdGhCdWZmZXIgPSBnbC5jcmVhdGVSZW5kZXJidWZmZXIoKTtcbiAgfSBlbHNlIGlmICh0aGlzLmN0eEF0dHJpYnMuc3RlbmNpbCkge1xuICAgIHRoaXMuc3RlbmNpbEJ1ZmZlciA9IGdsLmNyZWF0ZVJlbmRlcmJ1ZmZlcigpO1xuICB9XG5cbiAgdGhpcy5wYXRjaCgpO1xuXG4gIHRoaXMub25SZXNpemUoKTtcblxuICBpZiAoIVdlYlZSQ29uZmlnLkNBUkRCT0FSRF9VSV9ESVNBQkxFRCkge1xuICAgIHRoaXMuY2FyZGJvYXJkVUkgPSBuZXcgQ2FyZGJvYXJkVUkoZ2wpO1xuICB9XG59O1xuXG4vKipcbiAqIFRlYXJzIGRvd24gYWxsIHRoZSByZXNvdXJjZXMgY3JlYXRlZCBieSB0aGUgZGlzdG9ydGVyIGFuZCByZW1vdmVzIGFueVxuICogcGF0Y2hlcy5cbiAqL1xuQ2FyZGJvYXJkRGlzdG9ydGVyLnByb3RvdHlwZS5kZXN0cm95ID0gZnVuY3Rpb24oKSB7XG4gIHZhciBnbCA9IHRoaXMuZ2w7XG5cbiAgdGhpcy51bnBhdGNoKCk7XG5cbiAgZ2wuZGVsZXRlUHJvZ3JhbSh0aGlzLnByb2dyYW0pO1xuICBnbC5kZWxldGVCdWZmZXIodGhpcy52ZXJ0ZXhCdWZmZXIpO1xuICBnbC5kZWxldGVCdWZmZXIodGhpcy5pbmRleEJ1ZmZlcik7XG4gIGdsLmRlbGV0ZVRleHR1cmUodGhpcy5yZW5kZXJUYXJnZXQpO1xuICBnbC5kZWxldGVGcmFtZWJ1ZmZlcih0aGlzLmZyYW1lYnVmZmVyKTtcbiAgaWYgKHRoaXMuZGVwdGhTdGVuY2lsQnVmZmVyKSB7XG4gICAgZ2wuZGVsZXRlUmVuZGVyYnVmZmVyKHRoaXMuZGVwdGhTdGVuY2lsQnVmZmVyKTtcbiAgfVxuICBpZiAodGhpcy5kZXB0aEJ1ZmZlcikge1xuICAgIGdsLmRlbGV0ZVJlbmRlcmJ1ZmZlcih0aGlzLmRlcHRoQnVmZmVyKTtcbiAgfVxuICBpZiAodGhpcy5zdGVuY2lsQnVmZmVyKSB7XG4gICAgZ2wuZGVsZXRlUmVuZGVyYnVmZmVyKHRoaXMuc3RlbmNpbEJ1ZmZlcik7XG4gIH1cblxuICBpZiAodGhpcy5jYXJkYm9hcmRVSSkge1xuICAgIHRoaXMuY2FyZGJvYXJkVUkuZGVzdHJveSgpO1xuICB9XG59O1xuXG5cbi8qKlxuICogUmVzaXplcyB0aGUgYmFja2J1ZmZlciB0byBtYXRjaCB0aGUgY2FudmFzIHdpZHRoIGFuZCBoZWlnaHQuXG4gKi9cbkNhcmRib2FyZERpc3RvcnRlci5wcm90b3R5cGUub25SZXNpemUgPSBmdW5jdGlvbigpIHtcbiAgdmFyIGdsID0gdGhpcy5nbDtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gIHZhciBnbFN0YXRlID0gW1xuICAgIGdsLlJFTkRFUkJVRkZFUl9CSU5ESU5HLFxuICAgIGdsLlRFWFRVUkVfQklORElOR18yRCwgZ2wuVEVYVFVSRTBcbiAgXTtcblxuICBXR0xVUHJlc2VydmVHTFN0YXRlKGdsLCBnbFN0YXRlLCBmdW5jdGlvbihnbCkge1xuICAgIC8vIEJpbmQgcmVhbCBiYWNrYnVmZmVyIGFuZCBjbGVhciBpdCBvbmNlLiBXZSBkb24ndCBuZWVkIHRvIGNsZWFyIGl0IGFnYWluXG4gICAgLy8gYWZ0ZXIgdGhhdCBiZWNhdXNlIHdlJ3JlIG92ZXJ3cml0aW5nIHRoZSBzYW1lIGFyZWEgZXZlcnkgZnJhbWUuXG4gICAgc2VsZi5yZWFsQmluZEZyYW1lYnVmZmVyLmNhbGwoZ2wsIGdsLkZSQU1FQlVGRkVSLCBudWxsKTtcblxuICAgIC8vIFB1dCB0aGluZ3MgaW4gYSBnb29kIHN0YXRlXG4gICAgaWYgKHNlbGYuc2Npc3NvclRlc3QpIHsgc2VsZi5yZWFsRGlzYWJsZS5jYWxsKGdsLCBnbC5TQ0lTU09SX1RFU1QpOyB9XG4gICAgc2VsZi5yZWFsQ29sb3JNYXNrLmNhbGwoZ2wsIHRydWUsIHRydWUsIHRydWUsIHRydWUpO1xuICAgIHNlbGYucmVhbFZpZXdwb3J0LmNhbGwoZ2wsIDAsIDAsIGdsLmRyYXdpbmdCdWZmZXJXaWR0aCwgZ2wuZHJhd2luZ0J1ZmZlckhlaWdodCk7XG4gICAgc2VsZi5yZWFsQ2xlYXJDb2xvci5jYWxsKGdsLCAwLCAwLCAwLCAxKTtcblxuICAgIGdsLmNsZWFyKGdsLkNPTE9SX0JVRkZFUl9CSVQpO1xuXG4gICAgLy8gTm93IGJpbmQgYW5kIHJlc2l6ZSB0aGUgZmFrZSBiYWNrYnVmZmVyXG4gICAgc2VsZi5yZWFsQmluZEZyYW1lYnVmZmVyLmNhbGwoZ2wsIGdsLkZSQU1FQlVGRkVSLCBzZWxmLmZyYW1lYnVmZmVyKTtcblxuICAgIGdsLmJpbmRUZXh0dXJlKGdsLlRFWFRVUkVfMkQsIHNlbGYucmVuZGVyVGFyZ2V0KTtcbiAgICBnbC50ZXhJbWFnZTJEKGdsLlRFWFRVUkVfMkQsIDAsIHNlbGYuY3R4QXR0cmlicy5hbHBoYSA/IGdsLlJHQkEgOiBnbC5SR0IsXG4gICAgICAgIHNlbGYuYnVmZmVyV2lkdGgsIHNlbGYuYnVmZmVySGVpZ2h0LCAwLFxuICAgICAgICBzZWxmLmN0eEF0dHJpYnMuYWxwaGEgPyBnbC5SR0JBIDogZ2wuUkdCLCBnbC5VTlNJR05FRF9CWVRFLCBudWxsKTtcbiAgICBnbC50ZXhQYXJhbWV0ZXJpKGdsLlRFWFRVUkVfMkQsIGdsLlRFWFRVUkVfTUFHX0ZJTFRFUiwgZ2wuTElORUFSKTtcbiAgICBnbC50ZXhQYXJhbWV0ZXJpKGdsLlRFWFRVUkVfMkQsIGdsLlRFWFRVUkVfTUlOX0ZJTFRFUiwgZ2wuTElORUFSKTtcbiAgICBnbC50ZXhQYXJhbWV0ZXJpKGdsLlRFWFRVUkVfMkQsIGdsLlRFWFRVUkVfV1JBUF9TLCBnbC5DTEFNUF9UT19FREdFKTtcbiAgICBnbC50ZXhQYXJhbWV0ZXJpKGdsLlRFWFRVUkVfMkQsIGdsLlRFWFRVUkVfV1JBUF9ULCBnbC5DTEFNUF9UT19FREdFKTtcbiAgICBnbC5mcmFtZWJ1ZmZlclRleHR1cmUyRChnbC5GUkFNRUJVRkZFUiwgZ2wuQ09MT1JfQVRUQUNITUVOVDAsIGdsLlRFWFRVUkVfMkQsIHNlbGYucmVuZGVyVGFyZ2V0LCAwKTtcblxuICAgIGlmIChzZWxmLmN0eEF0dHJpYnMuZGVwdGggJiYgc2VsZi5jdHhBdHRyaWJzLnN0ZW5jaWwpIHtcbiAgICAgIGdsLmJpbmRSZW5kZXJidWZmZXIoZ2wuUkVOREVSQlVGRkVSLCBzZWxmLmRlcHRoU3RlbmNpbEJ1ZmZlcik7XG4gICAgICBnbC5yZW5kZXJidWZmZXJTdG9yYWdlKGdsLlJFTkRFUkJVRkZFUiwgZ2wuREVQVEhfU1RFTkNJTCxcbiAgICAgICAgICBzZWxmLmJ1ZmZlcldpZHRoLCBzZWxmLmJ1ZmZlckhlaWdodCk7XG4gICAgICBnbC5mcmFtZWJ1ZmZlclJlbmRlcmJ1ZmZlcihnbC5GUkFNRUJVRkZFUiwgZ2wuREVQVEhfU1RFTkNJTF9BVFRBQ0hNRU5ULFxuICAgICAgICAgIGdsLlJFTkRFUkJVRkZFUiwgc2VsZi5kZXB0aFN0ZW5jaWxCdWZmZXIpO1xuICAgIH0gZWxzZSBpZiAoc2VsZi5jdHhBdHRyaWJzLmRlcHRoKSB7XG4gICAgICBnbC5iaW5kUmVuZGVyYnVmZmVyKGdsLlJFTkRFUkJVRkZFUiwgc2VsZi5kZXB0aEJ1ZmZlcik7XG4gICAgICBnbC5yZW5kZXJidWZmZXJTdG9yYWdlKGdsLlJFTkRFUkJVRkZFUiwgZ2wuREVQVEhfQ09NUE9ORU5UMTYsXG4gICAgICAgICAgc2VsZi5idWZmZXJXaWR0aCwgc2VsZi5idWZmZXJIZWlnaHQpO1xuICAgICAgZ2wuZnJhbWVidWZmZXJSZW5kZXJidWZmZXIoZ2wuRlJBTUVCVUZGRVIsIGdsLkRFUFRIX0FUVEFDSE1FTlQsXG4gICAgICAgICAgZ2wuUkVOREVSQlVGRkVSLCBzZWxmLmRlcHRoQnVmZmVyKTtcbiAgICB9IGVsc2UgaWYgKHNlbGYuY3R4QXR0cmlicy5zdGVuY2lsKSB7XG4gICAgICBnbC5iaW5kUmVuZGVyYnVmZmVyKGdsLlJFTkRFUkJVRkZFUiwgc2VsZi5zdGVuY2lsQnVmZmVyKTtcbiAgICAgIGdsLnJlbmRlcmJ1ZmZlclN0b3JhZ2UoZ2wuUkVOREVSQlVGRkVSLCBnbC5TVEVOQ0lMX0lOREVYOCxcbiAgICAgICAgICBzZWxmLmJ1ZmZlcldpZHRoLCBzZWxmLmJ1ZmZlckhlaWdodCk7XG4gICAgICBnbC5mcmFtZWJ1ZmZlclJlbmRlcmJ1ZmZlcihnbC5GUkFNRUJVRkZFUiwgZ2wuU1RFTkNJTF9BVFRBQ0hNRU5ULFxuICAgICAgICAgIGdsLlJFTkRFUkJVRkZFUiwgc2VsZi5zdGVuY2lsQnVmZmVyKTtcbiAgICB9XG5cbiAgICBpZiAoIWdsLmNoZWNrRnJhbWVidWZmZXJTdGF0dXMoZ2wuRlJBTUVCVUZGRVIpID09PSBnbC5GUkFNRUJVRkZFUl9DT01QTEVURSkge1xuICAgICAgY29uc29sZS5lcnJvcignRnJhbWVidWZmZXIgaW5jb21wbGV0ZSEnKTtcbiAgICB9XG5cbiAgICBzZWxmLnJlYWxCaW5kRnJhbWVidWZmZXIuY2FsbChnbCwgZ2wuRlJBTUVCVUZGRVIsIHNlbGYubGFzdEJvdW5kRnJhbWVidWZmZXIpO1xuXG4gICAgaWYgKHNlbGYuc2Npc3NvclRlc3QpIHsgc2VsZi5yZWFsRW5hYmxlLmNhbGwoZ2wsIGdsLlNDSVNTT1JfVEVTVCk7IH1cblxuICAgIHNlbGYucmVhbENvbG9yTWFzay5hcHBseShnbCwgc2VsZi5jb2xvck1hc2spO1xuICAgIHNlbGYucmVhbFZpZXdwb3J0LmFwcGx5KGdsLCBzZWxmLnZpZXdwb3J0KTtcbiAgICBzZWxmLnJlYWxDbGVhckNvbG9yLmFwcGx5KGdsLCBzZWxmLmNsZWFyQ29sb3IpO1xuICB9KTtcblxuICBpZiAodGhpcy5jYXJkYm9hcmRVSSkge1xuICAgIHRoaXMuY2FyZGJvYXJkVUkub25SZXNpemUoKTtcbiAgfVxufTtcblxuQ2FyZGJvYXJkRGlzdG9ydGVyLnByb3RvdHlwZS5wYXRjaCA9IGZ1bmN0aW9uKCkge1xuICBpZiAodGhpcy5pc1BhdGNoZWQpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHZhciBjYW52YXMgPSB0aGlzLmdsLmNhbnZhcztcbiAgdmFyIGdsID0gdGhpcy5nbDtcblxuICBpZiAoIVV0aWwuaXNJT1MoKSkge1xuICAgIGNhbnZhcy53aWR0aCA9IFV0aWwuZ2V0U2NyZWVuV2lkdGgoKSAqIHRoaXMuYnVmZmVyU2NhbGU7XG4gICAgY2FudmFzLmhlaWdodCA9IFV0aWwuZ2V0U2NyZWVuSGVpZ2h0KCkgKiB0aGlzLmJ1ZmZlclNjYWxlO1xuXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KGNhbnZhcywgJ3dpZHRoJywge1xuICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBzZWxmLmJ1ZmZlcldpZHRoO1xuICAgICAgfSxcbiAgICAgIHNldDogZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgc2VsZi5idWZmZXJXaWR0aCA9IHZhbHVlO1xuICAgICAgICBzZWxmLm9uUmVzaXplKCk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoY2FudmFzLCAnaGVpZ2h0Jywge1xuICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBzZWxmLmJ1ZmZlckhlaWdodDtcbiAgICAgIH0sXG4gICAgICBzZXQ6IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgIHNlbGYuYnVmZmVySGVpZ2h0ID0gdmFsdWU7XG4gICAgICAgIHNlbGYub25SZXNpemUoKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIHRoaXMubGFzdEJvdW5kRnJhbWVidWZmZXIgPSBnbC5nZXRQYXJhbWV0ZXIoZ2wuRlJBTUVCVUZGRVJfQklORElORyk7XG5cbiAgaWYgKHRoaXMubGFzdEJvdW5kRnJhbWVidWZmZXIgPT0gbnVsbCkge1xuICAgIHRoaXMubGFzdEJvdW5kRnJhbWVidWZmZXIgPSB0aGlzLmZyYW1lYnVmZmVyO1xuICAgIHRoaXMuZ2wuYmluZEZyYW1lYnVmZmVyKGdsLkZSQU1FQlVGRkVSLCB0aGlzLmZyYW1lYnVmZmVyKTtcbiAgfVxuXG4gIHRoaXMuZ2wuYmluZEZyYW1lYnVmZmVyID0gZnVuY3Rpb24odGFyZ2V0LCBmcmFtZWJ1ZmZlcikge1xuICAgIHNlbGYubGFzdEJvdW5kRnJhbWVidWZmZXIgPSBmcmFtZWJ1ZmZlciA/IGZyYW1lYnVmZmVyIDogc2VsZi5mcmFtZWJ1ZmZlcjtcbiAgICAvLyBTaWxlbnRseSBtYWtlIGNhbGxzIHRvIGJpbmQgdGhlIGRlZmF1bHQgZnJhbWVidWZmZXIgYmluZCBvdXJzIGluc3RlYWQuXG4gICAgc2VsZi5yZWFsQmluZEZyYW1lYnVmZmVyLmNhbGwoZ2wsIHRhcmdldCwgc2VsZi5sYXN0Qm91bmRGcmFtZWJ1ZmZlcik7XG4gIH07XG5cbiAgdGhpcy5jdWxsRmFjZSA9IGdsLmdldFBhcmFtZXRlcihnbC5DVUxMX0ZBQ0UpO1xuICB0aGlzLmRlcHRoVGVzdCA9IGdsLmdldFBhcmFtZXRlcihnbC5ERVBUSF9URVNUKTtcbiAgdGhpcy5ibGVuZCA9IGdsLmdldFBhcmFtZXRlcihnbC5CTEVORCk7XG4gIHRoaXMuc2Npc3NvclRlc3QgPSBnbC5nZXRQYXJhbWV0ZXIoZ2wuU0NJU1NPUl9URVNUKTtcbiAgdGhpcy5zdGVuY2lsVGVzdCA9IGdsLmdldFBhcmFtZXRlcihnbC5TVEVOQ0lMX1RFU1QpO1xuXG4gIGdsLmVuYWJsZSA9IGZ1bmN0aW9uKHBuYW1lKSB7XG4gICAgc3dpdGNoIChwbmFtZSkge1xuICAgICAgY2FzZSBnbC5DVUxMX0ZBQ0U6IHNlbGYuY3VsbEZhY2UgPSB0cnVlOyBicmVhaztcbiAgICAgIGNhc2UgZ2wuREVQVEhfVEVTVDogc2VsZi5kZXB0aFRlc3QgPSB0cnVlOyBicmVhaztcbiAgICAgIGNhc2UgZ2wuQkxFTkQ6IHNlbGYuYmxlbmQgPSB0cnVlOyBicmVhaztcbiAgICAgIGNhc2UgZ2wuU0NJU1NPUl9URVNUOiBzZWxmLnNjaXNzb3JUZXN0ID0gdHJ1ZTsgYnJlYWs7XG4gICAgICBjYXNlIGdsLlNURU5DSUxfVEVTVDogc2VsZi5zdGVuY2lsVGVzdCA9IHRydWU7IGJyZWFrO1xuICAgIH1cbiAgICBzZWxmLnJlYWxFbmFibGUuY2FsbChnbCwgcG5hbWUpO1xuICB9O1xuXG4gIGdsLmRpc2FibGUgPSBmdW5jdGlvbihwbmFtZSkge1xuICAgIHN3aXRjaCAocG5hbWUpIHtcbiAgICAgIGNhc2UgZ2wuQ1VMTF9GQUNFOiBzZWxmLmN1bGxGYWNlID0gZmFsc2U7IGJyZWFrO1xuICAgICAgY2FzZSBnbC5ERVBUSF9URVNUOiBzZWxmLmRlcHRoVGVzdCA9IGZhbHNlOyBicmVhaztcbiAgICAgIGNhc2UgZ2wuQkxFTkQ6IHNlbGYuYmxlbmQgPSBmYWxzZTsgYnJlYWs7XG4gICAgICBjYXNlIGdsLlNDSVNTT1JfVEVTVDogc2VsZi5zY2lzc29yVGVzdCA9IGZhbHNlOyBicmVhaztcbiAgICAgIGNhc2UgZ2wuU1RFTkNJTF9URVNUOiBzZWxmLnN0ZW5jaWxUZXN0ID0gZmFsc2U7IGJyZWFrO1xuICAgIH1cbiAgICBzZWxmLnJlYWxEaXNhYmxlLmNhbGwoZ2wsIHBuYW1lKTtcbiAgfTtcblxuICB0aGlzLmNvbG9yTWFzayA9IGdsLmdldFBhcmFtZXRlcihnbC5DT0xPUl9XUklURU1BU0spO1xuICBnbC5jb2xvck1hc2sgPSBmdW5jdGlvbihyLCBnLCBiLCBhKSB7XG4gICAgc2VsZi5jb2xvck1hc2tbMF0gPSByO1xuICAgIHNlbGYuY29sb3JNYXNrWzFdID0gZztcbiAgICBzZWxmLmNvbG9yTWFza1syXSA9IGI7XG4gICAgc2VsZi5jb2xvck1hc2tbM10gPSBhO1xuICAgIHNlbGYucmVhbENvbG9yTWFzay5jYWxsKGdsLCByLCBnLCBiLCBhKTtcbiAgfTtcblxuICB0aGlzLmNsZWFyQ29sb3IgPSBnbC5nZXRQYXJhbWV0ZXIoZ2wuQ09MT1JfQ0xFQVJfVkFMVUUpO1xuICBnbC5jbGVhckNvbG9yID0gZnVuY3Rpb24ociwgZywgYiwgYSkge1xuICAgIHNlbGYuY2xlYXJDb2xvclswXSA9IHI7XG4gICAgc2VsZi5jbGVhckNvbG9yWzFdID0gZztcbiAgICBzZWxmLmNsZWFyQ29sb3JbMl0gPSBiO1xuICAgIHNlbGYuY2xlYXJDb2xvclszXSA9IGE7XG4gICAgc2VsZi5yZWFsQ2xlYXJDb2xvci5jYWxsKGdsLCByLCBnLCBiLCBhKTtcbiAgfTtcblxuICB0aGlzLnZpZXdwb3J0ID0gZ2wuZ2V0UGFyYW1ldGVyKGdsLlZJRVdQT1JUKTtcbiAgZ2wudmlld3BvcnQgPSBmdW5jdGlvbih4LCB5LCB3LCBoKSB7XG4gICAgc2VsZi52aWV3cG9ydFswXSA9IHg7XG4gICAgc2VsZi52aWV3cG9ydFsxXSA9IHk7XG4gICAgc2VsZi52aWV3cG9ydFsyXSA9IHc7XG4gICAgc2VsZi52aWV3cG9ydFszXSA9IGg7XG4gICAgc2VsZi5yZWFsVmlld3BvcnQuY2FsbChnbCwgeCwgeSwgdywgaCk7XG4gIH07XG5cbiAgdGhpcy5pc1BhdGNoZWQgPSB0cnVlO1xuICBVdGlsLnNhZmFyaUNzc1NpemVXb3JrYXJvdW5kKGNhbnZhcyk7XG59O1xuXG5DYXJkYm9hcmREaXN0b3J0ZXIucHJvdG90eXBlLnVucGF0Y2ggPSBmdW5jdGlvbigpIHtcbiAgaWYgKCF0aGlzLmlzUGF0Y2hlZCkge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIHZhciBnbCA9IHRoaXMuZ2w7XG4gIHZhciBjYW52YXMgPSB0aGlzLmdsLmNhbnZhcztcblxuICBpZiAoIVV0aWwuaXNJT1MoKSkge1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShjYW52YXMsICd3aWR0aCcsIHRoaXMucmVhbENhbnZhc1dpZHRoKTtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoY2FudmFzLCAnaGVpZ2h0JywgdGhpcy5yZWFsQ2FudmFzSGVpZ2h0KTtcbiAgfVxuICBjYW52YXMud2lkdGggPSB0aGlzLmJ1ZmZlcldpZHRoO1xuICBjYW52YXMuaGVpZ2h0ID0gdGhpcy5idWZmZXJIZWlnaHQ7XG5cbiAgZ2wuYmluZEZyYW1lYnVmZmVyID0gdGhpcy5yZWFsQmluZEZyYW1lYnVmZmVyO1xuICBnbC5lbmFibGUgPSB0aGlzLnJlYWxFbmFibGU7XG4gIGdsLmRpc2FibGUgPSB0aGlzLnJlYWxEaXNhYmxlO1xuICBnbC5jb2xvck1hc2sgPSB0aGlzLnJlYWxDb2xvck1hc2s7XG4gIGdsLmNsZWFyQ29sb3IgPSB0aGlzLnJlYWxDbGVhckNvbG9yO1xuICBnbC52aWV3cG9ydCA9IHRoaXMucmVhbFZpZXdwb3J0O1xuXG4gIC8vIENoZWNrIHRvIHNlZSBpZiBvdXIgZmFrZSBiYWNrYnVmZmVyIGlzIGJvdW5kIGFuZCBiaW5kIHRoZSByZWFsIGJhY2tidWZmZXJcbiAgLy8gaWYgdGhhdCdzIHRoZSBjYXNlLlxuICBpZiAodGhpcy5sYXN0Qm91bmRGcmFtZWJ1ZmZlciA9PSB0aGlzLmZyYW1lYnVmZmVyKSB7XG4gICAgZ2wuYmluZEZyYW1lYnVmZmVyKGdsLkZSQU1FQlVGRkVSLCBudWxsKTtcbiAgfVxuXG4gIHRoaXMuaXNQYXRjaGVkID0gZmFsc2U7XG5cbiAgc2V0VGltZW91dChmdW5jdGlvbigpIHtcbiAgICBVdGlsLnNhZmFyaUNzc1NpemVXb3JrYXJvdW5kKGNhbnZhcyk7XG4gIH0sIDEpO1xufTtcblxuQ2FyZGJvYXJkRGlzdG9ydGVyLnByb3RvdHlwZS5zZXRUZXh0dXJlQm91bmRzID0gZnVuY3Rpb24obGVmdEJvdW5kcywgcmlnaHRCb3VuZHMpIHtcbiAgaWYgKCFsZWZ0Qm91bmRzKSB7XG4gICAgbGVmdEJvdW5kcyA9IFswLCAwLCAwLjUsIDFdO1xuICB9XG5cbiAgaWYgKCFyaWdodEJvdW5kcykge1xuICAgIHJpZ2h0Qm91bmRzID0gWzAuNSwgMCwgMC41LCAxXTtcbiAgfVxuXG4gIC8vIExlZnQgZXllXG4gIHRoaXMudmlld3BvcnRPZmZzZXRTY2FsZVswXSA9IGxlZnRCb3VuZHNbMF07IC8vIFhcbiAgdGhpcy52aWV3cG9ydE9mZnNldFNjYWxlWzFdID0gbGVmdEJvdW5kc1sxXTsgLy8gWVxuICB0aGlzLnZpZXdwb3J0T2Zmc2V0U2NhbGVbMl0gPSBsZWZ0Qm91bmRzWzJdOyAvLyBXaWR0aFxuICB0aGlzLnZpZXdwb3J0T2Zmc2V0U2NhbGVbM10gPSBsZWZ0Qm91bmRzWzNdOyAvLyBIZWlnaHRcblxuICAvLyBSaWdodCBleWVcbiAgdGhpcy52aWV3cG9ydE9mZnNldFNjYWxlWzRdID0gcmlnaHRCb3VuZHNbMF07IC8vIFhcbiAgdGhpcy52aWV3cG9ydE9mZnNldFNjYWxlWzVdID0gcmlnaHRCb3VuZHNbMV07IC8vIFlcbiAgdGhpcy52aWV3cG9ydE9mZnNldFNjYWxlWzZdID0gcmlnaHRCb3VuZHNbMl07IC8vIFdpZHRoXG4gIHRoaXMudmlld3BvcnRPZmZzZXRTY2FsZVs3XSA9IHJpZ2h0Qm91bmRzWzNdOyAvLyBIZWlnaHRcbn07XG5cbi8qKlxuICogUGVyZm9ybXMgZGlzdG9ydGlvbiBwYXNzIG9uIHRoZSBpbmplY3RlZCBiYWNrYnVmZmVyLCByZW5kZXJpbmcgaXQgdG8gdGhlIHJlYWxcbiAqIGJhY2tidWZmZXIuXG4gKi9cbkNhcmRib2FyZERpc3RvcnRlci5wcm90b3R5cGUuc3VibWl0RnJhbWUgPSBmdW5jdGlvbigpIHtcbiAgdmFyIGdsID0gdGhpcy5nbDtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gIHZhciBnbFN0YXRlID0gW107XG5cbiAgaWYgKCFXZWJWUkNvbmZpZy5ESVJUWV9TVUJNSVRfRlJBTUVfQklORElOR1MpIHtcbiAgICBnbFN0YXRlLnB1c2goXG4gICAgICBnbC5DVVJSRU5UX1BST0dSQU0sXG4gICAgICBnbC5BUlJBWV9CVUZGRVJfQklORElORyxcbiAgICAgIGdsLkVMRU1FTlRfQVJSQVlfQlVGRkVSX0JJTkRJTkcsXG4gICAgICBnbC5URVhUVVJFX0JJTkRJTkdfMkQsIGdsLlRFWFRVUkUwXG4gICAgKTtcbiAgfVxuXG4gIFdHTFVQcmVzZXJ2ZUdMU3RhdGUoZ2wsIGdsU3RhdGUsIGZ1bmN0aW9uKGdsKSB7XG4gICAgLy8gQmluZCB0aGUgcmVhbCBkZWZhdWx0IGZyYW1lYnVmZmVyXG4gICAgc2VsZi5yZWFsQmluZEZyYW1lYnVmZmVyLmNhbGwoZ2wsIGdsLkZSQU1FQlVGRkVSLCBudWxsKTtcblxuICAgIC8vIE1ha2Ugc3VyZSB0aGUgR0wgc3RhdGUgaXMgaW4gYSBnb29kIHBsYWNlXG4gICAgaWYgKHNlbGYuY3VsbEZhY2UpIHsgc2VsZi5yZWFsRGlzYWJsZS5jYWxsKGdsLCBnbC5DVUxMX0ZBQ0UpOyB9XG4gICAgaWYgKHNlbGYuZGVwdGhUZXN0KSB7IHNlbGYucmVhbERpc2FibGUuY2FsbChnbCwgZ2wuREVQVEhfVEVTVCk7IH1cbiAgICBpZiAoc2VsZi5ibGVuZCkgeyBzZWxmLnJlYWxEaXNhYmxlLmNhbGwoZ2wsIGdsLkJMRU5EKTsgfVxuICAgIGlmIChzZWxmLnNjaXNzb3JUZXN0KSB7IHNlbGYucmVhbERpc2FibGUuY2FsbChnbCwgZ2wuU0NJU1NPUl9URVNUKTsgfVxuICAgIGlmIChzZWxmLnN0ZW5jaWxUZXN0KSB7IHNlbGYucmVhbERpc2FibGUuY2FsbChnbCwgZ2wuU1RFTkNJTF9URVNUKTsgfVxuICAgIHNlbGYucmVhbENvbG9yTWFzay5jYWxsKGdsLCB0cnVlLCB0cnVlLCB0cnVlLCB0cnVlKTtcbiAgICBzZWxmLnJlYWxWaWV3cG9ydC5jYWxsKGdsLCAwLCAwLCBnbC5kcmF3aW5nQnVmZmVyV2lkdGgsIGdsLmRyYXdpbmdCdWZmZXJIZWlnaHQpO1xuXG4gICAgLy8gSWYgdGhlIGJhY2tidWZmZXIgaGFzIGFuIGFscGhhIGNoYW5uZWwgY2xlYXIgZXZlcnkgZnJhbWUgc28gdGhlIHBhZ2VcbiAgICAvLyBkb2Vzbid0IHNob3cgdGhyb3VnaC5cbiAgICBpZiAoc2VsZi5jdHhBdHRyaWJzLmFscGhhIHx8IFV0aWwuaXNJT1MoKSkge1xuICAgICAgc2VsZi5yZWFsQ2xlYXJDb2xvci5jYWxsKGdsLCAwLCAwLCAwLCAxKTtcbiAgICAgIGdsLmNsZWFyKGdsLkNPTE9SX0JVRkZFUl9CSVQpO1xuICAgIH1cblxuICAgIC8vIEJpbmQgZGlzdG9ydGlvbiBwcm9ncmFtIGFuZCBtZXNoXG4gICAgZ2wudXNlUHJvZ3JhbShzZWxmLnByb2dyYW0pO1xuXG4gICAgZ2wuYmluZEJ1ZmZlcihnbC5FTEVNRU5UX0FSUkFZX0JVRkZFUiwgc2VsZi5pbmRleEJ1ZmZlcik7XG5cbiAgICBnbC5iaW5kQnVmZmVyKGdsLkFSUkFZX0JVRkZFUiwgc2VsZi52ZXJ0ZXhCdWZmZXIpO1xuICAgIGdsLmVuYWJsZVZlcnRleEF0dHJpYkFycmF5KHNlbGYuYXR0cmlicy5wb3NpdGlvbik7XG4gICAgZ2wuZW5hYmxlVmVydGV4QXR0cmliQXJyYXkoc2VsZi5hdHRyaWJzLnRleENvb3JkKTtcbiAgICBnbC52ZXJ0ZXhBdHRyaWJQb2ludGVyKHNlbGYuYXR0cmlicy5wb3NpdGlvbiwgMiwgZ2wuRkxPQVQsIGZhbHNlLCAyMCwgMCk7XG4gICAgZ2wudmVydGV4QXR0cmliUG9pbnRlcihzZWxmLmF0dHJpYnMudGV4Q29vcmQsIDMsIGdsLkZMT0FULCBmYWxzZSwgMjAsIDgpO1xuXG4gICAgZ2wuYWN0aXZlVGV4dHVyZShnbC5URVhUVVJFMCk7XG4gICAgZ2wudW5pZm9ybTFpKHNlbGYudW5pZm9ybXMuZGlmZnVzZSwgMCk7XG4gICAgZ2wuYmluZFRleHR1cmUoZ2wuVEVYVFVSRV8yRCwgc2VsZi5yZW5kZXJUYXJnZXQpO1xuXG4gICAgZ2wudW5pZm9ybTRmdihzZWxmLnVuaWZvcm1zLnZpZXdwb3J0T2Zmc2V0U2NhbGUsIHNlbGYudmlld3BvcnRPZmZzZXRTY2FsZSk7XG5cbiAgICAvLyBEcmF3cyBib3RoIGV5ZXNcbiAgICBnbC5kcmF3RWxlbWVudHMoZ2wuVFJJQU5HTEVTLCBzZWxmLmluZGV4Q291bnQsIGdsLlVOU0lHTkVEX1NIT1JULCAwKTtcblxuICAgIGlmIChzZWxmLmNhcmRib2FyZFVJKSB7XG4gICAgICBzZWxmLmNhcmRib2FyZFVJLnJlbmRlck5vU3RhdGUoKTtcbiAgICB9XG5cbiAgICAvLyBCaW5kIHRoZSBmYWtlIGRlZmF1bHQgZnJhbWVidWZmZXIgYWdhaW5cbiAgICBzZWxmLnJlYWxCaW5kRnJhbWVidWZmZXIuY2FsbChzZWxmLmdsLCBnbC5GUkFNRUJVRkZFUiwgc2VsZi5mcmFtZWJ1ZmZlcik7XG5cbiAgICAvLyBJZiBwcmVzZXJ2ZURyYXdpbmdCdWZmZXIgPT0gZmFsc2UgY2xlYXIgdGhlIGZyYW1lYnVmZmVyXG4gICAgaWYgKCFzZWxmLmN0eEF0dHJpYnMucHJlc2VydmVEcmF3aW5nQnVmZmVyKSB7XG4gICAgICBzZWxmLnJlYWxDbGVhckNvbG9yLmNhbGwoZ2wsIDAsIDAsIDAsIDApO1xuICAgICAgZ2wuY2xlYXIoZ2wuQ09MT1JfQlVGRkVSX0JJVCk7XG4gICAgfVxuXG4gICAgaWYgKCFXZWJWUkNvbmZpZy5ESVJUWV9TVUJNSVRfRlJBTUVfQklORElOR1MpIHtcbiAgICAgIHNlbGYucmVhbEJpbmRGcmFtZWJ1ZmZlci5jYWxsKGdsLCBnbC5GUkFNRUJVRkZFUiwgc2VsZi5sYXN0Qm91bmRGcmFtZWJ1ZmZlcik7XG4gICAgfVxuXG4gICAgLy8gUmVzdG9yZSBzdGF0ZVxuICAgIGlmIChzZWxmLmN1bGxGYWNlKSB7IHNlbGYucmVhbEVuYWJsZS5jYWxsKGdsLCBnbC5DVUxMX0ZBQ0UpOyB9XG4gICAgaWYgKHNlbGYuZGVwdGhUZXN0KSB7IHNlbGYucmVhbEVuYWJsZS5jYWxsKGdsLCBnbC5ERVBUSF9URVNUKTsgfVxuICAgIGlmIChzZWxmLmJsZW5kKSB7IHNlbGYucmVhbEVuYWJsZS5jYWxsKGdsLCBnbC5CTEVORCk7IH1cbiAgICBpZiAoc2VsZi5zY2lzc29yVGVzdCkgeyBzZWxmLnJlYWxFbmFibGUuY2FsbChnbCwgZ2wuU0NJU1NPUl9URVNUKTsgfVxuICAgIGlmIChzZWxmLnN0ZW5jaWxUZXN0KSB7IHNlbGYucmVhbEVuYWJsZS5jYWxsKGdsLCBnbC5TVEVOQ0lMX1RFU1QpOyB9XG5cbiAgICBzZWxmLnJlYWxDb2xvck1hc2suYXBwbHkoZ2wsIHNlbGYuY29sb3JNYXNrKTtcbiAgICBzZWxmLnJlYWxWaWV3cG9ydC5hcHBseShnbCwgc2VsZi52aWV3cG9ydCk7XG4gICAgaWYgKHNlbGYuY3R4QXR0cmlicy5hbHBoYSB8fCAhc2VsZi5jdHhBdHRyaWJzLnByZXNlcnZlRHJhd2luZ0J1ZmZlcikge1xuICAgICAgc2VsZi5yZWFsQ2xlYXJDb2xvci5hcHBseShnbCwgc2VsZi5jbGVhckNvbG9yKTtcbiAgICB9XG4gIH0pO1xuXG4gIC8vIFdvcmthcm91bmQgZm9yIHRoZSBmYWN0IHRoYXQgU2FmYXJpIGRvZXNuJ3QgYWxsb3cgdXMgdG8gcGF0Y2ggdGhlIGNhbnZhc1xuICAvLyB3aWR0aCBhbmQgaGVpZ2h0IGNvcnJlY3RseS4gQWZ0ZXIgZWFjaCBzdWJtaXQgZnJhbWUgY2hlY2sgdG8gc2VlIHdoYXQgdGhlXG4gIC8vIHJlYWwgYmFja2J1ZmZlciBzaXplIGhhcyBiZWVuIHNldCB0byBhbmQgcmVzaXplIHRoZSBmYWtlIGJhY2tidWZmZXIgc2l6ZVxuICAvLyB0byBtYXRjaC5cbiAgaWYgKFV0aWwuaXNJT1MoKSkge1xuICAgIHZhciBjYW52YXMgPSBnbC5jYW52YXM7XG4gICAgaWYgKGNhbnZhcy53aWR0aCAhPSBzZWxmLmJ1ZmZlcldpZHRoIHx8IGNhbnZhcy5oZWlnaHQgIT0gc2VsZi5idWZmZXJIZWlnaHQpIHtcbiAgICAgIHNlbGYuYnVmZmVyV2lkdGggPSBjYW52YXMud2lkdGg7XG4gICAgICBzZWxmLmJ1ZmZlckhlaWdodCA9IGNhbnZhcy5oZWlnaHQ7XG4gICAgICBzZWxmLm9uUmVzaXplKCk7XG4gICAgfVxuICB9XG59O1xuXG4vKipcbiAqIENhbGwgd2hlbiB0aGUgZGV2aWNlSW5mbyBoYXMgY2hhbmdlZC4gQXQgdGhpcyBwb2ludCB3ZSBuZWVkXG4gKiB0byByZS1jYWxjdWxhdGUgdGhlIGRpc3RvcnRpb24gbWVzaC5cbiAqL1xuQ2FyZGJvYXJkRGlzdG9ydGVyLnByb3RvdHlwZS51cGRhdGVEZXZpY2VJbmZvID0gZnVuY3Rpb24oZGV2aWNlSW5mbykge1xuICB2YXIgZ2wgPSB0aGlzLmdsO1xuICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgdmFyIGdsU3RhdGUgPSBbZ2wuQVJSQVlfQlVGRkVSX0JJTkRJTkcsIGdsLkVMRU1FTlRfQVJSQVlfQlVGRkVSX0JJTkRJTkddO1xuICBXR0xVUHJlc2VydmVHTFN0YXRlKGdsLCBnbFN0YXRlLCBmdW5jdGlvbihnbCkge1xuICAgIHZhciB2ZXJ0aWNlcyA9IHNlbGYuY29tcHV0ZU1lc2hWZXJ0aWNlc18oc2VsZi5tZXNoV2lkdGgsIHNlbGYubWVzaEhlaWdodCwgZGV2aWNlSW5mbyk7XG4gICAgZ2wuYmluZEJ1ZmZlcihnbC5BUlJBWV9CVUZGRVIsIHNlbGYudmVydGV4QnVmZmVyKTtcbiAgICBnbC5idWZmZXJEYXRhKGdsLkFSUkFZX0JVRkZFUiwgdmVydGljZXMsIGdsLlNUQVRJQ19EUkFXKTtcblxuICAgIC8vIEluZGljZXMgZG9uJ3QgY2hhbmdlIGJhc2VkIG9uIGRldmljZSBwYXJhbWV0ZXJzLCBzbyBvbmx5IGNvbXB1dGUgb25jZS5cbiAgICBpZiAoIXNlbGYuaW5kZXhDb3VudCkge1xuICAgICAgdmFyIGluZGljZXMgPSBzZWxmLmNvbXB1dGVNZXNoSW5kaWNlc18oc2VsZi5tZXNoV2lkdGgsIHNlbGYubWVzaEhlaWdodCk7XG4gICAgICBnbC5iaW5kQnVmZmVyKGdsLkVMRU1FTlRfQVJSQVlfQlVGRkVSLCBzZWxmLmluZGV4QnVmZmVyKTtcbiAgICAgIGdsLmJ1ZmZlckRhdGEoZ2wuRUxFTUVOVF9BUlJBWV9CVUZGRVIsIGluZGljZXMsIGdsLlNUQVRJQ19EUkFXKTtcbiAgICAgIHNlbGYuaW5kZXhDb3VudCA9IGluZGljZXMubGVuZ3RoO1xuICAgIH1cbiAgfSk7XG59O1xuXG4vKipcbiAqIEJ1aWxkIHRoZSBkaXN0b3J0aW9uIG1lc2ggdmVydGljZXMuXG4gKiBCYXNlZCBvbiBjb2RlIGZyb20gdGhlIFVuaXR5IGNhcmRib2FyZCBwbHVnaW4uXG4gKi9cbkNhcmRib2FyZERpc3RvcnRlci5wcm90b3R5cGUuY29tcHV0ZU1lc2hWZXJ0aWNlc18gPSBmdW5jdGlvbih3aWR0aCwgaGVpZ2h0LCBkZXZpY2VJbmZvKSB7XG4gIHZhciB2ZXJ0aWNlcyA9IG5ldyBGbG9hdDMyQXJyYXkoMiAqIHdpZHRoICogaGVpZ2h0ICogNSk7XG5cbiAgdmFyIGxlbnNGcnVzdHVtID0gZGV2aWNlSW5mby5nZXRMZWZ0RXllVmlzaWJsZVRhbkFuZ2xlcygpO1xuICB2YXIgbm9MZW5zRnJ1c3R1bSA9IGRldmljZUluZm8uZ2V0TGVmdEV5ZU5vTGVuc1RhbkFuZ2xlcygpO1xuICB2YXIgdmlld3BvcnQgPSBkZXZpY2VJbmZvLmdldExlZnRFeWVWaXNpYmxlU2NyZWVuUmVjdChub0xlbnNGcnVzdHVtKTtcbiAgdmFyIHZpZHggPSAwO1xuICB2YXIgaWlkeCA9IDA7XG4gIGZvciAodmFyIGUgPSAwOyBlIDwgMjsgZSsrKSB7XG4gICAgZm9yICh2YXIgaiA9IDA7IGogPCBoZWlnaHQ7IGorKykge1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB3aWR0aDsgaSsrLCB2aWR4KyspIHtcbiAgICAgICAgdmFyIHUgPSBpIC8gKHdpZHRoIC0gMSk7XG4gICAgICAgIHZhciB2ID0gaiAvIChoZWlnaHQgLSAxKTtcblxuICAgICAgICAvLyBHcmlkIHBvaW50cyByZWd1bGFybHkgc3BhY2VkIGluIFN0cmVvU2NyZWVuLCBhbmQgYmFycmVsIGRpc3RvcnRlZCBpblxuICAgICAgICAvLyB0aGUgbWVzaC5cbiAgICAgICAgdmFyIHMgPSB1O1xuICAgICAgICB2YXIgdCA9IHY7XG4gICAgICAgIHZhciB4ID0gVXRpbC5sZXJwKGxlbnNGcnVzdHVtWzBdLCBsZW5zRnJ1c3R1bVsyXSwgdSk7XG4gICAgICAgIHZhciB5ID0gVXRpbC5sZXJwKGxlbnNGcnVzdHVtWzNdLCBsZW5zRnJ1c3R1bVsxXSwgdik7XG4gICAgICAgIHZhciBkID0gTWF0aC5zcXJ0KHggKiB4ICsgeSAqIHkpO1xuICAgICAgICB2YXIgciA9IGRldmljZUluZm8uZGlzdG9ydGlvbi5kaXN0b3J0SW52ZXJzZShkKTtcbiAgICAgICAgdmFyIHAgPSB4ICogciAvIGQ7XG4gICAgICAgIHZhciBxID0geSAqIHIgLyBkO1xuICAgICAgICB1ID0gKHAgLSBub0xlbnNGcnVzdHVtWzBdKSAvIChub0xlbnNGcnVzdHVtWzJdIC0gbm9MZW5zRnJ1c3R1bVswXSk7XG4gICAgICAgIHYgPSAocSAtIG5vTGVuc0ZydXN0dW1bM10pIC8gKG5vTGVuc0ZydXN0dW1bMV0gLSBub0xlbnNGcnVzdHVtWzNdKTtcblxuICAgICAgICAvLyBDb252ZXJ0IHUsdiB0byBtZXNoIHNjcmVlbiBjb29yZGluYXRlcy5cbiAgICAgICAgdmFyIGFzcGVjdCA9IGRldmljZUluZm8uZGV2aWNlLndpZHRoTWV0ZXJzIC8gZGV2aWNlSW5mby5kZXZpY2UuaGVpZ2h0TWV0ZXJzO1xuXG4gICAgICAgIC8vIEZJWE1FOiBUaGUgb3JpZ2luYWwgVW5pdHkgcGx1Z2luIG11bHRpcGxpZWQgVSBieSB0aGUgYXNwZWN0IHJhdGlvXG4gICAgICAgIC8vIGFuZCBkaWRuJ3QgbXVsdGlwbHkgZWl0aGVyIHZhbHVlIGJ5IDIsIGJ1dCB0aGF0IHNlZW1zIHRvIGdldCBpdFxuICAgICAgICAvLyByZWFsbHkgY2xvc2UgdG8gY29ycmVjdCBsb29raW5nIGZvciBtZS4gSSBoYXRlIHRoaXMga2luZCBvZiBcIkRvbid0XG4gICAgICAgIC8vIGtub3cgd2h5IGl0IHdvcmtzXCIgY29kZSB0aG91Z2gsIGFuZCB3b2xkIGxvdmUgYSBtb3JlIGxvZ2ljYWxcbiAgICAgICAgLy8gZXhwbGFuYXRpb24gb2Ygd2hhdCBuZWVkcyB0byBoYXBwZW4gaGVyZS5cbiAgICAgICAgdSA9ICh2aWV3cG9ydC54ICsgdSAqIHZpZXdwb3J0LndpZHRoIC0gMC41KSAqIDIuMDsgLy8qIGFzcGVjdDtcbiAgICAgICAgdiA9ICh2aWV3cG9ydC55ICsgdiAqIHZpZXdwb3J0LmhlaWdodCAtIDAuNSkgKiAyLjA7XG5cbiAgICAgICAgdmVydGljZXNbKHZpZHggKiA1KSArIDBdID0gdTsgLy8gcG9zaXRpb24ueFxuICAgICAgICB2ZXJ0aWNlc1sodmlkeCAqIDUpICsgMV0gPSB2OyAvLyBwb3NpdGlvbi55XG4gICAgICAgIHZlcnRpY2VzWyh2aWR4ICogNSkgKyAyXSA9IHM7IC8vIHRleENvb3JkLnhcbiAgICAgICAgdmVydGljZXNbKHZpZHggKiA1KSArIDNdID0gdDsgLy8gdGV4Q29vcmQueVxuICAgICAgICB2ZXJ0aWNlc1sodmlkeCAqIDUpICsgNF0gPSBlOyAvLyB0ZXhDb29yZC56ICh2aWV3cG9ydCBpbmRleClcbiAgICAgIH1cbiAgICB9XG4gICAgdmFyIHcgPSBsZW5zRnJ1c3R1bVsyXSAtIGxlbnNGcnVzdHVtWzBdO1xuICAgIGxlbnNGcnVzdHVtWzBdID0gLSh3ICsgbGVuc0ZydXN0dW1bMF0pO1xuICAgIGxlbnNGcnVzdHVtWzJdID0gdyAtIGxlbnNGcnVzdHVtWzJdO1xuICAgIHcgPSBub0xlbnNGcnVzdHVtWzJdIC0gbm9MZW5zRnJ1c3R1bVswXTtcbiAgICBub0xlbnNGcnVzdHVtWzBdID0gLSh3ICsgbm9MZW5zRnJ1c3R1bVswXSk7XG4gICAgbm9MZW5zRnJ1c3R1bVsyXSA9IHcgLSBub0xlbnNGcnVzdHVtWzJdO1xuICAgIHZpZXdwb3J0LnggPSAxIC0gKHZpZXdwb3J0LnggKyB2aWV3cG9ydC53aWR0aCk7XG4gIH1cbiAgcmV0dXJuIHZlcnRpY2VzO1xufVxuXG4vKipcbiAqIEJ1aWxkIHRoZSBkaXN0b3J0aW9uIG1lc2ggaW5kaWNlcy5cbiAqIEJhc2VkIG9uIGNvZGUgZnJvbSB0aGUgVW5pdHkgY2FyZGJvYXJkIHBsdWdpbi5cbiAqL1xuQ2FyZGJvYXJkRGlzdG9ydGVyLnByb3RvdHlwZS5jb21wdXRlTWVzaEluZGljZXNfID0gZnVuY3Rpb24od2lkdGgsIGhlaWdodCkge1xuICB2YXIgaW5kaWNlcyA9IG5ldyBVaW50MTZBcnJheSgyICogKHdpZHRoIC0gMSkgKiAoaGVpZ2h0IC0gMSkgKiA2KTtcbiAgdmFyIGhhbGZ3aWR0aCA9IHdpZHRoIC8gMjtcbiAgdmFyIGhhbGZoZWlnaHQgPSBoZWlnaHQgLyAyO1xuICB2YXIgdmlkeCA9IDA7XG4gIHZhciBpaWR4ID0gMDtcbiAgZm9yICh2YXIgZSA9IDA7IGUgPCAyOyBlKyspIHtcbiAgICBmb3IgKHZhciBqID0gMDsgaiA8IGhlaWdodDsgaisrKSB7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHdpZHRoOyBpKyssIHZpZHgrKykge1xuICAgICAgICBpZiAoaSA9PSAwIHx8IGogPT0gMClcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgLy8gQnVpbGQgYSBxdWFkLiAgTG93ZXIgcmlnaHQgYW5kIHVwcGVyIGxlZnQgcXVhZHJhbnRzIGhhdmUgcXVhZHMgd2l0aFxuICAgICAgICAvLyB0aGUgdHJpYW5nbGUgZGlhZ29uYWwgZmxpcHBlZCB0byBnZXQgdGhlIHZpZ25ldHRlIHRvIGludGVycG9sYXRlXG4gICAgICAgIC8vIGNvcnJlY3RseS5cbiAgICAgICAgaWYgKChpIDw9IGhhbGZ3aWR0aCkgPT0gKGogPD0gaGFsZmhlaWdodCkpIHtcbiAgICAgICAgICAvLyBRdWFkIGRpYWdvbmFsIGxvd2VyIGxlZnQgdG8gdXBwZXIgcmlnaHQuXG4gICAgICAgICAgaW5kaWNlc1tpaWR4KytdID0gdmlkeDtcbiAgICAgICAgICBpbmRpY2VzW2lpZHgrK10gPSB2aWR4IC0gd2lkdGggLSAxO1xuICAgICAgICAgIGluZGljZXNbaWlkeCsrXSA9IHZpZHggLSB3aWR0aDtcbiAgICAgICAgICBpbmRpY2VzW2lpZHgrK10gPSB2aWR4IC0gd2lkdGggLSAxO1xuICAgICAgICAgIGluZGljZXNbaWlkeCsrXSA9IHZpZHg7XG4gICAgICAgICAgaW5kaWNlc1tpaWR4KytdID0gdmlkeCAtIDE7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gUXVhZCBkaWFnb25hbCB1cHBlciBsZWZ0IHRvIGxvd2VyIHJpZ2h0LlxuICAgICAgICAgIGluZGljZXNbaWlkeCsrXSA9IHZpZHggLSAxO1xuICAgICAgICAgIGluZGljZXNbaWlkeCsrXSA9IHZpZHggLSB3aWR0aDtcbiAgICAgICAgICBpbmRpY2VzW2lpZHgrK10gPSB2aWR4O1xuICAgICAgICAgIGluZGljZXNbaWlkeCsrXSA9IHZpZHggLSB3aWR0aDtcbiAgICAgICAgICBpbmRpY2VzW2lpZHgrK10gPSB2aWR4IC0gMTtcbiAgICAgICAgICBpbmRpY2VzW2lpZHgrK10gPSB2aWR4IC0gd2lkdGggLSAxO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG4gIHJldHVybiBpbmRpY2VzO1xufTtcblxuQ2FyZGJvYXJkRGlzdG9ydGVyLnByb3RvdHlwZS5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3JfID0gZnVuY3Rpb24ocHJvdG8sIGF0dHJOYW1lKSB7XG4gIHZhciBkZXNjcmlwdG9yID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihwcm90bywgYXR0ck5hbWUpO1xuICAvLyBJbiBzb21lIGNhc2VzIChhaGVtLi4uIFNhZmFyaSksIHRoZSBkZXNjcmlwdG9yIHJldHVybnMgdW5kZWZpbmVkIGdldCBhbmRcbiAgLy8gc2V0IGZpZWxkcy4gSW4gdGhpcyBjYXNlLCB3ZSBuZWVkIHRvIGNyZWF0ZSBhIHN5bnRoZXRpYyBwcm9wZXJ0eVxuICAvLyBkZXNjcmlwdG9yLiBUaGlzIHdvcmtzIGFyb3VuZCBzb21lIG9mIHRoZSBpc3N1ZXMgaW5cbiAgLy8gaHR0cHM6Ly9naXRodWIuY29tL2JvcmlzbXVzL3dlYnZyLXBvbHlmaWxsL2lzc3Vlcy80NlxuICBpZiAoZGVzY3JpcHRvci5nZXQgPT09IHVuZGVmaW5lZCB8fCBkZXNjcmlwdG9yLnNldCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgZGVzY3JpcHRvci5jb25maWd1cmFibGUgPSB0cnVlO1xuICAgIGRlc2NyaXB0b3IuZW51bWVyYWJsZSA9IHRydWU7XG4gICAgZGVzY3JpcHRvci5nZXQgPSBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB0aGlzLmdldEF0dHJpYnV0ZShhdHRyTmFtZSk7XG4gICAgfTtcbiAgICBkZXNjcmlwdG9yLnNldCA9IGZ1bmN0aW9uKHZhbCkge1xuICAgICAgdGhpcy5zZXRBdHRyaWJ1dGUoYXR0ck5hbWUsIHZhbCk7XG4gICAgfTtcbiAgfVxuICByZXR1cm4gZGVzY3JpcHRvcjtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQ2FyZGJvYXJkRGlzdG9ydGVyO1xuIiwiLypcbiAqIENvcHlyaWdodCAyMDE2IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xuICogeW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuICogWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG4gKlxuICogICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuICpcbiAqIFVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbiAqIGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbiAqIFdJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuICogU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxuICogbGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG4gKi9cblxudmFyIFV0aWwgPSByZXF1aXJlKCcuL3V0aWwuanMnKTtcbnZhciBXR0xVUHJlc2VydmVHTFN0YXRlID0gcmVxdWlyZSgnLi9kZXBzL3dnbHUtcHJlc2VydmUtc3RhdGUuanMnKTtcblxudmFyIHVpVlMgPSBbXG4gICdhdHRyaWJ1dGUgdmVjMiBwb3NpdGlvbjsnLFxuXG4gICd1bmlmb3JtIG1hdDQgcHJvamVjdGlvbk1hdDsnLFxuXG4gICd2b2lkIG1haW4oKSB7JyxcbiAgJyAgZ2xfUG9zaXRpb24gPSBwcm9qZWN0aW9uTWF0ICogdmVjNCggcG9zaXRpb24sIC0xLjAsIDEuMCApOycsXG4gICd9Jyxcbl0uam9pbignXFxuJyk7XG5cbnZhciB1aUZTID0gW1xuICAncHJlY2lzaW9uIG1lZGl1bXAgZmxvYXQ7JyxcblxuICAndW5pZm9ybSB2ZWM0IGNvbG9yOycsXG5cbiAgJ3ZvaWQgbWFpbigpIHsnLFxuICAnICBnbF9GcmFnQ29sb3IgPSBjb2xvcjsnLFxuICAnfScsXG5dLmpvaW4oJ1xcbicpO1xuXG52YXIgREVHMlJBRCA9IE1hdGguUEkvMTgwLjA7XG5cbi8vIFRoZSBnZWFyIGhhcyA2IGlkZW50aWNhbCBzZWN0aW9ucywgZWFjaCBzcGFubmluZyA2MCBkZWdyZWVzLlxudmFyIGtBbmdsZVBlckdlYXJTZWN0aW9uID0gNjA7XG5cbi8vIEhhbGYtYW5nbGUgb2YgdGhlIHNwYW4gb2YgdGhlIG91dGVyIHJpbS5cbnZhciBrT3V0ZXJSaW1FbmRBbmdsZSA9IDEyO1xuXG4vLyBBbmdsZSBiZXR3ZWVuIHRoZSBtaWRkbGUgb2YgdGhlIG91dGVyIHJpbSBhbmQgdGhlIHN0YXJ0IG9mIHRoZSBpbm5lciByaW0uXG52YXIga0lubmVyUmltQmVnaW5BbmdsZSA9IDIwO1xuXG4vLyBEaXN0YW5jZSBmcm9tIGNlbnRlciB0byBvdXRlciByaW0sIG5vcm1hbGl6ZWQgc28gdGhhdCB0aGUgZW50aXJlIG1vZGVsXG4vLyBmaXRzIGluIGEgWy0xLCAxXSB4IFstMSwgMV0gc3F1YXJlLlxudmFyIGtPdXRlclJhZGl1cyA9IDE7XG5cbi8vIERpc3RhbmNlIGZyb20gY2VudGVyIHRvIGRlcHJlc3NlZCByaW0sIGluIG1vZGVsIHVuaXRzLlxudmFyIGtNaWRkbGVSYWRpdXMgPSAwLjc1O1xuXG4vLyBSYWRpdXMgb2YgdGhlIGlubmVyIGhvbGxvdyBjaXJjbGUsIGluIG1vZGVsIHVuaXRzLlxudmFyIGtJbm5lclJhZGl1cyA9IDAuMzEyNTtcblxuLy8gQ2VudGVyIGxpbmUgdGhpY2tuZXNzIGluIERQLlxudmFyIGtDZW50ZXJMaW5lVGhpY2tuZXNzRHAgPSA0O1xuXG4vLyBCdXR0b24gd2lkdGggaW4gRFAuXG52YXIga0J1dHRvbldpZHRoRHAgPSAyODtcblxuLy8gRmFjdG9yIHRvIHNjYWxlIHRoZSB0b3VjaCBhcmVhIHRoYXQgcmVzcG9uZHMgdG8gdGhlIHRvdWNoLlxudmFyIGtUb3VjaFNsb3BGYWN0b3IgPSAxLjU7XG5cbnZhciBBbmdsZXMgPSBbXG4gIDAsIGtPdXRlclJpbUVuZEFuZ2xlLCBrSW5uZXJSaW1CZWdpbkFuZ2xlLFxuICBrQW5nbGVQZXJHZWFyU2VjdGlvbiAtIGtJbm5lclJpbUJlZ2luQW5nbGUsXG4gIGtBbmdsZVBlckdlYXJTZWN0aW9uIC0ga091dGVyUmltRW5kQW5nbGVcbl07XG5cbi8qKlxuICogUmVuZGVycyB0aGUgYWxpZ25tZW50IGxpbmUgYW5kIFwib3B0aW9uc1wiIGdlYXIuIEl0IGlzIGFzc3VtZWQgdGhhdCB0aGUgY2FudmFzXG4gKiB0aGlzIGlzIHJlbmRlcmVkIGludG8gY292ZXJzIHRoZSBlbnRpcmUgc2NyZWVuIChvciBjbG9zZSB0byBpdC4pXG4gKi9cbmZ1bmN0aW9uIENhcmRib2FyZFVJKGdsKSB7XG4gIHRoaXMuZ2wgPSBnbDtcblxuICB0aGlzLmF0dHJpYnMgPSB7XG4gICAgcG9zaXRpb246IDBcbiAgfTtcbiAgdGhpcy5wcm9ncmFtID0gVXRpbC5saW5rUHJvZ3JhbShnbCwgdWlWUywgdWlGUywgdGhpcy5hdHRyaWJzKTtcbiAgdGhpcy51bmlmb3JtcyA9IFV0aWwuZ2V0UHJvZ3JhbVVuaWZvcm1zKGdsLCB0aGlzLnByb2dyYW0pO1xuXG4gIHRoaXMudmVydGV4QnVmZmVyID0gZ2wuY3JlYXRlQnVmZmVyKCk7XG4gIHRoaXMuZ2Vhck9mZnNldCA9IDA7XG4gIHRoaXMuZ2VhclZlcnRleENvdW50ID0gMDtcbiAgdGhpcy5hcnJvd09mZnNldCA9IDA7XG4gIHRoaXMuYXJyb3dWZXJ0ZXhDb3VudCA9IDA7XG5cbiAgdGhpcy5wcm9qTWF0ID0gbmV3IEZsb2F0MzJBcnJheSgxNik7XG5cbiAgdGhpcy5saXN0ZW5lciA9IG51bGw7XG5cbiAgdGhpcy5vblJlc2l6ZSgpO1xufTtcblxuLyoqXG4gKiBUZWFycyBkb3duIGFsbCB0aGUgcmVzb3VyY2VzIGNyZWF0ZWQgYnkgdGhlIFVJIHJlbmRlcmVyLlxuICovXG5DYXJkYm9hcmRVSS5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uKCkge1xuICB2YXIgZ2wgPSB0aGlzLmdsO1xuXG4gIGlmICh0aGlzLmxpc3RlbmVyKSB7XG4gICAgZ2wuY2FudmFzLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgdGhpcy5saXN0ZW5lciwgZmFsc2UpO1xuICB9XG5cbiAgZ2wuZGVsZXRlUHJvZ3JhbSh0aGlzLnByb2dyYW0pO1xuICBnbC5kZWxldGVCdWZmZXIodGhpcy52ZXJ0ZXhCdWZmZXIpO1xufTtcblxuLyoqXG4gKiBBZGRzIGEgbGlzdGVuZXIgdG8gY2xpY2tzIG9uIHRoZSBnZWFyIGFuZCBiYWNrIGljb25zXG4gKi9cbkNhcmRib2FyZFVJLnByb3RvdHlwZS5saXN0ZW4gPSBmdW5jdGlvbihvcHRpb25zQ2FsbGJhY2ssIGJhY2tDYWxsYmFjaykge1xuICB2YXIgY2FudmFzID0gdGhpcy5nbC5jYW52YXM7XG4gIHRoaXMubGlzdGVuZXIgPSBmdW5jdGlvbihldmVudCkge1xuICAgIHZhciBtaWRsaW5lID0gY2FudmFzLmNsaWVudFdpZHRoIC8gMjtcbiAgICB2YXIgYnV0dG9uU2l6ZSA9IGtCdXR0b25XaWR0aERwICoga1RvdWNoU2xvcEZhY3RvcjtcbiAgICAvLyBDaGVjayB0byBzZWUgaWYgdGhlIHVzZXIgY2xpY2tlZCBvbiAob3IgYXJvdW5kKSB0aGUgZ2VhciBpY29uXG4gICAgaWYgKGV2ZW50LmNsaWVudFggPiBtaWRsaW5lIC0gYnV0dG9uU2l6ZSAmJlxuICAgICAgICBldmVudC5jbGllbnRYIDwgbWlkbGluZSArIGJ1dHRvblNpemUgJiZcbiAgICAgICAgZXZlbnQuY2xpZW50WSA+IGNhbnZhcy5jbGllbnRIZWlnaHQgLSBidXR0b25TaXplKSB7XG4gICAgICBvcHRpb25zQ2FsbGJhY2soZXZlbnQpO1xuICAgIH1cbiAgICAvLyBDaGVjayB0byBzZWUgaWYgdGhlIHVzZXIgY2xpY2tlZCBvbiAob3IgYXJvdW5kKSB0aGUgYmFjayBpY29uXG4gICAgZWxzZSBpZiAoZXZlbnQuY2xpZW50WCA8IGJ1dHRvblNpemUgJiYgZXZlbnQuY2xpZW50WSA8IGJ1dHRvblNpemUpIHtcbiAgICAgIGJhY2tDYWxsYmFjayhldmVudCk7XG4gICAgfVxuICB9O1xuICBjYW52YXMuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCB0aGlzLmxpc3RlbmVyLCBmYWxzZSk7XG59O1xuXG4vKipcbiAqIEJ1aWxkcyB0aGUgVUkgbWVzaC5cbiAqL1xuQ2FyZGJvYXJkVUkucHJvdG90eXBlLm9uUmVzaXplID0gZnVuY3Rpb24oKSB7XG4gIHZhciBnbCA9IHRoaXMuZ2w7XG4gIHZhciBzZWxmID0gdGhpcztcblxuICB2YXIgZ2xTdGF0ZSA9IFtcbiAgICBnbC5BUlJBWV9CVUZGRVJfQklORElOR1xuICBdO1xuXG4gIFdHTFVQcmVzZXJ2ZUdMU3RhdGUoZ2wsIGdsU3RhdGUsIGZ1bmN0aW9uKGdsKSB7XG4gICAgdmFyIHZlcnRpY2VzID0gW107XG5cbiAgICB2YXIgbWlkbGluZSA9IGdsLmRyYXdpbmdCdWZmZXJXaWR0aCAvIDI7XG5cbiAgICAvLyBBc3N1bWVzIHlvdXIgY2FudmFzIHdpZHRoIGFuZCBoZWlnaHQgaXMgc2NhbGVkIHByb3BvcnRpb25hdGVseS5cbiAgICAvLyBUT0RPKHNtdXMpOiBUaGUgZm9sbG93aW5nIGNhdXNlcyBidXR0b25zIHRvIGJlY29tZSBodWdlIG9uIGlPUywgYnV0IHNlZW1zXG4gICAgLy8gbGlrZSB0aGUgcmlnaHQgdGhpbmcgdG8gZG8uIEZvciBub3csIGFkZGVkIGEgaGFjay4gQnV0IHJlYWxseSwgaW52ZXN0aWdhdGUgd2h5LlxuICAgIHZhciBkcHMgPSAoZ2wuZHJhd2luZ0J1ZmZlcldpZHRoIC8gKHNjcmVlbi53aWR0aCAqIHdpbmRvdy5kZXZpY2VQaXhlbFJhdGlvKSk7XG4gICAgaWYgKCFVdGlsLmlzSU9TKCkpIHtcbiAgICAgIGRwcyAqPSB3aW5kb3cuZGV2aWNlUGl4ZWxSYXRpbztcbiAgICB9XG5cbiAgICB2YXIgbGluZVdpZHRoID0ga0NlbnRlckxpbmVUaGlja25lc3NEcCAqIGRwcyAvIDI7XG4gICAgdmFyIGJ1dHRvblNpemUgPSBrQnV0dG9uV2lkdGhEcCAqIGtUb3VjaFNsb3BGYWN0b3IgKiBkcHM7XG4gICAgdmFyIGJ1dHRvblNjYWxlID0ga0J1dHRvbldpZHRoRHAgKiBkcHMgLyAyO1xuICAgIHZhciBidXR0b25Cb3JkZXIgPSAoKGtCdXR0b25XaWR0aERwICoga1RvdWNoU2xvcEZhY3RvcikgLSBrQnV0dG9uV2lkdGhEcCkgKiBkcHM7XG5cbiAgICAvLyBCdWlsZCBjZW50ZXJsaW5lXG4gICAgdmVydGljZXMucHVzaChtaWRsaW5lIC0gbGluZVdpZHRoLCBidXR0b25TaXplKTtcbiAgICB2ZXJ0aWNlcy5wdXNoKG1pZGxpbmUgLSBsaW5lV2lkdGgsIGdsLmRyYXdpbmdCdWZmZXJIZWlnaHQpO1xuICAgIHZlcnRpY2VzLnB1c2gobWlkbGluZSArIGxpbmVXaWR0aCwgYnV0dG9uU2l6ZSk7XG4gICAgdmVydGljZXMucHVzaChtaWRsaW5lICsgbGluZVdpZHRoLCBnbC5kcmF3aW5nQnVmZmVySGVpZ2h0KTtcblxuICAgIC8vIEJ1aWxkIGdlYXJcbiAgICBzZWxmLmdlYXJPZmZzZXQgPSAodmVydGljZXMubGVuZ3RoIC8gMik7XG5cbiAgICBmdW5jdGlvbiBhZGRHZWFyU2VnbWVudCh0aGV0YSwgcikge1xuICAgICAgdmFyIGFuZ2xlID0gKDkwIC0gdGhldGEpICogREVHMlJBRDtcbiAgICAgIHZhciB4ID0gTWF0aC5jb3MoYW5nbGUpO1xuICAgICAgdmFyIHkgPSBNYXRoLnNpbihhbmdsZSk7XG4gICAgICB2ZXJ0aWNlcy5wdXNoKGtJbm5lclJhZGl1cyAqIHggKiBidXR0b25TY2FsZSArIG1pZGxpbmUsIGtJbm5lclJhZGl1cyAqIHkgKiBidXR0b25TY2FsZSArIGJ1dHRvblNjYWxlKTtcbiAgICAgIHZlcnRpY2VzLnB1c2gociAqIHggKiBidXR0b25TY2FsZSArIG1pZGxpbmUsIHIgKiB5ICogYnV0dG9uU2NhbGUgKyBidXR0b25TY2FsZSk7XG4gICAgfVxuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPD0gNjsgaSsrKSB7XG4gICAgICB2YXIgc2VnbWVudFRoZXRhID0gaSAqIGtBbmdsZVBlckdlYXJTZWN0aW9uO1xuXG4gICAgICBhZGRHZWFyU2VnbWVudChzZWdtZW50VGhldGEsIGtPdXRlclJhZGl1cyk7XG4gICAgICBhZGRHZWFyU2VnbWVudChzZWdtZW50VGhldGEgKyBrT3V0ZXJSaW1FbmRBbmdsZSwga091dGVyUmFkaXVzKTtcbiAgICAgIGFkZEdlYXJTZWdtZW50KHNlZ21lbnRUaGV0YSArIGtJbm5lclJpbUJlZ2luQW5nbGUsIGtNaWRkbGVSYWRpdXMpO1xuICAgICAgYWRkR2VhclNlZ21lbnQoc2VnbWVudFRoZXRhICsgKGtBbmdsZVBlckdlYXJTZWN0aW9uIC0ga0lubmVyUmltQmVnaW5BbmdsZSksIGtNaWRkbGVSYWRpdXMpO1xuICAgICAgYWRkR2VhclNlZ21lbnQoc2VnbWVudFRoZXRhICsgKGtBbmdsZVBlckdlYXJTZWN0aW9uIC0ga091dGVyUmltRW5kQW5nbGUpLCBrT3V0ZXJSYWRpdXMpO1xuICAgIH1cblxuICAgIHNlbGYuZ2VhclZlcnRleENvdW50ID0gKHZlcnRpY2VzLmxlbmd0aCAvIDIpIC0gc2VsZi5nZWFyT2Zmc2V0O1xuXG4gICAgLy8gQnVpbGQgYmFjayBhcnJvd1xuICAgIHNlbGYuYXJyb3dPZmZzZXQgPSAodmVydGljZXMubGVuZ3RoIC8gMik7XG5cbiAgICBmdW5jdGlvbiBhZGRBcnJvd1ZlcnRleCh4LCB5KSB7XG4gICAgICB2ZXJ0aWNlcy5wdXNoKGJ1dHRvbkJvcmRlciArIHgsIGdsLmRyYXdpbmdCdWZmZXJIZWlnaHQgLSBidXR0b25Cb3JkZXIgLSB5KTtcbiAgICB9XG5cbiAgICB2YXIgYW5nbGVkTGluZVdpZHRoID0gbGluZVdpZHRoIC8gTWF0aC5zaW4oNDUgKiBERUcyUkFEKTtcblxuICAgIGFkZEFycm93VmVydGV4KDAsIGJ1dHRvblNjYWxlKTtcbiAgICBhZGRBcnJvd1ZlcnRleChidXR0b25TY2FsZSwgMCk7XG4gICAgYWRkQXJyb3dWZXJ0ZXgoYnV0dG9uU2NhbGUgKyBhbmdsZWRMaW5lV2lkdGgsIGFuZ2xlZExpbmVXaWR0aCk7XG4gICAgYWRkQXJyb3dWZXJ0ZXgoYW5nbGVkTGluZVdpZHRoLCBidXR0b25TY2FsZSArIGFuZ2xlZExpbmVXaWR0aCk7XG5cbiAgICBhZGRBcnJvd1ZlcnRleChhbmdsZWRMaW5lV2lkdGgsIGJ1dHRvblNjYWxlIC0gYW5nbGVkTGluZVdpZHRoKTtcbiAgICBhZGRBcnJvd1ZlcnRleCgwLCBidXR0b25TY2FsZSk7XG4gICAgYWRkQXJyb3dWZXJ0ZXgoYnV0dG9uU2NhbGUsIGJ1dHRvblNjYWxlICogMik7XG4gICAgYWRkQXJyb3dWZXJ0ZXgoYnV0dG9uU2NhbGUgKyBhbmdsZWRMaW5lV2lkdGgsIChidXR0b25TY2FsZSAqIDIpIC0gYW5nbGVkTGluZVdpZHRoKTtcblxuICAgIGFkZEFycm93VmVydGV4KGFuZ2xlZExpbmVXaWR0aCwgYnV0dG9uU2NhbGUgLSBhbmdsZWRMaW5lV2lkdGgpO1xuICAgIGFkZEFycm93VmVydGV4KDAsIGJ1dHRvblNjYWxlKTtcblxuICAgIGFkZEFycm93VmVydGV4KGFuZ2xlZExpbmVXaWR0aCwgYnV0dG9uU2NhbGUgLSBsaW5lV2lkdGgpO1xuICAgIGFkZEFycm93VmVydGV4KGtCdXR0b25XaWR0aERwICogZHBzLCBidXR0b25TY2FsZSAtIGxpbmVXaWR0aCk7XG4gICAgYWRkQXJyb3dWZXJ0ZXgoYW5nbGVkTGluZVdpZHRoLCBidXR0b25TY2FsZSArIGxpbmVXaWR0aCk7XG4gICAgYWRkQXJyb3dWZXJ0ZXgoa0J1dHRvbldpZHRoRHAgKiBkcHMsIGJ1dHRvblNjYWxlICsgbGluZVdpZHRoKTtcblxuICAgIHNlbGYuYXJyb3dWZXJ0ZXhDb3VudCA9ICh2ZXJ0aWNlcy5sZW5ndGggLyAyKSAtIHNlbGYuYXJyb3dPZmZzZXQ7XG5cbiAgICAvLyBCdWZmZXIgZGF0YVxuICAgIGdsLmJpbmRCdWZmZXIoZ2wuQVJSQVlfQlVGRkVSLCBzZWxmLnZlcnRleEJ1ZmZlcik7XG4gICAgZ2wuYnVmZmVyRGF0YShnbC5BUlJBWV9CVUZGRVIsIG5ldyBGbG9hdDMyQXJyYXkodmVydGljZXMpLCBnbC5TVEFUSUNfRFJBVyk7XG4gIH0pO1xufTtcblxuLyoqXG4gKiBQZXJmb3JtcyBkaXN0b3J0aW9uIHBhc3Mgb24gdGhlIGluamVjdGVkIGJhY2tidWZmZXIsIHJlbmRlcmluZyBpdCB0byB0aGUgcmVhbFxuICogYmFja2J1ZmZlci5cbiAqL1xuQ2FyZGJvYXJkVUkucHJvdG90eXBlLnJlbmRlciA9IGZ1bmN0aW9uKCkge1xuICB2YXIgZ2wgPSB0aGlzLmdsO1xuICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgdmFyIGdsU3RhdGUgPSBbXG4gICAgZ2wuQ1VMTF9GQUNFLFxuICAgIGdsLkRFUFRIX1RFU1QsXG4gICAgZ2wuQkxFTkQsXG4gICAgZ2wuU0NJU1NPUl9URVNULFxuICAgIGdsLlNURU5DSUxfVEVTVCxcbiAgICBnbC5DT0xPUl9XUklURU1BU0ssXG4gICAgZ2wuVklFV1BPUlQsXG5cbiAgICBnbC5DVVJSRU5UX1BST0dSQU0sXG4gICAgZ2wuQVJSQVlfQlVGRkVSX0JJTkRJTkdcbiAgXTtcblxuICBXR0xVUHJlc2VydmVHTFN0YXRlKGdsLCBnbFN0YXRlLCBmdW5jdGlvbihnbCkge1xuICAgIC8vIE1ha2Ugc3VyZSB0aGUgR0wgc3RhdGUgaXMgaW4gYSBnb29kIHBsYWNlXG4gICAgZ2wuZGlzYWJsZShnbC5DVUxMX0ZBQ0UpO1xuICAgIGdsLmRpc2FibGUoZ2wuREVQVEhfVEVTVCk7XG4gICAgZ2wuZGlzYWJsZShnbC5CTEVORCk7XG4gICAgZ2wuZGlzYWJsZShnbC5TQ0lTU09SX1RFU1QpO1xuICAgIGdsLmRpc2FibGUoZ2wuU1RFTkNJTF9URVNUKTtcbiAgICBnbC5jb2xvck1hc2sodHJ1ZSwgdHJ1ZSwgdHJ1ZSwgdHJ1ZSk7XG4gICAgZ2wudmlld3BvcnQoMCwgMCwgZ2wuZHJhd2luZ0J1ZmZlcldpZHRoLCBnbC5kcmF3aW5nQnVmZmVySGVpZ2h0KTtcblxuICAgIHNlbGYucmVuZGVyTm9TdGF0ZSgpO1xuICB9KTtcbn07XG5cbkNhcmRib2FyZFVJLnByb3RvdHlwZS5yZW5kZXJOb1N0YXRlID0gZnVuY3Rpb24oKSB7XG4gIHZhciBnbCA9IHRoaXMuZ2w7XG5cbiAgLy8gQmluZCBkaXN0b3J0aW9uIHByb2dyYW0gYW5kIG1lc2hcbiAgZ2wudXNlUHJvZ3JhbSh0aGlzLnByb2dyYW0pO1xuXG4gIGdsLmJpbmRCdWZmZXIoZ2wuQVJSQVlfQlVGRkVSLCB0aGlzLnZlcnRleEJ1ZmZlcik7XG4gIGdsLmVuYWJsZVZlcnRleEF0dHJpYkFycmF5KHRoaXMuYXR0cmlicy5wb3NpdGlvbik7XG4gIGdsLnZlcnRleEF0dHJpYlBvaW50ZXIodGhpcy5hdHRyaWJzLnBvc2l0aW9uLCAyLCBnbC5GTE9BVCwgZmFsc2UsIDgsIDApO1xuXG4gIGdsLnVuaWZvcm00Zih0aGlzLnVuaWZvcm1zLmNvbG9yLCAxLjAsIDEuMCwgMS4wLCAxLjApO1xuXG4gIFV0aWwub3J0aG9NYXRyaXgodGhpcy5wcm9qTWF0LCAwLCBnbC5kcmF3aW5nQnVmZmVyV2lkdGgsIDAsIGdsLmRyYXdpbmdCdWZmZXJIZWlnaHQsIDAuMSwgMTAyNC4wKTtcbiAgZ2wudW5pZm9ybU1hdHJpeDRmdih0aGlzLnVuaWZvcm1zLnByb2plY3Rpb25NYXQsIGZhbHNlLCB0aGlzLnByb2pNYXQpO1xuXG4gIC8vIERyYXdzIFVJIGVsZW1lbnRcbiAgZ2wuZHJhd0FycmF5cyhnbC5UUklBTkdMRV9TVFJJUCwgMCwgNCk7XG4gIGdsLmRyYXdBcnJheXMoZ2wuVFJJQU5HTEVfU1RSSVAsIHRoaXMuZ2Vhck9mZnNldCwgdGhpcy5nZWFyVmVydGV4Q291bnQpO1xuICBnbC5kcmF3QXJyYXlzKGdsLlRSSUFOR0xFX1NUUklQLCB0aGlzLmFycm93T2Zmc2V0LCB0aGlzLmFycm93VmVydGV4Q291bnQpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBDYXJkYm9hcmRVSTtcbiIsIi8qXG4gKiBDb3B5cmlnaHQgMjAxNiBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICogTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcbiAqIHlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cbiAqIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuICpcbiAqICAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcbiAqXG4gKiBVbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG4gKiBkaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG4gKiBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cbiAqIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbiAqIGxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuICovXG5cbnZhciBDYXJkYm9hcmREaXN0b3J0ZXIgPSByZXF1aXJlKCcuL2NhcmRib2FyZC1kaXN0b3J0ZXIuanMnKTtcbnZhciBDYXJkYm9hcmRVSSA9IHJlcXVpcmUoJy4vY2FyZGJvYXJkLXVpLmpzJyk7XG52YXIgRGV2aWNlSW5mbyA9IHJlcXVpcmUoJy4vZGV2aWNlLWluZm8uanMnKTtcbnZhciBEcGRiID0gcmVxdWlyZSgnLi9kcGRiL2RwZGIuanMnKTtcbnZhciBGdXNpb25Qb3NlU2Vuc29yID0gcmVxdWlyZSgnLi9zZW5zb3ItZnVzaW9uL2Z1c2lvbi1wb3NlLXNlbnNvci5qcycpO1xudmFyIFJvdGF0ZUluc3RydWN0aW9ucyA9IHJlcXVpcmUoJy4vcm90YXRlLWluc3RydWN0aW9ucy5qcycpO1xudmFyIFZpZXdlclNlbGVjdG9yID0gcmVxdWlyZSgnLi92aWV3ZXItc2VsZWN0b3IuanMnKTtcbnZhciBWUkRpc3BsYXkgPSByZXF1aXJlKCcuL2Jhc2UuanMnKS5WUkRpc3BsYXk7XG52YXIgVXRpbCA9IHJlcXVpcmUoJy4vdXRpbC5qcycpO1xuXG52YXIgRXllID0ge1xuICBMRUZUOiAnbGVmdCcsXG4gIFJJR0hUOiAncmlnaHQnXG59O1xuXG4vKipcbiAqIFZSRGlzcGxheSBiYXNlZCBvbiBtb2JpbGUgZGV2aWNlIHBhcmFtZXRlcnMgYW5kIERldmljZU1vdGlvbiBBUElzLlxuICovXG5mdW5jdGlvbiBDYXJkYm9hcmRWUkRpc3BsYXkoKSB7XG4gIHRoaXMuZGlzcGxheU5hbWUgPSAnQ2FyZGJvYXJkIFZSRGlzcGxheSAod2VidnItcG9seWZpbGwpJztcblxuICB0aGlzLmNhcGFiaWxpdGllcy5oYXNPcmllbnRhdGlvbiA9IHRydWU7XG4gIHRoaXMuY2FwYWJpbGl0aWVzLmNhblByZXNlbnQgPSB0cnVlO1xuXG4gIC8vIFwiUHJpdmF0ZVwiIG1lbWJlcnMuXG4gIHRoaXMuYnVmZmVyU2NhbGVfID0gV2ViVlJDb25maWcuQlVGRkVSX1NDQUxFO1xuICB0aGlzLnBvc2VTZW5zb3JfID0gbmV3IEZ1c2lvblBvc2VTZW5zb3IoKTtcbiAgdGhpcy5kaXN0b3J0ZXJfID0gbnVsbDtcbiAgdGhpcy5jYXJkYm9hcmRVSV8gPSBudWxsO1xuXG4gIHRoaXMuZHBkYl8gPSBuZXcgRHBkYih0cnVlLCB0aGlzLm9uRGV2aWNlUGFyYW1zVXBkYXRlZF8uYmluZCh0aGlzKSk7XG4gIHRoaXMuZGV2aWNlSW5mb18gPSBuZXcgRGV2aWNlSW5mbyh0aGlzLmRwZGJfLmdldERldmljZVBhcmFtcygpKTtcblxuICB0aGlzLnZpZXdlclNlbGVjdG9yXyA9IG5ldyBWaWV3ZXJTZWxlY3RvcigpO1xuICB0aGlzLnZpZXdlclNlbGVjdG9yXy5vbignY2hhbmdlJywgdGhpcy5vblZpZXdlckNoYW5nZWRfLmJpbmQodGhpcykpO1xuXG4gIC8vIFNldCB0aGUgY29ycmVjdCBpbml0aWFsIHZpZXdlci5cbiAgdGhpcy5kZXZpY2VJbmZvXy5zZXRWaWV3ZXIodGhpcy52aWV3ZXJTZWxlY3Rvcl8uZ2V0Q3VycmVudFZpZXdlcigpKTtcblxuICBpZiAoIVdlYlZSQ29uZmlnLlJPVEFURV9JTlNUUlVDVElPTlNfRElTQUJMRUQpIHtcbiAgICB0aGlzLnJvdGF0ZUluc3RydWN0aW9uc18gPSBuZXcgUm90YXRlSW5zdHJ1Y3Rpb25zKCk7XG4gIH1cblxuICBpZiAoVXRpbC5pc0lPUygpKSB7XG4gICAgLy8gTGlzdGVuIGZvciByZXNpemUgZXZlbnRzIHRvIHdvcmthcm91bmQgdGhpcyBhd2Z1bCBTYWZhcmkgYnVnLlxuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdyZXNpemUnLCB0aGlzLm9uUmVzaXplXy5iaW5kKHRoaXMpKTtcbiAgfVxufVxuQ2FyZGJvYXJkVlJEaXNwbGF5LnByb3RvdHlwZSA9IG5ldyBWUkRpc3BsYXkoKTtcblxuQ2FyZGJvYXJkVlJEaXNwbGF5LnByb3RvdHlwZS5nZXRJbW1lZGlhdGVQb3NlID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiB7XG4gICAgcG9zaXRpb246IHRoaXMucG9zZVNlbnNvcl8uZ2V0UG9zaXRpb24oKSxcbiAgICBvcmllbnRhdGlvbjogdGhpcy5wb3NlU2Vuc29yXy5nZXRPcmllbnRhdGlvbigpLFxuICAgIGxpbmVhclZlbG9jaXR5OiBudWxsLFxuICAgIGxpbmVhckFjY2VsZXJhdGlvbjogbnVsbCxcbiAgICBhbmd1bGFyVmVsb2NpdHk6IG51bGwsXG4gICAgYW5ndWxhckFjY2VsZXJhdGlvbjogbnVsbFxuICB9O1xufTtcblxuQ2FyZGJvYXJkVlJEaXNwbGF5LnByb3RvdHlwZS5yZXNldFBvc2UgPSBmdW5jdGlvbigpIHtcbiAgdGhpcy5wb3NlU2Vuc29yXy5yZXNldFBvc2UoKTtcbn07XG5cbkNhcmRib2FyZFZSRGlzcGxheS5wcm90b3R5cGUuZ2V0RXllUGFyYW1ldGVycyA9IGZ1bmN0aW9uKHdoaWNoRXllKSB7XG4gIHZhciBvZmZzZXQgPSBbdGhpcy5kZXZpY2VJbmZvXy52aWV3ZXIuaW50ZXJMZW5zRGlzdGFuY2UgKiAwLjUsIDAuMCwgMC4wXTtcbiAgdmFyIGZpZWxkT2ZWaWV3O1xuXG4gIC8vIFRPRE86IEZvViBjYW4gYmUgYSBsaXR0bGUgZXhwZW5zaXZlIHRvIGNvbXB1dGUuIENhY2hlIHdoZW4gZGV2aWNlIHBhcmFtcyBjaGFuZ2UuXG4gIGlmICh3aGljaEV5ZSA9PSBFeWUuTEVGVCkge1xuICAgIG9mZnNldFswXSAqPSAtMS4wO1xuICAgIGZpZWxkT2ZWaWV3ID0gdGhpcy5kZXZpY2VJbmZvXy5nZXRGaWVsZE9mVmlld0xlZnRFeWUoKTtcbiAgfSBlbHNlIGlmICh3aGljaEV5ZSA9PSBFeWUuUklHSFQpIHtcbiAgICBmaWVsZE9mVmlldyA9IHRoaXMuZGV2aWNlSW5mb18uZ2V0RmllbGRPZlZpZXdSaWdodEV5ZSgpO1xuICB9IGVsc2Uge1xuICAgIGNvbnNvbGUuZXJyb3IoJ0ludmFsaWQgZXllIHByb3ZpZGVkOiAlcycsIHdoaWNoRXllKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgZmllbGRPZlZpZXc6IGZpZWxkT2ZWaWV3LFxuICAgIG9mZnNldDogb2Zmc2V0LFxuICAgIC8vIFRPRE86IFNob3VsZCBiZSBhYmxlIHRvIHByb3ZpZGUgYmV0dGVyIHZhbHVlcyB0aGFuIHRoZXNlLlxuICAgIHJlbmRlcldpZHRoOiB0aGlzLmRldmljZUluZm9fLmRldmljZS53aWR0aCAqIDAuNSAqIHRoaXMuYnVmZmVyU2NhbGVfLFxuICAgIHJlbmRlckhlaWdodDogdGhpcy5kZXZpY2VJbmZvXy5kZXZpY2UuaGVpZ2h0ICogdGhpcy5idWZmZXJTY2FsZV8sXG4gIH07XG59O1xuXG5DYXJkYm9hcmRWUkRpc3BsYXkucHJvdG90eXBlLm9uRGV2aWNlUGFyYW1zVXBkYXRlZF8gPSBmdW5jdGlvbihuZXdQYXJhbXMpIHtcbiAgY29uc29sZS5sb2coJ0RQREIgcmVwb3J0ZWQgdGhhdCBkZXZpY2UgcGFyYW1zIHdlcmUgdXBkYXRlZC4nKTtcbiAgdGhpcy5kZXZpY2VJbmZvXy51cGRhdGVEZXZpY2VQYXJhbXMobmV3UGFyYW1zKTtcblxuICBpZiAodGhpcy5kaXN0b3J0ZXJfKSB7XG4gICAgdGhpcy5kaXN0b3J0ZXJfLnVwZGF0ZURldmljZUluZm8odGhpcy5kZXZpY2VJbmZvXyk7XG4gIH1cbn07XG5cbkNhcmRib2FyZFZSRGlzcGxheS5wcm90b3R5cGUudXBkYXRlQm91bmRzXyA9IGZ1bmN0aW9uICgpIHtcbiAgaWYgKHRoaXMubGF5ZXJfICYmIHRoaXMuZGlzdG9ydGVyXyAmJiAodGhpcy5sYXllcl8ubGVmdEJvdW5kcyB8fCB0aGlzLmxheWVyXy5yaWdodEJvdW5kcykpIHtcbiAgICB0aGlzLmRpc3RvcnRlcl8uc2V0VGV4dHVyZUJvdW5kcyh0aGlzLmxheWVyXy5sZWZ0Qm91bmRzLCB0aGlzLmxheWVyXy5yaWdodEJvdW5kcyk7XG4gIH1cbn07XG5cbkNhcmRib2FyZFZSRGlzcGxheS5wcm90b3R5cGUuYmVnaW5QcmVzZW50XyA9IGZ1bmN0aW9uKCkge1xuICB2YXIgZ2wgPSB0aGlzLmxheWVyXy5zb3VyY2UuZ2V0Q29udGV4dCgnd2ViZ2wnKTtcbiAgaWYgKCFnbClcbiAgICBnbCA9IHRoaXMubGF5ZXJfLnNvdXJjZS5nZXRDb250ZXh0KCdleHBlcmltZW50YWwtd2ViZ2wnKTtcbiAgaWYgKCFnbClcbiAgICBnbCA9IHRoaXMubGF5ZXJfLnNvdXJjZS5nZXRDb250ZXh0KCd3ZWJnbDInKTtcblxuICBpZiAoIWdsKVxuICAgIHJldHVybjsgLy8gQ2FuJ3QgZG8gZGlzdG9ydGlvbiB3aXRob3V0IGEgV2ViR0wgY29udGV4dC5cblxuICAvLyBQcm92aWRlcyBhIHdheSB0byBvcHQgb3V0IG9mIGRpc3RvcnRpb25cbiAgaWYgKHRoaXMubGF5ZXJfLnByZWRpc3RvcnRlZCkge1xuICAgIGlmICghV2ViVlJDb25maWcuQ0FSREJPQVJEX1VJX0RJU0FCTEVEKSB7XG4gICAgICBnbC5jYW52YXMud2lkdGggPSBVdGlsLmdldFNjcmVlbldpZHRoKCkgKiB0aGlzLmJ1ZmZlclNjYWxlXztcbiAgICAgIGdsLmNhbnZhcy5oZWlnaHQgPSBVdGlsLmdldFNjcmVlbkhlaWdodCgpICogdGhpcy5idWZmZXJTY2FsZV87XG4gICAgICB0aGlzLmNhcmRib2FyZFVJXyA9IG5ldyBDYXJkYm9hcmRVSShnbCk7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIC8vIENyZWF0ZSBhIG5ldyBkaXN0b3J0ZXIgZm9yIHRoZSB0YXJnZXQgY29udGV4dFxuICAgIHRoaXMuZGlzdG9ydGVyXyA9IG5ldyBDYXJkYm9hcmREaXN0b3J0ZXIoZ2wpO1xuICAgIHRoaXMuZGlzdG9ydGVyXy51cGRhdGVEZXZpY2VJbmZvKHRoaXMuZGV2aWNlSW5mb18pO1xuICAgIHRoaXMuY2FyZGJvYXJkVUlfID0gdGhpcy5kaXN0b3J0ZXJfLmNhcmRib2FyZFVJO1xuICB9XG5cbiAgaWYgKHRoaXMuY2FyZGJvYXJkVUlfKSB7XG4gICAgdGhpcy5jYXJkYm9hcmRVSV8ubGlzdGVuKGZ1bmN0aW9uKGUpIHtcbiAgICAgIC8vIE9wdGlvbnMgY2xpY2tlZC5cbiAgICAgIHRoaXMudmlld2VyU2VsZWN0b3JfLnNob3codGhpcy5sYXllcl8uc291cmNlLnBhcmVudEVsZW1lbnQpO1xuICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICB9LmJpbmQodGhpcyksIGZ1bmN0aW9uKGUpIHtcbiAgICAgIC8vIEJhY2sgY2xpY2tlZC5cbiAgICAgIHRoaXMuZXhpdFByZXNlbnQoKTtcbiAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgfVxuXG4gIGlmICh0aGlzLnJvdGF0ZUluc3RydWN0aW9uc18pIHtcbiAgICBpZiAoVXRpbC5pc0xhbmRzY2FwZU1vZGUoKSAmJiBVdGlsLmlzTW9iaWxlKCkpIHtcbiAgICAgIC8vIEluIGxhbmRzY2FwZSBtb2RlLCB0ZW1wb3JhcmlseSBzaG93IHRoZSBcInB1dCBpbnRvIENhcmRib2FyZFwiXG4gICAgICAvLyBpbnRlcnN0aXRpYWwuIE90aGVyd2lzZSwgZG8gdGhlIGRlZmF1bHQgdGhpbmcuXG4gICAgICB0aGlzLnJvdGF0ZUluc3RydWN0aW9uc18uc2hvd1RlbXBvcmFyaWx5KDMwMDAsIHRoaXMubGF5ZXJfLnNvdXJjZS5wYXJlbnRFbGVtZW50KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5yb3RhdGVJbnN0cnVjdGlvbnNfLnVwZGF0ZSgpO1xuICAgIH1cbiAgfVxuXG4gIC8vIExpc3RlbiBmb3Igb3JpZW50YXRpb24gY2hhbmdlIGV2ZW50cyBpbiBvcmRlciB0byBzaG93IGludGVyc3RpdGlhbC5cbiAgdGhpcy5vcmllbnRhdGlvbkhhbmRsZXIgPSB0aGlzLm9uT3JpZW50YXRpb25DaGFuZ2VfLmJpbmQodGhpcyk7XG4gIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdvcmllbnRhdGlvbmNoYW5nZScsIHRoaXMub3JpZW50YXRpb25IYW5kbGVyKTtcblxuICAvLyBMaXN0ZW4gZm9yIHByZXNlbnQgZGlzcGxheSBjaGFuZ2UgZXZlbnRzIGluIG9yZGVyIHRvIHVwZGF0ZSBkaXN0b3J0ZXIgZGltZW5zaW9uc1xuICB0aGlzLnZyZGlzcGxheXByZXNlbnRjaGFuZ2VIYW5kbGVyID0gdGhpcy51cGRhdGVCb3VuZHNfLmJpbmQodGhpcyk7XG4gIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCd2cmRpc3BsYXlwcmVzZW50Y2hhbmdlJywgdGhpcy52cmRpc3BsYXlwcmVzZW50Y2hhbmdlSGFuZGxlcik7XG5cbiAgLy8gRmlyZSB0aGlzIGV2ZW50IGluaXRpYWxseSwgdG8gZ2l2ZSBnZW9tZXRyeS1kaXN0b3J0aW9uIGNsaWVudHMgdGhlIGNoYW5jZVxuICAvLyB0byBkbyBzb21ldGhpbmcgY3VzdG9tLlxuICB0aGlzLmZpcmVWUkRpc3BsYXlEZXZpY2VQYXJhbXNDaGFuZ2VfKCk7XG59O1xuXG5DYXJkYm9hcmRWUkRpc3BsYXkucHJvdG90eXBlLmVuZFByZXNlbnRfID0gZnVuY3Rpb24oKSB7XG4gIGlmICh0aGlzLmRpc3RvcnRlcl8pIHtcbiAgICB0aGlzLmRpc3RvcnRlcl8uZGVzdHJveSgpO1xuICAgIHRoaXMuZGlzdG9ydGVyXyA9IG51bGw7XG4gIH1cbiAgaWYgKHRoaXMuY2FyZGJvYXJkVUlfKSB7XG4gICAgdGhpcy5jYXJkYm9hcmRVSV8uZGVzdHJveSgpO1xuICAgIHRoaXMuY2FyZGJvYXJkVUlfID0gbnVsbDtcbiAgfVxuXG4gIGlmICh0aGlzLnJvdGF0ZUluc3RydWN0aW9uc18pIHtcbiAgICB0aGlzLnJvdGF0ZUluc3RydWN0aW9uc18uaGlkZSgpO1xuICB9XG4gIHRoaXMudmlld2VyU2VsZWN0b3JfLmhpZGUoKTtcblxuICB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcignb3JpZW50YXRpb25jaGFuZ2UnLCB0aGlzLm9yaWVudGF0aW9uSGFuZGxlcik7XG4gIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCd2cmRpc3BsYXlwcmVzZW50Y2hhbmdlJywgdGhpcy52cmRpc3BsYXlwcmVzZW50Y2hhbmdlSGFuZGxlcik7XG59O1xuXG5DYXJkYm9hcmRWUkRpc3BsYXkucHJvdG90eXBlLnN1Ym1pdEZyYW1lID0gZnVuY3Rpb24ocG9zZSkge1xuICBpZiAodGhpcy5kaXN0b3J0ZXJfKSB7XG4gICAgdGhpcy5kaXN0b3J0ZXJfLnN1Ym1pdEZyYW1lKCk7XG4gIH0gZWxzZSBpZiAodGhpcy5jYXJkYm9hcmRVSV8gJiYgdGhpcy5sYXllcl8pIHtcbiAgICAvLyBIYWNrIGZvciBwcmVkaXN0b3J0ZWQ6IHRydWUuXG4gICAgdmFyIGNhbnZhcyA9IHRoaXMubGF5ZXJfLnNvdXJjZS5nZXRDb250ZXh0KCd3ZWJnbCcpLmNhbnZhcztcbiAgICBpZiAoY2FudmFzLndpZHRoICE9IHRoaXMubGFzdFdpZHRoIHx8IGNhbnZhcy5oZWlnaHQgIT0gdGhpcy5sYXN0SGVpZ2h0KSB7XG4gICAgICB0aGlzLmNhcmRib2FyZFVJXy5vblJlc2l6ZSgpO1xuICAgIH1cbiAgICB0aGlzLmxhc3RXaWR0aCA9IGNhbnZhcy53aWR0aDtcbiAgICB0aGlzLmxhc3RIZWlnaHQgPSBjYW52YXMuaGVpZ2h0O1xuXG4gICAgLy8gUmVuZGVyIHRoZSBDYXJkYm9hcmQgVUkuXG4gICAgdGhpcy5jYXJkYm9hcmRVSV8ucmVuZGVyKCk7XG4gIH1cbn07XG5cbkNhcmRib2FyZFZSRGlzcGxheS5wcm90b3R5cGUub25PcmllbnRhdGlvbkNoYW5nZV8gPSBmdW5jdGlvbihlKSB7XG4gIGNvbnNvbGUubG9nKCdvbk9yaWVudGF0aW9uQ2hhbmdlXycpO1xuXG4gIC8vIEhpZGUgdGhlIHZpZXdlciBzZWxlY3Rvci5cbiAgdGhpcy52aWV3ZXJTZWxlY3Rvcl8uaGlkZSgpO1xuXG4gIC8vIFVwZGF0ZSB0aGUgcm90YXRlIGluc3RydWN0aW9ucy5cbiAgaWYgKHRoaXMucm90YXRlSW5zdHJ1Y3Rpb25zXykge1xuICAgIHRoaXMucm90YXRlSW5zdHJ1Y3Rpb25zXy51cGRhdGUoKTtcbiAgfVxuXG4gIHRoaXMub25SZXNpemVfKCk7XG59O1xuXG5DYXJkYm9hcmRWUkRpc3BsYXkucHJvdG90eXBlLm9uUmVzaXplXyA9IGZ1bmN0aW9uKGUpIHtcbiAgaWYgKHRoaXMubGF5ZXJfKSB7XG4gICAgdmFyIGdsID0gdGhpcy5sYXllcl8uc291cmNlLmdldENvbnRleHQoJ3dlYmdsJyk7XG4gICAgLy8gU2l6ZSB0aGUgQ1NTIGNhbnZhcy5cbiAgICAvLyBBZGRlZCBwYWRkaW5nIG9uIHJpZ2h0IGFuZCBib3R0b20gYmVjYXVzZSBpUGhvbmUgNSB3aWxsIG5vdFxuICAgIC8vIGhpZGUgdGhlIFVSTCBiYXIgdW5sZXNzIGNvbnRlbnQgaXMgYmlnZ2VyIHRoYW4gdGhlIHNjcmVlbi5cbiAgICAvLyBUaGlzIHdpbGwgbm90IGJlIHZpc2libGUgYXMgbG9uZyBhcyB0aGUgY29udGFpbmVyIGVsZW1lbnQgKGUuZy4gYm9keSlcbiAgICAvLyBpcyBzZXQgdG8gJ292ZXJmbG93OiBoaWRkZW4nLlxuICAgIHZhciBjc3NQcm9wZXJ0aWVzID0gW1xuICAgICAgJ3Bvc2l0aW9uOiBhYnNvbHV0ZScsXG4gICAgICAndG9wOiAwJyxcbiAgICAgICdsZWZ0OiAwJyxcbiAgICAgICd3aWR0aDogJyArIE1hdGgubWF4KHNjcmVlbi53aWR0aCwgc2NyZWVuLmhlaWdodCkgKyAncHgnLFxuICAgICAgJ2hlaWdodDogJyArIE1hdGgubWluKHNjcmVlbi5oZWlnaHQsIHNjcmVlbi53aWR0aCkgKyAncHgnLFxuICAgICAgJ2JvcmRlcjogMCcsXG4gICAgICAnbWFyZ2luOiAwJyxcbiAgICAgICdwYWRkaW5nOiAwIDEwcHggMTBweCAwJyxcbiAgICBdO1xuICAgIGdsLmNhbnZhcy5zZXRBdHRyaWJ1dGUoJ3N0eWxlJywgY3NzUHJvcGVydGllcy5qb2luKCc7ICcpICsgJzsnKTtcblxuICAgIFV0aWwuc2FmYXJpQ3NzU2l6ZVdvcmthcm91bmQoZ2wuY2FudmFzKTtcbiAgfVxufTtcblxuQ2FyZGJvYXJkVlJEaXNwbGF5LnByb3RvdHlwZS5vblZpZXdlckNoYW5nZWRfID0gZnVuY3Rpb24odmlld2VyKSB7XG4gIHRoaXMuZGV2aWNlSW5mb18uc2V0Vmlld2VyKHZpZXdlcik7XG5cbiAgaWYgKHRoaXMuZGlzdG9ydGVyXykge1xuICAgIC8vIFVwZGF0ZSB0aGUgZGlzdG9ydGlvbiBhcHByb3ByaWF0ZWx5LlxuICAgIHRoaXMuZGlzdG9ydGVyXy51cGRhdGVEZXZpY2VJbmZvKHRoaXMuZGV2aWNlSW5mb18pO1xuICB9XG5cbiAgLy8gRmlyZSBhIG5ldyBldmVudCBjb250YWluaW5nIHZpZXdlciBhbmQgZGV2aWNlIHBhcmFtZXRlcnMgZm9yIGNsaWVudHMgdGhhdFxuICAvLyB3YW50IHRvIGltcGxlbWVudCB0aGVpciBvd24gZ2VvbWV0cnktYmFzZWQgZGlzdG9ydGlvbi5cbiAgdGhpcy5maXJlVlJEaXNwbGF5RGV2aWNlUGFyYW1zQ2hhbmdlXygpO1xufTtcblxuQ2FyZGJvYXJkVlJEaXNwbGF5LnByb3RvdHlwZS5maXJlVlJEaXNwbGF5RGV2aWNlUGFyYW1zQ2hhbmdlXyA9IGZ1bmN0aW9uKCkge1xuICB2YXIgZXZlbnQgPSBuZXcgQ3VzdG9tRXZlbnQoJ3ZyZGlzcGxheWRldmljZXBhcmFtc2NoYW5nZScsIHtcbiAgICBkZXRhaWw6IHtcbiAgICAgIHZyZGlzcGxheTogdGhpcyxcbiAgICAgIGRldmljZUluZm86IHRoaXMuZGV2aWNlSW5mb18sXG4gICAgfVxuICB9KTtcbiAgd2luZG93LmRpc3BhdGNoRXZlbnQoZXZlbnQpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBDYXJkYm9hcmRWUkRpc3BsYXk7XG4iLCIvKlxuQ29weXJpZ2h0IChjKSAyMDE2LCBCcmFuZG9uIEpvbmVzLlxuXG5QZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYSBjb3B5XG5vZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZSBcIlNvZnR3YXJlXCIpLCB0byBkZWFsXG5pbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzXG50byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsXG5jb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0IHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXNcbmZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGUgZm9sbG93aW5nIGNvbmRpdGlvbnM6XG5cblRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkIGluXG5hbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cblxuVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTUyBPUlxuSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRiBNRVJDSEFOVEFCSUxJVFksXG5GSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTiBOTyBFVkVOVCBTSEFMTCBUSEVcbkFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sIERBTUFHRVMgT1IgT1RIRVJcbkxJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1IgT1RIRVJXSVNFLCBBUklTSU5HIEZST00sXG5PVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEUgVVNFIE9SIE9USEVSIERFQUxJTkdTIElOXG5USEUgU09GVFdBUkUuXG4qL1xuXG4vKlxuQ2FjaGVzIHNwZWNpZmllZCBHTCBzdGF0ZSwgcnVucyBhIGNhbGxiYWNrLCBhbmQgcmVzdG9yZXMgdGhlIGNhY2hlZCBzdGF0ZSB3aGVuXG5kb25lLlxuXG5FeGFtcGxlIHVzYWdlOlxuXG52YXIgc2F2ZWRTdGF0ZSA9IFtcbiAgZ2wuQVJSQVlfQlVGRkVSX0JJTkRJTkcsXG5cbiAgLy8gVEVYVFVSRV9CSU5ESU5HXzJEIG9yIF9DVUJFX01BUCBtdXN0IGFsd2F5cyBiZSBmb2xsb3dlZCBieSB0aGUgdGV4dXJlIHVuaXQuXG4gIGdsLlRFWFRVUkVfQklORElOR18yRCwgZ2wuVEVYVFVSRTAsXG5cbiAgZ2wuQ0xFQVJfQ09MT1IsXG5dO1xuLy8gQWZ0ZXIgdGhpcyBjYWxsIHRoZSBhcnJheSBidWZmZXIsIHRleHR1cmUgdW5pdCAwLCBhY3RpdmUgdGV4dHVyZSwgYW5kIGNsZWFyXG4vLyBjb2xvciB3aWxsIGJlIHJlc3RvcmVkLiBUaGUgdmlld3BvcnQgd2lsbCByZW1haW4gY2hhbmdlZCwgaG93ZXZlciwgYmVjYXVzZVxuLy8gZ2wuVklFV1BPUlQgd2FzIG5vdCBpbmNsdWRlZCBpbiB0aGUgc2F2ZWRTdGF0ZSBsaXN0LlxuV0dMVVByZXNlcnZlR0xTdGF0ZShnbCwgc2F2ZWRTdGF0ZSwgZnVuY3Rpb24oZ2wpIHtcbiAgZ2wudmlld3BvcnQoMCwgMCwgZ2wuZHJhd2luZ0J1ZmZlcldpZHRoLCBnbC5kcmF3aW5nQnVmZmVySGVpZ2h0KTtcblxuICBnbC5iaW5kQnVmZmVyKGdsLkFSUkFZX0JVRkZFUiwgYnVmZmVyKTtcbiAgZ2wuYnVmZmVyRGF0YShnbC5BUlJBWV9CVUZGRVIsIC4uLi4pO1xuXG4gIGdsLmFjdGl2ZVRleHR1cmUoZ2wuVEVYVFVSRTApO1xuICBnbC5iaW5kVGV4dHVyZShnbC5URVhUVVJFXzJELCB0ZXh0dXJlKTtcbiAgZ2wudGV4SW1hZ2UyRChnbC5URVhUVVJFXzJELCAuLi4pO1xuXG4gIGdsLmNsZWFyQ29sb3IoMSwgMCwgMCwgMSk7XG4gIGdsLmNsZWFyKGdsLkNPTE9SX0JVRkZFUl9CSVQpO1xufSk7XG5cbk5vdGUgdGhhdCB0aGlzIGlzIG5vdCBpbnRlbmRlZCB0byBiZSBmYXN0LiBNYW5hZ2luZyBzdGF0ZSBpbiB5b3VyIG93biBjb2RlIHRvXG5hdm9pZCByZWR1bmRhbnQgc3RhdGUgc2V0dGluZyBhbmQgcXVlcnlpbmcgd2lsbCBhbHdheXMgYmUgZmFzdGVyLiBUaGlzIGZ1bmN0aW9uXG5pcyBtb3N0IHVzZWZ1bCBmb3IgY2FzZXMgd2hlcmUgeW91IG1heSBub3QgaGF2ZSBmdWxsIGNvbnRyb2wgb3ZlciB0aGUgV2ViR0xcbmNhbGxzIGJlaW5nIG1hZGUsIHN1Y2ggYXMgdG9vbGluZyBvciBlZmZlY3QgaW5qZWN0b3JzLlxuKi9cblxuZnVuY3Rpb24gV0dMVVByZXNlcnZlR0xTdGF0ZShnbCwgYmluZGluZ3MsIGNhbGxiYWNrKSB7XG4gIGlmICghYmluZGluZ3MpIHtcbiAgICBjYWxsYmFjayhnbCk7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgdmFyIGJvdW5kVmFsdWVzID0gW107XG5cbiAgdmFyIGFjdGl2ZVRleHR1cmUgPSBudWxsO1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGJpbmRpbmdzLmxlbmd0aDsgKytpKSB7XG4gICAgdmFyIGJpbmRpbmcgPSBiaW5kaW5nc1tpXTtcbiAgICBzd2l0Y2ggKGJpbmRpbmcpIHtcbiAgICAgIGNhc2UgZ2wuVEVYVFVSRV9CSU5ESU5HXzJEOlxuICAgICAgY2FzZSBnbC5URVhUVVJFX0JJTkRJTkdfQ1VCRV9NQVA6XG4gICAgICAgIHZhciB0ZXh0dXJlVW5pdCA9IGJpbmRpbmdzWysraV07XG4gICAgICAgIGlmICh0ZXh0dXJlVW5pdCA8IGdsLlRFWFRVUkUwIHx8IHRleHR1cmVVbml0ID4gZ2wuVEVYVFVSRTMxKSB7XG4gICAgICAgICAgY29uc29sZS5lcnJvcihcIlRFWFRVUkVfQklORElOR18yRCBvciBURVhUVVJFX0JJTkRJTkdfQ1VCRV9NQVAgbXVzdCBiZSBmb2xsb3dlZCBieSBhIHZhbGlkIHRleHR1cmUgdW5pdFwiKTtcbiAgICAgICAgICBib3VuZFZhbHVlcy5wdXNoKG51bGwsIG51bGwpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIGlmICghYWN0aXZlVGV4dHVyZSkge1xuICAgICAgICAgIGFjdGl2ZVRleHR1cmUgPSBnbC5nZXRQYXJhbWV0ZXIoZ2wuQUNUSVZFX1RFWFRVUkUpO1xuICAgICAgICB9XG4gICAgICAgIGdsLmFjdGl2ZVRleHR1cmUodGV4dHVyZVVuaXQpO1xuICAgICAgICBib3VuZFZhbHVlcy5wdXNoKGdsLmdldFBhcmFtZXRlcihiaW5kaW5nKSwgbnVsbCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBnbC5BQ1RJVkVfVEVYVFVSRTpcbiAgICAgICAgYWN0aXZlVGV4dHVyZSA9IGdsLmdldFBhcmFtZXRlcihnbC5BQ1RJVkVfVEVYVFVSRSk7XG4gICAgICAgIGJvdW5kVmFsdWVzLnB1c2gobnVsbCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgYm91bmRWYWx1ZXMucHVzaChnbC5nZXRQYXJhbWV0ZXIoYmluZGluZykpO1xuICAgICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICBjYWxsYmFjayhnbCk7XG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBiaW5kaW5ncy5sZW5ndGg7ICsraSkge1xuICAgIHZhciBiaW5kaW5nID0gYmluZGluZ3NbaV07XG4gICAgdmFyIGJvdW5kVmFsdWUgPSBib3VuZFZhbHVlc1tpXTtcbiAgICBzd2l0Y2ggKGJpbmRpbmcpIHtcbiAgICAgIGNhc2UgZ2wuQUNUSVZFX1RFWFRVUkU6XG4gICAgICAgIGJyZWFrOyAvLyBJZ25vcmUgdGhpcyBiaW5kaW5nLCBzaW5jZSB3ZSBzcGVjaWFsLWNhc2UgaXQgdG8gaGFwcGVuIGxhc3QuXG4gICAgICBjYXNlIGdsLkFSUkFZX0JVRkZFUl9CSU5ESU5HOlxuICAgICAgICBnbC5iaW5kQnVmZmVyKGdsLkFSUkFZX0JVRkZFUiwgYm91bmRWYWx1ZSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBnbC5DT0xPUl9DTEVBUl9WQUxVRTpcbiAgICAgICAgZ2wuY2xlYXJDb2xvcihib3VuZFZhbHVlWzBdLCBib3VuZFZhbHVlWzFdLCBib3VuZFZhbHVlWzJdLCBib3VuZFZhbHVlWzNdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGdsLkNPTE9SX1dSSVRFTUFTSzpcbiAgICAgICAgZ2wuY29sb3JNYXNrKGJvdW5kVmFsdWVbMF0sIGJvdW5kVmFsdWVbMV0sIGJvdW5kVmFsdWVbMl0sIGJvdW5kVmFsdWVbM10pO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgZ2wuQ1VSUkVOVF9QUk9HUkFNOlxuICAgICAgICBnbC51c2VQcm9ncmFtKGJvdW5kVmFsdWUpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgZ2wuRUxFTUVOVF9BUlJBWV9CVUZGRVJfQklORElORzpcbiAgICAgICAgZ2wuYmluZEJ1ZmZlcihnbC5FTEVNRU5UX0FSUkFZX0JVRkZFUiwgYm91bmRWYWx1ZSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBnbC5GUkFNRUJVRkZFUl9CSU5ESU5HOlxuICAgICAgICBnbC5iaW5kRnJhbWVidWZmZXIoZ2wuRlJBTUVCVUZGRVIsIGJvdW5kVmFsdWUpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgZ2wuUkVOREVSQlVGRkVSX0JJTkRJTkc6XG4gICAgICAgIGdsLmJpbmRSZW5kZXJidWZmZXIoZ2wuUkVOREVSQlVGRkVSLCBib3VuZFZhbHVlKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGdsLlRFWFRVUkVfQklORElOR18yRDpcbiAgICAgICAgdmFyIHRleHR1cmVVbml0ID0gYmluZGluZ3NbKytpXTtcbiAgICAgICAgaWYgKHRleHR1cmVVbml0IDwgZ2wuVEVYVFVSRTAgfHwgdGV4dHVyZVVuaXQgPiBnbC5URVhUVVJFMzEpXG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGdsLmFjdGl2ZVRleHR1cmUodGV4dHVyZVVuaXQpO1xuICAgICAgICBnbC5iaW5kVGV4dHVyZShnbC5URVhUVVJFXzJELCBib3VuZFZhbHVlKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGdsLlRFWFRVUkVfQklORElOR19DVUJFX01BUDpcbiAgICAgICAgdmFyIHRleHR1cmVVbml0ID0gYmluZGluZ3NbKytpXTtcbiAgICAgICAgaWYgKHRleHR1cmVVbml0IDwgZ2wuVEVYVFVSRTAgfHwgdGV4dHVyZVVuaXQgPiBnbC5URVhUVVJFMzEpXG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGdsLmFjdGl2ZVRleHR1cmUodGV4dHVyZVVuaXQpO1xuICAgICAgICBnbC5iaW5kVGV4dHVyZShnbC5URVhUVVJFX0NVQkVfTUFQLCBib3VuZFZhbHVlKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGdsLlZJRVdQT1JUOlxuICAgICAgICBnbC52aWV3cG9ydChib3VuZFZhbHVlWzBdLCBib3VuZFZhbHVlWzFdLCBib3VuZFZhbHVlWzJdLCBib3VuZFZhbHVlWzNdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGdsLkJMRU5EOlxuICAgICAgY2FzZSBnbC5DVUxMX0ZBQ0U6XG4gICAgICBjYXNlIGdsLkRFUFRIX1RFU1Q6XG4gICAgICBjYXNlIGdsLlNDSVNTT1JfVEVTVDpcbiAgICAgIGNhc2UgZ2wuU1RFTkNJTF9URVNUOlxuICAgICAgICBpZiAoYm91bmRWYWx1ZSkge1xuICAgICAgICAgIGdsLmVuYWJsZShiaW5kaW5nKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBnbC5kaXNhYmxlKGJpbmRpbmcpO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgY29uc29sZS5sb2coXCJObyBHTCByZXN0b3JlIGJlaGF2aW9yIGZvciAweFwiICsgYmluZGluZy50b1N0cmluZygxNikpO1xuICAgICAgICBicmVhaztcbiAgICB9XG5cbiAgICBpZiAoYWN0aXZlVGV4dHVyZSkge1xuICAgICAgZ2wuYWN0aXZlVGV4dHVyZShhY3RpdmVUZXh0dXJlKTtcbiAgICB9XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBXR0xVUHJlc2VydmVHTFN0YXRlOyIsIi8qXG4gKiBDb3B5cmlnaHQgMjAxNSBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICogTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcbiAqIHlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cbiAqIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuICpcbiAqICAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcbiAqXG4gKiBVbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG4gKiBkaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG4gKiBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cbiAqIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbiAqIGxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuICovXG5cbnZhciBEaXN0b3J0aW9uID0gcmVxdWlyZSgnLi9kaXN0b3J0aW9uL2Rpc3RvcnRpb24uanMnKTtcbnZhciBNYXRoVXRpbCA9IHJlcXVpcmUoJy4vbWF0aC11dGlsLmpzJyk7XG52YXIgVXRpbCA9IHJlcXVpcmUoJy4vdXRpbC5qcycpO1xuXG5mdW5jdGlvbiBEZXZpY2UocGFyYW1zKSB7XG4gIHRoaXMud2lkdGggPSBwYXJhbXMud2lkdGggfHwgVXRpbC5nZXRTY3JlZW5XaWR0aCgpO1xuICB0aGlzLmhlaWdodCA9IHBhcmFtcy5oZWlnaHQgfHwgVXRpbC5nZXRTY3JlZW5IZWlnaHQoKTtcbiAgdGhpcy53aWR0aE1ldGVycyA9IHBhcmFtcy53aWR0aE1ldGVycztcbiAgdGhpcy5oZWlnaHRNZXRlcnMgPSBwYXJhbXMuaGVpZ2h0TWV0ZXJzO1xuICB0aGlzLmJldmVsTWV0ZXJzID0gcGFyYW1zLmJldmVsTWV0ZXJzO1xufVxuXG5cbi8vIEZhbGxiYWNrIEFuZHJvaWQgZGV2aWNlIChiYXNlZCBvbiBOZXh1cyA1IG1lYXN1cmVtZW50cykgZm9yIHVzZSB3aGVuXG4vLyB3ZSBjYW4ndCByZWNvZ25pemUgYW4gQW5kcm9pZCBkZXZpY2UuXG52YXIgREVGQVVMVF9BTkRST0lEID0gbmV3IERldmljZSh7XG4gIHdpZHRoTWV0ZXJzOiAwLjExMCxcbiAgaGVpZ2h0TWV0ZXJzOiAwLjA2MixcbiAgYmV2ZWxNZXRlcnM6IDAuMDA0XG59KTtcblxuLy8gRmFsbGJhY2sgaU9TIGRldmljZSAoYmFzZWQgb24gaVBob25lNikgZm9yIHVzZSB3aGVuXG4vLyB3ZSBjYW4ndCByZWNvZ25pemUgYW4gQW5kcm9pZCBkZXZpY2UuXG52YXIgREVGQVVMVF9JT1MgPSBuZXcgRGV2aWNlKHtcbiAgd2lkdGhNZXRlcnM6IDAuMTAzOCxcbiAgaGVpZ2h0TWV0ZXJzOiAwLjA1ODQsXG4gIGJldmVsTWV0ZXJzOiAwLjAwNFxufSk7XG5cblxudmFyIFZpZXdlcnMgPSB7XG4gIENhcmRib2FyZFYxOiBuZXcgQ2FyZGJvYXJkVmlld2VyKHtcbiAgICBpZDogJ0NhcmRib2FyZFYxJyxcbiAgICBsYWJlbDogJ0NhcmRib2FyZCBJL08gMjAxNCcsXG4gICAgZm92OiA0MCxcbiAgICBpbnRlckxlbnNEaXN0YW5jZTogMC4wNjAsXG4gICAgYmFzZWxpbmVMZW5zRGlzdGFuY2U6IDAuMDM1LFxuICAgIHNjcmVlbkxlbnNEaXN0YW5jZTogMC4wNDIsXG4gICAgZGlzdG9ydGlvbkNvZWZmaWNpZW50czogWzAuNDQxLCAwLjE1Nl0sXG4gICAgaW52ZXJzZUNvZWZmaWNpZW50czogWy0wLjQ0MTAwMzUsIDAuNDI3NTYxNTUsIC0wLjQ4MDQ0MzksIDAuNTQ2MDEzOSxcbiAgICAgIC0wLjU4ODIxMTgzLCAwLjU3MzM5MzgsIC0wLjQ4MzAzMjAyLCAwLjMzMjk5MDgzLCAtMC4xNzU3Mzg0MSxcbiAgICAgIDAuMDY1MTc3MiwgLTAuMDE0ODg5NjMsIDAuMDAxNTU5ODM0XVxuICB9KSxcbiAgQ2FyZGJvYXJkVjI6IG5ldyBDYXJkYm9hcmRWaWV3ZXIoe1xuICAgIGlkOiAnQ2FyZGJvYXJkVjInLFxuICAgIGxhYmVsOiAnQ2FyZGJvYXJkIEkvTyAyMDE1JyxcbiAgICBmb3Y6IDYwLFxuICAgIGludGVyTGVuc0Rpc3RhbmNlOiAwLjA2NCxcbiAgICBiYXNlbGluZUxlbnNEaXN0YW5jZTogMC4wMzUsXG4gICAgc2NyZWVuTGVuc0Rpc3RhbmNlOiAwLjAzOSxcbiAgICBkaXN0b3J0aW9uQ29lZmZpY2llbnRzOiBbMC4zNCwgMC41NV0sXG4gICAgaW52ZXJzZUNvZWZmaWNpZW50czogWy0wLjMzODM2NzA0LCAtMC4xODE2MjE4NSwgMC44NjI2NTUsIC0xLjI0NjIwNTEsXG4gICAgICAxLjA1NjA2MDIsIC0wLjU4MjA4MzE3LCAwLjIxNjA5MDc4LCAtMC4wNTQ0NDgyMywgMC4wMDkxNzc5NTYsXG4gICAgICAtOS45MDQxNjlFLTQsIDYuMTgzNTM1RS01LCAtMS42OTgxODAzRS02XVxuICB9KVxufTtcblxuXG52YXIgREVGQVVMVF9MRUZUX0NFTlRFUiA9IHt4OiAwLjUsIHk6IDAuNX07XG52YXIgREVGQVVMVF9SSUdIVF9DRU5URVIgPSB7eDogMC41LCB5OiAwLjV9O1xuXG4vKipcbiAqIE1hbmFnZXMgaW5mb3JtYXRpb24gYWJvdXQgdGhlIGRldmljZSBhbmQgdGhlIHZpZXdlci5cbiAqXG4gKiBkZXZpY2VQYXJhbXMgaW5kaWNhdGVzIHRoZSBwYXJhbWV0ZXJzIG9mIHRoZSBkZXZpY2UgdG8gdXNlIChnZW5lcmFsbHlcbiAqIG9idGFpbmVkIGZyb20gZHBkYi5nZXREZXZpY2VQYXJhbXMoKSkuIENhbiBiZSBudWxsIHRvIG1lYW4gbm8gZGV2aWNlXG4gKiBwYXJhbXMgd2VyZSBmb3VuZC5cbiAqL1xuZnVuY3Rpb24gRGV2aWNlSW5mbyhkZXZpY2VQYXJhbXMpIHtcbiAgdGhpcy52aWV3ZXIgPSBWaWV3ZXJzLkNhcmRib2FyZFYyO1xuICB0aGlzLnVwZGF0ZURldmljZVBhcmFtcyhkZXZpY2VQYXJhbXMpO1xuICB0aGlzLmRpc3RvcnRpb24gPSBuZXcgRGlzdG9ydGlvbih0aGlzLnZpZXdlci5kaXN0b3J0aW9uQ29lZmZpY2llbnRzKTtcbn1cblxuRGV2aWNlSW5mby5wcm90b3R5cGUudXBkYXRlRGV2aWNlUGFyYW1zID0gZnVuY3Rpb24oZGV2aWNlUGFyYW1zKSB7XG4gIHRoaXMuZGV2aWNlID0gdGhpcy5kZXRlcm1pbmVEZXZpY2VfKGRldmljZVBhcmFtcykgfHwgdGhpcy5kZXZpY2U7XG59O1xuXG5EZXZpY2VJbmZvLnByb3RvdHlwZS5nZXREZXZpY2UgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIHRoaXMuZGV2aWNlO1xufTtcblxuRGV2aWNlSW5mby5wcm90b3R5cGUuc2V0Vmlld2VyID0gZnVuY3Rpb24odmlld2VyKSB7XG4gIHRoaXMudmlld2VyID0gdmlld2VyO1xuICB0aGlzLmRpc3RvcnRpb24gPSBuZXcgRGlzdG9ydGlvbih0aGlzLnZpZXdlci5kaXN0b3J0aW9uQ29lZmZpY2llbnRzKTtcbn07XG5cbkRldmljZUluZm8ucHJvdG90eXBlLmRldGVybWluZURldmljZV8gPSBmdW5jdGlvbihkZXZpY2VQYXJhbXMpIHtcbiAgaWYgKCFkZXZpY2VQYXJhbXMpIHtcbiAgICAvLyBObyBwYXJhbWV0ZXJzLCBzbyB1c2UgYSBkZWZhdWx0LlxuICAgIGlmIChVdGlsLmlzSU9TKCkpIHtcbiAgICAgIGNvbnNvbGUud2FybignVXNpbmcgZmFsbGJhY2sgaU9TIGRldmljZSBtZWFzdXJlbWVudHMuJyk7XG4gICAgICByZXR1cm4gREVGQVVMVF9JT1M7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnNvbGUud2FybignVXNpbmcgZmFsbGJhY2sgQW5kcm9pZCBkZXZpY2UgbWVhc3VyZW1lbnRzLicpO1xuICAgICAgcmV0dXJuIERFRkFVTFRfQU5EUk9JRDtcbiAgICB9XG4gIH1cblxuICAvLyBDb21wdXRlIGRldmljZSBzY3JlZW4gZGltZW5zaW9ucyBiYXNlZCBvbiBkZXZpY2VQYXJhbXMuXG4gIHZhciBNRVRFUlNfUEVSX0lOQ0ggPSAwLjAyNTQ7XG4gIHZhciBtZXRlcnNQZXJQaXhlbFggPSBNRVRFUlNfUEVSX0lOQ0ggLyBkZXZpY2VQYXJhbXMueGRwaTtcbiAgdmFyIG1ldGVyc1BlclBpeGVsWSA9IE1FVEVSU19QRVJfSU5DSCAvIGRldmljZVBhcmFtcy55ZHBpO1xuICB2YXIgd2lkdGggPSBVdGlsLmdldFNjcmVlbldpZHRoKCk7XG4gIHZhciBoZWlnaHQgPSBVdGlsLmdldFNjcmVlbkhlaWdodCgpO1xuICByZXR1cm4gbmV3IERldmljZSh7XG4gICAgd2lkdGhNZXRlcnM6IG1ldGVyc1BlclBpeGVsWCAqIHdpZHRoLFxuICAgIGhlaWdodE1ldGVyczogbWV0ZXJzUGVyUGl4ZWxZICogaGVpZ2h0LFxuICAgIGJldmVsTWV0ZXJzOiBkZXZpY2VQYXJhbXMuYmV2ZWxNbSAqIDAuMDAxLFxuICB9KTtcbn07XG5cbi8qKlxuICogQ2FsY3VsYXRlcyBmaWVsZCBvZiB2aWV3IGZvciB0aGUgbGVmdCBleWUuXG4gKi9cbkRldmljZUluZm8ucHJvdG90eXBlLmdldERpc3RvcnRlZEZpZWxkT2ZWaWV3TGVmdEV5ZSA9IGZ1bmN0aW9uKCkge1xuICB2YXIgdmlld2VyID0gdGhpcy52aWV3ZXI7XG4gIHZhciBkZXZpY2UgPSB0aGlzLmRldmljZTtcbiAgdmFyIGRpc3RvcnRpb24gPSB0aGlzLmRpc3RvcnRpb247XG5cbiAgLy8gRGV2aWNlLmhlaWdodCBhbmQgZGV2aWNlLndpZHRoIGZvciBkZXZpY2UgaW4gcG9ydHJhaXQgbW9kZSwgc28gdHJhbnNwb3NlLlxuICB2YXIgZXllVG9TY3JlZW5EaXN0YW5jZSA9IHZpZXdlci5zY3JlZW5MZW5zRGlzdGFuY2U7XG5cbiAgdmFyIG91dGVyRGlzdCA9IChkZXZpY2Uud2lkdGhNZXRlcnMgLSB2aWV3ZXIuaW50ZXJMZW5zRGlzdGFuY2UpIC8gMjtcbiAgdmFyIGlubmVyRGlzdCA9IHZpZXdlci5pbnRlckxlbnNEaXN0YW5jZSAvIDI7XG4gIHZhciBib3R0b21EaXN0ID0gdmlld2VyLmJhc2VsaW5lTGVuc0Rpc3RhbmNlIC0gZGV2aWNlLmJldmVsTWV0ZXJzO1xuICB2YXIgdG9wRGlzdCA9IGRldmljZS5oZWlnaHRNZXRlcnMgLSBib3R0b21EaXN0O1xuXG4gIHZhciBvdXRlckFuZ2xlID0gTWF0aFV0aWwucmFkVG9EZWcgKiBNYXRoLmF0YW4oXG4gICAgICBkaXN0b3J0aW9uLmRpc3RvcnQob3V0ZXJEaXN0IC8gZXllVG9TY3JlZW5EaXN0YW5jZSkpO1xuICB2YXIgaW5uZXJBbmdsZSA9IE1hdGhVdGlsLnJhZFRvRGVnICogTWF0aC5hdGFuKFxuICAgICAgZGlzdG9ydGlvbi5kaXN0b3J0KGlubmVyRGlzdCAvIGV5ZVRvU2NyZWVuRGlzdGFuY2UpKTtcbiAgdmFyIGJvdHRvbUFuZ2xlID0gTWF0aFV0aWwucmFkVG9EZWcgKiBNYXRoLmF0YW4oXG4gICAgICBkaXN0b3J0aW9uLmRpc3RvcnQoYm90dG9tRGlzdCAvIGV5ZVRvU2NyZWVuRGlzdGFuY2UpKTtcbiAgdmFyIHRvcEFuZ2xlID0gTWF0aFV0aWwucmFkVG9EZWcgKiBNYXRoLmF0YW4oXG4gICAgICBkaXN0b3J0aW9uLmRpc3RvcnQodG9wRGlzdCAvIGV5ZVRvU2NyZWVuRGlzdGFuY2UpKTtcblxuICByZXR1cm4ge1xuICAgIGxlZnREZWdyZWVzOiBNYXRoLm1pbihvdXRlckFuZ2xlLCB2aWV3ZXIuZm92KSxcbiAgICByaWdodERlZ3JlZXM6IE1hdGgubWluKGlubmVyQW5nbGUsIHZpZXdlci5mb3YpLFxuICAgIGRvd25EZWdyZWVzOiBNYXRoLm1pbihib3R0b21BbmdsZSwgdmlld2VyLmZvdiksXG4gICAgdXBEZWdyZWVzOiBNYXRoLm1pbih0b3BBbmdsZSwgdmlld2VyLmZvdilcbiAgfTtcbn07XG5cbi8qKlxuICogQ2FsY3VsYXRlcyB0aGUgdGFuLWFuZ2xlcyBmcm9tIHRoZSBtYXhpbXVtIEZPViBmb3IgdGhlIGxlZnQgZXllIGZvciB0aGVcbiAqIGN1cnJlbnQgZGV2aWNlIGFuZCBzY3JlZW4gcGFyYW1ldGVycy5cbiAqL1xuRGV2aWNlSW5mby5wcm90b3R5cGUuZ2V0TGVmdEV5ZVZpc2libGVUYW5BbmdsZXMgPSBmdW5jdGlvbigpIHtcbiAgdmFyIHZpZXdlciA9IHRoaXMudmlld2VyO1xuICB2YXIgZGV2aWNlID0gdGhpcy5kZXZpY2U7XG4gIHZhciBkaXN0b3J0aW9uID0gdGhpcy5kaXN0b3J0aW9uO1xuXG4gIC8vIFRhbi1hbmdsZXMgZnJvbSB0aGUgbWF4IEZPVi5cbiAgdmFyIGZvdkxlZnQgPSBNYXRoLnRhbigtTWF0aFV0aWwuZGVnVG9SYWQgKiB2aWV3ZXIuZm92KTtcbiAgdmFyIGZvdlRvcCA9IE1hdGgudGFuKE1hdGhVdGlsLmRlZ1RvUmFkICogdmlld2VyLmZvdik7XG4gIHZhciBmb3ZSaWdodCA9IE1hdGgudGFuKE1hdGhVdGlsLmRlZ1RvUmFkICogdmlld2VyLmZvdik7XG4gIHZhciBmb3ZCb3R0b20gPSBNYXRoLnRhbigtTWF0aFV0aWwuZGVnVG9SYWQgKiB2aWV3ZXIuZm92KTtcbiAgLy8gVmlld3BvcnQgc2l6ZS5cbiAgdmFyIGhhbGZXaWR0aCA9IGRldmljZS53aWR0aE1ldGVycyAvIDQ7XG4gIHZhciBoYWxmSGVpZ2h0ID0gZGV2aWNlLmhlaWdodE1ldGVycyAvIDI7XG4gIC8vIFZpZXdwb3J0IGNlbnRlciwgbWVhc3VyZWQgZnJvbSBsZWZ0IGxlbnMgcG9zaXRpb24uXG4gIHZhciB2ZXJ0aWNhbExlbnNPZmZzZXQgPSAodmlld2VyLmJhc2VsaW5lTGVuc0Rpc3RhbmNlIC0gZGV2aWNlLmJldmVsTWV0ZXJzIC0gaGFsZkhlaWdodCk7XG4gIHZhciBjZW50ZXJYID0gdmlld2VyLmludGVyTGVuc0Rpc3RhbmNlIC8gMiAtIGhhbGZXaWR0aDtcbiAgdmFyIGNlbnRlclkgPSAtdmVydGljYWxMZW5zT2Zmc2V0O1xuICB2YXIgY2VudGVyWiA9IHZpZXdlci5zY3JlZW5MZW5zRGlzdGFuY2U7XG4gIC8vIFRhbi1hbmdsZXMgb2YgdGhlIHZpZXdwb3J0IGVkZ2VzLCBhcyBzZWVuIHRocm91Z2ggdGhlIGxlbnMuXG4gIHZhciBzY3JlZW5MZWZ0ID0gZGlzdG9ydGlvbi5kaXN0b3J0KChjZW50ZXJYIC0gaGFsZldpZHRoKSAvIGNlbnRlclopO1xuICB2YXIgc2NyZWVuVG9wID0gZGlzdG9ydGlvbi5kaXN0b3J0KChjZW50ZXJZICsgaGFsZkhlaWdodCkgLyBjZW50ZXJaKTtcbiAgdmFyIHNjcmVlblJpZ2h0ID0gZGlzdG9ydGlvbi5kaXN0b3J0KChjZW50ZXJYICsgaGFsZldpZHRoKSAvIGNlbnRlclopO1xuICB2YXIgc2NyZWVuQm90dG9tID0gZGlzdG9ydGlvbi5kaXN0b3J0KChjZW50ZXJZIC0gaGFsZkhlaWdodCkgLyBjZW50ZXJaKTtcbiAgLy8gQ29tcGFyZSB0aGUgdHdvIHNldHMgb2YgdGFuLWFuZ2xlcyBhbmQgdGFrZSB0aGUgdmFsdWUgY2xvc2VyIHRvIHplcm8gb24gZWFjaCBzaWRlLlxuICB2YXIgcmVzdWx0ID0gbmV3IEZsb2F0MzJBcnJheSg0KTtcbiAgcmVzdWx0WzBdID0gTWF0aC5tYXgoZm92TGVmdCwgc2NyZWVuTGVmdCk7XG4gIHJlc3VsdFsxXSA9IE1hdGgubWluKGZvdlRvcCwgc2NyZWVuVG9wKTtcbiAgcmVzdWx0WzJdID0gTWF0aC5taW4oZm92UmlnaHQsIHNjcmVlblJpZ2h0KTtcbiAgcmVzdWx0WzNdID0gTWF0aC5tYXgoZm92Qm90dG9tLCBzY3JlZW5Cb3R0b20pO1xuICByZXR1cm4gcmVzdWx0O1xufTtcblxuLyoqXG4gKiBDYWxjdWxhdGVzIHRoZSB0YW4tYW5nbGVzIGZyb20gdGhlIG1heGltdW0gRk9WIGZvciB0aGUgbGVmdCBleWUgZm9yIHRoZVxuICogY3VycmVudCBkZXZpY2UgYW5kIHNjcmVlbiBwYXJhbWV0ZXJzLCBhc3N1bWluZyBubyBsZW5zZXMuXG4gKi9cbkRldmljZUluZm8ucHJvdG90eXBlLmdldExlZnRFeWVOb0xlbnNUYW5BbmdsZXMgPSBmdW5jdGlvbigpIHtcbiAgdmFyIHZpZXdlciA9IHRoaXMudmlld2VyO1xuICB2YXIgZGV2aWNlID0gdGhpcy5kZXZpY2U7XG4gIHZhciBkaXN0b3J0aW9uID0gdGhpcy5kaXN0b3J0aW9uO1xuXG4gIHZhciByZXN1bHQgPSBuZXcgRmxvYXQzMkFycmF5KDQpO1xuICAvLyBUYW4tYW5nbGVzIGZyb20gdGhlIG1heCBGT1YuXG4gIHZhciBmb3ZMZWZ0ID0gZGlzdG9ydGlvbi5kaXN0b3J0SW52ZXJzZShNYXRoLnRhbigtTWF0aFV0aWwuZGVnVG9SYWQgKiB2aWV3ZXIuZm92KSk7XG4gIHZhciBmb3ZUb3AgPSBkaXN0b3J0aW9uLmRpc3RvcnRJbnZlcnNlKE1hdGgudGFuKE1hdGhVdGlsLmRlZ1RvUmFkICogdmlld2VyLmZvdikpO1xuICB2YXIgZm92UmlnaHQgPSBkaXN0b3J0aW9uLmRpc3RvcnRJbnZlcnNlKE1hdGgudGFuKE1hdGhVdGlsLmRlZ1RvUmFkICogdmlld2VyLmZvdikpO1xuICB2YXIgZm92Qm90dG9tID0gZGlzdG9ydGlvbi5kaXN0b3J0SW52ZXJzZShNYXRoLnRhbigtTWF0aFV0aWwuZGVnVG9SYWQgKiB2aWV3ZXIuZm92KSk7XG4gIC8vIFZpZXdwb3J0IHNpemUuXG4gIHZhciBoYWxmV2lkdGggPSBkZXZpY2Uud2lkdGhNZXRlcnMgLyA0O1xuICB2YXIgaGFsZkhlaWdodCA9IGRldmljZS5oZWlnaHRNZXRlcnMgLyAyO1xuICAvLyBWaWV3cG9ydCBjZW50ZXIsIG1lYXN1cmVkIGZyb20gbGVmdCBsZW5zIHBvc2l0aW9uLlxuICB2YXIgdmVydGljYWxMZW5zT2Zmc2V0ID0gKHZpZXdlci5iYXNlbGluZUxlbnNEaXN0YW5jZSAtIGRldmljZS5iZXZlbE1ldGVycyAtIGhhbGZIZWlnaHQpO1xuICB2YXIgY2VudGVyWCA9IHZpZXdlci5pbnRlckxlbnNEaXN0YW5jZSAvIDIgLSBoYWxmV2lkdGg7XG4gIHZhciBjZW50ZXJZID0gLXZlcnRpY2FsTGVuc09mZnNldDtcbiAgdmFyIGNlbnRlclogPSB2aWV3ZXIuc2NyZWVuTGVuc0Rpc3RhbmNlO1xuICAvLyBUYW4tYW5nbGVzIG9mIHRoZSB2aWV3cG9ydCBlZGdlcywgYXMgc2VlbiB0aHJvdWdoIHRoZSBsZW5zLlxuICB2YXIgc2NyZWVuTGVmdCA9IChjZW50ZXJYIC0gaGFsZldpZHRoKSAvIGNlbnRlclo7XG4gIHZhciBzY3JlZW5Ub3AgPSAoY2VudGVyWSArIGhhbGZIZWlnaHQpIC8gY2VudGVyWjtcbiAgdmFyIHNjcmVlblJpZ2h0ID0gKGNlbnRlclggKyBoYWxmV2lkdGgpIC8gY2VudGVyWjtcbiAgdmFyIHNjcmVlbkJvdHRvbSA9IChjZW50ZXJZIC0gaGFsZkhlaWdodCkgLyBjZW50ZXJaO1xuICAvLyBDb21wYXJlIHRoZSB0d28gc2V0cyBvZiB0YW4tYW5nbGVzIGFuZCB0YWtlIHRoZSB2YWx1ZSBjbG9zZXIgdG8gemVybyBvbiBlYWNoIHNpZGUuXG4gIHJlc3VsdFswXSA9IE1hdGgubWF4KGZvdkxlZnQsIHNjcmVlbkxlZnQpO1xuICByZXN1bHRbMV0gPSBNYXRoLm1pbihmb3ZUb3AsIHNjcmVlblRvcCk7XG4gIHJlc3VsdFsyXSA9IE1hdGgubWluKGZvdlJpZ2h0LCBzY3JlZW5SaWdodCk7XG4gIHJlc3VsdFszXSA9IE1hdGgubWF4KGZvdkJvdHRvbSwgc2NyZWVuQm90dG9tKTtcbiAgcmV0dXJuIHJlc3VsdDtcbn07XG5cbi8qKlxuICogQ2FsY3VsYXRlcyB0aGUgc2NyZWVuIHJlY3RhbmdsZSB2aXNpYmxlIGZyb20gdGhlIGxlZnQgZXllIGZvciB0aGVcbiAqIGN1cnJlbnQgZGV2aWNlIGFuZCBzY3JlZW4gcGFyYW1ldGVycy5cbiAqL1xuRGV2aWNlSW5mby5wcm90b3R5cGUuZ2V0TGVmdEV5ZVZpc2libGVTY3JlZW5SZWN0ID0gZnVuY3Rpb24odW5kaXN0b3J0ZWRGcnVzdHVtKSB7XG4gIHZhciB2aWV3ZXIgPSB0aGlzLnZpZXdlcjtcbiAgdmFyIGRldmljZSA9IHRoaXMuZGV2aWNlO1xuXG4gIHZhciBkaXN0ID0gdmlld2VyLnNjcmVlbkxlbnNEaXN0YW5jZTtcbiAgdmFyIGV5ZVggPSAoZGV2aWNlLndpZHRoTWV0ZXJzIC0gdmlld2VyLmludGVyTGVuc0Rpc3RhbmNlKSAvIDI7XG4gIHZhciBleWVZID0gdmlld2VyLmJhc2VsaW5lTGVuc0Rpc3RhbmNlIC0gZGV2aWNlLmJldmVsTWV0ZXJzO1xuICB2YXIgbGVmdCA9ICh1bmRpc3RvcnRlZEZydXN0dW1bMF0gKiBkaXN0ICsgZXllWCkgLyBkZXZpY2Uud2lkdGhNZXRlcnM7XG4gIHZhciB0b3AgPSAodW5kaXN0b3J0ZWRGcnVzdHVtWzFdICogZGlzdCArIGV5ZVkpIC8gZGV2aWNlLmhlaWdodE1ldGVycztcbiAgdmFyIHJpZ2h0ID0gKHVuZGlzdG9ydGVkRnJ1c3R1bVsyXSAqIGRpc3QgKyBleWVYKSAvIGRldmljZS53aWR0aE1ldGVycztcbiAgdmFyIGJvdHRvbSA9ICh1bmRpc3RvcnRlZEZydXN0dW1bM10gKiBkaXN0ICsgZXllWSkgLyBkZXZpY2UuaGVpZ2h0TWV0ZXJzO1xuICByZXR1cm4ge1xuICAgIHg6IGxlZnQsXG4gICAgeTogYm90dG9tLFxuICAgIHdpZHRoOiByaWdodCAtIGxlZnQsXG4gICAgaGVpZ2h0OiB0b3AgLSBib3R0b21cbiAgfTtcbn07XG5cbkRldmljZUluZm8ucHJvdG90eXBlLmdldEZpZWxkT2ZWaWV3TGVmdEV5ZSA9IGZ1bmN0aW9uKG9wdF9pc1VuZGlzdG9ydGVkKSB7XG4gIHJldHVybiBvcHRfaXNVbmRpc3RvcnRlZCA/IHRoaXMuZ2V0VW5kaXN0b3J0ZWRGaWVsZE9mVmlld0xlZnRFeWUoKSA6XG4gICAgICB0aGlzLmdldERpc3RvcnRlZEZpZWxkT2ZWaWV3TGVmdEV5ZSgpO1xufTtcblxuRGV2aWNlSW5mby5wcm90b3R5cGUuZ2V0RmllbGRPZlZpZXdSaWdodEV5ZSA9IGZ1bmN0aW9uKG9wdF9pc1VuZGlzdG9ydGVkKSB7XG4gIHZhciBmb3YgPSB0aGlzLmdldEZpZWxkT2ZWaWV3TGVmdEV5ZShvcHRfaXNVbmRpc3RvcnRlZCk7XG4gIHJldHVybiB7XG4gICAgbGVmdERlZ3JlZXM6IGZvdi5yaWdodERlZ3JlZXMsXG4gICAgcmlnaHREZWdyZWVzOiBmb3YubGVmdERlZ3JlZXMsXG4gICAgdXBEZWdyZWVzOiBmb3YudXBEZWdyZWVzLFxuICAgIGRvd25EZWdyZWVzOiBmb3YuZG93bkRlZ3JlZXNcbiAgfTtcbn07XG5cbi8qKlxuICogQ2FsY3VsYXRlcyB1bmRpc3RvcnRlZCBmaWVsZCBvZiB2aWV3IGZvciB0aGUgbGVmdCBleWUuXG4gKi9cbkRldmljZUluZm8ucHJvdG90eXBlLmdldFVuZGlzdG9ydGVkRmllbGRPZlZpZXdMZWZ0RXllID0gZnVuY3Rpb24oKSB7XG4gIHZhciBwID0gdGhpcy5nZXRVbmRpc3RvcnRlZFBhcmFtc18oKTtcblxuICByZXR1cm4ge1xuICAgIGxlZnREZWdyZWVzOiBNYXRoVXRpbC5yYWRUb0RlZyAqIE1hdGguYXRhbihwLm91dGVyRGlzdCksXG4gICAgcmlnaHREZWdyZWVzOiBNYXRoVXRpbC5yYWRUb0RlZyAqIE1hdGguYXRhbihwLmlubmVyRGlzdCksXG4gICAgZG93bkRlZ3JlZXM6IE1hdGhVdGlsLnJhZFRvRGVnICogTWF0aC5hdGFuKHAuYm90dG9tRGlzdCksXG4gICAgdXBEZWdyZWVzOiBNYXRoVXRpbC5yYWRUb0RlZyAqIE1hdGguYXRhbihwLnRvcERpc3QpXG4gIH07XG59O1xuXG5EZXZpY2VJbmZvLnByb3RvdHlwZS5nZXRVbmRpc3RvcnRlZFZpZXdwb3J0TGVmdEV5ZSA9IGZ1bmN0aW9uKCkge1xuICB2YXIgcCA9IHRoaXMuZ2V0VW5kaXN0b3J0ZWRQYXJhbXNfKCk7XG4gIHZhciB2aWV3ZXIgPSB0aGlzLnZpZXdlcjtcbiAgdmFyIGRldmljZSA9IHRoaXMuZGV2aWNlO1xuXG4gIC8vIERpc3RhbmNlcyBzdG9yZWQgaW4gbG9jYWwgdmFyaWFibGVzIGFyZSBpbiB0YW4tYW5nbGUgdW5pdHMgdW5sZXNzIG90aGVyd2lzZVxuICAvLyBub3RlZC5cbiAgdmFyIGV5ZVRvU2NyZWVuRGlzdGFuY2UgPSB2aWV3ZXIuc2NyZWVuTGVuc0Rpc3RhbmNlO1xuICB2YXIgc2NyZWVuV2lkdGggPSBkZXZpY2Uud2lkdGhNZXRlcnMgLyBleWVUb1NjcmVlbkRpc3RhbmNlO1xuICB2YXIgc2NyZWVuSGVpZ2h0ID0gZGV2aWNlLmhlaWdodE1ldGVycyAvIGV5ZVRvU2NyZWVuRGlzdGFuY2U7XG4gIHZhciB4UHhQZXJUYW5BbmdsZSA9IGRldmljZS53aWR0aCAvIHNjcmVlbldpZHRoO1xuICB2YXIgeVB4UGVyVGFuQW5nbGUgPSBkZXZpY2UuaGVpZ2h0IC8gc2NyZWVuSGVpZ2h0O1xuXG4gIHZhciB4ID0gTWF0aC5yb3VuZCgocC5leWVQb3NYIC0gcC5vdXRlckRpc3QpICogeFB4UGVyVGFuQW5nbGUpO1xuICB2YXIgeSA9IE1hdGgucm91bmQoKHAuZXllUG9zWSAtIHAuYm90dG9tRGlzdCkgKiB5UHhQZXJUYW5BbmdsZSk7XG4gIHJldHVybiB7XG4gICAgeDogeCxcbiAgICB5OiB5LFxuICAgIHdpZHRoOiBNYXRoLnJvdW5kKChwLmV5ZVBvc1ggKyBwLmlubmVyRGlzdCkgKiB4UHhQZXJUYW5BbmdsZSkgLSB4LFxuICAgIGhlaWdodDogTWF0aC5yb3VuZCgocC5leWVQb3NZICsgcC50b3BEaXN0KSAqIHlQeFBlclRhbkFuZ2xlKSAtIHlcbiAgfTtcbn07XG5cbkRldmljZUluZm8ucHJvdG90eXBlLmdldFVuZGlzdG9ydGVkUGFyYW1zXyA9IGZ1bmN0aW9uKCkge1xuICB2YXIgdmlld2VyID0gdGhpcy52aWV3ZXI7XG4gIHZhciBkZXZpY2UgPSB0aGlzLmRldmljZTtcbiAgdmFyIGRpc3RvcnRpb24gPSB0aGlzLmRpc3RvcnRpb247XG5cbiAgLy8gTW9zdCBvZiB0aGVzZSB2YXJpYWJsZXMgaW4gdGFuLWFuZ2xlIHVuaXRzLlxuICB2YXIgZXllVG9TY3JlZW5EaXN0YW5jZSA9IHZpZXdlci5zY3JlZW5MZW5zRGlzdGFuY2U7XG4gIHZhciBoYWxmTGVuc0Rpc3RhbmNlID0gdmlld2VyLmludGVyTGVuc0Rpc3RhbmNlIC8gMiAvIGV5ZVRvU2NyZWVuRGlzdGFuY2U7XG4gIHZhciBzY3JlZW5XaWR0aCA9IGRldmljZS53aWR0aE1ldGVycyAvIGV5ZVRvU2NyZWVuRGlzdGFuY2U7XG4gIHZhciBzY3JlZW5IZWlnaHQgPSBkZXZpY2UuaGVpZ2h0TWV0ZXJzIC8gZXllVG9TY3JlZW5EaXN0YW5jZTtcblxuICB2YXIgZXllUG9zWCA9IHNjcmVlbldpZHRoIC8gMiAtIGhhbGZMZW5zRGlzdGFuY2U7XG4gIHZhciBleWVQb3NZID0gKHZpZXdlci5iYXNlbGluZUxlbnNEaXN0YW5jZSAtIGRldmljZS5iZXZlbE1ldGVycykgLyBleWVUb1NjcmVlbkRpc3RhbmNlO1xuXG4gIHZhciBtYXhGb3YgPSB2aWV3ZXIuZm92O1xuICB2YXIgdmlld2VyTWF4ID0gZGlzdG9ydGlvbi5kaXN0b3J0SW52ZXJzZShNYXRoLnRhbihNYXRoVXRpbC5kZWdUb1JhZCAqIG1heEZvdikpO1xuICB2YXIgb3V0ZXJEaXN0ID0gTWF0aC5taW4oZXllUG9zWCwgdmlld2VyTWF4KTtcbiAgdmFyIGlubmVyRGlzdCA9IE1hdGgubWluKGhhbGZMZW5zRGlzdGFuY2UsIHZpZXdlck1heCk7XG4gIHZhciBib3R0b21EaXN0ID0gTWF0aC5taW4oZXllUG9zWSwgdmlld2VyTWF4KTtcbiAgdmFyIHRvcERpc3QgPSBNYXRoLm1pbihzY3JlZW5IZWlnaHQgLSBleWVQb3NZLCB2aWV3ZXJNYXgpO1xuXG4gIHJldHVybiB7XG4gICAgb3V0ZXJEaXN0OiBvdXRlckRpc3QsXG4gICAgaW5uZXJEaXN0OiBpbm5lckRpc3QsXG4gICAgdG9wRGlzdDogdG9wRGlzdCxcbiAgICBib3R0b21EaXN0OiBib3R0b21EaXN0LFxuICAgIGV5ZVBvc1g6IGV5ZVBvc1gsXG4gICAgZXllUG9zWTogZXllUG9zWVxuICB9O1xufTtcblxuXG5mdW5jdGlvbiBDYXJkYm9hcmRWaWV3ZXIocGFyYW1zKSB7XG4gIC8vIEEgbWFjaGluZSByZWFkYWJsZSBJRC5cbiAgdGhpcy5pZCA9IHBhcmFtcy5pZDtcbiAgLy8gQSBodW1hbiByZWFkYWJsZSBsYWJlbC5cbiAgdGhpcy5sYWJlbCA9IHBhcmFtcy5sYWJlbDtcblxuICAvLyBGaWVsZCBvZiB2aWV3IGluIGRlZ3JlZXMgKHBlciBzaWRlKS5cbiAgdGhpcy5mb3YgPSBwYXJhbXMuZm92O1xuXG4gIC8vIERpc3RhbmNlIGJldHdlZW4gbGVucyBjZW50ZXJzIGluIG1ldGVycy5cbiAgdGhpcy5pbnRlckxlbnNEaXN0YW5jZSA9IHBhcmFtcy5pbnRlckxlbnNEaXN0YW5jZTtcbiAgLy8gRGlzdGFuY2UgYmV0d2VlbiB2aWV3ZXIgYmFzZWxpbmUgYW5kIGxlbnMgY2VudGVyIGluIG1ldGVycy5cbiAgdGhpcy5iYXNlbGluZUxlbnNEaXN0YW5jZSA9IHBhcmFtcy5iYXNlbGluZUxlbnNEaXN0YW5jZTtcbiAgLy8gU2NyZWVuLXRvLWxlbnMgZGlzdGFuY2UgaW4gbWV0ZXJzLlxuICB0aGlzLnNjcmVlbkxlbnNEaXN0YW5jZSA9IHBhcmFtcy5zY3JlZW5MZW5zRGlzdGFuY2U7XG5cbiAgLy8gRGlzdG9ydGlvbiBjb2VmZmljaWVudHMuXG4gIHRoaXMuZGlzdG9ydGlvbkNvZWZmaWNpZW50cyA9IHBhcmFtcy5kaXN0b3J0aW9uQ29lZmZpY2llbnRzO1xuICAvLyBJbnZlcnNlIGRpc3RvcnRpb24gY29lZmZpY2llbnRzLlxuICAvLyBUT0RPOiBDYWxjdWxhdGUgdGhlc2UgZnJvbSBkaXN0b3J0aW9uQ29lZmZpY2llbnRzIGluIHRoZSBmdXR1cmUuXG4gIHRoaXMuaW52ZXJzZUNvZWZmaWNpZW50cyA9IHBhcmFtcy5pbnZlcnNlQ29lZmZpY2llbnRzO1xufVxuXG4vLyBFeHBvcnQgdmlld2VyIGluZm9ybWF0aW9uLlxuRGV2aWNlSW5mby5WaWV3ZXJzID0gVmlld2Vycztcbm1vZHVsZS5leHBvcnRzID0gRGV2aWNlSW5mbztcbiIsIi8qXG4gKiBDb3B5cmlnaHQgMjAxNiBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICogTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcbiAqIHlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cbiAqIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuICpcbiAqICAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcbiAqXG4gKiBVbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG4gKiBkaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG4gKiBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cbiAqIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbiAqIGxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuICovXG52YXIgVlJEaXNwbGF5ID0gcmVxdWlyZSgnLi9iYXNlLmpzJykuVlJEaXNwbGF5O1xudmFyIEhNRFZSRGV2aWNlID0gcmVxdWlyZSgnLi9iYXNlLmpzJykuSE1EVlJEZXZpY2U7XG52YXIgUG9zaXRpb25TZW5zb3JWUkRldmljZSA9IHJlcXVpcmUoJy4vYmFzZS5qcycpLlBvc2l0aW9uU2Vuc29yVlJEZXZpY2U7XG5cbi8qKlxuICogV3JhcHMgYSBWUkRpc3BsYXkgYW5kIGV4cG9zZXMgaXQgYXMgYSBITURWUkRldmljZVxuICovXG5mdW5jdGlvbiBWUkRpc3BsYXlITUREZXZpY2UoZGlzcGxheSkge1xuICB0aGlzLmRpc3BsYXkgPSBkaXNwbGF5O1xuXG4gIHRoaXMuaGFyZHdhcmVVbml0SWQgPSBkaXNwbGF5LmRpc3BsYXlJZDtcbiAgdGhpcy5kZXZpY2VJZCA9ICd3ZWJ2ci1wb2x5ZmlsbDpITUQ6JyArIGRpc3BsYXkuZGlzcGxheUlkO1xuICB0aGlzLmRldmljZU5hbWUgPSBkaXNwbGF5LmRpc3BsYXlOYW1lICsgJyAoSE1EKSc7XG59XG5WUkRpc3BsYXlITUREZXZpY2UucHJvdG90eXBlID0gbmV3IEhNRFZSRGV2aWNlKCk7XG5cblZSRGlzcGxheUhNRERldmljZS5wcm90b3R5cGUuZ2V0RXllUGFyYW1ldGVycyA9IGZ1bmN0aW9uKHdoaWNoRXllKSB7XG4gIHZhciBleWVQYXJhbWV0ZXJzID0gdGhpcy5kaXNwbGF5LmdldEV5ZVBhcmFtZXRlcnMod2hpY2hFeWUpO1xuXG4gIHJldHVybiB7XG4gICAgY3VycmVudEZpZWxkT2ZWaWV3OiBleWVQYXJhbWV0ZXJzLmZpZWxkT2ZWaWV3LFxuICAgIG1heGltdW1GaWVsZE9mVmlldzogZXllUGFyYW1ldGVycy5maWVsZE9mVmlldyxcbiAgICBtaW5pbXVtRmllbGRPZlZpZXc6IGV5ZVBhcmFtZXRlcnMuZmllbGRPZlZpZXcsXG4gICAgcmVjb21tZW5kZWRGaWVsZE9mVmlldzogZXllUGFyYW1ldGVycy5maWVsZE9mVmlldyxcbiAgICBleWVUcmFuc2xhdGlvbjogeyB4OiBleWVQYXJhbWV0ZXJzLm9mZnNldFswXSwgeTogZXllUGFyYW1ldGVycy5vZmZzZXRbMV0sIHo6IGV5ZVBhcmFtZXRlcnMub2Zmc2V0WzJdIH0sXG4gICAgcmVuZGVyUmVjdDoge1xuICAgICAgeDogKHdoaWNoRXllID09ICdyaWdodCcpID8gZXllUGFyYW1ldGVycy5yZW5kZXJXaWR0aCA6IDAsXG4gICAgICB5OiAwLFxuICAgICAgd2lkdGg6IGV5ZVBhcmFtZXRlcnMucmVuZGVyV2lkdGgsXG4gICAgICBoZWlnaHQ6IGV5ZVBhcmFtZXRlcnMucmVuZGVySGVpZ2h0XG4gICAgfVxuICB9O1xufTtcblxuVlJEaXNwbGF5SE1ERGV2aWNlLnByb3RvdHlwZS5zZXRGaWVsZE9mVmlldyA9XG4gICAgZnVuY3Rpb24ob3B0X2ZvdkxlZnQsIG9wdF9mb3ZSaWdodCwgb3B0X3pOZWFyLCBvcHRfekZhcikge1xuICAvLyBOb3Qgc3VwcG9ydGVkLiBnZXRFeWVQYXJhbWV0ZXJzIHJlcG9ydHMgdGhhdCB0aGUgbWluLCBtYXgsIGFuZCByZWNvbW1lbmRlZFxuICAvLyBGb1YgaXMgYWxsIHRoZSBzYW1lLCBzbyBubyBhZGp1c3RtZW50IGNhbiBiZSBtYWRlLlxufTtcblxuLy8gVE9ETzogTmVlZCB0byBob29rIHJlcXVlc3RGdWxsc2NyZWVuIHRvIHNlZSBpZiBhIHdyYXBwZWQgVlJEaXNwbGF5IHdhcyBwYXNzZWRcbi8vIGluIGFzIGFuIG9wdGlvbi4gSWYgc28gd2Ugc2hvdWxkIHByZXZlbnQgdGhlIGRlZmF1bHQgZnVsbHNjcmVlbiBiZWhhdmlvciBhbmRcbi8vIGNhbGwgVlJEaXNwbGF5LnJlcXVlc3RQcmVzZW50IGluc3RlYWQuXG5cbi8qKlxuICogV3JhcHMgYSBWUkRpc3BsYXkgYW5kIGV4cG9zZXMgaXQgYXMgYSBQb3NpdGlvblNlbnNvclZSRGV2aWNlXG4gKi9cbmZ1bmN0aW9uIFZSRGlzcGxheVBvc2l0aW9uU2Vuc29yRGV2aWNlKGRpc3BsYXkpIHtcbiAgdGhpcy5kaXNwbGF5ID0gZGlzcGxheTtcblxuICB0aGlzLmhhcmR3YXJlVW5pdElkID0gZGlzcGxheS5kaXNwbGF5SWQ7XG4gIHRoaXMuZGV2aWNlSWQgPSAnd2VidnItcG9seWZpbGw6UG9zaXRpb25TZW5zb3I6ICcgKyBkaXNwbGF5LmRpc3BsYXlJZDtcbiAgdGhpcy5kZXZpY2VOYW1lID0gZGlzcGxheS5kaXNwbGF5TmFtZSArICcgKFBvc2l0aW9uU2Vuc29yKSc7XG59XG5WUkRpc3BsYXlQb3NpdGlvblNlbnNvckRldmljZS5wcm90b3R5cGUgPSBuZXcgUG9zaXRpb25TZW5zb3JWUkRldmljZSgpO1xuXG5WUkRpc3BsYXlQb3NpdGlvblNlbnNvckRldmljZS5wcm90b3R5cGUuZ2V0U3RhdGUgPSBmdW5jdGlvbigpIHtcbiAgdmFyIHBvc2UgPSB0aGlzLmRpc3BsYXkuZ2V0UG9zZSgpO1xuICByZXR1cm4ge1xuICAgIHBvc2l0aW9uOiBwb3NlLnBvc2l0aW9uID8geyB4OiBwb3NlLnBvc2l0aW9uWzBdLCB5OiBwb3NlLnBvc2l0aW9uWzFdLCB6OiBwb3NlLnBvc2l0aW9uWzJdIH0gOiBudWxsLFxuICAgIG9yaWVudGF0aW9uOiBwb3NlLm9yaWVudGF0aW9uID8geyB4OiBwb3NlLm9yaWVudGF0aW9uWzBdLCB5OiBwb3NlLm9yaWVudGF0aW9uWzFdLCB6OiBwb3NlLm9yaWVudGF0aW9uWzJdLCB3OiBwb3NlLm9yaWVudGF0aW9uWzNdIH0gOiBudWxsLFxuICAgIGxpbmVhclZlbG9jaXR5OiBudWxsLFxuICAgIGxpbmVhckFjY2VsZXJhdGlvbjogbnVsbCxcbiAgICBhbmd1bGFyVmVsb2NpdHk6IG51bGwsXG4gICAgYW5ndWxhckFjY2VsZXJhdGlvbjogbnVsbFxuICB9O1xufTtcblxuVlJEaXNwbGF5UG9zaXRpb25TZW5zb3JEZXZpY2UucHJvdG90eXBlLnJlc2V0U3RhdGUgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIHRoaXMucG9zaXRpb25EZXZpY2UucmVzZXRQb3NlKCk7XG59O1xuXG5cbm1vZHVsZS5leHBvcnRzLlZSRGlzcGxheUhNRERldmljZSA9IFZSRGlzcGxheUhNRERldmljZTtcbm1vZHVsZS5leHBvcnRzLlZSRGlzcGxheVBvc2l0aW9uU2Vuc29yRGV2aWNlID0gVlJEaXNwbGF5UG9zaXRpb25TZW5zb3JEZXZpY2U7XG5cbiIsIi8qKlxuICogVE9ETyhzbXVzKTogSW1wbGVtZW50IGNvZWZmaWNpZW50IGludmVyc2lvbi5cbiAqL1xuZnVuY3Rpb24gRGlzdG9ydGlvbihjb2VmZmljaWVudHMpIHtcbiAgdGhpcy5jb2VmZmljaWVudHMgPSBjb2VmZmljaWVudHM7XG59XG5cbi8qKlxuICogQ2FsY3VsYXRlcyB0aGUgaW52ZXJzZSBkaXN0b3J0aW9uIGZvciBhIHJhZGl1cy5cbiAqIDwvcD48cD5cbiAqIEFsbG93cyB0byBjb21wdXRlIHRoZSBvcmlnaW5hbCB1bmRpc3RvcnRlZCByYWRpdXMgZnJvbSBhIGRpc3RvcnRlZCBvbmUuXG4gKiBTZWUgYWxzbyBnZXRBcHByb3hpbWF0ZUludmVyc2VEaXN0b3J0aW9uKCkgZm9yIGEgZmFzdGVyIGJ1dCBwb3RlbnRpYWxseVxuICogbGVzcyBhY2N1cmF0ZSBtZXRob2QuXG4gKlxuICogQHBhcmFtIHtOdW1iZXJ9IHJhZGl1cyBEaXN0b3J0ZWQgcmFkaXVzIGZyb20gdGhlIGxlbnMgY2VudGVyIGluIHRhbi1hbmdsZSB1bml0cy5cbiAqIEByZXR1cm4ge051bWJlcn0gVGhlIHVuZGlzdG9ydGVkIHJhZGl1cyBpbiB0YW4tYW5nbGUgdW5pdHMuXG4gKi9cbkRpc3RvcnRpb24ucHJvdG90eXBlLmRpc3RvcnRJbnZlcnNlID0gZnVuY3Rpb24ocmFkaXVzKSB7XG4gIC8vIFNlY2FudCBtZXRob2QuXG4gIHZhciByMCA9IDA7XG4gIHZhciByMSA9IDE7XG4gIHZhciBkcjAgPSByYWRpdXMgLSB0aGlzLmRpc3RvcnQocjApO1xuICB3aGlsZSAoTWF0aC5hYnMocjEgLSByMCkgPiAwLjAwMDEgLyoqIDAuMW1tICovKSB7XG4gICAgdmFyIGRyMSA9IHJhZGl1cyAtIHRoaXMuZGlzdG9ydChyMSk7XG4gICAgdmFyIHIyID0gcjEgLSBkcjEgKiAoKHIxIC0gcjApIC8gKGRyMSAtIGRyMCkpO1xuICAgIHIwID0gcjE7XG4gICAgcjEgPSByMjtcbiAgICBkcjAgPSBkcjE7XG4gIH1cbiAgcmV0dXJuIHIxO1xufTtcblxuLyoqXG4gKiBEaXN0b3J0cyBhIHJhZGl1cyBieSBpdHMgZGlzdG9ydGlvbiBmYWN0b3IgZnJvbSB0aGUgY2VudGVyIG9mIHRoZSBsZW5zZXMuXG4gKlxuICogQHBhcmFtIHtOdW1iZXJ9IHJhZGl1cyBSYWRpdXMgZnJvbSB0aGUgbGVucyBjZW50ZXIgaW4gdGFuLWFuZ2xlIHVuaXRzLlxuICogQHJldHVybiB7TnVtYmVyfSBUaGUgZGlzdG9ydGVkIHJhZGl1cyBpbiB0YW4tYW5nbGUgdW5pdHMuXG4gKi9cbkRpc3RvcnRpb24ucHJvdG90eXBlLmRpc3RvcnQgPSBmdW5jdGlvbihyYWRpdXMpIHtcbiAgdmFyIHIyID0gcmFkaXVzICogcmFkaXVzO1xuICB2YXIgcmV0ID0gMDtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmNvZWZmaWNpZW50cy5sZW5ndGg7IGkrKykge1xuICAgIHJldCA9IHIyICogKHJldCArIHRoaXMuY29lZmZpY2llbnRzW2ldKTtcbiAgfVxuICByZXR1cm4gKHJldCArIDEpICogcmFkaXVzO1xufTtcblxuLy8gRnVuY3Rpb25zIGJlbG93IHJvdWdobHkgcG9ydGVkIGZyb21cbi8vIGh0dHBzOi8vZ2l0aHViLmNvbS9nb29nbGVzYW1wbGVzL2NhcmRib2FyZC11bml0eS9ibG9iL21hc3Rlci9DYXJkYm9hcmQvU2NyaXB0cy9DYXJkYm9hcmRQcm9maWxlLmNzI0w0MTJcblxuLy8gU29sdmVzIGEgc21hbGwgbGluZWFyIGVxdWF0aW9uIHZpYSBkZXN0cnVjdGl2ZSBnYXVzc2lhblxuLy8gZWxpbWluYXRpb24gYW5kIGJhY2sgc3Vic3RpdHV0aW9uLiAgVGhpcyBpc24ndCBnZW5lcmljIG51bWVyaWNcbi8vIGNvZGUsIGl0J3MganVzdCBhIHF1aWNrIGhhY2sgdG8gd29yayB3aXRoIHRoZSBnZW5lcmFsbHlcbi8vIHdlbGwtYmVoYXZlZCBzeW1tZXRyaWMgbWF0cmljZXMgZm9yIGxlYXN0LXNxdWFyZXMgZml0dGluZy5cbi8vIE5vdCBpbnRlbmRlZCBmb3IgcmV1c2UuXG4vL1xuLy8gQHBhcmFtIGEgSW5wdXQgcG9zaXRpdmUgZGVmaW5pdGUgc3ltbWV0cmljYWwgbWF0cml4LiBEZXN0cm95ZWRcbi8vICAgICBkdXJpbmcgY2FsY3VsYXRpb24uXG4vLyBAcGFyYW0geSBJbnB1dCByaWdodC1oYW5kLXNpZGUgdmFsdWVzLiBEZXN0cm95ZWQgZHVyaW5nIGNhbGN1bGF0aW9uLlxuLy8gQHJldHVybiBSZXN1bHRpbmcgeCB2YWx1ZSB2ZWN0b3IuXG4vL1xuRGlzdG9ydGlvbi5wcm90b3R5cGUuc29sdmVMaW5lYXJfID0gZnVuY3Rpb24oYSwgeSkge1xuICB2YXIgbiA9IGEubGVuZ3RoO1xuXG4gIC8vIEdhdXNzaWFuIGVsaW1pbmF0aW9uIChubyByb3cgZXhjaGFuZ2UpIHRvIHRyaWFuZ3VsYXIgbWF0cml4LlxuICAvLyBUaGUgaW5wdXQgbWF0cml4IGlzIGEgQV5UIEEgcHJvZHVjdCB3aGljaCBzaG91bGQgYmUgYSBwb3NpdGl2ZVxuICAvLyBkZWZpbml0ZSBzeW1tZXRyaWNhbCBtYXRyaXgsIGFuZCBpZiBJIHJlbWVtYmVyIG15IGxpbmVhclxuICAvLyBhbGdlYnJhIHJpZ2h0IHRoaXMgaW1wbGllcyB0aGF0IHRoZSBwaXZvdHMgd2lsbCBiZSBub256ZXJvIGFuZFxuICAvLyBjYWxjdWxhdGlvbnMgc3VmZmljaWVudGx5IGFjY3VyYXRlIHdpdGhvdXQgbmVlZGluZyByb3dcbiAgLy8gZXhjaGFuZ2UuXG4gIGZvciAodmFyIGogPSAwOyBqIDwgbiAtIDE7ICsraikge1xuICAgIGZvciAodmFyIGsgPSBqICsgMTsgayA8IG47ICsraykge1xuICAgICAgdmFyIHAgPSBhW2pdW2tdIC8gYVtqXVtqXTtcbiAgICAgIGZvciAodmFyIGkgPSBqICsgMTsgaSA8IG47ICsraSkge1xuICAgICAgICBhW2ldW2tdIC09IHAgKiBhW2ldW2pdO1xuICAgICAgfVxuICAgICAgeVtrXSAtPSBwICogeVtqXTtcbiAgICB9XG4gIH1cbiAgLy8gRnJvbSB0aGlzIHBvaW50IG9uLCBvbmx5IHRoZSBtYXRyaXggZWxlbWVudHMgYVtqXVtpXSB3aXRoIGk+PWogYXJlXG4gIC8vIHZhbGlkLiBUaGUgZWxpbWluYXRpb24gZG9lc24ndCBmaWxsIGluIGVsaW1pbmF0ZWQgMCB2YWx1ZXMuXG5cbiAgdmFyIHggPSBuZXcgQXJyYXkobik7XG5cbiAgLy8gQmFjayBzdWJzdGl0dXRpb24uXG4gIGZvciAodmFyIGogPSBuIC0gMTsgaiA+PSAwOyAtLWopIHtcbiAgICB2YXIgdiA9IHlbal07XG4gICAgZm9yICh2YXIgaSA9IGogKyAxOyBpIDwgbjsgKytpKSB7XG4gICAgICB2IC09IGFbaV1bal0gKiB4W2ldO1xuICAgIH1cbiAgICB4W2pdID0gdiAvIGFbal1bal07XG4gIH1cblxuICByZXR1cm4geDtcbn07XG5cbi8vIFNvbHZlcyBhIGxlYXN0LXNxdWFyZXMgbWF0cml4IGVxdWF0aW9uLiAgR2l2ZW4gdGhlIGVxdWF0aW9uIEEgKiB4ID0geSwgY2FsY3VsYXRlIHRoZVxuLy8gbGVhc3Qtc3F1YXJlIGZpdCB4ID0gaW52ZXJzZShBICogdHJhbnNwb3NlKEEpKSAqIHRyYW5zcG9zZShBKSAqIHkuICBUaGUgd2F5IHRoaXMgd29ya3Ncbi8vIGlzIHRoYXQsIHdoaWxlIEEgaXMgdHlwaWNhbGx5IG5vdCBhIHNxdWFyZSBtYXRyaXggKGFuZCBoZW5jZSBub3QgaW52ZXJ0aWJsZSksIEEgKiB0cmFuc3Bvc2UoQSlcbi8vIGlzIGFsd2F5cyBzcXVhcmUuICBUaGF0IGlzOlxuLy8gICBBICogeCA9IHlcbi8vICAgdHJhbnNwb3NlKEEpICogKEEgKiB4KSA9IHRyYW5zcG9zZShBKSAqIHkgICA8LSBtdWx0aXBseSBib3RoIHNpZGVzIGJ5IHRyYW5zcG9zZShBKVxuLy8gICAodHJhbnNwb3NlKEEpICogQSkgKiB4ID0gdHJhbnNwb3NlKEEpICogeSAgIDwtIGFzc29jaWF0aXZpdHlcbi8vICAgeCA9IGludmVyc2UodHJhbnNwb3NlKEEpICogQSkgKiB0cmFuc3Bvc2UoQSkgKiB5ICA8LSBzb2x2ZSBmb3IgeFxuLy8gTWF0cml4IEEncyByb3cgY291bnQgKGZpcnN0IGluZGV4KSBtdXN0IG1hdGNoIHkncyB2YWx1ZSBjb3VudC4gIEEncyBjb2x1bW4gY291bnQgKHNlY29uZCBpbmRleClcbi8vIGRldGVybWluZXMgdGhlIGxlbmd0aCBvZiB0aGUgcmVzdWx0IHZlY3RvciB4LlxuRGlzdG9ydGlvbi5wcm90b3R5cGUuc29sdmVMZWFzdFNxdWFyZXNfID0gZnVuY3Rpb24obWF0QSwgdmVjWSkge1xuICB2YXIgaSwgaiwgaywgc3VtO1xuICB2YXIgbnVtU2FtcGxlcyA9IG1hdEEubGVuZ3RoO1xuICB2YXIgbnVtQ29lZmZpY2llbnRzID0gbWF0QVswXS5sZW5ndGg7XG4gIGlmIChudW1TYW1wbGVzICE9IHZlY1kuTGVuZ3RoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiTWF0cml4IC8gdmVjdG9yIGRpbWVuc2lvbiBtaXNtYXRjaFwiKTtcbiAgfVxuXG4gIC8vIENhbGN1bGF0ZSB0cmFuc3Bvc2UoQSkgKiBBXG4gIHZhciBtYXRBVEEgPSBuZXcgQXJyYXkobnVtQ29lZmZpY2llbnRzKTtcbiAgZm9yIChrID0gMDsgayA8IG51bUNvZWZmaWNpZW50czsgKytrKSB7XG4gICAgbWF0QVRBW2tdID0gbmV3IEFycmF5KG51bUNvZWZmaWNpZW50cyk7XG4gICAgZm9yIChqID0gMDsgaiA8IG51bUNvZWZmaWNpZW50czsgKytqKSB7XG4gICAgICBzdW0gPSAwO1xuICAgICAgZm9yIChpID0gMDsgaSA8IG51bVNhbXBsZXM7ICsraSkge1xuICAgICAgICBzdW0gKz0gbWF0QVtqXVtpXSAqIG1hdEFba11baV07XG4gICAgICB9XG4gICAgICBtYXRBVEFba11bal0gPSBzdW07XG4gICAgfVxuICB9XG5cbiAgLy8gQ2FsY3VsYXRlIHRyYW5zcG9zZShBKSAqIHlcbiAgdmFyIHZlY0FUWSA9IG5ldyBBcnJheShudW1Db2VmZmljaWVudHMpO1xuICBmb3IgKGogPSAwOyBqIDwgbnVtQ29lZmZpY2llbnRzOyArK2opIHtcbiAgICBzdW0gPSAwO1xuICAgIGZvciAoaSA9IDA7IGkgPCBudW1TYW1wbGVzOyArK2kpIHtcbiAgICAgIHN1bSArPSBtYXRBW2pdW2ldICogdmVjWVtpXTtcbiAgICB9XG4gICAgdmVjQVRZW2pdID0gc3VtO1xuICB9XG5cbiAgLy8gTm93IHNvbHZlIChBICogdHJhbnNwb3NlKEEpKSAqIHggPSB0cmFuc3Bvc2UoQSkgKiB5LlxuICByZXR1cm4gdGhpcy5zb2x2ZUxpbmVhcl8obWF0QVRBLCB2ZWNBVFkpO1xufTtcblxuLy8vIENhbGN1bGF0ZXMgYW4gYXBwcm94aW1hdGUgaW52ZXJzZSB0byB0aGUgZ2l2ZW4gcmFkaWFsIGRpc3RvcnRpb24gcGFyYW1ldGVycy5cbkRpc3RvcnRpb24ucHJvdG90eXBlLmFwcHJveGltYXRlSW52ZXJzZSA9IGZ1bmN0aW9uKG1heFJhZGl1cywgbnVtU2FtcGxlcykge1xuICBtYXhSYWRpdXMgPSBtYXhSYWRpdXMgfHwgMTtcbiAgbnVtU2FtcGxlcyA9IG51bVNhbXBsZXMgfHwgMTAwO1xuICB2YXIgbnVtQ29lZmZpY2llbnRzID0gNjtcbiAgdmFyIGksIGo7XG5cbiAgLy8gUiArIEsxKlJeMyArIEsyKlJeNSA9IHIsIHdpdGggUiA9IHJwID0gZGlzdG9ydChyKVxuICAvLyBSZXBlYXRpbmcgZm9yIG51bVNhbXBsZXM6XG4gIC8vICAgWyBSMF4zLCBSMF41IF0gKiBbIEsxIF0gPSBbIHIwIC0gUjAgXVxuICAvLyAgIFsgUjFeMywgUjFeNSBdICAgWyBLMiBdICAgWyByMSAtIFIxIF1cbiAgLy8gICBbIFIyXjMsIFIyXjUgXSAgICAgICAgICAgIFsgcjIgLSBSMiBdXG4gIC8vICAgWyBldGMuLi4gXSAgICAgICAgICAgICAgICBbIGV0Yy4uLiBdXG4gIC8vIFRoYXQgaXM6XG4gIC8vICAgbWF0QSAqIFtLMSwgSzJdID0geVxuICAvLyBTb2x2ZTpcbiAgLy8gICBbSzEsIEsyXSA9IGludmVyc2UodHJhbnNwb3NlKG1hdEEpICogbWF0QSkgKiB0cmFuc3Bvc2UobWF0QSkgKiB5XG4gIHZhciBtYXRBID0gbmV3IEFycmF5KG51bUNvZWZmaWNpZW50cyk7XG4gIGZvciAoaiA9IDA7IGogPCBudW1Db2VmZmljaWVudHM7ICsraikge1xuICAgIG1hdEFbal0gPSBuZXcgQXJyYXkobnVtU2FtcGxlcyk7XG4gIH1cbiAgdmFyIHZlY1kgPSBuZXcgQXJyYXkobnVtU2FtcGxlcyk7XG5cbiAgZm9yIChpID0gMDsgaSA8IG51bVNhbXBsZXM7ICsraSkge1xuICAgIHZhciByID0gbWF4UmFkaXVzICogKGkgKyAxKSAvIG51bVNhbXBsZXM7XG4gICAgdmFyIHJwID0gdGhpcy5kaXN0b3J0KHIpO1xuICAgIHZhciB2ID0gcnA7XG4gICAgZm9yIChqID0gMDsgaiA8IG51bUNvZWZmaWNpZW50czsgKytqKSB7XG4gICAgICB2ICo9IHJwICogcnA7XG4gICAgICBtYXRBW2pdW2ldID0gdjtcbiAgICB9XG4gICAgdmVjWVtpXSA9IHIgLSBycDtcbiAgfVxuXG4gIHZhciBpbnZlcnNlQ29lZmZpY2llbnRzID0gdGhpcy5zb2x2ZUxlYXN0U3F1YXJlc18obWF0QSwgdmVjWSk7XG5cbiAgcmV0dXJuIG5ldyBEaXN0b3J0aW9uKGludmVyc2VDb2VmZmljaWVudHMpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBEaXN0b3J0aW9uO1xuIiwiLypcbiAqIENvcHlyaWdodCAyMDE1IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xuICogeW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuICogWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG4gKlxuICogICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuICpcbiAqIFVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbiAqIGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbiAqIFdJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuICogU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxuICogbGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG4gKi9cblxuLyoqXG4gKiBEUERCIGNhY2hlLlxuICovXG52YXIgRFBEQl9DQUNIRSA9IHtcbiAgXCJmb3JtYXRcIjogMSxcbiAgXCJsYXN0X3VwZGF0ZWRcIjogXCIyMDE2LTAxLTIwVDAwOjE4OjM1WlwiLFxuICBcImRldmljZXNcIjogW1xuXG4gIHtcbiAgICBcInR5cGVcIjogXCJhbmRyb2lkXCIsXG4gICAgXCJydWxlc1wiOiBbXG4gICAgICB7IFwibWRtaFwiOiBcImFzdXMvKi9OZXh1cyA3LypcIiB9LFxuICAgICAgeyBcInVhXCI6IFwiTmV4dXMgN1wiIH1cbiAgICBdLFxuICAgIFwiZHBpXCI6IFsgMzIwLjgsIDMyMy4wIF0sXG4gICAgXCJid1wiOiAzLFxuICAgIFwiYWNcIjogNTAwXG4gIH0sXG5cbiAge1xuICAgIFwidHlwZVwiOiBcImFuZHJvaWRcIixcbiAgICBcInJ1bGVzXCI6IFtcbiAgICAgIHsgXCJtZG1oXCI6IFwiYXN1cy8qL0FTVVNfWjAwQUQvKlwiIH0sXG4gICAgICB7IFwidWFcIjogXCJBU1VTX1owMEFEXCIgfVxuICAgIF0sXG4gICAgXCJkcGlcIjogWyA0MDMuMCwgNDA0LjYgXSxcbiAgICBcImJ3XCI6IDMsXG4gICAgXCJhY1wiOiAxMDAwXG4gIH0sXG5cbiAge1xuICAgIFwidHlwZVwiOiBcImFuZHJvaWRcIixcbiAgICBcInJ1bGVzXCI6IFtcbiAgICAgIHsgXCJtZG1oXCI6IFwiSFRDLyovSFRDNjQzNUxWVy8qXCIgfSxcbiAgICAgIHsgXCJ1YVwiOiBcIkhUQzY0MzVMVldcIiB9XG4gICAgXSxcbiAgICBcImRwaVwiOiBbIDQ0OS43LCA0NDMuMyBdLFxuICAgIFwiYndcIjogMyxcbiAgICBcImFjXCI6IDEwMDBcbiAgfSxcblxuICB7XG4gICAgXCJ0eXBlXCI6IFwiYW5kcm9pZFwiLFxuICAgIFwicnVsZXNcIjogW1xuICAgICAgeyBcIm1kbWhcIjogXCJIVEMvKi9IVEMgT25lIFhMLypcIiB9LFxuICAgICAgeyBcInVhXCI6IFwiSFRDIE9uZSBYTFwiIH1cbiAgICBdLFxuICAgIFwiZHBpXCI6IFsgMzE1LjMsIDMxNC42IF0sXG4gICAgXCJid1wiOiAzLFxuICAgIFwiYWNcIjogMTAwMFxuICB9LFxuXG4gIHtcbiAgICBcInR5cGVcIjogXCJhbmRyb2lkXCIsXG4gICAgXCJydWxlc1wiOiBbXG4gICAgICB7IFwibWRtaFwiOiBcImh0Yy8qL05leHVzIDkvKlwiIH0sXG4gICAgICB7IFwidWFcIjogXCJOZXh1cyA5XCIgfVxuICAgIF0sXG4gICAgXCJkcGlcIjogMjg5LjAsXG4gICAgXCJid1wiOiAzLFxuICAgIFwiYWNcIjogNTAwXG4gIH0sXG5cbiAge1xuICAgIFwidHlwZVwiOiBcImFuZHJvaWRcIixcbiAgICBcInJ1bGVzXCI6IFtcbiAgICAgIHsgXCJtZG1oXCI6IFwiSFRDLyovSFRDIE9uZSBNOS8qXCIgfSxcbiAgICAgIHsgXCJ1YVwiOiBcIkhUQyBPbmUgTTlcIiB9XG4gICAgXSxcbiAgICBcImRwaVwiOiBbIDQ0Mi41LCA0NDMuMyBdLFxuICAgIFwiYndcIjogMyxcbiAgICBcImFjXCI6IDUwMFxuICB9LFxuXG4gIHtcbiAgICBcInR5cGVcIjogXCJhbmRyb2lkXCIsXG4gICAgXCJydWxlc1wiOiBbXG4gICAgICB7IFwibWRtaFwiOiBcIkhUQy8qL0hUQyBPbmVfTTgvKlwiIH0sXG4gICAgICB7IFwidWFcIjogXCJIVEMgT25lX004XCIgfVxuICAgIF0sXG4gICAgXCJkcGlcIjogWyA0NDkuNywgNDQ3LjQgXSxcbiAgICBcImJ3XCI6IDMsXG4gICAgXCJhY1wiOiA1MDBcbiAgfSxcblxuICB7XG4gICAgXCJ0eXBlXCI6IFwiYW5kcm9pZFwiLFxuICAgIFwicnVsZXNcIjogW1xuICAgICAgeyBcIm1kbWhcIjogXCJIVEMvKi9IVEMgT25lLypcIiB9LFxuICAgICAgeyBcInVhXCI6IFwiSFRDIE9uZVwiIH1cbiAgICBdLFxuICAgIFwiZHBpXCI6IDQ3Mi44LFxuICAgIFwiYndcIjogMyxcbiAgICBcImFjXCI6IDEwMDBcbiAgfSxcblxuICB7XG4gICAgXCJ0eXBlXCI6IFwiYW5kcm9pZFwiLFxuICAgIFwicnVsZXNcIjogW1xuICAgICAgeyBcIm1kbWhcIjogXCJIdWF3ZWkvKi9OZXh1cyA2UC8qXCIgfSxcbiAgICAgIHsgXCJ1YVwiOiBcIk5leHVzIDZQXCIgfVxuICAgIF0sXG4gICAgXCJkcGlcIjogWyA1MTUuMSwgNTE4LjAgXSxcbiAgICBcImJ3XCI6IDMsXG4gICAgXCJhY1wiOiAxMDAwXG4gIH0sXG5cbiAge1xuICAgIFwidHlwZVwiOiBcImFuZHJvaWRcIixcbiAgICBcInJ1bGVzXCI6IFtcbiAgICAgIHsgXCJtZG1oXCI6IFwiTEdFLyovTmV4dXMgNVgvKlwiIH0sXG4gICAgICB7IFwidWFcIjogXCJOZXh1cyA1WFwiIH1cbiAgICBdLFxuICAgIFwiZHBpXCI6IFsgNDIyLjAsIDQxOS45IF0sXG4gICAgXCJid1wiOiAzLFxuICAgIFwiYWNcIjogMTAwMFxuICB9LFxuXG4gIHtcbiAgICBcInR5cGVcIjogXCJhbmRyb2lkXCIsXG4gICAgXCJydWxlc1wiOiBbXG4gICAgICB7IFwibWRtaFwiOiBcIkxHRS8qL0xHTVMzNDUvKlwiIH0sXG4gICAgICB7IFwidWFcIjogXCJMR01TMzQ1XCIgfVxuICAgIF0sXG4gICAgXCJkcGlcIjogWyAyMjEuNywgMjE5LjEgXSxcbiAgICBcImJ3XCI6IDMsXG4gICAgXCJhY1wiOiA1MDBcbiAgfSxcblxuICB7XG4gICAgXCJ0eXBlXCI6IFwiYW5kcm9pZFwiLFxuICAgIFwicnVsZXNcIjogW1xuICAgICAgeyBcIm1kbWhcIjogXCJMR0UvKi9MRy1EODAwLypcIiB9LFxuICAgICAgeyBcInVhXCI6IFwiTEctRDgwMFwiIH1cbiAgICBdLFxuICAgIFwiZHBpXCI6IFsgNDIyLjAsIDQyNC4xIF0sXG4gICAgXCJid1wiOiAzLFxuICAgIFwiYWNcIjogNTAwXG4gIH0sXG5cbiAge1xuICAgIFwidHlwZVwiOiBcImFuZHJvaWRcIixcbiAgICBcInJ1bGVzXCI6IFtcbiAgICAgIHsgXCJtZG1oXCI6IFwiTEdFLyovTEctRDg1MC8qXCIgfSxcbiAgICAgIHsgXCJ1YVwiOiBcIkxHLUQ4NTBcIiB9XG4gICAgXSxcbiAgICBcImRwaVwiOiBbIDUzNy45LCA1NDEuOSBdLFxuICAgIFwiYndcIjogMyxcbiAgICBcImFjXCI6IDUwMFxuICB9LFxuXG4gIHtcbiAgICBcInR5cGVcIjogXCJhbmRyb2lkXCIsXG4gICAgXCJydWxlc1wiOiBbXG4gICAgICB7IFwibWRtaFwiOiBcIkxHRS8qL1ZTOTg1IDRHLypcIiB9LFxuICAgICAgeyBcInVhXCI6IFwiVlM5ODUgNEdcIiB9XG4gICAgXSxcbiAgICBcImRwaVwiOiBbIDUzNy45LCA1MzUuNiBdLFxuICAgIFwiYndcIjogMyxcbiAgICBcImFjXCI6IDEwMDBcbiAgfSxcblxuICB7XG4gICAgXCJ0eXBlXCI6IFwiYW5kcm9pZFwiLFxuICAgIFwicnVsZXNcIjogW1xuICAgICAgeyBcIm1kbWhcIjogXCJMR0UvKi9OZXh1cyA1LypcIiB9LFxuICAgICAgeyBcInVhXCI6IFwiTmV4dXMgNSBcIiB9XG4gICAgXSxcbiAgICBcImRwaVwiOiBbIDQ0Mi40LCA0NDQuOCBdLFxuICAgIFwiYndcIjogMyxcbiAgICBcImFjXCI6IDEwMDBcbiAgfSxcblxuICB7XG4gICAgXCJ0eXBlXCI6IFwiYW5kcm9pZFwiLFxuICAgIFwicnVsZXNcIjogW1xuICAgICAgeyBcIm1kbWhcIjogXCJMR0UvKi9OZXh1cyA0LypcIiB9LFxuICAgICAgeyBcInVhXCI6IFwiTmV4dXMgNFwiIH1cbiAgICBdLFxuICAgIFwiZHBpXCI6IFsgMzE5LjgsIDMxOC40IF0sXG4gICAgXCJid1wiOiAzLFxuICAgIFwiYWNcIjogMTAwMFxuICB9LFxuXG4gIHtcbiAgICBcInR5cGVcIjogXCJhbmRyb2lkXCIsXG4gICAgXCJydWxlc1wiOiBbXG4gICAgICB7IFwibWRtaFwiOiBcIkxHRS8qL0xHLVA3NjkvKlwiIH0sXG4gICAgICB7IFwidWFcIjogXCJMRy1QNzY5XCIgfVxuICAgIF0sXG4gICAgXCJkcGlcIjogWyAyNDAuNiwgMjQ3LjUgXSxcbiAgICBcImJ3XCI6IDMsXG4gICAgXCJhY1wiOiAxMDAwXG4gIH0sXG5cbiAge1xuICAgIFwidHlwZVwiOiBcImFuZHJvaWRcIixcbiAgICBcInJ1bGVzXCI6IFtcbiAgICAgIHsgXCJtZG1oXCI6IFwiTEdFLyovTEdNUzMyMy8qXCIgfSxcbiAgICAgIHsgXCJ1YVwiOiBcIkxHTVMzMjNcIiB9XG4gICAgXSxcbiAgICBcImRwaVwiOiBbIDIwNi42LCAyMDQuNiBdLFxuICAgIFwiYndcIjogMyxcbiAgICBcImFjXCI6IDEwMDBcbiAgfSxcblxuICB7XG4gICAgXCJ0eXBlXCI6IFwiYW5kcm9pZFwiLFxuICAgIFwicnVsZXNcIjogW1xuICAgICAgeyBcIm1kbWhcIjogXCJMR0UvKi9MR0xTOTk2LypcIiB9LFxuICAgICAgeyBcInVhXCI6IFwiTEdMUzk5NlwiIH1cbiAgICBdLFxuICAgIFwiZHBpXCI6IFsgNDAzLjQsIDQwMS41IF0sXG4gICAgXCJid1wiOiAzLFxuICAgIFwiYWNcIjogMTAwMFxuICB9LFxuXG4gIHtcbiAgICBcInR5cGVcIjogXCJhbmRyb2lkXCIsXG4gICAgXCJydWxlc1wiOiBbXG4gICAgICB7IFwibWRtaFwiOiBcIk1pY3JvbWF4LyovNDU2ME1NWC8qXCIgfSxcbiAgICAgIHsgXCJ1YVwiOiBcIjQ1NjBNTVhcIiB9XG4gICAgXSxcbiAgICBcImRwaVwiOiBbIDI0MC4wLCAyMTkuNCBdLFxuICAgIFwiYndcIjogMyxcbiAgICBcImFjXCI6IDEwMDBcbiAgfSxcblxuICB7XG4gICAgXCJ0eXBlXCI6IFwiYW5kcm9pZFwiLFxuICAgIFwicnVsZXNcIjogW1xuICAgICAgeyBcIm1kbWhcIjogXCJNaWNyb21heC8qL0EyNTAvKlwiIH0sXG4gICAgICB7IFwidWFcIjogXCJNaWNyb21heCBBMjUwXCIgfVxuICAgIF0sXG4gICAgXCJkcGlcIjogWyA0ODAuMCwgNDQ2LjQgXSxcbiAgICBcImJ3XCI6IDMsXG4gICAgXCJhY1wiOiAxMDAwXG4gIH0sXG5cbiAge1xuICAgIFwidHlwZVwiOiBcImFuZHJvaWRcIixcbiAgICBcInJ1bGVzXCI6IFtcbiAgICAgIHsgXCJtZG1oXCI6IFwiTWljcm9tYXgvKi9NaWNyb21heCBBUTQ1MDEvKlwiIH0sXG4gICAgICB7IFwidWFcIjogXCJNaWNyb21heCBBUTQ1MDFcIiB9XG4gICAgXSxcbiAgICBcImRwaVwiOiAyNDAuMCxcbiAgICBcImJ3XCI6IDMsXG4gICAgXCJhY1wiOiA1MDBcbiAgfSxcblxuICB7XG4gICAgXCJ0eXBlXCI6IFwiYW5kcm9pZFwiLFxuICAgIFwicnVsZXNcIjogW1xuICAgICAgeyBcIm1kbWhcIjogXCJtb3Rvcm9sYS8qL0RST0lEIFJBWlIvKlwiIH0sXG4gICAgICB7IFwidWFcIjogXCJEUk9JRCBSQVpSXCIgfVxuICAgIF0sXG4gICAgXCJkcGlcIjogWyAzNjguMSwgMjU2LjcgXSxcbiAgICBcImJ3XCI6IDMsXG4gICAgXCJhY1wiOiAxMDAwXG4gIH0sXG5cbiAge1xuICAgIFwidHlwZVwiOiBcImFuZHJvaWRcIixcbiAgICBcInJ1bGVzXCI6IFtcbiAgICAgIHsgXCJtZG1oXCI6IFwibW90b3JvbGEvKi9YVDgzMEMvKlwiIH0sXG4gICAgICB7IFwidWFcIjogXCJYVDgzMENcIiB9XG4gICAgXSxcbiAgICBcImRwaVwiOiBbIDI1NC4wLCAyNTUuOSBdLFxuICAgIFwiYndcIjogMyxcbiAgICBcImFjXCI6IDEwMDBcbiAgfSxcblxuICB7XG4gICAgXCJ0eXBlXCI6IFwiYW5kcm9pZFwiLFxuICAgIFwicnVsZXNcIjogW1xuICAgICAgeyBcIm1kbWhcIjogXCJtb3Rvcm9sYS8qL1hUMTAyMS8qXCIgfSxcbiAgICAgIHsgXCJ1YVwiOiBcIlhUMTAyMVwiIH1cbiAgICBdLFxuICAgIFwiZHBpXCI6IFsgMjU0LjAsIDI1Ni43IF0sXG4gICAgXCJid1wiOiAzLFxuICAgIFwiYWNcIjogNTAwXG4gIH0sXG5cbiAge1xuICAgIFwidHlwZVwiOiBcImFuZHJvaWRcIixcbiAgICBcInJ1bGVzXCI6IFtcbiAgICAgIHsgXCJtZG1oXCI6IFwibW90b3JvbGEvKi9YVDEwMjMvKlwiIH0sXG4gICAgICB7IFwidWFcIjogXCJYVDEwMjNcIiB9XG4gICAgXSxcbiAgICBcImRwaVwiOiBbIDI1NC4wLCAyNTYuNyBdLFxuICAgIFwiYndcIjogMyxcbiAgICBcImFjXCI6IDUwMFxuICB9LFxuXG4gIHtcbiAgICBcInR5cGVcIjogXCJhbmRyb2lkXCIsXG4gICAgXCJydWxlc1wiOiBbXG4gICAgICB7IFwibWRtaFwiOiBcIm1vdG9yb2xhLyovWFQxMDI4LypcIiB9LFxuICAgICAgeyBcInVhXCI6IFwiWFQxMDI4XCIgfVxuICAgIF0sXG4gICAgXCJkcGlcIjogWyAzMjYuNiwgMzI3LjYgXSxcbiAgICBcImJ3XCI6IDMsXG4gICAgXCJhY1wiOiAxMDAwXG4gIH0sXG5cbiAge1xuICAgIFwidHlwZVwiOiBcImFuZHJvaWRcIixcbiAgICBcInJ1bGVzXCI6IFtcbiAgICAgIHsgXCJtZG1oXCI6IFwibW90b3JvbGEvKi9YVDEwMzQvKlwiIH0sXG4gICAgICB7IFwidWFcIjogXCJYVDEwMzRcIiB9XG4gICAgXSxcbiAgICBcImRwaVwiOiBbIDMyNi42LCAzMjguNCBdLFxuICAgIFwiYndcIjogMyxcbiAgICBcImFjXCI6IDUwMFxuICB9LFxuXG4gIHtcbiAgICBcInR5cGVcIjogXCJhbmRyb2lkXCIsXG4gICAgXCJydWxlc1wiOiBbXG4gICAgICB7IFwibWRtaFwiOiBcIm1vdG9yb2xhLyovWFQxMDUzLypcIiB9LFxuICAgICAgeyBcInVhXCI6IFwiWFQxMDUzXCIgfVxuICAgIF0sXG4gICAgXCJkcGlcIjogWyAzMTUuMywgMzE2LjEgXSxcbiAgICBcImJ3XCI6IDMsXG4gICAgXCJhY1wiOiAxMDAwXG4gIH0sXG5cbiAge1xuICAgIFwidHlwZVwiOiBcImFuZHJvaWRcIixcbiAgICBcInJ1bGVzXCI6IFtcbiAgICAgIHsgXCJtZG1oXCI6IFwibW90b3JvbGEvKi9YVDE1NjIvKlwiIH0sXG4gICAgICB7IFwidWFcIjogXCJYVDE1NjJcIiB9XG4gICAgXSxcbiAgICBcImRwaVwiOiBbIDQwMy40LCA0MDIuNyBdLFxuICAgIFwiYndcIjogMyxcbiAgICBcImFjXCI6IDEwMDBcbiAgfSxcblxuICB7XG4gICAgXCJ0eXBlXCI6IFwiYW5kcm9pZFwiLFxuICAgIFwicnVsZXNcIjogW1xuICAgICAgeyBcIm1kbWhcIjogXCJtb3Rvcm9sYS8qL05leHVzIDYvKlwiIH0sXG4gICAgICB7IFwidWFcIjogXCJOZXh1cyA2IFwiIH1cbiAgICBdLFxuICAgIFwiZHBpXCI6IFsgNDk0LjMsIDQ4OS43IF0sXG4gICAgXCJid1wiOiAzLFxuICAgIFwiYWNcIjogMTAwMFxuICB9LFxuXG4gIHtcbiAgICBcInR5cGVcIjogXCJhbmRyb2lkXCIsXG4gICAgXCJydWxlc1wiOiBbXG4gICAgICB7IFwibWRtaFwiOiBcIm1vdG9yb2xhLyovWFQxMDYzLypcIiB9LFxuICAgICAgeyBcInVhXCI6IFwiWFQxMDYzXCIgfVxuICAgIF0sXG4gICAgXCJkcGlcIjogWyAyOTUuMCwgMjk2LjYgXSxcbiAgICBcImJ3XCI6IDMsXG4gICAgXCJhY1wiOiAxMDAwXG4gIH0sXG5cbiAge1xuICAgIFwidHlwZVwiOiBcImFuZHJvaWRcIixcbiAgICBcInJ1bGVzXCI6IFtcbiAgICAgIHsgXCJtZG1oXCI6IFwibW90b3JvbGEvKi9YVDEwNjQvKlwiIH0sXG4gICAgICB7IFwidWFcIjogXCJYVDEwNjRcIiB9XG4gICAgXSxcbiAgICBcImRwaVwiOiBbIDI5NS4wLCAyOTUuNiBdLFxuICAgIFwiYndcIjogMyxcbiAgICBcImFjXCI6IDUwMFxuICB9LFxuXG4gIHtcbiAgICBcInR5cGVcIjogXCJhbmRyb2lkXCIsXG4gICAgXCJydWxlc1wiOiBbXG4gICAgICB7IFwibWRtaFwiOiBcIm1vdG9yb2xhLyovWFQxMDkyLypcIiB9LFxuICAgICAgeyBcInVhXCI6IFwiWFQxMDkyXCIgfVxuICAgIF0sXG4gICAgXCJkcGlcIjogWyA0MjIuMCwgNDI0LjEgXSxcbiAgICBcImJ3XCI6IDMsXG4gICAgXCJhY1wiOiA1MDBcbiAgfSxcblxuICB7XG4gICAgXCJ0eXBlXCI6IFwiYW5kcm9pZFwiLFxuICAgIFwicnVsZXNcIjogW1xuICAgICAgeyBcIm1kbWhcIjogXCJtb3Rvcm9sYS8qL1hUMTA5NS8qXCIgfSxcbiAgICAgIHsgXCJ1YVwiOiBcIlhUMTA5NVwiIH1cbiAgICBdLFxuICAgIFwiZHBpXCI6IFsgNDIyLjAsIDQyMy40IF0sXG4gICAgXCJid1wiOiAzLFxuICAgIFwiYWNcIjogMTAwMFxuICB9LFxuXG4gIHtcbiAgICBcInR5cGVcIjogXCJhbmRyb2lkXCIsXG4gICAgXCJydWxlc1wiOiBbXG4gICAgICB7IFwibWRtaFwiOiBcIk9uZVBsdXMvKi9BMDAwMS8qXCIgfSxcbiAgICAgIHsgXCJ1YVwiOiBcIkEwMDAxXCIgfVxuICAgIF0sXG4gICAgXCJkcGlcIjogWyA0MDMuNCwgNDAxLjAgXSxcbiAgICBcImJ3XCI6IDMsXG4gICAgXCJhY1wiOiAxMDAwXG4gIH0sXG5cbiAge1xuICAgIFwidHlwZVwiOiBcImFuZHJvaWRcIixcbiAgICBcInJ1bGVzXCI6IFtcbiAgICAgIHsgXCJtZG1oXCI6IFwiT25lUGx1cy8qL09ORSBFMTAwNS8qXCIgfSxcbiAgICAgIHsgXCJ1YVwiOiBcIk9ORSBFMTAwNVwiIH1cbiAgICBdLFxuICAgIFwiZHBpXCI6IFsgNDQyLjQsIDQ0MS40IF0sXG4gICAgXCJid1wiOiAzLFxuICAgIFwiYWNcIjogMTAwMFxuICB9LFxuXG4gIHtcbiAgICBcInR5cGVcIjogXCJhbmRyb2lkXCIsXG4gICAgXCJydWxlc1wiOiBbXG4gICAgICB7IFwibWRtaFwiOiBcIk9uZVBsdXMvKi9PTkUgQTIwMDUvKlwiIH0sXG4gICAgICB7IFwidWFcIjogXCJPTkUgQTIwMDVcIiB9XG4gICAgXSxcbiAgICBcImRwaVwiOiBbIDM5MS45LCA0MDUuNCBdLFxuICAgIFwiYndcIjogMyxcbiAgICBcImFjXCI6IDEwMDBcbiAgfSxcblxuICB7XG4gICAgXCJ0eXBlXCI6IFwiYW5kcm9pZFwiLFxuICAgIFwicnVsZXNcIjogW1xuICAgICAgeyBcIm1kbWhcIjogXCJPUFBPLyovWDkwOS8qXCIgfSxcbiAgICAgIHsgXCJ1YVwiOiBcIlg5MDlcIiB9XG4gICAgXSxcbiAgICBcImRwaVwiOiBbIDQ0Mi40LCA0NDQuMSBdLFxuICAgIFwiYndcIjogMyxcbiAgICBcImFjXCI6IDEwMDBcbiAgfSxcblxuICB7XG4gICAgXCJ0eXBlXCI6IFwiYW5kcm9pZFwiLFxuICAgIFwicnVsZXNcIjogW1xuICAgICAgeyBcIm1kbWhcIjogXCJzYW1zdW5nLyovR1QtSTkwODIvKlwiIH0sXG4gICAgICB7IFwidWFcIjogXCJHVC1JOTA4MlwiIH1cbiAgICBdLFxuICAgIFwiZHBpXCI6IFsgMTg0LjcsIDE4NS40IF0sXG4gICAgXCJid1wiOiAzLFxuICAgIFwiYWNcIjogMTAwMFxuICB9LFxuXG4gIHtcbiAgICBcInR5cGVcIjogXCJhbmRyb2lkXCIsXG4gICAgXCJydWxlc1wiOiBbXG4gICAgICB7IFwibWRtaFwiOiBcInNhbXN1bmcvKi9TTS1HMzYwUC8qXCIgfSxcbiAgICAgIHsgXCJ1YVwiOiBcIlNNLUczNjBQXCIgfVxuICAgIF0sXG4gICAgXCJkcGlcIjogWyAxOTYuNywgMjA1LjQgXSxcbiAgICBcImJ3XCI6IDMsXG4gICAgXCJhY1wiOiAxMDAwXG4gIH0sXG5cbiAge1xuICAgIFwidHlwZVwiOiBcImFuZHJvaWRcIixcbiAgICBcInJ1bGVzXCI6IFtcbiAgICAgIHsgXCJtZG1oXCI6IFwic2Ftc3VuZy8qL05leHVzIFMvKlwiIH0sXG4gICAgICB7IFwidWFcIjogXCJOZXh1cyBTXCIgfVxuICAgIF0sXG4gICAgXCJkcGlcIjogWyAyMzQuNSwgMjI5LjggXSxcbiAgICBcImJ3XCI6IDMsXG4gICAgXCJhY1wiOiAxMDAwXG4gIH0sXG5cbiAge1xuICAgIFwidHlwZVwiOiBcImFuZHJvaWRcIixcbiAgICBcInJ1bGVzXCI6IFtcbiAgICAgIHsgXCJtZG1oXCI6IFwic2Ftc3VuZy8qL0dULUk5MzAwLypcIiB9LFxuICAgICAgeyBcInVhXCI6IFwiR1QtSTkzMDBcIiB9XG4gICAgXSxcbiAgICBcImRwaVwiOiBbIDMwNC44LCAzMDMuOSBdLFxuICAgIFwiYndcIjogNSxcbiAgICBcImFjXCI6IDUwMFxuICB9LFxuXG4gIHtcbiAgICBcInR5cGVcIjogXCJhbmRyb2lkXCIsXG4gICAgXCJydWxlc1wiOiBbXG4gICAgICB7IFwibWRtaFwiOiBcInNhbXN1bmcvKi9TTS1UMjMwTlUvKlwiIH0sXG4gICAgICB7IFwidWFcIjogXCJTTS1UMjMwTlVcIiB9XG4gICAgXSxcbiAgICBcImRwaVwiOiAyMTYuMCxcbiAgICBcImJ3XCI6IDMsXG4gICAgXCJhY1wiOiA1MDBcbiAgfSxcblxuICB7XG4gICAgXCJ0eXBlXCI6IFwiYW5kcm9pZFwiLFxuICAgIFwicnVsZXNcIjogW1xuICAgICAgeyBcIm1kbWhcIjogXCJzYW1zdW5nLyovU0dILVQzOTkvKlwiIH0sXG4gICAgICB7IFwidWFcIjogXCJTR0gtVDM5OVwiIH1cbiAgICBdLFxuICAgIFwiZHBpXCI6IFsgMjE3LjcsIDIzMS40IF0sXG4gICAgXCJid1wiOiAzLFxuICAgIFwiYWNcIjogMTAwMFxuICB9LFxuXG4gIHtcbiAgICBcInR5cGVcIjogXCJhbmRyb2lkXCIsXG4gICAgXCJydWxlc1wiOiBbXG4gICAgICB7IFwibWRtaFwiOiBcInNhbXN1bmcvKi9TTS1OOTAwNS8qXCIgfSxcbiAgICAgIHsgXCJ1YVwiOiBcIlNNLU45MDA1XCIgfVxuICAgIF0sXG4gICAgXCJkcGlcIjogWyAzODYuNCwgMzg3LjAgXSxcbiAgICBcImJ3XCI6IDMsXG4gICAgXCJhY1wiOiA1MDBcbiAgfSxcblxuICB7XG4gICAgXCJ0eXBlXCI6IFwiYW5kcm9pZFwiLFxuICAgIFwicnVsZXNcIjogW1xuICAgICAgeyBcIm1kbWhcIjogXCJzYW1zdW5nLyovU0FNU1VORy1TTS1OOTAwQS8qXCIgfSxcbiAgICAgIHsgXCJ1YVwiOiBcIlNBTVNVTkctU00tTjkwMEFcIiB9XG4gICAgXSxcbiAgICBcImRwaVwiOiBbIDM4Ni40LCAzODcuNyBdLFxuICAgIFwiYndcIjogMyxcbiAgICBcImFjXCI6IDEwMDBcbiAgfSxcblxuICB7XG4gICAgXCJ0eXBlXCI6IFwiYW5kcm9pZFwiLFxuICAgIFwicnVsZXNcIjogW1xuICAgICAgeyBcIm1kbWhcIjogXCJzYW1zdW5nLyovR1QtSTk1MDAvKlwiIH0sXG4gICAgICB7IFwidWFcIjogXCJHVC1JOTUwMFwiIH1cbiAgICBdLFxuICAgIFwiZHBpXCI6IFsgNDQyLjUsIDQ0My4zIF0sXG4gICAgXCJid1wiOiAzLFxuICAgIFwiYWNcIjogNTAwXG4gIH0sXG5cbiAge1xuICAgIFwidHlwZVwiOiBcImFuZHJvaWRcIixcbiAgICBcInJ1bGVzXCI6IFtcbiAgICAgIHsgXCJtZG1oXCI6IFwic2Ftc3VuZy8qL0dULUk5NTA1LypcIiB9LFxuICAgICAgeyBcInVhXCI6IFwiR1QtSTk1MDVcIiB9XG4gICAgXSxcbiAgICBcImRwaVwiOiA0MzkuNCxcbiAgICBcImJ3XCI6IDQsXG4gICAgXCJhY1wiOiAxMDAwXG4gIH0sXG5cbiAge1xuICAgIFwidHlwZVwiOiBcImFuZHJvaWRcIixcbiAgICBcInJ1bGVzXCI6IFtcbiAgICAgIHsgXCJtZG1oXCI6IFwic2Ftc3VuZy8qL1NNLUc5MDBGLypcIiB9LFxuICAgICAgeyBcInVhXCI6IFwiU00tRzkwMEZcIiB9XG4gICAgXSxcbiAgICBcImRwaVwiOiBbIDQxNS42LCA0MzEuNiBdLFxuICAgIFwiYndcIjogNSxcbiAgICBcImFjXCI6IDEwMDBcbiAgfSxcblxuICB7XG4gICAgXCJ0eXBlXCI6IFwiYW5kcm9pZFwiLFxuICAgIFwicnVsZXNcIjogW1xuICAgICAgeyBcIm1kbWhcIjogXCJzYW1zdW5nLyovU00tRzkwME0vKlwiIH0sXG4gICAgICB7IFwidWFcIjogXCJTTS1HOTAwTVwiIH1cbiAgICBdLFxuICAgIFwiZHBpXCI6IFsgNDE1LjYsIDQzMS42IF0sXG4gICAgXCJid1wiOiA1LFxuICAgIFwiYWNcIjogMTAwMFxuICB9LFxuXG4gIHtcbiAgICBcInR5cGVcIjogXCJhbmRyb2lkXCIsXG4gICAgXCJydWxlc1wiOiBbXG4gICAgICB7IFwibWRtaFwiOiBcInNhbXN1bmcvKi9TTS1HODAwRi8qXCIgfSxcbiAgICAgIHsgXCJ1YVwiOiBcIlNNLUc4MDBGXCIgfVxuICAgIF0sXG4gICAgXCJkcGlcIjogMzI2LjgsXG4gICAgXCJid1wiOiAzLFxuICAgIFwiYWNcIjogMTAwMFxuICB9LFxuXG4gIHtcbiAgICBcInR5cGVcIjogXCJhbmRyb2lkXCIsXG4gICAgXCJydWxlc1wiOiBbXG4gICAgICB7IFwibWRtaFwiOiBcInNhbXN1bmcvKi9TTS1HOTA2Uy8qXCIgfSxcbiAgICAgIHsgXCJ1YVwiOiBcIlNNLUc5MDZTXCIgfVxuICAgIF0sXG4gICAgXCJkcGlcIjogWyA1NjIuNywgNTcyLjQgXSxcbiAgICBcImJ3XCI6IDMsXG4gICAgXCJhY1wiOiAxMDAwXG4gIH0sXG5cbiAge1xuICAgIFwidHlwZVwiOiBcImFuZHJvaWRcIixcbiAgICBcInJ1bGVzXCI6IFtcbiAgICAgIHsgXCJtZG1oXCI6IFwic2Ftc3VuZy8qL0dULUk5MzAwLypcIiB9LFxuICAgICAgeyBcInVhXCI6IFwiR1QtSTkzMDBcIiB9XG4gICAgXSxcbiAgICBcImRwaVwiOiBbIDMwNi43LCAzMDQuOCBdLFxuICAgIFwiYndcIjogNSxcbiAgICBcImFjXCI6IDEwMDBcbiAgfSxcblxuICB7XG4gICAgXCJ0eXBlXCI6IFwiYW5kcm9pZFwiLFxuICAgIFwicnVsZXNcIjogW1xuICAgICAgeyBcIm1kbWhcIjogXCJzYW1zdW5nLyovU00tVDUzNS8qXCIgfSxcbiAgICAgIHsgXCJ1YVwiOiBcIlNNLVQ1MzVcIiB9XG4gICAgXSxcbiAgICBcImRwaVwiOiBbIDE0Mi42LCAxMzYuNCBdLFxuICAgIFwiYndcIjogMyxcbiAgICBcImFjXCI6IDUwMFxuICB9LFxuXG4gIHtcbiAgICBcInR5cGVcIjogXCJhbmRyb2lkXCIsXG4gICAgXCJydWxlc1wiOiBbXG4gICAgICB7IFwibWRtaFwiOiBcInNhbXN1bmcvKi9TTS1OOTIwQy8qXCIgfSxcbiAgICAgIHsgXCJ1YVwiOiBcIlNNLU45MjBDXCIgfVxuICAgIF0sXG4gICAgXCJkcGlcIjogWyA1MTUuMSwgNTE4LjQgXSxcbiAgICBcImJ3XCI6IDMsXG4gICAgXCJhY1wiOiAxMDAwXG4gIH0sXG5cbiAge1xuICAgIFwidHlwZVwiOiBcImFuZHJvaWRcIixcbiAgICBcInJ1bGVzXCI6IFtcbiAgICAgIHsgXCJtZG1oXCI6IFwic2Ftc3VuZy8qL0dULUk5MzAwSS8qXCIgfSxcbiAgICAgIHsgXCJ1YVwiOiBcIkdULUk5MzAwSVwiIH1cbiAgICBdLFxuICAgIFwiZHBpXCI6IFsgMzA0LjgsIDMwNS44IF0sXG4gICAgXCJid1wiOiAzLFxuICAgIFwiYWNcIjogMTAwMFxuICB9LFxuXG4gIHtcbiAgICBcInR5cGVcIjogXCJhbmRyb2lkXCIsXG4gICAgXCJydWxlc1wiOiBbXG4gICAgICB7IFwibWRtaFwiOiBcInNhbXN1bmcvKi9HVC1JOTE5NS8qXCIgfSxcbiAgICAgIHsgXCJ1YVwiOiBcIkdULUk5MTk1XCIgfVxuICAgIF0sXG4gICAgXCJkcGlcIjogWyAyNDkuNCwgMjU2LjcgXSxcbiAgICBcImJ3XCI6IDMsXG4gICAgXCJhY1wiOiA1MDBcbiAgfSxcblxuICB7XG4gICAgXCJ0eXBlXCI6IFwiYW5kcm9pZFwiLFxuICAgIFwicnVsZXNcIjogW1xuICAgICAgeyBcIm1kbWhcIjogXCJzYW1zdW5nLyovU1BILUw1MjAvKlwiIH0sXG4gICAgICB7IFwidWFcIjogXCJTUEgtTDUyMFwiIH1cbiAgICBdLFxuICAgIFwiZHBpXCI6IFsgMjQ5LjQsIDI1NS45IF0sXG4gICAgXCJid1wiOiAzLFxuICAgIFwiYWNcIjogMTAwMFxuICB9LFxuXG4gIHtcbiAgICBcInR5cGVcIjogXCJhbmRyb2lkXCIsXG4gICAgXCJydWxlc1wiOiBbXG4gICAgICB7IFwibWRtaFwiOiBcInNhbXN1bmcvKi9TQU1TVU5HLVNHSC1JNzE3LypcIiB9LFxuICAgICAgeyBcInVhXCI6IFwiU0FNU1VORy1TR0gtSTcxN1wiIH1cbiAgICBdLFxuICAgIFwiZHBpXCI6IDI4NS44LFxuICAgIFwiYndcIjogMyxcbiAgICBcImFjXCI6IDEwMDBcbiAgfSxcblxuICB7XG4gICAgXCJ0eXBlXCI6IFwiYW5kcm9pZFwiLFxuICAgIFwicnVsZXNcIjogW1xuICAgICAgeyBcIm1kbWhcIjogXCJzYW1zdW5nLyovU1BILUQ3MTAvKlwiIH0sXG4gICAgICB7IFwidWFcIjogXCJTUEgtRDcxMFwiIH1cbiAgICBdLFxuICAgIFwiZHBpXCI6IFsgMjE3LjcsIDIwNC4yIF0sXG4gICAgXCJid1wiOiAzLFxuICAgIFwiYWNcIjogMTAwMFxuICB9LFxuXG4gIHtcbiAgICBcInR5cGVcIjogXCJhbmRyb2lkXCIsXG4gICAgXCJydWxlc1wiOiBbXG4gICAgICB7IFwibWRtaFwiOiBcInNhbXN1bmcvKi9HVC1ONzEwMC8qXCIgfSxcbiAgICAgIHsgXCJ1YVwiOiBcIkdULU43MTAwXCIgfVxuICAgIF0sXG4gICAgXCJkcGlcIjogMjY1LjEsXG4gICAgXCJid1wiOiAzLFxuICAgIFwiYWNcIjogMTAwMFxuICB9LFxuXG4gIHtcbiAgICBcInR5cGVcIjogXCJhbmRyb2lkXCIsXG4gICAgXCJydWxlc1wiOiBbXG4gICAgICB7IFwibWRtaFwiOiBcInNhbXN1bmcvKi9TQ0gtSTYwNS8qXCIgfSxcbiAgICAgIHsgXCJ1YVwiOiBcIlNDSC1JNjA1XCIgfVxuICAgIF0sXG4gICAgXCJkcGlcIjogMjY1LjEsXG4gICAgXCJid1wiOiAzLFxuICAgIFwiYWNcIjogMTAwMFxuICB9LFxuXG4gIHtcbiAgICBcInR5cGVcIjogXCJhbmRyb2lkXCIsXG4gICAgXCJydWxlc1wiOiBbXG4gICAgICB7IFwibWRtaFwiOiBcInNhbXN1bmcvKi9HYWxheHkgTmV4dXMvKlwiIH0sXG4gICAgICB7IFwidWFcIjogXCJHYWxheHkgTmV4dXNcIiB9XG4gICAgXSxcbiAgICBcImRwaVwiOiBbIDMxNS4zLCAzMTQuMiBdLFxuICAgIFwiYndcIjogMyxcbiAgICBcImFjXCI6IDEwMDBcbiAgfSxcblxuICB7XG4gICAgXCJ0eXBlXCI6IFwiYW5kcm9pZFwiLFxuICAgIFwicnVsZXNcIjogW1xuICAgICAgeyBcIm1kbWhcIjogXCJzYW1zdW5nLyovU00tTjkxMEgvKlwiIH0sXG4gICAgICB7IFwidWFcIjogXCJTTS1OOTEwSFwiIH1cbiAgICBdLFxuICAgIFwiZHBpXCI6IFsgNTE1LjEsIDUxOC4wIF0sXG4gICAgXCJid1wiOiAzLFxuICAgIFwiYWNcIjogMTAwMFxuICB9LFxuXG4gIHtcbiAgICBcInR5cGVcIjogXCJhbmRyb2lkXCIsXG4gICAgXCJydWxlc1wiOiBbXG4gICAgICB7IFwibWRtaFwiOiBcInNhbXN1bmcvKi9TTS1OOTEwQy8qXCIgfSxcbiAgICAgIHsgXCJ1YVwiOiBcIlNNLU45MTBDXCIgfVxuICAgIF0sXG4gICAgXCJkcGlcIjogWyA1MTUuMiwgNTIwLjIgXSxcbiAgICBcImJ3XCI6IDMsXG4gICAgXCJhY1wiOiA1MDBcbiAgfSxcblxuICB7XG4gICAgXCJ0eXBlXCI6IFwiYW5kcm9pZFwiLFxuICAgIFwicnVsZXNcIjogW1xuICAgICAgeyBcIm1kbWhcIjogXCJzYW1zdW5nLyovU00tRzEzME0vKlwiIH0sXG4gICAgICB7IFwidWFcIjogXCJTTS1HMTMwTVwiIH1cbiAgICBdLFxuICAgIFwiZHBpXCI6IFsgMTY1LjksIDE2NC44IF0sXG4gICAgXCJid1wiOiAzLFxuICAgIFwiYWNcIjogNTAwXG4gIH0sXG5cbiAge1xuICAgIFwidHlwZVwiOiBcImFuZHJvaWRcIixcbiAgICBcInJ1bGVzXCI6IFtcbiAgICAgIHsgXCJtZG1oXCI6IFwic2Ftc3VuZy8qL1NNLUc5MjhJLypcIiB9LFxuICAgICAgeyBcInVhXCI6IFwiU00tRzkyOElcIiB9XG4gICAgXSxcbiAgICBcImRwaVwiOiBbIDUxNS4xLCA1MTguNCBdLFxuICAgIFwiYndcIjogMyxcbiAgICBcImFjXCI6IDEwMDBcbiAgfSxcblxuICB7XG4gICAgXCJ0eXBlXCI6IFwiYW5kcm9pZFwiLFxuICAgIFwicnVsZXNcIjogW1xuICAgICAgeyBcIm1kbWhcIjogXCJzYW1zdW5nLyovU00tRzkyMEYvKlwiIH0sXG4gICAgICB7IFwidWFcIjogXCJTTS1HOTIwRlwiIH1cbiAgICBdLFxuICAgIFwiZHBpXCI6IDU4MC42LFxuICAgIFwiYndcIjogMyxcbiAgICBcImFjXCI6IDUwMFxuICB9LFxuXG4gIHtcbiAgICBcInR5cGVcIjogXCJhbmRyb2lkXCIsXG4gICAgXCJydWxlc1wiOiBbXG4gICAgICB7IFwibWRtaFwiOiBcInNhbXN1bmcvKi9TTS1HOTIwUC8qXCIgfSxcbiAgICAgIHsgXCJ1YVwiOiBcIlNNLUc5MjBQXCIgfVxuICAgIF0sXG4gICAgXCJkcGlcIjogWyA1MjIuNSwgNTc3LjAgXSxcbiAgICBcImJ3XCI6IDMsXG4gICAgXCJhY1wiOiAxMDAwXG4gIH0sXG5cbiAge1xuICAgIFwidHlwZVwiOiBcImFuZHJvaWRcIixcbiAgICBcInJ1bGVzXCI6IFtcbiAgICAgIHsgXCJtZG1oXCI6IFwic2Ftc3VuZy8qL1NNLUc5MjVGLypcIiB9LFxuICAgICAgeyBcInVhXCI6IFwiU00tRzkyNUZcIiB9XG4gICAgXSxcbiAgICBcImRwaVwiOiA1ODAuNixcbiAgICBcImJ3XCI6IDMsXG4gICAgXCJhY1wiOiA1MDBcbiAgfSxcblxuICB7XG4gICAgXCJ0eXBlXCI6IFwiYW5kcm9pZFwiLFxuICAgIFwicnVsZXNcIjogW1xuICAgICAgeyBcIm1kbWhcIjogXCJzYW1zdW5nLyovU00tRzkyNVYvKlwiIH0sXG4gICAgICB7IFwidWFcIjogXCJTTS1HOTI1VlwiIH1cbiAgICBdLFxuICAgIFwiZHBpXCI6IFsgNTIyLjUsIDU3Ni42IF0sXG4gICAgXCJid1wiOiAzLFxuICAgIFwiYWNcIjogMTAwMFxuICB9LFxuXG4gIHtcbiAgICBcInR5cGVcIjogXCJhbmRyb2lkXCIsXG4gICAgXCJydWxlc1wiOiBbXG4gICAgICB7IFwibWRtaFwiOiBcIlNvbnkvKi9DNjkwMy8qXCIgfSxcbiAgICAgIHsgXCJ1YVwiOiBcIkM2OTAzXCIgfVxuICAgIF0sXG4gICAgXCJkcGlcIjogWyA0NDIuNSwgNDQzLjMgXSxcbiAgICBcImJ3XCI6IDMsXG4gICAgXCJhY1wiOiA1MDBcbiAgfSxcblxuICB7XG4gICAgXCJ0eXBlXCI6IFwiYW5kcm9pZFwiLFxuICAgIFwicnVsZXNcIjogW1xuICAgICAgeyBcIm1kbWhcIjogXCJTb255LyovRDY2NTMvKlwiIH0sXG4gICAgICB7IFwidWFcIjogXCJENjY1M1wiIH1cbiAgICBdLFxuICAgIFwiZHBpXCI6IFsgNDI4LjYsIDQyNy42IF0sXG4gICAgXCJid1wiOiAzLFxuICAgIFwiYWNcIjogMTAwMFxuICB9LFxuXG4gIHtcbiAgICBcInR5cGVcIjogXCJhbmRyb2lkXCIsXG4gICAgXCJydWxlc1wiOiBbXG4gICAgICB7IFwibWRtaFwiOiBcIlNvbnkvKi9FNjY1My8qXCIgfSxcbiAgICAgIHsgXCJ1YVwiOiBcIkU2NjUzXCIgfVxuICAgIF0sXG4gICAgXCJkcGlcIjogWyA0MjguNiwgNDI1LjcgXSxcbiAgICBcImJ3XCI6IDMsXG4gICAgXCJhY1wiOiAxMDAwXG4gIH0sXG5cbiAge1xuICAgIFwidHlwZVwiOiBcImFuZHJvaWRcIixcbiAgICBcInJ1bGVzXCI6IFtcbiAgICAgIHsgXCJtZG1oXCI6IFwiU29ueS8qL0U2ODUzLypcIiB9LFxuICAgICAgeyBcInVhXCI6IFwiRTY4NTNcIiB9XG4gICAgXSxcbiAgICBcImRwaVwiOiBbIDQwMy40LCA0MDEuOSBdLFxuICAgIFwiYndcIjogMyxcbiAgICBcImFjXCI6IDEwMDBcbiAgfSxcblxuICB7XG4gICAgXCJ0eXBlXCI6IFwiYW5kcm9pZFwiLFxuICAgIFwicnVsZXNcIjogW1xuICAgICAgeyBcIm1kbWhcIjogXCJTb255LyovU0dQMzIxLypcIiB9LFxuICAgICAgeyBcInVhXCI6IFwiU0dQMzIxXCIgfVxuICAgIF0sXG4gICAgXCJkcGlcIjogWyAyMjQuNywgMjI0LjEgXSxcbiAgICBcImJ3XCI6IDMsXG4gICAgXCJhY1wiOiA1MDBcbiAgfSxcblxuICB7XG4gICAgXCJ0eXBlXCI6IFwiYW5kcm9pZFwiLFxuICAgIFwicnVsZXNcIjogW1xuICAgICAgeyBcIm1kbWhcIjogXCJUQ1QvKi9BTENBVEVMIE9ORSBUT1VDSCBGaWVyY2UvKlwiIH0sXG4gICAgICB7IFwidWFcIjogXCJBTENBVEVMIE9ORSBUT1VDSCBGaWVyY2VcIiB9XG4gICAgXSxcbiAgICBcImRwaVwiOiBbIDI0MC4wLCAyNDcuNSBdLFxuICAgIFwiYndcIjogMyxcbiAgICBcImFjXCI6IDEwMDBcbiAgfSxcblxuICB7XG4gICAgXCJ0eXBlXCI6IFwiYW5kcm9pZFwiLFxuICAgIFwicnVsZXNcIjogW1xuICAgICAgeyBcIm1kbWhcIjogXCJUSEwvKi90aGwgNTAwMC8qXCIgfSxcbiAgICAgIHsgXCJ1YVwiOiBcInRobCA1MDAwXCIgfVxuICAgIF0sXG4gICAgXCJkcGlcIjogWyA0ODAuMCwgNDQzLjMgXSxcbiAgICBcImJ3XCI6IDMsXG4gICAgXCJhY1wiOiAxMDAwXG4gIH0sXG5cbiAge1xuICAgIFwidHlwZVwiOiBcImFuZHJvaWRcIixcbiAgICBcInJ1bGVzXCI6IFtcbiAgICAgIHsgXCJtZG1oXCI6IFwiWlRFLyovWlRFIEJsYWRlIEwyLypcIiB9LFxuICAgICAgeyBcInVhXCI6IFwiWlRFIEJsYWRlIEwyXCIgfVxuICAgIF0sXG4gICAgXCJkcGlcIjogMjQwLjAsXG4gICAgXCJid1wiOiAzLFxuICAgIFwiYWNcIjogNTAwXG4gIH0sXG5cbiAge1xuICAgIFwidHlwZVwiOiBcImlvc1wiLFxuICAgIFwicnVsZXNcIjogWyB7IFwicmVzXCI6IFsgNjQwLCA5NjAgXSB9IF0sXG4gICAgXCJkcGlcIjogWyAzMjUuMSwgMzI4LjQgXSxcbiAgICBcImJ3XCI6IDQsXG4gICAgXCJhY1wiOiAxMDAwXG4gIH0sXG5cbiAge1xuICAgIFwidHlwZVwiOiBcImlvc1wiLFxuICAgIFwicnVsZXNcIjogWyB7IFwicmVzXCI6IFsgNjQwLCA5NjAgXSB9IF0sXG4gICAgXCJkcGlcIjogWyAzMjUuMSwgMzI4LjQgXSxcbiAgICBcImJ3XCI6IDQsXG4gICAgXCJhY1wiOiAxMDAwXG4gIH0sXG5cbiAge1xuICAgIFwidHlwZVwiOiBcImlvc1wiLFxuICAgIFwicnVsZXNcIjogWyB7IFwicmVzXCI6IFsgNjQwLCAxMTM2IF0gfSBdLFxuICAgIFwiZHBpXCI6IFsgMzE3LjEsIDMyMC4yIF0sXG4gICAgXCJid1wiOiAzLFxuICAgIFwiYWNcIjogMTAwMFxuICB9LFxuXG4gIHtcbiAgICBcInR5cGVcIjogXCJpb3NcIixcbiAgICBcInJ1bGVzXCI6IFsgeyBcInJlc1wiOiBbIDY0MCwgMTEzNiBdIH0gXSxcbiAgICBcImRwaVwiOiBbIDMxNy4xLCAzMjAuMiBdLFxuICAgIFwiYndcIjogMyxcbiAgICBcImFjXCI6IDEwMDBcbiAgfSxcblxuICB7XG4gICAgXCJ0eXBlXCI6IFwiaW9zXCIsXG4gICAgXCJydWxlc1wiOiBbIHsgXCJyZXNcIjogWyA3NTAsIDEzMzQgXSB9IF0sXG4gICAgXCJkcGlcIjogMzI2LjQsXG4gICAgXCJid1wiOiA0LFxuICAgIFwiYWNcIjogMTAwMFxuICB9LFxuXG4gIHtcbiAgICBcInR5cGVcIjogXCJpb3NcIixcbiAgICBcInJ1bGVzXCI6IFsgeyBcInJlc1wiOiBbIDc1MCwgMTMzNCBdIH0gXSxcbiAgICBcImRwaVwiOiAzMjYuNCxcbiAgICBcImJ3XCI6IDQsXG4gICAgXCJhY1wiOiAxMDAwXG4gIH0sXG5cbiAge1xuICAgIFwidHlwZVwiOiBcImlvc1wiLFxuICAgIFwicnVsZXNcIjogWyB7IFwicmVzXCI6IFsgMTI0MiwgMjIwOCBdIH0gXSxcbiAgICBcImRwaVwiOiBbIDQ1My42LCA0NTguNCBdLFxuICAgIFwiYndcIjogNCxcbiAgICBcImFjXCI6IDEwMDBcbiAgfSxcblxuICB7XG4gICAgXCJ0eXBlXCI6IFwiaW9zXCIsXG4gICAgXCJydWxlc1wiOiBbIHsgXCJyZXNcIjogWyAxMjQyLCAyMjA4IF0gfSBdLFxuICAgIFwiZHBpXCI6IFsgNDUzLjYsIDQ1OC40IF0sXG4gICAgXCJid1wiOiA0LFxuICAgIFwiYWNcIjogMTAwMFxuICB9XG5dfTtcblxubW9kdWxlLmV4cG9ydHMgPSBEUERCX0NBQ0hFO1xuIiwiLypcbiAqIENvcHlyaWdodCAyMDE1IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xuICogeW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuICogWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG4gKlxuICogICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuICpcbiAqIFVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbiAqIGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbiAqIFdJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuICogU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxuICogbGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG4gKi9cblxuLy8gT2ZmbGluZSBjYWNoZSBvZiB0aGUgRFBEQiwgdG8gYmUgdXNlZCB1bnRpbCB3ZSBsb2FkIHRoZSBvbmxpbmUgb25lIChhbmRcbi8vIGFzIGEgZmFsbGJhY2sgaW4gY2FzZSB3ZSBjYW4ndCBsb2FkIHRoZSBvbmxpbmUgb25lKS5cbnZhciBEUERCX0NBQ0hFID0gcmVxdWlyZSgnLi9kcGRiLWNhY2hlLmpzJyk7XG52YXIgVXRpbCA9IHJlcXVpcmUoJy4uL3V0aWwuanMnKTtcblxuLy8gT25saW5lIERQREIgVVJMLlxudmFyIE9OTElORV9EUERCX1VSTCA9ICdodHRwczovL3N0b3JhZ2UuZ29vZ2xlYXBpcy5jb20vY2FyZGJvYXJkLWRwZGIvZHBkYi5qc29uJztcblxuLyoqXG4gKiBDYWxjdWxhdGVzIGRldmljZSBwYXJhbWV0ZXJzIGJhc2VkIG9uIHRoZSBEUERCIChEZXZpY2UgUGFyYW1ldGVyIERhdGFiYXNlKS5cbiAqIEluaXRpYWxseSwgdXNlcyB0aGUgY2FjaGVkIERQREIgdmFsdWVzLlxuICpcbiAqIElmIGZldGNoT25saW5lID09IHRydWUsIHRoZW4gdGhpcyBvYmplY3QgdHJpZXMgdG8gZmV0Y2ggdGhlIG9ubGluZSB2ZXJzaW9uXG4gKiBvZiB0aGUgRFBEQiBhbmQgdXBkYXRlcyB0aGUgZGV2aWNlIGluZm8gaWYgYSBiZXR0ZXIgbWF0Y2ggaXMgZm91bmQuXG4gKiBDYWxscyB0aGUgb25EZXZpY2VQYXJhbXNVcGRhdGVkIGNhbGxiYWNrIHdoZW4gdGhlcmUgaXMgYW4gdXBkYXRlIHRvIHRoZVxuICogZGV2aWNlIGluZm9ybWF0aW9uLlxuICovXG5mdW5jdGlvbiBEcGRiKGZldGNoT25saW5lLCBvbkRldmljZVBhcmFtc1VwZGF0ZWQpIHtcbiAgLy8gU3RhcnQgd2l0aCB0aGUgb2ZmbGluZSBEUERCIGNhY2hlIHdoaWxlIHdlIGFyZSBsb2FkaW5nIHRoZSByZWFsIG9uZS5cbiAgdGhpcy5kcGRiID0gRFBEQl9DQUNIRTtcblxuICAvLyBDYWxjdWxhdGUgZGV2aWNlIHBhcmFtcyBiYXNlZCBvbiB0aGUgb2ZmbGluZSB2ZXJzaW9uIG9mIHRoZSBEUERCLlxuICB0aGlzLnJlY2FsY3VsYXRlRGV2aWNlUGFyYW1zXygpO1xuXG4gIC8vIFhIUiB0byBmZXRjaCBvbmxpbmUgRFBEQiBmaWxlLCBpZiByZXF1ZXN0ZWQuXG4gIGlmIChmZXRjaE9ubGluZSkge1xuICAgIC8vIFNldCB0aGUgY2FsbGJhY2suXG4gICAgdGhpcy5vbkRldmljZVBhcmFtc1VwZGF0ZWQgPSBvbkRldmljZVBhcmFtc1VwZGF0ZWQ7XG5cbiAgICBjb25zb2xlLmxvZygnRmV0Y2hpbmcgRFBEQi4uLicpO1xuICAgIHZhciB4aHIgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgICB2YXIgb2JqID0gdGhpcztcbiAgICB4aHIub3BlbignR0VUJywgT05MSU5FX0RQREJfVVJMLCB0cnVlKTtcbiAgICB4aHIuYWRkRXZlbnRMaXN0ZW5lcignbG9hZCcsIGZ1bmN0aW9uKCkge1xuICAgICAgb2JqLmxvYWRpbmcgPSBmYWxzZTtcbiAgICAgIGlmICh4aHIuc3RhdHVzID49IDIwMCAmJiB4aHIuc3RhdHVzIDw9IDI5OSkge1xuICAgICAgICAvLyBTdWNjZXNzLlxuICAgICAgICBjb25zb2xlLmxvZygnU3VjY2Vzc2Z1bGx5IGxvYWRlZCBvbmxpbmUgRFBEQi4nKTtcbiAgICAgICAgb2JqLmRwZGIgPSBKU09OLnBhcnNlKHhoci5yZXNwb25zZSk7XG4gICAgICAgIG9iai5yZWNhbGN1bGF0ZURldmljZVBhcmFtc18oKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIEVycm9yIGxvYWRpbmcgdGhlIERQREIuXG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIGxvYWRpbmcgb25saW5lIERQREIhJyk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgeGhyLnNlbmQoKTtcbiAgfVxufVxuXG4vLyBSZXR1cm5zIHRoZSBjdXJyZW50IGRldmljZSBwYXJhbWV0ZXJzLlxuRHBkYi5wcm90b3R5cGUuZ2V0RGV2aWNlUGFyYW1zID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiB0aGlzLmRldmljZVBhcmFtcztcbn07XG5cbi8vIFJlY2FsY3VsYXRlcyB0aGlzIGRldmljZSdzIHBhcmFtZXRlcnMgYmFzZWQgb24gdGhlIERQREIuXG5EcGRiLnByb3RvdHlwZS5yZWNhbGN1bGF0ZURldmljZVBhcmFtc18gPSBmdW5jdGlvbigpIHtcbiAgY29uc29sZS5sb2coJ1JlY2FsY3VsYXRpbmcgZGV2aWNlIHBhcmFtcy4nKTtcbiAgdmFyIG5ld0RldmljZVBhcmFtcyA9IHRoaXMuY2FsY0RldmljZVBhcmFtc18oKTtcbiAgY29uc29sZS5sb2coJ05ldyBkZXZpY2UgcGFyYW1ldGVyczonKTtcbiAgY29uc29sZS5sb2cobmV3RGV2aWNlUGFyYW1zKTtcbiAgaWYgKG5ld0RldmljZVBhcmFtcykge1xuICAgIHRoaXMuZGV2aWNlUGFyYW1zID0gbmV3RGV2aWNlUGFyYW1zO1xuICAgIC8vIEludm9rZSBjYWxsYmFjaywgaWYgaXQgaXMgc2V0LlxuICAgIGlmICh0aGlzLm9uRGV2aWNlUGFyYW1zVXBkYXRlZCkge1xuICAgICAgdGhpcy5vbkRldmljZVBhcmFtc1VwZGF0ZWQodGhpcy5kZXZpY2VQYXJhbXMpO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBjb25zb2xlLmVycm9yKCdGYWlsZWQgdG8gcmVjYWxjdWxhdGUgZGV2aWNlIHBhcmFtZXRlcnMuJyk7XG4gIH1cbn07XG5cbi8vIFJldHVybnMgYSBEZXZpY2VQYXJhbXMgb2JqZWN0IHRoYXQgcmVwcmVzZW50cyB0aGUgYmVzdCBndWVzcyBhcyB0byB0aGlzXG4vLyBkZXZpY2UncyBwYXJhbWV0ZXJzLiBDYW4gcmV0dXJuIG51bGwgaWYgdGhlIGRldmljZSBkb2VzIG5vdCBtYXRjaCBhbnlcbi8vIGtub3duIGRldmljZXMuXG5EcGRiLnByb3RvdHlwZS5jYWxjRGV2aWNlUGFyYW1zXyA9IGZ1bmN0aW9uKCkge1xuICB2YXIgZGIgPSB0aGlzLmRwZGI7IC8vIHNob3J0aGFuZFxuICBpZiAoIWRiKSB7XG4gICAgY29uc29sZS5lcnJvcignRFBEQiBub3QgYXZhaWxhYmxlLicpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG4gIGlmIChkYi5mb3JtYXQgIT0gMSkge1xuICAgIGNvbnNvbGUuZXJyb3IoJ0RQREIgaGFzIHVuZXhwZWN0ZWQgZm9ybWF0IHZlcnNpb24uJyk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgaWYgKCFkYi5kZXZpY2VzIHx8ICFkYi5kZXZpY2VzLmxlbmd0aCkge1xuICAgIGNvbnNvbGUuZXJyb3IoJ0RQREIgZG9lcyBub3QgaGF2ZSBhIGRldmljZXMgc2VjdGlvbi4nKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIC8vIEdldCB0aGUgYWN0dWFsIHVzZXIgYWdlbnQgYW5kIHNjcmVlbiBkaW1lbnNpb25zIGluIHBpeGVscy5cbiAgdmFyIHVzZXJBZ2VudCA9IG5hdmlnYXRvci51c2VyQWdlbnQgfHwgbmF2aWdhdG9yLnZlbmRvciB8fCB3aW5kb3cub3BlcmE7XG4gIHZhciB3aWR0aCA9IFV0aWwuZ2V0U2NyZWVuV2lkdGgoKTtcbiAgdmFyIGhlaWdodCA9IFV0aWwuZ2V0U2NyZWVuSGVpZ2h0KCk7XG4gIGNvbnNvbGUubG9nKCdVc2VyIGFnZW50OiAnICsgdXNlckFnZW50KTtcbiAgY29uc29sZS5sb2coJ1BpeGVsIHdpZHRoOiAnICsgd2lkdGgpO1xuICBjb25zb2xlLmxvZygnUGl4ZWwgaGVpZ2h0OiAnICsgaGVpZ2h0KTtcblxuICBpZiAoIWRiLmRldmljZXMpIHtcbiAgICBjb25zb2xlLmVycm9yKCdEUERCIGhhcyBubyBkZXZpY2VzIHNlY3Rpb24uJyk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBmb3IgKHZhciBpID0gMDsgaSA8IGRiLmRldmljZXMubGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgZGV2aWNlID0gZGIuZGV2aWNlc1tpXTtcbiAgICBpZiAoIWRldmljZS5ydWxlcykge1xuICAgICAgY29uc29sZS53YXJuKCdEZXZpY2VbJyArIGkgKyAnXSBoYXMgbm8gcnVsZXMgc2VjdGlvbi4nKTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGlmIChkZXZpY2UudHlwZSAhPSAnaW9zJyAmJiBkZXZpY2UudHlwZSAhPSAnYW5kcm9pZCcpIHtcbiAgICAgIGNvbnNvbGUud2FybignRGV2aWNlWycgKyBpICsgJ10gaGFzIGludmFsaWQgdHlwZS4nKTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIC8vIFNlZSBpZiB0aGlzIGRldmljZSBpcyBvZiB0aGUgYXBwcm9wcmlhdGUgdHlwZS5cbiAgICBpZiAoVXRpbC5pc0lPUygpICE9IChkZXZpY2UudHlwZSA9PSAnaW9zJykpIGNvbnRpbnVlO1xuXG4gICAgLy8gU2VlIGlmIHRoaXMgZGV2aWNlIG1hdGNoZXMgYW55IG9mIHRoZSBydWxlczpcbiAgICB2YXIgbWF0Y2hlZCA9IGZhbHNlO1xuICAgIGZvciAodmFyIGogPSAwOyBqIDwgZGV2aWNlLnJ1bGVzLmxlbmd0aDsgaisrKSB7XG4gICAgICB2YXIgcnVsZSA9IGRldmljZS5ydWxlc1tqXTtcbiAgICAgIGlmICh0aGlzLm1hdGNoUnVsZV8ocnVsZSwgdXNlckFnZW50LCB3aWR0aCwgaGVpZ2h0KSkge1xuICAgICAgICBjb25zb2xlLmxvZygnUnVsZSBtYXRjaGVkOicpO1xuICAgICAgICBjb25zb2xlLmxvZyhydWxlKTtcbiAgICAgICAgbWF0Y2hlZCA9IHRydWU7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoIW1hdGNoZWQpIGNvbnRpbnVlO1xuXG4gICAgLy8gZGV2aWNlLmRwaSBtaWdodCBiZSBhbiBhcnJheSBvZiBbIHhkcGksIHlkcGldIG9yIGp1c3QgYSBzY2FsYXIuXG4gICAgdmFyIHhkcGkgPSBkZXZpY2UuZHBpWzBdIHx8IGRldmljZS5kcGk7XG4gICAgdmFyIHlkcGkgPSBkZXZpY2UuZHBpWzFdIHx8IGRldmljZS5kcGk7XG5cbiAgICByZXR1cm4gbmV3IERldmljZVBhcmFtcyh7IHhkcGk6IHhkcGksIHlkcGk6IHlkcGksIGJldmVsTW06IGRldmljZS5idyB9KTtcbiAgfVxuXG4gIGNvbnNvbGUud2FybignTm8gRFBEQiBkZXZpY2UgbWF0Y2guJyk7XG4gIHJldHVybiBudWxsO1xufTtcblxuRHBkYi5wcm90b3R5cGUubWF0Y2hSdWxlXyA9IGZ1bmN0aW9uKHJ1bGUsIHVhLCBzY3JlZW5XaWR0aCwgc2NyZWVuSGVpZ2h0KSB7XG4gIC8vIFdlIGNhbiBvbmx5IG1hdGNoICd1YScgYW5kICdyZXMnIHJ1bGVzLCBub3Qgb3RoZXIgdHlwZXMgbGlrZSAnbWRtaCdcbiAgLy8gKHdoaWNoIGFyZSBtZWFudCBmb3IgbmF0aXZlIHBsYXRmb3JtcykuXG4gIGlmICghcnVsZS51YSAmJiAhcnVsZS5yZXMpIHJldHVybiBmYWxzZTtcblxuICAvLyBJZiBvdXIgdXNlciBhZ2VudCBzdHJpbmcgZG9lc24ndCBjb250YWluIHRoZSBpbmRpY2F0ZWQgdXNlciBhZ2VudCBzdHJpbmcsXG4gIC8vIHRoZSBtYXRjaCBmYWlscy5cbiAgaWYgKHJ1bGUudWEgJiYgdWEuaW5kZXhPZihydWxlLnVhKSA8IDApIHJldHVybiBmYWxzZTtcblxuICAvLyBJZiB0aGUgcnVsZSBzcGVjaWZpZXMgc2NyZWVuIGRpbWVuc2lvbnMgdGhhdCBkb24ndCBjb3JyZXNwb25kIHRvIG91cnMsXG4gIC8vIHRoZSBtYXRjaCBmYWlscy5cbiAgaWYgKHJ1bGUucmVzKSB7XG4gICAgaWYgKCFydWxlLnJlc1swXSB8fCAhcnVsZS5yZXNbMV0pIHJldHVybiBmYWxzZTtcbiAgICB2YXIgcmVzWCA9IHJ1bGUucmVzWzBdO1xuICAgIHZhciByZXNZID0gcnVsZS5yZXNbMV07XG4gICAgLy8gQ29tcGFyZSBtaW4gYW5kIG1heCBzbyBhcyB0byBtYWtlIHRoZSBvcmRlciBub3QgbWF0dGVyLCBpLmUuLCBpdCBzaG91bGRcbiAgICAvLyBiZSB0cnVlIHRoYXQgNjQweDQ4MCA9PSA0ODB4NjQwLlxuICAgIGlmIChNYXRoLm1pbihzY3JlZW5XaWR0aCwgc2NyZWVuSGVpZ2h0KSAhPSBNYXRoLm1pbihyZXNYLCByZXNZKSB8fFxuICAgICAgICAoTWF0aC5tYXgoc2NyZWVuV2lkdGgsIHNjcmVlbkhlaWdodCkgIT0gTWF0aC5tYXgocmVzWCwgcmVzWSkpKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRydWU7XG59XG5cbmZ1bmN0aW9uIERldmljZVBhcmFtcyhwYXJhbXMpIHtcbiAgdGhpcy54ZHBpID0gcGFyYW1zLnhkcGk7XG4gIHRoaXMueWRwaSA9IHBhcmFtcy55ZHBpO1xuICB0aGlzLmJldmVsTW0gPSBwYXJhbXMuYmV2ZWxNbTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBEcGRiOyIsIi8qXG4gKiBDb3B5cmlnaHQgMjAxNSBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICogTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcbiAqIHlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cbiAqIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuICpcbiAqICAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcbiAqXG4gKiBVbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG4gKiBkaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG4gKiBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cbiAqIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbiAqIGxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuICovXG5cbmZ1bmN0aW9uIEVtaXR0ZXIoKSB7XG4gIHRoaXMuY2FsbGJhY2tzID0ge307XG59XG5cbkVtaXR0ZXIucHJvdG90eXBlLmVtaXQgPSBmdW5jdGlvbihldmVudE5hbWUpIHtcbiAgdmFyIGNhbGxiYWNrcyA9IHRoaXMuY2FsbGJhY2tzW2V2ZW50TmFtZV07XG4gIGlmICghY2FsbGJhY2tzKSB7XG4gICAgLy9jb25zb2xlLmxvZygnTm8gdmFsaWQgY2FsbGJhY2sgc3BlY2lmaWVkLicpO1xuICAgIHJldHVybjtcbiAgfVxuICB2YXIgYXJncyA9IFtdLnNsaWNlLmNhbGwoYXJndW1lbnRzKTtcbiAgLy8gRWxpbWluYXRlIHRoZSBmaXJzdCBwYXJhbSAodGhlIGNhbGxiYWNrKS5cbiAgYXJncy5zaGlmdCgpO1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGNhbGxiYWNrcy5sZW5ndGg7IGkrKykge1xuICAgIGNhbGxiYWNrc1tpXS5hcHBseSh0aGlzLCBhcmdzKTtcbiAgfVxufTtcblxuRW1pdHRlci5wcm90b3R5cGUub24gPSBmdW5jdGlvbihldmVudE5hbWUsIGNhbGxiYWNrKSB7XG4gIGlmIChldmVudE5hbWUgaW4gdGhpcy5jYWxsYmFja3MpIHtcbiAgICB0aGlzLmNhbGxiYWNrc1tldmVudE5hbWVdLnB1c2goY2FsbGJhY2spO1xuICB9IGVsc2Uge1xuICAgIHRoaXMuY2FsbGJhY2tzW2V2ZW50TmFtZV0gPSBbY2FsbGJhY2tdO1xuICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEVtaXR0ZXI7XG4iLCIvKlxuICogQ29weXJpZ2h0IDIwMTUgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG4gKiB5b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG4gKiBZb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcbiAqXG4gKiAgICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXG4gKlxuICogVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxuICogZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxuICogV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXG4gKiBTZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXG4gKiBsaW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cbiAqL1xudmFyIFV0aWwgPSByZXF1aXJlKCcuL3V0aWwuanMnKTtcbnZhciBXZWJWUlBvbHlmaWxsID0gcmVxdWlyZSgnLi93ZWJ2ci1wb2x5ZmlsbC5qcycpLldlYlZSUG9seWZpbGw7XG5cbi8vIEluaXRpYWxpemUgYSBXZWJWUkNvbmZpZyBqdXN0IGluIGNhc2UuXG53aW5kb3cuV2ViVlJDb25maWcgPSBVdGlsLmV4dGVuZCh7XG4gIC8vIEZvcmNlcyBhdmFpbGFiaWxpdHkgb2YgVlIgbW9kZSwgZXZlbiBmb3Igbm9uLW1vYmlsZSBkZXZpY2VzLlxuICBGT1JDRV9FTkFCTEVfVlI6IGZhbHNlLFxuXG4gIC8vIENvbXBsZW1lbnRhcnkgZmlsdGVyIGNvZWZmaWNpZW50LiAwIGZvciBhY2NlbGVyb21ldGVyLCAxIGZvciBneXJvLlxuICBLX0ZJTFRFUjogMC45OCxcblxuICAvLyBIb3cgZmFyIGludG8gdGhlIGZ1dHVyZSB0byBwcmVkaWN0IGR1cmluZyBmYXN0IG1vdGlvbiAoaW4gc2Vjb25kcykuXG4gIFBSRURJQ1RJT05fVElNRV9TOiAwLjA0MCxcblxuICAvLyBGbGFnIHRvIGVuYWJsZSB0b3VjaCBwYW5uZXIuIEluIGNhc2UgeW91IGhhdmUgeW91ciBvd24gdG91Y2ggY29udHJvbHMuXG4gIFRPVUNIX1BBTk5FUl9ESVNBQkxFRDogdHJ1ZSxcblxuICAvLyBGbGFnIHRvIGRpc2FibGVkIHRoZSBVSSBpbiBWUiBNb2RlLlxuICBDQVJEQk9BUkRfVUlfRElTQUJMRUQ6IGZhbHNlLCAvLyBEZWZhdWx0OiBmYWxzZVxuXG4gIC8vIEZsYWcgdG8gZGlzYWJsZSB0aGUgaW5zdHJ1Y3Rpb25zIHRvIHJvdGF0ZSB5b3VyIGRldmljZS5cbiAgUk9UQVRFX0lOU1RSVUNUSU9OU19ESVNBQkxFRDogZmFsc2UsIC8vIERlZmF1bHQ6IGZhbHNlLlxuXG4gIC8vIEVuYWJsZSB5YXcgcGFubmluZyBvbmx5LCBkaXNhYmxpbmcgcm9sbCBhbmQgcGl0Y2guIFRoaXMgY2FuIGJlIHVzZWZ1bFxuICAvLyBmb3IgcGFub3JhbWFzIHdpdGggbm90aGluZyBpbnRlcmVzdGluZyBhYm92ZSBvciBiZWxvdy5cbiAgWUFXX09OTFk6IGZhbHNlLFxuXG4gIC8vIFRvIGRpc2FibGUga2V5Ym9hcmQgYW5kIG1vdXNlIGNvbnRyb2xzLCBpZiB5b3Ugd2FudCB0byB1c2UgeW91ciBvd25cbiAgLy8gaW1wbGVtZW50YXRpb24uXG4gIE1PVVNFX0tFWUJPQVJEX0NPTlRST0xTX0RJU0FCTEVEOiBmYWxzZSxcblxuICAvLyBQcmV2ZW50IHRoZSBwb2x5ZmlsbCBmcm9tIGluaXRpYWxpemluZyBpbW1lZGlhdGVseS4gUmVxdWlyZXMgdGhlIGFwcFxuICAvLyB0byBjYWxsIEluaXRpYWxpemVXZWJWUlBvbHlmaWxsKCkgYmVmb3JlIGl0IGNhbiBiZSB1c2VkLlxuICBERUZFUl9JTklUSUFMSVpBVElPTjogZmFsc2UsXG5cbiAgLy8gRW5hYmxlIHRoZSBkZXByZWNhdGVkIHZlcnNpb24gb2YgdGhlIEFQSSAobmF2aWdhdG9yLmdldFZSRGV2aWNlcykuXG4gIEVOQUJMRV9ERVBSRUNBVEVEX0FQSTogZmFsc2UsXG5cbiAgLy8gU2NhbGVzIHRoZSByZWNvbW1lbmRlZCBidWZmZXIgc2l6ZSByZXBvcnRlZCBieSBXZWJWUiwgd2hpY2ggY2FuIGltcHJvdmVcbiAgLy8gcGVyZm9ybWFuY2UuXG4gIC8vIFVQREFURSgyMDE2LTA1LTAzKTogU2V0dGluZyB0aGlzIHRvIDAuNSBieSBkZWZhdWx0IHNpbmNlIDEuMCBkb2VzIG5vdFxuICAvLyBwZXJmb3JtIHdlbGwgb24gbWFueSBtb2JpbGUgZGV2aWNlcy5cbiAgQlVGRkVSX1NDQUxFOiAwLjUsXG5cbiAgLy8gQWxsb3cgVlJEaXNwbGF5LnN1Ym1pdEZyYW1lIHRvIGNoYW5nZSBnbCBiaW5kaW5ncywgd2hpY2ggaXMgbW9yZVxuICAvLyBlZmZpY2llbnQgaWYgdGhlIGFwcGxpY2F0aW9uIGNvZGUgd2lsbCByZS1iaW5kIGl0cyByZXNvdXJjZXMgb24gdGhlXG4gIC8vIG5leHQgZnJhbWUgYW55d2F5LiBUaGlzIGhhcyBiZWVuIHNlZW4gdG8gY2F1c2UgcmVuZGVyaW5nIGdsaXRjaGVzIHdpdGhcbiAgLy8gVEhSRUUuanMuXG4gIC8vIERpcnR5IGJpbmRpbmdzIGluY2x1ZGU6IGdsLkZSQU1FQlVGRkVSX0JJTkRJTkcsIGdsLkNVUlJFTlRfUFJPR1JBTSxcbiAgLy8gZ2wuQVJSQVlfQlVGRkVSX0JJTkRJTkcsIGdsLkVMRU1FTlRfQVJSQVlfQlVGRkVSX0JJTkRJTkcsXG4gIC8vIGFuZCBnbC5URVhUVVJFX0JJTkRJTkdfMkQgZm9yIHRleHR1cmUgdW5pdCAwLlxuICBESVJUWV9TVUJNSVRfRlJBTUVfQklORElOR1M6IGZhbHNlXG59LCB3aW5kb3cuV2ViVlJDb25maWcpO1xuXG5pZiAoIXdpbmRvdy5XZWJWUkNvbmZpZy5ERUZFUl9JTklUSUFMSVpBVElPTikge1xuICBuZXcgV2ViVlJQb2x5ZmlsbCgpO1xufSBlbHNlIHtcbiAgd2luZG93LkluaXRpYWxpemVXZWJWUlBvbHlmaWxsID0gZnVuY3Rpb24oKSB7XG4gICAgbmV3IFdlYlZSUG9seWZpbGwoKTtcbiAgfVxufVxuIiwiLypcbiAqIENvcHlyaWdodCAyMDE2IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xuICogeW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuICogWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG4gKlxuICogICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuICpcbiAqIFVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbiAqIGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbiAqIFdJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuICogU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxuICogbGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG4gKi9cblxudmFyIE1hdGhVdGlsID0gd2luZG93Lk1hdGhVdGlsIHx8IHt9O1xuXG5NYXRoVXRpbC5kZWdUb1JhZCA9IE1hdGguUEkgLyAxODA7XG5NYXRoVXRpbC5yYWRUb0RlZyA9IDE4MCAvIE1hdGguUEk7XG5cbi8vIFNvbWUgbWluaW1hbCBtYXRoIGZ1bmN0aW9uYWxpdHkgYm9ycm93ZWQgZnJvbSBUSFJFRS5NYXRoIGFuZCBzdHJpcHBlZCBkb3duXG4vLyBmb3IgdGhlIHB1cnBvc2VzIG9mIHRoaXMgbGlicmFyeS5cblxuXG5NYXRoVXRpbC5WZWN0b3IyID0gZnVuY3Rpb24gKCB4LCB5ICkge1xuICB0aGlzLnggPSB4IHx8IDA7XG4gIHRoaXMueSA9IHkgfHwgMDtcbn07XG5cbk1hdGhVdGlsLlZlY3RvcjIucHJvdG90eXBlID0ge1xuICBjb25zdHJ1Y3RvcjogTWF0aFV0aWwuVmVjdG9yMixcblxuICBzZXQ6IGZ1bmN0aW9uICggeCwgeSApIHtcbiAgICB0aGlzLnggPSB4O1xuICAgIHRoaXMueSA9IHk7XG5cbiAgICByZXR1cm4gdGhpcztcbiAgfSxcblxuICBjb3B5OiBmdW5jdGlvbiAoIHYgKSB7XG4gICAgdGhpcy54ID0gdi54O1xuICAgIHRoaXMueSA9IHYueTtcblxuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG4gIHN1YlZlY3RvcnM6IGZ1bmN0aW9uICggYSwgYiApIHtcbiAgICB0aGlzLnggPSBhLnggLSBiLng7XG4gICAgdGhpcy55ID0gYS55IC0gYi55O1xuXG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG59O1xuXG5NYXRoVXRpbC5WZWN0b3IzID0gZnVuY3Rpb24gKCB4LCB5LCB6ICkge1xuICB0aGlzLnggPSB4IHx8IDA7XG4gIHRoaXMueSA9IHkgfHwgMDtcbiAgdGhpcy56ID0geiB8fCAwO1xufTtcblxuTWF0aFV0aWwuVmVjdG9yMy5wcm90b3R5cGUgPSB7XG4gIGNvbnN0cnVjdG9yOiBNYXRoVXRpbC5WZWN0b3IzLFxuXG4gIHNldDogZnVuY3Rpb24gKCB4LCB5LCB6ICkge1xuICAgIHRoaXMueCA9IHg7XG4gICAgdGhpcy55ID0geTtcbiAgICB0aGlzLnogPSB6O1xuXG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG5cbiAgY29weTogZnVuY3Rpb24gKCB2ICkge1xuICAgIHRoaXMueCA9IHYueDtcbiAgICB0aGlzLnkgPSB2Lnk7XG4gICAgdGhpcy56ID0gdi56O1xuXG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG5cbiAgbGVuZ3RoOiBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIE1hdGguc3FydCggdGhpcy54ICogdGhpcy54ICsgdGhpcy55ICogdGhpcy55ICsgdGhpcy56ICogdGhpcy56ICk7XG4gIH0sXG5cbiAgbm9ybWFsaXplOiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNjYWxhciA9IHRoaXMubGVuZ3RoKCk7XG5cbiAgICBpZiAoIHNjYWxhciAhPT0gMCApIHtcbiAgICAgIHZhciBpbnZTY2FsYXIgPSAxIC8gc2NhbGFyO1xuXG4gICAgICB0aGlzLm11bHRpcGx5U2NhbGFyKGludlNjYWxhcik7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMueCA9IDA7XG4gICAgICB0aGlzLnkgPSAwO1xuICAgICAgdGhpcy56ID0gMDtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcztcbiAgfSxcblxuICBtdWx0aXBseVNjYWxhcjogZnVuY3Rpb24gKCBzY2FsYXIgKSB7XG4gICAgdGhpcy54ICo9IHNjYWxhcjtcbiAgICB0aGlzLnkgKj0gc2NhbGFyO1xuICAgIHRoaXMueiAqPSBzY2FsYXI7XG4gIH0sXG5cbiAgYXBwbHlRdWF0ZXJuaW9uOiBmdW5jdGlvbiAoIHEgKSB7XG4gICAgdmFyIHggPSB0aGlzLng7XG4gICAgdmFyIHkgPSB0aGlzLnk7XG4gICAgdmFyIHogPSB0aGlzLno7XG5cbiAgICB2YXIgcXggPSBxLng7XG4gICAgdmFyIHF5ID0gcS55O1xuICAgIHZhciBxeiA9IHEuejtcbiAgICB2YXIgcXcgPSBxLnc7XG5cbiAgICAvLyBjYWxjdWxhdGUgcXVhdCAqIHZlY3RvclxuICAgIHZhciBpeCA9ICBxdyAqIHggKyBxeSAqIHogLSBxeiAqIHk7XG4gICAgdmFyIGl5ID0gIHF3ICogeSArIHF6ICogeCAtIHF4ICogejtcbiAgICB2YXIgaXogPSAgcXcgKiB6ICsgcXggKiB5IC0gcXkgKiB4O1xuICAgIHZhciBpdyA9IC0gcXggKiB4IC0gcXkgKiB5IC0gcXogKiB6O1xuXG4gICAgLy8gY2FsY3VsYXRlIHJlc3VsdCAqIGludmVyc2UgcXVhdFxuICAgIHRoaXMueCA9IGl4ICogcXcgKyBpdyAqIC0gcXggKyBpeSAqIC0gcXogLSBpeiAqIC0gcXk7XG4gICAgdGhpcy55ID0gaXkgKiBxdyArIGl3ICogLSBxeSArIGl6ICogLSBxeCAtIGl4ICogLSBxejtcbiAgICB0aGlzLnogPSBpeiAqIHF3ICsgaXcgKiAtIHF6ICsgaXggKiAtIHF5IC0gaXkgKiAtIHF4O1xuXG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG5cbiAgZG90OiBmdW5jdGlvbiAoIHYgKSB7XG4gICAgcmV0dXJuIHRoaXMueCAqIHYueCArIHRoaXMueSAqIHYueSArIHRoaXMueiAqIHYuejtcbiAgfSxcblxuICBjcm9zc1ZlY3RvcnM6IGZ1bmN0aW9uICggYSwgYiApIHtcbiAgICB2YXIgYXggPSBhLngsIGF5ID0gYS55LCBheiA9IGEuejtcbiAgICB2YXIgYnggPSBiLngsIGJ5ID0gYi55LCBieiA9IGIuejtcblxuICAgIHRoaXMueCA9IGF5ICogYnogLSBheiAqIGJ5O1xuICAgIHRoaXMueSA9IGF6ICogYnggLSBheCAqIGJ6O1xuICAgIHRoaXMueiA9IGF4ICogYnkgLSBheSAqIGJ4O1xuXG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG59O1xuXG5NYXRoVXRpbC5RdWF0ZXJuaW9uID0gZnVuY3Rpb24gKCB4LCB5LCB6LCB3ICkge1xuICB0aGlzLnggPSB4IHx8IDA7XG4gIHRoaXMueSA9IHkgfHwgMDtcbiAgdGhpcy56ID0geiB8fCAwO1xuICB0aGlzLncgPSAoIHcgIT09IHVuZGVmaW5lZCApID8gdyA6IDE7XG59O1xuXG5NYXRoVXRpbC5RdWF0ZXJuaW9uLnByb3RvdHlwZSA9IHtcbiAgY29uc3RydWN0b3I6IE1hdGhVdGlsLlF1YXRlcm5pb24sXG5cbiAgc2V0OiBmdW5jdGlvbiAoIHgsIHksIHosIHcgKSB7XG4gICAgdGhpcy54ID0geDtcbiAgICB0aGlzLnkgPSB5O1xuICAgIHRoaXMueiA9IHo7XG4gICAgdGhpcy53ID0gdztcblxuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG4gIGNvcHk6IGZ1bmN0aW9uICggcXVhdGVybmlvbiApIHtcbiAgICB0aGlzLnggPSBxdWF0ZXJuaW9uLng7XG4gICAgdGhpcy55ID0gcXVhdGVybmlvbi55O1xuICAgIHRoaXMueiA9IHF1YXRlcm5pb24uejtcbiAgICB0aGlzLncgPSBxdWF0ZXJuaW9uLnc7XG5cbiAgICByZXR1cm4gdGhpcztcbiAgfSxcblxuICBzZXRGcm9tRXVsZXJYWVo6IGZ1bmN0aW9uKCB4LCB5LCB6ICkge1xuICAgIHZhciBjMSA9IE1hdGguY29zKCB4IC8gMiApO1xuICAgIHZhciBjMiA9IE1hdGguY29zKCB5IC8gMiApO1xuICAgIHZhciBjMyA9IE1hdGguY29zKCB6IC8gMiApO1xuICAgIHZhciBzMSA9IE1hdGguc2luKCB4IC8gMiApO1xuICAgIHZhciBzMiA9IE1hdGguc2luKCB5IC8gMiApO1xuICAgIHZhciBzMyA9IE1hdGguc2luKCB6IC8gMiApO1xuXG4gICAgdGhpcy54ID0gczEgKiBjMiAqIGMzICsgYzEgKiBzMiAqIHMzO1xuICAgIHRoaXMueSA9IGMxICogczIgKiBjMyAtIHMxICogYzIgKiBzMztcbiAgICB0aGlzLnogPSBjMSAqIGMyICogczMgKyBzMSAqIHMyICogYzM7XG4gICAgdGhpcy53ID0gYzEgKiBjMiAqIGMzIC0gczEgKiBzMiAqIHMzO1xuXG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG5cbiAgc2V0RnJvbUV1bGVyWVhaOiBmdW5jdGlvbiggeCwgeSwgeiApIHtcbiAgICB2YXIgYzEgPSBNYXRoLmNvcyggeCAvIDIgKTtcbiAgICB2YXIgYzIgPSBNYXRoLmNvcyggeSAvIDIgKTtcbiAgICB2YXIgYzMgPSBNYXRoLmNvcyggeiAvIDIgKTtcbiAgICB2YXIgczEgPSBNYXRoLnNpbiggeCAvIDIgKTtcbiAgICB2YXIgczIgPSBNYXRoLnNpbiggeSAvIDIgKTtcbiAgICB2YXIgczMgPSBNYXRoLnNpbiggeiAvIDIgKTtcblxuICAgIHRoaXMueCA9IHMxICogYzIgKiBjMyArIGMxICogczIgKiBzMztcbiAgICB0aGlzLnkgPSBjMSAqIHMyICogYzMgLSBzMSAqIGMyICogczM7XG4gICAgdGhpcy56ID0gYzEgKiBjMiAqIHMzIC0gczEgKiBzMiAqIGMzO1xuICAgIHRoaXMudyA9IGMxICogYzIgKiBjMyArIHMxICogczIgKiBzMztcblxuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG4gIHNldEZyb21BeGlzQW5nbGU6IGZ1bmN0aW9uICggYXhpcywgYW5nbGUgKSB7XG4gICAgLy8gaHR0cDovL3d3dy5ldWNsaWRlYW5zcGFjZS5jb20vbWF0aHMvZ2VvbWV0cnkvcm90YXRpb25zL2NvbnZlcnNpb25zL2FuZ2xlVG9RdWF0ZXJuaW9uL2luZGV4Lmh0bVxuICAgIC8vIGFzc3VtZXMgYXhpcyBpcyBub3JtYWxpemVkXG5cbiAgICB2YXIgaGFsZkFuZ2xlID0gYW5nbGUgLyAyLCBzID0gTWF0aC5zaW4oIGhhbGZBbmdsZSApO1xuXG4gICAgdGhpcy54ID0gYXhpcy54ICogcztcbiAgICB0aGlzLnkgPSBheGlzLnkgKiBzO1xuICAgIHRoaXMueiA9IGF4aXMueiAqIHM7XG4gICAgdGhpcy53ID0gTWF0aC5jb3MoIGhhbGZBbmdsZSApO1xuXG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG5cbiAgbXVsdGlwbHk6IGZ1bmN0aW9uICggcSApIHtcbiAgICByZXR1cm4gdGhpcy5tdWx0aXBseVF1YXRlcm5pb25zKCB0aGlzLCBxICk7XG4gIH0sXG5cbiAgbXVsdGlwbHlRdWF0ZXJuaW9uczogZnVuY3Rpb24gKCBhLCBiICkge1xuICAgIC8vIGZyb20gaHR0cDovL3d3dy5ldWNsaWRlYW5zcGFjZS5jb20vbWF0aHMvYWxnZWJyYS9yZWFsTm9ybWVkQWxnZWJyYS9xdWF0ZXJuaW9ucy9jb2RlL2luZGV4Lmh0bVxuXG4gICAgdmFyIHFheCA9IGEueCwgcWF5ID0gYS55LCBxYXogPSBhLnosIHFhdyA9IGEudztcbiAgICB2YXIgcWJ4ID0gYi54LCBxYnkgPSBiLnksIHFieiA9IGIueiwgcWJ3ID0gYi53O1xuXG4gICAgdGhpcy54ID0gcWF4ICogcWJ3ICsgcWF3ICogcWJ4ICsgcWF5ICogcWJ6IC0gcWF6ICogcWJ5O1xuICAgIHRoaXMueSA9IHFheSAqIHFidyArIHFhdyAqIHFieSArIHFheiAqIHFieCAtIHFheCAqIHFiejtcbiAgICB0aGlzLnogPSBxYXogKiBxYncgKyBxYXcgKiBxYnogKyBxYXggKiBxYnkgLSBxYXkgKiBxYng7XG4gICAgdGhpcy53ID0gcWF3ICogcWJ3IC0gcWF4ICogcWJ4IC0gcWF5ICogcWJ5IC0gcWF6ICogcWJ6O1xuXG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG5cbiAgaW52ZXJzZTogZnVuY3Rpb24gKCkge1xuICAgIHRoaXMueCAqPSAtMTtcbiAgICB0aGlzLnkgKj0gLTE7XG4gICAgdGhpcy56ICo9IC0xO1xuXG4gICAgdGhpcy5ub3JtYWxpemUoKTtcblxuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG4gIG5vcm1hbGl6ZTogZnVuY3Rpb24gKCkge1xuICAgIHZhciBsID0gTWF0aC5zcXJ0KCB0aGlzLnggKiB0aGlzLnggKyB0aGlzLnkgKiB0aGlzLnkgKyB0aGlzLnogKiB0aGlzLnogKyB0aGlzLncgKiB0aGlzLncgKTtcblxuICAgIGlmICggbCA9PT0gMCApIHtcbiAgICAgIHRoaXMueCA9IDA7XG4gICAgICB0aGlzLnkgPSAwO1xuICAgICAgdGhpcy56ID0gMDtcbiAgICAgIHRoaXMudyA9IDE7XG4gICAgfSBlbHNlIHtcbiAgICAgIGwgPSAxIC8gbDtcblxuICAgICAgdGhpcy54ID0gdGhpcy54ICogbDtcbiAgICAgIHRoaXMueSA9IHRoaXMueSAqIGw7XG4gICAgICB0aGlzLnogPSB0aGlzLnogKiBsO1xuICAgICAgdGhpcy53ID0gdGhpcy53ICogbDtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcztcbiAgfSxcblxuICBzbGVycDogZnVuY3Rpb24gKCBxYiwgdCApIHtcbiAgICBpZiAoIHQgPT09IDAgKSByZXR1cm4gdGhpcztcbiAgICBpZiAoIHQgPT09IDEgKSByZXR1cm4gdGhpcy5jb3B5KCBxYiApO1xuXG4gICAgdmFyIHggPSB0aGlzLngsIHkgPSB0aGlzLnksIHogPSB0aGlzLnosIHcgPSB0aGlzLnc7XG5cbiAgICAvLyBodHRwOi8vd3d3LmV1Y2xpZGVhbnNwYWNlLmNvbS9tYXRocy9hbGdlYnJhL3JlYWxOb3JtZWRBbGdlYnJhL3F1YXRlcm5pb25zL3NsZXJwL1xuXG4gICAgdmFyIGNvc0hhbGZUaGV0YSA9IHcgKiBxYi53ICsgeCAqIHFiLnggKyB5ICogcWIueSArIHogKiBxYi56O1xuXG4gICAgaWYgKCBjb3NIYWxmVGhldGEgPCAwICkge1xuICAgICAgdGhpcy53ID0gLSBxYi53O1xuICAgICAgdGhpcy54ID0gLSBxYi54O1xuICAgICAgdGhpcy55ID0gLSBxYi55O1xuICAgICAgdGhpcy56ID0gLSBxYi56O1xuXG4gICAgICBjb3NIYWxmVGhldGEgPSAtIGNvc0hhbGZUaGV0YTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5jb3B5KCBxYiApO1xuICAgIH1cblxuICAgIGlmICggY29zSGFsZlRoZXRhID49IDEuMCApIHtcbiAgICAgIHRoaXMudyA9IHc7XG4gICAgICB0aGlzLnggPSB4O1xuICAgICAgdGhpcy55ID0geTtcbiAgICAgIHRoaXMueiA9IHo7XG5cbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIHZhciBoYWxmVGhldGEgPSBNYXRoLmFjb3MoIGNvc0hhbGZUaGV0YSApO1xuICAgIHZhciBzaW5IYWxmVGhldGEgPSBNYXRoLnNxcnQoIDEuMCAtIGNvc0hhbGZUaGV0YSAqIGNvc0hhbGZUaGV0YSApO1xuXG4gICAgaWYgKCBNYXRoLmFicyggc2luSGFsZlRoZXRhICkgPCAwLjAwMSApIHtcbiAgICAgIHRoaXMudyA9IDAuNSAqICggdyArIHRoaXMudyApO1xuICAgICAgdGhpcy54ID0gMC41ICogKCB4ICsgdGhpcy54ICk7XG4gICAgICB0aGlzLnkgPSAwLjUgKiAoIHkgKyB0aGlzLnkgKTtcbiAgICAgIHRoaXMueiA9IDAuNSAqICggeiArIHRoaXMueiApO1xuXG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICB2YXIgcmF0aW9BID0gTWF0aC5zaW4oICggMSAtIHQgKSAqIGhhbGZUaGV0YSApIC8gc2luSGFsZlRoZXRhLFxuICAgIHJhdGlvQiA9IE1hdGguc2luKCB0ICogaGFsZlRoZXRhICkgLyBzaW5IYWxmVGhldGE7XG5cbiAgICB0aGlzLncgPSAoIHcgKiByYXRpb0EgKyB0aGlzLncgKiByYXRpb0IgKTtcbiAgICB0aGlzLnggPSAoIHggKiByYXRpb0EgKyB0aGlzLnggKiByYXRpb0IgKTtcbiAgICB0aGlzLnkgPSAoIHkgKiByYXRpb0EgKyB0aGlzLnkgKiByYXRpb0IgKTtcbiAgICB0aGlzLnogPSAoIHogKiByYXRpb0EgKyB0aGlzLnogKiByYXRpb0IgKTtcblxuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG4gIHNldEZyb21Vbml0VmVjdG9yczogZnVuY3Rpb24gKCkge1xuICAgIC8vIGh0dHA6Ly9sb2xlbmdpbmUubmV0L2Jsb2cvMjAxNC8wMi8yNC9xdWF0ZXJuaW9uLWZyb20tdHdvLXZlY3RvcnMtZmluYWxcbiAgICAvLyBhc3N1bWVzIGRpcmVjdGlvbiB2ZWN0b3JzIHZGcm9tIGFuZCB2VG8gYXJlIG5vcm1hbGl6ZWRcblxuICAgIHZhciB2MSwgcjtcbiAgICB2YXIgRVBTID0gMC4wMDAwMDE7XG5cbiAgICByZXR1cm4gZnVuY3Rpb24gKCB2RnJvbSwgdlRvICkge1xuICAgICAgaWYgKCB2MSA9PT0gdW5kZWZpbmVkICkgdjEgPSBuZXcgTWF0aFV0aWwuVmVjdG9yMygpO1xuXG4gICAgICByID0gdkZyb20uZG90KCB2VG8gKSArIDE7XG5cbiAgICAgIGlmICggciA8IEVQUyApIHtcbiAgICAgICAgciA9IDA7XG5cbiAgICAgICAgaWYgKCBNYXRoLmFicyggdkZyb20ueCApID4gTWF0aC5hYnMoIHZGcm9tLnogKSApIHtcbiAgICAgICAgICB2MS5zZXQoIC0gdkZyb20ueSwgdkZyb20ueCwgMCApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHYxLnNldCggMCwgLSB2RnJvbS56LCB2RnJvbS55ICk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHYxLmNyb3NzVmVjdG9ycyggdkZyb20sIHZUbyApO1xuICAgICAgfVxuXG4gICAgICB0aGlzLnggPSB2MS54O1xuICAgICAgdGhpcy55ID0gdjEueTtcbiAgICAgIHRoaXMueiA9IHYxLno7XG4gICAgICB0aGlzLncgPSByO1xuXG4gICAgICB0aGlzLm5vcm1hbGl6ZSgpO1xuXG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9XG4gIH0oKSxcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gTWF0aFV0aWw7XG4iLCIvKlxuICogQ29weXJpZ2h0IDIwMTYgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG4gKiB5b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG4gKiBZb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcbiAqXG4gKiAgICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXG4gKlxuICogVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxuICogZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxuICogV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXG4gKiBTZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXG4gKiBsaW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cbiAqL1xuXG52YXIgVlJEaXNwbGF5ID0gcmVxdWlyZSgnLi9iYXNlLmpzJykuVlJEaXNwbGF5O1xudmFyIE1hdGhVdGlsID0gcmVxdWlyZSgnLi9tYXRoLXV0aWwuanMnKTtcbnZhciBVdGlsID0gcmVxdWlyZSgnLi91dGlsLmpzJyk7XG5cbi8vIEhvdyBtdWNoIHRvIHJvdGF0ZSBwZXIga2V5IHN0cm9rZS5cbnZhciBLRVlfU1BFRUQgPSAwLjE1O1xudmFyIEtFWV9BTklNQVRJT05fRFVSQVRJT04gPSA4MDtcblxuLy8gSG93IG11Y2ggdG8gcm90YXRlIGZvciBtb3VzZSBldmVudHMuXG52YXIgTU9VU0VfU1BFRURfWCA9IDAuNTtcbnZhciBNT1VTRV9TUEVFRF9ZID0gMC4zO1xuXG4vKipcbiAqIFZSRGlzcGxheSBiYXNlZCBvbiBtb3VzZSBhbmQga2V5Ym9hcmQgaW5wdXQuIERlc2lnbmVkIGZvciBkZXNrdG9wcy9sYXB0b3BzXG4gKiB3aGVyZSBvcmllbnRhdGlvbiBldmVudHMgYXJlbid0IHN1cHBvcnRlZC4gQ2Fubm90IHByZXNlbnQuXG4gKi9cbmZ1bmN0aW9uIE1vdXNlS2V5Ym9hcmRWUkRpc3BsYXkoKSB7XG4gIHRoaXMuZGlzcGxheU5hbWUgPSAnTW91c2UgYW5kIEtleWJvYXJkIFZSRGlzcGxheSAod2VidnItcG9seWZpbGwpJztcblxuICB0aGlzLmNhcGFiaWxpdGllcy5oYXNPcmllbnRhdGlvbiA9IHRydWU7XG5cbiAgLy8gQXR0YWNoIHRvIG1vdXNlIGFuZCBrZXlib2FyZCBldmVudHMuXG4gIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgdGhpcy5vbktleURvd25fLmJpbmQodGhpcykpO1xuICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgdGhpcy5vbk1vdXNlTW92ZV8uYmluZCh0aGlzKSk7XG4gIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdtb3VzZWRvd24nLCB0aGlzLm9uTW91c2VEb3duXy5iaW5kKHRoaXMpKTtcbiAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCB0aGlzLm9uTW91c2VVcF8uYmluZCh0aGlzKSk7XG5cbiAgLy8gXCJQcml2YXRlXCIgbWVtYmVycy5cbiAgdGhpcy5waGlfID0gMDtcbiAgdGhpcy50aGV0YV8gPSAwO1xuXG4gIC8vIFZhcmlhYmxlcyBmb3Iga2V5Ym9hcmQtYmFzZWQgcm90YXRpb24gYW5pbWF0aW9uLlxuICB0aGlzLnRhcmdldEFuZ2xlXyA9IG51bGw7XG4gIHRoaXMuYW5nbGVBbmltYXRpb25fID0gbnVsbDtcblxuICAvLyBTdGF0ZSB2YXJpYWJsZXMgZm9yIGNhbGN1bGF0aW9ucy5cbiAgdGhpcy5vcmllbnRhdGlvbl8gPSBuZXcgTWF0aFV0aWwuUXVhdGVybmlvbigpO1xuXG4gIC8vIFZhcmlhYmxlcyBmb3IgbW91c2UtYmFzZWQgcm90YXRpb24uXG4gIHRoaXMucm90YXRlU3RhcnRfID0gbmV3IE1hdGhVdGlsLlZlY3RvcjIoKTtcbiAgdGhpcy5yb3RhdGVFbmRfID0gbmV3IE1hdGhVdGlsLlZlY3RvcjIoKTtcbiAgdGhpcy5yb3RhdGVEZWx0YV8gPSBuZXcgTWF0aFV0aWwuVmVjdG9yMigpO1xuICB0aGlzLmlzRHJhZ2dpbmdfID0gZmFsc2U7XG5cbiAgdGhpcy5vcmllbnRhdGlvbk91dF8gPSBuZXcgRmxvYXQzMkFycmF5KDQpO1xufVxuTW91c2VLZXlib2FyZFZSRGlzcGxheS5wcm90b3R5cGUgPSBuZXcgVlJEaXNwbGF5KCk7XG5cbk1vdXNlS2V5Ym9hcmRWUkRpc3BsYXkucHJvdG90eXBlLmdldEltbWVkaWF0ZVBvc2UgPSBmdW5jdGlvbigpIHtcbiAgdGhpcy5vcmllbnRhdGlvbl8uc2V0RnJvbUV1bGVyWVhaKHRoaXMucGhpXywgdGhpcy50aGV0YV8sIDApO1xuXG4gIHRoaXMub3JpZW50YXRpb25PdXRfWzBdID0gdGhpcy5vcmllbnRhdGlvbl8ueDtcbiAgdGhpcy5vcmllbnRhdGlvbk91dF9bMV0gPSB0aGlzLm9yaWVudGF0aW9uXy55O1xuICB0aGlzLm9yaWVudGF0aW9uT3V0X1syXSA9IHRoaXMub3JpZW50YXRpb25fLno7XG4gIHRoaXMub3JpZW50YXRpb25PdXRfWzNdID0gdGhpcy5vcmllbnRhdGlvbl8udztcblxuICByZXR1cm4ge1xuICAgIHBvc2l0aW9uOiBudWxsLFxuICAgIG9yaWVudGF0aW9uOiB0aGlzLm9yaWVudGF0aW9uT3V0XyxcbiAgICBsaW5lYXJWZWxvY2l0eTogbnVsbCxcbiAgICBsaW5lYXJBY2NlbGVyYXRpb246IG51bGwsXG4gICAgYW5ndWxhclZlbG9jaXR5OiBudWxsLFxuICAgIGFuZ3VsYXJBY2NlbGVyYXRpb246IG51bGxcbiAgfTtcbn07XG5cbk1vdXNlS2V5Ym9hcmRWUkRpc3BsYXkucHJvdG90eXBlLm9uS2V5RG93bl8gPSBmdW5jdGlvbihlKSB7XG4gIC8vIFRyYWNrIFdBU0QgYW5kIGFycm93IGtleXMuXG4gIGlmIChlLmtleUNvZGUgPT0gMzgpIHsgLy8gVXAga2V5LlxuICAgIHRoaXMuYW5pbWF0ZVBoaV8odGhpcy5waGlfICsgS0VZX1NQRUVEKTtcbiAgfSBlbHNlIGlmIChlLmtleUNvZGUgPT0gMzkpIHsgLy8gUmlnaHQga2V5LlxuICAgIHRoaXMuYW5pbWF0ZVRoZXRhXyh0aGlzLnRoZXRhXyAtIEtFWV9TUEVFRCk7XG4gIH0gZWxzZSBpZiAoZS5rZXlDb2RlID09IDQwKSB7IC8vIERvd24ga2V5LlxuICAgIHRoaXMuYW5pbWF0ZVBoaV8odGhpcy5waGlfIC0gS0VZX1NQRUVEKTtcbiAgfSBlbHNlIGlmIChlLmtleUNvZGUgPT0gMzcpIHsgLy8gTGVmdCBrZXkuXG4gICAgdGhpcy5hbmltYXRlVGhldGFfKHRoaXMudGhldGFfICsgS0VZX1NQRUVEKTtcbiAgfVxufTtcblxuTW91c2VLZXlib2FyZFZSRGlzcGxheS5wcm90b3R5cGUuYW5pbWF0ZVRoZXRhXyA9IGZ1bmN0aW9uKHRhcmdldEFuZ2xlKSB7XG4gIHRoaXMuYW5pbWF0ZUtleVRyYW5zaXRpb25zXygndGhldGFfJywgdGFyZ2V0QW5nbGUpO1xufTtcblxuTW91c2VLZXlib2FyZFZSRGlzcGxheS5wcm90b3R5cGUuYW5pbWF0ZVBoaV8gPSBmdW5jdGlvbih0YXJnZXRBbmdsZSkge1xuICAvLyBQcmV2ZW50IGxvb2tpbmcgdG9vIGZhciB1cCBvciBkb3duLlxuICB0YXJnZXRBbmdsZSA9IFV0aWwuY2xhbXAodGFyZ2V0QW5nbGUsIC1NYXRoLlBJLzIsIE1hdGguUEkvMik7XG4gIHRoaXMuYW5pbWF0ZUtleVRyYW5zaXRpb25zXygncGhpXycsIHRhcmdldEFuZ2xlKTtcbn07XG5cbi8qKlxuICogU3RhcnQgYW4gYW5pbWF0aW9uIHRvIHRyYW5zaXRpb24gYW4gYW5nbGUgZnJvbSBvbmUgdmFsdWUgdG8gYW5vdGhlci5cbiAqL1xuTW91c2VLZXlib2FyZFZSRGlzcGxheS5wcm90b3R5cGUuYW5pbWF0ZUtleVRyYW5zaXRpb25zXyA9IGZ1bmN0aW9uKGFuZ2xlTmFtZSwgdGFyZ2V0QW5nbGUpIHtcbiAgLy8gSWYgYW4gYW5pbWF0aW9uIGlzIGN1cnJlbnRseSBydW5uaW5nLCBjYW5jZWwgaXQuXG4gIGlmICh0aGlzLmFuZ2xlQW5pbWF0aW9uXykge1xuICAgIGNhbmNlbEFuaW1hdGlvbkZyYW1lKHRoaXMuYW5nbGVBbmltYXRpb25fKTtcbiAgfVxuICB2YXIgc3RhcnRBbmdsZSA9IHRoaXNbYW5nbGVOYW1lXTtcbiAgdmFyIHN0YXJ0VGltZSA9IG5ldyBEYXRlKCk7XG4gIC8vIFNldCB1cCBhbiBpbnRlcnZhbCB0aW1lciB0byBwZXJmb3JtIHRoZSBhbmltYXRpb24uXG4gIHRoaXMuYW5nbGVBbmltYXRpb25fID0gcmVxdWVzdEFuaW1hdGlvbkZyYW1lKGZ1bmN0aW9uIGFuaW1hdGUoKSB7XG4gICAgLy8gT25jZSB3ZSdyZSBmaW5pc2hlZCB0aGUgYW5pbWF0aW9uLCB3ZSdyZSBkb25lLlxuICAgIHZhciBlbGFwc2VkID0gbmV3IERhdGUoKSAtIHN0YXJ0VGltZTtcbiAgICBpZiAoZWxhcHNlZCA+PSBLRVlfQU5JTUFUSU9OX0RVUkFUSU9OKSB7XG4gICAgICB0aGlzW2FuZ2xlTmFtZV0gPSB0YXJnZXRBbmdsZTtcbiAgICAgIGNhbmNlbEFuaW1hdGlvbkZyYW1lKHRoaXMuYW5nbGVBbmltYXRpb25fKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgLy8gbG9vcCB3aXRoIHJlcXVlc3RBbmltYXRpb25GcmFtZVxuICAgIHRoaXMuYW5nbGVBbmltYXRpb25fID0gcmVxdWVzdEFuaW1hdGlvbkZyYW1lKGFuaW1hdGUuYmluZCh0aGlzKSlcbiAgICAvLyBMaW5lYXJseSBpbnRlcnBvbGF0ZSB0aGUgYW5nbGUgc29tZSBhbW91bnQuXG4gICAgdmFyIHBlcmNlbnQgPSBlbGFwc2VkIC8gS0VZX0FOSU1BVElPTl9EVVJBVElPTjtcbiAgICB0aGlzW2FuZ2xlTmFtZV0gPSBzdGFydEFuZ2xlICsgKHRhcmdldEFuZ2xlIC0gc3RhcnRBbmdsZSkgKiBwZXJjZW50O1xuICB9LmJpbmQodGhpcykpO1xufTtcblxuTW91c2VLZXlib2FyZFZSRGlzcGxheS5wcm90b3R5cGUub25Nb3VzZURvd25fID0gZnVuY3Rpb24oZSkge1xuICB0aGlzLnJvdGF0ZVN0YXJ0Xy5zZXQoZS5jbGllbnRYLCBlLmNsaWVudFkpO1xuICB0aGlzLmlzRHJhZ2dpbmdfID0gdHJ1ZTtcbn07XG5cbi8vIFZlcnkgc2ltaWxhciB0byBodHRwczovL2dpc3QuZ2l0aHViLmNvbS9tcmZsaXgvODM1MTAyMFxuTW91c2VLZXlib2FyZFZSRGlzcGxheS5wcm90b3R5cGUub25Nb3VzZU1vdmVfID0gZnVuY3Rpb24oZSkge1xuICBpZiAoIXRoaXMuaXNEcmFnZ2luZ18gJiYgIXRoaXMuaXNQb2ludGVyTG9ja2VkXygpKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIC8vIFN1cHBvcnQgcG9pbnRlciBsb2NrIEFQSS5cbiAgaWYgKHRoaXMuaXNQb2ludGVyTG9ja2VkXygpKSB7XG4gICAgdmFyIG1vdmVtZW50WCA9IGUubW92ZW1lbnRYIHx8IGUubW96TW92ZW1lbnRYIHx8IDA7XG4gICAgdmFyIG1vdmVtZW50WSA9IGUubW92ZW1lbnRZIHx8IGUubW96TW92ZW1lbnRZIHx8IDA7XG4gICAgdGhpcy5yb3RhdGVFbmRfLnNldCh0aGlzLnJvdGF0ZVN0YXJ0Xy54IC0gbW92ZW1lbnRYLCB0aGlzLnJvdGF0ZVN0YXJ0Xy55IC0gbW92ZW1lbnRZKTtcbiAgfSBlbHNlIHtcbiAgICB0aGlzLnJvdGF0ZUVuZF8uc2V0KGUuY2xpZW50WCwgZS5jbGllbnRZKTtcbiAgfVxuICAvLyBDYWxjdWxhdGUgaG93IG11Y2ggd2UgbW92ZWQgaW4gbW91c2Ugc3BhY2UuXG4gIHRoaXMucm90YXRlRGVsdGFfLnN1YlZlY3RvcnModGhpcy5yb3RhdGVFbmRfLCB0aGlzLnJvdGF0ZVN0YXJ0Xyk7XG4gIHRoaXMucm90YXRlU3RhcnRfLmNvcHkodGhpcy5yb3RhdGVFbmRfKTtcblxuICAvLyBLZWVwIHRyYWNrIG9mIHRoZSBjdW11bGF0aXZlIGV1bGVyIGFuZ2xlcy5cbiAgdGhpcy5waGlfICs9IDIgKiBNYXRoLlBJICogdGhpcy5yb3RhdGVEZWx0YV8ueSAvIHNjcmVlbi5oZWlnaHQgKiBNT1VTRV9TUEVFRF9ZO1xuICB0aGlzLnRoZXRhXyArPSAyICogTWF0aC5QSSAqIHRoaXMucm90YXRlRGVsdGFfLnggLyBzY3JlZW4ud2lkdGggKiBNT1VTRV9TUEVFRF9YO1xuXG4gIC8vIFByZXZlbnQgbG9va2luZyB0b28gZmFyIHVwIG9yIGRvd24uXG4gIHRoaXMucGhpXyA9IFV0aWwuY2xhbXAodGhpcy5waGlfLCAtTWF0aC5QSS8yLCBNYXRoLlBJLzIpO1xufTtcblxuTW91c2VLZXlib2FyZFZSRGlzcGxheS5wcm90b3R5cGUub25Nb3VzZVVwXyA9IGZ1bmN0aW9uKGUpIHtcbiAgdGhpcy5pc0RyYWdnaW5nXyA9IGZhbHNlO1xufTtcblxuTW91c2VLZXlib2FyZFZSRGlzcGxheS5wcm90b3R5cGUuaXNQb2ludGVyTG9ja2VkXyA9IGZ1bmN0aW9uKCkge1xuICB2YXIgZWwgPSBkb2N1bWVudC5wb2ludGVyTG9ja0VsZW1lbnQgfHwgZG9jdW1lbnQubW96UG9pbnRlckxvY2tFbGVtZW50IHx8XG4gICAgICBkb2N1bWVudC53ZWJraXRQb2ludGVyTG9ja0VsZW1lbnQ7XG4gIHJldHVybiBlbCAhPT0gdW5kZWZpbmVkO1xufTtcblxuTW91c2VLZXlib2FyZFZSRGlzcGxheS5wcm90b3R5cGUucmVzZXRQb3NlID0gZnVuY3Rpb24oKSB7XG4gIHRoaXMucGhpXyA9IDA7XG4gIHRoaXMudGhldGFfID0gMDtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gTW91c2VLZXlib2FyZFZSRGlzcGxheTtcbiIsIi8qXG4gKiBDb3B5cmlnaHQgMjAxNSBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICogTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcbiAqIHlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cbiAqIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuICpcbiAqICAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcbiAqXG4gKiBVbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG4gKiBkaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG4gKiBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cbiAqIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbiAqIGxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuICovXG5cbnZhciBVdGlsID0gcmVxdWlyZSgnLi91dGlsLmpzJyk7XG5cbmZ1bmN0aW9uIFJvdGF0ZUluc3RydWN0aW9ucygpIHtcbiAgdGhpcy5sb2FkSWNvbl8oKTtcblxuICB2YXIgb3ZlcmxheSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICB2YXIgcyA9IG92ZXJsYXkuc3R5bGU7XG4gIHMucG9zaXRpb24gPSAnZml4ZWQnO1xuICBzLnRvcCA9IDA7XG4gIHMucmlnaHQgPSAwO1xuICBzLmJvdHRvbSA9IDA7XG4gIHMubGVmdCA9IDA7XG4gIHMuYmFja2dyb3VuZENvbG9yID0gJ2dyYXknO1xuICBzLmZvbnRGYW1pbHkgPSAnc2Fucy1zZXJpZic7XG4gIC8vIEZvcmNlIHRoaXMgdG8gYmUgYWJvdmUgdGhlIGZ1bGxzY3JlZW4gY2FudmFzLCB3aGljaCBpcyBhdCB6SW5kZXg6IDk5OTk5OS5cbiAgcy56SW5kZXggPSAxMDAwMDAwO1xuXG4gIHZhciBpbWcgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdpbWcnKTtcbiAgaW1nLnNyYyA9IHRoaXMuaWNvbjtcbiAgdmFyIHMgPSBpbWcuc3R5bGU7XG4gIHMubWFyZ2luTGVmdCA9ICcyNSUnO1xuICBzLm1hcmdpblRvcCA9ICcyNSUnO1xuICBzLndpZHRoID0gJzUwJSc7XG4gIG92ZXJsYXkuYXBwZW5kQ2hpbGQoaW1nKTtcblxuICB2YXIgdGV4dCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICB2YXIgcyA9IHRleHQuc3R5bGU7XG4gIHMudGV4dEFsaWduID0gJ2NlbnRlcic7XG4gIHMuZm9udFNpemUgPSAnMTZweCc7XG4gIHMubGluZUhlaWdodCA9ICcyNHB4JztcbiAgcy5tYXJnaW4gPSAnMjRweCAyNSUnO1xuICBzLndpZHRoID0gJzUwJSc7XG4gIHRleHQuaW5uZXJIVE1MID0gJ1BsYWNlIHlvdXIgcGhvbmUgaW50byB5b3VyIENhcmRib2FyZCB2aWV3ZXIuJztcbiAgb3ZlcmxheS5hcHBlbmRDaGlsZCh0ZXh0KTtcblxuICB2YXIgc25hY2tiYXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgdmFyIHMgPSBzbmFja2Jhci5zdHlsZTtcbiAgcy5iYWNrZ3JvdW5kQ29sb3IgPSAnI0NGRDhEQyc7XG4gIHMucG9zaXRpb24gPSAnZml4ZWQnO1xuICBzLmJvdHRvbSA9IDA7XG4gIHMud2lkdGggPSAnMTAwJSc7XG4gIHMuaGVpZ2h0ID0gJzQ4cHgnO1xuICBzLnBhZGRpbmcgPSAnMTRweCAyNHB4JztcbiAgcy5ib3hTaXppbmcgPSAnYm9yZGVyLWJveCc7XG4gIHMuY29sb3IgPSAnIzY1NkE2Qic7XG4gIG92ZXJsYXkuYXBwZW5kQ2hpbGQoc25hY2tiYXIpO1xuXG4gIHZhciBzbmFja2JhclRleHQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgc25hY2tiYXJUZXh0LnN0eWxlLmZsb2F0ID0gJ2xlZnQnO1xuICBzbmFja2JhclRleHQuaW5uZXJIVE1MID0gJ05vIENhcmRib2FyZCB2aWV3ZXI/JztcblxuICB2YXIgc25hY2tiYXJCdXR0b24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdhJyk7XG4gIHNuYWNrYmFyQnV0dG9uLmhyZWYgPSAnaHR0cHM6Ly93d3cuZ29vZ2xlLmNvbS9nZXQvY2FyZGJvYXJkL2dldC1jYXJkYm9hcmQvJztcbiAgc25hY2tiYXJCdXR0b24uaW5uZXJIVE1MID0gJ2dldCBvbmUnO1xuICBzbmFja2JhckJ1dHRvbi50YXJnZXQgPSAnX2JsYW5rJztcbiAgdmFyIHMgPSBzbmFja2JhckJ1dHRvbi5zdHlsZTtcbiAgcy5mbG9hdCA9ICdyaWdodCc7XG4gIHMuZm9udFdlaWdodCA9IDYwMDtcbiAgcy50ZXh0VHJhbnNmb3JtID0gJ3VwcGVyY2FzZSc7XG4gIHMuYm9yZGVyTGVmdCA9ICcxcHggc29saWQgZ3JheSc7XG4gIHMucGFkZGluZ0xlZnQgPSAnMjRweCc7XG4gIHMudGV4dERlY29yYXRpb24gPSAnbm9uZSc7XG4gIHMuY29sb3IgPSAnIzY1NkE2Qic7XG5cbiAgc25hY2tiYXIuYXBwZW5kQ2hpbGQoc25hY2tiYXJUZXh0KTtcbiAgc25hY2tiYXIuYXBwZW5kQ2hpbGQoc25hY2tiYXJCdXR0b24pO1xuXG4gIHRoaXMub3ZlcmxheSA9IG92ZXJsYXk7XG4gIHRoaXMudGV4dCA9IHRleHQ7XG5cbiAgdGhpcy5oaWRlKCk7XG59XG5cblJvdGF0ZUluc3RydWN0aW9ucy5wcm90b3R5cGUuc2hvdyA9IGZ1bmN0aW9uKHBhcmVudCkge1xuICBpZiAoIXBhcmVudCAmJiAhdGhpcy5vdmVybGF5LnBhcmVudEVsZW1lbnQpIHtcbiAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHRoaXMub3ZlcmxheSk7XG4gIH0gZWxzZSBpZiAocGFyZW50KSB7XG4gICAgaWYgKHRoaXMub3ZlcmxheS5wYXJlbnRFbGVtZW50ICYmIHRoaXMub3ZlcmxheS5wYXJlbnRFbGVtZW50ICE9IHBhcmVudClcbiAgICAgIHRoaXMub3ZlcmxheS5wYXJlbnRFbGVtZW50LnJlbW92ZUNoaWxkKHRoaXMub3ZlcmxheSk7XG5cbiAgICBwYXJlbnQuYXBwZW5kQ2hpbGQodGhpcy5vdmVybGF5KTtcbiAgfVxuXG4gIHRoaXMub3ZlcmxheS5zdHlsZS5kaXNwbGF5ID0gJ2Jsb2NrJztcblxuICB2YXIgaW1nID0gdGhpcy5vdmVybGF5LnF1ZXJ5U2VsZWN0b3IoJ2ltZycpO1xuICB2YXIgcyA9IGltZy5zdHlsZTtcblxuICBpZiAoVXRpbC5pc0xhbmRzY2FwZU1vZGUoKSkge1xuICAgIHMud2lkdGggPSAnMjAlJztcbiAgICBzLm1hcmdpbkxlZnQgPSAnNDAlJztcbiAgICBzLm1hcmdpblRvcCA9ICczJSc7XG4gIH0gZWxzZSB7XG4gICAgcy53aWR0aCA9ICc1MCUnO1xuICAgIHMubWFyZ2luTGVmdCA9ICcyNSUnO1xuICAgIHMubWFyZ2luVG9wID0gJzI1JSc7XG4gIH1cbn07XG5cblJvdGF0ZUluc3RydWN0aW9ucy5wcm90b3R5cGUuaGlkZSA9IGZ1bmN0aW9uKCkge1xuICB0aGlzLm92ZXJsYXkuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbn07XG5cblJvdGF0ZUluc3RydWN0aW9ucy5wcm90b3R5cGUuc2hvd1RlbXBvcmFyaWx5ID0gZnVuY3Rpb24obXMsIHBhcmVudCkge1xuICB0aGlzLnNob3cocGFyZW50KTtcbiAgdGhpcy50aW1lciA9IHNldFRpbWVvdXQodGhpcy5oaWRlLmJpbmQodGhpcyksIG1zKTtcbn07XG5cblJvdGF0ZUluc3RydWN0aW9ucy5wcm90b3R5cGUuZGlzYWJsZVNob3dUZW1wb3JhcmlseSA9IGZ1bmN0aW9uKCkge1xuICBjbGVhclRpbWVvdXQodGhpcy50aW1lcik7XG59O1xuXG5Sb3RhdGVJbnN0cnVjdGlvbnMucHJvdG90eXBlLnVwZGF0ZSA9IGZ1bmN0aW9uKCkge1xuICB0aGlzLmRpc2FibGVTaG93VGVtcG9yYXJpbHkoKTtcbiAgLy8gSW4gcG9ydHJhaXQgVlIgbW9kZSwgdGVsbCB0aGUgdXNlciB0byByb3RhdGUgdG8gbGFuZHNjYXBlLiBPdGhlcndpc2UsIGhpZGVcbiAgLy8gdGhlIGluc3RydWN0aW9ucy5cbiAgaWYgKCFVdGlsLmlzTGFuZHNjYXBlTW9kZSgpICYmIFV0aWwuaXNNb2JpbGUoKSkge1xuICAgIHRoaXMuc2hvdygpO1xuICB9IGVsc2Uge1xuICAgIHRoaXMuaGlkZSgpO1xuICB9XG59O1xuXG5Sb3RhdGVJbnN0cnVjdGlvbnMucHJvdG90eXBlLmxvYWRJY29uXyA9IGZ1bmN0aW9uKCkge1xuICAvLyBFbmNvZGVkIGFzc2V0X3NyYy9yb3RhdGUtaW5zdHJ1Y3Rpb25zLnN2Z1xuICB0aGlzLmljb24gPSBVdGlsLmJhc2U2NCgnaW1hZ2Uvc3ZnK3htbCcsICdQRDk0Yld3Z2RtVnljMmx2YmowaU1TNHdJaUJsYm1OdlpHbHVaejBpVlZSR0xUZ2lJSE4wWVc1a1lXeHZibVU5SW01dklqOCtDanh6ZG1jZ2QybGtkR2c5SWpFNU9IQjRJaUJvWldsbmFIUTlJakkwTUhCNElpQjJhV1YzUW05NFBTSXdJREFnTVRrNElESTBNQ0lnZG1WeWMybHZiajBpTVM0eElpQjRiV3h1Y3owaWFIUjBjRG92TDNkM2R5NTNNeTV2Y21jdk1qQXdNQzl6ZG1jaUlIaHRiRzV6T25oc2FXNXJQU0pvZEhSd09pOHZkM2QzTG5jekxtOXlaeTh4T1RrNUwzaHNhVzVySWlCNGJXeHVjenB6YTJWMFkyZzlJbWgwZEhBNkx5OTNkM2N1WW05b1pXMXBZVzVqYjJScGJtY3VZMjl0TDNOclpYUmphQzl1Y3lJK0NpQWdJQ0E4SVMwdElFZGxibVZ5WVhSdmNqb2dVMnRsZEdOb0lETXVNeTR6SUNneE1qQTRNU2tnTFNCb2RIUndPaTh2ZDNkM0xtSnZhR1Z0YVdGdVkyOWthVzVuTG1OdmJTOXphMlYwWTJnZ0xTMCtDaUFnSUNBOGRHbDBiR1UrZEhKaGJuTnBkR2x2Ymp3dmRHbDBiR1UrQ2lBZ0lDQThaR1Z6WXo1RGNtVmhkR1ZrSUhkcGRHZ2dVMnRsZEdOb0xqd3ZaR1Z6WXo0S0lDQWdJRHhrWldaelBqd3ZaR1ZtY3o0S0lDQWdJRHhuSUdsa1BTSlFZV2RsTFRFaUlITjBjbTlyWlQwaWJtOXVaU0lnYzNSeWIydGxMWGRwWkhSb1BTSXhJaUJtYVd4c1BTSnViMjVsSWlCbWFXeHNMWEoxYkdVOUltVjJaVzV2WkdRaUlITnJaWFJqYURwMGVYQmxQU0pOVTFCaFoyVWlQZ29nSUNBZ0lDQWdJRHhuSUdsa1BTSjBjbUZ1YzJsMGFXOXVJaUJ6YTJWMFkyZzZkSGx3WlQwaVRWTkJjblJpYjJGeVpFZHliM1Z3SWo0S0lDQWdJQ0FnSUNBZ0lDQWdQR2NnYVdROUlrbHRjRzl5ZEdWa0xVeGhlV1Z5Y3kxRGIzQjVMVFF0S3kxSmJYQnZjblJsWkMxTVlYbGxjbk10UTI5d2VTMHJMVWx0Y0c5eWRHVmtMVXhoZVdWeWN5MURiM0I1TFRJdFEyOXdlU0lnYzJ0bGRHTm9PblI1Y0dVOUlrMVRUR0Y1WlhKSGNtOTFjQ0krQ2lBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0E4WnlCcFpEMGlTVzF3YjNKMFpXUXRUR0Y1WlhKekxVTnZjSGt0TkNJZ2RISmhibk5tYjNKdFBTSjBjbUZ1YzJ4aGRHVW9NQzR3TURBd01EQXNJREV3Tnk0d01EQXdNREFwSWlCemEyVjBZMmc2ZEhsd1pUMGlUVk5UYUdGd1pVZHliM1Z3SWo0S0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQThjR0YwYUNCa1BTSk5NVFE1TGpZeU5Td3lMalV5TnlCRE1UUTVMall5TlN3eUxqVXlOeUF4TlRVdU9EQTFMRFl1TURrMklERTFOaTR6TmpJc05pNDBNVGdnVERFMU5pNHpOaklzTnk0ek1EUWdRekUxTmk0ek5qSXNOeTQwT0RFZ01UVTJMak0zTlN3M0xqWTJOQ0F4TlRZdU5DdzNMamcxTXlCRE1UVTJMalF4TERjdU9UTTBJREUxTmk0ME1pdzRMakF4TlNBeE5UWXVOREkzTERndU1EazFJRU14TlRZdU5UWTNMRGt1TlRFZ01UVTNMalF3TVN3eE1TNHdPVE1nTVRVNExqVXpNaXd4TWk0d09UUWdUREUyTkM0eU5USXNNVGN1TVRVMklFd3hOalF1TXpNekxERTNMakEyTmlCRE1UWTBMak16TXl3eE55NHdOallnTVRZNExqY3hOU3d4TkM0MU16WWdNVFk1TGpVMk9Dd3hOQzR3TkRJZ1F6RTNNUzR3TWpVc01UUXVPRGd6SURFNU5TNDFNemdzTWprdU1ETTFJREU1TlM0MU16Z3NNamt1TURNMUlFd3hPVFV1TlRNNExEZ3pMakF6TmlCRE1UazFMalV6T0N3NE15NDRNRGNnTVRrMUxqRTFNaXc0TkM0eU5UTWdNVGswTGpVNUxEZzBMakkxTXlCRE1UazBMak0xTnl3NE5DNHlOVE1nTVRrMExqQTVOU3c0TkM0eE56Y2dNVGt6TGpneE9DdzROQzR3TVRjZ1RERTJPUzQ0TlRFc056QXVNVGM1SUV3eE5qa3VPRE0zTERjd0xqSXdNeUJNTVRReUxqVXhOU3c0TlM0NU56Z2dUREUwTVM0Mk5qVXNPRFF1TmpVMUlFTXhNell1T1RNMExEZ3pMakV5TmlBeE16RXVPVEUzTERneExqa3hOU0F4TWpZdU56RTBMRGd4TGpBME5TQkRNVEkyTGpjd09TdzRNUzR3TmlBeE1qWXVOekEzTERneExqQTJPU0F4TWpZdU56QTNMRGd4TGpBMk9TQk1NVEl4TGpZMExEazRMakF6SUV3eE1UTXVOelE1TERFd01pNDFPRFlnVERFeE15NDNNVElzTVRBeUxqVXlNeUJNTVRFekxqY3hNaXd4TXpBdU1URXpJRU14TVRNdU56RXlMREV6TUM0NE9EVWdNVEV6TGpNeU5pd3hNekV1TXpNZ01URXlMamMyTkN3eE16RXVNek1nUXpFeE1pNDFNeklzTVRNeExqTXpJREV4TWk0eU5qa3NNVE14TGpJMU5DQXhNVEV1T1RreUxERXpNUzR3T1RRZ1REWTVMalV4T1N3eE1EWXVOVGN5SUVNMk9DNDFOamtzTVRBMkxqQXlNeUEyTnk0M09Ua3NNVEEwTGpZNU5TQTJOeTQzT1Rrc01UQXpMall3TlNCTU5qY3VOems1TERFd01pNDFOeUJNTmpjdU56YzRMREV3TWk0Mk1UY2dRelkzTGpJM0xERXdNaTR6T1RNZ05qWXVOalE0TERFd01pNHlORGtnTmpVdU9UWXlMREV3TWk0eU1UZ2dRelkxTGpnM05Td3hNREl1TWpFMElEWTFMamM0T0N3eE1ESXVNakV5SURZMUxqY3dNU3d4TURJdU1qRXlJRU0yTlM0Mk1EWXNNVEF5TGpJeE1pQTJOUzQxTVRFc01UQXlMakl4TlNBMk5TNDBNVFlzTVRBeUxqSXhPU0JETmpVdU1UazFMREV3TWk0eU1qa2dOalF1T1RjMExERXdNaTR5TXpVZ05qUXVOelUwTERFd01pNHlNelVnUXpZMExqTXpNU3d4TURJdU1qTTFJRFl6TGpreE1Td3hNREl1TWpFMklEWXpMalE1T0N3eE1ESXVNVGM0SUVNMk1TNDRORE1zTVRBeUxqQXlOU0EyTUM0eU9UZ3NNVEF4TGpVM09DQTFPUzR3T1RRc01UQXdMamc0TWlCTU1USXVOVEU0TERjekxqazVNaUJNTVRJdU5USXpMRGMwTGpBd05DQk1NaTR5TkRVc05UVXVNalUwSUVNeExqSTBOQ3cxTXk0ME1qY2dNaTR3TURRc05URXVNRE00SURNdU9UUXpMRFE1TGpreE9DQk1OVGt1T1RVMExERTNMalUzTXlCRE5qQXVOakkyTERFM0xqRTROU0EyTVM0ek5Td3hOeTR3TURFZ05qSXVNRFV6TERFM0xqQXdNU0JETmpNdU16YzVMREUzTGpBd01TQTJOQzQyTWpVc01UY3VOallnTmpVdU1qZ3NNVGd1T0RVMElFdzJOUzR5T0RVc01UZ3VPRFV4SUV3Mk5TNDFNVElzTVRrdU1qWTBJRXcyTlM0MU1EWXNNVGt1TWpZNElFTTJOUzQ1TURrc01qQXVNREF6SURZMkxqUXdOU3d5TUM0Mk9DQTJOaTQ1T0RNc01qRXVNamcySUV3Mk55NHlOaXd5TVM0MU5UWWdRelk1TGpFM05Dd3lNeTQwTURZZ056RXVOekk0TERJMExqTTFOeUEzTkM0ek56TXNNalF1TXpVM0lFTTNOaTR6TWpJc01qUXVNelUzSURjNExqTXlNU3d5TXk0NE5DQTRNQzR4TkRnc01qSXVOemcxSUVNNE1DNHhOakVzTWpJdU56ZzFJRGczTGpRMk55d3hPQzQxTmpZZ09EY3VORFkzTERFNExqVTJOaUJET0RndU1UTTVMREU0TGpFM09DQTRPQzQ0TmpNc01UY3VPVGswSURnNUxqVTJOaXd4Tnk0NU9UUWdRemt3TGpnNU1pd3hOeTQ1T1RRZ09USXVNVE00TERFNExqWTFNaUE1TWk0M09USXNNVGt1T0RRM0lFdzVOaTR3TkRJc01qVXVOemMxSUV3NU5pNHdOalFzTWpVdU56VTNJRXd4TURJdU9EUTVMREk1TGpZM05DQk1NVEF5TGpjME5Dd3lPUzQwT1RJZ1RERTBPUzQyTWpVc01pNDFNamNnVFRFME9TNDJNalVzTUM0NE9USWdRekUwT1M0ek5ETXNNQzQ0T1RJZ01UUTVMakEyTWl3d0xqazJOU0F4TkRndU9ERXNNUzR4TVNCTU1UQXlMalkwTVN3eU55NDJOallnVERrM0xqSXpNU3d5TkM0MU5ESWdURGswTGpJeU5pd3hPUzR3TmpFZ1F6a3pMak14TXl3eE55NHpPVFFnT1RFdU5USTNMREUyTGpNMU9TQTRPUzQxTmpZc01UWXVNelU0SUVNNE9DNDFOVFVzTVRZdU16VTRJRGczTGpVME5pd3hOaTQyTXpJZ09EWXVOalE1TERFM0xqRTFJRU00TXk0NE56Z3NNVGd1TnpVZ056a3VOamczTERJeExqRTJPU0EzT1M0ek56UXNNakV1TXpRMUlFTTNPUzR6TlRrc01qRXVNelV6SURjNUxqTTBOU3d5TVM0ek5qRWdOemt1TXpNc01qRXVNelk1SUVNM055NDNPVGdzTWpJdU1qVTBJRGMyTGpBNE5Dd3lNaTQzTWpJZ056UXVNemN6TERJeUxqY3lNaUJETnpJdU1EZ3hMREl5TGpjeU1pQTJPUzQ1TlRrc01qRXVPRGtnTmpndU16azNMREl3TGpNNElFdzJPQzR4TkRVc01qQXVNVE0xSUVNMk55NDNNRFlzTVRrdU5qY3lJRFkzTGpNeU15d3hPUzR4TlRZZ05qY3VNREEyTERFNExqWXdNU0JETmpZdU9UZzRMREU0TGpVMU9TQTJOaTQ1Tmpnc01UZ3VOVEU1SURZMkxqazBOaXd4T0M0ME56a2dURFkyTGpjeE9Td3hPQzR3TmpVZ1F6WTJMalk1TERFNExqQXhNaUEyTmk0Mk5UZ3NNVGN1T1RZZ05qWXVOakkwTERFM0xqa3hNU0JETmpVdU5qZzJMREUyTGpNek55QTJNeTQ1TlRFc01UVXVNelkySURZeUxqQTFNeXd4TlM0ek5qWWdRell4TGpBME1pd3hOUzR6TmpZZ05qQXVNRE16TERFMUxqWTBJRFU1TGpFek5pd3hOaTR4TlRnZ1RETXVNVEkxTERRNExqVXdNaUJETUM0ME1qWXNOVEF1TURZeElDMHdMall4TXl3MU15NDBORElnTUM0NE1URXNOVFl1TURRZ1RERXhMakE0T1N3M05DNDNPU0JETVRFdU1qWTJMRGMxTGpFeE15QXhNUzQxTXpjc056VXVNelV6SURFeExqZzFMRGMxTGpRNU5DQk1OVGd1TWpjMkxERXdNaTR5T1RnZ1F6VTVMalkzT1N3eE1ETXVNVEE0SURZeExqUXpNeXd4TURNdU5qTWdOak11TXpRNExERXdNeTQ0TURZZ1F6WXpMamd4TWl3eE1ETXVPRFE0SURZMExqSTROU3d4TURNdU9EY2dOalF1TnpVMExERXdNeTQ0TnlCRE5qVXNNVEF6TGpnM0lEWTFMakkwT1N3eE1ETXVPRFkwSURZMUxqUTVOQ3d4TURNdU9EVXlJRU0yTlM0MU5qTXNNVEF6TGpnME9TQTJOUzQyTXpJc01UQXpMamcwTnlBMk5TNDNNREVzTVRBekxqZzBOeUJETmpVdU56WTBMREV3TXk0NE5EY2dOalV1T0RJNExERXdNeTQ0TkRrZ05qVXVPRGtzTVRBekxqZzFNaUJETmpVdU9UZzJMREV3TXk0NE5UWWdOall1TURnc01UQXpMamcyTXlBMk5pNHhOek1zTVRBekxqZzNOQ0JETmpZdU1qZ3lMREV3TlM0ME5qY2dOamN1TXpNeUxERXdOeTR4T1RjZ05qZ3VOekF5TERFd055NDVPRGdnVERFeE1TNHhOelFzTVRNeUxqVXhJRU14TVRFdU5qazRMREV6TWk0NE1USWdNVEV5TGpJek1pd3hNekl1T1RZMUlERXhNaTQzTmpRc01UTXlMamsyTlNCRE1URTBMakkyTVN3eE16SXVPVFkxSURFeE5TNHpORGNzTVRNeExqYzJOU0F4TVRVdU16UTNMREV6TUM0eE1UTWdUREV4TlM0ek5EY3NNVEF6TGpVMU1TQk1NVEl5TGpRMU9DdzVPUzQwTkRZZ1F6RXlNaTQ0TVRrc09Ua3VNak0zSURFeU15NHdPRGNzT1RndU9EazRJREV5TXk0eU1EY3NPVGd1TkRrNElFd3hNamN1T0RZMUxEZ3lMamt3TlNCRE1UTXlMakkzT1N3NE15NDNNRElnTVRNMkxqVTFOeXc0TkM0M05UTWdNVFF3TGpZd055dzROaTR3TXpNZ1RERTBNUzR4TkN3NE5pNDROaklnUXpFME1TNDBOVEVzT0RjdU16UTJJREUwTVM0NU56Y3NPRGN1TmpFeklERTBNaTQxTVRZc09EY3VOakV6SUVNeE5ESXVOemswTERnM0xqWXhNeUF4TkRNdU1EYzJMRGczTGpVME1pQXhORE11TXpNekxEZzNMak01TXlCTU1UWTVMamcyTlN3M01pNHdOellnVERFNU15dzROUzQwTXpNZ1F6RTVNeTQxTWpNc09EVXVOek0xSURFNU5DNHdOVGdzT0RVdU9EZzRJREU1TkM0MU9TdzROUzQ0T0RnZ1F6RTVOaTR3T0Rjc09EVXVPRGc0SURFNU55NHhOek1zT0RRdU5qZzVJREU1Tnk0eE56TXNPRE11TURNMklFd3hPVGN1TVRjekxESTVMakF6TlNCRE1UazNMakUzTXl3eU9DNDBOVEVnTVRrMkxqZzJNU3d5Tnk0NU1URWdNVGsyTGpNMU5Td3lOeTQyTVRrZ1F6RTVOaTR6TlRVc01qY3VOakU1SURFM01TNDRORE1zTVRNdU5EWTNJREUzTUM0ek9EVXNNVEl1TmpJMklFTXhOekF1TVRNeUxERXlMalE0SURFMk9TNDROU3d4TWk0ME1EY2dNVFk1TGpVMk9Dd3hNaTQwTURjZ1F6RTJPUzR5T0RVc01USXVOREEzSURFMk9TNHdNRElzTVRJdU5EZ3hJREUyT0M0M05Ea3NNVEl1TmpJM0lFTXhOamd1TVRRekxERXlMamszT0NBeE5qVXVOelUyTERFMExqTTFOeUF4TmpRdU5ESTBMREUxTGpFeU5TQk1NVFU1TGpZeE5Td3hNQzQ0TnlCRE1UVTRMamM1Tml3eE1DNHhORFVnTVRVNExqRTFOQ3c0TGprek55QXhOVGd1TURVMExEY3VPVE0wSUVNeE5UZ3VNRFExTERjdU9ETTNJREUxT0M0d016UXNOeTQzTXprZ01UVTRMakF5TVN3M0xqWTBJRU14TlRndU1EQTFMRGN1TlRJeklERTFOeTQ1T1Rnc055NDBNU0F4TlRjdU9UazRMRGN1TXpBMElFd3hOVGN1T1RrNExEWXVOREU0SUVNeE5UY3VPVGs0TERVdU9ETTBJREUxTnk0Mk9EWXNOUzR5T1RVZ01UVTNMakU0TVN3MUxqQXdNaUJETVRVMkxqWXlOQ3cwTGpZNElERTFNQzQwTkRJc01TNHhNVEVnTVRVd0xqUTBNaXd4TGpFeE1TQkRNVFV3TGpFNE9Td3dMamsyTlNBeE5Ea3VPVEEzTERBdU9Ea3lJREUwT1M0Mk1qVXNNQzQ0T1RJaUlHbGtQU0pHYVd4c0xURWlJR1pwYkd3OUlpTTBOVFZCTmpRaVBqd3ZjR0YwYUQ0S0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQThjR0YwYUNCa1BTSk5PVFl1TURJM0xESTFMall6TmlCTU1UUXlMall3TXl3MU1pNDFNamNnUXpFME15NDRNRGNzTlRNdU1qSXlJREUwTkM0MU9ESXNOVFF1TVRFMElERTBOQzQ0TkRVc05UVXVNRFk0SUV3eE5EUXVPRE0xTERVMUxqQTNOU0JNTmpNdU5EWXhMREV3TWk0d05UY2dURFl6TGpRMkxERXdNaTR3TlRjZ1F6WXhMamd3Tml3eE1ERXVPVEExSURZd0xqSTJNU3d4TURFdU5EVTNJRFU1TGpBMU55d3hNREF1TnpZeUlFd3hNaTQwT0RFc056TXVPRGN4SUV3NU5pNHdNamNzTWpVdU5qTTJJaUJwWkQwaVJtbHNiQzB5SWlCbWFXeHNQU0lqUmtGR1FVWkJJajQ4TDNCaGRHZytDaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnUEhCaGRHZ2daRDBpVFRZekxqUTJNU3d4TURJdU1UYzBJRU0yTXk0ME5UTXNNVEF5TGpFM05DQTJNeTQwTkRZc01UQXlMakUzTkNBMk15NDBNemtzTVRBeUxqRTNNaUJETmpFdU56UTJMREV3TWk0d01UWWdOakF1TWpFeExERXdNUzQxTmpNZ05UZ3VPVGs0TERFd01DNDROak1nVERFeUxqUXlNaXczTXk0NU56TWdRekV5TGpNNE5pdzNNeTQ1TlRJZ01USXVNelkwTERjekxqa3hOQ0F4TWk0ek5qUXNOek11T0RjeElFTXhNaTR6TmpRc056TXVPRE1nTVRJdU16ZzJMRGN6TGpjNU1TQXhNaTQwTWpJc056TXVOemNnVERrMUxqazJPQ3d5TlM0MU16VWdRemsyTGpBd05Dd3lOUzQxTVRRZ09UWXVNRFE1TERJMUxqVXhOQ0E1Tmk0d09EVXNNalV1TlRNMUlFd3hOREl1TmpZeExEVXlMalF5TmlCRE1UUXpMamc0T0N3MU15NHhNelFnTVRRMExqWTRNaXcxTkM0d016Z2dNVFEwTGprMU55dzFOUzR3TXpjZ1F6RTBOQzQ1Tnl3MU5TNHdPRE1nTVRRMExqazFNeXcxTlM0eE16TWdNVFEwTGpreE5TdzFOUzR4TmpFZ1F6RTBOQzQ1TVRFc05UVXVNVFkxSURFME5DNDRPVGdzTlRVdU1UYzBJREUwTkM0NE9UUXNOVFV1TVRjM0lFdzJNeTQxTVRrc01UQXlMakUxT0NCRE5qTXVOVEF4TERFd01pNHhOamtnTmpNdU5EZ3hMREV3TWk0eE56UWdOak11TkRZeExERXdNaTR4TnpRZ1REWXpMalEyTVN3eE1ESXVNVGMwSUZvZ1RURXlMamN4TkN3M015NDROekVnVERVNUxqRXhOU3d4TURBdU5qWXhJRU0yTUM0eU9UTXNNVEF4TGpNME1TQTJNUzQzT0RZc01UQXhMamM0TWlBMk15NDBNelVzTVRBeExqa3pOeUJNTVRRMExqY3dOeXcxTlM0d01UVWdRekUwTkM0ME1qZ3NOVFF1TVRBNElERTBNeTQyT0RJc05UTXVNamcxSURFME1pNDFORFFzTlRJdU5qSTRJRXc1Tmk0d01qY3NNalV1TnpjeElFd3hNaTQzTVRRc056TXVPRGN4SUV3eE1pNDNNVFFzTnpNdU9EY3hJRm9pSUdsa1BTSkdhV3hzTFRNaUlHWnBiR3c5SWlNMk1EZEVPRUlpUGp3dmNHRjBhRDRLSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBOGNHRjBhQ0JrUFNKTk1UUTRMak15Tnl3MU9DNDBOekVnUXpFME9DNHhORFVzTlRndU5EZ2dNVFEzTGprMk1pdzFPQzQwT0NBeE5EY3VOemd4TERVNExqUTNNaUJETVRRMUxqZzROeXcxT0M0ek9Ea2dNVFEwTGpRM09TdzFOeTQwTXpRZ01UUTBMall6Tml3MU5pNHpOQ0JETVRRMExqWTRPU3cxTlM0NU5qY2dNVFEwTGpZMk5DdzFOUzQxT1RjZ01UUTBMalUyTkN3MU5TNHlNelVnVERZekxqUTJNU3d4TURJdU1EVTNJRU0yTkM0d09Ea3NNVEF5TGpFeE5TQTJOQzQzTXpNc01UQXlMakV6SURZMUxqTTNPU3d4TURJdU1EazVJRU0yTlM0MU5qRXNNVEF5TGpBNUlEWTFMamMwTXl3eE1ESXVNRGtnTmpVdU9USTFMREV3TWk0d09UZ2dRelkzTGpneE9Td3hNREl1TVRneElEWTVMakl5Tnl3eE1ETXVNVE0ySURZNUxqQTNMREV3TkM0eU15Qk1NVFE0TGpNeU55dzFPQzQwTnpFaUlHbGtQU0pHYVd4c0xUUWlJR1pwYkd3OUlpTkdSa1pHUmtZaVBqd3ZjR0YwYUQ0S0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQThjR0YwYUNCa1BTSk5Oamt1TURjc01UQTBMak0wTnlCRE5qa3VNRFE0TERFd05DNHpORGNnTmprdU1ESTFMREV3TkM0ek5DQTJPUzR3TURVc01UQTBMak15TnlCRE5qZ3VPVFk0TERFd05DNHpNREVnTmpndU9UUTRMREV3TkM0eU5UY2dOamd1T1RVMUxERXdOQzR5TVRNZ1F6WTVMREV3TXk0NE9UWWdOamd1T0RrNExERXdNeTQxTnpZZ05qZ3VOalU0TERFd015NHlPRGdnUXpZNExqRTFNeXd4TURJdU5qYzRJRFkzTGpFd015d3hNREl1TWpZMklEWTFMamt5TERFd01pNHlNVFFnUXpZMUxqYzBNaXd4TURJdU1qQTJJRFkxTGpVMk15d3hNREl1TWpBM0lEWTFMak00TlN3eE1ESXVNakUxSUVNMk5DNDNORElzTVRBeUxqSTBOaUEyTkM0d09EY3NNVEF5TGpJek1pQTJNeTQwTlN3eE1ESXVNVGMwSUVNMk15NHpPVGtzTVRBeUxqRTJPU0EyTXk0ek5UZ3NNVEF5TGpFek1pQTJNeTR6TkRjc01UQXlMakE0TWlCRE5qTXVNek0yTERFd01pNHdNek1nTmpNdU16VTRMREV3TVM0NU9ERWdOak11TkRBeUxERXdNUzQ1TlRZZ1RERTBOQzQxTURZc05UVXVNVE0wSUVNeE5EUXVOVE0zTERVMUxqRXhOaUF4TkRRdU5UYzFMRFUxTGpFeE15QXhORFF1TmpBNUxEVTFMakV5TnlCRE1UUTBMalkwTWl3MU5TNHhOREVnTVRRMExqWTJPQ3cxTlM0eE55QXhORFF1TmpjM0xEVTFMakl3TkNCRE1UUTBMamM0TVN3MU5TNDFPRFVnTVRRMExqZ3dOaXcxTlM0NU56SWdNVFEwTGpjMU1TdzFOaTR6TlRjZ1F6RTBOQzQzTURZc05UWXVOamN6SURFME5DNDRNRGdzTlRZdU9UazBJREUwTlM0d05EY3NOVGN1TWpneUlFTXhORFV1TlRVekxEVTNMamc1TWlBeE5EWXVOakF5TERVNExqTXdNeUF4TkRjdU56ZzJMRFU0TGpNMU5TQkRNVFEzTGprMk5DdzFPQzR6TmpNZ01UUTRMakUwTXl3MU9DNHpOak1nTVRRNExqTXlNU3cxT0M0ek5UUWdRekUwT0M0ek56Y3NOVGd1TXpVeUlERTBPQzQwTWpRc05UZ3VNemczSURFME9DNDBNemtzTlRndU5ETTRJRU14TkRndU5EVTBMRFU0TGpRNUlERTBPQzQwTXpJc05UZ3VOVFExSURFME9DNHpPRFVzTlRndU5UY3lJRXcyT1M0eE1qa3NNVEEwTGpNek1TQkROamt1TVRFeExERXdOQzR6TkRJZ05qa3VNRGtzTVRBMExqTTBOeUEyT1M0d055d3hNRFF1TXpRM0lFdzJPUzR3Tnl3eE1EUXVNelEzSUZvZ1RUWTFMalkyTlN3eE1ERXVPVGMxSUVNMk5TNDNOVFFzTVRBeExqazNOU0EyTlM0NE5ESXNNVEF4TGprM055QTJOUzQ1TXl3eE1ERXVPVGd4SUVNMk55NHhPVFlzTVRBeUxqQXpOeUEyT0M0eU9ETXNNVEF5TGpRMk9TQTJPQzQ0TXpnc01UQXpMakV6T1NCRE5qa3VNRFkxTERFd015NDBNVE1nTmprdU1UZzRMREV3TXk0M01UUWdOamt1TVRrNExERXdOQzR3TWpFZ1RERTBOeTQ0T0RNc05UZ3VOVGt5SUVNeE5EY3VPRFEzTERVNExqVTVNaUF4TkRjdU9ERXhMRFU0TGpVNU1TQXhORGN1TnpjMkxEVTRMalU0T1NCRE1UUTJMalV3T1N3MU9DNDFNek1nTVRRMUxqUXlNaXcxT0M0eElERTBOQzQ0Tmpjc05UY3VORE14SUVNeE5EUXVOVGcxTERVM0xqQTVNU0F4TkRRdU5EWTFMRFUyTGpjd055QXhORFF1TlRJc05UWXVNekkwSUVNeE5EUXVOVFl6TERVMkxqQXlNU0F4TkRRdU5UVXlMRFUxTGpjeE5pQXhORFF1TkRnNExEVTFMalF4TkNCTU5qTXVPRFEyTERFd01TNDVOeUJETmpRdU16VXpMREV3TWk0d01ESWdOalF1T0RZM0xERXdNaTR3TURZZ05qVXVNemMwTERFd01TNDVPRElnUXpZMUxqUTNNU3d4TURFdU9UYzNJRFkxTGpVMk9Dd3hNREV1T1RjMUlEWTFMalkyTlN3eE1ERXVPVGMxSUV3Mk5TNDJOalVzTVRBeExqazNOU0JhSWlCcFpEMGlSbWxzYkMwMUlpQm1hV3hzUFNJak5qQTNSRGhDSWo0OEwzQmhkR2crQ2lBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ1BIQmhkR2dnWkQwaVRUSXVNakE0TERVMUxqRXpOQ0JETVM0eU1EY3NOVE11TXpBM0lERXVPVFkzTERVd0xqa3hOeUF6TGprd05pdzBPUzQzT1RjZ1REVTVMamt4Tnl3eE55NDBOVE1nUXpZeExqZzFOaXd4Tmk0ek16TWdOalF1TWpReExERTJMamt3TnlBMk5TNHlORE1zTVRndU56TTBJRXcyTlM0ME56VXNNVGt1TVRRMElFTTJOUzQ0TnpJc01Ua3VPRGd5SURZMkxqTTJPQ3d5TUM0MU5pQTJOaTQ1TkRVc01qRXVNVFkxSUV3Mk55NHlNak1zTWpFdU5ETTFJRU0zTUM0MU5EZ3NNalF1TmpRNUlEYzFMamd3Tml3eU5TNHhOVEVnT0RBdU1URXhMREl5TGpZMk5TQk1PRGN1TkRNc01UZ3VORFExSUVNNE9TNHpOeXd4Tnk0ek1qWWdPVEV1TnpVMExERTNMamc1T1NBNU1pNDNOVFVzTVRrdU56STNJRXc1Tmk0d01EVXNNalV1TmpVMUlFd3hNaTQwT0RZc056TXVPRGcwSUV3eUxqSXdPQ3cxTlM0eE16UWdXaUlnYVdROUlrWnBiR3d0TmlJZ1ptbHNiRDBpSTBaQlJrRkdRU0krUEM5d1lYUm9QZ29nSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUR4d1lYUm9JR1E5SWsweE1pNDBPRFlzTnpRdU1EQXhJRU14TWk0ME56WXNOelF1TURBeElERXlMalEyTlN3M015NDVPVGtnTVRJdU5EVTFMRGN6TGprNU5pQkRNVEl1TkRJMExEY3pMams0T0NBeE1pNHpPVGtzTnpNdU9UWTNJREV5TGpNNE5DdzNNeTQ1TkNCTU1pNHhNRFlzTlRVdU1Ua2dRekV1TURjMUxEVXpMak14SURFdU9EVTNMRFV3TGpnME5TQXpMamcwT0N3ME9TNDJPVFlnVERVNUxqZzFPQ3d4Tnk0ek5USWdRell3TGpVeU5Td3hOaTQ1TmpjZ05qRXVNamN4TERFMkxqYzJOQ0EyTWk0d01UWXNNVFl1TnpZMElFTTJNeTQwTXpFc01UWXVOelkwSURZMExqWTJOaXd4Tnk0ME5qWWdOalV1TXpJM0xERTRMalkwTmlCRE5qVXVNek0zTERFNExqWTFOQ0EyTlM0ek5EVXNNVGd1TmpZeklEWTFMak0xTVN3eE9DNDJOelFnVERZMUxqVTNPQ3d4T1M0d09EZ2dRelkxTGpVNE5Dd3hPUzR4SURZMUxqVTRPU3d4T1M0eE1USWdOalV1TlRreExERTVMakV5TmlCRE5qVXVPVGcxTERFNUxqZ3pPQ0EyTmk0ME5qa3NNakF1TkRrM0lEWTNMakF6TERJeExqQTROU0JNTmpjdU16QTFMREl4TGpNMU1TQkROamt1TVRVeExESXpMakV6TnlBM01TNDJORGtzTWpRdU1USWdOelF1TXpNMkxESTBMakV5SUVNM05pNHpNVE1zTWpRdU1USWdOemd1TWprc01qTXVOVGd5SURnd0xqQTFNeXd5TWk0MU5qTWdRemd3TGpBMk5Dd3lNaTQxTlRjZ09EQXVNRGMyTERJeUxqVTFNeUE0TUM0d09EZ3NNakl1TlRVZ1REZzNMak0zTWl3eE9DNHpORFFnUXpnNExqQXpPQ3d4Tnk0NU5Ua2dPRGd1TnpnMExERTNMamMxTmlBNE9TNDFNamtzTVRjdU56VTJJRU01TUM0NU5UWXNNVGN1TnpVMklEa3lMakl3TVN3eE9DNDBOeklnT1RJdU9EVTRMREU1TGpZM0lFdzVOaTR4TURjc01qVXVOVGs1SUVNNU5pNHhNemdzTWpVdU5qVTBJRGsyTGpFeE9Dd3lOUzQzTWpRZ09UWXVNRFl6TERJMUxqYzFOaUJNTVRJdU5UUTFMRGN6TGprNE5TQkRNVEl1TlRJMkxEY3pMams1TmlBeE1pNDFNRFlzTnpRdU1EQXhJREV5TGpRNE5pdzNOQzR3TURFZ1RERXlMalE0Tml3M05DNHdNREVnV2lCTk5qSXVNREUyTERFMkxqazVOeUJETmpFdU16RXlMREUyTGprNU55QTJNQzQyTURZc01UY3VNVGtnTlRrdU9UYzFMREUzTGpVMU5DQk1NeTQ1TmpVc05Ea3VPRGs1SUVNeUxqQTRNeXcxTUM0NU9EVWdNUzR6TkRFc05UTXVNekE0SURJdU16RXNOVFV1TURjNElFd3hNaTQxTXpFc056TXVOekl6SUV3NU5TNDRORGdzTWpVdU5qRXhJRXc1TWk0Mk5UTXNNVGt1TnpneUlFTTVNaTR3TXpnc01UZ3VOallnT1RBdU9EY3NNVGN1T1RrZ09Ea3VOVEk1TERFM0xqazVJRU00T0M0NE1qVXNNVGN1T1RrZ09EZ3VNVEU1TERFNExqRTRNaUE0Tnk0ME9Ea3NNVGd1TlRRM0lFdzRNQzR4TnpJc01qSXVOemN5SUVNNE1DNHhOakVzTWpJdU56YzRJRGd3TGpFME9Td3lNaTQzT0RJZ09EQXVNVE0zTERJeUxqYzROU0JETnpndU16UTJMREl6TGpneE1TQTNOaTR6TkRFc01qUXVNelUwSURjMExqTXpOaXd5TkM0ek5UUWdRemN4TGpVNE9Dd3lOQzR6TlRRZ05qa3VNRE16TERJekxqTTBOeUEyTnk0eE5ESXNNakV1TlRFNUlFdzJOaTQ0TmpRc01qRXVNalE1SUVNMk5pNHlOemNzTWpBdU5qTTBJRFkxTGpjM05Dd3hPUzQ1TkRjZ05qVXVNelkzTERFNUxqSXdNeUJETmpVdU16WXNNVGt1TVRreUlEWTFMak0xTml3eE9TNHhOemtnTmpVdU16VTBMREU1TGpFMk5pQk1OalV1TVRZekxERTRMamd4T1NCRE5qVXVNVFUwTERFNExqZ3hNU0EyTlM0eE5EWXNNVGd1T0RBeElEWTFMakUwTERFNExqYzVJRU0yTkM0MU1qVXNNVGN1TmpZM0lEWXpMak0xTnl3eE5pNDVPVGNnTmpJdU1ERTJMREUyTGprNU55Qk1Oakl1TURFMkxERTJMams1TnlCYUlpQnBaRDBpUm1sc2JDMDNJaUJtYVd4c1BTSWpOakEzUkRoQ0lqNDhMM0JoZEdnK0NpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdQSEJoZEdnZ1pEMGlUVFF5TGpRek5DdzBPQzQ0TURnZ1REUXlMalF6TkN3ME9DNDRNRGdnUXpNNUxqa3lOQ3cwT0M0NE1EY2dNemN1TnpNM0xEUTNMalUxSURNMkxqVTRNaXcwTlM0ME5ETWdRek0wTGpjM01TdzBNaTR4TXprZ016WXVNVFEwTERNM0xqZ3dPU0F6T1M0Mk5ERXNNelV1TnpnNUlFdzFNUzQ1TXpJc01qZ3VOamt4SUVNMU15NHhNRE1zTWpndU1ERTFJRFUwTGpReE15d3lOeTQyTlRnZ05UVXVOekl4TERJM0xqWTFPQ0JETlRndU1qTXhMREkzTGpZMU9DQTJNQzQwTVRnc01qZ3VPVEUySURZeExqVTNNeXd6TVM0d01qTWdRell6TGpNNE5Dd3pOQzR6TWpjZ05qSXVNREV5TERNNExqWTFOeUExT0M0MU1UUXNOREF1TmpjM0lFdzBOaTR5TWpNc05EY3VOemMxSUVNME5TNHdOVE1zTkRndU5EVWdORE11TnpReUxEUTRMamd3T0NBME1pNDBNelFzTkRndU9EQTRJRXcwTWk0ME16UXNORGd1T0RBNElGb2dUVFUxTGpjeU1Td3lPQzR4TWpVZ1F6VTBMalE1TlN3eU9DNHhNalVnTlRNdU1qWTFMREk0TGpRMk1TQTFNaTR4TmpZc01qa3VNRGsySUV3ek9TNDROelVzTXpZdU1UazBJRU16Tmk0MU9UWXNNemd1TURnM0lETTFMak13TWl3ME1pNHhNellnTXpZdU9Ua3lMRFExTGpJeE9DQkRNemd1TURZekxEUTNMakUzTXlBME1DNHdPVGdzTkRndU16UWdOREl1TkRNMExEUTRMak0wSUVNME15NDJOakVzTkRndU16UWdORFF1T0Rrc05EZ3VNREExSURRMUxqazVMRFEzTGpNM0lFdzFPQzR5T0RFc05EQXVNamN5SUVNMk1TNDFOaXd6T0M0ek56a2dOakl1T0RVekxETTBMak16SURZeExqRTJOQ3d6TVM0eU5EZ2dRell3TGpBNU1pd3lPUzR5T1RNZ05UZ3VNRFU0TERJNExqRXlOU0ExTlM0M01qRXNNamd1TVRJMUlFdzFOUzQzTWpFc01qZ3VNVEkxSUZvaUlHbGtQU0pHYVd4c0xUZ2lJR1pwYkd3OUlpTTJNRGRFT0VJaVBqd3ZjR0YwYUQ0S0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQThjR0YwYUNCa1BTSk5NVFE1TGpVNE9Dd3lMalF3TnlCRE1UUTVMalU0T0N3eUxqUXdOeUF4TlRVdU56WTRMRFV1T1RjMUlERTFOaTR6TWpVc05pNHlPVGNnVERFMU5pNHpNalVzTnk0eE9EUWdRekUxTmk0ek1qVXNOeTR6TmlBeE5UWXVNek00TERjdU5UUTBJREUxTmk0ek5qSXNOeTQzTXpNZ1F6RTFOaTR6TnpNc055NDRNVFFnTVRVMkxqTTRNaXczTGpnNU5DQXhOVFl1TXprc055NDVOelVnUXpFMU5pNDFNeXc1TGpNNUlERTFOeTR6TmpNc01UQXVPVGN6SURFMU9DNDBPVFVzTVRFdU9UYzBJRXd4TmpVdU9Ea3hMREU0TGpVeE9TQkRNVFkyTGpBMk9Dd3hPQzQyTnpVZ01UWTJMakkwT1N3eE9DNDRNVFFnTVRZMkxqUXpNaXd4T0M0NU16UWdRekUyT0M0d01URXNNVGt1T1RjMElERTJPUzR6T0RJc01Ua3VOQ0F4TmprdU5EazBMREUzTGpZMU1pQkRNVFk1TGpVME15d3hOaTQ0TmpnZ01UWTVMalUxTVN3eE5pNHdOVGNnTVRZNUxqVXhOeXd4TlM0eU1qTWdUREUyT1M0MU1UUXNNVFV1TURZeklFd3hOamt1TlRFMExERXpMamt4TWlCRE1UY3dMamM0TERFMExqWTBNaUF4T1RVdU5UQXhMREk0TGpreE5TQXhPVFV1TlRBeExESTRMamt4TlNCTU1UazFMalV3TVN3NE1pNDVNVFVnUXpFNU5TNDFNREVzT0RRdU1EQTFJREU1TkM0M016RXNPRFF1TkRRMUlERTVNeTQzT0RFc09ETXVPRGszSUV3eE5URXVNekE0TERVNUxqTTNOQ0JETVRVd0xqTTFPQ3cxT0M0NE1qWWdNVFE1TGpVNE9DdzFOeTQwT1RjZ01UUTVMalU0T0N3MU5pNDBNRGdnVERFME9TNDFPRGdzTWpJdU16YzFJaUJwWkQwaVJtbHNiQzA1SWlCbWFXeHNQU0lqUmtGR1FVWkJJajQ4TDNCaGRHZytDaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnUEhCaGRHZ2daRDBpVFRFNU5DNDFOVE1zT0RRdU1qVWdRekU1TkM0eU9UWXNPRFF1TWpVZ01UazBMakF4TXl3NE5DNHhOalVnTVRrekxqY3lNaXc0TXk0NU9UY2dUREUxTVM0eU5TdzFPUzQwTnpZZ1F6RTFNQzR5Tmprc05UZ3VPVEE1SURFME9TNDBOekVzTlRjdU5UTXpJREUwT1M0ME56RXNOVFl1TkRBNElFd3hORGt1TkRjeExESXlMak0zTlNCTU1UUTVMamN3TlN3eU1pNHpOelVnVERFME9TNDNNRFVzTlRZdU5EQTRJRU14TkRrdU56QTFMRFUzTGpRMU9TQXhOVEF1TkRVc05UZ3VOelEwSURFMU1TNHpOallzTlRrdU1qYzBJRXd4T1RNdU9ETTVMRGd6TGpjNU5TQkRNVGswTGpJMk15dzROQzR3TkNBeE9UUXVOalUxTERnMExqQTRNeUF4T1RRdU9UUXlMRGd6TGpreE55QkRNVGsxTGpJeU55dzRNeTQzTlRNZ01UazFMak00TkN3NE15NHpPVGNnTVRrMUxqTTROQ3c0TWk0NU1UVWdUREU1TlM0ek9EUXNNamd1T1RneUlFTXhPVFF1TVRBeUxESTRMakkwTWlBeE56SXVNVEEwTERFMUxqVTBNaUF4TmprdU5qTXhMREUwTGpFeE5DQk1NVFk1TGpZek5Dd3hOUzR5TWlCRE1UWTVMalkyT0N3eE5pNHdOVElnTVRZNUxqWTJMREUyTGpnM05DQXhOamt1TmpFc01UY3VOalU1SUVNeE5qa3VOVFUyTERFNExqVXdNeUF4TmprdU1qRTBMREU1TGpFeU15QXhOamd1TmpRM0xERTVMalF3TlNCRE1UWTRMakF5T0N3eE9TNDNNVFFnTVRZM0xqRTVOeXd4T1M0MU56Z2dNVFkyTGpNMk55d3hPUzR3TXpJZ1F6RTJOaTR4T0RFc01UZ3VPVEE1SURFMk5TNDVPVFVzTVRndU56WTJJREUyTlM0NE1UUXNNVGd1TmpBMklFd3hOVGd1TkRFM0xERXlMakEyTWlCRE1UVTNMakkxT1N3eE1TNHdNellnTVRVMkxqUXhPQ3c1TGpRek55QXhOVFl1TWpjMExEY3VPVGcySUVNeE5UWXVNalkyTERjdU9UQTNJREUxTmk0eU5UY3NOeTQ0TWpjZ01UVTJMakkwTnl3M0xqYzBPQ0JETVRVMkxqSXlNU3czTGpVMU5TQXhOVFl1TWpBNUxEY3VNelkxSURFMU5pNHlNRGtzTnk0eE9EUWdUREUxTmk0eU1Ea3NOaTR6TmpRZ1F6RTFOUzR6TnpVc05TNDRPRE1nTVRRNUxqVXlPU3d5TGpVd09DQXhORGt1TlRJNUxESXVOVEE0SUV3eE5Ea3VOalEyTERJdU16QTJJRU14TkRrdU5qUTJMREl1TXpBMklERTFOUzQ0TWpjc05TNDROelFnTVRVMkxqTTROQ3cyTGpFNU5pQk1NVFUyTGpRME1pdzJMakl6SUV3eE5UWXVORFF5TERjdU1UZzBJRU14TlRZdU5EUXlMRGN1TXpVMUlERTFOaTQwTlRRc055NDFNelVnTVRVMkxqUTNPQ3czTGpjeE55QkRNVFUyTGpRNE9TdzNMamdnTVRVMkxqUTVPU3czTGpnNE1pQXhOVFl1TlRBM0xEY3VPVFl6SUVNeE5UWXVOalExTERrdU16VTRJREUxTnk0ME5UVXNNVEF1T0RrNElERTFPQzQxTnpJc01URXVPRGcySUV3eE5qVXVPVFk1TERFNExqUXpNU0JETVRZMkxqRTBNaXd4T0M0MU9EUWdNVFkyTGpNeE9Td3hPQzQzTWlBeE5qWXVORGsyTERFNExqZ3pOeUJETVRZM0xqSTFOQ3d4T1M0ek16WWdNVFk0TERFNUxqUTJOeUF4TmpndU5UUXpMREU1TGpFNU5pQkRNVFk1TGpBek15d3hPQzQ1TlRNZ01UWTVMak15T1N3eE9DNDBNREVnTVRZNUxqTTNOeXd4Tnk0Mk5EVWdRekUyT1M0ME1qY3NNVFl1T0RZM0lERTJPUzQwTXpRc01UWXVNRFUwSURFMk9TNDBNREVzTVRVdU1qSTRJRXd4TmprdU16azNMREUxTGpBMk5TQk1NVFk1TGpNNU55d3hNeTQzTVNCTU1UWTVMalUzTWl3eE15NDRNU0JETVRjd0xqZ3pPU3d4TkM0MU5ERWdNVGsxTGpVMU9Td3lPQzQ0TVRRZ01UazFMalUxT1N3eU9DNDRNVFFnVERFNU5TNDJNVGdzTWpndU9EUTNJRXd4T1RVdU5qRTRMRGd5TGpreE5TQkRNVGsxTGpZeE9DdzRNeTQwT0RRZ01UazFMalF5TERnekxqa3hNU0F4T1RVdU1EVTVMRGcwTGpFeE9TQkRNVGswTGprd09DdzROQzR5TURZZ01UazBMamN6Tnl3NE5DNHlOU0F4T1RRdU5UVXpMRGcwTGpJMUlpQnBaRDBpUm1sc2JDMHhNQ0lnWm1sc2JEMGlJell3TjBRNFFpSStQQzl3WVhSb1Bnb2dJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJRHh3WVhSb0lHUTlJazB4TkRVdU5qZzFMRFUyTGpFMk1TQk1NVFk1TGpnc056QXVNRGd6SUV3eE5ETXVPREl5TERnMUxqQTRNU0JNTVRReUxqTTJMRGcwTGpjM05DQkRNVE0xTGpneU5pdzRNaTQyTURRZ01USTRMamN6TWl3NE1TNHdORFlnTVRJeExqTTBNU3c0TUM0eE5UZ2dRekV4Tmk0NU56WXNOemt1TmpNMElERXhNaTQyTnpnc09ERXVNalUwSURFeE1TNDNORE1zT0RNdU56YzRJRU14TVRFdU5UQTJMRGcwTGpReE5DQXhNVEV1TlRBekxEZzFMakEzTVNBeE1URXVOek15TERnMUxqY3dOaUJETVRFekxqSTNMRGc1TGprM015QXhNVFV1T1RZNExEazBMakEyT1NBeE1Ua3VOekkzTERrM0xqZzBNU0JNTVRJd0xqSTFPU3c1T0M0Mk9EWWdRekV5TUM0eU5pdzVPQzQyT0RVZ09UUXVNamd5TERFeE15NDJPRE1nT1RRdU1qZ3lMREV4TXk0Mk9ETWdURGN3TGpFMk55dzVPUzQzTmpFZ1RERTBOUzQyT0RVc05UWXVNVFl4SWlCcFpEMGlSbWxzYkMweE1TSWdabWxzYkQwaUkwWkdSa1pHUmlJK1BDOXdZWFJvUGdvZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lEeHdZWFJvSUdROUlrMDVOQzR5T0RJc01URXpMamd4T0NCTU9UUXVNakl6TERFeE15NDNPRFVnVERZNUxqa3pNeXc1T1M0M05qRWdURGN3TGpFd09DdzVPUzQyTmlCTU1UUTFMalk0TlN3MU5pNHdNallnVERFME5TNDNORE1zTlRZdU1EVTVJRXd4TnpBdU1ETXpMRGN3TGpBNE15Qk1NVFF6TGpnME1pdzROUzR5TURVZ1RERTBNeTQzT1Rjc09EVXVNVGsxSUVNeE5ETXVOemN5TERnMUxqRTVJREUwTWk0ek16WXNPRFF1T0RnNElERTBNaTR6TXpZc09EUXVPRGc0SUVNeE16VXVOemczTERneUxqY3hOQ0F4TWpndU56SXpMRGd4TGpFMk15QXhNakV1TXpJM0xEZ3dMakkzTkNCRE1USXdMamM0T0N3NE1DNHlNRGtnTVRJd0xqSXpOaXc0TUM0eE56Y2dNVEU1TGpZNE9TdzRNQzR4TnpjZ1F6RXhOUzQ1TXpFc09EQXVNVGMzSURFeE1pNDJNelVzT0RFdU56QTRJREV4TVM0NE5USXNPRE11T0RFNUlFTXhNVEV1TmpJMExEZzBMalF6TWlBeE1URXVOakl4TERnMUxqQTFNeUF4TVRFdU9EUXlMRGcxTGpZMk55QkRNVEV6TGpNM055dzRPUzQ1TWpVZ01URTJMakExT0N3NU15NDVPVE1nTVRFNUxqZ3hMRGszTGpjMU9DQk1NVEU1TGpneU5pdzVOeTQzTnprZ1RERXlNQzR6TlRJc09UZ3VOakUwSUVNeE1qQXVNelUwTERrNExqWXhOeUF4TWpBdU16VTJMRGs0TGpZeUlERXlNQzR6TlRnc09UZ3VOakkwSUV3eE1qQXVOREl5TERrNExqY3lOaUJNTVRJd0xqTXhOeXc1T0M0M09EY2dRekV5TUM0eU5qUXNPVGd1T0RFNElEazBMalU1T1N3eE1UTXVOak0xSURrMExqTTBMREV4TXk0M09EVWdURGswTGpJNE1pd3hNVE11T0RFNElFdzVOQzR5T0RJc01URXpMamd4T0NCYUlFMDNNQzQwTURFc09Ua3VOell4SUV3NU5DNHlPRElzTVRFekxqVTBPU0JNTVRFNUxqQTROQ3c1T1M0eU1qa2dRekV4T1M0Mk15dzVPQzQ1TVRRZ01URTVMamt6TERrNExqYzBJREV5TUM0eE1ERXNPVGd1TmpVMElFd3hNVGt1TmpNMUxEazNMamt4TkNCRE1URTFMamcyTkN3NU5DNHhNamNnTVRFekxqRTJPQ3c1TUM0d016TWdNVEV4TGpZeU1pdzROUzQzTkRZZ1F6RXhNUzR6T0RJc09EVXVNRGM1SURFeE1TNHpPRFlzT0RRdU5EQTBJREV4TVM0Mk16TXNPRE11TnpNNElFTXhNVEl1TkRRNExEZ3hMalV6T1NBeE1UVXVPRE0yTERjNUxqazBNeUF4TVRrdU5qZzVMRGM1TGprME15QkRNVEl3TGpJME5pdzNPUzQ1TkRNZ01USXdMamd3Tml3M09TNDVOellnTVRJeExqTTFOU3c0TUM0d05ESWdRekV5T0M0M05qY3NPREF1T1RNeklERXpOUzQ0TkRZc09ESXVORGczSURFME1pNHpPVFlzT0RRdU5qWXpJRU14TkRNdU1qTXlMRGcwTGpnek9DQXhORE11TmpFeExEZzBMamt4TnlBeE5ETXVOemcyTERnMExqazJOeUJNTVRZNUxqVTJOaXczTUM0d09ETWdUREUwTlM0Mk9EVXNOVFl1TWprMUlFdzNNQzQwTURFc09Ua3VOell4SUV3M01DNDBNREVzT1RrdU56WXhJRm9pSUdsa1BTSkdhV3hzTFRFeUlpQm1hV3hzUFNJak5qQTNSRGhDSWo0OEwzQmhkR2crQ2lBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ1BIQmhkR2dnWkQwaVRURTJOeTR5TXl3eE9DNDVOemtnVERFMk55NHlNeXcyT1M0NE5TQk1NVE01TGprd09TdzROUzQyTWpNZ1RERXpNeTQwTkRnc056RXVORFUySUVNeE16SXVOVE00TERZNUxqUTJJREV6TUM0d01pdzJPUzQzTVRnZ01USTNMamd5TkN3M01pNHdNeUJETVRJMkxqYzJPU3czTXk0eE5DQXhNalV1T1RNeExEYzBMalU0TlNBeE1qVXVORGswTERjMkxqQTBPQ0JNTVRFNUxqQXpOQ3c1Tnk0Mk56WWdURGt4TGpjeE1pd3hNVE11TkRVZ1REa3hMamN4TWl3Mk1pNDFOemtnVERFMk55NHlNeXd4T0M0NU56a2lJR2xrUFNKR2FXeHNMVEV6SWlCbWFXeHNQU0lqUmtaR1JrWkdJajQ4TDNCaGRHZytDaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnUEhCaGRHZ2daRDBpVFRreExqY3hNaXd4TVRNdU5UWTNJRU01TVM0Mk9USXNNVEV6TGpVMk55QTVNUzQyTnpJc01URXpMalUyTVNBNU1TNDJOVE1zTVRFekxqVTFNU0JET1RFdU5qRTRMREV4TXk0MU15QTVNUzQxT1RVc01URXpMalE1TWlBNU1TNDFPVFVzTVRFekxqUTFJRXc1TVM0MU9UVXNOakl1TlRjNUlFTTVNUzQxT1RVc05qSXVOVE0zSURreExqWXhPQ3cyTWk0ME9Ua2dPVEV1TmpVekxEWXlMalEzT0NCTU1UWTNMakUzTWl3eE9DNDROemdnUXpFMk55NHlNRGdzTVRndU9EVTNJREUyTnk0eU5USXNNVGd1T0RVM0lERTJOeTR5T0Rnc01UZ3VPRGM0SUVNeE5qY3VNekkwTERFNExqZzVPU0F4TmpjdU16UTNMREU0TGprek55QXhOamN1TXpRM0xERTRMamszT1NCTU1UWTNMak0wTnl3Mk9TNDROU0JETVRZM0xqTTBOeXcyT1M0NE9URWdNVFkzTGpNeU5DdzJPUzQ1TXlBeE5qY3VNamc0TERZNUxqazFJRXd4TXprdU9UWTNMRGcxTGpjeU5TQkRNVE01TGprek9TdzROUzQzTkRFZ01UTTVMamt3TlN3NE5TNDNORFVnTVRNNUxqZzNNeXc0TlM0M016VWdRekV6T1M0NE5ESXNPRFV1TnpJMUlERXpPUzQ0TVRZc09EVXVOekF5SURFek9TNDRNRElzT0RVdU5qY3lJRXd4TXpNdU16UXlMRGN4TGpVd05DQkRNVE15TGprMk55dzNNQzQyT0RJZ01UTXlMakk0TERjd0xqSXlPU0F4TXpFdU5EQTRMRGN3TGpJeU9TQkRNVE13TGpNeE9TdzNNQzR5TWprZ01USTVMakEwTkN3M01DNDVNVFVnTVRJM0xqa3dPQ3czTWk0eE1TQkRNVEkyTGpnM05DdzNNeTR5SURFeU5pNHdNelFzTnpRdU5qUTNJREV5TlM0Mk1EWXNOell1TURneUlFd3hNVGt1TVRRMkxEazNMamN3T1NCRE1URTVMakV6Tnl3NU55NDNNemdnTVRFNUxqRXhPQ3c1Tnk0M05qSWdNVEU1TGpBNU1pdzVOeTQzTnpjZ1REa3hMamMzTERFeE15NDFOVEVnUXpreExqYzFNaXd4TVRNdU5UWXhJRGt4TGpjek1pd3hNVE11TlRZM0lEa3hMamN4TWl3eE1UTXVOVFkzSUV3NU1TNDNNVElzTVRFekxqVTJOeUJhSUUwNU1TNDRNamtzTmpJdU5qUTNJRXc1TVM0NE1qa3NNVEV6TGpJME9DQk1NVEU0TGprek5TdzVOeTQxT1RnZ1RERXlOUzR6T0RJc056WXVNREUxSUVNeE1qVXVPREkzTERjMExqVXlOU0F4TWpZdU5qWTBMRGN6TGpBNE1TQXhNamN1TnpNNUxEY3hMamsxSUVNeE1qZ3VPVEU1TERjd0xqY3dPQ0F4TXpBdU1qVTJMRFk1TGprNU5pQXhNekV1TkRBNExEWTVMams1TmlCRE1UTXlMak0zTnl3Mk9TNDVPVFlnTVRNekxqRXpPU3czTUM0ME9UY2dNVE16TGpVMU5DdzNNUzQwTURjZ1RERXpPUzQ1TmpFc09EVXVORFU0SUV3eE5qY3VNVEV6TERZNUxqYzRNaUJNTVRZM0xqRXhNeXd4T1M0eE9ERWdURGt4TGpneU9TdzJNaTQyTkRjZ1REa3hMamd5T1N3Mk1pNDJORGNnV2lJZ2FXUTlJa1pwYkd3dE1UUWlJR1pwYkd3OUlpTTJNRGRFT0VJaVBqd3ZjR0YwYUQ0S0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQThjR0YwYUNCa1BTSk5NVFk0TGpVME15d3hPUzR5TVRNZ1RERTJPQzQxTkRNc056QXVNRGd6SUV3eE5ERXVNakl4TERnMUxqZzFOeUJNTVRNMExqYzJNU3czTVM0Mk9Ea2dRekV6TXk0NE5URXNOamt1TmprMElERXpNUzR6TXpNc05qa3VPVFV4SURFeU9TNHhNemNzTnpJdU1qWXpJRU14TWpndU1EZ3lMRGN6TGpNM05DQXhNamN1TWpRMExEYzBMamd4T1NBeE1qWXVPREEzTERjMkxqSTRNaUJNTVRJd0xqTTBOaXc1Tnk0NU1Ea2dURGt6TGpBeU5Td3hNVE11TmpneklFdzVNeTR3TWpVc05qSXVPREV6SUV3eE5qZ3VOVFF6TERFNUxqSXhNeUlnYVdROUlrWnBiR3d0TVRVaUlHWnBiR3c5SWlOR1JrWkdSa1lpUGp3dmNHRjBhRDRLSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBOGNHRjBhQ0JrUFNKTk9UTXVNREkxTERFeE15NDRJRU01TXk0d01EVXNNVEV6TGpnZ09USXVPVGcwTERFeE15NDNPVFVnT1RJdU9UWTJMREV4TXk0M09EVWdRemt5TGprek1Td3hNVE11TnpZMElEa3lMamt3T0N3eE1UTXVOekkxSURreUxqa3dPQ3d4TVRNdU5qZzBJRXc1TWk0NU1EZ3NOakl1T0RFeklFTTVNaTQ1TURnc05qSXVOemN4SURreUxqa3pNU3cyTWk0M016TWdPVEl1T1RZMkxEWXlMamN4TWlCTU1UWTRMalE0TkN3eE9TNHhNVElnUXpFMk9DNDFNaXd4T1M0d09TQXhOamd1TlRZMUxERTVMakE1SURFMk9DNDJNREVzTVRrdU1URXlJRU14TmpndU5qTTNMREU1TGpFek1pQXhOamd1TmpZc01Ua3VNVGN4SURFMk9DNDJOaXd4T1M0eU1USWdUREUyT0M0Mk5pdzNNQzR3T0RNZ1F6RTJPQzQyTml3M01DNHhNalVnTVRZNExqWXpOeXczTUM0eE5qUWdNVFk0TGpZd01TdzNNQzR4T0RRZ1RERTBNUzR5T0N3NE5TNDVOVGdnUXpFME1TNHlOVEVzT0RVdU9UYzFJREUwTVM0eU1UY3NPRFV1T1RjNUlERTBNUzR4T0RZc09EVXVPVFk0SUVNeE5ERXVNVFUwTERnMUxqazFPQ0F4TkRFdU1USTVMRGcxTGprek5pQXhOREV1TVRFMUxEZzFMamt3TmlCTU1UTTBMalkxTlN3M01TNDNNemdnUXpFek5DNHlPQ3czTUM0NU1UVWdNVE16TGpVNU15dzNNQzQwTmpNZ01UTXlMamN5TERjd0xqUTJNeUJETVRNeExqWXpNaXczTUM0ME5qTWdNVE13TGpNMU55dzNNUzR4TkRnZ01USTVMakl5TVN3M01pNHpORFFnUXpFeU9DNHhPRFlzTnpNdU5ETXpJREV5Tnk0ek5EY3NOelF1T0RneElERXlOaTQ1TVRrc056WXVNekUxSUV3eE1qQXVORFU0TERrM0xqazBNeUJETVRJd0xqUTFMRGszTGprM01pQXhNakF1TkRNeExEazNMams1TmlBeE1qQXVOREExTERrNExqQXhJRXc1TXk0d09ETXNNVEV6TGpjNE5TQkRPVE11TURZMUxERXhNeTQzT1RVZ09UTXVNRFExTERFeE15NDRJRGt6TGpBeU5Td3hNVE11T0NCTU9UTXVNREkxTERFeE15NDRJRm9nVFRrekxqRTBNaXcyTWk0NE9ERWdURGt6TGpFME1pd3hNVE11TkRneElFd3hNakF1TWpRNExEazNMamd6TWlCTU1USTJMalk1TlN3M05pNHlORGdnUXpFeU55NHhOQ3czTkM0M05UZ2dNVEkzTGprM055dzNNeTR6TVRVZ01USTVMakExTWl3M01pNHhPRE1nUXpFek1DNHlNekVzTnpBdU9UUXlJREV6TVM0MU5qZ3NOekF1TWpJNUlERXpNaTQzTWl3M01DNHlNamtnUXpFek15NDJPRGtzTnpBdU1qSTVJREV6TkM0ME5USXNOekF1TnpNeElERXpOQzQ0Tmpjc056RXVOalF4SUV3eE5ERXVNamMwTERnMUxqWTVNaUJNTVRZNExqUXlOaXczTUM0d01UWWdUREUyT0M0ME1qWXNNVGt1TkRFMUlFdzVNeTR4TkRJc05qSXVPRGd4SUV3NU15NHhORElzTmpJdU9EZ3hJRm9pSUdsa1BTSkdhV3hzTFRFMklpQm1hV3hzUFNJak5qQTNSRGhDSWo0OEwzQmhkR2crQ2lBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ1BIQmhkR2dnWkQwaVRURTJPUzQ0TERjd0xqQTRNeUJNTVRReUxqUTNPQ3c0TlM0NE5UY2dUREV6Tmk0d01UZ3NOekV1TmpnNUlFTXhNelV1TVRBNExEWTVMalk1TkNBeE16SXVOVGtzTmprdU9UVXhJREV6TUM0ek9UTXNOekl1TWpZeklFTXhNamt1TXpNNUxEY3pMak0zTkNBeE1qZ3VOU3czTkM0NE1Ua2dNVEk0TGpBMk5DdzNOaTR5T0RJZ1RERXlNUzQyTURNc09UY3VPVEE1SUV3NU5DNHlPRElzTVRFekxqWTRNeUJNT1RRdU1qZ3lMRFl5TGpneE15Qk1NVFk1TGpnc01Ua3VNakV6SUV3eE5qa3VPQ3czTUM0d09ETWdXaUlnYVdROUlrWnBiR3d0TVRjaUlHWnBiR3c5SWlOR1FVWkJSa0VpUGp3dmNHRjBhRDRLSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBOGNHRjBhQ0JrUFNKTk9UUXVNamd5TERFeE15NDVNVGNnUXprMExqSTBNU3d4TVRNdU9URTNJRGswTGpJd01Td3hNVE11T1RBM0lEazBMakUyTlN3eE1UTXVPRGcySUVNNU5DNHdPVE1zTVRFekxqZzBOU0E1TkM0d05EZ3NNVEV6TGpjMk55QTVOQzR3TkRnc01URXpMalk0TkNCTU9UUXVNRFE0TERZeUxqZ3hNeUJET1RRdU1EUTRMRFl5TGpjeklEazBMakE1TXl3Mk1pNDJOVElnT1RRdU1UWTFMRFl5TGpZeE1TQk1NVFk1TGpZNE15d3hPUzR3TVNCRE1UWTVMamMxTlN3eE9DNDVOamtnTVRZNUxqZzBOQ3d4T0M0NU5qa2dNVFk1TGpreE55d3hPUzR3TVNCRE1UWTVMams0T1N3eE9TNHdOVElnTVRjd0xqQXpNeXd4T1M0eE1qa2dNVGN3TGpBek15d3hPUzR5TVRJZ1RERTNNQzR3TXpNc056QXVNRGd6SUVNeE56QXVNRE16TERjd0xqRTJOaUF4TmprdU9UZzVMRGN3TGpJME5DQXhOamt1T1RFM0xEY3dMakk0TlNCTU1UUXlMalU1TlN3NE5pNHdOaUJETVRReUxqVXpPQ3c0Tmk0d09USWdNVFF5TGpRMk9TdzROaTR4SURFME1pNDBNRGNzT0RZdU1EZ2dRekUwTWk0ek5EUXNPRFl1TURZZ01UUXlMakk1TXl3NE5pNHdNVFFnTVRReUxqSTJOaXc0TlM0NU5UUWdUREV6TlM0NE1EVXNOekV1TnpnMklFTXhNelV1TkRRMUxEY3dMams1TnlBeE16UXVPREV6TERjd0xqVTRJREV6TXk0NU56Y3NOekF1TlRnZ1F6RXpNaTQ1TWpFc056QXVOVGdnTVRNeExqWTNOaXczTVM0eU5USWdNVE13TGpVMk1pdzNNaTQwTWpRZ1F6RXlPUzQxTkN3M015NDFNREVnTVRJNExqY3hNU3czTkM0NU16RWdNVEk0TGpJNE55dzNOaTR6TkRnZ1RERXlNUzQ0TWpjc09UY3VPVGMySUVNeE1qRXVPREVzT1RndU1ETTBJREV5TVM0M056RXNPVGd1TURneUlERXlNUzQzTWl3NU9DNHhNVElnVERrMExqTTVPQ3d4TVRNdU9EZzJJRU01TkM0ek5qSXNNVEV6TGprd055QTVOQzR6TWpJc01URXpMamt4TnlBNU5DNHlPRElzTVRFekxqa3hOeUJNT1RRdU1qZ3lMREV4TXk0NU1UY2dXaUJOT1RRdU5URTFMRFl5TGprME9DQk1PVFF1TlRFMUxERXhNeTR5TnprZ1RERXlNUzQwTURZc09UY3VOelUwSUV3eE1qY3VPRFFzTnpZdU1qRTFJRU14TWpndU1qa3NOelF1TnpBNElERXlPUzR4TXpjc056TXVNalEzSURFek1DNHlNalFzTnpJdU1UQXpJRU14TXpFdU5ESTFMRGN3TGpnek9DQXhNekl1TnprekxEY3dMakV4TWlBeE16TXVPVGMzTERjd0xqRXhNaUJETVRNMExqazVOU3czTUM0eE1USWdNVE0xTGpjNU5TdzNNQzQyTXpnZ01UTTJMakl6TERjeExqVTVNaUJNTVRReUxqVTROQ3c0TlM0MU1qWWdUREUyT1M0MU5qWXNOamt1T1RRNElFd3hOamt1TlRZMkxERTVMall4TnlCTU9UUXVOVEUxTERZeUxqazBPQ0JNT1RRdU5URTFMRFl5TGprME9DQmFJaUJwWkQwaVJtbHNiQzB4T0NJZ1ptbHNiRDBpSXpZd04wUTRRaUkrUEM5d1lYUm9QZ29nSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUR4d1lYUm9JR1E5SWsweE1Ea3VPRGswTERreUxqazBNeUJNTVRBNUxqZzVOQ3c1TWk0NU5ETWdRekV3T0M0eE1pdzVNaTQ1TkRNZ01UQTJMalkxTXl3NU1pNHlNVGdnTVRBMUxqWTFMRGt3TGpneU15QkRNVEExTGpVNE15dzVNQzQzTXpFZ01UQTFMalU1TXl3NU1DNDJNU0F4TURVdU5qY3pMRGt3TGpVeU9TQkRNVEExTGpjMU15dzVNQzQwTkRnZ01UQTFMamc0TERrd0xqUTBJREV3TlM0NU56UXNPVEF1TlRBMklFTXhNRFl1TnpVMExEa3hMakExTXlBeE1EY3VOamM1TERreExqTXpNeUF4TURndU56STBMRGt4TGpNek15QkRNVEV3TGpBME55dzVNUzR6TXpNZ01URXhMalEzT0N3NU1DNDRPVFFnTVRFeUxqazRMRGt3TGpBeU55QkRNVEU0TGpJNU1TdzROaTQ1TmlBeE1qSXVOakV4TERjNUxqVXdPU0F4TWpJdU5qRXhMRGN6TGpReE5pQkRNVEl5TGpZeE1TdzNNUzQwT0RrZ01USXlMakUyT1N3Mk9TNDROVFlnTVRJeExqTXpNeXcyT0M0Mk9USWdRekV5TVM0eU5qWXNOamd1TmlBeE1qRXVNamMyTERZNExqUTNNeUF4TWpFdU16VTJMRFk0TGpNNU1pQkRNVEl4TGpRek5pdzJPQzR6TVRFZ01USXhMalUyTXl3Mk9DNHlPVGtnTVRJeExqWTFOaXcyT0M0ek5qVWdRekV5TXk0ek1qY3NOamt1TlRNM0lERXlOQzR5TkRjc056RXVOelEySURFeU5DNHlORGNzTnpRdU5UZzBJRU14TWpRdU1qUTNMRGd3TGpneU5pQXhNVGt1T0RJeExEZzRMalEwTnlBeE1UUXVNemd5TERreExqVTROeUJETVRFeUxqZ3dPQ3c1TWk0ME9UVWdNVEV4TGpJNU9DdzVNaTQ1TkRNZ01UQTVMamc1TkN3NU1pNDVORE1nVERFd09TNDRPVFFzT1RJdU9UUXpJRm9nVFRFd05pNDVNalVzT1RFdU5EQXhJRU14TURjdU56TTRMRGt5TGpBMU1pQXhNRGd1TnpRMUxEa3lMakkzT0NBeE1Ea3VPRGt6TERreUxqSTNPQ0JNTVRBNUxqZzVOQ3c1TWk0eU56Z2dRekV4TVM0eU1UVXNPVEl1TWpjNElERXhNaTQyTkRjc09URXVPVFV4SURFeE5DNHhORGdzT1RFdU1EZzBJRU14TVRrdU5EVTVMRGc0TGpBeE55QXhNak11Tnpnc09EQXVOakl4SURFeU15NDNPQ3czTkM0MU1qZ2dRekV5TXk0M09DdzNNaTQxTkRrZ01USXpMak14Tnl3M01DNDVNamtnTVRJeUxqUTFOQ3cyT1M0M05qY2dRekV5TWk0NE5qVXNOekF1T0RBeUlERXlNeTR3Tnprc056SXVNRFF5SURFeU15NHdOemtzTnpNdU5EQXlJRU14TWpNdU1EYzVMRGM1TGpZME5TQXhNVGd1TmpVekxEZzNMakk0TlNBeE1UTXVNakUwTERrd0xqUXlOU0JETVRFeExqWTBMRGt4TGpNek5DQXhNVEF1TVRNc09URXVOelF5SURFd09DNDNNalFzT1RFdU56UXlJRU14TURndU1EZ3pMRGt4TGpjME1pQXhNRGN1TkRneExEa3hMalU1TXlBeE1EWXVPVEkxTERreExqUXdNU0JNTVRBMkxqa3lOU3c1TVM0ME1ERWdXaUlnYVdROUlrWnBiR3d0TVRraUlHWnBiR3c5SWlNMk1EZEVPRUlpUGp3dmNHRjBhRDRLSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBOGNHRjBhQ0JrUFNKTk1URXpMakE1Tnl3NU1DNHlNeUJETVRFNExqUTRNU3c0Tnk0eE1qSWdNVEl5TGpnME5TdzNPUzQxT1RRZ01USXlMamcwTlN3M015NDBNVFlnUXpFeU1pNDRORFVzTnpFdU16WTFJREV5TWk0ek5qSXNOamt1TnpJMElERXlNUzQxTWpJc05qZ3VOVFUySUVNeE1Ua3VOek00TERZM0xqTXdOQ0F4TVRjdU1UUTRMRFkzTGpNMk1pQXhNVFF1TWpZMUxEWTVMakF5TmlCRE1UQTRMamc0TVN3M01pNHhNelFnTVRBMExqVXhOeXczT1M0Mk5qSWdNVEEwTGpVeE55dzROUzQ0TkNCRE1UQTBMalV4Tnl3NE55NDRPVEVnTVRBMUxEZzVMalV6TWlBeE1EVXVPRFFzT1RBdU55QkRNVEEzTGpZeU5DdzVNUzQ1TlRJZ01URXdMakl4TkN3NU1TNDRPVFFnTVRFekxqQTVOeXc1TUM0eU15SWdhV1E5SWtacGJHd3RNakFpSUdacGJHdzlJaU5HUVVaQlJrRWlQand2Y0dGMGFENEtJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0E4Y0dGMGFDQmtQU0pOTVRBNExqY3lOQ3c1TVM0Mk1UUWdUREV3T0M0M01qUXNPVEV1TmpFMElFTXhNRGN1TlRneUxEa3hMall4TkNBeE1EWXVOVFkyTERreExqUXdNU0F4TURVdU56QTFMRGt3TGpjNU55QkRNVEExTGpZNE5DdzVNQzQzT0RNZ01UQTFMalkyTlN3NU1DNDRNVEVnTVRBMUxqWTFMRGt3TGpjNUlFTXhNRFF1TnpVMkxEZzVMalUwTmlBeE1EUXVNamd6TERnM0xqZzBNaUF4TURRdU1qZ3pMRGcxTGpneE55QkRNVEEwTGpJNE15dzNPUzQxTnpVZ01UQTRMamN3T1N3M01TNDVOVE1nTVRFMExqRTBPQ3cyT0M0NE1USWdRekV4TlM0M01qSXNOamN1T1RBMElERXhOeTR5TXpJc05qY3VORFE1SURFeE9DNDJNemdzTmpjdU5EUTVJRU14TVRrdU56Z3NOamN1TkRRNUlERXlNQzQzT1RZc05qY3VOelU0SURFeU1TNDJOVFlzTmpndU16WXlJRU14TWpFdU5qYzRMRFk0TGpNM055QXhNakV1TmprM0xEWTRMak01TnlBeE1qRXVOekV5TERZNExqUXhPQ0JETVRJeUxqWXdOaXcyT1M0Mk5qSWdNVEl6TGpBM09TdzNNUzR6T1NBeE1qTXVNRGM1TERjekxqUXhOU0JETVRJekxqQTNPU3czT1M0Mk5UZ2dNVEU0TGpZMU15dzROeTR4T1RnZ01URXpMakl4TkN3NU1DNHpNemdnUXpFeE1TNDJOQ3c1TVM0eU5EY2dNVEV3TGpFekxEa3hMall4TkNBeE1EZ3VOekkwTERreExqWXhOQ0JNTVRBNExqY3lOQ3c1TVM0Mk1UUWdXaUJOTVRBMkxqQXdOaXc1TUM0MU1EVWdRekV3Tmk0M09DdzVNUzR3TXpjZ01UQTNMalk1TkN3NU1TNHlPREVnTVRBNExqY3lOQ3c1TVM0eU9ERWdRekV4TUM0d05EY3NPVEV1TWpneElERXhNUzQwTnpnc09UQXVPRFk0SURFeE1pNDVPQ3c1TUM0d01ERWdRekV4T0M0eU9URXNPRFl1T1RNMUlERXlNaTQyTVRFc056a3VORGsySURFeU1pNDJNVEVzTnpNdU5EQXpJRU14TWpJdU5qRXhMRGN4TGpRNU5DQXhNakl1TVRjM0xEWTVMamc0SURFeU1TNHpOVFlzTmpndU56RTRJRU14TWpBdU5UZ3lMRFk0TGpFNE5TQXhNVGt1TmpZNExEWTNMamt4T1NBeE1UZ3VOak00TERZM0xqa3hPU0JETVRFM0xqTXhOU3cyTnk0NU1Ua2dNVEUxTGpnNE15dzJPQzR6TmlBeE1UUXVNemd5TERZNUxqSXlOeUJETVRBNUxqQTNNU3czTWk0eU9UTWdNVEEwTGpjMU1TdzNPUzQzTXpNZ01UQTBMamMxTVN3NE5TNDRNallnUXpFd05DNDNOVEVzT0RjdU56TTFJREV3TlM0eE9EVXNPRGt1TXpReklERXdOaTR3TURZc09UQXVOVEExSUV3eE1EWXVNREEyTERrd0xqVXdOU0JhSWlCcFpEMGlSbWxzYkMweU1TSWdabWxzYkQwaUl6WXdOMFE0UWlJK1BDOXdZWFJvUGdvZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lEeHdZWFJvSUdROUlrMHhORGt1TXpFNExEY3VNall5SUV3eE16a3VNek0wTERFMkxqRTBJRXd4TlRVdU1qSTNMREkzTGpFM01TQk1NVFl3TGpneE5pd3lNUzR3TlRrZ1RERTBPUzR6TVRnc055NHlOaklpSUdsa1BTSkdhV3hzTFRJeUlpQm1hV3hzUFNJalJrRkdRVVpCSWo0OEwzQmhkR2crQ2lBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ1BIQmhkR2dnWkQwaVRURTJPUzQyTnpZc01UTXVPRFFnVERFMU9TNDVNamdzTVRrdU5EWTNJRU14TlRZdU1qZzJMREl4TGpVM0lERTFNQzQwTERJeExqVTRJREUwTmk0M09ERXNNVGt1TkRreElFTXhORE11TVRZeExERTNMalF3TWlBeE5ETXVNVGdzTVRRdU1EQXpJREUwTmk0NE1qSXNNVEV1T1NCTU1UVTJMak14Tnl3MkxqSTVNaUJNTVRRNUxqVTRPQ3d5TGpRd055Qk1OamN1TnpVeUxEUTVMalEzT0NCTU1URXpMalkzTlN3M05TNDVPVElnVERFeE5pNDNOVFlzTnpRdU1qRXpJRU14TVRjdU16ZzNMRGN6TGpnME9DQXhNVGN1TmpJMUxEY3pMak14TlNBeE1UY3VNemMwTERjeUxqZ3lNeUJETVRFMUxqQXhOeXcyT0M0eE9URWdNVEUwTGpjNE1TdzJNeTR5TnpjZ01URTJMalk1TVN3MU9DNDFOakVnUXpFeU1pNHpNamtzTkRRdU5qUXhJREUwTVM0eUxETXpMamMwTmlBeE5qVXVNekE1TERNd0xqUTVNU0JETVRjekxqUTNPQ3d5T1M0ek9EZ2dNVGd4TGprNE9Td3lPUzQxTWpRZ01Ua3dMakF4TXl3ek1DNDRPRFVnUXpFNU1DNDROalVzTXpFdU1ETWdNVGt4TGpjNE9Td3pNQzQ0T1RNZ01Ua3lMalF5TERNd0xqVXlPQ0JNTVRrMUxqVXdNU3d5T0M0M05TQk1NVFk1TGpZM05pd3hNeTQ0TkNJZ2FXUTlJa1pwYkd3dE1qTWlJR1pwYkd3OUlpTkdRVVpCUmtFaVBqd3ZjR0YwYUQ0S0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQThjR0YwYUNCa1BTSk5NVEV6TGpZM05TdzNOaTQwTlRrZ1F6RXhNeTQxT1RRc056WXVORFU1SURFeE15NDFNVFFzTnpZdU5ETTRJREV4TXk0ME5ESXNOell1TXprM0lFdzJOeTQxTVRnc05Ea3VPRGd5SUVNMk55NHpOelFzTkRrdU56azVJRFkzTGpJNE5DdzBPUzQyTkRVZ05qY3VNamcxTERRNUxqUTNPQ0JETmpjdU1qZzFMRFE1TGpNeE1TQTJOeTR6TnpRc05Ea3VNVFUzSURZM0xqVXhPU3cwT1M0d056TWdUREUwT1M0ek5UVXNNaTR3TURJZ1F6RTBPUzQwT1Rrc01TNDVNVGtnTVRRNUxqWTNOeXd4TGpreE9TQXhORGt1T0RJeExESXVNREF5SUV3eE5UWXVOVFVzTlM0NE9EY2dRekUxTmk0M056UXNOaTR3TVRjZ01UVTJMamcxTERZdU16QXlJREUxTmk0M01qSXNOaTQxTWpZZ1F6RTFOaTQxT1RJc05pNDNORGtnTVRVMkxqTXdOeXcyTGpneU5pQXhOVFl1TURnekxEWXVOamsySUV3eE5Ea3VOVGczTERJdU9UUTJJRXcyT0M0Mk9EY3NORGt1TkRjNUlFd3hNVE11TmpjMUxEYzFMalExTWlCTU1URTJMalV5TXl3M015NDRNRGdnUXpFeE5pNDNNVFVzTnpNdU5qazNJREV4Tnk0eE5ETXNOek11TXprNUlERXhOaTQ1TlRnc056TXVNRE0xSUVNeE1UUXVOVFF5TERZNExqSTROeUF4TVRRdU15dzJNeTR5TWpFZ01URTJMakkxT0N3MU9DNHpPRFVnUXpFeE9TNHdOalFzTlRFdU5EVTRJREV5TlM0eE5ETXNORFV1TVRReklERXpNeTQ0TkN3ME1DNHhNaklnUXpFME1pNDBPVGNzTXpVdU1USTBJREUxTXk0ek5UZ3NNekV1TmpNeklERTJOUzR5TkRjc016QXVNREk0SUVNeE56TXVORFExTERJNExqa3lNU0F4T0RJdU1ETTNMREk1TGpBMU9DQXhPVEF1TURreExETXdMalF5TlNCRE1Ua3dMamd6TERNd0xqVTFJREU1TVM0Mk5USXNNekF1TkRNeUlERTVNaTR4T0RZc016QXVNVEkwSUV3eE9UUXVOVFkzTERJNExqYzFJRXd4TmprdU5EUXlMREUwTGpJME5DQkRNVFk1TGpJeE9Td3hOQzR4TVRVZ01UWTVMakUwTWl3eE15NDRNamtnTVRZNUxqSTNNU3d4TXk0Mk1EWWdRekUyT1M0MExERXpMak00TWlBeE5qa3VOamcxTERFekxqTXdOaUF4TmprdU9UQTVMREV6TGpRek5TQk1NVGsxTGpjek5Dd3lPQzR6TkRVZ1F6RTVOUzQ0Tnprc01qZ3VOREk0SURFNU5TNDVOamdzTWpndU5UZ3pJREU1TlM0NU5qZ3NNamd1TnpVZ1F6RTVOUzQ1Tmpnc01qZ3VPVEUySURFNU5TNDROemtzTWprdU1EY3hJREU1TlM0M016UXNNamt1TVRVMElFd3hPVEl1TmpVekxETXdMamt6TXlCRE1Ua3hMamt6TWl3ek1TNHpOU0F4T1RBdU9Ea3NNekV1TlRBNElERTRPUzQ1TXpVc016RXVNelEySUVNeE9ERXVPVGN5TERJNUxqazVOU0F4TnpNdU5EYzRMREk1TGpnMklERTJOUzR6TnpJc016QXVPVFUwSUVNeE5UTXVOakF5TERNeUxqVTBNeUF4TkRJdU9EWXNNelV1T1RreklERXpOQzR6TURjc05EQXVPVE14SUVNeE1qVXVOemt6TERRMUxqZzBOeUF4TVRrdU9EVXhMRFV5TGpBd05DQXhNVGN1TVRJMExEVTRMamN6TmlCRE1URTFMakkzTERZekxqTXhOQ0F4TVRVdU5UQXhMRFk0TGpFeE1pQXhNVGN1Tnprc056SXVOakV4SUVNeE1UZ3VNVFlzTnpNdU16TTJJREV4Tnk0NE5EVXNOelF1TVRJMElERXhOaTQ1T1N3M05DNDJNVGNnVERFeE15NDVNRGtzTnpZdU16azNJRU14TVRNdU9ETTJMRGMyTGpRek9DQXhNVE11TnpVMkxEYzJMalExT1NBeE1UTXVOamMxTERjMkxqUTFPU0lnYVdROUlrWnBiR3d0TWpRaUlHWnBiR3c5SWlNME5UVkJOalFpUGp3dmNHRjBhRDRLSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBOGNHRjBhQ0JrUFNKTk1UVXpMak14Tml3eU1TNHlOemtnUXpFMU1DNDVNRE1zTWpFdU1qYzVJREUwT0M0ME9UVXNNakF1TnpVeElERTBOaTQyTmpRc01Ua3VOamt6SUVNeE5EUXVPRFEyTERFNExqWTBOQ0F4TkRNdU9EUTBMREUzTGpJek1pQXhORE11T0RRMExERTFMamN4T0NCRE1UUXpMamcwTkN3eE5DNHhPVEVnTVRRMExqZzJMREV5TGpjMk15QXhORFl1TnpBMUxERXhMalk1T0NCTU1UVTJMakU1T0N3MkxqQTVNU0JETVRVMkxqTXdPU3cyTGpBeU5TQXhOVFl1TkRVeUxEWXVNRFl5SURFMU5pNDFNVGdzTmk0eE56TWdRekUxTmk0MU9ETXNOaTR5T0RRZ01UVTJMalUwTnl3MkxqUXlOeUF4TlRZdU5ETTJMRFl1TkRreklFd3hORFl1T1RRc01USXVNVEF5SUVNeE5EVXVNalEwTERFekxqQTRNU0F4TkRRdU16RXlMREUwTGpNMk5TQXhORFF1TXpFeUxERTFMamN4T0NCRE1UUTBMak14TWl3eE55NHdOVGdnTVRRMUxqSXpMREU0TGpNeU5pQXhORFl1T0RrM0xERTVMakk0T1NCRE1UVXdMalEwTml3eU1TNHpNemdnTVRVMkxqSTBMREl4TGpNeU55QXhOVGt1T0RFeExERTVMakkyTlNCTU1UWTVMalUxT1N3eE15NDJNemNnUXpFMk9TNDJOeXd4TXk0MU56TWdNVFk1TGpneE15d3hNeTQyTVRFZ01UWTVMamczT0N3eE15NDNNak1nUXpFMk9TNDVORE1zTVRNdU9ETTBJREUyT1M0NU1EUXNNVE11T1RjM0lERTJPUzQzT1RNc01UUXVNRFF5SUV3eE5qQXVNRFExTERFNUxqWTNJRU14TlRndU1UZzNMREl3TGpjME1pQXhOVFV1TnpRNUxESXhMakkzT1NBeE5UTXVNekUyTERJeExqSTNPU0lnYVdROUlrWnBiR3d0TWpVaUlHWnBiR3c5SWlNMk1EZEVPRUlpUGp3dmNHRjBhRDRLSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBOGNHRjBhQ0JrUFNKTk1URXpMalkzTlN3M05TNDVPVElnVERZM0xqYzJNaXcwT1M0ME9EUWlJR2xrUFNKR2FXeHNMVEkySWlCbWFXeHNQU0lqTkRVMVFUWTBJajQ4TDNCaGRHZytDaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnUEhCaGRHZ2daRDBpVFRFeE15NDJOelVzTnpZdU16UXlJRU14TVRNdU5qRTFMRGMyTGpNME1pQXhNVE11TlRVMUxEYzJMak15TnlBeE1UTXVOU3czTmk0eU9UVWdURFkzTGpVNE55dzBPUzQzT0RjZ1F6WTNMalF4T1N3ME9TNDJPU0EyTnk0ek5qSXNORGt1TkRjMklEWTNMalExT1N3ME9TNHpNRGtnUXpZM0xqVTFOaXcwT1M0eE5ERWdOamN1Tnpjc05Ea3VNRGd6SURZM0xqa3pOeXcwT1M0eE9DQk1NVEV6TGpnMUxEYzFMalk0T0NCRE1URTBMakF4T0N3M05TNDNPRFVnTVRFMExqQTNOU3czTmlBeE1UTXVPVGM0TERjMkxqRTJOeUJETVRFekxqa3hOQ3czTmk0eU56a2dNVEV6TGpjNU5pdzNOaTR6TkRJZ01URXpMalkzTlN3M05pNHpORElpSUdsa1BTSkdhV3hzTFRJM0lpQm1hV3hzUFNJak5EVTFRVFkwSWo0OEwzQmhkR2crQ2lBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ1BIQmhkR2dnWkQwaVRUWTNMamMyTWl3ME9TNDBPRFFnVERZM0xqYzJNaXd4TURNdU5EZzFJRU0yTnk0M05qSXNNVEEwTGpVM05TQTJPQzQxTXpJc01UQTFMamt3TXlBMk9TNDBPRElzTVRBMkxqUTFNaUJNTVRFeExqazFOU3d4TXpBdU9UY3pJRU14TVRJdU9UQTFMREV6TVM0MU1qSWdNVEV6TGpZM05Td3hNekV1TURneklERXhNeTQyTnpVc01USTVMams1TXlCTU1URXpMalkzTlN3M05TNDVPVElpSUdsa1BTSkdhV3hzTFRJNElpQm1hV3hzUFNJalJrRkdRVVpCSWo0OEwzQmhkR2crQ2lBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ1BIQmhkR2dnWkQwaVRURXhNaTQzTWpjc01UTXhMalUyTVNCRE1URXlMalF6TERFek1TNDFOakVnTVRFeUxqRXdOeXd4TXpFdU5EWTJJREV4TVM0M09Dd3hNekV1TWpjMklFdzJPUzR6TURjc01UQTJMamMxTlNCRE5qZ3VNalEwTERFd05pNHhORElnTmpjdU5ERXlMREV3TkM0M01EVWdOamN1TkRFeUxERXdNeTQwT0RVZ1REWTNMalF4TWl3ME9TNDBPRFFnUXpZM0xqUXhNaXcwT1M0eU9TQTJOeTQxTmprc05Ea3VNVE0wSURZM0xqYzJNaXcwT1M0eE16UWdRelkzTGprMU5pdzBPUzR4TXpRZ05qZ3VNVEV6TERRNUxqSTVJRFk0TGpFeE15dzBPUzQwT0RRZ1REWTRMakV4TXl3eE1ETXVORGcxSUVNMk9DNHhNVE1zTVRBMExqUTBOU0EyT0M0NE1pd3hNRFV1TmpZMUlEWTVMalkxTnl3eE1EWXVNVFE0SUV3eE1USXVNVE1zTVRNd0xqWTNJRU14TVRJdU5EYzBMREV6TUM0NE5qZ2dNVEV5TGpjNU1Td3hNekF1T1RFeklERXhNeXd4TXpBdU56a3lJRU14TVRNdU1qQTJMREV6TUM0Mk56TWdNVEV6TGpNeU5Td3hNekF1TXpneElERXhNeTR6TWpVc01USTVMams1TXlCTU1URXpMak15TlN3M05TNDVPVElnUXpFeE15NHpNalVzTnpVdU56azRJREV4TXk0ME9ESXNOelV1TmpReElERXhNeTQyTnpVc056VXVOalF4SUVNeE1UTXVPRFk1TERjMUxqWTBNU0F4TVRRdU1ESTFMRGMxTGpjNU9DQXhNVFF1TURJMUxEYzFMams1TWlCTU1URTBMakF5TlN3eE1qa3VPVGt6SUVNeE1UUXVNREkxTERFek1DNDJORGdnTVRFekxqYzROaXd4TXpFdU1UUTNJREV4TXk0ek5Td3hNekV1TXprNUlFTXhNVE11TVRZeUxERXpNUzQxTURjZ01URXlMamsxTWl3eE16RXVOVFl4SURFeE1pNDNNamNzTVRNeExqVTJNU0lnYVdROUlrWnBiR3d0TWpraUlHWnBiR3c5SWlNME5UVkJOalFpUGp3dmNHRjBhRDRLSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBOGNHRjBhQ0JrUFNKTk1URXlMamcyTERRd0xqVXhNaUJETVRFeUxqZzJMRFF3TGpVeE1pQXhNVEl1T0RZc05EQXVOVEV5SURFeE1pNDROVGtzTkRBdU5URXlJRU14TVRBdU5UUXhMRFF3TGpVeE1pQXhNRGd1TXpZc016a3VPVGtnTVRBMkxqY3hOeXd6T1M0d05ERWdRekV3TlM0d01USXNNemd1TURVM0lERXdOQzR3TnpRc016WXVOekkySURFd05DNHdOelFzTXpVdU1qa3lJRU14TURRdU1EYzBMRE16TGpnME55QXhNRFV1TURJMkxETXlMalV3TVNBeE1EWXVOelUwTERNeExqVXdOQ0JNTVRFNExqYzVOU3d5TkM0MU5URWdRekV5TUM0ME5qTXNNak11TlRnNUlERXlNaTQyTmprc01qTXVNRFU0SURFeU5TNHdNRGNzTWpNdU1EVTRJRU14TWpjdU16STFMREl6TGpBMU9DQXhNamt1TlRBMkxESXpMalU0TVNBeE16RXVNVFVzTWpRdU5UTWdRekV6TWk0NE5UUXNNalV1TlRFMElERXpNeTQzT1RNc01qWXVPRFExSURFek15NDNPVE1zTWpndU1qYzRJRU14TXpNdU56a3pMREk1TGpjeU5DQXhNekl1T0RReExETXhMakEyT1NBeE16RXVNVEV6TERNeUxqQTJOeUJNTVRFNUxqQTNNU3d6T1M0d01Ua2dRekV4Tnk0ME1ETXNNemt1T1RneUlERXhOUzR4T1Rjc05EQXVOVEV5SURFeE1pNDROaXcwTUM0MU1USWdUREV4TWk0NE5pdzBNQzQxTVRJZ1dpQk5NVEkxTGpBd055d3lNeTQzTlRrZ1F6RXlNaTQzT1N3eU15NDNOVGtnTVRJd0xqY3dPU3d5TkM0eU5UWWdNVEU1TGpFME5pd3lOUzR4TlRnZ1RERXdOeTR4TURRc016SXVNVEVnUXpFd05TNDJNRElzTXpJdU9UYzRJREV3TkM0M056UXNNelF1TVRBNElERXdOQzQzTnpRc016VXVNamt5SUVNeE1EUXVOemMwTERNMkxqUTJOU0F4TURVdU5UZzVMRE0zTGpVNE1TQXhNRGN1TURZM0xETTRMalF6TkNCRE1UQTRMall3TlN3ek9TNHpNak1nTVRFd0xqWTJNeXd6T1M0NE1USWdNVEV5TGpnMU9Td3pPUzQ0TVRJZ1RERXhNaTQ0Tml3ek9TNDRNVElnUXpFeE5TNHdOellzTXprdU9ERXlJREV4Tnk0eE5UZ3NNemt1TXpFMUlERXhPQzQzTWpFc016Z3VOREV6SUV3eE16QXVOell5TERNeExqUTJJRU14TXpJdU1qWTBMRE13TGpVNU15QXhNek11TURreUxESTVMalEyTXlBeE16TXVNRGt5TERJNExqSTNPQ0JETVRNekxqQTVNaXd5Tnk0eE1EWWdNVE15TGpJM09Dd3lOUzQ1T1NBeE16QXVPQ3d5TlM0eE16WWdRekV5T1M0eU5qRXNNalF1TWpRNElERXlOeTR5TURRc01qTXVOelU1SURFeU5TNHdNRGNzTWpNdU56VTVJRXd4TWpVdU1EQTNMREl6TGpjMU9TQmFJaUJwWkQwaVJtbHNiQzB6TUNJZ1ptbHNiRDBpSXpZd04wUTRRaUkrUEM5d1lYUm9QZ29nSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUR4d1lYUm9JR1E5SWsweE5qVXVOak1zTVRZdU1qRTVJRXd4TlRrdU9EazJMREU1TGpVeklFTXhOVFl1TnpJNUxESXhMak0xT0NBeE5URXVOakVzTWpFdU16WTNJREUwT0M0ME5qTXNNVGt1TlRVZ1F6RTBOUzR6TVRZc01UY3VOek16SURFME5TNHpNeklzTVRRdU56YzRJREUwT0M0ME9Ua3NNVEl1T1RRNUlFd3hOVFF1TWpNekxEa3VOak01SUV3eE5qVXVOak1zTVRZdU1qRTVJaUJwWkQwaVJtbHNiQzB6TVNJZ1ptbHNiRDBpSTBaQlJrRkdRU0krUEM5d1lYUm9QZ29nSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUR4d1lYUm9JR1E5SWsweE5UUXVNak16TERFd0xqUTBPQ0JNTVRZMExqSXlPQ3d4Tmk0eU1Ua2dUREUxT1M0MU5EWXNNVGd1T1RJeklFTXhOVGd1TVRFeUxERTVMamMxSURFMU5pNHhPVFFzTWpBdU1qQTJJREUxTkM0eE5EY3NNakF1TWpBMklFTXhOVEl1TVRFNExESXdMakl3TmlBeE5UQXVNakkwTERFNUxqYzFOeUF4TkRndU9ERTBMREU0TGprME15QkRNVFEzTGpVeU5Dd3hPQzR4T1RrZ01UUTJMamd4TkN3eE55NHlORGtnTVRRMkxqZ3hOQ3d4Tmk0eU5qa2dRekUwTmk0NE1UUXNNVFV1TWpjNElERTBOeTQxTXpjc01UUXVNekUwSURFME9DNDROU3d4TXk0MU5UWWdUREUxTkM0eU16TXNNVEF1TkRRNElFMHhOVFF1TWpNekxEa3VOak01SUV3eE5EZ3VORGs1TERFeUxqazBPU0JETVRRMUxqTXpNaXd4TkM0M056Z2dNVFExTGpNeE5pd3hOeTQzTXpNZ01UUTRMalEyTXl3eE9TNDFOU0JETVRVd0xqQXpNU3d5TUM0ME5UVWdNVFV5TGpBNE5pd3lNQzQ1TURjZ01UVTBMakUwTnl3eU1DNDVNRGNnUXpFMU5pNHlNalFzTWpBdU9UQTNJREUxT0M0ek1EWXNNakF1TkRRM0lERTFPUzQ0T1RZc01Ua3VOVE1nVERFMk5TNDJNeXd4Tmk0eU1Ua2dUREUxTkM0eU16TXNPUzQyTXpraUlHbGtQU0pHYVd4c0xUTXlJaUJtYVd4c1BTSWpOakEzUkRoQ0lqNDhMM0JoZEdnK0NpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdQSEJoZEdnZ1pEMGlUVEUwTlM0ME5EVXNOekl1TmpZM0lFd3hORFV1TkRRMUxEY3lMalkyTnlCRE1UUXpMalkzTWl3M01pNDJOamNnTVRReUxqSXdOQ3czTVM0NE1UY2dNVFF4TGpJd01pdzNNQzQwTWpJZ1F6RTBNUzR4TXpVc056QXVNek1nTVRReExqRTBOU3czTUM0eE5EY2dNVFF4TGpJeU5TdzNNQzR3TmpZZ1F6RTBNUzR6TURVc05qa3VPVGcxSURFME1TNDBNeklzTmprdU9UUTJJREUwTVM0MU1qVXNOekF1TURFeElFTXhOREl1TXpBMkxEY3dMalUxT1NBeE5ETXVNak14TERjd0xqZ3lNeUF4TkRRdU1qYzJMRGN3TGpneU1pQkRNVFExTGpVNU9DdzNNQzQ0TWpJZ01UUTNMakF6TERjd0xqTTNOaUF4TkRndU5UTXlMRFk1TGpVd09TQkRNVFV6TGpnME1pdzJOaTQwTkRNZ01UVTRMakUyTXl3MU9DNDVPRGNnTVRVNExqRTJNeXcxTWk0NE9UUWdRekUxT0M0eE5qTXNOVEF1T1RZM0lERTFOeTQzTWpFc05Ea3VNek15SURFMU5pNDRPRFFzTkRndU1UWTRJRU14TlRZdU9ERTRMRFE0TGpBM05pQXhOVFl1T0RJNExEUTNMamswT0NBeE5UWXVPVEE0TERRM0xqZzJOeUJETVRVMkxqazRPQ3cwTnk0M09EWWdNVFUzTGpFeE5DdzBOeTQzTnpRZ01UVTNMakl3T0N3ME55NDROQ0JETVRVNExqZzNPQ3cwT1M0d01USWdNVFU1TGpjNU9DdzFNUzR5TWlBeE5Ua3VOems0TERVMExqQTFPU0JETVRVNUxqYzVPQ3cyTUM0ek1ERWdNVFUxTGpNM015dzJPQzR3TkRZZ01UUTVMamt6TXl3M01TNHhPRFlnUXpFME9DNHpOaXczTWk0d09UUWdNVFEyTGpnMUxEY3lMalkyTnlBeE5EVXVORFExTERjeUxqWTJOeUJNTVRRMUxqUTBOU3czTWk0Mk5qY2dXaUJOTVRReUxqUTNOaXczTVNCRE1UUXpMakk1TERjeExqWTFNU0F4TkRRdU1qazJMRGN5TGpBd01pQXhORFV1TkRRMUxEY3lMakF3TWlCRE1UUTJMamMyTnl3M01pNHdNRElnTVRRNExqRTVPQ3czTVM0MU5TQXhORGt1Tnl3M01DNDJPRElnUXpFMU5TNHdNU3cyTnk0Mk1UY2dNVFU1TGpNek1TdzJNQzR4TlRrZ01UVTVMak16TVN3MU5DNHdOalVnUXpFMU9TNHpNekVzTlRJdU1EZzFJREUxT0M0NE5qZ3NOVEF1TkRNMUlERTFPQzR3TURZc05Ea3VNamN5SUVNeE5UZ3VOREUzTERVd0xqTXdOeUF4TlRndU5qTXNOVEV1TlRNeUlERTFPQzQyTXl3MU1pNDRPVElnUXpFMU9DNDJNeXcxT1M0eE16UWdNVFUwTGpJd05TdzJOaTQzTmpjZ01UUTRMamMyTlN3Mk9TNDVNRGNnUXpFME55NHhPVElzTnpBdU9ERTJJREUwTlM0Mk9ERXNOekV1TWpneklERTBOQzR5TnpZc056RXVNamd6SUVNeE5ETXVOak0wTERjeExqSTRNeUF4TkRNdU1ETXpMRGN4TGpFNU1pQXhOREl1TkRjMkxEY3hJRXd4TkRJdU5EYzJMRGN4SUZvaUlHbGtQU0pHYVd4c0xUTXpJaUJtYVd4c1BTSWpOakEzUkRoQ0lqNDhMM0JoZEdnK0NpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdQSEJoZEdnZ1pEMGlUVEUwT0M0Mk5EZ3NOamt1TnpBMElFTXhOVFF1TURNeUxEWTJMalU1TmlBeE5UZ3VNemsyTERVNUxqQTJPQ0F4TlRndU16azJMRFV5TGpnNU1TQkRNVFU0TGpNNU5pdzFNQzQ0TXprZ01UVTNMamt4TXl3ME9TNHhPVGdnTVRVM0xqQTNOQ3cwT0M0d015QkRNVFUxTGpJNE9TdzBOaTQzTnpnZ01UVXlMalk1T1N3ME5pNDRNellnTVRRNUxqZ3hOaXcwT0M0MU1ERWdRekUwTkM0ME16TXNOVEV1TmpBNUlERTBNQzR3Tmpnc05Ua3VNVE0zSURFME1DNHdOamdzTmpVdU16RTBJRU14TkRBdU1EWTRMRFkzTGpNMk5TQXhOREF1TlRVeUxEWTVMakF3TmlBeE5ERXVNemt4TERjd0xqRTNOQ0JETVRRekxqRTNOaXczTVM0ME1qY2dNVFExTGpjMk5TdzNNUzR6TmprZ01UUTRMalkwT0N3Mk9TNDNNRFFpSUdsa1BTSkdhV3hzTFRNMElpQm1hV3hzUFNJalJrRkdRVVpCSWo0OEwzQmhkR2crQ2lBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ1BIQmhkR2dnWkQwaVRURTBOQzR5TnpZc056RXVNamMySUV3eE5EUXVNamMyTERjeExqSTNOaUJETVRRekxqRXpNeXczTVM0eU56WWdNVFF5TGpFeE9DdzNNQzQ1TmprZ01UUXhMakkxTnl3M01DNHpOalVnUXpFME1TNHlNellzTnpBdU16VXhJREUwTVM0eU1UY3NOekF1TXpNeUlERTBNUzR5TURJc056QXVNekV4SUVNeE5EQXVNekEzTERZNUxqQTJOeUF4TXprdU9ETTFMRFkzTGpNek9TQXhNemt1T0RNMUxEWTFMak14TkNCRE1UTTVMamd6TlN3MU9TNHdOek1nTVRRMExqSTJMRFV4TGpRek9TQXhORGt1Tnl3ME9DNHlPVGdnUXpFMU1TNHlOek1zTkRjdU16a2dNVFV5TGpjNE5DdzBOaTQ1TWprZ01UVTBMakU0T1N3ME5pNDVNamtnUXpFMU5TNHpNeklzTkRZdU9USTVJREUxTmk0ek5EY3NORGN1TWpNMklERTFOeTR5TURnc05EY3VPRE01SUVNeE5UY3VNakk1TERRM0xqZzFOQ0F4TlRjdU1qUTRMRFEzTGpnM015QXhOVGN1TWpZekxEUTNMamc1TkNCRE1UVTRMakUxTnl3ME9TNHhNemdnTVRVNExqWXpMRFV3TGpnMk5TQXhOVGd1TmpNc05USXVPRGt4SUVNeE5UZ3VOak1zTlRrdU1UTXlJREUxTkM0eU1EVXNOall1TnpZMklERTBPQzQzTmpVc05qa3VPVEEzSUVNeE5EY3VNVGt5TERjd0xqZ3hOU0F4TkRVdU5qZ3hMRGN4TGpJM05pQXhORFF1TWpjMkxEY3hMakkzTmlCTU1UUTBMakkzTml3M01TNHlOellnV2lCTk1UUXhMalUxT0N3M01DNHhNRFFnUXpFME1pNHpNekVzTnpBdU5qTTNJREUwTXk0eU5EVXNOekV1TURBMUlERTBOQzR5TnpZc056RXVNREExSUVNeE5EVXVOVGs0TERjeExqQXdOU0F4TkRjdU1ETXNOekF1TkRZM0lERTBPQzQxTXpJc05qa3VOaUJETVRVekxqZzBNaXcyTmk0MU16UWdNVFU0TGpFMk15dzFPUzR3TXpNZ01UVTRMakUyTXl3MU1pNDVNemtnUXpFMU9DNHhOak1zTlRFdU1ETXhJREUxTnk0M01qa3NORGt1TXpnMUlERTFOaTQ1TURjc05EZ3VNakl6SUVNeE5UWXVNVE16TERRM0xqWTVNU0F4TlRVdU1qRTVMRFEzTGpRd09TQXhOVFF1TVRnNUxEUTNMalF3T1NCRE1UVXlMamcyTnl3ME55NDBNRGtnTVRVeExqUXpOU3cwTnk0NE5ESWdNVFE1TGprek15dzBPQzQzTURrZ1F6RTBOQzQyTWpNc05URXVOemMxSURFME1DNHpNRElzTlRrdU1qY3pJREUwTUM0ek1ESXNOalV1TXpZMklFTXhOREF1TXpBeUxEWTNMakkzTmlBeE5EQXVOek0yTERZNExqazBNaUF4TkRFdU5UVTRMRGN3TGpFd05DQk1NVFF4TGpVMU9DdzNNQzR4TURRZ1dpSWdhV1E5SWtacGJHd3RNelVpSUdacGJHdzlJaU0yTURkRU9FSWlQand2Y0dGMGFENEtJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0E4Y0dGMGFDQmtQU0pOTVRVd0xqY3lMRFkxTGpNMk1TQk1NVFV3TGpNMU55dzJOUzR3TmpZZ1F6RTFNUzR4TkRjc05qUXVNRGt5SURFMU1TNDROamtzTmpNdU1EUWdNVFV5TGpVd05TdzJNUzQ1TXpnZ1F6RTFNeTR6TVRNc05qQXVOVE01SURFMU15NDVOemdzTlRrdU1EWTNJREUxTkM0ME9ESXNOVGN1TlRZeklFd3hOVFF1T1RJMUxEVTNMamN4TWlCRE1UVTBMalF4TWl3MU9TNHlORFVnTVRVekxqY3pNeXcyTUM0M05EVWdNVFV5TGpreExEWXlMakUzTWlCRE1UVXlMakkyTWl3Mk15NHlPVFVnTVRVeExqVXlOU3cyTkM0ek5qZ2dNVFV3TGpjeUxEWTFMak0yTVNJZ2FXUTlJa1pwYkd3dE16WWlJR1pwYkd3OUlpTTJNRGRFT0VJaVBqd3ZjR0YwYUQ0S0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQThjR0YwYUNCa1BTSk5NVEUxTGpreE55dzROQzQxTVRRZ1RERXhOUzQxTlRRc09EUXVNaklnUXpFeE5pNHpORFFzT0RNdU1qUTFJREV4Tnk0d05qWXNPREl1TVRrMElERXhOeTQzTURJc09ERXVNRGt5SUVNeE1UZ3VOVEVzTnprdU5qa3lJREV4T1M0eE56VXNOemd1TWpJZ01URTVMalkzT0N3M05pNDNNVGNnVERFeU1DNHhNakVzTnpZdU9EWTFJRU14TVRrdU5qQTRMRGM0TGpNNU9DQXhNVGd1T1RNc056a3VPRGs1SURFeE9DNHhNRFlzT0RFdU16STJJRU14TVRjdU5EVTRMRGd5TGpRME9DQXhNVFl1TnpJeUxEZ3pMalV5TVNBeE1UVXVPVEUzTERnMExqVXhOQ0lnYVdROUlrWnBiR3d0TXpjaUlHWnBiR3c5SWlNMk1EZEVPRUlpUGp3dmNHRjBhRDRLSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBOGNHRjBhQ0JrUFNKTk1URTBMREV6TUM0ME56WWdUREV4TkN3eE16QXVNREE0SUV3eE1UUXNOell1TURVeUlFd3hNVFFzTnpVdU5UZzBJRXd4TVRRc056WXVNRFV5SUV3eE1UUXNNVE13TGpBd09DQk1NVEUwTERFek1DNDBOellpSUdsa1BTSkdhV3hzTFRNNElpQm1hV3hzUFNJak5qQTNSRGhDSWo0OEwzQmhkR2crQ2lBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0E4TDJjK0NpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBOFp5QnBaRDBpU1cxd2IzSjBaV1F0VEdGNVpYSnpMVU52Y0hraUlIUnlZVzV6Wm05eWJUMGlkSEpoYm5Oc1lYUmxLRFl5TGpBd01EQXdNQ3dnTUM0d01EQXdNREFwSWlCemEyVjBZMmc2ZEhsd1pUMGlUVk5UYUdGd1pVZHliM1Z3SWo0S0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQThjR0YwYUNCa1BTSk5NVGt1T0RJeUxETTNMalEzTkNCRE1Ua3VPRE01TERNM0xqTXpPU0F4T1M0M05EY3NNemN1TVRrMElERTVMalUxTlN3ek55NHdPRElnUXpFNUxqSXlPQ3d6Tmk0NE9UUWdNVGd1TnpJNUxETTJMamczTWlBeE9DNDBORFlzTXpjdU1ETTNJRXd4TWk0ME16UXNOREF1TlRBNElFTXhNaTR6TURNc05EQXVOVGcwSURFeUxqSTBMRFF3TGpZNE5pQXhNaTR5TkRNc05EQXVOemt6SUVNeE1pNHlORFVzTkRBdU9USTFJREV5TGpJME5TdzBNUzR5TlRRZ01USXVNalExTERReExqTTNNU0JNTVRJdU1qUTFMRFF4TGpReE5DQk1NVEl1TWpNNExEUXhMalUwTWlCRE9DNHhORGdzTkRNdU9EZzNJRFV1TmpRM0xEUTFMak15TVNBMUxqWTBOeXcwTlM0ek1qRWdRelV1TmpRMkxEUTFMak15TVNBekxqVTNMRFEyTGpNMk55QXlMamcyTERVd0xqVXhNeUJETWk0NE5pdzFNQzQxTVRNZ01TNDVORGdzTlRjdU5EYzBJREV1T1RZeUxEY3dMakkxT0NCRE1TNDVOemNzT0RJdU9ESTRJREl1TlRZNExEZzNMak15T0NBekxqRXlPU3c1TVM0Mk1Ea2dRek11TXpRNUxEa3pMakk1TXlBMkxqRXpMRGt6TGpjek5DQTJMakV6TERrekxqY3pOQ0JETmk0ME5qRXNPVE11TnpjMElEWXVPREk0TERrekxqY3dOeUEzTGpJeExEa3pMalE0TmlCTU9ESXVORGd6TERRNUxqa3pOU0JET0RRdU1qa3hMRFE0TGpnMk5pQTROUzR4TlN3ME5pNHlNVFlnT0RVdU5UTTVMRFF6TGpZMU1TQkRPRFl1TnpVeUxETTFMalkyTVNBNE55NHlNVFFzTVRBdU5qY3pJRGcxTGpJMk5Dd3pMamMzTXlCRE9EVXVNRFk0TERNdU1EZ2dPRFF1TnpVMExESXVOamtnT0RRdU16azJMREl1TkRreElFdzRNaTR6TVN3eExqY3dNU0JET0RFdU5UZ3pMREV1TnpJNUlEZ3dMamc1TkN3eUxqRTJPQ0E0TUM0M056WXNNaTR5TXpZZ1F6Z3dMall6Tml3eUxqTXhOeUEwTVM0NE1EY3NNalF1TlRnMUlESXdMakF6TWl3ek55NHdOeklnVERFNUxqZ3lNaXd6Tnk0ME56UWlJR2xrUFNKR2FXeHNMVEVpSUdacGJHdzlJaU5HUmtaR1JrWWlQand2Y0dGMGFENEtJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0E4Y0dGMGFDQmtQU0pOT0RJdU16RXhMREV1TnpBeElFdzROQzR6T1RZc01pNDBPVEVnUXpnMExqYzFOQ3d5TGpZNUlEZzFMakEyT0N3ekxqQTRJRGcxTGpJMk5Dd3pMamMzTXlCRE9EY3VNakV6TERFd0xqWTNNeUE0Tmk0M05URXNNelV1TmpZZ09EVXVOVE01TERRekxqWTFNU0JET0RVdU1UUTVMRFEyTGpJeE5pQTROQzR5T1N3ME9DNDROallnT0RJdU5EZ3pMRFE1TGprek5TQk1OeTR5TVN3NU15NDBPRFlnUXpZdU9EazNMRGt6TGpZMk55QTJMalU1TlN3NU15NDNORFFnTmk0ek1UUXNPVE11TnpRMElFdzJMakV6TVN3NU15NDNNek1nUXpZdU1UTXhMRGt6TGpjek5DQXpMak0wT1N3NU15NHlPVE1nTXk0eE1qZ3NPVEV1TmpBNUlFTXlMalUyT0N3NE55NHpNamNnTVM0NU56Y3NPREl1T0RJNElERXVPVFl6TERjd0xqSTFPQ0JETVM0NU5EZ3NOVGN1TkRjMElESXVPRFlzTlRBdU5URXpJREl1T0RZc05UQXVOVEV6SUVNekxqVTNMRFEyTGpNMk55QTFMalkwTnl3ME5TNHpNakVnTlM0Mk5EY3NORFV1TXpJeElFTTFMalkwTnl3ME5TNHpNakVnT0M0eE5EZ3NORE11T0RnM0lERXlMakl6T0N3ME1TNDFORElnVERFeUxqSTBOU3cwTVM0ME1UUWdUREV5TGpJME5TdzBNUzR6TnpFZ1F6RXlMakkwTlN3ME1TNHlOVFFnTVRJdU1qUTFMRFF3TGpreU5TQXhNaTR5TkRNc05EQXVOemt6SUVNeE1pNHlOQ3cwTUM0Mk9EWWdNVEl1TXpBeUxEUXdMalU0TXlBeE1pNDBNelFzTkRBdU5UQTRJRXd4T0M0ME5EWXNNemN1TURNMklFTXhPQzQxTnpRc016WXVPVFl5SURFNExqYzBOaXd6Tmk0NU1qWWdNVGd1T1RJM0xETTJMamt5TmlCRE1Ua3VNVFExTERNMkxqa3lOaUF4T1M0ek56WXNNell1T1RjNUlERTVMalUxTkN3ek55NHdPRElnUXpFNUxqYzBOeXd6Tnk0eE9UUWdNVGt1T0RNNUxETTNMak0wSURFNUxqZ3lNaXd6Tnk0ME56UWdUREl3TGpBek15d3pOeTR3TnpJZ1F6UXhMamd3Tml3eU5DNDFPRFVnT0RBdU5qTTJMREl1TXpFNElEZ3dMamMzTnl3eUxqSXpOaUJET0RBdU9EazBMREl1TVRZNElEZ3hMalU0TXl3eExqY3lPU0E0TWk0ek1URXNNUzQzTURFZ1RUZ3lMak14TVN3d0xqY3dOQ0JNT0RJdU1qY3lMREF1TnpBMUlFTTRNUzQyTlRRc01DNDNNamdnT0RBdU9UZzVMREF1T1RRNUlEZ3dMakk1T0N3eExqTTJNU0JNT0RBdU1qYzNMREV1TXpjeklFTTRNQzR4TWprc01TNDBOVGdnTlRrdU56WTRMREV6TGpFek5TQXhPUzQzTlRnc016WXVNRGM1SUVNeE9TNDFMRE0xTGprNE1TQXhPUzR5TVRRc016VXVPVEk1SURFNExqa3lOeXd6TlM0NU1qa2dRekU0TGpVMk1pd3pOUzQ1TWprZ01UZ3VNakl6TERNMkxqQXhNeUF4Tnk0NU5EY3NNell1TVRjeklFd3hNUzQ1TXpVc016a3VOalEwSUVNeE1TNDBPVE1zTXprdU9EazVJREV4TGpJek5pdzBNQzR6TXpRZ01URXVNalEyTERRd0xqZ3hJRXd4TVM0eU5EY3NOREF1T1RZZ1REVXVNVFkzTERRMExqUTBOeUJETkM0M09UUXNORFF1TmpRMklESXVOakkxTERRMUxqazNPQ0F4TGpnM055dzFNQzR6TkRVZ1RERXVPRGN4TERVd0xqTTROQ0JETVM0NE5qSXNOVEF1TkRVMElEQXVPVFV4TERVM0xqVTFOeUF3TGprMk5TdzNNQzR5TlRrZ1F6QXVPVGM1TERneUxqZzNPU0F4TGpVMk9DdzROeTR6TnpVZ01pNHhNemNzT1RFdU56STBJRXd5TGpFek9TdzVNUzQzTXprZ1F6SXVORFEzTERrMExqQTVOQ0ExTGpZeE5DdzVOQzQyTmpJZ05TNDVOelVzT1RRdU56RTVJRXcyTGpBd09TdzVOQzQzTWpNZ1F6WXVNVEVzT1RRdU56TTJJRFl1TWpFekxEazBMamMwTWlBMkxqTXhOQ3c1TkM0M05ESWdRell1Tnprc09UUXVOelF5SURjdU1qWXNPVFF1TmpFZ055NDNNU3c1TkM0ek5TQk1PREl1T1RnekxEVXdMamM1T0NCRE9EUXVOemswTERRNUxqY3lOeUE0TlM0NU9ESXNORGN1TXpjMUlEZzJMalV5TlN3ME15NDRNREVnUXpnM0xqY3hNU3d6TlM0NU9EY2dPRGd1TWpVNUxERXdMamN3TlNBNE5pNHlNalFzTXk0MU1ESWdRemcxTGprM01Td3lMall3T1NBNE5TNDFNaXd4TGprM05TQTROQzQ0T0RFc01TNDJNaUJNT0RRdU56UTVMREV1TlRVNElFdzRNaTQyTmpRc01DNDNOamtnUXpneUxqVTFNU3d3TGpjeU5TQTRNaTQwTXpFc01DNDNNRFFnT0RJdU16RXhMREF1TnpBMElpQnBaRDBpUm1sc2JDMHlJaUJtYVd4c1BTSWpORFUxUVRZMElqNDhMM0JoZEdnK0NpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdQSEJoZEdnZ1pEMGlUVFkyTGpJMk55d3hNUzQxTmpVZ1REWTNMamMyTWl3eE1TNDVPVGtnVERFeExqUXlNeXcwTkM0ek1qVWlJR2xrUFNKR2FXeHNMVE1pSUdacGJHdzlJaU5HUmtaR1JrWWlQand2Y0dGMGFENEtJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0E4Y0dGMGFDQmtQU0pOTVRJdU1qQXlMRGt3TGpVME5TQkRNVEl1TURJNUxEa3dMalUwTlNBeE1TNDROaklzT1RBdU5EVTFJREV4TGpjMk9TdzVNQzR5T1RVZ1F6RXhMall6TWl3NU1DNHdOVGNnTVRFdU56RXpMRGc1TGpjMU1pQXhNUzQ1TlRJc09Ea3VOakUwSUV3ek1DNHpPRGtzTnpndU9UWTVJRU16TUM0Mk1qZ3NOemd1T0RNeElETXdMamt6TXl3M09DNDVNVE1nTXpFdU1EY3hMRGM1TGpFMU1pQkRNekV1TWpBNExEYzVMak01SURNeExqRXlOeXczT1M0Mk9UWWdNekF1T0RnNExEYzVMamd6TXlCTU1USXVORFV4TERrd0xqUTNPQ0JNTVRJdU1qQXlMRGt3TGpVME5TSWdhV1E5SWtacGJHd3ROQ0lnWm1sc2JEMGlJell3TjBRNFFpSStQQzl3WVhSb1Bnb2dJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJRHh3WVhSb0lHUTlJazB4TXk0M05qUXNOREl1TmpVMElFd3hNeTQyTlRZc05ESXVOVGt5SUV3eE15NDNNRElzTkRJdU5ESXhJRXd4T0M0NE16Y3NNemt1TkRVM0lFd3hPUzR3TURjc016a3VOVEF5SUV3eE9DNDVOaklzTXprdU5qY3pJRXd4TXk0NE1qY3NOREl1TmpNM0lFd3hNeTQzTmpRc05ESXVOalUwSWlCcFpEMGlSbWxzYkMwMUlpQm1hV3hzUFNJak5qQTNSRGhDSWo0OEwzQmhkR2crQ2lBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ1BIQmhkR2dnWkQwaVRUZ3VOVElzT1RBdU16YzFJRXc0TGpVeUxEUTJMalF5TVNCTU9DNDFPRE1zTkRZdU16ZzFJRXczTlM0NE5DdzNMalUxTkNCTU56VXVPRFFzTlRFdU5UQTRJRXczTlM0M056Z3NOVEV1TlRRMElFdzRMalV5TERrd0xqTTNOU0JNT0M0MU1pdzVNQzR6TnpVZ1dpQk5PQzQzTnl3ME5pNDFOalFnVERndU56Y3NPRGt1T1RRMElFdzNOUzQxT1RFc05URXVNelkxSUV3M05TNDFPVEVzTnk0NU9EVWdURGd1Tnpjc05EWXVOVFkwSUV3NExqYzNMRFEyTGpVMk5DQmFJaUJwWkQwaVJtbHNiQzAySWlCbWFXeHNQU0lqTmpBM1JEaENJajQ4TDNCaGRHZytDaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnUEhCaGRHZ2daRDBpVFRJMExqazROaXc0TXk0eE9ESWdRekkwTGpjMU5pdzRNeTR6TXpFZ01qUXVNemMwTERnekxqVTJOaUF5TkM0eE16Y3NPRE11TnpBMUlFd3hNaTQyTXpJc09UQXVOREEySUVNeE1pNHpPVFVzT1RBdU5UUTFJREV5TGpReU5pdzVNQzQyTlRnZ01USXVOeXc1TUM0Mk5UZ2dUREV6TGpJMk5TdzVNQzQyTlRnZ1F6RXpMalUwTERrd0xqWTFPQ0F4TXk0NU5UZ3NPVEF1TlRRMUlERTBMakU1TlN3NU1DNDBNRFlnVERJMUxqY3NPRE11TnpBMUlFTXlOUzQ1TXpjc09ETXVOVFkySURJMkxqRXlPQ3c0TXk0ME5USWdNall1TVRJMUxEZ3pMalEwT1NCRE1qWXVNVEl5TERnekxqUTBOeUF5Tmk0eE1Ua3NPRE11TWpJZ01qWXVNVEU1TERneUxqazBOaUJETWpZdU1URTVMRGd5TGpZM01pQXlOUzQ1TXpFc09ESXVOVFk1SURJMUxqY3dNU3c0TWk0M01Ua2dUREkwTGprNE5pdzRNeTR4T0RJaUlHbGtQU0pHYVd4c0xUY2lJR1pwYkd3OUlpTTJNRGRFT0VJaVBqd3ZjR0YwYUQ0S0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQThjR0YwYUNCa1BTSk5NVE11TWpZMkxEa3dMamM0TWlCTU1USXVOeXc1TUM0M09ESWdRekV5TGpVc09UQXVOemd5SURFeUxqTTROQ3c1TUM0M01qWWdNVEl1TXpVMExEa3dMall4TmlCRE1USXVNekkwTERrd0xqVXdOaUF4TWk0ek9UY3NPVEF1TXprNUlERXlMalUyT1N3NU1DNHlPVGtnVERJMExqQTNOQ3c0TXk0MU9UY2dRekkwTGpNeExEZ3pMalExT1NBeU5DNDJPRGtzT0RNdU1qSTJJREkwTGpreE9DdzRNeTR3TnpnZ1RESTFMall6TXl3NE1pNDJNVFFnUXpJMUxqY3lNeXc0TWk0MU5UVWdNalV1T0RFekxEZ3lMalV5TlNBeU5TNDRPVGtzT0RJdU5USTFJRU15Tmk0d056RXNPREl1TlRJMUlESTJMakkwTkN3NE1pNDJOVFVnTWpZdU1qUTBMRGd5TGprME5pQkRNall1TWpRMExEZ3pMakUySURJMkxqSTBOU3c0TXk0ek1Ea2dNall1TWpRM0xEZ3pMak00TXlCTU1qWXVNalV6TERnekxqTTROeUJNTWpZdU1qUTVMRGd6TGpRMU5pQkRNall1TWpRMkxEZ3pMalV6TVNBeU5pNHlORFlzT0RNdU5UTXhJREkxTGpjMk15dzRNeTQ0TVRJZ1RERTBMakkxT0N3NU1DNDFNVFFnUXpFMExEa3dMalkyTlNBeE15NDFOalFzT1RBdU56Z3lJREV6TGpJMk5pdzVNQzQzT0RJZ1RERXpMakkyTml3NU1DNDNPRElnV2lCTk1USXVOalkyTERrd0xqVXpNaUJNTVRJdU55dzVNQzQxTXpNZ1RERXpMakkyTml3NU1DNDFNek1nUXpFekxqVXhPQ3c1TUM0MU16TWdNVE11T1RFMUxEa3dMalF5TlNBeE5DNHhNeklzT1RBdU1qazVJRXd5TlM0Mk16Y3NPRE11TlRrM0lFTXlOUzQ0TURVc09ETXVORGs1SURJMUxqa3pNU3c0TXk0ME1qUWdNalV1T1RrNExEZ3pMak00TXlCRE1qVXVPVGswTERnekxqSTVPU0F5TlM0NU9UUXNPRE11TVRZMUlESTFMams1TkN3NE1pNDVORFlnVERJMUxqZzVPU3c0TWk0M056VWdUREkxTGpjMk9DdzRNaTQ0TWpRZ1RESTFMakExTkN3NE15NHlPRGNnUXpJMExqZ3lNaXc0TXk0ME16Y2dNalF1TkRNNExEZ3pMalkzTXlBeU5DNHlMRGd6TGpneE1pQk1NVEl1TmprMUxEa3dMalV4TkNCTU1USXVOalkyTERrd0xqVXpNaUJNTVRJdU5qWTJMRGt3TGpVek1pQmFJaUJwWkQwaVJtbHNiQzA0SWlCbWFXeHNQU0lqTmpBM1JEaENJajQ4TDNCaGRHZytDaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnUEhCaGRHZ2daRDBpVFRFekxqSTJOaXc0T1M0NE56RWdUREV5TGpjc09Ea3VPRGN4SUVNeE1pNDFMRGc1TGpnM01TQXhNaTR6T0RRc09Ea3VPREUxSURFeUxqTTFOQ3c0T1M0M01EVWdRekV5TGpNeU5DdzRPUzQxT1RVZ01USXVNemszTERnNUxqUTRPQ0F4TWk0MU5qa3NPRGt1TXpnNElFd3lOQzR3TnpRc09ESXVOamcySUVNeU5DNHpNeklzT0RJdU5UTTFJREkwTGpjMk9DdzRNaTQwTVRnZ01qVXVNRFkzTERneUxqUXhPQ0JNTWpVdU5qTXlMRGd5TGpReE9DQkRNalV1T0RNeUxEZ3lMalF4T0NBeU5TNDVORGdzT0RJdU5EYzBJREkxTGprM09DdzRNaTQxT0RRZ1F6STJMakF3T0N3NE1pNDJPVFFnTWpVdU9UTTFMRGd5TGpnd01TQXlOUzQzTmpNc09ESXVPVEF4SUV3eE5DNHlOVGdzT0RrdU5qQXpJRU14TkN3NE9TNDNOVFFnTVRNdU5UWTBMRGc1TGpnM01TQXhNeTR5TmpZc09Ea3VPRGN4SUV3eE15NHlOallzT0RrdU9EY3hJRm9nVFRFeUxqWTJOaXc0T1M0Mk1qRWdUREV5TGpjc09Ea3VOakl5SUV3eE15NHlOallzT0RrdU5qSXlJRU14TXk0MU1UZ3NPRGt1TmpJeUlERXpMamt4TlN3NE9TNDFNVFVnTVRRdU1UTXlMRGc1TGpNNE9DQk1NalV1TmpNM0xEZ3lMalk0TmlCTU1qVXVOalkzTERneUxqWTJPQ0JNTWpVdU5qTXlMRGd5TGpZMk55Qk1NalV1TURZM0xEZ3lMalkyTnlCRE1qUXVPREUxTERneUxqWTJOeUF5TkM0ME1UZ3NPREl1TnpjMUlESTBMaklzT0RJdU9UQXhJRXd4TWk0Mk9UVXNPRGt1TmpBeklFd3hNaTQyTmpZc09Ea3VOakl4SUV3eE1pNDJOallzT0RrdU5qSXhJRm9pSUdsa1BTSkdhV3hzTFRraUlHWnBiR3c5SWlNMk1EZEVPRUlpUGp3dmNHRjBhRDRLSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBOGNHRjBhQ0JrUFNKTk1USXVNemNzT1RBdU9EQXhJRXd4TWk0ek55dzRPUzQxTlRRZ1RERXlMak0zTERrd0xqZ3dNU0lnYVdROUlrWnBiR3d0TVRBaUlHWnBiR3c5SWlNMk1EZEVPRUlpUGp3dmNHRjBhRDRLSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBOGNHRjBhQ0JrUFNKTk5pNHhNeXc1TXk0NU1ERWdRelV1TXpjNUxEa3pMamd3T0NBMExqZ3hOaXc1TXk0eE5qUWdOQzQyT1RFc09USXVOVEkxSUVNekxqZzJMRGc0TGpJNE55QXpMalUwTERnekxqYzBNeUF6TGpVeU5pdzNNUzR4TnpNZ1F6TXVOVEV4TERVNExqTTRPU0EwTGpReU15dzFNUzQwTWpnZ05DNDBNak1zTlRFdU5ESTRJRU0xTGpFek5DdzBOeTR5T0RJZ055NHlNU3cwTmk0eU16WWdOeTR5TVN3ME5pNHlNellnUXpjdU1qRXNORFl1TWpNMklEZ3hMalkyTnl3ekxqSTFJRGd5TGpBMk9Td3pMakF4TnlCRE9ESXVNamt5TERJdU9EZzRJRGcwTGpVMU5pd3hMalF6TXlBNE5TNHlOalFzTXk0NU5DQkRPRGN1TWpFMExERXdMamcwSURnMkxqYzFNaXd6TlM0NE1qY2dPRFV1TlRNNUxEUXpMamd4T0NCRE9EVXVNVFVzTkRZdU16Z3pJRGcwTGpJNU1TdzBPUzR3TXpNZ09ESXVORGd6TERVd0xqRXdNU0JNTnk0eU1TdzVNeTQyTlRNZ1F6WXVPREk0TERrekxqZzNOQ0EyTGpRMk1TdzVNeTQ1TkRFZ05pNHhNeXc1TXk0NU1ERWdRell1TVRNc09UTXVPVEF4SURNdU16UTVMRGt6TGpRMklETXVNVEk1TERreExqYzNOaUJETWk0MU5qZ3NPRGN1TkRrMUlERXVPVGMzTERneUxqazVOU0F4TGprMk1pdzNNQzQwTWpVZ1F6RXVPVFE0TERVM0xqWTBNU0F5TGpnMkxEVXdMalk0SURJdU9EWXNOVEF1TmpnZ1F6TXVOVGNzTkRZdU5UTTBJRFV1TmpRM0xEUTFMalE0T1NBMUxqWTBOeXcwTlM0ME9Ea2dRelV1TmpRMkxEUTFMalE0T1NBNExqQTJOU3cwTkM0d09USWdNVEl1TWpRMUxEUXhMalkzT1NCTU1UTXVNVEUyTERReExqVTJJRXd4T1M0M01UVXNNemN1TnpNZ1RERTVMamMyTVN3ek55NHlOamtnVERZdU1UTXNPVE11T1RBeElpQnBaRDBpUm1sc2JDMHhNU0lnWm1sc2JEMGlJMFpCUmtGR1FTSStQQzl3WVhSb1Bnb2dJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJRHh3WVhSb0lHUTlJazAyTGpNeE55dzVOQzR4TmpFZ1REWXVNVEF5TERrMExqRTBPQ0JNTmk0eE1ERXNPVFF1TVRRNElFdzFMamcxTnl3NU5DNHhNREVnUXpVdU1UTTRMRGt6TGprME5TQXpMakE0TlN3NU15NHpOalVnTWk0NE9ERXNPVEV1T0RBNUlFTXlMak14TXl3NE55NDBOamtnTVM0M01qY3NPREl1T1RrMklERXVOekV6TERjd0xqUXlOU0JETVM0Mk9Ua3NOVGN1TnpjeElESXVOakEwTERVd0xqY3hPQ0F5TGpZeE15dzFNQzQyTkRnZ1F6TXVNek00TERRMkxqUXhOeUExTGpRME5TdzBOUzR6TVNBMUxqVXpOU3cwTlM0eU5qWWdUREV5TGpFMk15dzBNUzQwTXprZ1RERXpMakF6TXl3ME1TNHpNaUJNTVRrdU5EYzVMRE0zTGpVM09DQk1NVGt1TlRFekxETTNMakkwTkNCRE1Ua3VOVEkyTERNM0xqRXdOeUF4T1M0Mk5EY3NNemN1TURBNElERTVMamM0Tml3ek55NHdNakVnUXpFNUxqa3lNaXd6Tnk0d016UWdNakF1TURJekxETTNMakUxTmlBeU1DNHdNRGtzTXpjdU1qa3pJRXd4T1M0NU5Td3pOeTQ0T0RJZ1RERXpMakU1T0N3ME1TNDRNREVnVERFeUxqTXlPQ3cwTVM0NU1Ua2dURFV1TnpjeUxEUTFMamN3TkNCRE5TNDNOREVzTkRVdU56SWdNeTQzT0RJc05EWXVOemN5SURNdU1UQTJMRFV3TGpjeU1pQkRNeTR3T1Rrc05UQXVOemd5SURJdU1UazRMRFUzTGpnd09DQXlMakl4TWl3M01DNDBNalFnUXpJdU1qSTJMRGd5TGprMk15QXlMamd3T1N3NE55NDBNaUF6TGpNM015dzVNUzQzTWprZ1F6TXVORFkwTERreUxqUXlJRFF1TURZeUxEa3lMamc0TXlBMExqWTRNaXc1TXk0eE9ERWdRelF1TlRZMkxEa3lMams0TkNBMExqUTROaXc1TWk0M056WWdOQzQwTkRZc09USXVOVGN5SUVNekxqWTJOU3c0T0M0MU9EZ2dNeTR5T1RFc09EUXVNemNnTXk0eU56WXNOekV1TVRjeklFTXpMakkyTWl3MU9DNDFNaUEwTGpFMk55dzFNUzQwTmpZZ05DNHhOellzTlRFdU16azJJRU0wTGprd01TdzBOeTR4TmpVZ055NHdNRGdzTkRZdU1EVTVJRGN1TURrNExEUTJMakF4TkNCRE55NHdPVFFzTkRZdU1ERTFJRGd4TGpVME1pd3pMakF6TkNBNE1TNDVORFFzTWk0NE1ESWdURGd4TGprM01pd3lMamM0TlNCRE9ESXVPRGMyTERJdU1qUTNJRGd6TGpZNU1pd3lMakE1TnlBNE5DNHpNeklzTWk0ek5USWdRemcwTGpnNE55d3lMalUzTXlBNE5TNHlPREVzTXk0d09EVWdPRFV1TlRBMExETXVPRGN5SUVNNE55NDFNVGdzTVRFZ09EWXVPVFkwTERNMkxqQTVNU0E0TlM0M09EVXNORE11T0RVMUlFTTROUzR5Tnpnc05EY3VNVGsySURnMExqSXhMRFE1TGpNM0lEZ3lMall4TERVd0xqTXhOeUJNTnk0ek16VXNPVE11T0RZNUlFTTJMams1T1N3NU5DNHdOak1nTmk0Mk5UZ3NPVFF1TVRZeElEWXVNekUzTERrMExqRTJNU0JNTmk0ek1UY3NPVFF1TVRZeElGb2dUVFl1TVRjc09UTXVOalUwSUVNMkxqUTJNeXc1TXk0Mk9TQTJMamMzTkN3NU15NDJNVGNnTnk0d09EVXNPVE11TkRNM0lFdzRNaTR6TlRnc05Ea3VPRGcySUVNNE5DNHhPREVzTkRndU9EQTRJRGcwTGprMkxEUTFMamszTVNBNE5TNHlPVElzTkRNdU56Z2dRemcyTGpRMk5pd3pOaTR3TkRrZ09EY3VNREl6TERFeExqQTROU0E0TlM0d01qUXNOQzR3TURnZ1F6ZzBMamcwTml3ekxqTTNOeUE0TkM0MU5URXNNaTQ1TnpZZ09EUXVNVFE0TERJdU9ERTJJRU00TXk0Mk5qUXNNaTQyTWpNZ09ESXVPVGd5TERJdU56WTBJRGd5TGpJeU55d3pMakl4TXlCTU9ESXVNVGt6TERNdU1qTTBJRU00TVM0M09URXNNeTQwTmpZZ055NHpNelVzTkRZdU5EVXlJRGN1TXpNMUxEUTJMalExTWlCRE55NHpNRFFzTkRZdU5EWTVJRFV1TXpRMkxEUTNMalV5TVNBMExqWTJPU3cxTVM0ME56RWdRelF1TmpZeUxEVXhMalV6SURNdU56WXhMRFU0TGpVMU5pQXpMamMzTlN3M01TNHhOek1nUXpNdU56a3NPRFF1TXpJNElEUXVNVFl4TERnNExqVXlOQ0EwTGprek5pdzVNaTQwTnpZZ1F6VXVNREkyTERreUxqa3pOeUExTGpReE1pdzVNeTQwTlRrZ05TNDVOek1zT1RNdU5qRTFJRU0yTGpBNE55dzVNeTQyTkNBMkxqRTFPQ3c1TXk0Mk5USWdOaTR4Tmprc09UTXVOalUwSUV3MkxqRTNMRGt6TGpZMU5DQk1OaTR4Tnl3NU15NDJOVFFnV2lJZ2FXUTlJa1pwYkd3dE1USWlJR1pwYkd3OUlpTTBOVFZCTmpRaVBqd3ZjR0YwYUQ0S0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQThjR0YwYUNCa1BTSk5OeTR6TVRjc05qZ3VPVGd5SUVNM0xqZ3dOaXcyT0M0M01ERWdPQzR5TURJc05qZ3VPVEkySURndU1qQXlMRFk1TGpRNE55QkRPQzR5TURJc056QXVNRFEzSURjdU9EQTJMRGN3TGpjeklEY3VNekUzTERjeExqQXhNaUJETmk0NE1qa3NOekV1TWprMElEWXVORE16TERjeExqQTJPU0EyTGpRek15dzNNQzQxTURnZ1F6WXVORE16TERZNUxqazBPQ0EyTGpneU9TdzJPUzR5TmpVZ055NHpNVGNzTmpndU9UZ3lJaUJwWkQwaVJtbHNiQzB4TXlJZ1ptbHNiRDBpSTBaR1JrWkdSaUkrUEM5d1lYUm9QZ29nSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUR4d1lYUm9JR1E5SWswMkxqa3lMRGN4TGpFek15QkROaTQyTXpFc056RXVNVE16SURZdU5ETXpMRGN3TGprd05TQTJMalF6TXl3M01DNDFNRGdnUXpZdU5ETXpMRFk1TGprME9DQTJMamd5T1N3Mk9TNHlOalVnTnk0ek1UY3NOamd1T1RneUlFTTNMalEyTERZNExqa2dOeTQxT1RVc05qZ3VPRFl4SURjdU56RTBMRFk0TGpnMk1TQkRPQzR3TURNc05qZ3VPRFl4SURndU1qQXlMRFk1TGpBNUlEZ3VNakF5TERZNUxqUTROeUJET0M0eU1ESXNOekF1TURRM0lEY3VPREEyTERjd0xqY3pJRGN1TXpFM0xEY3hMakF4TWlCRE55NHhOelFzTnpFdU1EazBJRGN1TURNNUxEY3hMakV6TXlBMkxqa3lMRGN4TGpFek15Qk5OeTQzTVRRc05qZ3VOamMwSUVNM0xqVTFOeXcyT0M0Mk56UWdOeTR6T1RJc05qZ3VOekl6SURjdU1qSTBMRFk0TGpneU1TQkROaTQyTnpZc05qa3VNVE00SURZdU1qUTJMRFk1TGpnM09TQTJMakkwTml3M01DNDFNRGdnUXpZdU1qUTJMRGN3TGprNU5DQTJMalV4Tnl3M01TNHpNaUEyTGpreUxEY3hMak15SUVNM0xqQTNPQ3czTVM0ek1pQTNMakkwTXl3M01TNHlOekVnTnk0ME1URXNOekV1TVRjMElFTTNMamsxT1N3M01DNDROVGNnT0M0ek9Ea3NOekF1TVRFM0lEZ3VNemc1TERZNUxqUTROeUJET0M0ek9Ea3NOamt1TURBeElEZ3VNVEUzTERZNExqWTNOQ0EzTGpjeE5DdzJPQzQyTnpRaUlHbGtQU0pHYVd4c0xURTBJaUJtYVd4c1BTSWpPREE1TjBFeUlqNDhMM0JoZEdnK0NpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdQSEJoZEdnZ1pEMGlUVFl1T1RJc056QXVPVFEzSUVNMkxqWTBPU3czTUM0NU5EY2dOaTQyTWpFc056QXVOalFnTmk0Mk1qRXNOekF1TlRBNElFTTJMall5TVN3M01DNHdNVGNnTmk0NU9ESXNOamt1TXpreUlEY3VOREV4TERZNUxqRTBOU0JETnk0MU1qRXNOamt1TURneUlEY3VOakkxTERZNUxqQTBPU0EzTGpjeE5DdzJPUzR3TkRrZ1F6Y3VPVGcyTERZNUxqQTBPU0E0TGpBeE5TdzJPUzR6TlRVZ09DNHdNVFVzTmprdU5EZzNJRU00TGpBeE5TdzJPUzQ1TnpnZ055NDJOVElzTnpBdU5qQXpJRGN1TWpJMExEY3dMamcxTVNCRE55NHhNVFVzTnpBdU9URTBJRGN1TURFc056QXVPVFEzSURZdU9USXNOekF1T1RRM0lFMDNMamN4TkN3Mk9DNDROakVnUXpjdU5UazFMRFk0TGpnMk1TQTNMalEyTERZNExqa2dOeTR6TVRjc05qZ3VPVGd5SUVNMkxqZ3lPU3cyT1M0eU5qVWdOaTQwTXpNc05qa3VPVFE0SURZdU5ETXpMRGN3TGpVd09DQkROaTQwTXpNc056QXVPVEExSURZdU5qTXhMRGN4TGpFek15QTJMamt5TERjeExqRXpNeUJETnk0d016a3NOekV1TVRNeklEY3VNVGMwTERjeExqQTVOQ0EzTGpNeE55dzNNUzR3TVRJZ1F6Y3VPREEyTERjd0xqY3pJRGd1TWpBeUxEY3dMakEwTnlBNExqSXdNaXcyT1M0ME9EY2dRemd1TWpBeUxEWTVMakE1SURndU1EQXpMRFk0TGpnMk1TQTNMamN4TkN3Mk9DNDROakVpSUdsa1BTSkdhV3hzTFRFMUlpQm1hV3hzUFNJak9EQTVOMEV5SWo0OEwzQmhkR2crQ2lBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ1BIQmhkR2dnWkQwaVRUY3VORFEwTERnMUxqTTFJRU0zTGpjd09DdzROUzR4T1RnZ055NDVNakVzT0RVdU16RTVJRGN1T1RJeExEZzFMall5TWlCRE55NDVNakVzT0RVdU9USTFJRGN1TnpBNExEZzJMakk1TWlBM0xqUTBOQ3c0Tmk0ME5EUWdRemN1TVRneExEZzJMalU1TnlBMkxqazJOeXc0Tmk0ME56VWdOaTQ1Tmpjc09EWXVNVGN6SUVNMkxqazJOeXc0TlM0NE56RWdOeTR4T0RFc09EVXVOVEF5SURjdU5EUTBMRGcxTGpNMUlpQnBaRDBpUm1sc2JDMHhOaUlnWm1sc2JEMGlJMFpHUmtaR1JpSStQQzl3WVhSb1Bnb2dJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJRHh3WVhSb0lHUTlJazAzTGpJekxEZzJMalV4SUVNM0xqQTNOQ3c0Tmk0MU1TQTJMamsyTnl3NE5pNHpPRGNnTmk0NU5qY3NPRFl1TVRjeklFTTJMamsyTnl3NE5TNDROekVnTnk0eE9ERXNPRFV1TlRBeUlEY3VORFEwTERnMUxqTTFJRU0zTGpVeU1TdzROUzR6TURVZ055NDFPVFFzT0RVdU1qZzBJRGN1TmpVNExEZzFMakk0TkNCRE55NDRNVFFzT0RVdU1qZzBJRGN1T1RJeExEZzFMalF3T0NBM0xqa3lNU3c0TlM0Mk1qSWdRemN1T1RJeExEZzFMamt5TlNBM0xqY3dPQ3c0Tmk0eU9USWdOeTQwTkRRc09EWXVORFEwSUVNM0xqTTJOeXc0Tmk0ME9Ea2dOeTR5T1RRc09EWXVOVEVnTnk0eU15dzROaTQxTVNCTk55NDJOVGdzT0RVdU1EazRJRU0zTGpVMU9DdzROUzR3T1RnZ055NDBOVFVzT0RVdU1USTNJRGN1TXpVeExEZzFMakU0T0NCRE55NHdNekVzT0RVdU16Y3pJRFl1TnpneExEZzFMamd3TmlBMkxqYzRNU3c0Tmk0eE56TWdRell1TnpneExEZzJMalE0TWlBMkxqazJOaXc0Tmk0Mk9UY2dOeTR5TXl3NE5pNDJPVGNnUXpjdU16TXNPRFl1TmprM0lEY3VORE16TERnMkxqWTJOaUEzTGpVek9DdzROaTQyTURjZ1F6Y3VPRFU0TERnMkxqUXlNaUE0TGpFd09DdzROUzQ1T0RrZ09DNHhNRGdzT0RVdU5qSXlJRU00TGpFd09DdzROUzR6TVRNZ055NDVNak1zT0RVdU1EazRJRGN1TmpVNExEZzFMakE1T0NJZ2FXUTlJa1pwYkd3dE1UY2lJR1pwYkd3OUlpTTRNRGszUVRJaVBqd3ZjR0YwYUQ0S0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQThjR0YwYUNCa1BTSk5OeTR5TXl3NE5pNHpNaklnVERjdU1UVTBMRGcyTGpFM015QkROeTR4TlRRc09EVXVPVE00SURjdU16TXpMRGcxTGpZeU9TQTNMalV6T0N3NE5TNDFNVElnVERjdU5qVTRMRGcxTGpRM01TQk1OeTQzTXpRc09EVXVOakl5SUVNM0xqY3pOQ3c0TlM0NE5UWWdOeTQxTlRVc09EWXVNVFkwSURjdU16VXhMRGcyTGpJNE1pQk1OeTR5TXl3NE5pNHpNaklnVFRjdU5qVTRMRGcxTGpJNE5DQkROeTQxT1RRc09EVXVNamcwSURjdU5USXhMRGcxTGpNd05TQTNMalEwTkN3NE5TNHpOU0JETnk0eE9ERXNPRFV1TlRBeUlEWXVPVFkzTERnMUxqZzNNU0EyTGprMk55dzROaTR4TnpNZ1F6WXVPVFkzTERnMkxqTTROeUEzTGpBM05DdzROaTQxTVNBM0xqSXpMRGcyTGpVeElFTTNMakk1TkN3NE5pNDFNU0EzTGpNMk55dzROaTQwT0RrZ055NDBORFFzT0RZdU5EUTBJRU0zTGpjd09DdzROaTR5T1RJZ055NDVNakVzT0RVdU9USTFJRGN1T1RJeExEZzFMall5TWlCRE55NDVNakVzT0RVdU5EQTRJRGN1T0RFMExEZzFMakk0TkNBM0xqWTFPQ3c0TlM0eU9EUWlJR2xrUFNKR2FXeHNMVEU0SWlCbWFXeHNQU0lqT0RBNU4wRXlJajQ4TDNCaGRHZytDaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnUEhCaGRHZ2daRDBpVFRjM0xqSTNPQ3czTGpjMk9TQk1OemN1TWpjNExEVXhMalF6TmlCTU1UQXVNakE0TERrd0xqRTJJRXd4TUM0eU1EZ3NORFl1TkRreklFdzNOeTR5Tnpnc055NDNOamtpSUdsa1BTSkdhV3hzTFRFNUlpQm1hV3hzUFNJak5EVTFRVFkwSWo0OEwzQmhkR2crQ2lBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ1BIQmhkR2dnWkQwaVRURXdMakE0TXl3NU1DNHpOelVnVERFd0xqQTRNeXcwTmk0ME1qRWdUREV3TGpFME5pdzBOaTR6T0RVZ1REYzNMalF3TXl3M0xqVTFOQ0JNTnpjdU5EQXpMRFV4TGpVd09DQk1OemN1TXpReExEVXhMalUwTkNCTU1UQXVNRGd6TERrd0xqTTNOU0JNTVRBdU1EZ3pMRGt3TGpNM05TQmFJRTB4TUM0ek16TXNORFl1TlRZMElFd3hNQzR6TXpNc09Ea3VPVFEwSUV3M055NHhOVFFzTlRFdU16WTFJRXczTnk0eE5UUXNOeTQ1T0RVZ1RERXdMak16TXl3ME5pNDFOalFnVERFd0xqTXpNeXcwTmk0MU5qUWdXaUlnYVdROUlrWnBiR3d0TWpBaUlHWnBiR3c5SWlNMk1EZEVPRUlpUGp3dmNHRjBhRDRLSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJRHd2Wno0S0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUR4d1lYUm9JR1E5SWsweE1qVXVOek0zTERnNExqWTBOeUJNTVRFNExqQTVPQ3c1TVM0NU9ERWdUREV4T0M0d09UZ3NPRFFnVERFd05pNDJNemtzT0RndU56RXpJRXd4TURZdU5qTTVMRGsyTGprNE1pQk1PVGtzTVRBd0xqTXhOU0JNTVRFeUxqTTJPU3d4TURNdU9UWXhJRXd4TWpVdU56TTNMRGc0TGpZME55SWdhV1E5SWtsdGNHOXlkR1ZrTFV4aGVXVnljeTFEYjNCNUxUSWlJR1pwYkd3OUlpTTBOVFZCTmpRaUlITnJaWFJqYURwMGVYQmxQU0pOVTFOb1lYQmxSM0p2ZFhBaVBqd3ZjR0YwYUQ0S0lDQWdJQ0FnSUNBZ0lDQWdQQzluUGdvZ0lDQWdJQ0FnSUR3dlp6NEtJQ0FnSUR3dlp6NEtQQzl6ZG1jKycpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBSb3RhdGVJbnN0cnVjdGlvbnM7XG4iLCIvKlxuICogQ29weXJpZ2h0IDIwMTUgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG4gKiB5b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG4gKiBZb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcbiAqXG4gKiAgICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXG4gKlxuICogVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxuICogZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxuICogV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXG4gKiBTZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXG4gKiBsaW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cbiAqL1xuXG52YXIgU2Vuc29yU2FtcGxlID0gcmVxdWlyZSgnLi9zZW5zb3Itc2FtcGxlLmpzJyk7XG52YXIgTWF0aFV0aWwgPSByZXF1aXJlKCcuLi9tYXRoLXV0aWwuanMnKTtcbnZhciBVdGlsID0gcmVxdWlyZSgnLi4vdXRpbC5qcycpO1xuXG52YXIgREVCVUcgPSBmYWxzZTtcblxuLyoqXG4gKiBBbiBpbXBsZW1lbnRhdGlvbiBvZiBhIHNpbXBsZSBjb21wbGVtZW50YXJ5IGZpbHRlciwgd2hpY2ggZnVzZXMgZ3lyb3Njb3BlIGFuZFxuICogYWNjZWxlcm9tZXRlciBkYXRhIGZyb20gdGhlICdkZXZpY2Vtb3Rpb24nIGV2ZW50LlxuICpcbiAqIEFjY2VsZXJvbWV0ZXIgZGF0YSBpcyB2ZXJ5IG5vaXN5LCBidXQgc3RhYmxlIG92ZXIgdGhlIGxvbmcgdGVybS5cbiAqIEd5cm9zY29wZSBkYXRhIGlzIHNtb290aCwgYnV0IHRlbmRzIHRvIGRyaWZ0IG92ZXIgdGhlIGxvbmcgdGVybS5cbiAqXG4gKiBUaGlzIGZ1c2lvbiBpcyByZWxhdGl2ZWx5IHNpbXBsZTpcbiAqIDEuIEdldCBvcmllbnRhdGlvbiBlc3RpbWF0ZXMgZnJvbSBhY2NlbGVyb21ldGVyIGJ5IGFwcGx5aW5nIGEgbG93LXBhc3MgZmlsdGVyXG4gKiAgICBvbiB0aGF0IGRhdGEuXG4gKiAyLiBHZXQgb3JpZW50YXRpb24gZXN0aW1hdGVzIGZyb20gZ3lyb3Njb3BlIGJ5IGludGVncmF0aW5nIG92ZXIgdGltZS5cbiAqIDMuIENvbWJpbmUgdGhlIHR3byBlc3RpbWF0ZXMsIHdlaWdoaW5nICgxKSBpbiB0aGUgbG9uZyB0ZXJtLCBidXQgKDIpIGZvciB0aGVcbiAqICAgIHNob3J0IHRlcm0uXG4gKi9cbmZ1bmN0aW9uIENvbXBsZW1lbnRhcnlGaWx0ZXIoa0ZpbHRlcikge1xuICB0aGlzLmtGaWx0ZXIgPSBrRmlsdGVyO1xuXG4gIC8vIFJhdyBzZW5zb3IgbWVhc3VyZW1lbnRzLlxuICB0aGlzLmN1cnJlbnRBY2NlbE1lYXN1cmVtZW50ID0gbmV3IFNlbnNvclNhbXBsZSgpO1xuICB0aGlzLmN1cnJlbnRHeXJvTWVhc3VyZW1lbnQgPSBuZXcgU2Vuc29yU2FtcGxlKCk7XG4gIHRoaXMucHJldmlvdXNHeXJvTWVhc3VyZW1lbnQgPSBuZXcgU2Vuc29yU2FtcGxlKCk7XG5cbiAgLy8gU2V0IGRlZmF1bHQgbG9vayBkaXJlY3Rpb24gdG8gYmUgaW4gdGhlIGNvcnJlY3QgZGlyZWN0aW9uLlxuICBpZiAoVXRpbC5pc0lPUygpKSB7XG4gICAgdGhpcy5maWx0ZXJRID0gbmV3IE1hdGhVdGlsLlF1YXRlcm5pb24oLTEsIDAsIDAsIDEpO1xuICB9IGVsc2Uge1xuICAgIHRoaXMuZmlsdGVyUSA9IG5ldyBNYXRoVXRpbC5RdWF0ZXJuaW9uKDEsIDAsIDAsIDEpO1xuICB9XG4gIHRoaXMucHJldmlvdXNGaWx0ZXJRID0gbmV3IE1hdGhVdGlsLlF1YXRlcm5pb24oKTtcbiAgdGhpcy5wcmV2aW91c0ZpbHRlclEuY29weSh0aGlzLmZpbHRlclEpO1xuXG4gIC8vIE9yaWVudGF0aW9uIGJhc2VkIG9uIHRoZSBhY2NlbGVyb21ldGVyLlxuICB0aGlzLmFjY2VsUSA9IG5ldyBNYXRoVXRpbC5RdWF0ZXJuaW9uKCk7XG4gIC8vIFdoZXRoZXIgb3Igbm90IHRoZSBvcmllbnRhdGlvbiBoYXMgYmVlbiBpbml0aWFsaXplZC5cbiAgdGhpcy5pc09yaWVudGF0aW9uSW5pdGlhbGl6ZWQgPSBmYWxzZTtcbiAgLy8gUnVubmluZyBlc3RpbWF0ZSBvZiBncmF2aXR5IGJhc2VkIG9uIHRoZSBjdXJyZW50IG9yaWVudGF0aW9uLlxuICB0aGlzLmVzdGltYXRlZEdyYXZpdHkgPSBuZXcgTWF0aFV0aWwuVmVjdG9yMygpO1xuICAvLyBNZWFzdXJlZCBncmF2aXR5IGJhc2VkIG9uIGFjY2VsZXJvbWV0ZXIuXG4gIHRoaXMubWVhc3VyZWRHcmF2aXR5ID0gbmV3IE1hdGhVdGlsLlZlY3RvcjMoKTtcblxuICAvLyBEZWJ1ZyBvbmx5IHF1YXRlcm5pb24gb2YgZ3lyby1iYXNlZCBvcmllbnRhdGlvbi5cbiAgdGhpcy5neXJvSW50ZWdyYWxRID0gbmV3IE1hdGhVdGlsLlF1YXRlcm5pb24oKTtcbn1cblxuQ29tcGxlbWVudGFyeUZpbHRlci5wcm90b3R5cGUuYWRkQWNjZWxNZWFzdXJlbWVudCA9IGZ1bmN0aW9uKHZlY3RvciwgdGltZXN0YW1wUykge1xuICB0aGlzLmN1cnJlbnRBY2NlbE1lYXN1cmVtZW50LnNldCh2ZWN0b3IsIHRpbWVzdGFtcFMpO1xufTtcblxuQ29tcGxlbWVudGFyeUZpbHRlci5wcm90b3R5cGUuYWRkR3lyb01lYXN1cmVtZW50ID0gZnVuY3Rpb24odmVjdG9yLCB0aW1lc3RhbXBTKSB7XG4gIHRoaXMuY3VycmVudEd5cm9NZWFzdXJlbWVudC5zZXQodmVjdG9yLCB0aW1lc3RhbXBTKTtcblxuICB2YXIgZGVsdGFUID0gdGltZXN0YW1wUyAtIHRoaXMucHJldmlvdXNHeXJvTWVhc3VyZW1lbnQudGltZXN0YW1wUztcbiAgaWYgKFV0aWwuaXNUaW1lc3RhbXBEZWx0YVZhbGlkKGRlbHRhVCkpIHtcbiAgICB0aGlzLnJ1bl8oKTtcbiAgfVxuXG4gIHRoaXMucHJldmlvdXNHeXJvTWVhc3VyZW1lbnQuY29weSh0aGlzLmN1cnJlbnRHeXJvTWVhc3VyZW1lbnQpO1xufTtcblxuQ29tcGxlbWVudGFyeUZpbHRlci5wcm90b3R5cGUucnVuXyA9IGZ1bmN0aW9uKCkge1xuXG4gIGlmICghdGhpcy5pc09yaWVudGF0aW9uSW5pdGlhbGl6ZWQpIHtcbiAgICB0aGlzLmFjY2VsUSA9IHRoaXMuYWNjZWxUb1F1YXRlcm5pb25fKHRoaXMuY3VycmVudEFjY2VsTWVhc3VyZW1lbnQuc2FtcGxlKTtcbiAgICB0aGlzLnByZXZpb3VzRmlsdGVyUS5jb3B5KHRoaXMuYWNjZWxRKTtcbiAgICB0aGlzLmlzT3JpZW50YXRpb25Jbml0aWFsaXplZCA9IHRydWU7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgdmFyIGRlbHRhVCA9IHRoaXMuY3VycmVudEd5cm9NZWFzdXJlbWVudC50aW1lc3RhbXBTIC1cbiAgICAgIHRoaXMucHJldmlvdXNHeXJvTWVhc3VyZW1lbnQudGltZXN0YW1wUztcblxuICAvLyBDb252ZXJ0IGd5cm8gcm90YXRpb24gdmVjdG9yIHRvIGEgcXVhdGVybmlvbiBkZWx0YS5cbiAgdmFyIGd5cm9EZWx0YVEgPSB0aGlzLmd5cm9Ub1F1YXRlcm5pb25EZWx0YV8odGhpcy5jdXJyZW50R3lyb01lYXN1cmVtZW50LnNhbXBsZSwgZGVsdGFUKTtcbiAgdGhpcy5neXJvSW50ZWdyYWxRLm11bHRpcGx5KGd5cm9EZWx0YVEpO1xuXG4gIC8vIGZpbHRlcl8xID0gSyAqIChmaWx0ZXJfMCArIGd5cm8gKiBkVCkgKyAoMSAtIEspICogYWNjZWwuXG4gIHRoaXMuZmlsdGVyUS5jb3B5KHRoaXMucHJldmlvdXNGaWx0ZXJRKTtcbiAgdGhpcy5maWx0ZXJRLm11bHRpcGx5KGd5cm9EZWx0YVEpO1xuXG4gIC8vIENhbGN1bGF0ZSB0aGUgZGVsdGEgYmV0d2VlbiB0aGUgY3VycmVudCBlc3RpbWF0ZWQgZ3Jhdml0eSBhbmQgdGhlIHJlYWxcbiAgLy8gZ3Jhdml0eSB2ZWN0b3IgZnJvbSBhY2NlbGVyb21ldGVyLlxuICB2YXIgaW52RmlsdGVyUSA9IG5ldyBNYXRoVXRpbC5RdWF0ZXJuaW9uKCk7XG4gIGludkZpbHRlclEuY29weSh0aGlzLmZpbHRlclEpO1xuICBpbnZGaWx0ZXJRLmludmVyc2UoKTtcblxuICB0aGlzLmVzdGltYXRlZEdyYXZpdHkuc2V0KDAsIDAsIC0xKTtcbiAgdGhpcy5lc3RpbWF0ZWRHcmF2aXR5LmFwcGx5UXVhdGVybmlvbihpbnZGaWx0ZXJRKTtcbiAgdGhpcy5lc3RpbWF0ZWRHcmF2aXR5Lm5vcm1hbGl6ZSgpO1xuXG4gIHRoaXMubWVhc3VyZWRHcmF2aXR5LmNvcHkodGhpcy5jdXJyZW50QWNjZWxNZWFzdXJlbWVudC5zYW1wbGUpO1xuICB0aGlzLm1lYXN1cmVkR3Jhdml0eS5ub3JtYWxpemUoKTtcblxuICAvLyBDb21wYXJlIGVzdGltYXRlZCBncmF2aXR5IHdpdGggbWVhc3VyZWQgZ3Jhdml0eSwgZ2V0IHRoZSBkZWx0YSBxdWF0ZXJuaW9uXG4gIC8vIGJldHdlZW4gdGhlIHR3by5cbiAgdmFyIGRlbHRhUSA9IG5ldyBNYXRoVXRpbC5RdWF0ZXJuaW9uKCk7XG4gIGRlbHRhUS5zZXRGcm9tVW5pdFZlY3RvcnModGhpcy5lc3RpbWF0ZWRHcmF2aXR5LCB0aGlzLm1lYXN1cmVkR3Jhdml0eSk7XG4gIGRlbHRhUS5pbnZlcnNlKCk7XG5cbiAgaWYgKERFQlVHKSB7XG4gICAgY29uc29sZS5sb2coJ0RlbHRhOiAlZCBkZWcsIEdfZXN0OiAoJXMsICVzLCAlcyksIEdfbWVhczogKCVzLCAlcywgJXMpJyxcbiAgICAgICAgICAgICAgICBNYXRoVXRpbC5yYWRUb0RlZyAqIFV0aWwuZ2V0UXVhdGVybmlvbkFuZ2xlKGRlbHRhUSksXG4gICAgICAgICAgICAgICAgKHRoaXMuZXN0aW1hdGVkR3Jhdml0eS54KS50b0ZpeGVkKDEpLFxuICAgICAgICAgICAgICAgICh0aGlzLmVzdGltYXRlZEdyYXZpdHkueSkudG9GaXhlZCgxKSxcbiAgICAgICAgICAgICAgICAodGhpcy5lc3RpbWF0ZWRHcmF2aXR5LnopLnRvRml4ZWQoMSksXG4gICAgICAgICAgICAgICAgKHRoaXMubWVhc3VyZWRHcmF2aXR5LngpLnRvRml4ZWQoMSksXG4gICAgICAgICAgICAgICAgKHRoaXMubWVhc3VyZWRHcmF2aXR5LnkpLnRvRml4ZWQoMSksXG4gICAgICAgICAgICAgICAgKHRoaXMubWVhc3VyZWRHcmF2aXR5LnopLnRvRml4ZWQoMSkpO1xuICB9XG5cbiAgLy8gQ2FsY3VsYXRlIHRoZSBTTEVSUCB0YXJnZXQ6IGN1cnJlbnQgb3JpZW50YXRpb24gcGx1cyB0aGUgbWVhc3VyZWQtZXN0aW1hdGVkXG4gIC8vIHF1YXRlcm5pb24gZGVsdGEuXG4gIHZhciB0YXJnZXRRID0gbmV3IE1hdGhVdGlsLlF1YXRlcm5pb24oKTtcbiAgdGFyZ2V0US5jb3B5KHRoaXMuZmlsdGVyUSk7XG4gIHRhcmdldFEubXVsdGlwbHkoZGVsdGFRKTtcblxuICAvLyBTTEVSUCBmYWN0b3I6IDAgaXMgcHVyZSBneXJvLCAxIGlzIHB1cmUgYWNjZWwuXG4gIHRoaXMuZmlsdGVyUS5zbGVycCh0YXJnZXRRLCAxIC0gdGhpcy5rRmlsdGVyKTtcblxuICB0aGlzLnByZXZpb3VzRmlsdGVyUS5jb3B5KHRoaXMuZmlsdGVyUSk7XG59O1xuXG5Db21wbGVtZW50YXJ5RmlsdGVyLnByb3RvdHlwZS5nZXRPcmllbnRhdGlvbiA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gdGhpcy5maWx0ZXJRO1xufTtcblxuQ29tcGxlbWVudGFyeUZpbHRlci5wcm90b3R5cGUuYWNjZWxUb1F1YXRlcm5pb25fID0gZnVuY3Rpb24oYWNjZWwpIHtcbiAgdmFyIG5vcm1BY2NlbCA9IG5ldyBNYXRoVXRpbC5WZWN0b3IzKCk7XG4gIG5vcm1BY2NlbC5jb3B5KGFjY2VsKTtcbiAgbm9ybUFjY2VsLm5vcm1hbGl6ZSgpO1xuICB2YXIgcXVhdCA9IG5ldyBNYXRoVXRpbC5RdWF0ZXJuaW9uKCk7XG4gIHF1YXQuc2V0RnJvbVVuaXRWZWN0b3JzKG5ldyBNYXRoVXRpbC5WZWN0b3IzKDAsIDAsIC0xKSwgbm9ybUFjY2VsKTtcbiAgcXVhdC5pbnZlcnNlKCk7XG4gIHJldHVybiBxdWF0O1xufTtcblxuQ29tcGxlbWVudGFyeUZpbHRlci5wcm90b3R5cGUuZ3lyb1RvUXVhdGVybmlvbkRlbHRhXyA9IGZ1bmN0aW9uKGd5cm8sIGR0KSB7XG4gIC8vIEV4dHJhY3QgYXhpcyBhbmQgYW5nbGUgZnJvbSB0aGUgZ3lyb3Njb3BlIGRhdGEuXG4gIHZhciBxdWF0ID0gbmV3IE1hdGhVdGlsLlF1YXRlcm5pb24oKTtcbiAgdmFyIGF4aXMgPSBuZXcgTWF0aFV0aWwuVmVjdG9yMygpO1xuICBheGlzLmNvcHkoZ3lybyk7XG4gIGF4aXMubm9ybWFsaXplKCk7XG4gIHF1YXQuc2V0RnJvbUF4aXNBbmdsZShheGlzLCBneXJvLmxlbmd0aCgpICogZHQpO1xuICByZXR1cm4gcXVhdDtcbn07XG5cblxubW9kdWxlLmV4cG9ydHMgPSBDb21wbGVtZW50YXJ5RmlsdGVyO1xuIiwiLypcbiAqIENvcHlyaWdodCAyMDE1IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xuICogeW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuICogWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG4gKlxuICogICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuICpcbiAqIFVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbiAqIGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbiAqIFdJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuICogU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxuICogbGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG4gKi9cbnZhciBDb21wbGVtZW50YXJ5RmlsdGVyID0gcmVxdWlyZSgnLi9jb21wbGVtZW50YXJ5LWZpbHRlci5qcycpO1xudmFyIFBvc2VQcmVkaWN0b3IgPSByZXF1aXJlKCcuL3Bvc2UtcHJlZGljdG9yLmpzJyk7XG52YXIgVG91Y2hQYW5uZXIgPSByZXF1aXJlKCcuLi90b3VjaC1wYW5uZXIuanMnKTtcbnZhciBNYXRoVXRpbCA9IHJlcXVpcmUoJy4uL21hdGgtdXRpbC5qcycpO1xudmFyIFV0aWwgPSByZXF1aXJlKCcuLi91dGlsLmpzJyk7XG5cbi8qKlxuICogVGhlIHBvc2Ugc2Vuc29yLCBpbXBsZW1lbnRlZCB1c2luZyBEZXZpY2VNb3Rpb24gQVBJcy5cbiAqL1xuZnVuY3Rpb24gRnVzaW9uUG9zZVNlbnNvcigpIHtcbiAgdGhpcy5kZXZpY2VJZCA9ICd3ZWJ2ci1wb2x5ZmlsbDpmdXNlZCc7XG4gIHRoaXMuZGV2aWNlTmFtZSA9ICdWUiBQb3NpdGlvbiBEZXZpY2UgKHdlYnZyLXBvbHlmaWxsOmZ1c2VkKSc7XG5cbiAgdGhpcy5hY2NlbGVyb21ldGVyID0gbmV3IE1hdGhVdGlsLlZlY3RvcjMoKTtcbiAgdGhpcy5neXJvc2NvcGUgPSBuZXcgTWF0aFV0aWwuVmVjdG9yMygpO1xuXG4gIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdkZXZpY2Vtb3Rpb24nLCB0aGlzLm9uRGV2aWNlTW90aW9uQ2hhbmdlXy5iaW5kKHRoaXMpKTtcbiAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ29yaWVudGF0aW9uY2hhbmdlJywgdGhpcy5vblNjcmVlbk9yaWVudGF0aW9uQ2hhbmdlXy5iaW5kKHRoaXMpKTtcblxuICB0aGlzLmZpbHRlciA9IG5ldyBDb21wbGVtZW50YXJ5RmlsdGVyKFdlYlZSQ29uZmlnLktfRklMVEVSKTtcbiAgdGhpcy5wb3NlUHJlZGljdG9yID0gbmV3IFBvc2VQcmVkaWN0b3IoV2ViVlJDb25maWcuUFJFRElDVElPTl9USU1FX1MpO1xuICB0aGlzLnRvdWNoUGFubmVyID0gbmV3IFRvdWNoUGFubmVyKCk7XG5cbiAgdGhpcy5maWx0ZXJUb1dvcmxkUSA9IG5ldyBNYXRoVXRpbC5RdWF0ZXJuaW9uKCk7XG5cbiAgLy8gU2V0IHRoZSBmaWx0ZXIgdG8gd29ybGQgdHJhbnNmb3JtLCBkZXBlbmRpbmcgb24gT1MuXG4gIGlmIChVdGlsLmlzSU9TKCkpIHtcbiAgICB0aGlzLmZpbHRlclRvV29ybGRRLnNldEZyb21BeGlzQW5nbGUobmV3IE1hdGhVdGlsLlZlY3RvcjMoMSwgMCwgMCksIE1hdGguUEkgLyAyKTtcbiAgfSBlbHNlIHtcbiAgICB0aGlzLmZpbHRlclRvV29ybGRRLnNldEZyb21BeGlzQW5nbGUobmV3IE1hdGhVdGlsLlZlY3RvcjMoMSwgMCwgMCksIC1NYXRoLlBJIC8gMik7XG4gIH1cblxuICB0aGlzLmludmVyc2VXb3JsZFRvU2NyZWVuUSA9IG5ldyBNYXRoVXRpbC5RdWF0ZXJuaW9uKCk7XG4gIHRoaXMud29ybGRUb1NjcmVlblEgPSBuZXcgTWF0aFV0aWwuUXVhdGVybmlvbigpO1xuICB0aGlzLm9yaWdpbmFsUG9zZUFkanVzdFEgPSBuZXcgTWF0aFV0aWwuUXVhdGVybmlvbigpO1xuICB0aGlzLm9yaWdpbmFsUG9zZUFkanVzdFEuc2V0RnJvbUF4aXNBbmdsZShuZXcgTWF0aFV0aWwuVmVjdG9yMygwLCAwLCAxKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAtd2luZG93Lm9yaWVudGF0aW9uICogTWF0aC5QSSAvIDE4MCk7XG5cbiAgdGhpcy5zZXRTY3JlZW5UcmFuc2Zvcm1fKCk7XG4gIC8vIEFkanVzdCB0aGlzIGZpbHRlciBmb3IgYmVpbmcgaW4gbGFuZHNjYXBlIG1vZGUuXG4gIGlmIChVdGlsLmlzTGFuZHNjYXBlTW9kZSgpKSB7XG4gICAgdGhpcy5maWx0ZXJUb1dvcmxkUS5tdWx0aXBseSh0aGlzLmludmVyc2VXb3JsZFRvU2NyZWVuUSk7XG4gIH1cblxuICAvLyBLZWVwIHRyYWNrIG9mIGEgcmVzZXQgdHJhbnNmb3JtIGZvciByZXNldFNlbnNvci5cbiAgdGhpcy5yZXNldFEgPSBuZXcgTWF0aFV0aWwuUXVhdGVybmlvbigpO1xuXG4gIHRoaXMuaXNGaXJlZm94QW5kcm9pZCA9IFV0aWwuaXNGaXJlZm94QW5kcm9pZCgpO1xuICB0aGlzLmlzSU9TID0gVXRpbC5pc0lPUygpO1xuXG4gIHRoaXMub3JpZW50YXRpb25PdXRfID0gbmV3IEZsb2F0MzJBcnJheSg0KTtcbn1cblxuRnVzaW9uUG9zZVNlbnNvci5wcm90b3R5cGUuZ2V0UG9zaXRpb24gPSBmdW5jdGlvbigpIHtcbiAgLy8gVGhpcyBQb3NlU2Vuc29yIGRvZXNuJ3Qgc3VwcG9ydCBwb3NpdGlvblxuICByZXR1cm4gbnVsbDtcbn07XG5cbkZ1c2lvblBvc2VTZW5zb3IucHJvdG90eXBlLmdldE9yaWVudGF0aW9uID0gZnVuY3Rpb24oKSB7XG4gIC8vIENvbnZlcnQgZnJvbSBmaWx0ZXIgc3BhY2UgdG8gdGhlIHRoZSBzYW1lIHN5c3RlbSB1c2VkIGJ5IHRoZVxuICAvLyBkZXZpY2VvcmllbnRhdGlvbiBldmVudC5cbiAgdmFyIG9yaWVudGF0aW9uID0gdGhpcy5maWx0ZXIuZ2V0T3JpZW50YXRpb24oKTtcblxuICAvLyBQcmVkaWN0IG9yaWVudGF0aW9uLlxuICB0aGlzLnByZWRpY3RlZFEgPSB0aGlzLnBvc2VQcmVkaWN0b3IuZ2V0UHJlZGljdGlvbihvcmllbnRhdGlvbiwgdGhpcy5neXJvc2NvcGUsIHRoaXMucHJldmlvdXNUaW1lc3RhbXBTKTtcblxuICAvLyBDb252ZXJ0IHRvIFRIUkVFIGNvb3JkaW5hdGUgc3lzdGVtOiAtWiBmb3J3YXJkLCBZIHVwLCBYIHJpZ2h0LlxuICB2YXIgb3V0ID0gbmV3IE1hdGhVdGlsLlF1YXRlcm5pb24oKTtcbiAgb3V0LmNvcHkodGhpcy5maWx0ZXJUb1dvcmxkUSk7XG4gIG91dC5tdWx0aXBseSh0aGlzLnJlc2V0USk7XG4gIGlmICghV2ViVlJDb25maWcuVE9VQ0hfUEFOTkVSX0RJU0FCTEVEKSB7XG4gICAgb3V0Lm11bHRpcGx5KHRoaXMudG91Y2hQYW5uZXIuZ2V0T3JpZW50YXRpb24oKSk7XG4gIH1cbiAgb3V0Lm11bHRpcGx5KHRoaXMucHJlZGljdGVkUSk7XG4gIG91dC5tdWx0aXBseSh0aGlzLndvcmxkVG9TY3JlZW5RKTtcblxuICAvLyBIYW5kbGUgdGhlIHlhdy1vbmx5IGNhc2UuXG4gIGlmIChXZWJWUkNvbmZpZy5ZQVdfT05MWSkge1xuICAgIC8vIE1ha2UgYSBxdWF0ZXJuaW9uIHRoYXQgb25seSB0dXJucyBhcm91bmQgdGhlIFktYXhpcy5cbiAgICBvdXQueCA9IDA7XG4gICAgb3V0LnogPSAwO1xuICAgIG91dC5ub3JtYWxpemUoKTtcbiAgfVxuXG4gIHRoaXMub3JpZW50YXRpb25PdXRfWzBdID0gb3V0Lng7XG4gIHRoaXMub3JpZW50YXRpb25PdXRfWzFdID0gb3V0Lnk7XG4gIHRoaXMub3JpZW50YXRpb25PdXRfWzJdID0gb3V0Lno7XG4gIHRoaXMub3JpZW50YXRpb25PdXRfWzNdID0gb3V0Lnc7XG4gIHJldHVybiB0aGlzLm9yaWVudGF0aW9uT3V0Xztcbn07XG5cbkZ1c2lvblBvc2VTZW5zb3IucHJvdG90eXBlLnJlc2V0UG9zZSA9IGZ1bmN0aW9uKCkge1xuICAvLyBSZWR1Y2UgdG8gaW52ZXJ0ZWQgeWF3LW9ubHkuXG4gIHRoaXMucmVzZXRRLmNvcHkodGhpcy5maWx0ZXIuZ2V0T3JpZW50YXRpb24oKSk7XG4gIHRoaXMucmVzZXRRLnggPSAwO1xuICB0aGlzLnJlc2V0US55ID0gMDtcbiAgdGhpcy5yZXNldFEueiAqPSAtMTtcbiAgdGhpcy5yZXNldFEubm9ybWFsaXplKCk7XG5cbiAgLy8gVGFrZSBpbnRvIGFjY291bnQgZXh0cmEgdHJhbnNmb3JtYXRpb25zIGluIGxhbmRzY2FwZSBtb2RlLlxuICBpZiAoVXRpbC5pc0xhbmRzY2FwZU1vZGUoKSkge1xuICAgIHRoaXMucmVzZXRRLm11bHRpcGx5KHRoaXMuaW52ZXJzZVdvcmxkVG9TY3JlZW5RKTtcbiAgfVxuXG4gIC8vIFRha2UgaW50byBhY2NvdW50IG9yaWdpbmFsIHBvc2UuXG4gIHRoaXMucmVzZXRRLm11bHRpcGx5KHRoaXMub3JpZ2luYWxQb3NlQWRqdXN0USk7XG5cbiAgaWYgKCFXZWJWUkNvbmZpZy5UT1VDSF9QQU5ORVJfRElTQUJMRUQpIHtcbiAgICB0aGlzLnRvdWNoUGFubmVyLnJlc2V0U2Vuc29yKCk7XG4gIH1cbn07XG5cbkZ1c2lvblBvc2VTZW5zb3IucHJvdG90eXBlLm9uRGV2aWNlTW90aW9uQ2hhbmdlXyA9IGZ1bmN0aW9uKGRldmljZU1vdGlvbikge1xuICB2YXIgYWNjR3Jhdml0eSA9IGRldmljZU1vdGlvbi5hY2NlbGVyYXRpb25JbmNsdWRpbmdHcmF2aXR5O1xuICB2YXIgcm90UmF0ZSA9IGRldmljZU1vdGlvbi5yb3RhdGlvblJhdGU7XG4gIHZhciB0aW1lc3RhbXBTID0gZGV2aWNlTW90aW9uLnRpbWVTdGFtcCAvIDEwMDA7XG5cbiAgLy8gRmlyZWZveCBBbmRyb2lkIHRpbWVTdGFtcCByZXR1cm5zIG9uZSB0aG91c2FuZHRoIG9mIGEgbWlsbGlzZWNvbmQuXG4gIGlmICh0aGlzLmlzRmlyZWZveEFuZHJvaWQpIHtcbiAgICB0aW1lc3RhbXBTIC89IDEwMDA7XG4gIH1cblxuICB2YXIgZGVsdGFTID0gdGltZXN0YW1wUyAtIHRoaXMucHJldmlvdXNUaW1lc3RhbXBTO1xuICBpZiAoZGVsdGFTIDw9IFV0aWwuTUlOX1RJTUVTVEVQIHx8IGRlbHRhUyA+IFV0aWwuTUFYX1RJTUVTVEVQKSB7XG4gICAgY29uc29sZS53YXJuKCdJbnZhbGlkIHRpbWVzdGFtcHMgZGV0ZWN0ZWQuIFRpbWUgc3RlcCBiZXR3ZWVuIHN1Y2Nlc3NpdmUgJyArXG4gICAgICAgICAgICAgICAgICdneXJvc2NvcGUgc2Vuc29yIHNhbXBsZXMgaXMgdmVyeSBzbWFsbCBvciBub3QgbW9ub3RvbmljJyk7XG4gICAgdGhpcy5wcmV2aW91c1RpbWVzdGFtcFMgPSB0aW1lc3RhbXBTO1xuICAgIHJldHVybjtcbiAgfVxuICB0aGlzLmFjY2VsZXJvbWV0ZXIuc2V0KC1hY2NHcmF2aXR5LngsIC1hY2NHcmF2aXR5LnksIC1hY2NHcmF2aXR5LnopO1xuICB0aGlzLmd5cm9zY29wZS5zZXQocm90UmF0ZS5hbHBoYSwgcm90UmF0ZS5iZXRhLCByb3RSYXRlLmdhbW1hKTtcblxuICAvLyBXaXRoIGlPUyBhbmQgRmlyZWZveCBBbmRyb2lkLCByb3RhdGlvblJhdGUgaXMgcmVwb3J0ZWQgaW4gZGVncmVlcyxcbiAgLy8gc28gd2UgZmlyc3QgY29udmVydCB0byByYWRpYW5zLlxuICBpZiAodGhpcy5pc0lPUyB8fCB0aGlzLmlzRmlyZWZveEFuZHJvaWQpIHtcbiAgICB0aGlzLmd5cm9zY29wZS5tdWx0aXBseVNjYWxhcihNYXRoLlBJIC8gMTgwKTtcbiAgfVxuXG4gIHRoaXMuZmlsdGVyLmFkZEFjY2VsTWVhc3VyZW1lbnQodGhpcy5hY2NlbGVyb21ldGVyLCB0aW1lc3RhbXBTKTtcbiAgdGhpcy5maWx0ZXIuYWRkR3lyb01lYXN1cmVtZW50KHRoaXMuZ3lyb3Njb3BlLCB0aW1lc3RhbXBTKTtcblxuICB0aGlzLnByZXZpb3VzVGltZXN0YW1wUyA9IHRpbWVzdGFtcFM7XG59O1xuXG5GdXNpb25Qb3NlU2Vuc29yLnByb3RvdHlwZS5vblNjcmVlbk9yaWVudGF0aW9uQ2hhbmdlXyA9XG4gICAgZnVuY3Rpb24oc2NyZWVuT3JpZW50YXRpb24pIHtcbiAgdGhpcy5zZXRTY3JlZW5UcmFuc2Zvcm1fKCk7XG59O1xuXG5GdXNpb25Qb3NlU2Vuc29yLnByb3RvdHlwZS5zZXRTY3JlZW5UcmFuc2Zvcm1fID0gZnVuY3Rpb24oKSB7XG4gIHRoaXMud29ybGRUb1NjcmVlblEuc2V0KDAsIDAsIDAsIDEpO1xuICBzd2l0Y2ggKHdpbmRvdy5vcmllbnRhdGlvbikge1xuICAgIGNhc2UgMDpcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgOTA6XG4gICAgICB0aGlzLndvcmxkVG9TY3JlZW5RLnNldEZyb21BeGlzQW5nbGUobmV3IE1hdGhVdGlsLlZlY3RvcjMoMCwgMCwgMSksIC1NYXRoLlBJIC8gMik7XG4gICAgICBicmVhaztcbiAgICBjYXNlIC05MDpcbiAgICAgIHRoaXMud29ybGRUb1NjcmVlblEuc2V0RnJvbUF4aXNBbmdsZShuZXcgTWF0aFV0aWwuVmVjdG9yMygwLCAwLCAxKSwgTWF0aC5QSSAvIDIpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAxODA6XG4gICAgICAvLyBUT0RPLlxuICAgICAgYnJlYWs7XG4gIH1cbiAgdGhpcy5pbnZlcnNlV29ybGRUb1NjcmVlblEuY29weSh0aGlzLndvcmxkVG9TY3JlZW5RKTtcbiAgdGhpcy5pbnZlcnNlV29ybGRUb1NjcmVlblEuaW52ZXJzZSgpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBGdXNpb25Qb3NlU2Vuc29yO1xuIiwiLypcbiAqIENvcHlyaWdodCAyMDE1IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xuICogeW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuICogWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG4gKlxuICogICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuICpcbiAqIFVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbiAqIGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbiAqIFdJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuICogU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxuICogbGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG4gKi9cbnZhciBNYXRoVXRpbCA9IHJlcXVpcmUoJy4uL21hdGgtdXRpbC5qcycpO1xudmFyIERFQlVHID0gZmFsc2U7XG5cbi8qKlxuICogR2l2ZW4gYW4gb3JpZW50YXRpb24gYW5kIHRoZSBneXJvc2NvcGUgZGF0YSwgcHJlZGljdHMgdGhlIGZ1dHVyZSBvcmllbnRhdGlvblxuICogb2YgdGhlIGhlYWQuIFRoaXMgbWFrZXMgcmVuZGVyaW5nIGFwcGVhciBmYXN0ZXIuXG4gKlxuICogQWxzbyBzZWU6IGh0dHA6Ly9tc2wuY3MudWl1Yy5lZHUvfmxhdmFsbGUvcGFwZXJzL0xhdlllckthdEFudDE0LnBkZlxuICpcbiAqIEBwYXJhbSB7TnVtYmVyfSBwcmVkaWN0aW9uVGltZVMgdGltZSBmcm9tIGhlYWQgbW92ZW1lbnQgdG8gdGhlIGFwcGVhcmFuY2Ugb2ZcbiAqIHRoZSBjb3JyZXNwb25kaW5nIGltYWdlLlxuICovXG5mdW5jdGlvbiBQb3NlUHJlZGljdG9yKHByZWRpY3Rpb25UaW1lUykge1xuICB0aGlzLnByZWRpY3Rpb25UaW1lUyA9IHByZWRpY3Rpb25UaW1lUztcblxuICAvLyBUaGUgcXVhdGVybmlvbiBjb3JyZXNwb25kaW5nIHRvIHRoZSBwcmV2aW91cyBzdGF0ZS5cbiAgdGhpcy5wcmV2aW91c1EgPSBuZXcgTWF0aFV0aWwuUXVhdGVybmlvbigpO1xuICAvLyBQcmV2aW91cyB0aW1lIGEgcHJlZGljdGlvbiBvY2N1cnJlZC5cbiAgdGhpcy5wcmV2aW91c1RpbWVzdGFtcFMgPSBudWxsO1xuXG4gIC8vIFRoZSBkZWx0YSBxdWF0ZXJuaW9uIHRoYXQgYWRqdXN0cyB0aGUgY3VycmVudCBwb3NlLlxuICB0aGlzLmRlbHRhUSA9IG5ldyBNYXRoVXRpbC5RdWF0ZXJuaW9uKCk7XG4gIC8vIFRoZSBvdXRwdXQgcXVhdGVybmlvbi5cbiAgdGhpcy5vdXRRID0gbmV3IE1hdGhVdGlsLlF1YXRlcm5pb24oKTtcbn1cblxuUG9zZVByZWRpY3Rvci5wcm90b3R5cGUuZ2V0UHJlZGljdGlvbiA9IGZ1bmN0aW9uKGN1cnJlbnRRLCBneXJvLCB0aW1lc3RhbXBTKSB7XG4gIGlmICghdGhpcy5wcmV2aW91c1RpbWVzdGFtcFMpIHtcbiAgICB0aGlzLnByZXZpb3VzUS5jb3B5KGN1cnJlbnRRKTtcbiAgICB0aGlzLnByZXZpb3VzVGltZXN0YW1wUyA9IHRpbWVzdGFtcFM7XG4gICAgcmV0dXJuIGN1cnJlbnRRO1xuICB9XG5cbiAgLy8gQ2FsY3VsYXRlIGF4aXMgYW5kIGFuZ2xlIGJhc2VkIG9uIGd5cm9zY29wZSByb3RhdGlvbiByYXRlIGRhdGEuXG4gIHZhciBheGlzID0gbmV3IE1hdGhVdGlsLlZlY3RvcjMoKTtcbiAgYXhpcy5jb3B5KGd5cm8pO1xuICBheGlzLm5vcm1hbGl6ZSgpO1xuXG4gIHZhciBhbmd1bGFyU3BlZWQgPSBneXJvLmxlbmd0aCgpO1xuXG4gIC8vIElmIHdlJ3JlIHJvdGF0aW5nIHNsb3dseSwgZG9uJ3QgZG8gcHJlZGljdGlvbi5cbiAgaWYgKGFuZ3VsYXJTcGVlZCA8IE1hdGhVdGlsLmRlZ1RvUmFkICogMjApIHtcbiAgICBpZiAoREVCVUcpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdNb3Zpbmcgc2xvd2x5LCBhdCAlcyBkZWcvczogbm8gcHJlZGljdGlvbicsXG4gICAgICAgICAgICAgICAgICAoTWF0aFV0aWwucmFkVG9EZWcgKiBhbmd1bGFyU3BlZWQpLnRvRml4ZWQoMSkpO1xuICAgIH1cbiAgICB0aGlzLm91dFEuY29weShjdXJyZW50USk7XG4gICAgdGhpcy5wcmV2aW91c1EuY29weShjdXJyZW50USk7XG4gICAgcmV0dXJuIHRoaXMub3V0UTtcbiAgfVxuXG4gIC8vIEdldCB0aGUgcHJlZGljdGVkIGFuZ2xlIGJhc2VkIG9uIHRoZSB0aW1lIGRlbHRhIGFuZCBsYXRlbmN5LlxuICB2YXIgZGVsdGFUID0gdGltZXN0YW1wUyAtIHRoaXMucHJldmlvdXNUaW1lc3RhbXBTO1xuICB2YXIgcHJlZGljdEFuZ2xlID0gYW5ndWxhclNwZWVkICogdGhpcy5wcmVkaWN0aW9uVGltZVM7XG5cbiAgdGhpcy5kZWx0YVEuc2V0RnJvbUF4aXNBbmdsZShheGlzLCBwcmVkaWN0QW5nbGUpO1xuICB0aGlzLm91dFEuY29weSh0aGlzLnByZXZpb3VzUSk7XG4gIHRoaXMub3V0US5tdWx0aXBseSh0aGlzLmRlbHRhUSk7XG5cbiAgdGhpcy5wcmV2aW91c1EuY29weShjdXJyZW50USk7XG4gIHRoaXMucHJldmlvdXNUaW1lc3RhbXBTID0gdGltZXN0YW1wUztcblxuICByZXR1cm4gdGhpcy5vdXRRO1xufTtcblxuXG5tb2R1bGUuZXhwb3J0cyA9IFBvc2VQcmVkaWN0b3I7XG4iLCJmdW5jdGlvbiBTZW5zb3JTYW1wbGUoc2FtcGxlLCB0aW1lc3RhbXBTKSB7XG4gIHRoaXMuc2V0KHNhbXBsZSwgdGltZXN0YW1wUyk7XG59O1xuXG5TZW5zb3JTYW1wbGUucHJvdG90eXBlLnNldCA9IGZ1bmN0aW9uKHNhbXBsZSwgdGltZXN0YW1wUykge1xuICB0aGlzLnNhbXBsZSA9IHNhbXBsZTtcbiAgdGhpcy50aW1lc3RhbXBTID0gdGltZXN0YW1wUztcbn07XG5cblNlbnNvclNhbXBsZS5wcm90b3R5cGUuY29weSA9IGZ1bmN0aW9uKHNlbnNvclNhbXBsZSkge1xuICB0aGlzLnNldChzZW5zb3JTYW1wbGUuc2FtcGxlLCBzZW5zb3JTYW1wbGUudGltZXN0YW1wUyk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFNlbnNvclNhbXBsZTtcbiIsIi8qXG4gKiBDb3B5cmlnaHQgMjAxNSBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICogTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcbiAqIHlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cbiAqIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuICpcbiAqICAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcbiAqXG4gKiBVbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG4gKiBkaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG4gKiBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cbiAqIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbiAqIGxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuICovXG52YXIgTWF0aFV0aWwgPSByZXF1aXJlKCcuL21hdGgtdXRpbC5qcycpO1xudmFyIFV0aWwgPSByZXF1aXJlKCcuL3V0aWwuanMnKTtcblxudmFyIFJPVEFURV9TUEVFRCA9IDAuNTtcbi8qKlxuICogUHJvdmlkZXMgYSBxdWF0ZXJuaW9uIHJlc3BvbnNpYmxlIGZvciBwcmUtcGFubmluZyB0aGUgc2NlbmUgYmVmb3JlIGZ1cnRoZXJcbiAqIHRyYW5zZm9ybWF0aW9ucyBkdWUgdG8gZGV2aWNlIHNlbnNvcnMuXG4gKi9cbmZ1bmN0aW9uIFRvdWNoUGFubmVyKCkge1xuICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigndG91Y2hzdGFydCcsIHRoaXMub25Ub3VjaFN0YXJ0Xy5iaW5kKHRoaXMpKTtcbiAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ3RvdWNobW92ZScsIHRoaXMub25Ub3VjaE1vdmVfLmJpbmQodGhpcykpO1xuICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigndG91Y2hlbmQnLCB0aGlzLm9uVG91Y2hFbmRfLmJpbmQodGhpcykpO1xuXG4gIHRoaXMuaXNUb3VjaGluZyA9IGZhbHNlO1xuICB0aGlzLnJvdGF0ZVN0YXJ0ID0gbmV3IE1hdGhVdGlsLlZlY3RvcjIoKTtcbiAgdGhpcy5yb3RhdGVFbmQgPSBuZXcgTWF0aFV0aWwuVmVjdG9yMigpO1xuICB0aGlzLnJvdGF0ZURlbHRhID0gbmV3IE1hdGhVdGlsLlZlY3RvcjIoKTtcblxuICB0aGlzLnRoZXRhID0gMDtcbiAgdGhpcy5vcmllbnRhdGlvbiA9IG5ldyBNYXRoVXRpbC5RdWF0ZXJuaW9uKCk7XG59XG5cblRvdWNoUGFubmVyLnByb3RvdHlwZS5nZXRPcmllbnRhdGlvbiA9IGZ1bmN0aW9uKCkge1xuICB0aGlzLm9yaWVudGF0aW9uLnNldEZyb21FdWxlclhZWigwLCAwLCB0aGlzLnRoZXRhKTtcbiAgcmV0dXJuIHRoaXMub3JpZW50YXRpb247XG59O1xuXG5Ub3VjaFBhbm5lci5wcm90b3R5cGUucmVzZXRTZW5zb3IgPSBmdW5jdGlvbigpIHtcbiAgdGhpcy50aGV0YSA9IDA7XG59O1xuXG5Ub3VjaFBhbm5lci5wcm90b3R5cGUub25Ub3VjaFN0YXJ0XyA9IGZ1bmN0aW9uKGUpIHtcbiAgLy8gT25seSByZXNwb25kIGlmIHRoZXJlIGlzIGV4YWN0bHkgb25lIHRvdWNoLlxuICBpZiAoZS50b3VjaGVzLmxlbmd0aCAhPSAxKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIHRoaXMucm90YXRlU3RhcnQuc2V0KGUudG91Y2hlc1swXS5wYWdlWCwgZS50b3VjaGVzWzBdLnBhZ2VZKTtcbiAgdGhpcy5pc1RvdWNoaW5nID0gdHJ1ZTtcbn07XG5cblRvdWNoUGFubmVyLnByb3RvdHlwZS5vblRvdWNoTW92ZV8gPSBmdW5jdGlvbihlKSB7XG4gIGlmICghdGhpcy5pc1RvdWNoaW5nKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIHRoaXMucm90YXRlRW5kLnNldChlLnRvdWNoZXNbMF0ucGFnZVgsIGUudG91Y2hlc1swXS5wYWdlWSk7XG4gIHRoaXMucm90YXRlRGVsdGEuc3ViVmVjdG9ycyh0aGlzLnJvdGF0ZUVuZCwgdGhpcy5yb3RhdGVTdGFydCk7XG4gIHRoaXMucm90YXRlU3RhcnQuY29weSh0aGlzLnJvdGF0ZUVuZCk7XG5cbiAgLy8gT24gaU9TLCBkaXJlY3Rpb24gaXMgaW52ZXJ0ZWQuXG4gIGlmIChVdGlsLmlzSU9TKCkpIHtcbiAgICB0aGlzLnJvdGF0ZURlbHRhLnggKj0gLTE7XG4gIH1cblxuICB2YXIgZWxlbWVudCA9IGRvY3VtZW50LmJvZHk7XG4gIHRoaXMudGhldGEgKz0gMiAqIE1hdGguUEkgKiB0aGlzLnJvdGF0ZURlbHRhLnggLyBlbGVtZW50LmNsaWVudFdpZHRoICogUk9UQVRFX1NQRUVEO1xufTtcblxuVG91Y2hQYW5uZXIucHJvdG90eXBlLm9uVG91Y2hFbmRfID0gZnVuY3Rpb24oZSkge1xuICB0aGlzLmlzVG91Y2hpbmcgPSBmYWxzZTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gVG91Y2hQYW5uZXI7XG4iLCIvKlxuICogQ29weXJpZ2h0IDIwMTUgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG4gKiB5b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG4gKiBZb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcbiAqXG4gKiAgICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXG4gKlxuICogVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxuICogZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxuICogV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXG4gKiBTZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXG4gKiBsaW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cbiAqL1xuXG52YXIgb2JqZWN0QXNzaWduID0gcmVxdWlyZSgnb2JqZWN0LWFzc2lnbicpO1xuXG52YXIgVXRpbCA9IHdpbmRvdy5VdGlsIHx8IHt9O1xuXG5VdGlsLk1JTl9USU1FU1RFUCA9IDAuMDAxO1xuVXRpbC5NQVhfVElNRVNURVAgPSAxO1xuXG5VdGlsLmJhc2U2NCA9IGZ1bmN0aW9uKG1pbWVUeXBlLCBiYXNlNjQpIHtcbiAgcmV0dXJuICdkYXRhOicgKyBtaW1lVHlwZSArICc7YmFzZTY0LCcgKyBiYXNlNjQ7XG59O1xuXG5VdGlsLmNsYW1wID0gZnVuY3Rpb24odmFsdWUsIG1pbiwgbWF4KSB7XG4gIHJldHVybiBNYXRoLm1pbihNYXRoLm1heChtaW4sIHZhbHVlKSwgbWF4KTtcbn07XG5cblV0aWwubGVycCA9IGZ1bmN0aW9uKGEsIGIsIHQpIHtcbiAgcmV0dXJuIGEgKyAoKGIgLSBhKSAqIHQpO1xufTtcblxuVXRpbC5pc0lPUyA9IChmdW5jdGlvbigpIHtcbiAgdmFyIGlzSU9TID0gL2lQYWR8aVBob25lfGlQb2QvLnRlc3QobmF2aWdhdG9yLnBsYXRmb3JtKTtcbiAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBpc0lPUztcbiAgfTtcbn0pKCk7XG5cblV0aWwuaXNTYWZhcmkgPSAoZnVuY3Rpb24oKSB7XG4gIHZhciBpc1NhZmFyaSA9IC9eKCg/IWNocm9tZXxhbmRyb2lkKS4pKnNhZmFyaS9pLnRlc3QobmF2aWdhdG9yLnVzZXJBZ2VudCk7XG4gIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gaXNTYWZhcmk7XG4gIH07XG59KSgpO1xuXG5VdGlsLmlzRmlyZWZveEFuZHJvaWQgPSAoZnVuY3Rpb24oKSB7XG4gIHZhciBpc0ZpcmVmb3hBbmRyb2lkID0gbmF2aWdhdG9yLnVzZXJBZ2VudC5pbmRleE9mKCdGaXJlZm94JykgIT09IC0xICYmXG4gICAgICBuYXZpZ2F0b3IudXNlckFnZW50LmluZGV4T2YoJ0FuZHJvaWQnKSAhPT0gLTE7XG4gIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gaXNGaXJlZm94QW5kcm9pZDtcbiAgfTtcbn0pKCk7XG5cblV0aWwuaXNMYW5kc2NhcGVNb2RlID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiAod2luZG93Lm9yaWVudGF0aW9uID09IDkwIHx8IHdpbmRvdy5vcmllbnRhdGlvbiA9PSAtOTApO1xufTtcblxuLy8gSGVscGVyIG1ldGhvZCB0byB2YWxpZGF0ZSB0aGUgdGltZSBzdGVwcyBvZiBzZW5zb3IgdGltZXN0YW1wcy5cblV0aWwuaXNUaW1lc3RhbXBEZWx0YVZhbGlkID0gZnVuY3Rpb24odGltZXN0YW1wRGVsdGFTKSB7XG4gIGlmIChpc05hTih0aW1lc3RhbXBEZWx0YVMpKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGlmICh0aW1lc3RhbXBEZWx0YVMgPD0gVXRpbC5NSU5fVElNRVNURVApIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgaWYgKHRpbWVzdGFtcERlbHRhUyA+IFV0aWwuTUFYX1RJTUVTVEVQKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIHJldHVybiB0cnVlO1xufTtcblxuVXRpbC5nZXRTY3JlZW5XaWR0aCA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gTWF0aC5tYXgod2luZG93LnNjcmVlbi53aWR0aCwgd2luZG93LnNjcmVlbi5oZWlnaHQpICpcbiAgICAgIHdpbmRvdy5kZXZpY2VQaXhlbFJhdGlvO1xufTtcblxuVXRpbC5nZXRTY3JlZW5IZWlnaHQgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIE1hdGgubWluKHdpbmRvdy5zY3JlZW4ud2lkdGgsIHdpbmRvdy5zY3JlZW4uaGVpZ2h0KSAqXG4gICAgICB3aW5kb3cuZGV2aWNlUGl4ZWxSYXRpbztcbn07XG5cblV0aWwucmVxdWVzdEZ1bGxzY3JlZW4gPSBmdW5jdGlvbihlbGVtZW50KSB7XG4gIGlmIChlbGVtZW50LnJlcXVlc3RGdWxsc2NyZWVuKSB7XG4gICAgZWxlbWVudC5yZXF1ZXN0RnVsbHNjcmVlbigpO1xuICB9IGVsc2UgaWYgKGVsZW1lbnQud2Via2l0UmVxdWVzdEZ1bGxzY3JlZW4pIHtcbiAgICBlbGVtZW50LndlYmtpdFJlcXVlc3RGdWxsc2NyZWVuKCk7XG4gIH0gZWxzZSBpZiAoZWxlbWVudC5tb3pSZXF1ZXN0RnVsbFNjcmVlbikge1xuICAgIGVsZW1lbnQubW96UmVxdWVzdEZ1bGxTY3JlZW4oKTtcbiAgfSBlbHNlIGlmIChlbGVtZW50Lm1zUmVxdWVzdEZ1bGxzY3JlZW4pIHtcbiAgICBlbGVtZW50Lm1zUmVxdWVzdEZ1bGxzY3JlZW4oKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn07XG5cblV0aWwuZXhpdEZ1bGxzY3JlZW4gPSBmdW5jdGlvbigpIHtcbiAgaWYgKGRvY3VtZW50LmV4aXRGdWxsc2NyZWVuKSB7XG4gICAgZG9jdW1lbnQuZXhpdEZ1bGxzY3JlZW4oKTtcbiAgfSBlbHNlIGlmIChkb2N1bWVudC53ZWJraXRFeGl0RnVsbHNjcmVlbikge1xuICAgIGRvY3VtZW50LndlYmtpdEV4aXRGdWxsc2NyZWVuKCk7XG4gIH0gZWxzZSBpZiAoZG9jdW1lbnQubW96Q2FuY2VsRnVsbFNjcmVlbikge1xuICAgIGRvY3VtZW50Lm1vekNhbmNlbEZ1bGxTY3JlZW4oKTtcbiAgfSBlbHNlIGlmIChkb2N1bWVudC5tc0V4aXRGdWxsc2NyZWVuKSB7XG4gICAgZG9jdW1lbnQubXNFeGl0RnVsbHNjcmVlbigpO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIHJldHVybiB0cnVlO1xufTtcblxuVXRpbC5nZXRGdWxsc2NyZWVuRWxlbWVudCA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gZG9jdW1lbnQuZnVsbHNjcmVlbkVsZW1lbnQgfHxcbiAgICAgIGRvY3VtZW50LndlYmtpdEZ1bGxzY3JlZW5FbGVtZW50IHx8XG4gICAgICBkb2N1bWVudC5tb3pGdWxsU2NyZWVuRWxlbWVudCB8fFxuICAgICAgZG9jdW1lbnQubXNGdWxsc2NyZWVuRWxlbWVudDtcbn07XG5cblV0aWwubGlua1Byb2dyYW0gPSBmdW5jdGlvbihnbCwgdmVydGV4U291cmNlLCBmcmFnbWVudFNvdXJjZSwgYXR0cmliTG9jYXRpb25NYXApIHtcbiAgLy8gTm8gZXJyb3IgY2hlY2tpbmcgZm9yIGJyZXZpdHkuXG4gIHZhciB2ZXJ0ZXhTaGFkZXIgPSBnbC5jcmVhdGVTaGFkZXIoZ2wuVkVSVEVYX1NIQURFUik7XG4gIGdsLnNoYWRlclNvdXJjZSh2ZXJ0ZXhTaGFkZXIsIHZlcnRleFNvdXJjZSk7XG4gIGdsLmNvbXBpbGVTaGFkZXIodmVydGV4U2hhZGVyKTtcblxuICB2YXIgZnJhZ21lbnRTaGFkZXIgPSBnbC5jcmVhdGVTaGFkZXIoZ2wuRlJBR01FTlRfU0hBREVSKTtcbiAgZ2wuc2hhZGVyU291cmNlKGZyYWdtZW50U2hhZGVyLCBmcmFnbWVudFNvdXJjZSk7XG4gIGdsLmNvbXBpbGVTaGFkZXIoZnJhZ21lbnRTaGFkZXIpO1xuXG4gIHZhciBwcm9ncmFtID0gZ2wuY3JlYXRlUHJvZ3JhbSgpO1xuICBnbC5hdHRhY2hTaGFkZXIocHJvZ3JhbSwgdmVydGV4U2hhZGVyKTtcbiAgZ2wuYXR0YWNoU2hhZGVyKHByb2dyYW0sIGZyYWdtZW50U2hhZGVyKTtcblxuICBmb3IgKHZhciBhdHRyaWJOYW1lIGluIGF0dHJpYkxvY2F0aW9uTWFwKVxuICAgIGdsLmJpbmRBdHRyaWJMb2NhdGlvbihwcm9ncmFtLCBhdHRyaWJMb2NhdGlvbk1hcFthdHRyaWJOYW1lXSwgYXR0cmliTmFtZSk7XG5cbiAgZ2wubGlua1Byb2dyYW0ocHJvZ3JhbSk7XG5cbiAgZ2wuZGVsZXRlU2hhZGVyKHZlcnRleFNoYWRlcik7XG4gIGdsLmRlbGV0ZVNoYWRlcihmcmFnbWVudFNoYWRlcik7XG5cbiAgcmV0dXJuIHByb2dyYW07XG59O1xuXG5VdGlsLmdldFByb2dyYW1Vbmlmb3JtcyA9IGZ1bmN0aW9uKGdsLCBwcm9ncmFtKSB7XG4gIHZhciB1bmlmb3JtcyA9IHt9O1xuICB2YXIgdW5pZm9ybUNvdW50ID0gZ2wuZ2V0UHJvZ3JhbVBhcmFtZXRlcihwcm9ncmFtLCBnbC5BQ1RJVkVfVU5JRk9STVMpO1xuICB2YXIgdW5pZm9ybU5hbWUgPSAnJztcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCB1bmlmb3JtQ291bnQ7IGkrKykge1xuICAgIHZhciB1bmlmb3JtSW5mbyA9IGdsLmdldEFjdGl2ZVVuaWZvcm0ocHJvZ3JhbSwgaSk7XG4gICAgdW5pZm9ybU5hbWUgPSB1bmlmb3JtSW5mby5uYW1lLnJlcGxhY2UoJ1swXScsICcnKTtcbiAgICB1bmlmb3Jtc1t1bmlmb3JtTmFtZV0gPSBnbC5nZXRVbmlmb3JtTG9jYXRpb24ocHJvZ3JhbSwgdW5pZm9ybU5hbWUpO1xuICB9XG4gIHJldHVybiB1bmlmb3Jtcztcbn07XG5cblV0aWwub3J0aG9NYXRyaXggPSBmdW5jdGlvbiAob3V0LCBsZWZ0LCByaWdodCwgYm90dG9tLCB0b3AsIG5lYXIsIGZhcikge1xuICB2YXIgbHIgPSAxIC8gKGxlZnQgLSByaWdodCksXG4gICAgICBidCA9IDEgLyAoYm90dG9tIC0gdG9wKSxcbiAgICAgIG5mID0gMSAvIChuZWFyIC0gZmFyKTtcbiAgb3V0WzBdID0gLTIgKiBscjtcbiAgb3V0WzFdID0gMDtcbiAgb3V0WzJdID0gMDtcbiAgb3V0WzNdID0gMDtcbiAgb3V0WzRdID0gMDtcbiAgb3V0WzVdID0gLTIgKiBidDtcbiAgb3V0WzZdID0gMDtcbiAgb3V0WzddID0gMDtcbiAgb3V0WzhdID0gMDtcbiAgb3V0WzldID0gMDtcbiAgb3V0WzEwXSA9IDIgKiBuZjtcbiAgb3V0WzExXSA9IDA7XG4gIG91dFsxMl0gPSAobGVmdCArIHJpZ2h0KSAqIGxyO1xuICBvdXRbMTNdID0gKHRvcCArIGJvdHRvbSkgKiBidDtcbiAgb3V0WzE0XSA9IChmYXIgKyBuZWFyKSAqIG5mO1xuICBvdXRbMTVdID0gMTtcbiAgcmV0dXJuIG91dDtcbn07XG5cblV0aWwuaXNNb2JpbGUgPSBmdW5jdGlvbigpIHtcbiAgdmFyIGNoZWNrID0gZmFsc2U7XG4gIChmdW5jdGlvbihhKXtpZigvKGFuZHJvaWR8YmJcXGQrfG1lZWdvKS4rbW9iaWxlfGF2YW50Z298YmFkYVxcL3xibGFja2JlcnJ5fGJsYXplcnxjb21wYWx8ZWxhaW5lfGZlbm5lY3xoaXB0b3B8aWVtb2JpbGV8aXAoaG9uZXxvZCl8aXJpc3xraW5kbGV8bGdlIHxtYWVtb3xtaWRwfG1tcHxtb2JpbGUuK2ZpcmVmb3h8bmV0ZnJvbnR8b3BlcmEgbShvYnxpbilpfHBhbG0oIG9zKT98cGhvbmV8cChpeGl8cmUpXFwvfHBsdWNrZXJ8cG9ja2V0fHBzcHxzZXJpZXMoNHw2KTB8c3ltYmlhbnx0cmVvfHVwXFwuKGJyb3dzZXJ8bGluayl8dm9kYWZvbmV8d2FwfHdpbmRvd3MgY2V8eGRhfHhpaW5vL2kudGVzdChhKXx8LzEyMDd8NjMxMHw2NTkwfDNnc298NHRocHw1MFsxLTZdaXw3NzBzfDgwMnN8YSB3YXxhYmFjfGFjKGVyfG9vfHNcXC0pfGFpKGtvfHJuKXxhbChhdnxjYXxjbyl8YW1vaXxhbihleHxueXx5dyl8YXB0dXxhcihjaHxnbyl8YXModGV8dXMpfGF0dHd8YXUoZGl8XFwtbXxyIHxzICl8YXZhbnxiZShja3xsbHxucSl8YmkobGJ8cmQpfGJsKGFjfGF6KXxicihlfHYpd3xidW1ifGJ3XFwtKG58dSl8YzU1XFwvfGNhcGl8Y2N3YXxjZG1cXC18Y2VsbHxjaHRtfGNsZGN8Y21kXFwtfGNvKG1wfG5kKXxjcmF3fGRhKGl0fGxsfG5nKXxkYnRlfGRjXFwtc3xkZXZpfGRpY2F8ZG1vYnxkbyhjfHApb3xkcygxMnxcXC1kKXxlbCg0OXxhaSl8ZW0obDJ8dWwpfGVyKGljfGswKXxlc2w4fGV6KFs0LTddMHxvc3x3YXx6ZSl8ZmV0Y3xmbHkoXFwtfF8pfGcxIHV8ZzU2MHxnZW5lfGdmXFwtNXxnXFwtbW98Z28oXFwud3xvZCl8Z3IoYWR8dW4pfGhhaWV8aGNpdHxoZFxcLShtfHB8dCl8aGVpXFwtfGhpKHB0fHRhKXxocCggaXxpcCl8aHNcXC1jfGh0KGMoXFwtfCB8X3xhfGd8cHxzfHQpfHRwKXxodShhd3x0Yyl8aVxcLSgyMHxnb3xtYSl8aTIzMHxpYWMoIHxcXC18XFwvKXxpYnJvfGlkZWF8aWcwMXxpa29tfGltMWt8aW5ub3xpcGFxfGlyaXN8amEodHx2KWF8amJyb3xqZW11fGppZ3N8a2RkaXxrZWppfGtndCggfFxcLyl8a2xvbnxrcHQgfGt3Y1xcLXxreW8oY3xrKXxsZShub3x4aSl8bGcoIGd8XFwvKGt8bHx1KXw1MHw1NHxcXC1bYS13XSl8bGlid3xseW54fG0xXFwtd3xtM2dhfG01MFxcL3xtYSh0ZXx1aXx4byl8bWMoMDF8MjF8Y2EpfG1cXC1jcnxtZShyY3xyaSl8bWkobzh8b2F8dHMpfG1tZWZ8bW8oMDF8MDJ8Yml8ZGV8ZG98dChcXC18IHxvfHYpfHp6KXxtdCg1MHxwMXx2ICl8bXdicHxteXdhfG4xMFswLTJdfG4yMFsyLTNdfG4zMCgwfDIpfG41MCgwfDJ8NSl8bjcoMCgwfDEpfDEwKXxuZSgoY3xtKVxcLXxvbnx0Znx3Znx3Z3x3dCl8bm9rKDZ8aSl8bnpwaHxvMmltfG9wKHRpfHd2KXxvcmFufG93ZzF8cDgwMHxwYW4oYXxkfHQpfHBkeGd8cGcoMTN8XFwtKFsxLThdfGMpKXxwaGlsfHBpcmV8cGwoYXl8dWMpfHBuXFwtMnxwbyhja3xydHxzZSl8cHJveHxwc2lvfHB0XFwtZ3xxYVxcLWF8cWMoMDd8MTJ8MjF8MzJ8NjB8XFwtWzItN118aVxcLSl8cXRla3xyMzgwfHI2MDB8cmFrc3xyaW05fHJvKHZlfHpvKXxzNTVcXC98c2EoZ2V8bWF8bW18bXN8bnl8dmEpfHNjKDAxfGhcXC18b298cFxcLSl8c2RrXFwvfHNlKGMoXFwtfDB8MSl8NDd8bWN8bmR8cmkpfHNnaFxcLXxzaGFyfHNpZShcXC18bSl8c2tcXC0wfHNsKDQ1fGlkKXxzbShhbHxhcnxiM3xpdHx0NSl8c28oZnR8bnkpfHNwKDAxfGhcXC18dlxcLXx2ICl8c3koMDF8bWIpfHQyKDE4fDUwKXx0NigwMHwxMHwxOCl8dGEoZ3R8bGspfHRjbFxcLXx0ZGdcXC18dGVsKGl8bSl8dGltXFwtfHRcXC1tb3x0byhwbHxzaCl8dHMoNzB8bVxcLXxtM3xtNSl8dHhcXC05fHVwKFxcLmJ8ZzF8c2kpfHV0c3R8djQwMHx2NzUwfHZlcml8dmkocmd8dGUpfHZrKDQwfDVbMC0zXXxcXC12KXx2bTQwfHZvZGF8dnVsY3x2eCg1Mnw1M3w2MHw2MXw3MHw4MHw4MXw4M3w4NXw5OCl8dzNjKFxcLXwgKXx3ZWJjfHdoaXR8d2koZyB8bmN8bncpfHdtbGJ8d29udXx4NzAwfHlhc1xcLXx5b3VyfHpldG98enRlXFwtL2kudGVzdChhLnN1YnN0cigwLDQpKSljaGVjayA9IHRydWV9KShuYXZpZ2F0b3IudXNlckFnZW50fHxuYXZpZ2F0b3IudmVuZG9yfHx3aW5kb3cub3BlcmEpO1xuICByZXR1cm4gY2hlY2s7XG59O1xuXG5VdGlsLmV4dGVuZCA9IG9iamVjdEFzc2lnbjtcblxuVXRpbC5zYWZhcmlDc3NTaXplV29ya2Fyb3VuZCA9IGZ1bmN0aW9uKGNhbnZhcykge1xuICAvLyBUT0RPKHNtdXMpOiBSZW1vdmUgdGhpcyB3b3JrYXJvdW5kIHdoZW4gU2FmYXJpIGZvciBpT1MgaXMgZml4ZWQuXG4gIC8vIGlPUyBvbmx5IHdvcmthcm91bmQgKGZvciBodHRwczovL2J1Z3Mud2Via2l0Lm9yZy9zaG93X2J1Zy5jZ2k/aWQ9MTUyNTU2KS5cbiAgLy9cbiAgLy8gXCJUbyB0aGUgbGFzdCBJIGdyYXBwbGUgd2l0aCB0aGVlO1xuICAvLyAgZnJvbSBoZWxsJ3MgaGVhcnQgSSBzdGFiIGF0IHRoZWU7XG4gIC8vICBmb3IgaGF0ZSdzIHNha2UgSSBzcGl0IG15IGxhc3QgYnJlYXRoIGF0IHRoZWUuXCJcbiAgLy8gLS0gTW9ieSBEaWNrLCBieSBIZXJtYW4gTWVsdmlsbGVcbiAgaWYgKFV0aWwuaXNJT1MoKSkge1xuICAgIHZhciB3aWR0aCA9IGNhbnZhcy5zdHlsZS53aWR0aDtcbiAgICB2YXIgaGVpZ2h0ID0gY2FudmFzLnN0eWxlLmhlaWdodDtcbiAgICBjYW52YXMuc3R5bGUud2lkdGggPSAocGFyc2VJbnQod2lkdGgpICsgMSkgKyAncHgnO1xuICAgIGNhbnZhcy5zdHlsZS5oZWlnaHQgPSAocGFyc2VJbnQoaGVpZ2h0KSkgKyAncHgnO1xuICAgIGNvbnNvbGUubG9nKCdSZXNldHRpbmcgd2lkdGggdG8uLi4nLCB3aWR0aCk7XG4gICAgc2V0VGltZW91dChmdW5jdGlvbigpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdEb25lLiBXaWR0aCBpcyBub3cnLCB3aWR0aCk7XG4gICAgICBjYW52YXMuc3R5bGUud2lkdGggPSB3aWR0aDtcbiAgICAgIGNhbnZhcy5zdHlsZS5oZWlnaHQgPSBoZWlnaHQ7XG4gICAgfSwgMTAwKTtcbiAgfVxuXG4gIC8vIERlYnVnIG9ubHkuXG4gIHdpbmRvdy5VdGlsID0gVXRpbDtcbiAgd2luZG93LmNhbnZhcyA9IGNhbnZhcztcbn07XG5cblV0aWwuZnJhbWVEYXRhRnJvbVBvc2UgPSAoZnVuY3Rpb24oKSB7XG4gIHZhciBwaU92ZXIxODAgPSBNYXRoLlBJIC8gMTgwLjA7XG4gIHZhciByYWQ0NSA9IE1hdGguUEkgKiAwLjI1O1xuXG4gIC8vIEJvcnJvd2VkIGZyb20gZ2xNYXRyaXguXG4gIGZ1bmN0aW9uIG1hdDRfcGVyc3BlY3RpdmVGcm9tRmllbGRPZlZpZXcob3V0LCBmb3YsIG5lYXIsIGZhcikge1xuICAgIHZhciB1cFRhbiA9IE1hdGgudGFuKGZvdiA/IChmb3YudXBEZWdyZWVzICogcGlPdmVyMTgwKSA6IHJhZDQ1KSxcbiAgICBkb3duVGFuID0gTWF0aC50YW4oZm92ID8gKGZvdi5kb3duRGVncmVlcyAqIHBpT3ZlcjE4MCkgOiByYWQ0NSksXG4gICAgbGVmdFRhbiA9IE1hdGgudGFuKGZvdiA/IChmb3YubGVmdERlZ3JlZXMgKiBwaU92ZXIxODApIDogcmFkNDUpLFxuICAgIHJpZ2h0VGFuID0gTWF0aC50YW4oZm92ID8gKGZvdi5yaWdodERlZ3JlZXMgKiBwaU92ZXIxODApIDogcmFkNDUpLFxuICAgIHhTY2FsZSA9IDIuMCAvIChsZWZ0VGFuICsgcmlnaHRUYW4pLFxuICAgIHlTY2FsZSA9IDIuMCAvICh1cFRhbiArIGRvd25UYW4pO1xuXG4gICAgb3V0WzBdID0geFNjYWxlO1xuICAgIG91dFsxXSA9IDAuMDtcbiAgICBvdXRbMl0gPSAwLjA7XG4gICAgb3V0WzNdID0gMC4wO1xuICAgIG91dFs0XSA9IDAuMDtcbiAgICBvdXRbNV0gPSB5U2NhbGU7XG4gICAgb3V0WzZdID0gMC4wO1xuICAgIG91dFs3XSA9IDAuMDtcbiAgICBvdXRbOF0gPSAtKChsZWZ0VGFuIC0gcmlnaHRUYW4pICogeFNjYWxlICogMC41KTtcbiAgICBvdXRbOV0gPSAoKHVwVGFuIC0gZG93blRhbikgKiB5U2NhbGUgKiAwLjUpO1xuICAgIG91dFsxMF0gPSBmYXIgLyAobmVhciAtIGZhcik7XG4gICAgb3V0WzExXSA9IC0xLjA7XG4gICAgb3V0WzEyXSA9IDAuMDtcbiAgICBvdXRbMTNdID0gMC4wO1xuICAgIG91dFsxNF0gPSAoZmFyICogbmVhcikgLyAobmVhciAtIGZhcik7XG4gICAgb3V0WzE1XSA9IDAuMDtcbiAgICByZXR1cm4gb3V0O1xuICB9XG5cbiAgZnVuY3Rpb24gbWF0NF9mcm9tUm90YXRpb25UcmFuc2xhdGlvbihvdXQsIHEsIHYpIHtcbiAgICAvLyBRdWF0ZXJuaW9uIG1hdGhcbiAgICB2YXIgeCA9IHFbMF0sIHkgPSBxWzFdLCB6ID0gcVsyXSwgdyA9IHFbM10sXG4gICAgICAgIHgyID0geCArIHgsXG4gICAgICAgIHkyID0geSArIHksXG4gICAgICAgIHoyID0geiArIHosXG5cbiAgICAgICAgeHggPSB4ICogeDIsXG4gICAgICAgIHh5ID0geCAqIHkyLFxuICAgICAgICB4eiA9IHggKiB6MixcbiAgICAgICAgeXkgPSB5ICogeTIsXG4gICAgICAgIHl6ID0geSAqIHoyLFxuICAgICAgICB6eiA9IHogKiB6MixcbiAgICAgICAgd3ggPSB3ICogeDIsXG4gICAgICAgIHd5ID0gdyAqIHkyLFxuICAgICAgICB3eiA9IHcgKiB6MjtcblxuICAgIG91dFswXSA9IDEgLSAoeXkgKyB6eik7XG4gICAgb3V0WzFdID0geHkgKyB3ejtcbiAgICBvdXRbMl0gPSB4eiAtIHd5O1xuICAgIG91dFszXSA9IDA7XG4gICAgb3V0WzRdID0geHkgLSB3ejtcbiAgICBvdXRbNV0gPSAxIC0gKHh4ICsgenopO1xuICAgIG91dFs2XSA9IHl6ICsgd3g7XG4gICAgb3V0WzddID0gMDtcbiAgICBvdXRbOF0gPSB4eiArIHd5O1xuICAgIG91dFs5XSA9IHl6IC0gd3g7XG4gICAgb3V0WzEwXSA9IDEgLSAoeHggKyB5eSk7XG4gICAgb3V0WzExXSA9IDA7XG4gICAgb3V0WzEyXSA9IHZbMF07XG4gICAgb3V0WzEzXSA9IHZbMV07XG4gICAgb3V0WzE0XSA9IHZbMl07XG4gICAgb3V0WzE1XSA9IDE7XG5cbiAgICByZXR1cm4gb3V0O1xuICB9O1xuXG4gIGZ1bmN0aW9uIG1hdDRfdHJhbnNsYXRlKG91dCwgYSwgdikge1xuICAgIHZhciB4ID0gdlswXSwgeSA9IHZbMV0sIHogPSB2WzJdLFxuICAgICAgICBhMDAsIGEwMSwgYTAyLCBhMDMsXG4gICAgICAgIGExMCwgYTExLCBhMTIsIGExMyxcbiAgICAgICAgYTIwLCBhMjEsIGEyMiwgYTIzO1xuXG4gICAgaWYgKGEgPT09IG91dCkge1xuICAgICAgb3V0WzEyXSA9IGFbMF0gKiB4ICsgYVs0XSAqIHkgKyBhWzhdICogeiArIGFbMTJdO1xuICAgICAgb3V0WzEzXSA9IGFbMV0gKiB4ICsgYVs1XSAqIHkgKyBhWzldICogeiArIGFbMTNdO1xuICAgICAgb3V0WzE0XSA9IGFbMl0gKiB4ICsgYVs2XSAqIHkgKyBhWzEwXSAqIHogKyBhWzE0XTtcbiAgICAgIG91dFsxNV0gPSBhWzNdICogeCArIGFbN10gKiB5ICsgYVsxMV0gKiB6ICsgYVsxNV07XG4gICAgfSBlbHNlIHtcbiAgICAgIGEwMCA9IGFbMF07IGEwMSA9IGFbMV07IGEwMiA9IGFbMl07IGEwMyA9IGFbM107XG4gICAgICBhMTAgPSBhWzRdOyBhMTEgPSBhWzVdOyBhMTIgPSBhWzZdOyBhMTMgPSBhWzddO1xuICAgICAgYTIwID0gYVs4XTsgYTIxID0gYVs5XTsgYTIyID0gYVsxMF07IGEyMyA9IGFbMTFdO1xuXG4gICAgICBvdXRbMF0gPSBhMDA7IG91dFsxXSA9IGEwMTsgb3V0WzJdID0gYTAyOyBvdXRbM10gPSBhMDM7XG4gICAgICBvdXRbNF0gPSBhMTA7IG91dFs1XSA9IGExMTsgb3V0WzZdID0gYTEyOyBvdXRbN10gPSBhMTM7XG4gICAgICBvdXRbOF0gPSBhMjA7IG91dFs5XSA9IGEyMTsgb3V0WzEwXSA9IGEyMjsgb3V0WzExXSA9IGEyMztcblxuICAgICAgb3V0WzEyXSA9IGEwMCAqIHggKyBhMTAgKiB5ICsgYTIwICogeiArIGFbMTJdO1xuICAgICAgb3V0WzEzXSA9IGEwMSAqIHggKyBhMTEgKiB5ICsgYTIxICogeiArIGFbMTNdO1xuICAgICAgb3V0WzE0XSA9IGEwMiAqIHggKyBhMTIgKiB5ICsgYTIyICogeiArIGFbMTRdO1xuICAgICAgb3V0WzE1XSA9IGEwMyAqIHggKyBhMTMgKiB5ICsgYTIzICogeiArIGFbMTVdO1xuICAgIH1cblxuICAgIHJldHVybiBvdXQ7XG4gIH07XG5cbiAgbWF0NF9pbnZlcnQgPSBmdW5jdGlvbihvdXQsIGEpIHtcbiAgICB2YXIgYTAwID0gYVswXSwgYTAxID0gYVsxXSwgYTAyID0gYVsyXSwgYTAzID0gYVszXSxcbiAgICAgICAgYTEwID0gYVs0XSwgYTExID0gYVs1XSwgYTEyID0gYVs2XSwgYTEzID0gYVs3XSxcbiAgICAgICAgYTIwID0gYVs4XSwgYTIxID0gYVs5XSwgYTIyID0gYVsxMF0sIGEyMyA9IGFbMTFdLFxuICAgICAgICBhMzAgPSBhWzEyXSwgYTMxID0gYVsxM10sIGEzMiA9IGFbMTRdLCBhMzMgPSBhWzE1XSxcblxuICAgICAgICBiMDAgPSBhMDAgKiBhMTEgLSBhMDEgKiBhMTAsXG4gICAgICAgIGIwMSA9IGEwMCAqIGExMiAtIGEwMiAqIGExMCxcbiAgICAgICAgYjAyID0gYTAwICogYTEzIC0gYTAzICogYTEwLFxuICAgICAgICBiMDMgPSBhMDEgKiBhMTIgLSBhMDIgKiBhMTEsXG4gICAgICAgIGIwNCA9IGEwMSAqIGExMyAtIGEwMyAqIGExMSxcbiAgICAgICAgYjA1ID0gYTAyICogYTEzIC0gYTAzICogYTEyLFxuICAgICAgICBiMDYgPSBhMjAgKiBhMzEgLSBhMjEgKiBhMzAsXG4gICAgICAgIGIwNyA9IGEyMCAqIGEzMiAtIGEyMiAqIGEzMCxcbiAgICAgICAgYjA4ID0gYTIwICogYTMzIC0gYTIzICogYTMwLFxuICAgICAgICBiMDkgPSBhMjEgKiBhMzIgLSBhMjIgKiBhMzEsXG4gICAgICAgIGIxMCA9IGEyMSAqIGEzMyAtIGEyMyAqIGEzMSxcbiAgICAgICAgYjExID0gYTIyICogYTMzIC0gYTIzICogYTMyLFxuXG4gICAgICAgIC8vIENhbGN1bGF0ZSB0aGUgZGV0ZXJtaW5hbnRcbiAgICAgICAgZGV0ID0gYjAwICogYjExIC0gYjAxICogYjEwICsgYjAyICogYjA5ICsgYjAzICogYjA4IC0gYjA0ICogYjA3ICsgYjA1ICogYjA2O1xuXG4gICAgaWYgKCFkZXQpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBkZXQgPSAxLjAgLyBkZXQ7XG5cbiAgICBvdXRbMF0gPSAoYTExICogYjExIC0gYTEyICogYjEwICsgYTEzICogYjA5KSAqIGRldDtcbiAgICBvdXRbMV0gPSAoYTAyICogYjEwIC0gYTAxICogYjExIC0gYTAzICogYjA5KSAqIGRldDtcbiAgICBvdXRbMl0gPSAoYTMxICogYjA1IC0gYTMyICogYjA0ICsgYTMzICogYjAzKSAqIGRldDtcbiAgICBvdXRbM10gPSAoYTIyICogYjA0IC0gYTIxICogYjA1IC0gYTIzICogYjAzKSAqIGRldDtcbiAgICBvdXRbNF0gPSAoYTEyICogYjA4IC0gYTEwICogYjExIC0gYTEzICogYjA3KSAqIGRldDtcbiAgICBvdXRbNV0gPSAoYTAwICogYjExIC0gYTAyICogYjA4ICsgYTAzICogYjA3KSAqIGRldDtcbiAgICBvdXRbNl0gPSAoYTMyICogYjAyIC0gYTMwICogYjA1IC0gYTMzICogYjAxKSAqIGRldDtcbiAgICBvdXRbN10gPSAoYTIwICogYjA1IC0gYTIyICogYjAyICsgYTIzICogYjAxKSAqIGRldDtcbiAgICBvdXRbOF0gPSAoYTEwICogYjEwIC0gYTExICogYjA4ICsgYTEzICogYjA2KSAqIGRldDtcbiAgICBvdXRbOV0gPSAoYTAxICogYjA4IC0gYTAwICogYjEwIC0gYTAzICogYjA2KSAqIGRldDtcbiAgICBvdXRbMTBdID0gKGEzMCAqIGIwNCAtIGEzMSAqIGIwMiArIGEzMyAqIGIwMCkgKiBkZXQ7XG4gICAgb3V0WzExXSA9IChhMjEgKiBiMDIgLSBhMjAgKiBiMDQgLSBhMjMgKiBiMDApICogZGV0O1xuICAgIG91dFsxMl0gPSAoYTExICogYjA3IC0gYTEwICogYjA5IC0gYTEyICogYjA2KSAqIGRldDtcbiAgICBvdXRbMTNdID0gKGEwMCAqIGIwOSAtIGEwMSAqIGIwNyArIGEwMiAqIGIwNikgKiBkZXQ7XG4gICAgb3V0WzE0XSA9IChhMzEgKiBiMDEgLSBhMzAgKiBiMDMgLSBhMzIgKiBiMDApICogZGV0O1xuICAgIG91dFsxNV0gPSAoYTIwICogYjAzIC0gYTIxICogYjAxICsgYTIyICogYjAwKSAqIGRldDtcblxuICAgIHJldHVybiBvdXQ7XG4gIH07XG5cbiAgdmFyIGRlZmF1bHRPcmllbnRhdGlvbiA9IG5ldyBGbG9hdDMyQXJyYXkoWzAsIDAsIDAsIDFdKTtcbiAgdmFyIGRlZmF1bHRQb3NpdGlvbiA9IG5ldyBGbG9hdDMyQXJyYXkoWzAsIDAsIDBdKTtcblxuICBmdW5jdGlvbiB1cGRhdGVFeWVNYXRyaWNlcyhwcm9qZWN0aW9uLCB2aWV3LCBwb3NlLCBwYXJhbWV0ZXJzLCB2ckRpc3BsYXkpIHtcbiAgICBtYXQ0X3BlcnNwZWN0aXZlRnJvbUZpZWxkT2ZWaWV3KHByb2plY3Rpb24sIHBhcmFtZXRlcnMgPyBwYXJhbWV0ZXJzLmZpZWxkT2ZWaWV3IDogbnVsbCwgdnJEaXNwbGF5LmRlcHRoTmVhciwgdnJEaXNwbGF5LmRlcHRoRmFyKTtcblxuICAgIHZhciBvcmllbnRhdGlvbiA9IHBvc2Uub3JpZW50YXRpb24gfHwgZGVmYXVsdE9yaWVudGF0aW9uO1xuICAgIHZhciBwb3NpdGlvbiA9IHBvc2UucG9zaXRpb24gfHwgZGVmYXVsdFBvc2l0aW9uO1xuXG4gICAgbWF0NF9mcm9tUm90YXRpb25UcmFuc2xhdGlvbih2aWV3LCBvcmllbnRhdGlvbiwgcG9zaXRpb24pO1xuICAgIGlmIChwYXJhbWV0ZXJzKVxuICAgICAgbWF0NF90cmFuc2xhdGUodmlldywgdmlldywgcGFyYW1ldGVycy5vZmZzZXQpO1xuICAgIG1hdDRfaW52ZXJ0KHZpZXcsIHZpZXcpO1xuICB9XG5cbiAgcmV0dXJuIGZ1bmN0aW9uKGZyYW1lRGF0YSwgcG9zZSwgdnJEaXNwbGF5KSB7XG4gICAgaWYgKCFmcmFtZURhdGEgfHwgIXBvc2UpXG4gICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICBmcmFtZURhdGEucG9zZSA9IHBvc2U7XG4gICAgZnJhbWVEYXRhLnRpbWVzdGFtcCA9IHBvc2UudGltZXN0YW1wO1xuXG4gICAgdXBkYXRlRXllTWF0cmljZXMoXG4gICAgICAgIGZyYW1lRGF0YS5sZWZ0UHJvamVjdGlvbk1hdHJpeCwgZnJhbWVEYXRhLmxlZnRWaWV3TWF0cml4LFxuICAgICAgICBwb3NlLCB2ckRpc3BsYXkuZ2V0RXllUGFyYW1ldGVycyhcImxlZnRcIiksIHZyRGlzcGxheSk7XG4gICAgdXBkYXRlRXllTWF0cmljZXMoXG4gICAgICAgIGZyYW1lRGF0YS5yaWdodFByb2plY3Rpb25NYXRyaXgsIGZyYW1lRGF0YS5yaWdodFZpZXdNYXRyaXgsXG4gICAgICAgIHBvc2UsIHZyRGlzcGxheS5nZXRFeWVQYXJhbWV0ZXJzKFwicmlnaHRcIiksIHZyRGlzcGxheSk7XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfTtcbn0pKCk7XG5cbm1vZHVsZS5leHBvcnRzID0gVXRpbDtcbiIsIi8qXG4gKiBDb3B5cmlnaHQgMjAxNSBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICogTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcbiAqIHlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cbiAqIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuICpcbiAqICAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcbiAqXG4gKiBVbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG4gKiBkaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG4gKiBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cbiAqIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbiAqIGxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuICovXG5cbnZhciBFbWl0dGVyID0gcmVxdWlyZSgnLi9lbWl0dGVyLmpzJyk7XG52YXIgVXRpbCA9IHJlcXVpcmUoJy4vdXRpbC5qcycpO1xudmFyIERldmljZUluZm8gPSByZXF1aXJlKCcuL2RldmljZS1pbmZvLmpzJyk7XG5cbnZhciBERUZBVUxUX1ZJRVdFUiA9ICdDYXJkYm9hcmRWMSc7XG52YXIgVklFV0VSX0tFWSA9ICdXRUJWUl9DQVJEQk9BUkRfVklFV0VSJztcbnZhciBDTEFTU19OQU1FID0gJ3dlYnZyLXBvbHlmaWxsLXZpZXdlci1zZWxlY3Rvcic7XG5cbi8qKlxuICogQ3JlYXRlcyBhIHZpZXdlciBzZWxlY3RvciB3aXRoIHRoZSBvcHRpb25zIHNwZWNpZmllZC4gU3VwcG9ydHMgYmVpbmcgc2hvd25cbiAqIGFuZCBoaWRkZW4uIEdlbmVyYXRlcyBldmVudHMgd2hlbiB2aWV3ZXIgcGFyYW1ldGVycyBjaGFuZ2UuIEFsc28gc3VwcG9ydHNcbiAqIHNhdmluZyB0aGUgY3VycmVudGx5IHNlbGVjdGVkIGluZGV4IGluIGxvY2FsU3RvcmFnZS5cbiAqL1xuZnVuY3Rpb24gVmlld2VyU2VsZWN0b3IoKSB7XG4gIC8vIFRyeSB0byBsb2FkIHRoZSBzZWxlY3RlZCBrZXkgZnJvbSBsb2NhbCBzdG9yYWdlLiBJZiBub25lIGV4aXN0cywgdXNlIHRoZVxuICAvLyBkZWZhdWx0IGtleS5cbiAgdHJ5IHtcbiAgICB0aGlzLnNlbGVjdGVkS2V5ID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oVklFV0VSX0tFWSkgfHwgREVGQVVMVF9WSUVXRVI7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcignRmFpbGVkIHRvIGxvYWQgdmlld2VyIHByb2ZpbGU6ICVzJywgZXJyb3IpO1xuICB9XG4gIHRoaXMuZGlhbG9nID0gdGhpcy5jcmVhdGVEaWFsb2dfKERldmljZUluZm8uVmlld2Vycyk7XG4gIHRoaXMucm9vdCA9IG51bGw7XG59XG5WaWV3ZXJTZWxlY3Rvci5wcm90b3R5cGUgPSBuZXcgRW1pdHRlcigpO1xuXG5WaWV3ZXJTZWxlY3Rvci5wcm90b3R5cGUuc2hvdyA9IGZ1bmN0aW9uKHJvb3QpIHtcbiAgdGhpcy5yb290ID0gcm9vdDtcblxuICByb290LmFwcGVuZENoaWxkKHRoaXMuZGlhbG9nKTtcbiAgLy9jb25zb2xlLmxvZygnVmlld2VyU2VsZWN0b3Iuc2hvdycpO1xuXG4gIC8vIEVuc3VyZSB0aGUgY3VycmVudGx5IHNlbGVjdGVkIGl0ZW0gaXMgY2hlY2tlZC5cbiAgdmFyIHNlbGVjdGVkID0gdGhpcy5kaWFsb2cucXVlcnlTZWxlY3RvcignIycgKyB0aGlzLnNlbGVjdGVkS2V5KTtcbiAgc2VsZWN0ZWQuY2hlY2tlZCA9IHRydWU7XG5cbiAgLy8gU2hvdyB0aGUgVUkuXG4gIHRoaXMuZGlhbG9nLnN0eWxlLmRpc3BsYXkgPSAnYmxvY2snO1xufTtcblxuVmlld2VyU2VsZWN0b3IucHJvdG90eXBlLmhpZGUgPSBmdW5jdGlvbigpIHtcbiAgaWYgKHRoaXMucm9vdCAmJiB0aGlzLnJvb3QuY29udGFpbnModGhpcy5kaWFsb2cpKSB7XG4gICAgdGhpcy5yb290LnJlbW92ZUNoaWxkKHRoaXMuZGlhbG9nKTtcbiAgfVxuICAvL2NvbnNvbGUubG9nKCdWaWV3ZXJTZWxlY3Rvci5oaWRlJyk7XG4gIHRoaXMuZGlhbG9nLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG59O1xuXG5WaWV3ZXJTZWxlY3Rvci5wcm90b3R5cGUuZ2V0Q3VycmVudFZpZXdlciA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gRGV2aWNlSW5mby5WaWV3ZXJzW3RoaXMuc2VsZWN0ZWRLZXldO1xufTtcblxuVmlld2VyU2VsZWN0b3IucHJvdG90eXBlLmdldFNlbGVjdGVkS2V5XyA9IGZ1bmN0aW9uKCkge1xuICB2YXIgaW5wdXQgPSB0aGlzLmRpYWxvZy5xdWVyeVNlbGVjdG9yKCdpbnB1dFtuYW1lPWZpZWxkXTpjaGVja2VkJyk7XG4gIGlmIChpbnB1dCkge1xuICAgIHJldHVybiBpbnB1dC5pZDtcbiAgfVxuICByZXR1cm4gbnVsbDtcbn07XG5cblZpZXdlclNlbGVjdG9yLnByb3RvdHlwZS5vblNhdmVfID0gZnVuY3Rpb24oKSB7XG4gIHRoaXMuc2VsZWN0ZWRLZXkgPSB0aGlzLmdldFNlbGVjdGVkS2V5XygpO1xuICBpZiAoIXRoaXMuc2VsZWN0ZWRLZXkgfHwgIURldmljZUluZm8uVmlld2Vyc1t0aGlzLnNlbGVjdGVkS2V5XSkge1xuICAgIGNvbnNvbGUuZXJyb3IoJ1ZpZXdlclNlbGVjdG9yLm9uU2F2ZV86IHRoaXMgc2hvdWxkIG5ldmVyIGhhcHBlbiEnKTtcbiAgICByZXR1cm47XG4gIH1cblxuICB0aGlzLmVtaXQoJ2NoYW5nZScsIERldmljZUluZm8uVmlld2Vyc1t0aGlzLnNlbGVjdGVkS2V5XSk7XG5cbiAgLy8gQXR0ZW1wdCB0byBzYXZlIHRoZSB2aWV3ZXIgcHJvZmlsZSwgYnV0IGZhaWxzIGluIHByaXZhdGUgbW9kZS5cbiAgdHJ5IHtcbiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbShWSUVXRVJfS0VZLCB0aGlzLnNlbGVjdGVkS2V5KTtcbiAgfSBjYXRjaChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoJ0ZhaWxlZCB0byBzYXZlIHZpZXdlciBwcm9maWxlOiAlcycsIGVycm9yKTtcbiAgfVxuICB0aGlzLmhpZGUoKTtcbn07XG5cbi8qKlxuICogQ3JlYXRlcyB0aGUgZGlhbG9nLlxuICovXG5WaWV3ZXJTZWxlY3Rvci5wcm90b3R5cGUuY3JlYXRlRGlhbG9nXyA9IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgdmFyIGNvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICBjb250YWluZXIuY2xhc3NMaXN0LmFkZChDTEFTU19OQU1FKTtcbiAgY29udGFpbmVyLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gIC8vIENyZWF0ZSBhbiBvdmVybGF5IHRoYXQgZGltcyB0aGUgYmFja2dyb3VuZCwgYW5kIHdoaWNoIGdvZXMgYXdheSB3aGVuIHlvdVxuICAvLyB0YXAgaXQuXG4gIHZhciBvdmVybGF5ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gIHZhciBzID0gb3ZlcmxheS5zdHlsZTtcbiAgcy5wb3NpdGlvbiA9ICdmaXhlZCc7XG4gIHMubGVmdCA9IDA7XG4gIHMudG9wID0gMDtcbiAgcy53aWR0aCA9ICcxMDAlJztcbiAgcy5oZWlnaHQgPSAnMTAwJSc7XG4gIHMuYmFja2dyb3VuZCA9ICdyZ2JhKDAsIDAsIDAsIDAuMyknO1xuICBvdmVybGF5LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgdGhpcy5oaWRlLmJpbmQodGhpcykpO1xuXG4gIHZhciB3aWR0aCA9IDI4MDtcbiAgdmFyIGRpYWxvZyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICB2YXIgcyA9IGRpYWxvZy5zdHlsZTtcbiAgcy5ib3hTaXppbmcgPSAnYm9yZGVyLWJveCc7XG4gIHMucG9zaXRpb24gPSAnZml4ZWQnO1xuICBzLnRvcCA9ICcyNHB4JztcbiAgcy5sZWZ0ID0gJzUwJSc7XG4gIHMubWFyZ2luTGVmdCA9ICgtd2lkdGgvMikgKyAncHgnO1xuICBzLndpZHRoID0gd2lkdGggKyAncHgnO1xuICBzLnBhZGRpbmcgPSAnMjRweCc7XG4gIHMub3ZlcmZsb3cgPSAnaGlkZGVuJztcbiAgcy5iYWNrZ3JvdW5kID0gJyNmYWZhZmEnO1xuICBzLmZvbnRGYW1pbHkgPSBcIidSb2JvdG8nLCBzYW5zLXNlcmlmXCI7XG4gIHMuYm94U2hhZG93ID0gJzBweCA1cHggMjBweCAjNjY2JztcblxuICBkaWFsb2cuYXBwZW5kQ2hpbGQodGhpcy5jcmVhdGVIMV8oJ1NlbGVjdCB5b3VyIHZpZXdlcicpKTtcbiAgZm9yICh2YXIgaWQgaW4gb3B0aW9ucykge1xuICAgIGRpYWxvZy5hcHBlbmRDaGlsZCh0aGlzLmNyZWF0ZUNob2ljZV8oaWQsIG9wdGlvbnNbaWRdLmxhYmVsKSk7XG4gIH1cbiAgZGlhbG9nLmFwcGVuZENoaWxkKHRoaXMuY3JlYXRlQnV0dG9uXygnU2F2ZScsIHRoaXMub25TYXZlXy5iaW5kKHRoaXMpKSk7XG5cbiAgY29udGFpbmVyLmFwcGVuZENoaWxkKG92ZXJsYXkpO1xuICBjb250YWluZXIuYXBwZW5kQ2hpbGQoZGlhbG9nKTtcblxuICByZXR1cm4gY29udGFpbmVyO1xufTtcblxuVmlld2VyU2VsZWN0b3IucHJvdG90eXBlLmNyZWF0ZUgxXyA9IGZ1bmN0aW9uKG5hbWUpIHtcbiAgdmFyIGgxID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaDEnKTtcbiAgdmFyIHMgPSBoMS5zdHlsZTtcbiAgcy5jb2xvciA9ICdibGFjayc7XG4gIHMuZm9udFNpemUgPSAnMjBweCc7XG4gIHMuZm9udFdlaWdodCA9ICdib2xkJztcbiAgcy5tYXJnaW5Ub3AgPSAwO1xuICBzLm1hcmdpbkJvdHRvbSA9ICcyNHB4JztcbiAgaDEuaW5uZXJIVE1MID0gbmFtZTtcbiAgcmV0dXJuIGgxO1xufTtcblxuVmlld2VyU2VsZWN0b3IucHJvdG90eXBlLmNyZWF0ZUNob2ljZV8gPSBmdW5jdGlvbihpZCwgbmFtZSkge1xuICAvKlxuICA8ZGl2IGNsYXNzPVwiY2hvaWNlXCI+XG4gIDxpbnB1dCBpZD1cInYxXCIgdHlwZT1cInJhZGlvXCIgbmFtZT1cImZpZWxkXCIgdmFsdWU9XCJ2MVwiPlxuICA8bGFiZWwgZm9yPVwidjFcIj5DYXJkYm9hcmQgVjE8L2xhYmVsPlxuICA8L2Rpdj5cbiAgKi9cbiAgdmFyIGRpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICBkaXYuc3R5bGUubWFyZ2luVG9wID0gJzhweCc7XG4gIGRpdi5zdHlsZS5jb2xvciA9ICdibGFjayc7XG5cbiAgdmFyIGlucHV0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaW5wdXQnKTtcbiAgaW5wdXQuc3R5bGUuZm9udFNpemUgPSAnMzBweCc7XG4gIGlucHV0LnNldEF0dHJpYnV0ZSgnaWQnLCBpZCk7XG4gIGlucHV0LnNldEF0dHJpYnV0ZSgndHlwZScsICdyYWRpbycpO1xuICBpbnB1dC5zZXRBdHRyaWJ1dGUoJ3ZhbHVlJywgaWQpO1xuICBpbnB1dC5zZXRBdHRyaWJ1dGUoJ25hbWUnLCAnZmllbGQnKTtcblxuICB2YXIgbGFiZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdsYWJlbCcpO1xuICBsYWJlbC5zdHlsZS5tYXJnaW5MZWZ0ID0gJzRweCc7XG4gIGxhYmVsLnNldEF0dHJpYnV0ZSgnZm9yJywgaWQpO1xuICBsYWJlbC5pbm5lckhUTUwgPSBuYW1lO1xuXG4gIGRpdi5hcHBlbmRDaGlsZChpbnB1dCk7XG4gIGRpdi5hcHBlbmRDaGlsZChsYWJlbCk7XG5cbiAgcmV0dXJuIGRpdjtcbn07XG5cblZpZXdlclNlbGVjdG9yLnByb3RvdHlwZS5jcmVhdGVCdXR0b25fID0gZnVuY3Rpb24obGFiZWwsIG9uY2xpY2spIHtcbiAgdmFyIGJ1dHRvbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpO1xuICBidXR0b24uaW5uZXJIVE1MID0gbGFiZWw7XG4gIHZhciBzID0gYnV0dG9uLnN0eWxlO1xuICBzLmZsb2F0ID0gJ3JpZ2h0JztcbiAgcy50ZXh0VHJhbnNmb3JtID0gJ3VwcGVyY2FzZSc7XG4gIHMuY29sb3IgPSAnIzEwOTRmNyc7XG4gIHMuZm9udFNpemUgPSAnMTRweCc7XG4gIHMubGV0dGVyU3BhY2luZyA9IDA7XG4gIHMuYm9yZGVyID0gMDtcbiAgcy5iYWNrZ3JvdW5kID0gJ25vbmUnO1xuICBzLm1hcmdpblRvcCA9ICcxNnB4JztcblxuICBidXR0b24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBvbmNsaWNrKTtcblxuICByZXR1cm4gYnV0dG9uO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBWaWV3ZXJTZWxlY3RvcjtcbiIsIi8qXG4gKiBDb3B5cmlnaHQgMjAxNSBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICogTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcbiAqIHlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cbiAqIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuICpcbiAqICAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcbiAqXG4gKiBVbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG4gKiBkaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG4gKiBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cbiAqIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbiAqIGxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuICovXG5cbnZhciBVdGlsID0gcmVxdWlyZSgnLi91dGlsLmpzJyk7XG5cbi8qKlxuICogQW5kcm9pZCBhbmQgaU9TIGNvbXBhdGlibGUgd2FrZWxvY2sgaW1wbGVtZW50YXRpb24uXG4gKlxuICogUmVmYWN0b3JlZCB0aGFua3MgdG8gZGtvdmFsZXZALlxuICovXG5mdW5jdGlvbiBBbmRyb2lkV2FrZUxvY2soKSB7XG4gIHZhciB2aWRlbyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3ZpZGVvJyk7XG5cbiAgdmlkZW8uYWRkRXZlbnRMaXN0ZW5lcignZW5kZWQnLCBmdW5jdGlvbigpIHtcbiAgICB2aWRlby5wbGF5KCk7XG4gIH0pO1xuXG4gIHRoaXMucmVxdWVzdCA9IGZ1bmN0aW9uKCkge1xuICAgIGlmICh2aWRlby5wYXVzZWQpIHtcbiAgICAgIC8vIEJhc2U2NCB2ZXJzaW9uIG9mIHZpZGVvc19zcmMvbm8tc2xlZXAtMTIwcy5tcDQuXG4gICAgICB2aWRlby5zcmMgPSBVdGlsLmJhc2U2NCgndmlkZW8vbXA0JywgJ0FBQUFHR1owZVhCcGMyOXRBQUFBQUcxd05ERmhkbU14QUFBSUEyMXZiM1lBQUFCc2JYWm9aQUFBQUFEU2E5djYwbXZiK2dBQlg1QUFsdy9nQUFFQUFBRUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFka2RISmhhd0FBQUZ4MGEyaGtBQUFBQWRKcjIvclNhOXY2QUFBQUFRQUFBQUFBbHcvZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBUUFBQUFIQUFBQUFBQUpHVmtkSE1BQUFBY1pXeHpkQUFBQUFBQUFBQUJBSmNQNEFBQUFBQUFBUUFBQUFBRzNHMWthV0VBQUFBZ2JXUm9aQUFBQUFEU2E5djYwbXZiK2dBUFFrQUdqbmVBRmNjQUFBQUFBQzFvWkd4eUFBQUFBQUFBQUFCMmFXUmxBQUFBQUFBQUFBQUFBQUFBVm1sa1pXOUlZVzVrYkdWeUFBQUFCb2R0YVc1bUFBQUFGSFp0YUdRQUFBQUJBQUFBQUFBQUFBQUFBQUFrWkdsdVpnQUFBQnhrY21WbUFBQUFBQUFBQUFFQUFBQU1kWEpzSUFBQUFBRUFBQVpIYzNSaWJBQUFBSmR6ZEhOa0FBQUFBQUFBQUFFQUFBQ0hZWFpqTVFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFNQUJ3QVNBQUFBRWdBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCai8vd0FBQURGaGRtTkRBV1FBQy8vaEFCbG5aQUFMck5sZmxsdzRRQUFBQXdCQUFBQURBS1BGQ21XQUFRQUZhT3Zzc2l3QUFBQVljM1IwY3dBQUFBQUFBQUFCQUFBQWJnQVBRa0FBQUFBVWMzUnpjd0FBQUFBQUFBQUJBQUFBQVFBQUE0QmpkSFJ6QUFBQUFBQUFBRzRBQUFBQkFEMEpBQUFBQUFFQWVoSUFBQUFBQVFBOUNRQUFBQUFCQUFBQUFBQUFBQUVBRDBKQUFBQUFBUUJNUzBBQUFBQUJBQjZFZ0FBQUFBRUFBQUFBQUFBQUFRQVBRa0FBQUFBQkFFeExRQUFBQUFFQUhvU0FBQUFBQVFBQUFBQUFBQUFCQUE5Q1FBQUFBQUVBVEV0QUFBQUFBUUFlaElBQUFBQUJBQUFBQUFBQUFBRUFEMEpBQUFBQUFRQk1TMEFBQUFBQkFCNkVnQUFBQUFFQUFBQUFBQUFBQVFBUFFrQUFBQUFCQUV4TFFBQUFBQUVBSG9TQUFBQUFBUUFBQUFBQUFBQUJBQTlDUUFBQUFBRUFURXRBQUFBQUFRQWVoSUFBQUFBQkFBQUFBQUFBQUFFQUQwSkFBQUFBQVFCTVMwQUFBQUFCQUI2RWdBQUFBQUVBQUFBQUFBQUFBUUFQUWtBQUFBQUJBRXhMUUFBQUFBRUFIb1NBQUFBQUFRQUFBQUFBQUFBQkFBOUNRQUFBQUFFQVRFdEFBQUFBQVFBZWhJQUFBQUFCQUFBQUFBQUFBQUVBRDBKQUFBQUFBUUJNUzBBQUFBQUJBQjZFZ0FBQUFBRUFBQUFBQUFBQUFRQVBRa0FBQUFBQkFFeExRQUFBQUFFQUhvU0FBQUFBQVFBQUFBQUFBQUFCQUE5Q1FBQUFBQUVBVEV0QUFBQUFBUUFlaElBQUFBQUJBQUFBQUFBQUFBRUFEMEpBQUFBQUFRQk1TMEFBQUFBQkFCNkVnQUFBQUFFQUFBQUFBQUFBQVFBUFFrQUFBQUFCQUV4TFFBQUFBQUVBSG9TQUFBQUFBUUFBQUFBQUFBQUJBQTlDUUFBQUFBRUFURXRBQUFBQUFRQWVoSUFBQUFBQkFBQUFBQUFBQUFFQUQwSkFBQUFBQVFCTVMwQUFBQUFCQUI2RWdBQUFBQUVBQUFBQUFBQUFBUUFQUWtBQUFBQUJBRXhMUUFBQUFBRUFIb1NBQUFBQUFRQUFBQUFBQUFBQkFBOUNRQUFBQUFFQVRFdEFBQUFBQVFBZWhJQUFBQUFCQUFBQUFBQUFBQUVBRDBKQUFBQUFBUUJNUzBBQUFBQUJBQjZFZ0FBQUFBRUFBQUFBQUFBQUFRQVBRa0FBQUFBQkFFeExRQUFBQUFFQUhvU0FBQUFBQVFBQUFBQUFBQUFCQUE5Q1FBQUFBQUVBVEV0QUFBQUFBUUFlaElBQUFBQUJBQUFBQUFBQUFBRUFEMEpBQUFBQUFRQk1TMEFBQUFBQkFCNkVnQUFBQUFFQUFBQUFBQUFBQVFBUFFrQUFBQUFCQUV4TFFBQUFBQUVBSG9TQUFBQUFBUUFBQUFBQUFBQUJBQTlDUUFBQUFBRUFURXRBQUFBQUFRQWVoSUFBQUFBQkFBQUFBQUFBQUFFQUQwSkFBQUFBQVFCTVMwQUFBQUFCQUI2RWdBQUFBQUVBQUFBQUFBQUFBUUFQUWtBQUFBQUJBRXhMUUFBQUFBRUFIb1NBQUFBQUFRQUFBQUFBQUFBQkFBOUNRQUFBQUFFQUxjYkFBQUFBSEhOMGMyTUFBQUFBQUFBQUFRQUFBQUVBQUFCdUFBQUFBUUFBQWN4emRITjZBQUFBQUFBQUFBQUFBQUJ1QUFBRENRQUFBQmdBQUFBT0FBQUFEZ0FBQUF3QUFBQVNBQUFBRGdBQUFBd0FBQUFNQUFBQUVnQUFBQTRBQUFBTUFBQUFEQUFBQUJJQUFBQU9BQUFBREFBQUFBd0FBQUFTQUFBQURnQUFBQXdBQUFBTUFBQUFFZ0FBQUE0QUFBQU1BQUFBREFBQUFCSUFBQUFPQUFBQURBQUFBQXdBQUFBU0FBQUFEZ0FBQUF3QUFBQU1BQUFBRWdBQUFBNEFBQUFNQUFBQURBQUFBQklBQUFBT0FBQUFEQUFBQUF3QUFBQVNBQUFBRGdBQUFBd0FBQUFNQUFBQUVnQUFBQTRBQUFBTUFBQUFEQUFBQUJJQUFBQU9BQUFBREFBQUFBd0FBQUFTQUFBQURnQUFBQXdBQUFBTUFBQUFFZ0FBQUE0QUFBQU1BQUFBREFBQUFCSUFBQUFPQUFBQURBQUFBQXdBQUFBU0FBQUFEZ0FBQUF3QUFBQU1BQUFBRWdBQUFBNEFBQUFNQUFBQURBQUFBQklBQUFBT0FBQUFEQUFBQUF3QUFBQVNBQUFBRGdBQUFBd0FBQUFNQUFBQUVnQUFBQTRBQUFBTUFBQUFEQUFBQUJJQUFBQU9BQUFBREFBQUFBd0FBQUFTQUFBQURnQUFBQXdBQUFBTUFBQUFFZ0FBQUE0QUFBQU1BQUFBREFBQUFCSUFBQUFPQUFBQURBQUFBQXdBQUFBU0FBQUFEZ0FBQUF3QUFBQU1BQUFBRWdBQUFBNEFBQUFNQUFBQURBQUFBQk1BQUFBVWMzUmpid0FBQUFBQUFBQUJBQUFJS3dBQUFDdDFaSFJoQUFBQUk2bGxibU1BRndBQWRteGpJREl1TWk0eElITjBjbVZoYlNCdmRYUndkWFFBQUFBSWQybGtaUUFBQ1JSdFpHRjBBQUFDcmdYLy82dmNSZW05NXRsSXQ1WXMyQ0RaSSs3dmVESTJOQ0F0SUdOdmNtVWdNVFF5SUMwZ1NDNHlOalF2VFZCRlJ5MDBJRUZXUXlCamIyUmxZeUF0SUVOdmNIbHNaV1owSURJd01ETXRNakF4TkNBdElHaDBkSEE2THk5M2QzY3VkbWxrWlc5c1lXNHViM0puTDNneU5qUXVhSFJ0YkNBdElHOXdkR2x2Ym5NNklHTmhZbUZqUFRFZ2NtVm1QVE1nWkdWaWJHOWphejB4T2pBNk1DQmhibUZzZVhObFBUQjRNem93ZURFeklHMWxQV2hsZUNCemRXSnRaVDAzSUhCemVUMHhJSEJ6ZVY5eVpEMHhMakF3T2pBdU1EQWdiV2w0WldSZmNtVm1QVEVnYldWZmNtRnVaMlU5TVRZZ1kyaHliMjFoWDIxbFBURWdkSEpsYkd4cGN6MHhJRGg0T0dSamREMHhJR054YlQwd0lHUmxZV1I2YjI1bFBUSXhMREV4SUdaaGMzUmZjSE5yYVhBOU1TQmphSEp2YldGZmNYQmZiMlptYzJWMFBTMHlJSFJvY21WaFpITTlNVElnYkc5dmEyRm9aV0ZrWDNSb2NtVmhaSE05TVNCemJHbGpaV1JmZEdoeVpXRmtjejB3SUc1eVBUQWdaR1ZqYVcxaGRHVTlNU0JwYm5SbGNteGhZMlZrUFRBZ1lteDFjbUY1WDJOdmJYQmhkRDB3SUdOdmJuTjBjbUZwYm1Wa1gybHVkSEpoUFRBZ1ltWnlZVzFsY3oweklHSmZjSGx5WVcxcFpEMHlJR0pmWVdSaGNIUTlNU0JpWDJKcFlYTTlNQ0JrYVhKbFkzUTlNU0IzWldsbmFIUmlQVEVnYjNCbGJsOW5iM0E5TUNCM1pXbG5hSFJ3UFRJZ2EyVjVhVzUwUFRJMU1DQnJaWGxwYm5SZmJXbHVQVEVnYzJObGJtVmpkWFE5TkRBZ2FXNTBjbUZmY21WbWNtVnphRDB3SUhKalgyeHZiMnRoYUdWaFpEMDBNQ0J5WXoxaFluSWdiV0owY21WbFBURWdZbWwwY21GMFpUMHhNREFnY21GMFpYUnZiRDB4TGpBZ2NXTnZiWEE5TUM0Mk1DQnhjRzFwYmoweE1DQnhjRzFoZUQwMU1TQnhjSE4wWlhBOU5DQnBjRjl5WVhScGJ6MHhMalF3SUdGeFBURTZNUzR3TUFDQUFBQUFVMldJaEFBUS84bHRsT2UrY1RadUdrS2crYVJ0dWl2Y0RaMHBCc2ZzRWk5cC9pMXlVOUR4UzJscTRkWFRpblZpRjFVUkJLWGduektCZC9VaDFia2hIdE1yd3JSY09Kc2xEMDFVQitmeWFMNmVmK0RCQUFBQUZFR2FKR3hCRDVCK3YrYSs0UXFGM01nQlh6OU1BQUFBQ2tHZVFuaUgvKzk0cjZFQUFBQUtBWjVoZEVOLzhReXR3QUFBQUFnQm5tTnFRMy9FZ1FBQUFBNUJtbWhKcUVGb21Vd0lJZi8rNFFBQUFBcEJub1pGRVN3Ly83NkJBQUFBQ0FHZXBYUkRmOFNCQUFBQUNBR2VwMnBEZjhTQUFBQUFEa0dhckVtb1FXeVpUQWdoLy83Z0FBQUFDa0dleWtVVkxELy92b0VBQUFBSUFaN3BkRU4veElBQUFBQUlBWjdyYWtOL3hJQUFBQUFPUVpyd1NhaEJiSmxNQ0NILy91RUFBQUFLUVo4T1JSVXNQLysrZ1FBQUFBZ0JueTEwUTMvRWdRQUFBQWdCbnk5cVEzL0VnQUFBQUE1Qm16UkpxRUZzbVV3SUlmLys0QUFBQUFwQm4xSkZGU3cvLzc2QkFBQUFDQUdmY1hSRGY4U0FBQUFBQ0FHZmMycERmOFNBQUFBQURrR2JlRW1vUVd5WlRBZ2gvLzdoQUFBQUNrR2Zsa1VWTEQvL3ZvQUFBQUFJQVorMWRFTi94SUVBQUFBSUFaKzNha04veElFQUFBQU9RWnU4U2FoQmJKbE1DQ0gvL3VBQUFBQUtRWi9hUlJVc1AvKytnUUFBQUFnQm4vbDBRMy9FZ0FBQUFBZ0JuL3RxUTMvRWdRQUFBQTVCbStCSnFFRnNtVXdJSWYvKzRRQUFBQXBCbmg1RkZTdy8vNzZBQUFBQUNBR2VQWFJEZjhTQUFBQUFDQUdlUDJwRGY4U0JBQUFBRGtHYUpFbW9RV3laVEFnaC8vN2dBQUFBQ2tHZVFrVVZMRC8vdm9FQUFBQUlBWjVoZEVOL3hJQUFBQUFJQVo1amFrTi94SUVBQUFBT1FacG9TYWhCYkpsTUNDSC8vdUVBQUFBS1FaNkdSUlVzUC8rK2dRQUFBQWdCbnFWMFEzL0VnUUFBQUFnQm5xZHFRMy9FZ0FBQUFBNUJtcXhKcUVGc21Vd0lJZi8rNEFBQUFBcEJuc3BGRlN3Ly83NkJBQUFBQ0FHZTZYUkRmOFNBQUFBQUNBR2U2MnBEZjhTQUFBQUFEa0dhOEVtb1FXeVpUQWdoLy83aEFBQUFDa0dmRGtVVkxELy92b0VBQUFBSUFaOHRkRU4veElFQUFBQUlBWjh2YWtOL3hJQUFBQUFPUVpzMFNhaEJiSmxNQ0NILy91QUFBQUFLUVo5U1JSVXNQLysrZ1FBQUFBZ0JuM0YwUTMvRWdBQUFBQWdCbjNOcVEzL0VnQUFBQUE1Qm0zaEpxRUZzbVV3SUlmLys0UUFBQUFwQm41WkZGU3cvLzc2QUFBQUFDQUdmdFhSRGY4U0JBQUFBQ0FHZnQycERmOFNCQUFBQURrR2J2RW1vUVd5WlRBZ2gvLzdnQUFBQUNrR2Yya1VWTEQvL3ZvRUFBQUFJQVovNWRFTi94SUFBQUFBSUFaLzdha04veElFQUFBQU9RWnZnU2FoQmJKbE1DQ0gvL3VFQUFBQUtRWjRlUlJVc1AvKytnQUFBQUFnQm5qMTBRMy9FZ0FBQUFBZ0JuajlxUTMvRWdRQUFBQTVCbWlSSnFFRnNtVXdJSWYvKzRBQUFBQXBCbmtKRkZTdy8vNzZCQUFBQUNBR2VZWFJEZjhTQUFBQUFDQUdlWTJwRGY4U0JBQUFBRGtHYWFFbW9RV3laVEFnaC8vN2hBQUFBQ2tHZWhrVVZMRC8vdm9FQUFBQUlBWjZsZEVOL3hJRUFBQUFJQVo2bmFrTi94SUFBQUFBT1FacXNTYWhCYkpsTUNDSC8vdUFBQUFBS1FaN0tSUlVzUC8rK2dRQUFBQWdCbnVsMFEzL0VnQUFBQUFnQm51dHFRMy9FZ0FBQUFBNUJtdkJKcUVGc21Vd0lJZi8rNFFBQUFBcEJudzVGRlN3Ly83NkJBQUFBQ0FHZkxYUkRmOFNCQUFBQUNBR2ZMMnBEZjhTQUFBQUFEa0diTkVtb1FXeVpUQWdoLy83Z0FBQUFDa0dmVWtVVkxELy92b0VBQUFBSUFaOXhkRU4veElBQUFBQUlBWjl6YWtOL3hJQUFBQUFPUVp0NFNhaEJiSmxNQ0NILy91RUFBQUFLUVorV1JSVXNQLysrZ0FBQUFBZ0JuN1YwUTMvRWdRQUFBQWdCbjdkcVEzL0VnUUFBQUE1Qm03eEpxRUZzbVV3SUlmLys0QUFBQUFwQm45cEZGU3cvLzc2QkFBQUFDQUdmK1hSRGY4U0FBQUFBQ0FHZisycERmOFNCQUFBQURrR2I0RW1vUVd5WlRBZ2gvLzdoQUFBQUNrR2VIa1VWTEQvL3ZvQUFBQUFJQVo0OWRFTi94SUFBQUFBSUFaNC9ha04veElFQUFBQU9RWm9rU2FoQmJKbE1DQ0gvL3VBQUFBQUtRWjVDUlJVc1AvKytnUUFBQUFnQm5tRjBRMy9FZ0FBQUFBZ0JubU5xUTMvRWdRQUFBQTVCbW1oSnFFRnNtVXdJSWYvKzRRQUFBQXBCbm9aRkZTdy8vNzZCQUFBQUNBR2VwWFJEZjhTQkFBQUFDQUdlcDJwRGY4U0FBQUFBRGtHYXJFbW9RV3laVEFnaC8vN2dBQUFBQ2tHZXlrVVZMRC8vdm9FQUFBQUlBWjdwZEVOL3hJQUFBQUFJQVo3cmFrTi94SUFBQUFBUFFacnVTYWhCYkpsTUZFdzMvLzdCJyk7XG4gICAgICB2aWRlby5wbGF5KCk7XG4gICAgfVxuICB9O1xuXG4gIHRoaXMucmVsZWFzZSA9IGZ1bmN0aW9uKCkge1xuICAgIHZpZGVvLnBhdXNlKCk7XG4gICAgdmlkZW8uc3JjID0gJyc7XG4gIH07XG59XG5cbmZ1bmN0aW9uIGlPU1dha2VMb2NrKCkge1xuICB2YXIgdGltZXIgPSBudWxsO1xuXG4gIHRoaXMucmVxdWVzdCA9IGZ1bmN0aW9uKCkge1xuICAgIGlmICghdGltZXIpIHtcbiAgICAgIHRpbWVyID0gc2V0SW50ZXJ2YWwoZnVuY3Rpb24oKSB7XG4gICAgICAgIHdpbmRvdy5sb2NhdGlvbiA9IHdpbmRvdy5sb2NhdGlvbjtcbiAgICAgICAgc2V0VGltZW91dCh3aW5kb3cuc3RvcCwgMCk7XG4gICAgICB9LCAzMDAwMCk7XG4gICAgfVxuICB9XG5cbiAgdGhpcy5yZWxlYXNlID0gZnVuY3Rpb24oKSB7XG4gICAgaWYgKHRpbWVyKSB7XG4gICAgICBjbGVhckludGVydmFsKHRpbWVyKTtcbiAgICAgIHRpbWVyID0gbnVsbDtcbiAgICB9XG4gIH1cbn1cblxuXG5mdW5jdGlvbiBnZXRXYWtlTG9jaygpIHtcbiAgdmFyIHVzZXJBZ2VudCA9IG5hdmlnYXRvci51c2VyQWdlbnQgfHwgbmF2aWdhdG9yLnZlbmRvciB8fCB3aW5kb3cub3BlcmE7XG4gIGlmICh1c2VyQWdlbnQubWF0Y2goL2lQaG9uZS9pKSB8fCB1c2VyQWdlbnQubWF0Y2goL2lQb2QvaSkpIHtcbiAgICByZXR1cm4gaU9TV2FrZUxvY2s7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIEFuZHJvaWRXYWtlTG9jaztcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGdldFdha2VMb2NrKCk7IiwiLypcbiAqIENvcHlyaWdodCAyMDE1IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xuICogeW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuICogWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG4gKlxuICogICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuICpcbiAqIFVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbiAqIGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbiAqIFdJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuICogU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxuICogbGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG4gKi9cblxudmFyIFV0aWwgPSByZXF1aXJlKCcuL3V0aWwuanMnKTtcbnZhciBDYXJkYm9hcmRWUkRpc3BsYXkgPSByZXF1aXJlKCcuL2NhcmRib2FyZC12ci1kaXNwbGF5LmpzJyk7XG52YXIgTW91c2VLZXlib2FyZFZSRGlzcGxheSA9IHJlcXVpcmUoJy4vbW91c2Uta2V5Ym9hcmQtdnItZGlzcGxheS5qcycpO1xuLy8gVW5jb21tZW50IHRvIGFkZCBwb3NpdGlvbmFsIHRyYWNraW5nIHZpYSB3ZWJjYW0uXG4vL3ZhciBXZWJjYW1Qb3NpdGlvblNlbnNvclZSRGV2aWNlID0gcmVxdWlyZSgnLi93ZWJjYW0tcG9zaXRpb24tc2Vuc29yLXZyLWRldmljZS5qcycpO1xudmFyIFZSRGlzcGxheSA9IHJlcXVpcmUoJy4vYmFzZS5qcycpLlZSRGlzcGxheTtcbnZhciBWUkZyYW1lRGF0YSA9IHJlcXVpcmUoJy4vYmFzZS5qcycpLlZSRnJhbWVEYXRhO1xudmFyIEhNRFZSRGV2aWNlID0gcmVxdWlyZSgnLi9iYXNlLmpzJykuSE1EVlJEZXZpY2U7XG52YXIgUG9zaXRpb25TZW5zb3JWUkRldmljZSA9IHJlcXVpcmUoJy4vYmFzZS5qcycpLlBvc2l0aW9uU2Vuc29yVlJEZXZpY2U7XG52YXIgVlJEaXNwbGF5SE1ERGV2aWNlID0gcmVxdWlyZSgnLi9kaXNwbGF5LXdyYXBwZXJzLmpzJykuVlJEaXNwbGF5SE1ERGV2aWNlO1xudmFyIFZSRGlzcGxheVBvc2l0aW9uU2Vuc29yRGV2aWNlID0gcmVxdWlyZSgnLi9kaXNwbGF5LXdyYXBwZXJzLmpzJykuVlJEaXNwbGF5UG9zaXRpb25TZW5zb3JEZXZpY2U7XG5cbmZ1bmN0aW9uIFdlYlZSUG9seWZpbGwoKSB7XG4gIHRoaXMuZGlzcGxheXMgPSBbXTtcbiAgdGhpcy5kZXZpY2VzID0gW107IC8vIEZvciBkZXByZWNhdGVkIG9iamVjdHNcbiAgdGhpcy5kZXZpY2VzUG9wdWxhdGVkID0gZmFsc2U7XG4gIHRoaXMubmF0aXZlV2ViVlJBdmFpbGFibGUgPSB0aGlzLmlzV2ViVlJBdmFpbGFibGUoKTtcbiAgdGhpcy5uYXRpdmVMZWdhY3lXZWJWUkF2YWlsYWJsZSA9IHRoaXMuaXNEZXByZWNhdGVkV2ViVlJBdmFpbGFibGUoKTtcblxuICBpZiAoIXRoaXMubmF0aXZlTGVnYWN5V2ViVlJBdmFpbGFibGUpIHtcbiAgICBpZiAoIXRoaXMubmF0aXZlV2ViVlJBdmFpbGFibGUpIHtcbiAgICAgIHRoaXMuZW5hYmxlUG9seWZpbGwoKTtcbiAgICB9XG4gICAgaWYgKFdlYlZSQ29uZmlnLkVOQUJMRV9ERVBSRUNBVEVEX0FQSSkge1xuICAgICAgdGhpcy5lbmFibGVEZXByZWNhdGVkUG9seWZpbGwoKTtcbiAgICB9XG4gIH1cblxuICAvLyBQdXQgYSBzaGltIGluIHBsYWNlIHRvIHVwZGF0ZSB0aGUgQVBJIHRvIDEuMSBpZiBuZWVkZWQuXG4gIEluc3RhbGxXZWJWUlNwZWNTaGltKCk7XG59XG5cbldlYlZSUG9seWZpbGwucHJvdG90eXBlLmlzV2ViVlJBdmFpbGFibGUgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuICgnZ2V0VlJEaXNwbGF5cycgaW4gbmF2aWdhdG9yKTtcbn07XG5cbldlYlZSUG9seWZpbGwucHJvdG90eXBlLmlzRGVwcmVjYXRlZFdlYlZSQXZhaWxhYmxlID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiAoJ2dldFZSRGV2aWNlcycgaW4gbmF2aWdhdG9yKSB8fCAoJ21vekdldFZSRGV2aWNlcycgaW4gbmF2aWdhdG9yKTtcbn07XG5cbldlYlZSUG9seWZpbGwucHJvdG90eXBlLnBvcHVsYXRlRGV2aWNlcyA9IGZ1bmN0aW9uKCkge1xuICBpZiAodGhpcy5kZXZpY2VzUG9wdWxhdGVkKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgLy8gSW5pdGlhbGl6ZSBvdXIgdmlydHVhbCBWUiBkZXZpY2VzLlxuICB2YXIgdnJEaXNwbGF5ID0gbnVsbDtcblxuICAvLyBBZGQgYSBDYXJkYm9hcmQgVlJEaXNwbGF5IG9uIGNvbXBhdGlibGUgbW9iaWxlIGRldmljZXNcbiAgaWYgKHRoaXMuaXNDYXJkYm9hcmRDb21wYXRpYmxlKCkpIHtcbiAgICB2ckRpc3BsYXkgPSBuZXcgQ2FyZGJvYXJkVlJEaXNwbGF5KCk7XG4gICAgdGhpcy5kaXNwbGF5cy5wdXNoKHZyRGlzcGxheSk7XG5cbiAgICAvLyBGb3IgYmFja3dhcmRzIGNvbXBhdGliaWxpdHlcbiAgICBpZiAoV2ViVlJDb25maWcuRU5BQkxFX0RFUFJFQ0FURURfQVBJKSB7XG4gICAgICB0aGlzLmRldmljZXMucHVzaChuZXcgVlJEaXNwbGF5SE1ERGV2aWNlKHZyRGlzcGxheSkpO1xuICAgICAgdGhpcy5kZXZpY2VzLnB1c2gobmV3IFZSRGlzcGxheVBvc2l0aW9uU2Vuc29yRGV2aWNlKHZyRGlzcGxheSkpO1xuICAgIH1cbiAgfVxuXG4gIC8vIEFkZCBhIE1vdXNlIGFuZCBLZXlib2FyZCBkcml2ZW4gVlJEaXNwbGF5IGZvciBkZXNrdG9wcy9sYXB0b3BzXG4gIGlmICghdGhpcy5pc01vYmlsZSgpICYmICFXZWJWUkNvbmZpZy5NT1VTRV9LRVlCT0FSRF9DT05UUk9MU19ESVNBQkxFRCkge1xuICAgIHZyRGlzcGxheSA9IG5ldyBNb3VzZUtleWJvYXJkVlJEaXNwbGF5KCk7XG4gICAgdGhpcy5kaXNwbGF5cy5wdXNoKHZyRGlzcGxheSk7XG5cbiAgICAvLyBGb3IgYmFja3dhcmRzIGNvbXBhdGliaWxpdHlcbiAgICBpZiAoV2ViVlJDb25maWcuRU5BQkxFX0RFUFJFQ0FURURfQVBJKSB7XG4gICAgICB0aGlzLmRldmljZXMucHVzaChuZXcgVlJEaXNwbGF5SE1ERGV2aWNlKHZyRGlzcGxheSkpO1xuICAgICAgdGhpcy5kZXZpY2VzLnB1c2gobmV3IFZSRGlzcGxheVBvc2l0aW9uU2Vuc29yRGV2aWNlKHZyRGlzcGxheSkpO1xuICAgIH1cbiAgfVxuXG4gIC8vIFVuY29tbWVudCB0byBhZGQgcG9zaXRpb25hbCB0cmFja2luZyB2aWEgd2ViY2FtLlxuICAvL2lmICghdGhpcy5pc01vYmlsZSgpICYmIFdlYlZSQ29uZmlnLkVOQUJMRV9ERVBSRUNBVEVEX0FQSSkge1xuICAvLyAgcG9zaXRpb25EZXZpY2UgPSBuZXcgV2ViY2FtUG9zaXRpb25TZW5zb3JWUkRldmljZSgpO1xuICAvLyAgdGhpcy5kZXZpY2VzLnB1c2gocG9zaXRpb25EZXZpY2UpO1xuICAvL31cblxuICB0aGlzLmRldmljZXNQb3B1bGF0ZWQgPSB0cnVlO1xufTtcblxuV2ViVlJQb2x5ZmlsbC5wcm90b3R5cGUuZW5hYmxlUG9seWZpbGwgPSBmdW5jdGlvbigpIHtcbiAgLy8gUHJvdmlkZSBuYXZpZ2F0b3IuZ2V0VlJEaXNwbGF5cy5cbiAgbmF2aWdhdG9yLmdldFZSRGlzcGxheXMgPSB0aGlzLmdldFZSRGlzcGxheXMuYmluZCh0aGlzKTtcblxuICAvLyBQcm92aWRlIHRoZSBWUkRpc3BsYXkgb2JqZWN0LlxuICB3aW5kb3cuVlJEaXNwbGF5ID0gVlJEaXNwbGF5O1xuXG4gIC8vIFByb3ZpZGUgbmF2aWdhdG9yLnZyRW5hYmxlZC5cbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBPYmplY3QuZGVmaW5lUHJvcGVydHkobmF2aWdhdG9yLCAndnJFbmFibGVkJywge1xuICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgcmV0dXJuIHNlbGYuaXNDYXJkYm9hcmRDb21wYXRpYmxlKCkgJiZcbiAgICAgICAgKGRvY3VtZW50LmZ1bGxzY3JlZW5FbmFibGVkIHx8XG4gICAgICAgICAgZG9jdW1lbnQubW96RnVsbFNjcmVlbkVuYWJsZWQgfHxcbiAgICAgICAgICBkb2N1bWVudC53ZWJraXRGdWxsc2NyZWVuRW5hYmxlZCB8fFxuICAgICAgICAgIGZhbHNlKTtcbiAgICB9XG4gIH0pO1xuXG4gIC8vIFByb3ZpZGUgdGhlIFZSRnJhbWVEYXRhIG9iamVjdC5cbiAgd2luZG93LlZSRnJhbWVEYXRhID0gVlJGcmFtZURhdGE7XG59O1xuXG5XZWJWUlBvbHlmaWxsLnByb3RvdHlwZS5lbmFibGVEZXByZWNhdGVkUG9seWZpbGwgPSBmdW5jdGlvbigpIHtcbiAgLy8gUHJvdmlkZSBuYXZpZ2F0b3IuZ2V0VlJEZXZpY2VzLlxuICBuYXZpZ2F0b3IuZ2V0VlJEZXZpY2VzID0gdGhpcy5nZXRWUkRldmljZXMuYmluZCh0aGlzKTtcblxuICAvLyBQcm92aWRlIHRoZSBDYXJkYm9hcmRITURWUkRldmljZSBhbmQgUG9zaXRpb25TZW5zb3JWUkRldmljZSBvYmplY3RzLlxuICB3aW5kb3cuSE1EVlJEZXZpY2UgPSBITURWUkRldmljZTtcbiAgd2luZG93LlBvc2l0aW9uU2Vuc29yVlJEZXZpY2UgPSBQb3NpdGlvblNlbnNvclZSRGV2aWNlO1xufTtcblxuV2ViVlJQb2x5ZmlsbC5wcm90b3R5cGUuZ2V0VlJEaXNwbGF5cyA9IGZ1bmN0aW9uKCkge1xuICB0aGlzLnBvcHVsYXRlRGV2aWNlcygpO1xuICB2YXIgZGlzcGxheXMgPSB0aGlzLmRpc3BsYXlzO1xuICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgdHJ5IHtcbiAgICAgIHJlc29sdmUoZGlzcGxheXMpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHJlamVjdChlKTtcbiAgICB9XG4gIH0pO1xufTtcblxuV2ViVlJQb2x5ZmlsbC5wcm90b3R5cGUuZ2V0VlJEZXZpY2VzID0gZnVuY3Rpb24oKSB7XG4gIGNvbnNvbGUud2FybignZ2V0VlJEZXZpY2VzIGlzIGRlcHJlY2F0ZWQuIFBsZWFzZSB1cGRhdGUgeW91ciBjb2RlIHRvIHVzZSBnZXRWUkRpc3BsYXlzIGluc3RlYWQuJyk7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgIHRyeSB7XG4gICAgICBpZiAoIXNlbGYuZGV2aWNlc1BvcHVsYXRlZCkge1xuICAgICAgICBpZiAoc2VsZi5uYXRpdmVXZWJWUkF2YWlsYWJsZSkge1xuICAgICAgICAgIHJldHVybiBuYXZpZ2F0b3IuZ2V0VlJEaXNwbGF5cyhmdW5jdGlvbihkaXNwbGF5cykge1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBkaXNwbGF5cy5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAgICBzZWxmLmRldmljZXMucHVzaChuZXcgVlJEaXNwbGF5SE1ERGV2aWNlKGRpc3BsYXlzW2ldKSk7XG4gICAgICAgICAgICAgIHNlbGYuZGV2aWNlcy5wdXNoKG5ldyBWUkRpc3BsYXlQb3NpdGlvblNlbnNvckRldmljZShkaXNwbGF5c1tpXSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgc2VsZi5kZXZpY2VzUG9wdWxhdGVkID0gdHJ1ZTtcbiAgICAgICAgICAgIHJlc29sdmUoc2VsZi5kZXZpY2VzKTtcbiAgICAgICAgICB9LCByZWplY3QpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHNlbGYubmF0aXZlTGVnYWN5V2ViVlJBdmFpbGFibGUpIHtcbiAgICAgICAgICByZXR1cm4gKG5hdmlnYXRvci5nZXRWUkREZXZpY2VzIHx8IG5hdmlnYXRvci5tb3pHZXRWUkRldmljZXMpKGZ1bmN0aW9uKGRldmljZXMpIHtcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZGV2aWNlcy5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAgICBpZiAoZGV2aWNlc1tpXSBpbnN0YW5jZW9mIEhNRFZSRGV2aWNlKSB7XG4gICAgICAgICAgICAgICAgc2VsZi5kZXZpY2VzLnB1c2goZGV2aWNlc1tpXSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaWYgKGRldmljZXNbaV0gaW5zdGFuY2VvZiBQb3NpdGlvblNlbnNvclZSRGV2aWNlKSB7XG4gICAgICAgICAgICAgICAgc2VsZi5kZXZpY2VzLnB1c2goZGV2aWNlc1tpXSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHNlbGYuZGV2aWNlc1BvcHVsYXRlZCA9IHRydWU7XG4gICAgICAgICAgICByZXNvbHZlKHNlbGYuZGV2aWNlcyk7XG4gICAgICAgICAgfSwgcmVqZWN0KTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBzZWxmLnBvcHVsYXRlRGV2aWNlcygpO1xuICAgICAgcmVzb2x2ZShzZWxmLmRldmljZXMpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHJlamVjdChlKTtcbiAgICB9XG4gIH0pO1xufTtcblxuLyoqXG4gKiBEZXRlcm1pbmUgaWYgYSBkZXZpY2UgaXMgbW9iaWxlLlxuICovXG5XZWJWUlBvbHlmaWxsLnByb3RvdHlwZS5pc01vYmlsZSA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gL0FuZHJvaWQvaS50ZXN0KG5hdmlnYXRvci51c2VyQWdlbnQpIHx8XG4gICAgICAvaVBob25lfGlQYWR8aVBvZC9pLnRlc3QobmF2aWdhdG9yLnVzZXJBZ2VudCk7XG59O1xuXG5XZWJWUlBvbHlmaWxsLnByb3RvdHlwZS5pc0NhcmRib2FyZENvbXBhdGlibGUgPSBmdW5jdGlvbigpIHtcbiAgLy8gRm9yIG5vdywgc3VwcG9ydCBhbGwgaU9TIGFuZCBBbmRyb2lkIGRldmljZXMuXG4gIC8vIEFsc28gZW5hYmxlIHRoZSBXZWJWUkNvbmZpZy5GT1JDRV9WUiBmbGFnIGZvciBkZWJ1Z2dpbmcuXG4gIHJldHVybiB0aGlzLmlzTW9iaWxlKCkgfHwgV2ViVlJDb25maWcuRk9SQ0VfRU5BQkxFX1ZSO1xufTtcblxuLy8gSW5zdGFsbHMgYSBzaGltIHRoYXQgdXBkYXRlcyBhIFdlYlZSIDEuMCBzcGVjIGltcGxlbWVudGF0aW9uIHRvIFdlYlZSIDEuMVxuZnVuY3Rpb24gSW5zdGFsbFdlYlZSU3BlY1NoaW0oKSB7XG4gIGlmICgnVlJEaXNwbGF5JyBpbiB3aW5kb3cgJiYgISgnVlJGcmFtZURhdGEnIGluIHdpbmRvdykpIHtcbiAgICAvLyBQcm92aWRlIHRoZSBWUkZyYW1lRGF0YSBvYmplY3QuXG4gICAgd2luZG93LlZSRnJhbWVEYXRhID0gVlJGcmFtZURhdGE7XG5cbiAgICAvLyBBIGxvdCBvZiBDaHJvbWUgYnVpbGRzIGRvbid0IGhhdmUgZGVwdGhOZWFyIGFuZCBkZXB0aEZhciwgZXZlblxuICAgIC8vIHRob3VnaCB0aGV5J3JlIGluIHRoZSBXZWJWUiAxLjAgc3BlYy4gUGF0Y2ggdGhlbSBpbiBpZiB0aGV5J3JlIG5vdCBwcmVzZW50LlxuICAgIGlmKCEoJ2RlcHRoTmVhcicgaW4gd2luZG93LlZSRGlzcGxheS5wcm90b3R5cGUpKSB7XG4gICAgICB3aW5kb3cuVlJEaXNwbGF5LnByb3RvdHlwZS5kZXB0aE5lYXIgPSAwLjAxO1xuICAgIH1cblxuICAgIGlmKCEoJ2RlcHRoRmFyJyBpbiB3aW5kb3cuVlJEaXNwbGF5LnByb3RvdHlwZSkpIHtcbiAgICAgIHdpbmRvdy5WUkRpc3BsYXkucHJvdG90eXBlLmRlcHRoRmFyID0gMTAwMDAuMDtcbiAgICB9XG5cbiAgICB3aW5kb3cuVlJEaXNwbGF5LnByb3RvdHlwZS5nZXRGcmFtZURhdGEgPSBmdW5jdGlvbihmcmFtZURhdGEpIHtcbiAgICAgIHJldHVybiBVdGlsLmZyYW1lRGF0YUZyb21Qb3NlKGZyYW1lRGF0YSwgdGhpcy5nZXRQb3NlKCksIHRoaXMpO1xuICAgIH1cbiAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMuV2ViVlJQb2x5ZmlsbCA9IFdlYlZSUG9seWZpbGw7XG4iXX0=

}());

