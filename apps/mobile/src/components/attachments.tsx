import Feather from '@expo/vector-icons/Feather';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { getDownloadUrl } from '@/api/attachments';
import { getErrorMessage } from '@/api/errors';
import type { Attachment } from '@/api/types';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Sheet } from '@/components/sheet';
import {
  useAttachments,
  useDeleteAttachment,
  useUploadAttachment,
  type PickedFile,
} from '@/hooks/use-attachments';
import { firstName } from '@/lib/format';
import { colors, fonts, radius, spacing } from '@/theme';

/** "240 KB", "1.2 MB" */
export function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const ICONS: [RegExp, React.ComponentProps<typeof Feather>['name']][] = [
  [/pdf/, 'file-text'],
  [/sheet|excel|csv/, 'grid'],
  [/presentation|powerpoint/, 'monitor'],
  [/word|text/, 'file-text'],
];
const iconFor = (mime: string) => ICONS.find(([re]) => re.test(mime))?.[1] ?? 'paperclip';

/**
 * Card detail's files: thumbnails for images, an icon for the rest. Tap to open (in the
 * browser, through a 10-minute link). Members and above can attach photos or files (up to
 * 10 MB) with upload progress; the uploader or a board Admin can delete.
 */
export function AttachmentsSection({
  cardId,
  boardId,
  meId,
  canEdit,
  canDeleteAny,
  onError,
}: {
  cardId: string;
  boardId: string;
  meId?: string;
  canEdit: boolean;
  canDeleteAny: boolean;
  onError: (error: unknown) => void;
}) {
  const files = useAttachments(cardId);
  const upload = useUploadAttachment(cardId, boardId);
  const remove = useDeleteAttachment(cardId, boardId);
  const [picker, setPicker] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Attachment | null>(null);

  const send = (file: PickedFile) => upload.mutate(file, { onError });

  const pickPhoto = async () => {
    setPicker(false);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8, // also turns iPhone HEIC photos into JPEG
    });
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return;
    const mimeType = asset.mimeType ?? 'image/jpeg';
    const ext = mimeType.split('/')[1] ?? 'jpg';
    send({ uri: asset.uri, name: asset.fileName ?? `photo-${Date.now()}.${ext}`, mimeType });
  };

  const pickFile = async () => {
    setPicker(false);
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return;
    send({
      uri: asset.uri,
      name: asset.name,
      mimeType: asset.mimeType ?? 'application/octet-stream',
    });
  };

  const open = async (a: Attachment) => {
    setOpening(a.id);
    try {
      await Linking.openURL(await getDownloadUrl(a.id));
    } catch (error) {
      onError(error);
    } finally {
      setOpening(null);
    }
  };

  const list = files.data ?? [];
  if (!canEdit && !files.isPending && !list.length) return null; // nothing to show a Viewer

  return (
    <View style={styles.section}>
      <View style={styles.headingRow}>
        <AppText style={styles.heading} accessibilityRole="header">
          Attachments
        </AppText>
        {canEdit ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add attachment"
            disabled={upload.isPending}
            onPress={() => setPicker(true)}
            hitSlop={10}
            style={({ pressed }) => [styles.add, pressed && styles.pressed]}>
            <Feather name="plus" size={16} color={colors.primary} />
            <Text style={styles.addText}>Add</Text>
          </Pressable>
        ) : null}
      </View>

      {upload.isPending ? (
        <View
          style={styles.row}
          accessibilityLabel={`Uploading, ${Math.round((upload.progress ?? 0) * 100)} percent`}>
          <View style={styles.iconTile}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.name} numberOfLines={1}>
              {upload.variables?.name}
            </Text>
            <View style={styles.bar}>
              <View
                style={[styles.barFill, { width: `${Math.round((upload.progress ?? 0) * 100)}%` }]}
              />
            </View>
          </View>
        </View>
      ) : null}

      {files.isPending ? (
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      ) : files.isError ? (
        <AppText variant="secondary">{getErrorMessage(files.error)}</AppText>
      ) : !list.length && !upload.isPending ? (
        <AppText variant="secondary">No files yet.</AppText>
      ) : (
        list.map((a) => {
          const canDelete = canEdit && (a.uploader?.id === meId || canDeleteAny);
          const by = a.uploader
            ? a.uploader.id === meId
              ? 'you'
              : firstName(a.uploader.name)
            : null;
          return (
            // Two buttons side by side (open, delete), never one inside the other.
            <View key={a.id} style={styles.row}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${a.fileName}, ${fileSize(a.size)}. Opens the file`}
                onPress={() => open(a)}
                style={({ pressed }) => [styles.openArea, pressed && styles.pressed]}>
                {a.previewUrl ? (
                  <Image
                    source={{ uri: a.previewUrl }}
                    style={styles.thumb}
                    accessibilityIgnoresInvertColors
                  />
                ) : (
                  <View style={styles.iconTile}>
                    <Feather name={iconFor(a.mimeType)} size={18} color={colors.primary} />
                  </View>
                )}
                <View style={styles.flex}>
                  <Text style={styles.name} numberOfLines={1}>
                    {a.fileName}
                  </Text>
                  <Text style={styles.meta}>
                    {fileSize(a.size)}
                    {by ? ` · added by ${by}` : ''}
                  </Text>
                </View>
                {opening === a.id ? <ActivityIndicator size="small" color={colors.muted} /> : null}
              </Pressable>
              {canDelete ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${a.fileName}`}
                  onPress={() => setConfirm(a)}
                  hitSlop={10}
                  style={styles.delete}>
                  <Feather name="trash-2" size={16} color={colors.muted} />
                </Pressable>
              ) : null}
            </View>
          );
        })
      )}

      <Sheet
        visible={picker}
        onClose={() => setPicker(false)}
        title="Add attachment"
        subtitle="Up to 10 MB">
        <View style={styles.sheet}>
          <Button title="Photo" icon="image" variant="secondary" onPress={pickPhoto} />
          <Button title="File" icon="file" variant="secondary" onPress={pickFile} />
        </View>
      </Sheet>

      <ConfirmDialog
        visible={!!confirm}
        icon="trash-2"
        title="Delete this file?"
        message={`${confirm?.fileName ?? 'The file'} will be removed from the card for everyone.`}
        confirmLabel="Delete file"
        loading={remove.isPending}
        error={remove.isError ? getErrorMessage(remove.error) : null}
        onCancel={() => {
          setConfirm(null);
          remove.reset();
        }}
        onConfirm={() =>
          confirm && remove.mutate(confirm.id, { onSuccess: () => setConfirm(null) })
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heading: { fontFamily: fonts.semibold, fontSize: 15 },
  add: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, paddingHorizontal: 4 },
  addText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.primary },
  pressed: { opacity: 0.6 },
  loading: { alignSelf: 'flex-start' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  flex: { flex: 1 },
  openArea: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  thumb: { width: 40, height: 40, borderRadius: 8, backgroundColor: colors.background },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
  meta: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 },
  delete: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  bar: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.divider,
    marginTop: 6,
    overflow: 'hidden',
  },
  barFill: { height: 4, backgroundColor: colors.primary },
  sheet: { gap: spacing.sm, padding: spacing.lg },
});
