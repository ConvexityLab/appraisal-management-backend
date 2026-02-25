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
 *   GET  /api/comps/search   — keyword/geo search for comparables
 *   POST /api/comps/suggest  — ranked suggestions for a specific order/subject
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

  return router;
}
