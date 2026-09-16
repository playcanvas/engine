// Consumer-side type tests for Asset<K>, AssetRegistry#find, AssetRegistry#findAll,
// AssetRegistry#loadFromUrl and the AssetMap augmentation. Compiled by `npm run test:types` against
// build/playcanvas.d.ts, so they exercise exactly what an application sees.
import { Asset, Material } from '../../build/playcanvas.js';
import type {
    AnimTrack, Animation, AssetMap, AssetRegistry, AssetResource, AssetType, Bundle, CanvasFont,
    ContainerResource, Font, Texture
} from '../../build/playcanvas.js';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Expect<T extends true> = T;

const concatenateShaders = (assets: AssetRegistry): string => {
    const shader1 = assets.find('part1', 'shader');
    const shader2 = assets.find('part2', 'shader');

    if (!shader1 || !shader2) {
        return '';
    }

    return (shader1.resource ?? '') + (shader2.resource ?? '');
};

const concatenateTextAssets = (assets: AssetRegistry): string => {
    return assets.findAll('part', 'text').map(asset => asset.resource).join('');
};

// An application-defined asset type: adding it to AssetMap is the one augmentation needed to type
// it everywhere.
class MyResource {
    destroy(): void {}
}
declare module '../../build/playcanvas.js' {
    interface AssetMap {
        mytype: MyResource;
    }
}

declare const assets: AssetRegistry;
declare const container: ContainerResource;
const name: string = 'texture';

// ---- constructor: the type string types the asset, its resource and its type field
const texture = new Asset('a', 'texture', { url: 'a.png' });
type T1 = Expect<Equal<typeof texture, Asset<'texture'>>>;
type T2 = Expect<Equal<typeof texture.resource, Texture | undefined>>;
type T36 = Expect<Equal<Asset<'texture'>['resource'], Texture | undefined>>;
type T3 = Expect<Equal<typeof texture.type, 'texture'>>;
type T4 = Expect<Equal<typeof texture.resources, Texture[]>>;
const bundle = new Asset('b', 'bundle');
type T5 = Expect<Equal<typeof bundle.resource, Bundle | undefined>>;
const other = new Asset('o', 'unregistered');
type T6 = Expect<Equal<typeof other.resource, unknown>>;
type T7 = Expect<Equal<typeof other.type, 'unregistered'>>;

// ---- a plain Asset is Asset<string>: string type, unknown resource, and every typed asset is one
const plain: Asset = texture;
const plainText: Asset = new Asset('t', 'text');
type T8 = Expect<Equal<Asset, Asset<string>>>;
type T9 = Expect<Equal<Asset['resource'], unknown>>;
type T10 = Expect<Equal<Asset['type'], string>>;
type T11 = Expect<Equal<Asset<'texture'> extends Asset ? true : false, true>>;
type T12 = Expect<Equal<Asset<'texture' | 'cubemap'>['resource'], Texture | null | undefined>>;

// ---- per-type nullability and unions live in AssetMap, not in Asset
type T33 = Expect<Equal<Asset<'cubemap'>['resource'], Texture | null | undefined>>;
type T34 = Expect<Equal<Asset<'cubemap'>['resources'], (Texture | null)[]>>;
type T35 = Expect<Equal<Asset<'font'>['resource'], Font | CanvasFont | undefined>>;
declare const canvasFont: CanvasFont;
const fontAsset = new Asset('dynamic', 'font');
fontAsset.resource = canvasFont;
assets.add(texture);
assets.add(plainText);
assets.load(bundle);

// ---- find and findAll: a literal narrows the result, no type or a string keeps the plain Asset
const found = assets.find('brick', 'texture');
type T13 = Expect<Equal<typeof found, Asset<'texture'> | null>>;
const material = assets.find('brick', 'material');
type T14 = Expect<Equal<NonNullable<typeof material>['resource'], Material | undefined>>;
const untyped = assets.find('brick');
type T15 = Expect<Equal<typeof untyped, Asset | null>>;
const loose = assets.find('brick', name);
type T16 = Expect<Equal<typeof loose, Asset | null>>;
const unregistered = assets.find('brick', 'unregistered');
type T17 = Expect<Equal<typeof unregistered, Asset<'unregistered'> | null>>;
type T18 = Expect<Equal<NonNullable<typeof unregistered>['resource'], unknown>>;
const all = assets.findAll('brick', 'texture');
type T19 = Expect<Equal<typeof all, Asset<'texture'>[]>>;
const allUntyped = assets.findAll('brick');
type T20 = Expect<Equal<typeof allUntyped, Asset[]>>;
const allLoose = assets.findAll('brick', name);
type T21 = Expect<Equal<typeof allLoose, Asset[]>>;
declare const maybeType: string | undefined;
const maybe = assets.find('brick', maybeType);
type T31 = Expect<Equal<typeof maybe, Asset | null>>;
const allMaybe = assets.findAll('brick', maybeType);
type T32 = Expect<Equal<typeof allMaybe, Asset[]>>;
type T22 = Expect<Equal<Asset<'json'>['resource'], unknown>>;
type T23 = Expect<Equal<Asset<'animation'>['resource'], Animation | AnimTrack | undefined>>;

// ---- loadFromUrl, loadFromUrlAndFilename and ready: the callback's asset follows the type
assets.loadFromUrl('statue.glb', 'container', (err, asset) => {
    type L1 = Expect<Equal<typeof err, string | null>>;
    type L2 = Expect<Equal<typeof asset, Asset<'container'> | undefined>>;
    if (asset) {
        type L3 = Expect<Equal<typeof asset.resource, ContainerResource | undefined>>;
        // the resource is undefined until loaded, so reads narrow it first
        const resource = asset.resource;
        if (resource) {
            type L4 = Expect<Equal<typeof resource.renders, Asset<'render'>[]>>;
            type L5 = Expect<Equal<typeof resource.textures, Asset<'texture'>[]>>;
            const first = resource.textures[0]?.resource;
            type L5b = Expect<Equal<typeof first, Texture | undefined>>;
            return [first] as [Texture | undefined, L1?, L2?, L3?, L4?, L5?, L5b?];
        }
    }
    return null;
});
assets.loadFromUrlAndFilename('blob:x', 'a.png', 'texture', (err, asset) => {
    type L6 = Expect<Equal<typeof asset, Asset<'texture'> | undefined>>;
    return null as L6 | null;
});
assets.loadFromUrl('a.bin', name, (err, asset) => {
    type L7 = Expect<Equal<typeof asset, Asset | undefined>>;
    return null as L7 | null;
});
texture.ready((asset) => {
    type L8 = Expect<Equal<typeof asset, Asset<'texture'>>>;
    return null as L8 | null;
});

// ---- the public types can be named, and the constructor's type parameter can be extracted
type T24 = Expect<Equal<AssetMap['texture'], Texture>>;
type T25 = Expect<Equal<AssetResource<'texture'>, Texture>>;
type T26 = Expect<Equal<AssetResource<'unregistered'>, unknown>>;
type T27 = Expect<Equal<AssetType, keyof AssetMap>>;
const assetType: AssetType = 'texture';
type TypeArgument = ConstructorParameters<typeof Asset>[1];
const literalArgument: TypeArgument = 'texture';
const stringArgument: TypeArgument = name;

// ---- application-defined type, after the augmentation above
const mine = new Asset('m', 'mytype');
type T28 = Expect<Equal<typeof mine.resource, MyResource | undefined>>;
type T29 = Expect<Equal<AssetMap['mytype'], MyResource>>;
const foundMine = assets.find('m', 'mytype');
type T30 = Expect<Equal<typeof foundMine, Asset<'mytype'> | null>>;
const myType: AssetType = 'mytype';

// ---- rejected
// @ts-expect-error a texture asset's resource is a Texture, not a Material
const wrongResource: Material = texture.resource;
// @ts-expect-error a plain Asset cannot be narrowed to a typed one by assignment
const narrowed: Asset<'texture'> = plain;
// @ts-expect-error a texture asset does not accept a Material resource
texture.resource = new Material();
// @ts-expect-error the resource is undefined until the asset has loaded
texture.resource.destroy();
// @ts-expect-error the setter takes the resource type only, never undefined
texture.resource = undefined;
// @ts-expect-error not an asset type
const notAnAssetType: AssetType = 'nope';
// @ts-expect-error renders are Asset<'render'>, not Asset<'texture'>
const wrongRenders: Asset<'texture'>[] = container.renders;
assets.loadFromUrl('a.png', 'texture', (err, asset) => {
    // @ts-expect-error a texture asset's resource is a Texture, not a Material
    const wrong: Material | undefined = asset?.resource;
    return wrong;
});

export { concatenateShaders, concatenateTextAssets };
export {
    assetType, literalArgument, stringArgument, myType, wrongResource, narrowed, notAnAssetType,
    wrongRenders
};
export type Checks = [
    T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16, T17, T18, T19, T20,
    T21, T22, T23, T24, T25, T26, T27, T28, T29, T30, T31, T32, T33, T34, T35, T36
];
