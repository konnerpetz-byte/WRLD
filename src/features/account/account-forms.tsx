"use client";

import { Camera, Trash2 } from "lucide-react";
import { useActionState, useRef, useState } from "react";

import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import type { AccountDetails, Country, Currency } from "@/types/database";
import {
  changeEmail,
  changePassword,
  deleteAccount,
  setAvatar,
  updateDetails,
  updateProfile,
  type AccountState,
} from "./actions";

function Status({ state }: { state: AccountState }) {
  if (state.error)
    return (
      <p role="alert" className="text-sm text-destructive">
        {state.error}
      </p>
    );
  if (state.message)
    return (
      <p role="status" className="text-sm text-primary">
        {state.message}
      </p>
    );
  return null;
}

// ---------------------------------------------------------------------------
export function AvatarUpload({ userId, name, url }: { userId: string; name: string; url: string | null }) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(url);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return setError("Use a JPG, PNG or WebP photo.");
    if (file.size > 5 * 1024 * 1024) return setError("That photo is over 5 MB.");
    setBusy(true);
    const supabase = createClient();
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `${userId}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) {
      setBusy(false);
      return setError("Upload failed. Try again.");
    }
    const publicUrl = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
    const result = await setAvatar(publicUrl);
    if (result.error) setError(result.error);
    else {
      setPreview(publicUrl);
      // Clean up older photos in your folder.
      const { data: files } = await supabase.storage.from("avatars").list(userId);
      const old = (files ?? []).map((f) => `${userId}/${f.name}`).filter((p) => p !== path);
      if (old.length) await supabase.storage.from("avatars").remove(old);
    }
    setBusy(false);
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar name={name} url={preview} size={72} />
      <div className="grid gap-1.5">
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()}>
            <Camera aria-hidden="true" /> {busy ? "Uploading…" : preview ? "Change photo" : "Add a photo"}
          </Button>
          {preview && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={async () => {
                const r = await setAvatar(null);
                if (!r.error) setPreview(null);
              }}
            >
              <Trash2 aria-hidden="true" /> Remove
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">JPG, PNG or WebP, up to 5 MB. People on your trips see it.</p>
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        aria-label="Choose a profile photo"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
export function ProfileForm({
  profile,
  countries,
  currencies,
}: {
  profile: { display_name: string | null; home_country: string | null; home_currency: string; home_airport: string | null };
  countries: Country[];
  currencies: Currency[];
}) {
  const [state, action, pending] = useActionState<AccountState, FormData>(updateProfile, {});
  return (
    <form action={action} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="display_name">Name</Label>
        <Input id="display_name" name="display_name" defaultValue={profile.display_name ?? ""} autoComplete="name" required maxLength={80} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="home_country">Home country</Label>
          <NativeSelect id="home_country" name="home_country" defaultValue={profile.home_country ?? ""}>
            <option value="">Choose</option>
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="home_currency">Home currency</Label>
          <NativeSelect id="home_currency" name="home_currency" defaultValue={profile.home_currency}>
            {currencies.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="home_airport">Home airport</Label>
          <Input id="home_airport" name="home_airport" defaultValue={profile.home_airport ?? ""} placeholder="DTW" maxLength={3} className="uppercase" />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        <Status state={state} />
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
export function EmailForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState<AccountState, FormData>(changeEmail, {});
  return (
    <form action={action} className="grid gap-2">
      <Label htmlFor="email">Email</Label>
      <div className="flex flex-wrap gap-2">
        <Input id="email" name="email" type="email" defaultValue={email} autoComplete="email" required className="max-w-sm" />
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Sending…" : "Change email"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">You sign in with this. We&rsquo;ll send a link to confirm a new address.</p>
      <Status state={state} />
    </form>
  );
}

// ---------------------------------------------------------------------------
export function DetailsForm({ details, countries }: { details: AccountDetails | null; countries: Country[] }) {
  const [state, action, pending] = useActionState<AccountState, FormData>(updateDetails, {});
  return (
    <form action={action} className="grid gap-4">
      <div className="grid gap-2 sm:max-w-sm">
        <Label htmlFor="phone">Phone</Label>
        <Input id="phone" name="phone" type="tel" defaultValue={details?.phone ?? ""} autoComplete="tel" placeholder="+1 313 555 0100" />
      </div>
      <fieldset className="grid gap-3">
        <legend className="mb-1 text-sm font-medium">Home address</legend>
        <Label htmlFor="address_line1" className="sr-only">
          Street address
        </Label>
        <Input id="address_line1" name="address_line1" defaultValue={details?.address_line1 ?? ""} autoComplete="address-line1" placeholder="Street address" />
        <Label htmlFor="address_line2" className="sr-only">
          Apartment, suite, unit
        </Label>
        <Input id="address_line2" name="address_line2" defaultValue={details?.address_line2 ?? ""} autoComplete="address-line2" placeholder="Apartment, suite (optional)" />
        <div className="grid gap-3 sm:grid-cols-[1fr_10rem_8rem]">
          <div className="grid gap-1.5">
            <Label htmlFor="city" className="text-xs">
              City
            </Label>
            <Input id="city" name="city" defaultValue={details?.city ?? ""} autoComplete="address-level2" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="region" className="text-xs">
              State / region
            </Label>
            <Input id="region" name="region" defaultValue={details?.region ?? ""} autoComplete="address-level1" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="postal_code" className="text-xs">
              ZIP / postal code
            </Label>
            <Input id="postal_code" name="postal_code" defaultValue={details?.postal_code ?? ""} autoComplete="postal-code" />
          </div>
        </div>
        <div className="grid gap-1.5 sm:max-w-xs">
          <Label htmlFor="country_code" className="text-xs">
            Country
          </Label>
          <NativeSelect id="country_code" name="country_code" defaultValue={details?.country_code ?? ""} autoComplete="country">
            <option value="">Choose</option>
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </div>
      </fieldset>
      <p className="text-xs text-muted-foreground">Only you can see your phone number and address.</p>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        <Status state={state} />
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
export function PasswordForm() {
  const [state, action, pending] = useActionState<AccountState, FormData>(changePassword, {});
  return (
    <form action={action} className="grid gap-3 sm:max-w-sm">
      <div className="grid gap-2">
        <Label htmlFor="password">New password</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="confirm-password">Type it again</Label>
        <Input id="confirm-password" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Saving…" : "Change password"}
        </Button>
        <Status state={state} />
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
export function DeleteAccountForm({ ownedSharedTrips }: { ownedSharedTrips: string[] }) {
  const [state, action, pending] = useActionState<AccountState, FormData>(deleteAccount, {});
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button type="button" variant="outline" className="border-destructive/50 text-destructive" onClick={() => setOpen(true)}>
        Delete my account
      </Button>
    );
  }
  return (
    <form action={action} className="grid gap-3">
      <p className="text-sm">This permanently deletes:</p>
      <ul className="list-disc pl-5 text-sm text-muted-foreground">
        <li>your profile and photo</li>
        <li>trips you created, with everything planned on them</li>
        <li>your points wallet, travel type and saved spots</li>
      </ul>
      {ownedSharedTrips.length > 0 && (
        <p className="rounded-md bg-travel-soft p-3 text-sm">
          You created {ownedSharedTrips.join(", ")}, which other people are on. {ownedSharedTrips.length === 1 ? "It" : "They"} will be deleted for them too.
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        Messages and expenses you added to other people&rsquo;s trips stay, shown as &ldquo;Former member&rdquo;. This can&rsquo;t be undone.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="confirm-delete">Type DELETE to confirm</Label>
          <Input id="confirm-delete" name="confirm" autoComplete="off" className="w-44" />
        </div>
        <Button type="submit" variant="destructive" disabled={pending}>
          {pending ? "Deleting…" : "Delete account"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      <Status state={state} />
    </form>
  );
}
