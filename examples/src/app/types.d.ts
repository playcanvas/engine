import type * as monaco from 'monaco-editor';
import type { editor } from 'monaco-editor';

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

declare global {
    interface Window {
        _scrolledToExample?: boolean;
        activeGraphicsDevice?: string;
        editor?: editor.IStandaloneCodeEditor;
        monaco: typeof monaco;
        preferredGraphicsDevice?: string;
    }
}

export {};
