'use strict'

import powerbi from "powerbi-visuals-api"
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions
import IVisualHost = powerbi.extensibility.visual.IVisualHost
import ISelectionId = powerbi.extensibility.ISelectionId


export interface VData {
    //array with data points where every point has their own category with a value
    items: VDataItem[],
    minValue: number,
    maxValue: number,
    target: number,
    formatString: string, 
}

export interface VDataItem {
    category: string,
    value: number,
    color: string,
    selectionId: ISelectionId,
    highlighted: boolean
}

/* export function transformData(options: VisualUpdateOptions, host: IVisualHost, defaultColor: string): VData {
    let data: VData
    try {
        const dv = options.dataViews[0].categorical
        console.log(dv)

        const minValue = Math.min(<number>dv.values[0].minLocal, <number>dv.values[1].minLocal) 
        const maxValue = Math.max(<number>dv.values[0].maxLocal, <number>dv.values[1].maxLocal)
        console.log(minValue, maxValue)

        // Check for null or undefined and then for type
        if (dv.values[0].minLocal === null || dv.values[0].minLocal === undefined ||
            dv.values[1].minLocal === null || dv.values[1].minLocal === undefined) {
            
            this.minValue = Math.min(<number>dv.values[0].min, <number>dv.values[1].min)
            //throw new Error('minLocal is null or undefined.');
        }

        if (typeof dv.values[0].minLocal !== 'number' || typeof dv.values[1].minLocal !== 'number') {

            throw new Error('minLocal is not a number.');
        }
        
       
        const target = <number>dv.values[1].values[0]
        const items: VDataItem[] = []
        let color: string

        for (let i = 0; i < dv.categories[0].values.length; i++) {
            try {
                color = dv.categories[0].objects[i].lollipopSettings.dataPointColor['solid'].color //i konsolen kan du se färgkoden för varje object här
            }
            catch(error) {
                color = defaultColor
            }
            const selectionId = host.createSelectionIdBuilder()
                .withCategory(dv.categories[0], i)
                .createSelectionId()
            const highlighted = !!(dv.values[0].highlights && dv.values[0].highlights[i]) //detta är pga boolean
            items.push({
                category: <string>dv.categories[0].values[i],
                value: <number>dv.values[0].values[i],
                color,
                selectionId,
                highlighted
            })
        }
        data = {
            items,
            minValue,
            maxValue,
            target,
            formatString: dv.values[0].source.format || '',
        }
        console.log(data)
    } catch (error) {
        console.error('Error in transformData:', error);
        data = {
            items: [],
            minValue: 0,
            maxValue: 0,
            target: 0,
            formatString: '',
        }
    }
    return data
} */

export function transformData(options: VisualUpdateOptions, host: IVisualHost, defaultColor: string): VData {
    let data: VData;
    try {
        const dv = options.dataViews[0].categorical;

        let minValue, maxValue;

        if (dv.values[0].minLocal !== null && dv.values[0].minLocal !== undefined &&
            dv.values[1].minLocal !== null && dv.values[1].minLocal !== undefined &&
            typeof dv.values[0].minLocal === 'number' && typeof dv.values[1].minLocal === 'number') {

            minValue = Math.min(<number>dv.values[0].minLocal, <number>dv.values[1].minLocal);
            maxValue = Math.max(<number>dv.values[0].maxLocal, <number>dv.values[1].maxLocal);

        } else {
            // Fall back to min if minLocal is null or undefined or not a number
            minValue = dv.values[0].min
            maxValue = dv.values[0].max
        }

        const target = <number>dv.values[1].values[0];
        const items: VDataItem[] = [];
        let color: string;

        for (let i = 0; i < dv.categories[0].values.length; i++) {
            try {
                color = dv.categories[0].objects[i].lollipopSettings.dataPointColor['solid'].color;
            } catch(error) {
                color = defaultColor;
            }
            const selectionId = host.createSelectionIdBuilder()
                .withCategory(dv.categories[0], i)
                .createSelectionId();
            const highlighted = !!(dv.values[0].highlights && dv.values[0].highlights[i]);
            items.push({
                category: <string>dv.categories[0].values[i],
                value: <number>dv.values[0].values[i],
                color,
                selectionId,
                highlighted
            });
        }
        data = {
            items,
            minValue,
            maxValue,
            target,
            formatString: dv.values[0].source.format || '',
        };
    } catch (error) {
        console.error('Error in transformData:', error);
        data = {
            items: [],
            minValue: 0,
            maxValue: 0,
            target: 0,
            formatString: '',
        };
    }
    return data;
}