const fs = require('fs');
const path = 'src/mappers/canonical-to-uad.mapper.ts';
let content = fs.readFileSync(path, 'utf8');

const regex = /function mapSubjectProperty\(doc: CanonicalReportDocument\): UadSubjectProperty \{([\s\S]*?)\n\}/;
const match = content.match(regex);

if (match && !match[1].includes('disasterMitigation: ')) {
  console.log("Need to update mapSubjectProperty");
}
