/*
*  Power BI Visual CLI
*
*  Copyright (c) Microsoft Corporation
*  All rights reserved.
*  MIT License
*
*  Permission is hereby granted, free of charge, to any person obtaining a copy
*  of this software and associated documentation files (the ""Software""), to deal
*  in the Software without restriction, including without limitation the rights
*  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
*  copies of the Software, and to permit persons to whom the Software is
*  furnished to do so, subject to the following conditions:
*
*  The above copyright notice and this permission notice shall be included in
*  all copies or substantial portions of the Software.
*
*  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
*  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
*  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
*  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
*  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
*  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
*  THE SOFTWARE.
*/
"use strict";

import "./../style/visual.less";
import powerbi from "powerbi-visuals-api";
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import EnumerateVisualObjectInstancesOptions = powerbi.EnumerateVisualObjectInstancesOptions;
import VisualObjectInstance = powerbi.VisualObjectInstance;
import DataView = powerbi.DataView;
import VisualObjectInstanceEnumerationObject = powerbi.VisualObjectInstanceEnumerationObject;
import VisualEnumerationInstanceKinds = powerbi.VisualEnumerationInstanceKinds;
import IVisualHost = powerbi.extensibility.visual.IVisualHost
import ISelectionId = powerbi.extensibility.ISelectionId
import ISelectionManager = powerbi.extensibility.ISelectionManager
import {valueFormatter, textMeasurementService} from "powerbi-visuals-utils-formattingutils";
import measureSvgTextWidth = textMeasurementService.measureSvgTextWidth;

import { Selection, select, selectAll, BaseType} from "d3-selection";
import { ScalePoint, scalePoint, ScaleLinear, scaleLinear} from "d3-scale"; // ScalePoint är klassen, scalePoint är funktionen
import { transition, Transition} from "d3-transition"
import { easeLinear } from "d3-ease"
import { dataViewWildcard } from "powerbi-visuals-utils-dataviewutils";

import { VisualSettings } from "./settings";
import { setStyle } from "./setStyle";
import { transformData, VData} from "./transformdata";

export class Visual implements IVisual {
    private target: HTMLElement
    private host: IVisualHost
    private sm: ISelectionManager //selectionManager
    private settings: VisualSettings
    private data: VData
    private svg: Selection<SVGElement, any, HTMLElement, any>
    private scaleX: ScalePoint<string>
    private scaleY: ScaleLinear<number, number>
    private dim: [number, number]
    private transition: Transition<BaseType, unknown, null, undefined>

    constructor(options: VisualConstructorOptions) {
        this.target = options.element; // element är vanligtvis HTMLcontainern där visualiseringen kommer renderas
        this.host = options.host;
        this.sm = this.host.createSelectionManager();
        if (document) { //HTMLdokumentet - ser till att det finns en DOM document object model att ändra
            this.svg = select(this.target).append('svg')
        }
    }

    public update(options: VisualUpdateOptions) {
        this.settings = Visual.parseSettings(options && options.dataViews && options.dataViews[0]);

        this.data = transformData(options, this.host, this.settings.lollipopSettings.dataPointColor) 

        setStyle(this.settings)
        this.dim = [options.viewport.width, options.viewport.height]
        this.svg.attr('width', this.dim[0])   // detta gör att hela svg rutan blir ljusgrå som vi definerat i "css" filen svg.less
        this.svg.attr('height', this.dim[1])


        //scales
        const targetLabelWidth = this.getTextWidth(this.formatMeasure(this.data.target, this.data.formatString))
        this.scaleX = scalePoint()
        .domain(Array.from(this.data.items, d => d.category))
        .range([0, this.dim[0]-targetLabelWidth-this.settings.lollipopSettings.fontSize/2])
        .padding(0.5)

        const strokeGap = this.settings.lollipopSettings.lineWidth
        this.scaleY = scaleLinear()
        .domain([this.data.minValue, this.data.maxValue]) // linear alltid min och max
        .range([
            this.dim[1] - this.settings.lollipopSettings.radius - strokeGap - (this.settings.lollipopSettings.fontSize*2), 
            this.settings.lollipopSettings.radius + strokeGap + (this.settings.lollipopSettings.fontSize*2)
        ]) 
        
        this.transition = transition().duration(500).ease(easeLinear)

        this.drawTarget()
        this.drawTargetLabel()
        const connectors = this.drawConnectors()
        const dataPoints = this.drawDataPoints()
        const catLabels = this.drawCategoryLabels()
        this.drawDataLabel()
        
      
        //highlight support 

        let isHighlighted = false  // detta är för att highlighta i grafen när något klickas på i tabellen
        for (let d of this.data.items) {
            if (d.highlighted == true) {
                isHighlighted = true 
                break
            }
        }
        if (isHighlighted) {
            dataPoints.style('stroke-opacity', d => (d.highlighted) ? 1 : 0.5)
            dataPoints.style('fill-opacity', d => (d.highlighted) ? 1 : 0.5)
            connectors.style('stroke-opacity', d => (d.highlighted) ? 1 : 0.5)
            catLabels.style('fill-opacity', d => (d.highlighted) ? 1 : 0.5)
        } else if (!this.sm.hasSelection()) {
            dataPoints.style('stroke-opacity', 1)
            dataPoints.style('fill-opacity', 1)
            connectors.style('stroke-opacity', 1)
            catLabels.style('fill-opacity', 1)
        }

    }

    private static parseSettings(dataView: DataView): VisualSettings {
        return <VisualSettings>VisualSettings.parse(dataView);
    }

 
    private drawTarget() {
        let targetLine = this.svg.selectAll('line.target-line').data([this.data.target]) 
        // selects all SVG <line> elements with the class target-line inside the this.svg container.

        targetLine.enter().append('line') //två punkter. Enter är endast för nya element
            .classed('target-line', true) //ger klassen target-line
            .attr('x1', 0)
            .attr('y1', this.scaleY(this.data.target))
            .attr('x2', this.scaleX.range()[1])
            .attr('y2', this.scaleY(this.data.target))

        targetLine.transition(this.transition)      // för att updatera position
            .attr('y1', this.scaleY(this.data.target))
            .attr('x2', this.scaleX.range()[1])
            .attr('y2', this.scaleY(this.data.target))

        targetLine.exit().remove(); //tar bort linjer med data som inte har korresponderande data
    }

    

   private drawCategoryLabels(){
        // här skapas namnen som står längstmed linjen

        // this.dim[1] = hela svg i y-led i pixlar
        // this.scaleY(this.data.target) = target labels pos i pixlar
        // this.scaleY(d.value) = datapoints position i pixlar

        const catLabels = this.svg.selectAll('text.category-label').data(this.data.items)

        catLabels.enter().append('text')
            .classed('category-label', true)
            .attr('ix', (d,i) => i)
            .attr('x', d => this.scaleX(d.category))
            .attr('y', (d, i) => {

                if (d.value > this.data.target) { // om värdet är större än target ska labeln stå under linjen (0 beräknas uppifrån) då det är ett positivt värde
                    
                    if ((this.scaleY(this.data.target) - this.scaleY(d.value)) <= this.settings.lollipopSettings.radius) { 
      
                        //  om (TARGET LINES POSITION - DATAPUNKTENS POSITION PÅ Y-AXELN) < RADIEN så nuddar datapunkten targetline
                        //  och texten ska placeras en bit ifrån punkten
                        //  Math.abs(this.scaleY(this.data.target)-this.scaleY(d.value)-this.settings.lollipopSettings.radius = antalet pixlar som punkten sticker ut över linjen

                        return this.scaleY(this.data.target) + this.settings.lollipopSettings.fontSize + Math.abs(this.scaleY(this.data.target)-this.scaleY(d.value)-this.settings.lollipopSettings.radius)
                    }
                    else {
                        return this.scaleY(this.data.target) + this.settings.lollipopSettings.fontSize
                    }
                } 
                else if (d.value < this.data.target) { // om värdet är mindre än target ska labeln stå över linjen (0 beräknas uppifrån) då det är ett negativt värde

                    if (this.scaleY(d.value) - (this.scaleY(this.data.target)) <= this.settings.lollipopSettings.radius) { 

                        //  om (DATAPUNKTENS POSITION PÅ Y-AXELN - TARGET LINES POSITION ) <= RADIEN så nuddar datapunkten targetline
                        //  och texten ska placeras en bit ifrån punkten
                        //  Math.abs(Math.abs(this.scaleY(d.value) - this.scaleY(this.data.target)-this.settings.lollipopSettings.radius blir antalet pixlar som punkten sticker ut över linjen

                        return this.scaleY(this.data.target) - this.settings.lollipopSettings.fontSize - Math.abs(this.scaleY(d.value) - this.scaleY(this.data.target)-this.settings.lollipopSettings.radius)
                    }
                    else {
                        return this.scaleY(this.data.target) - this.settings.lollipopSettings.fontSize
                    }

                }
                else { // om värdet ligger på linjen
                    return this.scaleY(this.data.target) + this.settings.lollipopSettings.fontSize + this.settings.lollipopSettings.radius
                } 
            })
            .text(d => d.category)
            .style('fill', this.settings.lollipopSettings.fontColor)

        catLabels.transition(this.transition)
            .attr('ix', (d,i) => i)
            .attr('x', d => this.scaleX(d.category))
            .attr('y', (d, i) => {
                

                if (d.value > this.data.target) { // om värdet är större än target ska labeln stå under linjen (0 beräknas uppifrån) då det är ett positivt värde
                    
                    if ((this.scaleY(this.data.target) - this.scaleY(d.value)) <= this.settings.lollipopSettings.radius) { 

                        //  om (TARGET LINES POSITION - DATAPUNKTENS POSITION PÅ Y-AXELN) < RADIEN så nuddar datapunkten targetline
                        //  och texten ska placeras en bit ifrån punkten
                        //  Math.abs(this.scaleY(this.data.target)-this.scaleY(d.value)-this.settings.lollipopSettings.radius = antalet pixlar som punkten sticker ut över linjen

                        return this.scaleY(this.data.target) + this.settings.lollipopSettings.fontSize + Math.abs(this.scaleY(this.data.target)-this.scaleY(d.value)-this.settings.lollipopSettings.radius)
                    }
                    else {
                        return this.scaleY(this.data.target) + this.settings.lollipopSettings.fontSize
                    }
                } 
                else if (d.value < this.data.target) { // om värdet är mindre än target ska labeln stå över linjen (0 beräknas uppifrån) då det är ett negativt värde

                    if (this.scaleY(d.value) - (this.scaleY(this.data.target)) <= this.settings.lollipopSettings.radius) { 
                        //  om (DATAPUNKTENS POSITION PÅ Y-AXELN - TARGET LINES POSITION ) <= RADIEN så nuddar datapunkten targetline
                        //  och texten ska placeras en bit ifrån punkten
                        //  Math.abs(Math.abs(this.scaleY(d.value) - this.scaleY(this.data.target)-this.settings.lollipopSettings.radius blir antalet pixlar som punkten sticker ut över linjen

                        return this.scaleY(this.data.target) - this.settings.lollipopSettings.fontSize - Math.abs(this.scaleY(d.value) - this.scaleY(this.data.target)-this.settings.lollipopSettings.radius)
                    }
                    else {
                        return this.scaleY(this.data.target) - this.settings.lollipopSettings.fontSize
                    }

                }
                else { // om värdet ligger på linjen
                    return this.scaleY(this.data.target) + this.settings.lollipopSettings.fontSize + this.settings.lollipopSettings.radius
                } 
            })
            .text(d => d.category)
            .style('fill', this.settings.lollipopSettings.fontColor)

        catLabels.exit().remove();
        return catLabels
    }

    private drawTargetLabel() {
        const targetLabel = this.svg.selectAll('text.target-label').data([this.data.target])

        targetLabel.enter().append('text')
            .classed('target-label', true)
            .attr('x', this.scaleX.range()[1] + this.settings.lollipopSettings.fontSize/2) // punkt 2 + lite space. Vill ha labeln i slutet av linjen
            .attr('y', this.scaleY(this.data.target)) //punkt 2
            .text(this.formatMeasure(this.data.target, this.data.formatString))
            .style('fill', this.settings.lollipopSettings.fontColor)

        targetLabel.transition(this.transition)
            .attr('x', this.scaleX.range()[1] + this.settings.lollipopSettings.fontSize/2) 
            .attr('y', this.scaleY(this.data.target)) 
            .text(this.formatMeasure(this.data.target, this.data.formatString))
            .style('fill', this.settings.lollipopSettings.fontColor)

        targetLabel.exit().remove();
    }
    

    private drawDataLabel() {
        const dataLabel = this.svg.selectAll('text.data-label').data(this.data.items)

        dataLabel.enter().append('text')
            .classed('data-label', true)
            .attr('x', d => this.scaleX(d.category))
            .attr('y', d => {
                if (d.value >= this.data.target) {
                    const yPos = this.scaleY(d.value) - this.settings.lollipopSettings.radius - this.settings.lollipopSettings.fontSize - 
                    this.settings.lollipopSettings.lineWidth
                    return yPos
                }
                else if (d.value < this.data.target) {
                    const yPos = this.scaleY(d.value) + this.settings.lollipopSettings.radius + this.settings.lollipopSettings.fontSize + 
                    this.settings.lollipopSettings.lineWidth + (this.settings.lollipopSettings.dataFontSize*0.3)
                    return yPos
                }
            } )
            .text(d => {
                if (this.settings.lollipopSettings.dataLabelEnabled) {
                    return d.value
                }
            })
            .style('fill', this.settings.lollipopSettings.dataFontColor)

        dataLabel.transition(this.transition)
            .attr('x', d => this.scaleX(d.category))
            .attr('y', d => {
               if (d.value >= this.data.target) {
                    const yPos = this.scaleY(d.value) - this.settings.lollipopSettings.radius - this.settings.lollipopSettings.fontSize - 
                    this.settings.lollipopSettings.lineWidth
                    return yPos
                }
                else if (d.value < this.data.target) {
                    const yPos = this.scaleY(d.value) + this.settings.lollipopSettings.radius + this.settings.lollipopSettings.fontSize + 
                    this.settings.lollipopSettings.lineWidth + (this.settings.lollipopSettings.dataFontSize*0.3)
                    return yPos
                }
            } )
            .text(d => {
                if (this.settings.lollipopSettings.dataLabelEnabled) {
                    return d.value
                }
            })
            .style('fill', this.settings.lollipopSettings.dataFontColor)

        dataLabel.exit().remove();   
             
    }


    private drawDataPoints() {
        const dataPoints = this.svg.selectAll('circle.data-point').data(this.data.items);
    
        dataPoints.enter().append('circle')
            .classed('data-point', true)
            .attr('ix', (d, i) => i)
            .attr('cx', d => this.scaleX(d.category))
            .attr('cy', d => {
                const cyValue = this.scaleY(d.value);
                if (isNaN(cyValue) || cyValue === undefined) {
                    console.log("ScaleY Domain:", this.scaleY.domain());
                    console.log("ScaleY Range:", this.scaleY.range());
                    console.log("Try reloading visual")
                    console.error('Invalid value for cy ', cyValue, d);
                    return 0; // Default fallback
                }
                return cyValue})
            .attr('r', this.settings.lollipopSettings.radius)
            .style('fill', d => {
                if (this.settings.lollipopSettings.gradientEnabled) {
                    const gradientId = `gradientColor${d.category.replace(/[^a-zA-Z0-9]/g, '')}`; // Generate a unique gradient id based on the category
                    this.applyGradient(gradientId, d.color); // Pass the unique gradient id and color
                    return `url(#${gradientId})`;
                }
                else {
                    return d.color
                }
                
            })
            .on('mouseover.tooltip', (e) => {
                const d = <{ category: string, value: number }>select(e.target).data()[0];
                this.host.tooltipService.show({
                    coordinates: [e.clientX, e.clientY],
                    identities: [],
                    isTouchEvent: false,
                    dataItems: [{
                        displayName: d.category,
                        value: this.formatMeasure(d.value, this.data.formatString)
                    }]
                });
            })
            .on('mouseout', (e) => {
                this.host.tooltipService.hide({
                    isTouchEvent: false,
                    immediately: true
                });
            })
            .on('click', (e) => {
                const el = select(e.target);
                const ix = el.attr('ix');
                const d = <{ selectionId: ISelectionId }>el.data()[0];
                this.sm.select(d.selectionId).then((selected) => {
                    selectAll('.data-point')
                        .style('fill-opacity', selected.length > 0 ? 0.5 : 1)
                        .style('stroke-opacity', selected.length > 0 ? 0.5 : 1);
                    selectAll('.connector')
                        .style('stroke-opacity', selected.length > 0 ? 0.5 : 1);
                    selectAll('.category-label')
                        .style('fill-opacity', selected.length > 0 ? 0.5 : 1);
                    el.style('fill-opacity', 1)
                        .style('stroke-opacity', 1);
                    select(`.connector[ix='${ix}']`)
                        .style('stroke-opacity', 1);
                    select(`.category-label[ix='${ix}']`)
                        .style('fill-opacity', 1);
                });
            });
    
        dataPoints.transition(this.transition)
            .attr('cx', d => this.scaleX(d.category))
            .attr('cy', d => {
                const cyValue = this.scaleY(d.value);
                if (isNaN(cyValue) || cyValue === undefined) {
                    console.error('Invalid value for cy ', cyValue, {d});
                    return 0; // Default fallback
                }
                return cyValue})
            .attr('r', this.settings.lollipopSettings.radius)
            .style('fill', d => {
                if (this.settings.lollipopSettings.gradientEnabled) {
                    const gradientId = `gradientColor${d.category.replace(/[^a-zA-Z0-9]/g, '')}`; // Generate a unique gradient id based on the category
                    this.applyGradient(gradientId, d.color); // Pass the unique gradient id and color
                    return `url(#${gradientId})`;
                }
                else {
                    return d.color
                }
                
            })
    
        dataPoints.exit().remove();
        return dataPoints;
    }
    

    private drawConnectors() {
        const connectors = this.svg.selectAll('line.connector').data(this.data.items)

        connectors.enter().append('line')
        .classed('connector', true)
        .attr('ix', (d,i) => i)
        .attr('x1', d => this.scaleX(d.category))
        .attr('y1', d => this.scaleY(this.data.target))
        .attr('x2', d => this.scaleX(d.category))
        .attr('y2', d => {
            if (Math.abs(this.scaleY(this.data.target) - this.scaleY(d.value)) <= this.settings.lollipopSettings.radius) {
                return this.scaleY(this.data.target)
            } else if (this.scaleY(this.data.target) > this.scaleY(d.value)) {
                return this.scaleY(d.value) + this.settings.lollipopSettings.radius
            } else 
                return this.scaleY(d.value) - this.settings.lollipopSettings.radius
        })

        connectors.transition(this.transition)
        .attr('x1', d => this.scaleX(d.category))
        .attr('y1', d => this.scaleY(this.data.target))
        .attr('x2', d => this.scaleX(d.category))
        .attr('y2', d => {
            if (Math.abs(this.scaleY(this.data.target) - this.scaleY(d.value)) <= this.settings.lollipopSettings.radius) {
                return this.scaleY(this.data.target)
            } else if (this.scaleY(this.data.target) > this.scaleY(d.value)) {
                return this.scaleY(d.value) + this.settings.lollipopSettings.radius
            } else 
                return this.scaleY(d.value) - this.settings.lollipopSettings.radius
            
        })

        connectors.exit().remove()
        return connectors
    }

    private applyGradient(gradientId: string, dataPointColor: string) {
        let gradient = this.svg.select(`#${gradientId}`);
        const gradientColor = this.settings.lollipopSettings.gradientColor;
    
        if (gradient.empty()) {
            gradient = this.svg.append("defs")
                .append("linearGradient")
                .attr("id", gradientId);
        }
    
        gradient.attr("x1", "0%")
            .attr("y1", "0%")
            .attr("x2", "100%")
            .attr("y2", "100%");
    
        let stop1 = gradient.select("stop:first-child");
        let stop2 = gradient.select("stop:last-child");
    
        if (stop1.empty()) {
            stop1 = gradient.append("stop").attr("offset", "30%");
        }
    
        if (stop2.empty()) {
            stop2 = gradient.append("stop").attr("offset", "100%");
        }
    
        stop1.attr("stop-color", dataPointColor)
             .attr("stop-opacity", 1);
    
        stop2.attr("stop-color", gradientColor)
             .attr("stop-opacity", 1);
    }

    private formatMeasure(measure: Number, fs: string): string { // :string definerar att det vi returnerar är en sträng
        const formatter = valueFormatter.create({format: fs})
        return formatter.format(measure)
    }

    private getTextWidth(txt: string): number {
        const textProperties = {
            text: txt,
            fontFamily: this.settings.lollipopSettings.fontFamily,
            fontSize: `${this.settings.lollipopSettings.fontSize}pt`
        }
        return measureSvgTextWidth(textProperties)
    }

    /**
     * This function gets called for each of the objects defined in the capabilities files and allows you to select which of the
     * objects and properties you want to expose to the users in the property pane.
     *
     */
    public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstance[] | VisualObjectInstanceEnumerationObject {
        //return VisualSettings.enumerateObjectInstances(this.settings || VisualSettings.getDefault(), options);
        const objectName: string = options.objectName
        const objectEnumeration: VisualObjectInstance[] = []

        switch(objectName) {
            case 'lollipopSettings': 
            // endast ett case då i pbi under visual så finns endast lollipop settings
                objectEnumeration.push ({
                    objectName,
                    properties: {
                        defaultColor: this.settings.lollipopSettings.defaultColor
                    },
                    selector: null
                }),
                objectEnumeration.push ({
                    objectName,
                    properties: {
                        dataPointColor: this.settings.lollipopSettings.dataPointColor
                    },
                    selector: dataViewWildcard.createDataViewWildcardSelector(dataViewWildcard.DataViewWildcardMatchingOption.InstancesAndTotals),
                    altConstantValueSelector: this.settings.lollipopSettings.dataPointColor,  
                    propertyInstanceKind: { // Detta är vad som blir "fx knappen" conditional formatting 
                        dataPointColor: VisualEnumerationInstanceKinds.ConstantOrRule  /// Här defineras det om färgen ska vara solid eller enligt field view. Gradient fungerar inte 
                    }
                }), 
                objectEnumeration.push ({
                    objectName,
                    properties: {
                        radius: this.settings.lollipopSettings.radius,
                        lineWidth: this.settings.lollipopSettings.lineWidth,
                        fontSize: this.settings.lollipopSettings.fontSize,
                        fontFamily: this.settings.lollipopSettings.fontFamily,
                        fontColor: this.settings.lollipopSettings.fontColor,
                        gradientEnabled: this.settings.lollipopSettings.gradientEnabled,
                        gradientColor: this.settings.lollipopSettings.gradientColor,
                        dataLabelEnabled: this.settings.lollipopSettings.dataLabelEnabled,
                        dataFontSize: this.settings.lollipopSettings.dataFontSize,
                        dataFontColor: this.settings.lollipopSettings.dataFontColor,
                        dataFontFamily:this.settings.lollipopSettings.dataFontFamily
                    },
                    selector: null
                })
                break
        } 

        return objectEnumeration
    }
}