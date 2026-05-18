import type * as monaco from 'monaco-editor';
import type { editor } from 'monaco-editor';

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

declare module '*.frag?raw' {
    const text: string;
    export default text;
}

declare module '*.vert?raw' {
    const text: string;
    export default text;
}

declare module '*.wgsl?raw' {
    const text: string;
    export default text;
}

declare module '*.glsl?raw' {
    const text: string;
    export default text;
}

declare module '*.html?raw' {
    const text: string;
    export default text;
}

declare module '*.css?raw' {
    const text: string;
    export default text;
}

declare module '*.txt?raw' {
    const text: string;
    export default text;
}

declare module '*?url' {
    const url: string;
    export default url;
}

declare module '*.json' {
    const data: JsonValue;
    export default data;
}

declare global {
    interface Window {
        _scrolledToExample?: boolean;
        editor?: editor.IStandaloneCodeEditor;
        monaco: typeof monaco;
        preferredGraphicsDevice?: string;
    }
}

export {};
