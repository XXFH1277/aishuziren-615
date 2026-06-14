import { Result, Spin, message } from 'antd';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import AvatarForm, { mapAvatarToFormValues } from '../../components/AvatarForm';
import PageHeader from '../../components/PageHeader';
import { getAvatarById } from '../../services/avatarService';

export default function EditAvatar() {
  const { id } = useParams();
  const [avatar, setAvatar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function fetchAvatar() {
      setLoading(true);
      setError('');

      try {
        const data = await getAvatarById(id);
        if (active) {
          setAvatar(data);
        }
      } catch (requestError) {
        const messageText = requestError.message || '数字人详情加载失败';
        if (active) {
          setError(messageText);
        }
        message.error(messageText);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    fetchAvatar();

    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return <Spin tip="正在加载数字人详情..." />;
  }

  if (error || !avatar) {
    return <Result status="404" title="未找到数字人" subTitle={error || '本地 API 中未找到对应数字人。'} />;
  }

  return (
    <>
      <PageHeader
        title="编辑数字人"
        description="编辑某一个已有数字人的完整配置，形象源视频、LiveTalking 预处理和声音模型配置均读取/写入本地 API 与 SQLite。"
      />
      <AvatarForm mode="edit" avatarId={avatar.id} initialValues={mapAvatarToFormValues(avatar)} avatarName={avatar.name} />
    </>
  );
}
