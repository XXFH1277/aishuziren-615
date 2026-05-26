import { CopyOutlined, EyeOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Card, Input, Select, Space, Table, Tag, Typography, message } from 'antd';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AiGenerateButton from '../../components/AiGenerateButton';
import PageHeader from '../../components/PageHeader';
import StatusTag from '../../components/StatusTag';
import { productCategories, productStatuses, products } from '../../mock/products';

const statusActionText = {
  已上架: '下架',
  草稿: '上架',
  已下架: '上架',
  待审核: '撤回',
};

export default function ProductList() {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState();
  const [status, setStatus] = useState();

  const filteredProducts = useMemo(
    () =>
      products.filter((product) => {
        const matchKeyword =
          !keyword ||
          product.name.toLowerCase().includes(keyword.toLowerCase()) ||
          product.brand.toLowerCase().includes(keyword.toLowerCase());
        const matchCategory = !category || product.category === category;
        const matchStatus = !status || product.status === status;
        return matchKeyword && matchCategory && matchStatus;
      }),
    [category, keyword, status],
  );

  const columns = [
    {
      title: '商品图片',
      dataIndex: 'image',
      width: 100,
      render: (_, record) => (
        <div className={`product-thumb product-thumb-${record.image}`} aria-label={record.name}>
          {record.name.slice(0, 2)}
        </div>
      ),
    },
    {
      title: '商品名称',
      dataIndex: 'name',
      width: 210,
      render: (name, record) => (
        <div>
          <Typography.Text strong>{name}</Typography.Text>
          <div className="table-subtext">{record.brand}</div>
        </div>
      ),
    },
    {
      title: '商品分类',
      dataIndex: 'category',
      width: 120,
      render: (value) => <Tag color="blue">{value}</Tag>,
    },
    {
      title: '售价',
      dataIndex: 'price',
      width: 100,
      render: (value) => `￥${value}`,
      sorter: (a, b) => a.price - b.price,
    },
    {
      title: '库存',
      dataIndex: 'stock',
      width: 100,
      sorter: (a, b) => a.stock - b.stock,
    },
    {
      title: '绑定商品组',
      dataIndex: 'groupName',
      width: 150,
    },
    {
      title: '上架状态',
      dataIndex: 'status',
      width: 110,
      render: (value) => <StatusTag status={value} />,
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      width: 160,
    },
    {
      title: '操作',
      fixed: 'right',
      width: 280,
      render: (_, record) => (
        <Space size={4} wrap>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => message.info(`查看 ${record.name}`)}>
            查看
          </Button>
          <Button type="link" size="small" onClick={() => message.info(`编辑 ${record.name}`)}>
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            icon={<CopyOutlined />}
            onClick={() => message.success(`已复制 ${record.name} 的 Mock 商品资料`)}
          >
            复制
          </Button>
          <Button type="link" size="small" danger={record.status === '已上架'} onClick={() => message.info('仅演示状态动作')}>
            {statusActionText[record.status]}
          </Button>
          <AiGenerateButton target="口播" fieldName={record.name} size="small">
            生成话术
          </AiGenerateButton>
        </Space>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="商品列表"
        description="管理直播带货商品资料、上架状态和商品组绑定情况，当前全部使用本地 Mock 数据。"
        extra={
          <Space wrap>
            <Button onClick={() => navigate('/products/ai-copy')}>AI商品文案</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/products/create')}>
              新建商品
            </Button>
          </Space>
        }
      />
      <Card className="panel-card">
        <div className="toolbar-row">
          <Input.Search
            allowClear
            placeholder="搜索商品名称或品牌"
            onSearch={setKeyword}
            onChange={(event) => setKeyword(event.target.value)}
            style={{ maxWidth: 300 }}
          />
          <Select
            allowClear
            placeholder="分类筛选"
            value={category}
            onChange={setCategory}
            options={productCategories.map((item) => ({ label: item, value: item }))}
            style={{ width: 160 }}
          />
          <Select
            allowClear
            placeholder="状态筛选"
            value={status}
            onChange={setStatus}
            options={productStatuses.map((item) => ({ label: item, value: item }))}
            style={{ width: 160 }}
          />
        </div>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filteredProducts}
          pagination={{ pageSize: 8, showTotal: (total) => `共 ${total} 个商品` }}
          scroll={{ x: 1320 }}
        />
      </Card>
    </>
  );
}
