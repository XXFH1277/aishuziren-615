import { Alert, Card, Empty, Space, Tag, Timeline, Typography, message } from 'antd';
import { useEffect, useState } from 'react';
import PageHeader from '../../components/PageHeader';
import { getChangelog } from '../../services/helpService';

export default function Changelog() {
  const [changelog, setChangelog] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;

    async function fetchChangelog() {
      setLoading(true);
      setError('');

      try {
        const data = await getChangelog({ page: 1, pageSize: 100 });

        if (!ignore) {
          setChangelog(data.list || []);
        }
      } catch (requestError) {
        const messageText = requestError.message || '更新日志加载失败';

        if (!ignore) {
          setError(messageText);
          message.error(messageText);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    fetchChangelog();

    return () => {
      ignore = true;
    };
  }, []);

  return (
    <>
      <PageHeader
        title="更新日志"
        description="查看系统原型各阶段版本更新记录，当前通过本地 API 读取 SQLite 数据。"
      />

      <Card className="panel-card" loading={loading}>
        {error ? <Alert className="placeholder-hint" type="error" showIcon message={error} /> : null}
        {changelog.length ? (
          <Timeline
            className="help-changelog-timeline"
            items={changelog.map((item) => ({
              color: item.important ? 'blue' : 'gray',
              children: (
                <div className="help-changelog-item">
                  <Space wrap>
                    <Typography.Title level={4}>{item.version} {item.title}</Typography.Title>
                    <Tag color={item.important ? 'red' : 'blue'}>{item.important ? '重要更新' : '常规更新'}</Tag>
                    <Tag>{item.updatedAt}</Tag>
                  </Space>
                  <div className="help-changelog-grid">
                    <div>
                      <h4>新增功能</h4>
                      <ul>
                        {item.features.map((feature) => (
                          <li key={feature}>{feature}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4>修复问题</h4>
                      <ul>
                        {item.fixes.map((fix) => (
                          <li key={fix}>{fix}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4>注意事项</h4>
                      <ul>
                        {item.notes.map((note) => (
                          <li key={note}>{note}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ),
            }))}
          />
        ) : (
          <Empty description={error ? '本地 API 暂无可展示数据' : '暂无更新日志'} />
        )}
      </Card>
    </>
  );
}
