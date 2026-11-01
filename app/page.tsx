"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <>
      <h1>
        Trick or <span>Commit</span> 🎃
      </h1>
      <p className="lead">
        Your Petdex pet goes door to door through your GitHub repos.
        <br />
        Active repos hand out treats. Abandoned ones… play tricks.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const u = name.trim().replace(/^@/, "");
          if (!u) return;
          setBusy(true);
          router.push(`/u/${encodeURIComponent(u)}`);
        }}
      >
        <input
          aria-label="GitHub username"
          placeholder="github username"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <button disabled={busy}>{busy ? "Knocking…" : "Knock knock"}</button>
      </form>
    </>
  );
}
