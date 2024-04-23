export const jsdoc = [
    [/@\w+/, 'keyword'],
    [/(\}\s*)(\w+)/, ['comment.doc', 'identifier']],
    [/(\{)([^\}]+)(?=\})/, ['comment.doc', 'type.identifier']],
    [/\*\//, 'comment.doc', '@pop'],
    [/./, 'comment.doc']
];
