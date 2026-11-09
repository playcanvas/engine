import {
    BindingTwoWay,
    ColorPicker,
    LabelGroup,
    Panel,
    SelectInput,
    SliderInput
} from '@playcanvas/pcui/react';

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
            <LabelGroup text='Renderer'>
                <SelectInput
                    type='number'
                    binding={new BindingTwoWay()}
                    link={{ observer, path: 'renderer' }}
                    value={observer.get('renderer') ?? 0}
                    options={[
                        { v: 0, t: 'Auto' },
                        { v: 1, t: 'Raster (CPU Sort)' },
                        { v: 2, t: 'Raster (GPU Sort)' }
                    ]}
                />
            </LabelGroup>
            <Panel headerText='Annotations'>
                <LabelGroup text='Hotspot Size'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.hotspotSize' }}
                        min={10}
                        max={50}
                    />
                </LabelGroup>
                <LabelGroup text='Hotspot Color'>
                    <ColorPicker
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.hotspotColor' }}
                    />
                </LabelGroup>
                <LabelGroup text='Hover Color'>
                    <ColorPicker
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.hoverColor' }}
                    />
                </LabelGroup>
                <LabelGroup text='Opacity'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.opacity' }}
                        min={0}
                        max={1}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='Behind Opacity'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.behindOpacity' }}
                        min={0}
                        max={1}
                        precision={2}
                    />
                </LabelGroup>
            </Panel>
        </>
    );
}
