import {
    BindingTwoWay,
    BooleanInput,
    ColorPicker,
    LabelGroup,
    Panel,
    SelectInput,
    SliderInput
} from '@playcanvas/pcui/react';
import { useState } from 'react';

import {
    LIGHTSHAPE_DISK,
    LIGHTSHAPE_PUNCTUAL,
    LIGHTSHAPE_RECT,
    LIGHTSHAPE_SPHERE,
    PROJECTION_ORTHOGRAPHIC,
    PROJECTION_PERSPECTIVE
} from 'playcanvas';

/**
 * @import { Observer } from '@playcanvas/observer'
 * @import { ReactElement } from 'react'
 */

/**
 * @param {{ observer: Observer }} props - The control panel props.
 * @returns {ReactElement} The control panel.
 */
export function Controls({ observer }) {
    const [type, setType] = useState('spot');
    const [shape, setShape] = useState(LIGHTSHAPE_PUNCTUAL);
    const [proj, setProj] = useState(PROJECTION_PERSPECTIVE);

    // the gizmo draws area shapes in place of punctual ones, and no handles for a directional
    const area = shape !== LIGHTSHAPE_PUNCTUAL;
    const directional = type === 'directional';
    const editable = !directional || area;
    const cone = type === 'spot' && !area;

    return (
        <>
            <Panel headerText='Theme'>
                <LabelGroup text='Base'>
                    <ColorPicker
                        channels={4}
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.theme.base' }}
                    />
                </LabelGroup>
                <LabelGroup text='Occluded'>
                    <ColorPicker
                        channels={4}
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.theme.occluded' }}
                    />
                </LabelGroup>
                <LabelGroup text='Fill'>
                    <ColorPicker
                        channels={4}
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.theme.fill' }}
                    />
                </LabelGroup>
                <LabelGroup text='Primary'>
                    <ColorPicker
                        channels={4}
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.theme.primary' }}
                    />
                </LabelGroup>
                <LabelGroup text='Secondary'>
                    <ColorPicker
                        channels={4}
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.theme.secondary' }}
                    />
                </LabelGroup>
                <LabelGroup text='Tertiary'>
                    <ColorPicker
                        channels={4}
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.theme.tertiary' }}
                    />
                </LabelGroup>
                <LabelGroup text='Backdrop'>
                    <ColorPicker
                        channels={4}
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.theme.backdrop' }}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Layers'>
                {editable && (
                    <>
                        <LabelGroup text='Handles'>
                            <BooleanInput
                                type='toggle'
                                binding={new BindingTwoWay()}
                                link={{ observer, path: 'gizmo.handles' }}
                            />
                        </LabelGroup>
                        <LabelGroup text='Readout'>
                            <BooleanInput
                                type='toggle'
                                binding={new BindingTwoWay()}
                                link={{ observer, path: 'gizmo.readout' }}
                            />
                        </LabelGroup>
                    </>
                )}
                <LabelGroup text='Icon'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.icon' }}
                    />
                </LabelGroup>
                {!directional && (
                    <LabelGroup text='Ground Line'>
                        <BooleanInput
                            type='toggle'
                            binding={new BindingTwoWay()}
                            link={{ observer, path: 'gizmo.groundLine' }}
                        />
                    </LabelGroup>
                )}
                <LabelGroup text='Use Light Color'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.useLightColor' }}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Render'>
                <LabelGroup text='Line Thickness'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.lineThickness' }}
                        min={1}
                        max={10}
                        precision={1}
                    />
                </LabelGroup>
                {directional && !area && (
                    <LabelGroup text='Arrow Size'>
                        <SliderInput
                            binding={new BindingTwoWay()}
                            link={{ observer, path: 'gizmo.size' }}
                            min={0.2}
                            max={3}
                            precision={2}
                        />
                    </LabelGroup>
                )}
                {editable && (
                    <LabelGroup text='Handle Size'>
                        <SliderInput
                            binding={new BindingTwoWay()}
                            link={{ observer, path: 'gizmo.handleSize' }}
                            min={2}
                            max={20}
                            precision={1}
                        />
                    </LabelGroup>
                )}
                <LabelGroup text='Icon Size'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.iconSize' }}
                        min={8}
                        max={64}
                        precision={0}
                    />
                </LabelGroup>
            </Panel>
            {editable && (
                <Panel headerText='Snap'>
                    <LabelGroup text='Snap'>
                        <BooleanInput
                            type='toggle'
                            binding={new BindingTwoWay()}
                            link={{ observer, path: 'gizmo.snap' }}
                        />
                    </LabelGroup>
                    <LabelGroup text='Increment'>
                        <SliderInput
                            binding={new BindingTwoWay()}
                            link={{ observer, path: 'gizmo.snapIncrement' }}
                            min={0.05}
                            max={2}
                            precision={2}
                        />
                    </LabelGroup>
                    {cone && (
                        <LabelGroup text='Angle Increment'>
                            <SliderInput
                                binding={new BindingTwoWay()}
                                link={{ observer, path: 'gizmo.snapAngleIncrement' }}
                                min={1}
                                max={45}
                                precision={0}
                            />
                        </LabelGroup>
                    )}
                </Panel>
            )}
            <Panel headerText='Light'>
                <LabelGroup text='Type'>
                    <SelectInput
                        options={[
                            { v: 'directional', t: 'Directional' },
                            { v: 'omni', t: 'Omni' },
                            { v: 'spot', t: 'Spot' }
                        ]}
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'light.type' }}
                        onSelect={setType}
                    />
                </LabelGroup>
                <LabelGroup text='Shape'>
                    <SelectInput
                        type='number'
                        options={[
                            { v: LIGHTSHAPE_PUNCTUAL, t: 'Punctual' },
                            { v: LIGHTSHAPE_RECT, t: 'Rectangle' },
                            { v: LIGHTSHAPE_DISK, t: 'Disk' },
                            { v: LIGHTSHAPE_SPHERE, t: 'Sphere' }
                        ]}
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'light.shape' }}
                        onSelect={(value) => setShape(parseInt(value, 10) || LIGHTSHAPE_PUNCTUAL)}
                    />
                </LabelGroup>
                <LabelGroup text='Color'>
                    <ColorPicker
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'light.color' }}
                    />
                </LabelGroup>
                {type !== 'directional' && (
                    <LabelGroup text='Range'>
                        <SliderInput
                            binding={new BindingTwoWay()}
                            link={{ observer, path: 'light.range' }}
                            min={0.5}
                            max={15}
                            precision={1}
                        />
                    </LabelGroup>
                )}
                {type === 'spot' && (
                    <>
                        <LabelGroup text='Inner Angle'>
                            <SliderInput
                                binding={new BindingTwoWay()}
                                link={{ observer, path: 'light.innerConeAngle' }}
                                min={0}
                                max={90}
                            />
                        </LabelGroup>
                        <LabelGroup text='Outer Angle'>
                            <SliderInput
                                binding={new BindingTwoWay()}
                                link={{ observer, path: 'light.outerConeAngle' }}
                                min={0}
                                max={90}
                            />
                        </LabelGroup>
                    </>
                )}
            </Panel>
            <Panel headerText='Camera'>
                <LabelGroup text='Projection'>
                    <SelectInput
                        options={[
                            { v: PROJECTION_PERSPECTIVE + 1, t: 'Perspective' },
                            { v: PROJECTION_ORTHOGRAPHIC + 1, t: 'Orthographic' }
                        ]}
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'camera.proj' }}
                        onSelect={(value) => setProj((parseInt(value, 10) || 1) - 1)}
                    />
                </LabelGroup>
                {proj === PROJECTION_PERSPECTIVE && (
                    <LabelGroup text='FOV'>
                        <SliderInput
                            binding={new BindingTwoWay()}
                            link={{ observer, path: 'camera.fov' }}
                            min={30}
                            max={100}
                        />
                    </LabelGroup>
                )}
            </Panel>
        </>
    );
}
