"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUserId } from "@/lib/supabase/server";
import { QUIZ, QUIZ_VERSION, scoreQuiz } from "./quiz";

export type QuizState = { error?: string };

export async function saveQuiz(_: QuizState, formData: FormData): Promise<QuizState> {
  const answers = z.record(z.string(), z.string()).parse(Object.fromEntries(formData));
  const valid = Object.fromEntries(
    QUIZ.filter((q) => q.options.some((o) => o.id === answers[q.id])).map((q) => [q.id, answers[q.id]]),
  );
  if (Object.keys(valid).length < QUIZ.length) return { error: "Answer every question to see your travel type." };

  const result = scoreQuiz(valid);
  const { supabase, userId } = await requireUserId();

  const { error } = await supabase
    .from("traveler_profiles")
    .update({
      compass_x: result.x,
      compass_y: result.y,
      quiz_version: QUIZ_VERSION,
      quiz_answers: valid,
      quiz_completed_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
  if (error) return { error: "We couldn't save your results. Try again." };

  // Replace quiz-sourced interests; keep ones the user set by hand.
  await supabase.from("traveler_interests").delete().eq("user_id", userId).eq("source", "quiz");
  const rows = Object.entries(result.interests).map(([tag_slug, weight]) => ({ user_id: userId, tag_slug, weight, source: "quiz" as const }));
  if (rows.length) await supabase.from("traveler_interests").upsert(rows, { onConflict: "user_id,tag_slug", ignoreDuplicates: true });

  revalidatePath("/profile");
  redirect("/profile?new=1");
}
