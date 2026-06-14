import {
  CheckOutlined,
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  FolderOpenOutlined,
  PlusCircleOutlined,
  SendOutlined,
  ThunderboltOutlined,
  UploadOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Badge,
  Button,
  Card,
  Descriptions,
  Divider,
  Empty,
  Input,
  List,
  Modal,
  Select,
  Space,
  Spin,
  Switch,
  Tag,
  Timeline,
  Tooltip,
  Typography,
  Upload,
  message,
} from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import CommentTypeTag from '../../components/CommentTypeTag';
import PageHeader from '../../components/PageHeader';
import RiskTag from '../../components/RiskTag';
import SpeechRiskTag from '../../components/SpeechRiskTag';
import SpeechStatusTag from '../../components/SpeechStatusTag';
import StatusTag from '../../components/StatusTag';
import {
  dispatchNextSpeechItem,
  dispatchSpeechItem,
  getCurrentSpeech,
  getDelaySettings as getFallbackDelaySettings,
  getSpeechActions,
  getSpeechQueue,
  getSpeechTones,
} from '../../services/delayControlService';
import {
  addQuestionToSpeechQueue,
  generateQuestionReply,
  getAiReplyTemplates,
  getBroadcastModes,
  getTakeoverActions,
  getTakeoverTones,
  ignoreQuestion,
  simulateComment,
} from '../../services/interactionService';
import {
  directSpeakControlRoomManualSpeech,
  enqueueControlRoomManualSpeech,
  getControlRoomBroadcast,
  getControlRoomComments,
  getControlRoomQuestions,
  getLiveControlRoomState,
  sendControlRoomManualSpeech,
  updateControlRoomSpeechQueueItem,
} from '../../services/liveControlRoomService';
import { closeLiveSession, connectLiveSession, getLiveSessionEngines, openLiveSession, speakLiveSession } from '../../services/liveSessionService';
import {
  getAvatarPreprocessTask,
  getAvatarSourceVideos,
  getAvatars,
  startAvatarPreprocess,
  updateAvatar,
} from '../../services/avatarService';
import { generateCommentReply } from '../../services/aiService';
import { getExecutorCommand, getLocalObsSourceScreenshot, getObsOutputRuntime } from '../../services/executorService';
import { uploadAvatarSourceVideo } from '../../services/fileService';

const commentFilters = [
  { key: 'all', label: '全部' },
  { key: 'questions', label: '仅看问题' },
  { key: 'risk', label: '仅看高风险' },
  { key: 'pending', label: '未处理' },
];

const speechActions = getSpeechActions();
const speechTones = getSpeechTones();
const broadcastModes = getBroadcastModes();
const takeoverActions = getTakeoverActions();
const takeoverTones = getTakeoverTones();
const aiReplyTemplates = getAiReplyTemplates();
const fallbackDelaySettings = getFallbackDelaySettings();
const avatarRuntimeStatusOptions = [
  { label: '已预处理', value: 'ready' },
  { label: '预处理中', value: 'preprocessing' },
  { label: '待预处理', value: 'pending' },
  { label: '测试中', value: 'testing' },
  { label: '预处理失败', value: 'failed' },
  { label: '不可用', value: 'disabled' },
];
const avatarRuntimeModelOptions = [
  { label: 'wav2lip 实时低延迟', value: 'wav2lip' },
  { label: 'musetalk 高清口型', value: 'musetalk' },
];
const avatarRuntimeResolutionOptions = [
  { label: '720p 高码率', value: '720p' },
  { label: '1080p 高码率', value: '1080p' },
];

function getAvatarRuntime(avatar) {
  return avatar?.imageSettings?.liveRuntime || {};
}

function getAvatarRuntimeId(avatar) {
  const runtime = getAvatarRuntime(avatar);
  return runtime.livetalkingAvatarId || runtime.avatarId || runtime.preprocessedAvatarId || '';
}

function getAvatarRuntimeStatusLabel(status) {
  return avatarRuntimeStatusOptions.find((item) => item.value === status)?.label || '未登记';
}

function nowTime() {
  return new Date().toLocaleTimeString('zh-CN', { hour12: false });
}

function formatRiskTips(riskTips = []) {
  return riskTips
    .map((item) => `${item.keyword || '合规词'}（${item.riskLevel || '未知'}风险）`)
    .filter(Boolean)
    .join('、');
}

function formatFileSize(bytes = 0) {
  const value = Number(bytes || 0);
  if (!Number.isFinite(value) || value <= 0) return '0B';
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)}KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)}MB`;
  return `${(value / 1024 / 1024 / 1024).toFixed(2)}GB`;
}

function getAiReply(question) {
  return question.aiReply || aiReplyTemplates[question.type] || '这是本地 AI 推荐回复，播出前请先做合规审核。';
}

function isHighRisk(level) {
  return level === '高';
}

function isPendingStatus(status) {
  return !String(status || '').includes('已忽略') && !String(status || '').includes('已加入待播');
}

const approvedSpeechStatuses = ['已通过', '已审核', '即将播出'];
const dispatchableBroadcastStatuses = ['', '待下发', '失败'];
const dispatchingBroadcastStatuses = ['下发中'];
const broadcastedBroadcastStatuses = ['已播报'];
const finalCommandStatuses = ['done', 'succeeded', 'failed', 'timeout', 'expired', 'cancelled'];
const commandStatusColorMap = {
  pending: 'gold',
  received: 'blue',
  running: 'processing',
  done: 'green',
  succeeded: 'green',
  failed: 'red',
  timeout: 'red',
  expired: 'red',
  cancelled: 'default',
};

function isApprovedSpeech(record) {
  return approvedSpeechStatuses.includes(record.reviewStatus);
}

function canDispatchSpeech(record) {
  return isApprovedSpeech(record) && dispatchableBroadcastStatuses.includes(record.broadcastStatus || '');
}

function isDispatchingSpeech(record) {
  return dispatchingBroadcastStatuses.includes(record.broadcastStatus);
}

function isBroadcastedSpeech(record) {
  return broadcastedBroadcastStatuses.includes(record.broadcastStatus);
}

function isFinalCommandStatus(status) {
  return finalCommandStatuses.includes(String(status || ''));
}

function getCommandStatusColor(status) {
  return commandStatusColorMap[String(status || '')] || 'default';
}

function isExecutorOnlineStatus(status) {
  const text = String(status || '');
  if (!text || text.includes('离线') || text.includes('异常')) {
    return false;
  }

  return ['在线', '直播中', '更新中'].some((item) => text.includes(item));
}

export default function LiveControlRoom() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [overview, setOverview] = useState(null);
  const [commentList, setCommentList] = useState([]);
  const [commentFilter, setCommentFilter] = useState('all');
  const [questionList, setQuestionList] = useState([]);
  const [queue, setQueue] = useState([]);
  const [broadcastState, setBroadcastState] = useState(null);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueError, setQueueError] = useState('');
  const [dispatchingId, setDispatchingId] = useState('');
  const [manualSubmittingMode, setManualSubmittingMode] = useState('');
  const [questionQueueingId, setQuestionQueueingId] = useState('');
  const [speechText, setSpeechText] = useState('');
  const [tone, setTone] = useState(takeoverTones[0] || '亲切');
  const [action, setAction] = useState(takeoverActions[0] || '看评论区');
  const [broadcastMode, setBroadcastMode] = useState(broadcastModes[0] || '立即插队');
  const [suggestion, setSuggestion] = useState('');
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [editingReply, setEditingReply] = useState('');
  const [editingSpeech, setEditingSpeech] = useState(null);
  const [speechDraft, setSpeechDraft] = useState({ text: '', action: speechActions[0] || '回到镜头', tone: speechTones[0] || '专业' });
  const [dhSession, setDhSession] = useState(null);
  const [dhBusy, setDhBusy] = useState('');
  const [dhEngineLoading, setDhEngineLoading] = useState(false);
  const [dhEngineConfig, setDhEngineConfig] = useState(null);
  const [dhProvider, setDhProvider] = useState('livetalking');
  const [dhVoiceEngine, setDhVoiceEngine] = useState('voxcpm2');
  const [dhCloneMode, setDhCloneMode] = useState('hifi');
  const [dhAvatars, setDhAvatars] = useState([]);
  const [dhAvatarsLoading, setDhAvatarsLoading] = useState(false);
  const [selectedDhAvatarId, setSelectedDhAvatarId] = useState('');
  const [avatarRuntimeModalOpen, setAvatarRuntimeModalOpen] = useState(false);
  const [avatarRuntimeSaving, setAvatarRuntimeSaving] = useState(false);
  const [avatarPreprocessBusy, setAvatarPreprocessBusy] = useState(false);
  const [avatarPreprocessPolling, setAvatarPreprocessPolling] = useState(false);
  const [avatarSourceVideos, setAvatarSourceVideos] = useState([]);
  const [avatarSourceFolder, setAvatarSourceFolder] = useState('');
  const [avatarSourceVideosLoading, setAvatarSourceVideosLoading] = useState(false);
  const [avatarSourceUploading, setAvatarSourceUploading] = useState(false);
  const [avatarRuntimeDraft, setAvatarRuntimeDraft] = useState({
    livetalkingAvatarId: '',
    sourceVideoPath: '',
    preprocessedPath: '',
    modelRoute: 'wav2lip',
    resolution: '720p',
    status: 'pending',
    preprocessTaskId: '',
    preprocessProgress: 0,
    preprocessError: '',
    note: '',
  });
  const [autoReply, setAutoReply] = useState(false);
  const [replyingId, setReplyingId] = useState('');
  const [lastSpeakCommand, setLastSpeakCommand] = useState(null);
  const [commandPolling, setCommandPolling] = useState(false);
  const [dhRtcStatus, setDhRtcStatus] = useState('idle');
  const [dhRtcSessionId, setDhRtcSessionId] = useState('');
  const [dhRtcError, setDhRtcError] = useState('');
  const [obsOutputRuntime, setObsOutputRuntime] = useState(null);
  const [obsScreenshot, setObsScreenshot] = useState(null);
  const [obsScreenshotLoading, setObsScreenshotLoading] = useState(false);
  const [obsScreenshotError, setObsScreenshotError] = useState('');
  const [obsPasswordInput, setObsPasswordInput] = useState('');
  const dhPeerRef = useRef(null);
  const dhVideoRef = useRef(null);
  const dhAudioRef = useRef(null);

  async function loadObsOutputRuntime(options = {}) {
    try {
      const data = await getObsOutputRuntime();
      setObsOutputRuntime(data.runtime || null);
      return data.runtime || null;
    } catch (requestError) {
      if (!options.silent) {
        message.warning(requestError.message || 'OBS 输出状态读取失败');
      }
      return null;
    }
  }

  async function loadObsSourceScreenshot(options = {}) {
    try {
      if (!options.silent) {
        setObsScreenshotLoading(true);
      }
      setObsScreenshotError('');
      const requestPayload = options.password ? { password: options.password } : {};
      const data = await getLocalObsSourceScreenshot(requestPayload);
      setObsScreenshot(data.screenshot || null);
      if (options.password) {
        setObsPasswordInput('');
      }
      return data.screenshot || null;
    } catch (requestError) {
      const errorMessage = requestError.message || 'OBS 当前画面读取失败';
      setObsScreenshotError(errorMessage);
      if (!options.silent) {
        message.warning(errorMessage);
      }
      return null;
    } finally {
      if (!options.silent) {
        setObsScreenshotLoading(false);
      }
    }
  }

  async function loadBroadcastQueue(taskId, options = {}) {
    if (!taskId) {
      setQueue([]);
      setQueueError('当前直播任务缺少任务 ID，无法读取待播队列');
      return;
    }

    try {
      if (!options.silent) {
        setQueueLoading(true);
      }
      setQueueError('');
      const [queueResult, currentResult] = await Promise.all([
        getSpeechQueue({ liveTaskId: taskId, pageSize: 30 }),
        getCurrentSpeech({ liveTaskId: taskId }),
      ]);

      setQueue(queueResult.list || []);
      setBroadcastState((current) => ({
        ...(current || {}),
        delayControl: currentResult || current?.delayControl || null,
        currentSpeech: currentResult?.currentSpeech || current?.currentSpeech || null,
        nextSpeech: currentResult?.nextSpeech || current?.nextSpeech || null,
        queueStatus: currentResult?.queueStatus || current?.queueStatus || null,
      }));
    } catch (requestError) {
      setQueueError(requestError.message || '本地 API 服务未连接，请先运行 npm run server:dev');
    } finally {
      setQueueLoading(false);
    }
  }

  async function loadControlRoom() {
    try {
      setLoading(true);
      setError('');
      setQueueError('');
      const overviewResult = await getLiveControlRoomState();
      const taskId = overviewResult.task?.id;
      const [commentsResult, questionsResult, broadcastResult, queueResult, currentResult] = await Promise.all([
        getControlRoomComments({ taskId, limit: 30 }),
        getControlRoomQuestions({ taskId }),
        getControlRoomBroadcast(taskId),
        getSpeechQueue({ liveTaskId: taskId, pageSize: 30 }),
        getCurrentSpeech({ liveTaskId: taskId }),
      ]);

      setOverview(overviewResult);
      setCommentList(commentsResult.list || []);
      setQuestionList(questionsResult.list || []);
      setBroadcastState({
        ...broadcastResult,
        delayControl: currentResult || broadcastResult.delayControl,
        currentSpeech: currentResult?.currentSpeech || broadcastResult.currentSpeech,
        nextSpeech: currentResult?.nextSpeech || broadcastResult.nextSpeech,
        queueStatus: currentResult?.queueStatus || broadcastResult.queueStatus,
      });
      setQueue(queueResult.list || []);
    } catch (requestError) {
      setError(requestError.message || '本地 API 服务未连接，请先运行 npm run server:dev');
    } finally {
      setLoading(false);
    }
  }

  async function loadDigitalHumanAvatars() {
    try {
      setDhAvatarsLoading(true);
      const result = await getAvatars({ pageSize: 100 });
      setDhAvatars(result.list || []);
    } catch (requestError) {
      message.error(requestError.message || '数字人形象列表加载失败');
    } finally {
      setDhAvatarsLoading(false);
    }
  }

  async function loadAvatarSourceVideos(options = {}) {
    try {
      setAvatarSourceVideosLoading(true);
      const result = await getAvatarSourceVideos();
      const files = result.files || [];
      setAvatarSourceVideos(files);
      setAvatarSourceFolder(result.folderPath || '');

      if (!options.silent) {
        message.success(`已扫描源视频素材箱：${files.length} 个视频`);
      }
      return files;
    } catch (requestError) {
      if (!options.silent) {
        message.error(requestError.message || '源视频素材箱扫描失败');
      }
      return [];
    } finally {
      setAvatarSourceVideosLoading(false);
    }
  }

  async function handleUploadAvatarSourceVideo(file) {
    if (!selectedDhAvatar) {
      message.warning('请先选择一个数字人形象');
      return false;
    }

    try {
      setAvatarSourceUploading(true);
      const uploaded = await uploadAvatarSourceVideo(file, { businessId: selectedDhAvatar.id });
      const sourceVideoPath = uploaded.localPath || uploaded.filePath || '';

      if (sourceVideoPath) {
        updateAvatarRuntimeDraft('sourceVideoPath', sourceVideoPath);
      }

      await loadAvatarSourceVideos({ silent: true });
      message.success('源视频已保存到素材箱');
    } catch (requestError) {
      message.error(requestError.message || '源视频上传失败');
    } finally {
      setAvatarSourceUploading(false);
    }

    return false;
  }

  function waitForIceGatheringComplete(peer) {
    return new Promise((resolve) => {
      if (peer.iceGatheringState === 'complete') {
        resolve();
        return;
      }

      const checkState = () => {
        if (peer.iceGatheringState === 'complete') {
          peer.removeEventListener('icegatheringstatechange', checkState);
          resolve();
        }
      };

      peer.addEventListener('icegatheringstatechange', checkState);
    });
  }

  function stopDhRtcConnection(options = {}) {
    const { resetStatus = true } = options;

    if (dhPeerRef.current) {
      dhPeerRef.current.close();
      dhPeerRef.current = null;
    }

    if (dhVideoRef.current) {
      dhVideoRef.current.srcObject = null;
    }

    if (dhAudioRef.current) {
      dhAudioRef.current.srcObject = null;
    }

    setDhRtcSessionId('');
    setDhRtcError('');
    if (resetStatus) {
      setDhRtcStatus('idle');
    }
  }

  async function playDhAudio() {
    const audio = dhAudioRef.current;

    if (!audio || !audio.srcObject) {
      return false;
    }

    audio.muted = false;
    audio.volume = 1;

    try {
      await audio.play();
      return true;
    } catch {
      return false;
    }
  }

  async function getPreferredLiveTalkingSessionId() {
    let outputSessionId = '';

    try {
      const data = await getObsOutputRuntime();
      const runtime = data.runtime || {};
      setObsOutputRuntime(runtime);
      const outputAvatarId = runtime.avatarId || '';
      const avatarMatches = !selectedDhRuntimeAvatarId || !outputAvatarId || outputAvatarId === selectedDhRuntimeAvatarId;

      if (runtime.status === 'connected' && runtime.sessionId && avatarMatches) {
        outputSessionId = runtime.sessionId;
      }
    } catch {
      outputSessionId = '';
    }

    return outputSessionId || dhRtcSessionId;
  }

  async function speakWithLocalDigitalHuman(text) {
    const speech = String(text || '').trim();

    if (!speech) {
      throw new Error('待播话术为空，无法发送到本机数字人');
    }

    if (!dhSession?.id) {
      throw new Error('本机数字人还未开播');
    }

    const runtimeSessionId = dhProvider === 'livetalking' ? await getPreferredLiveTalkingSessionId() : '';

    if (dhProvider === 'livetalking' && dhRtcStatus !== 'connected' && !runtimeSessionId) {
      throw new Error('本机数字人画面还未连接');
    }

    let result;

    try {
      result = await speakLiveSession(dhSession.id, {
        text: speech,
        provider: dhProvider,
        voiceEngine: dhVoiceEngine,
        cloneMode: dhCloneMode,
        liveTalkingSessionId: runtimeSessionId,
      });
    } catch (error) {
      if (runtimeSessionId && runtimeSessionId !== dhRtcSessionId && dhRtcSessionId) {
        result = await speakLiveSession(dhSession.id, {
          text: speech,
          provider: dhProvider,
          voiceEngine: dhVoiceEngine,
          cloneMode: dhCloneMode,
          liveTalkingSessionId: dhRtcSessionId,
        });
      } else {
        throw error;
      }
    }

    setDhSession((current) => ({ ...(current || {}), status: 'live', lastText: speech }));
    await playDhAudio();
    return result;
  }

  async function connectDhRtc(session) {
    if (!session?.id || (session.provider || dhProvider) !== 'livetalking') {
      return;
    }

    stopDhRtcConnection({ resetStatus: false });
    setDhRtcStatus('connecting');
    setDhRtcError('');

    const peer = new RTCPeerConnection({ sdpSemantics: 'unified-plan' });
    dhPeerRef.current = peer;

    peer.addTransceiver('video', { direction: 'recvonly' });
    peer.addTransceiver('audio', { direction: 'recvonly' });

    peer.addEventListener('track', (event) => {
      const [stream] = event.streams;
      if (event.track.kind === 'video' && dhVideoRef.current) {
        dhVideoRef.current.srcObject = stream;
      }
      if (event.track.kind === 'audio' && dhAudioRef.current) {
        dhAudioRef.current.srcObject = stream;
        dhAudioRef.current.muted = false;
        dhAudioRef.current.volume = 1;
        dhAudioRef.current.play().catch(() => {});
      }
    });

    peer.addEventListener('connectionstatechange', () => {
      if (peer.connectionState === 'connected') {
        setDhRtcStatus('connected');
      } else if (['failed', 'disconnected', 'closed'].includes(peer.connectionState)) {
        setDhRtcStatus(peer.connectionState === 'closed' ? 'idle' : peer.connectionState);
      }
    });

    try {
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      await waitForIceGatheringComplete(peer);

      const answer = await connectLiveSession(session.id, {
        sdp: peer.localDescription.sdp,
        type: peer.localDescription.type,
        avatar: selectedDhRuntimeAvatarId,
      });

      if (answer.sessionid) {
        setDhRtcSessionId(String(answer.sessionid));
      }

      await peer.setRemoteDescription(new RTCSessionDescription({ type: answer.type || 'answer', sdp: answer.sdp }));
    } catch (requestError) {
      stopDhRtcConnection({ resetStatus: false });
      setDhRtcStatus('failed');
      setDhRtcError(requestError.message || '数字人画面连接失败');
      throw requestError;
    }
  }

  useEffect(() => {
    loadControlRoom();
    loadDigitalHumanAvatars();
    loadObsOutputRuntime({ silent: true });
    loadObsSourceScreenshot({ silent: true });
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      loadObsOutputRuntime({ silent: true });
      loadObsSourceScreenshot({ silent: true });
    }, 3000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (avatarRuntimeModalOpen) {
      loadAvatarSourceVideos({ silent: true });
    }
  }, [avatarRuntimeModalOpen]);

  useEffect(() => () => {
    stopDhRtcConnection({ resetStatus: false });
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadDigitalHumanEngines() {
      try {
        setDhEngineLoading(true);
        const result = await getLiveSessionEngines({ provider: dhProvider });

        if (cancelled) return;

        setDhEngineConfig(result);
        setDhProvider(result.defaultProvider || dhProvider);
        setDhVoiceEngine(result.defaultVoiceEngine || 'voxcpm2');
        setDhCloneMode(result.defaultCloneMode || 'hifi');
      } catch (requestError) {
        if (!cancelled) {
          setDhEngineConfig({
            health: {
              ok: false,
              provider: dhProvider,
              message: requestError.message || 'Local digital human engine status unavailable',
            },
          });
        }
      } finally {
        if (!cancelled) {
          setDhEngineLoading(false);
        }
      }
    }

    loadDigitalHumanEngines();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const commandId = lastSpeakCommand?.commandId || lastSpeakCommand?.id;
    const taskId = overview?.task?.id;

    if (!commandId || isFinalCommandStatus(lastSpeakCommand?.status)) {
      return undefined;
    }

    let cancelled = false;

    async function pollCommand() {
      try {
        setCommandPolling(true);
        const command = await getExecutorCommand(commandId);

        if (!cancelled) {
          setLastSpeakCommand((current) => {
            const currentCommandId = current?.commandId || current?.id;

            if (currentCommandId !== commandId) {
              return current;
            }

            return {
              ...current,
              ...command,
              commandId: command.commandId || command.id || commandId,
              traceId: command.traceId || current.traceId,
            };
          });

          if (isFinalCommandStatus(command.status) && taskId) {
            await loadBroadcastQueue(taskId, { silent: true });
          }
        }
      } catch (requestError) {
        if (!cancelled) {
          setLastSpeakCommand((current) => ({
            ...(current || {}),
            commandId,
            status: current?.status || 'pending',
            resultMessage: requestError.message || '命令状态查询失败',
          }));
        }
      } finally {
        if (!cancelled) {
          setCommandPolling(false);
        }
      }
    }

    pollCommand();
    const timer = window.setInterval(pollCommand, 2500);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [lastSpeakCommand?.commandId, lastSpeakCommand?.id, lastSpeakCommand?.status, overview?.task?.id]);

  const currentTask = overview?.task || {};
  const currentRoom = overview?.room || {};
  const studioOutput = overview?.outputStatus || {};
  const delayControl = broadcastState?.delayControl || overview?.delayControl || {};
  const manualTakeover = overview?.manualTakeover || {};
  const subtitles = broadcastState?.subtitles || {};
  const delaySettings = broadcastState?.delaySettings || fallbackDelaySettings;
  const currentSpeech = delayControl.currentSpeech || {};
  const nextSpeech = delayControl.nextSpeech || {};
  const currentSubtitle = subtitles.currentSubtitle || {};
  const nextSubtitle = subtitles.nextSubtitle || {};
  const subtitleStyle = subtitles.subtitleStyle || {};
  const selectedDhAvatar = useMemo(
    () => dhAvatars.find((item) => item.id === selectedDhAvatarId) || null,
    [dhAvatars, selectedDhAvatarId],
  );
  const selectedDhAvatarRuntime = getAvatarRuntime(selectedDhAvatar);
  const selectedDhRuntimeAvatarId = getAvatarRuntimeId(selectedDhAvatar);

  useEffect(() => {
    if (selectedDhAvatarId || !dhAvatars.length) {
      return;
    }

    const taskAvatar = dhAvatars.find((item) => item.id === currentTask.avatarId);
    setSelectedDhAvatarId((taskAvatar || dhAvatars[0])?.id || '');
  }, [currentTask.avatarId, dhAvatars, selectedDhAvatarId]);

  const unhandledComments = useMemo(
    () => commentList.filter((item) => !String(item.replyStatus || '').includes('已忽略')),
    [commentList],
  );
  const highRiskComments = useMemo(() => commentList.filter((item) => isHighRisk(item.riskLevel)), [commentList]);
  const pendingQuestions = useMemo(() => questionList.filter((item) => isPendingStatus(item.status)), [questionList]);
  const activeQueue = useMemo(
    () => queue.filter((item) => !String(item.reviewStatus || '').includes('已删除')).sort((a, b) => (a.order || 0) - (b.order || 0)),
    [queue],
  );
  const pendingReviewSpeech = useMemo(
    () => activeQueue.filter((item) => !String(item.reviewStatus || '').includes('已通过')),
    [activeQueue],
  );

  const queueStatus = delayControl.queueStatus || broadcastState?.queueStatus || {};
  const dispatchingSpeech = queueStatus.current || activeQueue.find(isDispatchingSpeech);
  const nextDispatchableSpeech = queueStatus.next || activeQueue.find(canDispatchSpeech);
  const recentBroadcastedSpeech = useMemo(
    () => (queueStatus.broadcasted?.length ? queueStatus.broadcasted : activeQueue.filter(isBroadcastedSpeech).slice(0, 3)),
    [activeQueue, queueStatus.broadcasted],
  );
  const dispatchableSpeechCount = useMemo(() => activeQueue.filter(canDispatchSpeech).length, [activeQueue]);
  const executorStatusText = overview?.statusBar?.executorStatus || delayControl.executorStatus || '';
  const executorReady = Boolean(currentTask.executorId) && isExecutorOnlineStatus(executorStatusText);
  const dispatchBlockedReason = !currentTask.executorId
    ? '当前直播任务未绑定执行端，无法下发播报'
    : !executorReady
      ? `执行端未在线或状态异常：${executorStatusText || '未知'}`
      : !dispatchableSpeechCount
        ? '暂无已审核且待下发的话术'
        : '';

  const filteredComments = useMemo(
    () =>
      commentList.filter((item) => {
        if (commentFilter === 'questions') {
          return !['闲聊互动', '恶意评论'].includes(item.type);
        }
        if (commentFilter === 'risk') {
          return isHighRisk(item.riskLevel);
        }
        if (commentFilter === 'pending') {
          return unhandledComments.some((comment) => comment.id === item.id);
        }
        return true;
      }),
    [commentFilter, commentList, unhandledComments],
  );

  const statusBar = overview?.statusBar || {};
  const liveStatusItems = [
    { label: '当前直播任务', value: statusBar.currentLiveTask || currentTask.taskName, wide: true },
    { label: '当前直播间', value: statusBar.currentLiveRoom || currentRoom.name, wide: true },
    { label: '平台', node: <Tag color="blue">{statusBar.platform || currentTask.platform || '本机'}</Tag> },
    { label: '当前数字人', value: statusBar.currentAvatar || currentTask.avatarName, wide: true },
    { label: '当前商品组', value: statusBar.currentProductGroup || currentTask.productGroupName, wide: true },
    { label: '执行端', node: <StatusTag status={statusBar.executorStatus || delayControl.executorStatus} /> },
    { label: 'OBS', node: <StatusTag status={statusBar.obsStatus || studioOutput.obsStatus} /> },
    { label: '延迟模式', node: <Tag color="geekblue">{statusBar.delayMode || delayControl.delayMode || '本机延迟'}</Tag> },
    { label: '未处理弹幕', node: <Badge count={unhandledComments.length} overflowCount={99} /> },
    { label: '待处理问题', node: <Badge count={pendingQuestions.length} color="#f59e0b" /> },
    { label: '高风险评论', node: <Badge count={highRiskComments.length} color="#e11d48" /> },
    { label: '待审核播报', node: <Badge count={pendingReviewSpeech.length} color="#7c3aed" /> },
  ];

  const updateCommentStatus = (id, replyStatus) => {
    setCommentList((items) => items.map((item) => (item.id === id ? { ...item, replyStatus } : item)));
  };

  const updateQuestion = (id, patch) => {
    setQuestionList((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const updateSpeech = (id, patch) => {
    setQueue((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const upsertSpeech = (speechItem) => {
    if (!speechItem?.id) return;

    setQueue((items) => {
      const exists = items.some((item) => item.id === speechItem.id);
      if (exists) {
        return items.map((item) => (item.id === speechItem.id ? { ...item, ...speechItem } : item));
      }

      return [speechItem, ...items];
    });
  };

  const handleAiReplyAndSpeak = async (comment) => {
    if (!comment) return;
    const sessionActive = Boolean(dhSession && dhSession.status && dhSession.status !== 'ended');
    if (!sessionActive) {
      message.warning('请先点「开播」启动数字人，再让它回复弹幕');
      return;
    }

    try {
      setReplyingId(comment.id);
      const replyResult = await generateCommentReply({
        comment: comment.content,
        productName: currentTask.productGroupName || '',
        sourcePage: '直播中控台',
      });
      const reply = replyResult.reply || '';
      setCommentList((items) =>
        items.map((item) => (item.id === comment.id ? { ...item, aiReply: reply, replyStatus: '已回复' } : item)),
      );
      await speakWithLocalDigitalHuman(reply);
      message.success('数字人已回复该弹幕');
    } catch (requestError) {
      const errorText = requestError.message || '自动回复失败';
      if (errorText.includes('合规') || errorText.includes('命中')) {
        Modal.warning({ title: '回复被合规拦截，未播报', content: errorText });
      } else {
        message.error(errorText);
      }
    } finally {
      setReplyingId('');
    }
  };

  const handleSimulateComment = async () => {
    try {
      const newComment = await simulateComment({
        liveTaskId: currentTask.id,
        liveRoomId: currentRoom.id,
        content: '中控台模拟新弹幕：这款今天有优惠吗？',
        time: nowTime(),
        productName: currentTask.productGroupName || '当前商品组',
      });
      setCommentList((items) => [newComment, ...items]);
      message.success('已追加一条本地测试弹幕');
      if (autoReply && dhSession && dhSession.status && dhSession.status !== 'ended') {
        handleAiReplyAndSpeak(newComment);
      }
    } catch (requestError) {
      message.error(requestError.message || '模拟弹幕失败');
    }
  };

  const handleOpenQuestionEdit = (question) => {
    setEditingQuestion(question);
    setEditingReply(getAiReply(question));
  };

  const handleSaveQuestionEdit = async () => {
    if (!editingQuestion) return;

    try {
      const updated = await generateQuestionReply(editingQuestion.id, { replyText: editingReply });
      updateQuestion(editingQuestion.id, updated);
      setEditingQuestion(null);
      setEditingReply('');
      message.success('已通过本地 API 保存推荐回复');
    } catch (requestError) {
      message.error(requestError.message || '保存回复失败');
    }
  };

  const handleAddQuestionToQueue = async (question) => {
    try {
      setQuestionQueueingId(question.id);
      const result = await addQuestionToSpeechQueue(question.id, {
        source: 'question_reply',
        scheduledTime: '下一句',
      });
      updateQuestion(question.id, result.question);
      upsertSpeech(result.speechItem);
      const riskTipText = formatRiskTips(result.riskTips);
      if (riskTipText) {
        message.warning(`合规提示：${riskTipText}`);
      }
      message.success(result.message || '已加入真实待播队列');
      await loadBroadcastQueue(currentTask.id || question.liveTaskId, { silent: true });
    } catch (requestError) {
      message.error(requestError.message || '加入待播失败');
    } finally {
      setQuestionQueueingId('');
    }
  };

  const handleIgnoreQuestion = async (question) => {
    try {
      const updated = await ignoreQuestion(question.id);
      updateQuestion(question.id, updated);
      message.info('已忽略问题');
    } catch (requestError) {
      message.error(requestError.message || '忽略失败');
    }
  };

  const handleBroadcast = async (mode = broadcastMode) => {
    if (!speechText.trim()) {
      message.warning('请先输入人工接管话术');
      return;
    }

    try {
      const result = await sendControlRoomManualSpeech({
        taskId: currentTask.id,
        text: speechText,
        tone,
        action,
        broadcastMode: mode,
      });
      setSuggestion(result.suggestion || '');
      message.success(`${mode} 已通过本地 API 生成建议，未加入待播队列`);
    } catch (requestError) {
      message.error(requestError.message || '人工播报失败');
    }
  };

  const buildManualSpeechPayload = () => ({
    taskId: currentTask.id,
    text: speechText,
    tone,
    action,
    source: 'manual_takeover',
  });

  const handleEnqueueManualSpeech = async () => {
    if (!speechText.trim()) {
      message.warning('请先输入人工接管话术');
      return;
    }

    try {
      setManualSubmittingMode('queue');
      const result = await enqueueControlRoomManualSpeech(buildManualSpeechPayload());
      upsertSpeech(result.speechItem);
      const riskTipText = formatRiskTips(result.riskTips);
      if (riskTipText) {
        message.warning(`合规提示：${riskTipText}`);
      }
      message.success(result.message || '已加入待播队列');
      await loadBroadcastQueue(currentTask.id, { silent: true });
    } catch (requestError) {
      message.error(requestError.message || '加入待播队列失败');
    } finally {
      setManualSubmittingMode('');
    }
  };

  const handleDirectManualSpeech = async () => {
    if (!speechText.trim()) {
      message.warning('请先输入人工接管话术');
      return;
    }

    try {
      setManualSubmittingMode('direct');
      const result = await directSpeakControlRoomManualSpeech(buildManualSpeechPayload());
      upsertSpeech(result.speechItem);
      setLastSpeakCommand({
        commandId: result.commandId,
        status: 'pending',
        traceId: result.traceId || (result.commandId ? `TRACE-${result.commandId}` : ''),
        resultMessage: result.message || '',
        speechItem: result.speechItem,
        executor: result.executor,
      });
      const riskTipText = formatRiskTips(result.riskTips);
      if (riskTipText) {
        message.warning(`合规提示：${riskTipText}`);
      }
      message.success(result.message || `已直发 speak 命令：${result.commandId}`);
      await loadBroadcastQueue(currentTask.id, { silent: true });
    } catch (requestError) {
      const errorText = requestError.message || '直发执行端失败';
      if (errorText.includes('合规') || errorText.includes('命中词')) {
        Modal.warning({
          title: '直发执行端已被合规拦截',
          content: errorText,
        });
      } else {
        message.error(errorText);
      }
    } finally {
      setManualSubmittingMode('');
    }
  };

  const fillReply = (reply) => {
    setSpeechText(reply);
    setSuggestion('');
    message.info('已填入人工输入框');
  };

  const handleOpenSpeechEdit = (record) => {
    setEditingSpeech(record);
    setSpeechDraft({ text: record.text, action: record.action, tone: record.tone });
  };

  const handleSaveSpeechEdit = async () => {
    if (!editingSpeech) return;

    try {
      const updated = await updateControlRoomSpeechQueueItem(editingSpeech.id, {
        operation: 'update',
        ...speechDraft,
        reviewStatus: '已修改',
      });
      updateSpeech(editingSpeech.id, updated);
      setEditingSpeech(null);
      message.success('已通过本地 API 保存待播内容修改');
    } catch (requestError) {
      message.error(requestError.message || '保存待播内容失败');
    }
  };

  const handleSpeechOperation = async (item, operation, patch = {}) => {
    try {
      const updated = await updateControlRoomSpeechQueueItem(item.id, { operation, ...patch });
      updateSpeech(item.id, updated);
      message.success('播控操作已写入本地 API');
    } catch (requestError) {
      message.error(requestError.message || '播控操作失败');
    }
  };

  const handleDispatchSpeech = async (item) => {
    try {
      setDispatchingId(item.id);
      const result = await dispatchSpeechItem(item.id, { liveTaskId: currentTask.id });
      if (result.speechItem) {
        updateSpeech(result.speechItem.id, result.speechItem);
      }
      const riskTipText = formatRiskTips(result.riskTips);
      if (riskTipText) {
        message.warning(`合规复检提示：${riskTipText}`);
      }
      if (dhActive) {
        try {
          await speakWithLocalDigitalHuman(result.speechItem?.text || item.text);
          message.success(`已下发执行端命令，并同步发送到本机数字人：${result.commandId}`);
        } catch (digitalHumanError) {
          message.warning(`执行端命令已下发，但本机数字人未出声：${digitalHumanError.message}`);
        }
      } else {
        message.success(result.message || `已下发播报命令：${result.commandId}`);
        message.info('本机数字人未开播，所以这次只下发到执行端，不会从左侧数字人出声');
      }
      await loadBroadcastQueue(currentTask.id, { silent: true });
    } catch (requestError) {
      message.error(requestError.message || '下发播报失败');
    } finally {
      setDispatchingId('');
    }
  };

  const handleDispatchNextSpeech = async () => {
    try {
      setDispatchingId('__next__');
      const result = await dispatchNextSpeechItem({ liveTaskId: currentTask.id });
      if (result.speechItem) {
        updateSpeech(result.speechItem.id, result.speechItem);
      }
      const riskTipText = formatRiskTips(result.riskTips);
      if (riskTipText) {
        message.warning(`合规复检提示：${riskTipText}`);
      }
      if (dhActive) {
        try {
          await speakWithLocalDigitalHuman(result.speechItem?.text);
          message.success(`已下发下一条，并同步发送到本机数字人：${result.commandId}`);
        } catch (digitalHumanError) {
          message.warning(`下一条已下发执行端，但本机数字人未出声：${digitalHumanError.message}`);
        }
      } else {
        message.success(result.message || `已下发下一条播报命令：${result.commandId}`);
        message.info('本机数字人未开播，所以这次只下发到执行端，不会从左侧数字人出声');
      }
      await loadBroadcastQueue(currentTask.id, { silent: true });
    } catch (requestError) {
      message.error(requestError.message || '下发下一条失败');
    } finally {
      setDispatchingId('');
    }
  };

  const handleDhOpen = async () => {
    try {
      setDhBusy('open');
      const result = await openLiveSession({
        roomId: currentRoom.id,
        roomName: currentRoom.name || currentTask.taskName,
        figureId: selectedDhAvatar?.id || currentTask.avatarId || '',
        figureName: selectedDhAvatar?.name || currentTask.avatarName || '',
        runtimeAvatarId: selectedDhRuntimeAvatarId,
        runtimeAvatar: selectedDhAvatarRuntime,
        mode: 'realtime',
        provider: dhProvider,
        voiceEngine: dhVoiceEngine,
        cloneMode: dhCloneMode,
        liveTalkingSessionId: dhRtcSessionId,
      });
      setDhSession(result.session);
      if ((result.session?.provider || dhProvider) === 'livetalking') {
        stopDhRtcConnection();
        const runtime = await loadObsOutputRuntime({ silent: true });
        const runtimeReady = runtime?.status === 'connected' && runtime?.sessionId;
        message.success(
          runtimeReady
            ? '数字人已开播，播报将发送到 OBS 输出画面'
            : '数字人已开播；请确认 OBS 浏览器源已打开纯输出页',
        );
      } else {
        message.success(result.note || `数字人已开播（${result.provider || 'stub'}）`);
      }
    } catch (requestError) {
      message.error(requestError.message || '开播失败');
    } finally {
      setDhBusy('');
    }
  };

  const handleOpenAvatarRuntimeModal = () => {
    if (!selectedDhAvatar) {
      message.warning('请先选择一个数字人形象');
      return;
    }

    const runtime = getAvatarRuntime(selectedDhAvatar);
    setAvatarRuntimeDraft({
      livetalkingAvatarId: runtime.livetalkingAvatarId || runtime.avatarId || '',
      sourceVideoPath: runtime.sourceVideoPath || selectedDhAvatar.trainingAssets?.sourceVideoPath || '',
      preprocessedPath: runtime.preprocessedPath || '',
      modelRoute: runtime.modelRoute || dhRunningModel || 'wav2lip',
      resolution: runtime.resolution || '720p',
      status: runtime.status || (runtime.livetalkingAvatarId ? 'ready' : 'pending'),
      preprocessTaskId: runtime.preprocessTaskId || '',
      preprocessProgress: Number(runtime.preprocessProgress || 0),
      preprocessError: runtime.preprocessError || '',
      note: runtime.note || '',
    });
    setAvatarRuntimeModalOpen(true);
  };

  const updateAvatarRuntimeDraft = (field, value) => {
    setAvatarRuntimeDraft((current) => ({ ...current, [field]: value }));
  };

  const applyUpdatedDhAvatar = (avatar) => {
    if (!avatar?.id) return;

    setDhAvatars((items) => items.map((item) => (item.id === avatar.id ? avatar : item)));
    if (avatar.id === selectedDhAvatarId) {
      const runtime = getAvatarRuntime(avatar);
      setAvatarRuntimeDraft((current) => ({
        ...current,
        livetalkingAvatarId: runtime.livetalkingAvatarId || current.livetalkingAvatarId,
        sourceVideoPath: runtime.sourceVideoPath || current.sourceVideoPath,
        preprocessedPath: runtime.preprocessedPath || current.preprocessedPath,
        modelRoute: runtime.modelRoute || current.modelRoute,
        resolution: runtime.resolution || current.resolution,
        status: runtime.status || current.status,
        preprocessTaskId: runtime.preprocessTaskId || current.preprocessTaskId,
        preprocessProgress: Number(runtime.preprocessProgress || current.preprocessProgress || 0),
        preprocessError: runtime.preprocessError || '',
        note: runtime.note || current.note,
      }));
    }
  };

  const handleSaveAvatarRuntime = async () => {
    if (!selectedDhAvatar) return;

    try {
      setAvatarRuntimeSaving(true);
      const runtime = {
        ...avatarRuntimeDraft,
        provider: 'livetalking',
        updatedAt: new Date().toISOString(),
      };
      const updated = await updateAvatar(selectedDhAvatar.id, {
        imageSettings: {
          ...(selectedDhAvatar.imageSettings || {}),
          liveRuntime: runtime,
        },
        trainingAssets: {
          ...(selectedDhAvatar.trainingAssets || {}),
          sourceVideoPath: runtime.sourceVideoPath || selectedDhAvatar.trainingAssets?.sourceVideoPath || '',
        },
      });

      applyUpdatedDhAvatar(updated);
      setAvatarRuntimeModalOpen(false);
      message.success('本机形象素材配置已保存');
    } catch (requestError) {
      message.error(requestError.message || '保存本机形象素材失败');
    } finally {
      setAvatarRuntimeSaving(false);
    }
  };

  const handleStartAvatarPreprocess = async () => {
    if (!selectedDhAvatar) {
      message.warning('请先选择一个数字人形象');
      return;
    }

    if (!avatarRuntimeDraft.sourceVideoPath.trim()) {
      message.warning('请先填写源视频路径');
      return;
    }

    try {
      setAvatarPreprocessBusy(true);
      const result = await startAvatarPreprocess(selectedDhAvatar.id, avatarRuntimeDraft);
      applyUpdatedDhAvatar(result.avatar);
      message.success(`已创建 LiveTalking 预处理任务：${result.task?.taskId || '-'}`);
    } catch (requestError) {
      message.error(requestError.message || '创建预处理任务失败');
    } finally {
      setAvatarPreprocessBusy(false);
    }
  };

  const handleRefreshAvatarPreprocess = async (options = {}) => {
    if (!selectedDhAvatar) return;

    const taskId = avatarRuntimeDraft.preprocessTaskId || selectedDhAvatarRuntime.preprocessTaskId;
    if (!taskId) {
      if (!options.silent) {
        message.info('当前形象还没有预处理任务');
      }
      return;
    }

    try {
      if (!options.silent) {
        setAvatarPreprocessPolling(true);
      }
      const result = await getAvatarPreprocessTask(selectedDhAvatar.id, taskId);
      applyUpdatedDhAvatar(result.avatar);

      if (!options.silent) {
        if (result.task?.status === 'completed') {
          message.success('预处理已完成，可以下播后用这个形象重新开播');
        } else if (result.task?.status === 'failed') {
          message.error(result.task?.errorMessage || '预处理失败');
        } else {
          message.info(`预处理中：${result.task?.progress || 0}%`);
        }
      }
    } catch (requestError) {
      if (!options.silent) {
        message.error(requestError.message || '刷新预处理状态失败');
      }
    } finally {
      if (!options.silent) {
        setAvatarPreprocessPolling(false);
      }
    }
  };

  const handleLocalDigitalHumanSpeech = async () => {
    if (!speechText.trim()) {
      message.warning('请先输入要让本机数字人播报的话术');
      return;
    }

    if (!dhSession?.id) {
      message.warning('请先在左侧开启本机数字人会话');
      return;
    }

    try {
      setManualSubmittingMode('local-dh');
      const result = await speakWithLocalDigitalHuman(speechText);
      setSuggestion(`已发送到本机数字人：${result.provider || dhProvider} / ${dhVoiceEngine} / ${dhCloneMode}`);
      message.success('已发送到本机数字人播报链路');
    } catch (requestError) {
      message.error(requestError.message || '本机数字人播报失败');
    } finally {
      setManualSubmittingMode('');
    }
  };

  const handleEnableDhSound = async () => {
    const played = await playDhAudio();

    if (played) {
      message.success('本机数字人声音已启用');
    } else {
      message.warning('还没有拿到音频轨，或浏览器暂时阻止播放。请确认左侧画面已连接后再点一次');
    }
  };

  const handleDhClose = async () => {
    if (!dhSession?.id) return;

    try {
      setDhBusy('close');
      stopDhRtcConnection();
      const result = await closeLiveSession(dhSession.id);
      setDhSession(result.session || null);
      message.info('数字人已下播');
    } catch (requestError) {
      message.error(requestError.message || '下播失败');
    } finally {
      setDhBusy('');
    }
  };

  const dhActive = Boolean(dhSession && dhSession.status && dhSession.status !== 'ended');
  const obsOutputConnected = obsOutputRuntime?.status === 'connected' && Boolean(obsOutputRuntime?.sessionId);
  const obsOutputStatusText = obsOutputConnected
    ? 'OBS 输出已连接'
    : obsOutputRuntime?.status === 'closed'
      ? 'OBS 输出已关闭'
      : obsOutputRuntime?.status === 'failed'
        ? 'OBS 输出连接失败'
        : '等待 OBS 输出页连接';
  const obsOutputStatusColor = obsOutputConnected
    ? 'green'
    : obsOutputRuntime?.status === 'failed'
      ? 'red'
      : obsOutputRuntime?.status === 'closed'
        ? 'default'
        : 'orange';
  const obsScreenshotCapturedText = obsScreenshot?.capturedAt
    ? new Date(obsScreenshot.capturedAt).toLocaleTimeString('zh-CN', { hour12: false })
    : '';
  const obsScreenshotNeedsPassword = /password|auth|authentication|鉴权|密码/i.test(obsScreenshotError || '');
  const canSpeakToDigitalHuman = dhProvider !== 'livetalking' || obsOutputConnected || dhRtcStatus === 'connected';
  const dhProviderOptions = dhEngineConfig?.providers || [
    { label: '本机 LiveTalking', value: 'livetalking' },
    { label: '本机 Stub', value: 'stub' },
  ];
  const dhVoiceEngineOptions = dhEngineConfig?.voiceEngines || [
    { label: 'VoxCPM2', value: 'voxcpm2' },
    { label: 'GPT-SoVITS', value: 'gpt-sovits' },
  ];
  const dhCloneModeOptions = dhEngineConfig?.cloneModes || [
    { label: '普通克隆', value: 'reference' },
    { label: 'Hi-Fi 深度克隆', value: 'hifi' },
  ];
  const dhAvatarOptions = dhAvatars.map((item) => {
    const runtimeId = getAvatarRuntimeId(item);
    const runtimeStatus = getAvatarRuntime(item).status;

    return {
      label: `${item.name}${runtimeId ? ` · ${runtimeId}` : ` · ${getAvatarRuntimeStatusLabel(runtimeStatus)}`}`,
      value: item.id,
    };
  });
  const dhHealth = dhEngineConfig?.health || {};
  const dhRunningTts = dhHealth.config?.tts || dhHealth.config?.ttsEngine || dhHealth.config?.tts_engine || '';
  const dhRunningModel = dhHealth.config?.model || dhHealth.config?.modelName || '';
  const dhEngineMismatch = dhProvider === 'livetalking' && dhRunningTts && dhRunningTts !== dhVoiceEngine;
  const dhRtcStatusText = {
    idle: '画面未连接',
    connecting: '画面连接中',
    connected: '画面已连接',
    disconnected: '画面已断开',
    failed: '画面连接失败',
  }[dhRtcStatus] || dhRtcStatus;
  const dhRtcStatusColor = {
    idle: 'default',
    connecting: 'processing',
    connected: 'green',
    disconnected: 'orange',
    failed: 'red',
  }[dhRtcStatus] || 'default';
  const handleDhProviderChange = async (value) => {
    setDhProvider(value);

    try {
      setDhEngineLoading(true);
      const result = await getLiveSessionEngines({ provider: value });
      setDhEngineConfig(result);
    } catch (requestError) {
      setDhEngineConfig({
        health: {
          ok: false,
          provider: value,
          message: requestError.message || 'Local digital human engine status unavailable',
        },
      });
    } finally {
      setDhEngineLoading(false);
    }
  };
  const dhEngineControls = (
    <Space direction="vertical" size={8} style={{ width: '100%' }}>
      <Space wrap>
        <Select
          size="small"
          style={{ width: 160 }}
          value={dhProvider}
          loading={dhEngineLoading}
          options={dhProviderOptions}
          onChange={handleDhProviderChange}
        />
        <Select
          size="small"
          style={{ width: 140 }}
          value={dhVoiceEngine}
          options={dhVoiceEngineOptions}
          onChange={setDhVoiceEngine}
          disabled={dhProvider !== 'livetalking'}
        />
        <Select
          size="small"
          style={{ width: 150 }}
          value={dhCloneMode}
          options={dhCloneModeOptions}
          onChange={setDhCloneMode}
          disabled={dhProvider !== 'livetalking'}
        />
      </Space>
      <Space wrap>
        <Select
          size="small"
          style={{ width: 260 }}
          placeholder="选择开播形象"
          value={selectedDhAvatarId || undefined}
          loading={dhAvatarsLoading}
          options={dhAvatarOptions}
          onChange={setSelectedDhAvatarId}
          disabled={dhActive}
        />
        <Button size="small" onClick={handleOpenAvatarRuntimeModal} disabled={!selectedDhAvatar || dhActive}>
          登记素材
        </Button>
        <Button size="small" loading={dhAvatarsLoading} onClick={loadDigitalHumanAvatars}>
          刷新
        </Button>
      </Space>
      {selectedDhAvatar ? (
        <Typography.Text type="secondary">
          开播形象：{selectedDhAvatar.name} / LiveTalking ID：{selectedDhRuntimeAvatarId || '未登记，使用当前默认形象'} / 状态：
          {getAvatarRuntimeStatusLabel(selectedDhAvatarRuntime.status)}
        </Typography.Text>
      ) : null}
      {!dhHealth.ok && dhHealth.message ? (
        <Alert type="warning" showIcon message={dhHealth.message} />
      ) : null}
      {dhHealth.ok && (dhRunningModel || dhRunningTts) ? (
        <Typography.Text type="secondary">
          运行中：{dhRunningModel || 'LiveTalking'} / {dhRunningTts || '未知 TTS'}
        </Typography.Text>
      ) : null}
      {dhEngineMismatch ? (
        <Alert
          type="warning"
          showIcon
          message={`当前 LiveTalking 进程是 ${dhRunningTts}，切换到 ${dhVoiceEngine} 需要重启对应引擎。`}
        />
      ) : null}
    </Space>
  );

  return (
    <>
      <PageHeader
        title="直播中控台"
        description="直播中控台用于直播进行中的一屏操作，聚合直播预览、弹幕、问题、人工接管、待播队列和风险提示。当前数据来自本地 API + SQLite。"
        extra={
          <Space wrap>
            <Badge status="processing" text="本机中控在线" />
          </Space>
        }
      />

      <Alert
        className="page-alert"
        type="info"
        showIcon
        message="当前为本地 API + LiveTalking / 执行端播报链路。"
        description="右侧待播队列下发与人工接管「直发执行端」保留原执行端命令链路；左侧本机数字人会话负责开播、下播和画面连接，右侧「本机数字人播报」会调用 LiveTalking，并按所选 VoxCPM2/GPT-SoVITS 与克隆模式发送文本。OBS、真实平台弹幕和正式推流仍待接入。"
      />

      {error ? <Alert className="page-alert" type="error" showIcon message={error} /> : null}

      <Spin spinning={loading}>
        {!overview && !loading ? (
          <Card className="panel-card">
            <Empty description="暂无直播中控台数据" />
          </Card>
        ) : null}

        {overview ? (
          <>
            <Card className="panel-card live-status-bar control-room-status-card">
              <div className="control-room-status-grid">
                {liveStatusItems.map((item) => (
                  <div className={`control-room-status-item ${item.wide ? 'is-wide' : ''}`} key={item.label}>
                    <span>{item.label}</span>
                    {item.node || <strong>{item.value || '-'}</strong>}
                  </div>
                ))}
              </div>
            </Card>

            <div className="live-control-room-grid control-room-v2-grid">
              <section className="control-room-column">
                <Card
                  title="数字人播控"
                  className="panel-card control-room-panel"
                  extra={
                    <Space size={6} wrap>
                      <Tag color={dhHealth.ok ? 'green' : 'red'}>{dhHealth.ok ? '引擎在线' : '引擎未连接'}</Tag>
                      {dhActive ? (
                        <Tag color="blue">{dhSession.provider || dhProvider} · {dhSession.status}</Tag>
                      ) : (
                        <Tag>未开播</Tag>
                      )}
                      <Tag color={obsOutputStatusColor}>{obsOutputStatusText}</Tag>
                    </Space>
                  }
                >
                  {dhActive ? (
                    <Space direction="vertical" size={10} style={{ width: '100%' }}>
                      {dhEngineControls}
                      <Descriptions column={1} size="small">
                        <Descriptions.Item label="会话">{dhSession.id}</Descriptions.Item>
                        <Descriptions.Item label="驱动">
                          {(dhSession.provider || dhProvider)} / {dhVoiceEngine} / {dhCloneMode}
                        </Descriptions.Item>
                        <Descriptions.Item label="播报目标">
                          {obsOutputConnected ? `OBS 输出页 / ${obsOutputRuntime.sessionId}` : '等待 OBS 输出页连接'}
                        </Descriptions.Item>
                        <Descriptions.Item label="输出形象">{obsOutputRuntime?.avatarId || selectedDhRuntimeAvatarId || 'LiveTalking 默认形象'}</Descriptions.Item>
                        <Descriptions.Item label="最近播报">{dhSession.lastText || '-'}</Descriptions.Item>
                      </Descriptions>
                      <Alert
                        type={obsOutputConnected ? 'success' : 'warning'}
                        showIcon
                        message={obsOutputConnected ? '真实直播画面由 OBS 输出页接管' : 'OBS 输出页未连接'}
                        description={
                          obsOutputConnected
                            ? '中控台不再创建第二条 LiveTalking 预览会话，避免测试画面和直播画面不同步。'
                            : '请在 OBS 中使用浏览器源 http://127.0.0.1:5173/obs/output，打开后这里会显示已连接。'
                        }
                      />
                      <Space wrap>
                        <Button onClick={() => loadObsOutputRuntime()} loading={dhBusy === 'status'}>
                          刷新 OBS 输出状态
                        </Button>
                        <Button danger loading={dhBusy === 'close'} onClick={handleDhClose}>
                          下播
                        </Button>
                      </Space>
                    </Space>
                  ) : (
                    <Space direction="vertical" size={10} style={{ width: '100%' }}>
                      {dhEngineControls}
                      <Alert
                        type="info"
                        showIcon
                        message="点「开播」启动本机数字人播控。"
                        description="真实画面由 OBS 浏览器源输出；中控台只登记播控会话，不再额外打开一条 LiveTalking 预览。"
                      />
                      <Button type="primary" loading={dhBusy === 'open'} onClick={handleDhOpen}>
                        开播
                      </Button>
                    </Space>
                  )}
                </Card>

                <Card
                  title="OBS 输出监看/状态"
                  className="panel-card control-room-panel"
                  extra={
                    <Space size={6} wrap>
                      <Tag color={obsOutputStatusColor}>{obsOutputStatusText}</Tag>
                      <Button size="small" loading={obsScreenshotLoading} onClick={() => loadObsSourceScreenshot()}>
                        刷新画面
                      </Button>
                    </Space>
                  }
                >
                  <div className={`control-room-obs-monitor ${obsOutputConnected ? 'is-live' : 'is-waiting'}`}>
                    <div className="control-room-obs-screen">
                      {obsScreenshot?.imageData ? (
                        <img src={obsScreenshot.imageData} alt="OBS 当前输出画面" />
                      ) : (
                        <div className="control-room-obs-placeholder">
                          <span>{obsOutputConnected ? 'OBS LIVE' : 'WAITING'}</span>
                          <strong>{currentRoom.name || '当前直播间'}</strong>
                          <p>{obsScreenshotError || currentSpeech.text || '等待 OBS 返回当前画面'}</p>
                        </div>
                      )}
                      <div className="control-room-obs-badge">
                        <span>{obsOutputConnected ? 'OBS LIVE' : 'WAITING'}</span>
                        {obsScreenshotCapturedText ? <small>{obsScreenshotCapturedText}</small> : null}
                      </div>
                    </div>
                    <div className="control-room-obs-meta">
                      <div>
                        <span>输出页</span>
                        <strong>http://127.0.0.1:5173/obs/output</strong>
                      </div>
                      <div>
                        <span>LiveTalking 会话</span>
                        <strong>{obsOutputRuntime?.sessionId || '-'}</strong>
                      </div>
                      <div>
                        <span>输出形象</span>
                        <strong>{obsOutputRuntime?.avatarId || selectedDhRuntimeAvatarId || '-'}</strong>
                      </div>
                      <div>
                        <span>OBS 输出</span>
                        <strong>{studioOutput.resolution || '-'} / {studioOutput.fps || 0} FPS</strong>
                      </div>
                      <div>
                        <span>监看来源</span>
                        <strong>{obsScreenshot?.sourceName || '等待 OBS 截图'}</strong>
                      </div>
                    </div>
                  </div>
                  {obsScreenshotError ? (
                    <Alert
                      className="control-room-alert"
                      type="warning"
                      showIcon
                      message="OBS 当前画面读取失败"
                      description={obsScreenshotError}
                    />
                  ) : null}
                  {obsScreenshotNeedsPassword ? (
                    <Space.Compact className="control-room-obs-password">
                      <Input.Password
                        value={obsPasswordInput}
                        onChange={(event) => setObsPasswordInput(event.target.value)}
                        placeholder="粘贴 OBS WebSocket 密码后刷新画面"
                        autoComplete="new-password"
                      />
                      <Button
                        type="primary"
                        loading={obsScreenshotLoading}
                        disabled={!obsPasswordInput.trim()}
                        onClick={() => loadObsSourceScreenshot({ password: obsPasswordInput.trim() })}
                      >
                        用密码刷新
                      </Button>
                    </Space.Compact>
                  ) : null}
                  <Alert
                    className="control-room-alert"
                    type={obsOutputConnected ? 'success' : 'warning'}
                    showIcon
                    message={obsOutputConnected ? '当前播报会发送到 OBS 输出页' : '等待 OBS 浏览器源打开纯输出页'}
                    description={
                      obsOutputConnected
                        ? `OBS：${studioOutput.obsStatus || '已接入'}；执行端：${delayControl.executorStatus || '-'}；最后心跳：${studioOutput.lastHeartbeatAt || obsOutputRuntime?.updatedAt || '-'}`
                        : '请在 OBS 来源里使用“数字人直播画面”浏览器源，URL 指向 http://127.0.0.1:5173/obs/output。'
                    }
                  />
                </Card>

                <Card title="当前播报" className="panel-card control-room-panel" extra={<SpeechRiskTag level={currentSpeech.riskLevel} />}>
                  <Typography.Paragraph className="control-room-current-speech">
                    {currentSpeech.text || '暂无当前播报'}
                  </Typography.Paragraph>
                  <Descriptions bordered column={2} size="small">
                    <Descriptions.Item label="来源">{currentSpeech.source || '-'}</Descriptions.Item>
                    <Descriptions.Item label="动作">{currentSpeech.action || '-'}</Descriptions.Item>
                    <Descriptions.Item label="语气">{currentSpeech.tone || '-'}</Descriptions.Item>
                    <Descriptions.Item label="商品">{currentSpeech.productName || currentSpeech.relatedProduct || '-'}</Descriptions.Item>
                    <Descriptions.Item label="剩余">{currentSpeech.remainingSeconds || 0} 秒</Descriptions.Item>
                    <Descriptions.Item label="风险"><SpeechRiskTag level={currentSpeech.riskLevel} /></Descriptions.Item>
                  </Descriptions>
                </Card>

                <Card title="下一句字幕小预览" className="panel-card control-room-panel" extra={<SpeechRiskTag level={nextSpeech.riskLevel || nextSubtitle.riskLevel} />}>
                  <div className="control-room-next-subtitle">
                    <span>下一句</span>
                    <strong>{nextSubtitle.text || nextSpeech.text || '暂无下一句'}</strong>
                    <Space wrap size={6}>
                      <Tag color="blue">{nextSpeech.source || '本地队列'}</Tag>
                      <SpeechStatusTag status={nextSubtitle.status || nextSpeech.reviewStatus} />
                    </Space>
                  </div>
                </Card>
              </section>

              <section className="control-room-column">
                <Card
                  title="实时弹幕流"
                  className="panel-card control-room-panel"
                  extra={
                    <Space size={8}>
                      <Tooltip title={dhActive ? '开启后，新弹幕自动让数字人回复' : '请先开播数字人'}>
                        <Switch
                          checkedChildren="自动回复"
                          unCheckedChildren="自动回复"
                          checked={autoReply}
                          disabled={!dhActive}
                          onChange={setAutoReply}
                        />
                      </Tooltip>
                      <Button icon={<PlusCircleOutlined />} onClick={handleSimulateComment}>
                        模拟新弹幕
                      </Button>
                    </Space>
                  }
                >
                  <Space wrap size={8} className="control-room-filter-row">
                    {commentFilters.map((item) => (
                      <Button
                        size="small"
                        type={commentFilter === item.key ? 'primary' : 'default'}
                        onClick={() => setCommentFilter(item.key)}
                        key={item.key}
                      >
                        {item.label}
                      </Button>
                    ))}
                  </Space>
                  <div className="control-room-comment-stream">
                    {filteredComments.length ? (
                      filteredComments.map((item) => (
                        <div className={`control-room-comment-card ${isHighRisk(item.riskLevel) ? 'is-risk' : ''}`} key={item.id}>
                          <div className="control-room-comment-head">
                            <Space size={6} wrap>
                              <Typography.Text strong>{item.nickname}</Typography.Text>
                              <Tag color="blue">{item.platform}</Tag>
                              <CommentTypeTag type={item.type} />
                              <RiskTag level={item.riskLevel} />
                            </Space>
                            <span>{item.time}</span>
                          </div>
                          <p>{item.content}</p>
                          {item.aiReply ? (
                            <div className="control-room-ai-reply">数字人回复：{item.aiReply}</div>
                          ) : null}
                          <Space size={4} wrap>
                            <Button
                              type="link"
                              size="small"
                              loading={replyingId === item.id}
                              onClick={() => handleAiReplyAndSpeak(item)}
                            >
                              AI回复并播报
                            </Button>
                            <Button type="link" size="small" onClick={() => { updateCommentStatus(item.id, '已加入队列'); message.success('已加入问题队列'); }}>
                              加入问题队列
                            </Button>
                            <Button type="link" size="small" onClick={() => { updateCommentStatus(item.id, '已忽略'); message.info('已忽略该弹幕'); }}>
                              忽略
                            </Button>
                          </Space>
                        </div>
                      ))
                    ) : (
                      <Empty description="暂无符合条件的弹幕" />
                    )}
                  </div>
                </Card>

                <Card title="问题处理" className="panel-card control-room-panel">
                  <List
                    className="control-room-question-list"
                    dataSource={pendingQuestions}
                    locale={{ emptyText: <Empty description="暂无待处理问题" /> }}
                    renderItem={(item) => (
                      <List.Item
                        actions={[
                          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleOpenQuestionEdit(item)} key="edit">编辑回复</Button>,
                          <Button
                            type="link"
                            size="small"
                            loading={questionQueueingId === item.id}
                            onClick={() => handleAddQuestionToQueue(item)}
                            key="queue"
                          >
                            加入待播
                          </Button>,
                          <Button type="link" size="small" onClick={() => fillReply(getAiReply(item))} key="manual">转人工</Button>,
                          <Button type="link" size="small" onClick={() => handleIgnoreQuestion(item)} key="ignore">忽略</Button>,
                        ]}
                      >
                        <List.Item.Meta
                          title={
                            <Space wrap size={6}>
                              <span>{item.question}</span>
                              <CommentTypeTag type={item.type} />
                              <RiskTag level={item.riskLevel} />
                            </Space>
                          }
                          description={
                            <div>
                              <div className="table-subtext">来源用户：{item.nickname}；关联商品：{item.relatedProduct || item.productName}</div>
                              <div className="control-room-ai-reply">{getAiReply(item)}</div>
                            </div>
                          }
                        />
                      </List.Item>
                    )}
                  />
                </Card>
              </section>

              <section className="control-room-column control-room-right-sticky">
                <Card title="人工接管" className="panel-card control-room-panel">
                  <Input.TextArea
                    rows={4}
                    value={speechText}
                    onChange={(event) => setSpeechText(event.target.value)}
                    placeholder="输入人工接管话术，可入队、直发执行端或发送本机数字人"
                  />
                  <div className="control-room-form-grid">
                    <Select value={tone} onChange={setTone} options={takeoverTones.map((item) => ({ label: item, value: item }))} />
                    <Select value={action} onChange={setAction} options={takeoverActions.map((item) => ({ label: item, value: item }))} />
                    <Select value={broadcastMode} onChange={setBroadcastMode} options={broadcastModes.map((item) => ({ label: item, value: item }))} />
                  </div>
                  <Space wrap>
                    <Button
                      icon={<SendOutlined />}
                      loading={manualSubmittingMode === 'queue'}
                      disabled={!speechText.trim()}
                      onClick={handleEnqueueManualSpeech}
                    >
                      加入待播队列
                    </Button>
                    <Tooltip title={executorReady ? '不进待播队列，直接创建 speak 命令给绑定执行端；不等于左侧本机数字人播报' : dispatchBlockedReason}>
                      <Button
                        type="primary"
                        icon={<ThunderboltOutlined />}
                        loading={manualSubmittingMode === 'direct'}
                        disabled={!speechText.trim() || !executorReady}
                        onClick={handleDirectManualSpeech}
                      >
                        直发执行端
                      </Button>
                    </Tooltip>
                    <Tooltip title={dhActive ? `发送到 ${dhProvider} / ${dhVoiceEngine} / ${dhCloneMode}` : '请先开启本机数字人会话'}>
                      <Button
                        icon={<ThunderboltOutlined />}
                        loading={manualSubmittingMode === 'local-dh'}
                        disabled={!speechText.trim() || !dhActive || !canSpeakToDigitalHuman}
                        onClick={handleLocalDigitalHumanSpeech}
                      >
                        本机数字人播报
                      </Button>
                    </Tooltip>
                    <Button onClick={() => handleBroadcast('仅生成建议')}>仅生成建议</Button>
                  </Space>
                  {!executorReady ? <Alert className="control-room-alert" type="warning" showIcon message={dispatchBlockedReason} /> : null}
                  {suggestion ? <Alert className="control-room-alert" type="info" showIcon message={suggestion} /> : null}
                  {lastSpeakCommand?.commandId ? (
                    <Alert
                      className="control-room-alert"
                      type={['failed', 'timeout', 'expired'].includes(lastSpeakCommand.status) ? 'error' : isFinalCommandStatus(lastSpeakCommand.status) ? 'success' : 'info'}
                      showIcon
                      message={
                        <Space wrap size={6}>
                          <span>最新 speak 命令</span>
                          <Tag color={getCommandStatusColor(lastSpeakCommand.status)}>
                            {lastSpeakCommand.status || 'pending'}
                          </Tag>
                          {commandPolling && !isFinalCommandStatus(lastSpeakCommand.status) ? <Tag color="blue">polling</Tag> : null}
                        </Space>
                      }
                      description={
                        <Descriptions column={1} size="small" className="control-room-compact-desc">
                          <Descriptions.Item label="Command">{lastSpeakCommand.commandId}</Descriptions.Item>
                          <Descriptions.Item label="Trace">{lastSpeakCommand.traceId || '-'}</Descriptions.Item>
                          <Descriptions.Item label="Executor">{lastSpeakCommand.executor?.name || lastSpeakCommand.executorId || '-'}</Descriptions.Item>
                          <Descriptions.Item label="Message">{lastSpeakCommand.resultMessage || lastSpeakCommand.ackPayload?.resultMessage || '-'}</Descriptions.Item>
                          <Descriptions.Item label="Adapter">{lastSpeakCommand.ackPayload?.detail?.adapter || '-'}</Descriptions.Item>
                        </Descriptions>
                      }
                    />
                  ) : null}
                  <Divider />
                  <List
                    size="small"
                    header="推荐回复一键填入"
                    dataSource={manualTakeover.recommendedReplies || []}
                    locale={{ emptyText: <Empty description="暂无推荐回复" /> }}
                    renderItem={(item) => (
                      <List.Item actions={[<Button type="link" size="small" onClick={() => fillReply(item)} key="fill">填入</Button>]}>
                        <Typography.Text>{item}</Typography.Text>
                      </List.Item>
                    )}
                  />
                </Card>

                <Card
                  title="固定播控区"
                  className="panel-card control-room-panel"
                  extra={
                    <Space wrap size={6}>
                      <Button size="small" onClick={() => loadBroadcastQueue(currentTask.id)} loading={queueLoading}>
                        刷新
                      </Button>
                      <Tooltip title={dispatchBlockedReason || '按计划顺序下发下一条已审核话术'}>
                        <Button
                          type="primary"
                          size="small"
                          icon={<SendOutlined />}
                          loading={dispatchingId === '__next__'}
                          disabled={Boolean(dispatchBlockedReason)}
                          onClick={handleDispatchNextSpeech}
                        >
                          下发下一条
                        </Button>
                      </Tooltip>
                    </Space>
                  }
                >
                  {queueError ? <Alert className="control-room-alert" type="error" showIcon message={queueError} /> : null}
                  {!queueError && dispatchBlockedReason ? (
                    <Alert className="control-room-alert" type="warning" showIcon message={dispatchBlockedReason} />
                  ) : null}

                  <Spin spinning={queueLoading}>
                    <Descriptions column={1} size="small" className="control-room-compact-desc">
                      <Descriptions.Item label="直播任务">{currentTask.taskName || currentTask.id || '-'}</Descriptions.Item>
                      <Descriptions.Item label="绑定执行端">
                        {currentTask.executorName || currentTask.executorId || '-'} / {executorStatusText || '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label="可下发数量">{dispatchableSpeechCount}</Descriptions.Item>
                    </Descriptions>

                    <Timeline
                      className="control-room-speech-timeline"
                      items={[
                        {
                          color: dispatchingSpeech ? 'green' : 'gray',
                          children: (
                            <div className="control-room-queue-item is-current">
                              <Space wrap>
                                <strong>当前下发中</strong>
                                <SpeechStatusTag status={dispatchingSpeech?.broadcastStatus || currentSpeech.broadcastStatus || '下发中'} />
                                <SpeechRiskTag level={dispatchingSpeech?.riskLevel || currentSpeech.riskLevel} />
                              </Space>
                              <p>{dispatchingSpeech?.text || currentSpeech.text || '暂无下发中的播报'}</p>
                              {dispatchingSpeech?.executorCommandId ? <div className="table-subtext">命令：{dispatchingSpeech.executorCommandId}</div> : null}
                            </div>
                          ),
                        },
                        {
                          color: nextDispatchableSpeech ? 'blue' : 'gray',
                          children: (
                            <div className="control-room-queue-item">
                              <Space wrap size={6}>
                                <strong>下一条待下发</strong>
                                <SpeechStatusTag status={nextDispatchableSpeech?.broadcastStatus || '待下发'} />
                                <SpeechRiskTag level={nextDispatchableSpeech?.riskLevel} />
                              </Space>
                              <p>{nextDispatchableSpeech?.text || '暂无已审核且待下发的话术'}</p>
                              {nextDispatchableSpeech ? (
                                <Space size={4} wrap>
                                  <Tooltip title={executorReady ? '下发为 speak 命令，等待执行端 PrintAdapter 回执' : dispatchBlockedReason}>
                                    <Button
                                      size="small"
                                      type="primary"
                                      icon={<SendOutlined />}
                                      loading={dispatchingId === nextDispatchableSpeech.id}
                                      disabled={!executorReady || !canDispatchSpeech(nextDispatchableSpeech)}
                                      onClick={() => handleDispatchSpeech(nextDispatchableSpeech)}
                                    >
                                      下发播报
                                    </Button>
                                  </Tooltip>
                                  <Button size="small" icon={<EditOutlined />} onClick={() => handleOpenSpeechEdit(nextDispatchableSpeech)}>修改</Button>
                                </Space>
                              ) : null}
                            </div>
                          ),
                        },
                        ...activeQueue
                          .filter((item) => item.id !== dispatchingSpeech?.id && item.id !== nextDispatchableSpeech?.id)
                          .slice(0, 4)
                          .map((item, index) => ({
                            color: isHighRisk(item.riskLevel) ? 'red' : canDispatchSpeech(item) ? 'blue' : 'gray',
                            children: (
                              <div className="control-room-queue-item">
                                <Space wrap size={6}>
                                  <strong>{`后续第 ${index + 1} 句`}</strong>
                                  <SpeechStatusTag status={item.broadcastStatus || item.reviewStatus} />
                                  <SpeechRiskTag level={item.riskLevel} />
                                </Space>
                                <p>{item.text}</p>
                                {item.executorCommandId ? <div className="table-subtext">命令：{item.executorCommandId}</div> : null}
                                {item.broadcastErrorMessage ? <div className="table-subtext">失败原因：{item.broadcastErrorMessage}</div> : null}
                                <Space size={4} wrap>
                                  <Tooltip title={canDispatchSpeech(item) && executorReady ? '下发为 speak 命令' : '仅已审核且待下发/失败的话术可下发'}>
                                    <Button
                                      size="small"
                                      icon={<SendOutlined />}
                                      loading={dispatchingId === item.id}
                                      disabled={!executorReady || !canDispatchSpeech(item)}
                                      onClick={() => handleDispatchSpeech(item)}
                                    >
                                      下发播报
                                    </Button>
                                  </Tooltip>
                                  <Tooltip title="写入本地 API 状态">
                                    <Button size="small" icon={<CheckOutlined />} onClick={() => handleSpeechOperation(item, 'approve')}>通过</Button>
                                  </Tooltip>
                                  <Button size="small" icon={<EditOutlined />} onClick={() => handleOpenSpeechEdit(item)}>修改</Button>
                                  <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleSpeechOperation(item, 'delete')}>删除</Button>
                                  <Button size="small" icon={<ThunderboltOutlined />} onClick={() => handleSpeechOperation(item, 'insert')}>插队</Button>
                                  <Button size="small" icon={<WarningOutlined />} onClick={() => handleSpeechOperation(item, 'markRisk')}>高风险</Button>
                                </Space>
                              </div>
                            ),
                          })),
                      ]}
                    />

                    {activeQueue.length ? null : <Empty description="暂无待播队列数据" />}

                    <Divider />
                    <List
                      size="small"
                      header="最近已播报"
                      dataSource={recentBroadcastedSpeech}
                      locale={{ emptyText: <Empty description="暂无已播报回执" /> }}
                      renderItem={(item) => (
                        <List.Item>
                          <List.Item.Meta
                            title={
                              <Space wrap size={6}>
                                <SpeechStatusTag status={item.broadcastStatus || '已播报'} />
                                <span>{item.text}</span>
                              </Space>
                            }
                            description={item.executorCommandId ? `命令：${item.executorCommandId}` : item.broadcastFinishedAt || item.updatedAt}
                          />
                        </List.Item>
                      )}
                    />
                  </Spin>
                </Card>

                <Card title="字幕小预览" className="panel-card control-room-panel">
                  <div className={`control-room-mini-subtitle subtitle-position-${subtitleStyle.position || 'bottom'}`}>
                    <div className="mini-subtitle-current">{currentSubtitle.text || currentSpeech.text || '当前字幕'}</div>
                    <div className="mini-subtitle-next">{nextSubtitle.text || nextSpeech.text || '下一句字幕'}</div>
                  </div>
                  <Space wrap size={6} className="control-room-mini-meta">
                    <Tag color="blue">位置：{subtitleStyle.position || '-'}</Tag>
                    <SpeechRiskTag level={nextSubtitle.riskLevel || nextSpeech.riskLevel} />
                    <SpeechStatusTag status={nextSubtitle.status || nextSpeech.reviewStatus} />
                  </Space>
                </Card>

                <Card title="风险提示" className="panel-card control-room-panel">
                  <List
                    size="small"
                    dataSource={[...(delaySettings.riskRules || []), ...(manualTakeover.riskWarnings || [])]}
                    locale={{ emptyText: <Empty description="暂无风险提示" /> }}
                    renderItem={(item) => (
                      <List.Item>
                        <List.Item.Meta
                          avatar={<ExclamationCircleOutlined className={isHighRisk(item.level) ? 'risk-icon-high' : 'risk-icon-mid'} />}
                          title={
                            <Space wrap>
                              <span>{item.name || item.type}</span>
                              <RiskTag level={item.level} />
                            </Space>
                          }
                          description={item.description || item.content}
                        />
                      </List.Item>
                    )}
                  />
                </Card>
              </section>
            </div>
          </>
        ) : null}
      </Spin>

      <Modal
        title="本机形象素材登记"
        open={avatarRuntimeModalOpen}
        onCancel={() => setAvatarRuntimeModalOpen(false)}
        onOk={handleSaveAvatarRuntime}
        okText="保存配置"
        confirmLoading={avatarRuntimeSaving}
        width={720}
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Alert
            type="info"
            showIcon
            message={selectedDhAvatar ? `登记对象：${selectedDhAvatar.name}` : '请先选择数字人'}
            description="填写本机源视频路径后，可直接创建 LiveTalking avatar 预处理任务；完成后会写回当前数字人的开播形象配置。"
          />
          {avatarRuntimeDraft.preprocessTaskId ? (
            <Descriptions size="small" column={1} bordered>
              <Descriptions.Item label="任务 ID">{avatarRuntimeDraft.preprocessTaskId}</Descriptions.Item>
              <Descriptions.Item label="任务状态">
                <Space wrap>
                  <Tag color={avatarRuntimeDraft.status === 'ready' ? 'green' : avatarRuntimeDraft.status === 'failed' ? 'red' : 'blue'}>
                    {getAvatarRuntimeStatusLabel(avatarRuntimeDraft.status)}
                  </Tag>
                  <span>{avatarRuntimeDraft.preprocessProgress || 0}%</span>
                </Space>
              </Descriptions.Item>
              {avatarRuntimeDraft.preprocessError ? (
                <Descriptions.Item label="错误">{avatarRuntimeDraft.preprocessError}</Descriptions.Item>
              ) : null}
            </Descriptions>
          ) : null}
          <Input
            value={avatarRuntimeDraft.livetalkingAvatarId}
            onChange={(event) => updateAvatarRuntimeDraft('livetalkingAvatarId', event.target.value)}
            placeholder="LiveTalking avatar id，例如 codex_user_wav2lip_12s"
          />
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            <Space wrap style={{ width: '100%' }}>
              <Select
                showSearch
                allowClear
                loading={avatarSourceVideosLoading}
                value={avatarRuntimeDraft.sourceVideoPath || undefined}
                placeholder="从源视频素材箱选择"
                optionFilterProp="label"
                style={{ minWidth: 340, flex: 1 }}
                options={avatarSourceVideos.map((item) => ({
                  label: `${item.fileName} · ${formatFileSize(item.size)}`,
                  value: item.filePath,
                }))}
                onChange={(value) => updateAvatarRuntimeDraft('sourceVideoPath', value || '')}
              />
              <Button
                icon={<FolderOpenOutlined />}
                loading={avatarSourceVideosLoading}
                onClick={() => loadAvatarSourceVideos()}
              >
                扫描文件夹
              </Button>
              <Upload
                accept="video/mp4,video/webm,video/quicktime,video/x-matroska,video/x-msvideo"
                showUploadList={false}
                beforeUpload={handleUploadAvatarSourceVideo}
              >
                <Button icon={<UploadOutlined />} loading={avatarSourceUploading}>
                  上传源视频
                </Button>
              </Upload>
            </Space>
            <Input
              value={avatarRuntimeDraft.sourceVideoPath}
              onChange={(event) => updateAvatarRuntimeDraft('sourceVideoPath', event.target.value)}
              placeholder="源视频路径，例如 F:\\漫剧\\your_avatar.mp4"
            />
            <Typography.Text type="secondary">
              素材箱：{avatarSourceFolder || 'server/uploads/avatar_sources'}
            </Typography.Text>
          </Space>
          <Input
            value={avatarRuntimeDraft.preprocessedPath}
            onChange={(event) => updateAvatarRuntimeDraft('preprocessedPath', event.target.value)}
            placeholder="预处理输出目录或备注，例如 data/avatars/codex_user_wav2lip_12s"
          />
          <Space wrap>
            <Select
              value={avatarRuntimeDraft.modelRoute}
              options={avatarRuntimeModelOptions}
              onChange={(value) => updateAvatarRuntimeDraft('modelRoute', value)}
              style={{ width: 180 }}
            />
            <Select
              value={avatarRuntimeDraft.resolution}
              options={avatarRuntimeResolutionOptions}
              onChange={(value) => updateAvatarRuntimeDraft('resolution', value)}
              style={{ width: 150 }}
            />
            <Select
              value={avatarRuntimeDraft.status}
              options={avatarRuntimeStatusOptions}
              onChange={(value) => updateAvatarRuntimeDraft('status', value)}
              style={{ width: 140 }}
            />
          </Space>
          <Space wrap>
            <Button
              type="primary"
              icon={<ThunderboltOutlined />}
              loading={avatarPreprocessBusy}
              disabled={!selectedDhAvatar || !avatarRuntimeDraft.sourceVideoPath.trim()}
              onClick={handleStartAvatarPreprocess}
            >
              一键预处理
            </Button>
            <Button
              loading={avatarPreprocessPolling}
              disabled={!avatarRuntimeDraft.preprocessTaskId}
              onClick={() => handleRefreshAvatarPreprocess()}
            >
              刷新任务状态
            </Button>
          </Space>
          <Input.TextArea
            rows={3}
            value={avatarRuntimeDraft.note}
            onChange={(event) => updateAvatarRuntimeDraft('note', event.target.value)}
            placeholder="备注：素材时长、清晰度、是否需要重新预处理等"
          />
        </Space>
      </Modal>

      <Modal
        title="编辑 AI 推荐回复"
        open={Boolean(editingQuestion)}
        onCancel={() => setEditingQuestion(null)}
        onOk={handleSaveQuestionEdit}
        okText="保存回复"
      >
        <Input.TextArea rows={6} value={editingReply} onChange={(event) => setEditingReply(event.target.value)} />
      </Modal>

      <Modal
        title="修改待播话术"
        open={Boolean(editingSpeech)}
        onCancel={() => setEditingSpeech(null)}
        onOk={handleSaveSpeechEdit}
        okText="保存修改"
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Input.TextArea
            rows={5}
            value={speechDraft.text}
            onChange={(event) => setSpeechDraft((item) => ({ ...item, text: event.target.value }))}
          />
          <Select
            value={speechDraft.action}
            onChange={(value) => setSpeechDraft((item) => ({ ...item, action: value }))}
            options={speechActions.map((item) => ({ label: item, value: item }))}
            style={{ width: '100%' }}
          />
          <Select
            value={speechDraft.tone}
            onChange={(value) => setSpeechDraft((item) => ({ ...item, tone: value }))}
            options={speechTones.map((item) => ({ label: item, value: item }))}
            style={{ width: '100%' }}
          />
        </Space>
      </Modal>
    </>
  );
}
