import { Navigate, createBrowserRouter } from 'react-router-dom';
import AdminLayout from '../layouts/AdminLayout';
import AiAssistant from '../pages/ai-center/AiAssistant';
import AiCallLogs from '../pages/ai-center/AiCallLogs';
import AiCostMonitor from '../pages/ai-center/AiCostMonitor';
import ModelServices from '../pages/ai-center/ModelServices';
import PromptTemplates from '../pages/ai-center/PromptTemplates';
import ActionLibrary from '../pages/avatar/ActionLibrary';
import AvatarList from '../pages/avatar/AvatarList';
import CreateAvatar from '../pages/avatar/CreateAvatar';
import EditAvatar from '../pages/avatar/EditAvatar';
import Dashboard from '../pages/dashboard/Dashboard';
import CurrentSpeech from '../pages/delay-control/CurrentSpeech';
import DelaySettings from '../pages/delay-control/DelaySettings';
import SpeechQueue from '../pages/delay-control/SpeechQueue';
import SubtitlePreview from '../pages/delay-control/SubtitlePreview';
import ExecutorList from '../pages/executors/ExecutorList';
import HeartbeatLogs from '../pages/executors/HeartbeatLogs';
import ObsStatus from '../pages/executors/ObsStatus';
import Changelog from '../pages/help/Changelog';
import Faq from '../pages/help/Faq';
import SystemStatus from '../pages/help/SystemStatus';
import Tickets from '../pages/help/Tickets';
import Troubleshooting from '../pages/help/Troubleshooting';
import Tutorials from '../pages/help/Tutorials';
import CommentCapture from '../pages/interaction/CommentCapture';
import ManualTakeover from '../pages/interaction/ManualTakeover';
import QuestionQueue from '../pages/interaction/QuestionQueue';
import CreateLiveRoom from '../pages/live/CreateLiveRoom';
import EditLiveRoom from '../pages/live/EditLiveRoom';
import LiveControlRoom from '../pages/live/LiveControlRoom';
import LiveRoomList from '../pages/live/LiveRoomList';
import LiveTasks from '../pages/live/LiveTasks';
import CreateProduct from '../pages/products/CreateProduct';
import EditProduct from '../pages/products/EditProduct';
import ProductAICopy from '../pages/products/ProductAICopy';
import ProductGroups from '../pages/products/ProductGroups';
import ProductList from '../pages/products/ProductList';
import BasicSettings from '../pages/settings/BasicSettings';
import UserManagement from '../pages/settings/UserManagement';
import StudioBackground from '../pages/studio/StudioBackground';
import StudioLayout from '../pages/studio/StudioLayout';
import StudioOutput from '../pages/studio/StudioOutput';

const router = createBrowserRouter([
  {
    path: '/',
    element: <AdminLayout />,
    handle: { label: '后台' },
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <Dashboard />, handle: { label: '首页工作台' } },
      { path: 'live/rooms', element: <LiveRoomList />, handle: { label: '直播间列表' } },
      { path: 'live/rooms/create', element: <CreateLiveRoom />, handle: { label: '创建直播间' } },
      { path: 'live/rooms/:id/edit', element: <EditLiveRoom />, handle: { label: '编辑直播间' } },
      { path: 'live/tasks', element: <LiveTasks />, handle: { label: '直播任务' } },
      { path: 'live/control-room', element: <LiveControlRoom />, handle: { label: '直播中控台' } },
      { path: 'products/list', element: <ProductList />, handle: { label: '商品列表' } },
      { path: 'products/create', element: <CreateProduct />, handle: { label: '创建商品' } },
      { path: 'products/:id/edit', element: <EditProduct />, handle: { label: '编辑商品' } },
      { path: 'products/groups', element: <ProductGroups />, handle: { label: '商品组' } },
      { path: 'products/ai-copy', element: <ProductAICopy />, handle: { label: 'AI商品文案' } },
      { path: 'avatar/list', element: <AvatarList />, handle: { label: '数字人列表' } },
      { path: 'avatar/create', element: <CreateAvatar />, handle: { label: '创建数字人' } },
      { path: 'avatar/:id/edit', element: <EditAvatar />, handle: { label: '编辑数字人' } },
      { path: 'avatar/actions', element: <ActionLibrary />, handle: { label: '动作库' } },
      { path: 'studio/background', element: <StudioBackground />, handle: { label: 'AI生成背景' } },
      { path: 'studio/layout', element: <StudioLayout />, handle: { label: '画面布局' } },
      { path: 'studio/output', element: <StudioOutput />, handle: { label: 'OBS输出预留' } },
      { path: 'interaction/comments', element: <CommentCapture />, handle: { label: '弹幕捕获' } },
      { path: 'interaction/questions', element: <QuestionQueue />, handle: { label: '问题队列' } },
      { path: 'interaction/takeover', element: <ManualTakeover />, handle: { label: '人工接管' } },
      { path: 'delay-control/current', element: <CurrentSpeech />, handle: { label: '当前播报' } },
      { path: 'delay-control/queue', element: <SpeechQueue />, handle: { label: '待播队列' } },
      { path: 'delay-control/subtitles', element: <SubtitlePreview />, handle: { label: '字幕预览' } },
      { path: 'delay-control/settings', element: <DelaySettings />, handle: { label: '播控设置' } },
      { path: 'ai-center/assistant', element: <AiAssistant />, handle: { label: 'AI助理设置' } },
      { path: 'ai-center/models', element: <ModelServices />, handle: { label: '模型服务配置' } },
      { path: 'ai-center/prompts', element: <PromptTemplates />, handle: { label: 'Prompt模板管理' } },
      { path: 'ai-center/logs', element: <AiCallLogs />, handle: { label: '调用日志' } },
      { path: 'ai-center/costs', element: <AiCostMonitor />, handle: { label: '成本监控' } },
      { path: 'executors/list', element: <ExecutorList />, handle: { label: '执行端列表' } },
      { path: 'executors/obs', element: <ObsStatus />, handle: { label: 'OBS连接状态' } },
      { path: 'executors/heartbeat', element: <HeartbeatLogs />, handle: { label: '心跳日志' } },
      { path: 'executors/obs-status', element: <Navigate to="/executors/obs" replace /> },
      { path: 'executors/heartbeats', element: <Navigate to="/executors/heartbeat" replace /> },
      { path: 'help/faq', element: <Faq />, handle: { label: '常见问题' } },
      { path: 'help/troubleshooting', element: <Troubleshooting />, handle: { label: '快速排查' } },
      { path: 'help/tickets', element: <Tickets />, handle: { label: '技术工单' } },
      { path: 'help/tutorials', element: <Tutorials />, handle: { label: '操作教程' } },
      { path: 'help/status', element: <SystemStatus />, handle: { label: '系统状态' } },
      { path: 'help/changelog', element: <Changelog />, handle: { label: '更新日志' } },
      { path: 'settings/users', element: <UserManagement />, handle: { label: '用户管理' } },
      { path: 'settings/basic', element: <BasicSettings />, handle: { label: '基础设置' } },
      { path: '*', element: <Navigate to="/dashboard" replace /> },
    ],
  },
]);

export default router;
