import {
  CheckCircleOutlined,
  CloudUploadOutlined,
  DownloadOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Empty,
  Form,
  Input,
  InputNumber,
  List,
  Progress,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import PageHeader from '../../components/PageHeader';
import { getAvatars } from '../../services/avatarService';
import { uploadFile, resolveFileUrl } from '../../services/fileService';
import { closeLiveSession, connectLiveSession, getLiveSessionEngines, openLiveSession, speakLiveSession } from '../../services/liveSessionService';
import {
  createTalkingVideoJob,
  finishTalkingVideoJob,
  getTalkingVideoJobs,
  updateTalkingVideoJobStatus,
} from '../../services/talkingVideoService';

const ratioOptions = [
  { label: '9:16 竖屏', value: '9:16' },
  { label: '16:9 横屏', value: '16:9' },
  { label: '1:1 方形', value: '1:1' },
];

const resolutionOptions = [
  { label: '720p 高码率', value: '720p' },
  { label: '1080p 高码率', value: '1080p' },
];

const statusColorMap = {
  created: 'blue',
  recording: 'processing',
  completed: 'green',
  failed: 'red',
  cancelled: 'default',
};

const statusLabelMap = {
  created: '待录制',
  recording: '录制中',
  completed: '已完成',
  failed: '失败',
  cancelled: '已取消',
};

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForIceGatheringComplete(peer) {
  return new Promise((resolve) => {
    if (peer.iceGatheringState === 'complete') {
      resolve();
      return;
    }

    const checkState = () => {
      if (peer.iceGatheringState === 'complete') {
        peer.removeEventListener('icegatheringstatechange', checkState);
        resolve();
      }
    };

    peer.addEventListener('icegatheringstatechange', checkState);
  });
}

function getAvatarRuntime(avatar) {
  return avatar?.imageSettings?.liveRuntime || {};
}

function getAvatarRuntimeId(avatar) {
  const runtime = getAvatarRuntime(avatar);
  return runtime.livetalkingAvatarId || runtime.avatarId || runtime.preprocessedAvatarId || '';
}

function estimateDurationSeconds(text = '', bufferSeconds = 3, customSeconds = 0) {
  const explicitSeconds = Number(customSeconds || 0);
  if (explicitSeconds > 0) {
    return Math.min(Math.max(explicitSeconds, 3), 300);
  }

  const cleanLength = String(text || '').replace(/\s+/g, '').length;
  return Math.min(Math.max(Math.ceil(cleanLength / 4) + Number(bufferSeconds || 3), 8), 240);
}

function getRecorderMimeType() {
  const candidates = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  return candidates.find((item) => window.MediaRecorder?.isTypeSupported?.(item)) || 'video/webm';
}

function createSafeFileName(value = 'talking-video') {
  return String(value || 'talking-video')
    .replace(/[\\/:*?"<>|\s]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'talking-video';
}

function formatFileSize(size = 0) {
  const value = Number(size || 0);
  if (!value) return '-';
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)}KB`;
  return `${(value / 1024 / 1024).toFixed(1)}MB`;
}

function JobStatusTag({ status }) {
  return <Tag color={statusColorMap[status] || 'default'}>{statusLabelMap[status] || status || '未知'}</Tag>;
}

export default function TalkingVideoGenerator() {
  const [form] = Form.useForm();
  const videoRef = useRef(null);
  const peerRef = useRef(null);
  const recorderRef = useRef(null);
  const [avatars, setAvatars] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [engineLoading, setEngineLoading] = useState(false);
  const [engineConfig, setEngineConfig] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [activeJob, setActiveJob] = useState(null);
  const [recordingStatus, setRecordingStatus] = useState('idle');
  const [previewStreamReady, setPreviewStreamReady] = useState(false);
  const [lastError, setLastError] = useState('');

  const watchedAvatarId = Form.useWatch('avatarId', form);
  const watchedText = Form.useWatch('scriptText', form) || '';
  const watchedProvider = Form.useWatch('provider', form) || 'livetalking';
  const watchedBufferSeconds = Form.useWatch('recordBufferSeconds', form) || 3;
  const watchedRecordSeconds = Form.useWatch('recordSeconds', form) || 0;
  const selectedAvatar = useMemo(() => avatars.find((item) => item.id === watchedAvatarId), [avatars, watchedAvatarId]);
  const selectedRuntime = getAvatarRuntime(selectedAvatar);
  const selectedRuntimeId = getAvatarRuntimeId(selectedAvatar);
  const estimatedDuration = estimateDurationSeconds(watchedText, watchedBufferSeconds, watchedRecordSeconds);
  const health = engineConfig?.health || {};
  const canRecord = watchedProvider === 'livetalking' && health.ok && selectedRuntimeId && !generating;

  async function loadData() {
    try {
      setLoading(true);
      const [avatarResult, jobResult] = await Promise.all([
        getAvatars({ pageSize: 100 }),
        getTalkingVideoJobs({ pageSize: 20 }),
      ]);
      setAvatars(avatarResult.list || []);
      setJobs(jobResult.list || []);
    } catch (requestError) {
      message.error(requestError.message || '口播视频生成数据加载失败');
    } finally {
      setLoading(false);
    }
  }

  async function loadJobs() {
    try {
      setJobsLoading(true);
      const result = await getTalkingVideoJobs({ pageSize: 20 });
      setJobs(result.list || []);
    } catch (requestError) {
      message.error(requestError.message || '生成记录加载失败');
    } finally {
      setJobsLoading(false);
    }
  }

  async function loadEngines() {
    try {
      setEngineLoading(true);
      const result = await getLiveSessionEngines({ provider: watchedProvider });
      setEngineConfig(result);
      form.setFieldsValue({
        provider: result.defaultProvider || 'livetalking',
        voiceEngine: result.defaultVoiceEngine || 'voxcpm2',
        cloneMode: result.defaultCloneMode || 'hifi',
      });
    } catch (requestError) {
      setEngineConfig({
        health: {
          ok: false,
          provider: watchedProvider,
          message: requestError.message || '本机数字人引擎不可用',
        },
        providers: [{ label: '本机 LiveTalking', value: 'livetalking' }],
        voiceEngines: [
          { label: 'VoxCPM2', value: 'voxcpm2' },
          { label: 'GPT-SoVITS', value: 'gpt-sovits' },
        ],
        cloneModes: [
          { label: '普通克隆', value: 'reference' },
          { label: 'Hi-Fi 深度克隆', value: 'hifi' },
        ],
      });
    } finally {
      setEngineLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    loadEngines();

    return () => {
      stopPreview();
    };
  }, []);

  function stopPreview() {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }

    if (peerRef.current) {
      peerRef.current.close();
      peerRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setPreviewStreamReady(false);
  }

  async function connectRecordingStream(session, avatarId) {
    const peer = new RTCPeerConnection({ sdpSemantics: 'unified-plan' });
    const remoteStream = new MediaStream();
    peerRef.current = peer;

    peer.addTransceiver('video', { direction: 'recvonly' });
    peer.addTransceiver('audio', { direction: 'recvonly' });

    const streamReady = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('数字人画面连接超时')), 30000);

      peer.addEventListener('track', (event) => {
        if (!remoteStream.getTracks().some((track) => track.id === event.track.id)) {
          remoteStream.addTrack(event.track);
        }

        if (videoRef.current) {
          videoRef.current.srcObject = remoteStream;
          videoRef.current.muted = true;
          videoRef.current.play().catch(() => {});
        }

        if (remoteStream.getVideoTracks().length) {
          clearTimeout(timer);
          setPreviewStreamReady(true);
          resolve(remoteStream);
        }
      });
    });

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    await waitForIceGatheringComplete(peer);

    const answer = await connectLiveSession(session.id, {
      sdp: peer.localDescription.sdp,
      type: peer.localDescription.type,
      avatar: avatarId,
    });

    await peer.setRemoteDescription(new RTCSessionDescription({ type: answer.type || 'answer', sdp: answer.sdp }));
    const stream = await streamReady;

    return {
      stream,
      runtimeSessionId: answer.sessionid || '',
    };
  }

  function recordStream(stream, durationSeconds, speakAction) {
    return new Promise((resolve, reject) => {
      const mimeType = getRecorderMimeType();
      const chunks = [];
      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;

      recorder.addEventListener('dataavailable', (event) => {
        if (event.data?.size) {
          chunks.push(event.data);
        }
      });

      recorder.addEventListener('error', () => {
        reject(new Error('浏览器录制数字人视频失败'));
      });

      recorder.addEventListener('stop', () => {
        resolve({
          blob: new Blob(chunks, { type: mimeType }),
          mimeType,
        });
      });

      recorder.start(1000);
      speakAction()
        .then(async () => {
          await wait(durationSeconds * 1000);
          if (recorder.state !== 'inactive') {
            recorder.stop();
          }
        })
        .catch((error) => {
          if (recorder.state !== 'inactive') {
            recorder.stop();
          }
          reject(error);
        });
    });
  }

  async function handleGenerate() {
    let session = null;
    let job = null;

    try {
      const values = await form.validateFields();

      if (!window.MediaRecorder) {
        message.error('当前浏览器不支持 MediaRecorder，无法录制视频');
        return;
      }

      if (!selectedRuntimeId) {
        message.warning('请先在数字人管理里完成 LiveTalking 形象预处理，并保存 avatar id');
        return;
      }

      setGenerating(true);
      setLastError('');
      setRecordingStatus('creating');
      stopPreview();

      const createResult = await createTalkingVideoJob({
        ...values,
        avatarName: selectedAvatar?.name || '',
        liveTalkingAvatarId: selectedRuntimeId,
      });

      job = createResult.job;
      setActiveJob(job);

      if (createResult.riskTips?.length) {
        message.warning(`合规提示：${createResult.riskTips.map((item) => item.keyword || item.text).filter(Boolean).join('、')}`);
      }

      await updateTalkingVideoJobStatus(job.id, { status: 'recording', progress: 20 });
      setRecordingStatus('connecting');

      const opened = await openLiveSession({
        roomName: values.title,
        figureId: selectedRuntimeId,
        mode: 'video-generate',
        provider: values.provider,
        voiceEngine: values.voiceEngine,
        cloneMode: values.cloneMode,
      });
      session = opened.session;

      const { stream, runtimeSessionId } = await connectRecordingStream(session, selectedRuntimeId);
      await updateTalkingVideoJobStatus(job.id, { status: 'recording', progress: 45 });
      setRecordingStatus('recording');

      const durationSeconds = estimateDurationSeconds(values.scriptText, values.recordBufferSeconds, values.recordSeconds);
      const startedAt = Date.now();
      const recorded = await recordStream(stream, durationSeconds, async () => {
        await speakLiveSession(session.id, {
          text: values.scriptText,
          provider: values.provider,
          voiceEngine: values.voiceEngine,
          cloneMode: values.cloneMode,
          liveTalkingSessionId: runtimeSessionId,
        });
      });

      setRecordingStatus('uploading');
      await updateTalkingVideoJobStatus(job.id, { status: 'recording', progress: 80 });

      const fileName = `${job.id}-${createSafeFileName(values.title)}.webm`;
      const file = new File([recorded.blob], fileName, { type: recorded.mimeType });
      const uploaded = await uploadFile({
        file,
        module: 'talking_videos',
        businessId: job.id,
        fileType: 'video',
      });

      const completed = await finishTalkingVideoJob(job.id, {
        outputFileId: uploaded.fileId || uploaded.id,
        outputFileName: uploaded.fileName || fileName,
        outputVideoUrl: uploaded.fileUrl,
        outputLocalPath: uploaded.localPath || '',
        mimeType: uploaded.mimeType || recorded.mimeType,
        fileSize: uploaded.size || recorded.blob.size,
        durationSeconds: Math.max((Date.now() - startedAt) / 1000, durationSeconds),
      });

      setActiveJob(completed);
      setRecordingStatus('completed');
      message.success('口播数字人视频已生成并保存到本地');
      await loadJobs();
    } catch (requestError) {
      const errorText = requestError.message || '口播视频生成失败';
      setLastError(errorText);
      setRecordingStatus('failed');
      message.error(errorText);

      if (job?.id) {
        await updateTalkingVideoJobStatus(job.id, {
          status: 'failed',
          errorMessage: errorText,
        }).catch(() => {});
        await loadJobs().catch(() => {});
      }
    } finally {
      if (session?.id) {
        await closeLiveSession(session.id).catch(() => {});
      }
      setGenerating(false);
      stopPreview();
    }
  }

  const latestCompletedJob = activeJob?.status === 'completed'
    ? activeJob
    : jobs.find((item) => item.status === 'completed' && item.outputVideoUrl);

  return (
    <>
      <PageHeader
        title="短视频口播生成"
        description="独立于直播中控的短视频生产工具。输入文案后调用本机数字人和所选声音模型，生成适合发布引流的无字幕口播视频。"
        extra={
          <Space wrap>
            <Button icon={<ReloadOutlined />} onClick={loadJobs} loading={jobsLoading}>
              刷新记录
            </Button>
          </Space>
        }
      />

      <Spin spinning={loading}>
        <div className="talking-video-layout">
          <section className="talking-video-main">
            <Card className="panel-card" title="生成配置">
              <Alert
                className="control-room-alert"
                type={health.ok ? 'success' : 'warning'}
                showIcon
                message={health.ok ? '本机 LiveTalking 引擎可用' : '本机 LiveTalking 引擎不可用'}
                description={health.ok ? `当前服务：${health.baseUrl || '127.0.0.1:8010'}` : health.message || '请先启动 LiveTalking。'}
              />
              <Alert
                className="control-room-alert"
                type="info"
                showIcon
                message="生成链路：文本输入 -> 声音模型生成音频 -> 数字人生成视频 -> 保存成片"
                description="这一页只负责生成可发布的口播成片，不写入直播任务、不进入待播队列，也不会自动叠加字幕层。"
              />

              <Form
                form={form}
                layout="vertical"
                initialValues={{
                  title: '舟山海鲜礼盒短视频口播',
                  provider: 'livetalking',
                  voiceEngine: 'voxcpm2',
                  cloneMode: 'hifi',
                  ratio: '9:16',
                  resolution: '720p',
                  recordBufferSeconds: 3,
                  recordSeconds: 0,
                  scriptText: '大家好，今天给大家看一款适合家里常备的舟山海鲜礼盒，规格清楚，搭配也比较实在。不管是自己吃，还是送亲友都很合适，想了解的话可以先看详情再下单。',
                }}
              >
                <div className="talking-video-script-box">
                  <Typography.Text strong>第一步：输入短视频口播文本</Typography.Text>
                  <Typography.Text type="secondary">
                    这里的文本会先交给 VoxCPM2 或 GPT-SoVITS 生成讲解音频，再把音频送进 LiveTalking 合成数字人口播视频。
                  </Typography.Text>
                  <Form.Item name="scriptText" label="文本输入 / 口播文案" rules={[{ required: true, message: '请输入口播文案' }]}>
                    <Input.TextArea rows={8} placeholder="输入要让数字人播报的引流或带货文案，例如产品卖点、福利说明、下单引导。" />
                  </Form.Item>
                </div>

                <div className="form-grid">
                  <Form.Item name="title" label="短视频标题" rules={[{ required: true, message: '请输入短视频标题' }]}>
                    <Input placeholder="例如：舟山海鲜礼盒短视频口播" />
                  </Form.Item>
                  <Form.Item name="avatarId" label="数字人形象" rules={[{ required: true, message: '请选择数字人' }]}>
                    <Select
                      showSearch
                      placeholder="选择已预处理的数字人"
                      optionFilterProp="label"
                      options={avatars.map((item) => ({
                        label: `${item.name}${getAvatarRuntimeId(item) ? '' : '（未登记 LiveTalking）'}`,
                        value: item.id,
                      }))}
                    />
                  </Form.Item>
                  <Form.Item name="provider" label="数字人引擎">
                    <Select
                      loading={engineLoading}
                      options={(engineConfig?.providers || [{ label: '本机 LiveTalking', value: 'livetalking' }]).map((item) => ({
                        label: item.label,
                        value: item.value,
                      }))}
                    />
                  </Form.Item>
                  <Form.Item name="voiceEngine" label="声音模型">
                    <Select
                      options={(engineConfig?.voiceEngines || []).map((item) => ({
                        label: item.label,
                        value: item.value,
                      }))}
                    />
                  </Form.Item>
                  <Form.Item name="cloneMode" label="克隆模式">
                    <Select
                      options={(engineConfig?.cloneModes || []).map((item) => ({
                        label: item.label,
                        value: item.value,
                      }))}
                    />
                  </Form.Item>
                  <Form.Item name="ratio" label="画面比例">
                    <Select options={ratioOptions} />
                  </Form.Item>
                  <Form.Item name="resolution" label="目标规格">
                    <Select options={resolutionOptions} />
                  </Form.Item>
                  <Form.Item name="recordBufferSeconds" label="结尾缓冲秒数">
                    <InputNumber min={1} max={20} style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item name="recordSeconds" label="手动录制秒数">
                    <InputNumber min={0} max={300} style={{ width: '100%' }} addonAfter="0=自动" />
                  </Form.Item>
                </div>
              </Form>

              {selectedAvatar ? (
                <Descriptions bordered size="small" column={2} className="talking-video-desc">
                  <Descriptions.Item label="数字人">{selectedAvatar.name}</Descriptions.Item>
                  <Descriptions.Item label="LiveTalking ID">{selectedRuntimeId || '未登记'}</Descriptions.Item>
                  <Descriptions.Item label="形象状态">{selectedRuntime.status || selectedAvatar.status || '-'}</Descriptions.Item>
                  <Descriptions.Item label="预计录制">{estimatedDuration} 秒</Descriptions.Item>
                </Descriptions>
              ) : null}

              {!selectedRuntimeId && selectedAvatar ? (
                <Alert
                  className="control-room-alert"
                  type="warning"
                  showIcon
                  message="当前数字人还没有登记 LiveTalking avatar id"
                  description="请先到数字人管理的“素材与模型”里完成预处理，或选择已经预处理好的数字人。"
                />
              ) : null}

              {lastError ? <Alert className="control-room-alert" type="error" showIcon message={lastError} /> : null}

              <Space wrap className="talking-video-actions">
                <Button
                  type="primary"
                  icon={<ThunderboltOutlined />}
                  loading={generating}
                  disabled={!canRecord}
                  onClick={handleGenerate}
                >
                  根据文本生成短视频
                </Button>
                <Button icon={<ReloadOutlined />} onClick={loadEngines} loading={engineLoading}>
                  检查引擎
                </Button>
              </Space>
            </Card>

            <Card className="panel-card" title="成片记录">
              <List
                loading={jobsLoading}
                dataSource={jobs}
                locale={{ emptyText: <Empty description="暂无短视频任务" /> }}
                renderItem={(item) => (
                  <List.Item
                    actions={[
                      item.outputVideoUrl ? (
                        <Button
                          key="play"
                          type="link"
                          icon={<PlayCircleOutlined />}
                          href={resolveFileUrl(item.outputVideoUrl)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          播放
                        </Button>
                      ) : null,
                      item.outputVideoUrl ? (
                        <Button
                          key="download"
                          type="link"
                          icon={<DownloadOutlined />}
                          href={resolveFileUrl(item.outputVideoUrl)}
                          download={item.outputFileName || true}
                        >
                          下载
                        </Button>
                      ) : null,
                    ].filter(Boolean)}
                  >
                    <List.Item.Meta
                      title={
                        <Space wrap size={6}>
                          <Typography.Text strong>{item.title}</Typography.Text>
                          <JobStatusTag status={item.status} />
                          <Tag>{item.voiceEngine} / {item.cloneMode}</Tag>
                        </Space>
                      }
                      description={
                        <Space direction="vertical" size={4}>
                          <span>{item.avatarName || '未绑定数字人'} · {item.ratio || '-'} · {item.resolution || '-'}</span>
                          <Typography.Text type="secondary" ellipsis>
                            {item.scriptText}
                          </Typography.Text>
                          <span>{item.outputFileName || '等待录制文件'} {item.fileSize ? `· ${formatFileSize(item.fileSize)}` : ''}</span>
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            </Card>
          </section>

          <aside className="talking-video-side">
            <Card
              className="panel-card talking-video-preview-card"
              title="实时生成预览"
              extra={recordingStatus === 'completed' ? <CheckCircleOutlined className="status-success-icon" /> : <VideoCameraOutlined />}
            >
              <div className="talking-video-preview">
                <video ref={videoRef} playsInline muted controls={false} />
                {!previewStreamReady ? (
                  <div className="talking-video-preview-empty">
                    <VideoCameraOutlined />
                    <span>{generating ? '正在连接数字人画面' : '开始生成后显示数字人画面'}</span>
                  </div>
                ) : null}
              </div>
              <Descriptions column={1} size="small" className="control-room-compact-desc">
                <Descriptions.Item label="任务">{activeJob?.id || '-'}</Descriptions.Item>
                <Descriptions.Item label="状态">
                  <JobStatusTag status={activeJob?.status || (generating ? 'recording' : 'created')} />
                </Descriptions.Item>
                <Descriptions.Item label="录制阶段">{recordingStatus}</Descriptions.Item>
              </Descriptions>
              <Progress
                percent={activeJob?.progress || (recordingStatus === 'completed' ? 100 : generating ? 45 : 0)}
                status={recordingStatus === 'failed' ? 'exception' : recordingStatus === 'completed' ? 'success' : 'active'}
              />
            </Card>

            <Card className="panel-card" title="最近成片">
              {latestCompletedJob?.outputVideoUrl ? (
                <video
                  className="talking-video-output"
                  src={resolveFileUrl(latestCompletedJob.outputVideoUrl)}
                  controls
                />
              ) : (
                <Empty description="暂无已完成视频" />
              )}
              {latestCompletedJob ? (
                <Descriptions column={1} size="small" className="control-room-compact-desc">
                  <Descriptions.Item label="标题">{latestCompletedJob.title}</Descriptions.Item>
                  <Descriptions.Item label="文件">{latestCompletedJob.outputFileName || '-'}</Descriptions.Item>
                  <Descriptions.Item label="大小">{formatFileSize(latestCompletedJob.fileSize)}</Descriptions.Item>
                </Descriptions>
              ) : null}
            </Card>

            <Alert
              type="info"
              showIcon
              icon={<CloudUploadOutlined />}
              message="生成结果会保存到本地 server/uploads/talking_videos"
              description="当前输出格式为浏览器录制的 WebM，适合本机预览和测试。后续接入离线渲染器后，可以再增加 MP4 转码和封面导出。"
            />
          </aside>
        </div>
      </Spin>
    </>
  );
}
