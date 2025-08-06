import * as pc from 'playcanvas';

/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export const controls = ({ observer, ReactPCUI, React, jsx, fragment }) => {
    const { BindingTwoWay, LabelGroup, Panel, ColorPicker, SliderInput, SelectInput, BooleanInput } = ReactPCUI;
    const { useState } = React;

    const [proj, setProj] = useState(pc.PROJECTION_PERSPECTIVE);

    return fragment(
        jsx(
            Panel,
            { headerText: 'Transform' },
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
            ),
            jsx(
                LabelGroup,
                { text: 'Orbit Rotation' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.orbitRotation' }
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
                    channels: 4,
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.xAxisColor' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Y Axis' },
                jsx(ColorPicker, {
                    channels: 4,
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.yAxisColor' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Z Axis' },
                jsx(ColorPicker, {
                    channels: 4,
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.zAxisColor' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'X Hover' },
                jsx(ColorPicker, {
                    channels: 4,
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.xHoverColor' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Y Hover' },
                jsx(ColorPicker, {
                    channels: 4,
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.yHoverColor' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Z Hover' },
                jsx(ColorPicker, {
                    channels: 4,
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.zHoverColor' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Disabled' },
                jsx(ColorPicker, {
                    channels: 4,
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.disabledColor' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'X Guide' },
                jsx(ColorPicker, {
                    channels: 4,
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.xGuideColor' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Y Guide' },
                jsx(ColorPicker, {
                    channels: 4,
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.yGuideColor' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Z Guide' },
                jsx(ColorPicker, {
                    channels: 4,
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.zGuideColor' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Shading' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.shading' }
                })
            )
        ),
        jsx(
            Panel,
            { headerText: 'Intersection' },
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
            jsx(
                LabelGroup,
                { text: 'XYZ Tube Radius' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.xyzTubeRadius' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'XYZ Ring Radius' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.xyzRingRadius' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Face Tube Radius' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gizmo.faceTubeRadius' }
                })
            ),
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
};
