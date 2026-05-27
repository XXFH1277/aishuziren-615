import express from 'express';
import { db } from '../db/database.js';
import { success } from '../utils/response.js';

const router = express.Router();

function countRows(sql, params = {}) {
  return Number(db.prepare(sql).get(params)?.count || 0);
}

function groupRows(sql) {
  return db
    .prepare(sql)
    .all()
    .map((row) => ({
      name: row.name || '未分类',
      value: Number(row.value || 0),
    }));
}

function mapOperation(row) {
  return {
    id: row.id,
    operator: row.operator,
    action: row.description || row.action_type,
    time: row.time || row.created_at,
    status: row.result,
  };
}

router.get('/overview', (req, res) => {
  const todayLiveTaskCount = countRows('SELECT COUNT(*) AS count FROM live_tasks');
  const onlineExecutorCount = countRows(
    "SELECT COUNT(*) AS count FROM executors WHERE status NOT LIKE '%离线%' AND status NOT LIKE '%异常%'",
  );
  const pendingSpeechReviewCount = countRows(
    "SELECT COUNT(*) AS count FROM speech_queue WHERE review_status NOT LIKE '%通过%' AND review_status NOT LIKE '%删除%'",
  );
  const todayCommentCount = countRows('SELECT COUNT(*) AS count FROM comments');
  const highRiskCommentCount = countRows(
    "SELECT COUNT(*) AS count FROM comments WHERE risk_level LIKE '%高%' OR recognized_type LIKE '%恶意%'",
  );
  const pendingQuestionCount = countRows(
    "SELECT COUNT(*) AS count FROM questions WHERE status NOT LIKE '%忽略%' AND status NOT LIKE '%待播%'",
  );
  const highRiskSpeechCount = countRows("SELECT COUNT(*) AS count FROM speech_queue WHERE risk_level LIKE '%高%'");

  const aiProviders = db
    .prepare(
      `SELECT name, provider, status, default_model, today_calls, today_cost
       FROM ai_model_providers
       ORDER BY id ASC
       LIMIT 5`,
    )
    .all();

  const recentOperations = db
    .prepare(
      `SELECT id, operator, action_type, description, result, time, created_at
       FROM operation_logs
       ORDER BY COALESCE(time, created_at) DESC, id DESC
       LIMIT 5`,
    )
    .all()
    .map(mapOperation);

  return success(res, {
    overview: {
      stats: [
        {
          title: '今日直播任务',
          value: todayLiveTaskCount,
          helper: '来自本地 SQLite live_tasks',
          tone: 'blue',
        },
        {
          title: '在线执行端',
          value: onlineExecutorCount,
          helper: '仅为本地 Mock 状态聚合',
          tone: 'green',
        },
        {
          title: '待审核话术',
          value: pendingSpeechReviewCount,
          helper: '来自待播队列审核状态',
          tone: pendingSpeechReviewCount > 0 ? 'orange' : 'green',
        },
        {
          title: '今日弹幕',
          value: todayCommentCount,
          helper: '当前为 SQLite Mock 弹幕',
          tone: 'purple',
        },
      ],
      aiCallStatus: aiProviders.map((item) => ({
        name: item.name,
        status: item.status,
        detail: `${item.default_model || '未设置模型'} · 今日 ${Number(item.today_calls || 0)} 次 · ¥${Number(
          item.today_cost || 0,
        ).toFixed(2)}`,
      })),
      recentOperations,
      liveTaskStatusStats: groupRows('SELECT status AS name, COUNT(*) AS value FROM live_tasks GROUP BY status'),
      executorStatusStats: groupRows('SELECT status AS name, COUNT(*) AS value FROM executors GROUP BY status'),
      riskSummary: {
        highRiskCommentCount,
        pendingQuestionCount,
        highRiskSpeechCount,
      },
      mock: true,
    },
  });
});

export default router;
