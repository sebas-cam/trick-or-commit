"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { isValidUsername } from "@/lib/github";
import { UI, type Lang } from "@/lib/i18n";

export default function KnockForm({ lang }: { lang: Lang }) {
  const ui = UI[lang];
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [invalid, setInvalid] = useState(false);

  return (
    <form
      className="knock"
      onSubmit={(e) => {
        e.preventDefault();
        const u = name.trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?github\.com\//i, "").split("/")[0];
        if (!isValidUsername(u)) { setInvalid(true); return; }
        setBusy(true);
        router.push(`/u/${encodeURIComponent(u)}?lang=${lang}`);
      }}
    >
      <label className="field">
        <span>github.com/</span>
        <input
          aria-label={ui.usernameLabel}
          aria-invalid={invalid}
          placeholder={ui.placeholder}
          value={name}
          onChange={(e) => { setName(e.target.value); setInvalid(false); }}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
      </label>
      <button disabled={busy}>{busy ? ui.knocking : ui.knock}</button>
      {invalid && <p className="note" role="alert">{ui.invalid}</p>}
    </form>
  );
}
