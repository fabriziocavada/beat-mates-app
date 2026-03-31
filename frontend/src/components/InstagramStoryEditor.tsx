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
  PanResponder,
  Animated as RNAnimated,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import Svg, { Path } from 'react-native-svg';
import Colors from '../constants/colors';

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
  type: 'emoji' | 'widget';
  content: string;
  icon?: string;
  x: number;
  y: number;
  scale: number;
}

// Drawing path
interface DrawPath {
  id: string;
  points: string;
  color: string;
  width: number;
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
  { icon: 'images-outline', label: 'Foto', type: 'widget' },
  { icon: 'search', label: 'GIF', type: 'widget' },
  { icon: 'hand-right-outline', label: 'Tocca a te', type: 'widget' },
  { icon: 'grid-outline', label: 'Cornice', type: 'widget' },
  { icon: 'help-circle-outline', label: 'Domande', type: 'widget' },
  { icon: 'cut-outline', label: 'Ritagli', type: 'widget' },
  { icon: 'star-outline', label: 'Metti in evidenza', type: 'widget' },
  { icon: 'notifications-outline', label: 'Attiva notifiche', type: 'widget' },
  { icon: 'person-circle-outline', label: 'Avatar', type: 'widget' },
  { icon: 'stats-chart', label: 'Sondaggio', type: 'widget' },
  { icon: 'link', label: 'Link', type: 'widget' },
  { icon: 'pricetag', label: '#hashtag', type: 'widget' },
  { icon: 'heart', label: 'Donazione', type: 'widget' },
  { icon: 'cart-outline', label: 'Prodotto', type: 'widget' },
  { icon: 'timer-outline', label: 'Countdown', type: 'widget' },
];

const EMOJIS = ['❤️', '🔥', '😂', '😍', '🎉', '👏', '💯', '✨', '🙌', '💪', '🎵', '💃', '🕺', '🌟', '💖', '🥳', '😎', '🤩', '💫', '🦋'];

const BACKGROUNDS = ['transparent', '#000000', '#1a1a2e', '#16213e', '#0f3460', '#533483', '#e94560', '#f38181', '#fce38a', '#95e1d3'];

interface Props {
  mediaUri: string;
  mediaType: 'photo' | 'video';
  originalPoster?: { username: string; profileImage?: string };
  onSave: (data: any) => void;
  onClose: () => void;
}

// Draggable Element Component - defined outside main component
const DraggableItem = ({ children, initialX, initialY, onPositionChange, onDelete, onTap }: {
  children: React.ReactNode;
  initialX: number;
  initialY: number;
  onPositionChange?: (x: number, y: number) => void;
  onDelete?: () => void;
  onTap?: () => void;
}) => {
  const pan = useRef(new RNAnimated.ValueXY({ x: initialX, y: initialY })).current;
  const scale = useRef(new RNAnimated.Value(1)).current;
  const lastPosition = useRef({ x: initialX, y: initialY });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2;
      },
      onPanResponderGrant: () => {
        pan.setOffset({
          x: lastPosition.current.x,
          y: lastPosition.current.y,
        });
        pan.setValue({ x: 0, y: 0 });
        RNAnimated.spring(scale, { toValue: 1.1, useNativeDriver: true }).start();
      },
      onPanResponderMove: RNAnimated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: (_, gestureState) => {
        pan.flattenOffset();
        const newX = lastPosition.current.x + gestureState.dx;
        const newY = lastPosition.current.y + gestureState.dy;
        lastPosition.current = { x: newX, y: newY };
        onPositionChange?.(newX, newY);
        RNAnimated.spring(scale, { toValue: 1, useNativeDriver: true }).start();
      },
    })
  ).current;

  return (
    <RNAnimated.View
      {...panResponder.panHandlers}
      style={[
        styles.draggableElement,
        {
          transform: [{ translateX: pan.x }, { translateY: pan.y }, { scale }],
        },
      ]}
    >
      <TouchableOpacity onLongPress={onDelete} onPress={onTap} delayLongPress={500} activeOpacity={0.9}>
        {children}
      </TouchableOpacity>
    </RNAnimated.View>
  );
};

export default function InstagramStoryEditor({ mediaUri, mediaType, originalPoster, onSave, onClose }: Props) {
  // Core state - persists across panel changes
  const [texts, setTexts] = useState<TextElement[]>([]);
  const [stickers, setStickers] = useState<StickerElement[]>([]);
  const [drawings, setDrawings] = useState<DrawPath[]>([]);
  const [backgroundColor, setBackgroundColor] = useState<string>('transparent');
  const [caption, setCaption] = useState('');

  // Panel state
  const [activePanel, setActivePanel] = useState<'none' | 'text' | 'stickers' | 'draw' | 'background' | 'music' | 'link' | 'poll' | 'question'>('none');
  const [showSidebar, setShowSidebar] = useState(true);

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

  // Drawing handlers
  const drawingPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => isDrawingMode,
      onMoveShouldSetPanResponder: () => isDrawingMode,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        setCurrentPath([{ x: locationX, y: locationY }]);
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        setCurrentPath(prev => [...prev, { x: locationX, y: locationY }]);
      },
      onPanResponderRelease: () => {
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
      },
    })
  ).current;

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
      backgroundColor,
      caption,
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
          onPositionChange={(x, y) => updateStickerPosition(item.id, x, y)}
          onDelete={() => deleteSticker(item.id)}
        >
          <Text style={{ fontSize: 60 }}>{item.content}</Text>
        </DraggableItem>
      );
    }

    // Widget sticker
    return (
      <DraggableItem
        key={item.id}
        initialX={item.x}
        initialY={item.y}
        onPositionChange={(x, y) => updateStickerPosition(item.id, x, y)}
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

  return (
    <View style={styles.container}>
      {/* Background color overlay */}
      {backgroundColor !== 'transparent' && <View style={[StyleSheet.absoluteFill, { backgroundColor }]} />}

      {/* Media */}
      <View style={styles.mediaContainer} {...(isDrawingMode ? drawingPanResponder.panHandlers : {})}>
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

        {/* Drawing canvas */}
        {(drawings.length > 0 || currentPath.length > 0) && (
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
        )}

        {/* Original poster watermark */}
        {originalPoster && (
          <View style={styles.watermark}>
            <Text style={styles.watermarkText}>{originalPoster.username}</Text>
          </View>
        )}
      </View>

      {/* Rendered elements - outside media container so they're always visible */}
      {!isDrawingMode && texts.map(renderTextElement)}
      {!isDrawingMode && stickers.map(renderStickerElement)}

      {/* Top bar */}
      <View style={styles.topBar}>
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
          <SidebarTool icon="musical-note" label="Audio" onPress={() => openPanel('music')} />
          <SidebarTool icon="at" label="Menziona" onPress={() => {
            const newSticker: StickerElement = {
              id: Date.now().toString(),
              type: 'widget',
              content: '@username',
              icon: 'at',
              x: width / 2 - 60,
              y: height / 2 - 20,
              scale: 1,
            };
            setStickers(prev => [...prev, newSticker]);
          }} />
          <SidebarTool icon="color-palette-outline" label="Sfondo" onPress={() => openPanel('background')} />
          <SidebarTool icon="brush-outline" label="Disegna" onPress={() => setIsDrawingMode(true)} />
          <SidebarTool icon="download-outline" label="Scarica" onPress={() => Alert.alert('Scarica', 'Funzione di download in arrivo!')} />
          <SidebarTool icon="ellipsis-horizontal" label="Altro" onPress={() => Alert.alert('Altro', 'Altre opzioni in arrivo!')} />
          <TouchableOpacity style={styles.collapseButton} onPress={() => setShowSidebar(false)}>
            <Ionicons name="chevron-up" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      {/* Drawing tools bar */}
      {isDrawingMode && (
        <View style={styles.drawToolsBar}>
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
              style={[styles.textInput, { color: textColor }, textBgColor && { backgroundColor: textBgColor, paddingHorizontal: 12 }]}
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
          <TextInput style={styles.musicSearch} placeholder="Cerca brani..." placeholderTextColor="#888" />
          <View style={styles.musicList}>
            {['Per te', 'Popolari', 'Nuove uscite'].map((cat, i) => (
              <TouchableOpacity key={i} style={styles.musicCat}>
                <Text style={styles.musicCatText}>{cat}</Text>
              </TouchableOpacity>
            ))}
            <Text style={styles.musicPlaceholder}>I brani verranno mostrati qui</Text>
          </View>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  mediaContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 60,
    marginHorizontal: 10,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1c1c1e',
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
});
