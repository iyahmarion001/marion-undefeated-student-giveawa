import { app } from '../server/app';

// Export handler for Vercel Serverless Functions with URL normalization
export default function handler(req: any, res: any) {
  // If Vercel rewrote the request to /api/index, restore original URL from Vercel headers
  const forwardedUri =
    req.headers['x-forwarded-uri'] ||
    req.headers['x-vercel-matched-path'] ||
    req.headers['x-matched-path'];

  if (typeof forwardedUri === 'string' && (forwardedUri.startsWith('/api') || forwardedUri.startsWith('/'))) {
    req.url = forwardedUri;
  } else if (req.url === '/api/index' || req.url.startsWith('/api/index?')) {
    const parts = req.url.split('?');
    req.url = parts[0].replace(/^\/api\/index/, '/api') + (parts[1] ? `?${parts[1]}` : '');
  }

  return (app as any)(req, res);
}
