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
            svgElement.style.maxHeight = '100%';
            
            svgElement.style.display = 'block';
            svgElement.style.margin = '0 auto';
            
            window.addEventListener('resize', () => {
                adjustSvgSize(svgElement);
            });
            
            adjustSvgSize(svgElement);
            
            return svgElement;
        }
    } catch (error) {
        console.error('Error loading SVG:', error);
        return null;
    }
}

function adjustSvgSize(svgElement) {
    const container = svgElement.parentElement;
    const containerRatio = container.offsetWidth / container.offsetHeight;
    const svgRatio = svgElement.viewBox.baseVal.width / svgElement.viewBox.baseVal.height;
    
    if (containerRatio > svgRatio) {
        svgElement.style.width = 'auto';
        svgElement.style.height = '100%';
    } else {
        svgElement.style.width = '100%';
        svgElement.style.height = 'auto';
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const svg = await loadSVG('assets/images/joy.svg', 'svg-container');
    
    if (svg) {
    }
});