import { app } from '../server/app';

// Export handler for Vercel Serverless Functions with URL normalization
export default function handler(req: any, res: any) {
  try {
    // 1. URL Path Normalization for Vercel
    const urlObj = new URL(req.url, 'http://localhost');
    const apiPathQuery = urlObj.searchParams.get('__api_path');

    if (apiPathQuery) {
      // Reconstructed clean path e.g. /api/admin/login
      urlObj.searchParams.delete('__api_path');
      const remainingQuery = urlObj.searchParams.toString();
      req.url = `/api/${apiPathQuery}${remainingQuery ? `?${remainingQuery}` : ''}`;
    } else {
      const forwardedUri =
        req.headers['x-forwarded-uri'] ||
        req.headers['x-vercel-matched-path'] ||
        req.headers['x-matched-path'];

      if (typeof forwardedUri === 'string' && (forwardedUri.startsWith('/api') || forwardedUri.startsWith('/'))) {
        req.url = forwardedUri;
      }
    }

    // 2. Pre-parsed body normalization from Vercel runtime
    if (req.body && typeof req.body === 'object') {
      req._body = true;
    } else if (typeof req.body === 'string' && req.body.trim().startsWith('{')) {
      try {
        req.body = JSON.parse(req.body);
        req._body = true;
      } catch {}
    }

    // 3. Invoke Express application safely
    return (app as any)(req, res);
  } catch (err: any) {
    console.error('[Vercel Handler Fatal]:', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        error: `Serverless execution error: ${err?.message || 'Unknown error'}`,
      }));
    }
  }
}
