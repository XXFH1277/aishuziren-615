import { InboxOutlined, SaveOutlined } from '@ant-design/icons';
import { Button, Card, Checkbox, Descriptions, Empty, Form, Input, Select, Slider, Space, Steps, Tabs, Upload, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { getAvatarActions, getAvatarCategories, getVoiceOptions } from '../services/avatarService';

const { TextArea } = Input;
const avatarCategories = getAvatarCategories();
const voiceOptions = getVoiceOptions();
const avatarActions = getAvatarActions();

const imageTemplates = ['海岛蓝衬衫', '职场白衬衫', '客服蓝外套', '导购西装', '直播红外套', '默认模板'];
const imageStyles = ['真实主播', '半写实', '写实', '测试模板'];
const outfitStyles = ['清爽休闲', '商务休闲', '客服制服', '商务正装', '促销主播', '基础服装'];
const expressionStyles = ['微笑', '开朗', '亲和', '稳重', '惊喜', '中性'];
const languageStyles = ['亲切自然', '热情直接', '温柔耐心', '专业清晰', '热情促单', '测试口吻'];
const emotions = ['亲切', '热情', '温柔', '专业', '兴奋', '平静'];
const rhythms = ['自然停顿', '紧凑', '慢速停顿', '清晰停顿', '快节奏', '标准'];
const authStatuses = ['已授权', '待确认', '未授权', '已确认', '未确认'];

function uploadPlaceholder(label) {
  return (
    <Upload.Dragger beforeUpload={() => false} maxCount={1}>
      <p className="ant-upload-drag-icon">
        <InboxOutlined />
      </p>
      <p className="ant-upload-text">{label}</p>
      <p className="ant-upload-hint">仅 UI 占位，不上传到服务器。</p>
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
    imageSettings: avatar.imageSettings,
    voiceSettings: {
      voiceName: avatar.voiceName,
      ...avatar.voiceSettings,
    },
    behaviorRules: avatar.behaviorRules,
    preview: {
      script: `大家好，我是${avatar.name}，今天先用 Mock 预览检查播报效果。`,
      action: '轻微点头',
      tone: avatar.voiceSettings.emotion,
      result: 'Mock 预览结果：等待点击预览按钮。',
    },
    trainingAssets: avatar.trainingAssets,
    authorizationStatus: avatar.authorizationStatus,
  };
}

export default function AvatarForm({ mode = 'create', initialValues, avatarName }) {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const isEdit = mode === 'edit';

  const handlePreview = async () => {
    const values = await form.validateFields([['preview', 'script'], ['preview', 'action'], ['preview', 'tone']]);
    form.setFieldValue(
      ['preview', 'result'],
      `Mock 预览：数字人将以「${values.preview.tone}」语气说：“${values.preview.script}”，并执行「${values.preview.action}」动作。`,
    );
    message.success('已生成 Mock 预览结果，未调用真实数字人服务');
  };

  const handleSaveDraft = () => {
    message.success(isEdit ? '数字人修改草稿已保存到前端 Mock 状态' : '数字人草稿已保存到前端 Mock 状态');
  };

  const handleSaveAndReturn = async () => {
    await form.validateFields();
    message.success(isEdit ? '数字人编辑已保存，当前仅为前端 Mock 提示' : '数字人已保存，当前仅为前端 Mock 提示');
    navigate('/avatar/list');
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
          <Form.Item label="上传真人照片占位" name={['imageSettings', 'photo']} valuePropName="fileList" getValueFromEvent={(event) => event?.fileList}>
            {uploadPlaceholder('上传真人照片占位')}
          </Form.Item>
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
          <Form.Item label="上传声音样本占位" name={['voiceSettings', 'sample']} valuePropName="fileList" getValueFromEvent={(event) => event?.fileList}>
            {uploadPlaceholder('上传声音样本占位')}
          </Form.Item>
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
            <Form.Item label="视频素材上传占位" name={['trainingAssets', 'videoFile']} valuePropName="fileList" getValueFromEvent={(event) => event?.fileList}>
              {uploadPlaceholder('上传视频素材占位')}
            </Form.Item>
            <Form.Item label="音频素材上传占位" name={['trainingAssets', 'audioFile']} valuePropName="fileList" getValueFromEvent={(event) => event?.fileList}>
              {uploadPlaceholder('上传音频素材占位')}
            </Form.Item>
            <Form.Item label="图片素材上传占位" name={['trainingAssets', 'imageFile']} valuePropName="fileList" getValueFromEvent={(event) => event?.fileList}>
              {uploadPlaceholder('上传图片素材占位')}
            </Form.Item>
            <Form.Item name={['trainingAssets', 'qualityStatus']} label="素材质量检测状态 Mock">
              <Select
                options={['通过', '待检测', '未检测'].map((item) => ({ label: item, value: item }))}
                placeholder="请选择检测状态"
              />
            </Form.Item>
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
