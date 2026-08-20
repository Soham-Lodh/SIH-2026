import { Router, Request, Response } from 'express';
import { getSachetAlerts } from './sachet';
import { searchGoogleNews } from './googleNews';
import {
  buildHistoricalEvidenceBundle,
  buildRecentIndiaArchive,
  compareDisasterEvents,
  chatResearchAssistant,
  generateTTSAudio,
  transcribeAudio,
  isGroqConfigured,
  warmRecentIndiaArchive,
} from './aiGateway';

const router = Router();
warmRecentIndiaArchive(30);

// In-memory request limiter / counter for API cost safety (Section 14)
let globalSearchCounter = 0;
const GLOBAL_SEARCH_CEILING = 150; // resets periodically
const geocodeCache = new Map<string, { expiresAt: number; payload: any }>();
const GEOCODE_CACHE_TTL_MS = 10 * 60 * 1000;

setInterval(() => {
  globalSearchCounter = Math.max(0, globalSearchCounter - 20);
}, 60000);

/**
 * POST /api/transcribe
 * Transcribes audio recordings from microphone using Groq Whisper.
 */
router.post('/transcribe', async (req: Request, res: Response) => {
  try {
    if (!isGroqConfigured()) {
      return res.status(503).json({
        error: 'Groq is not configured on the server',
        details: 'Set GROQ_API_KEY in the server environment and restart the app.',
      });
    }

    const { audioBase64, mimeType } = req.body;
    if (!audioBase64) {
      return res.status(400).json({ error: 'Audio data is required for transcription' });
    }

    const text = await transcribeAudio(audioBase64, mimeType || 'audio/webm');
    res.json({ text, success: true });
  } catch (error) {
    res.status(500).json({
      error: 'Audio transcription failed',
      details: (error as Error).message,
    });
  }
});

/**
 * GET /api/alerts
 * Returns all active official SACHET alerts with ETag support and expiry filtering.
 */
router.get('/alerts', async (req: Request, res: Response) => {
  try {
    const clientEtag = req.headers['if-none-match'];
    const result = await getSachetAlerts(typeof clientEtag === 'string' ? clientEtag : undefined);

    res.setHeader('ETag', result.etag);
    res.setHeader('Cache-Control', 'public, max-age=15');

    if (!result.isModified && clientEtag) {
      return res.status(304).end();
    }

    const categories = Array.from(new Set(result.alerts.map((a) => a.category)));

    res.json({
      alerts: result.alerts,
      activeCount: result.alerts.length,
      categoriesCount: categories.length,
      categories,
      lastUpdated: result.lastUpdated,
      cacheStatus: result.cacheStatus,
      etag: result.etag,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve SACHET alerts',
      details: (error as Error).message,
    });
  }
});

/**
 * GET /api/alerts/:id/news
 * Returns temporally gated (72h default), recent news coverage for a selected alert.
 */
router.get('/alerts/:id/news', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const query = (req.query.q as string) || 'Odisha cyclone warning';
    const windowHours = parseInt((req.query.window as string) || '72', 10);

    const news = await searchGoogleNews(query, {
      isCurrentNews: true,
      windowHours,
      maxResults: 6,
    });

    res.setHeader('Cache-Control', 'public, max-age=60');

    res.json({
      alertId: id,
      query,
      windowHours,
      articles: news,
      count: news.length,
      retrievedAt: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve current news for alert',
      details: (error as Error).message,
    });
  }
});

/**
 * GET /api/geocode?q=
 * Resolves a free-form Indian location query using the public Nominatim geocoder.
 */
router.get('/geocode', async (req: Request, res: Response) => {
  try {
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!query) {
      return res.status(400).json({ error: 'Location query is required' });
    }

    const cacheKey = query.toLowerCase();
    const cached = geocodeCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      res.setHeader('Cache-Control', 'public, max-age=600');
      return res.json(cached.payload);
    }

    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&addressdetails=1&q=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'DisasterIntelligencePlatform/1.0 (geocoding)',
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      return res.status(502).json({
        error: 'Geocoding service unavailable',
      });
    }

    const results = await response.json();
    const places = Array.isArray(results)
      ? results.map((item: any) => ({
          name: item.display_name || item.name || query,
          lat: Number(item.lat),
          lng: Number(item.lon),
          state: item.address?.state || item.address?.state_district || item.address?.county || undefined,
          district: item.address?.county || item.address?.city_district || item.address?.district || undefined,
          country: item.address?.country || 'India',
          raw: item,
        }))
      : [];

    const filtered = places.filter((place) => Number.isFinite(place.lat) && Number.isFinite(place.lng));

    const payload = {
      query,
      count: filtered.length,
      places: filtered,
      timestamp: new Date().toISOString(),
    };

    geocodeCache.set(cacheKey, {
      expiresAt: Date.now() + GEOCODE_CACHE_TTL_MS,
      payload,
    });

    res.setHeader('Cache-Control', 'public, max-age=600');
    res.json(payload);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to resolve location',
      details: (error as Error).message,
    });
  }
});

/**
 * POST /api/past/search
 * Searches historical disaster events and generates an EvidenceBundle with stable citations.
 */
router.post('/past/search', async (req: Request, res: Response) => {
  try {
    const { query, category, state } = req.body;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    if (globalSearchCounter >= GLOBAL_SEARCH_CEILING) {
      return res.status(429).json({
        error: 'Please allow results to load before searching again (Demo rate ceiling reached).',
      });
    }
    globalSearchCounter++;

    const bundle = await buildHistoricalEvidenceBundle(query, category, state);
    res.json({ bundle });
  } catch (error) {
    const details = (error as Error).message;
    if (/no live google news sources were found/i.test(details)) {
      return res.status(200).json({
        bundle: null,
        noResults: true,
        error: null,
        details: 'No live news sources were found for this query.',
      });
    }

    res.status(500).json({
      error: 'Failed to execute historical research search',
      details,
    });
  }
});

/**
 * GET /api/past/archive
 * Returns a live recent-disaster archive built from Google News-backed evidence bundles.
 */
router.get('/past/archive', async (_req: Request, res: Response) => {
  try {
    const categoryFilter = typeof _req.query.category === 'string' ? _req.query.category : undefined;
    const stateFilter = typeof _req.query.state === 'string' ? _req.query.state : undefined;
    const decadeFilter = typeof _req.query.decade === 'string' ? _req.query.decade : undefined;
    const items = await buildRecentIndiaArchive(30, { categoryFilter, stateFilter, decadeFilter });
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json({ items, count: items.length, retrievedAt: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to build recent disaster archive',
      details: (error as Error).message,
    });
  }
});

/**
 * POST /api/past/compare
 * Compares 2-4 disaster events using their evidence bundles.
 */
router.post('/past/compare', async (req: Request, res: Response) => {
  try {
    const { bundles } = req.body;
    if (!Array.isArray(bundles) || bundles.length < 2 || bundles.length > 4) {
      return res.status(400).json({ error: 'Select between 2 and 4 events to compare' });
    }

    const comparison = await compareDisasterEvents(bundles);
    res.json(comparison);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to generate comparison matrix',
      details: (error as Error).message,
    });
  }
});

/**
 * POST /api/past/chat
 * Multi-turn research assistant with multilingual voice support.
 */
router.post('/past/chat', async (req: Request, res: Response) => {
  try {
    const { message, history, targetLanguage, associatedBundle } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const chatResponse = await chatResearchAssistant({
      message,
      history: Array.isArray(history) ? history : [],
      targetLanguage: targetLanguage || 'en',
      associatedBundle,
    });

    res.json(chatResponse);
  } catch (error) {
    res.status(500).json({
      error: 'AI Assistant query failed',
      details: (error as Error).message,
    });
  }
});

/**
 * POST /api/tts
 * Synthesizes speech audio for Indian languages.
 */
router.post('/tts', async (req: Request, res: Response) => {
  try {
    if (!isGroqConfigured()) {
      return res.status(503).json({
        error: 'Groq is not configured on the server',
        details: 'Set GROQ_API_KEY in the server environment and restart the app.',
      });
    }

    const { text, voiceName } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Text is required for TTS' });
    }

    const audioBase64 = await generateTTSAudio(text, voiceName || 'Kore');
    res.json({ audioBase64 });
  } catch (error) {
    res.status(500).json({
      error: 'TTS generation failed',
      details: (error as Error).message,
    });
  }
});

/**
 * GET /api/health
 * Lightweight health endpoint with provider diagnostics.
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    providers: {
      sachet: 'operational',
      googleNews: 'operational',
      groqAI: isGroqConfigured() ? 'configured' : 'missing_key_fallback_active',
    },
    version: '1.0.0',
  });
});

export default router;
