"use client";
import { ChangeEvent, useState } from "react";
import Link from "next/link";
import { api, uuidv7 } from "../../lib/api";
import type { DisruptionFile } from "../../lib/types";
import { UploadIcon, WrenchIcon } from "../../components/ui/icons";
import { Feedback, StepHeader } from "../../components/ui/feedback";
export default function Repair() {
  const [baseline,setBaseline]=useState(""),[dataset,setDataset]=useState("");
  const [disruption,setDisruption]=useState<DisruptionFile|null>(null),[fileName,setFileName]=useState("");
  const [error,setError]=useState(""),[busy,setBusy]=useState(false),[job,setJob]=useState("");
  const [changePrompt,setChangePrompt]=useState("F07 will be unavailable on Monday for the whole teaching day due to conference travel.");
  async function choose(e:ChangeEvent<HTMLInputElement>){
    const file=e.target.files?.[0];if(!file)return;
    try{const parsed=JSON.parse(await file.text()) as DisruptionFile;if(!Array.isArray(parsed.changes))throw new Error("The file needs a changes array.");setDisruption(parsed);setFileName(file.name);setError("");}
    catch(err){setError(err instanceof Error?err.message:"Invalid change file");}
  }
  async function parseChange(){
    setBusy(true);setError("");
    const r=await api<{draft:{changes:NonNullable<DisruptionFile["changes"]>;follow_up:string|null}}>("/api/v1/ai/schedule-change-drafts",{method:"POST",body:JSON.stringify({text:changePrompt})});
    setBusy(false);
    if(!r.data){setError(`${r.error??"AI parsing unavailable"} Upload a change file instead.`);return;}
    if(r.data.draft.follow_up){setError(r.data.draft.follow_up);return;}
    setDisruption({changes:r.data.draft.changes});setFileName("AI-created editable draft");
  }
  async function submit(){
    if(!disruption)return;setBusy(true);
    const r=await api<{jobId:string}>("/api/v1/schedules/repair",{method:"POST",headers:{"idempotency-key":uuidv7()},body:JSON.stringify({baselineScheduleId:baseline,datasetVersionId:dataset,disruption})});
    setBusy(false);if(!r.data){setError(r.error??"Repair could not start");return;}setJob(r.data.jobId);
  }
  return <main className="route">
    <StepHeader eyebrow="ADMIN · SCHEDULE CHANGES" title="Repair a disrupted timetable" copy="Describe a change or upload the official format. The engine moves as few sessions as possible."/>
    <section className="form-layout">
      <div className="form-card">
        <div className="section-title"><span className="card-icon violet"><WrenchIcon/></span><div><h2>Repair inputs</h2><p>Changes are proposed first and never applied automatically.</p></div></div>
        <div className="two-fields"><label>Approved baseline ID<input value={baseline} onChange={e=>setBaseline(e.target.value.trim())} placeholder="Approved schedule UUID"/></label><label>Dataset version ID<input value={dataset} onChange={e=>setDataset(e.target.value.trim())} placeholder="Dataset version UUID"/></label></div>
        <label>Describe a faculty or room change<textarea value={changePrompt} onChange={e=>setChangePrompt(e.target.value)}/></label>
        <button className="secondary" onClick={parseChange} disabled={busy}>Create editable change draft</button>
        <p className="or-divider">or upload the official change format</p>
        <label className={`dropzone compact ${disruption?"selected":""}`}><UploadIcon/><strong>{disruption?fileName:"Choose disruption JSON"}</strong><span>{disruption?`${disruption.changes?.length??0} changes found`:"sample_disruption.json or a judge-provided file"}</span><input type="file" accept="application/json,.json" onChange={choose}/></label>
        {disruption&&<div className="change-list">{disruption.changes?.map((change,i)=><div key={i}><b>{i+1}</b><span><strong>{change.type?.replaceAll("_"," ")??"Change"}</strong><small>{change.reason??"No reason provided"}</small></span></div>)}</div>}
        <button className="primary wide" disabled={busy||!baseline||!dataset||!disruption} onClick={submit}>{busy?"Finding minimum-change repair…":"Propose repair"}</button>
        {error&&<Feedback tone="error" title="Repair input needs attention">{error}</Feedback>}
        {job&&<Feedback tone="success" title="Repair queued">Track job {job.slice(0,8)}… in <Link href={`/jobs?id=${job}`}>Operations</Link>.</Feedback>}
      </div>
      <aside className="info-card"><p className="eyebrow">SAFE CHANGE CONTROL</p><div className="stat-callout"><strong>Fewest moves</strong><p>The repair objective preserves the approved baseline wherever possible.</p></div><div className="stat-callout"><strong>Exact diff</strong><p>Moved sessions show old and new slots before approval.</p></div><div className="stat-callout"><strong>Admin gate</strong><p>Validated proposals require a different Admin to approve.</p></div></aside>
    </section>
  </main>;
}
