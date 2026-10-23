type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

declare module '*.json' {
    const data: JsonValue;
    export default data;
}

declare module '*.frag' {
    const data: string;
    export default data;
}

declare module '*.vert' {
    const data: string;
    export default data;
}

declare module '*.wgsl' {
    const data: string;
    export default data;
}

declare module '*.glsl' {
    const data: string;
    export default data;
}

declare module '*.html' {
    const data: string;
    export default data;
}

declare module '*.css' {
    const data: string;
    export default data;
}

declare module '*.txt' {
    const data: string;
    export default data;
}

// modules loaded from a url, such as a library imported for its side effects
declare module 'https://*';
