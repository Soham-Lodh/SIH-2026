import { Router, Request, Response } from 'express';
import { getSachetAlerts } from './sachet';
import { searchGoogleNews } from './googleNews';
import {
  buildHistoricalEvidenceBundle,
  compareDisasterEvents,
  chatResearchAssistant,
  generateTTSAudio,
  transcribeAudio,
} from './aiGateway';

const router = Router();

// In-memory request limiter / counter for API cost safety (Section 14)
let globalSearchCounter = 0;
const GLOBAL_SEARCH_CEILING = 150; // resets periodically

setInterval(() => {
  globalSearchCounter = Math.max(0, globalSearchCounter - 20);
}, 60000);

/**
 * POST /api/transcribe
 * Transcribes audio recordings from microphone using Gemini 3.7 Flash.
 */
router.post('/transcribe', async (req: Request, res: Response) => {
  try {
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
    res.status(500).json({
      error: 'Failed to execute historical research search',
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
      geminiAI: process.env.GEMINI_API_KEY ? 'configured' : 'missing_key_fallback_active',
    },
    version: '1.0.0',
  });
});

export default router;
