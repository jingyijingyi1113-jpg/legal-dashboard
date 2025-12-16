const pptxgen = require('pptxgenjs');
const html2pptx = require('/Users/jingyiding/.codebuddy/skills/document-skills/pptx/scripts/html2pptx');
const path = require('path');

async function createMergedSlide() {
    const pptx = new pptxgen();
    pptx.layout = 'LAYOUT_16x9';
    pptx.author = 'Codebuddy';
    pptx.title = '前期进展合并';

    const slidesDir = path.join(__dirname, 'slides');

    // Create merged slide
    await html2pptx(path.join(slidesDir, 'merged_slide.html'), pptx);

    // Save
    const outputPath = path.join(__dirname, 'merged_slide.pptx');
    await pptx.writeFile({ fileName: outputPath });
    console.log('Merged slide created: ' + outputPath);
}

createMergedSlide().catch(console.error);
