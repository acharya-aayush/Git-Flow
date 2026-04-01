import { Router } from 'express';

export const healthRouter = Router();

healthRouter.get('/', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'sentinel', timestamp: new Date().toISOString() });
});
