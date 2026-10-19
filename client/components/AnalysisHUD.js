import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

const EMOTION_LABELS = {
  angry: 'Öfke',
  disgust: 'Tiksinme',
  fear: 'Korku',
  happy: 'Mutluluk',
  neutral: 'Nötr',
  sad: 'Üzüntü',
  surprise: 'Şaşkınlık',
  focus: 'Odaklanma',
  focused: 'Odaklanma',
  stress: 'Stres',
  suspicion: 'Şüphe',
  suspicious: 'Şüphe',
};

function formatEmotionName(emotion) {
  const normalized = emotion.toLowerCase();
  return (
    EMOTION_LABELS[normalized] ||
    normalized.replace(/[_-]+/g, ' ').replace(/^\w/, (letter) => letter.toUpperCase())
  );
}

export default function AnalysisHUD({ data, isLoading }) {
  const radarProgress = useRef(new Animated.Value(0)).current;
  const emotionScores = data?.averageEmotionScores || {};
  const emotionEntries = Object.entries(emotionScores).sort(
    ([, first], [, second]) => Number(second) - Number(first),
  );

  useEffect(() => {
    if (!isLoading) {
      radarProgress.setValue(0);
      return undefined;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(radarProgress, {
          toValue: 1,
          duration: 1400,
          useNativeDriver: true,
        }),
        Animated.timing(radarProgress, {
          toValue: 0,
          duration: 1,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [isLoading, radarProgress]);

  const radarScale = radarProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.55, 1.5],
  });
  const radarOpacity = radarProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.65, 0],
  });
  const scanOffset = radarProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [-44, 44],
  });

  return (
    <View className="relative mb-4 overflow-hidden rounded-3xl border border-sky-300/20 bg-[#030712]/75 p-5">
      <Text pointerEvents="none" style={[styles.crosshair, styles.topLeft]}>
        +
      </Text>
      <Text pointerEvents="none" style={[styles.crosshair, styles.topRight]}>
        +
      </Text>
      <Text pointerEvents="none" style={[styles.crosshair, styles.bottomLeft]}>
        +
      </Text>
      <Text pointerEvents="none" style={[styles.crosshair, styles.bottomRight]}>
        +
      </Text>

      <View className="mb-5 flex-row items-center justify-between pr-2">
        <View>
          <Text className="font-mono text-[10px] tracking-[1.5px] text-sky-300">
            02 / SİNYAL ÇÖZÜMLEME
          </Text>
          <Text className="mt-1 text-lg font-semibold text-slate-100">
            Mikro ifade paneli
          </Text>
        </View>
        <View
          className={`h-2 w-2 rounded-full ${
            isLoading ? 'bg-sky-300' : data ? 'bg-emerald-300' : 'bg-slate-600'
          }`}
        />
      </View>

      {isLoading ? (
        <View className="mb-5 flex-row items-center rounded-2xl border border-sky-300/10 bg-sky-400/[0.04] px-4 py-3">
          <View style={styles.radar}>
            <View style={styles.radarRing} />
            <Animated.View
              style={[
                styles.radarPulse,
                { opacity: radarOpacity, transform: [{ scale: radarScale }] },
              ]}
            />
            <View style={styles.radarCenter} />
            <Animated.View
              style={[styles.scanLine, { transform: [{ translateX: scanOffset }] }]}
            />
          </View>
          <View className="ml-4 flex-1">
            <Text className="font-mono text-[10px] font-semibold tracking-[1.5px] text-sky-200">
              SİNYAL TARANIYOR
            </Text>
            <Text className="mt-1 text-xs text-slate-500">
              Duygu verileri bekleniyor...
            </Text>
          </View>
          <Text className="font-mono text-[9px] text-sky-400/70">LIVE</Text>
        </View>
      ) : null}

      <View className="mb-4 flex-row">
        <View className="mr-3 flex-1 rounded-2xl border border-white/5 bg-slate-950/50 p-3">
          <Text className="font-mono text-[9px] tracking-wider text-slate-500">
            BASKIN DUYGU
          </Text>
          <Text className="mt-2 text-base font-semibold text-sky-200">
            {data?.dominantEmotion
              ? formatEmotionName(data.dominantEmotion)
              : '--'}
          </Text>
        </View>
        <View className="flex-1 rounded-2xl border border-white/5 bg-slate-950/50 p-3">
          <Text className="font-mono text-[9px] tracking-wider text-slate-500">
            İNCELENEN KARE
          </Text>
          <Text className="mt-2 text-base font-semibold text-slate-100">
            {data?.sampledFrames ?? '--'}
          </Text>
        </View>
      </View>

      <View className="mb-3 flex-row items-center justify-between pr-2">
        <Text className="font-mono text-[9px] tracking-[1.5px] text-slate-400">
          DUYGU DAĞILIMI
        </Text>
        <Text className="font-mono text-[9px] text-slate-600">DEEPFACE / %</Text>
      </View>

      {emotionEntries.length ? (
        emotionEntries.map(([emotion, rawScore]) => {
          const value = Number(rawScore);
          const score = Number.isFinite(value)
            ? Math.max(0, Math.min(100, value))
            : 0;

          return (
            <View key={emotion} className="mb-3 pr-2">
              <View className="mb-1.5 flex-row justify-between">
                <Text className="text-xs text-slate-300">
                  {formatEmotionName(emotion)}
                </Text>
                <Text className="font-mono text-[10px] text-sky-200">
                  {score.toFixed(1)}%
                </Text>
              </View>
              <View className="h-2 overflow-hidden rounded-full bg-slate-950/90">
                <View
                  className="h-full rounded-full bg-sky-400"
                  style={[styles.barGlow, { width: `${score}%` }]}
                />
              </View>
            </View>
          );
        })
      ) : (
        <View className="rounded-xl border border-white/5 bg-slate-950/35 px-3 py-4">
          <Text className="text-xs leading-5 text-slate-500">
            {isLoading
              ? 'Tarama tamamlandığında duygu yüzdeleri burada görünecek.'
              : 'Analiz tamamlandığında duygu skorları burada gösterilecek.'}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  crosshair: {
    position: 'absolute',
    zIndex: 2,
    color: '#38BDF8',
    fontFamily: 'monospace',
    fontSize: 14,
    lineHeight: 14,
    opacity: 0.65,
  },
  topLeft: {
    top: 7,
    left: 8,
  },
  topRight: {
    top: 7,
    right: 8,
  },
  bottomLeft: {
    bottom: 7,
    left: 8,
  },
  bottomRight: {
    bottom: 7,
    right: 8,
  },
  radar: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.18)',
    borderRadius: 26,
  },
  radarRing: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
    borderRadius: 14,
  },
  radarPulse: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderWidth: 1,
    borderColor: '#38BDF8',
    borderRadius: 17,
    backgroundColor: 'rgba(14, 165, 233, 0.08)',
  },
  radarCenter: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#7DD3FC',
    shadowColor: '#38BDF8',
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 4,
  },
  scanLine: {
    position: 'absolute',
    width: 1,
    height: 46,
    backgroundColor: '#38BDF8',
    opacity: 0.5,
  },
  barGlow: {
    shadowColor: '#38BDF8',
    shadowOpacity: 0.85,
    shadowRadius: 7,
    elevation: 5,
  },
});