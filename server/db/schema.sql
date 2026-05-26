CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  brand TEXT,
  price REAL DEFAULT 0,
  stock INTEGER DEFAULT 0,
  status TEXT DEFAULT '草稿',
  image TEXT,
  description TEXT,
  group_id TEXT,
  group_name TEXT,
  selling_points TEXT,
  faq TEXT,
  scripts TEXT,
  forbidden_expressions TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS product_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT,
  product_count INTEGER DEFAULT 0,
  main_product TEXT,
  live_room TEXT,
  product_ids_json TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS product_group_items (
  id TEXT PRIMARY KEY,
  product_group_id TEXT,
  product_id TEXT,
  sort_order INTEGER DEFAULT 0,
  role_in_group TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS avatars (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  avatar_image TEXT,
  persona TEXT,
  suitable_categories TEXT,
  voice_name TEXT,
  status TEXT,
  bound_live_rooms INTEGER DEFAULT 0,
  language_style TEXT,
  behavior_rules TEXT,
  voice_settings TEXT,
  image_settings TEXT,
  training_assets TEXT,
  authorization_status TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS avatar_actions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT,
  trigger_scene TEXT,
  suitable_tone TEXT,
  status TEXT,
  description TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS live_rooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  theme TEXT,
  platform TEXT,
  platform_account TEXT,
  avatar_id TEXT,
  avatar_name TEXT,
  product_group_id TEXT,
  product_group_name TEXT,
  scene_name TEXT,
  layout_type TEXT,
  danmu_enabled INTEGER DEFAULT 0,
  ai_reply_enabled INTEGER DEFAULT 0,
  manual_takeover_enabled INTEGER DEFAULT 0,
  delay_control_enabled INTEGER DEFAULT 0,
  delay_seconds INTEGER DEFAULT 0,
  status TEXT,
  notes TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS live_tasks (
  id TEXT PRIMARY KEY,
  task_name TEXT NOT NULL,
  live_room_id TEXT,
  live_room_name TEXT,
  platform TEXT,
  executor_id TEXT,
  executor_name TEXT,
  avatar_id TEXT,
  avatar_name TEXT,
  product_group_id TEXT,
  product_group_name TEXT,
  scheduled_start_time TEXT,
  status TEXT,
  notes TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  nickname TEXT,
  email TEXT,
  phone TEXT,
  role TEXT,
  status TEXT,
  last_login_at TEXT,
  recent_login INTEGER DEFAULT 0,
  notes TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  user_count INTEGER DEFAULT 0,
  permission_scope TEXT,
  data_scope TEXT,
  operation_permissions TEXT,
  menu_permissions TEXT,
  status TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS basic_settings (
  id TEXT PRIMARY KEY,
  settings_json TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS operation_logs (
  id TEXT PRIMARY KEY,
  time TEXT,
  operator TEXT,
  module TEXT,
  action_type TEXT,
  target TEXT,
  result TEXT,
  ip TEXT,
  device TEXT,
  description TEXT,
  before_summary TEXT,
  after_summary TEXT,
  error_message TEXT,
  created_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_avatars_status ON avatars(status);
CREATE INDEX IF NOT EXISTS idx_live_rooms_status ON live_rooms(status);
CREATE INDEX IF NOT EXISTS idx_live_tasks_status ON live_tasks(status);
CREATE INDEX IF NOT EXISTS idx_live_tasks_live_room ON live_tasks(live_room_id);
CREATE INDEX IF NOT EXISTS idx_operation_logs_time ON operation_logs(time);

-- 后续阶段预留：comments / questions / speech_queue / subtitles / ai_model_providers /
-- file_assets / executor_commands / ticket_replies / ticket_attachments 等表。
