import { InboxOutlined, SaveOutlined } from '@ant-design/icons';
import { Button, Card, Checkbox, Form, Input, Select, Space, Tabs, Upload, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { resolveFileUrl, uploadFile } from '../services/fileService';
import { createProduct, getProductCategories, updateProduct } from '../services/productService';
import AiGenerateButton from './AiGenerateButton';

const { TextArea } = Input;
const productCategories = getProductCategories();

export const forbiddenOptions = [
  '不能说最低价',
  '不能说全网第一',
  '不能虚构销量',
  '不能夸大承诺',
  '不能说治疗功效',
];

function aiLabel(label, target = '简介', action = 'AI生成', aiProps = {}) {
  return (
    <Space size={4}>
      <span>{label}</span>
      <AiGenerateButton fieldName={label} target={target} {...aiProps}>
        {action}
      </AiGenerateButton>
    </Space>
  );
}

function TextInput({
  name,
  label,
  target = '简介',
  action,
  required = false,
  textarea = false,
  placeholder,
  buildGeneratePayload,
  onAiInsert,
}) {
  const Component = textarea ? TextArea : Input;
  const aiProps = buildGeneratePayload
    ? {
        buildGeneratePayload,
        onInsert: (copy, meta) => onAiInsert?.(name, copy, meta),
      }
    : {};

  return (
    <Form.Item
      name={name}
      label={aiLabel(label, target, action, aiProps)}
      rules={required ? [{ required: true, message: `请输入${label}` }] : []}
    >
      <Component rows={textarea ? 4 : undefined} placeholder={placeholder || `请输入${label}`} />
    </Form.Item>
  );
}

export function mapProductToFormValues(product) {
  if (!product) {
    return { forbidden: forbiddenOptions };
  }

  const mainImage = product.image
    ? [
        {
          uid: product.image,
          name: product.image.startsWith('/uploads/') ? product.image.split('/').pop() : product.image,
          status: 'done',
          url: product.image.startsWith('/uploads/') ? resolveFileUrl(product.image) : undefined,
          response: { file: { fileUrl: product.image } },
        },
      ]
    : [];

  return {
    name: product.name,
    category: product.category,
    brand: product.brand,
    mainImage,
    link: `https://mock.local/products/${product.id}`,
    description: product.description,
    spec: {
      name: '默认规格',
      price: product.price,
      stock: product.stock,
      delivery: '默认 48 小时内发货，具体以商品页展示为准。',
    },
    selling: {
      core: product.sellingPoints.join('\n'),
      audience: product.category === '办公好物' ? '办公室人群、通勤人群、效率工具爱好者' : '直播间目标用户与礼品采购人群',
      scene: '直播讲解、商品卡展示、用户咨询回复',
      advantage: 'Mock 对比优势，后续可由人工或合规 AI 改写。',
      promotion: '限时福利、组合优惠和直播间专属权益占位。',
    },
    script: {
      opening: `今天给大家看这款${product.name}，它是我们本场的重点商品之一。`,
      sellingPoint: product.sellingPoints.map((point) => `- ${point}`).join('\n'),
      price: `当前直播间到手价为 ${product.price} 元，具体优惠以页面展示为准。`,
      benefit: '福利说明为 Mock 占位，后续根据商品组和场次补充。',
      urge: '喜欢的朋友可以先加入购物车，库存和活动节奏以后端配置为准。',
      afterSale: '售后说明以商品详情页和平台规则为准。',
    },
    faq: {
      questions: product.faq.join('\n'),
      answerStrategy: '优先使用商品真实信息回答，不虚构销量、功效和绝对化承诺。',
    },
    compliance: {
      forbidden: forbiddenOptions,
      rewrite: '避免最低价、全网第一、夸大承诺、治疗功效等表达。',
    },
  };
}

function splitLines(value) {
  if (!value) {
    return [];
  }

  return String(value)
    .split('\n')
    .map((item) => item.replace(/^-\s*/, '').trim())
    .filter(Boolean);
}

function buildProductPayload(values, status) {
  const mainImage = values.mainImage?.[0];

  return {
    name: values.name,
    category: values.category,
    brand: values.brand,
    image: mainImage?.response?.file?.fileUrl || mainImage?.url || mainImage?.name || 'api-product',
    description: values.description,
    price: Number(values.spec?.price || 0),
    stock: Number(values.spec?.stock || 0),
    status,
    sellingPoints: splitLines(values.selling?.core),
    faq: splitLines(values.faq?.questions),
    scripts: values.script || {},
    forbiddenExpressions: values.compliance?.forbidden || forbiddenOptions,
  };
}

function buildDraftProduct(values) {
  return {
    name: values.name,
    category: values.category,
    brand: values.brand,
    price: Number(values.spec?.price || 0),
    stock: Number(values.spec?.stock || 0),
    description: values.description,
    sellingPoints: splitLines(values.selling?.core),
    faq: splitLines(values.faq?.questions),
    scripts: values.script || {},
    forbiddenExpressions: values.compliance?.forbidden || forbiddenOptions,
  };
}

export default function ProductForm({ mode = 'create', productId, initialValues, productName }) {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const isEdit = mode === 'edit';

  const handleMainImageUpload = async ({ file, onSuccess, onError }) => {
    try {
      const uploadedFile = await uploadFile({
        file,
        module: 'product',
        businessId: productId || 'new-product',
        fileType: 'image',
      });
      message.success('商品主图已上传到本地文件服务');
      onSuccess({ file: uploadedFile });
    } catch (error) {
      message.error(error.message || '商品主图上传失败');
      onError(error);
    }
  };

  const buildProductCopyPayload = () => ({
    sourcePage: isEdit ? '商品编辑' : '商品创建',
    productId: isEdit ? productId : undefined,
    draftProduct: buildDraftProduct(form.getFieldsValue(true)),
  });

  const handleAiInsert = (name, copy) => {
    form.setFields([
      {
        name: Array.isArray(name) ? name : [name],
        value: copy,
      },
    ]);
    message.success('AI 文案已插入当前字段，请人工确认后保存');
  };

  const aiTextProps = (name) => ({
    buildGeneratePayload: buildProductCopyPayload,
    onAiInsert: (_fieldName, copy) => handleAiInsert(name, copy),
  });

  const saveProduct = async ({ returnToList = false, status = '草稿' } = {}) => {
    if (returnToList) {
      await form.validateFields();
    } else {
      await form.validateFields(['name']);
    }

    const values = form.getFieldsValue(true);
    const payload = buildProductPayload(values, status);

    if (isEdit) {
      await updateProduct(productId, payload);
    } else {
      await createProduct(payload);
    }
  };

  const handleSaveDraft = async () => {
    try {
      await saveProduct({ status: '草稿' });
      message.success(isEdit ? '商品修改草稿已保存到本地 SQLite' : '商品草稿已保存到本地 SQLite');
    } catch (error) {
      if (!error.errorFields) {
        message.error(error.message || '保存草稿失败');
      }
    }
  };

  const handleSaveAndReturn = async () => {
    try {
      await saveProduct({ returnToList: true, status: isEdit ? undefined : '草稿' });
      message.success(isEdit ? '商品编辑已保存到本地 SQLite' : '商品已保存到本地 SQLite');
      navigate('/products/list');
    } catch (error) {
      if (!error.errorFields) {
        message.error(error.message || '商品保存失败');
      }
    }
  };

  const tabItems = [
    {
      key: 'base',
      label: '基础信息',
      children: (
        <Card className="panel-card">
          <div className="form-section-intro">维护单个商品的基础资料，列表页只展示摘要，不在列表中编辑复杂字段。</div>
          <div className="form-grid">
            <TextInput name="name" label="商品名称" required {...aiTextProps('name')} />
            <Form.Item name="category" label={aiLabel('商品分类')} rules={[{ required: true, message: '请选择商品分类' }]}>
              <Select placeholder="请选择商品分类" options={productCategories.map((item) => ({ label: item, value: item }))} />
            </Form.Item>
            <TextInput name="brand" label="商品品牌" action="AI优化" {...aiTextProps('brand')} />
            <TextInput name="link" label="商品链接" placeholder="https://example.com/product/demo" {...aiTextProps('link')} />
          </div>
          <Form.Item label="商品主图" name="mainImage" valuePropName="fileList" getValueFromEvent={(event) => event?.fileList}>
            <Upload.Dragger customRequest={handleMainImageUpload} maxCount={1} accept="image/png,image/jpeg,image/webp,image/gif">
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">点击或拖拽上传商品主图</p>
              <p className="ant-upload-hint">保存到本地 server/uploads，并记录到 SQLite file_assets。</p>
            </Upload.Dragger>
          </Form.Item>
          <TextInput name="description" label="商品简介" target="简介" action="AI改写" textarea {...aiTextProps('description')} />
        </Card>
      ),
    },
    {
      key: 'spec',
      label: '规格价格',
      children: (
        <Card className="panel-card">
          <div className="form-grid">
            <TextInput name={['spec', 'name']} label="规格名称" required {...aiTextProps(['spec', 'name'])} />
            <Form.Item name={['spec', 'price']} label={aiLabel('价格说明', '口播')} rules={[{ required: true, message: '请输入价格' }]}>
              <Input prefix="￥" placeholder="请输入价格" />
            </Form.Item>
            <Form.Item name={['spec', 'stock']} label="库存" rules={[{ required: true, message: '请输入库存' }]}>
              <Input placeholder="请输入库存" />
            </Form.Item>
            <TextInput name={['spec', 'delivery']} label="发货说明" target="简介" action="AI优化" {...aiTextProps(['spec', 'delivery'])} />
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
            <TextInput name={['selling', 'core']} label="核心卖点" target="卖点" textarea {...aiTextProps(['selling', 'core'])} />
            <TextInput name={['selling', 'audience']} label="适用人群" target="卖点" action="AI优化" textarea {...aiTextProps(['selling', 'audience'])} />
            <TextInput name={['selling', 'scene']} label="使用场景" target="卖点" action="AI生成" textarea {...aiTextProps(['selling', 'scene'])} />
            <TextInput name={['selling', 'advantage']} label="对比优势" target="合规改写" action="AI改写" textarea {...aiTextProps(['selling', 'advantage'])} />
            <TextInput name={['selling', 'promotion']} label="促销利益点" target="卖点" action="AI优化" textarea {...aiTextProps(['selling', 'promotion'])} />
          </div>
        </Card>
      ),
    },
    {
      key: 'script',
      label: '直播话术',
      children: (
        <Card className="panel-card">
          <div className="form-grid">
            <TextInput name={['script', 'opening']} label="开场介绍" target="口播" textarea {...aiTextProps(['script', 'opening'])} />
            <TextInput name={['script', 'sellingPoint']} label="卖点讲解" target="口播" action="AI优化" textarea {...aiTextProps(['script', 'sellingPoint'])} />
            <TextInput name={['script', 'price']} label="价格说明" target="口播" textarea {...aiTextProps(['script', 'price'])} />
            <TextInput name={['script', 'benefit']} label="福利说明" target="口播" textarea {...aiTextProps(['script', 'benefit'])} />
            <TextInput name={['script', 'urge']} label="催单话术" target="合规改写" action="AI改写" textarea {...aiTextProps(['script', 'urge'])} />
            <TextInput name={['script', 'afterSale']} label="售后说明" target="口播" action="AI优化" textarea {...aiTextProps(['script', 'afterSale'])} />
          </div>
        </Card>
      ),
    },
    {
      key: 'faq',
      label: '常见问题 FAQ',
      children: (
        <Card className="panel-card">
          <div className="form-grid">
            <TextInput name={['faq', 'questions']} label="常见问题回答" target="FAQ" textarea {...aiTextProps(['faq', 'questions'])} />
            <TextInput name={['faq', 'answerStrategy']} label="回答策略" target="FAQ" action="AI优化" textarea {...aiTextProps(['faq', 'answerStrategy'])} />
          </div>
        </Card>
      ),
    },
    {
      key: 'compliance',
      label: '合规限制',
      children: (
        <Card className="panel-card">
          <Form.Item name={['compliance', 'forbidden']} label="商品禁用表达" initialValue={forbiddenOptions}>
            <Checkbox.Group options={forbiddenOptions} />
          </Form.Item>
          <TextInput name={['compliance', 'rewrite']} label="合规改写备注" target="合规改写" action="AI改写" textarea {...aiTextProps(['compliance', 'rewrite'])} />
        </Card>
      ),
    },
  ];

  return (
    <Form form={form} layout="vertical" initialValues={initialValues || { compliance: { forbidden: forbiddenOptions } }}>
      {productName ? <div className="editing-product-name">当前商品：{productName}</div> : null}
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
  );
}
