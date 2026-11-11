import { Ionicons } from '@expo/vector-icons';
import { FunctionsHttpError } from '@supabase/supabase-js';
import * as DocumentPicker from 'expo-document-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../constants/theme';
import { supabase } from '../lib/supabase';

// IMAGE PATHS: change this line if you rename or move the image
const LOGO = require('../../assets/images/logo.png');

const OUTLINE = [[-2, 0], [2, 0], [0, -2], [0, 2], [-2, -2], [2, -2], [-2, 2], [2, 2]];
const TITLE = 'Scan a Page';
const CARD_BORDER = '#FFE08A';

// Photo is made smaller so it stays under the 1 MB OCR limit.
// If it is still too big, the next (smaller) try is used.
const SHRINK_STEPS = [
  { width: 1500, quality: 0.7 },
  { width: 1200, quality: 0.5 },
  { width: 1000, quality: 0.4 },
];
const MAX_BASE64_LENGTH = 1_360_000; // about 1 MB file

const NOT_ANSWERING = 'The reading service is not answering. Please try again.';
const NO_WORDS = 'We could not find any words. Try a clearer photo or another file.';
const CANNOT_OPEN = 'Oops! We could not open that file. Please try again.';

// Biggest PDF allowed (1 MB = OCR.space free limit)
const MAX_PDF_MB = 1;
const MAX_PDF_BYTES = MAX_PDF_MB * 1024 * 1024;

type Photo = { uri: string; width: number; height: number; base64: string };
type Pdf = { uri: string; name: string; size?: number };

// Open a picked file and turn it into base64, using tools built into React Native
// (fetch + FileReader). Works in Expo Go, where the file system package is blocked
// from reading the picker's folder.
const readFileAsBase64 = async (uri: string): Promise<string> => {
  const response = await fetch(uri);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      // dataUrl looks like "data:application/pdf;base64,AAAA..." - keep only the part after the comma
      const base64 = dataUrl.split(',')[1] ?? '';
      if (base64 === '') reject(new Error('File was empty or could not be read.'));
      else resolve(base64);
    };
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed.'));
    reader.readAsDataURL(blob);
  });
};

// Show file size in simple words, e.g. "850 KB" or "1.2 MB"
const formatSize = (bytes?: number) => {
  if (bytes === undefined) return 'Size unknown';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function Scan() {
  const router = useRouter();
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [pdf, setPdf] = useState<Pdf | null>(null);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [message, setMessage] = useState('');

  const startAgain = () => {
    setPhoto(null);
    setPdf(null);
    setMessage('');
  };

  const pickPdf = async () => {
    setMessage('');
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      if (result.canceled || result.assets.length === 0) return;

      const file = result.assets[0];
      const isPdf =
        file.mimeType === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

      if (!isPdf) {
        setMessage('Please choose a PDF file.');
        return;
      }
      if (file.size !== undefined && file.size > MAX_PDF_BYTES) {
        setMessage(`This file is too big. Please choose a PDF under ${MAX_PDF_MB} MB.`);
        return;
      }

      setPdf({ uri: file.uri, name: file.name, size: file.size });
    } catch {
      setMessage(CANNOT_OPEN);
    }
  };

  // Make the photo smaller and save as JPEG (also as base64 for the OCR server).
  // Tries smaller sizes until it is under about 1 MB.
  const shrinkPhoto = async (asset: ImagePicker.ImagePickerAsset): Promise<Photo> => {
    let photoResult: Photo | null = null;
    for (const step of SHRINK_STEPS) {
      const context = ImageManipulator.manipulate(asset.uri);
      if (asset.width > step.width) {
        context.resize({ width: step.width });
      }
      const image = await context.renderAsync();
      const result = await image.saveAsync({
        compress: step.quality,
        format: SaveFormat.JPEG,
        base64: true,
      });
      photoResult = {
        uri: result.uri,
        width: result.width,
        height: result.height,
        base64: result.base64 ?? '',
      };
      if (photoResult.base64.length <= MAX_BASE64_LENGTH) break;
    }
    // If still too big after all tries, the server sends a kind "too big" message
    return photoResult as Photo;
  };

  const pickPhoto = async (source: 'camera' | 'gallery') => {
    setMessage('');

    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setMessage(
        source === 'camera'
          ? 'We need the camera to scan your page. You can allow it in Settings.'
          : 'We need your photos to pick a page. You can allow it in Settings.'
      );
      return;
    }

    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);

    if (result.canceled || result.assets.length === 0) return;

    setBusy(true);
    try {
      setPhoto(await shrinkPhoto(result.assets[0]));
    } catch {
      setMessage('Oops! We could not open that photo. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  // Send the photo or PDF to our "ocr" server function and show the text it sends back
  const handleReadText = async () => {
    setMessage('');
    if (!photo && !pdf) return;

    setReading(true);
    try {
      let base64 = '';
      let mimeType = 'image/jpeg';

      if (pdf) {
        // Open the PDF file and turn it into base64 for the server
        try {
          base64 = await readFileAsBase64(pdf.uri);
          mimeType = 'application/pdf';
        } catch (e) {
          console.log('PDF open failed:', e);
          setMessage(CANNOT_OPEN);
          return;
        }
      } else if (photo) {
        base64 = photo.base64;
      }

      const { data, error } = await supabase.functions.invoke('ocr', {
        body: { base64, mimeType },
      });

      if (error) {
        let errorMessage = NOT_ANSWERING;
        // The server sends its own kind message (e.g. "too big"), show that one
        if (error instanceof FunctionsHttpError) {
          try {
            const details = await error.context.json();
            if (typeof details?.error === 'string') errorMessage = details.error;
          } catch {
            // keep the default message
          }
        }
        setMessage(errorMessage);
        return;
      }

      const text = typeof data?.text === 'string' ? data.text.trim() : '';
      if (text === '') {
        setMessage(NO_WORDS);
        return;
      }

      router.push({ pathname: '/result', params: { text } });
    } catch {
      setMessage(NOT_ANSWERING);
    } finally {
      setReading(false);
    }
  };

  return (
    <LinearGradient
      colors={[colors.skyTop, colors.skyMid, colors.mint]}
      locations={[0, 0.5, 1]}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.topRow}>
            <Image source={LOGO} style={styles.logo} resizeMode="contain" />
            <Pressable
              style={({ pressed }) => [styles.back, pressed && styles.pressed]}
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={26} color={colors.brown} />
            </Pressable>
          </View>

          <View style={styles.titleWrap}>
            {OUTLINE.map(([x, y], i) => (
              <Text
                key={i}
                style={[styles.title, styles.titleOutline, { left: x, right: -x, top: y }]}
              >
                {TITLE}
              </Text>
            ))}
            <Text style={styles.title}>{TITLE}</Text>
          </View>

          {busy ? (
            <View style={styles.card}>
              <ActivityIndicator size="large" color={colors.orangeDark} />
              <Text style={styles.busyText}>Getting your photo ready...</Text>
            </View>
          ) : photo || pdf ? (
            <>
              {photo ? (
                <View style={styles.card}>
                  <Image
                    source={{ uri: photo.uri }}
                    style={[styles.preview, { aspectRatio: photo.width / photo.height }]}
                    resizeMode="contain"
                  />
                </View>
              ) : (
                pdf && (
                  <View style={[styles.card, styles.pdfCard]}>
                    <View style={styles.pdfIcon}>
                      <Ionicons name="document-text" size={34} color={colors.white} />
                    </View>
                    <View style={styles.pdfInfo}>
                      <Text style={styles.pdfName} numberOfLines={2}>
                        {pdf.name}
                      </Text>
                      <Text style={styles.pdfSize}>{formatSize(pdf.size)}</Text>
                      <Text style={styles.pdfNote}>Only the first 3 pages will be read.</Text>
                    </View>
                  </View>
                )
              )}

              <Pressable
                style={({ pressed }) => [styles.button, pressed && styles.pressed]}
                onPress={handleReadText}
                disabled={reading}
              >
                {reading ? (
                  <>
                    <ActivityIndicator color={colors.brown} />
                    <Text style={styles.buttonText}>Reading your page...</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="book" size={22} color={colors.brown} />
                    <Text style={styles.buttonText}>READ TEXT</Text>
                  </>
                )}
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.button,
                  styles.whiteButton,
                  pressed && styles.pressed,
                  reading && styles.disabled,
                ]}
                onPress={startAgain}
                disabled={reading}
              >
                <Ionicons name="refresh" size={22} color={colors.navy} />
                <Text style={[styles.buttonText, styles.whiteButtonText]}>TRY AGAIN</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.subtitle}>Take a photo of a page, or pick one you have.</Text>
              <Text style={styles.tip}>
                Tip: hold the page flat, in good light, and fit all the words in.
              </Text>

              <Pressable
                style={({ pressed }) => [styles.button, pressed && styles.pressed]}
                onPress={() => pickPhoto('camera')}
              >
                <Ionicons name="camera" size={22} color={colors.brown} />
                <Text style={styles.buttonText}>TAKE PHOTO</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.button, pressed && styles.pressed]}
                onPress={() => pickPhoto('gallery')}
              >
                <Ionicons name="images" size={22} color={colors.brown} />
                <Text style={styles.buttonText}>CHOOSE FROM GALLERY</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.button, pressed && styles.pressed]}
                onPress={pickPdf}
              >
                <Ionicons name="document-text" size={22} color={colors.brown} />
                <Text style={styles.buttonText}>CHOOSE A PDF</Text>
              </Pressable>
            </>
          )}

          {message !== '' && (
            <View style={styles.messageBox}>
              <Text style={styles.messageText}>{message}</Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 32 },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  logo: { width: 100, height: 82 },
  back: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFC933',
    borderWidth: 2,
    borderColor: colors.yellow,
    borderBottomWidth: 5,
    borderBottomColor: colors.orangeDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: { alignSelf: 'center', marginTop: 14, marginBottom: 18 },
  title: {
    fontFamily: fonts.bold,
    fontSize: 30,
    color: colors.title,
    textAlign: 'center',
  },
  titleOutline: { position: 'absolute', color: colors.white },
  subtitle: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    lineHeight: 24,
    color: colors.navy,
    textAlign: 'center',
    marginBottom: 8,
  },
  tip: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 20,
    color: colors.muted,
    textAlign: 'center',
    marginBottom: 8,
    paddingHorizontal: 10,
  },
  card: {
    backgroundColor: colors.cardCream,
    borderWidth: 2,
    borderColor: CARD_BORDER,
    borderRadius: 22,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 160,
  },
  preview: { width: '100%', maxHeight: 420, borderRadius: 14 },
  pdfCard: { flexDirection: 'row', justifyContent: 'flex-start', minHeight: 0, padding: 16 },
  pdfIcon: {
    width: 58,
    height: 58,
    borderRadius: 16,
    backgroundColor: colors.title,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  pdfInfo: { flex: 1 },
  pdfName: { fontFamily: fonts.bold, fontSize: 16, color: colors.navy },
  pdfSize: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.muted, marginTop: 4 },
  pdfNote: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 4 },
  busyText: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: colors.navy,
    marginTop: 12,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 17,
    paddingHorizontal: 16,
    borderRadius: 32,
    backgroundColor: colors.orange,
    borderBottomWidth: 6,
    borderBottomColor: colors.orangeDark,
    marginTop: 16,
  },
  whiteButton: {
    backgroundColor: colors.white,
    borderBottomColor: colors.whiteShadow,
  },
  pressed: { transform: [{ translateY: 2 }], opacity: 0.9 },
  disabled: { opacity: 0.5 },
  buttonText: {
    fontFamily: fonts.bold,
    fontSize: 17,
    letterSpacing: 1,
    color: colors.brown,
  },
  whiteButtonText: { color: colors.navy },
  messageBox: {
    backgroundColor: colors.parentIconBg,
    borderWidth: 2,
    borderColor: colors.yellow,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 18,
  },
  messageText: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    lineHeight: 22,
    color: colors.navy,
    textAlign: 'center',
  },
});
