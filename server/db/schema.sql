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

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  live_task_id TEXT,
  live_room_id TEXT,
  user_nickname TEXT,
  content TEXT,
  platform TEXT,
  comment_time TEXT,
  recognized_type TEXT,
  risk_level TEXT,
  reply_status TEXT,
  handled_status TEXT,
  product_id TEXT,
  product_name TEXT,
  created_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_comments_live_task_id ON comments(live_task_id);
CREATE INDEX IF NOT EXISTS idx_comments_live_room_id ON comments(live_room_id);
CREATE INDEX IF NOT EXISTS idx_comments_risk_level ON comments(risk_level);
CREATE INDEX IF NOT EXISTS idx_comments_handled_status ON comments(handled_status);

CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  live_task_id TEXT,
  live_room_id TEXT,
  comment_id TEXT,
  question TEXT,
  nickname TEXT,
  type TEXT,
  product_id TEXT,
  product_name TEXT,
  risk_level TEXT,
  ai_reply TEXT,
  edited_reply TEXT,
  status TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_questions_live_task_id ON questions(live_task_id);
CREATE INDEX IF NOT EXISTS idx_questions_live_room_id ON questions(live_room_id);
CREATE INDEX IF NOT EXISTS idx_questions_comment_id ON questions(comment_id);
CREATE INDEX IF NOT EXISTS idx_questions_status ON questions(status);

CREATE TABLE IF NOT EXISTS manual_takeover_state (
  id TEXT PRIMARY KEY,
  live_task_id TEXT,
  live_room_id TEXT,
  current_avatar_id TEXT,
  current_avatar_name TEXT,
  current_product_group_id TEXT,
  current_product_group_name TEXT,
  speech_status TEXT,
  executor_status TEXT,
  current_speech TEXT,
  next_speech TEXT,
  upcoming_speech_json TEXT,
  recommended_replies_json TEXT,
  risk_warnings_json TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS delay_control_state (
  id TEXT PRIMARY KEY,
  live_task_id TEXT,
  live_room_id TEXT,
  current_avatar_id TEXT,
  current_avatar_name TEXT,
  current_product_group_id TEXT,
  current_product_group_name TEXT,
  delay_mode TEXT,
  executor_status TEXT,
  current_speech_json TEXT,
  next_speech_json TEXT,
  upcoming_speech_json TEXT,
  risk_summary_json TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS speech_queue (
  id TEXT PRIMARY KEY,
  live_task_id TEXT,
  live_room_id TEXT,
  question_id TEXT,
  comment_id TEXT,
  product_id TEXT,
  product_name TEXT,
  text TEXT,
  source TEXT,
  action TEXT,
  tone TEXT,
  risk_level TEXT,
  review_status TEXT,
  scheduled_time TEXT,
  approved_by TEXT,
  approved_at TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_speech_queue_live_task_id ON speech_queue(live_task_id);
CREATE INDEX IF NOT EXISTS idx_speech_queue_live_room_id ON speech_queue(live_room_id);
CREATE INDEX IF NOT EXISTS idx_speech_queue_review_status ON speech_queue(review_status);
CREATE INDEX IF NOT EXISTS idx_speech_queue_risk_level ON speech_queue(risk_level);
CREATE INDEX IF NOT EXISTS idx_speech_queue_question_id ON speech_queue(question_id);

CREATE TABLE IF NOT EXISTS subtitle_settings (
  id TEXT PRIMARY KEY,
  live_task_id TEXT,
  current_subtitle TEXT,
  next_subtitle TEXT,
  upcoming_subtitles_json TEXT,
  subtitle_style_json TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS delay_settings (
  id TEXT PRIMARY KEY,
  delay_mode TEXT,
  delay_seconds INTEGER DEFAULT 0,
  review_rules_json TEXT,
  queue_rules_json TEXT,
  risk_rules_json TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS ai_assistant_settings (
  id TEXT PRIMARY KEY,
  settings_json TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS ai_model_providers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  provider TEXT,
  usage_json TEXT,
  status TEXT,
  official_base_url TEXT,
  base_url_options_json TEXT,
  model_options_json TEXT,
  default_model TEXT,
  api_key_configured INTEGER DEFAULT 0,
  credential_ref TEXT,
  api_key_masked TEXT,
  last_test_status TEXT,
  last_test_at TEXT,
  today_calls INTEGER DEFAULT 0,
  today_cost REAL DEFAULT 0,
  enabled INTEGER DEFAULT 0,
  docs_note TEXT,
  is_official_preset INTEGER DEFAULT 0,
  description TEXT,
  max_tokens INTEGER DEFAULT 2048,
  temperature REAL DEFAULT 0.7,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS ai_model_role_settings (
  id TEXT PRIMARY KEY,
  label TEXT,
  value TEXT,
  provider_id TEXT,
  model_name TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS prompt_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  target_page TEXT,
  default_model TEXT,
  status TEXT,
  template_content TEXT,
  variables_json TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS ai_call_logs (
  id TEXT PRIMARY KEY,
  call_time TEXT,
  source_page TEXT,
  type TEXT,
  provider TEXT,
  model_name TEXT,
  input_summary TEXT,
  output_summary TEXT,
  status TEXT,
  duration TEXT,
  tokens INTEGER DEFAULT 0,
  cost REAL DEFAULT 0,
  error_message TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS ai_cost_daily (
  id TEXT PRIMARY KEY,
  stat_date TEXT,
  today_calls INTEGER DEFAULT 0,
  today_cost REAL DEFAULT 0,
  month_cost REAL DEFAULT 0,
  average_cost REAL DEFAULT 0,
  abnormal_calls INTEGER DEFAULT 0,
  provider_breakdown_json TEXT,
  type_breakdown_json TEXT,
  budget_settings_json TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  password_hash TEXT,
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
  permission_keys TEXT,
  operation_permissions TEXT,
  menu_permissions TEXT,
  status TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
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

CREATE TABLE IF NOT EXISTS ticket_attachments (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL,
  file_id TEXT NOT NULL,
  file_name TEXT,
  file_url TEXT,
  file_type TEXT,
  size INTEGER DEFAULT 0,
  mime_type TEXT,
  uploaded_by TEXT,
  created_at TEXT
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

CREATE TABLE IF NOT EXISTS file_assets (
  id TEXT PRIMARY KEY,
  file_name TEXT,
  file_url TEXT,
  file_type TEXT,
  module TEXT,
  business_id TEXT,
  size INTEGER DEFAULT 0,
  mime_type TEXT,
  uploaded_by TEXT,
  created_at TEXT
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
CREATE INDEX IF NOT EXISTS idx_ai_model_providers_status ON ai_model_providers(status);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_category ON prompt_templates(category);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_status ON prompt_templates(status);
CREATE INDEX IF NOT EXISTS idx_ai_call_logs_time ON ai_call_logs(call_time);
CREATE INDEX IF NOT EXISTS idx_ai_call_logs_provider ON ai_call_logs(provider);
CREATE INDEX IF NOT EXISTS idx_operation_logs_time ON operation_logs(time);
CREATE INDEX IF NOT EXISTS idx_help_faq_category ON help_faq(category);
CREATE INDEX IF NOT EXISTS idx_troubleshooting_category ON troubleshooting_guides(category);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_type ON tickets(type);
CREATE INDEX IF NOT EXISTS idx_ticket_attachments_ticket ON ticket_attachments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_tutorials_category ON tutorials(category);
CREATE INDEX IF NOT EXISTS idx_executors_status ON executors(status);
CREATE INDEX IF NOT EXISTS idx_executor_obs_executor_id ON executor_obs_status(executor_id);
CREATE INDEX IF NOT EXISTS idx_executor_obs_status ON executor_obs_status(obs_status);
CREATE INDEX IF NOT EXISTS idx_executor_heartbeats_executor_id ON executor_heartbeats(executor_id);
CREATE INDEX IF NOT EXISTS idx_executor_heartbeats_level ON executor_heartbeats(level);
CREATE INDEX IF NOT EXISTS idx_executor_heartbeats_created_at ON executor_heartbeats(created_at);
CREATE INDEX IF NOT EXISTS idx_executor_commands_executor_id ON executor_commands(executor_id);
CREATE INDEX IF NOT EXISTS idx_executor_commands_status ON executor_commands(status);
CREATE INDEX IF NOT EXISTS idx_file_assets_module_business ON file_assets(module, business_id);
CREATE INDEX IF NOT EXISTS idx_file_assets_uploaded_by ON file_assets(uploaded_by);

-- 后续阶段预留：comments / questions / speech_queue / subtitles / ai_model_providers /
-- file_assets / ticket_replies / ticket_attachments 等表。
