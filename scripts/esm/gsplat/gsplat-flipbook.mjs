import { Script, Asset } from 'playcanvas';

/**
 * Reference-counted asset cache shared across all GsplatFlipbook instances.
 * Ensures assets are only loaded once and properly cleaned up when no longer needed.
 */
class AssetCache {
    /**
     * Cache storage: Map<url, { asset, refCount }>
     * @type {Map<string, {asset: import('playcanvas').Asset, refCount: number}>}
     */
    static cache = new Map();

    /**
     * Get an asset from cache or create and load it.
     * @param {string} url - The asset URL
     * @param {import('playcanvas').AppBase} app - The application instance
     * @returns {import('playcanvas').Asset} The asset
     */
    static getAsset(url, app) {
        const entry = this.cache.get(url);

        if (entry) {
            // Asset exists in cache, increment reference count
            entry.refCount++;
            return entry.asset;
        }

        // Create new asset
        // disable reorder to avoid reordering of splats for rendering performance due to high reordering cost
        // for our purpose (applied to ply files only, ignored for other formats)
        const asset = new Asset(url, 'gsplat', { url }, { reorder: false });
        app.assets.add(asset);
        app.assets.load(asset);

        // Add to cache with initial refCount of 1
        this.cache.set(url, { asset, refCount: 1 });

        return asset;
    }

    /**
     * Release an asset from cache, decrementing its reference count.
     * Actual unload happens in processPendingUnloads() when both the cache refCount
     * and resource.refCount are 0.
     * @param {string} url - The asset URL
     * @param {import('playcanvas').AppBase} app - The application instance
     */
    static releaseAsset(url, app) {
        const entry = this.cache.get(url);

        if (!entry) return;

        entry.refCount--;
    }

    /**
     * Process pending unloads, checking if resources are safe to unload.
     * This should be called periodically (e.g., in update loop) to clean up resources
     * that are no longer referenced by any script instances or GSplatManager.
     * @param {import('playcanvas').AppBase} app - The application instance
     */
    static processPendingUnloads(app) {
        for (const [url, entry] of this.cache.entries()) {
            if (entry.refCount <= 0 && entry.asset.resource) {
                // Check if resource is still in use by any manager
                if (entry.asset.resource.refCount === 0) {
                    app.assets.remove(entry.asset);
                    entry.asset.unload();
                    this.cache.delete(url);
                }
            }
        }
    }
}

/** @enum {string} */
const PlayMode = {
    Once: 'once',
    Loop: 'loop',
    Bounce: 'bounce'
};

/**
 * GSplat Flipbook Script
 *
 * Plays a sequence of gsplat files as a flipbook animation with automatic asset loading,
 * unloading, and reference-counted caching. Multiple script instances share a common cache
 * to minimize memory usage when using the same assets. Preloads multiple frames ahead for
 * smooth playback even with variable loading times.
 *
 * ## Requirements
 *
 * The entity must have a gsplat component with `unified: true` added **before** this script.
 *
 * ## Usage
 *
 * @example
 * // Create entity and add gsplat component first
 * const entity = new pc.Entity('Flipbook');
 * entity.addComponent('gsplat', {
 *     unified: true
 * });
 *
 * // Add script component and create flipbook script
 * entity.addComponent('script');
 * const flipbook = entity.script.create(GsplatFlipbook);
 *
 * // Configure attributes
 * flipbook.fps = 30;
 * flipbook.folder = 'assets/splats/animation';
 * flipbook.filenamePattern = 'frame_{frame:04}.sog';
 * flipbook.startFrame = 1;
 * flipbook.endFrame = 100;
 * flipbook.playMode = 'loop';
 * flipbook.playing = true;
 * flipbook.preloadCount = 10; // Preload 10 frames ahead (default)
 *
 * // Add to scene
 * app.root.addChild(entity);
 *
 * @example
 * // Control playback at runtime
 * flipbook.pause();        // Pause animation
 * flipbook.play();         // Resume animation
 * flipbook.stop();         // Stop and reset to start
 * flipbook.seekToFrame(50); // Jump to specific frame
 *
 * @example
 * // Different filename patterns
 * // Zero-padded: 'wave_{frame:04}.sog' -> wave_0001.sog, wave_0002.sog
 * // Two digits:  'anim{frame:02}.sog'  -> anim01.sog, anim02.sog
 * // No padding:  'file_{frame}.sog'    -> file_1.sog, file_2.sog
 *
 * @example
 * // Adjust preload buffer for different scenarios
 * flipbook.preloadCount = 20; // Larger buffer for slower connections
 * flipbook.preloadCount = 5;  // Smaller buffer to save memory
 */
class GsplatFlipbook extends Script {
    static scriptName = 'gsplatFlipbook';

    /**
     * Frames per second for playback.
     * @attribute
     * @type {number}
     */
    fps = 30;

    /**
     * Base folder path for assets (e.g., 'assets/splats/wave/').
     * @attribute
     * @type {string}
     */
    folder = '';

    /**
     * Filename pattern with {frame} or {frame:NN} placeholder.
     * Examples: 'wave_{frame:04}.sog' -> wave_0001.sog, 'frame{frame:02}.sog' -> frame01.sog
     * @attribute
     * @type {string}
     */
    filenamePattern = 'frame_{frame:04}.sog';

    /**
     * First frame number.
     * @attribute
     * @type {number}
     */
    startFrame = 1;

    /**
     * Last frame number.
     * @attribute
     * @type {number}
     */
    endFrame = 100;

    /**
     * Playback mode: 'once' (play once and stop), 'loop' (wrap around), or 'bounce' (reverse at ends).
     * @attribute
     * @type {PlayMode}
     */
    playMode = PlayMode.Loop;

    /**
     * Whether the animation is currently playing (can be toggled to pause/resume).
     * @attribute
     * @type {boolean}
     */
    playing = true;

    /**
     * Number of frames to preload ahead for smooth playback (default: 10).
     * Higher values provide smoother playback but use more memory.
     * Preloaded assets are shared across all script instances via AssetCache.
     * @attribute
     * @type {number}
     */
    preloadCount = 10;

    initialize() {
        // Internal state
        this.currentFrame = this.startFrame;
        this.frameTime = 0;
        this.direction = 1; // 1 for forward, -1 for reverse (used in bounce mode)
        this.currentAsset = null;
        this.currentAssetUrl = null;
        // Array of preloaded frame entries: [{ frameNum, url, asset }, ...]
        this.preloadedFrames = [];

        // Verify gsplat component exists (should be added before this script)
        if (!this.entity.gsplat) {
            console.error('GsplatFlipbook: Entity must have a gsplat component with unified=true');
            return;
        }

        // Load first frame
        this.loadFrame(this.currentFrame);
    }

    update(dt) {
        if (!this.playing) return;

        this.frameTime += dt;

        // Check if it's time to advance frame
        if (this.frameTime >= 1 / this.fps) {
            this.frameTime = 0;

            // Check if next asset is ready
            if (this.preloadedFrames.length > 0 && this.preloadedFrames[0].asset.loaded) {
                this.switchToNextFrame();
            }
        }

        // Process pending unloads - check if any assets are safe to unload
        AssetCache.processPendingUnloads(this.app);
    }

    /**
     * Switch to the next preloaded frame
     * @private
     */
    switchToNextFrame() {
        // Get first preloaded frame
        const nextFrame = this.preloadedFrames.shift();
        if (!nextFrame) return;

        // Release old asset
        if (this.currentAssetUrl) {
            AssetCache.releaseAsset(this.currentAssetUrl, this.app);
        }

        // Set new asset on component
        if (this.entity.gsplat) {
            this.entity.gsplat.asset = nextFrame.asset;
        }

        // Update current references
        this.currentAsset = nextFrame.asset;
        this.currentAssetUrl = nextFrame.url;

        // Advance frame
        this.advanceFrame();

        // Maintain preload buffer
        this.maintainPreloadBuffer();
    }

    /**
     * Advance to the next frame based on playMode
     * @private
     */
    advanceFrame() {
        if (this.playMode === 'bounce') {
            this.currentFrame += this.direction;

            // Check bounds and reverse direction
            if (this.currentFrame >= this.endFrame) {
                this.currentFrame = this.endFrame;
                this.direction = -1;
            } else if (this.currentFrame <= this.startFrame) {
                this.currentFrame = this.startFrame;
                this.direction = 1;
            }
        } else if (this.playMode === 'loop') {
            this.currentFrame++;
            if (this.currentFrame > this.endFrame) {
                this.currentFrame = this.startFrame;
            }
        } else if (this.playMode === 'once') {
            this.currentFrame++;
            if (this.currentFrame > this.endFrame) {
                this.playing = false;
            }
        }
    }

    /**
     * Get the next frame number without modifying state
     * @private
     * @returns {number|null} Next frame number or null if animation is done
     */
    getNextFrameNumber() {
        if (this.playMode === 'bounce') {
            return this.currentFrame + this.direction;
        } else if (this.playMode === 'loop') {
            const next = this.currentFrame + 1;
            return next > this.endFrame ? this.startFrame : next;
        } else if (this.playMode === 'once') {
            const next = this.currentFrame + 1;
            return next <= this.endFrame ? next : null;
        }
        return null;
    }

    /**
     * Get the next frame number from the last preloaded frame
     * @private
     * @returns {number|null} Next frame number or null if animation is done
     */
    getNextFrameNumberFromLast() {
        // If no frames preloaded, use current frame as base
        if (this.preloadedFrames.length === 0) {
            return this.getNextFrameNumber();
        }

        // Get last preloaded frame
        const lastFrame = this.preloadedFrames[this.preloadedFrames.length - 1].frameNum;

        if (this.playMode === 'bounce') {
            // Simulate direction changes from current to last frame
            let checkFrame = this.currentFrame;
            let checkDir = this.direction;

            while (checkFrame !== lastFrame) {
                checkFrame += checkDir;
                if (checkFrame >= this.endFrame) {
                    checkFrame = this.endFrame;
                    checkDir = -1;
                } else if (checkFrame <= this.startFrame) {
                    checkFrame = this.startFrame;
                    checkDir = 1;
                }
            }

            // Now calculate next from last frame
            const next = lastFrame + checkDir;
            if (next >= this.startFrame && next <= this.endFrame) {
                return next;
            }
            // If at boundary, reverse direction
            if (next > this.endFrame) return this.endFrame;
            if (next < this.startFrame) return this.startFrame;
            return next;
        } else if (this.playMode === 'loop') {
            const next = lastFrame + 1;
            return next > this.endFrame ? this.startFrame : next;
        } else if (this.playMode === 'once') {
            const next = lastFrame + 1;
            return next <= this.endFrame ? next : null;
        }
        return null;
    }

    /**
     * Maintain the preload buffer by filling it up to preloadCount frames ahead
     * @private
     */
    maintainPreloadBuffer() {
        // Fill buffer up to preloadCount frames ahead
        while (this.preloadedFrames.length < this.preloadCount) {
            const nextFrameNum = this.getNextFrameNumberFromLast();
            if (nextFrameNum === null) break; // End of sequence

            const url = this.getFramePath(nextFrameNum);
            const asset = AssetCache.getAsset(url, this.app);
            this.preloadedFrames.push({ frameNum: nextFrameNum, url, asset });
        }
    }

    /**
     * Load and set a specific frame
     * @param {number} frameNum - Frame number to load
     * @private
     */
    loadFrame(frameNum) {
        const url = this.getFramePath(frameNum);
        const asset = AssetCache.getAsset(url, this.app);

        this.currentAssetUrl = url;
        this.currentAsset = asset;

        // Set asset when loaded
        if (asset.loaded) {
            if (this.entity.gsplat) {
                this.entity.gsplat.asset = asset;
            }
            // Fill preload buffer
            this.maintainPreloadBuffer();
        } else {
            asset.once('load', () => {
                if (this.entity.gsplat) {
                    this.entity.gsplat.asset = asset;
                }
                // Fill preload buffer
                this.maintainPreloadBuffer();
            });
        }
    }

    /**
     * Construct the full path for a frame
     * @param {number} frameNum - Frame number
     * @returns {string} Full asset URL
     * @private
     */
    getFramePath(frameNum) {
        let filename = this.filenamePattern;

        // Replace {frame:NN} or {frame} with padded number
        filename = filename.replace(/\{frame(?::(\d+))?\}/g, (match, padding) => {
            if (padding) {
                return frameNum.toString().padStart(parseInt(padding, 10), '0');
            }
            return frameNum.toString();
        });

        // Combine folder and filename
        let path = this.folder;
        if (path && !path.endsWith('/')) {
            path += '/';
        }
        return path + filename;
    }

    /**
     * Start or resume playback
     */
    play() {
        this.playing = true;
    }

    /**
     * Pause playback
     */
    pause() {
        this.playing = false;
    }

    /**
     * Stop playback and reset to start frame
     */
    stop() {
        this.playing = false;
        this.currentFrame = this.startFrame;
        this.direction = 1;
        this.frameTime = 0;
        this.loadFrame(this.currentFrame);
    }

    /**
     * Seek to a specific frame
     * @param {number} frameNum - Frame number to seek to
     */
    seekToFrame(frameNum) {
        if (frameNum < this.startFrame || frameNum > this.endFrame) {
            console.warn(`Frame ${frameNum} is out of range [${this.startFrame}, ${this.endFrame}]`);
            return;
        }

        this.currentFrame = frameNum;
        this.frameTime = 0;
        this.loadFrame(this.currentFrame);
    }

    onDestroy() {
        // Release current asset
        if (this.currentAssetUrl) {
            AssetCache.releaseAsset(this.currentAssetUrl, this.app);
        }
        // Release all preloaded assets
        for (const frame of this.preloadedFrames) {
            AssetCache.releaseAsset(frame.url, this.app);
        }
        this.preloadedFrames = [];
    }
}

export { GsplatFlipbook };
