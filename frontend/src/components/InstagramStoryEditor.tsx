import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  Dimensions,
  ScrollView,
  Modal,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Animated as RNAnimated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import Svg, { Path } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import { GestureHandlerRootView, Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS } from 'react-native-reanimated';
import Colors from '../constants/colors';
import api, { getMediaUrl } from '../services/api';

const { width, height } = Dimensions.get('window');

// Text element
interface TextElement {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  fontSize: number;
  fontStyle: 'modern' | 'classic' | 'signature';
  backgroundColor: string | null;
}

// Sticker element
interface StickerElement {
  id: string;
  type: 'emoji' | 'widget' | 'gif' | 'animated_text';
  content: string;
  icon?: string;
  x: number;
  y: number;
  scale: number;
  color?: string;
  animation?: string;
}

// Drawing path
interface DrawPath {
  id: string;
  points: string;
  color: string;
  width: number;
}

// Overlay image
interface OverlayImage {
  id: string;
  uri: string;
  x: number;
  y: number;
  scale: number;
  width: number;
  height: number;
}

const COLORS = ['#FFFFFF', '#000000', '#FF6978', '#FF9500', '#FFCC00', '#34C759', '#007AFF', '#5856D6', '#AF52DE', '#FF2D55'];

const FONT_STYLES = [
  { id: 'modern', name: 'Modern' },
  { id: 'classic', name: 'Classic' },
  { id: 'signature', name: 'Signature' },
  { id: 'edit', name: 'Edit' },
];

const STICKERS = [
  { icon: 'location-outline', label: 'Luogo', type: 'widget' },
  { icon: 'at', label: '@menzione', type: 'widget' },
  { icon: 'musical-notes', label: 'Musica', type: 'widget' },
  { icon: 'help-circle-outline', label: 'Domande', type: 'widget' },
  { icon: 'stats-chart', label: 'Sondaggio', type: 'widget' },
  { icon: 'link', label: 'Link', type: 'widget' },
  { icon: 'timer-outline', label: 'Countdown', type: 'widget' },
  { icon: 'pricetag', label: '#hashtag', type: 'widget' },
];

const EMOJIS = ['❤️', '🔥', '😂', '😍', '🎉', '👏', '💯', '✨', '🙌', '💪', '🎵', '💃', '🕺', '🌟', '💖', '🥳', '😎', '🤩', '💫', '🦋'];

const BACKGROUNDS = ['transparent', '#000000', '#1a1a2e', '#16213e', '#0f3460', '#533483', '#e94560', '#f38181', '#fce38a', '#95e1d3'];

// Instagram-style ANIMATED Effects
const ANIMATED_EFFECTS = [
  { id: 'falling_hearts', name: 'Cuori Cadenti', preview: '💕', type: 'falling', particles: ['❤️', '💕', '💖', '💗', '💝'] },
  { id: 'rising_stars', name: 'Stelle Volanti', preview: '✨', type: 'rising', particles: ['⭐', '✨', '🌟', '💫', '⚡'] },
  { id: 'floating_sparkles', name: 'Scintille', preview: '✨', type: 'floating', particles: ['✨', '💫', '🔆', '💎', '⭐'] },
  { id: 'confetti_burst', name: 'Coriandoli', preview: '🎊', type: 'burst', particles: ['🎊', '🎉', '🎀', '🎈', '💫'] },
  { id: 'snow_fall', name: 'Neve', preview: '❄️', type: 'falling', particles: ['❄️', '❅', '❆', '🌨️', '💎'] },
  { id: 'fire_rise', name: 'Fuoco', preview: '🔥', type: 'rising', particles: ['🔥', '🔥', '💥', '⚡', '☄️'] },
  { id: 'bubbles', name: 'Bolle', preview: '🫧', type: 'rising', particles: ['🫧', '💧', '💦', '🔵', '⚪'] },
  { id: 'flowers_rain', name: 'Fiori', preview: '🌸', type: 'falling', particles: ['🌸', '🌺', '🌹', '🌷', '🌼'] },
  { id: 'butterflies', name: 'Farfalle', preview: '🦋', type: 'floating', particles: ['🦋', '🦋', '🦋', '✨', '💜'] },
  { id: 'music_notes', name: 'Note', preview: '🎵', type: 'floating', particles: ['🎵', '🎶', '🎼', '🎤', '🎸'] },
  { id: 'money_rain', name: 'Soldi', preview: '💰', type: 'falling', particles: ['💰', '💵', '💸', '🤑', '💎'] },
  { id: 'love_burst', name: 'Amore', preview: '😍', type: 'burst', particles: ['😍', '🥰', '😘', '💋', '❤️'] },
];

// Animated text stickers (Instagram-style)
const TEXT_STICKERS = [
  { id: 'love_text', label: 'LOVE', color: '#FF1493', animation: 'pulse' },
  { id: 'wow_text', label: 'WOW!', color: '#FFD700', animation: 'bounce' },
  { id: 'fire_text', label: '🔥FIRE🔥', color: '#FF4500', animation: 'shake' },
  { id: 'yes_text', label: 'YES!', color: '#00FF00', animation: 'pulse' },
  { id: 'omg_text', label: 'OMG', color: '#FF69B4', animation: 'bounce' },
  { id: 'cool_text', label: 'COOL', color: '#00BFFF', animation: 'pulse' },
  { id: 'lol_text', label: 'LOL 😂', color: '#FFFF00', animation: 'shake' },
  { id: 'vibes_text', label: '✨VIBES✨', color: '#9400D3', animation: 'pulse' },
];

// Animated GIF stickers - EXPANDED with more variety
const GIF_STICKERS = [
  { id: 'dance1', label: 'Dance', url: 'https://media.giphy.com/media/3o7TKUn3XK2Y9jFHGM/giphy.gif' },
  { id: 'fire1', label: 'Fire', url: 'https://media.giphy.com/media/jUwpNzg9IcyrK/giphy.gif' },
  { id: 'heart1', label: 'Heart', url: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif' },
  { id: 'star1', label: 'Star', url: 'https://media.giphy.com/media/xT5LMHxhOfscxPfIfm/giphy.gif' },
  { id: 'cool1', label: 'Cool', url: 'https://media.giphy.com/media/62PP2yEIAZF6g/giphy.gif' },
  { id: 'party1', label: 'Party', url: 'https://media.giphy.com/media/l0MYGb1LuZ3n7dRnO/giphy.gif' },
  { id: 'sparkle1', label: 'Sparkle', url: 'https://media.giphy.com/media/xUPGGDNsLvqsBOhuU0/giphy.gif' },
  { id: 'rainbow1', label: 'Rainbow', url: 'https://media.giphy.com/media/SKGo6OYe24EBG/giphy.gif' },
  { id: 'confetti1', label: 'Confetti', url: 'https://media.giphy.com/media/26tOZ42Mg6pbTUPHW/giphy.gif' },
  { id: 'love1', label: 'Love', url: 'https://media.giphy.com/media/l4pTdcifPZLpDjL1e/giphy.gif' },
  { id: 'wow1', label: 'Wow', url: 'https://media.giphy.com/media/5VKbvrjxpVJCM/giphy.gif' },
  { id: 'yes1', label: 'Yes', url: 'https://media.giphy.com/media/l0HlvtIPzPdt2usKs/giphy.gif' },
];

interface Props {
  mediaUri: string;
  mediaType: 'photo' | 'video';
  originalPoster?: { username: string; profileImage?: string };
  onSave: (data: any) => void;
  onClose: () => void;
}

// Draggable Element Component with pinch-to-zoom support (Instagram-style)
const DraggableItem = ({ children, initialX, initialY, initialScale = 1, onPositionChange, onScaleChange, onDelete, onTap }: {
  children: React.ReactNode;
  initialX: number;
  initialY: number;
  initialScale?: number;
  onPositionChange?: (x: number, y: number) => void;
  onScaleChange?: (scale: number) => void;
  onDelete?: () => void;
  onTap?: () => void;
}) => {
  const translateX = useSharedValue(initialX);
  const translateY = useSharedValue(initialY);
  const scale = useSharedValue(initialScale);
  const savedScale = useSharedValue(initialScale);
  const savedTranslateX = useSharedValue(initialX);
  const savedTranslateY = useSharedValue(initialY);

  // Callback wrappers for worklet -> JS thread
  const notifyPositionChange = (x: number, y: number) => {
    onPositionChange?.(x, y);
  };
  const notifyScaleChange = (s: number) => {
    onScaleChange?.(s);
  };
  const notifyDelete = () => {
    onDelete?.();
  };
  const notifyTap = () => {
    onTap?.();
  };

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      translateX.value = savedTranslateX.value + event.translationX;
      translateY.value = savedTranslateY.value + event.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
      if (onPositionChange) {
        runOnJS(notifyPositionChange)(translateX.value, translateY.value);
      }
    });

  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = Math.min(Math.max(savedScale.value * event.scale, 0.3), 4);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (onScaleChange) {
        runOnJS(notifyScaleChange)(scale.value);
      }
    });

  const tapGesture = Gesture.Tap()
    .onEnd(() => {
      if (onTap) {
        runOnJS(notifyTap)();
      }
    });

  const longPressGesture = Gesture.LongPress()
    .minDuration(500)
    .onEnd(() => {
      if (onDelete) {
        runOnJS(notifyDelete)();
      }
    });

  const composedGesture = Gesture.Simultaneous(
    panGesture,
    pinchGesture,
    Gesture.Exclusive(longPressGesture, tapGesture)
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View style={[styles.draggableElement, animatedStyle]}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
};

// Animated Particles Component - creates falling/rising/floating particles
const AnimatedParticles = ({ particles }: { particles: any[] }) => {
  const animRefs = useRef<{ [key: string]: RNAnimated.Value }>({});
  
  useEffect(() => {
    particles.forEach((p) => {
      if (!animRefs.current[p.id]) {
        animRefs.current[p.id] = new RNAnimated.Value(0);
      }
      
      const anim = animRefs.current[p.id];
      anim.setValue(0);
      
      RNAnimated.loop(
        RNAnimated.timing(anim, {
          toValue: 1,
          duration: p.duration || 3000,
          delay: p.delay || 0,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    });
    
    return () => {
      Object.values(animRefs.current).forEach((anim) => anim.stopAnimation());
    };
  }, [particles]);
  
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map((p) => {
        const anim = animRefs.current[p.id] || new RNAnimated.Value(0);
        
        let translateY, translateX, opacity;
        
        if (p.animationType === 'falling') {
          translateY = anim.interpolate({
            inputRange: [0, 1],
            outputRange: [-50, height + 50],
          });
          translateX = anim.interpolate({
            inputRange: [0, 0.25, 0.5, 0.75, 1],
            outputRange: [0, 15, 0, -15, 0],
          });
        } else if (p.animationType === 'rising') {
          translateY = anim.interpolate({
            inputRange: [0, 1],
            outputRange: [height + 50, -50],
          });
          translateX = anim.interpolate({
            inputRange: [0, 0.25, 0.5, 0.75, 1],
            outputRange: [0, -10, 0, 10, 0],
          });
        } else if (p.animationType === 'burst') {
          const angle = Math.random() * Math.PI * 2;
          const distance = 100 + Math.random() * 150;
          translateY = anim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, Math.sin(angle) * distance],
          });
          translateX = anim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, Math.cos(angle) * distance],
          });
        } else {
          // floating
          translateY = anim.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: [0, -30, 0],
          });
          translateX = anim.interpolate({
            inputRange: [0, 0.25, 0.5, 0.75, 1],
            outputRange: [0, 20, 0, -20, 0],
          });
        }
        
        opacity = anim.interpolate({
          inputRange: [0, 0.1, 0.9, 1],
          outputRange: [0, 1, 1, 0],
        });
        
        return (
          <RNAnimated.Text
            key={p.id}
            style={{
              position: 'absolute',
              left: p.x,
              top: p.y,
              fontSize: 24 + Math.random() * 12,
              transform: [{ translateY }, { translateX }],
              opacity,
            }}
          >
            {p.emoji}
          </RNAnimated.Text>
        );
      })}
    </View>
  );
};

export default function InstagramStoryEditor({ mediaUri, mediaType, originalPoster, onSave, onClose }: Props) {
  // Core state - persists across panel changes
  const [texts, setTexts] = useState<TextElement[]>([]);
  const [stickers, setStickers] = useState<StickerElement[]>([]);
  const [drawings, setDrawings] = useState<DrawPath[]>([]);
  const [overlayImages, setOverlayImages] = useState<OverlayImage[]>([]);
  const [backgroundColor, setBackgroundColor] = useState<string>('transparent');
  const [caption, setCaption] = useState('');
  const [mainImageScale, setMainImageScale] = useState(1);

  // Panel state
  const [activePanel, setActivePanel] = useState<'none' | 'text' | 'stickers' | 'draw' | 'background' | 'music' | 'link' | 'poll' | 'question' | 'location' | 'countdown' | 'hashtag' | 'mention' | 'effects'>('none');
  const [showSidebar, setShowSidebar] = useState(true);

  // Effects state
  const [selectedEffect, setSelectedEffect] = useState<string | null>(null);
  const [effectParticles, setEffectParticles] = useState<{ id: string; emoji: string; x: number; y: number; opacity: number }[]>([]);

  // Text editing state
  const [currentText, setCurrentText] = useState('');
  const [textColor, setTextColor] = useState('#FFFFFF');
  const [textBgColor, setTextBgColor] = useState<string | null>(null);
  const [fontStyle, setFontStyle] = useState<'modern' | 'classic' | 'signature'>('classic');
  const [editingTextId, setEditingTextId] = useState<string | null>(null);

  // Drawing state
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [drawColor, setDrawColor] = useState('#FFFFFF');
  const [drawWidth, setDrawWidth] = useState(5);
  const [currentPath, setCurrentPath] = useState<{ x: number; y: number }[]>([]);

  // Widget input states
  const [linkUrl, setLinkUrl] = useState('');
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [questionText, setQuestionText] = useState('');
  const [locationText, setLocationText] = useState('');
  const [countdownTitle, setCountdownTitle] = useState('');
  const [countdownDate, setCountdownDate] = useState('');
  const [hashtagText, setHashtagText] = useState('');
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionUsers, setMentionUsers] = useState<{id: string; username: string; name: string; profile_image: string | null}[]>([]);
  
  // Music state
  const [musicSongs, setMusicSongs] = useState<{id: string; title: string; artist: string; file_url: string; duration: number}[]>([]);
  const [musicSearch, setMusicSearch] = useState('');
  const [selectedMusic, setSelectedMusic] = useState<{id: string; title: string; artist: string; file_url: string} | null>(null);
  const [musicLoading, setMusicLoading] = useState(false);

  // Open panel without resetting elements
  const openPanel = (panel: typeof activePanel) => {
    setActivePanel(panel);
  };

  // Add text element
  const addTextElement = () => {
    if (!currentText.trim()) return;
    Keyboard.dismiss();

    const newText: TextElement = {
      id: editingTextId || Date.now().toString(),
      text: currentText,
      x: editingTextId ? (texts.find(t => t.id === editingTextId)?.x || width / 2 - 100) : width / 2 - 100,
      y: editingTextId ? (texts.find(t => t.id === editingTextId)?.y || height / 3) : height / 3,
      color: textColor,
      fontSize: 28,
      fontStyle,
      backgroundColor: textBgColor,
    };

    if (editingTextId) {
      setTexts(prev => prev.map(t => t.id === editingTextId ? newText : t));
    } else {
      setTexts(prev => [...prev, newText]);
    }

    setCurrentText('');
    setEditingTextId(null);
    setActivePanel('none');
  };

  // Add emoji sticker
  const addEmoji = (emoji: string) => {
    const newSticker: StickerElement = {
      id: Date.now().toString(),
      type: 'emoji',
      content: emoji,
      x: width / 2 - 30,
      y: height / 2 - 30,
      scale: 1,
    };
    setStickers(prev => [...prev, newSticker]);
  };

  // Add widget sticker
  const addWidget = (widget: typeof STICKERS[0]) => {
    // For some widgets, open a special panel
    if (widget.label === 'Link') {
      openPanel('link');
      return;
    }
    if (widget.label === 'Sondaggio') {
      openPanel('poll');
      return;
    }
    if (widget.label === 'Domande') {
      openPanel('question');
      return;
    }
    if (widget.label === 'Musica') {
      openPanel('music');
      return;
    }
    if (widget.label === 'Luogo') {
      openPanel('location');
      return;
    }
    if (widget.label === 'Countdown') {
      openPanel('countdown');
      return;
    }
    if (widget.label === '#hashtag') {
      openPanel('hashtag');
      return;
    }

    const newSticker: StickerElement = {
      id: Date.now().toString(),
      type: 'widget',
      content: widget.label,
      icon: widget.icon,
      x: width / 2 - 60,
      y: height / 2 - 30,
      scale: 1,
    };
    setStickers(prev => [...prev, newSticker]);
    setActivePanel('none');
  };

  // Add link widget
  const addLinkWidget = () => {
    if (!linkUrl.trim()) return;
    const newSticker: StickerElement = {
      id: Date.now().toString(),
      type: 'widget',
      content: linkUrl,
      icon: 'link',
      x: width / 2 - 80,
      y: height / 2 - 25,
      scale: 1,
    };
    setStickers(prev => [...prev, newSticker]);
    setLinkUrl('');
    setActivePanel('none');
  };

  // Add poll widget
  const addPollWidget = () => {
    if (!pollQuestion.trim()) return;
    const newSticker: StickerElement = {
      id: Date.now().toString(),
      type: 'widget',
      content: `${pollQuestion}|${pollOptions.filter(o => o.trim()).join('|')}`,
      icon: 'stats-chart',
      x: width / 2 - 100,
      y: height / 2 - 60,
      scale: 1,
    };
    setStickers(prev => [...prev, newSticker]);
    setPollQuestion('');
    setPollOptions(['', '']);
    setActivePanel('none');
  };

  // Add question widget
  const addQuestionWidget = () => {
    const newSticker: StickerElement = {
      id: Date.now().toString(),
      type: 'widget',
      content: questionText || 'Fammi una domanda',
      icon: 'help-circle-outline',
      x: width / 2 - 100,
      y: height / 2 - 40,
      scale: 1,
    };
    setStickers(prev => [...prev, newSticker]);
    setQuestionText('');
    setActivePanel('none');
  };

  // Add location widget
  const addLocationWidget = () => {
    if (!locationText.trim()) return;
    const newSticker: StickerElement = {
      id: Date.now().toString(),
      type: 'widget',
      content: locationText,
      icon: 'location-outline',
      x: width / 2 - 80,
      y: height / 2 - 25,
      scale: 1,
    };
    setStickers(prev => [...prev, newSticker]);
    setLocationText('');
    setActivePanel('none');
  };

  // Add countdown widget
  const addCountdownWidget = () => {
    if (!countdownTitle.trim()) return;
    const newSticker: StickerElement = {
      id: Date.now().toString(),
      type: 'widget',
      content: `${countdownTitle}|${countdownDate || 'No date'}`,
      icon: 'timer-outline',
      x: width / 2 - 80,
      y: height / 2 - 40,
      scale: 1,
    };
    setStickers(prev => [...prev, newSticker]);
    setCountdownTitle('');
    setCountdownDate('');
    setActivePanel('none');
  };

  // Add hashtag widget
  const addHashtagWidget = () => {
    if (!hashtagText.trim()) return;
    const tag = hashtagText.startsWith('#') ? hashtagText : `#${hashtagText}`;
    const newSticker: StickerElement = {
      id: Date.now().toString(),
      type: 'widget',
      content: tag,
      icon: 'pricetag',
      x: width / 2 - 50,
      y: height / 2 - 20,
      scale: 1,
    };
    setStickers(prev => [...prev, newSticker]);
    setHashtagText('');
    setActivePanel('none');
  };

  // Load users for mention
  const loadMentionUsers = async (search: string) => {
    try {
      const res = await api.get('/users/search', { params: { q: search || '', limit: 15 } });
      if (res.data && res.data.length > 0) {
        setMentionUsers(res.data);
      } else {
        // Fallback demo users if no results
        setMentionUsers([
          { id: '1', username: 'dancer_pro', name: 'Pro Dancer', profile_image: null },
          { id: '2', username: 'hiphop_star', name: 'Hip Hop Star', profile_image: null },
          { id: '3', username: 'salsa_queen', name: 'Salsa Queen', profile_image: null },
          { id: '4', username: 'ballet_master', name: 'Ballet Master', profile_image: null },
          { id: '5', username: 'street_dancer', name: 'Street Dancer', profile_image: null },
        ]);
      }
    } catch (e) {
      // Fallback to showing some demo users
      setMentionUsers([
        { id: '1', username: 'dancer_pro', name: 'Pro Dancer', profile_image: null },
        { id: '2', username: 'hiphop_star', name: 'Hip Hop Star', profile_image: null },
        { id: '3', username: 'salsa_queen', name: 'Salsa Queen', profile_image: null },
        { id: '4', username: 'ballet_master', name: 'Ballet Master', profile_image: null },
        { id: '5', username: 'street_dancer', name: 'Street Dancer', profile_image: null },
      ]);
    }
  };

  // Add mention widget
  const addMentionWidget = (user: typeof mentionUsers[0]) => {
    const newSticker: StickerElement = {
      id: Date.now().toString(),
      type: 'widget',
      content: `@${user.username}`,
      icon: 'at',
      x: width / 2 - 60,
      y: height / 2 - 20,
      scale: 1,
    };
    setStickers(prev => [...prev, newSticker]);
    setMentionSearch('');
    setActivePanel('none');
  };

  // Load music from library
  const loadMusicSongs = async (search?: string) => {
    setMusicLoading(true);
    try {
      const params: any = { limit: 20 };
      if (search && search.trim()) params.search = search;
      const res = await api.get('/music/songs', { params });
      setMusicSongs(res.data || []);
    } catch (e) {
      console.error('Failed to load music', e);
      // Fallback demo songs if API fails
      setMusicSongs([
        { id: '1', title: 'Dance Beat', artist: 'DJ Moves', file_url: '', duration: 180 },
        { id: '2', title: 'Hip Hop Flow', artist: 'Street Beats', file_url: '', duration: 210 },
        { id: '3', title: 'Salsa Caliente', artist: 'Latin Fire', file_url: '', duration: 195 },
      ]);
    } finally {
      setMusicLoading(false);
    }
  };

  // Select music for story
  const selectMusic = (song: typeof musicSongs[0]) => {
    setSelectedMusic({
      id: song.id,
      title: song.title,
      artist: song.artist,
      file_url: song.file_url,
    });
    // Add music sticker to show on story
    const newSticker: StickerElement = {
      id: `music-${Date.now()}`,
      type: 'widget',
      content: `${song.title} - ${song.artist}`,
      icon: 'musical-notes',
      x: width / 2 - 80,
      y: height - 200,
      scale: 1,
    };
    setStickers(prev => [...prev.filter(s => !s.id.startsWith('music-')), newSticker]);
    setActivePanel('none');
  };

  // Format duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Add overlay image from gallery
  const addOverlayImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const imgWidth = Math.min(150, asset.width || 150);
      const imgHeight = asset.height ? (imgWidth * asset.height / asset.width) : 150;
      
      const newImage: OverlayImage = {
        id: Date.now().toString(),
        uri: asset.uri,
        x: width / 2 - imgWidth / 2,
        y: height / 2 - imgHeight / 2,
        scale: 1,
        width: imgWidth,
        height: imgHeight,
      };
      setOverlayImages(prev => [...prev, newImage]);
    }
  };

  // Delete overlay image
  const deleteOverlayImage = (id: string) => {
    Alert.alert('Elimina', 'Vuoi eliminare questa immagine?', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Elimina', style: 'destructive', onPress: () => setOverlayImages(prev => prev.filter(i => i.id !== id)) },
    ]);
  };

  // Update overlay image position/scale
  const updateOverlayImage = (id: string, updates: Partial<OverlayImage>) => {
    setOverlayImages(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i));
  };

  // Apply animated particle effect
  const applyEffect = (effect: typeof ANIMATED_EFFECTS[0]) => {
    setSelectedEffect(effect.id);
    
    // Generate animated particles based on effect type
    const particleCount = 30;
    const newParticles = [];
    
    for (let i = 0; i < particleCount; i++) {
      const particle = {
        id: `${Date.now()}-${i}`,
        emoji: effect.particles[Math.floor(Math.random() * effect.particles.length)],
        x: Math.random() * width,
        y: effect.type === 'falling' ? -50 : effect.type === 'rising' ? height + 50 : Math.random() * height,
        opacity: 1,
        animationType: effect.type,
        delay: Math.random() * 2000,
        duration: 2000 + Math.random() * 2000,
      };
      newParticles.push(particle);
    }
    setEffectParticles(newParticles);
    setActivePanel('none');
  };

  // Add animated text sticker
  const addTextSticker = (textSticker: typeof TEXT_STICKERS[0]) => {
    const newSticker: StickerElement = {
      id: `text-${Date.now()}`,
      type: 'animated_text',
      content: textSticker.label,
      icon: 'text',
      x: width / 2 - 50,
      y: height / 2 - 20,
      scale: 1,
      color: textSticker.color,
      animation: textSticker.animation,
    };
    setStickers(prev => [...prev, newSticker]);
    setActivePanel('none');
  };

  // Add GIF sticker
  const addGifSticker = (gif: typeof GIF_STICKERS[0]) => {
    const newSticker: StickerElement = {
      id: `gif-${Date.now()}`,
      type: 'gif',
      content: gif.url,
      icon: 'image',
      x: width / 2 - 60,
      y: height / 2 - 60,
      scale: 1,
    };
    setStickers(prev => [...prev, newSticker]);
    setActivePanel('none');
  };

  // Clear effect
  const clearEffect = () => {
    setSelectedEffect(null);
    setEffectParticles([]);
  };

  // Delete element
  const deleteText = (id: string) => {
    Alert.alert('Elimina', 'Vuoi eliminare questo testo?', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Elimina', style: 'destructive', onPress: () => setTexts(prev => prev.filter(t => t.id !== id)) },
    ]);
  };

  const deleteSticker = (id: string) => {
    Alert.alert('Elimina', 'Vuoi eliminare questo sticker?', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Elimina', style: 'destructive', onPress: () => setStickers(prev => prev.filter(s => s.id !== id)) },
    ]);
  };

  // Update text position
  const updateTextPosition = (id: string, x: number, y: number) => {
    setTexts(prev => prev.map(t => t.id === id ? { ...t, x, y } : t));
  };

  // Update sticker position
  const updateStickerPosition = (id: string, x: number, y: number) => {
    setStickers(prev => prev.map(s => s.id === id ? { ...s, x, y } : s));
  };

  // Edit text
  const editText = (item: TextElement) => {
    setCurrentText(item.text);
    setTextColor(item.color);
    setTextBgColor(item.backgroundColor);
    setFontStyle(item.fontStyle);
    setEditingTextId(item.id);
    setActivePanel('text');
  };

  // Drawing handlers - using state-dependent approach
  const handleDrawTouchStart = (evt: any) => {
    if (!isDrawingMode) return;
    const { locationX, locationY } = evt.nativeEvent;
    setCurrentPath([{ x: locationX, y: locationY }]);
  };

  const handleDrawTouchMove = (evt: any) => {
    if (!isDrawingMode || currentPath.length === 0) return;
    const { locationX, locationY } = evt.nativeEvent;
    setCurrentPath(prev => [...prev, { x: locationX, y: locationY }]);
  };

  const handleDrawTouchEnd = () => {
    if (!isDrawingMode) return;
    if (currentPath.length > 1) {
      const pathString = currentPath.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
      setDrawings(prev => [...prev, {
        id: Date.now().toString(),
        points: pathString,
        color: drawColor,
        width: drawWidth,
      }]);
    }
    setCurrentPath([]);
  };

  // Undo last drawing
  const undoDrawing = () => {
    setDrawings(prev => prev.slice(0, -1));
  };

  // Handle save
  const handleSave = () => {
    onSave({
      texts,
      stickers,
      drawings,
      overlayImages, // Include overlay images
      backgroundColor,
      caption,
      music: selectedMusic, // Include selected music
      effect: selectedEffect, // Include selected effect (ID only, animations done in viewer)
    });
  };

  // Render text element
  const renderTextElement = (item: TextElement) => {
    const getFontFamily = () => {
      switch (item.fontStyle) {
        case 'signature': return { fontStyle: 'italic' as const };
        case 'modern': return { fontWeight: '300' as const };
        default: return { fontWeight: 'bold' as const };
      }
    };

    return (
      <DraggableItem
        key={item.id}
        initialX={item.x}
        initialY={item.y}
        onPositionChange={(x, y) => updateTextPosition(item.id, x, y)}
        onDelete={() => deleteText(item.id)}
        onTap={() => editText(item)}
      >
        <View style={[
          styles.textElement,
          item.backgroundColor ? { backgroundColor: item.backgroundColor, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 } : null,
        ]}>
          <Text style={[{ color: item.color, fontSize: item.fontSize }, getFontFamily(), styles.textShadow]}>
            {item.text}
          </Text>
        </View>
      </DraggableItem>
    );
  };

  // Render sticker element
  const renderStickerElement = (item: StickerElement) => {
    if (item.type === 'emoji') {
      return (
        <DraggableItem
          key={item.id}
          initialX={item.x}
          initialY={item.y}
          initialScale={item.scale || 1}
          onPositionChange={(x, y) => updateStickerPosition(item.id, x, y)}
          onScaleChange={(scale) => setStickers(prev => prev.map(s => s.id === item.id ? { ...s, scale } : s))}
          onDelete={() => deleteSticker(item.id)}
        >
          <Text style={{ fontSize: 60 }}>{item.content}</Text>
        </DraggableItem>
      );
    }

    // GIF sticker - render as animated image
    if (item.type === 'gif') {
      return (
        <DraggableItem
          key={item.id}
          initialX={item.x}
          initialY={item.y}
          initialScale={item.scale || 1}
          onPositionChange={(x, y) => updateStickerPosition(item.id, x, y)}
          onScaleChange={(scale) => setStickers(prev => prev.map(s => s.id === item.id ? { ...s, scale } : s))}
          onDelete={() => deleteSticker(item.id)}
        >
          <Image
            source={{ uri: item.content }}
            style={{ width: 120, height: 120, borderRadius: 12 }}
            resizeMode="cover"
          />
        </DraggableItem>
      );
    }

    // Animated text sticker (LOVE, WOW, etc.)
    if (item.type === 'animated_text') {
      return (
        <DraggableItem
          key={item.id}
          initialX={item.x}
          initialY={item.y}
          initialScale={item.scale || 1}
          onPositionChange={(x, y) => updateStickerPosition(item.id, x, y)}
          onScaleChange={(scale) => setStickers(prev => prev.map(s => s.id === item.id ? { ...s, scale } : s))}
          onDelete={() => deleteSticker(item.id)}
        >
          <View style={[styles.animatedTextSticker, { borderColor: item.color || '#FF1493' }]}>
            <Text style={[styles.animatedTextLabel, { color: item.color || '#FF1493' }]}>
              {item.content}
            </Text>
          </View>
        </DraggableItem>
      );
    }

    // Widget sticker
    return (
      <DraggableItem
        key={item.id}
        initialX={item.x}
        initialY={item.y}
        initialScale={item.scale || 1}
        onPositionChange={(x, y) => updateStickerPosition(item.id, x, y)}
        onScaleChange={(scale) => setStickers(prev => prev.map(s => s.id === item.id ? { ...s, scale } : s))}
        onDelete={() => deleteSticker(item.id)}
      >
        <View style={styles.widgetSticker}>
          {item.icon && <Ionicons name={item.icon as any} size={20} color="#fff" />}
          <Text style={styles.widgetText} numberOfLines={1}>
            {item.icon === 'stats-chart' ? item.content.split('|')[0] : item.content}
          </Text>
        </View>
      </DraggableItem>
    );
  };

  // Sidebar tool button
  const SidebarTool = ({ icon, label, onPress, isActive }: { icon: string; label: string; onPress: () => void; isActive?: boolean }) => (
    <TouchableOpacity style={styles.sidebarTool} onPress={onPress}>
      <Text style={styles.sidebarLabel}>{label}</Text>
      <View style={[styles.sidebarIcon, isActive && styles.sidebarIconActive]}>
        <Ionicons name={icon as any} size={22} color="#fff" />
      </View>
    </TouchableOpacity>
  );

  const isAnyPanelOpen = activePanel !== 'none';

  // Main media pinch-to-zoom gesture - REQUIRES 2 fingers for pan to avoid conflicts
  const mainMediaScale = useSharedValue(1);
  const savedMainScale = useSharedValue(1);
  const mainMediaTranslateX = useSharedValue(0);
  const mainMediaTranslateY = useSharedValue(0);
  const savedMainTranslateX = useSharedValue(0);
  const savedMainTranslateY = useSharedValue(0);

  const mainPinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      mainMediaScale.value = Math.min(Math.max(savedMainScale.value * event.scale, 0.3), 4);
    })
    .onEnd(() => {
      savedMainScale.value = mainMediaScale.value;
    });

  // Two-finger pan for moving main media
  const mainPanGesture = Gesture.Pan()
    .minPointers(2) // Requires 2 fingers - allows single finger for other elements
    .onUpdate((event) => {
      mainMediaTranslateX.value = savedMainTranslateX.value + event.translationX;
      mainMediaTranslateY.value = savedMainTranslateY.value + event.translationY;
    })
    .onEnd(() => {
      savedMainTranslateX.value = mainMediaTranslateX.value;
      savedMainTranslateY.value = mainMediaTranslateY.value;
    });

  const mainMediaGesture = Gesture.Simultaneous(mainPinchGesture, mainPanGesture);

  const mainMediaAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: mainMediaTranslateX.value },
      { translateY: mainMediaTranslateY.value },
      { scale: mainMediaScale.value },
    ],
  }));

  return (
    <GestureHandlerRootView style={styles.container}>
      {/* Background color overlay */}
      {backgroundColor !== 'transparent' && <View style={[StyleSheet.absoluteFill, { backgroundColor }]} />}

      {/* Media layer - visual only, no gestures */}
      <View style={styles.mediaContainer} pointerEvents="none">
        <Animated.View style={[styles.mediaInner, mainMediaAnimatedStyle]}>
          {mediaType === 'video' ? (
            <Video
              source={{ uri: mediaUri }}
              style={styles.media}
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay
              isLooping
              isMuted={false}
            />
          ) : (
            <Image source={{ uri: mediaUri }} style={styles.media} resizeMode="contain" />
          )}
        </Animated.View>

        {/* Drawing canvas - only show saved drawings when NOT in drawing mode */}
        {!isDrawingMode && drawings.length > 0 && (
          <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
            {drawings.map(d => (
              <Path key={d.id} d={d.points} stroke={d.color} strokeWidth={d.width} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            ))}
          </Svg>
        )}

        {/* Original poster watermark */}
        {originalPoster && (
          <View style={styles.watermark}>
            <Text style={styles.watermarkText}>{originalPoster.username}</Text>
          </View>
        )}
      </View>

      {/* Gesture layer for main media - captures 2-finger gestures */}
      {!isDrawingMode && !isAnyPanelOpen && (
        <GestureDetector gesture={mainMediaGesture}>
          <Animated.View style={[StyleSheet.absoluteFill, { zIndex: 5 }]} pointerEvents="box-none" />
        </GestureDetector>
      )}

      {/* Drawing overlay - captures touch events when drawing */}
      {isDrawingMode && (
        <View
          style={[StyleSheet.absoluteFill, { zIndex: 50 }]}
          onTouchStart={handleDrawTouchStart}
          onTouchMove={handleDrawTouchMove}
          onTouchEnd={handleDrawTouchEnd}
        >
          {/* SVG canvas for active drawing */}
          <Svg style={StyleSheet.absoluteFill}>
            {drawings.map(d => (
              <Path key={d.id} d={d.points} stroke={d.color} strokeWidth={d.width} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            ))}
            {currentPath.length > 0 && (
              <Path
                d={currentPath.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')}
                stroke={drawColor}
                strokeWidth={drawWidth}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </Svg>
        </View>
      )}

      {/* Rendered elements - outside media container so they're always visible */}
      {!isDrawingMode && texts.map(renderTextElement)}
      {!isDrawingMode && stickers.map(renderStickerElement)}
      {/* Overlay images */}
      {!isDrawingMode && overlayImages.map((img) => (
        <DraggableItem
          key={img.id}
          initialX={img.x}
          initialY={img.y}
          initialScale={img.scale}
          onPositionChange={(x, y) => updateOverlayImage(img.id, { x, y })}
          onScaleChange={(scale) => updateOverlayImage(img.id, { scale })}
          onDelete={() => deleteOverlayImage(img.id)}
        >
          <Image
            source={{ uri: img.uri }}
            style={{ width: img.width, height: img.height, borderRadius: 8 }}
            resizeMode="cover"
          />
        </DraggableItem>
      ))}

      {/* Top bar - zIndex 100 to be above drawing layer */}
      <View style={[styles.topBar, { zIndex: 100 }]}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>

        {isDrawingMode ? (
          <View style={styles.drawingTopBar}>
            <TouchableOpacity onPress={undoDrawing} style={styles.undoButton}>
              <Ionicons name="arrow-undo" size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setIsDrawingMode(false)} style={styles.doneDrawButton}>
              <Text style={styles.doneDrawText}>Fine</Text>
            </TouchableOpacity>
          </View>
        ) : !isAnyPanelOpen && (
          <TouchableOpacity style={styles.textToolButton} onPress={() => openPanel('text')}>
            <Text style={styles.textToolLabel}>Testo</Text>
            <View style={styles.textToolIcon}>
              <Text style={styles.aaText}>Aa</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* Right sidebar */}
      {showSidebar && !isAnyPanelOpen && !isDrawingMode && (
        <View style={styles.sidebar}>
          <SidebarTool icon="happy-outline" label="Adesivi" onPress={() => openPanel('stickers')} />
          <SidebarTool icon="sparkles-outline" label="Effetti" onPress={() => openPanel('effects')} />
          <SidebarTool icon="image-outline" label="Immagine" onPress={addOverlayImage} />
          <SidebarTool icon="musical-note" label="Audio" onPress={() => { loadMusicSongs(); openPanel('music'); }} />
          <SidebarTool icon="at" label="Menziona" onPress={() => { loadMentionUsers(''); openPanel('mention'); }} />
          <SidebarTool icon="color-palette-outline" label="Sfondo" onPress={() => openPanel('background')} />
          <SidebarTool icon="brush-outline" label="Disegna" onPress={() => setIsDrawingMode(true)} />
          <TouchableOpacity style={styles.collapseButton} onPress={() => setShowSidebar(false)}>
            <Ionicons name="chevron-up" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      {/* Drawing tools bar - zIndex 100 to be above drawing layer */}
      {isDrawingMode && (
        <View style={[styles.drawToolsBar, { zIndex: 100 }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.drawColorsRow}>
            {COLORS.map(c => (
              <TouchableOpacity
                key={c}
                style={[styles.drawColorDot, { backgroundColor: c }, drawColor === c && styles.drawColorSelected]}
                onPress={() => setDrawColor(c)}
              />
            ))}
          </ScrollView>
          <View style={styles.brushSizes}>
            {[3, 5, 8, 12].map(w => (
              <TouchableOpacity
                key={w}
                style={[styles.brushSize, drawWidth === w && styles.brushSizeSelected]}
                onPress={() => setDrawWidth(w)}
              >
                <View style={[styles.brushDot, { width: w * 2, height: w * 2, backgroundColor: drawColor }]} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Expand sidebar button */}
      {!showSidebar && !isAnyPanelOpen && !isDrawingMode && (
        <TouchableOpacity style={styles.expandButton} onPress={() => setShowSidebar(true)}>
          <Ionicons name="chevron-down" size={20} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Bottom bar */}
      {!isAnyPanelOpen && !isDrawingMode && (
        <View style={styles.bottomBar}>
          <TextInput
            style={styles.captionInput}
            placeholder="Aggiungi una didascalia..."
            placeholderTextColor="rgba(255,255,255,0.6)"
            value={caption}
            onChangeText={setCaption}
          />
          <View style={styles.bottomActions}>
            <View style={styles.profilePill}>
              <View style={styles.miniAvatar} />
              <Text style={styles.storyLabel}>Le tue storie</Text>
            </View>
            <TouchableOpacity style={styles.closeFriendsPill}>
              <Ionicons name="star" size={16} color="#34C759" />
              <Text style={styles.closeFriendsLabel}>Amici pi...</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.nextButton} onPress={handleSave}>
              <Ionicons name="arrow-forward" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* TEXT PANEL */}
      <Modal visible={activePanel === 'text'} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.textEditOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => { Keyboard.dismiss(); setActivePanel('none'); setCurrentText(''); setEditingTextId(null); }} />

          <View style={styles.textEditHeader}>
            <TouchableOpacity onPress={() => { setActivePanel('none'); setCurrentText(''); setEditingTextId(null); }}>
              <Text style={styles.cancelText}>Annulla</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={addTextElement}>
              <Text style={styles.doneText}>Fine</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.textPreviewArea}>
            <TextInput
              style={[
                styles.textInput,
                { color: textColor },
                textBgColor && { backgroundColor: textBgColor, paddingHorizontal: 12 },
                fontStyle === 'signature' && { fontStyle: 'italic' },
                fontStyle === 'modern' && { fontWeight: '300' },
                fontStyle === 'classic' && { fontWeight: 'bold' },
              ]}
              value={currentText}
              onChangeText={setCurrentText}
              placeholder="Scrivi qualcosa..."
              placeholderTextColor="rgba(255,255,255,0.5)"
              multiline
              autoFocus
              textAlign="center"
            />
          </View>

          {/* Font styles */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.fontStylesRow}>
            {FONT_STYLES.map(f => (
              <TouchableOpacity
                key={f.id}
                style={[styles.fontStyleBtn, fontStyle === f.id && styles.fontStyleActive]}
                onPress={() => setFontStyle(f.id as any)}
              >
                <Text style={[styles.fontStyleText, fontStyle === f.id && styles.fontStyleTextActive]}>{f.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Text tools */}
          <View style={styles.textToolsRow}>
            <TouchableOpacity style={styles.textToolItem}>
              <Text style={styles.aaSmall}>Aa</Text>
            </TouchableOpacity>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.colorScrollView}>
              {COLORS.map(c => (
                <TouchableOpacity
                  key={c}
                  style={[styles.colorDot, { backgroundColor: c }, textColor === c && styles.colorDotSelected]}
                  onPress={() => setTextColor(c)}
                />
              ))}
            </ScrollView>
            <TouchableOpacity
              style={[styles.textToolItem, textBgColor && styles.textToolActive]}
              onPress={() => setTextBgColor(textBgColor ? null : 'rgba(0,0,0,0.6)')}
            >
              <View style={styles.textBgIcon}>
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>A</Text>
              </View>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* STICKERS PANEL */}
      <Modal visible={activePanel === 'stickers'} transparent animationType="slide">
        <View style={styles.stickerPanel}>
          <View style={styles.stickerHeader}>
            <View style={styles.dragHandle} />
            <TouchableOpacity style={styles.closeStickerBtn} onPress={() => setActivePanel('none')}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.stickerSearch}
            placeholder="Cerca"
            placeholderTextColor="#888"
          />

          <ScrollView style={styles.stickerContent} showsVerticalScrollIndicator={false}>
            {/* Widget stickers */}
            <View style={styles.widgetGrid}>
              {STICKERS.map((s, i) => (
                <TouchableOpacity key={i} style={styles.widgetItem} onPress={() => addWidget(s)}>
                  <View style={styles.widgetIconBg}>
                    <Ionicons name={s.icon as any} size={24} color="#fff" />
                  </View>
                  <Text style={styles.widgetLabel}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Emoji section */}
            <Text style={styles.sectionTitle}>Emoji</Text>
            <View style={styles.emojiGrid}>
              {EMOJIS.map((e, i) => (
                <TouchableOpacity key={i} style={styles.emojiItem} onPress={() => { addEmoji(e); setActivePanel('none'); }}>
                  <Text style={styles.emoji}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* BACKGROUND PANEL */}
      <Modal visible={activePanel === 'background'} transparent animationType="slide">
        <View style={styles.bgPanel}>
          <View style={styles.bgHeader}>
            <Text style={styles.bgTitle}>Sfondo</Text>
            <TouchableOpacity onPress={() => setActivePanel('none')}>
              <Text style={styles.bgDone}>Fine</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bgColors}>
            {BACKGROUNDS.map((c, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.bgColorItem, backgroundColor === c && styles.bgColorSelected, c === 'transparent' && styles.bgTransparent]}
                onPress={() => setBackgroundColor(c)}
              >
                {c === 'transparent' ? (
                  <Ionicons name="close" size={20} color="#fff" />
                ) : (
                  <View style={[styles.bgColorInner, { backgroundColor: c }]} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* MUSIC PANEL */}
      <Modal visible={activePanel === 'music'} transparent animationType="slide">
        <View style={styles.musicPanel}>
          <View style={styles.musicHeader}>
            <TouchableOpacity onPress={() => setActivePanel('none')}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.musicTitle}>Musica</Text>
            <View style={{ width: 28 }} />
          </View>
          <TextInput 
            style={styles.musicSearch} 
            placeholder="Cerca brani..." 
            placeholderTextColor="#888"
            value={musicSearch}
            onChangeText={(text) => { setMusicSearch(text); loadMusicSongs(text); }}
          />
          
          {/* Selected music indicator */}
          {selectedMusic && (
            <View style={styles.selectedMusicBanner}>
              <Ionicons name="musical-notes" size={18} color="#34C759" />
              <Text style={styles.selectedMusicText} numberOfLines={1}>{selectedMusic.title} - {selectedMusic.artist}</Text>
              <TouchableOpacity onPress={() => { setSelectedMusic(null); setStickers(prev => prev.filter(s => !s.id.startsWith('music-'))); }}>
                <Ionicons name="close-circle" size={20} color="#888" />
              </TouchableOpacity>
            </View>
          )}
          
          <ScrollView style={styles.musicList}>
            {musicLoading ? (
              <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
            ) : musicSongs.length > 0 ? (
              musicSongs.map((song) => (
                <TouchableOpacity key={song.id} style={styles.musicSongItem} onPress={() => selectMusic(song)}>
                  <View style={styles.musicSongIcon}>
                    <Ionicons name="musical-notes" size={20} color="#fff" />
                  </View>
                  <View style={styles.musicSongInfo}>
                    <Text style={styles.musicSongTitle} numberOfLines={1}>{song.title}</Text>
                    <Text style={styles.musicSongArtist} numberOfLines={1}>{song.artist} • {formatDuration(song.duration)}</Text>
                  </View>
                  <Ionicons name="add-circle-outline" size={24} color="#007AFF" />
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.musicEmpty}>
                <Ionicons name="musical-notes-outline" size={50} color="#666" />
                <Text style={styles.musicEmptyText}>Nessun brano trovato</Text>
                <Text style={styles.musicEmptySubtext}>Aggiungi musica dalla pagina Musica</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* LINK PANEL */}
      <Modal visible={activePanel === 'link'} transparent animationType="slide">
        <View style={styles.linkPanel}>
          <View style={styles.linkHeader}>
            <TouchableOpacity onPress={() => { setActivePanel('none'); setLinkUrl(''); }}>
              <Text style={styles.linkCancel}>Annulla</Text>
            </TouchableOpacity>
            <Text style={styles.linkTitle}>Aggiungi link</Text>
            <TouchableOpacity onPress={addLinkWidget}>
              <Text style={styles.linkDone}>Fine</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.linkInput}
            placeholder="https://..."
            placeholderTextColor="#888"
            value={linkUrl}
            onChangeText={setLinkUrl}
            autoCapitalize="none"
            keyboardType="url"
          />
        </View>
      </Modal>

      {/* POLL PANEL */}
      <Modal visible={activePanel === 'poll'} transparent animationType="slide">
        <View style={styles.pollPanel}>
          <View style={styles.pollHeader}>
            <TouchableOpacity onPress={() => { setActivePanel('none'); setPollQuestion(''); setPollOptions(['', '']); }}>
              <Text style={styles.pollCancel}>Annulla</Text>
            </TouchableOpacity>
            <Text style={styles.pollTitle}>Sondaggio</Text>
            <TouchableOpacity onPress={addPollWidget}>
              <Text style={styles.pollDone}>Fine</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.pollQuestion}
            placeholder="Fai una domanda..."
            placeholderTextColor="#888"
            value={pollQuestion}
            onChangeText={setPollQuestion}
          />
          {pollOptions.map((opt, i) => (
            <TextInput
              key={i}
              style={styles.pollOption}
              placeholder={`Opzione ${i + 1}`}
              placeholderTextColor="#888"
              value={opt}
              onChangeText={(t) => {
                const newOpts = [...pollOptions];
                newOpts[i] = t;
                setPollOptions(newOpts);
              }}
            />
          ))}
          <TouchableOpacity onPress={() => setPollOptions([...pollOptions, ''])}>
            <Text style={styles.addOption}>+ Aggiungi opzione</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* QUESTION PANEL */}
      <Modal visible={activePanel === 'question'} transparent animationType="slide">
        <View style={styles.questionPanel}>
          <View style={styles.questionHeader}>
            <TouchableOpacity onPress={() => { setActivePanel('none'); setQuestionText(''); }}>
              <Text style={styles.questionCancel}>Annulla</Text>
            </TouchableOpacity>
            <Text style={styles.questionTitle}>Domande</Text>
            <TouchableOpacity onPress={addQuestionWidget}>
              <Text style={styles.questionDone}>Fine</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.questionInput}
            placeholder="Fammi una domanda"
            placeholderTextColor="#888"
            value={questionText}
            onChangeText={setQuestionText}
          />
        </View>
      </Modal>

      {/* LOCATION PANEL */}
      <Modal visible={activePanel === 'location'} transparent animationType="slide">
        <View style={styles.locationPanel}>
          <View style={styles.locationHeader}>
            <TouchableOpacity onPress={() => { setActivePanel('none'); setLocationText(''); }}>
              <Text style={styles.locationCancel}>Annulla</Text>
            </TouchableOpacity>
            <Text style={styles.locationTitle}>Luogo</Text>
            <TouchableOpacity onPress={addLocationWidget}>
              <Text style={styles.locationDone}>Fine</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.locationInput}
            placeholder="Cerca un luogo..."
            placeholderTextColor="#888"
            value={locationText}
            onChangeText={setLocationText}
          />
          <View style={styles.locationSuggestions}>
            {['Roma, Italia', 'Milano, Italia', 'Napoli, Italia', 'Firenze, Italia'].map((loc, i) => (
              <TouchableOpacity key={i} style={styles.locationItem} onPress={() => setLocationText(loc)}>
                <Ionicons name="location-outline" size={20} color="#007AFF" />
                <Text style={styles.locationItemText}>{loc}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* COUNTDOWN PANEL */}
      <Modal visible={activePanel === 'countdown'} transparent animationType="slide">
        <View style={styles.countdownPanel}>
          <View style={styles.countdownHeader}>
            <TouchableOpacity onPress={() => { setActivePanel('none'); setCountdownTitle(''); setCountdownDate(''); }}>
              <Text style={styles.countdownCancel}>Annulla</Text>
            </TouchableOpacity>
            <Text style={styles.countdownTitle}>Countdown</Text>
            <TouchableOpacity onPress={addCountdownWidget}>
              <Text style={styles.countdownDone}>Fine</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.countdownInput}
            placeholder="Nome evento..."
            placeholderTextColor="#888"
            value={countdownTitle}
            onChangeText={setCountdownTitle}
          />
          <TextInput
            style={styles.countdownInput}
            placeholder="Data (es: 25/12/2025)"
            placeholderTextColor="#888"
            value={countdownDate}
            onChangeText={setCountdownDate}
          />
        </View>
      </Modal>

      {/* HASHTAG PANEL */}
      <Modal visible={activePanel === 'hashtag'} transparent animationType="slide">
        <View style={styles.hashtagPanel}>
          <View style={styles.hashtagHeader}>
            <TouchableOpacity onPress={() => { setActivePanel('none'); setHashtagText(''); }}>
              <Text style={styles.hashtagCancel}>Annulla</Text>
            </TouchableOpacity>
            <Text style={styles.hashtagTitle}>#Hashtag</Text>
            <TouchableOpacity onPress={addHashtagWidget}>
              <Text style={styles.hashtagDone}>Fine</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.hashtagInput}
            placeholder="Scrivi un hashtag..."
            placeholderTextColor="#888"
            value={hashtagText}
            onChangeText={setHashtagText}
            autoCapitalize="none"
          />
          <View style={styles.hashtagSuggestions}>
            {['dance', 'balletto', 'hiphop', 'salsa', 'tango', 'beatmates'].map((tag, i) => (
              <TouchableOpacity key={i} style={styles.hashtagItem} onPress={() => setHashtagText(tag)}>
                <Text style={styles.hashtagItemText}>#{tag}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* MENTION PANEL */}
      <Modal visible={activePanel === 'mention'} transparent animationType="slide">
        <View style={styles.mentionPanel}>
          <View style={styles.mentionHeader}>
            <TouchableOpacity onPress={() => { setActivePanel('none'); setMentionSearch(''); }}>
              <Text style={styles.mentionCancel}>Annulla</Text>
            </TouchableOpacity>
            <Text style={styles.mentionTitle}>@Menziona</Text>
            <View style={{ width: 60 }} />
          </View>
          <TextInput
            style={styles.mentionSearch}
            placeholder="Cerca utente..."
            placeholderTextColor="#888"
            value={mentionSearch}
            onChangeText={(text) => { setMentionSearch(text); loadMentionUsers(text); }}
          />
          <ScrollView style={styles.mentionList}>
            {mentionUsers.map((user) => (
              <TouchableOpacity key={user.id} style={styles.mentionItem} onPress={() => addMentionWidget(user)}>
                <View style={styles.mentionAvatar}>
                  {user.profile_image ? (
                    <Image source={{ uri: getMediaUrl(user.profile_image) || '' }} style={styles.mentionAvatarImg} />
                  ) : (
                    <Ionicons name="person" size={20} color="#fff" />
                  )}
                </View>
                <View style={styles.mentionInfo}>
                  <Text style={styles.mentionUsername}>@{user.username}</Text>
                  <Text style={styles.mentionName}>{user.name}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* EFFECTS PANEL - Instagram-style */}
      <Modal visible={activePanel === 'effects'} transparent animationType="slide">
        <View style={styles.effectsPanel}>
          <View style={styles.effectsHeader}>
            <View style={styles.dragHandle} />
            <TouchableOpacity style={styles.closeEffectsBtn} onPress={() => setActivePanel('none')}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.effectsContent} showsVerticalScrollIndicator={false}>
            {/* Animated Text Stickers */}
            <Text style={styles.effectsSectionTitle}>Scritte Animate</Text>
            <View style={styles.effectsGrid}>
              {TEXT_STICKERS.map((ts) => (
                <TouchableOpacity 
                  key={ts.id} 
                  style={styles.effectItem}
                  onPress={() => addTextSticker(ts)}
                >
                  <View style={[styles.effectIconBg, { borderWidth: 2, borderColor: ts.color }]}>
                    <Text style={{ fontSize: 12, fontWeight: 'bold', color: ts.color }}>{ts.label}</Text>
                  </View>
                  <Text style={styles.effectLabel}>{ts.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Animated Particle Effects */}
            <Text style={styles.effectsSectionTitle}>Effetti Animati</Text>
            <View style={styles.effectsGrid}>
              {ANIMATED_EFFECTS.map((effect) => (
                <TouchableOpacity 
                  key={effect.id} 
                  style={[styles.effectItem, selectedEffect === effect.id && styles.effectItemSelected]}
                  onPress={() => applyEffect(effect)}
                >
                  <View style={styles.effectIconBg}>
                    <Text style={{ fontSize: 28 }}>{effect.preview}</Text>
                  </View>
                  <Text style={styles.effectLabel}>{effect.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* GIF Stickers */}
            <Text style={styles.effectsSectionTitle}>GIF Animate</Text>
            <View style={styles.gifGrid}>
              {GIF_STICKERS.map((gif) => (
                <TouchableOpacity 
                  key={gif.id} 
                  style={styles.gifItem}
                  onPress={() => addGifSticker(gif)}
                >
                  <Image 
                    source={{ uri: gif.url }} 
                    style={styles.gifPreview}
                    resizeMode="cover"
                  />
                  <Text style={styles.gifLabel}>{gif.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Clear Effects Button */}
            {selectedEffect && (
              <TouchableOpacity style={styles.clearEffectBtn} onPress={clearEffect}>
                <Ionicons name="close-circle" size={20} color="#FF3B30" />
                <Text style={styles.clearEffectText}>Rimuovi Effetto</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Animated particle effect overlay */}
      {effectParticles.length > 0 && (
        <AnimatedParticles particles={effectParticles} />
      )}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  mediaContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  mediaInner: {
    width: '100%',
    height: '100%',
  },
  media: {
    width: '100%',
    height: '100%',
  },
  watermark: {
    position: 'absolute',
    top: 12,
    left: 12,
  },
  watermarkText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  topBar: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    zIndex: 100,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(60,60,60,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textToolButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  textToolLabel: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  textToolIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(60,60,60,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aaText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  sidebar: {
    position: 'absolute',
    right: 12,
    top: 120,
    alignItems: 'flex-end',
    gap: 4,
    zIndex: 90,
  },
  sidebarTool: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  sidebarLabel: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  sidebarIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(60,60,60,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sidebarIconActive: {
    backgroundColor: Colors.primary,
  },
  collapseButton: {
    width: 44,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(60,60,60,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  expandButton: {
    position: 'absolute',
    right: 12,
    top: 120,
    width: 44,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(60,60,60,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    gap: 12,
  },
  captionInput: {
    backgroundColor: 'rgba(60,60,60,0.9)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 14,
  },
  bottomActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profilePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(60,60,60,0.9)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  miniAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#666',
  },
  storyLabel: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
  closeFriendsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(60,60,60,0.9)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    flex: 1,
  },
  closeFriendsLabel: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
  nextButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Text editing
  textEditOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
  },
  textEditHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
  },
  cancelText: {
    color: '#fff',
    fontSize: 16,
  },
  doneText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  textPreviewArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  textInput: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    minWidth: 200,
    maxWidth: width - 40,
  },
  fontStylesRow: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  fontStyleBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  fontStyleActive: {
    backgroundColor: '#fff',
  },
  fontStyleText: {
    color: '#fff',
    fontSize: 14,
  },
  fontStyleTextActive: {
    color: '#000',
  },
  textToolsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 30,
    gap: 12,
  },
  textToolItem: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textToolActive: {
    backgroundColor: Colors.primary,
  },
  aaSmall: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  colorScrollView: {
    flex: 1,
  },
  colorDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorDotSelected: {
    borderColor: '#fff',
  },
  textBgIcon: {
    width: 22,
    height: 22,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Draggable elements
  draggableElement: {
    position: 'absolute',
    zIndex: 50,
  },
  textElement: {
    maxWidth: width - 40,
  },
  textShadow: {
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  widgetSticker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
    maxWidth: 200,
  },
  widgetText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  // Sticker panel
  stickerPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: height * 0.7,
    backgroundColor: '#1c1c1e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  stickerHeader: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#666',
    borderRadius: 2,
  },
  closeStickerBtn: {
    position: 'absolute',
    right: 16,
    top: 8,
  },
  stickerSearch: {
    backgroundColor: '#2c2c2e',
    marginHorizontal: 16,
    marginVertical: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    color: '#fff',
    fontSize: 16,
  },
  stickerContent: {
    flex: 1,
    paddingHorizontal: 16,
  },
  widgetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  widgetItem: {
    width: (width - 48) / 4,
    alignItems: 'center',
    marginBottom: 16,
  },
  widgetIconBg: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#2c2c2e',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  widgetLabel: {
    color: '#fff',
    fontSize: 11,
    textAlign: 'center',
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  emojiItem: {
    width: (width - 48) / 6,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 32,
  },
  // Drawing
  drawingTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  undoButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(60,60,60,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneDrawButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  doneDrawText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  drawToolsBar: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    gap: 12,
  },
  drawColorsRow: {
    paddingVertical: 8,
  },
  drawColorDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  drawColorSelected: {
    borderColor: '#fff',
    borderWidth: 3,
  },
  brushSizes: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  brushSize: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(60,60,60,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brushSizeSelected: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  brushDot: {
    borderRadius: 50,
  },
  // Background panel
  bgPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1c1c1e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  bgHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  bgTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  bgDone: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  bgColors: {
    paddingBottom: 20,
  },
  bgColorItem: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2c2c2e',
  },
  bgColorSelected: {
    borderColor: '#007AFF',
  },
  bgTransparent: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#666',
  },
  bgColorInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  // Music panel
  musicPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: height * 0.7,
    backgroundColor: '#1c1c1e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
  },
  musicHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  musicTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  musicSearch: {
    backgroundColor: '#2c2c2e',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    color: '#fff',
    fontSize: 16,
    marginBottom: 16,
  },
  musicList: {
    flex: 1,
  },
  musicCat: {
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#333',
  },
  musicCatText: {
    color: '#fff',
    fontSize: 16,
  },
  musicPlaceholder: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 40,
  },
  selectedMusicBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2c2c2e',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 12,
    gap: 10,
  },
  selectedMusicText: {
    flex: 1,
    color: '#34C759',
    fontSize: 14,
    fontWeight: '500',
  },
  musicSongItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#333',
    gap: 12,
  },
  musicSongIcon: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  musicSongInfo: {
    flex: 1,
  },
  musicSongTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  musicSongArtist: {
    color: '#888',
    fontSize: 14,
    marginTop: 2,
  },
  musicEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  musicEmptyText: {
    color: '#888',
    fontSize: 16,
    marginTop: 16,
  },
  musicEmptySubtext: {
    color: '#666',
    fontSize: 14,
    marginTop: 4,
  },
  // Link panel
  linkPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1c1c1e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  linkHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  linkCancel: {
    color: '#fff',
    fontSize: 16,
  },
  linkTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  linkDone: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  linkInput: {
    backgroundColor: '#2c2c2e',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 10,
    color: '#fff',
    fontSize: 16,
    marginBottom: 30,
  },
  // Poll panel
  pollPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1c1c1e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  pollHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  pollCancel: {
    color: '#fff',
    fontSize: 16,
  },
  pollTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  pollDone: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  pollQuestion: {
    backgroundColor: '#2c2c2e',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 10,
    color: '#fff',
    fontSize: 16,
    marginBottom: 12,
  },
  pollOption: {
    backgroundColor: '#2c2c2e',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    color: '#fff',
    fontSize: 16,
    marginBottom: 8,
  },
  addOption: {
    color: '#007AFF',
    fontSize: 14,
    marginTop: 8,
    marginBottom: 30,
  },
  // Question panel
  questionPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1c1c1e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  questionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  questionCancel: {
    color: '#fff',
    fontSize: 16,
  },
  questionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  questionDone: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  questionInput: {
    backgroundColor: '#2c2c2e',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 10,
    color: '#fff',
    fontSize: 16,
    marginBottom: 30,
  },
  // Location panel
  locationPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: height * 0.5,
    backgroundColor: '#1c1c1e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  locationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  locationCancel: { color: '#fff', fontSize: 16 },
  locationTitle: { color: '#fff', fontSize: 18, fontWeight: '600' },
  locationDone: { color: '#007AFF', fontSize: 16, fontWeight: '600' },
  locationInput: {
    backgroundColor: '#2c2c2e',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    color: '#fff',
    fontSize: 16,
    marginBottom: 16,
  },
  locationSuggestions: { flex: 1 },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#333',
    gap: 12,
  },
  locationItemText: { color: '#fff', fontSize: 16 },
  // Countdown panel
  countdownPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1c1c1e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  countdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  countdownCancel: { color: '#fff', fontSize: 16 },
  countdownTitle: { color: '#fff', fontSize: 18, fontWeight: '600' },
  countdownDone: { color: '#007AFF', fontSize: 16, fontWeight: '600' },
  countdownInput: {
    backgroundColor: '#2c2c2e',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 10,
    color: '#fff',
    fontSize: 16,
    marginBottom: 12,
  },
  // Hashtag panel
  hashtagPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: height * 0.45,
    backgroundColor: '#1c1c1e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  hashtagHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  hashtagCancel: { color: '#fff', fontSize: 16 },
  hashtagTitle: { color: '#fff', fontSize: 18, fontWeight: '600' },
  hashtagDone: { color: '#007AFF', fontSize: 16, fontWeight: '600' },
  hashtagInput: {
    backgroundColor: '#2c2c2e',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    color: '#fff',
    fontSize: 16,
    marginBottom: 16,
  },
  hashtagSuggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  hashtagItem: {
    backgroundColor: '#2c2c2e',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  hashtagItemText: { color: '#007AFF', fontSize: 14 },
  // Mention panel
  mentionPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: height * 0.6,
    backgroundColor: '#1c1c1e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  mentionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  mentionCancel: { color: '#fff', fontSize: 16 },
  mentionTitle: { color: '#fff', fontSize: 18, fontWeight: '600' },
  mentionSearch: {
    backgroundColor: '#2c2c2e',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    color: '#fff',
    fontSize: 16,
    marginBottom: 16,
  },
  mentionList: { flex: 1 },
  mentionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#333',
    gap: 12,
  },
  mentionAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2c2c2e',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  mentionAvatarImg: { width: 44, height: 44 },
  mentionInfo: { flex: 1 },
  mentionUsername: { color: '#fff', fontSize: 16, fontWeight: '600' },
  mentionName: { color: '#888', fontSize: 14 },
  // Effects panel
  effectsPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: height * 0.7,
    backgroundColor: '#1c1c1e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  effectsHeader: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  closeEffectsBtn: {
    position: 'absolute',
    right: 16,
    top: 8,
  },
  effectsContent: {
    flex: 1,
    paddingHorizontal: 16,
  },
  effectsSectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 12,
  },
  effectsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  effectItem: {
    width: (width - 80) / 4,
    alignItems: 'center',
    marginBottom: 12,
  },
  effectItemSelected: {
    opacity: 0.5,
  },
  effectIconBg: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#2c2c2e',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  effectLabel: {
    color: '#fff',
    fontSize: 11,
    textAlign: 'center',
  },
  gifGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gifItem: {
    width: (width - 64) / 3,
    marginBottom: 12,
  },
  gifPreview: {
    width: '100%',
    height: 80,
    borderRadius: 12,
    backgroundColor: '#2c2c2e',
  },
  gifLabel: {
    color: '#fff',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
  },
  clearEffectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2c2c2e',
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 20,
    marginBottom: 30,
    gap: 8,
  },
  clearEffectText: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '600',
  },
  // Animated text sticker styles
  animatedTextSticker: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 2,
  },
  animatedTextLabel: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
