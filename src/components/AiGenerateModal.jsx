import { Alert, Button, Form, Input, Modal, Select, Switch, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { generateProductCopy, getAiRuntimePolicy, getModelRoleSettings } from '../services/aiService';

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
  return `${field}生成一段${style || '专业'}风格的${target || '简介'} Mock 文案，长度为${length || '中'}。这里不会调用真实模型，也不会读取任何 API Key；接入真实模型前可先用这段文案检查页面流程。`;
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
  const [realProvider, setRealProvider] = useState({ available: false, providerId: '', label: '' });
  const [useReal, setUseReal] = useState(false);

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
    if (!open) {
      return undefined;
    }

    form.setFieldsValue(initialValues);
    setResult(buildMockCopy({ ...initialValues, fieldName }));
    setRiskTips([]);
    setGenerateMeta(null);

    let ignore = false;

    async function loadRealStatus() {
      try {
        const [policyRes, defaultsRes] = await Promise.all([getAiRuntimePolicy(), getModelRoleSettings({})]);
        if (ignore) return;
        const policy = policyRes.policy || {};
        const copy = (defaultsRes.list || []).find((item) => item.id === 'copywriting');
        const available = Boolean(policy.realProviderEnabled && copy?.providerId);
        setRealProvider({ available, providerId: copy?.providerId || '', label: copy?.value || '' });
        setUseReal(available);
      } catch {
        if (!ignore) {
          setRealProvider({ available: false, providerId: '', label: '' });
          setUseReal(false);
        }
      }
    }

    loadRealStatus();

    return () => {
      ignore = true;
    };
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

    const willUseReal = Boolean(useReal && realProvider.available);

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
        realProvider: willUseReal,
        providerId: willUseReal ? realProvider.providerId : payload.providerId,
      });
      setResult(data.content || '');
      setRiskTips(data.riskTips || []);
      setGenerateMeta(data);

      if (data.error) {
        message.error(data.message || '真实模型调用失败');
      } else if (data.realProviderEnabled) {
        message.success('已通过真实模型生成文案');
      } else if (data.blocked) {
        message.warning(data.message || '真实模型未通过安全闸，已回退');
      } else {
        message.success('已通过本地 fake provider 生成文案，未调用真实模型');
      }
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

  const realActive = realProvider.available && useReal;

  return (
    <Modal
      title={realActive ? 'AI生成文案（真实模型）' : 'AI生成文案（Mock）'}
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
        type={realActive ? 'success' : 'info'}
        showIcon
        message={realActive ? `将调用真实模型：${realProvider.label || '已配置默认模型'}` : '当前使用 fake provider，不调用真实模型。'}
        description={
          realProvider.available
            ? '请求经过本地 /api/ai/generate + 安全闸（频率/预算/超时）与合规检查，并写入脱敏日志。'
            : '请求会经过本地 /api/ai/generate，并写入脱敏调用日志和 fake 成本统计。到「模型服务配置」配置并启用真实模型后可切换。'
        }
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
        {realProvider.available ? (
          <Form.Item label="使用真实模型">
            <Switch checked={useReal} onChange={setUseReal} checkedChildren="真实" unCheckedChildren="Mock" />
          </Form.Item>
        ) : null}
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
