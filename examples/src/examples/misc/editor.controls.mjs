import * as pc from 'playcanvas';

/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export const controls = ({ observer, ReactPCUI, React, jsx, fragment }) => {
    const { BindingTwoWay, LabelGroup, Panel, SliderInput, SelectInput, ColorPicker } = ReactPCUI;
    const { useState } = React;

    const [type, setType] = useState('translate');
    const [proj, setProj] = useState(pc.PROJECTION_PERSPECTIVE);

    // observe changes to the camera and gizmo type
    observer.on('*:set', (/** @type {string} */ path, /** @type {any} */ value) => {
        const [category, key] = path.split('.');
        switch (category) {
            case 'camera': {
                switch (key) {
                    case 'proj':
                        setType(value);
                        break;
                }
                break;
            }
            case 'gizmo': {
                switch (key) {
                    case 'type':
                        setType(value);
                        break;
                }
                break;
            }
        }
    });

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
        ),
        jsx(
            Panel,
            { headerText: 'Grid' },
            jsx(
                LabelGroup,
                { text: 'Resolution' },
                jsx(SelectInput, {
                    options: [
                        { v: 3, t: 'High' },
                        { v: 2, t: 'Medium' },
                        { v: 1, t: 'Low' }
                    ],
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'grid.resolution' }
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
            { headerText: 'View Cube' },
            jsx(
                LabelGroup,
                { text: 'Color X' },
                jsx(ColorPicker, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'viewCube.colorX' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Color Y' },
                jsx(ColorPicker, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'viewCube.colorY' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Color Z' },
                jsx(ColorPicker, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'viewCube.colorZ' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Radius' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'viewCube.radius' },
                    min: 10,
                    max: 50
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Text Size' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'viewCube.textSize' },
                    min: 1,
                    max: 50
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Line Thickness' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'viewCube.lineThickness' },
                    min: 1,
                    max: 20
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Line Length' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'viewCube.lineLength' },
                    min: 10,
                    max: 200
                })
            )
        )
    );
};
