"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/components/ui";
import type { Role } from "@prisma/client";

type Msg = { role: "user" | "assistant"; content: string };
type Lang = "en" | "fr" | "ar";

function asLang(code: string): Lang {
  return code === "fr" || code === "ar" ? code : "en";
}

const STRINGS: Record<Lang, {
  title: string;
  subtitle: string;
  placeholder: string;
  send: string;
  greeting: (first: string) => string;
  error: string;
}> = {
  en: {
    title: "AI Assistant",
    subtitle: "Here to help",
    placeholder: "Ask anything…",
    send: "Send",
    greeting: (f) => `Hi ${f}! I'm your exam assistant. Ask me how to do something in the app, or to create questions and exams.`,
    error: "Sorry, something went wrong. Please try again.",
  },
  fr: {
    title: "Assistant IA",
    subtitle: "Là pour aider",
    placeholder: "Posez votre question…",
    send: "Envoyer",
    greeting: (f) => `Bonjour ${f} ! Je suis votre assistant d'examens. Demandez-moi comment faire, ou de créer des questions et des examens.`,
    error: "Désolé, une erreur s'est produite. Réessayez.",
  },
  ar: {
    title: "المساعد الذكي",
    subtitle: "في خدمتك",
    placeholder: "اكتب سؤالك…",
    send: "إرسال",
    greeting: (f) => `مرحباً ${f}! أنا مساعدك للامتحانات. اسألني كيف تنجز مهمة، أو أن أنشئ أسئلة وامتحانات.`,
    error: "عذراً، حدث خطأ ما. حاول مرة أخرى.",
  },
};

const SUGGESTIONS: Record<Lang, Partial<Record<Role, string[]>>> = {
  en: {
    ADMIN: ["How do I add a school?", "How do I approve a new user?", "Where do I see orders and payment proofs?"],
    TEACHER: ["Build a 10-question algebra quiz", "Add 5 easy MCQs about fractions to my bank", "How does auto vs. manual grading work?"],
  },
  fr: {
    ADMIN: ["Comment ajouter une école ?", "Comment approuver un nouvel utilisateur ?", "Où voir les commandes et les preuves de paiement ?"],
    TEACHER: ["Crée un quiz d'algèbre de 10 questions", "Ajoute 5 QCM faciles sur les fractions à ma banque", "Comment fonctionne la correction auto/manuelle ?"],
  },
  ar: {
    ADMIN: ["كيف أضيف مدرسة؟", "كيف أوافق على مستخدم جديد؟", "أين أرى الطلبات وإثباتات الدفع؟"],
    TEACHER: ["أنشئ اختبار جبر من ١٠ أسئلة", "أضف ٥ أسئلة اختيار من متعدد سهلة عن الكسور إلى بنكي", "كيف يعمل التصحيح التلقائي مقابل اليدوي؟"],
  },
};

export function ChatWidget({
  userName,
  role,
  lang: langCode,
}: {
  userName: string;
  role: Role;
  lang: string;
}) {
  const lang = asLang(langCode);
  const t = STRINGS[lang];
  const rtl = lang === "ar";
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const greeting = t.greeting(userName.split(" ")[0] || "");
  const suggestions = SUGGESTIONS[lang][role] ?? SUGGESTIONS.en[role] ?? [];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, open]);

  async function send(textArg?: string) {
    const text = (textArg ?? input).trim();
    if (!text || busy) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);
    setMessages((m) => [...m, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      if (!res.body) {
        const txt = await res.text();
        setMessages((m) => updateLast(m, txt || "…"));
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((m) => updateLast(m, acc));
      }
      if (!acc) setMessages((m) => updateLast(m, "…"));
    } catch {
      setMessages((m) => updateLast(m, t.error));
    } finally {
      setBusy(false);
    }
  }

  function updateLast(m: Msg[], content: string): Msg[] {
    const copy = m.slice();
    for (let i = copy.length - 1; i >= 0; i--) {
      if (copy[i].role === "assistant") {
        copy[i] = { ...copy[i], content };
        break;
      }
    }
    return copy;
  }

  return (
    <>
      {/* Launcher */}
      <button
        type="button"
        aria-label={t.title}
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white shadow-lg transition hover:bg-blue-700"
      >
        {open ? (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 10.5h8M8 14h5M21 12c0 4.418-4.03 8-9 8a9.8 9.8 0 0 1-4-.84L3 20l1.3-3.5A7.6 7.6 0 0 1 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8Z" />
          </svg>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div
          dir={rtl ? "rtl" : "ltr"}
          className="fixed bottom-24 right-5 z-50 flex h-[32rem] max-h-[75vh] w-[22rem] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
        >
          <div className="flex items-center gap-2 bg-brand px-4 py-3 text-white">
            <span className="text-lg">🤖</span>
            <div>
              <div className="text-sm font-semibold">{t.title}</div>
              <div className="text-xs text-blue-100">{t.subtitle}</div>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-gray-50 p-3">
            <Bubble role="assistant" content={greeting} />
            {messages.length === 0 && (
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="rounded-full border border-blue-200 bg-white px-3 py-1.5 text-start text-xs font-medium text-brand hover:bg-blue-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            {messages.map((m, i) => (
              <Bubble key={i} role={m.role} content={m.content || (busy ? "…" : "")} />
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex items-end gap-2 border-t border-gray-200 p-2"
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              placeholder={t.placeholder}
              className="max-h-28 flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {t.send}
            </button>
          </form>
        </div>
      )}
    </>
  );
}

function Bubble({ role, content }: { role: "user" | "assistant"; content: string }) {
  return (
    <div className={cn("flex", role === "user" ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm",
          role === "user"
            ? "bg-brand text-white"
            : "border border-gray-200 bg-white text-gray-800",
        )}
      >
        {content}
      </div>
    </div>
  );
}
