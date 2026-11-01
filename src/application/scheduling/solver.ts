export type Day = "MON" | "TUE" | "WED" | "THU" | "FRI";
export type Placement = { session_id: string; day: Day; start_period: number; room_id: string };
export type ExamPlacement = { exam_id: string; day: string; session: string; rooms: string[] };
export type BookingDecision = { request_id: string; status: "approved" | "rejected" | "alternative_offered"; day?: Day; start_period?: number; end_period?: number; room_id?: string; reason: string };
export type HeldSlot = { room_id: string; day: Day; start_period: number; end_period: number };
type Room = { id:string; name:string; type:string; capacity:number; features:string[]; accessible:boolean; allowed_uses:string[] };
type Faculty = { id:string; max_hours_per_day?:number; unavailable?:Array<{day:Day;periods:number[]}>; preferences?:Array<{type:string;days?:Day[];periods:number[]}> };
type Session = { id:string; course_id:string; kind:string; groups:string[]; faculty_id:string; size:number; duration:number; room_types:string[]; needs_accessible?:boolean; basket_slot?:string|null; fixed_slot?:{day:Day;start_period:number}|null };
type Exam = { id:string; groups:string[]; size:number };
type Request = { id:string; submitted_at:string; role:string; requested_category:string; title:string; attendance:number; duration_periods:number; windows:Array<{day:Day;from_period:number;to_period:number}>; room_types:string[]; needs:string[]; requested_room?:string|null; mandatory_for_groups:string[]; honor_requested_category?: boolean };
export type CitDataset = { dataset_id:string; calendar:{days:Day[];lab_start_periods:number[];lunch:{after_period:number};exam_week:{days:string[];sessions:Array<{id:string}>}}; priority_order:string[]; role_category_cap:Record<string,string>; rooms:Room[]; faculty:Faculty[]; sessions:Session[]; exams?:Exam[]; booking_requests?:Request[]; cancellations?:Array<{request_id:string}>; room_unavailability?:Array<{room_id:string;day:Day;periods:number[]}> };
export type Disruption = { changes:Array<Record<string,unknown>> };

type Unit = { key:string; sessions:Session[]; hardness:number };
type State = { room:Set<string>; faculty:Set<string>; group:Set<string>; facultyDay:Map<string,number>; groupDay:Map<string,Set<number>>; courseDay:Set<string> };

const key = (...parts:(string|number)[]) => parts.join("|");
const periods = (start:number,duration:number) => Array.from({length:duration},(_,i)=>start+i);

export function applyDisruption(source:CitDataset, disruption?:Disruption):CitDataset {
  if (!disruption) return structuredClone(source);
  const data = structuredClone(source);
  for (const raw of disruption.changes) {
    const change = raw as Record<string,any>;
    if (change.type === "faculty_unavailable") {
      const faculty = data.faculty.find((f)=>f.id===change.faculty_id);
      if (!faculty) throw new Error(`Unknown faculty ${change.faculty_id}`);
      faculty.unavailable ??= [];
      for (const day of change.days) faculty.unavailable.push({day,periods:change.periods});
    } else if (change.type === "room_unavailable") {
      data.room_unavailability ??= [];
      for (const day of change.days) data.room_unavailability.push({room_id:change.room_id,day,periods:change.periods});
    } else if (change.type === "add_faculty") data.faculty.push(change.faculty);
    else if (change.type === "add_session") data.sessions.push(change.session);
    else if (change.type === "remove_session") data.sessions = data.sessions.filter((s)=>s.id!==change.session_id);
    else throw new Error(`Unknown disruption type ${String(change.type)}`);
  }
  return data;
}

function unitsFor(data:CitDataset):Unit[] {
  const grouped = new Map<string,Session[]>();
  for (const session of data.sessions) {
    const unitKey = session.basket_slot ? `basket:${session.basket_slot}` : `session:${session.id}`;
    const list = grouped.get(unitKey) ?? []; list.push(session); grouped.set(unitKey,list);
  }
  const rooms = data.rooms;
  return [...grouped].map(([unitKey,sessions])=>{
    const eligible = Math.min(...sessions.map((s)=>rooms.filter((r)=>r.capacity>=s.size&&s.room_types.includes(r.type)&&(!s.needs_accessible||r.accessible)).length));
    const groups = new Set(sessions.flatMap((s)=>s.groups)).size;
    const duration = Math.max(...sessions.map((s)=>s.duration));
    return {key:unitKey,sessions,hardness:(20-eligible)*100+groups*25+duration*50+sessions.length*80+(sessions.some((s)=>s.fixed_slot)?10000:0)};
  });
}

function makeState():State { return {room:new Set(),faculty:new Set(),group:new Set(),facultyDay:new Map(),groupDay:new Map(),courseDay:new Set()}; }
function unavailableMaps(data:CitDataset) {
  const faculty = new Set<string>(), room = new Set<string>();
  for (const f of data.faculty) for (const u of f.unavailable??[]) for (const p of u.periods) faculty.add(key(f.id,u.day,p));
  for (const u of data.room_unavailability??[]) for (const p of u.periods) room.add(key(u.room_id,u.day,p));
  return {faculty,room};
}
function canTime(data:CitDataset, state:State, unit:Unit, day:Day, start:number, un:{faculty:Set<string>;room:Set<string>}):boolean {
  const basket = unit.key.startsWith("basket:");
  const internalFaculty = new Set<string>();
  for (const s of unit.sessions) {
    const ps=periods(start,s.duration);
    if (start<1||ps.at(-1)!>9||ps.includes(5)&&ps.includes(6)) return false;
    if (s.kind==="lab"&&!data.calendar.lab_start_periods.includes(start)) return false;
    if (s.fixed_slot&&(s.fixed_slot.day!==day||s.fixed_slot.start_period!==start)) return false;
    const daily=state.facultyDay.get(key(s.faculty_id,day))??0;
    const max=data.faculty.find((f)=>f.id===s.faculty_id)?.max_hours_per_day??4;
    if(daily+s.duration>max||internalFaculty.has(s.faculty_id)) return false;
    internalFaculty.add(s.faculty_id);
    for(const p of ps){
      if(state.faculty.has(key(s.faculty_id,day,p))||un.faculty.has(key(s.faculty_id,day,p))) return false;
      for(const g of s.groups) if(state.group.has(key(g,day,p))) return false;
    }
  }
  if(!basket){
    const seen=new Set<string>();
    for(const s of unit.sessions) for(const g of s.groups) if(seen.has(g)) return false; else seen.add(g);
  }
  return true;
}
function roomOptions(data:CitDataset,state:State,s:Session,day:Day,start:number,un:{faculty:Set<string>;room:Set<string>}):Room[]{
  return data.rooms.filter((r)=>r.capacity>=s.size&&s.room_types.includes(r.type)&&(!s.needs_accessible||r.accessible)&&periods(start,s.duration).every((p)=>!state.room.has(key(r.id,day,p))&&!un.room.has(key(r.id,day,p))))
    .sort((a,b)=>(a.capacity-s.size)-(b.capacity-s.size)||a.id.localeCompare(b.id));
}
function assignRooms(data:CitDataset,state:State,unit:Unit,day:Day,start:number,un:{faculty:Set<string>;room:Set<string>},baseline:Map<string,Placement>):Map<string,string>|null{
  const ordered=[...unit.sessions].sort((a,b)=>roomOptions(data,state,a,day,start,un).length-roomOptions(data,state,b,day,start,un).length||b.size-a.size);
  const chosen=new Map<string,string>(), used=new Set<string>();
  const place=(i:number):boolean=>{
    if(i===ordered.length)return true;
    const s=ordered[i];
    const options=roomOptions(data,state,s,day,start,un).sort((a,b)=>(a.id===baseline.get(s.id)?.room_id?-1:0)-(b.id===baseline.get(s.id)?.room_id?-1:0));
    for(const room of options){
      if(used.has(room.id))continue; used.add(room.id);chosen.set(s.id,room.id);
      if(place(i+1))return true; used.delete(room.id);chosen.delete(s.id);
    }
    return false;
  };
  return place(0)?chosen:null;
}
function timeScore(data:CitDataset,state:State,unit:Unit,day:Day,start:number,baseline:Map<string,Placement>,seed:number):number{
  let score=0;
  for(const s of unit.sessions){
    const base=baseline.get(s.id);
    if(base){ if(base.day!==day||base.start_period!==start)score+=100000; }
    if(periods(start,s.duration).includes(9))score+=20;
    const f=data.faculty.find((x)=>x.id===s.faculty_id);
    for(const pref of f?.preferences??[]) if(pref.type==="avoid"&&(!pref.days||pref.days.includes(day))) score+=2*periods(start,s.duration).filter((p)=>pref.periods.includes(p)).length;
    if(state.courseDay.has(key(s.groups.join(","),s.course_id,day)))score+=12;
    for(const g of s.groups){const occupied=state.groupDay.get(key(g,day));if(occupied?.size){const min=Math.min(...occupied),max=Math.max(...occupied);score+=Math.max(0,Math.abs(start-min)-2)+Math.max(0,Math.abs(start-max)-4);}}
  }
  return score+((seed*1103515245+start*97+day.charCodeAt(0))>>>0)%11;
}
function commit(state:State,unit:Unit,day:Day,start:number,rooms:Map<string,string>):Placement[]{
  const result:Placement[]=[];
  for(const s of unit.sessions){const rid=rooms.get(s.id)!;result.push({session_id:s.id,day,start_period:start,room_id:rid});state.facultyDay.set(key(s.faculty_id,day),(state.facultyDay.get(key(s.faculty_id,day))??0)+s.duration);state.courseDay.add(key(s.groups.join(","),s.course_id,day));for(const p of periods(start,s.duration)){state.room.add(key(rid,day,p));state.faculty.add(key(s.faculty_id,day,p));for(const g of s.groups){state.group.add(key(g,day,p));const gd=state.groupDay.get(key(g,day))??new Set<number>();gd.add(p);state.groupDay.set(key(g,day),gd);}}}
  return result;
}

export function generateTimetable(source:CitDataset, options:{baseline?:Placement[];disruption?:Disruption;attempts?:number}={}):{data:CitDataset;placements:Placement[];moved:number}{
  const data=applyDisruption(source,options.disruption),un=unavailableMaps(data),baseline=new Map((options.baseline??[]).map((p)=>[p.session_id,p]));
  const units=unitsFor(data), attempts=options.attempts??500;
  let best:Placement[]|null=null,bestCount=0;
  for(let attempt=0;attempt<attempts;attempt++){
    const state=makeState(),out:Placement[]=[];
    const anchored=new Set<string>();
    if(baseline.size>0&&attempt<Math.ceil(attempts/2)){
      for(const unit of [...units].sort((a,b)=>b.hardness-a.hardness)){
        const placements=unit.sessions.map((s)=>baseline.get(s.id));
        if(placements.some((p)=>!p))continue;
        const first=placements[0]!;
        if(placements.some((p)=>p!.day!==first.day||p!.start_period!==first.start_period))continue;
        if(!canTime(data,state,unit,first.day,first.start_period,un))continue;
        const exactRooms=new Map<string,string>();let valid=true;
        for(const s of unit.sessions){const p=baseline.get(s.id)!;const room=data.rooms.find((r)=>r.id===p.room_id);if(!room||room.capacity<s.size||!s.room_types.includes(room.type)||(s.needs_accessible&&!room.accessible)||periods(p.start_period,s.duration).some((period)=>state.room.has(key(room.id,p.day,period))||un.room.has(key(room.id,p.day,period)))){valid=false;break;}exactRooms.set(s.id,room.id);}
        if(valid){out.push(...commit(state,unit,first.day,first.start_period,exactRooms));anchored.add(unit.key);}
      }
    }
    const ordered=units.filter((u)=>!anchored.has(u.key)).sort((a,b)=>b.hardness-a.hardness||(((a.key.length*97+attempt*7919)%101)-((b.key.length*97+attempt*3571)%101)));
    let ok=true;
    for(const unit of ordered){
      const fixed=unit.sessions[0].fixed_slot;
      const starts=unit.sessions[0].kind==="lab"?data.calendar.lab_start_periods:[1,2,3,4,5,6,7,8,9];
      const times:(readonly [Day,number])[]=(fixed?[[fixed.day,fixed.start_period] as const]:data.calendar.days.flatMap((d)=>starts.map((p)=>[d,p] as const)))
        .filter(([d,p])=>canTime(data,state,unit,d,p,un))
        .sort((a,b)=>timeScore(data,state,unit,a[0],a[1],baseline,attempt)-timeScore(data,state,unit,b[0],b[1],baseline,attempt));
      let placed=false;
      for(const [day,start] of times){const rooms=assignRooms(data,state,unit,day,start,un,baseline);if(!rooms)continue;out.push(...commit(state,unit,day,start,rooms));placed=true;break;}
      if(!placed){ok=false;break;}
    }
    if(out.length>bestCount){best=out;bestCount=out.length;}
    if(ok&&out.length===data.sessions.length){
      const moved=out.filter((p)=>{const b=baseline.get(p.session_id);return b&&(b.day!==p.day||b.start_period!==p.start_period||b.room_id!==p.room_id);}).length;
      return {data,placements:out.sort((a,b)=>a.session_id.localeCompare(b.session_id)),moved};
    }
  }
  throw new Error(`Unable to build a conflict-free timetable; placed ${bestCount}/${data.sessions.length} sessions after ${attempts} attempts`);
}

export function scheduleExams(data:CitDataset):ExamPlacement[]{
  const exams=[...(data.exams??[])].sort((a,b)=>b.size-a.size||b.groups.length-a.groups.length), roomUse=new Set<string>(),groupUse=new Set<string>(),groupDay=new Map<string,number>();
  const slots=data.calendar.exam_week.days.flatMap((day)=>data.calendar.exam_week.sessions.map((s)=>({day,session:s.id})));const out:ExamPlacement[]=[];
  for(const exam of exams){let best:{day:string;session:string;rooms:string[];score:number}|null=null;
    for(const slot of slots){if(exam.groups.some((g)=>groupUse.has(key(g,slot.day,slot.session))))continue;const available=data.rooms.filter((r)=>r.allowed_uses.includes("exam")&&!roomUse.has(key(r.id,slot.day,slot.session))).sort((a,b)=>b.capacity-a.capacity);let seats=0;const rooms:string[]=[];for(const r of available){rooms.push(r.id);seats+=Math.floor(r.capacity/2);if(seats>=exam.size)break;}if(seats<exam.size)continue;const score=exam.groups.reduce((n,g)=>n+(groupDay.get(key(g,slot.day))??0)*100,0)+rooms.length*5+slots.indexOf(slot);if(!best||score<best.score)best={...slot,rooms,score};}
    if(!best)throw new Error(`No valid exam slot for ${exam.id}`);out.push({exam_id:exam.id,day:best.day,session:best.session,rooms:best.rooms});for(const r of best.rooms)roomUse.add(key(r,best.day,best.session));for(const g of exam.groups){groupUse.add(key(g,best.day,best.session));groupDay.set(key(g,best.day),(groupDay.get(key(g,best.day))??0)+1);}}
  return out;
}

function effectiveCategory(data:CitDataset,request:Request){if(request.honor_requested_category&&data.priority_order.includes(request.requested_category))return request.requested_category;const cap=data.role_category_cap[request.role]??"club_event";const requested=data.priority_order.indexOf(request.requested_category);return data.priority_order[Math.max(requested<0?data.priority_order.length-1:requested,data.priority_order.indexOf(cap))];}
export function decideBookings(data:CitDataset,placements:Placement[],held:HeldSlot[]=[]):BookingDecision[]{
  const sessions=new Map(data.sessions.map((s)=>[s.id,s])),busy=new Set<string>(),groupBusy=new Set<string>(),cancelled=new Set((data.cancellations??[]).map((c)=>c.request_id));
  for(const p of placements){const s=sessions.get(p.session_id)!;for(const period of periods(p.start_period,s.duration)){busy.add(key(p.room_id,p.day,period));for(const g of s.groups)groupBusy.add(key(g,p.day,period));}}
  for(const slot of held){for(const period of periods(slot.start_period,slot.end_period-slot.start_period+1))busy.add(key(slot.room_id,slot.day,period));}
  const requests=[...(data.booking_requests??[])].sort((a,b)=>data.priority_order.indexOf(effectiveCategory(data,a))-data.priority_order.indexOf(effectiveCategory(data,b))||a.submitted_at.localeCompare(b.submitted_at));const decisions=new Map<string,BookingDecision>();
  const roomsFor=(req:Request)=>data.rooms.filter((r)=>r.allowed_uses.includes("event")&&req.room_types.includes(r.type)&&r.capacity>=req.attendance&&req.needs.every((n)=>n==="accessible"?r.accessible:r.features.includes(n))).sort((a,b)=>(a.id===req.requested_room?-1:0)-(b.id===req.requested_room?-1:0)||(a.capacity-req.attendance)-(b.capacity-req.attendance));
  const fits=(req:Request,room:Room,day:Day,start:number)=>periods(start,req.duration_periods).every((p)=>p<=13&&!busy.has(key(room.id,day,p))&&!req.mandatory_for_groups.some((g)=>groupBusy.has(key(g,day,p)))&&!(data.room_unavailability??[]).some((u)=>u.room_id===room.id&&u.day===day&&u.periods.includes(p)));
  for(const req of requests){
    if(cancelled.has(req.id)){
      decisions.set(req.id,{request_id:req.id,status:"rejected",reason:"Request was cancelled by the requester."});
      continue;
    }
    let found:{room:Room;day:Day;start:number;approved:boolean}|null=null;
    const rooms=roomsFor(req);
    requested: for(const window of req.windows){
      for(let start=window.from_period;start+req.duration_periods-1<=window.to_period;start++){
        for(const room of rooms){
          if(fits(req,room,window.day,start)){
            found={room,day:window.day,start,approved:true};
            break requested;
          }
        }
      }
    }
    if(!found){
      alternative: for(const day of data.calendar.days){
        for(let start=10;start+req.duration_periods-1<=13;start++){
          for(const room of rooms){
            if(fits(req,room,day,start)){
              found={room,day,start,approved:false};
              break alternative;
            }
          }
        }
      }
    }
    if(found){
      for(const p of periods(found.start,req.duration_periods))busy.add(key(found.room.id,found.day,p));
      decisions.set(req.id,{request_id:req.id,status:found.approved?"approved":"alternative_offered",day:found.day,start_period:found.start,end_period:found.start+req.duration_periods-1,room_id:found.room.id,reason:found.approved?`${found.room.name} satisfies capacity, features and the requested window.`:`Requested windows were unavailable; ${found.room.name} is the nearest conflict-free alternative.`});
    }else{
      decisions.set(req.id,{request_id:req.id,status:"rejected",reason:rooms.length?"No conflict-free venue and time could satisfy this request.":"No campus venue satisfies the required type, capacity and features."});
    }
  }
  return (data.booking_requests??[]).map((r)=>decisions.get(r.id)!);
}

export function buildSchedule(data:CitDataset,options:{baseline?:Placement[];disruption?:Disruption}={}){
  const solved=generateTimetable(data,options);const exams=scheduleExams(solved.data),bookings=decideBookings(solved.data,solved.placements);
  return {team:"TechZephyr",dataset_id:solved.data.dataset_id,sessions:solved.placements,fest_week:{bookings,session_overrides:[]},exams};
}
