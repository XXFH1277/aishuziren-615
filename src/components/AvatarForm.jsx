import { InboxOutlined, SaveOutlined } from '@ant-design/icons';
import { Button, Card, Checkbox, Descriptions, Empty, Form, Input, Select, Slider, Space, Steps, Tabs, Upload, message } from 'antd';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createAvatar, getAvatarActions, getAvatarCategories, getVoiceOptions, updateAvatar } from '../services/avatarService';
import { resolveFileUrl, toFileAsset, uploadAvatarAsset, uploadAvatarAuthorization } from '../services/fileService';

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
const videoAccept = 'video/mp4,video/webm,video/quicktime';
const audioAccept = 'audio/mpeg,audio/mp4,audio/aac,audio/wav,audio/x-wav,audio/webm,audio/x-m4a';
const documentAccept = 'application/pdf,text/plain,image/png,image/jpeg,image/webp,image/gif';

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
          </Descriptions>
        );
      }}
    </Form.Item>
  );
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

  return {
    name: avatar.name,
    persona: avatar.persona,
    suitableCategories: avatar.suitableCategories,
    languageStyle: avatar.languageStyle,
    forbiddenScenes: ['医疗诊断', '承诺收益'],
    remark: 'Mock 编辑备注，后续可接入真实审核流。',
    imageSettings: {
      ...avatar.imageSettings,
      photo: assetToUploadList(avatar.imageSettings?.photo),
      videoMaterial: assetToUploadList(avatar.imageSettings?.videoMaterial),
      audioMaterial: assetToUploadList(avatar.imageSettings?.audioMaterial),
    },
    voiceSettings: {
      voiceName: avatar.voiceName,
      ...avatar.voiceSettings,
      sample: assetToUploadList(avatar.voiceSettings?.sample),
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

  return {
    name: normalizedValues.name,
    persona: normalizedValues.persona,
    suitableCategories: normalizedValues.suitableCategories || [],
    languageStyle: normalizedValues.languageStyle || '',
    avatarImage: normalizedValues.imageSettings?.photo?.fileUrl || normalizedValues.imageSettings?.template || 'api-avatar',
    voiceName: normalizedValues.voiceSettings?.voiceName || '',
    status,
    behaviorRules: normalizedValues.behaviorRules || {},
    voiceSettings: normalizedValues.voiceSettings || {},
    imageSettings: normalizedValues.imageSettings || {},
    trainingAssets: normalizedValues.trainingAssets || {},
    authorizationStatus: normalizedValues.authorizationStatus || {},
  };
}

export default function AvatarForm({ mode = 'create', avatarId, initialValues, avatarName }) {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const isEdit = mode === 'edit';
  const [avatarActions, setAvatarActions] = useState([]);

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
      label: '形象设置',
      children: (
        <Card className="panel-card">
          <Form.Item label="真人照片" name={['imageSettings', 'photo']} valuePropName="fileList" getValueFromEvent={normalizeUploadEvent}>
            {uploadDragger({
              label: '点击或拖拽上传真人照片',
              hint: '保存到本地 server/uploads/avatar，并记录到 SQLite file_assets。',
              accept: imageAccept,
              customRequest: createAssetUploadRequest({ fileType: 'image', successMessage: '真人照片已上传到本地文件服务' }),
            })}
          </Form.Item>
          <UploadedAssetInfo name={['imageSettings', 'photo']} />
          <div className="form-grid">
            <Form.Item label="形象视频素材" name={['imageSettings', 'videoMaterial']} valuePropName="fileList" getValueFromEvent={normalizeUploadEvent}>
              {uploadDragger({
                label: '点击或拖拽上传形象视频素材',
                hint: '仅保存素材文件，不触发真实数字人训练。',
                accept: videoAccept,
                customRequest: createAssetUploadRequest({ fileType: 'video', successMessage: '形象视频素材已上传到本地文件服务' }),
              })}
            </Form.Item>
            <Form.Item label="形象音频素材" name={['imageSettings', 'audioMaterial']} valuePropName="fileList" getValueFromEvent={normalizeUploadEvent}>
              {uploadDragger({
                label: '点击或拖拽上传形象音频素材',
                hint: '仅保存素材文件，不触发 TTS 或声音克隆。',
                accept: audioAccept,
                customRequest: createAssetUploadRequest({ fileType: 'audio', successMessage: '形象音频素材已上传到本地文件服务' }),
              })}
            </Form.Item>
          </div>
          <div className="form-grid">
            <UploadedAssetInfo name={['imageSettings', 'videoMaterial']} />
            <UploadedAssetInfo name={['imageSettings', 'audioMaterial']} />
          </div>
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
          <Form.Item name={['voiceSettings', 'voiceName']} label="选择系统音色">
            <Select options={voiceOptions.map((item) => ({ label: item, value: item }))} placeholder="请选择系统音色" />
          </Form.Item>
          <Form.Item label="声音样本" name={['voiceSettings', 'sample']} valuePropName="fileList" getValueFromEvent={normalizeUploadEvent}>
            {uploadDragger({
              label: '点击或拖拽上传声音样本',
              hint: '保存到本地文件服务；不做真实声音克隆、TTS 或口型同步。',
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
      label: '训练素材',
      children: (
        <Card className="panel-card">
          <div className="form-grid">
            <Form.Item label="视频素材" name={['trainingAssets', 'videoFile']} valuePropName="fileList" getValueFromEvent={normalizeUploadEvent}>
              {uploadDragger({
                label: '点击或拖拽上传视频素材',
                hint: '保存到本地文件服务；不触发真实训练任务。',
                accept: videoAccept,
                customRequest: createAssetUploadRequest({ fileType: 'video', successMessage: '视频素材已上传到本地文件服务' }),
              })}
            </Form.Item>
            <Form.Item label="音频素材" name={['trainingAssets', 'audioFile']} valuePropName="fileList" getValueFromEvent={normalizeUploadEvent}>
              {uploadDragger({
                label: '点击或拖拽上传音频素材',
                hint: '保存到本地文件服务；不触发 TTS 或声音训练。',
                accept: audioAccept,
                customRequest: createAssetUploadRequest({ fileType: 'audio', successMessage: '音频素材已上传到本地文件服务' }),
              })}
            </Form.Item>
            <Form.Item label="图片素材" name={['trainingAssets', 'imageFile']} valuePropName="fileList" getValueFromEvent={normalizeUploadEvent}>
              {uploadDragger({
                label: '点击或拖拽上传图片素材',
                hint: '保存到本地文件服务；只做素材管理记录。',
                accept: imageAccept,
                customRequest: createAssetUploadRequest({ fileType: 'image', successMessage: '图片素材已上传到本地文件服务' }),
              })}
            </Form.Item>
            <Form.Item name={['trainingAssets', 'qualityStatus']} label="素材质量检测状态 Mock">
              <Select
                options={['通过', '待检测', '未检测'].map((item) => ({ label: item, value: item }))}
                placeholder="请选择检测状态"
              />
            </Form.Item>
          </div>
          <div className="form-grid">
            <UploadedAssetInfo name={['trainingAssets', 'videoFile']} />
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
          voiceSettings: { speed: 50, volume: 70, emotion: '亲切', rhythm: '自然停顿' },
          behaviorRules: { lookComment: true, nod: true, pointProduct: true, emphasizePrice: false },
          preview: { action: '轻微点头', tone: '亲切' },
          trainingAssets: { qualityStatus: '未检测' },
        }
      }
    >
      {avatarName ? <div className="editing-product-name">当前数字人：{avatarName}</div> : null}
      <Tabs className="product-form-tabs" items={tabItems} />
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
