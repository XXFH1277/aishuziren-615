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
  buildGeneratePayload,
  onInsert,
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
        buildGeneratePayload={buildGeneratePayload}
        onCancel={() => setOpen(false)}
        onInsert={(copy, meta) => {
          if (onInsert) {
            onInsert(copy, meta);
          } else {
            message.info('已生成文案，请人工确认后使用');
          }
          setOpen(false);
        }}
      />
    </>
  );
}
