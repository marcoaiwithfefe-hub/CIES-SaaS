import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { captureHkexScreenshot } from './src/services/hkexService';
import { captureSfcScreenshot } from './src/services/sfcService';
import { captureAfrcScreenshot } from './src/services/afrcService';
import { captureAfrcFirmScreenshot } from './src/services/afrcFirmService';
import { CONFIG } from './src/config';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  const setupSSE = (res: express.Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    return (type: string, data: any) => {
      res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
    };
  };

  app.post(CONFIG.ENDPOINTS.HKEX, async (req, res) => {
    const { stockCode } = req.body;
    if (!stockCode) {
      return res.status(400).json({ error: 'Stock code is required' });
    }

    const sendEvent = setupSSE(res);

    try {
      const image = await captureHkexScreenshot(stockCode, (message, step, totalSteps) => {
        sendEvent('progress', { message, step, totalSteps });
      });
      sendEvent('complete', { results: [{ query: stockCode, images: [image], totalMatches: 1 }] });
    } catch (error: any) {
      console.error('HKEX Screenshot error:', error);
      sendEvent('error', { error: error.details || { errorType: 'UNKNOWN', message: error.message || 'Failed to capture screenshot', stage: 'UNKNOWN' } });
    } finally {
      res.end();
    }
  });

  app.post(CONFIG.ENDPOINTS.SFC, async (req, res) => {
    const { fundNames } = req.body;
    if (!fundNames || !Array.isArray(fundNames) || fundNames.length === 0) {
      return res.status(400).json({ error: 'fundNames array is required' });
    }

    const sendEvent = setupSSE(res);

    try {
      const results = await captureSfcScreenshot(fundNames, (message, step, totalSteps) => {
        sendEvent('progress', { message, step, totalSteps });
      });
      sendEvent('complete', { results });
    } catch (error: any) {
      console.error('SFC Screenshot error:', error);
      sendEvent('error', { error: error.details || { errorType: 'UNKNOWN', message: error.message || 'Failed to capture screenshot', stage: 'UNKNOWN' } });
    } finally {
      res.end();
    }
  });

  app.post(CONFIG.ENDPOINTS.AFRC, async (req, res) => {
    const { searchType, searchValue } = req.body;
    if (!searchType || !searchValue) {
      return res.status(400).json({ error: 'searchType and searchValue are required' });
    }

    const sendEvent = setupSSE(res);

    try {
      const image = await captureAfrcScreenshot(searchType, searchValue, (message, step, totalSteps) => {
        sendEvent('progress', { message, step, totalSteps });
      });
      sendEvent('complete', { results: [{ query: searchValue, images: [image], totalMatches: 1 }] });
    } catch (error: any) {
      console.error('AFRC Screenshot error:', error);
      sendEvent('error', { error: error.details || { errorType: 'UNKNOWN', message: error.message || 'Failed to capture screenshot', stage: 'UNKNOWN' } });
    } finally {
      res.end();
    }
  });

  app.post(CONFIG.ENDPOINTS.AFRC_FIRM, async (req, res) => {
    const { searchType, searchValue } = req.body;
    if (!searchType || !searchValue) {
      return res.status(400).json({ error: 'searchType and searchValue are required' });
    }

    const sendEvent = setupSSE(res);

    try {
      const image = await captureAfrcFirmScreenshot(searchType, searchValue, (message, step, totalSteps) => {
        sendEvent('progress', { message, step, totalSteps });
      });
      sendEvent('complete', { results: [{ query: searchValue, images: [image], totalMatches: 1 }] });
    } catch (error: any) {
      console.error('AFRC Firm Screenshot error:', error);
      sendEvent('error', { error: error.details || { errorType: 'UNKNOWN', message: error.message || 'Failed to capture screenshot', stage: 'UNKNOWN' } });
    } finally {
      res.end();
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
