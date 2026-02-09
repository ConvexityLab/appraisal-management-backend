/**
 * QC Results Controller
 * REST API endpoints for querying QC results, generating reports, and exporting analysis data
 */

import { Router, Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { Logger } from '../utils/logger.js';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { createApiError, createApiResponse } from '../utils/api-response.util.js';
import {
  QCExecutionResult,
  QCExecutionStatus,
  QCExecutionMode,
  RiskLevel,
  ComplianceStatus,
  QCDecision
} from '../types/qc-management.js';
import { ApiResponse } from '../types/index.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    permissions: string[];
    organizationId?: string;
    clientId?: string;
  };
}

export interface QCResultsFilter {
  checklistId?: string;
  targetId?: string;
  executedBy?: string;
  status?: QCExecutionStatus;
  riskLevel?: RiskLevel;
  complianceStatus?: ComplianceStatus;
  decision?: QCDecision;
  scoreRange?: { min: number; max: number };
  dateRange?: { startDate: Date; endDate: Date };
  clientId?: string;
  organizationId?: string;
  tags?: string[];
  hasIssues?: boolean;
}

export interface QCResultsQuery {
  filters: QCResultsFilter;
  sorting?: {
    field: string;
    direction: 'asc' | 'desc';
  };
  pagination?: {
    limit: number;
    offset: number;
  };
  aggregations?: string[];
}

export interface QCResultsReport {
  id: string;
  title: string;
  description?: string;
  generatedAt: Date;
  generatedBy: string;
  filters: QCResultsFilter;
  summary: {
    totalResults: number;
    avgScore: number;
    passRate: number;
    criticalIssuesCount: number;
    riskDistribution: Record<RiskLevel, number>;
    complianceDistribution: Record<ComplianceStatus, number>;
  };
  data: any[];
  format: 'json' | 'csv' | 'excel' | 'pdf';
  downloadUrl?: string;
}

export class QCResultsController {
  private logger: Logger;
  private cosmosService: CosmosDbService;
  private router: Router;

  constructor() {
    this.logger = new Logger('QCResultsController');
    this.cosmosService = new CosmosDbService();
    this.router = Router();
    this.initializeRoutes();
  }

  /**
   * Initialize all routes for QC results management
   */
  private initializeRoutes(): void {
    // Results querying
    this.router.get('/search',
      this.validateSearchResults(),
      this.handleValidation,
      this.searchResults.bind(this)
    );

    this.router.get('/:resultId',
      this.validateGetResult(),
      this.handleValidation,
      this.getResult.bind(this)
    );

    this.router.get('/checklist/:checklistId',
      this.validateGetResultsByChecklist(),
      this.handleValidation,
      this.getResultsByChecklist.bind(this)
    );

    this.router.get('/target/:targetId',
      this.validateGetResultsByTarget(),
      this.handleValidation,
      this.getResultsByTarget.bind(this)
    );

    // Analytics and aggregations
    this.router.get('/analytics/summary',
      this.validateGetAnalyticsSummary(),
      this.handleValidation,
      this.getAnalyticsSummary.bind(this)
    );

    this.router.get('/analytics/trends',
      this.validateGetTrends(),
      this.handleValidation,
      this.getTrends.bind(this)
    );

    this.router.get('/analytics/performance',
      this.validateGetPerformance(),
      this.handleValidation,
      this.getPerformanceMetrics.bind(this)
    );

    this.router.get('/analytics/issues',
      this.validateGetIssuesAnalysis(),
      this.handleValidation,
      this.getIssuesAnalysis.bind(this)
    );

    // Update verification status for a specific checklist item
    this.router.patch('/:resultId/items/:itemId/verification',
      this.validateUpdateVerification(),
      this.handleValidation,
      this.updateItemVerification.bind(this)
    );

    // Reporting
    this.router.post('/reports/generate',
      this.validateGenerateReport(),
      this.handleValidation,
      this.generateReport.bind(this)
    );

    this.router.get('/reports',
      this.validateGetReports(),
      this.handleValidation,
      this.getReports.bind(this)
    );

    this.router.get('/reports/:reportId',
      this.validateGetReport(),
      this.handleValidation,
      this.getReport.bind(this)
    );

    this.router.delete('/reports/:reportId',
      this.validateDeleteReport(),
      this.handleValidation,
      this.deleteReport.bind(this)
    );

    // Export functionality
    this.router.post('/export',
      this.validateExportResults(),
      this.handleValidation,
      this.exportResults.bind(this)
    );

    this.router.get('/export/:exportId/download',
      this.validateDownloadExport(),
      this.handleValidation,
      this.downloadExport.bind(this)
    );

    // Comparison and benchmarking
    this.router.post('/compare',
      this.validateCompareResults(),
      this.handleValidation,
      this.compareResults.bind(this)
    );

    this.router.get('/benchmarks',
      this.validateGetBenchmarks(),
      this.handleValidation,
      this.getBenchmarks.bind(this)
    );
  }

  // ============================================================================
  // RESULTS QUERYING
  // ============================================================================

  /**
   * Search QC results with advanced filtering
   */
  private async searchResults(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const filters: QCResultsFilter = this.buildFiltersFromQuery(req.query, req.user);
      const sorting = this.buildSortingFromQuery(req.query);
      const pagination = this.buildPaginationFromQuery(req.query);

      this.logger.debug('Searching QC results', {
        filters,
        sorting,
        pagination,
        userId: req.user?.id
      });

      const query: QCResultsQuery = { filters, sorting, pagination };
      const results = await this.queryResults(query);

      res.json(createApiResponse(results, 'QC results retrieved successfully'));

    } catch (error) {
      this.logger.error('Failed to search QC results', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: createApiError('QC_RESULTS_SEARCH_FAILED', 'Failed to search QC results')
      });
    }
  }

  /**
   * Get specific QC result by ID
   */
  private async getResult(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { resultId } = req.params;

      if (!resultId) {
        res.status(400).json({
          success: false,
          error: createApiError('RESULT_ID_REQUIRED', 'Result ID is required')
        });
        return;
      }

      this.logger.debug('Getting QC result', {
        resultId,
        userId: req.user?.id
      });

      const result = await this.cosmosService.getItem('results', resultId);

      if (!result) {
        res.status(404).json({
          success: false,
          error: createApiError('QC_RESULT_NOT_FOUND', `QC result ${resultId} not found`)
        });
        return;
      }

      // Check access permissions
      if (!this.hasResultAccess(req.user, result)) {
        res.status(403).json({
          success: false,
          error: createApiError('QC_RESULT_ACCESS_DENIED', 'Access denied to this QC result')
        });
        return;
      }

      res.json(createApiResponse(result, 'QC result retrieved successfully'));

    } catch (error) {
      this.logger.error('Failed to get QC result', {
        error: error instanceof Error ? error.message : 'Unknown error',
        resultId: req.params.resultId,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: createApiError('QC_RESULT_GET_FAILED', 'Failed to retrieve QC result')
      });
    }
  }

  /**
   * Update verification status for a specific checklist item
   */
  private async updateItemVerification(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { resultId, itemId } = req.params;
      const { verified, verifiedBy, verifiedAt, verificationNotes } = req.body;

      this.logger.debug('Updating item verification', {
        resultId,
        itemId,
        verified,
        userId: req.user?.id
      });

      // Get the result
      const result = await this.cosmosService.getItem('results', resultId);

      if (!result) {
        res.status(404).json({
          success: false,
          error: createApiError('QC_RESULT_NOT_FOUND', `QC result ${resultId} not found`)
        });
        return;
      }

      // Check access permissions
      if (!this.hasResultAccess(req.user, result)) {
        res.status(403).json({
          success: false,
          error: createApiError('QC_RESULT_ACCESS_DENIED', 'Access denied to this QC result')
        });
        return;
      }

      // Find and update the item
      const itemIndex = result.items?.findIndex((item: any) => item.id === itemId);
      if (itemIndex === -1 || itemIndex === undefined) {
        res.status(404).json({
          success: false,
          error: createApiError('QC_ITEM_NOT_FOUND', `QC item ${itemId} not found in result`)
        });
        return;
      }

      // Update the verification status
      result.items[itemIndex].verified = verified;
      result.items[itemIndex].verifiedBy = verifiedBy || req.user?.id;
      result.items[itemIndex].verifiedAt = verifiedAt || new Date().toISOString();
      if (verificationNotes) {
        result.items[itemIndex].verificationNotes = verificationNotes;
      }

      // Update the result in database
      const updatedResult = await this.cosmosService.updateItem('results', resultId, result);

      this.logger.info('QC item verification updated', {
        resultId,
        itemId,
        verified,
        userId: req.user?.id
      });

      res.json(createApiResponse(updatedResult));

    } catch (error) {
      this.logger.error('Failed to update item verification', {
        error,
        resultId: req.params.resultId,
        itemId: req.params.itemId
      });

      res.status(500).json({
        success: false,
        error: createApiError('QC_VERIFICATION_UPDATE_FAILED', 'Failed to update item verification')
      });
    }
  }

  /**
   * Get QC results by checklist ID
   */
  private async getResultsByChecklist(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { checklistId } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      this.logger.debug('Getting QC results by checklist', {
        checklistId,
        limit,
        offset,
        userId: req.user?.id
      });

      const filters: QCResultsFilter = {
        ...(checklistId && { checklistId }),
        ...(req.user?.clientId && { clientId: req.user.clientId }),
        ...(req.user?.organizationId && { organizationId: req.user.organizationId })
      };

      const query: QCResultsQuery = {
        filters,
        sorting: { field: 'startedAt', direction: 'desc' },
        pagination: { limit, offset }
      };

      const results = await this.queryResults(query);

      res.json(createApiResponse(results, 'QC results by checklist retrieved successfully'));

    } catch (error) {
      this.logger.error('Failed to get QC results by checklist', {
        error: error instanceof Error ? error.message : 'Unknown error',
        checklistId: req.params.checklistId,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: createApiError('QC_RESULTS_BY_CHECKLIST_FAILED', 'Failed to retrieve QC results by checklist')
      });
    }
  }

  /**
   * Get QC results by target ID
   */
  private async getResultsByTarget(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { targetId } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      this.logger.debug('Getting QC results by target', {
        targetId,
        limit,
        offset,
        userId: req.user?.id
      });

      const filters: QCResultsFilter = {
        ...(targetId && { targetId }),
        ...(req.user?.clientId && { clientId: req.user.clientId }),
        ...(req.user?.organizationId && { organizationId: req.user.organizationId })
      };

      const query: QCResultsQuery = {
        filters,
        sorting: { field: 'startedAt', direction: 'desc' },
        pagination: { limit, offset }
      };

      const results = await this.queryResults(query);

      res.json(createApiResponse(results, 'QC results by target retrieved successfully'));

    } catch (error) {
      this.logger.error('Failed to get QC results by target', {
        error: error instanceof Error ? error.message : 'Unknown error',
        targetId: req.params.targetId,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: createApiError('QC_RESULTS_BY_TARGET_FAILED', 'Failed to retrieve QC results by target')
      });
    }
  }

  // ============================================================================
  // ANALYTICS AND AGGREGATIONS
  // ============================================================================

  /**
   * Get analytics summary
   */
  private async getAnalyticsSummary(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const timeRange = req.query.timeRange as string || '30d';
      const filters: QCResultsFilter = this.buildFiltersFromQuery(req.query, req.user);

      this.logger.debug('Getting analytics summary', {
        timeRange,
        filters,
        userId: req.user?.id
      });

      const summary = await this.calculateAnalyticsSummary(filters, timeRange);

      res.json(createApiResponse(summary, 'Analytics summary retrieved successfully'));

    } catch (error) {
      this.logger.error('Failed to get analytics summary', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: createApiError('QC_ANALYTICS_SUMMARY_FAILED', 'Failed to retrieve analytics summary')
      });
    }
  }

  /**
   * Get trends analysis
   */
  private async getTrends(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const timeRange = req.query.timeRange as string || '90d';
      const granularity = req.query.granularity as string || 'daily';
      const filters: QCResultsFilter = this.buildFiltersFromQuery(req.query, req.user);

      this.logger.debug('Getting trends analysis', {
        timeRange,
        granularity,
        filters,
        userId: req.user?.id
      });

      const trends = await this.calculateTrends(filters, timeRange, granularity);

      res.json(createApiResponse(trends, 'Trends analysis retrieved successfully'));

    } catch (error) {
      this.logger.error('Failed to get trends analysis', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: createApiError('QC_TRENDS_FAILED', 'Failed to retrieve trends analysis')
      });
    }
  }

  /**
   * Get performance metrics
   */
  private async getPerformanceMetrics(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const dimension = req.query.dimension as string || 'checklist';
      const timeRange = req.query.timeRange as string || '30d';
      const filters: QCResultsFilter = this.buildFiltersFromQuery(req.query, req.user);

      this.logger.debug('Getting performance metrics', {
        dimension,
        timeRange,
        filters,
        userId: req.user?.id
      });

      const performance = await this.calculatePerformanceMetrics(filters, dimension, timeRange);

      res.json(createApiResponse(performance, 'Performance metrics retrieved successfully'));

    } catch (error) {
      this.logger.error('Failed to get performance metrics', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: createApiError('QC_PERFORMANCE_FAILED', 'Failed to retrieve performance metrics')
      });
    }
  }

  /**
   * Get issues analysis
   */
  private async getIssuesAnalysis(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const analysisType = req.query.analysisType as string || 'frequency';
      const timeRange = req.query.timeRange as string || '30d';
      const filters: QCResultsFilter = this.buildFiltersFromQuery(req.query, req.user);

      this.logger.debug('Getting issues analysis', {
        analysisType,
        timeRange,
        filters,
        userId: req.user?.id
      });

      const issues = await this.analyzeIssues(filters, analysisType, timeRange);

      res.json(createApiResponse(issues, 'Issues analysis retrieved successfully'));

    } catch (error) {
      this.logger.error('Failed to get issues analysis', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: createApiError('QC_ISSUES_ANALYSIS_FAILED', 'Failed to retrieve issues analysis')
      });
    }
  }

  // ============================================================================
  // REPORTING
  // ============================================================================

  /**
   * Generate a comprehensive QC report
   */
  private async generateReport(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { title, description, filters, format = 'json', includeCharts = false } = req.body;

      this.logger.debug('Generating QC report', {
        title,
        format,
        includeCharts,
        userId: req.user?.id
      });

      const reportFilters: QCResultsFilter = {
        ...filters,
        clientId: filters.clientId || req.user?.clientId,
        organizationId: filters.organizationId || req.user?.organizationId
      };

      const reportId = this.generateReportId();
      const report: QCResultsReport = {
        id: reportId,
        title,
        description,
        generatedAt: new Date(),
        generatedBy: req.user?.id || 'system',
        filters: reportFilters,
        summary: await this.calculateReportSummary(reportFilters),
        data: [],
        format: format as 'json' | 'csv' | 'excel' | 'pdf'
      };

      // Generate report data based on filters
      const query: QCResultsQuery = {
        filters: reportFilters,
        sorting: { field: 'startedAt', direction: 'desc' },
        pagination: { limit: 10000, offset: 0 } // Large limit for reports
      };

      const results = await this.queryResults(query);
      report.data = results.data;

      // Store report for future access
      await this.cosmosService.createItem('qc-reports', report);

      // Generate downloadable file if needed
      if (format !== 'json') {
        report.downloadUrl = await this.generateReportFile(report);
      }

      this.logger.info('QC report generated successfully', {
        reportId,
        title,
        totalRecords: report.data.length,
        userId: req.user?.id
      });

      res.status(201).json(createApiResponse(report, 'QC report generated successfully'));

    } catch (error) {
      this.logger.error('Failed to generate QC report', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: createApiError('QC_REPORT_GENERATION_FAILED', 'Failed to generate QC report')
      });
    }
  }

  /**
   * Get list of generated reports
   */
  private async getReports(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      this.logger.debug('Getting QC reports list', {
        limit,
        offset,
        userId: req.user?.id
      });

      // Build query for user's reports
      const query = `
        SELECT * FROM c 
        WHERE c.generatedBy = @userId 
        OR c.filters.clientId = @clientId 
        OR c.filters.organizationId = @organizationId
        ORDER BY c.generatedAt DESC
        OFFSET @offset LIMIT @limit
      `;

      const parameters = [
        { name: '@userId', value: req.user?.id },
        { name: '@clientId', value: req.user?.clientId },
        { name: '@organizationId', value: req.user?.organizationId },
        { name: '@offset', value: offset },
        { name: '@limit', value: limit }
      ];

      const reports = await this.cosmosService.queryItems('qc-reports', query, parameters);

      // Remove data field for list view (too large)
      const reportSummaries = (reports.data || []).map((report: any) => ({
        ...report,
        data: undefined,
        dataCount: Array.isArray(report.data) ? report.data.length : 0
      }));

      res.json(createApiResponse({
        reports: reportSummaries,
        pagination: { limit, offset, hasMore: (reports.data?.length || 0) === limit }
      }, 'QC reports list retrieved successfully'));

    } catch (error) {
      this.logger.error('Failed to get QC reports list', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: createApiError('QC_REPORTS_LIST_FAILED', 'Failed to retrieve QC reports list')
      });
    }
  }

  /**
   * Get specific report by ID
   */
  private async getReport(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { reportId } = req.params;
      const includeData = req.query.includeData === 'true';

      if (!reportId) {
        res.status(400).json({
          success: false,
          error: createApiError('INVALID_REPORT_ID', 'Report ID is required')
        });
        return;
      }

      this.logger.debug('Getting QC report', {
        reportId,
        includeData,
        userId: req.user?.id
      });

      const reportResponse = await this.cosmosService.getItem('qc-reports', reportId);

      if (!reportResponse.data) {
        res.status(404).json({
          success: false,
          error: createApiError('QC_REPORT_NOT_FOUND', `QC report ${reportId} not found`)
        });
        return;
      }

      const report: any = reportResponse.data;

      // Check access permissions
      if (!this.hasReportAccess(req.user, report)) {
        res.status(403).json({
          success: false,
          error: createApiError('QC_REPORT_ACCESS_DENIED', 'Access denied to this QC report')
        });
        return;
      }

      // Remove data if not explicitly requested (can be large)
      if (!includeData) {
        report.data = undefined;
        report.dataCount = report.data?.length || 0;
      }

      res.json(createApiResponse(report, 'QC report retrieved successfully'));

    } catch (error) {
      this.logger.error('Failed to get QC report', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reportId: req.params.reportId,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: createApiError('QC_REPORT_GET_FAILED', 'Failed to retrieve QC report')
      });
    }
  }

  /**
   * Delete a report
   */
  private async deleteReport(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { reportId } = req.params;

      if (!reportId) {
        res.status(400).json({
          success: false,
          error: createApiError('INVALID_REPORT_ID', 'Report ID is required')
        });
        return;
      }

      this.logger.debug('Deleting QC report', {
        reportId,
        userId: req.user?.id
      });

      const reportResponse = await this.cosmosService.getItem('qc-reports', reportId);

      if (!reportResponse.data) {
        res.status(404).json({
          success: false,
          error: createApiError('QC_REPORT_NOT_FOUND', `QC report ${reportId} not found`)
        });
        return;
      }

      const report: any = reportResponse.data;

      // Check permissions
      if (report.generatedBy !== req.user?.id && req.user?.role !== 'admin') {
        res.status(403).json({
          success: false,
          error: createApiError('QC_REPORT_DELETE_DENIED', 'Access denied to delete this report')
        });
        return;
      }

      await this.cosmosService.deleteItem('qc-reports', reportId, report.generatedBy);

      this.logger.info('QC report deleted successfully', {
        reportId,
        userId: req.user?.id
      });

      res.json(createApiResponse(null, 'QC report deleted successfully'));

    } catch (error) {
      this.logger.error('Failed to delete QC report', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reportId: req.params.reportId,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: createApiError('QC_REPORT_DELETE_FAILED', 'Failed to delete QC report')
      });
    }
  }

  // ============================================================================
  // EXPORT FUNCTIONALITY
  // ============================================================================

  /**
   * Export QC results in various formats
   */
  private async exportResults(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { filters, format = 'csv', filename } = req.body;

      this.logger.debug('Exporting QC results', {
        format,
        filename,
        userId: req.user?.id
      });

      const exportFilters: QCResultsFilter = {
        ...filters,
        clientId: filters.clientId || req.user?.clientId,
        organizationId: filters.organizationId || req.user?.organizationId
      };

      const exportId = this.generateExportId();
      const query: QCResultsQuery = {
        filters: exportFilters,
        sorting: { field: 'startedAt', direction: 'desc' },
        pagination: { limit: 50000, offset: 0 } // Large limit for exports
      };

      const results = await this.queryResults(query);

      // Generate export file
      const exportResult = await this.generateExportFile(results.data, format, filename);

      res.json(createApiResponse({
        exportId,
        format,
        filename: exportResult.filename,
        recordCount: results.data.length,
        downloadUrl: exportResult.downloadUrl,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      }, 'QC results export initiated successfully'));

    } catch (error) {
      this.logger.error('Failed to export QC results', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: createApiError('QC_EXPORT_FAILED', 'Failed to export QC results')
      });
    }
  }

  /**
   * Download exported file
   */
  private async downloadExport(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { exportId } = req.params;

      this.logger.debug('Downloading export file', {
        exportId,
        userId: req.user?.id
      });

      // In a real implementation, this would retrieve the file from storage
      // For now, return a placeholder response
      res.status(501).json({
        success: false,
        error: createApiError('DOWNLOAD_NOT_IMPLEMENTED', 'File download not yet implemented')
      });

    } catch (error) {
      this.logger.error('Failed to download export file', {
        error: error instanceof Error ? error.message : 'Unknown error',
        exportId: req.params.exportId,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: createApiError('QC_DOWNLOAD_FAILED', 'Failed to download export file')
      });
    }
  }

  // ============================================================================
  // COMPARISON AND BENCHMARKING
  // ============================================================================

  /**
   * Compare multiple QC results
   */
  private async compareResults(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { resultIds, comparisonType = 'side-by-side' } = req.body;

      this.logger.debug('Comparing QC results', {
        resultIds,
        comparisonType,
        userId: req.user?.id
      });

      if (!resultIds || resultIds.length < 2) {
        res.status(400).json({
          success: false,
          error: createApiError('INVALID_COMPARISON_REQUEST', 'At least 2 results required for comparison')
        });
        return;
      }

      const results = await Promise.all(
        resultIds.map((id: string) => this.cosmosService.getItem('results', id))
      );

      // Filter out null results and check access
      const validResults = results.filter(result => 
        result && this.hasResultAccess(req.user, result)
      );

      if (validResults.length < 2) {
        res.status(400).json({
          success: false,
          error: createApiError('INSUFFICIENT_RESULTS', 'Insufficient accessible results for comparison')
        });
        return;
      }

      const comparison = await this.generateComparison(validResults, comparisonType);

      res.json(createApiResponse(comparison, 'QC results comparison generated successfully'));

    } catch (error) {
      this.logger.error('Failed to compare QC results', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: createApiError('QC_COMPARISON_FAILED', 'Failed to compare QC results')
      });
    }
  }

  /**
   * Get benchmarking data
   */
  private async getBenchmarks(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const benchmarkType = req.query.benchmarkType as string || 'industry';
      const timeRange = req.query.timeRange as string || '90d';
      const dimension = req.query.dimension as string || 'checklist';

      this.logger.debug('Getting benchmarks', {
        benchmarkType,
        timeRange,
        dimension,
        userId: req.user?.id
      });

      const benchmarks = await this.calculateBenchmarks(
        benchmarkType,
        timeRange,
        dimension,
        req.user
      );

      res.json(createApiResponse(benchmarks, 'Benchmarks retrieved successfully'));

    } catch (error) {
      this.logger.error('Failed to get benchmarks', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: createApiError('QC_BENCHMARKS_FAILED', 'Failed to retrieve benchmarks')
      });
    }
  }

  // ============================================================================
  // VALIDATION MIDDLEWARE
  // ============================================================================

  private validateSearchResults() {
    return [
      query('limit').optional().isInt({ min: 1, max: 1000 }),
      query('offset').optional().isInt({ min: 0 }),
      query('sortBy').optional().isIn(['startedAt', 'completedAt', 'score', 'status']),
      query('sortOrder').optional().isIn(['asc', 'desc'])
    ];
  }

  private validateGetResult() {
    return [
      param('resultId').notEmpty().withMessage('Result ID is required')
    ];
  }

  private validateGetResultsByChecklist() {
    return [
      param('checklistId').notEmpty().withMessage('Checklist ID is required'),
      query('limit').optional().isInt({ min: 1, max: 200 }),
      query('offset').optional().isInt({ min: 0 })
    ];
  }

  private validateGetResultsByTarget() {
    return [
      param('targetId').notEmpty().withMessage('Target ID is required'),
      query('limit').optional().isInt({ min: 1, max: 200 }),
      query('offset').optional().isInt({ min: 0 })
    ];
  }

  private validateGetAnalyticsSummary() {
    return [
      query('timeRange').optional().isIn(['7d', '30d', '90d', '1y'])
    ];
  }

  private validateGetTrends() {
    return [
      query('timeRange').optional().isIn(['7d', '30d', '90d', '1y']),
      query('granularity').optional().isIn(['hourly', 'daily', 'weekly', 'monthly'])
    ];
  }

  private validateGetPerformance() {
    return [
      query('dimension').optional().isIn(['checklist', 'user', 'client', 'organization']),
      query('timeRange').optional().isIn(['7d', '30d', '90d', '1y'])
    ];
  }

  private validateGetIssuesAnalysis() {
    return [
      query('analysisType').optional().isIn(['frequency', 'severity', 'category', 'trends']),
      query('timeRange').optional().isIn(['7d', '30d', '90d', '1y'])
    ];
  }

  private validateGenerateReport() {
    return [
      body('title').notEmpty().withMessage('Report title is required'),
      body('format').optional().isIn(['json', 'csv', 'excel', 'pdf']),
      body('filters').isObject().withMessage('Filters must be an object')
    ];
  }

  private validateGetReports() {
    return [
      query('limit').optional().isInt({ min: 1, max: 200 }),
      query('offset').optional().isInt({ min: 0 })
    ];
  }

  private validateGetReport() {
    return [
      param('reportId').notEmpty().withMessage('Report ID is required')
    ];
  }

  private validateDeleteReport() {
    return [
      param('reportId').notEmpty().withMessage('Report ID is required')
    ];
  }

  private validateExportResults() {
    return [
      body('format').isIn(['csv', 'excel', 'json']).withMessage('Invalid export format'),
      body('filters').isObject().withMessage('Filters must be an object')
    ];
  }

  private validateDownloadExport() {
    return [
      param('exportId').notEmpty().withMessage('Export ID is required')
    ];
  }

  private validateCompareResults() {
    return [
      body('resultIds').isArray().withMessage('Result IDs must be an array'),
      body('resultIds').custom((ids) => ids.length >= 2).withMessage('At least 2 result IDs required'),
      body('comparisonType').optional().isIn(['side-by-side', 'diff', 'summary'])
    ];
  }

  private validateGetBenchmarks() {
    return [
      query('benchmarkType').optional().isIn(['industry', 'organization', 'user']),
      query('dimension').optional().isIn(['checklist', 'category', 'overall'])
    ];
  }

  private validateUpdateVerification() {
    return [
      param('resultId').isString().notEmpty(),
      param('itemId').isString().notEmpty(),
      body('verified').isBoolean(),
      body('verifiedBy').optional().isString(),
      body('verifiedAt').optional().isISO8601(),
      body('verificationNotes').optional().isString()
    ];
  }

  /**
   * Handle validation errors
   */
  private handleValidation(req: Request, res: Response, next: NextFunction): void {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: createApiError('VALIDATION_ERROR', 'Validation failed', {
          validationErrors: errors.array()
        })
      });
      return;
    }
    next();
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private buildFiltersFromQuery(queryParams: any, user: any): QCResultsFilter {
    const filters: QCResultsFilter = {};

    if (queryParams.checklistId) filters.checklistId = queryParams.checklistId;
    if (queryParams.targetId) filters.targetId = queryParams.targetId;
    if (queryParams.executedBy) filters.executedBy = queryParams.executedBy;
    if (queryParams.status) filters.status = queryParams.status;
    if (queryParams.riskLevel) filters.riskLevel = queryParams.riskLevel;
    if (queryParams.complianceStatus) filters.complianceStatus = queryParams.complianceStatus;
    if (queryParams.decision) filters.decision = queryParams.decision;
    if (queryParams.hasIssues) filters.hasIssues = queryParams.hasIssues === 'true';

    if (queryParams.minScore || queryParams.maxScore) {
      filters.scoreRange = {
        min: parseFloat(queryParams.minScore) || 0,
        max: parseFloat(queryParams.maxScore) || 100
      };
    }

    if (queryParams.startDate || queryParams.endDate) {
      filters.dateRange = {
        startDate: queryParams.startDate ? new Date(queryParams.startDate) : new Date(0),
        endDate: queryParams.endDate ? new Date(queryParams.endDate) : new Date()
      };
    }

    if (queryParams.tags) {
      filters.tags = queryParams.tags.split(',');
    }

    // Apply user context
    filters.clientId = queryParams.clientId || user?.clientId;
    filters.organizationId = queryParams.organizationId || user?.organizationId;

    return filters;
  }

  private buildSortingFromQuery(queryParams: any) {
    return {
      field: queryParams.sortBy || 'startedAt',
      direction: (queryParams.sortOrder as 'asc' | 'desc') || 'desc'
    };
  }

  private buildPaginationFromQuery(queryParams: any) {
    return {
      limit: parseInt(queryParams.limit) || 50,
      offset: parseInt(queryParams.offset) || 0
    };
  }

  private async queryResults(query: QCResultsQuery): Promise<any> {
    // Build Cosmos DB query based on filters
    let whereClause = 'WHERE 1=1';
    const parameters: any[] = [];

    if (query.filters.checklistId) {
      whereClause += ' AND c.checklistId = @checklistId';
      parameters.push({ name: '@checklistId', value: query.filters.checklistId });
    }

    if (query.filters.status) {
      whereClause += ' AND c.status = @status';
      parameters.push({ name: '@status', value: query.filters.status });
    }

    if (query.filters.clientId) {
      whereClause += ' AND c.clientId = @clientId';
      parameters.push({ name: '@clientId', value: query.filters.clientId });
    }

    if (query.filters.dateRange) {
      whereClause += ' AND c.startedAt >= @startDate AND c.startedAt <= @endDate';
      parameters.push(
        { name: '@startDate', value: query.filters.dateRange.startDate },
        { name: '@endDate', value: query.filters.dateRange.endDate }
      );
    }

    const orderBy = `ORDER BY c.${query.sorting?.field || 'startedAt'} ${query.sorting?.direction || 'DESC'}`;
    const offset = query.pagination?.offset || 0;
    const limit = query.pagination?.limit || 50;

    const sql = `SELECT * FROM c ${whereClause} ${orderBy} OFFSET ${offset} LIMIT ${limit}`;

    const results = await this.cosmosService.queryItems('results', sql, parameters);

    return {
      data: results.data || [],
      pagination: {
        offset,
        limit,
        total: results.data?.length || 0,
        hasMore: (results.data?.length || 0) === limit
      }
    };
  }

  private async calculateAnalyticsSummary(filters: QCResultsFilter, timeRange: string): Promise<any> {
    // Mock implementation - would calculate real analytics from Cosmos DB
    return {
      totalExecutions: 150,
      averageScore: 82.5,
      passRate: 78.3,
      criticalIssuesCount: 23,
      riskDistribution: {
        [RiskLevel.LOW]: 45,
        [RiskLevel.MEDIUM]: 67,
        [RiskLevel.HIGH]: 28,
        [RiskLevel.CRITICAL]: 10
      },
      complianceDistribution: {
        [ComplianceStatus.COMPLIANT]: 112,
        [ComplianceStatus.NON_COMPLIANT]: 25,
        [ComplianceStatus.NEEDS_REVIEW]: 13
      },
      timeRange,
      generatedAt: new Date()
    };
  }

  private async calculateTrends(filters: QCResultsFilter, timeRange: string, granularity: string): Promise<any> {
    // Mock implementation
    return {
      scoresTrend: [],
      volumeTrend: [],
      issuesTrend: [],
      timeRange,
      granularity,
      generatedAt: new Date()
    };
  }

  private async calculatePerformanceMetrics(filters: QCResultsFilter, dimension: string, timeRange: string): Promise<any> {
    // Mock implementation
    return {
      dimension,
      metrics: [],
      benchmarks: {},
      timeRange,
      generatedAt: new Date()
    };
  }

  private async analyzeIssues(filters: QCResultsFilter, analysisType: string, timeRange: string): Promise<any> {
    // Mock implementation
    return {
      analysisType,
      topIssues: [],
      issuesTrend: [],
      severityDistribution: {},
      timeRange,
      generatedAt: new Date()
    };
  }

  private async calculateReportSummary(filters: QCResultsFilter): Promise<any> {
    // Mock implementation
    return {
      totalResults: 0,
      avgScore: 0,
      passRate: 0,
      criticalIssuesCount: 0,
      riskDistribution: {},
      complianceDistribution: {}
    };
  }

  private generateReportId(): string {
    return `qc_report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateExportId(): string {
    return `qc_export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async generateReportFile(report: QCResultsReport): Promise<string> {
    // Mock implementation - would generate actual file and return URL
    return `/downloads/reports/${report.id}.${report.format}`;
  }

  private async generateExportFile(data: any[], format: string, filename?: string): Promise<any> {
    // Mock implementation - would generate actual export file
    const actualFilename = filename || `qc_export_${Date.now()}.${format}`;
    return {
      filename: actualFilename,
      downloadUrl: `/downloads/exports/${actualFilename}`
    };
  }

  private async generateComparison(results: any[], comparisonType: string): Promise<any> {
    // Mock implementation
    return {
      comparisonType,
      results: results.map(r => ({ id: r.id, summary: r.summary })),
      differences: [],
      commonIssues: [],
      generatedAt: new Date()
    };
  }

  private async calculateBenchmarks(benchmarkType: string, timeRange: string, dimension: string, user: any): Promise<any> {
    // Mock implementation
    return {
      benchmarkType,
      dimension,
      benchmarks: {},
      userPerformance: {},
      timeRange,
      generatedAt: new Date()
    };
  }

  private hasResultAccess(user: any, result: any): boolean {
    if (!user) return false;
    if (user.role === 'admin' || user.role === 'system') return true;
    if (result.executedBy === user.id) return true;
    if (result.clientId && user.clientId && result.clientId === user.clientId) return true;
    if (result.organizationId && user.organizationId && result.organizationId === user.organizationId) return true;
    return false;
  }

  private hasReportAccess(user: any, report: any): boolean {
    if (!user) return false;
    if (user.role === 'admin' || user.role === 'system') return true;
    if (report.generatedBy === user.id) return true;
    if (report.filters.clientId && user.clientId && report.filters.clientId === user.clientId) return true;
    if (report.filters.organizationId && user.organizationId && report.filters.organizationId === user.organizationId) return true;
    return false;
  }

  /**
   * Get the router instance
   */
  public getRouter(): Router {
    return this.router;
  }
}

// Create and export router instance
export const qcResultsRouter = new QCResultsController().getRouter();