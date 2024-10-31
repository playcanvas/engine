import * as pc from 'playcanvas';

/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export function controls({ observer, ReactPCUI, React, jsx, fragment }) {
    const { BindingTwoWay, LabelGroup, Panel, SliderInput, SelectInput, ColorPicker } = ReactPCUI;

    const [type, setType] = React.useState('translate');
    const [proj, setProj] = React.useState(pc.PROJECTION_PERSPECTIVE);

    // @ts-ignore
    window.setType = (/** @type {string} */ value) => setType(value);

    // @ts-ignore
    window.setProj = (/** @type {number} */ value) => setProj(value);

    return fragment(
        jsx(
            Panel,
            { headerText: 'Transform' },
            jsx(
                LabelGroup,
                { text: 'Type' },
                jsx(SelectInput, {
                    options: [
                        { v: 'translate', t: 'Translate' },
                        { v: 'rotate', t: 'Rotate' },
                        { v: 'scale', t: 'Scale' }
                    ],
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.type' },
                    onSelect: setType
                })
            ),
            (type === 'translate' || type === 'rotate') &&
                jsx(
                    LabelGroup,
                    { text: 'Coord Space' },
                    jsx(SelectInput, {
                        options: [
                            { v: 'world', t: 'World' },
                            { v: 'local', t: 'Local' }
                        ],
                        binding: new BindingTwoWay(),
                        link: { observer, path: 'gizmo.coordSpace' }
                    })
                ),
            jsx(
                LabelGroup,
                { text: 'Size' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.size' },
                    min: 0.1,
                    max: 10.0
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Snap Increment' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.snapIncrement' },
                    min: 1,
                    max: 10,
                    precision: 0
                })
            )
        ),
        jsx(
            Panel,
            { headerText: 'Grid' },
            jsx(
                LabelGroup,
                { text: 'Size' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'grid.size' },
                    min: 1,
                    max: 10,
                    precision: 0
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Color X' },
                jsx(ColorPicker, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'grid.colorX' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Color Z' },
                jsx(ColorPicker, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'grid.colorZ' }
                })
            )
        ),
        jsx(
            Panel,
            { headerText: 'Camera' },
            jsx(
                LabelGroup,
                { text: 'Projection' },
                jsx(SelectInput, {
                    options: [
                        { v: pc.PROJECTION_PERSPECTIVE + 1, t: 'Perspective' },
                        { v: pc.PROJECTION_ORTHOGRAPHIC + 1, t: 'Orthographic' }
                    ],
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'camera.proj' },
                    onSelect: value => setProj((parseInt(value, 10) || 1) - 1)
                })
            ),
            proj === pc.PROJECTION_PERSPECTIVE &&
                jsx(
                    LabelGroup,
                    { text: 'FOV' },
                    jsx(SliderInput, {
                        binding: new BindingTwoWay(),
                        link: { observer, path: 'camera.fov' },
                        min: 30,
                        max: 100
                    })
                )
        )
    );
}
