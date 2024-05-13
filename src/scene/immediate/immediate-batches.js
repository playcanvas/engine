import { ImmediateBatch } from './immediate-batch.js';

// helper class storing line batches for a single layer
class ImmediateBatches {
    constructor(device) {
        this.device = device;

        // dictionary of Material to ImmediateBatch mapping
        this.map = new Map();
    }

    getBatch(material, layer) {
        let batch = this.map.get(material);
        if (!batch) {
            batch = new ImmediateBatch(this.device, material, layer);
            this.map.set(material, batch);
        }
        return batch;
    }

    onPreRender(visibleList, transparent) {
        this.map.forEach((batch) => {
            batch.onPreRender(visibleList, transparent);
        });
    }

    clear() {
        this.map.forEach(batch => batch.clear());
    }
}

export { ImmediateBatches };
