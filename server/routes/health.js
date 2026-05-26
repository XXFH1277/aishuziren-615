import express from 'express';
import { success } from '../utils/response.js';

const router = express.Router();

router.get('/', (req, res) => {
  return success(res, {
    status: 'ok',
    service: 'digital-human-live-console-api',
    time: new Date().toISOString(),
  });
});

export default router;
