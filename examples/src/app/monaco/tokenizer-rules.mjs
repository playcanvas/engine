export const jsRules = {
    jsdoc: [
        [/@\w+/, 'keyword'],
        [/(\})([^-]+)(?=-)/, ['comment.doc', 'identifier']],
        [/\{/, 'comment.doc', '@jsdocBrackets'],
        [/\*\//, 'comment.doc', '@pop'],
        [/./, 'comment.doc']
    ],
    jsdocBrackets: [
        [/(@link)([^}]+)/, ['keyword', 'identifier']],
        [/\{/, 'comment.doc', '@push'],
        [/\}/, 'comment.doc', '@pop'],
        [/./, 'type.identifier']
    ]
};
