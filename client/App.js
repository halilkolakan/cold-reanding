import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import './global.css';

const ANALYZE_API_URL = 'http://172.2.0.29:3000/api/analyze';

export default function App() {
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

  return (
    <SafeAreaView className="flex-1 bg-zinc-950">
      <StatusBar style="light" />
      <ScrollView
        className="flex-1"
        contentContainerClassName="flex-grow justify-between px-6 pb-8 pt-5"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <View className="mr-3 h-9 w-9 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-400/10">
              <Text className="text-lg font-semibold text-cyan-300">C</Text>
            </View>
            <Text className="text-base font-semibold tracking-wide text-zinc-100">
              COLD READING
            </Text>
          </View>
          <View className="flex-row items-center rounded-full border border-zinc-800 bg-zinc-900/70 px-3 py-2">
            <View className="mr-2 h-1.5 w-1.5 rounded-full bg-cyan-400" />
            <Text className="text-[10px] font-medium tracking-[2px] text-zinc-400">
              STUDIO
            </Text>
          </View>
        </View>

        <View className="w-full self-center py-14">
          <View className="mb-8">
            <Text className="mb-3 text-xs font-semibold tracking-[3px] text-cyan-400">
              DAVRANIŞ ANALİZİ
            </Text>
            <Text className="text-4xl font-semibold leading-[46px] tracking-tight text-zinc-50">
              Söylenmeyeni{'\n'}görün.
            </Text>
            <Text className="mt-4 max-w-sm text-base leading-6 text-zinc-400">
              Bir video yükleyin. Mikro ifadeleri ve beden dilini keşfedin.
            </Text>
          </View>

          <View className="rounded-3xl border border-cyan-400/25 bg-zinc-900/70 p-5">
            <View className="mb-5 flex-row items-center justify-between">
              <Text className="text-[11px] font-semibold tracking-[2px] text-zinc-400">
                VİDEO KAYNAĞI
              </Text>
              <View className="rounded-full border border-zinc-800 px-2.5 py-1">
                <Text className="text-[10px] tracking-wide text-zinc-500">
                  MP4 · MOV
                </Text>
              </View>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Analiz için video seç"
              onPress={chooseVideo}
              className="min-h-48 items-center justify-center rounded-2xl border border-dashed border-cyan-400/30 bg-zinc-950/70 px-5 py-8 active:bg-cyan-950/30"
            >
              <View className="mb-4 h-14 w-14 items-center justify-center rounded-2xl border border-cyan-400/25 bg-cyan-400/10">
                <Text className="text-3xl font-light text-cyan-300">
                  {video ? '✓' : '+'}
                </Text>
              </View>
              <Text className="mb-2 text-base font-medium text-zinc-100">
                {video ? 'Video seçildi' : 'Video Yükle'}
              </Text>
              <Text className="max-w-xs text-center text-sm leading-5 text-zinc-500">
                {video
                  ? video.name
                  : 'Cihazınızdan analiz etmek istediğiniz videoyu seçin'}
              </Text>
            </Pressable>

            <Text className="mt-4 text-center text-xs text-zinc-600">
              Videolarınız güvenli şekilde işlenir
            </Text>
          </View>
        </View>

        <View>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: loading, busy: loading }}
            disabled={loading}
            onPress={startAnalysis}
            className={`min-h-14 flex-row items-center justify-center rounded-2xl px-5 ${
              loading ? 'bg-cyan-700' : 'bg-cyan-400 active:bg-cyan-300'
            }`}
          >
            {loading ? (
              <>
                <ActivityIndicator color="#09090b" />
                <Text className="ml-3 text-base font-semibold text-zinc-950">
                  Veriler Yükleniyor...
                </Text>
              </>
            ) : (
              <>
                <Text className="text-base font-semibold text-zinc-950">
                  Analizi Başlat
                </Text>
                <Text className="ml-2 text-lg font-semibold text-zinc-950">→</Text>
              </>
            )}
          </Pressable>
          {taskId && taskStatus !== 'completed' && taskStatus !== 'failed' ? (
            <View
              accessibilityLiveRegion="polite"
              className="mt-4 rounded-2xl border border-cyan-400/25 bg-cyan-400/10 p-4"
            >
              <Text className="text-xs font-semibold tracking-[2px] text-cyan-300">
                {taskStatus === 'processing' ? 'ANALİZ EDİLİYOR' : 'ANALİZ SIRADA'}
              </Text>
              <Text className="mt-2 text-sm text-zinc-300">
                Görev numarası:{' '}
                <Text className="font-semibold text-zinc-50">{taskId}</Text>
              </Text>
              {pollError ? (
                <Text className="mt-2 text-xs text-amber-300">
                  Durum kontrolünde sorun oluştu; yeniden deneniyor.
                </Text>
              ) : null}
            </View>
          ) : null}
          {taskStatus === 'failed' ? (
            <View
              accessibilityLiveRegion="polite"
              className="mt-4 rounded-2xl border border-red-400/25 bg-red-400/10 p-4"
            >
              <Text className="text-xs font-semibold tracking-[2px] text-red-300">
                ANALİZ TAMAMLANAMADI
              </Text>
              <Text className="mt-2 text-sm text-zinc-300">{pollError}</Text>
            </View>
          ) : null}
          {taskStatus === 'completed' && analysis ? (
            <View
              accessibilityLiveRegion="polite"
              className="mt-4 rounded-2xl border border-cyan-400/25 bg-zinc-900/80 p-4"
            >
              <Text className="text-xs font-semibold tracking-[2px] text-cyan-300">
                ANALİZ TAMAMLANDI
              </Text>
              <Text className="mt-3 text-lg font-semibold capitalize text-zinc-50">
                Baskın duygu: {analysis.dominantEmotion}
              </Text>
              {analysis.sampledFrames ? (
                <Text className="mt-1 text-xs text-zinc-500">
                  İncelenen kare: {analysis.sampledFrames}
                </Text>
              ) : null}
              {Object.entries(analysis.averageEmotionScores || {}).map(
                ([emotion, rawScore]) => {
                  const score = Number(rawScore);
                  const percentage = Number.isFinite(score)
                    ? Math.max(0, Math.min(100, score))
                    : 0;

                  return (
                    <View key={emotion} className="mt-4">
                      <View className="mb-2 flex-row justify-between">
                        <Text className="text-sm capitalize text-zinc-300">
                          {emotion}
                        </Text>
                        <Text className="text-sm text-cyan-300">
                          {percentage.toFixed(1)}%
                        </Text>
                      </View>
                      <View className="h-2 overflow-hidden rounded-full bg-zinc-800">
                        <View
                          className="h-full rounded-full bg-cyan-400"
                          style={{ width: `${percentage}%` }}
                        />
                      </View>
                    </View>
                  );
                },
              )}
            </View>
          ) : null}
          <Text className="mt-4 text-center text-xs tracking-wide text-zinc-600">
            COLD READING · INSIGHT ENGINE
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
