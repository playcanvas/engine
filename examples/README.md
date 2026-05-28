![PlayCanvas](http://static.playcanvas.com/images/logo/Playcanvas_LOGOSET_SMALL-06.png)

# Examples

A selection of simple examples to get you up and running

See them <a href="https://playcanvas.github.io/">running live</a>

## Local examples browser development
This section covers how to locally develop the examples browser application. For information on how to develop individual examples please see the following section.

Ensure you have Node.js installed. Then, install all of the required Node.js dependencies:
```
npm install
```
Now run the following command:
```
npm run dev
```
Visit the url mentioned in your terminal to view the examples browser.

To run without automatic browser and example reloads:
```
npm run develop
```

You can also run the examples browser with a specific version of the engine by running the following command:

```
ENGINE_PATH=../build/playcanvas.mjs npm run dev
```

Where `../build/playcanvas.mjs` is the path to the ESM version of the engine.

Or directly from the source:

```
ENGINE_PATH=../src/index.js npm run dev
```

The dev server binds to `0.0.0.0:5555` by default. Use `EXAMPLES_HOST` or
`EXAMPLES_PORT` to override those values.

## HTTPS dev for mobile / XR device testing

`npm run dev` serves the examples browser over plain HTTP on `localhost`,
which is enough for everyday work — browsers treat `localhost` as a secure
context, so WebGPU and WebXR features that require one still work.

For testing on a phone, tablet, Quest, or Apple Vision Pro you need to reach
the dev server over the LAN, and the device will require HTTPS for WebXR (and
exposes WebGPU only in a secure context). This is what `npm run dev:https` is
for. Use `npm run develop:https` when automatic reloads should be disabled.
Certs are generated locally with [mkcert](https://github.com/FiloSottile/mkcert);
none are committed to the repo.

### One-time setup

1. **Install mkcert:**
   - macOS: `brew install mkcert nss` (`nss` only needed if Firefox testing)
   - Windows: `choco install mkcert` (or `scoop install mkcert`)
   - Linux: see [mkcert install docs](https://github.com/FiloSottile/mkcert#installation)
2. **Trust the local root CA on this machine** — run once, ever:
   ```
   mkcert -install
   ```
   This writes mkcert's root CA into the OS trust store (macOS Keychain,
   Windows certificate store, Linux NSS). Existing certs become trusted by
   Safari, Chrome, etc. automatically.
3. **Generate dev certs** (rerun whenever your machine's `.local` hostname
   changes, or if you delete the `.cert/` folder):
   ```
   npm run cert
   ```
   Output: `examples/.cert/cert.pem` and `key.pem`. The script prints
   the LAN URL to open.

### Day-to-day

```
npm run dev:https
```

Opens on:
- `https://localhost:5555` — this Mac.
- `https://<hostname>.local:5555` — other devices on the same LAN. Find your
  hostname with `scutil --get LocalHostName` (macOS) or `hostname` (Windows /
  Linux).

If the cert files are missing, the dev server fails immediately with a hint
to run `npm run cert`.

### Trusting the cert on devices

The Mac already trusts the mkcert root from `mkcert -install`. Other devices
need the root CA installed once. The root file lives at
`$(mkcert -CAROOT)/rootCA.pem`.

**iPhone / iPad / Apple Vision Pro (Safari):**
1. AirDrop `rootCA.pem` to the device.
2. Settings → General → VPN & Device Management → install the profile.
3. **Settings → General → About → Certificate Trust Settings → toggle the
   mkcert root to ON.** This step is easy to miss and is the #1 source of
   "Not Secure" warnings.
4. Open `https://<hostname>.local:5555`.

**Android (Chrome):**
1. Copy `rootCA.pem` to the device (USB, email, Drive — no AirDrop).
2. Settings → Security → Encryption & credentials → Install a certificate →
   CA certificate. Search Settings for "CA certificate" if the path differs
   on your OEM.
3. Open `https://<hostname>.local:5555`. If `.local` doesn't resolve, fall
   back to the Mac's LAN IP and regenerate certs that include it
   (`npm run cert -- <ip>`, see "Adding extra hostnames or LAN IPs" below).

**Quest 3:** Quest Browser does not honor user-installed CAs reliably. The
recommended workflow is the Chrome insecure-origin flag, set via ADB:
```
adb shell am start -a android.intent.action.VIEW \
  -d "chrome://flags/#unsafely-treat-insecure-origin-as-secure"
```
Add `https://<hostname>.local:5555` (or `http://<lan-ip>:5555`) to the
allowed list and restart the browser. This bypasses cert validation and is
fine for local dev only.

### Adding extra hostnames or LAN IPs

If `<hostname>.local` doesn't resolve on a device (common on Android / Quest),
use the Mac's LAN IP and regenerate certs to include it. Pass extra SANs as
positional args (the `--` is required so `npm` forwards them to the script):

```
npm run cert -- 10.0.0.42 192.168.1.50
```

These are added on top of the defaults (`localhost`, `127.0.0.1`, `::1`,
`<hostname>.local`). Already-trusted devices stay trusted — the leaf cert is
re-signed by the same root CA, no re-install needed.

### What's expensive vs cheap to lose

- **Root CA** (in `$(mkcert -CAROOT)`) — expensive. Re-creating it means
  re-trusting on every device. Back this up if you care.
- **Leaf certs** in `examples/.cert/` — cheap. Regenerate with `npm run cert`;
  devices keep trusting them because they're signed by the same root CA.

### Troubleshooting

- **"site can't be reached"** from a device — check the Mac's firewall allows
  inbound on port 5555, and verify `ping <hostname>.local` resolves from the
  device. On corp WiFi, AP isolation often blocks client-to-client traffic;
  a personal hotspot or portable router (e.g. Netgear M6) sidesteps that.
- **"Not Secure" warning** on Apple devices — the mkcert profile is installed
  but not trusted. Re-check Certificate Trust Settings (step 3 above).
- **Vite 403** on a custom hostname — add it to `allowedHosts` in
  `vite.config.mjs` or stick to `<hostname>.local`.
- **mDNS doesn't resolve** on Android / Quest / Windows — use the LAN IP
  directly and regenerate certs to cover it (`npm run cert -- <ip>`).

## Creating an example

The available examples are written as classes in JavaScript under the paths `./src/examples/<category>/<exampleName>.example.mjs`.
To create a new example you can copy any of the existing examples as a template.

Each example consists of two modules to define its behavior:

### `<exampleName>.example.mjs`

```js
import * as pc from 'playcanvas';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const app = new pc.Application(canvas, {});
```

This is the only file that's required to run an example. The code defined in this function is executed each time the example play button is pressed. It takes the example's canvas element from the DOM and usually begins by creating a new PlayCanvas `Application` or `AppBase` using that canvas.
The examples loader finds and destroys applications registered to canvases it owns, so the `app` does not need to be exported. Export a `destroy` function only when the example creates non-app resources such as timers, DOM overlays, or animation frames that need cleanup.

Examples can also contain comments which allow you to define the default configuration for your examples as well as overrides to particular settings such as `deviceType`. Check the possible values to set in `ExampleConfig` in `utils/example-source.mjs` file for the full list.

```js
// @config
//
// @keybinds
// WASD: Move
// Space: Jump
// Mouse: Look
//
// @credit
// title: Example Asset
// author: Artist Name
// source: https://example.com/asset
// license: CC BY 4.0
//
// @flag HIDDEN
// @flag ENGINE=performance
// @flag NO_DEVICE_SELECTOR
// @flag NO_MINISTATS
// @flag WEBGPU_DISABLED
// @flag WEBGL_DISABLED
import * as pc from 'playcanvas';
...
```

External ESM packages can be imported directly:

```js
import confetti from 'https://esm.sh/canvas-confetti@1.6.0';
```

However, depending on external URLs is maybe not what you want as it breaks your examples once your internet connection is gone. Where possible, add shared files to the examples tree and import them directly.

Legacy non-module scripts should define any loading helper they need inside the example.

### `<exampleName>.controls.mjs`

This file allows you to define a set of PCUI based interface which can be used to display stats from your example or provide users with a way of controlling the example.

```js
/**
 * @param {import('../../../app/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export function controls({ observer, ReactPCUI, React, jsx, fragment }) {
    const { Button } = ReactPCUI;
    return fragment(
        jsx(Button, {
            text: 'Flash',
            onClick: () => {
                observer.set('flash', !observer.get('flash'));
            }
        })
    );
}
```

The controls function takes a [pcui observer](https://playcanvas.github.io/pcui/data-binding/using-observers/) as its parameter and returns a set of PCUI components. Check this [link](https://playcanvas.github.io/pcui/examples/todo/) for an example of how to create and use PCUI.

The data observer used in the `controls` function will be made available as an import from `examples/context` to use in the example file:

```js
import { data } from 'examples/context';

console.log(data.get('flash'));
```

### Additional files

Any other file you wish to include in your example can be added to the same folder with the example name prepended (e.g. `<exampleName>.shader.vert` and `<exampleName>.shader.frag`). These files can be imported from the example using their relative file name:

```js
import shaderVert from './shader.vert';
import shaderFrag from './shader.frag';
import data from './data.json';

const assets = {
    statue: new pc.Asset('statue', 'container', { url: './assets/models/statue.glb' }),
    orbit: new pc.Asset('orbit', 'script', { url: './scripts/camera/orbit-camera.js' })
};
```

Sidecar text files with `.frag`, `.vert`, `.wgsl`, `.glsl`, `.html`, `.css`, and `.txt` extensions are imported as strings. JSON files are imported as parsed values. Shared example assets use plain runtime URLs starting with `./assets/...`, shared engine script asset URLs use `./scripts/...`, and local `.mjs` files are imported as standard JavaScript modules. When using these modules outside the examples browser, configure your bundler to load text extensions as strings.

### Testing your example
Run `npm run dev` from the `Local examples browser development` section to serve the examples browser with Vite. Use `npm run develop` when automatic reloads should be disabled.

You can view an individual iframe directly, for example [http://localhost:5555/iframe/misc_hello-world.html]().

### Debug and performance engine development
By default, `npm run dev` and `npm run develop` serve the engine from `../src/index.js`. To test against a built ESM engine instead, pass `ENGINE_PATH`, for example `ENGINE_PATH=../build/playcanvas.mjs npm run dev`.

## Example Modules

The example script allows you to import examples-only modules that interact with the environment such as the device selector and controls. These are listed below:

- `examples/context` - The observer object `data` and selected graphics `deviceType`.
- `examples/assets/*` - Shared example modules. Use `./assets/...` when a runtime asset URL string is needed.
- `playcanvas/scripts/*` - Shared engine script modules. Use `./scripts/...` when a runtime script URL string is needed.

## Deployment

1) **Install Engine packages** by running the following in the `/engine` directory:
```
npm install
```

2) **Build the examples browser and launch the server** by running the following in the `/engine/examples` directory:
```
npm install
npm run build
npm run serve
```

3) **Generate thumbnails (Case-by-case basis)** This step will create the thumbnails directory for the browser. This only needs to be run if the examples thumbnails are updated or new examples are added.
```
npm run build:thumbnails
```

This command spawns its own `serve` instance on port 12321, so you don't need to care about that.

4) Copy the contents of the `./dist` directory to the root of the [playcanvas.github.io](https://github.com/playcanvas/playcanvas.github.io) repository. Be sure not to wipe the contents of the `pcui` subdirectory in that repository.

5) Run `git commit -m "Update to Engine 1.XX.X"` in the `playcanvas.github.io` repo

6) Create a PR for this new commit
