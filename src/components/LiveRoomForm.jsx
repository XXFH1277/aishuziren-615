import { SaveOutlined } from '@ant-design/icons';
import { Button, Card, Descriptions, Empty, Form, Input, Select, Slider, Space, Steps, Switch, Tabs, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAvatars } from '../services/avatarService';
import { activateLiveRoom, createLiveRoom, getLivePlatforms, updateLiveRoom } from '../services/liveService';
import { getProductGroups } from '../services/productService';

const { TextArea } = Input;
const livePlatforms = getLivePlatforms();

const liveTypes = ['常规直播', '福利专场', '新品首播', '测试直播', '返场直播'];
const platformAccounts = ['舟山鲜选官方号', '职场好物研究所', '新人福利测试号', '明眸光电旗舰店', '轻盈计划官方号', '内部测试账号'];
const streamMethods = ['OBS', '直播伴侣', '云端推流预留'];
const sceneBackgrounds = ['海岛厨房背景', '办公室桌面背景', '默认测试背景', '书房阅读背景', '清晨餐桌背景', '空白调试背景'];
const layoutTypes = ['左侧数字人 + 右侧商品卡', '居中数字人 + 底部商品栏', '基础三栏布局', '右侧数字人 + 左侧参数卡'];
const productPositions = ['右侧商品卡', '底部商品栏', '左侧参数卡', '场景商品台'];
const danmuStyles = ['右侧浮层', '底部滚动', '精简弹幕条', '隐藏弹幕'];
const faqLibraries = ['通用商品 FAQ', '海鲜特产 FAQ', '办公好物 FAQ', '轻食健康 FAQ'];

export function mapLiveRoomToFormValues(room) {
  if (!room) {
    return undefined;
  }

  return {
    name: room.name,
    theme: room.theme,
    description: room.notes,
    liveType: room.name.includes('测试') ? '测试直播' : '常规直播',
    notes: room.notes,
    platform: {
      name: room.platform,
      account: room.platformAccount,
      streamMethod: room.platform === '抖音' ? 'OBS' : '直播伴侣',
      ruleTip: '请检查平台禁用词、商品资质和直播标题。',
    },
    avatarId: room.avatarId,
    avatarName: room.avatarName,
    productGroupId: room.productGroupId,
    productGroupName: room.productGroupName,
    scene: {
      background: room.sceneName,
      layoutType: room.layoutType,
      productPosition: room.layoutType.includes('底部') ? '底部商品栏' : '右侧商品卡',
      danmuStyle: room.danmuEnabled ? '右侧浮层' : '隐藏弹幕',
    },
    interaction: {
      danmuEnabled: room.danmuEnabled,
      aiReplyEnabled: room.aiReplyEnabled,
      manualTakeoverEnabled: room.manualTakeoverEnabled,
      faqLibrary: '通用商品 FAQ',
      blacklistRules: '绝对化用语、医疗功效、虚构销量',
    },
    control: {
      delayControlEnabled: room.delayControlEnabled,
      delaySeconds: room.delaySeconds,
      nextSentencePreview: true,
      riskWordBlock: true,
      manualConfirm: room.delayControlEnabled,
    },
  };
}

function buildLiveRoomPayload(values, selectedAvatar, selectedGroup, status) {
  return {
    name: values.name,
    theme: values.theme,
    notes: values.notes || values.description || '',
    platform: values.platform?.name,
    platformAccount: values.platform?.account || '',
    avatarId: values.avatarId,
    avatarName: selectedAvatar?.name || values.avatarName || '',
    productGroupId: values.productGroupId,
    productGroupName: selectedGroup?.name || values.productGroupName || '',
    sceneName: values.scene?.background || '',
    layoutType: values.scene?.layoutType || '',
    danmuEnabled: Boolean(values.interaction?.danmuEnabled),
    aiReplyEnabled: Boolean(values.interaction?.aiReplyEnabled),
    manualTakeoverEnabled: Boolean(values.interaction?.manualTakeoverEnabled),
    delayControlEnabled: Boolean(values.control?.delayControlEnabled),
    delaySeconds: Number(values.control?.delaySeconds || 0),
    status,
  };
}

export default function LiveRoomForm({ mode = 'create', roomId, initialValues, roomName }) {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const isEdit = mode === 'edit';
  const [avatars, setAvatars] = useState([]);
  const [productGroups, setProductGroups] = useState([]);
  const [activating, setActivating] = useState(false);

  useEffect(() => {
    async function fetchOptions() {
      try {
        const [avatarData, groupData] = await Promise.all([getAvatars({ pageSize: 100 }), getProductGroups({ pageSize: 100 })]);
        setAvatars(avatarData.list || []);
        setProductGroups(groupData.list || []);
      } catch (error) {
        message.error(error.message || '直播间表单选项加载失败');
      }
    }

    fetchOptions();
  }, []);

  const watchedAvatarId = Form.useWatch('avatarId', form);
  const watchedGroupId = Form.useWatch('productGroupId', form);
  const watchedScene = Form.useWatch('scene', form) || {};
  const watchedPlatform = Form.useWatch('platform', form) || {};
  const watchedControl = Form.useWatch('control', form) || {};
  const selectedAvatar = useMemo(() => avatars.find((item) => item.id === watchedAvatarId), [avatars, watchedAvatarId]);
  const selectedGroup = useMemo(() => productGroups.find((item) => item.id === watchedGroupId), [productGroups, watchedGroupId]);

  const saveLiveRoom = async ({ returnToList = false, status = '草稿' } = {}) => {
    if (returnToList) {
      await form.validateFields();
    } else {
      await form.validateFields(['name']);
    }

    const values = form.getFieldsValue(true);
    const payload = buildLiveRoomPayload(values, selectedAvatar, selectedGroup, status);

    if (isEdit) {
      return updateLiveRoom(roomId, payload);
    } else {
      return createLiveRoom(payload);
    }
  };

  const handleSaveDraft = async () => {
    try {
      const savedRoom = await saveLiveRoom({ status: '草稿' });
      message.success(isEdit ? '直播间修改草稿已保存到本地 SQLite' : '直播间草稿已保存到本地 SQLite');
      if (!isEdit && savedRoom?.id) {
        navigate(`/live/rooms/${savedRoom.id}/edit`, { replace: true });
      }
    } catch (error) {
      if (!error.errorFields) {
        message.error(error.message || '保存草稿失败');
      }
    }
  };

  const handleSaveAndReturn = async () => {
    try {
      await saveLiveRoom({ returnToList: true, status: isEdit ? undefined : '草稿' });
      message.success(isEdit ? '直播间编辑已保存到本地 SQLite' : '直播间已保存到本地 SQLite');
      navigate('/live/rooms');
    } catch (error) {
      if (!error.errorFields) {
        message.error(error.message || '直播间保存失败');
      }
    }
  };

  const handleSaveAndEnterControl = async () => {
    try {
      setActivating(true);
      const savedRoom = await saveLiveRoom({ returnToList: true, status: '启用中' });
      const result = await activateLiveRoom(savedRoom.id);
      message.success(result.message || '直播间已保存并进入中控台');
      navigate(result.redirectUrl || '/live/control-room');
    } catch (error) {
      if (!error.errorFields) {
        message.error(error.message || '保存并进入中控失败');
      }
    } finally {
      setActivating(false);
    }
  };

  const handleOpenSelectedAvatar = () => {
    if (!selectedAvatar?.id) {
      message.warning('请先选择一个数字人');
      return;
    }

    navigate(`/avatar/${selectedAvatar.id}/edit`);
  };

  const handleOpenProductGroup = () => {
    if (!selectedGroup?.id) {
      message.warning('请先选择一个商品组');
      return;
    }

    navigate('/products/groups');
  };

  const tabItems = [
    {
      key: 'base',
      label: '基础信息',
      children: (
        <Card className="panel-card">
          <div className="form-grid">
            <Form.Item name="name" label="直播间名称" rules={[{ required: true, message: '请输入直播间名称' }]}>
              <Input placeholder="请输入直播间名称" />
            </Form.Item>
            <Form.Item name="theme" label="直播主题" rules={[{ required: true, message: '请输入直播主题' }]}>
              <Input placeholder="请输入直播主题" />
            </Form.Item>
            <Form.Item name="liveType" label="直播类型">
              <Select options={liveTypes.map((item) => ({ label: item, value: item }))} placeholder="请选择直播类型" />
            </Form.Item>
          </div>
          <Form.Item name="description" label="直播说明">
            <TextArea rows={4} placeholder="说明本直播间的定位、主推商品和运营注意事项" />
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <TextArea rows={3} placeholder="内部备注，会保存到本地 SQLite" />
          </Form.Item>
        </Card>
      ),
    },
    {
      key: 'platform',
      label: '平台设置',
      children: (
        <Card className="panel-card">
          <div className="form-grid">
            <Form.Item name={['platform', 'name']} label="直播平台" rules={[{ required: true, message: '请选择直播平台' }]}>
              <Select options={livePlatforms.map((item) => ({ label: item, value: item }))} placeholder="请选择直播平台" />
            </Form.Item>
            <Form.Item name={['platform', 'account']} label="平台账号选择">
              <Select options={platformAccounts.map((item) => ({ label: item, value: item }))} placeholder="请选择平台账号" />
            </Form.Item>
            <Form.Item name={['platform', 'streamMethod']} label="推流方式">
              <Select options={streamMethods.map((item) => ({ label: item, value: item }))} placeholder="请选择推流方式" />
            </Form.Item>
          </div>
          <Form.Item name={['platform', 'ruleTip']} label="平台规则提示">
            <TextArea rows={4} placeholder="记录本场直播需要注意的平台规则、商品资质和禁用表达" />
          </Form.Item>
        </Card>
      ),
    },
    {
      key: 'avatar',
      label: '数字人绑定',
      children: (
        <Card className="panel-card">
          <Form.Item name="avatarId" label="选择数字人" rules={[{ required: true, message: '请选择数字人' }]}>
            <Select
              showSearch
              options={avatars.map((item) => ({ label: item.name, value: item.id }))}
              placeholder="请选择数字人"
            />
          </Form.Item>
          {selectedAvatar ? (
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="数字人人设">{selectedAvatar.persona}</Descriptions.Item>
              <Descriptions.Item label="数字人声音">{selectedAvatar.voiceName}</Descriptions.Item>
              <Descriptions.Item label="语言风格">{selectedAvatar.languageStyle}</Descriptions.Item>
              <Descriptions.Item label="动作规则">
                {selectedAvatar.behaviorRules.pointProduct ? '指向商品' : '不指向商品'} /{' '}
                {selectedAvatar.behaviorRules.emphasizePrice ? '强调价格' : '不强调价格'}
              </Descriptions.Item>
            </Descriptions>
          ) : (
            <Empty description="请选择数字人后查看人设、声音和动作规则" />
          )}
          <div className="copy-scene-actions">
            <Button onClick={handleOpenSelectedAvatar} disabled={!selectedAvatar}>
              查看数字人素材与声音
            </Button>
          </div>
        </Card>
      ),
    },
    {
      key: 'group',
      label: '商品组绑定',
      children: (
        <Card className="panel-card">
          <Form.Item name="productGroupId" label="选择商品组" rules={[{ required: true, message: '请选择商品组' }]}>
            <Select
              showSearch
              options={productGroups.map((item) => ({ label: item.name, value: item.id }))}
              placeholder="请选择商品组"
            />
          </Form.Item>
          {selectedGroup ? (
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="商品数量">{selectedGroup.productCount} 个</Descriptions.Item>
              <Descriptions.Item label="主推商品">{selectedGroup.mainProduct}</Descriptions.Item>
            <Descriptions.Item label="福利商品">{selectedGroup.type === '福利品' ? selectedGroup.mainProduct : '未单独配置'}</Descriptions.Item>
              <Descriptions.Item label="适用直播间">{selectedGroup.liveRoom}</Descriptions.Item>
            </Descriptions>
          ) : (
            <Empty description="请选择商品组后查看商品数量和主推商品" />
          )}
          <div className="copy-scene-actions">
            <Button onClick={handleOpenProductGroup} disabled={!selectedGroup}>
              打开商品组配置
            </Button>
          </div>
        </Card>
      ),
    },
    {
      key: 'scene',
      label: '直播间场景',
      children: (
        <Card className="panel-card">
          <div className="form-grid">
            <Form.Item name={['scene', 'background']} label="选择直播间背景">
              <Select options={sceneBackgrounds.map((item) => ({ label: item, value: item }))} placeholder="请选择背景" />
            </Form.Item>
            <Form.Item name={['scene', 'layoutType']} label="选择画面布局">
              <Select options={layoutTypes.map((item) => ({ label: item, value: item }))} placeholder="请选择布局" />
            </Form.Item>
            <Form.Item name={['scene', 'productPosition']} label="选择商品展示区位置">
              <Select options={productPositions.map((item) => ({ label: item, value: item }))} placeholder="请选择商品位置" />
            </Form.Item>
            <Form.Item name={['scene', 'danmuStyle']} label="选择弹幕展示样式">
              <Select options={danmuStyles.map((item) => ({ label: item, value: item }))} placeholder="请选择弹幕样式" />
            </Form.Item>
          </div>
          <div className="live-preview-panel">
            <div className="live-preview-stage">
              <strong>{selectedAvatar?.name || '未选择数字人'}</strong>
              <span>{selectedGroup?.name || '未选择商品组'}</span>
              <span>{watchedScene.background || '未选择背景'}</span>
            </div>
            <Descriptions size="small" column={2}>
              <Descriptions.Item label="直播平台">{watchedPlatform.name || '-'}</Descriptions.Item>
              <Descriptions.Item label="推流方式">{watchedPlatform.streamMethod || '-'}</Descriptions.Item>
              <Descriptions.Item label="画面布局">{watchedScene.layoutType || '-'}</Descriptions.Item>
              <Descriptions.Item label="商品区">{watchedScene.productPosition || '-'}</Descriptions.Item>
              <Descriptions.Item label="弹幕样式">{watchedScene.danmuStyle || '-'}</Descriptions.Item>
              <Descriptions.Item label="延迟播控">{watchedControl.delayControlEnabled ? `${watchedControl.delaySeconds || 0}s` : '关闭'}</Descriptions.Item>
            </Descriptions>
          </div>
        </Card>
      ),
    },
    {
      key: 'interaction',
      label: '互动设置',
      children: (
        <Card className="panel-card">
          <div className="form-grid">
            <Form.Item name={['interaction', 'danmuEnabled']} label="是否开启弹幕捕获" valuePropName="checked">
              <Switch checkedChildren="开启" unCheckedChildren="关闭" />
            </Form.Item>
            <Form.Item name={['interaction', 'aiReplyEnabled']} label="是否开启 AI 推荐回复" valuePropName="checked">
              <Switch checkedChildren="开启" unCheckedChildren="关闭" />
            </Form.Item>
            <Form.Item name={['interaction', 'manualTakeoverEnabled']} label="是否开启人工接管" valuePropName="checked">
              <Switch checkedChildren="开启" unCheckedChildren="关闭" />
            </Form.Item>
            <Form.Item name={['interaction', 'faqLibrary']} label="常见问题库选择">
              <Select options={faqLibraries.map((item) => ({ label: item, value: item }))} placeholder="请选择 FAQ 库" />
            </Form.Item>
          </div>
          <Form.Item name={['interaction', 'blacklistRules']} label="黑名单规则预留">
            <TextArea rows={4} placeholder="例如：绝对化用语、医疗功效、虚构销量" />
          </Form.Item>
        </Card>
      ),
    },
    {
      key: 'control',
      label: '播控设置',
      children: (
        <Card className="panel-card">
          <Steps
            size="small"
            current={1}
            items={[{ title: '配置延迟' }, { title: '人工确认' }, { title: '本机播控' }]}
            className="avatar-preview-steps"
          />
          <div className="form-grid">
            <Form.Item name={['control', 'delayControlEnabled']} label="是否开启延迟播控" valuePropName="checked">
              <Switch checkedChildren="开启" unCheckedChildren="关闭" />
            </Form.Item>
            <Form.Item name={['control', 'delaySeconds']} label="延迟秒数">
              <Slider min={0} max={60} marks={{ 0: '0s', 15: '15s', 30: '30s', 60: '60s' }} />
            </Form.Item>
            <Form.Item name={['control', 'nextSentencePreview']} label="下一句话预览开关" valuePropName="checked">
              <Switch checkedChildren="开启" unCheckedChildren="关闭" />
            </Form.Item>
            <Form.Item name={['control', 'riskWordBlock']} label="风险词拦截开关" valuePropName="checked">
              <Switch checkedChildren="开启" unCheckedChildren="关闭" />
            </Form.Item>
            <Form.Item name={['control', 'manualConfirm']} label="人工确认开关" valuePropName="checked">
              <Switch checkedChildren="开启" unCheckedChildren="关闭" />
            </Form.Item>
          </div>
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
          liveType: '常规直播',
              platform: { name: '抖音', streamMethod: 'OBS', ruleTip: '请检查平台禁用词和商品资质。' },
          scene: { background: '默认测试背景', layoutType: '基础三栏布局', productPosition: '右侧商品卡', danmuStyle: '右侧浮层' },
          interaction: { danmuEnabled: true, aiReplyEnabled: false, manualTakeoverEnabled: true, faqLibrary: '通用商品 FAQ' },
          control: { delayControlEnabled: true, delaySeconds: 10, nextSentencePreview: true, riskWordBlock: true, manualConfirm: true },
        }
      }
    >
      {roomName ? <div className="editing-product-name">当前直播间：{roomName}</div> : null}
      <Tabs className="product-form-tabs" items={tabItems} />
      <div className="sticky-actions">
        <Space wrap>
          <Button icon={<SaveOutlined />} onClick={handleSaveDraft}>
            保存草稿
          </Button>
          <Button type="primary" onClick={handleSaveAndReturn}>
            保存并返回列表
          </Button>
          <Button type="primary" ghost loading={activating} onClick={handleSaveAndEnterControl}>
            保存并进入中控
          </Button>
          <Button onClick={() => navigate('/live/rooms')}>取消</Button>
        </Space>
      </div>
    </Form>
  );
}
