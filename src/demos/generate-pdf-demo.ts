/**
 * Demo: Generate PDF from Template
 * 
 * This script demonstrates generating a PDF from the ROV Value Increased template
 */

import { ROV_VALUE_INCREASED_TEMPLATE } from '../data/default-templates';
import { TemplateFormat, Template, TemplatePlaceholder } from '../types/template.types.js';
import * as fs from 'fs';
import * as path from 'path';
import PDFDocument from 'pdfkit';

/**
 * Standalone PDF renderer (no database dependency)
 */
async function renderTemplateToPdf(template: Partial<Template>, data: Record<string, any>): Promise<Buffer> {
  // Replace placeholders
  let content = template.content || '';
  
  for (const placeholder of template.placeholders || []) {
    const value = data[placeholder.key];
    if (value !== undefined && value !== null) {
      const regex = new RegExp(`\\{\\{${placeholder.key}\\}\\}`, 'g');
      content = content.replace(regex, String(value));
    }
  }

  // Create PDF
  const doc = new PDFDocument({
    size: 'LETTER',
    margins: { top: 50, bottom: 50, left: 50, right: 50 }
  });

  // Use Promise to handle stream completion properly
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Parse and render HTML
    renderHtmlToPdf(doc, content);

    doc.end();
  });
}

function renderHtmlToPdf(doc: InstanceType<typeof PDFDocument>, html: string): void {
  // Remove wrapper tags
  html = html.replace(/<\/?html[^>]*>/gi, '')
             .replace(/<\/?head[^>]*>/gi, '')
             .replace(/<\/?body[^>]*>/gi, '')
             .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  const lines = html.split(/\n/);
  
  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    // H2 heading
    if (line.match(/<h2[^>]*>/i)) {
      const text = stripHtmlTags(line);
      doc.fontSize(16).font('Helvetica-Bold').text(text, { underline: true });
      doc.moveDown(0.5);
      doc.font('Helvetica').fontSize(12);
      continue;
    }

    // H3 heading
    if (line.match(/<h3[^>]*>/i)) {
      const text = stripHtmlTags(line);
      doc.fontSize(14).font('Helvetica-Bold').text(text);
      doc.moveDown(0.3);
      doc.font('Helvetica').fontSize(12);
      continue;
    }

    // Table
    if (line.match(/<table[^>]*>/i)) {
      const tableHtml = extractTag(html, 'table');
      if (tableHtml) {
        renderTableToPdf(doc, tableHtml);
        html = html.replace(tableHtml, '');
      }
      continue;
    }

    // Paragraph
    if (line.match(/<p[^>]*>/i)) {
      const text = stripHtmlTags(line).trim();
      if (text) {
        const isBold = line.includes('<strong>') || line.includes('font-weight: bold');
        if (isBold) doc.font('Helvetica-Bold');
        
        doc.text(text, { align: 'left' });
        doc.moveDown(0.5);
        doc.font('Helvetica');
      }
      continue;
    }

    // Div
    if (line.match(/<div[^>]*>/i)) {
      const text = stripHtmlTags(line).trim();
      if (text) {
        doc.text(text);
        doc.moveDown(0.5);
      }
    }
  }
}

function extractTag(html: string, tagName: string): string | null {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = html.match(regex);
  return match ? match[0] : null;
}

function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, '')
             .replace(/&nbsp;/g, ' ')
             .replace(/&lt;/g, '<')
             .replace(/&gt;/g, '>')
             .replace(/&amp;/g, '&')
             .replace(/&quot;/g, '"');
}

function renderTableToPdf(doc: InstanceType<typeof PDFDocument>, tableHtml: string): void {
  const rows = tableHtml.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi);
  if (!rows) return;

  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  for (const row of rows) {
    if (!row) continue;
    const cells = row.match(/<td[^>]*>[\s\S]*?<\/td>/gi);
    if (!cells) continue;

    const cellWidth = pageWidth / cells.length;
    let currentX = doc.page.margins.left;
    const currentY = doc.y;

    for (const cell of cells) {
      const text = stripHtmlTags(cell);
      const hasBackground = cell.includes('background-color');
      const isBold = cell.includes('<strong>') || cell.includes('font-weight: bold');
      const hasBorder = cell.includes('border:');

      if (hasBackground) {
        doc.rect(currentX, currentY, cellWidth, 20).fill('#f0f0f0');
        doc.fillColor('black');
      }

      if (hasBorder) {
        doc.rect(currentX, currentY, cellWidth, 20).stroke();
      }

      if (isBold) doc.font('Helvetica-Bold');
      
      doc.text(text, currentX + 5, currentY + 5, {
        width: cellWidth - 10,
        height: 20,
        ellipsis: true
      });

      doc.font('Helvetica');
      currentX += cellWidth;
    }

    doc.y = currentY + 22;
  }

  doc.moveDown(0.5);
}

async function generateROVPdf() {
  console.log('🚀 Generating PDF from ROV Value Increased Template...\n');

  const template = ROV_VALUE_INCREASED_TEMPLATE;

  // Sample data to fill the template
  const sampleData = {
    date: new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    }),
    requestorName: 'John Smith',
    requestorAddress: '123 Main Street',
    requestorCity: 'Seattle',
    requestorState: 'WA',
    requestorZip: '98101',
    propertyAddress: '456 Oak Avenue, Seattle, WA 98102',
    requestDate: 'December 15, 2025',
    originalValue: '$450,000',
    newValue: '$475,000',
    valueChange: '$25,000',
    valueChangePercent: '5.56%',
    explanation: `After reviewing the additional comparable properties you provided, I conducted 
further market research in the subject property's neighborhood. The comparables you submitted 
were more recent sales (within 60 days) and better matched the subject property's features, 
particularly the updated kitchen and master bathroom. The original appraisal relied more heavily 
on older sales (90-120 days) which did not fully reflect the current market conditions showing 
an upward trend in this area.`,
    comparablesList: `
<table style="width: 100%; border-collapse: collapse; margin: 10px 0;">
  <tr style="background-color: #f0f0f0; font-weight: bold;">
    <td style="border: 1px solid #ccc; padding: 8px;">Address</td>
    <td style="border: 1px solid #ccc; padding: 8px;">Sale Price</td>
    <td style="border: 1px solid #ccc; padding: 8px;">Sale Date</td>
    <td style="border: 1px solid #ccc; padding: 8px;">Sq Ft</td>
    <td style="border: 1px solid #ccc; padding: 8px;">Distance</td>
  </tr>
  <tr>
    <td style="border: 1px solid #ccc; padding: 8px;">789 Elm Street</td>
    <td style="border: 1px solid #ccc; padding: 8px;">$472,000</td>
    <td style="border: 1px solid #ccc; padding: 8px;">Nov 30, 2025</td>
    <td style="border: 1px solid #ccc; padding: 8px;">2,100</td>
    <td style="border: 1px solid #ccc; padding: 8px;">0.3 miles</td>
  </tr>
  <tr>
    <td style="border: 1px solid #ccc; padding: 8px;">321 Pine Avenue</td>
    <td style="border: 1px solid #ccc; padding: 8px;">$478,500</td>
    <td style="border: 1px solid #ccc; padding: 8px;">Dec 5, 2025</td>
    <td style="border: 1px solid #ccc; padding: 8px;">2,150</td>
    <td style="border: 1px solid #ccc; padding: 8px;">0.5 miles</td>
  </tr>
  <tr>
    <td style="border: 1px solid #ccc; padding: 8px;">555 Maple Drive</td>
    <td style="border: 1px solid #ccc; padding: 8px;">$469,000</td>
    <td style="border: 1px solid #ccc; padding: 8px;">Dec 10, 2025</td>
    <td style="border: 1px solid #ccc; padding: 8px;">2,050</td>
    <td style="border: 1px solid #ccc; padding: 8px;">0.4 miles</td>
  </tr>
</table>
    `,
    deliveryDays: '3',
    appraiserName: 'Sarah Johnson, MAI',
    appraiserTitle: 'Certified Residential Appraiser',
    appraiserLicense: 'CRA-12345-WA',
    appraiserCompany: 'Pacific Northwest Appraisal Services',
    appraiserPhone: '(206) 555-1234',
    appraiserEmail: 'sarah.johnson@pnwappraisals.com'
  };

  console.log('📄 Template:', template.name);
  console.log('📊 Sample Data:');
  console.log('   - Property:', sampleData.propertyAddress);
  console.log('   - Original Value:', sampleData.originalValue);
  console.log('   - New Value:', sampleData.newValue);
  console.log('   - Value Change:', sampleData.valueChange, `(${sampleData.valueChangePercent})`);
  console.log('');

  // Render template as PDF
  console.log('🔨 Rendering PDF...');
  const pdfBuffer = await renderTemplateToPdf(template, sampleData);

  // Save PDF to file
  const outputDir = path.join(__dirname, '../../output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const filename = 'ROV_Value_Increased_Response.pdf';
  const outputPath = path.join(outputDir, filename);
  fs.writeFileSync(outputPath, pdfBuffer);

  console.log('✅ PDF generated successfully!');
  console.log('');
  console.log('📁 Output File:', outputPath);
  console.log('📏 File Size:', (pdfBuffer.length / 1024).toFixed(2), 'KB');
  console.log('');
  console.log('📋 Template Info:');
  console.log('   - Template:', template.name);
  console.log('   - Category:', template.category);
  console.log('   - Format:', template.format);
  console.log('   - Placeholders:', template.placeholders?.length);
  console.log('');
  console.log('🎉 Open the file to view the generated PDF!');
}

// Run the demo
generateROVPdf().catch(error => {
  console.error('Error running demo:', error);
  process.exit(1);
});
