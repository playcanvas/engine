import { BindingTwoWay, LabelGroup, Panel, SliderInput } from '@playcanvas/pcui/react';

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
        <Panel headerText='Tiles'>
            <LabelGroup text='Error Target'>
                <SliderInput
                    binding={new BindingTwoWay()}
                    link={{ observer, path: 'data.tiles.errorTarget' }}
                    min={1}
                    max={32}
                    precision={0}
                />
            </LabelGroup>
        </Panel>
    );
}
