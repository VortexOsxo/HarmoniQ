import * as Plotly from 'plotly.js-dist-min';

/**
 * Replaces Plotly's built-in pie/donut legend with a custom HTML legend that
 * clearly shows selected vs hidden segments (opacity + strikethrough).
 * Call this after every Plotly.newPlot call on a donut chart.
 */
export function attachCustomLegend(
    graphDiv: HTMLElement,
    labels: string[],
    colors: string[],
): void {
    const parent = graphDiv.parentElement!;
    parent.style.position = 'relative';

    parent.querySelector('.donut-custom-legend')?.remove();

    const legendDiv = document.createElement('div');
    legendDiv.className = 'donut-custom-legend';
    legendDiv.style.cssText = [
        'position: absolute',
        'right: 20px',
        'top: 50%',
        'transform: translateY(-50%)',
        'display: flex',
        'flex-direction: column',
        'gap: 10px',
        'z-index: 10',
    ].join('; ');

    const items: HTMLElement[] = labels.map((label, i) => {
        const item = document.createElement('div');
        item.style.cssText = [
            'display: flex',
            'align-items: center',
            'gap: 8px',
            'cursor: pointer',
            'user-select: none',
            'font-size: 14px',
            'transition: opacity 0.15s',
            'font-family: sans-serif',
        ].join('; ');

        const swatch = document.createElement('span');
        swatch.style.cssText = [
            `background: ${colors[i]}`,
            'display: inline-block',
            'width: 13px',
            'height: 13px',
            'border-radius: 3px',
            'flex-shrink: 0',
        ].join('; ');

        const text = document.createElement('span');
        text.textContent = label;

        item.appendChild(swatch);
        item.appendChild(text);
        legendDiv.appendChild(item);

        item.addEventListener('click', () => {
            const hidden: string[] = [...((graphDiv as any).layout?.hiddenlabels ?? [])];
            const idx = hidden.indexOf(label);
            if (idx >= 0) hidden.splice(idx, 1);
            else hidden.push(label);
            Plotly.relayout(graphDiv, { hiddenlabels: hidden } as any);
        });

        return item;
    });

    const syncVisuals = () => {
        const hidden: string[] = (graphDiv as any).layout?.hiddenlabels ?? [];
        items.forEach((item, i) => {
            const isHidden = hidden.includes(labels[i]);
            item.style.opacity = isHidden ? '0.3' : '1';
            (item.children[0] as HTMLElement).style.opacity = isHidden ? '0.3' : '1';
            (item.children[1] as HTMLElement).style.textDecoration = isHidden ? 'line-through' : 'none';
            (item.children[1] as HTMLElement).style.color = isHidden ? '#aaa' : '';
        });
    };

    (graphDiv as any).on('plotly_relayout', syncVisuals);
    parent.appendChild(legendDiv);
    syncVisuals();
}
