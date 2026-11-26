import Feather from '@expo/vector-icons/Feather';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ActivityItem, Comment } from '@/api/types';
import { MemberAvatar } from '@/components/workspace-ui';
import { activitySentence, actorName, describeActivity } from '@/lib/activity-text';
import { firstName, timeAgo } from '@/lib/format';
import { colors, fonts, radius, spacing } from '@/theme';

const TOKEN = /@\[([0-9a-f-]{36})\]/gi;

/** Splits a comment body into text and @mention pieces (tokens shown as "@Name"). */
export function commentParts(comment: Pick<Comment, 'body' | 'mentions'>) {
  const names = new Map(comment.mentions.map((m) => [m.id.toLowerCase(), m.name]));
  const parts: { text: string; mention?: boolean }[] = [];
  let last = 0;
  for (const match of comment.body.matchAll(TOKEN)) {
    if (match.index > last) parts.push({ text: comment.body.slice(last, match.index) });
    const name = names.get(match[1].toLowerCase());
    parts.push({ text: `@${name ?? 'someone'}`, mention: true });
    last = match.index + match[0].length;
  }
  if (last < comment.body.length) parts.push({ text: comment.body.slice(last) });
  return parts;
}

/** The comment text with mention tokens turned back into "@Full Name" (for editing). */
export function commentPlainText(comment: Pick<Comment, 'body' | 'mentions'>) {
  return commentParts(comment)
    .map((p) => p.text)
    .join('');
}

/** Grey bubble with the comment text; mentions in blue. "Comment deleted" when deleted. */
export function CommentBubble({ comment }: { comment: Comment | null | undefined }) {
  if (!comment || comment.deleted) {
    return (
      <View style={[styles.bubble, styles.bubbleDeleted]}>
        <Text style={styles.deletedText}>Comment deleted</Text>
      </View>
    );
  }
  return (
    <View style={styles.bubble}>
      <Text style={styles.bubbleText}>
        {commentParts(comment).map((p, i) => (
          <Text key={i} style={p.mention ? styles.mention : undefined}>
            {p.text}
          </Text>
        ))}
      </Text>
      {comment.editedAt ? <Text style={styles.edited}>Edited</Text> : null}
    </View>
  );
}

/** The sentence: "**Sana** moved **Drag and drop** from To do to Doing". */
function Sentence({
  item,
  meId,
  onCard,
  small,
}: {
  item: ActivityItem;
  meId?: string;
  onCard?: boolean;
  small?: boolean;
}) {
  return (
    <Text style={small ? styles.smallSentence : styles.sentence}>
      <Text style={styles.strong}>{actorName(item, meId)}</Text>{' '}
      {describeActivity(item, meId, onCard).map((p, i) => (
        <Text key={i} style={p.strong ? styles.strong : undefined}>
          {p.text}
        </Text>
      ))}
    </Text>
  );
}

/** One entry on 20 · Board activity. Comment entries show the comment underneath. */
export function BoardActivityRow({
  item,
  meId,
  onPress,
}: {
  item: ActivityItem;
  meId?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${activitySentence(item, meId)}, ${timeAgo(item.createdAt)}`}
      accessibilityHint={onPress ? 'Opens the card' : undefined}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <MemberAvatar name={item.actor.name} seed={item.actor.id} size={30} />
      <View style={styles.flex}>
        <Sentence item={item} meId={meId} />
        {item.type === 'comment.created' ? <CommentBubble comment={item.comment} /> : null}
        <Text style={styles.time}>{timeAgo(item.createdAt)}</Text>
      </View>
    </Pressable>
  );
}

/**
 * One entry on the card's "Comments and activity". Comments get the author, time and bubble
 * (long-press for Edit / Delete); other changes are a single small line.
 */
export function CardTimelineRow({
  item,
  meId,
  onCommentLongPress,
}: {
  item: ActivityItem;
  meId?: string;
  onCommentLongPress?: (comment: Comment) => void;
}) {
  if (item.type === 'comment.created') {
    const comment = item.comment;
    const canAct = !!comment && !comment.deleted && !!onCommentLongPress;
    return (
      <Pressable
        onLongPress={canAct ? () => onCommentLongPress!(comment!) : undefined}
        delayLongPress={350}
        disabled={!canAct}
        accessibilityHint={canAct ? 'Long-press for edit and delete' : undefined}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
        <MemberAvatar name={item.actor.name} seed={item.actor.id} size={30} />
        <View style={styles.flex}>
          <Text style={styles.meta}>
            <Text style={styles.strong}>
              {item.actor.id === meId ? 'You' : firstName(item.actor.name)}
            </Text>
            {` · ${timeAgo(item.createdAt)}`}
          </Text>
          <CommentBubble comment={comment} />
        </View>
      </Pressable>
    );
  }
  return (
    <View
      style={styles.change}
      accessible
      accessibilityLabel={`${activitySentence(item, meId, true)}, ${timeAgo(item.createdAt)}`}>
      <Feather name="arrow-right" size={14} color={colors.muted} style={styles.changeIcon} />
      <Text style={[styles.flex, styles.smallSentence]}>
        <Sentence item={item} meId={meId} onCard small />
        <Text style={styles.time}>{` · ${timeAgo(item.createdAt)}`}</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.sm },
  pressed: { opacity: 0.7 },
  sentence: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.ink },
  smallSentence: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.muted },
  strong: { fontFamily: fonts.semibold, color: colors.ink },
  meta: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  time: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 },
  bubble: {
    marginTop: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.control,
    backgroundColor: colors.background,
    alignSelf: 'stretch',
  },
  bubbleDeleted: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.divider },
  bubbleText: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.ink },
  mention: { fontFamily: fonts.medium, color: colors.primary },
  edited: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted, marginTop: 2 },
  deletedText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.muted,
    fontStyle: 'italic',
  },
  change: { flexDirection: 'row', gap: spacing.sm, paddingVertical: 6, paddingLeft: 8 },
  changeIcon: { marginTop: 2 },
});
