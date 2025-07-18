async function loadSVG(svgPath, targetContainerId) {
    try {
        const response = await fetch(svgPath);
        if (!response.ok) throw new Error('SVG load failed');
        
        const svgText = await response.text();        
        const container = document.getElementById(targetContainerId);
        container.innerHTML = svgText;
        
        const svgElement = container.querySelector('svg');
        if (svgElement) {
            svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');
            
            svgElement.classList.add('loaded-svg');            
            return svgElement;
        }
    } catch (error) {
        console.error('Error loading SVG:', error);
        return null;
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const svg = await loadSVG('assets/images/joy.svg', 'svg-container');
    
    if (svg) {
    }
});