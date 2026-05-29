import cors from 'cors';
import express from 'express';
import { runSchema } from './db/database.js';
import aiRoutes from './routes/ai.js';
import authRoutes from './routes/auth.js';
import avatarRoutes from './routes/avatars.js';
import dashboardRoutes from './routes/dashboard.js';
import delayControlRoutes from './routes/delayControl.js';
import executorRoutes from './routes/executors.js';
import fileRoutes from './routes/files.js';
import helpRoutes from './routes/help.js';
import healthRoutes from './routes/health.js';
import interactionRoutes from './routes/interaction.js';
import liveControlRoomRoutes from './routes/liveControlRoom.js';
import liveRoutes from './routes/liveRooms.js';
import productRoutes from './routes/products.js';
import settingsRoutes from './routes/settings.js';
import studioRoutes from './routes/studio.js';
import { requireAuth } from './utils/auth.js';
import { fail, success } from './utils/response.js';
import { uploadPublicPrefix, uploadRoot } from './utils/uploadConfig.js';

const app = express();
const port = Number(process.env.PORT || 3000);
const mutatingMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

runSchema();

function parseCorsOrigins(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function isLocalDevOrigin(origin) {
  try {
    const url = new URL(origin);
    return ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  } catch {
    return false;
  }
}

function createCorsOriginChecker() {
  const configuredOrigins = parseCorsOrigins(process.env.CORS_ORIGINS);
  const allowLocalhost = process.env.CORS_ALLOW_LOCALHOST !== 'false';

  return (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (configuredOrigins.includes(origin) || (allowLocalhost && isLocalDevOrigin(origin))) {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS origin not allowed: ${origin}`));
  };
}

function shouldSkipMutationAuth(req) {
  if (!req.path.startsWith('/api') || !mutatingMethods.has(req.method)) {
    return true;
  }

  return req.method === 'POST' && req.path === '/api/auth/login';
}

function requireAuthForMutations(req, res, next) {
  if (shouldSkipMutationAuth(req)) {
    return next();
  }

  return requireAuth(req, res, next);
}

app.use(
  cors({
    origin: createCorsOriginChecker(),
    credentials: true,
  }),
);
app.use(express.json({ limit: '2mb' }));
app.use(uploadPublicPrefix, express.static(uploadRoot));

app.get('/', (req, res) => {
  return success(res, {
    service: 'digital-human-live-console-api',
    health: '/api/health',
  });
});

app.use(requireAuthForMutations);

app.use('/api/health', healthRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/files', fileRoutes);
app.use('/api', productRoutes);
app.use('/api', avatarRoutes);
app.use('/api', liveRoutes);
app.use('/api', settingsRoutes);
app.use('/api', helpRoutes);
app.use('/api', executorRoutes);
app.use('/api', studioRoutes);
app.use('/api', interactionRoutes);
app.use('/api', delayControlRoutes);
app.use('/api', aiRoutes);
app.use('/api', liveControlRoomRoutes);

app.use((req, res) => {
  return fail(res, '接口不存在', 40400, {
    method: req.method,
    path: req.path,
  });
});

app.use((error, req, res, next) => {
  console.error(error);
  return fail(res, '服务器内部错误', 50000, {
    reason: error.message,
  });
});

app.listen(port, () => {
  console.log(`Local API server is running at http://localhost:${port}`);
});

export default app;
