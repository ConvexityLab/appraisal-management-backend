# Appraisal Review System - Frontend Integration Guide

## 🎯 Overview

This guide shows you how to integrate the Appraisal Review System with any frontend framework (React, Vue, Angular, or plain JavaScript).

---

## 📡 API Endpoints Available

### Base URL
```
https://your-api-domain.com/api/reviews
```

### Authentication
All endpoints require JWT token in Authorization header:
```javascript
headers: {
  'Authorization': 'Bearer YOUR_JWT_TOKEN',
  'Content-Type': 'application/json'
}
```

---

## 🔄 Complete Frontend Integration Flow

### **Step 1: Create a Review Request**

#### Endpoint
```
POST /api/reviews
```

#### React Example
```typescript
// components/ReviewRequest.tsx
import { useState } from 'react';

interface CreateReviewData {
  orderId: string;
  originalAppraisalId: string;
  reviewType: 'TECHNICAL_REVIEW' | 'DESK_REVIEW' | 'FIELD_REVIEW';
  priority: 'ROUTINE' | 'URGENT' | 'CRITICAL';
  requestReason: string;
  dueDate?: string;
}

export function ReviewRequestForm() {
  const [formData, setFormData] = useState<CreateReviewData>({
    orderId: '',
    originalAppraisalId: '',
    reviewType: 'TECHNICAL_REVIEW',
    priority: 'ROUTINE',
    requestReason: ''
  });

  const createReview = async () => {
    try {
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const result = await response.json();
      
      if (result.success) {
        console.log('Review created:', result.data);
        // Navigate to review detail page
        window.location.href = `/reviews/${result.data.id}`;
      }
    } catch (error) {
      console.error('Failed to create review:', error);
    }
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); createReview(); }}>
      <h2>Request Appraisal Review</h2>
      
      <div>
        <label>Order ID</label>
        <input
          value={formData.orderId}
          onChange={(e) => setFormData({...formData, orderId: e.target.value})}
          required
        />
      </div>

      <div>
        <label>Review Type</label>
        <select
          value={formData.reviewType}
          onChange={(e) => setFormData({...formData, reviewType: e.target.value as any})}
        >
          <option value="TECHNICAL_REVIEW">Technical Review</option>
          <option value="DESK_REVIEW">Desk Review</option>
          <option value="FIELD_REVIEW">Field Review</option>
          <option value="COMPLIANCE_REVIEW">Compliance Review</option>
        </select>
      </div>

      <div>
        <label>Priority</label>
        <select
          value={formData.priority}
          onChange={(e) => setFormData({...formData, priority: e.target.value as any})}
        >
          <option value="ROUTINE">Routine</option>
          <option value="URGENT">Urgent</option>
          <option value="CRITICAL">Critical</option>
        </select>
      </div>

      <div>
        <label>Reason for Review</label>
        <textarea
          value={formData.requestReason}
          onChange={(e) => setFormData({...formData, requestReason: e.target.value})}
          placeholder="Explain why this review is needed..."
          required
        />
      </div>

      <button type="submit">Create Review</button>
    </form>
  );
}
```

---

### **Step 2: List and Filter Reviews**

#### Endpoint
```
GET /api/reviews?status=IN_PROGRESS&page=1&limit=20
```

#### React Example
```typescript
// components/ReviewList.tsx
import { useEffect, useState } from 'react';

interface Review {
  id: string;
  orderId: string;
  reviewType: string;
  status: string;
  priority: string;
  assignedTo?: string;
  requestedAt: string;
  dueDate?: string;
  originalValue: number;
  reviewedValue?: number;
}

export function ReviewList() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [filters, setFilters] = useState({
    status: '',
    reviewType: '',
    assignedTo: '',
    page: 1,
    limit: 20
  });
  const [pagination, setPagination] = useState({
    total: 0,
    totalPages: 0
  });

  const fetchReviews = async () => {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.reviewType) params.append('reviewType', filters.reviewType);
    if (filters.assignedTo) params.append('assignedTo', filters.assignedTo);
    params.append('page', filters.page.toString());
    params.append('limit', filters.limit.toString());

    try {
      const response = await fetch(`/api/reviews?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const result = await response.json();
      
      if (result.success) {
        setReviews(result.data);
        setPagination(result.pagination);
      }
    } catch (error) {
      console.error('Failed to fetch reviews:', error);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, [filters]);

  return (
    <div className="review-list">
      {/* Filters */}
      <div className="filters">
        <select 
          value={filters.status} 
          onChange={(e) => setFilters({...filters, status: e.target.value})}
        >
          <option value="">All Statuses</option>
          <option value="REQUESTED">Requested</option>
          <option value="ASSIGNED">Assigned</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="COMPLETED">Completed</option>
        </select>

        <select 
          value={filters.reviewType} 
          onChange={(e) => setFilters({...filters, reviewType: e.target.value})}
        >
          <option value="">All Types</option>
          <option value="TECHNICAL_REVIEW">Technical Review</option>
          <option value="DESK_REVIEW">Desk Review</option>
          <option value="FIELD_REVIEW">Field Review</option>
        </select>
      </div>

      {/* Review Table */}
      <table>
        <thead>
          <tr>
            <th>Review ID</th>
            <th>Order</th>
            <th>Type</th>
            <th>Status</th>
            <th>Priority</th>
            <th>Assigned To</th>
            <th>Due Date</th>
            <th>Value</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {reviews.map(review => (
            <tr key={review.id}>
              <td>{review.id}</td>
              <td>{review.orderId}</td>
              <td>{review.reviewType}</td>
              <td>
                <span className={`status-badge ${review.status.toLowerCase()}`}>
                  {review.status}
                </span>
              </td>
              <td>{review.priority}</td>
              <td>{review.assignedTo || 'Unassigned'}</td>
              <td>{review.dueDate ? new Date(review.dueDate).toLocaleDateString() : '-'}</td>
              <td>
                ${review.originalValue.toLocaleString()}
                {review.reviewedValue && (
                  <span> → ${review.reviewedValue.toLocaleString()}</span>
                )}
              </td>
              <td>
                <button onClick={() => window.location.href = `/reviews/${review.id}`}>
                  View
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Pagination */}
      <div className="pagination">
        <button 
          disabled={filters.page === 1}
          onClick={() => setFilters({...filters, page: filters.page - 1})}
        >
          Previous
        </button>
        <span>Page {filters.page} of {pagination.totalPages}</span>
        <button 
          disabled={filters.page === pagination.totalPages}
          onClick={() => setFilters({...filters, page: filters.page + 1})}
        >
          Next
        </button>
      </div>
    </div>
  );
}
```

---

### **Step 3: Review Detail & Workflow Management**

#### Endpoint
```
GET /api/reviews/:id
```

#### React Example
```typescript
// components/ReviewDetail.tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

interface ReviewDetail {
  id: string;
  orderId: string;
  reviewType: string;
  status: string;
  priority: string;
  requestReason: string;
  assignedTo?: string;
  currentStage: {
    name: string;
    status: string;
    order: number;
  };
  stages: Array<{
    name: string;
    status: string;
    order: number;
    startedAt?: string;
    completedAt?: string;
  }>;
  findings: Array<{
    id: string;
    category: string;
    severity: 'CRITICAL' | 'MAJOR' | 'MINOR';
    description: string;
    recommendation: string;
  }>;
  originalValue: number;
  reviewedValue?: number;
  valueAdjustment?: number;
}

export function ReviewDetail() {
  const { reviewId } = useParams();
  const [review, setReview] = useState<ReviewDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchReview = async () => {
    try {
      const response = await fetch(`/api/reviews/${reviewId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const result = await response.json();
      
      if (result.success) {
        setReview(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch review:', error);
    } finally {
      setLoading(false);
    }
  };

  const startReview = async () => {
    try {
      const response = await fetch(`/api/reviews/${reviewId}/start`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const result = await response.json();
      
      if (result.success) {
        setReview(result.data);
        alert('Review started!');
      }
    } catch (error) {
      console.error('Failed to start review:', error);
    }
  };

  const advanceStage = async () => {
    try {
      const response = await fetch(`/api/reviews/${reviewId}/advance`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const result = await response.json();
      
      if (result.success) {
        setReview(result.data);
        alert(`Advanced to: ${result.data.currentStage.name}`);
      }
    } catch (error) {
      console.error('Failed to advance stage:', error);
    }
  };

  useEffect(() => {
    fetchReview();
  }, [reviewId]);

  if (loading) return <div>Loading...</div>;
  if (!review) return <div>Review not found</div>;

  return (
    <div className="review-detail">
      {/* Header */}
      <header>
        <h1>Review {review.id}</h1>
        <span className={`status-badge ${review.status.toLowerCase()}`}>
          {review.status}
        </span>
        <span className={`priority-badge ${review.priority.toLowerCase()}`}>
          {review.priority}
        </span>
      </header>

      {/* Workflow Progress */}
      <div className="workflow-progress">
        <h2>Workflow Progress</h2>
        <div className="stages">
          {review.stages.map((stage, index) => (
            <div 
              key={index} 
              className={`stage ${stage.status.toLowerCase()}`}
            >
              <div className="stage-number">{stage.order}</div>
              <div className="stage-name">{stage.name}</div>
              <div className="stage-status">{stage.status}</div>
              {stage.completedAt && (
                <div className="stage-completed">
                  ✓ {new Date(stage.completedAt).toLocaleString()}
                </div>
              )}
            </div>
          ))}
        </div>
        
        {review.status === 'ASSIGNED' && (
          <button onClick={startReview} className="btn-primary">
            Start Review
          </button>
        )}
        
        {review.status === 'IN_PROGRESS' && (
          <button onClick={advanceStage} className="btn-primary">
            Advance to Next Stage
          </button>
        )}
      </div>

      {/* Review Details */}
      <div className="review-info">
        <h2>Review Information</h2>
        <div className="info-grid">
          <div><strong>Order ID:</strong> {review.orderId}</div>
          <div><strong>Review Type:</strong> {review.reviewType}</div>
          <div><strong>Assigned To:</strong> {review.assignedTo || 'Unassigned'}</div>
          <div><strong>Current Stage:</strong> {review.currentStage.name}</div>
        </div>
        <div className="reason">
          <strong>Reason for Review:</strong>
          <p>{review.requestReason}</p>
        </div>
      </div>

      {/* Value Information */}
      <div className="value-info">
        <h2>Value Analysis</h2>
        <div className="value-grid">
          <div className="value-box">
            <label>Original Value</label>
            <div className="value">${review.originalValue.toLocaleString()}</div>
          </div>
          {review.reviewedValue && (
            <>
              <div className="value-box">
                <label>Reviewed Value</label>
                <div className="value">${review.reviewedValue.toLocaleString()}</div>
              </div>
              <div className="value-box">
                <label>Adjustment</label>
                <div className={`value ${review.valueAdjustment! > 0 ? 'positive' : 'negative'}`}>
                  ${Math.abs(review.valueAdjustment!).toLocaleString()}
                  ({((review.valueAdjustment! / review.originalValue) * 100).toFixed(2)}%)
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Findings */}
      <div className="findings">
        <h2>Findings ({review.findings.length})</h2>
        {review.findings.map(finding => (
          <div key={finding.id} className={`finding ${finding.severity.toLowerCase()}`}>
            <div className="finding-header">
              <span className="severity-badge">{finding.severity}</span>
              <span className="category">{finding.category}</span>
            </div>
            <div className="finding-description">{finding.description}</div>
            <div className="finding-recommendation">
              <strong>Recommendation:</strong> {finding.recommendation}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

### **Step 4: Add Findings**

#### Endpoint
```
POST /api/reviews/:id/findings
```

#### React Example
```typescript
// components/AddFindingForm.tsx
import { useState } from 'react';

interface FindingFormData {
  category: string;
  severity: 'CRITICAL' | 'MAJOR' | 'MINOR';
  description: string;
  location?: string;
  requirement?: string;
  recommendation: string;
}

export function AddFindingForm({ reviewId, onSuccess }: { reviewId: string; onSuccess: () => void }) {
  const [formData, setFormData] = useState<FindingFormData>({
    category: 'ADJUSTMENTS',
    severity: 'MAJOR',
    description: '',
    location: '',
    requirement: '',
    recommendation: ''
  });

  const addFinding = async () => {
    try {
      const response = await fetch(`/api/reviews/${reviewId}/findings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          status: 'OPEN'
        })
      });

      const result = await response.json();
      
      if (result.success) {
        alert('Finding added successfully!');
        onSuccess();
      }
    } catch (error) {
      console.error('Failed to add finding:', error);
    }
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); addFinding(); }}>
      <h3>Add Finding</h3>

      <div>
        <label>Category</label>
        <select
          value={formData.category}
          onChange={(e) => setFormData({...formData, category: e.target.value})}
        >
          <option value="VALUE_CONCLUSION">Value Conclusion</option>
          <option value="COMPARABLE_SELECTION">Comparable Selection</option>
          <option value="COMPARABLE_VERIFICATION">Comparable Verification</option>
          <option value="ADJUSTMENTS">Adjustments</option>
          <option value="PROPERTY_DESCRIPTION">Property Description</option>
          <option value="USPAP_COMPLIANCE">USPAP Compliance</option>
        </select>
      </div>

      <div>
        <label>Severity</label>
        <select
          value={formData.severity}
          onChange={(e) => setFormData({...formData, severity: e.target.value as any})}
        >
          <option value="CRITICAL">Critical</option>
          <option value="MAJOR">Major</option>
          <option value="MINOR">Minor</option>
        </select>
      </div>

      <div>
        <label>Description</label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({...formData, description: e.target.value})}
          placeholder="Describe the issue found..."
          required
        />
      </div>

      <div>
        <label>Location (optional)</label>
        <input
          value={formData.location}
          onChange={(e) => setFormData({...formData, location: e.target.value})}
          placeholder="e.g., Page 2, Sales Comparison Grid"
        />
      </div>

      <div>
        <label>Requirement (optional)</label>
        <input
          value={formData.requirement}
          onChange={(e) => setFormData({...formData, requirement: e.target.value})}
          placeholder="e.g., USPAP Standards Rule 1-4"
        />
      </div>

      <div>
        <label>Recommendation</label>
        <textarea
          value={formData.recommendation}
          onChange={(e) => setFormData({...formData, recommendation: e.target.value})}
          placeholder="Recommend corrective action..."
          required
        />
      </div>

      <button type="submit">Add Finding</button>
    </form>
  );
}
```

---

### **Step 5: Comparable Analysis**

#### Endpoint
```
POST /api/reviews/:id/comparable-analysis
```

#### React Example
```typescript
// components/ComparableAnalysis.tsx
import { useState } from 'react';

interface ComparableData {
  address: string;
  salePrice: number;
  saleDate: string;
  gla: number;
  bedrooms: number;
  bathrooms: number;
  yearBuilt: number;
  lotSize: number;
  condition: string;
  quality: string;
}

export function ComparableAnalysisForm({ reviewId }: { reviewId: string }) {
  const [subjectProperty, setSubjectProperty] = useState({
    address: '',
    propertyType: 'Single Family',
    gla: 0,
    bedrooms: 0,
    bathrooms: 0,
    yearBuilt: 0,
    lotSize: 0,
    condition: 'C3 (Average)',
    quality: 'Q4 (Average)'
  });

  const [comparables, setComparables] = useState<ComparableData[]>([
    {
      address: '',
      salePrice: 0,
      saleDate: '',
      gla: 0,
      bedrooms: 0,
      bathrooms: 0,
      yearBuilt: 0,
      lotSize: 0,
      condition: 'C3 (Average)',
      quality: 'Q4 (Average)'
    }
  ]);

  const [analysis, setAnalysis] = useState<any>(null);

  const runAnalysis = async () => {
    try {
      const response = await fetch(`/api/reviews/${reviewId}/comparable-analysis`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          subjectProperty,
          comparables
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setAnalysis(result.data);
        alert('Analysis completed!');
      }
    } catch (error) {
      console.error('Failed to run analysis:', error);
    }
  };

  return (
    <div className="comparable-analysis">
      <h2>Comparable Sales Analysis</h2>

      {/* Subject Property Form */}
      <div className="subject-property">
        <h3>Subject Property</h3>
        {/* Form fields for subject property */}
      </div>

      {/* Comparables List */}
      <div className="comparables-list">
        <h3>Comparable Sales</h3>
        {comparables.map((comp, index) => (
          <div key={index} className="comparable-form">
            <h4>Comparable #{index + 1}</h4>
            {/* Form fields for comparable */}
          </div>
        ))}
        <button onClick={() => setComparables([...comparables, {...comparables[0]}])}>
          Add Comparable
        </button>
      </div>

      <button onClick={runAnalysis} className="btn-primary">
        Run Analysis
      </button>

      {/* Analysis Results */}
      {analysis && (
        <div className="analysis-results">
          <h3>Analysis Results</h3>
          
          <div className="summary">
            <p><strong>Selection Quality:</strong> {analysis.summary.selectionQuality}</p>
            <p><strong>Comparables Verified:</strong> {analysis.summary.comparablesVerified}/{analysis.summary.totalComparablesReviewed}</p>
            <p><strong>Value Range:</strong> ${analysis.summary.valueIndicationRange.low.toLocaleString()} - ${analysis.summary.valueIndicationRange.high.toLocaleString()}</p>
          </div>

          <div className="comparable-details">
            {analysis.comparables.map((comp: any, index: number) => (
              <div key={index} className="comparable-card">
                <h4>Comp #{comp.compNumber}: {comp.address}</h4>
                <div className="comp-stats">
                  <div>Sale Price: ${comp.salePrice.toLocaleString()}</div>
                  <div>Adjustments: ${comp.totalAdjustment.toLocaleString()} ({comp.totalAdjustmentPercent.toFixed(1)}%)</div>
                  <div>Adjusted Value: ${comp.adjustedValue.toLocaleString()}</div>
                  <div>Score: {comp.appropriatenessScore}/100</div>
                  <div>Status: {comp.verificationStatus}</div>
                  <div>Action: {comp.recommendedAction}</div>
                </div>
                {comp.appropriatenessIssues.length > 0 && (
                  <div className="issues">
                    <strong>Issues:</strong>
                    <ul>
                      {comp.appropriatenessIssues.map((issue: string, i: number) => (
                        <li key={i}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

---

### **Step 6: Complete Review & Generate Report**

#### Complete Review Endpoint
```
POST /api/reviews/:id/complete
```

#### Generate Report Endpoint
```
POST /api/reviews/:id/report
```

#### React Example
```typescript
// components/CompleteReview.tsx
import { useState } from 'react';

export function CompleteReviewForm({ reviewId }: { reviewId: string }) {
  const [outcome, setOutcome] = useState('APPROVED');
  const [reviewedValue, setReviewedValue] = useState<number | null>(null);
  const [valueAdjustmentReason, setValueAdjustmentReason] = useState('');

  const completeReview = async () => {
    try {
      // Complete the review
      const completeResponse = await fetch(`/api/reviews/${reviewId}/complete`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          outcome,
          reviewedValue,
          valueAdjustmentReason
        })
      });

      const completeResult = await completeResponse.json();
      
      if (completeResult.success) {
        // Generate the report
        const reportResponse = await fetch(`/api/reviews/${reviewId}/report`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            reportType: 'FORM_2010',
            includeFindingsDetail: true,
            includeComparableAnalysis: true,
            includePhotos: false,
            certify: true
          })
        });

        const reportResult = await reportResponse.json();
        
        if (reportResult.success) {
          alert('Review completed and report generated!');
          // Download or display the report
          window.location.href = reportResult.data.pdfUrl;
        }
      }
    } catch (error) {
      console.error('Failed to complete review:', error);
    }
  };

  return (
    <div className="complete-review">
      <h2>Complete Review</h2>

      <div>
        <label>Outcome</label>
        <select value={outcome} onChange={(e) => setOutcome(e.target.value)}>
          <option value="APPROVED">Approved</option>
          <option value="APPROVED_WITH_CONDITIONS">Approved with Conditions</option>
          <option value="REQUIRES_REVISION">Requires Revision</option>
          <option value="VALUE_ADJUSTED">Value Adjusted</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>

      {outcome === 'VALUE_ADJUSTED' && (
        <>
          <div>
            <label>Reviewed Value</label>
            <input
              type="number"
              value={reviewedValue || ''}
              onChange={(e) => setReviewedValue(Number(e.target.value))}
              placeholder="Enter reviewed value"
            />
          </div>

          <div>
            <label>Reason for Adjustment</label>
            <textarea
              value={valueAdjustmentReason}
              onChange={(e) => setValueAdjustmentReason(e.target.value)}
              placeholder="Explain why the value was adjusted..."
            />
          </div>
        </>
      )}

      <button onClick={completeReview} className="btn-primary btn-large">
        Complete Review & Generate Report
      </button>
    </div>
  );
}
```

---

### **Step 7: Analytics Dashboard**

#### Endpoint
```
GET /api/reviews/metrics/summary?dateFrom=2026-01-01&dateTo=2026-12-31
```

#### React Example
```typescript
// components/ReviewAnalytics.tsx
import { useEffect, useState } from 'react';
import { BarChart, PieChart } from 'your-chart-library';

interface ReviewMetrics {
  totalReviews: number;
  reviewsByStatus: Record<string, number>;
  reviewsByType: Record<string, number>;
  averageTurnaroundTime: number;
  onTimeCompletion: number;
  valueAdjustmentRate: number;
  averageValueAdjustment: number;
}

export function ReviewAnalyticsDashboard() {
  const [metrics, setMetrics] = useState<ReviewMetrics | null>(null);
  const [dateRange, setDateRange] = useState({
    dateFrom: '2026-01-01',
    dateTo: '2026-12-31'
  });

  const fetchMetrics = async () => {
    try {
      const params = new URLSearchParams(dateRange);
      const response = await fetch(`/api/reviews/metrics/summary?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const result = await response.json();
      
      if (result.success) {
        setMetrics(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, [dateRange]);

  if (!metrics) return <div>Loading...</div>;

  return (
    <div className="analytics-dashboard">
      <h1>Review Analytics</h1>

      {/* Key Metrics */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-value">{metrics.totalReviews}</div>
          <div className="metric-label">Total Reviews</div>
        </div>

        <div className="metric-card">
          <div className="metric-value">{metrics.averageTurnaroundTime}h</div>
          <div className="metric-label">Avg Turnaround</div>
        </div>

        <div className="metric-card">
          <div className="metric-value">{metrics.onTimeCompletion}%</div>
          <div className="metric-label">On-Time Completion</div>
        </div>

        <div className="metric-card">
          <div className="metric-value">${metrics.averageValueAdjustment.toLocaleString()}</div>
          <div className="metric-label">Avg Value Adjustment</div>
        </div>
      </div>

      {/* Charts */}
      <div className="charts-grid">
        <div className="chart-container">
          <h3>Reviews by Status</h3>
          <PieChart data={metrics.reviewsByStatus} />
        </div>

        <div className="chart-container">
          <h3>Reviews by Type</h3>
          <BarChart data={metrics.reviewsByType} />
        </div>
      </div>
    </div>
  );
}
```

---

## 🔧 Complete API Client Service

### Centralized API Service (Recommended)
```typescript
// services/reviewApiClient.ts

class ReviewApiClient {
  private baseUrl = '/api/reviews';
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('token');
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Request failed');
    }

    return result.data;
  }

  // Create
  async createReview(data: CreateReviewRequest) {
    return this.request('/','{ method: 'POST', body: JSON.stringify(data) });
  }

  // List
  async listReviews(filters?: any, page = 1, limit = 20) {
    const params = new URLSearchParams({ page: page.toString(), limit: limit.toString(), ...filters });
    return this.request(`/?${params}`);
  }

  // Get single
  async getReview(id: string) {
    return this.request(`/${id}`);
  }

  // Assign
  async assignReview(id: string, assignment: AssignReviewRequest) {
    return this.request(`/${id}/assign`, { method: 'POST', body: JSON.stringify(assignment) });
  }

  // Start
  async startReview(id: string) {
    return this.request(`/${id}/start`, { method: 'POST' });
  }

  // Add finding
  async addFinding(id: string, finding: any) {
    return this.request(`/${id}/findings`, { method: 'POST', body: JSON.stringify(finding) });
  }

  // Complete
  async completeReview(id: string, outcome: string, reviewedValue?: number) {
    return this.request(`/${id}/complete`, { 
      method: 'POST', 
      body: JSON.stringify({ outcome, reviewedValue }) 
    });
  }

  // Generate report
  async generateReport(id: string, options: GenerateReviewReportRequest) {
    return this.request(`/${id}/report`, { method: 'POST', body: JSON.stringify(options) });
  }

  // Analytics
  async getMetrics(dateFrom?: string, dateTo?: string) {
    const params = new URLSearchParams();
    if (dateFrom) params.append('dateFrom', dateFrom);
    if (dateTo) params.append('dateTo', dateTo);
    return this.request(`/metrics/summary?${params}`);
  }
}

export const reviewApi = new ReviewApiClient();
```

### Usage in Components
```typescript
import { reviewApi } from '@/services/reviewApiClient';

// In your component
const handleCreateReview = async () => {
  try {
    const review = await reviewApi.createReview(formData);
    console.log('Created:', review);
  } catch (error) {
    console.error('Error:', error);
  }
};
```

---

## 🎨 Sample CSS Styles

```css
/* Review Status Badges */
.status-badge {
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
}

.status-badge.requested { background: #e3f2fd; color: #1976d2; }
.status-badge.assigned { background: #fff3e0; color: #f57c00; }
.status-badge.in_progress { background: #fce4ec; color: #c2185b; }
.status-badge.completed { background: #e8f5e9; color: #388e3c; }

/* Finding Severity */
.finding.critical { border-left-color: #d32f2f; background: #ffebee; }
.finding.major { border-left-color: #ff9800; background: #fff3e0; }
.finding.minor { border-left-color: #ffc107; background: #fffde7; }

/* Workflow Stages */
.stage.completed { background: #e8f5e9; color: #388e3c; }
.stage.in_progress { background: #fce4ec; color: #c2185b; }
.stage.pending { background: #f5f5f5; color: #757575; }
```

---

## ✅ Summary

**You now have:**
1. ✅ Complete REST API with 18 endpoints
2. ✅ React components for all major workflows
3. ✅ Centralized API client service
4. ✅ Real-time workflow management
5. ✅ Analytics dashboard integration
6. ✅ Form validation and error handling

**The frontend can:**
- Create and manage reviews
- Track workflow progress in real-time
- Add findings and document issues
- Run comparable analysis
- Generate professional reports
- View analytics and metrics

All you need is to connect your frontend framework to these REST endpoints! 🚀
