import { QuizStepper } from "@/features/traveler-profile/quiz-stepper";

export const metadata = { title: "Travel type quiz" };

export default function QuizPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <p className="mb-8 text-muted-foreground">
        Ten quick questions. Your answers place you on the travel compass and shape the activities we suggest.
      </p>
      <QuizStepper />
    </div>
  );
}
