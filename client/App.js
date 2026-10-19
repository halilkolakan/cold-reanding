import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BlurTargetView, BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import AnalysisHUD from './components/AnalysisHUD';
import CyberFaceViewer from './components/CyberFaceViewer';
import './global.css';

const ANALYZE_API_URL = 'http://172.2.0.29:3000/api/analyze';

function GlassCard({ children, targetRef, className = '' }) {
  return (
    <View
      className={`relative overflow-hidden rounded-3xl border border-sky-300/15 bg-slate-900/70 ${className}`}
    >
      <BlurView
        blurTarget={targetRef}
        blurMethod="dimezisBlurViewSdk31Plus"
        intensity={24}
        tint="dark"
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}

export default function App() {
  const blurTargetRef = useRef(null);
  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [taskId, setTaskId] = useState(null);
  const [taskStatus, setTaskStatus] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [pollError, setPollError] = useState(null);

  useEffect(() => {
    if (!taskId || taskStatus === 'completed' || taskStatus === 'failed') {
      return undefined;
    }

    let active = true;
    let requestInFlight = false;

    async function checkTask() {
      if (requestInFlight) {
        return;
      }
      requestInFlight = true;

      try {
        const response = await fetch(
          `${ANALYZE_API_URL}/${encodeURIComponent(taskId)}`,
        );
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.message || 'Analiz durumu alınamadı.');
        }

        if (!active) {
          return;
        }

        setPollError(null);
        setTaskStatus(result.status);

        if (result.status === 'completed') {
          setAnalysis(result.analysis);
        } else if (result.status === 'failed') {
          setPollError(result.error || 'Video analizi tamamlanamadı.');
        }
      } catch (error) {
        if (active) {
          setPollError(
            error instanceof Error
              ? error.message
              : 'Analiz durumu kontrol edilemedi.',
          );
        }
      } finally {
        requestInFlight = false;
      }
    }

    void checkTask();
    const interval = setInterval(() => {
      void checkTask();
    }, 3000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [taskId, taskStatus]);

  async function chooseVideo() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      });

      if (!result.canceled) {
        const asset = result.assets[0];
        const filename = asset.uri.split('/').pop() || 'video.mp4';
        setVideo({ ...asset, name: filename });
        setTaskId(null);
        setTaskStatus(null);
        setAnalysis(null);
        setPollError(null);
      }
    } catch (error) {
      Alert.alert(
        'Video açılamadı',
        error instanceof Error ? error.message : 'Beklenmeyen bir hata oluştu.',
      );
    }
  }

  async function startAnalysis() {
    if (!video) {
      Alert.alert('Önce bir video seçin', 'Analize başlamak için video yükleyin.');
      return;
    }

    setLoading(true);
    setTaskId(null);
    setTaskStatus(null);
    setAnalysis(null);
    setPollError(null);

    try {
      const formData = new FormData();
      const filename = video.uri.split('/').pop() || 'video.mp4';
      const videoFile = new File(video.uri);
      formData.append('video', videoFile, filename);

      const response = await fetch(ANALYZE_API_URL, {
        method: 'POST',
        body: formData,
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Video sunucuya gönderilemedi.');
      }

      if (result.status !== 'success' || !result.taskId) {
        throw new Error('Sunucudan geçerli bir analiz yanıtı alınamadı.');
      }

      setTaskId(String(result.taskId));
      setTaskStatus('processing');
    } catch (error) {
      Alert.alert(
        'Analiz başlatılamadı',
        error instanceof Error
          ? error.message
          : 'Sunucuya bağlanırken bir ağ hatası oluştu.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function chooseNewTarget() {
    setVideo(null);
    setTaskId(null);
    setTaskStatus(null);
    setAnalysis(null);
    setPollError(null);
    await chooseVideo();
  }

  const isTaskRunning =
    taskId !== null && taskStatus !== 'completed' && taskStatus !== 'failed';
  const emotionEntries = Object.entries(
    analysis?.averageEmotionScores || {},
  ).sort(([, first], [, second]) => Number(second) - Number(first));
  const terminalLines = [
    {
      label: 'SYS',
      text: 'COLD READING ENGINE // ONLINE',
      color: 'text-sky-300',
    },
    video
      ? {
          label: 'TGT',
          text: `SOURCE LOCKED: ${video.name}`,
          color: 'text-slate-200',
        }
      : {
          label: 'TGT',
          text: 'AWAITING VIDEO SOURCE',
          color: 'text-slate-500',
        },
    loading
      ? {
          label: 'NET',
          text: 'UPLOADING VIDEO STREAM...',
          color: 'text-sky-300',
        }
      : null,
    isTaskRunning
      ? {
          label: 'RUN',
          text: `ANALYSIS ${taskStatus?.toUpperCase()}`,
          color: 'text-sky-300',
        }
      : null,
    analysis
      ? {
          label: 'OUT',
          text: `DOMINANT SIGNAL: ${analysis.dominantEmotion?.toUpperCase() || 'N/A'}`,
          color: 'text-emerald-300',
        }
      : null,
    analysis
      ? {
          label: 'DAT',
          text: `${analysis.sampledFrames || 0} FRAMES // ${emotionEntries.length} EMOTION CHANNELS`,
          color: 'text-slate-400',
        }
      : null,
    pollError
      ? { label: 'WRN', text: pollError, color: 'text-amber-300' }
      : null,
  ].filter(Boolean);

  return (
    <SafeAreaView className="flex-1 bg-[#0B0F19]">
      <StatusBar style="light" />
      <BlurTargetView
        ref={blurTargetRef}
        style={[StyleSheet.absoluteFill, styles.blurBackdrop]}
      >
        <View className="flex-1 bg-[#0B0F19]">
          <View style={styles.blueGlow} />
          <View style={styles.cyanGlow} />
        </View>
      </BlurTargetView>

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-10 pt-3"
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-5 flex-row items-center justify-between">
          <View className="flex-row items-center">
            <View className="mr-3 h-10 w-10 items-center justify-center rounded-xl border border-sky-300/30 bg-sky-400/10">
              <Text className="font-mono text-lg font-semibold text-sky-300">
                CR
              </Text>
            </View>
            <Text className="text-sm font-semibold tracking-[2px] text-slate-100">
              COLD READING
            </Text>
          </View>
          <View className="flex-row items-center rounded-full border border-sky-300/15 bg-slate-900/70 px-3 py-2">
            <View
              className={`mr-2 h-1.5 w-1.5 rounded-full ${
                isTaskRunning ? 'bg-amber-300' : 'bg-sky-300'
              }`}
            />
            <Text className="font-mono text-[9px] tracking-[1.5px] text-slate-400">
              {isTaskRunning ? 'SCANNING' : 'AGENT ONLINE'}
            </Text>
          </View>
        </View>

        <View className="mb-4">
          <View className="mb-1 flex-row items-center">
            <View className="mr-2 h-px w-7 bg-sky-400" />
            <Text className="font-mono text-[10px] tracking-[2px] text-sky-300">
              FIELD INTELLIGENCE / 01
            </Text>
          </View>
          <Text className="text-3xl font-semibold text-slate-50">
            Söylenmeyeni görün.
          </Text>
          <Text className="mt-1 text-sm leading-5 text-slate-400">
            Mikro ifade taraması için bir hedef belirleyin.
          </Text>
        </View>

        <View className="mb-4 overflow-hidden rounded-3xl border border-sky-300/10 bg-[#030712]/50 px-2 pt-1">
          <CyberFaceViewer />
        </View>

        <GlassCard targetRef={blurTargetRef} className="mb-4">
          <View className="p-5">
            <View className="mb-4 flex-row items-center justify-between">
              <View>
                <Text className="font-mono text-[10px] tracking-[1.5px] text-sky-300">
                  01 / HEDEF GİRİŞİ
                </Text>
                <Text className="mt-1 text-lg font-semibold text-slate-100">
                  Video kaynağı
                </Text>
              </View>
              <View className="rounded-lg border border-sky-300/20 bg-sky-400/5 px-2.5 py-1.5">
                <Text className="font-mono text-[9px] tracking-wider text-sky-200">
                  {video ? 'TARGET LOCKED' : 'STANDBY'}
                </Text>
              </View>
            </View>

            <View className="rounded-2xl border border-dashed border-sky-300/20 bg-[#030712]/40 p-4">
              <View className="flex-row items-start">
                <View className="mr-3 mt-0.5 h-9 w-9 items-center justify-center rounded-xl border border-sky-300/20 bg-sky-400/10">
                  <Text className="font-mono text-lg text-sky-300">
                    {video ? '✓' : '+'}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-medium text-slate-100">
                    {video ? 'Hedef dosyası hazır' : 'Analiz için video seçin'}
                  </Text>
                  <Text
                    numberOfLines={2}
                    className="mt-1 text-xs leading-5 text-slate-400"
                  >
                    {video?.name || 'MP4 veya MOV formatında bir video kaynağı yükleyin.'}
                  </Text>
                </View>
              </View>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                video ? 'Hedef videosunu değiştir' : 'Analiz için video seç'
              }
              onPress={chooseVideo}
              className="mt-4 min-h-12 flex-row items-center justify-center rounded-xl border border-sky-300/35 bg-sky-400/5 px-4 active:opacity-60"
            >
              <Text className="mr-2 font-mono text-xs text-sky-200">
                {video ? '↻' : '+'}
              </Text>
              <Text className="font-mono text-[10px] font-semibold tracking-[1.5px] text-sky-100">
                {video ? 'HEDEFİ DEĞİŞTİR' : 'VİDEO DOSYASI SEÇ'}
              </Text>
            </Pressable>
          </View>
        </GlassCard>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{
            disabled: loading || isTaskRunning,
            busy: loading || isTaskRunning,
          }}
          disabled={loading || isTaskRunning}
          onPress={startAnalysis}
          className={`mb-5 min-h-14 flex-row items-center justify-center rounded-2xl border px-5 active:opacity-60 ${
            loading || isTaskRunning
              ? 'border-sky-300/15 bg-sky-400/10'
              : 'border-sky-300/70 bg-sky-400/10'
          }`}
        >
          {loading ? (
            <>
              <ActivityIndicator color="#38BDF8" />
              <Text className="ml-3 font-mono text-xs font-semibold tracking-[1.5px] text-sky-100">
                VİDEO GÖNDERİLİYOR
              </Text>
            </>
          ) : isTaskRunning ? (
            <>
              <ActivityIndicator color="#38BDF8" />
              <Text className="ml-3 font-mono text-xs font-semibold tracking-[1.5px] text-sky-100">
                ANALİZ MOTORU ÇALIŞIYOR
              </Text>
            </>
          ) : (
            <>
              <Text className="font-mono text-xs font-semibold tracking-[2px] text-sky-100">
                ANALİZİ BAŞLAT
              </Text>
              <Text className="ml-3 text-base text-sky-300">→</Text>
            </>
          )}
        </Pressable>

        <AnalysisHUD data={analysis} isLoading={loading || isTaskRunning} />

        <GlassCard targetRef={blurTargetRef} className="mb-4">
          <View className="p-5">
            <View className="mb-4 flex-row items-center justify-between">
              <View>
                <Text className="font-mono text-[10px] tracking-[1.5px] text-sky-300">
                  03 / CANLI ÇIKTI
                </Text>
                <Text className="mt-1 text-lg font-semibold text-slate-100">
                  Cold Reading terminali
                </Text>
              </View>
              <Text className="font-mono text-[9px] text-slate-500">
                SESSION.LOG
              </Text>
            </View>
            <View className="rounded-2xl border border-sky-300/10 bg-[#030712]/75 p-4">
              <View className="mb-3 flex-row items-center border-b border-white/5 pb-3">
                <View className="mr-1.5 h-2 w-2 rounded-full bg-rose-400/70" />
                <View className="mr-1.5 h-2 w-2 rounded-full bg-amber-300/70" />
                <View className="h-2 w-2 rounded-full bg-emerald-300/70" />
                <Text className="ml-3 font-mono text-[9px] text-slate-600">
                  CR // SECURE CHANNEL
                </Text>
              </View>
              {terminalLines.map((line, index) => (
                <View
                  key={`${line.label}-${index}`}
                  className="mb-2 flex-row items-start"
                >
                  <Text className="mr-2 font-mono text-[10px] text-slate-600">
                    [{line.label}]
                  </Text>
                  <Text
                    className={`flex-1 font-mono text-[10px] leading-4 ${line.color}`}
                  >
                    {line.text}
                  </Text>
                </View>
              ))}
              {taskId ? (
                <Text className="mt-2 border-t border-white/5 pt-2 font-mono text-[9px] text-slate-600">
                  TASK ID // {taskId}
                </Text>
              ) : null}
            </View>
          </View>
        </GlassCard>

        {taskStatus === 'failed' || taskStatus === 'completed' ? (
          <Pressable
            accessibilityRole="button"
            onPress={chooseNewTarget}
            className="min-h-12 flex-row items-center justify-center rounded-xl border border-sky-300/30 bg-sky-400/5 active:opacity-60"
          >
            <Text className="mr-2 font-mono text-xs text-sky-300">↻</Text>
            <Text className="font-mono text-[10px] font-semibold tracking-[1.5px] text-sky-100">
              YENİ HEDEF TARA
            </Text>
          </Pressable>
        ) : null}

        <Text className="mt-6 text-center font-mono text-[9px] tracking-[1.5px] text-slate-700">
          COLD READING / BEHAVIORAL SIGNAL ANALYSIS
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  blurBackdrop: {
    backgroundColor: '#0B0F19',
  },
  blueGlow: {
    position: 'absolute',
    top: 80,
    right: -150,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: '#0EA5E9',
    opacity: 0.07,
  },
  cyanGlow: {
    position: 'absolute',
    top: 440,
    left: -190,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: '#38BDF8',
    opacity: 0.045,
  },
});