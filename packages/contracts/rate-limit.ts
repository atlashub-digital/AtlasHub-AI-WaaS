// Bounded fixed-window limiter. Expiry work runs once per window, never on every request.
export class RateLimiter {
 private entries = new Map<string,{count:number;until:number}>();
 private sweepAt = 0;
 constructor(private maxEntries=10000,private windowMs=60000) {}
 check(key:string,limit:number,now=Date.now()) {
  if(now>=this.sweepAt){for(const [k,v] of this.entries)if(v.until<=now)this.entries.delete(k);this.sweepAt=now+this.windowMs;}
  let e=this.entries.get(key);
  if(e&&e.until<=now){this.entries.delete(key);e=undefined;}
  if(!e){if(this.entries.size>=this.maxEntries)return {allowed:false,retryAfter:Math.max(1,Math.ceil((this.sweepAt-now)/1000))};e={count:0,until:now+this.windowMs};this.entries.set(key,e);}
  e.count++;
  return {allowed:e.count<=limit,retryAfter:Math.max(1,Math.ceil((e.until-now)/1000))};
 }
 get size(){return this.entries.size;}
}
