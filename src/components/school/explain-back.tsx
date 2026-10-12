"use client";

import { useEffect, useRef, useState } from "react";

const MAX_SECONDS = 60;

/**
 * Explain It Back — "Can you explain today's lesson out loud?" 60-second
 * voice self-test (the protégé effect). Text fallback always works —
 * typed explanations save as .txt into the class files folder.
 */
export function ExplainBack({
  childId,
  classId,
  topic,
}: {
  childId: string;
  classId: string;
  topic: string;
}) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedMode, setSavedMode] = useState<"voice" | "text" | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [textMode, setTextMode] = useState(false);
  const [explanation, setExplanation] = useState("");
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  const stopTimer = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const stopRecording = () => {
    stopTimer();
    try {
      mediaRef.current?.stop();
    } catch {
      // already stopped
    }
    setRecording(false);
  };

  async function startRecording() {
    setMicError(null);
    setSaveError(null);
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== "function"
    ) {
      setMicError(
        "Voice recording needs a secure (HTTPS) connection here — you can write your explanation below instead."
      );
      setTextMode(true);
      return;
    }
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        setAudioUrl(URL.createObjectURL(blob));
        stream?.getTracks().forEach((t) => t.stop());
      };
      mediaRef.current = mr;
      mr.start();
      setRecording(true);
      setSeconds(0);
      setSaved(false);
      setSavedMode(null);
      timerRef.current = window.setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_SECONDS) {
            stopRecording();
            return MAX_SECONDS;
          }
          return s + 1;
        });
      }, 1000);
    } catch (err) {
      stream?.getTracks().forEach((t) => t.stop());
      const name = err instanceof Error ? err.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        setMicError(
          "Microphone access was blocked — check your browser permissions (look for the mic icon in the address bar), then try again."
        );
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        setMicError("No microphone was found on this device. You can write your explanation below instead.");
        setTextMode(true);
      } else {
        setMicError("Couldn't start the microphone. You can write your explanation below instead.");
        setTextMode(true);
      }
    }
  }

  function discard() {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setSeconds(0);
    setSaved(false);
    setSavedMode(null);
    setSaveError(null);
  }

  async function uploadFile(blob: Blob, name: string) {
    const form = new FormData();
    form.append("file", new File([blob], name, { type: blob.type }));
    const res = await fetch(`/api/v1/children/${childId}/school/classes/${classId}/uploads`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) throw new Error("upload_failed");
  }

  async function saveRecording() {
    if (chunksRef.current.length === 0) return;
    setUploading(true);
    setSaveError(null);
    try {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      await uploadFile(blob, `explain-back-${Date.now()}.webm`);
      setSaved(true);
      setSavedMode("voice");
    } catch {
      setSaveError("Couldn't save — check your connection and try again.");
    } finally {
      setUploading(false);
    }
  }

  async function saveText() {
    const text = explanation.trim();
    if (!text) return;
    setUploading(true);
    setSaveError(null);
    try {
      const header = `Explain it back — ${topic}\n${new Date().toLocaleString("en-US")}\n\n`;
      await uploadFile(new Blob([header + text], { type: "text/plain" }), `explain-back-${Date.now()}.txt`);
      setSaved(true);
      setSavedMode("text");
    } catch {
      setSaveError("Couldn't save — check your connection and try again.");
    } finally {
      setUploading(false);
    }
  }

  useEffect(
    () => () => {
      stopTimer();
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    },
    [audioUrl]
  );

  const mm = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  const wordCount = explanation.trim() === "" ? 0 : explanation.trim().split(/\s+/).length;

  return (
    <div className="card-living rounded-2xl border border-nova-400/20 px-5 py-4">
      <h3 className="flex items-center gap-2 text-sm font-bold text-star-100">
        <span aria-hidden="true">🎙️</span> Explain It Back
      </h3>
      <p className="mt-1 text-xs leading-relaxed text-stardust-300">
        Can you teach <span className="font-semibold text-star-100">{topic}</span> to someone who
        missed class? Record 60 seconds — gaps in your explanation are gaps in your understanding.
      </p>

      {micError && (
        <div className="mt-3 rounded-xl border border-aurum-400/30 bg-aurum-400/5 px-3.5 py-2.5">
          <p className="text-xs text-star-100">{micError}</p>
          <button
            type="button"
            onClick={startRecording}
            className="mt-1.5 text-xs font-bold text-star-100 underline underline-offset-2"
          >
            Try Again
          </button>
        </div>
      )}

      {!recording && !audioUrl && !textMode && (
        <button
          type="button"
          onClick={startRecording}
          className="btn-dapple mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-nebula-950 transition-transform hover:scale-[1.01]"
        >
          🎙️ Start 60-Second Self-Test
        </button>
      )}

      {recording && (
        <div className="mt-3 flex items-center justify-between rounded-xl border border-nova-400/10 bg-nebula-800/60 p-3">
          <div className="flex items-center gap-2">
            <span className="relative flex size-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-aurum-400 opacity-60" />
              <span className="relative inline-flex size-3 rounded-full bg-aurum-400" />
            </span>
            <span className="font-mono text-sm font-bold text-star-100">{mm}</span>
          </div>
          <button
            type="button"
            onClick={stopRecording}
            className="rounded-xl border border-nova-400/20 px-4 py-1.5 text-xs font-bold text-star-100"
          >
            ■ Stop
          </button>
        </div>
      )}

      {!recording && audioUrl && !textMode && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2 rounded-xl border border-nova-400/10 bg-nebula-800/60 p-3">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <audio src={audioUrl} controls className="h-8 w-full" />
            <span className="font-mono text-xs text-stardust-300">{mm}</span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={saveRecording}
              disabled={uploading || saved}
              className="btn-dapple flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold text-nebula-950 disabled:opacity-60"
            >
              {saved ? "✓ Saved" : uploading ? "Saving…" : "Save Recording"}
            </button>
            <button
              type="button"
              onClick={discard}
              aria-label="Discard recording"
              className="rounded-xl border border-nova-400/20 px-3.5 text-stardust-300 hover:text-star-100"
            >
              🗑️
            </button>
          </div>
        </div>
      )}

      {!recording && !textMode && (
        <button
          type="button"
          onClick={() => {
            setTextMode(true);
            setMicError(null);
          }}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-nova-400/15 py-2.5 text-xs font-semibold text-stardust-300 hover:text-star-100"
        >
          ✏️ Or Write Your Explanation
        </button>
      )}

      {!recording && textMode && (
        <div className="mt-3 space-y-2">
          <textarea
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            maxLength={2000}
            rows={4}
            placeholder={`Explain ${topic} like you're teaching a friend…`}
            className="input-rooted w-full rounded-xl px-3.5 py-2.5 text-sm"
          />
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-stardust-400">
              {wordCount} words · aim for ~100 words, about 60 seconds of speech
            </span>
            <div className="flex gap-2">
              {!audioUrl && (
                <button
                  type="button"
                  onClick={() => {
                    setTextMode(false);
                    setExplanation("");
                    setSaved(false);
                    setSavedMode(null);
                  }}
                  className="rounded-xl border border-nova-400/15 px-3.5 py-2 text-xs font-semibold text-stardust-300"
                >
                  Back to Voice
                </button>
              )}
              <button
                type="button"
                onClick={saveText}
                disabled={uploading || saved || explanation.trim() === ""}
                className="btn-dapple rounded-xl px-4 py-2 text-xs font-bold text-nebula-950 disabled:opacity-60"
              >
                {saved ? "✓ Saved" : uploading ? "Saving…" : "Save Explanation"}
              </button>
            </div>
          </div>
        </div>
      )}

      {saveError && <p className="mt-2 text-xs text-aurum-300">⚠️ {saveError}</p>}
      {saved && savedMode && (
        <p className="mt-2 text-xs text-stardust-300">
          ✓ {savedMode === "voice" ? "Voice" : "Written"} explanation saved to your class files.
          Listen back in a week — you&apos;ll hear how far you&apos;ve come.
        </p>
      )}
    </div>
  );
}
