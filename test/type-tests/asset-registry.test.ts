import type { AssetRegistry } from '../../build/playcanvas.js';

const concatenateShaders = (assets: AssetRegistry): string => {
    const shader1 = assets.find('part1', 'shader');
    const shader2 = assets.find('part2', 'shader');

    if (!shader1 || !shader2) {
        return '';
    }

    return shader1.resource + shader2.resource;
};

const concatenateTextAssets = (assets: AssetRegistry): string => {
    return assets.findAll('part', 'text').map(asset => asset.resource).join('');
};

export { concatenateShaders, concatenateTextAssets };
