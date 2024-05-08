/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export function controls({ observer, ReactPCUI, React, jsx, fragment }) {
    const { BindingTwoWay, Panel, Label, Button } = ReactPCUI;
    return fragment(
        jsx(
            Panel,
            { headerText: 'WebGPU' },
            jsx(Button, {
                text: 'Add',
                onClick: () => observer.emit('add:webgpu')
            }),
            jsx(Button, {
                text: 'Remove',
                onClick: () => observer.emit('remove:webgpu')
            }),
            jsx(Label, {
                binding: new BindingTwoWay(),
                link: { observer, path: 'webgpu' },
                value: observer.get('webgpu')
            })
        ),
        jsx(
            Panel,
            { headerText: 'WebGL 2' },
            jsx(Button, {
                text: 'Add',
                onClick: () => observer.emit('add:webgl2')
            }),
            jsx(Button, {
                text: 'Remove',
                onClick: () => observer.emit('remove:webgl2')
            }),
            jsx(Label, {
                binding: new BindingTwoWay(),
                link: { observer, path: 'webgl2' },
                value: observer.get('webgl2')
            })
        ),
        jsx(
            Panel,
            { headerText: 'Null' },
            jsx(Button, {
                text: 'Add',
                onClick: () => observer.emit('add:null')
            }),
            jsx(Button, {
                text: 'Remove',
                onClick: () => observer.emit('remove:null')
            }),
            jsx(Label, {
                binding: new BindingTwoWay(),
                link: { observer, path: 'null' },
                value: observer.get('null')
            })
        )
    );
}
