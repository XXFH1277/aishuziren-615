import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Form, Input, Typography, message } from 'antd';
import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getFirstAccessiblePath } from '../../mock/menu';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, loading, login, menuPermissions } = useAuth();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  if (!loading && isAuthenticated) {
    return <Navigate to={location.state?.from?.pathname || getFirstAccessiblePath(menuPermissions)} replace />;
  }

  const handleFinish = async (values) => {
    setSubmitting(true);

    try {
      const profile = await login(values);
      message.success('登录成功');
      navigate(location.state?.from?.pathname || getFirstAccessiblePath(profile.menuPermissions), { replace: true });
    } catch (error) {
      message.error(error.message || '登录失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="login-brand">
          <div className="brand-mark">DH</div>
          <div>
            <Typography.Title level={1}>数字人直播带货中控系统</Typography.Title>
            <Typography.Text type="secondary">本地管理入口</Typography.Text>
          </div>
        </div>

        <Card className="login-card">
          <Alert className="login-alert" type="info" showIcon message="本地演示账号：admin；初始密码请查看 server:seed 输出或设置 SEED_ADMIN_PASSWORD" />
          <Form
            form={form}
            layout="vertical"
            initialValues={{ username: 'admin' }}
            onFinish={handleFinish}
            requiredMark={false}
          >
            <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
              <Input prefix={<UserOutlined />} placeholder="请输入用户名" autoComplete="username" />
            </Form.Item>
            <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
              <Input.Password prefix={<LockOutlined />} placeholder="请输入密码" autoComplete="current-password" />
            </Form.Item>
            <Button type="primary" htmlType="submit" block loading={submitting}>
              登录
            </Button>
          </Form>
        </Card>
      </section>
    </main>
  );
}
