// Serialises a TypeDoc JSON model (`typedoc --json`) into a stable, sorted, full-signature text
// view of the public API. Because it consumes TypeDoc's model, it inherits the docs' public-API
// rules (excludeNotDocumented, @ignore, @private, the custom typedoc plugin) — so internal/ignored
// symbols are absent. Usage: `node utils/api-surface.mjs <typedoc.json>` → surface on stdout.

import { readFileSync } from 'node:fs';

// TypeDoc ReflectionKind values we serialise at the top level
const NAMESPACE = 4, ENUM = 8, VARIABLE = 32, FUNCTION = 64, CLASS = 128, INTERFACE = 256;
const CONSTRUCTOR = 512, PROPERTY = 1024, METHOD = 2048, ACCESSOR = 262144, TYPE_ALIAS = 2097152;
const TOP = [NAMESPACE, ENUM, VARIABLE, FUNCTION, CLASS, INTERFACE, TYPE_ALIAS];

const flags = r => r.flags || {};

function typeStr(t) {
    if (!t) return 'unknown';
    switch (t.type) {
        case 'intrinsic': return t.name;
        case 'literal': return typeof t.value === 'string' ? JSON.stringify(t.value) : `${t.value}`;
        case 'reference': return t.name + (t.typeArguments?.length ? `<${t.typeArguments.map(typeStr).join(', ')}>` : '');
        case 'array': return `${typeStr(t.elementType)}[]`;
        case 'union': return t.types.map(typeStr).join(' | ');
        case 'intersection': return t.types.map(typeStr).join(' & ');
        case 'tuple': return `[${(t.elements || []).map(typeStr).join(', ')}]`;
        case 'query': return `typeof ${typeStr(t.queryType)}`;
        case 'indexedAccess': return `${typeStr(t.objectType)}[${typeStr(t.indexType)}]`;
        case 'typeOperator': return `${t.operator} ${typeStr(t.target)}`;
        case 'reflection': return reflStr(t.declaration);
        case 'templateLiteral': return 'string';
        case 'mapped': return '{ [mapped]: … }';
        case 'predicate': return 'boolean';
        default: return t.name || t.type || 'unknown';
    }
}

function reflStr(decl) {
    if (!decl) return 'object';
    if (decl.signatures?.length) return `(${params(decl.signatures[0])}) => ${typeStr(decl.signatures[0].type)}`;
    if (decl.children?.length) return `{ ${decl.children.map(c => `${c.name}: ${typeStr(c.type)}`).join('; ')} }`;
    return 'object';
}

function params(sig) {
    return (sig.parameters || []).map((p) => {
        const f = flags(p);
        return `${f.isRest ? '...' : ''}${p.name}${f.isOptional ? '?' : ''}: ${typeStr(p.type)}`;
    }).join(', ');
}

function typeParams(r) {
    return r.typeParameters?.length ?
        `<${r.typeParameters.map(p => p.name + (p.type ? ` extends ${typeStr(p.type)}` : '')).join(', ')}>` : '';
}

// one member of a class/interface → one or more lines (overloads, get+set)
function member(r) {
    const f = flags(r);
    const pre = (f.isStatic ? 'static ' : '') + (f.isReadonly ? 'readonly ' : '');
    if (r.kind === CONSTRUCTOR) return r.signatures.map(s => `constructor(${params(s)})`);
    if (r.kind === METHOD) return r.signatures.map(s => `${pre}${r.name}${typeParams(s)}(${params(s)}): ${typeStr(s.type)}`);
    if (r.kind === ACCESSOR) {
        const out = [];
        if (r.getSignature) out.push(`${pre}get ${r.name}(): ${typeStr(r.getSignature.type)}`);
        if (r.setSignature) out.push(`${pre}set ${r.name}(${params(r.setSignature)})`);
        return out;
    }
    if (r.kind === PROPERTY) return [`${pre}${r.name}${f.isOptional ? '?' : ''}: ${typeStr(r.type)}`];
    return [];
}

// flat, fully-qualified lines so each entry is self-contained in a diff (e.g. `Vec3.add(...)`)
function decl(r) {
    switch (r.kind) {
        case CLASS:
        case INTERFACE: {
            const kw = r.kind === CLASS ? 'class' : 'interface';
            const ext = r.extendedTypes?.length ? ` extends ${r.extendedTypes.map(typeStr).join(', ')}` : '';
            return [`${kw} ${r.name}${typeParams(r)}${ext}`,
                ...(r.children || []).flatMap(member).map(m => `${r.name}.${m}`)];
        }
        case FUNCTION: return (r.signatures || []).map(s => `function ${r.name}${typeParams(s)}(${params(s)}): ${typeStr(s.type)}`);
        case VARIABLE: return [`const ${r.name}: ${typeStr(r.type)}`];
        case TYPE_ALIAS: return [`type ${r.name}${typeParams(r)} = ${typeStr(r.type)}`];
        case ENUM: return [`enum ${r.name}`, ...(r.children || []).map(c => `${r.name}.${c.name}`)];
        case NAMESPACE: return [`namespace ${r.name}`,
            ...(r.children || []).filter(c => TOP.includes(c.kind)).flatMap(decl).map(l => `${r.name}.${l}`)];
        default: return [];
    }
}

const json = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const lines = (json.children || []).filter(r => TOP.includes(r.kind)).flatMap(decl).sort();
process.stdout.write(`${lines.join('\n')}\n`);
