import { CopyOutlined, DeleteOutlined, EyeOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Form, Input, Modal, Select, Space, Switch, Tag, message } from 'antd';
import { useMemo, useState } from 'react';
import LivePreviewFrame from '../../components/LivePreviewFrame';
import PageHeader from '../../components/PageHeader';
import StatusTag from '../../components/StatusTag';
import {
  getStudioBackgrounds,
  getStudioCategories,
  getStudioRatios,
  getStudioRoomTypes,
  getStudioVisualStyles,
} from '../../services/studioService';

const studioBackgrounds = getStudioBackgrounds();
const studioCategories = getStudioCategories();
const studioRatios = getStudioRatios();
const studioRoomTypes = getStudioRoomTypes();
const studioVisualStyles = getStudioVisualStyles();

export default function StudioBackground() {
  const [form] = Form.useForm();
  const [previewBackground, setPreviewBackground] = useState(studioBackgrounds[0]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const currentRatio = Form.useWatch('ratio', form) || previewBackground.ratio;
  const currentColor = Form.useWatch('mainColor', form) || previewBackground.previewColor;

  const initialValues = useMemo(
    () => ({
      roomType: '带货',
      category: '海鲜特产',
      visualStyle: '海岛风',
      ratio: '9:16 竖屏',
      mainColor: '#0ea5e9',
      hasProductArea: true,
      hasCouponArea: true,
      hasDanmuArea: true,
      hasAvatarSlot: true,
      prompt: '海岛特产直播间，蓝白配色，保留数字人站位、商品展示区和弹幕区域。',
    }),
    [],
  );

  const handleGenerate = () => {
    message.success('已生成 4 张 Mock 背景结果，本阶段不调用真实图片生成服务');
  };

  const handlePreview = (item) => {
    setPreviewBackground(item);
    setPreviewOpen(true);
  };

  return (
    <>
      <PageHeader
        title="AI生成背景"
        description="为直播间生成或选择背景方案。当前全部为 Mock，不调用真实图片生成服务。"
      />

      <Alert
        className="studio-alert"
        type="info"
        showIcon
        message="当前为前端原型"
        description="生成、预览、应用、复制 Prompt 和删除均为 Mock 操作，不会上传素材，也不会请求任何 AI 图片生成接口。"
      />

      <div className="studio-background-grid">
        <Card title="背景生成表单" className="panel-card">
          <Form form={form} layout="vertical" initialValues={initialValues}>
            <div className="form-grid">
              <Form.Item label="直播间类型" name="roomType">
                <Select options={studioRoomTypes.map((item) => ({ label: item, value: item }))} />
              </Form.Item>
              <Form.Item label="商品品类" name="category">
                <Select options={studioCategories.map((item) => ({ label: item, value: item }))} />
              </Form.Item>
              <Form.Item label="视觉风格" name="visualStyle">
                <Select options={studioVisualStyles.map((item) => ({ label: item, value: item }))} />
              </Form.Item>
              <Form.Item label="画面比例" name="ratio">
                <Select options={studioRatios.map((item) => ({ label: item, value: item }))} />
              </Form.Item>
              <Form.Item label="主色调" name="mainColor">
                <Input type="color" />
              </Form.Item>
              <Form.Item label="是否包含商品展示区" name="hasProductArea" valuePropName="checked">
                <Switch checkedChildren="包含" unCheckedChildren="不包含" />
              </Form.Item>
              <Form.Item label="是否包含优惠券区域" name="hasCouponArea" valuePropName="checked">
                <Switch checkedChildren="包含" unCheckedChildren="不包含" />
              </Form.Item>
              <Form.Item label="是否包含弹幕区域" name="hasDanmuArea" valuePropName="checked">
                <Switch checkedChildren="包含" unCheckedChildren="不包含" />
              </Form.Item>
              <Form.Item label="是否为数字人预留站位" name="hasAvatarSlot" valuePropName="checked">
                <Switch checkedChildren="预留" unCheckedChildren="不预留" />
              </Form.Item>
            </div>
            <Form.Item label="Prompt 输入框" name="prompt">
              <Input.TextArea rows={4} placeholder="描述直播间背景、氛围、商品区、弹幕区和数字人站位要求" />
            </Form.Item>
            <Button type="primary" icon={<ThunderboltOutlined />} onClick={handleGenerate}>
              生成 Mock 背景
            </Button>
          </Form>
        </Card>

        <Card title="背景预览区" className="panel-card">
          <LivePreviewFrame
            ratio={currentRatio}
            backgroundColor={currentColor}
            title={previewBackground.name}
            showAvatar
            showProduct
            showDanmu
            showCoupon
          />
        </Card>
      </div>

      <Card title="Mock 背景结果" className="panel-card">
        <div className="studio-card-grid">
          {studioBackgrounds.map((item) => (
            <Card
              key={item.id}
              className="studio-result-card"
              actions={[
                <Button type="link" icon={<EyeOutlined />} onClick={() => handlePreview(item)} key="preview">
                  预览
                </Button>,
                <Button type="link" onClick={() => message.success(`已将「${item.name}」Mock 应用到布局`)} key="apply">
                  应用到布局
                </Button>,
                <Button type="link" icon={<CopyOutlined />} onClick={() => message.success('Prompt 已复制到 Mock 剪贴板')} key="copy">
                  复制 Prompt
                </Button>,
                <Button type="link" danger icon={<DeleteOutlined />} onClick={() => message.info('删除仅为 Mock 提示')} key="delete">
                  删除
                </Button>,
              ]}
            >
              <div className="studio-background-swatch" style={{ background: item.previewColor }} />
              <div className="studio-card-title">
                <strong>{item.name}</strong>
                <StatusTag status={item.status} />
              </div>
              <Space wrap size={6}>
                <Tag color="blue">{item.style}</Tag>
                <Tag>{item.ratio}</Tag>
                <Tag>{item.category}</Tag>
              </Space>
              <p className="studio-card-desc">适用直播间：{item.suitableScene}</p>
            </Card>
          ))}
        </div>
      </Card>

      <Modal title="背景预览" open={previewOpen} footer={null} onCancel={() => setPreviewOpen(false)} width={520}>
        <LivePreviewFrame
          ratio={previewBackground.ratio}
          backgroundColor={previewBackground.previewColor}
          title={previewBackground.name}
          showAvatar
          showProduct
          showDanmu
          showCoupon
        />
      </Modal>
    </>
  );
}
