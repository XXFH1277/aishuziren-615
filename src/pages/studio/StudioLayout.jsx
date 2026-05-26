import { CopyOutlined, EyeOutlined } from '@ant-design/icons';
import { Button, Card, Empty, Modal, Space, Table, Tabs, Tag, message } from 'antd';
import { useMemo, useState } from 'react';
import LayerPanel from '../../components/LayerPanel';
import LivePreviewFrame from '../../components/LivePreviewFrame';
import PageHeader from '../../components/PageHeader';
import StatusTag from '../../components/StatusTag';
import { studioLayouts } from '../../mock/studioLayouts';

export default function StudioLayout() {
  const [selectedLayout, setSelectedLayout] = useState(studioLayouts[0]);
  const [previewOpen, setPreviewOpen] = useState(false);

  const columns = useMemo(
    () => [
      {
        title: '模板名称',
        dataIndex: 'name',
        width: 210,
        render: (name, record) => (
          <div>
            <strong>{name}</strong>
            <div className="table-subtext">{record.description}</div>
          </div>
        ),
      },
      { title: '画面比例', dataIndex: 'ratio', width: 110 },
      { title: '数字人位置', dataIndex: 'avatarPosition', width: 130 },
      { title: '商品区位置', dataIndex: 'productAreaPosition', width: 140 },
      { title: '弹幕区位置', dataIndex: 'danmuPosition', width: 130 },
      {
        title: '适合 OBS',
        dataIndex: 'suitableForObs',
        width: 100,
        render: (value) => (value ? <Tag color="green">适合</Tag> : <Tag>预留</Tag>),
      },
      { title: '状态', dataIndex: 'status', width: 110, render: (value) => <StatusTag status={value} /> },
      {
        title: '操作',
        fixed: 'right',
        width: 190,
        render: (_, record) => (
          <Space size={4}>
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => {
                setSelectedLayout(record);
                setPreviewOpen(true);
              }}
            >
              预览
            </Button>
            <Button
              type="link"
              size="small"
              onClick={() => {
                setSelectedLayout(record);
                message.success(`已应用「${record.name}」Mock 布局`);
              }}
            >
              应用
            </Button>
            <Button type="link" size="small" icon={<CopyOutlined />} onClick={() => message.success('已复制 Mock 布局模板')}>
              复制
            </Button>
          </Space>
        ),
      },
    ],
    [],
  );

  return (
    <>
      <PageHeader title="画面布局" description="配置直播间画面布局。当前不做真实拖拽引擎，仅提供模板选择、图层面板和 Mock 预览。" />

      <Tabs
        className="studio-tabs"
        items={[
          {
            key: 'templates',
            label: '布局模板',
            children: (
              <Card className="panel-card">
                <Table rowKey="id" columns={columns} dataSource={studioLayouts} pagination={false} scroll={{ x: 1180 }} />
              </Card>
            ),
          },
          {
            key: 'preview',
            label: '预览编辑',
            children: (
              <div className="studio-layout-grid">
                <Card
                  title="布局预览编辑区"
                  extra={<StatusTag status={selectedLayout.status} />}
                  className="panel-card"
                >
                  {selectedLayout ? (
                    <>
                      <div className="studio-layout-summary">
                        <strong>{selectedLayout.name}</strong>
                        <span>{selectedLayout.description}</span>
                      </div>
                      <LivePreviewFrame
                        ratio={selectedLayout.ratio}
                        backgroundColor={selectedLayout.name.includes('海岛') ? '#0ea5e9' : '#2563eb'}
                        title={selectedLayout.name}
                        showAvatar
                        showProduct
                        showDanmu
                        showCoupon={selectedLayout.hasCouponArea}
                        showLogo
                      />
                    </>
                  ) : (
                    <Empty description="请选择一个布局模板" />
                  )}
                </Card>
                <Card title="图层列表" className="panel-card">
                  <LayerPanel />
                </Card>
              </div>
            ),
          },
        ]}
      />

      <Modal title="布局预览" open={previewOpen} footer={null} onCancel={() => setPreviewOpen(false)} width={560}>
        <LivePreviewFrame
          ratio={selectedLayout.ratio}
          backgroundColor={selectedLayout.name.includes('海岛') ? '#0ea5e9' : '#2563eb'}
          title={selectedLayout.name}
          showAvatar
          showProduct
          showDanmu
          showCoupon={selectedLayout.hasCouponArea}
          showLogo
        />
      </Modal>
    </>
  );
}
