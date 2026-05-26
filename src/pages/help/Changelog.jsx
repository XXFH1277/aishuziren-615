import { Card, Empty, Space, Tag, Timeline, Typography } from 'antd';
import PageHeader from '../../components/PageHeader';
import { getChangelog } from '../../services/helpService';

const changelog = getChangelog();

export default function Changelog() {
  return (
    <>
      <PageHeader
        title="更新日志"
        description="查看系统原型各阶段版本更新记录，帮助团队了解当前功能边界和注意事项。"
      />

      <Card className="panel-card">
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
          <Empty description="暂无更新日志" />
        )}
      </Card>
    </>
  );
}
