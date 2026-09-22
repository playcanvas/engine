import { Component } from '../../framework/components/component.js';
import { Entity } from '../../framework/entity.js';
import { ScriptType } from '../../framework/script/script-type.js';
import { Script } from '../../framework/script/script.js';
import { Material } from '../../scene/materials/material.js';
import { MeshInstance } from '../../scene/mesh-instance.js';

import {
    INDEXFORMAT_UINT8, INDEXFORMAT_UINT16, INDEXFORMAT_UINT32,
    PRIMITIVE_LINELOOP, PRIMITIVE_LINES, PRIMITIVE_LINESTRIP, PRIMITIVE_POINTS, PRIMITIVE_TRIANGLES,
    PRIMITIVE_TRIFAN, PRIMITIVE_TRISTRIP, vertexTypesNames
} from '../../platform/graphics/constants.js';

import { pushAssetRows } from './asset-view.js';
import { describeValue } from './describe.js';
import { formatBytes, makeSection, push, pushRow, read, reflectInto, reflectRows } from './model.js';

/** @import { LayerComposition } from '../../scene/composition/layer-composition.js' */
/** @import { Mesh } from '../../scene/mesh.js' */
/** @import { GraphNode } from '../../scene/graph-node.js' */
/** @import { Described } from './describe.js' */
/** @import { PropertyRow, PropertySection } from './model.js' */

// component properties that are plumbing rather than state, plus deprecated aliases whose getters
// would log a deprecation warning just by being read
const SKIP_COMPONENT = [
    'enabled', 'system', 'entity', 'data',
    'renderPasses', 'lodBaseDistance', 'lodMultiplier', 'lodDistances', 'splatBudget', 'noFog', 'bodyType'
];

// script properties that are plumbing rather than state
const SKIP_SCRIPT = ['enabled', 'app', 'entity'];

// mesh instance properties shown up front, or that are plumbing
const SKIP_MESH_INSTANCE = ['node', 'mesh', 'material', 'visible', 'key'];

// mesh properties shown up front, or that are plumbing
const SKIP_MESH = ['vertexBuffer', 'indexBuffer', 'primitive', 'device', 'id'];

const INDEX_FORMAT_NAMES = {
    [INDEXFORMAT_UINT8]: 'UINT8',
    [INDEXFORMAT_UINT16]: 'UINT16',
    [INDEXFORMAT_UINT32]: 'UINT32'
};

const PRIMITIVE_NAMES = {
    [PRIMITIVE_POINTS]: 'POINTS',
    [PRIMITIVE_LINES]: 'LINES',
    [PRIMITIVE_LINELOOP]: 'LINELOOP',
    [PRIMITIVE_LINESTRIP]: 'LINESTRIP',
    [PRIMITIVE_TRIANGLES]: 'TRIANGLES',
    [PRIMITIVE_TRISTRIP]: 'TRISTRIP',
    [PRIMITIVE_TRIFAN]: 'TRIFAN'
};

// material getters that only exist to warn about their removal or deprecation, and the variant cache shown up front
const SKIP_MATERIAL = [
    'variants',
    'ambientTint', 'anisotropy', 'aoMapVertexColor', 'aoUvSet', 'blend', 'chunks', 'clearCoatGlossiness',
    'diffuseMapVertexColor', 'diffuseTint', 'dirty', 'emissiveMapVertexColor', 'emissiveTint',
    'glossMapVertexColor', 'lightMapVertexColor', 'metalnessMapVertexColor', 'opacityMapVertexColor', 'shader',
    'sheenGlossiness', 'sheenTint', 'specularMapVertexColor', 'specularTint'
];

/**
 * @param {GraphNode} node - The node.
 * @returns {PropertySection} The general section.
 */
function nodeSection(node) {
    const isEntity = node instanceof Entity;
    const section = makeSection('node', isEntity ? 'Entity' : 'GraphNode');

    push(section, 'name', describeValue(node.name));
    if (isEntity) push(section, 'guid', describeValue(node.guid));
    push(section, 'enabled', describeValue(node._enabled));
    push(section, 'enabled in hierarchy', describeValue(node.enabled));
    push(section, 'tags', describeValue(node.tags.list()));
    push(section, 'path', describeValue(node.path));
    push(section, 'parent', describeValue(node.parent));
    push(section, 'children', describeValue(node.children.length));

    return section;
}

/**
 * @param {GraphNode} node - The node.
 * @returns {PropertySection} The transform section.
 */
function transformSection(node) {
    const section = makeSection('transform', 'Transform');

    push(section, 'local position', describeValue(node.getLocalPosition()));
    push(section, 'local rotation', describeValue(node.getLocalEulerAngles()));
    push(section, 'local scale', describeValue(node.getLocalScale()));
    push(section, 'world position', describeValue(node.getPosition()));
    push(section, 'world rotation', describeValue(node.getEulerAngles()));
    push(section, 'world scale', describeValue(node.getScale()));
    push(section, 'forward', describeValue(node.forward));

    return section;
}

/**
 * @param {string} name - The component name.
 * @param {Component} component - The component.
 * @returns {PropertySection} The component section.
 */
function componentSection(name, component) {
    const section = makeSection(`c:${name}`, name);
    push(section, 'enabled', read(component, 'enabled'));
    // asset references first, with their ids resolved to the assets they name
    const assetProperties = pushAssetRows(section, component);

    const handled = [...SKIP_COMPONENT, ...assetProperties];

    // layer ids, named from the composition they belong to
    const layers = /** @type {any} */ (component).layers;
    if (Array.isArray(layers)) {
        const composition = /** @type {any} */ (component).system?.app?.scene?.layers ?? null;
        push(section, 'layers', layersValue(layers, composition));
        handled.push('layers');
    }

    // mesh instances open in place, down to the elements of a vertex format
    const instances = /** @type {any} */ (component).meshInstances;
    if (Array.isArray(instances) && instances.length) {
        push(section, 'meshInstances', meshInstancesValue(instances));
        handled.push('meshInstances');
    }

    reflectRows(section, component, [Component.prototype], handled);
    return section;
}

/**
 * The layers a component renders in. Components hold them as ids, which say nothing on their own,
 * so each is named from the scene's layer composition.
 *
 * @param {number[]} ids - The layer ids.
 * @param {LayerComposition|null} composition - The scene's composition.
 * @returns {Described} The layers, named.
 */
function layersValue(ids, composition) {
    if (ids.length === 0) return describeValue(ids);
    return {
        text: ids.map((id) => {
            const layer = composition?.getLayerById(id) ?? null;
            return layer ? `${layer.name} (${id})` : `#${id} (not in the composition)`;
        }).join(', '),
        cls: 'obj'
    };
}

/**
 * @param {import('../../platform/graphics/vertex-format.js').VertexFormat} format - A vertex format.
 * @returns {Described} The format, expanding into one row per element.
 */
function vertexFormatValue(format) {
    return {
        text: `${format.elements.length} elements, ${format.size} bytes per vertex${format.interleaved ? ', interleaved' : ''}`,
        cls: 'obj',
        expand: () => format.elements.map(element => ({
            key: element.name,
            label: element.name,
            value: {
                text: `${element.numComponents} × ${vertexTypesNames[element.dataType] ?? element.dataType}` +
                    `  offset ${element.offset}  stride ${element.stride}  size ${element.size}` +
                    `${element.normalize ? '  normalized' : ''}${element.asInt ? '  integer' : ''}`,
                cls: 'num'
            }
        }))
    };
}

/**
 * @param {{ type: number, base: number, baseVertex: number, count: number, indexed?: boolean }} primitive - A
 * primitive of a mesh.
 * @returns {string} What it draws, and from where.
 */
function primitiveText(primitive) {
    const { type, base, baseVertex, count, indexed } = primitive;
    return `${PRIMITIVE_NAMES[type] ?? type}  count ${count}  base ${base}` +
        `${baseVertex ? `  base vertex ${baseVertex}` : ''}${indexed ? '  indexed' : ''}`;
}

/**
 * The draw ranges of a mesh. Almost every mesh has exactly one, so a single primitive reads on the
 * row itself rather than hiding behind an entry.
 *
 * @param {{ type: number, base: number, baseVertex: number, count: number, indexed?: boolean }[]} primitives - The
 * primitives of a mesh.
 * @returns {Described} The primitives.
 */
function primitiveValue(primitives) {
    if (!Array.isArray(primitives) || primitives.length === 0) return describeValue(primitives);
    if (primitives.length === 1) return { text: primitiveText(primitives[0]), cls: 'num' };
    return {
        text: `${primitives.length} primitives`,
        cls: 'obj',
        items: primitives.map((primitive, index) => ({
            label: `[${index}]`,
            text: primitiveText(primitive),
            cls: 'num'
        }))
    };
}

/**
 * @param {Mesh} mesh - A mesh.
 * @returns {PropertyRow[]} Its rows, with the vertex format opening into its elements.
 */
function meshRows(mesh) {
    const rows = [];
    const vertexBuffer = mesh.vertexBuffer;
    const indexBuffer = mesh.indexBuffer?.[0];

    if (vertexBuffer) {
        pushRow(rows, 'vertex buffer', {
            text: `${vertexBuffer.numVertices} vertices, ${formatBytes(vertexBuffer.numBytes)}`,
            cls: 'num'
        });
        pushRow(rows, 'vertex format', vertexFormatValue(vertexBuffer.format));
    } else {
        pushRow(rows, 'vertex buffer', describeValue(null));
    }
    pushRow(rows, 'index buffer', indexBuffer ? {
        text: `${indexBuffer.numIndices} indices, ${INDEX_FORMAT_NAMES[indexBuffer.format] ?? indexBuffer.format}, ${formatBytes(indexBuffer.numBytes)}`,
        cls: 'num'
    } : describeValue(null));
    pushRow(rows, 'primitive', primitiveValue(mesh.primitive));

    reflectInto(rows, mesh, [], SKIP_MESH);
    return rows;
}

/**
 * @param {Material} material - A material.
 * @returns {PropertyRow[]} Its rows, textures and compiled variants linking to their tabs.
 */
function materialRows(material) {
    const rows = [];
    pushRow(rows, 'variants', describeValue([...material.variants.values()]));
    reflectInto(rows, material, [], SKIP_MATERIAL);
    return rows;
}

/**
 * @param {MeshInstance} instance - A mesh instance.
 * @returns {PropertyRow[]} Its rows, with the mesh and the material opening in place.
 */
function meshInstanceRows(instance) {
    const rows = [];
    const mesh = instance.mesh;
    const material = instance.material;

    pushRow(rows, 'node', read(instance, 'node'));
    pushRow(rows, 'mesh', mesh ? { ...describeValue(mesh), expand: () => meshRows(mesh) } : describeValue(mesh));
    pushRow(rows, 'material', material instanceof Material ?
        { ...describeValue(material), expand: () => materialRows(material) } : describeValue(material));
    pushRow(rows, 'visible', read(instance, 'visible'));
    reflectInto(rows, instance, [], SKIP_MESH_INSTANCE);
    return rows;
}

/**
 * The mesh instances of a component, as one row per instance that opens into its properties. The
 * value of each is the instance itself rather than a link to its node, since the node is one of
 * the rows it opens into.
 *
 * @param {MeshInstance[]} instances - The mesh instances.
 * @returns {Described} The list.
 */
function meshInstancesValue(instances) {
    return {
        text: `Array(${instances.length}) of MeshInstance`,
        cls: 'obj',
        items: instances.map((instance, index) => {
            const described = describeValue(instance, 1);
            delete described.target;
            return {
                label: `[${index}]`,
                ...described,
                expand: instance instanceof MeshInstance ? () => meshInstanceRows(instance) : undefined
            };
        })
    };
}

/**
 * @param {import('../../framework/components/script/component.js').ScriptComponent} scriptComponent - The script component.
 * @returns {PropertySection[]} One section per script instance.
 */
function scriptSections(scriptComponent) {
    const sections = [];
    const scripts = scriptComponent.scripts ?? [];

    scripts.forEach((script, index) => {
        const ctor = /** @type {any} */ (script.constructor);
        const name = ctor.scriptName ?? ctor.__name ?? ctor.name;
        const section = makeSection(`s:${index}:${name}`, `script › ${name}`);

        push(section, 'enabled', read(script, 'enabled'));

        if (script instanceof ScriptType) {
            // classic scripts declare their attributes up front
            for (const attribute in ctor.attributes?.index ?? {}) {
                push(section, attribute, read(script, attribute));
            }
        } else {
            reflectRows(section, script, [Script.prototype, ScriptType.prototype], SKIP_SCRIPT);
        }

        sections.push(section);
    });

    return sections;
}

/**
 * Everything the property view shows for a node: identity, transform, one section per component
 * and one per script instance. A component's mesh instances open in place, each into its own
 * properties, its mesh and its material.
 *
 * @param {GraphNode} node - The node.
 * @returns {PropertySection[]} The sections.
 */
function buildNodeModel(node) {
    const sections = [nodeSection(node), transformSection(node)];

    if (node instanceof Entity) {
        for (const name of Object.keys(node.c)) {
            const component = node.c[name];
            sections.push(componentSection(name, component));
            if (name === 'script') {
                sections.push(...scriptSections(/** @type {any} */ (component)));
            }
        }
    }

    return sections;
}

export { buildNodeModel };
