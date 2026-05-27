import { Alert, Card, Collapse, Empty, Input, Select, Space, Tag, message } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import { getFaqCategories, getFaqList } from '../../services/helpService';

const defaultFaqCategories = getFaqCategories();

export default function Faq() {
  const [faqList, setFaqList] = useState([]);
  const [faqCategories, setFaqCategories] = useState(defaultFaqCategories);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState();

  const fetchFaq = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const data = await getFaqList({
        keyword,
        category,
        page: 1,
        pageSize: 100,
      });

      setFaqList(data.list || []);
      setFaqCategories(data.categories?.length ? data.categories : defaultFaqCategories);
    } catch (requestError) {
      const messageText = requestError.message || 'FAQ 加载失败';
      setError(messageText);
      message.error(messageText);
    } finally {
      setLoading(false);
    }
  }, [category, keyword]);

  useEffect(() => {
    fetchFaq();
  }, [fetchFaq]);

  const collapseItems = faqList.map((item) => ({
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
        description="面向运营和技术人员的常见问题库，当前通过本地 API 读取 SQLite 数据。"
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
        message="帮助中心知识库"
        description="FAQ 数据来自本地 SQLite；本阶段不连接真实外部知识库或工单系统。"
      />

      <Card className="panel-card" loading={loading}>
        {error ? <Alert className="placeholder-hint" type="error" showIcon message={error} /> : null}
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
        {collapseItems.length ? <Collapse items={collapseItems} /> : <Empty description={error ? '本地 API 暂无可展示数据' : '暂无符合条件的问题'} />}
      </Card>
    </>
  );
}
