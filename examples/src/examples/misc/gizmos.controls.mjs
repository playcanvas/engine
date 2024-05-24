import * as pc from 'playcanvas';

/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export function controls({ observer, ReactPCUI, React, jsx, fragment }) {
    const { BindingTwoWay, LabelGroup, Panel, ColorPicker, SliderInput, SelectInput } = ReactPCUI;

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
                    max: 2.0
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
            { headerText: 'Color' },
            jsx(
                LabelGroup,
                { text: 'X Axis' },
                jsx(ColorPicker, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.xAxisColor' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Y Axis' },
                jsx(ColorPicker, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.yAxisColor' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Z Axis' },
                jsx(ColorPicker, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.zAxisColor' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Color Alpha' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.colorAlpha' },
                    min: 0,
                    max: 1,
                    precision: 2
                })
            )
        ),
        jsx(
            Panel,
            { headerText: 'Intersection' },
            (type === 'translate' || type === 'scale') &&
                jsx(
                    LabelGroup,
                    { text: 'Line Tolerance' },
                    jsx(SliderInput, {
                        binding: new BindingTwoWay(),
                        link: { observer, path: 'gizmo.axisLineTolerance' },
                        min: 0,
                        max: 0.5,
                        precision: 2
                    })
                ),
            (type === 'translate' || type === 'scale') &&
                jsx(
                    LabelGroup,
                    { text: 'Center Tolerance' },
                    jsx(SliderInput, {
                        binding: new BindingTwoWay(),
                        link: { observer, path: 'gizmo.axisCenterTolerance' },
                        min: 0,
                        max: 0.5,
                        precision: 2
                    })
                ),
            type === 'rotate' &&
                jsx(
                    LabelGroup,
                    { text: 'Ring Tolerance' },
                    jsx(SliderInput, {
                        binding: new BindingTwoWay(),
                        link: { observer, path: 'gizmo.ringTolerance' },
                        min: 0,
                        max: 0.5,
                        precision: 2
                    })
                )
        ),
        jsx(
            Panel,
            { headerText: 'Render' },
            (type === 'translate' || type === 'scale') &&
                jsx(
                    LabelGroup,
                    { text: 'Gap' },
                    jsx(SliderInput, {
                        binding: new BindingTwoWay(),
                        link: { observer, path: 'gizmo.axisGap' }
                    })
                ),
            (type === 'translate' || type === 'scale') &&
                jsx(
                    LabelGroup,
                    { text: 'Line Thickness' },
                    jsx(SliderInput, {
                        binding: new BindingTwoWay(),
                        link: { observer, path: 'gizmo.axisLineThickness' }
                    })
                ),
            (type === 'translate' || type === 'scale') &&
                jsx(
                    LabelGroup,
                    { text: 'Line Length' },
                    jsx(SliderInput, {
                        binding: new BindingTwoWay(),
                        link: { observer, path: 'gizmo.axisLineLength' }
                    })
                ),
            type === 'scale' &&
                jsx(
                    LabelGroup,
                    { text: 'Box Size' },
                    jsx(SliderInput, {
                        binding: new BindingTwoWay(),
                        link: { observer, path: 'gizmo.axisBoxSize' }
                    })
                ),
            type === 'translate' &&
                jsx(
                    LabelGroup,
                    { text: 'Arrow Thickness' },
                    jsx(SliderInput, {
                        binding: new BindingTwoWay(),
                        link: { observer, path: 'gizmo.axisArrowThickness' }
                    })
                ),
            type === 'translate' &&
                jsx(
                    LabelGroup,
                    { text: 'Arrow Length' },
                    jsx(SliderInput, {
                        binding: new BindingTwoWay(),
                        link: { observer, path: 'gizmo.axisArrowLength' }
                    })
                ),
            (type === 'translate' || type === 'scale') &&
                jsx(
                    LabelGroup,
                    { text: 'Plane Size' },
                    jsx(SliderInput, {
                        binding: new BindingTwoWay(),
                        link: { observer, path: 'gizmo.axisPlaneSize' }
                    })
                ),
            (type === 'translate' || type === 'scale') &&
                jsx(
                    LabelGroup,
                    { text: 'Plane Gap' },
                    jsx(SliderInput, {
                        binding: new BindingTwoWay(),
                        link: { observer, path: 'gizmo.axisPlaneGap' }
                    })
                ),
            (type === 'translate' || type === 'scale') &&
                jsx(
                    LabelGroup,
                    { text: 'Center Size' },
                    jsx(SliderInput, {
                        binding: new BindingTwoWay(),
                        link: { observer, path: 'gizmo.axisCenterSize' }
                    })
                ),
            type === 'rotate' &&
                jsx(
                    LabelGroup,
                    { text: 'XYZ Tube Radius' },
                    jsx(SliderInput, {
                        binding: new BindingTwoWay(),
                        link: { observer, path: 'gizmo.xyzTubeRadius' }
                    })
                ),
            type === 'rotate' &&
                jsx(
                    LabelGroup,
                    { text: 'XYZ Ring Radius' },
                    jsx(SliderInput, {
                        binding: new BindingTwoWay(),
                        link: { observer, path: 'gizmo.xyzRingRadius' }
                    })
                ),
            type === 'rotate' &&
                jsx(
                    LabelGroup,
                    { text: 'Face Tube Radius' },
                    jsx(SliderInput, {
                        binding: new BindingTwoWay(),
                        link: { observer, path: 'gizmo.faceTubeRadius' }
                    })
                ),
            type === 'rotate' &&
                jsx(
                    LabelGroup,
                    { text: 'Face Ring Radius' },
                    jsx(SliderInput, {
                        binding: new BindingTwoWay(),
                        link: { observer, path: 'gizmo.faceRingRadius' },
                        max: 2
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
