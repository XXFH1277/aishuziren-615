import { Navigate, createBrowserRouter } from 'react-router-dom';
import AdminLayout from '../layouts/AdminLayout';
import AiAssistant from '../pages/ai-center/AiAssistant';
import ModelServices from '../pages/ai-center/ModelServices';
import PromptTemplates from '../pages/ai-center/PromptTemplates';
import ActionLibrary from '../pages/avatar/ActionLibrary';
import AvatarList from '../pages/avatar/AvatarList';
import CreateAvatar from '../pages/avatar/CreateAvatar';
import Dashboard from '../pages/dashboard/Dashboard';
import CurrentSpeech from '../pages/delay-control/CurrentSpeech';
import DelaySettings from '../pages/delay-control/DelaySettings';
import SpeechQueue from '../pages/delay-control/SpeechQueue';
import SubtitlePreview from '../pages/delay-control/SubtitlePreview';
import ExecutorList from '../pages/executors/ExecutorList';
import HeartbeatLogs from '../pages/executors/HeartbeatLogs';
import ObsStatus from '../pages/executors/ObsStatus';
import Faq from '../pages/help/Faq';
import Tickets from '../pages/help/Tickets';
import Troubleshooting from '../pages/help/Troubleshooting';
import DanmuCapture from '../pages/interaction/DanmuCapture';
import ManualTakeover from '../pages/interaction/ManualTakeover';
import QuestionQueue from '../pages/interaction/QuestionQueue';
import CreateLiveRoom from '../pages/live/CreateLiveRoom';
import LiveRooms from '../pages/live/LiveRooms';
import LiveTasks from '../pages/live/LiveTasks';
import CreateProduct from '../pages/products/CreateProduct';
import EditProduct from '../pages/products/EditProduct';
import ProductAICopy from '../pages/products/ProductAICopy';
import ProductGroups from '../pages/products/ProductGroups';
import ProductList from '../pages/products/ProductList';
import BasicSettings from '../pages/settings/BasicSettings';
import UserManagement from '../pages/settings/UserManagement';
import AiBackground from '../pages/studio/AiBackground';
import ObsOutput from '../pages/studio/ObsOutput';
import ScreenLayout from '../pages/studio/ScreenLayout';

const router = createBrowserRouter([
  {
    path: '/',
    element: <AdminLayout />,
    handle: { label: '后台' },
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <Dashboard />, handle: { label: '首页工作台' } },
      { path: 'live/rooms', element: <LiveRooms />, handle: { label: '直播间列表' } },
      { path: 'live/create', element: <CreateLiveRoom />, handle: { label: '创建直播间' } },
      { path: 'live/tasks', element: <LiveTasks />, handle: { label: '直播任务' } },
      { path: 'products/list', element: <ProductList />, handle: { label: '商品列表' } },
      { path: 'products/create', element: <CreateProduct />, handle: { label: '创建商品' } },
      { path: 'products/:id/edit', element: <EditProduct />, handle: { label: '编辑商品' } },
      { path: 'products/groups', element: <ProductGroups />, handle: { label: '商品组' } },
      { path: 'products/ai-copy', element: <ProductAICopy />, handle: { label: 'AI商品文案' } },
      { path: 'avatar/list', element: <AvatarList />, handle: { label: '数字人列表' } },
      { path: 'avatar/create', element: <CreateAvatar />, handle: { label: '创建数字人' } },
      { path: 'avatar/actions', element: <ActionLibrary />, handle: { label: '动作库' } },
      { path: 'studio/background', element: <AiBackground />, handle: { label: 'AI生成背景' } },
      { path: 'studio/layout', element: <ScreenLayout />, handle: { label: '画面布局' } },
      { path: 'studio/obs-output', element: <ObsOutput />, handle: { label: 'OBS输出预留' } },
      { path: 'interaction/danmu', element: <DanmuCapture />, handle: { label: '弹幕捕获' } },
      { path: 'interaction/questions', element: <QuestionQueue />, handle: { label: '问题队列' } },
      { path: 'interaction/manual', element: <ManualTakeover />, handle: { label: '人工接管台' } },
      { path: 'delay-control/current', element: <CurrentSpeech />, handle: { label: '当前播报' } },
      { path: 'delay-control/queue', element: <SpeechQueue />, handle: { label: '待播队列' } },
      { path: 'delay-control/subtitles', element: <SubtitlePreview />, handle: { label: '字幕预览' } },
      { path: 'delay-control/settings', element: <DelaySettings />, handle: { label: '延迟设置' } },
      { path: 'ai-center/assistant', element: <AiAssistant />, handle: { label: 'AI助理设置' } },
      { path: 'ai-center/models', element: <ModelServices />, handle: { label: '模型服务配置' } },
      { path: 'ai-center/prompts', element: <PromptTemplates />, handle: { label: 'Prompt模板管理' } },
      { path: 'executors/list', element: <ExecutorList />, handle: { label: '执行端列表' } },
      { path: 'executors/obs-status', element: <ObsStatus />, handle: { label: 'OBS连接状态' } },
      { path: 'executors/heartbeats', element: <HeartbeatLogs />, handle: { label: '心跳日志' } },
      { path: 'help/faq', element: <Faq />, handle: { label: '常见问题' } },
      { path: 'help/troubleshooting', element: <Troubleshooting />, handle: { label: '快速排查' } },
      { path: 'help/tickets', element: <Tickets />, handle: { label: '技术工单' } },
      { path: 'settings/users', element: <UserManagement />, handle: { label: '用户管理' } },
      { path: 'settings/basic', element: <BasicSettings />, handle: { label: '基础设置' } },
      { path: '*', element: <Navigate to="/dashboard" replace /> },
    ],
  },
]);

export default router;
