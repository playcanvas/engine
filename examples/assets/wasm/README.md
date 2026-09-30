This directory contains a set of precompiled WebAssembly modules which can optionally be used with the Playcanvas engine.

The modules are as follows:

ammo.js
-------
Direct port of the Bullet physics engine to JavaScript using Emscripten.
https://github.com/kripken/ammo.js

The shipped build is kripken/ammo.js commit c8779e6 (PR #449, merged 2026-09-22), built with
emsdk 3.1.35 and CLOSURE=1. It starts with a 16MB heap that grows on demand instead of a fixed 64MB heap, so it
instantiates on low-end devices and no longer aborts when a large scene needs more memory. It
includes the btScaledBvhTriangleMeshShape binding (PR #448) that mesh colliders need to follow
entity scale.


jolt
----
JoltPhysics.js, the WebAssembly port of the Jolt Physics engine (MIT, see jolt/LICENSE), used
by JoltPhysicsWorld.
https://github.com/jrouwe/JoltPhysics.js

The shipped build is the single-threaded `wasm` flavor of the jolt-physics 1.1.0 npm package
(published 2026-07-11), copied unmodified: the ES module glue jolt-physics.wasm.js and the binary
jolt-physics.wasm.wasm, which the glue loads from beside itself. The build uses single precision
and has a fixed 128MB heap that does not grow.


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
