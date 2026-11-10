import { app } from '../server/app';

// Export handler for Vercel Serverless Functions with URL normalization and async completion guarantee
export default function handler(req: any, res: any) {
  return new Promise((resolve) => {
    // 9-second safety timeout: guarantee response before Vercel serverless gateway timeout
    const timeoutTimer = setTimeout(() => {
      if (!res.headersSent) {
        res.statusCode = 504;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Gateway timeout processing request.' }));
      }
      resolve(true);
    }, 9000);

    const finish = () => {
      clearTimeout(timeoutTimer);
      resolve(true);
    };

    try {
      // 1. URL Path Normalization for Vercel
      const urlObj = new URL(req.url, 'http://localhost');
      const apiPathQuery = urlObj.searchParams.get('__api_path');

      if (apiPathQuery) {
        urlObj.searchParams.delete('__api_path');
        const cleanSub = apiPathQuery.startsWith('/') ? apiPathQuery : `/${apiPathQuery}`;
        const remainingQuery = urlObj.searchParams.toString();
        req.url = `/api${cleanSub}${remainingQuery ? `?${remainingQuery}` : ''}`;
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

      // 3. Resolve the serverless promise when response finishes or closes
      res.once('finish', finish);
      res.once('close', finish);

      // 4. Invoke Express application safely with error fallback
      (app as any)(req, res, (err: any) => {
        if (err && !res.headersSent) {
          console.error('[Vercel Express Unhandled Error]:', err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            error: `Serverless execution error: ${err?.message || 'Unknown error'}`,
          }));
        }
        finish();
      });
    } catch (err: any) {
      console.error('[Vercel Handler Fatal]:', err);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          error: `Serverless execution error: ${err?.message || 'Unknown error'}`,
        }));
      }
      finish();
    }
  });
}
