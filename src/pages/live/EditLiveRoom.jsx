import { Result, Spin, message } from 'antd';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import LiveRoomForm, { mapLiveRoomToFormValues } from '../../components/LiveRoomForm';
import PageHeader from '../../components/PageHeader';
import { getLiveRoomById } from '../../services/liveService';

export default function EditLiveRoom() {
  const { id } = useParams();
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function fetchLiveRoom() {
      setLoading(true);
      setError('');

      try {
        const data = await getLiveRoomById(id);
        if (active) {
          setRoom(data);
        }
      } catch (requestError) {
        const messageText = requestError.message || '直播间详情加载失败';
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

    fetchLiveRoom();

    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return <Spin tip="正在加载直播间详情..." />;
  }

  if (error || !room) {
    return <Result status="404" title="未找到直播间" subTitle={error || '本地 API 中未找到对应直播间。'} />;
  }

  return (
    <>
      <PageHeader
        title="编辑直播间"
        description="编辑某一个已有直播间配置，当前详情读取自本地 API / SQLite。预览、推流和播控仍为 Mock。"
      />
      <LiveRoomForm mode="edit" roomId={room.id} initialValues={mapLiveRoomToFormValues(room)} roomName={room.name} />
    </>
  );
}
