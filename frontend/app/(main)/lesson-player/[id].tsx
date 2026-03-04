import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import Colors from '../../../src/constants/colors';
import api, { getMediaUrl } from '../../../src/services/api';

const { width, height } = Dimensions.get('window');

interface VideoLesson {
  id: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  duration_minutes: number;
  video_url: string | null;
  user?: { username: string };
}

export default function LessonPlayerScreen() {
  const router = useRouter();
  const { id: lessonId } = useLocalSearchParams<{ id: string }>();
  const [lesson, setLesson] = useState<VideoLesson | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { loadLesson(); }, [lessonId]);

  const loadLesson = async () => {
    try {
      const res = await api.get('/video-lessons');
      const found = res.data.find((l: VideoLesson) => l.id === lessonId);
      if (found) setLesson(found);
    } catch (e) { console.error('Failed to load lesson', e); }
    finally { setIsLoading(false); }
  };

  if (isLoading || !lesson) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }} edges={['top']}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </SafeAreaView>
      </View>
    );
  }

  const videoUrl = lesson.video_url ? getMediaUrl(lesson.video_url) : null;

  const html = videoUrl ? `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>
*{margin:0;padding:0;background:#000}
video{width:100vw;height:100vh;object-fit:contain}
</style>
</head><body>
<video src="${videoUrl}" autoplay playsinline webkit-playsinline controls></video>
<script>
var v=document.querySelector('video');
v.play();
</script>
</body></html>` : '';

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header overlay */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={28} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle} numberOfLines={1}>{lesson.title}</Text>
            <Text style={styles.headerSub}>{lesson.user?.username || ''}</Text>
          </View>
          <Text style={styles.priceTag}>{lesson.price.toFixed(2)} EUR</Text>
        </View>

        {/* Video player - WebView same as reels */}
        {videoUrl ? (
          <WebView
            source={{ html }}
            style={styles.video}
            scrollEnabled={false}
            bounces={false}
            allowsInlineMediaPlayback={true}
            mediaPlaybackRequiresUserAction={false}
            javaScriptEnabled={true}
          />
        ) : (
          <View style={styles.noVideo}>
            <Ionicons name="videocam-off-outline" size={48} color="#666" />
            <Text style={styles.noVideoText}>Video non disponibile</Text>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    zIndex: 10,
  },
  backBtn: { padding: 4 },
  headerInfo: { flex: 1, marginLeft: 8 },
  headerTitle: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  headerSub: { color: '#888', fontSize: 12, marginTop: 1 },
  priceTag: { color: '#4CD964', fontSize: 15, fontWeight: '700' },
  video: { flex: 1 },
  noVideo: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  noVideoText: { color: '#888', fontSize: 14, marginTop: 8 },
});
