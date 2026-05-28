import { FileTextOutlined, SafetyCertificateOutlined, SoundOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { Alert, Card, Col, Input, Row, Select, Space, Tabs, Tag, message } from 'antd';
import { useEffect, useState } from 'react';
import AiGenerateButton from '../../components/AiGenerateButton';
import PageHeader from '../../components/PageHeader';
import { getProducts } from '../../services/productService';

const copyScenes = [
  {
    key: 'description',
    title: '根据商品生成简介',
    target: '简介',
    icon: <FileTextOutlined />,
    description: '用于商品详情、直播间商品卡和运营素材摘要。',
  },
  {
    key: 'script',
    title: '根据商品生成直播话术',
    target: '口播',
    icon: <SoundOutlined />,
    description: '用于开场介绍、卖点讲解、价格说明和催单话术。',
  },
  {
    key: 'faq',
    title: '根据商品生成 FAQ',
    target: 'FAQ',
    icon: <QuestionCircleOutlined />,
    description: '用于整理观众高频问题和人工接管台参考回复。',
  },
  {
    key: 'compliance',
    title: '根据商品做合规改写',
    target: '合规改写',
    icon: <SafetyCertificateOutlined />,
    description: '用于检查夸大承诺、绝对化表达和敏感功效描述。',
  },
];

function SceneCard({ scene, selectedProduct }) {
  const [extraInput, setExtraInput] = useState('');

  const buildGeneratePayload = () => ({
    sourcePage: 'AI商品文案',
    productId: selectedProduct?.id,
    draftProduct: {
      ...(selectedProduct || {}),
      description: extraInput || selectedProduct?.description,
    },
  });

  return (
    <Card className="copy-scene-card">
      <div className="copy-scene-title">
        <span>
          {scene.icon} {scene.title}
        </span>
        <Tag color="default">Mock</Tag>
      </div>
      <p>{scene.description}</p>
      <Input.TextArea
        rows={4}
        value={extraInput}
        onChange={(event) => setExtraInput(event.target.value)}
        placeholder="可粘贴商品卖点、规格或已有话术，仅发送到本地 fake provider。"
      />
      <div className="copy-scene-actions">
        <AiGenerateButton target={scene.target} fieldName={scene.title} type="primary" buildGeneratePayload={buildGeneratePayload}>
          生成 fake 文案
        </AiGenerateButton>
      </div>
    </Card>
  );
}

export default function ProductAICopy() {
  const [products, setProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const selectedProduct = products.find((product) => product.id === selectedProductId) || null;

  useEffect(() => {
    async function fetchProducts() {
      try {
        const data = await getProducts({ pageSize: 100 });
        setProducts(data.list || []);
      } catch (error) {
        message.error(error.message || '商品数据加载失败');
      }
    }

    fetchProducts();
  }, []);

  const tabItems = [
    {
      key: 'single',
      label: '单品文案',
      children: (
        <>
          <Card className="panel-card ai-copy-selector">
            <Space wrap>
              <span>选择商品</span>
              <Select
                showSearch
                placeholder="请选择商品"
                style={{ minWidth: 240 }}
                value={selectedProductId || undefined}
                onChange={setSelectedProductId}
                options={products.map((product) => ({ label: product.name, value: product.id }))}
              />
              <span className="table-subtext">生成请求只访问本地 /api/ai/generate，不调用真实模型。</span>
            </Space>
          </Card>
          <Row gutter={[16, 16]}>
            {copyScenes.map((scene) => (
              <Col xs={24} lg={12} key={scene.key}>
                <SceneCard scene={scene} selectedProduct={selectedProduct} />
              </Col>
            ))}
          </Row>
        </>
      ),
    },
    {
      key: 'batch',
      label: '批量占位',
      children: (
        <Alert
          className="placeholder-hint"
          message="批量生成预留"
          description="后续可按商品组批量生成简介、直播话术和 FAQ。Phase 1 只保留入口，不调用真实模型服务。"
          type="info"
          showIcon
        />
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="AI商品文案"
        description="商品文案生成的前端占位页，覆盖简介、直播话术、FAQ 和合规改写，所有结果均为 Mock。"
      />
      <Tabs items={tabItems} />
    </>
  );
}
