import { PlusOutlined } from '@ant-design/icons';
import { Button, Card, Col, Form, Input, Modal, Row, Select, Space, Tag, message } from 'antd';
import { useState } from 'react';
import PageHeader from '../../components/PageHeader';
import { getProductGroupTypes, getProductGroups, getProducts } from '../../services/productService';

const productGroups = getProductGroups();
const productGroupTypes = getProductGroupTypes();
const products = getProducts();

const typeColors = {
  福利品: 'gold',
  主推品: 'blue',
  利润品: 'green',
  引流品: 'purple',
  返场品: 'magenta',
};

export default function ProductGroups() {
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  const handleCreate = async () => {
    await form.validateFields();
    message.success('商品组已创建，当前仅为前端 Mock 提示');
    form.resetFields();
    setOpen(false);
  };

  return (
    <>
      <PageHeader
        title="商品组"
        description="按直播场景管理福利品、主推品、利润品、引流品和返场品组合，当前使用 Mock 数据。"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
            新建商品组
          </Button>
        }
      />
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
      <Modal
        title="新建商品组（Mock）"
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
              <span>本弹窗只做前端表单演示。</span>
              <span>不会写入后端、数据库或真实电商接口。</span>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
