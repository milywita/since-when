export type PartnerReactionCategory =
  | "finallyDone"
  | "startTheThing"
  | "explainYourself"
  | "stillNotDone"
  | "painfullyImpressive";

export type PartnerReactionTone =
  | "formal"
  | "mystic"
  | "cute"
  | "sarcastic";

export type PartnerReactionTemplate = {
  id: PartnerReactionCategory;
  emoji: string;
  title: string;
  description: string;
  replies: {
    formal: string[];
    mystic: string[];
    cute: string[];
    sarcastic: string[];
  };
};

export const PARTNER_REACTION_TEMPLATES: PartnerReactionTemplate[] = [
  {
    id: "finallyDone",
    emoji: "👏",
    title: "Finally Done",
    description: "For when partner completed a task.",
    replies: {
      formal: ["Task completed. Good work."],
      mystic: ["The quest is complete. The path is clear again."],
      cute: ["Yayyy, you actually did it :D"],
      sarcastic: [
        "Look at you escaping your own todo list.",
        "The checkbox has been fed. Crisis postponed.",
      ],
    },
  },
  {
    id: "startTheThing",
    emoji: "🔥",
    title: "Start The Thing",
    description: "For pushing partner to start the task.",
    replies: {
      formal: ["Please start this task now."],
      mystic: ["The first step awaits. Begin the quest."],
      cute: ["Tiny start now, okay? ^^"],
      sarcastic: [
        "Start before your brain invents a fake emergency.",
        "The task is untouched and the evidence is damning.",
      ],
    },
  },
  {
    id: "explainYourself",
    emoji: "👀",
    title: "Explain Yourself",
    description: "For suspicious pauses, disappearing, or avoiding the task.",
    replies: {
      formal: ["What happened here?"],
      mystic: ["The oracle requires your account."],
      cute: ["Bestie… where did you go? :)"],
      sarcastic: [
        "No progress, but incredible commitment to silence.",
        "You vanished so hard even the task felt abandoned.",
      ],
    },
  },
  {
    id: "stillNotDone",
    emoji: "💀",
    title: "Still Not Done?",
    description: "For overdue tasks or tasks taking way too long.",
    replies: {
      formal: ["This task is still unfinished."],
      mystic: ["The quest remains unresolved."],
      cute: ["It’s still waiting for you… sadly :<"],
      sarcastic: [
        "End its suffering. Finish the task.",
        "This task has lived long enough to develop trust issues.",
      ],
    },
  },
  {
    id: "painfullyImpressive",
    emoji: "🫡",
    title: "Painfully Impressive",
    description: "For hard tasks, serious effort, or finally pushing through.",
    replies: {
      formal: ["Strong effort. Well done."],
      mystic: ["A difficult trial was endured with honor."],
      cute: ["That looked hard. Proud of you ^^"],
      sarcastic: [
        "Respect. You suffered with structure.",
        "That was painful to witness, but weirdly impressive.",
      ],
    },
  },
];

export function getPartnerReactionById(categoryId: PartnerReactionCategory) {
  return PARTNER_REACTION_TEMPLATES.find((reaction) => reaction.id === categoryId);
}

export function getPartnerReactionReplies(
  categoryId: PartnerReactionCategory,
  tone: PartnerReactionTone,
): string[] {
  const reaction = getPartnerReactionById(categoryId);
  return reaction?.replies[tone] ?? [];
}

export function getRandomPartnerReactionReply(
  categoryId: PartnerReactionCategory,
  tone: PartnerReactionTone,
): string | null {
  const replies = getPartnerReactionReplies(categoryId, tone);

  if (replies.length === 0) {
    return null;
  }

  const randomIndex = Math.floor(Math.random() * replies.length);
  return replies[randomIndex];
}
