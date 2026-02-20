/**
 * Seed QC Smoke Test Data
 * 
 * Creates a complete end-to-end test scenario:
 * 1. An order
 * 2. A QC queue item pointing to that order
 * 3. A complete QC review result with categoriesResults/questions
 * 
 * This allows clicking a queue item and seeing the full review page with data.
 * 
 * Usage: node scripts/seed-qc-smoke-test.js
 */

require('dotenv').config();
const { CosmosClient } = require('@azure/cosmos');
const { DefaultAzureCredential } = require('@azure/identity');

const COSMOS_ENDPOINT = process.env.AZURE_COSMOS_ENDPOINT || 'https://appraisal-mgmt-staging-cosmos.documents.azure.com:443/';
const DATABASE_ID = 'appraisal-management';

const credential = new DefaultAzureCredential();
const client = new CosmosClient({ endpoint: COSMOS_ENDPOINT, aadCredentials: credential });
const database = client.database(DATABASE_ID);

// Test IDs for easy reference
const TEST_ORDER_ID = 'order-qc-smoke-test-001';
const TEST_QC_REVIEW_ID = 'qc-review-smoke-test-001';

async function seedSmokeTestData() {
  try {
    console.log('🚀 Starting QC smoke test data seeding...\n');
    
    // 1. Get the checklist from criteria container
    console.log('📋 Fetching QC checklist template...');
    const criteriaContainer = database.container('criteria');
    const { resource: checklist } = await criteriaContainer.item('checklist-uad-standard-2026', 'default-client').read();
    
    if (!checklist) {
      throw new Error('QC checklist not found. Run seed-qc-checklists-2026.js first.');
    }
    console.log(`✅ Found checklist: ${checklist.name} (${checklist.categories.length} categories)\n`);
    
    // 2. Create/Update Order
    console.log('📝 Creating test order...');
    const ordersContainer = database.container('orders');
    const testOrder = {
      id: TEST_ORDER_ID,
      orderNumber: 'ORD-SMOKE-TEST-001',
      clientId: 'client-test-001',
      clientName: 'Test Client Bank',
      propertyAddress: '742 Evergreen Terrace, Springfield, IL 62701',
      propertyCity: 'Springfield',
      propertyState: 'IL',
      propertyZip: '62701',
      borrowerName: 'Homer J. Simpson',
      loanNumber: 'LN-TEST-2026-001',
      loanAmount: 400000,
      appraisalType: 'FULL_APPRAISAL_1004',
      appraisedValue: 500000,
      orderStatus: 'QC_REVIEW',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      // Link to QC review
      qcReviewId: TEST_QC_REVIEW_ID
    };
    await ordersContainer.items.upsert(testOrder);
    console.log(`✅ Order created: ${testOrder.orderNumber}\n`);
    
    // 3. Build complete QC Review Result with all categories and questions
    console.log('🔍 Generating QC review result with all questions...');
    
    const categoriesResults = checklist.categories.map((category, catIndex) => {
      const questions = [];
      
      category.subcategories.forEach((subcategory, subIndex) => {
        subcategory.questions.forEach((question, qIndex) => {
          // Create realistic pass/fail pattern
          // First 2 questions fail, rest pass (for demo purposes)
          const totalQuestionsSoFar = questions.length;
          const shouldFail = totalQuestionsSoFar < 2;
          const passed = !shouldFail;
          
          const severity = shouldFail 
            ? (question.priority === 'CRITICAL' ? 'high' : 'medium')
            : 'low';
          
          questions.push({
            questionId: question.id,
            questionCode: question.id.toUpperCase().replace(/-/g, '_'),
            questionText: question.question,
            questionType: question.type || 'YES_NO',
            answer: {
              questionId: question.id,
              value: passed,
              confidence: passed ? 0.95 : 0.88,
              source: 'ai',
              evidence: {
                actual: passed ? 'Verified - Compliant' : 'Issue detected - Non-compliant',
                expected: 'Compliant',
                explanation: passed 
                  ? `${question.question} - Verified and meets requirements`
                  : `${question.question} - Does not meet requirements. ${question.description}`
              },
              citations: [
                {
                  documentId: 'doc-appraisal-001',
                  documentName: 'Appraisal Report.pdf',
                  documentType: 'appraisal',
                  pageNumber: catIndex + 1,
                  sectionReference: category.name,
                  excerpt: `Section ${catIndex + 1}.${subIndex + 1}.${qIndex + 1}`
                }
              ]
            },
            passed: passed,
            severity: severity,
            verificationStatus: 'pending',
            requiredDocumentCategories: question.requiredDocumentCategories || ['appraisal-report'],
            ...(passed ? {} : {
              issue: {
                code: question.id.toUpperCase().replace(/-/g, '_'),
                title: question.question,
                description: `Issue found: ${question.description}`,
                category: category.name,
                source: 'AI Analysis',
                recommendedAction: 'Request revision from appraiser with supporting documentation'
              },
              criteria: {
                ruleId: `RULE-${question.id.toUpperCase()}`,
                description: question.description,
                sourceDocument: {
                  documentId: 'doc-uspap',
                  documentName: 'USPAP Standards',
                  documentType: 'guideline',
                  pageNumber: 12,
                  sectionReference: 'Standard 2-2'
                }
              }
            })
          });
        });
      });
      
      const errors = questions.filter(q => !q.passed && q.severity === 'high').length;
      const warnings = questions.filter(q => !q.passed && (q.severity === 'medium' || q.severity === 'low')).length;
      const avgConfidence = questions.reduce((sum, q) => sum + (q.answer.confidence || 0), 0) / questions.length;
      
      return {
        categoryId: category.id,
        categoryName: category.name,
        categoryCode: category.id.toUpperCase().replace(/-/g, '_'),
        score: errors === 0 ? 95 : 78,
        passed: errors === 0,
        questions: questions,
        summary: {
          totalQuestions: questions.length,
          questionsAnswered: questions.length,
          errors: errors,
          warnings: warnings,
          averageConfidence: avgConfidence
        }
      };
    });
    
    // Calculate summary
    const allQuestions = categoriesResults.flatMap(c => c.questions);
    const totalErrors = allQuestions.filter(q => !q.passed && q.severity === 'high').length;
    const totalWarnings = allQuestions.filter(q => !q.passed && (q.severity === 'medium' || q.severity === 'low')).length;
    const avgConfidence = allQuestions.reduce((sum, q) => sum + (q.answer.confidence || 0), 0) / allQuestions.length;
    
    // Build critical issues list
    const criticalIssues = allQuestions
      .filter(q => !q.passed && q.severity === 'high')
      .map(q => ({
        questionId: q.questionId,
        code: q.issue?.code || q.questionCode,
        title: q.issue?.title || q.questionText,
        description: q.issue?.description || 'Critical issue detected',
        severity: q.severity,
        category: categoriesResults.find(cat => 
          cat.questions.some(cq => cq.questionId === q.questionId)
        )?.categoryName || 'Unknown',
        source: 'AI Analysis',
        verificationStatus: q.verificationStatus,
        recommendedAction: q.issue?.recommendedAction || 'Immediate review required',
        evidence: q.answer.evidence
      }));
    
    const qcReviewResult = {
      id: TEST_QC_REVIEW_ID,
      sessionId: `session-${Date.now()}`,
      orderId: TEST_ORDER_ID,
      orderNumber: testOrder.orderNumber,
      checklistId: checklist.id,
      checklistName: checklist.name,
      checklistVersion: checklist.version,
      propertyAddress: testOrder.propertyAddress,
      appraisedValue: testOrder.appraisedValue,
      status: 'COMPLETED',
      overallScore: totalErrors === 0 ? 95 : 82,
      passFailStatus: totalErrors === 0 ? 'PASS' : 'CONDITIONAL_PASS',
      summary: {
        totalCategories: categoriesResults.length,
        totalQuestions: allQuestions.length,
        totalAnswered: allQuestions.length,
        totalErrors: totalErrors,
        totalWarnings: totalWarnings,
        criticalIssues: criticalIssues.length,
        averageConfidence: avgConfidence
      },
      categoriesResults: categoriesResults,
      criticalIssues: criticalIssues,
      startedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(), // 45 mins ago
      completedAt: new Date().toISOString(),
      reviewedBy: 'analyst-test-001',
      reviewedByName: 'QC Test Analyst',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // 4. Save QC Review Result
    console.log('💾 Saving QC review result...');
    const qcReviewsContainer = database.container('qc-reviews');
    await qcReviewsContainer.items.upsert(qcReviewResult);
    console.log(`✅ QC review result saved: ${TEST_QC_REVIEW_ID}`);
    console.log(`   - Categories: ${categoriesResults.length}`);
    console.log(`   - Total Questions: ${allQuestions.length}`);
    console.log(`   - Errors: ${totalErrors}`);
    console.log(`   - Warnings: ${totalWarnings}`);
    console.log(`   - Overall Score: ${qcReviewResult.overallScore}`);
    console.log(`   - Status: ${qcReviewResult.passFailStatus}\n`);
    
    console.log('✨ Smoke test data seeding completed!\n');
    console.log('📋 Test Data Summary:');
    console.log(`   Order ID: ${TEST_ORDER_ID}`);
    console.log(`   Order Number: ${testOrder.orderNumber}`);
    console.log(`   QC Review ID: ${TEST_QC_REVIEW_ID}`);
    console.log(`   Property: ${testOrder.propertyAddress}`);
    console.log('\n🔗 To test:');
    console.log(`   1. Go to QC Queue`);
    console.log(`   2. Look for order: ${testOrder.orderNumber}`);
    console.log(`   3. Click to open review - should show ${allQuestions.length} criteria across ${categoriesResults.length} categories`);
    
  } catch (error) {
    console.error('❌ Error seeding smoke test data:', error);
    throw error;
  }
}

// Run the seed script
seedSmokeTestData()
  .then(() => {
    console.log('\n✅ Seed script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Seed script failed:', error);
    process.exit(1);
  });
