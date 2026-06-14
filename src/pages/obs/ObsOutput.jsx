import { useEffect, useMemo, useRef, useState } from 'react';
import { API_BASE_URL } from '../../services/request';

function buildApiUrl(path) {
  return new URL(path, API_BASE_URL).toString();
}

async function publicApiRequest(path, data = {}) {
  const response = await fetch(buildApiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const payload = await response.json();

  if (!response.ok || payload.code !== 0) {
    throw new Error(payload.message || payload.error?.reason || `HTTP ${response.status}`);
  }

  return payload.data;
}

function publicApiBeacon(path, data = {}) {
  const url = buildApiUrl(path);
  const body = JSON.stringify(data);

  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: 'application/json' });
    navigator.sendBeacon(url, blob);
    return;
  }

  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {});
}

function waitForIceGatheringComplete(peer) {
  return new Promise((resolve) => {
    if (peer.iceGatheringState === 'complete') {
      resolve();
      return;
    }

    const timer = setTimeout(resolve, 5000);
    const checkState = () => {
      if (peer.iceGatheringState === 'complete') {
        clearTimeout(timer);
        peer.removeEventListener('icegatheringstatechange', checkState);
        resolve();
      }
    };

    peer.addEventListener('icegatheringstatechange', checkState);
  });
}

function getQueryConfig() {
  const params = new URLSearchParams(window.location.search);

  return {
    avatarId: params.get('avatar') || params.get('avatarId') || params.get('figureId') || '',
    voiceEngine: params.get('voice') || params.get('voiceEngine') || 'voxcpm2',
    cloneMode: params.get('clone') || params.get('cloneMode') || 'hifi',
    fit: params.get('fit') === 'contain' ? 'contain' : 'cover',
    debug: params.get('debug') === '1',
  };
}

export default function ObsOutput() {
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const peerRef = useRef(null);
  const sessionRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const [status, setStatus] = useState('connecting');
  const [statusText, setStatusText] = useState('正在连接本机数字人画面');
  const [avatarId, setAvatarId] = useState('');
  const config = useMemo(() => getQueryConfig(), []);

  useEffect(() => {
    let cancelled = false;

    async function connectOutput() {
      const remoteStream = new MediaStream();
      remoteStreamRef.current = remoteStream;

      try {
        const created = await publicApiRequest('/api/obs-output/sessions', {
          avatar: config.avatarId,
          provider: 'livetalking',
          roomName: 'OBS 数字人输出页',
          voiceEngine: config.voiceEngine,
          cloneMode: config.cloneMode,
        });

        if (cancelled) return;

        const session = created.session;
        sessionRef.current = session;
        setAvatarId(created.avatar?.avatarId || session?.figureId || '');
        setStatusText('正在建立 WebRTC 视频流');

        const peer = new RTCPeerConnection({ sdpSemantics: 'unified-plan' });
        peerRef.current = peer;
        peer.addTransceiver('video', { direction: 'recvonly' });
        peer.addTransceiver('audio', { direction: 'recvonly' });

        const streamReady = new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('OBS 输出页连接数字人画面超时')), 30000);

          peer.addEventListener('track', (event) => {
            if (!remoteStream.getTracks().some((track) => track.id === event.track.id)) {
              remoteStream.addTrack(event.track);
            }

            if (videoRef.current) {
              videoRef.current.srcObject = remoteStream;
              videoRef.current.muted = true;
              videoRef.current.play().catch(() => {});
            }

            if (audioRef.current) {
              audioRef.current.srcObject = remoteStream;
              audioRef.current.muted = false;
              audioRef.current.volume = 1;
              audioRef.current.play().catch(() => {});
            }

            if (remoteStream.getVideoTracks().length) {
              clearTimeout(timer);
              resolve(remoteStream);
            }
          });
        });

        peer.addEventListener('connectionstatechange', () => {
          if (peer.connectionState === 'connected') {
            setStatus('connected');
            setStatusText('OBS 输出已连接');
          } else if (['failed', 'disconnected', 'closed'].includes(peer.connectionState)) {
            setStatus(peer.connectionState);
            setStatusText(peer.connectionState === 'closed' ? 'OBS 输出已关闭' : 'OBS 输出连接异常');
          }
        });

        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        await waitForIceGatheringComplete(peer);

        const answer = await publicApiRequest(`/api/obs-output/sessions/${session.id}/connect`, {
          sdp: peer.localDescription.sdp,
          type: peer.localDescription.type,
          avatar: created.avatar?.avatarId || session.figureId || '',
        });

        await peer.setRemoteDescription(new RTCSessionDescription({ type: answer.type || 'answer', sdp: answer.sdp }));
        await streamReady;

        if (!cancelled) {
          setStatus('connected');
          setStatusText('OBS 输出已连接');
        }
      } catch (error) {
        if (!cancelled) {
          setStatus('failed');
          setStatusText(error.message || 'OBS 输出页连接失败');
        }
      }
    }

    connectOutput();

    return () => {
      cancelled = true;
      publicApiBeacon('/api/obs-output/runtime/clear', {
        liveSessionId: sessionRef.current?.id || '',
        avatarId: sessionRef.current?.figureId || config.avatarId || '',
      });

      if (peerRef.current) {
        peerRef.current.close();
        peerRef.current = null;
      }

      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      if (audioRef.current) {
        audioRef.current.srcObject = null;
      }

      remoteStreamRef.current = null;
    };
  }, [config.avatarId, config.cloneMode, config.voiceEngine]);

  const shouldShowStatus = config.debug || status !== 'connected';

  return (
    <main className={`obs-output-page obs-output-${status}`} data-fit={config.fit}>
      <video ref={videoRef} autoPlay playsInline muted className="obs-output-video" />
      <audio ref={audioRef} autoPlay />
      {shouldShowStatus ? (
        <div className="obs-output-status">
          <strong>{statusText}</strong>
          <span>{avatarId ? `Avatar: ${avatarId}` : '未指定 Avatar，使用 LiveTalking 默认形象'}</span>
        </div>
      ) : null}
    </main>
  );
}
