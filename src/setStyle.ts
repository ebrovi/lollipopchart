'use strict'

import {VisualSettings} from "./settings" 

// här deklareras --namnen för allt som används i visual.less 

export function setStyle(settings: VisualSettings): void {
    const style = document.documentElement.style

    style.setProperty('--default-color', settings.lollipopSettings.defaultColor),
    style.setProperty('--data-point-color', settings.lollipopSettings.dataPointColor),
    style.setProperty('--line-width', `${settings.lollipopSettings.lineWidth}`),
    style.setProperty('--font-family', settings.lollipopSettings.fontFamily),
    style.setProperty('--font-size', `${settings.lollipopSettings.fontSize}pt`),
    style.setProperty('--font-color', settings.lollipopSettings.fontColor),
    style.setProperty('--data-font-color', settings.lollipopSettings.dataFontColor),
    style.setProperty('--data-font-size', `${settings.lollipopSettings.dataFontSize}pt`),
    style.setProperty('--data-font-family', settings.lollipopSettings.dataFontFamily)
}