/**
 * Add Review Results to Existing QC Reviews
 * 
 * Updates existing QC review queue items to include the full categoriesResults
 * structure with questions/answers so they display properly in the UI.
 * 
 * Usage: node scripts/add-review-results-to-existing.js
 */

require('dotenv').config();
const { CosmosClient } = require('@azure/cosmos');
const { DefaultAzureCredential } = require('@azure/identity');

const COSMOS_ENDPOINT = process.env.AZURE_COSMOS_ENDPOINT || 'https://appraisal-mgmt-staging-cosmos.documents.azure.com:443/';
const DATABASE_ID = 'appraisal-management';

const credential = new DefaultAzureCredential();
const client = new CosmosClient({ endpoint: COSMOS_ENDPOINT, aadCredentials: credential });
const database = client.database(DATABASE_ID);

function generateReviewResults(qcReview, checklist) {
  console.log(`  Generating review results for ${qcReview.id}...`);
  
  // Build categoriesResults from checklist template
  const categoriesResults = checklist.categories.map((category, catIndex) => {
    const questions = [];
    
    category.subcategories.forEach((subcategory) => {
      subcategory.questions.forEach((question) => {
        // Realistic pass/fail: fail first question in first category only
        const isFirstCategory = catIndex === 0;
        const isFirstQuestion = questions.length === 0;
        const shouldFail = isFirstCategory && isFirstQuestion;
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
            confidence: passed ? 0.96 : 0.87,
            source: 'ai',
            evidence: {
              actual: passed ? 'Verified - Compliant' : 'Issue detected',
              expected: 'Compliant',
              explanation: passed 
                ? `${question.question} - Verified and meets all requirements`
                : `${question.question} - Does not meet requirements. ${question.description}`
            },
            citations: [
              {
                documentId: `doc-appraisal-${qcReview.id}`,
                documentName: 'Appraisal Report.pdf',
                documentType: 'appraisal',
                pageNumber: catIndex + 1,
                sectionReference: category.name,
                excerpt: `Found in ${category.name} section`
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
              description: `Issue detected: ${question.description}`,
              category: category.name,
              source: 'AI Analysis',
              recommendedAction: 'Request appraiser to provide supporting documentation and clarification'
            },
            criteria: {
              ruleId: `RULE-${question.id.toUpperCase()}`,
              description: question.description,
              sourceDocument: {
                documentId: 'doc-uspap',
                documentName: 'USPAP Standards',
                documentType: 'guideline',
                pageNumber: 14,
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
      score: errors === 0 ? 94 : 82,
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
  
  // Calculate overall summary
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
      recommendedAction: q.issue?.recommendedAction || 'Immediate review and correction required',
      evidence: q.answer.evidence
    }));
  
  return {
    categoriesResults,
    summary: {
      totalCategories: categoriesResults.length,
      totalQuestions: allQuestions.length,
      totalAnswered: allQuestions.length,
      totalErrors: totalErrors,
      totalWarnings: totalWarnings,
      criticalIssues: criticalIssues.length,
      averageConfidence: avgConfidence
    },
    criticalIssues,
    overallScore: totalErrors === 0 ? 94 : 82,
    passFailStatus: totalErrors === 0 ? 'PASS' : 'CONDITIONAL_PASS'
  };
}

async function addReviewResultsToExisting() {
  try {
    console.log('🚀 Adding review results to existing QC reviews...\n');
    
    // 1. Get the checklist template
    console.log('📋 Fetching QC checklist template...');
    const criteriaContainer = database.container('criteria');
    const { resource: checklist } = await criteriaContainer.item('checklist-uad-standard-2026', 'default-client').read();
    
    if (!checklist) {
      throw new Error('QC checklist not found. Run seed-qc-checklists-2026.js first.');
    }
    console.log(`✅ Found checklist: ${checklist.name}\n`);
    
    // 2. Get all existing QC reviews
    console.log('🔍 Fetching existing QC reviews...');
    const qcReviewsContainer = database.container('qc-reviews');
    const { resources: existingReviews } = await qcReviewsContainer.items.readAll().fetchAll();
    
    if (existingReviews.length === 0) {
      console.log('❌ No QC reviews found to update');
      return;
    }
    
    console.log(`✅ Found ${existingReviews.length} existing review(s)\n`);
    
    // 3. Update each review
    for (const review of existingReviews) {
      console.log(`📝 Updating: ${review.id} (${review.orderNumber || review.orderId})`);
      
      // Generate review results
      const reviewResults = generateReviewResults(review, checklist);
      
      // Merge with existing queue metadata
      const updatedReview = {
        ...review,
        
        // Add checklist reference
        checklistId: checklist.id,
        checklistName: checklist.name,
        checklistVersion: checklist.version,
        
        // Add review results
        categoriesResults: reviewResults.categoriesResults,
        criticalIssues: reviewResults.criticalIssues,
        summary: reviewResults.summary,
        overallScore: reviewResults.overallScore,
        passFailStatus: reviewResults.passFailStatus,
        
        // Update status and timestamps
        status: 'COMPLETED',
        startedAt: review.startedAt || new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 hour ago
        completedAt: new Date().toISOString(),
        reviewedBy: review.assignedAnalyst || 'analyst-001',
        reviewedByName: 'QC Analyst',
        
        // Metadata
        updatedAt: new Date().toISOString()
      };
      
      // Save back to database
      await qcReviewsContainer.items.upsert(updatedReview);
      
      console.log(`   ✅ Updated successfully`);
      console.log(`   - Categories: ${reviewResults.categoriesResults.length}`);
      console.log(`   - Total Questions: ${reviewResults.summary.totalQuestions}`);
      console.log(`   - Errors: ${reviewResults.summary.totalErrors}`);
      console.log(`   - Warnings: ${reviewResults.summary.totalWarnings}`);
      console.log(`   - Overall Score: ${reviewResults.overallScore}`);
      console.log(`   - Status: ${reviewResults.passFailStatus}\n`);
    }
    
    console.log('✨ All reviews updated successfully!\n');
    console.log('🔗 To test:');
    console.log('   1. Go to QC Queue in the UI');
    console.log('   2. Click on any of these orders:');
    existingReviews.forEach(r => {
      console.log(`      - ${r.orderNumber || r.orderId} (${r.propertyAddress || 'No address'})`);
    });
    console.log('   3. Should now see full review with all categories and questions');
    
  } catch (error) {
    console.error('❌ Error updating reviews:', error);
    throw error;
  }
}

// Run the script
addReviewResultsToExisting()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
