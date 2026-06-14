import {
  DeleteOutlined,
  EditOutlined,
  FolderOpenOutlined,
  PlusOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons';
import { Alert, Button, Card, Empty, Input, Modal, Pagination, Select, Space, Spin, Tag, Typography, message } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import StatusTag from '../../components/StatusTag';
import {
  deleteAvatar,
  getAvatarCategories,
  getAvatarStatuses,
  getAvatars,
  getVoiceOptions,
} from '../../services/avatarService';
import { resolveFileUrl } from '../../services/fileService';

const avatarCategories = getAvatarCategories();
const avatarStatuses = getAvatarStatuses();
const voiceOptions = getVoiceOptions();

function isImageAsset(value) {
  const text = String(value || '').trim();
  if (!text) return false;
  return (
    text.startsWith('http://') ||
    text.startsWith('https://') ||
    text.startsWith('/') ||
    text.startsWith('data:image/') ||
    /\.(png|jpe?g|webp|gif)(\?.*)?$/i.test(text)
  );
}

function getAvatarImageSrc(avatar) {
  const photoUrl = avatar.imageSettings?.photo?.fileUrl;
  const directImage = photoUrl || avatar.avatarImage;
  return isImageAsset(directImage) ? resolveFileUrl(directImage) : '';
}

function getAvatarClassName(avatar) {
  const token = String(avatar.avatarImage || avatar.imageSettings?.template || 'test')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '');

  return token ? `avatar-thumb avatar-thumb-${token}` : 'avatar-thumb avatar-thumb-test';
}

function AvatarPreview({ avatar }) {
  const imageSrc = getAvatarImageSrc(avatar);

  if (imageSrc) {
    return (
      <div className="avatar-grid-photo">
        <img src={imageSrc} alt={`${avatar.name} 的头像`} />
      </div>
    );
  }

  return (
    <div className={getAvatarClassName(avatar)}>
      <span>{avatar.name?.slice(0, 2) || '数字'}</span>
    </div>
  );
}

function getRuntimeStatus(record) {
  const runtime = record.imageSettings?.liveRuntime || {};
  if (runtime.status === 'ready') return { label: '形象已预处理', color: 'green' };
  if (runtime.status === 'preprocessing') return { label: '形象预处理中', color: 'blue' };
  if (runtime.status === 'failed') return { label: '形象失败', color: 'red' };
  return { label: '待登记素材', color: 'default' };
}

function getVoiceLabel(record) {
  const voiceSettings = record.voiceSettings || {};
  const displayName = record.voiceName || voiceSettings.voiceName || '未命名音色';
  const engine = voiceSettings.voiceEngine || voiceSettings.engine || '未配置模型';
  const cloneMode = voiceSettings.cloneMode || '未配置';
  return `${displayName} · ${engine} / ${cloneMode}`;
}

export default function AvatarList() {
  const navigate = useNavigate();
  const [avatars, setAvatars] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState();
  const [category, setCategory] = useState();
  const [voice, setVoice] = useState();
  const [testingAvatar, setTestingAvatar] = useState(null);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 8, total: 0 });
  const voiceFilterOptions = useMemo(() => {
    const names = new Set(voiceOptions);

    avatars.forEach((avatar) => {
      const voiceName = avatar.voiceName || avatar.voiceSettings?.voiceName;
      if (voiceName) {
        names.add(voiceName);
      }
    });

    return Array.from(names).map((item) => ({ label: item, value: item }));
  }, [avatars]);

  const fetchAvatars = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const data = await getAvatars({
        keyword,
        status,
        category,
        voiceName: voice,
        page: pagination.current,
        pageSize: pagination.pageSize,
      });

      setAvatars(data.list || []);
      setPagination((current) => ({
        ...current,
        current: data.page || current.current,
        pageSize: data.pageSize || current.pageSize,
        total: data.total || 0,
      }));
    } catch (requestError) {
      const messageText = requestError.message || '数字人列表加载失败';
      setError(messageText);
      message.error(messageText);
    } finally {
      setLoading(false);
    }
  }, [category, keyword, pagination.current, pagination.pageSize, status, voice]);

  useEffect(() => {
    fetchAvatars();
  }, [fetchAvatars]);

  const resetToFirstPage = (updater) => {
    updater();
    setPagination((current) => ({ ...current, current: 1 }));
  };

  const handleDelete = (avatar) => {
    Modal.confirm({
      title: '删除数字人',
      content: `确认删除「${avatar.name}」吗？会删除本地数字人记录，并解除直播间里的绑定；不会删除你上传的源视频和音频文件。`,
      okText: '确认删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      async onOk() {
        try {
          const result = await deleteAvatar(avatar.id);
          message.success(
            `已删除「${avatar.name}」${
              result.clearedLiveRooms ? `，并解除 ${result.clearedLiveRooms} 个直播间绑定` : ''
            }`,
          );

          if (avatars.length === 1 && pagination.current > 1) {
            setPagination((current) => ({ ...current, current: current.current - 1 }));
          } else {
            await fetchAvatars();
          }
        } catch (deleteError) {
          message.error(deleteError.message || '删除数字人失败');
          throw deleteError;
        }
      },
    });
  };

  return (
    <>
      <PageHeader
        title="数字人列表"
        description="一个卡片代表一个可选主播形象。进入编辑页维护头像外观、声音、素材与本机 LiveTalking 预处理状态。"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/avatar/create')}>
            新建数字人
          </Button>
        }
      />
      <Card className="panel-card">
        {error ? <Alert className="placeholder-hint" type="error" showIcon message={error} /> : null}
        <div className="toolbar-row">
          <Input.Search
            allowClear
            placeholder="搜索数字人名称或人设"
            onSearch={(value) => resetToFirstPage(() => setKeyword(value))}
            onChange={(event) => resetToFirstPage(() => setKeyword(event.target.value))}
            style={{ maxWidth: 300 }}
          />
          <Select
            allowClear
            placeholder="状态筛选"
            value={status}
            onChange={(value) => resetToFirstPage(() => setStatus(value))}
            options={avatarStatuses.map((item) => ({ label: item, value: item }))}
            style={{ width: 150 }}
          />
          <Select
            allowClear
            placeholder="适合品类筛选"
            value={category}
            onChange={(value) => resetToFirstPage(() => setCategory(value))}
            options={avatarCategories.map((item) => ({ label: item, value: item }))}
            style={{ width: 170 }}
          />
          <Select
            allowClear
            placeholder="绑定音色筛选"
            value={voice}
            onChange={(value) => resetToFirstPage(() => setVoice(value))}
            options={voiceFilterOptions}
            style={{ width: 170 }}
          />
        </div>

        <Spin spinning={loading}>
          {avatars.length ? (
            <div className="avatar-card-grid">
              {avatars.map((avatar) => {
                const runtimeStatus = getRuntimeStatus(avatar);
                return (
                  <article className="avatar-grid-card" key={avatar.id}>
                    <div className="avatar-grid-head">
                      <AvatarPreview avatar={avatar} />
                      <div className="avatar-grid-title">
                        <Typography.Title level={5}>{avatar.name}</Typography.Title>
                        <Typography.Text type="secondary">{avatar.languageStyle || '未设置语言风格'}</Typography.Text>
                      </div>
                    </div>

                    <Typography.Paragraph className="avatar-grid-persona" ellipsis={{ rows: 2 }}>
                      {avatar.persona || '暂未填写人设定位'}
                    </Typography.Paragraph>

                    <div className="avatar-grid-tags">
                      {(avatar.suitableCategories || []).slice(0, 3).map((item) => (
                        <Tag color="blue" key={item}>
                          {item}
                        </Tag>
                      ))}
                      {(avatar.suitableCategories || []).length > 3 ? <Tag>+{avatar.suitableCategories.length - 3}</Tag> : null}
                    </div>

                    <div className="avatar-grid-meta">
                      <span>声音</span>
                      <strong>{getVoiceLabel(avatar)}</strong>
                    </div>
                    <div className="avatar-grid-status">
                      <Tag color={runtimeStatus.color}>{runtimeStatus.label}</Tag>
                      <StatusTag status={avatar.status} />
                    </div>

                    <div className="avatar-grid-actions">
                      <Button size="small" type="primary" icon={<EditOutlined />} onClick={() => navigate(`/avatar/${avatar.id}/edit`)}>
                        编辑
                      </Button>
                      <Button size="small" icon={<FolderOpenOutlined />} onClick={() => navigate(`/avatar/${avatar.id}/edit?tab=training`)}>
                        素材
                      </Button>
                      <Button size="small" icon={<PlayCircleOutlined />} onClick={() => setTestingAvatar(avatar)}>
                        测试
                      </Button>
                      <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(avatar)}>
                        删除
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <Empty description={error ? '本地 API 暂无可展示数据' : '暂无数字人数据'} />
          )}
        </Spin>

        <div className="avatar-grid-pagination">
          <Pagination
            current={pagination.current}
            pageSize={pagination.pageSize}
            total={pagination.total}
            showSizeChanger
            showTotal={(total) => `共 ${total} 个数字人`}
            onChange={(current, pageSize) => setPagination((value) => ({ ...value, current, pageSize }))}
          />
        </div>
      </Card>
      <Modal
        title="数字人测试"
        open={Boolean(testingAvatar)}
        onCancel={() => setTestingAvatar(null)}
        okText="进入编辑页测试"
        cancelText="关闭"
        onOk={() => {
          const avatar = testingAvatar;
          setTestingAvatar(null);
          if (avatar) {
            navigate(`/avatar/${avatar.id}/edit?tab=preview`);
          }
        }}
      >
        <p>测试对象：{testingAvatar?.name}</p>
        <p>测试预览已归到数字人编辑页；真实开播效果建议在直播中控台连接本机 LiveTalking 后测试。</p>
      </Modal>
    </>
  );
}
