import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { ADMIN_PASSWORD, JWT_SECRET, MUSICIAN_PASSWORD } from '../config';

const router = Router();

const USERS = {
  admin: { password: ADMIN_PASSWORD, role: 'admin' as const },
  musician: { password: MUSICIAN_PASSWORD, role: 'user' as const },
};

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  const user = (USERS as any)[username];
  if (!user || user.password !== password) return res.status(401).send('Invalid credentials');

  const token = jwt.sign({ username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ role: user.role, token });
});

router.post('/logout', (_req, res) => {
  // Tokens are stateless; the client discards its stored token on logout.
  res.json({ ok: true });
});

export default router;
