import type * as monaco from 'monaco-editor';
import type { editor } from 'monaco-editor';

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

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
