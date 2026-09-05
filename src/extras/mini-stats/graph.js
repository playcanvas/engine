class Graph {
    constructor(name, app, watermark, textRefreshRate, timer) {
        this.name = name;
        this.label = name === 'DrawCalls' ? 'Draw calls' : name;
        this.timer = timer;
        this.watermark = watermark ?? 100;
        this.enabled = false;
        this.textRefreshRate = textRefreshRate;
        this.avgTotal = 0;
        this.avgTimer = 0;
        this.avgCount = 0;
        this.maxValue = 0;
        this.timingText = '—';
        this.maxText = '—';
        this.texture = null;
        this.yOffset = 0;
        this.cursor = 0;
        this.needsClear = true;
        this.quad = -1;
        this.renderWidth = 0;
        this.parent = null;
        this.group = 0;
        this.lastNonZeroFrame = 0;
        this.statName = '';
    }

    destroy() {
        if (typeof this.timer.destroy === 'function') this.timer.destroy();
    }

    loseContext() {
        if (typeof this.timer.loseContext === 'function') this.timer.loseContext();
    }

    // Returns a bitmask of changed average (1) and peak (2) text. The shared texture is
    // locked once by MiniStats, so all rows are updated before a single unlock/upload.
    update(ms, data) {
        const timings = this.timer.timings;
        let total = 0;
        for (let i = 0; i < timings.length; i++) total += timings[i];
        if (!Number.isFinite(total)) total = 0;
        this.avgTotal += total;
        this.avgTimer += ms;
        this.avgCount++;
        this.maxValue = Math.max(this.maxValue, total);
        let changed = 0;
        if (this.avgTimer >= this.textRefreshRate) {
            const timingText = (this.avgTotal / this.avgCount).toFixed(this.timer.decimalPlaces);
            const maxText = this.maxValue.toFixed(this.timer.decimalPlaces);
            changed = (this.timingText !== timingText ? 1 : 0) | (this.maxText !== maxText ? 2 : 0);
            this.timingText = timingText;
            this.maxText = maxText;
            this.avgTotal = 0;
            this.avgTimer = 0;
            this.avgCount = 0;
            this.maxValue = 0;
        }
        if (data && this.enabled) {
            const width = this.texture.width;
            const rowOffset = this.yOffset * width * 4;
            if (this.needsClear) {
                data.fill(0, rowOffset, rowOffset + width * 4);
                this.needsClear = false;
            }
            const offset = rowOffset + this.cursor * 4;
            const range = 1.5 * (this.watermark > 0 ? this.watermark : 100);
            data[offset] = Math.min(255, Math.max(0, Math.round(total / range * 255)));
            data[offset + 3] = 170;
            this.cursor = (this.cursor + 1) % width;
        }
        return changed;
    }
}

export { Graph };
