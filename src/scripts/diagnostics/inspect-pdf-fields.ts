/**
 * inspect-pdf-fields.ts
 *
 * Dumps every AcroForm field from a fillable PDF so the mapper keys can be
 * verified / updated against the real Fannie Mae Form 1004.
 *
 * Usage:
 *   npx ts-node --project tsconfig.json src/scripts/diagnostics/inspect-pdf-fields.ts \
 *     docs/samples/Form1004_Fillable.pdf
 *
 * Output is written to stdout (pipe to a file if needed):
 *   npx ts-node src/scripts/diagnostics/inspect-pdf-fields.ts docs/samples/Form1004_Fillable.pdf \
 *     > tsc-1004-fields.txt
 *
 * If the PDF is owner-password-protected (locked against editing) but still has
 * readable metadata, pass the password as the second argument:
 *   ... inspect-pdf-fields.ts <file.pdf> <password>
 */

import * as fs from 'fs';
import * as path from 'path';
import { PDFDocument, PDFTextField, PDFCheckBox, PDFRadioGroup, PDFDropdown, PDFOptionList } from 'pdf-lib';

async function inspect(filePath: string, password?: string): Promise<void> {
  const absPath = path.resolve(filePath);

  if (!fs.existsSync(absPath)) {
    console.error(`File not found: ${absPath}`);
    process.exit(1);
  }

  const bytes = fs.readFileSync(absPath);

  let pdfDoc: PDFDocument;
  try {
    pdfDoc = await PDFDocument.load(bytes, {
      ignoreEncryption: true,           // read fields even if owner-locked
      ...(password ? { password } : {}),
    });
  } catch (err) {
    console.error('Failed to load PDF:', err instanceof Error ? err.message : err);
    console.error(
      '\nIf the PDF is password-protected, pass the password as the second argument:\n' +
      '  npx ts-node src/scripts/inspect-pdf-fields.ts <file.pdf> <password>',
    );
    process.exit(1);
  }

  const form = pdfDoc.getForm();
  const fields = form.getFields();

  if (fields.length === 0) {
    console.log('⚠  No AcroForm fields found in this PDF.');
    console.log('   The form may be flattened (non-fillable) or use XFA instead of AcroForm.');
    console.log('   For XFA forms, pdf-lib cannot enumerate fields — use Adobe Acrobat to inspect.');
    return;
  }

  console.log(`\nPDF: ${path.basename(absPath)}`);
  console.log(`Pages: ${pdfDoc.getPageCount()}`);
  console.log(`Total AcroForm fields: ${fields.length}`);
  console.log('─'.repeat(90));
  console.log(
    'INDEX'.padEnd(6) +
    'TYPE'.padEnd(20) +
    'FIELD NAME'.padEnd(50) +
    'DEFAULT VALUE',
  );
  console.log('─'.repeat(90));

  fields.forEach((field, i) => {
    const name = field.getName();
    let type = 'Unknown';
    let defaultVal = '';

    if (field instanceof PDFTextField) {
      type = 'TextField';
      try { defaultVal = field.getText() ?? ''; } catch { /* locked */ }
    } else if (field instanceof PDFCheckBox) {
      type = 'CheckBox';
      try { defaultVal = field.isChecked() ? 'checked' : 'unchecked'; } catch { /* locked */ }
    } else if (field instanceof PDFRadioGroup) {
      type = 'RadioGroup';
      try { defaultVal = field.getSelected() ?? ''; } catch { /* locked */ }
    } else if (field instanceof PDFDropdown) {
      type = 'Dropdown';
      try { defaultVal = field.getSelected().join(', '); } catch { /* locked */ }
    } else if (field instanceof PDFOptionList) {
      type = 'OptionList';
      try { defaultVal = field.getSelected().join(', '); } catch { /* locked */ }
    }

    console.log(
      String(i + 1).padEnd(6) +
      type.padEnd(20) +
      name.padEnd(50) +
      defaultVal.slice(0, 30),
    );
  });

  console.log('─'.repeat(90));
  console.log(`\n✓ Done. ${fields.length} fields listed above.`);
  console.log('\nTo update urar-1004.mapper.ts, replace the provisional field key strings');
  console.log('with the exact "FIELD NAME" values from the table above.\n');
}

// ─── Entry point ──────────────────────────────────────────────────────────────
const [, , filePath, password] = process.argv;
if (!filePath) {
  console.error('Usage: npx ts-node src/scripts/inspect-pdf-fields.ts <file.pdf> [password]');
  process.exit(1);
}

inspect(filePath, password).catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
