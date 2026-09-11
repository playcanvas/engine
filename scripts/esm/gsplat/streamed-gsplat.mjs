import { Script, Asset, Entity, platform, GSPLAT_DEBUG_LOD, GSPLAT_DEBUG_NONE } from 'playcanvas';

/**
 * Loads and displays a streamed gaussian splat scene ({@link StreamedGSplat#splatUrl}), plus an
 * optional environment splat ({@link StreamedGSplat#environmentUrl}) on a child entity, using
 * unified gsplat components. The main splat has four LOD presets — ultra, high, medium or low —
 * each with a configurable detail falloff and allowed LOD range. The scene-wide splat budget
 * and LOD mode are configured through `app.scene.gsplat` in code or the Editor's scene settings.
 * The initial preset is low on mobile and medium on desktop, and can be switched at runtime by
 * firing the `preset:ultra`, `preset:high`, `preset:medium` or `preset:low` app events. Firing
 * `colorize:toggle` toggles the LOD debug visualization.
 *
 * @example
 * splatEntity.addComponent('script');
 * splatEntity.script.create(StreamedGSplat, {
 *     properties: {
 *         splatUrl: 'scene.lod-meta.json',
 *         environmentUrl: 'environment.sog'
 *     }
 * });
 * @category Gaussian Splatting
 */
class StreamedGSplat extends Script {
    static scriptName = 'streamedGsplat';

    /**
     * @attribute
     * @type {string}
     */
    splatUrl = '';

    /**
     * @attribute
     * @type {string}
     */
    environmentUrl = '';

    /**
     * Detail falloff for the ultra preset. Higher values concentrate detail near the camera;
     * values towards 0 spread it more evenly. See
     * [GSplatComponent.lodFalloff](https://api.playcanvas.com/engine/classes/GSplatComponent.html#lodfalloff).
     *
     * @attribute
     * @type {number}
     * @range [0, 8]
     */
    ultraLodFalloff = 1;

    /**
     * Detail falloff for the high preset. See {@link StreamedGSplat#ultraLodFalloff}.
     *
     * @attribute
     * @type {number}
     * @range [0, 8]
     */
    highLodFalloff = 1;

    /**
     * Detail falloff for the medium preset. See {@link StreamedGSplat#ultraLodFalloff}.
     *
     * @attribute
     * @type {number}
     * @range [0, 8]
     */
    mediumLodFalloff = 1;

    /**
     * Detail falloff for the low preset. See {@link StreamedGSplat#ultraLodFalloff}.
     *
     * @attribute
     * @type {number}
     * @range [0, 8]
     */
    lowLodFalloff = 1;

    /**
     * @attribute
     * @type {number[]}
     */
    ultraLodRange = [0, 5];

    /**
     * @attribute
     * @type {number[]}
     */
    highLodRange = [1, 5];

    /**
     * @attribute
     * @type {number[]}
     */
    mediumLodRange = [2, 5];

    /**
     * @attribute
     * @type {number[]}
     */
    lowLodRange = [3, 5];

    /** @type {Asset[]} */
    _assets = [];

    /** @type {Entity[]} */
    _children = [];

    _highRes = false;

    _colorize = false;

    initialize() {
        const app = this.app;

        this._currentPreset = platform.mobile ? 'low' : 'medium';

        // Listen for UI events
        app.on('preset:ultra', () => this._setPreset('ultra'), this);
        app.on('preset:high', () => this._setPreset('high'), this);
        app.on('preset:medium', () => this._setPreset('medium'), this);
        app.on('preset:low', () => this._setPreset('low'), this);
        app.on('colorize:toggle', this._toggleColorize, this);

        // Apply initial resolution
        this._applyResolution();

        // Load main splat - attach to entity directly
        if (!this.splatUrl) {
            console.warn('[StreamedGSplat] No splatUrl provided.');
        } else {
            const mainAsset = new Asset('MainGSplat_asset', 'gsplat', { url: this.splatUrl });
            app.assets.add(mainAsset);
            app.assets.load(mainAsset);
            this._assets.push(mainAsset);

            mainAsset.ready((a) => {
                // Temporarily disable entity to allow unified property to be set
                const wasEnabled = this.entity.enabled;
                this.entity.enabled = false;

                // Add component directly to this entity
                this.entity.addComponent('gsplat', {
                    unified: true,
                    lodFalloff: this._getCurrentLodFalloff(),
                    asset: a
                });

                // Restore entity enabled state
                this.entity.enabled = wasEnabled;

                // Apply initial preset
                this._applyPreset();
            });
        }

        // Load environment splat - attach to child entity
        if (!this.environmentUrl) {
            console.warn('[StreamedGSplat] No environmentUrl provided (skipping env child).');
        } else {
            const envAsset = new Asset('EnvironmentGSplat_asset', 'gsplat', { url: this.environmentUrl });
            app.assets.add(envAsset);
            app.assets.load(envAsset);
            this._assets.push(envAsset);

            envAsset.ready((a) => {
                // Create child entity disabled to allow unified property to be set
                const child = new Entity('EnvironmentGSplat');
                child.enabled = false;

                // Attach to the scene graph
                this.entity.addChild(child);
                this._children.push(child);

                // Add the component while entity is disabled
                child.addComponent('gsplat', {
                    unified: true,
                    asset: a
                });

                // Enable the child entity
                child.enabled = true;
            });
        }

        this.once('destroy', () => {
            this.onDestroy();
        });
    }

    _getCurrentLodFalloff() {
        switch (this._currentPreset) {
            case 'ultra':
                return this.ultraLodFalloff;
            case 'high':
                return this.highLodFalloff;
            case 'medium':
                return this.mediumLodFalloff;
            case 'low':
                return this.lowLodFalloff;
            default:
                return 1;
        }
    }

    _getCurrentLodRange() {
        let range;
        switch (this._currentPreset) {
            case 'ultra':
                range = this.ultraLodRange;
                break;
            case 'high':
                range = this.highLodRange;
                break;
            case 'medium':
                range = this.mediumLodRange;
                break;
            case 'low':
                range = this.lowLodRange;
                break;
            default:
                range = [0, 5];
        }
        return range && range.length >= 2 ? range : [0, 5];
    }

    _applyPreset() {
        const range = this._getCurrentLodRange();
        if (!range) return;

        // Apply to main streaming asset only (environment doesn't support these settings)
        if (this.entity.gsplat) {
            this.entity.gsplat.lodRangeMin = range[0];
            this.entity.gsplat.lodRangeMax = range[1];
            this.entity.gsplat.lodFalloff = this._getCurrentLodFalloff();
        }
    }

    _setPreset(presetName) {
        this._currentPreset = presetName;
        this._applyPreset();

        // Notify UI of preset change
        this.app.fire('ui:setPreset', presetName);
    }

    _applyResolution() {
        const device = this.app.graphicsDevice;
        const dpr = window.devicePixelRatio || 1;
        device.maxPixelRatio = this._highRes ? Math.min(dpr, 2) : (dpr >= 2 ? dpr * 0.5 : dpr);
        this.app.resizeCanvas();
    }

    _toggleColorize() {
        this._colorize = !this._colorize;
        this.app.scene.gsplat.debug = this._colorize ? GSPLAT_DEBUG_LOD : GSPLAT_DEBUG_NONE;

        const statusEl = document.getElementById('colorize-status');
        if (statusEl) {
            statusEl.textContent = this._colorize ? 'On' : 'Off';
        }
    }

    update() {
        const rendered = this.app.stats.frame.gsplats || 0;
        this.app.fire('ui:updateStats', rendered);
    }

    onDestroy() {
        // Clean up event listeners
        this.app.off('preset:ultra');
        this.app.off('preset:high');
        this.app.off('preset:medium');
        this.app.off('preset:low');
        this.app.off('colorize:toggle');

        // unload/remove assets
        for (let i = 0; i < this._assets.length; i++) {
            const a = this._assets[i];
            if (a) {
                a.unload();
                this.app.assets.remove(a);
            }
        }
        this._assets.length = 0;

        // remove gsplat component from entity if present
        if (this.entity.gsplat) {
            this.entity.removeComponent('gsplat');
        }

        // destroy created children
        for (let j = 0; j < this._children.length; j++) {
            const c = this._children[j];
            if (c && c.destroy) c.destroy();
        }
        this._children.length = 0;
    }
}

export { StreamedGSplat };
