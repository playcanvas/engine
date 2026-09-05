This directory contains a set of precompiled WebAssembly modules which can optionally be used with the Playcanvas engine.

The modules are as follows:

ammo.js
-------
Direct port of the Bullet physics engine to JavaScript using Emscripten.
https://github.com/kripken/ammo.js

The shipped build adds the btScaledBvhTriangleMeshShape binding from
https://github.com/kripken/ammo.js/pull/448 (branch willeastcott/ammo.js@fa7502f, built with
emsdk 3.1.35 and CLOSURE=1). Mesh colliders need it to follow entity scale.


basis.js
--------
Basis Universal GPU Texture Codec.
https://github.com/BinomialLLC/basis_universal


zstd
----
ZSTD (Zstandard) decompressor, used by the SPZ gaussian splat parser. The wasm binary is the
single-file zstd decoder (zstddeclib) from https://github.com/facebook/zstd (BSD-3-Clause),
compiled to WebAssembly by https://github.com/donmccurdy/zstddec (MIT). The glue script
(zstd.wasm.js) is a hand-written wrapper conforming to the WasmModule contract.
