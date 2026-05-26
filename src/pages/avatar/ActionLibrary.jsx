import { PlusOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { Button, Card, Col, Empty, Modal, Row, Space, Tabs, Tag, message } from 'antd';
import { useMemo, useState } from 'react';
import PageHeader from '../../components/PageHeader';
import StatusTag from '../../components/StatusTag';
import { getAvatarActionTypes, getAvatarActions } from '../../services/avatarService';

const avatarActions = getAvatarActions();
const actionTypes = getAvatarActionTypes();

export default function ActionLibrary() {
  const [previewAction, setPreviewAction] = useState(null);

  const tabItems = useMemo(
    () =>
      actionTypes.map((type) => ({
        key: type,
        label: type,
        children: (
          <Row gutter={[16, 16]}>
            {avatarActions.filter((action) => action.type === type).length ? (
              avatarActions
                .filter((action) => action.type === type)
                .map((action) => (
                <Col xs={24} md={12} xl={8} key={action.id}>
                  <Card className="action-card">
                    <div className="action-card-title">
                      <strong>{action.name}</strong>
                      <StatusTag status={action.status} />
                    </div>
                    <div className="group-meta">
                      <span>动作类型</span>
                      <Tag color="blue">{action.type}</Tag>
                    </div>
                    <div className="group-meta">
                      <span>触发场景</span>
                      <strong>{action.triggerScene}</strong>
                    </div>
                    <div className="group-meta">
                      <span>适用语气</span>
                      <strong>{action.suitableTone}</strong>
                    </div>
                    <p className="action-description">{action.description}</p>
                    <div className="copy-scene-actions">
                      <Button icon={<PlayCircleOutlined />} onClick={() => setPreviewAction(action)}>
                        预览
                      </Button>
                    </div>
                  </Card>
                </Col>
                ))
            ) : (
              <Col span={24}>
                <Empty description="暂无该分类动作，后续可通过新建动作补充" />
              </Col>
            )}
          </Row>
        ),
      })),
    [],
  );

  return (
    <>
      <PageHeader
        title="动作库"
        description="维护全局动作模板库，用于数字人互动、商品讲解、促单、空场和异常场景。"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => message.info('新建动作仅为 Mock 入口')}>
            新建动作
          </Button>
        }
      />
      <Tabs items={tabItems} />
      <Modal
        title="动作预览（Mock）"
        open={Boolean(previewAction)}
        onCancel={() => setPreviewAction(null)}
        okText="开始 Mock 预览"
        cancelText="关闭"
        onOk={() => {
          message.success('已触发 Mock 动作预览，未调用真实数字人服务');
          setPreviewAction(null);
        }}
      >
        <Space direction="vertical" size={8}>
          <span>动作名称：{previewAction?.name}</span>
          <span>触发场景：{previewAction?.triggerScene}</span>
          <span>预览结果：数字人将执行该动作的本地占位动画说明。</span>
        </Space>
      </Modal>
    </>
  );
}
