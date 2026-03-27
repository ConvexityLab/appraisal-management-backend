/**
 * Debug the QC Results API issue
 */

import express from 'express';
import { CosmosDbService } from '../src/services/cosmos-db.service.ts';

const app = express();

// Simple debug endpoint
app.get('/debug-qc/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    console.log('🐛 Debug: Testing orderId =', orderId);
    
    const cosmosService = new CosmosDbService();
    await cosmosService.initialize();
    
    // Step 1: Try results container (should fail)
    console.log('🐛 Step 1: Trying results container...');
    const resultFromResults = await cosmosService.getItem('results', orderId);
    console.log('🐛 Step 1 result:', !!resultFromResults);
    
    // Step 2: Try qc-reviews query (should work)
    console.log('🐛 Step 2: Trying qc-reviews query...');
    const query = {
      query: 'SELECT * FROM c WHERE c.orderId = @orderId',
      parameters: [{ name: '@orderId', value: orderId }]
    };
    
    const qcReviewResult = await cosmosService.queryItems('qc-reviews', query);
    console.log('🐛 Step 2 result:', {
      success: qcReviewResult.success,
      count: qcReviewResult.data?.length || 0,
      error: qcReviewResult.error
    });
    
    if (qcReviewResult.success && qcReviewResult.data && qcReviewResult.data.length > 0) {
      const qcReview = qcReviewResult.data[0];
      console.log('🐛 Found QC review:', {
        id: qcReview.id,
        orderId: qcReview.orderId,
        categories: qcReview.categoriesResults?.length
      });
      
      res.json({
        success: true,
        data: qcReview,
        debug: {
          foundInResults: !!resultFromResults,
          foundInQcReviews: true,
          queryUsed: query
        }
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Not found',
        debug: {
          foundInResults: !!resultFromResults,
          foundInQcReviews: false,
          queryResult: qcReviewResult
        }
      });
    }
    
  } catch (error) {
    console.error('🐛 Debug error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      debug: {
        step: 'exception',
        stack: error.stack
      }
    });
  }
});

const port = 3002;
app.listen(port, () => {
  console.log(`🐛 Debug server running on http://localhost:${port}`);
  console.log(`🐛 Test URL: http://localhost:${port}/debug-qc/ord_2024_00123456`);
});