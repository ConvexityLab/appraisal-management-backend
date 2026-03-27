/**
 * Comps Controller
 *
 * Comparable property search and suggestion endpoints.
 * Backed by ValuationEngine — NO Bridge Interactive API dependency.
 *
 * Data is mocked inside ValuationEngine.findComparableProperties() today.
 * To go live: replace that method's body with a Cosmos DB or MLS query
 * keyed on lat/lng + radius + sale-date range.
 *
 * Routes:
 *   GET  /api/comps/search              — keyword/geo search for comparables
 *   POST /api/comps/suggest             — ranked suggestions for a specific order/subject
 *   POST /api/comps/suggest-adjustments — AI-generated per-attribute adjustments for a comp
 */

import { Router, Request, Response } from 'express';
import { Logger } from '../utils/logger.js';
import {
  ValuationEngine,
  SubjectFeatures,
} from '../services/valuation-engine.service.js';
import type { PropertyAddress } from '../types/index.js';

const logger = new Logger();

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createCompsRouter(): Router {
  const router = Router();
  const engine = new ValuationEngine();

  // -------------------------------------------------------------------------
  // GET /api/comps/search
  //
  // Query params:
  //   lat, lng           — subject coordinates (required)
  //   zip                — fallback if no lat/lng
  //   city, state        — optional context
  //   radius             — search radius in miles (default 1.0)
  //   bedrooms           — subject bedroom count
  //   bathrooms          — subject bathroom count
  //   gla                — subject gross living area (sqft)
  //   yearBuilt          — subject year built
  //   saleMonths         — how many months back to search (default 12)
  // -------------------------------------------------------------------------
  router.get('/search', async (req: Request, res: Response) => {
    try {
      const {
        lat, lng, zip = '',
        city = '', state = '',
        radius: _radius = '1.0',
        bedrooms: _beds = '3',
        bathrooms: _baths = '2',
        gla: _gla = '2000',
        yearBuilt: _yb = '2000',
        saleMonths: _months = '12',
      } = req.query as Record<string, string>;

      if (!lat && !lng && !zip) {
        return res.status(400).json({
          error: 'At least one of lat/lng or zip is required',
        });
      }

      const address: PropertyAddress = {
        streetAddress: '',
        city,
        state,
        zipCode: zip,
        county: '',
        ...(lat && lng ? { coordinates: { latitude: parseFloat(lat), longitude: parseFloat(lng) } } : {}),
      };

      const subject: SubjectFeatures = {
        squareFootage: parseFloat(_gla),
        bedrooms: parseFloat(_beds),
        bathrooms: parseFloat(_baths),
        yearBuilt: parseFloat(_yb),
      };

      const suggestions = await engine.suggestComparables(address, subject);

      return res.json({
        results: suggestions,
        total: suggestions.length,
        searchParams: {
          lat: lat ? parseFloat(lat) : null,
          lng: lng ? parseFloat(lng) : null,
          zip,
          radiusMiles: parseFloat(_radius),
          saleMonths: parseInt(_months, 10),
          subject,
        },
        source: 'valuation-engine',
        _mock: true,
      });
    } catch (err: any) {
      logger.error('GET /api/comps/search error', err);
      return res.status(500).json({ error: 'Comp search failed', message: err.message });
    }
  });

  // -------------------------------------------------------------------------
  // POST /api/comps/suggest
  //
  // Body:
  //   orderId            — used to look up subject property from Cosmos (optional today)
  //   subjectAddress     — { street, city, state, zip, lat, lng }
  //   subjectFeatures    — { squareFootage, bedrooms, bathrooms, yearBuilt?, lotSize? }
  //   maxResults         — cap on returned suggestions (default 5)
  // -------------------------------------------------------------------------
  router.post('/suggest', async (req: Request, res: Response) => {
    try {
      const {
        orderId,
        subjectAddress,
        subjectFeatures,
        maxResults = 5,
      } = req.body as {
        orderId?: string;
        subjectAddress?: {
          street?: string;
          city?: string;
          state?: string;
          zip?: string;
          lat?: number;
          lng?: number;
        };
        subjectFeatures?: SubjectFeatures;
        maxResults?: number;
      };

      if (!subjectAddress && !orderId) {
        return res.status(400).json({
          error: 'subjectAddress or orderId is required',
        });
      }

      if (!subjectFeatures) {
        return res.status(400).json({
          error: 'subjectFeatures is required (squareFootage, bedrooms, bathrooms)',
        });
      }

      const address: PropertyAddress = {
        streetAddress: subjectAddress?.street ?? '',
        city: subjectAddress?.city ?? '',
        state: subjectAddress?.state ?? '',
        zipCode: subjectAddress?.zip ?? '',
        county: '',
        ...(subjectAddress?.lat != null && subjectAddress?.lng != null
          ? { coordinates: { latitude: subjectAddress.lat, longitude: subjectAddress.lng } }
          : {}),
      };

      const suggestions = await engine.suggestComparables(address, subjectFeatures);
      const capped = suggestions.slice(0, Math.min(Number(maxResults), 10));

      return res.json({
        orderId: orderId ?? null,
        suggestions: capped,
        totalFound: suggestions.length,
        returned: capped.length,
        source: 'valuation-engine',
        generatedAt: new Date().toISOString(),
        _mock: true,
      });
    } catch (err: any) {
      logger.error('POST /api/comps/suggest error', err);
      return res.status(500).json({ error: 'Comp suggest failed', message: err.message });
    }
  });

  // -------------------------------------------------------------------------
  // POST /api/comps/suggest-adjustments
  //
  // AI-generated per-attribute adjustments for a single comp vs subject.
  //
  // Body:
  //   orderId?       — optional order reference
  //   subject        — { squareFootage, bedrooms, bathrooms, yearBuilt?, lotSize?, salePrice? }
  //   comp           — { propertyRecordId, squareFootage, bedrooms, bathrooms, yearBuilt?,
  //                      lotSize?, salePrice?, distance?, saleDate? }
  //
  // Returns: { adjustments[], totalAdjustment, adjustedValue, source, _mock }
  // -------------------------------------------------------------------------
  router.post('/suggest-adjustments', async (req: Request, res: Response) => {
    try {
      const { subject, comp } = req.body as {
        orderId?: string;
        subject?: {
          squareFootage: number;
          bedrooms: number;
          bathrooms: number;
          yearBuilt?: number;
          lotSize?: number;
          salePrice?: number;
        };
        comp?: {
          propertyRecordId: string;
          squareFootage: number;
          bedrooms: number;
          bathrooms: number;
          yearBuilt?: number;
          lotSize?: number;
          salePrice?: number;
          distance?: number;
          saleDate?: string;
        };
      };

      if (!subject) {
        return res.status(400).json({ error: 'subject is required' });
      }
      if (!comp) {
        return res.status(400).json({ error: 'comp is required' });
      }

      // Per-attribute adjustment calculation
      const adjustments: Array<{
        key: string;
        amount: number;
        confidence: 'high' | 'medium' | 'low';
        reasoning: string;
      }> = [];

      // GLA adjustment — $50/sqft deviation
      const glaDelta = (subject.squareFootage ?? 0) - (comp.squareFootage ?? 0);
      if (glaDelta !== 0) {
        const amount = Math.round(glaDelta * 50);
        adjustments.push({
          key: 'livingArea',
          amount,
          confidence: Math.abs(glaDelta) < 200 ? 'high' : Math.abs(glaDelta) < 500 ? 'medium' : 'low',
          reasoning: `${Math.abs(glaDelta)} sqft difference × $50/sqft = ${amount > 0 ? '+' : ''}$${amount.toLocaleString()}`,
        });
      }

      // Bedrooms — $5,000 per bedroom
      const bedDelta = (subject.bedrooms ?? 0) - (comp.bedrooms ?? 0);
      if (bedDelta !== 0) {
        const amount = bedDelta * 5000;
        adjustments.push({
          key: 'bedrooms',
          amount,
          confidence: Math.abs(bedDelta) <= 1 ? 'high' : 'medium',
          reasoning: `${Math.abs(bedDelta)} bedroom difference × $5,000 = ${amount > 0 ? '+' : ''}$${amount.toLocaleString()}`,
        });
      }

      // Bathrooms — $7,500 per bathroom
      const bathDelta = (subject.bathrooms ?? 0) - (comp.bathrooms ?? 0);
      if (bathDelta !== 0) {
        const amount = Math.round(bathDelta * 7500);
        adjustments.push({
          key: 'bathrooms',
          amount,
          confidence: Math.abs(bathDelta) <= 1 ? 'high' : 'medium',
          reasoning: `${Math.abs(bathDelta)} bathroom difference × $7,500 = ${amount > 0 ? '+' : ''}$${amount.toLocaleString()}`,
        });
      }

      // Year Built — $1,000 per year (age adjustment)
      if (subject.yearBuilt && comp.yearBuilt) {
        const ageDelta = subject.yearBuilt - comp.yearBuilt;
        if (ageDelta !== 0) {
          const amount = ageDelta * 1000;
          adjustments.push({
            key: 'yearBuilt',
            amount,
            confidence: Math.abs(ageDelta) <= 5 ? 'high' : Math.abs(ageDelta) <= 15 ? 'medium' : 'low',
            reasoning: `${Math.abs(ageDelta)} year difference × $1,000 = ${amount > 0 ? '+' : ''}$${amount.toLocaleString()}`,
          });
        }
      }

      // Lot Size — $2/sqft for lot differences
      if (subject.lotSize && comp.lotSize) {
        const lotDelta = subject.lotSize - comp.lotSize;
        if (Math.abs(lotDelta) > 500) {
          const amount = Math.round(lotDelta * 2);
          adjustments.push({
            key: 'lotSize',
            amount,
            confidence: Math.abs(lotDelta) < 2000 ? 'high' : 'medium',
            reasoning: `${Math.abs(lotDelta)} sqft lot difference × $2/sqft = ${amount > 0 ? '+' : ''}$${amount.toLocaleString()}`,
          });
        }
      }

      // Time (market conditions) — 0.3% per month
      if (comp.saleDate) {
        const monthsAgo = Math.round(
          (Date.now() - new Date(comp.saleDate).getTime()) / (1000 * 60 * 60 * 24 * 30.44),
        );
        if (monthsAgo > 3 && comp.salePrice) {
          const amount = Math.round(comp.salePrice * 0.003 * monthsAgo);
          adjustments.push({
            key: 'saleDate',
            amount,
            confidence: monthsAgo <= 12 ? 'high' : monthsAgo <= 18 ? 'medium' : 'low',
            reasoning: `${monthsAgo} months × 0.3%/month market appreciation = +$${amount.toLocaleString()}`,
          });
        }
      }

      // Distance/location — $2,000 per 0.5 mile beyond first mile
      if (comp.distance != null && comp.distance > 1.0) {
        const excessMiles = comp.distance - 1.0;
        const amount = -Math.round(excessMiles * 4000);
        adjustments.push({
          key: 'distance',
          amount,
          confidence: comp.distance < 3 ? 'medium' : 'low',
          reasoning: `${excessMiles.toFixed(1)} excess miles × -$4,000/mi = $${amount.toLocaleString()}`,
        });
      }

      const totalAdjustment = adjustments.reduce((sum, a) => sum + a.amount, 0);
      const adjustedValue = comp.salePrice != null ? comp.salePrice + totalAdjustment : null;

      return res.json({
        adjustments,
        totalAdjustment,
        adjustedValue,
        source: 'valuation-engine',
        _mock: true,
      });
    } catch (err: any) {
      logger.error('POST /api/comps/suggest-adjustments error', err);
      return res.status(500).json({ error: 'Adjustment suggest failed', message: err.message });
    }
  });

  // -------------------------------------------------------------------------
  // POST /api/comps/strategy-search (Phase 3.3)
  //
  // Strategy-contextualised comp search — wraps the standard search with
  // investment-strategy-specific filters and enriched response fields.
  //
  // Body:
  //   subjectAddress     — { street, city, state, zip, lat, lng }
  //   subjectFeatures    — { squareFootage, bedrooms, bathrooms, yearBuilt? }
  //   strategyContext    — 'flip' | 'rental' | 'new_construction' | 'land' | 'standard'
  //   maxResults?        — cap on results (default 10)
  //
  // Strategy effects:
  //   flip:             boosts comps with short hold times (<180 days), adds holdDays field
  //   rental:           adds grossYield + capRateEstimate calculated fields
  //   new_construction: filters to comps built in last 5 years
  //   land:             filters to land sales (minimal sqft)
  //   standard:         no filter modification (default comp search)
  // -------------------------------------------------------------------------
  router.post('/strategy-search', async (req: Request, res: Response) => {
    try {
      const {
        subjectAddress,
        subjectFeatures,
        strategyContext = 'standard',
        maxResults = 10,
        monthlyRentEstimate,
      } = req.body as {
        subjectAddress?: {
          street?: string;
          city?: string;
          state?: string;
          zip?: string;
          lat?: number;
          lng?: number;
        };
        subjectFeatures?: SubjectFeatures;
        strategyContext?: 'flip' | 'rental' | 'new_construction' | 'land' | 'standard';
        maxResults?: number;
        /** Used for rental gross yield calculation (monthly rent) */
        monthlyRentEstimate?: number;
      };

      if (!subjectAddress) return res.status(400).json({ error: 'subjectAddress is required' });
      if (!subjectFeatures) return res.status(400).json({ error: 'subjectFeatures is required' });

      const address: PropertyAddress = {
        streetAddress: subjectAddress.street ?? '',
        city: subjectAddress.city ?? '',
        state: subjectAddress.state ?? '',
        zipCode: subjectAddress.zip ?? '',
        county: '',
        ...(subjectAddress.lat != null && subjectAddress.lng != null
          ? { coordinates: { latitude: subjectAddress.lat, longitude: subjectAddress.lng } }
          : {}),
      };

      let suggestions = await engine.suggestComparables(address, subjectFeatures);

      // Strategy-specific filtering and enrichment
      if (strategyContext === 'new_construction') {
        // No year-based filter — CompSuggestion does not carry yearBuilt.
        // When real MLS data is ingested, filter by construction date server-side.
      } else if (strategyContext === 'land') {
        suggestions = suggestions.filter(s => (s.squareFootage ?? 999) < 100);
      }

      const capped = suggestions.slice(0, Math.min(Number(maxResults), 20));

      // Enrich based on strategy
      type EnrichedComp = (typeof capped)[number] & {
        holdDays?: number;
        grossYield?: number;
        capRateEstimate?: number;
      };
      const enriched: EnrichedComp[] = capped.map((comp) => {
        const base: EnrichedComp = { ...comp };
        if (strategyContext === 'flip' && comp.saleDate) {
          // Approximate hold days: random seed for mock — real data from MLS listDate
          const listedDate = new Date(comp.saleDate);
          listedDate.setDate(listedDate.getDate() - Math.floor(Math.random() * 120 + 30));
          base.holdDays = Math.floor(
            (new Date(comp.saleDate).getTime() - listedDate.getTime()) / 86400000,
          );
        } else if (strategyContext === 'rental' && monthlyRentEstimate && comp.salePrice) {
          const annualRent = monthlyRentEstimate * 12;
          base.grossYield = Math.round((annualRent / comp.salePrice) * 10000) / 100; // %
          const noi = annualRent * 0.6; // rough 40% expense ratio
          base.capRateEstimate = Math.round((noi / comp.salePrice) * 10000) / 100; // %
        }
        return base;
      });

      // For flip strategy: sort by holdDays ascending (fastest flips first)
      if (strategyContext === 'flip') {
        enriched.sort((a, b) => (a.holdDays ?? 9999) - (b.holdDays ?? 9999));
      }

      return res.json({
        results: enriched,
        strategyContext,
        total: enriched.length,
        source: 'valuation-engine',
        _mock: true,
        generatedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      logger.error('POST /api/comps/strategy-search error', err);
      return res.status(500).json({ error: 'Strategy search failed', message: err.message });
    }
  });

  return router;
}
