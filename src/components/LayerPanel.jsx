import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  EditOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  LockOutlined,
  UnlockOutlined,
} from '@ant-design/icons';
import { Button, List, Space, Tag, Tooltip, message } from 'antd';
import { useState } from 'react';
import { studioLayers } from '../mock/studioLayouts';

export default function LayerPanel() {
  const [layers, setLayers] = useState(studioLayers);

  const toggleVisible = (id) => {
    setLayers((items) => items.map((item) => (item.id === id ? { ...item, visible: !item.visible } : item)));
    message.info('图层显示状态已做 Mock 切换');
  };

  const toggleLocked = (id) => {
    setLayers((items) => items.map((item) => (item.id === id ? { ...item, locked: !item.locked } : item)));
    message.info('图层锁定状态已做 Mock 切换');
  };

  const mockAction = (label) => {
    message.info(`${label}为 Mock 操作，当前不修改真实画布`);
  };

  return (
    <List
      className="studio-layer-list"
      dataSource={layers}
      renderItem={(layer) => (
        <List.Item
          actions={[
            <Tooltip title={layer.visible ? '隐藏' : '显示'} key="visible">
              <Button
                size="small"
                icon={layer.visible ? <EyeOutlined /> : <EyeInvisibleOutlined />}
                onClick={() => toggleVisible(layer.id)}
              />
            </Tooltip>,
            <Tooltip title="上移" key="up">
              <Button size="small" icon={<ArrowUpOutlined />} onClick={() => mockAction('图层上移')} />
            </Tooltip>,
            <Tooltip title="下移" key="down">
              <Button size="small" icon={<ArrowDownOutlined />} onClick={() => mockAction('图层下移')} />
            </Tooltip>,
            <Tooltip title={layer.locked ? '解锁' : '锁定'} key="lock">
              <Button size="small" icon={layer.locked ? <LockOutlined /> : <UnlockOutlined />} onClick={() => toggleLocked(layer.id)} />
            </Tooltip>,
            <Tooltip title="编辑" key="edit">
              <Button size="small" icon={<EditOutlined />} onClick={() => mockAction('图层编辑')} />
            </Tooltip>,
          ]}
        >
          <List.Item.Meta
            title={
              <Space>
                <span>{layer.name}</span>
                <Tag>{layer.type}</Tag>
              </Space>
            }
            description={layer.visible ? '当前显示在预览画面中' : '当前已隐藏'}
          />
        </List.Item>
      )}
    />
  );
}
