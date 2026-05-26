import { PlusOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Col, Empty, Form, Input, Modal, Row, Select, Space, Spin, Tag, message } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import PageHeader from '../../components/PageHeader';
import { createProductGroup, getProductGroupTypes, getProductGroups, getProducts } from '../../services/productService';

const productGroupTypes = getProductGroupTypes();

const typeColors = {
  福利品: 'gold',
  主推品: 'blue',
  利润品: 'green',
  引流品: 'purple',
  返场品: 'magenta',
};

export default function ProductGroups() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [productGroups, setProductGroups] = useState([]);
  const [products, setProducts] = useState([]);
  const [form] = Form.useForm();

  const fetchProductGroups = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [groupData, productData] = await Promise.all([getProductGroups({ pageSize: 100 }), getProducts({ pageSize: 100 })]);
      setProductGroups(groupData.list || []);
      setProducts(productData.list || []);
    } catch (requestError) {
      const messageText = requestError.message || '商品组加载失败';
      setError(messageText);
      message.error(messageText);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProductGroups();
  }, [fetchProductGroups]);

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      await createProductGroup(values);
      message.success('商品组已创建并写入本地 SQLite');
      form.resetFields();
      setOpen(false);
      fetchProductGroups();
    } catch (requestError) {
      if (requestError.errorFields) {
        return;
      }
      message.error(requestError.message || '商品组创建失败');
    }
  };

  return (
    <>
      <PageHeader
        title="商品组"
        description="按直播场景管理福利品、主推品、利润品、引流品和返场品组合，当前通过本地 API 读取 SQLite 数据。"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
            新建商品组
          </Button>
        }
      />
      {error ? <Alert className="placeholder-hint" type="error" showIcon message={error} /> : null}
      <Spin spinning={loading}>
        {productGroups.length ? (
          <Row gutter={[16, 16]}>
            {productGroups.map((group) => (
              <Col xs={24} md={12} xl={8} key={group.id}>
                <Card
                  className="product-group-card"
                  title={group.name}
                  extra={<Tag color={typeColors[group.type]}>{group.type}</Tag>}
                  actions={[
                    <Button type="link" key="view" onClick={() => message.info(`查看 ${group.name}`)}>
                      查看
                    </Button>,
                    <Button type="link" key="edit" onClick={() => message.info(`编辑 ${group.name}`)}>
                      编辑
                    </Button>,
                    <Button type="link" key="copy" onClick={() => message.success(`已复制 ${group.name}`)}>
                      复制
                    </Button>,
                  ]}
                >
                  <div className="group-meta">
                    <span>商品数量</span>
                    <strong>{group.productCount}</strong>
                  </div>
                  <div className="group-meta">
                    <span>主推商品</span>
                    <strong>{group.mainProduct}</strong>
                  </div>
                  <div className="group-meta">
                    <span>适用直播间</span>
                    <strong>{group.liveRoom}</strong>
                  </div>
                  <div className="group-meta">
                    <span>更新时间</span>
                    <strong>{group.updatedAt}</strong>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        ) : (
          <Card className="panel-card">
            <Empty description={error ? '本地 API 暂无可展示数据' : '暂无商品组数据'} />
          </Card>
        )}
      </Spin>
      <Modal
        title="新建商品组"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={handleCreate}
        okText="创建商品组"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="商品组名称" rules={[{ required: true, message: '请输入商品组名称' }]}>
            <Input placeholder="请输入商品组名称" />
          </Form.Item>
          <Form.Item name="type" label="商品组类型" rules={[{ required: true, message: '请选择商品组类型' }]}>
            <Select options={productGroupTypes.map((item) => ({ label: item, value: item }))} placeholder="请选择商品组类型" />
          </Form.Item>
          <Form.Item name="mainProduct" label="主推商品" rules={[{ required: true, message: '请选择主推商品' }]}>
            <Select
              showSearch
              placeholder="请选择主推商品"
              options={products.map((product) => ({ label: product.name, value: product.name }))}
            />
          </Form.Item>
          <Form.Item name="liveRoom" label="适用直播间">
            <Input placeholder="例如：晚 8 点福利专场" />
          </Form.Item>
          <Form.Item label="说明">
            <Space direction="vertical" size={0}>
              <span>本弹窗会写入本地 SQLite 开发库。</span>
              <span>不会接真实电商接口或外部服务。</span>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
