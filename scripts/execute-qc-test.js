/**
 * Execute QC Review for Testing
 * 
 * This script executes a QC checklist against an order and stores the results.
 * It simulates what the QC execution engine does.
 */

require('dotenv').config();
const { CosmosClient } = require('@azure/cosmos');
const { DefaultAzureCredential } = require('@azure/identity');

const COSMOS_ENDPOINT = process.env.AZURE_COSMOS_ENDPOINT || 'https://appraisal-mgmt-staging-cosmos.documents.azure.com:443/';
const DATABASE_ID = 'appraisal-management';

const credential = new DefaultAzureCredential();
const client = new CosmosClient({ endpoint: COSMOS_ENDPOINT, aadCredentials: credential });
const database = client.database(DATABASE_ID);

// Generate sample QC execution result for testing
function generateQCExecutionResult(queueItem, checklist) {
  const now = new Date().toISOString();
  
  // Build category results with all questions from checklist
  const categoriesResults = checklist.categories.map(category => {
    const questions = [];
    
    category.subcategories.forEach(subcategory => {
      subcategory.questions.forEach(question => {
        // Generate sample answer (randomly pass/fail for testing)
        const passed = Math.random() > 0.3; // 70% pass rate
        const severity = question.priority === 'CRITICAL' ? 'high' : question.priority === 'HIGH' ? 'medium' : 'low';
        
        questions.push({
          questionId: question.id,
          questionCode: question.id.toUpperCase().replace(/-/g, '_'),
          questionText: question.question,
          questionType: question.type || 'YES_NO',
          answer: {
            questionId: question.id,
            value: passed,
            confidence: 0.85 + Math.random() * 0.15,
            source: 'ai',
            evidence: {
              actual: passed ? 'Compliant' : 'Non-compliant',
              expected: 'Compliant',
              explanation: passed 
                ? `${question.question} - Verified and compliant`
                : `${question.question} - Issue detected`
            }
          },
          passed: passed,
          severity: passed ? 'low' : severity,
          verificationStatus: 'pending',
          ...(passed ? {} : {
            issue: {
              code: question.id.toUpperCase().replace(/-/g, '_'),
              title: question.question,
              description: `Issue found with: ${question.description}`,
              category: category.name,
              source: 'AI Analysis',
              recommendedAction: 'Review and verify'
            }
          })
        });
      });
    });
    
    const errors = questions.filter(q => !q.passed && q.severity === 'high').length;
    const warnings = questions.filter(q => !q.passed && (q.severity === 'medium' || q.severity === 'low')).length;
    
    return {
      categoryId: category.id,
      categoryName: category.name,
      categoryCode: category.id.toUpperCase().replace(/-/g, '_'),
      score: Math.round(85 + Math.random() * 10),
      passed: errors === 0,
      questions: questions,
      summary: {
        totalQuestions: questions.length,
        questionsAnswered: questions.length,
        errors: errors,
        warnings: warnings,
        averageConfidence: 0.90
      }
    };
  });
  
  const allQuestions = categoriesResults.flatMap(c => c.questions);
  const totalErrors = allQuestions.filter(q => !q.passed && q.severity === 'high').length;
  const totalWarnings = allQuestions.filter(q => !q.passed && (q.severity === 'medium' || q.severity === 'low')).length;
  
  return {
    id: `qc-result-${queueItem.id}`,
    sessionId: `session-${Date.now()}`,
    orderId: queueItem.orderId,
    orderNumber: queueItem.orderNumber,
    checklistId: checklist.id,
    checklistName: checklist.name,
    checklistVersion: checklist.version,
    propertyAddress: queueItem.propertyAddress,
    appraisedValue: queueItem.appraisedValue,
    status: 'COMPLETED',
    overallScore: Math.round(85 + Math.random() * 10),
    passFailStatus: totalErrors > 0 ? 'CONDITIONAL_PASS' : 'PASS',
    summary: {
      totalCategories: categoriesResults.length,
      totalQuestions: allQuestions.length,
      totalAnswered: allQuestions.length,
      totalErrors: totalErrors,
      totalWarnings: totalWarnings,
      criticalIssues: totalErrors,
      averageConfidence: 0.90
    },
    categoriesResults: categoriesResults,
    criticalIssues: allQuestions
      .filter(q => !q.passed && q.severity === 'high')
      .map(q => q.issue),
    startedAt: now,
    completedAt: now,
    reviewedBy: 'system',
    reviewedByName: 'AI System',
    createdAt: now,
    updatedAt: now
  };
}

async function executeQCReview(queueItemId) {
  try {
    console.log('🚀 Starting QC execution...\n');
    
    // 1. Fetch the queue item
    const qcReviewsContainer = database.container('qc-reviews');
    const { resources: queueItems } = await qcReviewsContainer.items
      .query({
        query: 'SELECT * FROM c WHERE c.id = @id',
        parameters: [{ name: '@id', value: queueItemId }]
      })
      .fetchAll();
    
    if (queueItems.length === 0) {
      console.error(`❌ Queue item ${queueItemId} not found`);
      return;
    }
    
    const queueItem = queueItems[0];
    console.log(`✅ Found queue item: ${queueItem.orderNumber}`);
    
    // 2. Fetch the checklist
    const criteriaContainer = database.container('criteria');
    const { resource: checklist } = await criteriaContainer
      .item('checklist-uad-standard-2026', 'default-client')
      .read();
    
    if (!checklist) {
      console.error('❌ Checklist not found');
      return;
    }
    
    console.log(`✅ Found checklist: ${checklist.name}`);
    console.log(`   Categories: ${checklist.categories.length}`);
    
    let totalQuestions = 0;
    checklist.categories.forEach(cat => {
      cat.subcategories.forEach(sub => {
        totalQuestions += sub.questions.length;
      });
    });
    console.log(`   Total Questions: ${totalQuestions}\n`);
    
    // 3. Generate execution result
    console.log('⚙️  Executing QC checklist...');
    const executionResult = generateQCExecutionResult(queueItem, checklist);
    
    console.log(`✅ Execution completed`);
    console.log(`   Overall Score: ${executionResult.overallScore}`);
    console.log(`   Status: ${executionResult.passFailStatus}`);
    console.log(`   Errors: ${executionResult.summary.totalErrors}`);
    console.log(`   Warnings: ${executionResult.summary.totalWarnings}\n`);
    
    // 4. Store result (upsert into qc-reviews with full results)
    console.log('💾 Storing QC result...');
    await qcReviewsContainer.items.upsert(executionResult);
    
    console.log(`✅ QC result stored with ID: ${executionResult.id}\n`);
    
    console.log('📊 Category Breakdown:');
    executionResult.categoriesResults.forEach((cat, i) => {
      console.log(`   ${i+1}. ${cat.categoryName}: ${cat.questions.length} questions (${cat.summary.errors} errors, ${cat.summary.warnings} warnings)`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

// Get queue item ID from command line or use default
const queueItemId = process.argv[2] || 'qc_review_20260208_001';

console.log(`📋 Executing QC review for queue item: ${queueItemId}\n`);

executeQCReview(queueItemId)
  .then(() => {
    console.log('\n✅ QC execution completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ QC execution failed:', error);
    process.exit(1);
  });
