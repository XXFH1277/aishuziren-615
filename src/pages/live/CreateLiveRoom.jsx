import PageHeader from '../../components/PageHeader';
import LiveRoomForm from '../../components/LiveRoomForm';

export default function CreateLiveRoom() {
  return (
    <>
      <PageHeader
        title="创建直播间"
        description="创建单个直播间配置，并在页内绑定平台、数字人、商品组、场景、互动和播控能力。"
      />
      <LiveRoomForm mode="create" />
    </>
  );
}
