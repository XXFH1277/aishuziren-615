import { Button, Form, Input, Modal, Select, Switch, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';

const targetOptions = ['简介', '卖点', '口播', 'FAQ', '合规改写'];
const styleOptions = ['专业', '亲切', '热情', '接地气', '数字人自然口吻'];
const lengthOptions = ['短', '中', '长', '15秒', '30秒', '60秒'];

function buildMockCopy({ target, style, length, fieldName }) {
  const field = fieldName ? `围绕「${fieldName}」` : '围绕当前商品';
  return `${field}生成一段${style || '专业'}风格的${target || '简介'} Mock 文案，长度为${length || '中'}。这里不会调用 Kimi / Mimo，也不会读取任何 API Key；后续接入真实服务前可先用这段文案检查页面流程。`;
}

export default function AiGenerateModal({ open, target = '简介', fieldName, onCancel, onInsert }) {
  const [form] = Form.useForm();
  const [result, setResult] = useState('');

  const initialValues = useMemo(
    () => ({
      target,
      style: '数字人自然口吻',
      length: target === '口播' ? '30秒' : '中',
      compliance: true,
    }),
    [target],
  );

  useEffect(() => {
    if (open) {
      form.setFieldsValue(initialValues);
      setResult(buildMockCopy({ ...initialValues, fieldName }));
    }
  }, [fieldName, form, initialValues, open]);

  const handleGenerate = async () => {
    const values = await form.validateFields();
    setResult(buildMockCopy({ ...values, fieldName }));
    message.success('已生成 Mock 文案，未调用真实 AI 服务');
  };

  const handleInsert = () => {
    if (onInsert) {
      onInsert(result);
    } else {
      message.info('已触发“插入当前字段”占位动作');
      console.log('[Mock AI Insert]', result);
    }
  };

  return (
    <Modal
      title="AI生成文案（Mock）"
      open={open}
      onCancel={onCancel}
      width={720}
      okText="重新生成"
      cancelText="关闭"
      onOk={handleGenerate}
      footer={(_, { OkBtn, CancelBtn }) => (
        <>
          <CancelBtn />
          <OkBtn />
          <Button type="primary" onClick={handleInsert}>
            插入当前字段
          </Button>
        </>
      )}
    >
      <Form form={form} layout="vertical" initialValues={initialValues}>
        <div className="ai-modal-grid">
          <Form.Item name="target" label="生成目标" rules={[{ required: true, message: '请选择生成目标' }]}>
            <Select options={targetOptions.map((item) => ({ label: item, value: item }))} />
          </Form.Item>
          <Form.Item name="style" label="文案风格" rules={[{ required: true, message: '请选择文案风格' }]}>
            <Select options={styleOptions.map((item) => ({ label: item, value: item }))} />
          </Form.Item>
          <Form.Item name="length" label="文案长度" rules={[{ required: true, message: '请选择文案长度' }]}>
            <Select options={lengthOptions.map((item) => ({ label: item, value: item }))} />
          </Form.Item>
          <Form.Item name="compliance" label="自动合规检测" valuePropName="checked">
            <Switch checkedChildren="开启" unCheckedChildren="关闭" />
          </Form.Item>
        </div>
        <Form.Item label="生成结果">
          <Input.TextArea value={result} rows={5} readOnly />
        </Form.Item>
      </Form>
    </Modal>
  );
}
