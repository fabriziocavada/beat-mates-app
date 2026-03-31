import React, { useState, useRef, useCallback } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
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
  alignment: 'left' | 'center' | 'right';
}

// Sticker element
interface StickerElement {
  id: string;
  type: 'emoji' | 'widget';
  content: string;
  x: number;
  y: number;
  scale: number;
}

// Drawing path
interface DrawPath {
  id: string;
  points: { x: number; y: number }[];
  color: string;
  width: number;
}

const COLORS = ['#FFFFFF', '#000000', '#FF6978', '#FF9500', '#FFCC00', '#34C759', '#007AFF', '#5856D6', '#AF52DE', '#FF2D55'];

const FONT_STYLES = [
  { id: 'modern', name: 'Modern' },
  { id: 'classic', name: 'Classic' },
  { id: 'signature', name: 'Signature' },
];

const STICKERS = [
  { icon: 'location-outline', label: 'Luogo', color: '#007AFF' },
  { icon: 'at', label: '@menzione', color: '#5856D6' },
  { icon: 'musical-notes', label: 'Musica', color: '#FF2D55' },
  { icon: 'images-outline', label: 'Foto', color: '#34C759' },
  { icon: 'search', label: 'GIF', color: '#FF9500' },
  { icon: 'hand-right-outline', label: 'Tocca a te', color: '#FF2D55' },
  { icon: 'grid-outline', label: 'Cornice', color: '#34C759' },
  { icon: 'help-circle-outline', label: 'Domande', color: '#5856D6' },
  { icon: 'cut-outline', label: 'Ritagli', color: '#34C759' },
  { icon: 'star-outline', label: 'Metti in evidenza', color: '#FF2D55' },
  { icon: 'notifications-outline', label: 'Attiva notifiche', color: '#007AFF' },
  { icon: 'person-circle-outline', label: 'Avatar', color: '#5856D6' },
  { icon: 'stats-chart', label: 'Sondaggio', color: '#AF52DE' },
  { icon: 'link', label: 'Link', color: '#007AFF' },
  { icon: 'pricetag', label: '#hashtag', color: '#5856D6' },
  { icon: 'heart', label: 'Donazione', color: '#34C759' },
  { icon: 'cart-outline', label: 'Prodotto', color: '#007AFF' },
  { icon: 'timer-outline', label: 'Countdown', color: '#FF2D55' },
  { icon: 'text', label: 'Testo', color: '#FFCC00' },
];

const EMOJIS = ['❤️', '🔥', '😂', '😍', '🎉', '👏', '💯', '✨', '🙌', '💪', '🎵', '💃', '🕺', '🌟', '💖', '🥳', '😎', '🤩', '💫', '🦋'];

interface Props {
  mediaUri: string;
  mediaType: 'photo' | 'video';
  originalPoster?: { username: string; profileImage?: string };
  onSave: (data: any) => void;
  onClose: () => void;
}

export default function InstagramStoryEditor({ mediaUri, mediaType, originalPoster, onSave, onClose }: Props) {
  // Elements state
  const [texts, setTexts] = useState<TextElement[]>([]);
  const [stickers, setStickers] = useState<StickerElement[]>([]);
  const [drawings, setDrawings] = useState<DrawPath[]>([]);
  const [backgroundColor, setBackgroundColor] = useState<string | null>(null);
  
  // UI state
  const [activePanel, setActivePanel] = useState<'none' | 'text' | 'stickers' | 'draw'>('none');
  const [showSidebar, setShowSidebar] = useState(true);
  
  // Text editing
  const [isEditingText, setIsEditingText] = useState(false);
  const [currentText, setCurrentText] = useState('');
  const [textColor, setTextColor] = useState('#FFFFFF');
  const [textBgColor, setTextBgColor] = useState<string | null>(null);
  const [fontStyle, setFontStyle] = useState<'modern' | 'classic' | 'signature'>('classic');
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  
  // Drawing
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawColor, setDrawColor] = useState('#FFFFFF');
  const [currentDrawPath, setCurrentDrawPath] = useState<{ x: number; y: number }[]>([]);
  
  // Caption
  const [caption, setCaption] = useState('');

  // Add text element
  const addTextElement = () => {
    if (!currentText.trim()) return;
    Keyboard.dismiss();
    
    const newText: TextElement = {
      id: Date.now().toString(),
      text: currentText,
      x: width / 2 - 100,
      y: height / 3,
      color: textColor,
      fontSize: 28,
      fontStyle,
      backgroundColor: textBgColor,
      alignment: 'center',
    };
    
    if (editingTextId) {
      setTexts(prev => prev.map(t => t.id === editingTextId ? { ...newText, id: editingTextId, x: t.x, y: t.y } : t));
    } else {
      setTexts(prev => [...prev, newText]);
    }
    
    setCurrentText('');
    setEditingTextId(null);
    setIsEditingText(false);
    setActivePanel('none');
  };

  // Add sticker
  const addSticker = (content: string, type: 'emoji' | 'widget' = 'emoji') => {
    const newSticker: StickerElement = {
      id: Date.now().toString(),
      type,
      content,
      x: width / 2 - 30,
      y: height / 2 - 30,
      scale: 1,
    };
    setStickers(prev => [...prev, newSticker]);
    setActivePanel('none');
  };

  // Delete element
  const deleteElement = (id: string, type: 'text' | 'sticker') => {
    if (type === 'text') {
      setTexts(prev => prev.filter(t => t.id !== id));
    } else {
      setStickers(prev => prev.filter(s => s.id !== id));
    }
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

  // Draggable element component
  const DraggableElement = ({ children, initialX, initialY, onDelete, onEdit }: any) => {
    const translateX = useRef(new RNAnimated.Value(initialX)).current;
    const translateY = useRef(new RNAnimated.Value(initialY)).current;
    const scale = useRef(new RNAnimated.Value(1)).current;
    
    const panResponder = useRef(
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          translateX.setOffset((translateX as any)._value);
          translateY.setOffset((translateY as any)._value);
          translateX.setValue(0);
          translateY.setValue(0);
          RNAnimated.spring(scale, { toValue: 1.1, useNativeDriver: true }).start();
        },
        onPanResponderMove: RNAnimated.event(
          [null, { dx: translateX, dy: translateY }],
          { useNativeDriver: false }
        ),
        onPanResponderRelease: () => {
          translateX.flattenOffset();
          translateY.flattenOffset();
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
            transform: [
              { translateX },
              { translateY },
              { scale },
            ],
          },
        ]}
      >
        <TouchableOpacity onLongPress={onDelete} onPress={onEdit} delayLongPress={500}>
          {children}
        </TouchableOpacity>
      </RNAnimated.View>
    );
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
      <DraggableElement
        key={item.id}
        initialX={item.x}
        initialY={item.y}
        onDelete={() => deleteElement(item.id, 'text')}
        onEdit={() => {
          setCurrentText(item.text);
          setTextColor(item.color);
          setTextBgColor(item.backgroundColor);
          setFontStyle(item.fontStyle);
          setEditingTextId(item.id);
          setIsEditingText(true);
          setActivePanel('text');
        }}
      >
        <View style={[
          styles.textElement,
          item.backgroundColor ? { backgroundColor: item.backgroundColor, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 } : null,
        ]}>
          <Text style={[
            { color: item.color, fontSize: item.fontSize, textAlign: item.alignment },
            getFontFamily(),
            styles.textShadow,
          ]}>
            {item.text}
          </Text>
        </View>
      </DraggableElement>
    );
  };

  // Render sticker element
  const renderStickerElement = (item: StickerElement) => (
    <DraggableElement
      key={item.id}
      initialX={item.x}
      initialY={item.y}
      onDelete={() => deleteElement(item.id, 'sticker')}
    >
      <Text style={{ fontSize: 60 * item.scale }}>{item.content}</Text>
    </DraggableElement>
  );

  // Sidebar tool button
  const SidebarTool = ({ icon, label, onPress, isActive }: { icon: string; label: string; onPress: () => void; isActive?: boolean }) => (
    <TouchableOpacity style={styles.sidebarTool} onPress={onPress}>
      <Text style={styles.sidebarLabel}>{label}</Text>
      <View style={[styles.sidebarIcon, isActive && styles.sidebarIconActive]}>
        <Ionicons name={icon as any} size={22} color="#fff" />
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Background color overlay */}
      {backgroundColor && <View style={[StyleSheet.absoluteFill, { backgroundColor }]} />}
      
      {/* Media */}
      <View style={styles.mediaContainer}>
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
        
        {/* Original poster watermark */}
        {originalPoster && (
          <View style={styles.watermark}>
            <Text style={styles.watermarkText}>{originalPoster.username}</Text>
          </View>
        )}
      </View>

      {/* Rendered elements */}
      {texts.map(renderTextElement)}
      {stickers.map(renderStickerElement)}

      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
        
        {!isEditingText && (
          <TouchableOpacity 
            style={styles.textToolButton} 
            onPress={() => { setActivePanel('text'); setIsEditingText(true); }}
          >
            <Text style={styles.textToolLabel}>Testo</Text>
            <View style={styles.textToolIcon}>
              <Text style={styles.aaText}>Aa</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* Right sidebar */}
      {showSidebar && !isEditingText && (
        <View style={styles.sidebar}>
          <SidebarTool icon="happy-outline" label="Adesivi" onPress={() => setActivePanel('stickers')} />
          <SidebarTool icon="musical-note" label="Audio" onPress={() => {}} />
          <SidebarTool icon="at" label="Menziona" onPress={() => {}} />
          <SidebarTool icon="ellipse-outline" label="Sfondo" onPress={() => setActivePanel('draw')} isActive={activePanel === 'draw'} />
          <SidebarTool icon="image-outline" label="Immagine sfondo" onPress={() => {}} />
          <SidebarTool icon="brush-outline" label="Disegna" onPress={() => setIsDrawing(!isDrawing)} isActive={isDrawing} />
          <SidebarTool icon="download-outline" label="Scarica" onPress={() => {}} />
          <SidebarTool icon="ellipsis-horizontal" label="Altro" onPress={() => {}} />
          <TouchableOpacity style={styles.collapseButton} onPress={() => setShowSidebar(false)}>
            <Ionicons name="chevron-up" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      {/* Expand sidebar button */}
      {!showSidebar && !isEditingText && (
        <TouchableOpacity style={styles.expandButton} onPress={() => setShowSidebar(true)}>
          <Ionicons name="chevron-down" size={20} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Bottom bar */}
      {!isEditingText && (
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
              <Text style={styles.closeFriendsLabel}>Amici più str...</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.nextButton} onPress={handleSave}>
              <Ionicons name="arrow-forward" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Text editing panel */}
      <Modal visible={isEditingText} transparent animationType="fade">
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.textEditOverlay}
        >
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => { Keyboard.dismiss(); setIsEditingText(false); setActivePanel('none'); }} />
          
          <View style={styles.textEditHeader}>
            <TouchableOpacity onPress={() => { setIsEditingText(false); setActivePanel('none'); setCurrentText(''); }}>
              <Text style={styles.cancelText}>Annulla</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={addTextElement}>
              <Text style={styles.doneText}>Fine</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.textPreviewArea}>
            <TextInput
              style={[
                styles.textPreviewInput,
                { color: textColor },
                textBgColor ? { backgroundColor: textBgColor, paddingHorizontal: 16, borderRadius: 8 } : null,
                fontStyle === 'signature' ? { fontStyle: 'italic' } : null,
                fontStyle === 'modern' ? { fontWeight: '300' } : { fontWeight: 'bold' },
              ]}
              value={currentText}
              onChangeText={setCurrentText}
              placeholder="Scrivi..."
              placeholderTextColor="rgba(255,255,255,0.5)"
              multiline
              autoFocus
              textAlign="center"
            />
          </View>

          {/* Font style selector */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.fontSelector}>
            {FONT_STYLES.map(f => (
              <TouchableOpacity
                key={f.id}
                style={[styles.fontOption, fontStyle === f.id && styles.fontOptionActive]}
                onPress={() => setFontStyle(f.id as any)}
              >
                <Text style={[
                  styles.fontOptionText,
                  f.id === 'signature' && { fontStyle: 'italic' },
                  f.id === 'modern' && { fontWeight: '300' },
                ]}>
                  {f.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Text tools - Instagram-style toolbar */}
          <View style={styles.textTools}>
            <TouchableOpacity style={styles.textTool}>
              <Text style={styles.aaSmall}>Aa</Text>
            </TouchableOpacity>
            {/* Rainbow color picker button */}
            <TouchableOpacity style={[styles.textTool, styles.rainbowBorder]}>
              <View style={styles.rainbowCircle} />
            </TouchableOpacity>
            {/* Italic */}
            <TouchableOpacity style={styles.textTool}>
              <Text style={[styles.aaSmall, { fontStyle: 'italic' }]}>//A</Text>
            </TouchableOpacity>
            {/* Sparkles/Magic */}
            <TouchableOpacity style={styles.textTool}>
              <Ionicons name="sparkles" size={20} color="#fff" />
            </TouchableOpacity>
            {/* Alignment */}
            <TouchableOpacity style={styles.textTool}>
              <Ionicons name="reorder-three" size={20} color="#fff" />
            </TouchableOpacity>
            {/* Text Background */}
            <TouchableOpacity
              style={[styles.textTool, textBgColor && styles.textToolActive]}
              onPress={() => setTextBgColor(textBgColor ? null : 'rgba(0,0,0,0.6)')}
            >
              <View style={styles.textBgIcon}>
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>A</Text>
              </View>
            </TouchableOpacity>
            {/* Animation */}
            <TouchableOpacity style={styles.textTool}>
              <Text style={[styles.aaSmall, { color: '#5856D6' }]}>A</Text>
              <View style={styles.sparkleIndicator} />
            </TouchableOpacity>
          </View>
          
          {/* Color picker row */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.colorScrollView}>
            {COLORS.map(c => (
              <TouchableOpacity
                key={c}
                style={[styles.colorDot, { backgroundColor: c }, textColor === c && styles.colorDotSelected]}
                onPress={() => setTextColor(c)}
              />
            ))}
          </ScrollView>

          {/* Bottom options */}
          <View style={styles.textBottomOptions}>
            <TouchableOpacity style={styles.bottomOption}>
              <Ionicons name="at" size={18} color="#fff" />
              <Text style={styles.bottomOptionText}>Menziona</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.bottomOption}>
              <Ionicons name="location-outline" size={18} color="#fff" />
              <Text style={styles.bottomOptionText}>Luogo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.bottomOption}>
              <Ionicons name="pencil-outline" size={18} color="#fff" />
              <Text style={styles.bottomOptionText}>Riscrittura</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Stickers panel */}
      <Modal visible={activePanel === 'stickers'} transparent animationType="slide">
        <TouchableOpacity style={styles.stickerOverlay} onPress={() => setActivePanel('none')} />
        <View style={styles.stickerPanel}>
          <View style={styles.stickerHandle} />
          <View style={styles.stickerSearch}>
            <Ionicons name="search" size={18} color="#8E8E93" />
            <TextInput style={styles.stickerSearchInput} placeholder="Cerca" placeholderTextColor="#8E8E93" />
          </View>
          
          {/* Sticker widgets */}
          <ScrollView style={styles.stickerContent} showsVerticalScrollIndicator={false}>
            <View style={styles.stickerWidgets}>
              {STICKERS.map((s, i) => (
                <TouchableOpacity key={i} style={styles.stickerWidget} onPress={() => addSticker(s.label, 'widget')}>
                  <Ionicons name={s.icon as any} size={18} color={s.color} />
                  <Text style={styles.stickerWidgetText}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            
            {/* Emoji grid */}
            <Text style={styles.stickerSectionTitle}>Emoji</Text>
            <View style={styles.emojiGrid}>
              {EMOJIS.map((e, i) => (
                <TouchableOpacity key={i} style={styles.emojiOption} onPress={() => addSticker(e)}>
                  <Text style={styles.emojiText}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(60,60,60,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sidebarIconActive: {
    backgroundColor: Colors.primary,
  },
  collapseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(60,60,60,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  expandButton: {
    position: 'absolute',
    right: 12,
    top: 120,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(60,60,60,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 90,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 34,
    gap: 12,
  },
  captionInput: {
    color: '#fff',
    fontSize: 15,
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
    flex: 1,
  },
  miniAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
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
  // Text edit modal
  textEditOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
  },
  textEditHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
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
  textPreviewInput: {
    fontSize: 28,
    textAlign: 'center',
    width: '100%',
  },
  fontSelector: {
    maxHeight: 50,
    marginBottom: 12,
  },
  fontOption: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginHorizontal: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  fontOptionActive: {
    backgroundColor: '#fff',
  },
  fontOptionText: {
    color: '#fff',
    fontSize: 15,
  },
  textTools: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  textTool: {
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
  rainbowBorder: {
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  rainbowCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FF9500',
    borderWidth: 3,
    borderTopColor: '#FF3B30',
    borderRightColor: '#FFCC00',
    borderBottomColor: '#34C759',
    borderLeftColor: '#007AFF',
  },
  textBgIcon: {
    width: 22,
    height: 22,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sparkleIndicator: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#5856D6',
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
    marginRight: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorDotSelected: {
    borderColor: '#fff',
  },
  textBottomOptions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 32,
    paddingVertical: 16,
    paddingBottom: 40,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  bottomOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bottomOptionText: {
    color: '#fff',
    fontSize: 14,
  },
  // Sticker panel
  stickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  stickerPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1c1c1e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: height * 0.7,
    paddingBottom: 34,
  },
  stickerHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#666',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 16,
  },
  stickerSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2c2c2e',
    marginHorizontal: 16,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 36,
    marginBottom: 16,
  },
  stickerSearchInput: {
    flex: 1,
    marginLeft: 8,
    color: '#fff',
    fontSize: 16,
  },
  stickerContent: {
    paddingHorizontal: 16,
  },
  stickerWidgets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  stickerWidget: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
  },
  stickerWidgetText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '500',
  },
  stickerSectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 12,
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  emojiOption: {
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiText: {
    fontSize: 32,
  },
});
