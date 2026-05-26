import { InboxOutlined, SaveOutlined } from '@ant-design/icons';
import { Button, Card, Checkbox, Form, Input, Select, Space, Tabs, Upload, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import AiGenerateButton from '../../components/AiGenerateButton';
import PageHeader from '../../components/PageHeader';
import { productCategories } from '../../mock/products';

const { TextArea } = Input;

const forbiddenOptions = [
  '不能说最低价',
  '不能说全网第一',
  '不能虚构销量',
  '不能夸大承诺',
  '不能说治疗功效',
];

function aiLabel(label, target = '简介') {
  return (
    <Space size={4}>
      <span>{label}</span>
      <AiGenerateButton fieldName={label} target={target} />
    </Space>
  );
}

function TextInput({ name, label, target = '简介', required = false, textarea = false, placeholder }) {
  const Component = textarea ? TextArea : Input;
  return (
    <Form.Item name={name} label={aiLabel(label, target)} rules={required ? [{ required: true, message: `请输入${label}` }] : []}>
      <Component rows={textarea ? 4 : undefined} placeholder={placeholder || `请输入${label}`} />
    </Form.Item>
  );
}

export default function CreateProduct() {
  const [form] = Form.useForm();
  const navigate = useNavigate();

  const handleSaveDraft = () => {
    message.success('商品草稿已保存到前端 Mock 状态');
  };

  const handleSaveAndReturn = async () => {
    await form.validateFields();
    message.success('商品已保存，当前仅为前端 Mock 成功提示');
    navigate('/products/list');
  };

  const tabItems = [
    {
      key: 'base',
      label: '商品基础信息',
      children: (
        <Card className="panel-card">
          <div className="form-grid">
            <TextInput name="name" label="商品名称" required />
            <Form.Item name="category" label={aiLabel('商品分类')} rules={[{ required: true, message: '请选择商品分类' }]}>
              <Select placeholder="请选择商品分类" options={productCategories.map((item) => ({ label: item, value: item }))} />
            </Form.Item>
            <TextInput name="brand" label="商品品牌" />
            <TextInput name="link" label="商品链接" placeholder="https://example.com/product/demo" />
          </div>
          <Form.Item label="商品主图上传占位" name="mainImage" valuePropName="fileList" getValueFromEvent={(event) => event?.fileList}>
            <Upload.Dragger beforeUpload={() => false} maxCount={1} accept="image/*">
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">点击或拖拽上传商品主图</p>
              <p className="ant-upload-hint">仅前端占位，不上传到服务器。</p>
            </Upload.Dragger>
          </Form.Item>
          <TextInput name="description" label="商品简介" target="简介" textarea />
        </Card>
      ),
    },
    {
      key: 'spec',
      label: '商品规格',
      children: (
        <Card className="panel-card">
          <div className="form-grid">
            <TextInput name={['spec', 'name']} label="规格名称" required />
            <Form.Item name={['spec', 'price']} label={aiLabel('价格')} rules={[{ required: true, message: '请输入价格' }]}>
              <Input prefix="￥" placeholder="请输入价格" />
            </Form.Item>
            <Form.Item name={['spec', 'stock']} label={aiLabel('库存')} rules={[{ required: true, message: '请输入库存' }]}>
              <Input placeholder="请输入库存" />
            </Form.Item>
            <TextInput name={['spec', 'delivery']} label="发货说明" target="简介" />
          </div>
        </Card>
      ),
    },
    {
      key: 'selling',
      label: '商品卖点',
      children: (
        <Card className="panel-card">
          <div className="form-grid">
            <TextInput name={['selling', 'core']} label="核心卖点" target="卖点" textarea />
            <TextInput name={['selling', 'audience']} label="适用人群" target="卖点" textarea />
            <TextInput name={['selling', 'scene']} label="使用场景" target="卖点" textarea />
            <TextInput name={['selling', 'advantage']} label="对比优势" target="卖点" textarea />
            <TextInput name={['selling', 'promotion']} label="促销利益点" target="卖点" textarea />
          </div>
        </Card>
      ),
    },
    {
      key: 'script',
      label: '商品话术',
      children: (
        <Card className="panel-card">
          <div className="form-grid">
            <TextInput name={['script', 'opening']} label="开场介绍" target="口播" textarea />
            <TextInput name={['script', 'sellingPoint']} label="卖点讲解" target="口播" textarea />
            <TextInput name={['script', 'price']} label="价格说明" target="口播" textarea />
            <TextInput name={['script', 'benefit']} label="福利说明" target="口播" textarea />
            <TextInput name={['script', 'urge']} label="催单话术" target="口播" textarea />
            <TextInput name={['script', 'afterSale']} label="售后说明" target="口播" textarea />
            <TextInput name={['script', 'faq']} label="常见问题回答" target="FAQ" textarea />
          </div>
        </Card>
      ),
    },
    {
      key: 'compliance',
      label: '禁用表达',
      children: (
        <Card className="panel-card">
          <Form.Item name="forbidden" label="商品禁用表达" initialValue={forbiddenOptions}>
            <Checkbox.Group options={forbiddenOptions} />
          </Form.Item>
          <TextInput name="complianceRewrite" label="合规改写备注" target="合规改写" textarea />
        </Card>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="创建商品"
        description="录入商品资料、卖点和直播话术。本页只保存前端 Mock 状态，不写数据库。"
        extra={<Button onClick={() => navigate('/products/ai-copy')}>AI商品文案</Button>}
      />
      <Form form={form} layout="vertical" initialValues={{ forbidden: forbiddenOptions }}>
        <Tabs className="product-form-tabs" items={tabItems} />
        <div className="sticky-actions">
          <Space wrap>
            <Button icon={<SaveOutlined />} onClick={handleSaveDraft}>
              保存草稿
            </Button>
            <Button type="primary" onClick={handleSaveAndReturn}>
              保存并返回列表
            </Button>
            <Button onClick={() => navigate('/products/list')}>取消</Button>
          </Space>
        </div>
      </Form>
    </>
  );
}
