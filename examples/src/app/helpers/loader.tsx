import React from 'react';
import * as pc from 'playcanvas/build/playcanvas.js';

interface AssetLoaderProps {
    name: string,
    type: string,
    data?: any,
    url?: string
}

class AssetLoader extends React.Component <AssetLoaderProps, any>  {
    static ctor: any;
    static load(resource: AssetLoaderProps, app: pc.Application, onLoad: any) {
        if (resource.data) {
            const asset = new pc.Asset(resource.name, resource.type, resource.type === 'cubemap' ? { url: resource.url } : null, resource.data);
            asset.on('load', function (asset) {
                onLoad(resource.name, asset);
            });
            app.assets.add(asset);
            app.assets.load(asset);
        } else {
            app.assets.loadFromUrl(resource.url, resource.type, function (err, asset) {
                if (!err && asset) {
                    onLoad(resource.name, asset);
                }
            });
        }
    }
}

interface ScriptLoaderProps {
    name: string,
    url: string
}
class ScriptLoader extends React.Component <ScriptLoaderProps, any>  {
    static ctor: any;
    static load(resource: ScriptLoaderProps, app: pc.Application, onLoad: any) {
        fetch(resource.url)
            .then((response: any) => response.text())
            .then((data) => {
                (window as any)[resource.name] = (Function('module', 'exports', data).call(module, module, module.exports), module).exports;
                onLoad();
            });
    }
}

class Loader {
    // asset loader function allowing to load multiple assets
    static load(app: pc.Application, resources: Array<AssetLoaderProps|ScriptLoaderProps>, onLoadedResources: (assetManifest: any) => any) {
        const manifest: any = {};

        // count of assets to load
        let count = resources.length;

        function onLoadedResource(key: string, asset: pc.Asset) {
            count--;
            if (key) {
                manifest[key] = asset;
            }
            if (count === 0) {
                if (onLoadedResources) {
                    onLoadedResources(manifest);
                }
            }
        }

        resources.forEach((resource: any) => {
            resource.load(resource, app, onLoadedResource);
        });
    }
}

export {
    Loader,
    AssetLoader,
    ScriptLoader
};
