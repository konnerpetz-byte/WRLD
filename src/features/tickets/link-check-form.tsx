import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Paste a ticket link, find out if it's the real one. Plain GET form: works without JavaScript and results are shareable. */
export function LinkCheckForm({ value = "" }: { value?: string }) {
  return (
    <form method="get" action="/tickets/check" className="flex flex-col gap-3 sm:flex-row">
      <label htmlFor="url" className="sr-only">
        Ticket website
      </label>
      <Input
        id="url"
        name="url"
        type="text"
        inputMode="url"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        required
        defaultValue={value}
        placeholder="Paste a ticket link, like louvre-tickets.org"
        className="h-12 flex-1 rounded-full px-5"
      />
      <Button type="submit" size="lg" className="h-12 rounded-full px-7 text-base">
        Is it official?
      </Button>
    </form>
  );
}
