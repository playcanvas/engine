import { Script, Asset, Entity, platform } from 'playcanvas';

class StreamedGsplat extends Script {
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
     * @attribute
     * @type {number[]}
     */
    ultraLodDistances = [5, 20, 35, 50, 65, 90, 150];

    /**
     * @attribute
     * @type {number[]}
     */
    highLodDistances = [5, 20, 35, 50, 65, 90, 150];

    /**
     * @attribute
     * @type {number[]}
     */
    mediumLodDistances = [5, 7, 12, 25, 75, 120, 200];

    /**
     * @attribute
     * @type {number[]}
     */
    lowLodDistances = [5, 7, 12, 25, 75, 120, 200];

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

    /**
     * @attribute
     * @type {number}
     */
    ultraSplatBudget = 6000000;

    /**
     * @attribute
     * @type {number}
     */
    highSplatBudget = 4000000;

    /**
     * @attribute
     * @type {number}
     */
    mediumSplatBudget = 2000000;

    /**
     * @attribute
     * @type {number}
     */
    lowSplatBudget = 1000000;

    /** @type {Asset[]} */
    _assets = [];

    /** @type {Entity[]} */
    _children = [];

    _highRes = false;

    _colorize = false;

    initialize() {
        const app = this.app;

        this._currentPreset = platform.mobile ? 'low' : 'medium';

        // global settings
        app.scene.gsplat.radialSorting = true;
        app.scene.gsplat.lodUpdateAngle = 90;
        app.scene.gsplat.lodBehindPenalty = 5;
        app.scene.gsplat.lodUpdateDistance = 1;
        app.scene.gsplat.lodUnderfillLimit = 10;

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
            console.warn('[StreamedGsplat] No splatUrl provided.');
        } else {
            const mainAsset = new Asset('MainGsplat_asset', 'gsplat', { url: this.splatUrl });
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
                    lodDistances: this._getCurrentLodDistances(),
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
            console.warn('[StreamedGsplat] No environmentUrl provided (skipping env child).');
        } else {
            const envAsset = new Asset('EnvironmentGsplat_asset', 'gsplat', { url: this.environmentUrl });
            app.assets.add(envAsset);
            app.assets.load(envAsset);
            this._assets.push(envAsset);

            envAsset.ready((a) => {
                // Create child entity disabled to allow unified property to be set
                const child = new Entity('EnvironmentGsplat');
                child.enabled = false;

                // Attach to the scene graph
                this.entity.addChild(child);
                this._children.push(child);

                // Add the component while entity is disabled
                child.addComponent('gsplat', {
                    unified: true,
                    lodDistances: this._getCurrentLodDistances(),
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

    _getCurrentLodDistances() {
        let distances;
        switch (this._currentPreset) {
            case 'ultra':
                distances = this.ultraLodDistances;
                break;
            case 'high':
                distances = this.highLodDistances;
                break;
            case 'medium':
                distances = this.mediumLodDistances;
                break;
            case 'low':
                distances = this.lowLodDistances;
                break;
            default:
                distances = [5, 20, 35, 50, 65, 90, 150];
        }
        return distances && distances.length > 0 ? distances : [5, 20, 35, 50, 65, 90, 150];
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

    _getCurrentSplatBudget() {
        let budget;
        switch (this._currentPreset) {
            case 'ultra':
                budget = this.ultraSplatBudget;
                break;
            case 'high':
                budget = this.highSplatBudget;
                break;
            case 'medium':
                budget = this.mediumSplatBudget;
                break;
            case 'low':
                budget = this.lowSplatBudget;
                break;
            default:
                budget = 0;
        }
        return budget || 0;
    }

    _applyPreset() {
        const range = this._getCurrentLodRange();
        if (!range) return;

        const app = this.app;
        app.scene.gsplat.lodRangeMin = range[0];
        app.scene.gsplat.lodRangeMax = range[1];

        const lodDistances = this._getCurrentLodDistances();
        const splatBudget = this._getCurrentSplatBudget();

        // Apply to main streaming asset only (environment doesn't support these settings)
        if (this.entity.gsplat) {
            this.entity.gsplat.lodDistances = lodDistances;
            this.entity.gsplat.splatBudget = splatBudget;
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
        this.app.scene.gsplat.colorizeLod = this._colorize;

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

export { StreamedGsplat };
