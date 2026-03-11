/**
 * IFieldMapper — every form-type mapper must implement this interface.
 *
 * The mapper's job is to translate a CanonicalReportDocument into a flat
 * Record<fieldKey, value> suitable for pdf-lib AcroForm filling (acroform strategy)
 * or Handlebars template context (html-render strategy).
 *
 * Field keys must match the AcroForm field names returned by the PDF inspector
 * script (`pnpm ts-node src/scripts/inspect-pdf-fields.ts <path-to-pdf>`).
 */

import { CanonicalReportDocument } from '../../../types/canonical-schema';

export interface IFieldMapper {
  /** Canonical domain key registered in TemplateRegistryService, e.g. 'urar-1004' */
  readonly mapperKey: string;

  /**
   * Returns a context object for this report form:
   * - For 'acroform' templates: flat Record<string, string> (pdfFieldName → value)
   * - For 'html-render' templates: nested object consumed directly by Handlebars
   *
   * AcroFormFillStrategy coerces all values to strings. HtmlRenderStrategy passes
   * the object as-is to Handlebars.compile().
   */
  mapToFieldMap(doc: CanonicalReportDocument): Record<string, unknown>;
}
