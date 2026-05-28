export const menuItems = [
  {
    key: '/dashboard',
    label: '首页工作台',
    icon: 'dashboard',
  },
  {
    key: '/live',
    label: '直播管理',
    icon: 'live',
    children: [
      { key: '/live/rooms', label: '直播间列表' },
      { key: '/live/tasks', label: '直播任务' },
      { key: '/live/control-room', label: '直播中控台' },
    ],
  },
  {
    key: '/products',
    label: '商品管理',
    icon: 'products',
    children: [
      { key: '/products/list', label: '商品列表' },
      { key: '/products/groups', label: '商品组' },
    ],
  },
  {
    key: '/avatar',
    label: '数字人管理',
    icon: 'avatar',
    children: [
      { key: '/avatar/list', label: '数字人列表' },
      { key: '/avatar/actions', label: '动作库' },
    ],
  },
  {
    key: '/studio',
    label: '直播间搭建',
    icon: 'studio',
    children: [
      { key: '/studio/background', label: 'AI生成背景' },
      { key: '/studio/layout', label: '画面布局' },
      { key: '/studio/output', label: 'OBS输出预留' },
    ],
  },
  {
    key: '/interaction-control',
    label: '互动播控',
    icon: 'interaction',
    children: [
      { key: '/interaction/comments', label: '弹幕捕获' },
      { key: '/interaction/questions', label: '问题队列' },
      { key: '/interaction/takeover', label: '人工接管' },
      { key: '/delay-control/current', label: '当前播报' },
      { key: '/delay-control/queue', label: '待播队列' },
      { key: '/delay-control/subtitles', label: '字幕预览' },
      { key: '/delay-control/settings', label: '播控设置' },
    ],
  },
  {
    key: '/ai-center',
    label: 'AI能力中心',
    icon: 'ai',
    children: [
      { key: '/ai-center/assistant', label: 'AI助理设置' },
      { key: '/ai-center/models', label: '模型服务配置' },
      { key: '/ai-center/prompts', label: 'Prompt模板管理' },
      { key: '/ai-center/logs', label: '调用日志' },
      { key: '/ai-center/costs', label: '成本监控' },
    ],
  },
  {
    key: '/executors',
    label: '执行端管理',
    icon: 'executors',
    children: [
      { key: '/executors/list', label: '执行端列表' },
      { key: '/executors/obs', label: 'OBS连接状态' },
      { key: '/executors/heartbeat', label: '心跳日志' },
    ],
  },
  {
    key: '/help',
    label: '帮助中心',
    icon: 'help',
    children: [
      { key: '/help/faq', label: '常见问题' },
      { key: '/help/troubleshooting', label: '快速排查' },
      { key: '/help/tickets', label: '技术工单' },
      { key: '/help/tutorials', label: '操作教程' },
      { key: '/help/status', label: '系统状态' },
      { key: '/help/changelog', label: '更新日志' },
    ],
  },
  {
    key: '/settings',
    label: '系统设置',
    icon: 'settings',
    children: [
      { key: '/settings/users', label: '用户管理' },
      { key: '/settings/roles', label: '角色权限' },
      { key: '/settings/basic', label: '基础设置' },
      { key: '/settings/notifications', label: '通知设置' },
      { key: '/settings/logs', label: '操作日志' },
    ],
  },
];

export function flattenMenu(items = menuItems) {
  return items.flatMap((item) => [item, ...(item.children ? flattenMenu(item.children) : [])]);
}

export function canAccessMenuKey(key, menuPermissions = []) {
  if (!menuPermissions.length) {
    return false;
  }

  return menuPermissions.some((permission) => key === permission || key.startsWith(`${permission}/`));
}

export function filterMenuByPermissions(items = menuItems, menuPermissions = []) {
  return items
    .map((item) => {
      const children = item.children ? filterMenuByPermissions(item.children, menuPermissions) : undefined;
      const allowed = canAccessMenuKey(item.key, menuPermissions) || Boolean(children?.length);

      if (!allowed) {
        return null;
      }

      return {
        ...item,
        children,
      };
    })
    .filter(Boolean);
}

export function getFirstAccessiblePath(menuPermissions = []) {
  const filtered = filterMenuByPermissions(menuItems, menuPermissions);
  const firstLeaf = flattenMenu(filtered).find((item) => !item.children);
  return firstLeaf?.key || '/dashboard';
}

export function canAccessPath(pathname, menuPermissions = []) {
  if (pathname === '/') {
    return true;
  }

  return canAccessMenuKey(pathname, menuPermissions);
}

export function findMenuItem(pathname) {
  const pages = flattenMenu().filter((item) => !item.children);
  return pages.find((item) => pathname === item.key) || pages.find((item) => pathname.startsWith(item.key));
}

export function findOpenKeys(pathname, items = menuItems, parents = []) {
  for (const item of items) {
    const nextParents = item.children ? [...parents, item.key] : parents;
    if (item.key === pathname || pathname.startsWith(`${item.key}/`)) {
      return item.children ? [...parents, item.key] : parents;
    }
    if (item.children) {
      const found = findOpenKeys(pathname, item.children, nextParents);
      if (found.length) {
        return found;
      }
    }
  }
  return [];
}
