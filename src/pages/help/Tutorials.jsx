import { BookOutlined, EyeOutlined } from '@ant-design/icons';
import { Button, Card, Col, Empty, Modal, Row, Select, Space, Tag, Typography, message } from 'antd';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import { getTutorialCategories, getTutorials } from '../../services/helpService';

const tutorials = getTutorials();
const tutorialCategories = getTutorialCategories();

const difficultyColor = {
  入门: 'green',
  中等: 'blue',
  进阶: 'orange',
};

export default function Tutorials() {
  const [category, setCategory] = useState();
  const [detail, setDetail] = useState(null);

  const filteredTutorials = useMemo(
    () => tutorials.filter((item) => !category || item.category === category),
    [category],
  );

  return (
    <>
      <PageHeader
        title="操作教程"
        description="面向运营人员的操作教程集合，覆盖商品、数字人、直播间、互动播控、AI模型和执行端配置。"
        extra={
          <Select
            allowClear
            placeholder="教程分类"
            value={category}
            onChange={setCategory}
            options={tutorialCategories.map((item) => ({ label: item, value: item }))}
            style={{ width: 180 }}
          />
        }
      />

      <Row gutter={[16, 16]}>
        {filteredTutorials.length ? (
          filteredTutorials.map((item) => (
            <Col xs={24} md={12} xl={8} key={item.id}>
              <Card
                className="help-tutorial-card"
                title={
                  <Space>
                    <BookOutlined />
                    <span>{item.title}</span>
                  </Space>
                }
                extra={<Tag color={difficultyColor[item.difficulty]}>{item.difficulty}</Tag>}
                actions={[
                  <Button type="link" icon={<EyeOutlined />} onClick={() => setDetail(item)} key="detail">
                    查看详情
                  </Button>,
                  <Button type="link" onClick={() => message.info('教程跳转为 Mock 操作，可通过详情中的相关页面进入')} key="mock">
                    入口提示
                  </Button>,
                ]}
              >
                <Space wrap>
                  <Tag color="blue">{item.category}</Tag>
                  <Tag>预计 {item.duration}</Tag>
                </Space>
                <ol className="help-tutorial-summary">
                  {item.summary.slice(0, 3).map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </Card>
            </Col>
          ))
        ) : (
          <Col span={24}>
            <Empty description="暂无符合条件的教程" />
          </Col>
        )}
      </Row>

      <Modal title={detail?.title || '教程详情'} open={Boolean(detail)} onCancel={() => setDetail(null)} footer={null}>
        {detail ? (
          <>
            <Space wrap>
              <Tag color="blue">{detail.category}</Tag>
              <Tag color={difficultyColor[detail.difficulty]}>{detail.difficulty}</Tag>
              <Tag>预计 {detail.duration}</Tag>
            </Space>
            <Typography.Title level={5}>步骤摘要</Typography.Title>
            <ol className="help-tutorial-summary">
              {detail.summary.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <Typography.Paragraph>
              相关页面：<Link to={detail.targetPage}>{detail.targetPage}</Link>
            </Typography.Paragraph>
          </>
        ) : null}
      </Modal>
    </>
  );
}
