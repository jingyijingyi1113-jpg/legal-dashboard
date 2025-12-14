const pptxgen = require('pptxgenjs');
const html2pptx = require('/Users/jingyiding/.codebuddy/skills/document-skills/pptx/scripts/html2pptx');
const path = require('path');

async function createPresentation() {
    const pptx = new pptxgen();
    pptx.layout = 'LAYOUT_16x9';
    pptx.author = '法务部门';
    pptx.title = '工时管理系统汇报';
    pptx.subject = '工时管理系统功能介绍';

    const slidesDir = '/Users/jingyiding/CodeBuddy/20251127100303/ppt_slides';
    
    const slides = [
        'slide1.html',  // 封面
        'slide2.html',  // 项目背景
        'slide3.html',  // 解决方案概述
        'slide4.html',  // 核心功能模块
        'slide5.html',  // 系统价值
        'slide6.html',  // 技术架构
        'slide7.html',  // 感谢页
    ];

    for (const slideFile of slides) {
        const htmlPath = path.join(slidesDir, slideFile);
        console.log(`Processing: ${slideFile}`);
        try {
            await html2pptx(htmlPath, pptx);
        } catch (err) {
            console.error(`Error processing ${slideFile}:`, err.message);
        }
    }

    const outputPath = '/Users/jingyiding/CodeBuddy/20251127100303/工时管理系统汇报.pptx';
    await pptx.writeFile({ fileName: outputPath });
    console.log(`\nPresentation created: ${outputPath}`);
}

createPresentation().catch(console.error);
