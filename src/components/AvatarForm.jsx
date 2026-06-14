import {
  FolderOpenOutlined,
  InboxOutlined,
  ReloadOutlined,
  SaveOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import {
  Alert,
  AutoComplete,
  Button,
  Card,
  Checkbox,
  Descriptions,
  Empty,
  Form,
  Input,
  Select,
  Slider,
  Space,
  Steps,
  Tabs,
  Tag,
  Typography,
  Upload,
  message,
} from 'antd';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  createAvatar,
  getAvatarActions,
  getAvatarCategories,
  getAvatarPreprocessTask,
  getAvatarSourceVideos,
  getVoiceOptions,
  startAvatarPreprocess,
  updateAvatar,
} from '../services/avatarService';
import { getLiveSessionEngines } from '../services/liveSessionService';
import {
  resolveFileUrl,
  toFileAsset,
  uploadAvatarAsset,
  uploadAvatarAuthorization,
  uploadAvatarSourceVideo,
} from '../services/fileService';

const { TextArea } = Input;
const avatarCategories = getAvatarCategories();
const voiceOptions = getVoiceOptions();

const imageTemplates = ['海岛蓝衬衫', '职场白衬衫', '客服蓝外套', '导购西装', '直播红外套', '默认模板'];
const imageStyles = ['真实主播', '半写实', '写实', '测试模板'];
const outfitStyles = ['清爽休闲', '商务休闲', '客服制服', '商务正装', '促销主播', '基础服装'];
const expressionStyles = ['微笑', '开朗', '亲和', '稳重', '惊喜', '中性'];
const languageStyles = ['亲切自然', '热情直接', '温柔耐心', '专业清晰', '热情促单', '测试口吻'];
const emotions = ['亲切', '热情', '温柔', '专业', '兴奋', '平静'];
const rhythms = ['自然停顿', '紧凑', '慢速停顿', '清晰停顿', '快节奏', '标准'];
const authStatuses = ['已授权', '待确认', '未授权', '已确认', '未确认'];
const imageAccept = 'image/png,image/jpeg,image/webp,image/gif';
const videoAccept = 'video/mp4,video/webm,video/quicktime,video/x-matroska,video/x-msvideo';
const audioAccept = 'audio/mpeg,audio/mp4,audio/aac,audio/wav,audio/x-wav,audio/webm,audio/x-m4a';
const documentAccept = 'application/pdf,text/plain,image/png,image/jpeg,image/webp,image/gif';
const runtimeModelOptions = [
  { label: 'wav2lip 实时低延迟', value: 'wav2lip' },
  { label: 'musetalk 高清口型', value: 'musetalk' },
];
const runtimeResolutionOptions = [
  { label: '720p 高码率', value: '720p' },
  { label: '1080p 高码率', value: '1080p' },
];
const runtimeStatusOptions = [
  { label: '已预处理', value: 'ready' },
  { label: '预处理中', value: 'preprocessing' },
  { label: '待预处理', value: 'pending' },
  { label: '预处理失败', value: 'failed' },
  { label: '不可用', value: 'disabled' },
];
const fallbackEngineConfig = {
  providers: [{ label: '本机 LiveTalking', value: 'livetalking' }],
  voiceEngines: [
    { label: 'VoxCPM2', value: 'voxcpm2' },
    { label: 'GPT-SoVITS', value: 'gpt-sovits' },
  ],
  cloneModes: [
    { label: '普通克隆', value: 'reference' },
    { label: 'Hi-Fi 深度克隆', value: 'hifi' },
  ],
  defaultProvider: 'livetalking',
  defaultVoiceEngine: 'voxcpm2',
  defaultCloneMode: 'hifi',
};

function normalizeUploadEvent(event) {
  return Array.isArray(event) ? event : event?.fileList;
}

function assetToUploadList(asset) {
  if (!asset || typeof asset === 'string') {
    return [];
  }

  if (Array.isArray(asset)) {
    return asset;
  }

  const fileAsset = toFileAsset(asset);

  if (!fileAsset?.fileName && !fileAsset?.fileUrl) {
    return [];
  }

  return [
    {
      uid: fileAsset.fileId || fileAsset.fileUrl || fileAsset.fileName,
      name: fileAsset.fileName || 'uploaded-file',
      status: 'done',
      url: fileAsset.fileUrl ? resolveFileUrl(fileAsset.fileUrl) : undefined,
      response: { file: fileAsset },
    },
  ];
}

function uploadValueToAsset(value) {
  const uploadItem = Array.isArray(value) ? value[0] : value;

  if (!uploadItem) {
    return undefined;
  }

  return toFileAsset(uploadItem) || undefined;
}

function UploadedAssetInfo({ name }) {
  return (
    <Form.Item shouldUpdate noStyle>
      {({ getFieldValue }) => {
        const asset = uploadValueToAsset(getFieldValue(name));

        if (!asset?.fileName) {
          return null;
        }

        return (
          <Descriptions className="uploaded-file-info" size="small" column={1} bordered>
            <Descriptions.Item label="文件名">{asset.fileName}</Descriptions.Item>
            <Descriptions.Item label="文件类型">{asset.fileType || asset.mimeType || '-'}</Descriptions.Item>
            <Descriptions.Item label="上传时间">{asset.uploadedAt || '-'}</Descriptions.Item>
            <Descriptions.Item label="文件地址">
              {asset.fileUrl ? (
                <a href={resolveFileUrl(asset.fileUrl)} target="_blank" rel="noreferrer">
                  打开文件
                </a>
              ) : (
                '-'
              )}
            </Descriptions.Item>
            {asset.localPath ? <Descriptions.Item label="本机路径">{asset.localPath}</Descriptions.Item> : null}
          </Descriptions>
        );
      }}
    </Form.Item>
  );
}

function formatFileSize(bytes = 0) {
  const value = Number(bytes || 0);
  if (!Number.isFinite(value) || value <= 0) return '0B';
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)}KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)}MB`;
  return `${(value / 1024 / 1024 / 1024).toFixed(2)}GB`;
}

function getRuntimeStatusLabel(status) {
  return runtimeStatusOptions.find((item) => item.value === status)?.label || '未登记';
}

function getRuntimeStatusColor(status) {
  if (status === 'ready') return 'green';
  if (status === 'failed' || status === 'disabled') return 'red';
  if (status === 'preprocessing') return 'blue';
  return 'default';
}

function getRuntimeFromValues(values = {}) {
  return values.imageSettings?.liveRuntime || {};
}

function uploadDragger({ label, hint, accept, customRequest }) {
  return (
    <Upload.Dragger customRequest={customRequest} maxCount={1} accept={accept}>
      <p className="ant-upload-drag-icon">
        <InboxOutlined />
      </p>
      <p className="ant-upload-text">{label}</p>
      <p className="ant-upload-hint">{hint}</p>
    </Upload.Dragger>
  );
}

export function mapAvatarToFormValues(avatar) {
  if (!avatar) {
    return undefined;
  }

  const runtime = avatar.imageSettings?.liveRuntime || {};
  const voiceSettings = avatar.voiceSettings || {};

  return {
    name: avatar.name,
    persona: avatar.persona,
    suitableCategories: avatar.suitableCategories,
    languageStyle: avatar.languageStyle,
    forbiddenScenes: ['医疗诊断', '承诺收益'],
    remark: 'Mock 编辑备注，后续可接入真实审核流。',
    imageSettings: {
      ...avatar.imageSettings,
      liveRuntime: {
        provider: 'livetalking',
        modelRoute: 'wav2lip',
        resolution: '720p',
        status: runtime.livetalkingAvatarId ? 'ready' : 'pending',
        ...runtime,
        sourceVideoPath: runtime.sourceVideoPath || avatar.trainingAssets?.sourceVideoPath || '',
      },
      photo: assetToUploadList(avatar.imageSettings?.photo),
      videoMaterial: assetToUploadList(avatar.imageSettings?.videoMaterial),
      audioMaterial: assetToUploadList(avatar.imageSettings?.audioMaterial),
    },
    voiceSettings: {
      ...voiceSettings,
      provider: voiceSettings.provider || 'livetalking',
      engine: voiceSettings.engine || voiceSettings.voiceEngine || 'voxcpm2',
      voiceEngine: voiceSettings.voiceEngine || voiceSettings.engine || 'voxcpm2',
      cloneMode: voiceSettings.cloneMode || 'hifi',
      voiceName: avatar.voiceName || voiceSettings.voiceName,
      sample: assetToUploadList(voiceSettings.sample),
    },
    behaviorRules: avatar.behaviorRules,
    preview: {
      script: `大家好，我是${avatar.name}，今天先用 Mock 预览检查播报效果。`,
      action: '轻微点头',
      tone: avatar.voiceSettings.emotion,
      result: 'Mock 预览结果：等待点击预览按钮。',
    },
    trainingAssets: {
      ...avatar.trainingAssets,
      videoFile: assetToUploadList(avatar.trainingAssets?.videoFile),
      audioFile: assetToUploadList(avatar.trainingAssets?.audioFile),
      imageFile: assetToUploadList(avatar.trainingAssets?.imageFile),
    },
    authorizationStatus: {
      ...avatar.authorizationStatus,
      portraitFile: assetToUploadList(avatar.authorizationStatus?.portraitFile),
      voiceFile: assetToUploadList(avatar.authorizationStatus?.voiceFile),
      commercialFile: assetToUploadList(avatar.authorizationStatus?.commercialFile),
    },
  };
}

function normalizeAvatarUploadFields(values) {
  const imageSettings = { ...(values.imageSettings || {}) };
  imageSettings.photo = uploadValueToAsset(imageSettings.photo);
  imageSettings.videoMaterial = uploadValueToAsset(imageSettings.videoMaterial);
  imageSettings.audioMaterial = uploadValueToAsset(imageSettings.audioMaterial);

  const voiceSettings = { ...(values.voiceSettings || {}) };
  voiceSettings.sample = uploadValueToAsset(voiceSettings.sample);

  const trainingAssets = { ...(values.trainingAssets || {}) };
  trainingAssets.videoFile = uploadValueToAsset(trainingAssets.videoFile);
  trainingAssets.audioFile = uploadValueToAsset(trainingAssets.audioFile);
  trainingAssets.imageFile = uploadValueToAsset(trainingAssets.imageFile);

  const authorizationStatus = { ...(values.authorizationStatus || {}) };
  authorizationStatus.portraitFile = uploadValueToAsset(authorizationStatus.portraitFile);
  authorizationStatus.voiceFile = uploadValueToAsset(authorizationStatus.voiceFile);
  authorizationStatus.commercialFile = uploadValueToAsset(authorizationStatus.commercialFile);

  return {
    ...values,
    imageSettings,
    voiceSettings,
    trainingAssets,
    authorizationStatus,
  };
}

function buildAvatarPayload(values, status) {
  const normalizedValues = normalizeAvatarUploadFields(values);
  const imageSettings = { ...(normalizedValues.imageSettings || {}) };
  const trainingAssets = { ...(normalizedValues.trainingAssets || {}) };
  const voiceSettings = { ...(normalizedValues.voiceSettings || {}) };
  const liveRuntime = {
    provider: 'livetalking',
    modelRoute: 'wav2lip',
    resolution: '720p',
    status: 'pending',
    ...(imageSettings.liveRuntime || {}),
  };
  const sourceVideoPath = liveRuntime.sourceVideoPath || trainingAssets.sourceVideoPath || trainingAssets.videoFile?.localPath || '';

  if (sourceVideoPath) {
    liveRuntime.sourceVideoPath = sourceVideoPath;
    trainingAssets.sourceVideoPath = sourceVideoPath;
  }

  voiceSettings.voiceEngine = voiceSettings.engine || voiceSettings.voiceEngine || 'voxcpm2';
  voiceSettings.engine = voiceSettings.voiceEngine;
  voiceSettings.cloneMode = voiceSettings.cloneMode || 'hifi';
  voiceSettings.provider = voiceSettings.provider || 'livetalking';
  voiceSettings.voiceName = String(voiceSettings.voiceName || '').trim();
  imageSettings.liveRuntime = liveRuntime;

  return {
    name: normalizedValues.name,
    persona: normalizedValues.persona,
    suitableCategories: normalizedValues.suitableCategories || [],
    languageStyle: normalizedValues.languageStyle || '',
    avatarImage: imageSettings.photo?.fileUrl || imageSettings.template || 'api-avatar',
    voiceName: voiceSettings.voiceName || voiceSettings.voiceEngine || '',
    status,
    behaviorRules: normalizedValues.behaviorRules || {},
    voiceSettings,
    imageSettings,
    trainingAssets,
    authorizationStatus: normalizedValues.authorizationStatus || {},
  };
}

export default function AvatarForm({ mode = 'create', avatarId, initialValues, avatarName }) {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isEdit = mode === 'edit';
  const [avatarActions, setAvatarActions] = useState([]);
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'base');
  const [engineConfig, setEngineConfig] = useState(fallbackEngineConfig);
  const [engineLoading, setEngineLoading] = useState(false);
  const [sourceVideos, setSourceVideos] = useState([]);
  const [sourceFolder, setSourceFolder] = useState('');
  const [sourceVideosLoading, setSourceVideosLoading] = useState(false);
  const [sourceUploading, setSourceUploading] = useState(false);
  const [preprocessBusy, setPreprocessBusy] = useState(false);
  const [preprocessPolling, setPreprocessPolling] = useState(false);

  useEffect(() => {
    async function fetchActions() {
      try {
        const data = await getAvatarActions({ pageSize: 100 });
        setAvatarActions(data.list || []);
      } catch (error) {
        message.error(error.message || '动作库加载失败');
      }
    }

    fetchActions();
  }, []);

  useEffect(() => {
    setActiveTab(searchParams.get('tab') || 'base');
  }, [searchParams]);

  useEffect(() => {
    async function fetchEngineConfig() {
      try {
        setEngineLoading(true);
        const data = await getLiveSessionEngines({ provider: 'livetalking' });
        setEngineConfig({
          ...fallbackEngineConfig,
          ...data,
          providers: data.providers?.length ? data.providers : fallbackEngineConfig.providers,
          voiceEngines: data.voiceEngines?.length ? data.voiceEngines : fallbackEngineConfig.voiceEngines,
          cloneModes: data.cloneModes?.length ? data.cloneModes : fallbackEngineConfig.cloneModes,
        });
      } catch (error) {
        message.warning(error.message || '本机数字人引擎状态读取失败，已使用默认配置');
      } finally {
        setEngineLoading(false);
      }
    }

    fetchEngineConfig();
  }, []);

  async function loadSourceVideos(options = {}) {
    try {
      setSourceVideosLoading(true);
      const data = await getAvatarSourceVideos();
      setSourceVideos(data.files || []);
      setSourceFolder(data.folderPath || '');

      if (!options.silent) {
        message.success(`已扫描源视频素材箱：${data.files?.length || 0} 个视频`);
      }
    } catch (error) {
      if (!options.silent) {
        message.error(error.message || '源视频素材箱扫描失败');
      }
    } finally {
      setSourceVideosLoading(false);
    }
  }

  useEffect(() => {
    loadSourceVideos({ silent: true });
  }, []);

  const setRuntimeFields = (runtimePatch = {}) => {
    const imageSettings = form.getFieldValue('imageSettings') || {};
    const trainingAssets = form.getFieldValue('trainingAssets') || {};
    const currentRuntime = imageSettings.liveRuntime || {};
    const nextRuntime = {
      provider: 'livetalking',
      modelRoute: 'wav2lip',
      resolution: '720p',
      status: 'pending',
      ...currentRuntime,
      ...runtimePatch,
    };

    form.setFieldsValue({
      imageSettings: {
        ...imageSettings,
        liveRuntime: nextRuntime,
      },
      trainingAssets: {
        ...trainingAssets,
        sourceVideoPath: nextRuntime.sourceVideoPath || trainingAssets.sourceVideoPath || '',
      },
    });
  };

  const handleSourceVideoUpload =
    () =>
    async ({ file, onSuccess, onError }) => {
      try {
        setSourceUploading(true);
        const uploadedFile = await uploadAvatarSourceVideo(file, {
          businessId: avatarId || 'new-avatar',
        });

        setRuntimeFields({ sourceVideoPath: uploadedFile.localPath || '' });
        await loadSourceVideos({ silent: true });
        message.success('源视频已保存到数字人素材箱');
        onSuccess({ file: uploadedFile });
      } catch (error) {
        message.error(error.message || '源视频上传失败');
        onError(error);
      } finally {
        setSourceUploading(false);
      }
    };

  const handleStartAvatarPreprocess = async () => {
    if (!isEdit || !avatarId) {
      message.warning('请先保存数字人，再进入编辑页创建本机形象预处理任务');
      return;
    }

    const values = form.getFieldsValue(true);
    const runtime = getRuntimeFromValues(values);
    const sourceVideoPath = runtime.sourceVideoPath || values.trainingAssets?.sourceVideoPath || '';

    if (!sourceVideoPath.trim()) {
      message.warning('请先上传或选择一个源视频');
      return;
    }

    try {
      setPreprocessBusy(true);
      const result = await startAvatarPreprocess(avatarId, {
        ...runtime,
        sourceVideoPath,
      });
      const nextRuntime = result.avatar?.imageSettings?.liveRuntime || {};
      setRuntimeFields(nextRuntime);
      message.success(`已创建 LiveTalking 预处理任务：${result.task?.taskId || '-'}`);
    } catch (error) {
      message.error(error.message || '创建预处理任务失败');
    } finally {
      setPreprocessBusy(false);
    }
  };

  const handleRefreshPreprocessTask = async () => {
    if (!isEdit || !avatarId) {
      message.warning('请先保存数字人，再刷新预处理任务');
      return;
    }

    const runtime = form.getFieldValue(['imageSettings', 'liveRuntime']) || {};
    const taskId = runtime.preprocessTaskId;

    if (!taskId) {
      message.info('当前数字人还没有预处理任务');
      return;
    }

    try {
      setPreprocessPolling(true);
      const result = await getAvatarPreprocessTask(avatarId, taskId);
      const nextRuntime = result.avatar?.imageSettings?.liveRuntime || {};
      setRuntimeFields(nextRuntime);

      if (result.task?.status === 'completed') {
        message.success('预处理已完成，开播时可以选择这个本机形象');
      } else if (result.task?.status === 'failed') {
        message.error(result.task?.errorMessage || '预处理失败');
      } else {
        message.info(`预处理中：${result.task?.progress || 0}%`);
      }
    } catch (error) {
      message.error(error.message || '刷新预处理任务失败');
    } finally {
      setPreprocessPolling(false);
    }
  };

  const handlePreview = async () => {
    const values = await form.validateFields([['preview', 'script'], ['preview', 'action'], ['preview', 'tone']]);
    form.setFieldValue(
      ['preview', 'result'],
      `Mock 预览：数字人将以「${values.preview.tone}」语气说：“${values.preview.script}”，并执行「${values.preview.action}」动作。`,
    );
    message.success('已生成 Mock 预览结果，未调用真实数字人服务');
  };

  const createAssetUploadRequest =
    ({ fileType, successMessage }) =>
    async ({ file, onSuccess, onError }) => {
      try {
        const uploadedFile = await uploadAvatarAsset(file, {
          businessId: avatarId || 'new-avatar',
          fileType,
        });

        message.success(successMessage);
        onSuccess({ file: uploadedFile });
      } catch (error) {
        message.error(error.message || '数字人素材上传失败');
        onError(error);
      }
    };

  const createAuthorizationUploadRequest =
    ({ fileType = 'document', successMessage }) =>
    async ({ file, onSuccess, onError }) => {
      try {
        const uploadedFile = await uploadAvatarAuthorization(file, {
          businessId: avatarId || 'new-avatar',
          fileType,
        });

        message.success(successMessage);
        onSuccess({ file: uploadedFile });
      } catch (error) {
        message.error(error.message || '授权文件上传失败');
        onError(error);
      }
    };

  const saveAvatar = async ({ returnToList = false, status = '草稿' } = {}) => {
    if (returnToList) {
      await form.validateFields();
    } else {
      await form.validateFields(['name']);
    }

    const values = form.getFieldsValue(true);
    const payload = buildAvatarPayload(values, status);

    if (isEdit) {
      await updateAvatar(avatarId, payload);
    } else {
      await createAvatar(payload);
    }
  };

  const handleSaveDraft = async () => {
    try {
      await saveAvatar({ status: '草稿' });
      message.success(isEdit ? '数字人修改草稿已保存到本地 SQLite' : '数字人草稿已保存到本地 SQLite');
    } catch (error) {
      if (!error.errorFields) {
        message.error(error.message || '保存草稿失败');
      }
    }
  };

  const handleSaveAndReturn = async () => {
    try {
      await saveAvatar({ returnToList: true, status: isEdit ? undefined : '草稿' });
      message.success(isEdit ? '数字人编辑已保存到本地 SQLite' : '数字人已保存到本地 SQLite');
      navigate('/avatar/list');
    } catch (error) {
      if (!error.errorFields) {
        message.error(error.message || '数字人保存失败');
      }
    }
  };

  const tabItems = [
    {
      key: 'base',
      label: '基础信息',
      children: (
        <Card className="panel-card">
          <div className="form-grid">
            <Form.Item name="name" label="数字人名称" rules={[{ required: true, message: '请输入数字人名称' }]}>
              <Input placeholder="请输入数字人名称" />
            </Form.Item>
            <Form.Item name="languageStyle" label="语言风格">
              <Select options={languageStyles.map((item) => ({ label: item, value: item }))} placeholder="请选择语言风格" />
            </Form.Item>
            <Form.Item name="suitableCategories" label="适合品类">
              <Select
                mode="multiple"
                options={avatarCategories.map((item) => ({ label: item, value: item }))}
                placeholder="请选择适合品类"
              />
            </Form.Item>
            <Form.Item name="forbiddenScenes" label="禁用场景">
              <Select mode="tags" placeholder="输入禁用场景，例如医疗诊断、金融承诺" />
            </Form.Item>
          </div>
          <Form.Item name="persona" label="人设定位" rules={[{ required: true, message: '请输入人设定位' }]}>
            <TextArea rows={4} placeholder="描述数字人的角色定位、适合场景和沟通边界" />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <TextArea rows={3} placeholder="内部运营备注" />
          </Form.Item>
        </Card>
      ),
    },
    {
      key: 'image',
      label: '头像与外观',
      children: (
        <Card className="panel-card">
          <Alert
            className="placeholder-hint"
            type="info"
            showIcon
            message="这里仅维护列表头像和外观标签"
            description="真正用于 LiveTalking 预处理的源视频、模型路线和训练素材，请到“素材与模型”里登记，避免同一份素材在两个地方重复配置。"
          />
          <Form.Item label="列表头像 / 真人照片" name={['imageSettings', 'photo']} valuePropName="fileList" getValueFromEvent={normalizeUploadEvent}>
            {uploadDragger({
              label: '点击或拖拽上传列表头像',
              hint: '保存到本地 server/uploads/avatar，并记录到 SQLite file_assets。',
              accept: imageAccept,
              customRequest: createAssetUploadRequest({ fileType: 'image', successMessage: '列表头像已上传到本地文件服务' }),
            })}
          </Form.Item>
          <UploadedAssetInfo name={['imageSettings', 'photo']} />
          <div className="form-grid">
            <Form.Item name={['imageSettings', 'template']} label="选择模板形象">
              <Select options={imageTemplates.map((item) => ({ label: item, value: item }))} placeholder="请选择模板形象" />
            </Form.Item>
            <Form.Item name={['imageSettings', 'style']} label="形象风格">
              <Select options={imageStyles.map((item) => ({ label: item, value: item }))} placeholder="请选择形象风格" />
            </Form.Item>
            <Form.Item name={['imageSettings', 'outfit']} label="服装风格">
              <Select options={outfitStyles.map((item) => ({ label: item, value: item }))} placeholder="请选择服装风格" />
            </Form.Item>
            <Form.Item name={['imageSettings', 'expression']} label="表情风格">
              <Select options={expressionStyles.map((item) => ({ label: item, value: item }))} placeholder="请选择表情风格" />
            </Form.Item>
          </div>
          <div className="avatar-preview-panel">
            <div className="avatar-preview-figure">形象预览</div>
            <Descriptions size="small" column={2}>
              <Descriptions.Item label="预览状态">Mock 占位</Descriptions.Item>
              <Descriptions.Item label="渲染服务">未连接</Descriptions.Item>
            </Descriptions>
          </div>
        </Card>
      ),
    },
    {
      key: 'voice',
      label: '声音设置',
      children: (
        <Card className="panel-card">
          <Alert
            className="placeholder-hint"
            type={engineConfig.health?.ok ? 'success' : 'info'}
            showIcon
            message={engineConfig.health?.ok ? '本机语音引擎可用' : '本机语音引擎配置'}
            description={engineConfig.health?.message || '可选择 VoxCPM2 或 GPT-SoVITS；开播播报时会按这里保存的 voiceEngine / cloneMode 作为默认配置。'}
          />
          <div className="form-grid">
            <Form.Item name={['voiceSettings', 'provider']} label="运行引擎">
              <Select
                loading={engineLoading}
                options={engineConfig.providers || fallbackEngineConfig.providers}
                placeholder="请选择运行引擎"
              />
            </Form.Item>
            <Form.Item name={['voiceSettings', 'engine']} label="语音模型">
              <Select
                loading={engineLoading}
                options={engineConfig.voiceEngines || fallbackEngineConfig.voiceEngines}
                placeholder="请选择语音模型"
              />
            </Form.Item>
            <Form.Item name={['voiceSettings', 'cloneMode']} label="克隆模式">
              <Select
                loading={engineLoading}
                options={engineConfig.cloneModes || fallbackEngineConfig.cloneModes}
                placeholder="请选择克隆模式"
              />
            </Form.Item>
            <Form.Item
              name={['voiceSettings', 'voiceName']}
              label="音色名称"
              extra="可以从已有音色名中选择，也可以直接输入自己的名字，例如：我的带货音色、主播小陈。"
            >
              <AutoComplete
                allowClear
                options={voiceOptions.map((item) => ({ label: item, value: item }))}
                placeholder="选择或输入自定义音色名称"
                filterOption={(inputValue, option) =>
                  String(option?.value || '').toLowerCase().includes(inputValue.toLowerCase())
                }
              />
            </Form.Item>
          </div>
          <Form.Item label="声音样本" name={['voiceSettings', 'sample']} valuePropName="fileList" getValueFromEvent={normalizeUploadEvent}>
            {uploadDragger({
              label: '点击或拖拽上传声音样本',
              hint: '保存到本地文件服务；后续用于 VoxCPM2 / GPT-SoVITS 克隆参考音频。',
              accept: audioAccept,
              customRequest: createAssetUploadRequest({ fileType: 'audio', successMessage: '声音样本已上传到本地文件服务' }),
            })}
          </Form.Item>
          <UploadedAssetInfo name={['voiceSettings', 'sample']} />
          <div className="form-grid">
            <Form.Item name={['voiceSettings', 'speed']} label="语速">
              <Slider min={20} max={90} />
            </Form.Item>
            <Form.Item name={['voiceSettings', 'volume']} label="音量">
              <Slider min={20} max={100} />
            </Form.Item>
            <Form.Item name={['voiceSettings', 'emotion']} label="情绪">
              <Select options={emotions.map((item) => ({ label: item, value: item }))} placeholder="请选择情绪" />
            </Form.Item>
            <Form.Item name={['voiceSettings', 'rhythm']} label="停顿节奏">
              <Select options={rhythms.map((item) => ({ label: item, value: item }))} placeholder="请选择停顿节奏" />
            </Form.Item>
          </div>
        </Card>
      ),
    },
    {
      key: 'behavior',
      label: '行为规则',
      children: (
        <Card className="panel-card">
          <div className="form-grid">
            <Form.Item name={['behaviorRules', 'lookComment']} valuePropName="checked">
              <Checkbox>看评论动作</Checkbox>
            </Form.Item>
            <Form.Item name={['behaviorRules', 'nod']} valuePropName="checked">
              <Checkbox>点头动作</Checkbox>
            </Form.Item>
            <Form.Item name={['behaviorRules', 'pointProduct']} valuePropName="checked">
              <Checkbox>指向商品动作</Checkbox>
            </Form.Item>
            <Form.Item name={['behaviorRules', 'emphasizePrice']} valuePropName="checked">
              <Checkbox>强调价格动作</Checkbox>
            </Form.Item>
            <Form.Item name={['behaviorRules', 'idle']} label="空场待机动作">
              <Select options={avatarActions.map((item) => ({ label: item.name, value: item.name }))} placeholder="请选择待机动作" />
            </Form.Item>
            <Form.Item name={['behaviorRules', 'silence']} label="异常静默动作">
              <Input placeholder="例如：提示人工接管" />
            </Form.Item>
          </div>
        </Card>
      ),
    },
    {
      key: 'preview',
      label: '测试预览',
      children: (
        <Card className="panel-card">
          <Steps
            size="small"
            current={1}
            items={[{ title: '填写话术' }, { title: '选择动作' }, { title: 'Mock 预览' }]}
            className="avatar-preview-steps"
          />
          <Form.Item name={['preview', 'script']} label="输入一句测试话术" rules={[{ required: true, message: '请输入测试话术' }]}>
            <TextArea rows={3} placeholder="例如：欢迎来到直播间，今天给大家介绍一款办公室好物。" />
          </Form.Item>
          <div className="form-grid">
            <Form.Item name={['preview', 'action']} label="选择动作" rules={[{ required: true, message: '请选择动作' }]}>
              <Select options={avatarActions.map((item) => ({ label: item.name, value: item.name }))} placeholder="请选择动作" />
            </Form.Item>
            <Form.Item name={['preview', 'tone']} label="选择语气" rules={[{ required: true, message: '请选择语气' }]}>
              <Select options={emotions.map((item) => ({ label: item, value: item }))} placeholder="请选择语气" />
            </Form.Item>
          </div>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Button type="primary" onClick={handlePreview}>
              预览
            </Button>
            <Form.Item shouldUpdate noStyle>
              {({ getFieldValue }) => {
                const result = getFieldValue(['preview', 'result']);
                return result ? <div className="mock-preview-result">{result}</div> : <Empty description="暂无 Mock 预览结果" />;
              }}
            </Form.Item>
          </Space>
        </Card>
      ),
    },
    {
      key: 'training',
      label: '素材与模型',
      children: (
        <Card className="panel-card">
          <Alert
            className="placeholder-hint"
            type="info"
            showIcon
            message="本机数字人形象素材登记"
            description="源视频会保存到项目素材箱；编辑已有数字人时可直接创建 LiveTalking 预处理任务，完成后开播会使用这里登记的 avatar id。"
          />
          <div className="form-grid">
            <Form.Item label="上传源视频" name={['trainingAssets', 'videoFile']} valuePropName="fileList" getValueFromEvent={normalizeUploadEvent}>
              {uploadDragger({
                label: sourceUploading ? '源视频上传中...' : '点击或拖拽上传源视频',
                hint: '会保存到 server/uploads/avatar_sources，并把本机路径写入预处理配置。',
                accept: videoAccept,
                customRequest: handleSourceVideoUpload(),
              })}
            </Form.Item>
            <div>
              <Form.Item label="从素材箱选择源视频">
                <Form.Item shouldUpdate noStyle>
                  {({ getFieldValue }) => {
                    const runtime = getFieldValue(['imageSettings', 'liveRuntime']) || {};
                    return (
                      <Select
                        showSearch
                        allowClear
                        loading={sourceVideosLoading}
                        value={runtime.sourceVideoPath || undefined}
                        placeholder="选择已上传或手动放入素材箱的视频"
                        optionFilterProp="label"
                        options={sourceVideos.map((item) => ({
                          label: `${item.fileName} · ${formatFileSize(item.size)}`,
                          value: item.filePath,
                        }))}
                        onChange={(value) => setRuntimeFields({ sourceVideoPath: value || '' })}
                      />
                    );
                  }}
                </Form.Item>
              </Form.Item>
              <Space wrap>
                <Button icon={<FolderOpenOutlined />} loading={sourceVideosLoading} onClick={() => loadSourceVideos()}>
                  扫描素材箱
                </Button>
                <Typography.Text type="secondary">{sourceFolder || 'server/uploads/avatar_sources'}</Typography.Text>
              </Space>
            </div>
          </div>
          <UploadedAssetInfo name={['trainingAssets', 'videoFile']} />
          <div className="form-grid">
            <Form.Item label="源视频本机路径" name={['imageSettings', 'liveRuntime', 'sourceVideoPath']}>
              <Input placeholder="例如 E:\\数字人直播\\server\\uploads\\avatar_sources\\your_avatar.mp4" />
            </Form.Item>
            <Form.Item label="LiveTalking avatar id" name={['imageSettings', 'liveRuntime', 'livetalkingAvatarId']}>
              <Input placeholder="例如 codex_user_wav2lip_12s；留空则预处理时自动生成" />
            </Form.Item>
            <Form.Item label="口型路线" name={['imageSettings', 'liveRuntime', 'modelRoute']}>
              <Select options={runtimeModelOptions} placeholder="请选择口型路线" />
            </Form.Item>
            <Form.Item label="目标规格" name={['imageSettings', 'liveRuntime', 'resolution']}>
              <Select options={runtimeResolutionOptions} placeholder="请选择目标规格" />
            </Form.Item>
            <Form.Item label="预处理输出目录" name={['imageSettings', 'liveRuntime', 'preprocessedPath']}>
              <Input placeholder="LiveTalking data/avatars 输出路径，完成任务后自动回填" />
            </Form.Item>
            <Form.Item label="素材质量检测状态" name={['trainingAssets', 'qualityStatus']}>
              <Select options={['通过', '待检测', '未检测'].map((item) => ({ label: item, value: item }))} placeholder="请选择检测状态" />
            </Form.Item>
          </div>
          <Form.Item shouldUpdate noStyle>
            {({ getFieldValue }) => {
              const runtime = getFieldValue(['imageSettings', 'liveRuntime']) || {};
              return (
                <Descriptions className="uploaded-file-info" size="small" column={2} bordered>
                  <Descriptions.Item label="本机形象状态">
                    <Tag color={getRuntimeStatusColor(runtime.status)}>{getRuntimeStatusLabel(runtime.status)}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="任务进度">{runtime.preprocessProgress || 0}%</Descriptions.Item>
                  <Descriptions.Item label="任务 ID">{runtime.preprocessTaskId || '-'}</Descriptions.Item>
                  <Descriptions.Item label="运行 Provider">{runtime.provider || 'livetalking'}</Descriptions.Item>
                  {runtime.preprocessError ? <Descriptions.Item label="错误">{runtime.preprocessError}</Descriptions.Item> : null}
                </Descriptions>
              );
            }}
          </Form.Item>
          <Space wrap>
            <Button
              type="primary"
              icon={<ThunderboltOutlined />}
              loading={preprocessBusy}
              disabled={!isEdit}
              onClick={handleStartAvatarPreprocess}
            >
              一键预处理形象
            </Button>
            <Button icon={<ReloadOutlined />} loading={preprocessPolling} disabled={!isEdit} onClick={handleRefreshPreprocessTask}>
              刷新任务状态
            </Button>
            {!isEdit ? <Typography.Text type="secondary">新建数字人需先保存，再进入编辑页预处理形象。</Typography.Text> : null}
          </Space>
          <Form.Item label="音频训练素材" name={['trainingAssets', 'audioFile']} valuePropName="fileList" getValueFromEvent={normalizeUploadEvent}>
            {uploadDragger({
              label: '点击或拖拽上传音频素材',
              hint: '保存到本地文件服务；可作为后续 GPT-SoVITS / VoxCPM2 深度克隆素材。',
              accept: audioAccept,
              customRequest: createAssetUploadRequest({ fileType: 'audio', successMessage: '音频素材已上传到本地文件服务' }),
            })}
          </Form.Item>
          <div className="form-grid">
            <Form.Item label="图片补充素材" name={['trainingAssets', 'imageFile']} valuePropName="fileList" getValueFromEvent={normalizeUploadEvent}>
              {uploadDragger({
                label: '点击或拖拽上传图片素材',
                hint: '保存到本地文件服务；可用于授权、质检和后续形象补充。',
                accept: imageAccept,
                customRequest: createAssetUploadRequest({ fileType: 'image', successMessage: '图片素材已上传到本地文件服务' }),
              })}
            </Form.Item>
            <Form.Item name={['imageSettings', 'liveRuntime', 'note']} label="本机形象备注">
              <TextArea rows={4} placeholder="记录录制时长、清晰度、是否正脸、是否需要重新预处理等" />
            </Form.Item>
          </div>
          <div className="form-grid">
            <UploadedAssetInfo name={['trainingAssets', 'audioFile']} />
            <UploadedAssetInfo name={['trainingAssets', 'imageFile']} />
          </div>
        </Card>
      ),
    },
    {
      key: 'auth',
      label: '授权信息',
      children: (
        <Card className="panel-card">
          <div className="form-grid">
            <Form.Item name={['authorizationStatus', 'portrait']} label="肖像授权状态">
              <Select options={authStatuses.map((item) => ({ label: item, value: item }))} placeholder="请选择肖像授权状态" />
            </Form.Item>
            <Form.Item name={['authorizationStatus', 'voice']} label="声音授权状态">
              <Select options={authStatuses.map((item) => ({ label: item, value: item }))} placeholder="请选择声音授权状态" />
            </Form.Item>
            <Form.Item name={['authorizationStatus', 'copyright']} label="素材版权状态">
              <Select options={authStatuses.map((item) => ({ label: item, value: item }))} placeholder="请选择素材版权状态" />
            </Form.Item>
          </div>
          <div className="form-grid">
            <Form.Item label="肖像授权文件" name={['authorizationStatus', 'portraitFile']} valuePropName="fileList" getValueFromEvent={normalizeUploadEvent}>
              {uploadDragger({
                label: '点击或拖拽上传肖像授权文件',
                hint: '支持图片、PDF、TXT；仅保存本地文件和引用。',
                accept: documentAccept,
                customRequest: createAuthorizationUploadRequest({ successMessage: '肖像授权文件已上传到本地文件服务' }),
              })}
            </Form.Item>
            <Form.Item label="声音授权文件" name={['authorizationStatus', 'voiceFile']} valuePropName="fileList" getValueFromEvent={normalizeUploadEvent}>
              {uploadDragger({
                label: '点击或拖拽上传声音授权文件',
                hint: '支持图片、PDF、TXT；不接真实声音授权系统。',
                accept: documentAccept,
                customRequest: createAuthorizationUploadRequest({ successMessage: '声音授权文件已上传到本地文件服务' }),
              })}
            </Form.Item>
            <Form.Item label="商用授权文件" name={['authorizationStatus', 'commercialFile']} valuePropName="fileList" getValueFromEvent={normalizeUploadEvent}>
              {uploadDragger({
                label: '点击或拖拽上传商用授权文件',
                hint: '支持图片、PDF、TXT；仅做本地开发记录。',
                accept: documentAccept,
                customRequest: createAuthorizationUploadRequest({ successMessage: '商用授权文件已上传到本地文件服务' }),
              })}
            </Form.Item>
          </div>
          <div className="form-grid">
            <UploadedAssetInfo name={['authorizationStatus', 'portraitFile']} />
            <UploadedAssetInfo name={['authorizationStatus', 'voiceFile']} />
            <UploadedAssetInfo name={['authorizationStatus', 'commercialFile']} />
          </div>
          <Form.Item name={['authorizationStatus', 'note']} label="授权备注">
            <TextArea rows={4} placeholder="记录授权范围、到期时间和内部备注" />
          </Form.Item>
        </Card>
      ),
    },
  ];

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={
        initialValues || {
          suitableCategories: [],
          forbiddenScenes: [],
          imageSettings: {
            liveRuntime: {
              provider: 'livetalking',
              modelRoute: 'wav2lip',
              resolution: '720p',
              status: 'pending',
            },
          },
          voiceSettings: {
            provider: 'livetalking',
            engine: 'voxcpm2',
            voiceEngine: 'voxcpm2',
            cloneMode: 'hifi',
            speed: 50,
            volume: 70,
            emotion: '亲切',
            rhythm: '自然停顿',
          },
          behaviorRules: { lookComment: true, nod: true, pointProduct: true, emphasizePrice: false },
          preview: { action: '轻微点头', tone: '亲切' },
          trainingAssets: { qualityStatus: '未检测' },
        }
      }
    >
      {avatarName ? <div className="editing-product-name">当前数字人：{avatarName}</div> : null}
      <Tabs className="product-form-tabs" items={tabItems} activeKey={activeTab} onChange={setActiveTab} />
      <div className="sticky-actions">
        <Space wrap>
          <Button icon={<SaveOutlined />} onClick={handleSaveDraft}>
            保存草稿
          </Button>
          <Button type="primary" onClick={handleSaveAndReturn}>
            保存并返回列表
          </Button>
          <Button onClick={() => navigate('/avatar/list')}>取消</Button>
        </Space>
      </div>
    </Form>
  );
}
