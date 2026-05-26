import { RobotOutlined } from '@ant-design/icons';
import { Button, message } from 'antd';
import { useState } from 'react';
import AiGenerateModal from './AiGenerateModal';

export default function AiGenerateButton({
  target = '简介',
  fieldName,
  type = 'link',
  size = 'small',
  children = 'AI生成',
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button icon={<RobotOutlined />} type={type} size={size} onClick={() => setOpen(true)}>
        {children}
      </Button>
      <AiGenerateModal
        open={open}
        target={target}
        fieldName={fieldName}
        onCancel={() => setOpen(false)}
        onInsert={(copy) => {
          console.log('[Mock AI Insert]', fieldName || target, copy);
          message.info('已触发插入占位，本阶段不自动写入字段');
          setOpen(false);
        }}
      />
    </>
  );
}
