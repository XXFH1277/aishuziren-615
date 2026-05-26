import PageHeader from '../../components/PageHeader';
import AvatarForm from '../../components/AvatarForm';

export default function CreateAvatar() {
  return (
    <>
      <PageHeader
        title="创建数字人"
        description="创建单个数字人，并在页内维护基础信息、形象、声音、行为规则、测试预览、训练素材和授权信息。"
      />
      <AvatarForm mode="create" />
    </>
  );
}
