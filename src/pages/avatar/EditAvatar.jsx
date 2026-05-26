import { Result } from 'antd';
import { useParams } from 'react-router-dom';
import AvatarForm, { mapAvatarToFormValues } from '../../components/AvatarForm';
import PageHeader from '../../components/PageHeader';
import { getAvatarById } from '../../services/avatarService';

export default function EditAvatar() {
  const { id } = useParams();
  const avatar = getAvatarById(id);

  if (!avatar) {
    return <Result status="404" title="未找到数字人" subTitle="当前编辑页只读取本地 Mock 数字人数据。" />;
  }

  return (
    <>
      <PageHeader
        title="编辑数字人"
        description="编辑某一个已有数字人的完整配置。当前保存、预览和素材上传都只做前端 Mock。"
      />
      <AvatarForm mode="edit" initialValues={mapAvatarToFormValues(avatar)} avatarName={avatar.name} />
    </>
  );
}
