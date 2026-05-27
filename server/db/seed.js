import { avatarActions } from '../../src/mock/avatarActions.js';
import { avatars } from '../../src/mock/avatars.js';
import { changelog } from '../../src/mock/changelog.js';
import { helpFaqList } from '../../src/mock/helpFaq.js';
import { liveRooms } from '../../src/mock/liveRooms.js';
import { liveTasks } from '../../src/mock/liveTasks.js';
import { productGroups } from '../../src/mock/productGroups.js';
import { products } from '../../src/mock/products.js';
import { basicSettings, operationLogs, roles, users } from '../../src/mock/settings.js';
import { systemStatusList } from '../../src/mock/systemStatus.js';
import { tickets } from '../../src/mock/tickets.js';
import { troubleshootingList } from '../../src/mock/troubleshooting.js';
import { tutorials } from '../../src/mock/tutorials.js';
import { db, now, runSchema, toJson } from './database.js';

runSchema();

const timestamp = now();
const executorIdByName = new Map([
  ['杭州执行端 01', 'EX001'],
  ['舟山直播电脑 02', 'EX002'],
  ['云端执行端预留', 'EX003'],
  ['未绑定', ''],
]);

const liveRoomById = new Map(liveRooms.map((item) => [item.id, item]));
const productGroupIdByName = new Map(productGroups.map((item) => [item.name, item.id]));

function clearTables() {
  [
    'product_group_items',
    'products',
    'product_groups',
    'avatars',
    'avatar_actions',
    'live_tasks',
    'live_rooms',
    'users',
    'roles',
    'basic_settings',
    'operation_logs',
    'help_faq',
    'troubleshooting_guides',
    'tickets',
    'tutorials',
    'system_status',
    'changelog',
  ].forEach((tableName) => {
    db.prepare(`DELETE FROM ${tableName}`).run();
  });
}

function seedProducts() {
  const insertProduct = db.prepare(
    `INSERT INTO products (
      id, name, category, brand, price, stock, status, image, description,
      group_id, group_name, selling_points, faq, scripts, forbidden_expressions,
      created_at, updated_at
    ) VALUES (
      @id, @name, @category, @brand, @price, @stock, @status, @image, @description,
      @groupId, @groupName, @sellingPoints, @faq, @scripts, @forbiddenExpressions,
      @createdAt, @updatedAt
    )`,
  );

  const insertGroup = db.prepare(
    `INSERT INTO product_groups (
      id, name, type, product_count, main_product, live_room, product_ids_json, created_at, updated_at
    ) VALUES (
      @id, @name, @type, @productCount, @mainProduct, @liveRoom, @productIds, @createdAt, @updatedAt
    )`,
  );

  const insertGroupItem = db.prepare(
    `INSERT INTO product_group_items (
      id, product_group_id, product_id, sort_order, role_in_group, created_at
    ) VALUES (
      @id, @productGroupId, @productId, @sortOrder, @roleInGroup, @createdAt
    )`,
  );

  productGroups.forEach((group) => {
    const groupProducts = products.filter((product) => product.groupName === group.name);

    insertGroup.run({
      id: group.id,
      name: group.name,
      type: group.type,
      productCount: group.productCount ?? groupProducts.length,
      mainProduct: group.mainProduct,
      liveRoom: group.liveRoom,
      productIds: toJson(groupProducts.map((product) => product.id)),
      createdAt: group.createdAt || group.updatedAt || timestamp,
      updatedAt: group.updatedAt || timestamp,
    });

    groupProducts.forEach((product, index) => {
      insertGroupItem.run({
        id: `${group.id}-${product.id}`,
        productGroupId: group.id,
        productId: product.id,
        sortOrder: index + 1,
        roleInGroup: index === 0 ? 'main' : 'profit',
        createdAt: timestamp,
      });
    });
  });

  products.forEach((product) => {
    insertProduct.run({
      id: product.id,
      name: product.name,
      category: product.category,
      brand: product.brand,
      price: Number(product.price || 0),
      stock: Number(product.stock || 0),
      status: product.status,
      image: product.image,
      description: product.description,
      groupId: productGroupIdByName.get(product.groupName) || '',
      groupName: product.groupName,
      sellingPoints: toJson(product.sellingPoints || []),
      faq: toJson(product.faq || []),
      scripts: toJson(product.scripts || []),
      forbiddenExpressions: toJson(product.forbiddenExpressions || []),
      createdAt: product.createdAt || product.updatedAt || timestamp,
      updatedAt: product.updatedAt || timestamp,
    });
  });
}

function seedAvatars() {
  const insertAvatar = db.prepare(
    `INSERT INTO avatars (
      id, name, avatar_image, persona, suitable_categories, voice_name, status,
      bound_live_rooms, language_style, behavior_rules, voice_settings, image_settings,
      training_assets, authorization_status, created_at, updated_at
    ) VALUES (
      @id, @name, @avatarImage, @persona, @suitableCategories, @voiceName, @status,
      @boundLiveRooms, @languageStyle, @behaviorRules, @voiceSettings, @imageSettings,
      @trainingAssets, @authorizationStatus, @createdAt, @updatedAt
    )`,
  );

  const insertAction = db.prepare(
    `INSERT INTO avatar_actions (
      id, name, type, trigger_scene, suitable_tone, status, description, created_at, updated_at
    ) VALUES (
      @id, @name, @type, @triggerScene, @suitableTone, @status, @description, @createdAt, @updatedAt
    )`,
  );

  avatars.forEach((avatar) => {
    insertAvatar.run({
      id: avatar.id,
      name: avatar.name,
      avatarImage: avatar.avatarImage,
      persona: avatar.persona,
      suitableCategories: toJson(avatar.suitableCategories || []),
      voiceName: avatar.voiceName,
      status: avatar.status,
      boundLiveRooms: Number(avatar.boundLiveRooms || 0),
      languageStyle: avatar.languageStyle,
      behaviorRules: toJson(avatar.behaviorRules || []),
      voiceSettings: toJson(avatar.voiceSettings || {}),
      imageSettings: toJson(avatar.imageSettings || {}),
      trainingAssets: toJson(avatar.trainingAssets || {}),
      authorizationStatus: toJson(avatar.authorizationStatus || {}),
      createdAt: avatar.createdAt || avatar.updatedAt || timestamp,
      updatedAt: avatar.updatedAt || timestamp,
    });
  });

  avatarActions.forEach((action) => {
    insertAction.run({
      id: action.id,
      name: action.name,
      type: action.type,
      triggerScene: action.triggerScene,
      suitableTone: action.suitableTone,
      status: action.status,
      description: action.description,
      createdAt: action.createdAt || timestamp,
      updatedAt: action.updatedAt || timestamp,
    });
  });
}

function seedLive() {
  const insertLiveRoom = db.prepare(
    `INSERT INTO live_rooms (
      id, name, theme, platform, platform_account, avatar_id, avatar_name,
      product_group_id, product_group_name, scene_name, layout_type, danmu_enabled,
      ai_reply_enabled, manual_takeover_enabled, delay_control_enabled, delay_seconds,
      status, notes, created_at, updated_at
    ) VALUES (
      @id, @name, @theme, @platform, @platformAccount, @avatarId, @avatarName,
      @productGroupId, @productGroupName, @sceneName, @layoutType, @danmuEnabled,
      @aiReplyEnabled, @manualTakeoverEnabled, @delayControlEnabled, @delaySeconds,
      @status, @notes, @createdAt, @updatedAt
    )`,
  );

  const insertLiveTask = db.prepare(
    `INSERT INTO live_tasks (
      id, task_name, live_room_id, live_room_name, platform, executor_id, executor_name,
      avatar_id, avatar_name, product_group_id, product_group_name, scheduled_start_time,
      status, notes, created_at, updated_at
    ) VALUES (
      @id, @taskName, @liveRoomId, @liveRoomName, @platform, @executorId, @executorName,
      @avatarId, @avatarName, @productGroupId, @productGroupName, @scheduledStartTime,
      @status, @notes, @createdAt, @updatedAt
    )`,
  );

  liveRooms.forEach((room) => {
    insertLiveRoom.run({
      id: room.id,
      name: room.name,
      theme: room.theme,
      platform: room.platform,
      platformAccount: room.platformAccount,
      avatarId: room.avatarId,
      avatarName: room.avatarName,
      productGroupId: room.productGroupId,
      productGroupName: room.productGroupName,
      sceneName: room.sceneName,
      layoutType: room.layoutType,
      danmuEnabled: room.danmuEnabled ? 1 : 0,
      aiReplyEnabled: room.aiReplyEnabled ? 1 : 0,
      manualTakeoverEnabled: room.manualTakeoverEnabled ? 1 : 0,
      delayControlEnabled: room.delayControlEnabled ? 1 : 0,
      delaySeconds: Number(room.delaySeconds || 0),
      status: room.status,
      notes: room.notes,
      createdAt: room.createdAt || room.updatedAt || timestamp,
      updatedAt: room.updatedAt || timestamp,
    });
  });

  liveTasks.forEach((task) => {
    const room = liveRoomById.get(task.liveRoomId);

    insertLiveTask.run({
      id: task.id,
      taskName: task.taskName,
      liveRoomId: task.liveRoomId,
      liveRoomName: task.liveRoomName,
      platform: task.platform,
      executorId: executorIdByName.get(task.executorName) || '',
      executorName: task.executorName,
      avatarId: task.avatarId || room?.avatarId || '',
      avatarName: task.avatarName,
      productGroupId: task.productGroupId || room?.productGroupId || '',
      productGroupName: task.productGroupName,
      scheduledStartTime: task.scheduledStartTime,
      status: task.status,
      notes: task.notes,
      createdAt: task.createdAt || timestamp,
      updatedAt: task.updatedAt || task.createdAt || timestamp,
    });
  });
}

function seedSettings() {
  const insertUser = db.prepare(
    `INSERT INTO users (
      id, username, nickname, email, phone, role, status, last_login_at,
      recent_login, notes, created_at, updated_at
    ) VALUES (
      @id, @username, @nickname, @email, @phone, @role, @status, @lastLoginAt,
      @recentLogin, @notes, @createdAt, @updatedAt
    )`,
  );

  const insertRole = db.prepare(
    `INSERT INTO roles (
      id, name, description, user_count, permission_scope, data_scope,
      operation_permissions, menu_permissions, status, created_at, updated_at
    ) VALUES (
      @id, @name, @description, @userCount, @permissionScope, @dataScope,
      @operationPermissions, @menuPermissions, @status, @createdAt, @updatedAt
    )`,
  );

  const insertLog = db.prepare(
    `INSERT INTO operation_logs (
      id, time, operator, module, action_type, target, result, ip, device,
      description, before_summary, after_summary, error_message, created_at
    ) VALUES (
      @id, @time, @operator, @module, @actionType, @target, @result, @ip, @device,
      @description, @beforeSummary, @afterSummary, @errorMessage, @createdAt
    )`,
  );

  users.forEach((user) => {
    insertUser.run({
      id: user.id,
      username: user.username,
      nickname: user.nickname,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
      lastLoginAt: user.lastLoginAt,
      recentLogin: user.recentLogin ? 1 : 0,
      notes: user.notes,
      createdAt: user.createdAt || timestamp,
      updatedAt: user.updatedAt || timestamp,
    });
  });

  roles.forEach((role) => {
    insertRole.run({
      id: role.id,
      name: role.name,
      description: role.description,
      userCount: Number(role.userCount || 0),
      permissionScope: role.permissionScope,
      dataScope: role.dataScope,
      operationPermissions: toJson(role.operationPermissions || []),
      menuPermissions: toJson(role.menuPermissions || []),
      status: role.status,
      createdAt: role.createdAt || role.updatedAt || timestamp,
      updatedAt: role.updatedAt || timestamp,
    });
  });

  db.prepare(
    `INSERT INTO basic_settings (id, settings_json, created_at, updated_at)
     VALUES ('basic', @settingsJson, @createdAt, @updatedAt)`,
  ).run({
    settingsJson: toJson(basicSettings),
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  operationLogs.forEach((log) => {
    insertLog.run({
      id: log.id,
      time: log.time,
      operator: log.operator,
      module: log.module,
      actionType: log.actionType,
      target: log.target,
      result: log.result,
      ip: log.ip,
      device: log.device,
      description: log.description,
      beforeSummary: log.beforeSummary,
      afterSummary: log.afterSummary,
      errorMessage: log.errorMessage,
      createdAt: log.createdAt || log.time || timestamp,
    });
  });
}

function seedHelp() {
  const insertFaq = db.prepare(
    `INSERT INTO help_faq (
      id, title, category, causes_json, steps_json, related_page,
      need_support, created_at, updated_at
    ) VALUES (
      @id, @title, @category, @causes, @steps, @relatedPage,
      @needSupport, @createdAt, @updatedAt
    )`,
  );

  const insertTroubleshooting = db.prepare(
    `INSERT INTO troubleshooting_guides (
      id, title, category, description, steps_json, created_at, updated_at
    ) VALUES (
      @id, @title, @category, @description, @steps, @createdAt, @updatedAt
    )`,
  );

  const insertTicket = db.prepare(
    `INSERT INTO tickets (
      id, title, type, urgency, related_live_room, related_avatar, related_product,
      related_executor, status, submitter, submitted_at, description, diagnosis,
      error_log, technical_reply, resolution_record, contact, created_at, updated_at
    ) VALUES (
      @id, @title, @type, @urgency, @relatedLiveRoom, @relatedAvatar, @relatedProduct,
      @relatedExecutor, @status, @submitter, @submittedAt, @description, @diagnosis,
      @errorLog, @technicalReply, @resolutionRecord, @contact, @createdAt, @updatedAt
    )`,
  );

  const insertTutorial = db.prepare(
    `INSERT INTO tutorials (
      id, title, category, difficulty, duration, summary_json, target_page, created_at, updated_at
    ) VALUES (
      @id, @title, @category, @difficulty, @duration, @summary, @targetPage, @createdAt, @updatedAt
    )`,
  );

  const insertStatus = db.prepare(
    `INSERT INTO system_status (
      id, name, status, checked_at, abnormal_count, detail, created_at, updated_at
    ) VALUES (
      @id, @name, @status, @checkedAt, @abnormalCount, @detail, @createdAt, @updatedAt
    )`,
  );

  const insertChangelog = db.prepare(
    `INSERT INTO changelog (
      id, version, title, updated_at, features_json, fixes_json, notes_json, important, created_at
    ) VALUES (
      @id, @version, @title, @updatedAt, @features, @fixes, @notes, @important, @createdAt
    )`,
  );

  helpFaqList.forEach((item) => {
    insertFaq.run({
      id: item.id,
      title: item.title,
      category: item.category,
      causes: toJson(item.causes || []),
      steps: toJson(item.steps || []),
      relatedPage: item.relatedPage,
      needSupport: item.needSupport ? 1 : 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  });

  troubleshootingList.forEach((item) => {
    insertTroubleshooting.run({
      id: item.id,
      title: item.title,
      category: item.category,
      description: item.description,
      steps: toJson(item.steps || []),
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  });

  tickets.forEach((ticket) => {
    insertTicket.run({
      id: ticket.id,
      title: ticket.title,
      type: ticket.type,
      urgency: ticket.urgency,
      relatedLiveRoom: ticket.liveRoom,
      relatedAvatar: ticket.avatar,
      relatedProduct: ticket.product || '',
      relatedExecutor: ticket.executor,
      status: ticket.status,
      submitter: ticket.submitter,
      submittedAt: ticket.submittedAt,
      description: ticket.description,
      diagnosis: ticket.diagnosis,
      errorLog: ticket.errorLog,
      technicalReply: ticket.reply,
      resolutionRecord: ticket.resolution,
      contact: '',
      createdAt: ticket.submittedAt || timestamp,
      updatedAt: timestamp,
    });
  });

  tutorials.forEach((item) => {
    insertTutorial.run({
      id: item.id,
      title: item.title,
      category: item.category,
      difficulty: item.difficulty,
      duration: item.duration,
      summary: toJson(item.summary || []),
      targetPage: item.targetPage,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  });

  systemStatusList.forEach((item) => {
    insertStatus.run({
      id: item.id,
      name: item.name,
      status: item.status,
      checkedAt: item.checkedAt,
      abnormalCount: Number(item.abnormalCount || 0),
      detail: item.description,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  });

  changelog.forEach((item) => {
    insertChangelog.run({
      id: item.id,
      version: item.version,
      title: item.title,
      updatedAt: item.updatedAt,
      features: toJson(item.features || []),
      fixes: toJson(item.fixes || []),
      notes: toJson(item.notes || []),
      important: item.important ? 1 : 0,
      createdAt: item.updatedAt || timestamp,
    });
  });
}

const seed = db.transaction(() => {
  clearTables();
  seedProducts();
  seedAvatars();
  seedLive();
  seedSettings();
  seedHelp();
});

seed();

console.log('SQLite seed completed.');
console.log(`Products: ${products.length}, Avatars: ${avatars.length}, Live rooms: ${liveRooms.length}, Live tasks: ${liveTasks.length}`);
console.log(`Help FAQ: ${helpFaqList.length}, Tickets: ${tickets.length}, Tutorials: ${tutorials.length}`);
