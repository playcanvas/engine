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

import { PROJECTION_ORTHOGRAPHIC, PROJECTION_PERSPECTIVE } from 'playcanvas';

/**
 * @import { Observer } from '@playcanvas/observer'
 * @import { ReactElement } from 'react'
 */

/**
 * @param {{ observer: Observer }} props - The control panel props.
 * @returns {ReactElement} The control panel.
 */
export function Controls({ observer }) {
    const [proj, setProj] = useState(PROJECTION_PERSPECTIVE);

    return (
        <>
            <Panel headerText='Icon'>
                <LabelGroup text='Component'>
                    <SelectInput
                        options={[
                            { v: 'camera', t: 'Camera' },
                            { v: 'light', t: 'Light' },
                            { v: 'audiolistener', t: 'Audio Listener' },
                            { v: 'sound', t: 'Sound' },
                            { v: 'particlesystem', t: 'Particle System' }
                        ]}
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'icon' }}
                    />
                </LabelGroup>
                <LabelGroup text='Light Color'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.useLightColor' }}
                    />
                </LabelGroup>
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
                <LabelGroup text='Backdrop'>
                    <ColorPicker
                        channels={4}
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gizmo.theme.backdrop' }}
                    />
                </LabelGroup>
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
