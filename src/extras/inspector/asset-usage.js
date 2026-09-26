import { assetUsers, containerParts } from './asset-view.js';
import { describeValue } from './describe.js';
import { collectMeshInstances } from './instance-survey.js';
import { materialsUsingTexture } from './material-view.js';
import { nodeLabel } from './memory-view.js';
import { pushRow } from './model.js';

/** @import { AppBase } from '../../framework/app-base.js' */
/** @import { Asset } from '../../framework/asset/asset.js' */
/** @import { Described } from './describe.js' */
/** @import { PropertySection } from './model.js' */

// most users a resource lists
const MAX_USERS = 100;

/**
 * The anim component layers playing an animation track: an animation assigned to a layer with
 * `assignAnimation` is given as its track, taken from the asset's resource, so the component
 * never names the asset. Each layer keeps the tracks it plays as the clips of its evaluator.
 *
 * @param {AppBase} app - The app.
 * @param {object} track - The track.
 * @returns {Described[]} One linked entry per clip playing it.
 */
function trackUsers(app, track) {
    const users = [];
    app.root?.forEach((node) => {
        const anim = /** @type {any} */ (node).c?.anim;
        for (const layer of anim?.layers ?? []) {
            // the controller of a layer is not exposed, but its evaluator's clips are
            for (const clip of layer._controller?.animEvaluator?.clips ?? []) {
                if (clip.track !== track) continue;
                users.push({ label: 'anim', text: `${nodeLabel(node)} · layer "${layer.name}" · "${clip.name}"`, cls: 'ref', target: node });
            }
        }
    });
    return users;
}

/**
 * @param {AppBase} app - The app.
 * @param {object} material - A material.
 * @returns {Described[]} One linked entry per mesh instance drawing with it.
 */
function materialUsers(app, material) {
    return collectMeshInstances(app)
    .filter(({ instance }) => instance.material === material)
    .map(({ instance }) => ({ label: 'mesh instance', text: nodeLabel(instance.node ?? null), cls: 'ref', target: instance.node ?? null }));
}

/**
 * What uses an asset's resource directly, handed over without the asset: the anim layers playing
 * an animation's track, the mesh instances drawing with a material, and the materials sampling a
 * texture. The components referencing the asset itself are found separately, by
 * {@link assetUsers}.
 *
 * @param {AppBase} app - The app.
 * @param {Asset} asset - The asset.
 * @returns {Described[]} One entry per user.
 */
function resourceUsers(app, asset) {
    const resource = asset.loaded ? asset.resource : null;
    if (!resource) return [];
    if (asset.type === 'animation') return trackUsers(app, resource);
    if (asset.type === 'material') return materialUsers(app, resource);
    if (asset.type === 'texture') {
        return materialsUsingTexture(app, resource).map(material => ({ label: 'material', ...describeValue(material) }));
    }
    return [];
}

/**
 * Adds to the Used by section of an asset what uses its resource directly, and for a container,
 * which of its contents are in use: a container itself is rarely referenced, while the renders,
 * materials and animations made of its file are.
 *
 * @param {PropertySection} section - The asset's Used by section.
 * @param {Asset} asset - The asset.
 * @param {AppBase} app - The app.
 */
function pushResourceUsage(section, asset, app) {
    const users = resourceUsers(app, asset);
    if (users.length) {
        pushRow(section.rows, 'resource', {
            text: `used directly by ${users.length}`,
            cls: 'obj',
            items: users.slice(0, MAX_USERS)
        });
    }

    const kinds = containerParts(app.assets ?? null).parts.get(asset);
    if (kinds?.length) {
        const used = [];
        for (const [kind, parts] of kinds) {
            for (const part of parts) {
                const count = assetUsers(app, part).length + resourceUsers(app, part).length;
                if (count) used.push({ label: kind, text: `${part.name}, ${count} user${count === 1 ? '' : 's'}`, cls: 'ref', target: part });
            }
        }
        pushRow(section.rows, 'contents', {
            text: used.length ? `${used.length} in use` : 'none in use',
            cls: used.length ? 'obj' : 'null',
            items: used
        });
    }
}

export { pushResourceUsage, resourceUsers };
