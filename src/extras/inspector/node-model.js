import { Component } from '../../framework/components/component.js';
import { Entity } from '../../framework/entity.js';
import { ScriptType } from '../../framework/script/script-type.js';
import { Script } from '../../framework/script/script.js';
import { Material } from '../../scene/materials/material.js';
import { MeshInstance } from '../../scene/mesh-instance.js';

import { describeValue } from './describe.js';
import { makeSection, push, read, reflectRows } from './model.js';

/** @import { GraphNode } from '../../scene/graph-node.js' */
/** @import { PropertySection } from './model.js' */

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
    reflectRows(section, component, [Component.prototype], SKIP_COMPONENT);
    return section;
}

/**
 * One collapsed section per mesh instance of a component, followed by one per distinct material
 * they use. Textures on a material are links that preview them in the viewport.
 *
 * @param {string} name - The component name.
 * @param {Component} component - A component with a `meshInstances` array, such as render or model.
 * @returns {PropertySection[]} The sections, none when the component has no mesh instances.
 */
function meshInstanceSections(name, component) {
    const sections = [];
    const instances = /** @type {any} */ (component).meshInstances;
    if (!Array.isArray(instances) || instances.length === 0) return sections;

    /** @type {Map<Material, string[]>} */
    const materials = new Map();

    instances.forEach((instance, index) => {
        if (!(instance instanceof MeshInstance)) return;
        const section = makeSection(`mi:${name}:${index}`, `${name} › mesh instance ${index}`, true);
        push(section, 'node', read(instance, 'node'));
        push(section, 'mesh', read(instance, 'mesh'));
        push(section, 'material', read(instance, 'material'));
        push(section, 'visible', read(instance, 'visible'));
        reflectRows(section, instance, [], SKIP_MESH_INSTANCE);
        sections.push(section);

        const material = instance.material;
        if (material instanceof Material) {
            const users = materials.get(material) ?? [];
            users.push(`mesh instance ${index}`);
            materials.set(material, users);
        }
    });

    let index = 0;
    for (const [material, users] of materials) {
        const section = makeSection(`mat:${name}:${index++}`, `${name} › ${material.constructor.name} "${material.name}"`, true);
        push(section, 'used by', describeValue(users));
        // the compiled variants, one per shader pass and define set, linking to the shaders tab
        push(section, 'variants', describeValue([...material.variants.values()]));
        reflectRows(section, material, [], SKIP_MATERIAL);
        sections.push(section);
    }

    return sections;
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
 * Everything the property view shows for a node: identity, transform, one section per component,
 * collapsed sections for a component's mesh instances and their materials, and one section per
 * script instance.
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
            sections.push(...meshInstanceSections(name, component));
            if (name === 'script') {
                sections.push(...scriptSections(/** @type {any} */ (component)));
            }
        }
    }

    return sections;
}

export { buildNodeModel };
