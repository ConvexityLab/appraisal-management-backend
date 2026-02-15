/**
 * Seed QC Checklists with Document Requirements - 2026
 * 
 * Creates QC checklists that link criteria to required document categories
 * This enables the UI to show which documents are needed to validate each criterion
 * 
 * Uses the existing 'criteria' container (not a separate qc-checklists container)
 * 
 * Usage: node scripts/seed-qc-checklists-2026.js
 */

require('dotenv').config();
const { CosmosClient } = require('@azure/cosmos');
const { DefaultAzureCredential } = require('@azure/identity');

const COSMOS_ENDPOINT = process.env.AZURE_COSMOS_ENDPOINT || 'https://appraisal-mgmt-staging-cosmos.documents.azure.com:443/';
const DATABASE_ID = 'appraisal-management';
const TENANT_ID = 'test-tenant-001';
const CLIENT_ID = 'default-client'; // For criteria container partition key

const credential = new DefaultAzureCredential();
const client = new CosmosClient({ endpoint: COSMOS_ENDPOINT, aadCredentials: credential });
const database = client.database(DATABASE_ID);

// Generate unique ID
function generateId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Sample QC Checklist with Document Requirements
const sampleChecklist = {
  id: 'checklist-uad-standard-2026',
  type: 'qc-checklist',
  tenantId: TENANT_ID,
  clientId: CLIENT_ID, // Required for criteria container partition key
  
  name: 'UAD Standard Residential Appraisal Review',
  description: 'Comprehensive QC checklist for UAD-compliant residential appraisals with document validation requirements',
  version: '2026.1',
  checklistType: 'TECHNICAL',
  tags: ['uad', 'residential', 'standard', '2026'],
  
  active: true,
  
  // Categories with questions that require specific documents
  categories: [
    {
      id: 'property-identification',
      name: 'Property Identification & Description',
      description: 'Verify property details, address, legal description',
      priority: 'CRITICAL',
      tags: ['property', 'identification'],
      
      subcategories: [
        {
          id: 'basic-property-info',
          name: 'Basic Property Information',
          description: 'Core property identification data',
          priority: 'CRITICAL',
          tags: ['property', 'basic'],
          
          questions: [
            {
              id: 'property-address-correct',
              question: 'Is the property address accurate and matches title documents?',
              description: 'Verify street address, city, state, ZIP match title documents and public records',
              type: 'YES_NO',
              priority: 'CRITICAL',
              tags: ['address', 'identification'],
              
              dataRequirements: [
                {
                  id: 'property-address',
                  name: 'Property Address',
                  description: 'Full property address from appraisal report',
                  dataType: 'string',
                  required: true,
                  sourceType: 'UAD_SCHEMA',
                  sourcePath: '$.property.address'
                }
              ],
              
              // Link to required document categories
              requiredDocumentCategories: ['appraisal-report', 'title-document', 'property-listing'],
              
              documentationRequirements: [
                {
                  id: 'title-doc-address',
                  name: 'Title Document Address',
                  description: 'Property address from title document',
                  documentType: 'title-document',
                  required: true,
                  fieldReference: 'propertyAddress'
                }
              ],
              
              scoringWeight: 10,
              passingCriteria: {
                requiredAnswer: 'yes'
              }
            },
            {
              id: 'legal-description',
              question: 'Is the legal description complete and accurate?',
              description: 'Verify legal description includes lot, block, subdivision, and matches title',
              type: 'YES_NO',
              priority: 'HIGH',
              tags: ['legal', 'description'],
              
              requiredDocumentCategories: ['appraisal-report', 'title-document'],
              
              dataRequirements: [
                {
                  id: 'legal-desc',
                  name: 'Legal Description',
                  description: 'Legal description from report',
                  dataType: 'string',
                  required: true,
                  sourceType: 'DOCUMENT_FIELD',
                  sourcePath: '$.property.legalDescription'
                }
              ],
              
              scoringWeight: 8
            }
          ]
        }
      ]
    },
    
    {
      id: 'property-condition',
      name: 'Property Condition Assessment',
      description: 'Review property condition, photos, and inspection quality',
      priority: 'HIGH',
      tags: ['condition', 'photos'],
      
      subcategories: [
        {
          id: 'photo-quality',
          name: 'Photo Quality & Coverage',
          description: 'Verify inspection photos are clear and comprehensive',
          priority: 'HIGH',
          tags: ['photos', 'inspection'],
          
          questions: [
            {
              id: 'exterior-photos-adequate',
              question: 'Are exterior photos clear and show all required views?',
              description: 'Verify front, rear, street views are present and clear',
              type: 'YES_NO',
              priority: 'HIGH',
              tags: ['photos', 'exterior'],
              
              // Photos are required to validate this
              requiredDocumentCategories: ['property-photo', 'inspection-report'],
              
              dataRequirements: [
                {
                  id: 'exterior-photo-count',
                  name: 'Exterior Photo Count',
                  description: 'Number of exterior photos',
                  dataType: 'number',
                  required: true,
                  sourceType: 'DOCUMENT_FIELD',
                  validationRules: {
                    minValue: 4
                  }
                }
              ],
              
              scoringWeight: 7
            },
            {
              id: 'interior-photos-adequate',
              question: 'Are interior photos clear and show all major rooms?',
              description: 'Verify living room, kitchen, bedrooms, bathrooms photographed',
              type: 'YES_NO',
              priority: 'HIGH',
              tags: ['photos', 'interior'],
              
              requiredDocumentCategories: ['property-photo', 'inspection-report'],
              
              dataRequirements: [
                {
                  id: 'interior-photo-count',
                  name: 'Interior Photo Count',
                  description: 'Number of interior photos',
                  dataType: 'number',
                  required: true,
                  sourceType: 'DOCUMENT_FIELD',
                  validationRules: {
                    minValue: 6
                  }
                }
              ],
              
              scoringWeight: 7
            },
            {
              id: 'condition-rating-supported',
              question: 'Is the condition rating supported by photos and description?',
              description: 'Verify condition rating (C1-C6) matches visual evidence',
              type: 'YES_NO',
              priority: 'CRITICAL',
              tags: ['condition', 'rating'],
              
              requiredDocumentCategories: ['appraisal-report', 'property-photo', 'inspection-report'],
              
              dataRequirements: [
                {
                  id: 'condition-rating',
                  name: 'Condition Rating',
                  description: 'Property condition rating',
                  dataType: 'string',
                  required: true,
                  sourceType: 'UAD_SCHEMA',
                  sourcePath: '$.property.condition',
                  validationRules: {
                    allowedValues: ['C1', 'C2', 'C3', 'C4', 'C5', 'C6']
                  }
                }
              ],
              
              scoringWeight: 10
            }
          ]
        }
      ]
    },
    
    {
      id: 'comparable-sales',
      name: 'Comparable Sales Analysis',
      description: 'Review comparable selection, adjustments, and documentation',
      priority: 'CRITICAL',
      tags: ['comps', 'sales', 'valuation'],
      
      subcategories: [
        {
          id: 'comp-selection',
          name: 'Comparable Selection',
          description: 'Verify comparable properties are appropriate and recent',
          priority: 'CRITICAL',
          tags: ['comps', 'selection'],
          
          questions: [
            {
              id: 'comps-recent',
              question: 'Are all comparable sales within the last 12 months?',
              description: 'Verify sale dates are within acceptable timeframe',
              type: 'YES_NO',
              priority: 'HIGH',
              tags: ['comps', 'recency'],
              
              requiredDocumentCategories: ['appraisal-report', 'comparable-analysis', 'property-listing'],
              
              dataRequirements: [
                {
                  id: 'comp-sale-dates',
                  name: 'Comparable Sale Dates',
                  description: 'Sale dates of all comparables',
                  dataType: 'array',
                  required: true,
                  sourceType: 'UAD_SCHEMA',
                  sourcePath: '$.comparables[*].saleDate'
                }
              ],
              
              scoringWeight: 8
            },
            {
              id: 'comp-proximity',
              question: 'Are comparables located within reasonable proximity?',
              description: 'Verify comps are within 1 mile or same neighborhood',
              type: 'YES_NO',
              priority: 'HIGH',
              tags: ['comps', 'location'],
              
              requiredDocumentCategories: ['appraisal-report', 'comparable-analysis'],
              
              dataRequirements: [
                {
                  id: 'comp-distances',
                  name: 'Comparable Distances',
                  description: 'Distance from subject to each comp',
                  dataType: 'array',
                  required: true,
                  sourceType: 'CALCULATED'
                }
              ],
              
              scoringWeight: 7
            },
            {
              id: 'comp-similarity',
              question: 'Are comparables similar in size, age, and condition?',
              description: 'Verify comparables have similar GLA, year built, and condition',
              type: 'YES_NO',
              priority: 'CRITICAL',
              tags: ['comps', 'similarity'],
              
              requiredDocumentCategories: ['appraisal-report', 'comparable-analysis', 'property-listing'],
              
              dataRequirements: [
                {
                  id: 'comp-gla-variance',
                  name: 'GLA Variance',
                  description: 'Variance in gross living area',
                  dataType: 'number',
                  required: true,
                  sourceType: 'CALCULATED',
                  validationRules: {
                    maxValue: 500 // Max 500 sqft variance
                  }
                }
              ],
              
              scoringWeight: 10
            }
          ]
        }
      ]
    },
    
    {
      id: 'valuation-conclusion',
      name: 'Valuation Conclusion',
      description: 'Review final value opinion and reconciliation',
      priority: 'CRITICAL',
      tags: ['valuation', 'conclusion'],
      
      subcategories: [
        {
          id: 'value-reconciliation',
          name: 'Value Reconciliation',
          description: 'Verify final value opinion is supported and reasonable',
          priority: 'CRITICAL',
          tags: ['value', 'reconciliation'],
          
          questions: [
            {
              id: 'value-within-range',
              question: 'Is final value within reasonable range of comparable indicators?',
              description: 'Verify final value is within 5% of comp sales indicators',
              type: 'YES_NO',
              priority: 'CRITICAL',
              tags: ['value', 'range'],
              
              requiredDocumentCategories: ['appraisal-report', 'comparable-analysis'],
              
              dataRequirements: [
                {
                  id: 'value-variance',
                  name: 'Value Variance Percentage',
                  description: 'Variance from comp indicators',
                  dataType: 'number',
                  required: true,
                  sourceType: 'CALCULATED',
                  validationRules: {
                    maxValue: 5 // Max 5% variance
                  }
                }
              ],
              
              scoringWeight: 15
            },
            {
              id: 'reconciliation-explained',
              question: 'Is the value reconciliation well-explained and logical?',
              description: 'Verify appraiser explains how they arrived at final value',
              type: 'YES_NO',
              priority: 'HIGH',
              tags: ['reconciliation', 'explanation'],
              
              requiredDocumentCategories: ['appraisal-report'],
              
              dataRequirements: [
                {
                  id: 'reconciliation-text',
                  name: 'Reconciliation Narrative',
                  description: 'Text of reconciliation section',
                  dataType: 'string',
                  required: true,
                  sourceType: 'DOCUMENT_FIELD',
                  validationRules: {
                    minLength: 100 // At least 100 characters
                  }
                }
              ],
              
              scoringWeight: 10
            }
          ]
        }
      ]
    }
  ],
  
  // Scoring configuration
  scoringMethod: 'weighted_average',
  passingThreshold: 80,
  
  // Workflow
  workflow: {
    steps: [
      {
        id: 'ai-prescreening',
        name: 'AI Pre-screening',
        description: 'Automated analysis of report and documents',
        categories: [],
        assignedRole: 'system'
      },
      {
        id: 'manual-review',
        name: 'Manual QC Review',
        description: 'Analyst reviews flagged items and completes checklist',
        categories: ['property-identification', 'property-condition', 'comparable-sales', 'valuation-conclusion'],
        assignedRole: 'qc_analyst',
        timeoutMinutes: 240
      },
      {
        id: 'final-approval',
        name: 'Final Approval',
        description: 'Manager reviews and approves',
        categories: [],
        assignedRole: 'manager',
        timeoutMinutes: 60
      }
    ]
  },
  
  createdAt: new Date().toISOString(),
  createdBy: 'system',
  updatedAt: new Date().toISOString(),
  updatedBy: 'system'
};

async function seedQCChecklists() {
  try {
    console.log('🚀 Starting QC checklist seeding...');
    
    const container = database.container('criteria');
    
    // Upsert the sample checklist
    console.log('📝 Creating checklist:', sampleChecklist.name);
    await container.items.upsert(sampleChecklist);
    console.log('✅ Checklist created successfully in criteria container');
    
    console.log('\n✨ QC checklist seeding completed!');
    console.log('📋 Created checklist:', sampleChecklist.id);
    console.log('📊 Total categories:', sampleChecklist.categories.length);
    console.log('❓ Total questions:', 
      sampleChecklist.categories.reduce((total, cat) => 
        total + cat.subcategories.reduce((subTotal, sub) => 
          subTotal + sub.questions.length, 0), 0)
    );
    
  } catch (error) {
    console.error('❌ Error seeding QC checklists:', error);
    throw error;
  }
}

// Run the seed script
seedQCChecklists()
  .then(() => {
    console.log('✅ Seed script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Seed script failed:', error);
    process.exit(1);
  });
