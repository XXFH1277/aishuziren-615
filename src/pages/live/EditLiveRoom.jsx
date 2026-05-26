import { Result } from 'antd';
import { useParams } from 'react-router-dom';
import LiveRoomForm, { mapLiveRoomToFormValues } from '../../components/LiveRoomForm';
import PageHeader from '../../components/PageHeader';
import { liveRooms } from '../../mock/liveRooms';

export default function EditLiveRoom() {
  const { id } = useParams();
  const room = liveRooms.find((item) => item.id === id);

  if (!room) {
    return <Result status="404" title="未找到直播间" subTitle="当前编辑页只读取本地 Mock 直播间数据。" />;
  }

  return (
    <>
      <PageHeader
        title="编辑直播间"
        description="编辑某一个已有直播间配置。当前保存、预览、推流和播控均为前端 Mock。"
      />
      <LiveRoomForm mode="edit" initialValues={mapLiveRoomToFormValues(room)} roomName={room.name} />
    </>
  );
}
