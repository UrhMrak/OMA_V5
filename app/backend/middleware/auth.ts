import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config';

export type AuthUser = { username: string; role: 'admin' | 'user' } | null;

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}

function getToken(req: Request): string | null {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice('Bearer '.length).trim();
  return null;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = getToken(req);
    if (!token) return res.status(401).send('Unauthorized');
    const payload = jwt.verify(token, JWT_SECRET) as any;
    req.user = { username: payload.username, role: payload.role };
    next();
  } catch {
    return res.status(401).send('Unauthorized');
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    if (req.user?.role !== 'admin') return res.status(403).send('Forbidden');
    next();
  });
}
