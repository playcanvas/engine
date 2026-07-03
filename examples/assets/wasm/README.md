This directory contains a set of precompiled WebAssembly modules which can optionally be used with the Playcanvas engine.

The modules are as follows:

ammo.js
-------
Direct port of the Bullet physics engine to JavaScript using Emscripten.
https://github.com/kripken/ammo.js


basis.js
--------
Basis Universal GPU Texture Codec.
https://github.com/BinomialLLC/basis_universal


zstd
----
ZSTD (Zstandard) decompressor, used by the SPZ gaussian splat parser. The wasm binary is the
single-file zstd decoder (zstddeclib) from https://github.com/facebook/zstd (BSD-3-Clause),
compiled to WebAssembly by https://github.com/donmccurdy/zstddec (MIT). The glue script
(zstd.wasm.js) is a hand-written wrapper conforming to the pc.WasmModule contract.