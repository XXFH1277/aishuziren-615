import cors from 'cors';
import express from 'express';
import { runSchema } from './db/database.js';
import aiRoutes from './routes/ai.js';
import authRoutes from './routes/auth.js';
import avatarRoutes from './routes/avatars.js';
import complianceRoutes from './routes/compliance.js';
import dashboardRoutes from './routes/dashboard.js';
import delayControlRoutes from './routes/delayControl.js';
import executorRoutes from './routes/executors.js';
import fileRoutes from './routes/files.js';
import helpRoutes from './routes/help.js';
import healthRoutes from './routes/health.js';
import interactionRoutes from './routes/interaction.js';
import liveControlRoomRoutes from './routes/liveControlRoom.js';
import liveRoutes from './routes/liveRooms.js';
import liveSessionRoutes from './routes/liveSessions.js';
import obsLocalRoutes from './routes/obsLocal.js';
import obsOutputRoutes from './routes/obsOutput.js';
import productRoutes from './routes/products.js';
import settingsRoutes from './routes/settings.js';
import studioRoutes from './routes/studio.js';
import talkingVideoRoutes from './routes/talkingVideos.js';
import { requireAuth } from './utils/auth.js';
import { PASSWORD_CHANGE_REQUIRED, SERVER_ERROR } from './utils/errorCodes.js';
import { fail, success } from './utils/response.js';
import { uploadPublicPrefix, uploadRoot } from './utils/uploadConfig.js';

const app = express();
const port = Number(process.env.PORT || 3000);

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

function isAuthWhitelist(req) {
  return (
    (req.method === 'GET' && req.path === '/api/health') ||
    (req.method === 'POST' && req.path === '/api/auth/login') ||
    (req.method === 'GET' && req.path === '/api/obs-output/runtime') ||
    (req.method === 'POST' && req.path === '/api/obs-output/runtime/clear') ||
    (req.method === 'POST' && req.path === '/api/obs-output/sessions') ||
    (req.method === 'POST' && /^\/api\/obs-output\/sessions\/[^/]+\/connect$/.test(req.path))
  );
}

function isDeviceProtocolPath(req) {
  return (
    (req.method === 'POST' && req.path === '/api/executors/register') ||
    (req.method === 'POST' && /^\/api\/executors\/[^/]+\/heartbeat$/.test(req.path)) ||
    (req.method === 'GET' && /^\/api\/executors\/[^/]+\/commands\/pending$/.test(req.path)) ||
    (req.method === 'POST' && /^\/api\/executors\/commands\/[^/]+\/ack$/.test(req.path))
  );
}

function isPasswordChangeAllowedPath(req) {
  return (
    (req.method === 'POST' && req.path === '/api/auth/change-password') ||
    (req.method === 'GET' && req.path === '/api/auth/me') ||
    (req.method === 'POST' && req.path === '/api/auth/logout')
  );
}

function requireAuthForApi(req, res, next) {
  if (!req.path.startsWith('/api') || isAuthWhitelist(req) || isDeviceProtocolPath(req)) {
    return next();
  }

  return requireAuth(req, res, () => {
    if (req.authUser?.must_change_password && !isPasswordChangeAllowedPath(req)) {
      return fail(res, '请先修改初始密码', PASSWORD_CHANGE_REQUIRED, {
        mustChangePassword: true,
      });
    }

    return next();
  });
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

app.use(requireAuthForApi);

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
app.use('/api', talkingVideoRoutes);
app.use('/api', obsLocalRoutes);
app.use('/api', obsOutputRoutes);
app.use('/api', interactionRoutes);
app.use('/api', delayControlRoutes);
app.use('/api', aiRoutes);
app.use('/api', complianceRoutes);
app.use('/api', liveControlRoomRoutes);
app.use('/api', liveSessionRoutes);

app.use((req, res) => {
  return fail(res, '接口不存在', 40400, {
    method: req.method,
    path: req.path,
  });
});

app.use((error, req, res, next) => {
  console.error(error);
  return fail(res, '服务器内部错误', SERVER_ERROR);
});

app.listen(port, () => {
  console.log(`Local API server is running at http://localhost:${port}`);
});

export default app;
