import { AlertIcon, CheckIcon } from "./icons";

export function Feedback({ tone = "info", title, children }: { tone?: "success" | "error" | "info"; title: string; children?: React.ReactNode }) {
  return <div className={`feedback ${tone}`} role={tone === "error" ? "alert" : "status"}>
    <span className="feedback-icon">{tone === "success" ? <CheckIcon/> : <AlertIcon/>}</span>
    <div><strong>{title}</strong>{children && <p>{children}</p>}</div>
  </div>;
}

export function StepHeader({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return <header className="route-head"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{copy}</p></div><span className="verified"><CheckIcon/> Deterministic validation</span></header>;
}
