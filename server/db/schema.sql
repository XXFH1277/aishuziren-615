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

CREATE TABLE IF NOT EXISTS studio_backgrounds (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  style TEXT,
  ratio TEXT,
  category TEXT,
  prompt TEXT,
  status TEXT,
  preview_color TEXT,
  suitable_scene TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS studio_layouts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  ratio TEXT,
  avatar_position TEXT,
  product_area_position TEXT,
  danmu_position TEXT,
  has_coupon_area INTEGER DEFAULT 0,
  has_title_bar INTEGER DEFAULT 0,
  suitable_for_obs INTEGER DEFAULT 0,
  status TEXT,
  description TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS studio_output_status (
  id TEXT PRIMARY KEY,
  obs_status TEXT,
  virtual_camera_status TEXT,
  window_capture_status TEXT,
  obs_version TEXT,
  current_scene TEXT,
  current_source TEXT,
  resolution TEXT,
  fps INTEGER DEFAULT 0,
  last_heartbeat_at TEXT,
  scene_mappings_json TEXT,
  checklist_json TEXT,
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

CREATE TABLE IF NOT EXISTS help_faq (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT,
  causes_json TEXT,
  steps_json TEXT,
  related_page TEXT,
  need_support INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS troubleshooting_guides (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT,
  description TEXT,
  steps_json TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS tickets (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT,
  urgency TEXT,
  related_live_room TEXT,
  related_avatar TEXT,
  related_product TEXT,
  related_executor TEXT,
  status TEXT,
  submitter TEXT,
  submitted_at TEXT,
  description TEXT,
  diagnosis TEXT,
  error_log TEXT,
  technical_reply TEXT,
  resolution_record TEXT,
  contact TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS tutorials (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT,
  difficulty TEXT,
  duration TEXT,
  summary_json TEXT,
  target_page TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS system_status (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT,
  checked_at TEXT,
  abnormal_count INTEGER DEFAULT 0,
  detail TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS changelog (
  id TEXT PRIMARY KEY,
  version TEXT,
  title TEXT,
  updated_at TEXT,
  features_json TEXT,
  fixes_json TEXT,
  notes_json TEXT,
  important INTEGER DEFAULT 0,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS executors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  device_id TEXT,
  bound_account TEXT,
  device_name TEXT,
  os TEXT,
  status TEXT,
  current_live_task TEXT,
  obs_status TEXT,
  virtual_camera_status TEXT,
  version TEXT,
  last_heartbeat_at TEXT,
  notes TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS executor_obs_status (
  id TEXT PRIMARY KEY,
  executor_id TEXT,
  executor_name TEXT,
  obs_status TEXT,
  obs_version TEXT,
  current_scene TEXT,
  source_count INTEGER DEFAULT 0,
  resolution TEXT,
  fps INTEGER DEFAULT 0,
  virtual_camera_status TEXT,
  output_status TEXT,
  error_message TEXT,
  scene_sources_json TEXT,
  last_connected_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS executor_heartbeats (
  id TEXT PRIMARY KEY,
  executor_id TEXT,
  executor_name TEXT,
  online_status TEXT,
  obs_status TEXT,
  virtual_camera_status TEXT,
  cpu_usage INTEGER DEFAULT 0,
  memory_usage INTEGER DEFAULT 0,
  network_latency INTEGER DEFAULT 0,
  error_message TEXT,
  level TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS executor_commands (
  id TEXT PRIMARY KEY,
  executor_id TEXT,
  command_type TEXT,
  payload_json TEXT,
  status TEXT,
  result_message TEXT,
  created_by TEXT,
  created_at TEXT,
  executed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_avatars_status ON avatars(status);
CREATE INDEX IF NOT EXISTS idx_live_rooms_status ON live_rooms(status);
CREATE INDEX IF NOT EXISTS idx_live_tasks_status ON live_tasks(status);
CREATE INDEX IF NOT EXISTS idx_live_tasks_live_room ON live_tasks(live_room_id);
CREATE INDEX IF NOT EXISTS idx_studio_backgrounds_category ON studio_backgrounds(category);
CREATE INDEX IF NOT EXISTS idx_studio_backgrounds_status ON studio_backgrounds(status);
CREATE INDEX IF NOT EXISTS idx_studio_layouts_ratio ON studio_layouts(ratio);
CREATE INDEX IF NOT EXISTS idx_studio_layouts_status ON studio_layouts(status);
CREATE INDEX IF NOT EXISTS idx_operation_logs_time ON operation_logs(time);
CREATE INDEX IF NOT EXISTS idx_help_faq_category ON help_faq(category);
CREATE INDEX IF NOT EXISTS idx_troubleshooting_category ON troubleshooting_guides(category);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_type ON tickets(type);
CREATE INDEX IF NOT EXISTS idx_tutorials_category ON tutorials(category);
CREATE INDEX IF NOT EXISTS idx_executors_status ON executors(status);
CREATE INDEX IF NOT EXISTS idx_executor_obs_executor_id ON executor_obs_status(executor_id);
CREATE INDEX IF NOT EXISTS idx_executor_obs_status ON executor_obs_status(obs_status);
CREATE INDEX IF NOT EXISTS idx_executor_heartbeats_executor_id ON executor_heartbeats(executor_id);
CREATE INDEX IF NOT EXISTS idx_executor_heartbeats_level ON executor_heartbeats(level);
CREATE INDEX IF NOT EXISTS idx_executor_heartbeats_created_at ON executor_heartbeats(created_at);
CREATE INDEX IF NOT EXISTS idx_executor_commands_executor_id ON executor_commands(executor_id);
CREATE INDEX IF NOT EXISTS idx_executor_commands_status ON executor_commands(status);

-- 后续阶段预留：comments / questions / speech_queue / subtitles / ai_model_providers /
-- file_assets / ticket_replies / ticket_attachments 等表。
