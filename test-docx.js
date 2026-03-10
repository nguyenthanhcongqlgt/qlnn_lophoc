const { Document, Packer, Paragraph, TextRun } = require('docx');
async function run() {
    try {
        const doc = new Document({
            sections: [{
                properties: {},
                children: [
                    new Paragraph({ text: "Hello" }),
                    new Paragraph({ children: [new TextRun({ text: "World" })] })
                ]
            }]
        });
        const buffer = await Packer.toBuffer(doc);
        console.log("SUCCESS, buffer size:", buffer.length);
    } catch (e) {
        console.error("ERROR:", e);
    }
}
run();
