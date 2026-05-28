import { InboxOutlined, PlusOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Descriptions, Empty, Form, Input, List, Modal, Select, Space, Table, Timeline, Upload, message } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import PageHeader from '../../components/PageHeader';
import StatusTag from '../../components/StatusTag';
import { resolveFileUrl, uploadFile } from '../../services/fileService';
import { createTicket, getTicketStatuses, getTicketTypes, getTicketUrgencies, getTickets } from '../../services/helpService';

const { TextArea } = Input;
const ticketTypes = getTicketTypes();
const ticketUrgencies = getTicketUrgencies();
const ticketStatuses = getTicketStatuses();

export default function Tickets() {
  const [form] = Form.useForm();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState();
  const [type, setType] = useState();
  const [priority, setPriority] = useState();
  const [createOpen, setCreateOpen] = useState(false);
  const [detailRecord, setDetailRecord] = useState(null);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 6, total: 0 });

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const data = await getTickets({
        keyword,
        status,
        type,
        priority,
        page: pagination.current,
        pageSize: pagination.pageSize,
      });

      setTickets(data.list || []);
      setPagination((current) => ({
        ...current,
        current: data.page || current.current,
        pageSize: data.pageSize || current.pageSize,
        total: data.total || 0,
      }));
    } catch (requestError) {
      const messageText = requestError.message || '技术工单加载失败';
      setError(messageText);
      message.error(messageText);
    } finally {
      setLoading(false);
    }
  }, [keyword, pagination.current, pagination.pageSize, priority, status, type]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const resetToFirstPage = (updater) => {
    updater();
    setPagination((current) => ({ ...current, current: 1 }));
  };

  const handleAttachmentUpload = async ({ file, onSuccess, onError }) => {
    try {
      const uploadedFile = await uploadFile({
        file,
        module: 'ticket',
        businessId: 'new-ticket',
        fileType: file.type?.startsWith('image/') ? 'image' : 'document',
      });
      message.success('附件已上传到本地文件服务');
      onSuccess({ file: uploadedFile });
    } catch (uploadError) {
      message.error(uploadError.message || '附件上传失败');
      onError(uploadError);
    }
  };

  const handleCreate = async () => {
    setCreating(true);

    try {
      const values = await form.validateFields();

      const attachments = (values.attachments || [])
        .map((item) => item.response?.file)
        .filter(Boolean);

      await createTicket({
        ...values,
        relatedLiveRoom: values.liveRoom,
        relatedAvatar: values.avatar,
        relatedProduct: values.product,
        relatedExecutor: values.executor,
        attachmentIds: attachments.map((item) => item.fileId || item.id),
        attachments,
      });

      message.success('技术工单已写入本地 SQLite，附件已绑定到工单');
      form.resetFields();
      setCreateOpen(false);
      setPagination((current) => ({ ...current, current: 1 }));
      fetchTickets();
    } catch (requestError) {
      if (!requestError.errorFields) {
        message.error(requestError.message || '技术工单提交失败');
      }
    } finally {
      setCreating(false);
    }
  };

  const columns = [
    { title: '工单编号', dataIndex: 'id', width: 150 },
    { title: '标题', dataIndex: 'title', width: 210 },
    { title: '问题类型', dataIndex: 'type', width: 130 },
    { title: '紧急程度', dataIndex: 'urgency', width: 100, render: (value) => <StatusTag status={value} /> },
    { title: '关联直播间', dataIndex: 'liveRoom', width: 160 },
    { title: '关联数字人', dataIndex: 'avatar', width: 150 },
    { title: '关联执行端', dataIndex: 'executor', width: 150 },
    { title: '状态', dataIndex: 'status', width: 100, render: (value) => <StatusTag status={value} /> },
    { title: '提交人', dataIndex: 'submitter', width: 100 },
    { title: '提交时间', dataIndex: 'submittedAt', width: 150 },
    {
      title: '操作',
      fixed: 'right',
      width: 200,
      render: (_, record) => (
        <Space size={4} wrap>
          <Button type="link" size="small" onClick={() => setDetailRecord(record)}>
            查看
          </Button>
          <Button type="link" size="small" onClick={() => message.info('回复工单为 Mock 操作')}>
            回复
          </Button>
          <Button type="link" size="small" danger onClick={() => message.warning('关闭工单为 Mock 操作')}>
            关闭
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="技术工单"
        description="提交和查看技术工单，当前通过本地 API 读取并写入 SQLite；不发送邮件，不接企业微信 / 飞书 / 钉钉，也不接真实工单系统。"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            新建工单
          </Button>
        }
      />

      <Card className="panel-card">
        {error ? <Alert className="placeholder-hint" type="error" showIcon message={error} /> : null}
        <div className="toolbar-row">
          <Input.Search
            allowClear
            placeholder="搜索工单编号、标题或描述"
            onSearch={(value) => resetToFirstPage(() => setKeyword(value))}
            onChange={(event) => resetToFirstPage(() => setKeyword(event.target.value))}
            style={{ maxWidth: 320 }}
          />
          <Select
            allowClear
            placeholder="问题类型"
            value={type}
            onChange={(value) => resetToFirstPage(() => setType(value))}
            options={ticketTypes.map((item) => ({ label: item, value: item }))}
            style={{ width: 160 }}
          />
          <Select
            allowClear
            placeholder="紧急程度"
            value={priority}
            onChange={(value) => resetToFirstPage(() => setPriority(value))}
            options={ticketUrgencies.map((item) => ({ label: item, value: item }))}
            style={{ width: 130 }}
          />
          <Select
            allowClear
            placeholder="工单状态"
            value={status}
            onChange={(value) => resetToFirstPage(() => setStatus(value))}
            options={ticketStatuses.map((item) => ({ label: item, value: item }))}
            style={{ width: 140 }}
          />
        </div>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={tickets}
          loading={loading}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showTotal: (total) => `共 ${total} 个工单`,
          }}
          onChange={(nextPagination) =>
            setPagination((current) => ({
              ...current,
              current: nextPagination.current,
              pageSize: nextPagination.pageSize,
            }))
          }
          scroll={{ x: 1680 }}
          locale={{ emptyText: <Empty description={error ? '本地 API 暂无可展示数据' : '暂无符合条件的工单'} /> }}
        />
      </Card>

      <Modal
        title="新建技术工单"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={handleCreate}
        okText="提交工单"
        confirmLoading={creating}
        width={760}
      >
        <Form form={form} layout="vertical">
          <div className="form-grid">
            <Form.Item name="type" label="问题类型" rules={[{ required: true, message: '请选择问题类型' }]}>
              <Select options={ticketTypes.map((item) => ({ label: item, value: item }))} />
            </Form.Item>
            <Form.Item name="urgency" label="紧急程度" rules={[{ required: true, message: '请选择紧急程度' }]}>
              <Select options={ticketUrgencies.map((item) => ({ label: item, value: item }))} />
            </Form.Item>
            <Form.Item name="liveRoom" label="关联直播间">
              <Input placeholder="例如：舟山海鲜礼盒晚场" />
            </Form.Item>
            <Form.Item name="avatar" label="关联数字人">
              <Input placeholder="例如：海岛好物推荐官" />
            </Form.Item>
            <Form.Item name="product" label="关联商品">
              <Input placeholder="例如：舟山海鲜礼盒" />
            </Form.Item>
            <Form.Item name="executor" label="关联执行端">
              <Input placeholder="例如：公司直播电脑01" />
            </Form.Item>
          </div>
          <Form.Item name="description" label="问题描述" rules={[{ required: true, message: '请填写问题描述' }]}>
            <TextArea rows={4} placeholder="请描述看到的现象、出现时间和已尝试的处理步骤" />
          </Form.Item>
          <Form.Item label="附件" name="attachments" valuePropName="fileList" getValueFromEvent={(event) => event?.fileList}>
            <Upload.Dragger customRequest={handleAttachmentUpload} maxCount={3} accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,text/plain">
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">点击或拖拽截图、PDF 或日志文件到这里</p>
              <p className="ant-upload-hint">保存到本地 server/uploads，并随工单写入 SQLite。</p>
            </Upload.Dragger>
          </Form.Item>
          <Form.Item name="contact" label="联系方式">
            <Input placeholder="手机号、邮箱或企业 IM，当前不发送真实通知" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="工单详情" open={Boolean(detailRecord)} onCancel={() => setDetailRecord(null)} footer={null} width={760}>
        {detailRecord ? (
          <>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="工单编号">{detailRecord.id}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <StatusTag status={detailRecord.status} />
              </Descriptions.Item>
              <Descriptions.Item label="标题">{detailRecord.title}</Descriptions.Item>
              <Descriptions.Item label="紧急程度">
                <StatusTag status={detailRecord.urgency} />
              </Descriptions.Item>
              <Descriptions.Item label="关联直播间">{detailRecord.liveRoom}</Descriptions.Item>
              <Descriptions.Item label="关联执行端">{detailRecord.executor}</Descriptions.Item>
              <Descriptions.Item label="提交人">{detailRecord.submitter}</Descriptions.Item>
              <Descriptions.Item label="提交时间">{detailRecord.submittedAt}</Descriptions.Item>
            </Descriptions>
            <Timeline
              className="help-ticket-timeline"
              items={[
                { color: 'blue', children: `用户描述：${detailRecord.description}` },
                { color: 'orange', children: `系统诊断 Mock：${detailRecord.diagnosis}` },
                { color: 'red', children: `错误日志 Mock：${detailRecord.errorLog}` },
                { color: 'green', children: `技术回复 Mock：${detailRecord.reply}` },
                { color: 'gray', children: `解决记录 Mock：${detailRecord.resolution}` },
              ]}
            />
            <Card size="small" title="附件" className="help-ticket-attachments">
              <List
                size="small"
                dataSource={detailRecord.attachments || []}
                locale={{ emptyText: '暂无附件' }}
                renderItem={(item) => (
                  <List.Item
                    actions={[
                      <a key="open" href={resolveFileUrl(item.fileUrl)} target="_blank" rel="noreferrer">
                        打开
                      </a>,
                    ]}
                  >
                    <List.Item.Meta
                      title={item.fileName}
                      description={`${item.fileType || 'file'} · ${Math.max(1, Math.round((item.size || 0) / 1024))} KB`}
                    />
                  </List.Item>
                )}
              />
            </Card>
          </>
        ) : null}
      </Modal>
    </>
  );
}
