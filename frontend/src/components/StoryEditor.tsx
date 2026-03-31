import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  Dimensions,
  PanResponder,
  Animated,
  ScrollView,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import Colors from '../constants/colors';

const { width, height } = Dimensions.get('window');

// Text element type
interface TextElement {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  backgroundColor: string | null;
}

// Sticker element type
interface StickerElement {
  id: string;
  emoji: string;
  x: number;
  y: number;
  scale: number;
}

// Drawing path type
interface DrawingPath {
  id: string;
  points: { x: number; y: number }[];
  color: string;
  strokeWidth: number;
}

// Available colors for text/drawing
const COLORS = [
  '#FFFFFF', '#000000', '#FF6978', '#FF9500', '#FFCC00',
  '#34C759', '#00C7BE', '#007AFF', '#5856D6', '#AF52DE',
];

// Available stickers
const STICKERS = [
  '❤️', '🔥', '😂', '😍', '🎉', '👏', '💯', '✨',
  '🙌', '💪', '🎵', '💃', '🕺', '🌟', '💖', '🥳',
];

// Background colors
const BACKGROUNDS = [
  null, // Transparent (show media)
  '#000000', '#1a1a2e', '#16213e', '#0f3460',
  '#FF6978', '#e94560', '#533483', '#1f4068',
];

interface Props {
  mediaUri: string;
  mediaType: 'photo' | 'video';
  onSave: (elements: { texts: TextElement[]; stickers: StickerElement[]; backgroundColor: string | null }) => void;
  onClose: () => void;
}

type EditorMode = 'none' | 'text' | 'draw' | 'sticker';

export default function StoryEditor({ mediaUri, mediaType, onSave, onClose }: Props) {
  const [mode, setMode] = useState<EditorMode>('none');
  const [texts, setTexts] = useState<TextElement[]>([]);
  const [stickers, setStickers] = useState<StickerElement[]>([]);
  const [drawings, setDrawings] = useState<DrawingPath[]>([]);
  const [backgroundColor, setBackgroundColor] = useState<string | null>(null);
  
  // Text editing state
  const [isEditingText, setIsEditingText] = useState(false);
  const [currentText, setCurrentText] = useState('');
  const [textColor, setTextColor] = useState('#FFFFFF');
  const [textBgColor, setTextBgColor] = useState<string | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  
  // Drawing state
  const [drawColor, setDrawColor] = useState('#FFFFFF');
  const [currentPath, setCurrentPath] = useState<{ x: number; y: number }[]>([]);
  
  // Sticker modal
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showBgPicker, setShowBgPicker] = useState(false);

  // Add new text
  const addText = () => {
    if (!currentText.trim()) return;
    
    const newText: TextElement = {
      id: Date.now().toString(),
      text: currentText,
      x: width / 2 - 50,
      y: height / 2 - 100,
      color: textColor,
      fontSize: 24,
      fontWeight: 'bold',
      backgroundColor: textBgColor,
    };
    
    if (editingTextId) {
      setTexts(texts.map(t => t.id === editingTextId ? { ...newText, id: editingTextId } : t));
    } else {
      setTexts([...texts, newText]);
    }
    
    setCurrentText('');
    setEditingTextId(null);
    setIsEditingText(false);
  };

  // Add sticker
  const addSticker = (emoji: string) => {
    const newSticker: StickerElement = {
      id: Date.now().toString(),
      emoji,
      x: width / 2 - 30,
      y: height / 2 - 30,
      scale: 1,
    };
    setStickers([...stickers, newSticker]);
    setShowStickerPicker(false);
  };

  // Delete element
  const deleteText = (id: string) => {
    setTexts(texts.filter(t => t.id !== id));
  };

  const deleteSticker = (id: string) => {
    setStickers(stickers.filter(s => s.id !== id));
  };

  // Handle save
  const handleSave = () => {
    onSave({ texts, stickers, backgroundColor });
  };

  // Draggable Text Element
  const DraggableText = ({ item }: { item: TextElement }) => {
    const pan = useRef(new Animated.ValueXY({ x: item.x, y: item.y })).current;
    
    const panResponder = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: () => {
        pan.extractOffset();
      },
    });

    return (
      <Animated.View
        {...panResponder.panHandlers}
        style={[styles.draggableElement, { transform: pan.getTranslateTransform() }]}
      >
        <TouchableOpacity
          onLongPress={() => deleteText(item.id)}
          onPress={() => {
            setCurrentText(item.text);
            setTextColor(item.color);
            setTextBgColor(item.backgroundColor);
            setEditingTextId(item.id);
            setIsEditingText(true);
          }}
        >
          <View style={[
            styles.textContainer,
            item.backgroundColor ? { backgroundColor: item.backgroundColor, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 } : null
          ]}>
            <Text style={[styles.textElement, { color: item.color, fontSize: item.fontSize, fontWeight: item.fontWeight }]}>
              {item.text}
            </Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // Draggable Sticker Element
  const DraggableSticker = ({ item }: { item: StickerElement }) => {
    const pan = useRef(new Animated.ValueXY({ x: item.x, y: item.y })).current;
    
    const panResponder = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: () => {
        pan.extractOffset();
      },
    });

    return (
      <Animated.View
        {...panResponder.panHandlers}
        style={[styles.draggableElement, { transform: pan.getTranslateTransform() }]}
      >
        <TouchableOpacity onLongPress={() => deleteSticker(item.id)}>
          <Text style={[styles.stickerElement, { fontSize: 60 * item.scale }]}>{item.emoji}</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Background */}
      {backgroundColor && <View style={[StyleSheet.absoluteFill, { backgroundColor }]} />}
      
      {/* Media Preview */}
      <View style={StyleSheet.absoluteFill}>
        {mediaType === 'video' ? (
          <Video
            source={{ uri: mediaUri }}
            style={StyleSheet.absoluteFill}
            resizeMode={ResizeMode.COVER}
            shouldPlay
            isLooping
            isMuted={false}
          />
        ) : (
          <Image source={{ uri: mediaUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        )}
      </View>

      {/* Rendered Elements */}
      {texts.map(t => <DraggableText key={t.id} item={t} />)}
      {stickers.map(s => <DraggableSticker key={s.id} item={s} />)}

      {/* Top toolbar */}
      <View style={styles.topToolbar}>
        <TouchableOpacity onPress={onClose} style={styles.toolButton}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
        
        <View style={styles.topToolbarRight}>
          <TouchableOpacity onPress={() => setShowBgPicker(true)} style={styles.toolButton}>
            <Ionicons name="color-palette-outline" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setMode('text'); setIsEditingText(true); }} style={styles.toolButton}>
            <Ionicons name="text" size={24} color={mode === 'text' ? Colors.primary : '#fff'} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowStickerPicker(true)} style={styles.toolButton}>
            <Ionicons name="happy-outline" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMode(mode === 'draw' ? 'none' : 'draw')} style={styles.toolButton}>
            <Ionicons name="brush-outline" size={24} color={mode === 'draw' ? Colors.primary : '#fff'} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Bottom toolbar with Done button */}
      <View style={styles.bottomToolbar}>
        <TouchableOpacity style={styles.doneButton} onPress={handleSave}>
          <Text style={styles.doneButtonText}>Fatto</Text>
          <Ionicons name="chevron-forward" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Text Input Modal */}
      <Modal visible={isEditingText} transparent animationType="fade">
        <View style={styles.textInputOverlay}>
          <View style={styles.textInputContainer}>
            <TextInput
              style={[styles.textInput, { color: textColor, backgroundColor: textBgColor || 'transparent' }]}
              value={currentText}
              onChangeText={setCurrentText}
              placeholder="Scrivi qualcosa..."
              placeholderTextColor="rgba(255,255,255,0.5)"
              autoFocus
              multiline
            />
            
            {/* Color picker for text */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.colorPicker}>
              {COLORS.map(color => (
                <TouchableOpacity
                  key={color}
                  style={[styles.colorOption, { backgroundColor: color }, textColor === color && styles.colorOptionSelected]}
                  onPress={() => setTextColor(color)}
                />
              ))}
            </ScrollView>
            
            {/* Background color toggle */}
            <View style={styles.textOptions}>
              <TouchableOpacity
                style={[styles.textOptionButton, textBgColor && styles.textOptionButtonActive]}
                onPress={() => setTextBgColor(textBgColor ? null : 'rgba(0,0,0,0.6)')}
              >
                <Text style={styles.textOptionText}>Sfondo</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.textInputButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => { setIsEditingText(false); setCurrentText(''); setEditingTextId(null); }}>
                <Text style={styles.cancelButtonText}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmButton} onPress={addText}>
                <Text style={styles.confirmButtonText}>Aggiungi</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Sticker Picker Modal */}
      <Modal visible={showStickerPicker} transparent animationType="slide">
        <View style={styles.stickerPickerOverlay}>
          <View style={styles.stickerPickerContainer}>
            <View style={styles.stickerPickerHeader}>
              <Text style={styles.stickerPickerTitle}>Sticker</Text>
              <TouchableOpacity onPress={() => setShowStickerPicker(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <View style={styles.stickerGrid}>
              {STICKERS.map(emoji => (
                <TouchableOpacity key={emoji} style={styles.stickerOption} onPress={() => addSticker(emoji)}>
                  <Text style={styles.stickerEmoji}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* Background Color Picker Modal */}
      <Modal visible={showBgPicker} transparent animationType="fade">
        <TouchableOpacity style={styles.bgPickerOverlay} activeOpacity={1} onPress={() => setShowBgPicker(false)}>
          <View style={styles.bgPickerContainer}>
            <Text style={styles.bgPickerTitle}>Sfondo</Text>
            <View style={styles.bgColorGrid}>
              {BACKGROUNDS.map((bg, i) => (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.bgColorOption,
                    { backgroundColor: bg || '#333' },
                    !bg && styles.bgColorTransparent,
                    backgroundColor === bg && styles.bgColorSelected,
                  ]}
                  onPress={() => { setBackgroundColor(bg); setShowBgPicker(false); }}
                >
                  {!bg && <Ionicons name="ban-outline" size={20} color="#fff" />}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  topToolbar: {
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
  topToolbarRight: {
    flexDirection: 'row',
    gap: 8,
  },
  toolButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomToolbar: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    zIndex: 100,
  },
  doneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 4,
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  draggableElement: {
    position: 'absolute',
    zIndex: 50,
  },
  textContainer: {
    maxWidth: width - 40,
  },
  textElement: {
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  stickerElement: {
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  // Text Input Modal
  textInputOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    padding: 20,
  },
  textInputContainer: {
    gap: 16,
  },
  textInput: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    padding: 16,
    borderRadius: 8,
    minHeight: 60,
  },
  colorPicker: {
    flexGrow: 0,
  },
  colorOption: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorOptionSelected: {
    borderColor: '#fff',
  },
  textOptions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  textOptionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  textOptionButtonActive: {
    backgroundColor: Colors.primary,
  },
  textOptionText: {
    color: '#fff',
    fontSize: 14,
  },
  textInputButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 20,
  },
  cancelButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  confirmButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Sticker Picker Modal
  stickerPickerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  stickerPickerContainer: {
    backgroundColor: '#1c1c1e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  stickerPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  stickerPickerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  stickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  stickerOption: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
  },
  stickerEmoji: {
    fontSize: 36,
  },
  // Background Color Picker
  bgPickerOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  bgPickerContainer: {
    backgroundColor: '#1c1c1e',
    borderRadius: 16,
    padding: 20,
    width: width - 60,
  },
  bgPickerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
  },
  bgColorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  bgColorOption: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bgColorTransparent: {
    borderWidth: 2,
    borderColor: '#666',
    borderStyle: 'dashed',
  },
  bgColorSelected: {
    borderWidth: 3,
    borderColor: '#fff',
  },
});
