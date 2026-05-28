import { Alert, Button, Form, Input, Modal, Select, Switch, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { generateProductCopy } from '../services/aiService';

const targetOptions = ['简介', '卖点', '口播', 'FAQ', '合规改写'];
const styleOptions = ['专业', '亲切', '热情', '接地气', '数字人自然口吻'];
const lengthOptions = ['短', '中', '长', '15秒', '30秒', '60秒'];
const targetApiMap = {
  简介: 'description',
  卖点: 'selling_points',
  口播: 'live_script',
  FAQ: 'faq',
  合规改写: 'compliance_rewrite',
};

function buildMockCopy({ target, style, length, fieldName }) {
  const field = fieldName ? `围绕「${fieldName}」` : '围绕当前商品';
  return `${field}生成一段${style || '专业'}风格的${target || '简介'} Mock 文案，长度为${length || '中'}。这里不会调用 Kimi / Mimo，也不会读取任何 API Key；后续接入真实服务前可先用这段文案检查页面流程。`;
}

function normalizeTarget(value) {
  return targetApiMap[value] || value || 'description';
}

export default function AiGenerateModal({ open, target = '简介', fieldName, buildGeneratePayload, onCancel, onInsert }) {
  const [form] = Form.useForm();
  const [result, setResult] = useState('');
  const [riskTips, setRiskTips] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [generateMeta, setGenerateMeta] = useState(null);

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
      setRiskTips([]);
      setGenerateMeta(null);
    }
  }, [fieldName, form, initialValues, open]);

  const handleGenerate = async () => {
    const values = await form.validateFields();
    const apiTarget = normalizeTarget(values.target);

    if (!buildGeneratePayload) {
      setResult(buildMockCopy({ ...values, fieldName }));
      setRiskTips([{ message: '当前为前端占位生成，未调用真实 AI 服务。' }]);
      message.success('已生成 Mock 文案，未调用真实 AI 服务');
      return;
    }

    try {
      setGenerating(true);
      const payload = buildGeneratePayload(values) || {};
      const data = await generateProductCopy({
        ...payload,
        target: payload.target || apiTarget,
        sourcePage: payload.sourcePage || '商品编辑',
        options: {
          ...(payload.options || {}),
          style: values.style,
          length: values.length,
          complianceCheck: values.compliance,
        },
        realProvider: false,
      });
      setResult(data.content || '');
      setRiskTips(data.riskTips || []);
      setGenerateMeta(data);
      message.success('已通过本地 fake provider 生成文案，未调用真实模型');
    } catch (error) {
      message.error(error.message || 'AI 文案生成失败');
    } finally {
      setGenerating(false);
    }
  };

  const handleInsert = () => {
    if (onInsert) {
      onInsert(result, generateMeta);
    } else {
      message.info('已触发“插入当前字段”动作');
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
      confirmLoading={generating}
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
      <Alert
        className="ai-modal-alert"
        type="info"
        showIcon
        message="当前使用 fake provider，不调用真实模型。"
        description="请求会经过本地 /api/ai/generate，并写入脱敏调用日志和 fake 成本统计。"
      />
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
        {riskTips.length ? (
          <Alert
            type="warning"
            showIcon
            message="合规提醒"
            description={riskTips.map((item) => item.message || item).join('；')}
          />
        ) : null}
      </Form>
    </Modal>
  );
}
