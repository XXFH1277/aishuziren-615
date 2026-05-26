import { Alert, Button, Card, Collapse, Empty, Input, Select, Space, Tag } from 'antd';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import { getFaqCategories, getFaqList } from '../../services/helpService';

const faqList = getFaqList();
const faqCategories = getFaqCategories();

export default function Faq() {
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState();

  const filteredFaq = useMemo(
    () =>
      faqList.filter((item) => {
        const lowerKeyword = keyword.toLowerCase();
        const matchKeyword =
          !keyword ||
          item.title.toLowerCase().includes(lowerKeyword) ||
          item.causes.join(' ').toLowerCase().includes(lowerKeyword) ||
          item.steps.join(' ').toLowerCase().includes(lowerKeyword);
        const matchCategory = !category || item.category === category;
        return matchKeyword && matchCategory;
      }),
    [category, keyword],
  );

  const collapseItems = filteredFaq.map((item) => ({
    key: item.id,
    label: (
      <Space wrap>
        <strong>{item.title}</strong>
        <Tag color="blue">{item.category}</Tag>
        {item.needSupport ? <Tag color="orange">可能需要技术支持</Tag> : <Tag color="green">可自助处理</Tag>}
      </Space>
    ),
    children: (
      <div className="help-faq-detail">
        <div>
          <h4>常见原因</h4>
          <ul>
            {item.causes.map((cause) => (
              <li key={cause}>{cause}</li>
            ))}
          </ul>
        </div>
        <div>
          <h4>解决步骤</h4>
          <ol>
            {item.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
        <Space wrap>
          <span>相关页面入口：</span>
          <Link to={item.relatedPage}>{item.relatedPage}</Link>
        </Space>
      </div>
    ),
  }));

  return (
    <>
      <PageHeader
        title="常见问题"
        description="面向运营和技术人员的常见问题库，帮助快速定位直播、数字人、互动播控、AI配置和执行端相关问题。"
        extra={
          <Input.Search
            allowClear
            placeholder="搜索问题、原因或处理步骤"
            onSearch={setKeyword}
            onChange={(event) => setKeyword(event.target.value)}
            style={{ width: 320 }}
          />
        }
      />

      <Alert
        className="help-alert"
        type="info"
        showIcon
        message="当前为帮助中心 Mock 知识库"
        description="所有问题、排查步骤和页面入口均为前端 Mock，不连接真实知识库或工单系统。"
      />

      <Card className="panel-card">
        <div className="toolbar-row">
          <Select
            allowClear
            placeholder="问题分类"
            value={category}
            onChange={setCategory}
            options={faqCategories.map((item) => ({ label: item, value: item }))}
            style={{ width: 220 }}
          />
          <Space wrap>
            {faqCategories.map((item) => (
              <Tag.CheckableTag key={item} checked={category === item} onChange={() => setCategory(category === item ? undefined : item)}>
                {item}
              </Tag.CheckableTag>
            ))}
          </Space>
        </div>
        {collapseItems.length ? <Collapse items={collapseItems} /> : <Empty description="暂无符合条件的问题" />}
      </Card>
    </>
  );
}
