# PlayCanvas Engine Scripts

A collection of ready-to-use [`Script`](https://api.playcanvas.com/engine/classes/Script.html) classes for the PlayCanvas Engine, maintained and versioned alongside it, that attach to entities via the script component.

These scripts ship inside the `playcanvas` npm package but are **not** part of the core engine bundle — each one is imported directly from its module:

```javascript
import { Vec3 } from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';

entity.addComponent('script');
entity.script.create(CameraControls, {
    properties: {
        focusPoint: new Vec3(0, 1, 0)
    }
});
```

Script attributes (documented on each class) can be passed via `properties` as above, or edited in the PlayCanvas Editor.

## What's included

- **Camera and character controllers** — orbit/fly/pan camera controls, first and third person controllers.
- **Rendering helpers** — post-processing via camera frame, planar reflections, shadow catcher, reference grid, procedural sky.
- **Gaussian splatting** — streamed splat loading with LOD presets, reveal animations, shader effects, weather, text and image splats.
- **XR** — session lifecycle, controllers, teleport navigation, object manipulation and 3D menus.
- **Annotations** — 3D hotspots with DOM labels.

## Resources

- [Engine API Reference](https://api.playcanvas.com/engine/)
- [Engine Examples](https://playcanvas.github.io/) — many examples use these scripts
- [Scripting User Manual](https://developer.playcanvas.com/user-manual/scripting/)
