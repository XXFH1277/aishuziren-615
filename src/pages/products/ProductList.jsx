import { CopyOutlined, EyeOutlined, PlusOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Empty, Input, Select, Space, Table, Tag, Typography, message } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import StatusTag from '../../components/StatusTag';
import { resolveFileUrl } from '../../services/fileService';
import { getProductCategories, getProductStatuses, getProducts, updateProductStatus } from '../../services/productService';

const productCategories = getProductCategories();
const productStatuses = getProductStatuses();

const statusActionText = {
  已上架: '下架',
  草稿: '上架',
  已下架: '上架',
  待审核: '上架',
};

function ProductThumb({ record }) {
  if (record.image?.startsWith('/uploads/')) {
    return <img className="product-thumb product-thumb-image" src={resolveFileUrl(record.image)} alt={record.name} />;
  }

  return (
    <div className={`product-thumb product-thumb-${record.image}`} aria-label={record.name}>
      {record.name.slice(0, 2)}
    </div>
  );
}

export default function ProductList() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState();
  const [status, setStatus] = useState();
  const [pagination, setPagination] = useState({ current: 1, pageSize: 8, total: 0 });

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const data = await getProducts({
        keyword,
        category,
        status,
        page: pagination.current,
        pageSize: pagination.pageSize,
      });

      setProducts(data.list || []);
      setPagination((current) => ({
        ...current,
        current: data.page || current.current,
        pageSize: data.pageSize || current.pageSize,
        total: data.total || 0,
      }));
    } catch (requestError) {
      const messageText = requestError.message || '商品列表加载失败';
      setError(messageText);
      message.error(messageText);
    } finally {
      setLoading(false);
    }
  }, [category, keyword, pagination.current, pagination.pageSize, status]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const resetToFirstPage = (updater) => {
    updater();
    setPagination((current) => ({ ...current, current: 1 }));
  };

  const handleStatusAction = async (record) => {
    const nextStatus = record.status === '已上架' ? '已下架' : '已上架';

    try {
      await updateProductStatus(record.id, nextStatus);
      message.success(`已${statusActionText[record.status]}「${record.name}」`);
      fetchProducts();
    } catch (requestError) {
      message.error(requestError.message || '商品状态更新失败');
    }
  };

  const columns = [
    {
      title: '商品图片',
      dataIndex: 'image',
      width: 100,
      render: (_, record) => <ProductThumb record={record} />,
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
      width: 230,
      render: (_, record) => (
        <Space size={4} wrap>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => navigate(`/products/${record.id}/edit`)}>
            查看
          </Button>
          <Button type="link" size="small" onClick={() => navigate(`/products/${record.id}/edit`)}>
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
          <Button type="link" size="small" danger={record.status === '已上架'} onClick={() => handleStatusAction(record)}>
            {statusActionText[record.status]}
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="商品列表"
        description="管理直播带货商品资料、上架状态和商品组绑定情况，当前通过本地 API 读取 SQLite 数据。"
        extra={
          <Space wrap>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/products/create')}>
              新建商品
            </Button>
          </Space>
        }
      />
      <Card className="panel-card">
        {error ? <Alert className="placeholder-hint" type="error" showIcon message={error} /> : null}
        <div className="toolbar-row">
          <Input.Search
            allowClear
            placeholder="搜索商品名称或品牌"
            onSearch={(value) => resetToFirstPage(() => setKeyword(value))}
            onChange={(event) => resetToFirstPage(() => setKeyword(event.target.value))}
            style={{ maxWidth: 300 }}
          />
          <Select
            allowClear
            placeholder="分类筛选"
            value={category}
            onChange={(value) => resetToFirstPage(() => setCategory(value))}
            options={productCategories.map((item) => ({ label: item, value: item }))}
            style={{ width: 160 }}
          />
          <Select
            allowClear
            placeholder="状态筛选"
            value={status}
            onChange={(value) => resetToFirstPage(() => setStatus(value))}
            options={productStatuses.map((item) => ({ label: item, value: item }))}
            style={{ width: 160 }}
          />
        </div>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={products}
          loading={loading}
          locale={{ emptyText: <Empty description={error ? '本地 API 暂无可展示数据' : '暂无商品数据'} /> }}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showTotal: (total) => `共 ${total} 个商品`,
          }}
          onChange={(nextPagination) =>
            setPagination((current) => ({
              ...current,
              current: nextPagination.current,
              pageSize: nextPagination.pageSize,
            }))
          }
          scroll={{ x: 1320 }}
        />
      </Card>
    </>
  );
}
