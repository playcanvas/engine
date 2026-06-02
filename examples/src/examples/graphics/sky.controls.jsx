import {
    BindingTwoWay,
    BooleanInput,
    VectorInput,
    LabelGroup,
    Panel,
    SliderInput,
    SelectInput
} from '@playcanvas/pcui/react';

import * as pc from 'playcanvas';

/**
 * @import { Observer } from '@playcanvas/observer'
 * @import { ReactElement } from 'react'
 */

/**
 * @param {{ observer: Observer }} props - The control panel props.
 * @returns {ReactElement} The control panel.
 */
export function Controls({ observer }) {
    return (
        <>
            <Panel headerText='Sky'>
                <LabelGroup text='Preset'>
                    <SelectInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.skybox.preset' }}
                        type='string'
                        options={[
                            { v: 'Street Dome', t: 'Street Dome' },
                            { v: 'Street Infinite', t: 'Street Infinite' },
                            { v: 'Room', t: 'Room' }
                        ]}
                    />
                </LabelGroup>
                <LabelGroup text='Type'>
                    <SelectInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.skybox.type' }}
                        type='string'
                        options={[
                            { v: pc.SKYTYPE_INFINITE, t: 'Infinite' },
                            { v: pc.SKYTYPE_BOX, t: 'Box' },
                            { v: pc.SKYTYPE_DOME, t: 'Dome' }
                        ]}
                    />
                </LabelGroup>
                <LabelGroup text='Exposure'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.skybox.exposure' }}
                        min={0}
                        max={3}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='Rotation'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.skybox.rotation' }}
                        min={0}
                        max={360}
                        precision={0}
                    />
                </LabelGroup>
                <LabelGroup text='Scale'>
                    <VectorInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.skybox.scale' }}
                        value={[1, 1, 1]}
                        precision={1}
                    />
                </LabelGroup>
                <LabelGroup text='Position'>
                    <VectorInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.skybox.position' }}
                        value={[0, 0, 0]}
                        precision={1}
                    />
                </LabelGroup>
                <LabelGroup text='Tripod Y'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.skybox.tripodY' }}
                        min={0}
                        max={1}
                        precision={2}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Color Enhance'>
                <LabelGroup text='enabled'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.colorEnhance.enabled' }}
                    />
                </LabelGroup>
                <LabelGroup text='shadows'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.colorEnhance.shadows' }}
                        min={-3}
                        max={3}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='highlights'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.colorEnhance.highlights' }}
                        min={-3}
                        max={3}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='midtones'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.colorEnhance.midtones' }}
                        min={-1}
                        max={1}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='vibrance'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.colorEnhance.vibrance' }}
                        min={-1}
                        max={1}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='dehaze'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.colorEnhance.dehaze' }}
                        min={-1}
                        max={1}
                        precision={2}
                    />
                </LabelGroup>
            </Panel>
        </>
    );
}
