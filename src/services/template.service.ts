/**
 * Template Management Service
 * Handles creation, rendering, and management of document templates
 * Supports ROV responses, appraisal reports (1033, 1004), and custom documents
 */

import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service';
import {
  Template,
  TemplateCategory,
  TemplateFormat,
  TemplateStatus,
  CreateTemplateInput,
  UpdateTemplateInput,
  RenderTemplateRequest,
  RenderTemplateResult,
  TemplateFilters,
  TemplateListItem,
  TemplateValidationResult,
  TemplatePlaceholder
} from '../types/template.types.js';
import { AccessControl } from '../types/authorization.types.js';
import PDFDocument from 'pdfkit';
import * as fs from 'fs';

export class TemplateService {
  private logger: Logger;
  private dbService: CosmosDbService;

  constructor() {
    this.logger = new Logger();
    this.dbService = new CosmosDbService();
  }

  /**
   * Create a new template
   */
  async createTemplate(
    input: CreateTemplateInput,
    createdBy: string,
    tenantId: string,
    accessControl: AccessControl
  ): Promise<{ success: boolean; data?: Template; error?: string }> {
    try {
      this.logger.info('Creating template', { name: input.name, category: input.category });

      // Validate template
      const validation = this.validateTemplate(input.content, input.placeholders);
      if (!validation.isValid) {
        return {
          success: false,
          error: `Template validation failed: ${validation.errors.map(e => e.message).join(', ')}`
        };
      }

      const template = {
        id: this.generateId(),
        tenantId,
        name: input.name,
        description: input.description,
        category: input.category,
        ...(input.formType && { formType: input.formType }),
        content: input.content,
        sections: input.sections,
        format: input.format,
        version: '1.0.0',
        status: TemplateStatus.DRAFT,
        isDefault: false,
        placeholders: input.placeholders,
        styles: input.styles,
        usageCount: 0,
        requiresApproval: input.requiresApproval || false,
        accessControl,
        createdBy,
        createdAt: new Date(),
        updatedBy: createdBy,
        updatedAt: new Date(),
        tags: input.tags || []
      };

      const saved = await this.dbService.createTemplate(template);

      this.logger.info('Template created successfully', { templateId: saved.id });

      return { success: true, data: saved as Template };

    } catch (error) {
      this.logger.error('Error creating template', { error });
      return { success: false, error: 'Failed to create template' };
    }
  }

  /**
   * Update an existing template
   */
  async updateTemplate(
    input: UpdateTemplateInput,
    updatedBy: string
  ): Promise<{ success: boolean; data?: Template; error?: string }> {
    try {
      const { templateId, ...updates } = input;

      this.logger.info('Updating template', { templateId });

      // Get existing template
      const existing = await this.dbService.findTemplateById(templateId);
      if (!existing) {
        return { success: false, error: 'Template not found' };
      }

      // Validate if content/placeholders changed
      if (updates.content || updates.placeholders) {
        const validation = this.validateTemplate(
          updates.content || existing.content,
          updates.placeholders || existing.placeholders
        );
        if (!validation.isValid) {
          return {
            success: false,
            error: `Template validation failed: ${validation.errors.map(e => e.message).join(', ')}`
          };
        }
      }

      // Increment version if content changed
      let newVersion = existing.version;
      if (updates.content && updates.content !== existing.content) {
        const [major, minor, patch] = existing.version.split('.').map(Number);
        newVersion = `${major}.${minor}.${patch + 1}`;
      }

      const updated = await this.dbService.updateTemplate(templateId, {
        ...updates,
        version: newVersion,
        updatedBy,
        updatedAt: new Date()
      });

      this.logger.info('Template updated successfully', { templateId, version: newVersion });

      return { success: true, data: updated };

    } catch (error) {
      this.logger.error('Error updating template', { error });
      return { success: false, error: 'Failed to update template' };
    }
  }

  /**
   * Get template by ID
   */
  async getTemplateById(templateId: string): Promise<{ success: boolean; data?: Template; error?: string }> {
    try {
      const template = await this.dbService.findTemplateById(templateId);
      
      if (!template) {
        return { success: false, error: 'Template not found' };
      }

      return { success: true, data: template };

    } catch (error) {
      this.logger.error('Error fetching template', { error, templateId });
      return { success: false, error: 'Failed to fetch template' };
    }
  }

  /**
   * List templates with filters
   */
  async listTemplates(
    filters: TemplateFilters,
    page: number = 1,
    limit: number = 50
  ): Promise<{ items: TemplateListItem[]; total: number; page: number; pageSize: number }> {
    try {
      const offset = (page - 1) * limit;
      const templates = await this.dbService.findTemplates(filters, offset, limit);
      const total = await this.dbService.countTemplates(filters);

      const items: TemplateListItem[] = templates.map(t => ({
        id: t.id,
        name: t.name,
        description: t.description,
        category: t.category,
        formType: t.formType,
        format: t.format,
        version: t.version,
        status: t.status,
        isDefault: t.isDefault,
        usageCount: t.usageCount,
        lastUsedAt: t.lastUsedAt,
        updatedAt: t.updatedAt,
        tags: t.tags
      }));

      return {
        items,
        total,
        page,
        pageSize: limit
      };

    } catch (error) {
      this.logger.error('Error listing templates', { error, filters });
      throw error;
    }
  }

  /**
   * Render template with data
   */
  async renderTemplate(
    request: RenderTemplateRequest
  ): Promise<RenderTemplateResult> {
    try {
      this.logger.info('Rendering template', { templateId: request.templateId });

      // Get template
      const templateResult = await this.getTemplateById(request.templateId);
      if (!templateResult.success || !templateResult.data) {
        return {
          success: false,
          error: templateResult.error || 'Template not found'
        };
      }

      const template = templateResult.data;

      // Replace placeholders
      let rendered = template.content;
      let filledCount = 0;

      for (const placeholder of template.placeholders) {
        const value = request.data[placeholder.key];
        
        if (value !== undefined && value !== null) {
          // Format value based on type
          let formattedValue = this.formatPlaceholderValue(value, placeholder);
          
          // Replace all occurrences
          const regex = new RegExp(`\\{\\{${placeholder.key}\\}\\}`, 'g');
          rendered = rendered.replace(regex, formattedValue);
          filledCount++;
        } else if (placeholder.required) {
          return {
            success: false,
            error: `Required placeholder missing: ${placeholder.key}`
          };
        } else if (placeholder.defaultValue !== undefined) {
          // Use default value
          let formattedValue = this.formatPlaceholderValue(placeholder.defaultValue, placeholder);
          const regex = new RegExp(`\\{\\{${placeholder.key}\\}\\}`, 'g');
          rendered = rendered.replace(regex, formattedValue);
        }
      }

      // Update usage tracking
      await this.dbService.updateTemplate(template.id, {
        usageCount: template.usageCount + 1,
        lastUsedAt: new Date()
      });

      // Determine output format
      const outputFormat = request.format || template.format;

      // Convert to requested format
      let result: RenderTemplateResult;
      
      switch (outputFormat) {
        case TemplateFormat.HTML:
          result = await this.renderAsHtml(rendered, template, request.options);
          break;
        case TemplateFormat.PDF:
          result = await this.renderAsPdf(rendered, template, request.options);
          break;
        case TemplateFormat.MARKDOWN:
          result = { success: true, content: rendered };
          break;
        case TemplateFormat.DOCX:
          result = await this.renderAsDocx(rendered, template, request.options);
          break;
        default:
          result = { success: true, content: rendered };
      }

      // Add metadata
      if (result.success) {
        result.metadata = {
          templateId: template.id,
          templateName: template.name,
          version: template.version,
          renderedAt: new Date(),
          placeholdersFilled: filledCount,
          placeholdersTotal: template.placeholders.length
        };
      }

      return result;

    } catch (error) {
      this.logger.error('Error rendering template', { error });
      return {
        success: false,
        error: 'Failed to render template'
      };
    }
  }

  /**
   * Validate template syntax and placeholders
   */
  validateTemplate(
    content: string,
    placeholders: TemplatePlaceholder[]
  ): TemplateValidationResult {
    const errors: { field: string; message: string }[] = [];
    const warnings: { field: string; message: string }[] = [];

    // Extract placeholders used in content
    const placeholderRegex = /\{\{([^}]+)\}\}/g;
    const usedPlaceholders = new Set<string>();
    let match;
    
    while ((match = placeholderRegex.exec(content)) !== null) {
      if (match[1]) {
        usedPlaceholders.add(match[1]);
      }
    }

    // Check for defined placeholders
    const definedKeys = new Set(placeholders.map(p => p.key));

    // Find undefined placeholders (used but not defined)
    const undefinedPlaceholders: string[] = [];
    usedPlaceholders.forEach(key => {
      if (!definedKeys.has(key)) {
        undefinedPlaceholders.push(key);
        errors.push({
          field: 'placeholders',
          message: `Placeholder {{${key}}} is used in content but not defined`
        });
      }
    });

    // Find unused placeholders (defined but not used)
    const unusedPlaceholders: string[] = [];
    definedKeys.forEach(key => {
      if (!usedPlaceholders.has(key)) {
        unusedPlaceholders.push(key);
        warnings.push({
          field: 'placeholders',
          message: `Placeholder {{${key}}} is defined but not used in content`
        });
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      unusedPlaceholders,
      undefinedPlaceholders
    };
  }

  /**
   * Set template as default for its category
   */
  async setDefaultTemplate(
    templateId: string,
    category: TemplateCategory
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Unset current default
      await this.dbService.unsetDefaultTemplates(category);

      // Set new default
      await this.dbService.updateTemplate(templateId, {
        isDefault: true,
        status: TemplateStatus.ACTIVE
      });

      this.logger.info('Default template set', { templateId, category });

      return { success: true };

    } catch (error) {
      this.logger.error('Error setting default template', { error });
      return { success: false, error: 'Failed to set default template' };
    }
  }

  /**
   * Delete template
   */
  async deleteTemplate(templateId: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.dbService.deleteTemplate(templateId);
      this.logger.info('Template deleted', { templateId });
      return { success: true };

    } catch (error) {
      this.logger.error('Error deleting template', { error, templateId });
      return { success: false, error: 'Failed to delete template' };
    }
  }

  // ===============================
  // Private Helper Methods
  // ===============================

  private formatPlaceholderValue(value: any, placeholder: TemplatePlaceholder): string {
    switch (placeholder.type) {
      case 'currency':
        return `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      
      case 'date':
        return new Date(value).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      
      case 'number':
        return Number(value).toLocaleString('en-US');
      
      case 'list':
        if (Array.isArray(value)) {
          return value.map(item => `• ${item}`).join('\n');
        }
        return String(value);
      
      case 'table':
        // TODO: Format as HTML/Markdown table
        return JSON.stringify(value);
      
      default:
        return String(value);
    }
  }

  private async renderAsHtml(
    content: string,
    template: Template,
    options?: any
  ): Promise<RenderTemplateResult> {
    try {
      // Apply styles
      let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${template.name}</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; padding: 20px; }
    ${template.styles?.css || ''}
    ${options?.customStyles || ''}
  </style>
</head>
<body>
  ${template.styles?.headerImage ? `<img src="${template.styles.headerImage}" alt="Header" style="max-width: 200px;">` : ''}
  ${content}
  ${template.styles?.footerText ? `<footer style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ccc;">${template.styles.footerText}</footer>` : ''}
</body>
</html>`;

      return { success: true, content: html };

    } catch (error) {
      this.logger.error('Error rendering HTML', { error });
      return { success: false, error: 'Failed to render HTML' };
    }
  }

  private async renderAsPdf(
    content: string,
    template: Template,
    options?: any
  ): Promise<RenderTemplateResult> {
    try {
      // Create PDF document
      const doc = new PDFDocument({
        size: template.styles?.pageSize === 'legal' ? 'LEGAL' : 
              template.styles?.pageSize === 'a4' ? 'A4' : 'LETTER',
        margins: {
          top: template.styles?.margins?.top || 50,
          bottom: template.styles?.margins?.bottom || 50,
          left: template.styles?.margins?.left || 50,
          right: template.styles?.margins?.right || 50
        }
      });

      const chunks: Buffer[] = [];
      
      // Collect PDF data
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      
      const pdfGenerated = new Promise<Buffer>((resolve, reject) => {
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
      });

      // Add header image if provided
      if (template.styles?.headerImage) {
        try {
          // In production, download and embed the image
          // For now, just add a placeholder
          doc.fontSize(10).text('Header Image: ' + template.styles.headerImage, { align: 'center' });
          doc.moveDown();
        } catch (error) {
          this.logger.warn('Failed to add header image', { error });
        }
      }

      // Parse and render HTML-like content
      this.renderHtmlToPdf(doc, content, template);

      // Add footer if provided
      if (template.styles?.footerText) {
        const pageHeight = doc.page.height;
        const pageMargins = doc.page.margins;
        doc.fontSize(8)
           .text(template.styles.footerText, 
                 pageMargins.left, 
                 pageHeight - pageMargins.bottom + 10,
                 { align: 'center', width: doc.page.width - pageMargins.left - pageMargins.right });
      }

      // Add watermark if requested
      if (options?.watermark) {
        doc.fontSize(60)
           .fillColor('gray', 0.1)
           .rotate(-45, { origin: [doc.page.width / 2, doc.page.height / 2] })
           .text(options.watermark, 0, doc.page.height / 2, { align: 'center' });
      }

      // Finalize PDF
      doc.end();

      const pdfBuffer = await pdfGenerated;

      return {
        success: true,
        file: {
          filename: `${template.name.replace(/\s+/g, '_')}.pdf`,
          mimeType: 'application/pdf',
          size: pdfBuffer.length,
          buffer: pdfBuffer
        }
      };

    } catch (error) {
      this.logger.error('Error rendering PDF', { error });
      return { success: false, error: 'Failed to render PDF' };
    }
  }

  private async renderAsDocx(
    content: string,
    template: Template,
    options?: any
  ): Promise<RenderTemplateResult> {
    try {
      // TODO: Integrate DOCX generation library (docx, officegen, etc.)
      
      return {
        success: true,
        content,
        file: {
          filename: `${template.name.replace(/\s+/g, '_')}.docx`,
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          size: 0
        }
      };

    } catch (error) {
      this.logger.error('Error rendering DOCX', { error });
      return { success: false, error: 'Failed to render DOCX' };
    }
  }

  /**
   * Parse simple HTML and render to PDF
   * Supports basic tags: <h2>, <h3>, <p>, <table>, <strong>, <br>
   */
  private renderHtmlToPdf(doc: InstanceType<typeof PDFDocument>, html: string, template: Template): void {
    // Remove HTML wrapper tags
    html = html.replace(/<\/?html[^>]*>/gi, '')
               .replace(/<\/?head[^>]*>/gi, '')
               .replace(/<\/?body[^>]*>/gi, '')
               .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

    // Split into sections by tags
    const lines = html.split(/\n/);
    
    for (let line of lines) {
      line = line.trim();
      if (!line) continue;

      // H2 heading
      if (line.match(/<h2[^>]*>/i)) {
        const text = line.replace(/<\/?h2[^>]*>/gi, '').trim();
        doc.fontSize(16).font('Helvetica-Bold').text(text, { underline: true });
        doc.moveDown(0.5);
        doc.font('Helvetica').fontSize(12);
        continue;
      }

      // H3 heading
      if (line.match(/<h3[^>]*>/i)) {
        const text = line.replace(/<\/?h3[^>]*>/gi, '').trim();
        doc.fontSize(14).font('Helvetica-Bold').text(text);
        doc.moveDown(0.3);
        doc.font('Helvetica').fontSize(12);
        continue;
      }

      // Table
      if (line.match(/<table[^>]*>/i)) {
        const tableHtml = this.extractTag(html, 'table');
        if (tableHtml) {
          this.renderTableToPdf(doc, tableHtml);
          html = html.replace(tableHtml, ''); // Remove processed table
        }
        continue;
      }

      // Paragraph
      if (line.match(/<p[^>]*>/i)) {
        const text = this.stripHtmlTags(line.replace(/<\/?p[^>]*>/gi, '')).trim();
        if (text) {
          // Check for inline styling
          const styleMatch = line.match(/style="([^"]*)"/);
          if (styleMatch && styleMatch[1] && styleMatch[1].includes('font-weight: bold')) {
            doc.font('Helvetica-Bold');
          }
          
          doc.text(text, { align: 'left' });
          doc.moveDown(0.5);
          doc.font('Helvetica');
        }
        continue;
      }

      // Div (treat like paragraph)
      if (line.match(/<div[^>]*>/i)) {
        const text = this.stripHtmlTags(line.replace(/<\/?div[^>]*>/gi, '')).trim();
        if (text) {
          doc.text(text);
          doc.moveDown(0.5);
        }
        continue;
      }
    }
  }

  /**
   * Extract content between tags
   */
  private extractTag(html: string, tagName: string): string | null {
    const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
    const match = html.match(regex);
    return match ? match[0] : null;
  }

  /**
   * Strip all HTML tags
   */
  private stripHtmlTags(html: string): string {
    return html.replace(/<[^>]*>/g, '')
               .replace(/&nbsp;/g, ' ')
               .replace(/&lt;/g, '<')
               .replace(/&gt;/g, '>')
               .replace(/&amp;/g, '&')
               .replace(/&quot;/g, '"');
  }

  /**
   * Render HTML table to PDF
   */
  private renderTableToPdf(doc: InstanceType<typeof PDFDocument>, tableHtml: string): void {
    const rows = tableHtml.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi);
    if (!rows) return;

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const startY = doc.y;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;
      const cells = row.match(/<td[^>]*>[\s\S]*?<\/td>/gi);
      if (!cells) continue;

      const cellWidth = pageWidth / cells.length;
      let currentX = doc.page.margins.left;
      const currentY = doc.y;

      for (const cell of cells) {
        const text = this.stripHtmlTags(cell);
        
        // Check if cell has styling
        const hasBackground = cell.match(/background-color:\s*#f0f0f0/i);
        const isBold = cell.match(/<strong>/i) || cell.match(/font-weight:\s*bold/i);
        const hasBorder = cell.match(/border:\s*1px/i);

        // Draw cell background
        if (hasBackground) {
          doc.rect(currentX, currentY, cellWidth, 20).fill('#f0f0f0');
          doc.fillColor('black');
        }

        // Draw cell border
        if (hasBorder) {
          doc.rect(currentX, currentY, cellWidth, 20).stroke();
        }

        // Draw text
        if (isBold) {
          doc.font('Helvetica-Bold');
        }
        
        doc.text(text, currentX + 5, currentY + 5, {
          width: cellWidth - 10,
          height: 20,
          ellipsis: true
        });

        doc.font('Helvetica');
        currentX += cellWidth;
      }

      doc.y = currentY + 22;
      doc.moveDown(0.1);
    }

    doc.moveDown(0.5);
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
